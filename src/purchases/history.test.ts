import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalProduct } from "@/catalog/local";
import { createDb, type Db } from "@/db/client";
import { mandates, payments } from "@/db/schema";
import { RETURN_WINDOW_DAYS, type ChargeInput, type PaymentView } from "@/payments/charge";
import { ToolkitError, type ToolkitRunner } from "@/paypal/agent-toolkit";
import { confirmDraft, saveDraft } from "@/rules/policies";
import type { SpendingRules } from "@/rules/schema";
import { listHistory, refundPurchase, returnWindowOf } from "./history";
import { proposePurchase } from "./propose";

const USER = "user-1";
const NOW = new Date("2026-10-20T10:00:00Z");
const DAY = 86_400_000;

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

let db: Db;
let calls: Array<{ method: string; args: unknown; requestId?: string }>;

/** A charge like chargeWithMandate's, with PayPal IDs and the return window. */
async function fakeCharge(input: ChargeInput): Promise<PaymentView> {
  const n = db.select().from(payments).all().length + 1;
  const row = {
    id: `pay-${n}`, userId: input.userId, intentId: input.intentId ?? null, amount: input.amount,
    currency: "EUR", initiator: input.initiator, status: "COMPLETED" as const,
    paypalOrderId: `ORDER${n}`, captureId: `CAPTURE${n}`, refundId: null, failureIssue: null,
    debugId: null, withdrawalDeadline: new Date(NOW.getTime() + RETURN_WINDOW_DAYS * DAY),
    createdAt: NOW, updatedAt: NOW,
  };
  db.insert(payments).values(row).run();
  return row;
}

/** Buys the sticky notes (€6.90, approved and charged); returns the intent ID. */
async function charged(): Promise<string> {
  const result = await proposePurchase(
    { db, catalog: { getProduct: async (id) => getLocalProduct(id) }, charge: fakeCharge, now: () => NOW },
    { userId: USER, productId: "local-sticky-notes", merchantDomain: "office-supplies-demo.example", quantity: 1, reason: "Notes." },
  );
  expect(result.paymentStatus).toBe("COMPLETED");
  return result.purchaseRef!;
}

function toolkit(answer: (method: string) => unknown): ToolkitRunner {
  return (async (method, args, options) => {
    calls.push({ method, args, requestId: options?.requestId });
    const reply = answer(method);
    if (reply instanceof Error) throw reply;
    return reply;
  }) as ToolkitRunner;
}

const refundOk = toolkit(() => ({ id: "REFUND1", status: "COMPLETED" }));
const refund = (run: ToolkitRunner, intentId: string, at = NOW, userId = USER) =>
  refundPurchase({ db, runToolkit: run, now: () => at }, { userId, intentId });
const paymentOf = (intentId: string) =>
  db.select().from(payments).where(eq(payments.intentId, intentId)).get()!;

