import type { MandateStatus, PaymentStatus } from "@/db/schema";
import { fromCents, isMoney, toCents } from "@/lib/money";
import {
  normalizeCategory,
  normalizeMerchantDomain,
  parseRules,
  type RuleId,
  type SpendingRules,
} from "./schema";

/**
 * The policy engine: decides every purchase the agent proposes.
 *
 * THE AI PROPOSES, THE CODE DECIDES. This is plain TypeScript with no AI,
 * no network and no clock of its own: the same input always gives the same
 * decision. It fails closed: anything it cannot check is blocked.
 *
 * Order (brief §4):
 * 1. state: an active mandate and an agent that is not paused;
 * 2. hard blocks: category, merchant, units, limit per order, monthly budget;
 * 3. the approval threshold;
 * 4. approve.
 */

export type Outcome = "APPROVE" | "NEEDS_APPROVAL" | "BLOCK";

/**
 * A purchase to decide. The caller fills it from the catalog, never from
 * the model (brief §4: the server re-reads price, merchant and category).
 */
export type PurchaseRequest = {
  /** Price of one unit, e.g. "6.00". */
  unitPrice: string;
  quantity: number;
  currency: string;
  /** Catalog category slug, e.g. "printer-paper". */
  category: string;
  /**
   * Its parent categories from the catalog, e.g. ["office-supplies",
   * "paper"]. The category is allowed if it or any parent is allowed, so
   * "office-supplies" covers printer paper.
   */
  parentCategories?: readonly string[];
  /** Merchant website, e.g. "shop.example". */
  merchantDomain: string;
};

export type EngineState = {
  mandate: MandateStatus | "NONE";
  agentPaused: boolean;
  /**
   * Purchases that count against the budget, from any month: the engine
   * keeps the ones in the current Madrid month. See countsTowardBudget.
   */
  spending: ReadonlyArray<{ amount: string; at: Date }>;
  now: Date;
};

export type Decision = {
  outcome: Outcome;
  /** The rules that decided the outcome; empty when approved. */
  ruleIds: RuleId[];
  /** One sentence for the user (and the agent). */
  explanation: string;
  /** The order total, or null when the request could not be checked. */
  orderTotal: string | null;
};

/** Requests above this quantity are not believable: block, don't compute. */
const MAX_REQUEST_QUANTITY = 10_000;

const madridMonthFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
});

/** The calendar month of a moment in Madrid, e.g. "2026-10" (brief §4.7). */
export function madridMonth(date: Date): string {
  return madridMonthFormat.format(date);
}

/**
 * Which payments use up the monthly budget. PENDING counts because its
 * outcome may still be a charge (D-018); refunded or failed ones do not.
 */
export function countsTowardBudget(status: PaymentStatus): boolean {
  return status === "COMPLETED" || status === "PENDING" || status === "PARTIALLY_REFUNDED";
}

const euros = (cents: number) => `€${fromCents(cents)}`;

const MAX_PARENT_CATEGORIES = 10;

/** The parent slugs, normalised; null if any of them is not a category slug. */
function readParentCategories(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PARENT_CATEGORIES) return null;
  const slugs: string[] = [];
  for (const item of value) {
    const slug = typeof item === "string" ? normalizeCategory(item) : null;
    if (!slug) return null;
    slugs.push(slug);
  }
  return slugs;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function block(ruleIds: RuleId[], explanation: string, orderTotal: string | null): Decision {
  return { outcome: "BLOCK", ruleIds, explanation, orderTotal };
}

const INVALID = block(
  ["valid_request"],
  "Blocked: the purchase details are not valid, so Leash did not check them.",
  null,
);

