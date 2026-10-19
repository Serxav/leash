import { VaultController } from "@paypal/paypal-server-sdk";
import { getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalProduct } from "@/catalog/local";
import { createDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { mandates, payments, securityEvents } from "@/db/schema";
import type { ChargeInput, PaymentView } from "@/payments/charge";
import { getActiveVaultToken } from "@/payments/mandate";
import { stubPayPalClient, type StubReply } from "@/paypal/testing/stub-client";
import { proposePurchase } from "@/purchases/propose";
import { confirmDraft, saveDraft } from "@/rules/policies";
import type { SpendingRules } from "@/rules/schema";
import { deleteAccount, revokeForUser } from "./account";
import { isAgentPaused, setAgentPaused } from "./settings";

const USER = "user-1";
const OTHER = "someone-else";
const NOW = new Date("2026-10-20T10:00:00Z");

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
let charged: ChargeInput[];

async function fakeCharge(input: ChargeInput): Promise<PaymentView> {
  charged.push(input);
  const row = {
    id: `pay-${input.userId}-${charged.length}`, userId: input.userId, intentId: input.intentId ?? null,
    amount: input.amount, currency: "EUR", initiator: input.initiator, status: "COMPLETED" as const,
    createdAt: NOW, updatedAt: NOW,
  };
  db.insert(payments).values(row).run();
  return {
    ...row, paypalOrderId: "ORDER", captureId: "CAPTURE", refundId: null, failureIssue: null,
    debugId: null, withdrawalDeadline: null,
  };
}

const vaultReplying = (reply: StubReply) => {
  const { client, requests } = stubPayPalClient(() => reply);
  return { vault: new VaultController(client), requests };
};
const deleted: StubReply = { status: 204, body: "" };

/** A demo user with rules, a mandate, a charged purchase, a security event and settings. */
async function fullUser(userId: string) {
  confirmDraft(db, { userId, draftId: saveDraft(db, { userId, sourceText: "rules", rules }) });
  db.insert(schema.demoUsers).values({ userId, createdAt: NOW, lastSeenAt: NOW }).run();
  db.insert(mandates).values({
    id: `m-${userId}`, userId, status: "ACTIVE", vaultTokenRef: `TOKEN-${userId}`, createdAt: NOW, updatedAt: NOW,
  }).run();
  const result = await proposePurchase(
    { db, catalog: { getProduct: async (id) => getLocalProduct(id) }, charge: fakeCharge, now: () => NOW },
    { userId, productId: "local-sticky-notes", merchantDomain: "office-supplies-demo.example", quantity: 1, reason: "Notes." },
  );
  expect(result.paymentStatus).toBe("COMPLETED");
  db.insert(securityEvents).values({
    id: `s-${userId}`, userId, stage: "SEARCH", productId: "local-sticky-notes-deal", productSource: "local",
    productTitle: "Trap", merchantDomain: null, signalsJson: "[]", intentId: null, createdAt: NOW,
  }).run();
  setAgentPaused(db, userId, true, NOW);
}

/** Rows per table that belong to the user, for every table with a user_id column. */
function userRows(userId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of Object.values(schema)) {
    if (!is(table, SQLiteTable) || !("userId" in getTableColumns(table))) continue;
    const name = getTableName(table);
    counts[name] = db.get<{ n: number }>(sql`select count(*) as n from ${sql.identifier(name)} where user_id = ${userId}`).n;
  }
  return counts;
}

beforeEach(() => {
  db = createDb(":memory:");
  charged = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("pause the agent (US7)", () => {
  it("is active by default and can be paused and resumed", () => {
    expect(isAgentPaused(db, USER)).toBe(false);
    setAgentPaused(db, USER, true, NOW);
    expect(isAgentPaused(db, USER)).toBe(true);
    expect(isAgentPaused(db, OTHER)).toBe(false);
    setAgentPaused(db, USER, false, NOW);
    expect(isAgentPaused(db, USER)).toBe(false);
  });
});

describe("delete my account and data (US7, D-038)", () => {
  it("deletes every row about the user, in every table, and the saved PayPal at PayPal", async () => {
    await fullUser(USER);
    await fullUser(OTHER);
    const before = userRows(USER);
    expect(Object.values(before).every((n) => n > 0)).toBe(true);

    const { vault, requests } = vaultReplying(deleted);
    expect(await deleteAccount({ db, vault }, USER)).toEqual({ result: "DELETED" });

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      `DELETE /v3/vault/payment-tokens/TOKEN-${USER}`,
    ]);
    expect(Object.values(userRows(USER)).every((n) => n === 0)).toBe(true);
    expect(db.select().from(schema.decisions).all()).toHaveLength(1); // the other user's
    expect(userRows(OTHER)).toEqual(before);
    expect(getActiveVaultToken(db, OTHER)).toBe(`TOKEN-${OTHER}`);
  });

  it("deletes nothing when PayPal cannot delete the saved PayPal first", async () => {
    await fullUser(USER);
    const before = userRows(USER);
    const { vault } = vaultReplying({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "dbg" } });
    expect(await deleteAccount({ db, vault }, USER)).toEqual({ result: "PAYPAL_FAILED" });
    expect(userRows(USER)).toEqual(before);
    // Charges still stopped: the mandate is revoked.
    expect(getActiveVaultToken(db, USER)).toBeUndefined();
  });

  it("works for a user who never connected PayPal", async () => {
    setAgentPaused(db, USER, true, NOW);
    const { vault, requests } = vaultReplying(deleted);
    expect(await deleteAccount({ db, vault }, USER)).toEqual({ result: "DELETED" });
    expect(requests).toEqual([]);
    expect(isAgentPaused(db, USER)).toBe(false);
  });
});

describe("revoke runs after a purchase already in progress", () => {
  it("lets a started purchase finish, and blocks the next one", async () => {
    await fullUser(USER);
    setAgentPaused(db, USER, false, NOW);
    let release!: () => void;
    const slowCatalog = {
      getProduct: (id: string) =>
        new Promise<ReturnType<typeof getLocalProduct>>((resolve) => {
          release = () => resolve(getLocalProduct(id));
        }),
    };
    const input = { userId: USER, productId: "local-sticky-notes", merchantDomain: "office-supplies-demo.example", quantity: 1, reason: "More." };
    const deps = { db, catalog: slowCatalog, charge: fakeCharge, now: () => NOW };

    const purchase = proposePurchase(deps, input);
    const revoke = revokeForUser({ db, vault: vaultReplying(deleted).vault }, USER);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    expect((await purchase).paymentStatus).toBe("COMPLETED");
    expect(await revoke).toBe("REVOKED");

    const next = await proposePurchase({ ...deps, catalog: { getProduct: async (id) => getLocalProduct(id) } }, input);
    expect(next).toMatchObject({ outcome: "BLOCK" });
    expect(charged).toHaveLength(2); // the first purchase of fullUser and the one in progress
  });
});
