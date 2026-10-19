import { VaultController } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "@/db/client";
import { demoUsers, mandates } from "@/db/schema";
import { getActiveVaultToken } from "@/payments/mandate";
import { stubPayPalClient, type StubReply } from "@/paypal/testing/stub-client";
import { getActivePolicy, listPolicyVersions } from "@/rules/policies";
import { isAgentPaused, setAgentPaused } from "./settings";
import {
  DEMO_USER_TTL_MS,
  demoUsersToPrune,
  ensureDemoUser,
  MARTA_RULES,
  MARTA_RULES_TEXT,
  pruneDemoUsers,
  resetDemoUser,
} from "./demo-users";

const NOW = new Date("2026-12-01T10:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 3_600_000;

let db: Db;

const vaultReplying = (reply: StubReply) => {
  const { client, requests } = stubPayPalClient(() => reply);
  return { vault: new VaultController(client), requests };
};
const deleted: StubReply = { status: 204, body: "" };

const lastSeen = (userId: string) =>
  db.select().from(demoUsers).all().find((row) => row.userId === userId)?.lastSeenAt;

function connect(userId: string) {
  db.insert(mandates).values({
    id: `m-${userId}`, userId, status: "ACTIVE", vaultTokenRef: `TOKEN-${userId}`, createdAt: NOW, updatedAt: NOW,
  }).run();
}

beforeEach(() => {
  db = createDb(":memory:");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("a new visitor's demo user (D-040)", () => {
  it("starts with Marta's rules confirmed as version 1", () => {
    expect(ensureDemoUser(db, "visitor-a", NOW)).toEqual({ created: true });
    expect(getActivePolicy(db, "visitor-a")).toMatchObject({
      version: 1,
      sourceText: MARTA_RULES_TEXT,
      rules: MARTA_RULES,
    });
  });

  it("is created once, and keeps the visitor's own changes", () => {
    ensureDemoUser(db, "visitor-a", NOW);
    setAgentPaused(db, "visitor-a", true, NOW);
    expect(ensureDemoUser(db, "visitor-a", at(HOUR))).toEqual({ created: false });
    expect(listPolicyVersions(db, "visitor-a")).toHaveLength(1);
    expect(isAgentPaused(db, "visitor-a")).toBe(true);
  });

  it("keeps two visitors apart", () => {
    ensureDemoUser(db, "visitor-a", NOW);
    ensureDemoUser(db, "visitor-b", NOW);
    setAgentPaused(db, "visitor-a", true, NOW);
    expect(isAgentPaused(db, "visitor-b")).toBe(false);
  });

  it("writes the last visit at most once an hour", () => {
    ensureDemoUser(db, "visitor-a", NOW);
    ensureDemoUser(db, "visitor-a", at(HOUR - 1));
    expect(lastSeen("visitor-a")).toEqual(NOW);
    ensureDemoUser(db, "visitor-a", at(HOUR));
    expect(lastSeen("visitor-a")).toEqual(at(HOUR));
  });
});

describe("pruning demo users", () => {
  it("picks users not seen for a week, then the least recently seen above the cap", () => {
    ensureDemoUser(db, "old", NOW);
    ensureDemoUser(db, "a", at(DEMO_USER_TTL_MS - 3 * HOUR));
    ensureDemoUser(db, "b", at(DEMO_USER_TTL_MS - 2 * HOUR));
    ensureDemoUser(db, "c", at(DEMO_USER_TTL_MS - HOUR));
    const later = at(DEMO_USER_TTL_MS + 1);
    expect(demoUsersToPrune(db, later, 10)).toEqual(["old"]);
    expect(demoUsersToPrune(db, later, 2)).toEqual(["old", "a"]);
    expect(demoUsersToPrune(db, at(DEMO_USER_TTL_MS), 10)).toEqual([]); // exactly a week: kept
  });

  it("deletes them with their saved PayPal, and keeps the others", async () => {
    ensureDemoUser(db, "old", NOW);
    connect("old");
    ensureDemoUser(db, "recent", at(DEMO_USER_TTL_MS));
    connect("recent");
    const { vault, requests } = vaultReplying(deleted);

    expect(await pruneDemoUsers({ db, vault }, at(DEMO_USER_TTL_MS + 1))).toEqual({ deleted: 1, failed: 0 });
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      "DELETE /v3/vault/payment-tokens/TOKEN-old",
    ]);
    expect(db.select().from(demoUsers).all().map((row) => row.userId)).toEqual(["recent"]);
    expect(getActivePolicy(db, "old")).toBeNull();
    expect(getActiveVaultToken(db, "recent")).toBe("TOKEN-recent");
  });

  it("keeps a user whose saved PayPal could not be deleted, to try again later", async () => {
    ensureDemoUser(db, "old", NOW);
    connect("old");
    const { vault } = vaultReplying({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "dbg" } });
    expect(await pruneDemoUsers({ db, vault }, at(DEMO_USER_TTL_MS + 1))).toEqual({ deleted: 0, failed: 1 });
    expect(lastSeen("old")).toEqual(NOW);
    expect(getActiveVaultToken(db, "old")).toBeUndefined(); // revoked: never charged again
  });
});

describe("Reset demo", () => {
  it("deletes everything, saved PayPal included, and starts again from Marta's rules", async () => {
    ensureDemoUser(db, "visitor-a", NOW);
    connect("visitor-a");
    setAgentPaused(db, "visitor-a", true, NOW);
    const { vault, requests } = vaultReplying(deleted);

    expect(await resetDemoUser({ db, vault }, "visitor-a", at(HOUR))).toEqual({ result: "DELETED" });
    expect(requests).toHaveLength(1);
    expect(getActiveVaultToken(db, "visitor-a")).toBeUndefined();
    expect(isAgentPaused(db, "visitor-a")).toBe(false);
    expect(getActivePolicy(db, "visitor-a")).toMatchObject({ version: 1, rules: MARTA_RULES });
    expect(lastSeen("visitor-a")).toEqual(at(HOUR));
  });

  it("changes nothing when PayPal cannot delete the saved PayPal", async () => {
    ensureDemoUser(db, "visitor-a", NOW);
    connect("visitor-a");
    setAgentPaused(db, "visitor-a", true, NOW);
    const { vault } = vaultReplying({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "dbg" } });
    expect(await resetDemoUser({ db, vault }, "visitor-a", at(HOUR))).toEqual({ result: "PAYPAL_FAILED" });
    expect(isAgentPaused(db, "visitor-a")).toBe(true);
    expect(lastSeen("visitor-a")).toEqual(NOW);
  });
});
