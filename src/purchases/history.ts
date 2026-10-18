import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { payments, purchaseIntents, type Payment } from "@/db/schema";
import { refundRequestId } from "@/payments/refund";
import type { ToolkitRunner } from "@/paypal/agent-toolkit";
import { listProposals, oneAtATime, type ProposalView } from "./propose";

/**
 * Purchase history and refunds (US6, D-037).
 *
 * Every purchase the agent proposed, with its decision, the rule applied,
 * the PayPal reference, the "14-day return window" (D-008) and a refund
 * button while the window is open.
 *
 * Refunds are leashed Agent Toolkit calls (`create_refund`, D-034): only
 * the user starts one, from the history page, never the agent. Leash checks
 * first that the purchase is the user's, charged and still inside its
 * return window, and refunds it in full with a PayPal-Request-Id derived
 * from the payment, so a double click or a retry never refunds twice.
 */

const DAY_MS = 86_400_000;

export type ReturnWindow =
  | { state: "OPEN"; daysLeft: number; until: Date }
  | { state: "CLOSED"; until: Date }
  /** Not charged, or already refunded. */
  | { state: "NONE" };

export type HistoryItem = ProposalView & {
  /** PayPal's transaction ID for the capture, for the user. Never for the model. */
  paypalReference: string | null;
  /** PayPal accepted the refund but has not finished it yet. */
  refundPending: boolean;
  returnWindow: ReturnWindow;
  canRefund: boolean;
};

/** The return window of a payment at a given moment. */
export function returnWindowOf(
  payment: Pick<Payment, "status" | "withdrawalDeadline" | "refundId">,
  now: Date,
): ReturnWindow {
  if (payment.status !== "COMPLETED" || payment.refundId || !payment.withdrawalDeadline) {
    return { state: "NONE" };
  }
  const left = payment.withdrawalDeadline.getTime() - now.getTime();
  if (left < 0) return { state: "CLOSED", until: payment.withdrawalDeadline };
  // Any part of a day counts as a day left, so the last hours say "1 day".
  return { state: "OPEN", daysLeft: Math.max(1, Math.ceil(left / DAY_MS)), until: payment.withdrawalDeadline };
}

export function listHistory(db: Db, userId: string, now: Date, limit = 50): HistoryItem[] {
  const views = listProposals(db, userId, limit);
  if (views.length === 0) return [];
  const paymentByIntent = new Map(
    db
      .select()
      .from(payments)
      .where(and(eq(payments.userId, userId), inArray(payments.intentId, views.map((v) => v.intentId))))
      .all()
      .map((row) => [row.intentId, row]),
  );
  return views.map((view) => {
    const payment = paymentByIntent.get(view.intentId);
    const window = payment ? returnWindowOf(payment, now) : ({ state: "NONE" } as const);
    return {
      ...view,
      paypalReference: payment?.captureId ?? null,
      refundPending: Boolean(payment?.refundId) && payment?.status === "COMPLETED",
      returnWindow: window,
      canRefund: window.state === "OPEN",
    };
  });
}

export type RefundDeps = {
  db: Db;
  runToolkit: ToolkitRunner;
  now?: () => Date;
};

export type RefundResult =
  | { result: "NOT_FOUND"; message: string }
  | { result: "NOT_REFUNDABLE"; message: string }
  | { result: "WINDOW_CLOSED"; message: string }
  | { result: "REFUNDED"; message: string }
  | { result: "PENDING"; message: string }
  | { result: "FAILED"; message: string };

const refundSchema = z.object({ id: z.string().min(1), status: z.string() });
const orderSchema = z.object({
  purchase_units: z
    .array(
      z.object({
        payments: z.object({ captures: z.array(z.object({ status: z.string() })).optional() }).optional(),
      }),
    )
    .min(1),
});

export async function refundPurchase(
  deps: RefundDeps,
  input: { userId: string; intentId: string },
): Promise<RefundResult> {
  const notFound: RefundResult = { result: "NOT_FOUND", message: "There is no purchase with this reference." };
  if (!z.uuid().safeParse(input.intentId).success) return notFound;
  const now = deps.now ?? (() => new Date());

  return oneAtATime(input.userId, async () => {
    // 1. Permission: one of this user's own purchases, charged and refundable.
    const intent = deps.db
      .select({ id: purchaseIntents.id })
      .from(purchaseIntents)
      .where(and(eq(purchaseIntents.id, input.intentId), eq(purchaseIntents.userId, input.userId)))
      .get();
    if (!intent) return notFound;
    const where = and(eq(payments.intentId, intent.id), eq(payments.userId, input.userId));
    const payment = deps.db.select().from(payments).where(where).get();
    if (payment?.status === "REFUNDED") {
      return { result: "REFUNDED", message: "This purchase was already refunded." };
    }
    if (!payment || payment.status !== "COMPLETED" || !payment.captureId) {
      return { result: "NOT_REFUNDABLE", message: "Only charged purchases can be refunded." };
    }
    if (payment.refundId) {
      return { result: "PENDING", message: "The refund is already on its way at PayPal." };
    }
    const window = returnWindowOf(payment, now());
    if (window.state !== "OPEN") {
      return { result: "WINDOW_CLOSED", message: "The 14-day return window for this purchase has closed." };
    }

    const update = (values: Partial<Payment>) =>
      deps.db.update(payments).set({ ...values, updatedAt: now() }).where(eq(payments.id, payment.id)).run();

    // 2. One full refund through the Agent Toolkit, in the sandbox.
    try {
      const raw = await deps.runToolkit(
        "create_refund",
        { capture_id: payment.captureId },
        { requestId: refundRequestId(payment.id) },
      );
      const refund = refundSchema.parse(raw);
      console.info(`[history] create_refund via Agent Toolkit: refund ${refund.status}`);
      if (refund.status === "COMPLETED") {
        update({ status: "REFUNDED", refundId: refund.id });
        return { result: "REFUNDED", message: `Refunded €${payment.amount} to your PayPal (sandbox).` };
      }
      // PENDING: the payment stays COMPLETED with its refund on its way.
      update({ refundId: refund.id });
      return { result: "PENDING", message: "PayPal accepted the refund and will finish it soon." };
    } catch (error) {
      console.error("[history] create_refund failed:", (error as Error).name);
    }

    // 3. It may already be refunded at PayPal (for example from the
    // dashboard): read the order, and bring Leash's record in line.
    if (payment.paypalOrderId) {
      try {
        const order = orderSchema.parse(await deps.runToolkit("get_order", { id: payment.paypalOrderId }));
        const capture = order.purchase_units[0].payments?.captures?.[0];
        if (capture?.status === "REFUNDED") {
          update({ status: "REFUNDED" });
          return { result: "REFUNDED", message: "PayPal shows this purchase was already refunded." };
        }
      } catch (error) {
        console.error("[history] get_order after a failed refund failed:", (error as Error).name);
      }
    }
    // Retrying is safe: the same PayPal-Request-Id never refunds twice.
    return { result: "FAILED", message: "PayPal could not refund it right now. Nothing changed; try again." };
  });
}