export function decide(
  rules: SpendingRules,
  request: PurchaseRequest,
  state: EngineState,
): Decision {
  // 0. Check every input before using it (rules may come from the database).
  const parsed = parseRules(rules);
  if (!parsed.ok) return INVALID;
  const policy = parsed.rules;

  // Read each value once and check its real type: no coercion, so an
  // object cannot pass one check and turn into something else later.
  const { unitPrice, quantity, currency, now } = {
    unitPrice: request.unitPrice,
    quantity: request.quantity,
    currency: request.currency,
    now: state.now,
  };
  const category =
    typeof request.category === "string" ? normalizeCategory(request.category) : null;
  const parents = readParentCategories(request.parentCategories);
  const merchant =
    typeof request.merchantDomain === "string"
      ? normalizeMerchantDomain(request.merchantDomain)
      : null;
  if (
    !category ||
    !parents ||
    !merchant ||
    currency !== policy.currency ||
    typeof unitPrice !== "string" ||
    !isMoney(unitPrice) ||
    toCents(unitPrice) <= 0 ||
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_REQUEST_QUANTITY ||
    !isValidDate(now) ||
    !Array.isArray(state.spending)
  ) {
    return INVALID;
  }

  const month = madridMonth(now);
  let spentCents = 0;
  for (const entry of state.spending) {
    const { amount, at } = entry ?? {};
    if (typeof amount !== "string" || !isMoney(amount) || !isValidDate(at)) return INVALID;
    if (madridMonth(at) === month) spentCents += toCents(amount);
  }
  if (!Number.isSafeInteger(spentCents)) return INVALID;

  const totalCents = toCents(unitPrice) * quantity;
  const orderTotal = fromCents(totalCents);

  // 1. State: nothing is bought without an active mandate and agent.
  if (state.mandate === "PAUSED") {
    return block(["mandate_active"], "Blocked: your PayPal mandate is paused.", orderTotal);
  }
  if (state.mandate !== "ACTIVE") {
    return block(
      ["mandate_active"],
      "Blocked: PayPal is not connected, so Leash cannot pay.",
      orderTotal,
    );
  }
  // Anything but an explicit `false` counts as paused (fail closed).
  if (state.agentPaused !== false) {
    return block(["agent_active"], "Blocked: you paused the agent.", orderTotal);
  }

  // 2. Hard blocks: collect every broken rule, in evaluation order.
  const broken: Array<{ id: RuleId; reason: string }> = [];

  if (![category, ...parents].some((slug) => policy.allowedCategories.includes(slug))) {
    broken.push({
      id: "allowed_categories",
      reason: `the category ${category} is not in your allowed categories`,
    });
  }

  const blockedBy = policy.blockedMerchants.find(
    (blocked) => merchant === blocked || merchant.endsWith(`.${blocked}`),
  );
  if (blockedBy) {
    broken.push({ id: "blocked_merchants", reason: `you never want to buy from ${blockedBy}` });
  }

  if (quantity > policy.maxUnitsPerItem) {
    broken.push({
      id: "max_units_per_item",
      reason: `${quantity} units is more than your maximum of ${policy.maxUnitsPerItem} of the same item`,
    });
  }

  const maxPerOrderCents = toCents(policy.maxPerOrder);
  if (totalCents > maxPerOrderCents) {
    broken.push({
      id: "max_per_order",
      reason: `this order (${euros(totalCents)}) is above your limit of ${euros(maxPerOrderCents)} per order`,
    });
  }

  const budgetCents = toCents(policy.monthlyBudget);
  if (spentCents + totalCents > budgetCents) {
    broken.push({
      id: "monthly_budget",
      reason: `${euros(totalCents)} would take this month's spending to ${euros(spentCents + totalCents)}, above your budget of ${euros(budgetCents)}`,
    });
  }

  if (broken.length > 0) {
    const more = broken.length - 1;
    const suffix = more === 0 ? "" : ` (and ${more} more rule${more === 1 ? "" : "s"})`;
    return block(
      broken.map((rule) => rule.id),
      `Blocked: ${broken[0].reason}${suffix}.`,
      orderTotal,
    );
  }

  // 3. Approval threshold: above it, the user decides.
  if (policy.approvalThreshold !== null) {
    const thresholdCents = toCents(policy.approvalThreshold);
    if (totalCents > thresholdCents) {
      return {
        outcome: "NEEDS_APPROVAL",
        ruleIds: ["approval_threshold"],
        explanation: `Needs your approval: ${euros(totalCents)} is above ${euros(thresholdCents)}, the amount you asked to approve.`,
        orderTotal,
      };
    }
  }

  // 4. Approve.
  return {
    outcome: "APPROVE",
    ruleIds: [],
    explanation: `Approved: ${euros(totalCents)} is within all your spending rules.`,
    orderTotal,
  };
}
