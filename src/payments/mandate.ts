import { randomUUID } from "node:crypto";
import {
  ExperienceContextShippingPreference,
  PaypalPaymentTokenCustomerType,
  PaypalPaymentTokenUsageType,
  UsagePattern,
  VaultTokenRequestType,
  type VaultController,
} from "@paypal/paypal-server-sdk";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mandates, type MandateStatus } from "@/db/schema";
import { callPayPal, PayPalRequestError } from "@/paypal/errors";

/**
 * US1 Mandate: the user saves their PayPal once in the PayPal vault
 * ("Save PayPal for purchase later", Payment Method Tokens API v3):
 *   1. create a setup token → PayPal returns an `approve` link;
 *   2. the payer approves on www.sandbox.paypal.com and comes back;
 *   3. exchange the approved setup token for a payment token (the mandate).
 * Docs: https://developer.paypal.com/api/payment-tokens/save-without-purchase/paypal
 */

/** The only host Leash ever redirects a payer to for approval. */
export const PAYPAL_SANDBOX_APPROVAL_HOST = "www.sandbox.paypal.com";

export type MandateDeps = {
  db: Db;
  vault: Pick<VaultController, "createSetupToken" | "createPaymentToken">;
  now?: () => Date;
};

/** What the UI may see. Never contains the vault payment token. */
export type MandateView = {
  status: MandateStatus | "NONE";
  connectedAt?: Date;
  /** REVOKED, but PayPal has not confirmed deleting the saved token yet. */
  deletionPending?: boolean;
};

export class MandateError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_ACTIVE"
      | "NO_PENDING_MANDATE"
      | "SETUP_TOKEN_MISMATCH"
      | "UNEXPECTED_PAYPAL_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "MandateError";
  }
}

function latestMandate(db: Db, userId: string, status?: MandateStatus) {
  return db
    .select()
    .from(mandates)
    .where(
      status
        ? and(eq(mandates.userId, userId), eq(mandates.status, status))
        : eq(mandates.userId, userId),
    )
    .orderBy(desc(mandates.createdAt))
    .get();
}

export function getMandateView(db: Db, userId: string): MandateView {
  const mandate = latestMandate(db, userId);
  if (!mandate) return { status: "NONE" };
  return {
    status: mandate.status,
    connectedAt: mandate.status === "ACTIVE" ? mandate.updatedAt : undefined,
    deletionPending: mandate.status === "REVOKED" && Boolean(mandate.vaultTokenRef),
  };
}

/** Server-only: the payment token to charge, if the mandate is active. */
export function getActiveVaultToken(db: Db, userId: string): string | undefined {
  return latestMandate(db, userId, "ACTIVE")?.vaultTokenRef ?? undefined;
}

