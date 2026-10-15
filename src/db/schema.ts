import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A user's spending mandate: their PayPal account saved in the PayPal vault.
 *
 * - PENDING: setup token created, waiting for the payer's approval on PayPal.
 * - ACTIVE: approved; Leash holds a vault payment token it can charge.
 * - PAUSED / REVOKED: see US7 (F4).
 *
 * `vaultTokenRef` is the PayPal payment token. It is server-only data: never
 * send it to the browser, to logs or to the AI model.
 */
export const mandates = sqliteTable("mandates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status", {
    enum: ["PENDING", "ACTIVE", "PAUSED", "REVOKED"],
  }).notNull(),
  setupTokenId: text("setup_token_id"),
  paypalCustomerId: text("paypal_customer_id"),
  vaultTokenRef: text("vault_token_ref"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Mandate = typeof mandates.$inferSelect;
export type MandateStatus = Mandate["status"];

/**
 * One charge attempt against the user's mandate (PayPal Orders v2 with the
 * vaulted payment token). The row is written before calling PayPal and its
 * `id` is the PayPal-Request-Id, so a retried attempt can never charge twice.
 *
 * - CUSTOMER initiator: the user is present (e.g. one-tap approval).
 * - MERCHANT initiator: the agent buys within the rules without the user.
 */
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  /** The purchase intent this pays for (F2/F3); null for lab charges. */
  intentId: text("intent_id"),
  /** Decimal string exactly as sent to PayPal, e.g. "5.00". */
  amount: text("amount").notNull(),
  currency: text("currency").notNull(),
  initiator: text("initiator", { enum: ["CUSTOMER", "MERCHANT"] }).notNull(),
  status: text("status", {
    enum: ["PENDING", "COMPLETED", "DECLINED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
  }).notNull(),
  paypalOrderId: text("paypal_order_id"),
  captureId: text("capture_id"),
  refundId: text("refund_id"),
  /** details[0].issue of a failed attempt, e.g. INSTRUMENT_DECLINED. */
  failureIssue: text("failure_issue"),
  debugId: text("debug_id"),
  /** End of the 14-day return window (D-008). */
  withdrawalDeadline: integer("withdrawal_deadline", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type PaymentStatus = Payment["status"];