beforeEach(() => {
  db = createDb(":memory:");
  calls = [];
  confirmDraft(db, { userId: USER, draftId: saveDraft(db, { userId: USER, sourceText: "rules", rules }) });
  db.insert(mandates).values({
    id: "m1", userId: USER, status: "ACTIVE", vaultTokenRef: "VAULT1", createdAt: NOW, updatedAt: NOW,
  }).run();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("return window (D-008)", () => {
  const until = new Date(NOW.getTime() + 14 * DAY);
  const paid = { status: "COMPLETED" as const, withdrawalDeadline: until, refundId: null };

  it("counts the days left, any part of a day as a day", () => {
    expect(returnWindowOf(paid, NOW)).toEqual({ state: "OPEN", daysLeft: 14, until });
    expect(returnWindowOf(paid, new Date(until.getTime() - 1000))).toMatchObject({ daysLeft: 1 });
    expect(returnWindowOf(paid, until)).toMatchObject({ state: "OPEN", daysLeft: 1 });
  });

  it("closes after the deadline", () => {
    expect(returnWindowOf(paid, new Date(until.getTime() + 1))).toEqual({ state: "CLOSED", until });
  });

  it("has none for refunds, refunds on their way and payments that did not go through", () => {
    expect(returnWindowOf({ ...paid, status: "REFUNDED" }, NOW)).toEqual({ state: "NONE" });
    expect(returnWindowOf({ ...paid, refundId: "R1" }, NOW)).toEqual({ state: "NONE" });
    expect(returnWindowOf({ ...paid, status: "DECLINED", withdrawalDeadline: null }, NOW)).toEqual({ state: "NONE" });
  });
});

describe("purchase history (US6)", () => {
  it("lists each purchase with its PayPal reference and return window", async () => {
    const intentId = await charged();
    const [item] = listHistory(db, USER, NOW);
    expect(item).toMatchObject({
      intentId,
      outcome: "APPROVE",
      paymentStatus: "COMPLETED",
      paypalReference: "CAPTURE1",
      returnWindow: { state: "OPEN", daysLeft: 14 },
      canRefund: true,
    });
    expect(listHistory(db, "someone-else", NOW)).toEqual([]);
  });

  it("lists blocked purchases too, without a refund", async () => {
    await proposePurchase(
      { db, catalog: { getProduct: async (id) => getLocalProduct(id) }, charge: fakeCharge, now: () => NOW },
      { userId: USER, productId: "local-office-chair", merchantDomain: "office-supplies-demo.example", quantity: 1, reason: "Chair." },
    );
    expect(listHistory(db, USER, NOW)[0]).toMatchObject({
      outcome: "BLOCK",
      paypalReference: null,
      returnWindow: { state: "NONE" },
      canRefund: false,
    });
  });
});

describe("refunds through the leashed Agent Toolkit (D-037)", () => {
  it("refunds in full once, with a request ID derived from the payment", async () => {
    const intentId = await charged();
    expect(await refund(refundOk, intentId)).toEqual({
      result: "REFUNDED",
      message: "Refunded €6.90 to your PayPal (sandbox).",
    });
    expect(calls).toEqual([{ method: "create_refund", args: { capture_id: "CAPTURE1" }, requestId: "refund-pay-1" }]);
    expect(paymentOf(intentId)).toMatchObject({ status: "REFUNDED", refundId: "REFUND1" });
    expect(listHistory(db, USER, NOW)[0]).toMatchObject({ canRefund: false, paymentStatus: "REFUNDED" });
  });

  it("calls PayPal only once when refunded twice at the same time", async () => {
    const intentId = await charged();
    const results = await Promise.all([refund(refundOk, intentId), refund(refundOk, intentId)]);
    expect(results.map((r) => r.result)).toEqual(["REFUNDED", "REFUNDED"]);
    expect(calls).toHaveLength(1);
  });

  it("keeps a pending refund as on its way, without a second one", async () => {
    const intentId = await charged();
    const pending = toolkit(() => ({ id: "REFUND1", status: "PENDING" }));
    expect((await refund(pending, intentId)).result).toBe("PENDING");
    expect(paymentOf(intentId)).toMatchObject({ status: "COMPLETED", refundId: "REFUND1" });
    expect(listHistory(db, USER, NOW)[0]).toMatchObject({ refundPending: true, canRefund: false });
    expect((await refund(pending, intentId)).result).toBe("PENDING");
    expect(calls).toHaveLength(1);
  });

  it("refuses after the 14-day return window", async () => {
    const intentId = await charged();
    const late = new Date(NOW.getTime() + 15 * DAY);
    expect((await refund(refundOk, intentId, late)).result).toBe("WINDOW_CLOSED");
    expect(calls).toEqual([]);
  });

  it("refuses purchases that were not charged", async () => {
    const blocked = await proposePurchase(
      { db, catalog: { getProduct: async (id) => getLocalProduct(id) }, charge: fakeCharge, now: () => NOW },
      { userId: USER, productId: "local-office-chair", merchantDomain: "office-supplies-demo.example", quantity: 1, reason: "Chair." },
    );
    expect((await refund(refundOk, blocked.purchaseRef!)).result).toBe("NOT_REFUNDABLE");
    expect(calls).toEqual([]);
  });

  it("treats another user's purchase and bad references as missing", async () => {
    const intentId = await charged();
    expect((await refund(refundOk, intentId, NOW, "someone-else")).result).toBe("NOT_FOUND");
    expect((await refund(refundOk, "not-a-uuid")).result).toBe("NOT_FOUND");
    expect(calls).toEqual([]);
  });

  it("brings the record in line when PayPal shows it was already refunded", async () => {
    const intentId = await charged();
    const run = toolkit((method) =>
      method === "create_refund"
        ? new ToolkitError("PAYPAL_ERROR", "PayPal refused the create_refund call.")
        : { id: "ORDER1", purchase_units: [{ payments: { captures: [{ status: "REFUNDED" }] } }] },
    );
    expect((await refund(run, intentId)).result).toBe("REFUNDED");
    expect(calls.map((call) => call.method)).toEqual(["create_refund", "get_order"]);
    expect(paymentOf(intentId).status).toBe("REFUNDED");
  });

  it("changes nothing when PayPal fails, so trying again is safe", async () => {
    const intentId = await charged();
    const run = toolkit((method) =>
      method === "create_refund"
        ? new ToolkitError("TIMEOUT", "PayPal did not answer in time.")
        : { id: "ORDER1", purchase_units: [{ payments: { captures: [{ status: "COMPLETED" }] } }] },
    );
    expect((await refund(run, intentId)).result).toBe("FAILED");
    expect(paymentOf(intentId)).toMatchObject({ status: "COMPLETED", refundId: null });
    expect((await refund(refundOk, intentId)).result).toBe("REFUNDED");
    expect(calls.filter((call) => call.method === "create_refund").map((call) => call.requestId)).toEqual([
      "refund-pay-1",
      "refund-pay-1",
    ]);
  });

  it("fails closed on an answer it cannot read", async () => {
    const intentId = await charged();
    const odd = toolkit((method) => (method === "create_refund" ? { unexpected: true } : { nope: 1 }));
    expect((await refund(odd, intentId)).result).toBe("FAILED");
    expect(paymentOf(intentId).status).toBe("COMPLETED");
  });
});
