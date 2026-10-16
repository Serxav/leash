import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "@/db/client";
import { policies } from "@/db/schema";
import {
  confirmDraft,
  discardDraft,
  getActivePolicy,
  listPolicyVersions,
  PolicyError,
  saveDraft,
} from "./policies";
import type { SpendingRules } from "./schema";

const USER = "user-1";
const OTHER = "user-2";
const NOW = new Date("2026-10-22T10:00:00Z");
const LATER = new Date("2026-10-23T10:00:00Z");
const TEXT = "Max 40 € per order, 150 € per month, only office supplies";

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
beforeEach(() => {
  db = createDb(":memory:");
});

const draftFor = (userId = USER, changes: Partial<SpendingRules> = {}) =>
  saveDraft(db, { userId, sourceText: TEXT, rules: { ...rules, ...changes }, now: NOW });

describe("policy versions", () => {
  it("applies nothing until the user confirms", () => {
    draftFor();
    expect(getActivePolicy(db, USER)).toBeNull();
    expect(listPolicyVersions(db, USER)).toEqual([]);
  });

  it("confirms a draft as version 1", () => {
    const draftId = draftFor();
    const confirmed = confirmDraft(db, { userId: USER, draftId, now: LATER });
    expect(confirmed).toEqual({ version: 1, confirmedAt: LATER, sourceText: TEXT, rules });
    expect(getActivePolicy(db, USER)).toEqual(confirmed);
  });

  it("makes every change a new version and keeps the old ones", () => {
    confirmDraft(db, { userId: USER, draftId: draftFor(), now: NOW });
    confirmDraft(db, {
      userId: USER,
      draftId: draftFor(USER, { maxPerOrder: "30.00" }),
      now: LATER,
    });
    expect(getActivePolicy(db, USER)).toMatchObject({
      version: 2,
      rules: { maxPerOrder: "30.00" },
    });
    expect(listPolicyVersions(db, USER)).toEqual([
      { version: 2, confirmedAt: LATER },
      { version: 1, confirmedAt: NOW },
    ]);
    expect(db.select().from(policies).all()).toHaveLength(2);
  });

  it("keeps one draft per user: a new one replaces the old one", () => {
    const first = draftFor();
    const second = draftFor(USER, { maxPerOrder: "30.00" });
    expect(() => confirmDraft(db, { userId: USER, draftId: first })).toThrow(PolicyError);
    expect(confirmDraft(db, { userId: USER, draftId: second }).rules.maxPerOrder).toBe("30.00");
  });

  it("discards a draft so it can no longer be confirmed", () => {
    const draftId = draftFor();
    const other = draftFor(OTHER);
    discardDraft(db, USER);
    expect(() => confirmDraft(db, { userId: USER, draftId })).toThrow(PolicyError);
    // Only the user's own draft is dropped.
    expect(confirmDraft(db, { userId: OTHER, draftId: other }).version).toBe(1);
  });

  it("never discards confirmed versions", () => {
    confirmDraft(db, { userId: USER, draftId: draftFor() });
    discardDraft(db, USER);
    expect(getActivePolicy(db, USER)?.version).toBe(1);
  });

  it("numbers versions per user", () => {
    confirmDraft(db, { userId: USER, draftId: draftFor() });
    confirmDraft(db, { userId: OTHER, draftId: draftFor(OTHER) });
    expect(getActivePolicy(db, OTHER)?.version).toBe(1);
  });

  it("caps the stored source text", () => {
    const draftId = saveDraft(db, { userId: USER, sourceText: `  ${"a".repeat(5000)}  `, rules });
    const { sourceText } = confirmDraft(db, { userId: USER, draftId });
    expect(sourceText).toHaveLength(1000);
  });
});

describe("policy security", () => {
  it("refuses to confirm another user's draft", () => {
    const draftId = draftFor(OTHER);
    expect(() => confirmDraft(db, { userId: USER, draftId })).toThrow(
      expect.objectContaining({ code: "DRAFT_NOT_FOUND" }),
    );
    expect(getActivePolicy(db, USER)).toBeNull();
    expect(getActivePolicy(db, OTHER)).toBeNull();
  });

  it("refuses to confirm the same draft twice", () => {
    const draftId = draftFor();
    confirmDraft(db, { userId: USER, draftId });
    expect(() => confirmDraft(db, { userId: USER, draftId })).toThrow(
      expect.objectContaining({ code: "DRAFT_NOT_FOUND" }),
    );
    expect(listPolicyVersions(db, USER)).toHaveLength(1);
  });

  it.each(["", "not-a-uuid", "' OR 1=1 --", "x".repeat(500)])(
    "refuses a malformed draft ID (%j)",
    (draftId) => {
      expect(() => confirmDraft(db, { userId: USER, draftId })).toThrow(
        expect.objectContaining({ code: "DRAFT_NOT_FOUND" }),
      );
    },
  );

  it("refuses to store rules that are not valid", () => {
    expect(() => draftFor(USER, { maxPerOrder: "999.00" })).toThrow(
      expect.objectContaining({ code: "INVALID_RULES" }),
    );
    expect(() =>
      saveDraft(db, {
        userId: USER,
        sourceText: TEXT,
        rules: { ...rules, allowEverything: true } as SpendingRules,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_RULES" }));
    expect(db.select().from(policies).all()).toEqual([]);
  });

  it("fails closed when the latest confirmed rules are not valid", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    confirmDraft(db, { userId: USER, draftId: draftFor() });
    confirmDraft(db, { userId: USER, draftId: draftFor(USER, { maxPerOrder: "30.00" }) });
    // Corrupt only version 2: the engine must not fall back to version 1.
    db.update(policies)
      .set({ rulesJson: '{"allowEverything":true}' })
      .where(eq(policies.version, 2))
      .run();
    expect(getActivePolicy(db, USER)).toBeNull();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("fails closed when the stored rules are not JSON", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    confirmDraft(db, { userId: USER, draftId: draftFor() });
    db.update(policies).set({ rulesJson: "not json" }).run();
    expect(getActivePolicy(db, USER)).toBeNull();
    error.mockRestore();
  });
});
