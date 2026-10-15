import { randomUUID } from "node:crypto";
import {
  CaptureStatus,
  CheckoutPaymentIntent,
  OrderStatus,
  PaymentInitiator,
  UsagePattern,
  type OrdersController,
} from "@paypal/paypal-server-sdk";
import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { payments, type Payment, type PaymentStatus } from "@/db/schema";
import { callPayPal, PayPalRequestError } from "@/paypal/errors";
import { getActiveVaultToken } from "./mandate";

/**
 * Charges the user's mandate with PayPal Orders v2: one order with the
 * vaulted payment token (`payment_source.paypal.vault_id`) and intent
 * CAPTURE, which PayPal captures immediately.
 * Docs: https://developer.paypal.com/api/payment-tokens/save-without-purchase/paypal (step 4)
 */

/** Leash only charges euros and never converts currencies (brief §5). */
export const CHARGE_CURRENCY = "EUR";

/** The 14-day return window shown on every purchase (D-008). */
export const RETURN_WINDOW_DAYS = 14;

const AMOUNT_PATTERN = /^(0|[1-9]\d{0,5})\.\d{2}$/;
/** FraudNet session id: 32 lowercase hex characters (max length 32). */
const CLIENT_METADATA_ID_PATTERN = /^[0-9a-f]{32}$/;

export type ChargeDeps = {
  db: Db;
  orders: Pick<OrdersController, "createOrder">;
  now?: () => Date;
};

export type ChargeInput = {
  userId: string;
  /** Decimal string with two decimals, e.g. "5.00". */
  amount: string;
  description: string;
  initiator: "CUSTOMER" | "MERCHANT";
  /**
   * FraudNet session id, sent as PayPal-Client-Metadata-Id. Required when
   * the customer initiates: PayPal requires risk data (RDA) for
   * customer-initiated payments with PayPal payment tokens.
   */
  clientMetadataId?: string;
  intentId?: string;
};

/** What the UI may see about a payment. */
export type PaymentView = Pick<
  Payment,
  | "id"
  | "amount"
  | "currency"
  | "initiator"
  | "status"
  | "paypalOrderId"
  | "captureId"
  | "failureIssue"
  | "debugId"
  | "withdrawalDeadline"
  | "createdAt"
>;

export class ChargeError extends Error {
  constructor(
    public readonly code:
      | "NO_ACTIVE_MANDATE"
      | "INVALID_AMOUNT"
      | "MISSING_RISK_DATA"
      | "INVALID_RISK_DATA",
    message: string,
  ) {
    super(message);
    this.name = "ChargeError";
  }
}

export function toPaymentView(payment: Payment): PaymentView {
  const {
    id, amount, currency, initiator, status, paypalOrderId, captureId,
    failureIssue, debugId, withdrawalDeadline, createdAt,
  } = payment;
  return {
    id, amount, currency, initiator, status, paypalOrderId, captureId,
    failureIssue, debugId, withdrawalDeadline, createdAt,
  };
}

export function listPayments(db: Db, userId: string): PaymentView[] {
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .all()
    .map(toPaymentView);
}

/** A new random FraudNet session id for a page that can start a charge. */
export function newClientMetadataId(): string {
  return randomUUID().replaceAll("-", "");
}

function statusFromCapture(status: CaptureStatus | undefined): PaymentStatus {
  switch (status) {
    case CaptureStatus.Completed:
      return "COMPLETED";
    case CaptureStatus.Pending:
      return "PENDING";
    case CaptureStatus.Declined:
      return "DECLINED";
    default:
      return "FAILED";
  }
}

export async function chargeWithMandate(
  deps: ChargeDeps,
  input: ChargeInput,
): Promise<PaymentView> {
  const now = deps.now ?? (() => new Date());

  if (!AMOUNT_PATTERN.test(input.amount) || Number(input.amount) <= 0) {
    throw new ChargeError("INVALID_AMOUNT", "Amount must look like 5.00 and be above zero.");
  }
  if (input.initiator === "CUSTOMER" && !input.clientMetadataId) {
    throw new ChargeError(
      "MISSING_RISK_DATA",
      "Customer-initiated charges need a FraudNet session id (PayPal RDA).",
    );
  }
  if (input.clientMetadataId && !CLIENT_METADATA_ID_PATTERN.test(input.clientMetadataId)) {
    throw new ChargeError("INVALID_RISK_DATA", "The FraudNet session id is malformed.");
  }

  const vaultId = getActiveVaultToken(deps.db, input.userId);
  if (!vaultId) {
    throw new ChargeError("NO_ACTIVE_MANDATE", "Connect PayPal before charging.");
  }

  // Record the attempt first: its id is the idempotency key for PayPal.
  const paymentId = randomUUID();
  const createdAt = now();
  deps.db
    .insert(payments)
    .values({
      id: paymentId,
      userId: input.userId,
      intentId: input.intentId ?? null,
      amount: input.amount,
      currency: CHARGE_CURRENCY,
      initiator: input.initiator,
      status: "PENDING",
      createdAt,
      updatedAt: createdAt,
    })
    .run();

  const update = (values: Partial<Payment>) => {
    deps.db
      .update(payments)
      .set({ ...values, updatedAt: now() })
      .where(eq(payments.id, paymentId))
      .run();
    return toPaymentView(
      deps.db.select().from(payments).where(eq(payments.id, paymentId)).get()!,
    );
  };

  try {
    const { result: order } = await callPayPal(() =>
      deps.orders.createOrder({
        paypalRequestId: paymentId,
        paypalClientMetadataId: input.clientMetadataId,
        prefer: "return=representation",
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              referenceId: paymentId,
              // invoice_id must be unique: a second charge for the same
              // attempt is rejected by PayPal as DUPLICATE_INVOICE_ID.
              invoiceId: paymentId,
              customId: paymentId,
              description: input.description.slice(0, 127),
              amount: { currencyCode: CHARGE_CURRENCY, value: input.amount },
            },
          ],
          paymentSource: {
            paypal: {
              vaultId,
              storedCredential: {
                paymentInitiator:
                  input.initiator === "CUSTOMER"
                    ? PaymentInitiator.Customer
                    : PaymentInitiator.Merchant,
                usagePattern: UsagePattern.Immediate,
              },
            },
          },
        },
      }),
    );

    const capture = order.purchaseUnits?.[0]?.payments?.captures?.[0];
    const status =
      order.status === OrderStatus.Completed || capture
        ? statusFromCapture(capture?.status)
        : "FAILED";

    return update({
      status,
      paypalOrderId: order.id ?? null,
      captureId: capture?.id ?? null,
      failureIssue:
        status === "COMPLETED" || status === "PENDING"
          ? null
          : (capture?.statusDetails?.reason ?? order.status ?? "UNKNOWN"),
      withdrawalDeadline:
        status === "COMPLETED"
          ? new Date(createdAt.getTime() + RETURN_WINDOW_DAYS * 86_400_000)
          : null,
    });
  } catch (error) {
    if (error instanceof PayPalRequestError) {
      const { issue, name, debugId } = error.failure;
      return update({
        status: issue === "INSTRUMENT_DECLINED" ? "DECLINED" : "FAILED",
        failureIssue: issue ?? name ?? `HTTP_${error.failure.status}`,
        debugId: debugId ?? null,
      });
    }
    // Unknown outcome (network, timeout): keep PENDING so it can be checked
    // with the same PayPal-Request-Id; never assume it was not charged.
    throw error;
  }
}
