import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * The user's spending rules, versioned (US2). A row starts as a draft
 * (`version` and `confirmedAt` are null) holding what the AI turned the
 * user's text into. Nothing applies until the user confirms it: then it
 * gets the next version number and becomes the active policy. Confirmed
 * versions are never edited; a change is a new version.
 */
export const policies = sqliteTable(
  "policies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** 1, 2, 3… per user once confirmed; null while it is a draft. */
    version: integer("version"),
    /** What the user wrote, kept so they can see where the rules came from. */
    sourceText: text("source_text").notNull(),
    /** The exact rules (validated JSON, see src/rules/schema.ts). */
    rulesJson: text("rules_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("policies_user_version").on(table.userId, table.version)],
);

export type Policy = typeof policies.$inferSelect;

/**
 * Channel3 search results kept for a few hours (D-028), so the same search
 * does not spend another credit. Prices are re-read (free) before any
 * decision, so a cached price never decides a purchase.
 */
export const catalogSearches = sqliteTable("catalog_searches", {
  /** The normalised query, e.g. "a4 printer paper". */
  queryKey: text("query_key").primaryKey(),
  /** The products found (validated catalog products, JSON). */
  productsJson: text("products_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Channel3 searches made per calendar month in Madrid (D-028). Leash stops
 * calling Channel3 search at a cap far below the 1,000 free monthly credits,
 * so no bill can ever come; the local catalog is used instead.
 */
export const catalogUsage = sqliteTable("catalog_usage", {
  /** "2026-10" */
  month: text("month").primaryKey(),
  searches: integer("searches").notNull(),
});

/**
 * A purchase the agent proposed (brief §4.1). Price, merchant and category
 * are what the server re-read from the catalog, never the model's numbers;
 * they are null when the product could not be re-read.
 */
export const purchaseIntents = sqliteTable("purchase_intents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  /** The offer, identified by its merchant (D-028). */
  merchantDomain: text("merchant_domain").notNull(),
  quantity: integer("quantity").notNull(),
  productTitle: text("product_title"),
  unitPrice: text("unit_price"),
  currency: text("currency"),
  category: text("category"),
  /** The agent's one-line reason, shown to the user. Untrusted text. */
  agentReason: text("agent_reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type PurchaseIntent = typeof purchaseIntents.$inferSelect;

/** What decided a purchase intent, and why (brief §4.4). */
export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  intentId: text("intent_id").notNull(),
  outcome: text("outcome", { enum: ["APPROVE", "NEEDS_APPROVAL", "BLOCK"] }).notNull(),
  /** JSON list of rule IDs (src/rules/schema.ts RULE_IDS). */
  ruleIdsJson: text("rule_ids_json").notNull(),
  explanation: text("explanation").notNull(),
  decidedBy: text("decided_by", { enum: ["ENGINE", "USER"] }).notNull(),
  /** The confirmed rules version used; null when there were none. */
  policyVersion: integer("policy_version"),
  orderTotal: text("order_total"),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull(),
});

export type DecisionRow = typeof decisions.$inferSelect;