/** Step 1: creates a setup token and returns the PayPal approval URL. */
export async function startMandate(
  deps: MandateDeps,
  input: { userId: string; returnUrl: string; cancelUrl: string },
): Promise<{ approveUrl: string }> {
  const now = deps.now ?? (() => new Date());

  if (latestMandate(deps.db, input.userId, "ACTIVE")) {
    throw new MandateError(
      "ALREADY_ACTIVE",
      "PayPal is already connected for this user.",
    );
  }

  const mandateId = randomUUID();
  const { result } = await callPayPal(() =>
    deps.vault.createSetupToken({
      // Idempotency: retrying this exact request never creates a second token.
      paypalRequestId: `${mandateId}-setup`,
      body: {
        paymentSource: {
          paypal: {
            description: "Leash spending mandate (PayPal sandbox)",
            // Variable amounts at varying times, charged only when the
            // user's rules allow it.
            usagePattern: UsagePattern.Immediate,
            // Leash's own demo store is the merchant that charges.
            usageType: PaypalPaymentTokenUsageType.Merchant,
            customerType: PaypalPaymentTokenCustomerType.Consumer,
            // Every demo visitor is a different Leash customer, even when
            // several judges approve with the same sandbox account (D-040):
            // "Use this also when multiple payment tokens are required for
            // the same payer, different customer at merchant/platform."
            // So one visitor revoking never deletes another visitor's token.
            permitMultiplePaymentTokens: true,
            experienceContext: {
              brandName: "Leash Demo Store",
              // No shipping address is ever collected or stored (privacy).
              shippingPreference: ExperienceContextShippingPreference.NoShipping,
              returnUrl: input.returnUrl,
              cancelUrl: input.cancelUrl,
            },
          },
        },
      },
    }),
  );

  const approveUrl = result.links?.find((link) => link.rel === "approve")?.href;
  if (!result.id || !approveUrl) {
    throw new MandateError(
      "UNEXPECTED_PAYPAL_RESPONSE",
      "PayPal did not return a setup token with an approval link.",
    );
  }
  // Sandbox guard for redirects: only ever send the payer to PayPal sandbox.
  const parsed = new URL(approveUrl);
  if (parsed.protocol !== "https:" || parsed.host !== PAYPAL_SANDBOX_APPROVAL_HOST) {
    throw new MandateError(
      "UNEXPECTED_PAYPAL_RESPONSE",
      `PayPal approval link is not on ${PAYPAL_SANDBOX_APPROVAL_HOST}.`,
    );
  }

  const timestamp = now();
  // A new attempt replaces any earlier one the payer never finished.
  cancelPendingMandate(deps.db, input.userId);
  deps.db
    .insert(mandates)
    .values({
      id: mandateId,
      userId: input.userId,
      status: "PENDING",
      setupTokenId: result.id,
      paypalCustomerId: result.customer?.id ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  return { approveUrl };
}

/**
 * Step 3: after the payer approved on PayPal, saves the payment token.
 * Uses the setup token Leash stored itself, not a value from the URL.
 */
export async function completeMandate(
  deps: MandateDeps,
  input: {
    userId: string;
    /** `approval_token_id` from PayPal's return URL, if present. */
    approvalTokenId?: string | null;
  },
): Promise<MandateView> {
  const now = deps.now ?? (() => new Date());
  const pending = latestMandate(deps.db, input.userId, "PENDING");
  if (!pending?.setupTokenId) {
    throw new MandateError(
      "NO_PENDING_MANDATE",
      "There is no PayPal connection waiting for approval.",
    );
  }
  // Defence in depth: the return URL must refer to the setup token we created.
  if (input.approvalTokenId && input.approvalTokenId !== pending.setupTokenId) {
    throw new MandateError(
      "SETUP_TOKEN_MISMATCH",
      "The PayPal approval does not match the pending connection.",
    );
  }

  const { result } = await callPayPal(() =>
    deps.vault.createPaymentToken({
      paypalRequestId: `${pending.id}-payment-token`,
      body: {
        paymentSource: {
          token: { id: pending.setupTokenId!, type: VaultTokenRequestType.SetupToken },
        },
      },
    }),
  );

  if (!result.id) {
    throw new MandateError(
      "UNEXPECTED_PAYPAL_RESPONSE",
      "PayPal did not return a payment token.",
    );
  }

  const timestamp = now();
  deps.db
    .update(mandates)
    .set({
      status: "ACTIVE",
      vaultTokenRef: result.id,
      paypalCustomerId: result.customer?.id ?? pending.paypalCustomerId,
      updatedAt: timestamp,
    })
    .where(eq(mandates.id, pending.id))
    .run();

  return { status: "ACTIVE", connectedAt: timestamp };
}

/** The payer cancelled on PayPal: drop the pending attempt. */
export function cancelPendingMandate(db: Db, userId: string): void {
  db.delete(mandates)
    .where(and(eq(mandates.userId, userId), eq(mandates.status, "PENDING")))
    .run();
}

export type RevokeDeps = {
  db: Db;
  vault: Pick<VaultController, "deletePaymentToken">;
  now?: () => Date;
};

export type RevokeResult =
  /** Leash stopped using it and PayPal deleted the saved token. */
  | "REVOKED"
  /** Leash stopped using it, but PayPal could not delete the token yet. */
  | "PAYPAL_FAILED"
  | "NOT_CONNECTED";

/**
 * US7: the user revokes the mandate (D-038).
 * Docs: DELETE /v3/vault/payment-tokens/{id} (204, no body),
 * https://developer.paypal.com/docs/api/payment-tokens/v3/
 *
 * 1. Leash marks it REVOKED first, so it is never charged again, whatever
 *    PayPal answers next.
 * 2. Then it asks PayPal to delete the vault token, and forgets the token
 *    once PayPal confirms. If PayPal fails, the token stays stored only so
 *    the deletion can be tried again (the same call retries it).
 *
 * The sandbox answers 204 even for a token that does not exist (checked on
 * Oct 18), so deleting twice is safe; a 404 counts as deleted too.
 */
export async function revokeMandate(deps: RevokeDeps, userId: string): Promise<RevokeResult> {
  const now = deps.now ?? (() => new Date());
  const usable = and(eq(mandates.userId, userId), inArray(mandates.status, ["ACTIVE", "PAUSED"]));
  const active = deps.db.select({ id: mandates.id }).from(mandates).where(usable).all().length > 0;
  if (active) {
    deps.db.update(mandates).set({ status: "REVOKED", updatedAt: now() }).where(usable).run();
  }
  const toDelete = deps.db
    .select()
    .from(mandates)
    .where(and(eq(mandates.userId, userId), eq(mandates.status, "REVOKED"), isNotNull(mandates.vaultTokenRef)))
    .all();
  if (toDelete.length === 0) return active ? "REVOKED" : "NOT_CONNECTED";

  let result: RevokeResult = "REVOKED";
  for (const mandate of toDelete) {
    try {
      await callPayPal(() => deps.vault.deletePaymentToken(mandate.vaultTokenRef!));
    } catch (error) {
      if (!(error instanceof PayPalRequestError && error.failure.status === 404)) {
        console.error("[mandate] PayPal could not delete the vault token:", (error as Error).name);
        result = "PAYPAL_FAILED";
        continue;
      }
    }
    deps.db
      .update(mandates)
      .set({ vaultTokenRef: null, updatedAt: now() })
      .where(eq(mandates.id, mandate.id))
      .run();
  }
  return result;
}
