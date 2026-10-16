import type { RuleId, SpendingRules } from "./schema";

/**
 * Exact rules → short readable tags for the confirmation screen (US2).
 * Plain code, no AI: the user confirms exactly what the engine will check.
 */

export type RuleTag = {
  /** The engine rule the tag describes, or "currency". */
  id: Extract<
    RuleId,
    | "max_per_order"
    | "monthly_budget"
    | "approval_threshold"
    | "allowed_categories"
    | "blocked_merchants"
    | "max_units_per_item"
  > | "currency";
  text: string;
};

const euros = (amount: string) => `€${amount}`;

/** "office-supplies" → "office supplies". */
const readableCategory = (slug: string) => slug.replace(/[-_]+/g, " ");

/** "a", "a or b", "a, b or c". */
function list(items: string[], word: "or" | "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`;
}

export function describeRules(rules: SpendingRules): RuleTag[] {
  return [
    { id: "max_per_order", text: `Up to ${euros(rules.maxPerOrder)} per order` },
    { id: "monthly_budget", text: `Up to ${euros(rules.monthlyBudget)} per month` },
    {
      id: "approval_threshold",
      text:
        rules.approvalThreshold === null
          ? "Never asks you first within these limits"
          : `Asks you first above ${euros(rules.approvalThreshold)}`,
    },
    {
      id: "allowed_categories",
      text: `Only ${list(rules.allowedCategories.map(readableCategory), "or")}`,
    },
    {
      id: "blocked_merchants",
      text:
        rules.blockedMerchants.length === 0
          ? "No blocked shops"
          : `Never from ${list(rules.blockedMerchants, "or")}`,
    },
    {
      id: "max_units_per_item",
      text:
        rules.maxUnitsPerItem === 1
          ? "At most 1 unit of the same item"
          : `At most ${rules.maxUnitsPerItem} units of the same item`,
    },
    { id: "currency", text: "Euros only, never converted" },
  ];
}
