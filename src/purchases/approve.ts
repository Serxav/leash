import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { decisions, payments, purchaseIntents, securityEvents, type PaymentStatus } from "@/db/schema";
import { toCents } from "@/lib/money";
import type { Decision } from "@/rules/engine";
import { injectionEvent, logInjection } from "@/security/events";
import { latestDecisions, oneAtATime, reviewPurchase, type ProposeDeps } from "./propose";

/**
 * The approval inbox (US5, D-036): the user answers a purchase the engine
 * sent to them (NEEDS_APPROVAL). Only the user can do this, from the inbox
 * page; the agent has no tool for it.
 *
 * - Reject: stored as the user's decision; nothing is charged.
 * - Approve: the user's yes covers the approval threshold and nothing else.
 *   The server re-reads the product and decides again with the current
 *   rules, mandate and this month's spending, as if it were a new proposal.
 *   A hard rule that now fails blocks it, and so does a total above the one
 *   the user saw. Otherwise it is charged exactly like an approved purchase.
 *
 * Answers run in the same per-user queue as proposals, so a double click or
 * two tabs can never charge twice or both pass the budget.
 */

export type ApprovalChoice = "APPROVE" | "REJECT";

export type ApprovalResult =
  | { result: "NOT_FOUND"; message: string }
  | { result: "ALREADY_ANSWERED"; message: string }
  | { result: "REJECTED"; message: string }
  | { result: "BLOCKED"; message: string }
  | { result: "APPROVED"; message: string; orderTotal: string; paymentStatus: PaymentStatus };

const inputSchema = z.object({
  userId: z.string().min(1).max(64),
  intentId: z.uuid(),
  choice: z.enum(["APPROVE", "REJECT"]),
});

export async function answerApproval(
  deps: ProposeDeps,
  raw: { userId: string; intentId: string; choice: ApprovalChoice },
): Promise<ApprovalResult> {
  const notFound: ApprovalResult = {
    result: "NOT_FOUND",
    message: "There is no purchase waiting for you with this reference.",
  };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return notFound;
  const input = parsed.data;
  const now = deps.now ?? (() => new Date());

  return oneAtATime(input.userId, async () => {
    // Only this user's own purchases; another user's looks like a missing one.
    const intent = deps.db
      .select()
      .from(purchaseIntents)
      .where(and(eq(purchaseIntents.id, input.intentId), eq(purchaseIntents.userId, input.userId)))
      .get();
    if (!intent) return notFound;
    const pending = pendingDecision(deps.db, intent.id);
    if (!pending) {
      return { result: "ALREADY_ANSWERED", message: "This purchase was already answered." };
    }

    if (input.choice === "REJECT") {
      storeDecision(deps.db, intent.id, {
        decision: {
          outcome: "BLOCK",
          ruleIds: ["approval_threshold"],
          explanation: "You rejected it in your inbox, so Leash did not buy it.",
          orderTotal: pending.orderTotal,
        },
        decidedBy: "USER",
        policyVersion: pending.policyVersion,
        at: now(),
      });
      return { result: "REJECTED", message: "Rejected. Nothing was charged." };
    }

    // Approve: decide again with fresh data, like a new proposal.
    const review = await reviewPurchase({ ...deps, now }, intent);
    // The only await is above: check nothing answered it meanwhile.
    if (!pendingDecision(deps.db, intent.id)) {
      return { result: "ALREADY_ANSWERED", message: "This purchase was already answered." };
    }
    const { product, injection, policy, at } = review;
    let decision = review.decision;
    if (
      decision.outcome !== "BLOCK" &&
      (!decision.orderTotal ||
        !pending.orderTotal ||
        toCents(decision.orderTotal) > toCents(pending.orderTotal))
    ) {
      decision = {
        outcome: "BLOCK",
        ruleIds: ["approved_amount"],
        explanation: `Blocked: the price went up to €${decision.orderTotal} after you saw €${pending.orderTotal}, so your approval does not cover it.`,
        orderTotal: decision.orderTotal,
      };
    }
    const approved = decision.outcome !== "BLOCK";
    const total = decision.orderTotal;
    deps.db.transaction((tx) => {
      storeDecision(tx, intent.id, {
        decision: approved
          ? { outcome: "APPROVE", ruleIds: [], explanation: `You approved €${total} in your inbox, after Leash checked the price and your rules again.`, orderTotal: total }
          : decision,
        // A block found now is the engine's; only a yes is the user's.
        decidedBy: approved ? "USER" : "ENGINE",
        policyVersion: policy?.version ?? null,
        at,
      });
      if (product && injection.length > 0) {
        tx.insert(securityEvents)
          .values(
            injectionEvent({
              userId: input.userId,
              stage: "PROPOSAL",
              product,
              signals: injection,
              merchantDomain: intent.merchantDomain,
              intentId: intent.id,
              at,
            }),
          )
          .run();
      }
    });
    if (product && injection.length > 0) logInjection("PROPOSAL", product.id, injection);
    if (!approved || !total || !product) {
      return { result: "BLOCKED", message: decision.explanation };
    }

    // Charge, exactly as for an approved proposal.
    try {
      const payment = await deps.charge({
        userId: input.userId,
        amount: total,
        description: `Leash: ${intent.quantity} × ${product.title}`,
        initiator: "MERCHANT",
        intentId: intent.id,
      });
      return {
        result: "APPROVED",
        message: `Approved and charged €${total} with PayPal (sandbox).`,
        orderTotal: total,
        paymentStatus: payment.status,
      };
    } catch (error) {
      console.error("[purchases] charge after approval failed:", (error as Error).name);
      return {
        result: "APPROVED",
        message: "Approved, but the PayPal payment failed. Nothing was charged.",
        orderTotal: total,
        paymentStatus: "FAILED",
      };
    }
  });
}

/** The intent's engine NEEDS_APPROVAL decision, if nobody answered it yet. */
function pendingDecision(db: Db, intentId: string) {
  const latest = latestDecisions(db, [intentId]).get(intentId);
  if (!latest || latest.outcome !== "NEEDS_APPROVAL" || latest.decidedBy !== "ENGINE") return null;
  const paid = db.select({ id: payments.id }).from(payments).where(eq(payments.intentId, intentId)).get();
  return paid ? null : latest;
}

function storeDecision(
  db: Pick<Db, "insert">,
  intentId: string,
  entry: { decision: Decision; decidedBy: "ENGINE" | "USER"; policyVersion: number | null; at: Date },
): void {
  db.insert(decisions)
    .values({
      id: randomUUID(),
      intentId,
      outcome: entry.decision.outcome,
      ruleIdsJson: JSON.stringify(entry.decision.ruleIds),
      explanation: entry.decision.explanation,
      decidedBy: entry.decidedBy,
      policyVersion: entry.policyVersion,
      orderTotal: entry.decision.orderTotal,
      decidedAt: entry.at,
    })
    .run();
}
