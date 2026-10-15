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
