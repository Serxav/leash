import { z } from "zod";
import { isMoney, MONEY_PATTERN, toCents } from "@/lib/money";

/**
 * The user's spending rules: the exact, confirmed version of what they
 * wrote in plain language. The policy engine (plain TypeScript, no AI)
 * decides every purchase with these values.
 *
 * Security: rules can come from an AI model, so the schema is strict.
 * - Unknown keys are rejected: a model or injected text cannot add a
 *   field like "allowEverything".
 * - The hard limits are required and capped: there is no "no limit" value.
 * - Categories and merchants are closed formats (slugs and hostnames), never
 *   free text that could carry instructions.
 */

/** Bumped when the rules format changes; stored with every policy. */
export const RULES_FORMAT_VERSION = 1;

/** Highest amount any rule may hold: €10,000.00. */
export const MAX_RULE_AMOUNT_CENTS = 1_000_000;
export const MAX_UNITS_PER_ITEM = 100;
export const MAX_ALLOWED_CATEGORIES = 20;
export const MAX_BLOCKED_MERCHANTS = 50;

/**
 * Stable IDs of the rules, in the order the engine checks them (brief §4).
 * Decisions store these IDs to say which rule applied.
 */
export const RULE_IDS = [
  "valid_request",
  // A fixed protection, not a user rule: the product's shop text carries
  // instructions for AI agents (US8, D-033).
  "untrusted_instructions",
  "mandate_active",
  "agent_active",
  "allowed_categories",
  "blocked_merchants",
  "max_units_per_item",
  "max_per_order",
  "monthly_budget",
  "approval_threshold",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

const amount = z
  .string()
  .regex(MONEY_PATTERN, { error: "must be a euro amount with two decimals, like 40.00" })
  // Zod keeps running checks after a failed regex, so guard toCents.
  .refine((value) => isMoney(value) && toCents(value) > 0, { error: "must be above 0.00" })
  .refine((value) => isMoney(value) && toCents(value) <= MAX_RULE_AMOUNT_CENTS, {
    error: "must be at most 10000.00",
  });

const CATEGORY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * " Office-Supplies " → "office-supplies", or null if it is not a category
 * slug. Rules and catalog products go through the same function, so they
 * always compare the same way.
 */
export function normalizeCategory(value: string): string | null {
  const category = value.trim().toLowerCase();
  return category.length <= 64 && CATEGORY_PATTERN.test(category) ? category : null;
}

/**
 * "https://www.Shop.example/x" → "shop.example", or null if it is not a
 * hostname. Non-ASCII domains must be written in punycode (xn--…).
 */
export function normalizeMerchantDomain(value: string): string | null {
  const domain = stripUrl(value.trim().toLowerCase());
  return domain.length <= 253 && DOMAIN_PATTERN.test(domain) ? domain : null;
}

function stripUrl(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

/** A catalog category slug, e.g. "stationery" or "office-supplies". */
const categorySlug = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .regex(CATEGORY_PATTERN, {
    error: "must be a category slug like office-supplies",
  });

/**
 * A merchant hostname, e.g. "shop.example". Common ways of writing it
 * ("https://www.Shop.example/") are normalised; anything else is rejected.
 * Non-ASCII domains must be written in punycode (xn--…).
 */
const merchantDomain = z
  .string()
  .trim()
  .toLowerCase()
  .overwrite(stripUrl)
  .max(253)
  .regex(DOMAIN_PATTERN, {
    error: "must be a website domain like shop.example",
  });

const unique = <T>(values: T[]) => [...new Set(values)];

export const rulesSchema = z
  .strictObject({
    formatVersion: z.literal(RULES_FORMAT_VERSION),
    /** Leash only works in euros and never converts currencies. */
    currency: z.literal("EUR"),
    /** Hard limit for one order (inclusive): a larger order is blocked. */
    maxPerOrder: amount,
    /** Hard limit per calendar month in Europe/Madrid (inclusive). */
    monthlyBudget: amount,
    /**
     * Orders above this amount need the user's approval; an order of exactly
     * this amount does not ("ask me before anything over €15"). null means
     * every order within the hard limits is bought without asking.
     */
    approvalThreshold: amount.nullable(),
    /** Only these catalog categories can be bought. */
    allowedCategories: z
      .array(categorySlug)
      .min(1, { error: "needs at least one category" })
      .max(MAX_ALLOWED_CATEGORIES)
      .overwrite(unique),
    /** Never buy from these merchants or their subdomains. */
    blockedMerchants: z
      .array(merchantDomain)
      .max(MAX_BLOCKED_MERCHANTS)
      .overwrite(unique),
    /** Most units of the same item in one order (inclusive). */
    maxUnitsPerItem: z.int().min(1).max(MAX_UNITS_PER_ITEM),
  })
  .superRefine((rules, ctx) => {
    const amounts = [rules.maxPerOrder, rules.monthlyBudget, rules.approvalThreshold ?? "0.00"];
    if (!amounts.every((value) => typeof value === "string" && isMoney(value))) return;
    if (toCents(rules.maxPerOrder) > toCents(rules.monthlyBudget)) {
      ctx.addIssue({
        code: "custom",
        path: ["maxPerOrder"],
        message: "cannot be higher than the monthly budget",
      });
    }
    if (
      rules.approvalThreshold !== null &&
      toCents(rules.approvalThreshold) > toCents(rules.maxPerOrder)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["approvalThreshold"],
        message: "cannot be higher than the limit per order",
      });
    }
  });

export type SpendingRules = z.output<typeof rulesSchema>;

export type RulesParseResult =
  | { ok: true; rules: SpendingRules }
  | { ok: false; problems: string[] };

/**
 * Validates rules from any source (the AI, the database, a form). Problems
 * name the field and the reason, and never echo the rejected value, which
 * could be injected text.
 */
export function parseRules(input: unknown): RulesParseResult {
  const result = rulesSchema.safeParse(input);
  if (result.success) return { ok: true, rules: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((issue) => {
      // Zod's own message lists the unknown key names, which are untrusted.
      const message =
        issue.code === "unrecognized_keys" ? "unknown fields are not allowed" : issue.message;
      return issue.path.length > 0 ? `${issue.path.join(".")}: ${message}` : message;
    }),
  };
}
