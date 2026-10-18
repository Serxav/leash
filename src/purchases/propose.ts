import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isAgentPaused } from "@/account/settings";
import type { Catalog } from "@/catalog/catalog";
import { isLocalProductId } from "@/catalog/local";
import { cleanText, PRODUCT_ID_PATTERN, type CatalogOffer, type CatalogProduct } from "@/catalog/product";
import type { Db } from "@/db/client";
import {
  decisions,
  payments,
  purchaseIntents,
  securityEvents,
  type DecisionRow,
  type PaymentStatus,
  type PurchaseIntent,
} from "@/db/schema";
import type { ChargeInput, PaymentView } from "@/payments/charge";
import { getMandateView } from "@/payments/mandate";
import { countsTowardBudget, decide, type Decision, type Outcome } from "@/rules/engine";
import { getActivePolicy, type ActivePolicy } from "@/rules/policies";
import { normalizeMerchantDomain, type RuleId } from "@/rules/schema";
import { injectionEvent, logInjection } from "@/security/events";
import { screenProduct, type InjectionSignal } from "@/security/untrusted-text";

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

/**
 * Runs one user's work one at a time (single server process, D-029):
 * proposals and the user's answers in the inbox share this queue.
 */
const queues = new Map<string, Promise<unknown>>();
export function oneAtATime<T>(userId: string, work: () => Promise<T>): Promise<T> {
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
    // 2–3. Re-read from the catalog and decide. From the decision to
    // recording the charge there is no await, so the next proposal always
    // sees this one's payment in the budget.
    const { product, offer, injection, policy, decision, at } = await reviewPurchase(
      { ...deps, now },
      input,
    );

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

export type PurchaseReview = {
  product: CatalogProduct | null;
  offer: CatalogOffer | null;
  /** Injection signals in the product's shop text; [] when clean. */
  injection: InjectionSignal[];
  policy: ActivePolicy | null;
  decision: Decision;
  /** When the engine decided. */
  at: Date;
};

/**
 * Re-reads a product from the catalog (never trusting the model's numbers)
 * and decides it with the user's current confirmed rules. Writes nothing.
 * Used for new proposals and again when the user approves one (D-036).
 * Its only await is the catalog re-read, before the decision.
 */
export async function reviewPurchase(
  deps: Pick<ProposeDeps, "db" | "catalog"> & { now: () => Date },
  input: { userId: string; productId: string; merchantDomain: string; quantity: number },
): Promise<PurchaseReview> {
  const product = await deps.catalog.getProduct(input.productId);
  const offer = product?.offers.find((o) => o.merchantDomain === input.merchantDomain) ?? null;
  const injection = product ? screenProduct(product) : [];
  const policy = getActivePolicy(deps.db, input.userId);
  const at = deps.now();

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
        agentPaused: isAgentPaused(deps.db, input.userId),
        spending: budgetSpending(deps.db, input.userId),
        now: at,
      },
    );
  }
  return { product, offer, injection, policy, decision, at };
}

/** Payments that use up this user's budget, for the engine. */
export function budgetSpending(db: Db, userId: string): Array<{ amount: string; at: Date }> {
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
  /** Where the product came from: a real Channel3 offer or the demo catalog. */
  source: CatalogProduct["source"];
  merchantDomain: string;
  quantity: number;
  unitPrice: string | null;
  agentReason: string;
  createdAt: Date;
  outcome: Outcome;
  ruleIds: RuleId[];
  explanation: string;
  /** The engine, or the user answering in the inbox (D-036). */
  decidedBy: DecisionRow["decidedBy"];
  orderTotal: string | null;
  paymentStatus: PaymentStatus | null;
};

/**
 * Each intent's latest decision. An intent has one engine decision, and a
 * second one once the user answers it in the inbox (D-036).
 */
export function latestDecisions(db: Db, intentIds: string[]): Map<string, DecisionRow> {
  if (intentIds.length === 0) return new Map();
  const rows = db
    .select()
    .from(decisions)
    .where(inArray(decisions.intentId, intentIds))
    .orderBy(asc(decisions.decidedAt), sql`rowid`)
    .all();
  // Later rows replace earlier ones.
  return new Map(rows.map((row) => [row.intentId, row]));
}

export function listProposals(db: Db, userId: string, limit = 20): ProposalView[] {
  const intents = db
    .select()
    .from(purchaseIntents)
    .where(eq(purchaseIntents.userId, userId))
    .orderBy(desc(purchaseIntents.createdAt))
    .limit(limit)
    .all();
  return toProposalViews(db, intents);
}

/**
 * Proposals waiting for the user (US5): the engine said NEEDS_APPROVAL and
 * nobody has answered yet. Oldest first, all of them.
 */
export function listPendingApprovals(db: Db, userId: string): ProposalView[] {
  const intents = db
    .select()
    .from(purchaseIntents)
    .where(eq(purchaseIntents.userId, userId))
    .orderBy(asc(purchaseIntents.createdAt))
    .all();
  return toProposalViews(db, intents).filter(
    (view) => view.outcome === "NEEDS_APPROVAL" && view.paymentStatus === null,
  );
}

function toProposalViews(db: Db, intents: PurchaseIntent[]): ProposalView[] {
  if (intents.length === 0) return [];
  const ids = intents.map((intent) => intent.id);
  const decisionByIntent = latestDecisions(db, ids);
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
        source: isLocalProductId(intent.productId) ? "local" : "channel3",
        merchantDomain: intent.merchantDomain,
        quantity: intent.quantity,
        unitPrice: intent.unitPrice,
        agentReason: intent.agentReason,
        createdAt: intent.createdAt,
        outcome: decision.outcome,
        ruleIds,
        explanation: decision.explanation,
        decidedBy: decision.decidedBy,
        orderTotal: decision.orderTotal,
        paymentStatus: paymentByIntent.get(intent.id)?.status ?? null,
      },
    ];
  });
}
