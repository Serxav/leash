import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { payments, purchaseIntents } from "@/db/schema";
import { latestDecisions } from "@/purchases/propose";
import type { ToolkitRunner } from "@/paypal/agent-toolkit";

/**
 * Leashed tools: PayPal Agent Toolkit tools behind Leash's permission
 * layer (brief §5, D-034). The model never receives a toolkit tool. It
 * gets a Leash tool that:
 * 1. checks permission first: only the current user's own purchases, only
 *    read actions, a limited number of calls per run (in the agent);
 * 2. calls exactly one toolkit tool, in the sandbox;
 * 3. checks PayPal's answer against Leash's own records;
 * 4. passes on only whitelisted fields: no PayPal IDs, payer names,
 *    emails, addresses or links ever reach the model.
 *
 * What the agent can do with each tool (none of them can pay or refund):
 * - search_catalog: read the catalog (src/catalog);
 * - propose_purchase: propose; Leash's engine decides (src/purchases);
 * - check_purchase_status: read one of its purchases at PayPal through the
 *   Agent Toolkit's get_order (this file).
 * Refunds with the toolkit wait for the user's confirmation in the history
 * page (F4): the agent never gets them.
 */

export type StatusCheckDeps = {
  db: Db;
  runToolkit: ToolkitRunner;
};

/** What the model sees. Amounts as text, statuses from fixed lists. */
export type PurchaseStatus =
  | { result: "NOT_FOUND"; message: string }
  | { result: "NOT_CHARGED"; message: string }
  | { result: "UNAVAILABLE"; message: string }
  | {
      result: "CHECKED";
      checkedWith: "PayPal Agent Toolkit (sandbox)";
      orderStatus: OrderStatus;
      paymentStatus: CaptureStatus;
      amount: string;
      /** PayPal's order is the one Leash recorded, for the same amount. */
      matchesLeashRecords: boolean;
      message: string;
    };

const ORDER_STATUSES = ["CREATED", "SAVED", "APPROVED", "VOIDED", "COMPLETED", "PAYER_ACTION_REQUIRED"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number] | "UNKNOWN";
const CAPTURE_STATUSES = ["COMPLETED", "DECLINED", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "FAILED"] as const;
type CaptureStatus = (typeof CAPTURE_STATUSES)[number] | "NONE" | "UNKNOWN";

/** Only the fields Leash reads from PayPal's order; the rest is ignored. */
const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  purchase_units: z
    .array(
      z.object({
        custom_id: z.string().optional(),
        amount: z.object({ value: z.string(), currency_code: z.string() }),
        payments: z
          .object({ captures: z.array(z.object({ status: z.string() })).optional() })
          .optional(),
      }),
    )
    .min(1),
});

const PURCHASE_REF = z.uuid();

const oneOf = <T extends string>(list: readonly T[], value: string): T | "UNKNOWN" =>
  (list as readonly string[]).includes(value) ? (value as T) : "UNKNOWN";

export async function checkPurchaseStatus(
  deps: StatusCheckDeps,
  input: { userId: string; purchaseRef: string },
): Promise<PurchaseStatus> {
  const notFound: PurchaseStatus = {
    result: "NOT_FOUND",
    message: "There is no purchase with this reference.",
  };
  // 1. Permission: a well-formed reference to one of this user's purchases.
  // Another user's purchase looks exactly like a missing one.
  const ref = PURCHASE_REF.safeParse(input.purchaseRef);
  if (!ref.success) return notFound;
  const intent = deps.db
    .select({ id: purchaseIntents.id })
    .from(purchaseIntents)
    .where(and(eq(purchaseIntents.id, ref.data), eq(purchaseIntents.userId, input.userId)))
    .get();
  if (!intent) return notFound;

  const payment = deps.db
    .select()
    .from(payments)
    .where(and(eq(payments.intentId, intent.id), eq(payments.userId, input.userId)))
    .get();
  if (!payment?.paypalOrderId) {
    const decision = latestDecisions(deps.db, [intent.id]).get(intent.id);
    return {
      result: "NOT_CHARGED",
      message: payment
        ? `Leash's payment attempt ended as ${payment.status}; there is no PayPal order to check.`
        : `Leash did not charge this purchase (decision: ${decision?.outcome ?? "none"}).`,
    };
  }

  // 2. One read-only toolkit call, in the sandbox.
  let raw: unknown;
  try {
    raw = await deps.runToolkit("get_order", { id: payment.paypalOrderId });
  } catch (error) {
    console.error("[leashed-tools] get_order failed:", (error as Error).name);
    return { result: "UNAVAILABLE", message: "PayPal could not be checked right now." };
  }
  const order = orderSchema.safeParse(raw);
  if (!order.success) {
    return { result: "UNAVAILABLE", message: "PayPal's answer could not be read." };
  }

  // 3. Compare with Leash's records: same order, same attempt, same amount.
  const unit = order.data.purchase_units[0];
  const matches =
    order.data.id === payment.paypalOrderId &&
    unit.custom_id === payment.id &&
    unit.amount.value === payment.amount &&
    unit.amount.currency_code === payment.currency;
  const captures = unit.payments?.captures ?? [];
  const orderStatus = oneOf(ORDER_STATUSES, order.data.status);
  const paymentStatus: CaptureStatus =
    captures.length === 0 ? "NONE" : oneOf(CAPTURE_STATUSES, captures[0].status);

  // Audit line: what was checked and the outcome, never IDs or PayPal data.
  console.info(
    `[leashed-tools] get_order via Agent Toolkit: order ${orderStatus}, payment ${paymentStatus}, matches Leash: ${matches}`,
  );

  // 4. Whitelisted fields only.
  return {
    result: "CHECKED",
    checkedWith: "PayPal Agent Toolkit (sandbox)",
    orderStatus,
    paymentStatus,
    amount: `€${payment.amount}`,
    matchesLeashRecords: matches,
    message: matches
      ? `PayPal confirms the order is ${orderStatus} and the payment ${paymentStatus}.`
      : "PayPal's order does not match Leash's records. Tell the user to check this purchase.",
  };
}
