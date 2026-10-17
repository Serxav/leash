import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Catalog } from "@/catalog/catalog";
import { cleanText, PRODUCT_ID_PATTERN } from "@/catalog/product";
import type { Db } from "@/db/client";
import {
  decisions,
  payments,
  purchaseIntents,
  securityEvents,
  type PaymentStatus,
} from "@/db/schema";
import type { ChargeInput, PaymentView } from "@/payments/charge";
import { getMandateView } from "@/payments/mandate";
import { countsTowardBudget, decide, type Decision, type Outcome } from "@/rules/engine";
import { getActivePolicy } from "@/rules/policies";
import { normalizeMerchantDomain, type RuleId } from "@/rules/schema";
import { injectionEvent, logInjection } from "@/security/events";
import { screenProduct } from "@/security/untrusted-text";

/**
 * The purchase flow (brief §4). THE AI PROPOSES, THE CODE DECIDES:
 * 1. the agent proposes a product, an offer (its merchant), a quantity and
 *    a reason — never a price;
 * 2. the server re-reads price, merchant and category from the catalog;
 *    a product whose shop text carries instructions for AI agents is
 *    blocked here, whatever the rules say (US8);
 * 3. the policy engine decides with the user's confirmed rules;
 * 4. the intent and the decision are stored;
 * 5. only APPROVE charges, with the saved PayPal, merchant-initiated.
 *    NEEDS_APPROVAL waits for the user (inbox, F4); BLOCK is only stored.
 *
 * One user's proposals run one at a time, so two at once can never both
 * pass the budget: a charge is recorded before the next decision starts.
 */

export const MAX_REASON_LENGTH = 300;
export const MAX_PROPOSAL_QUANTITY = 1000;

export type ProposalInput = {
  userId: string;
  productId: string;
  merchantDomain: string;
  quantity: number;
  reason: string;
};

export type ProposalResult = {
  outcome: Outcome;
  explanation: string;
  orderTotal: string | null;
  /** What PayPal did, for approved purchases only. */
  paymentStatus?: PaymentStatus;
  /**
   * Leash's own reference for the stored proposal (the intent ID), so the
   * agent can check it later. Not a PayPal ID.
   */
  purchaseRef?: string;
};

export type ProposeDeps = {
  db: Db;
  catalog: Pick<Catalog, "getProduct">;
  /** Charges an approved purchase (chargeWithMandate in the app). */
  charge: (input: ChargeInput) => Promise<PaymentView>;
  now?: () => Date;
};

const inputSchema = z.object({
  userId: z.string().min(1).max(64),
  productId: z.string().regex(PRODUCT_ID_PATTERN),
  merchantDomain: z.string().max(253),
  quantity: z.int().min(1).max(MAX_PROPOSAL_QUANTITY),
  // Long reasons are capped below, not refused; this only stops huge strings.
  reason: z.string().max(10_000),
});

const blocked = (explanation: string): Decision => ({
  outcome: "BLOCK",
  ruleIds: ["valid_request"],
  explanation,
  orderTotal: null,
});

/** Runs one user's work one at a time (single server process, D-029). */
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(userId) ?? Promise.resolve();
  const next = previous.then(work, work);
  const settled = next.catch(() => undefined);
  queues.set(userId, settled);
  void settled.then(() => {
    if (queues.get(userId) === settled) queues.delete(userId);
  });
  return next;
}

