import type { RuleTag } from "@/rules/describe";

/** What each rule is about, as a short label above its value. */
const RULE_LABELS: Record<RuleTag["id"], string> = {
  max_per_order: "Each order",
  monthly_budget: "Each month",
  approval_threshold: "Ask me first",
  allowed_categories: "What Rex may buy",
  blocked_merchants: "Shops to avoid",
  max_units_per_item: "Units of one item",
  currency: "Currency",
};

/**
 * The exact rules as a settings-style list: one row per rule, the
 * same text the engine's checks are described with.
 */
export function RuleList({ tags, label }: { tags: RuleTag[]; label: string }) {
  return (
    <ul aria-label={label} className="card-muted divide-y divide-[var(--border)] overflow-hidden">
      {tags.map((tag) => (
        <li key={tag.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="text-xs text-muted sm:text-sm">{RULE_LABELS[tag.id]}</span>
          <span className="text-sm font-medium sm:text-right">{tag.text}</span>
        </li>
      ))}
    </ul>
  );
}
