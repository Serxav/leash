import { describe, expect, it } from "vitest";
import { describeRules } from "./describe";
import type { SpendingRules } from "./schema";

const rules: SpendingRules = {
  formatVersion: 1,
  currency: "EUR",
  maxPerOrder: "40.00",
  monthlyBudget: "150.00",
  approvalThreshold: "15.00",
  allowedCategories: ["office-supplies"],
  blockedMerchants: ["marketplace-x.example"],
  maxUnitsPerItem: 5,
};

const texts = (changes: Partial<SpendingRules> = {}) =>
  describeRules({ ...rules, ...changes }).map((tag) => tag.text);

describe("describeRules", () => {
  it("shows the brief's example as readable tags", () => {
    expect(describeRules(rules)).toEqual([
      { id: "max_per_order", text: "Up to €40.00 per order" },
      { id: "monthly_budget", text: "Up to €150.00 per month" },
      { id: "approval_threshold", text: "Asks you first above €15.00" },
      { id: "allowed_categories", text: "Only office supplies" },
      { id: "blocked_merchants", text: "Never from marketplace-x.example" },
      { id: "max_units_per_item", text: "At most 5 units of the same item" },
      { id: "currency", text: "Euros only, never converted" },
    ]);
  });

  it("says when Leash never asks first", () => {
    expect(texts({ approvalThreshold: null })).toContain("Never asks you first within these limits");
  });

  it("lists several categories and shops", () => {
    const tags = texts({
      allowedCategories: ["office-supplies", "stationery", "cleaning_supplies"],
      blockedMerchants: ["a.example", "b.example"],
    });
    expect(tags).toContain("Only office supplies, stationery or cleaning supplies");
    expect(tags).toContain("Never from a.example or b.example");
  });

  it("says when no shop is blocked", () => {
    expect(texts({ blockedMerchants: [] })).toContain("No blocked shops");
  });

  it("uses the singular for one unit", () => {
    expect(texts({ maxUnitsPerItem: 1 })).toContain("At most 1 unit of the same item");
  });

  it("has one tag for every rule the engine checks with the user's values", () => {
    const ids = describeRules(rules).map((tag) => tag.id);
    expect(ids).toEqual(expect.arrayContaining([
      "max_per_order",
      "monthly_budget",
      "approval_threshold",
      "allowed_categories",
      "blocked_merchants",
      "max_units_per_item",
    ]));
  });
});