export async function proposePurchase(
  deps: ProposeDeps,
  raw: ProposalInput,
): Promise<ProposalResult> {
  const parsed = inputSchema.safeParse(raw);
  const merchant = parsed.success ? normalizeMerchantDomain(parsed.data.merchantDomain) : null;
  if (!parsed.success || !merchant) {
    // Not stored: there is no valid product or shop to record.
    return {
      outcome: "BLOCK",
      explanation: "Blocked: the proposal is not valid, so Leash did not check it.",
      orderTotal: null,
    };
  }
  const input = { ...parsed.data, merchantDomain: merchant };
  const reason = cleanText(input.reason, MAX_REASON_LENGTH) || "No reason given.";
  const now = deps.now ?? (() => new Date());

  return oneAtATime(input.userId, async () => {
    // 2. Re-read from the catalog: never trust the model's numbers.
    const product = await deps.catalog.getProduct(input.productId);
    const offer = product?.offers.find((o) => o.merchantDomain === input.merchantDomain) ?? null;
    const injection = product ? screenProduct(product) : [];
    const policy = getActivePolicy(deps.db, input.userId);
    const at = now();

    // 3. Decide. From here to recording the charge there is no await, so the
    // next proposal always sees this one's payment in the budget.
    let decision: Decision;
    if (!product) {
      decision = blocked("Blocked: Leash could not check this product's current price, so it did not buy it.");
    } else if (injection.length > 0) {
      decision = {
        outcome: "BLOCK",
        ruleIds: ["untrusted_instructions"],
        explanation:
          "Blocked: this product's shop text contains instructions for AI agents (a prompt injection), so Leash never buys it.",
        orderTotal: null,
      };
    } else if (!offer) {
      decision = blocked(`Blocked: ${input.merchantDomain} does not sell this product in euros right now.`);
    } else if (!policy) {
      decision = blocked("Blocked: you have not confirmed any spending rules yet.");
    } else {
      decision = decide(
        policy.rules,
        {
          unitPrice: offer.unitPrice,
          quantity: input.quantity,
          currency: offer.currency,
          category: product.category,
          parentCategories: product.parentCategories,
          merchantDomain: offer.merchantDomain,
        },
        {
          mandate: getMandateView(deps.db, input.userId).status,
          agentPaused: false, // the pause switch arrives in F4 (US7)
          spending: budgetSpending(deps.db, input.userId),
          now: at,
        },
      );
    }

    // 4. Store the intent and the decision together.
    const intentId = randomUUID();
    deps.db.transaction((tx) => {
      tx.insert(purchaseIntents)
        .values({
          id: intentId,
          userId: input.userId,
          productId: input.productId,
          merchantDomain: input.merchantDomain,
          quantity: input.quantity,
          productTitle: product?.title ?? null,
          unitPrice: offer?.unitPrice ?? null,
          currency: offer?.currency ?? null,
          category: product?.category ?? null,
          agentReason: reason,
          createdAt: at,
        })
        .run();
      tx.insert(decisions)
        .values({
          id: randomUUID(),
          intentId,
          outcome: decision.outcome,
          ruleIdsJson: JSON.stringify(decision.ruleIds),
          explanation: decision.explanation,
          decidedBy: "ENGINE",
          policyVersion: policy?.version ?? null,
          orderTotal: decision.orderTotal,
          decidedAt: at,
        })
        .run();
      if (product && injection.length > 0) {
        tx.insert(securityEvents)
          .values(
            injectionEvent({
              userId: input.userId,
              stage: "PROPOSAL",
              product,
              signals: injection,
              merchantDomain: input.merchantDomain,
              intentId,
              at,
            }),
          )
          .run();
      }
    });
    if (product && injection.length > 0) logInjection("PROPOSAL", product.id, injection);

    const result: ProposalResult = {
      outcome: decision.outcome,
      explanation: decision.explanation,
      orderTotal: decision.orderTotal,
      purchaseRef: intentId,
    };
    if (decision.outcome !== "APPROVE" || !decision.orderTotal || !product) return result;

    // 5. Charge. chargeWithMandate records the payment before its first await.
    try {
      const payment = await deps.charge({
        userId: input.userId,
        amount: decision.orderTotal,
        description: `Leash: ${input.quantity} × ${product.title}`,
        initiator: "MERCHANT",
        intentId,
      });
      return { ...result, paymentStatus: payment.status };
    } catch (error) {
      console.error("[purchases] charge failed:", (error as Error).name);
      return { ...result, paymentStatus: "FAILED" };
    }
  });
}

/** Payments that use up this user's budget, for the engine. */
function budgetSpending(db: Db, userId: string): Array<{ amount: string; at: Date }> {
  return db
    .select({ amount: payments.amount, status: payments.status, at: payments.createdAt })
    .from(payments)
    .where(eq(payments.userId, userId))
    .all()
    .filter((payment) => countsTowardBudget(payment.status))
    .map(({ amount, at }) => ({ amount, at }));
}

/** One proposal as the UI shows it. No PayPal IDs. */
export type ProposalView = {
  intentId: string;
  productTitle: string | null;
  merchantDomain: string;
  quantity: number;
  unitPrice: string | null;
  agentReason: string;
  createdAt: Date;
  outcome: Outcome;
  ruleIds: RuleId[];
  explanation: string;
  orderTotal: string | null;
  paymentStatus: PaymentStatus | null;
};

export function listProposals(db: Db, userId: string, limit = 20): ProposalView[] {
  const intents = db
    .select()
    .from(purchaseIntents)
    .where(eq(purchaseIntents.userId, userId))
    .orderBy(desc(purchaseIntents.createdAt))
    .limit(limit)
    .all();
  if (intents.length === 0) return [];
  const ids = intents.map((intent) => intent.id);
  const decisionByIntent = new Map(
    db.select().from(decisions).where(inArray(decisions.intentId, ids)).all()
      .map((row) => [row.intentId, row]),
  );
  const paymentByIntent = new Map(
    db.select().from(payments).where(inArray(payments.intentId, ids)).all()
      .map((row) => [row.intentId, row]),
  );
  return intents.flatMap((intent) => {
    const decision = decisionByIntent.get(intent.id);
    if (!decision) return [];
    let ruleIds: RuleId[] = [];
    try {
      ruleIds = JSON.parse(decision.ruleIdsJson) as RuleId[];
    } catch {
      ruleIds = [];
    }
    return [
      {
        intentId: intent.id,
        productTitle: intent.productTitle,
        merchantDomain: intent.merchantDomain,
        quantity: intent.quantity,
        unitPrice: intent.unitPrice,
        agentReason: intent.agentReason,
        createdAt: intent.createdAt,
        outcome: decision.outcome,
        ruleIds,
        explanation: decision.explanation,
        orderTotal: decision.orderTotal,
        paymentStatus: paymentByIntent.get(intent.id)?.status ?? null,
      },
    ];
  });
}
