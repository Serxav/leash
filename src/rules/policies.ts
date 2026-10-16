import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, max } from "drizzle-orm";
import type { Db } from "@/db/client";
import { policies, type Policy } from "@/db/schema";
import { MAX_RULES_TEXT_LENGTH } from "./limits";
import { parseRules, type SpendingRules } from "./schema";

/**
 * Versioned spending rules (US2): "nothing applies until I confirm it".
 *
 * 1. `saveDraft` keeps what the AI turned the user's text into, on the
 *    server. The browser only gets a random draft ID and readable tags, so
 *    it cannot send back different rules to confirm.
 * 2. `confirmDraft` turns the user's own draft into the next version.
 * 3. `getActivePolicy` returns the latest confirmed version, validated
 *    again on every read: if it is unreadable there are no rules, and the
 *    engine blocks every purchase (fail closed).
 */

export type ActivePolicy = {
  version: number;
  confirmedAt: Date;
  sourceText: string;
  rules: SpendingRules;
};

export type PolicyVersionSummary = { version: number; confirmedAt: Date };

export class PolicyError extends Error {
  constructor(
    public readonly code: "INVALID_RULES" | "DRAFT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

/** Draft IDs are random UUIDs; anything else is rejected before the query. */
const DRAFT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Stores rules waiting for the user's confirmation and returns the draft
 * ID. A user has at most one draft: a new one replaces the old one.
 */
export function saveDraft(
  db: Db,
  input: { userId: string; sourceText: string; rules: SpendingRules; now?: Date },
): string {
  const parsed = parseRules(input.rules);
  if (!parsed.ok) throw new PolicyError("INVALID_RULES", "These rules are not valid.");
  const id = randomUUID();
  db.transaction((tx) => {
    tx.delete(policies)
      .where(and(eq(policies.userId, input.userId), isNull(policies.version)))
      .run();
    tx.insert(policies)
      .values({
        id,
        userId: input.userId,
        version: null,
        sourceText: input.sourceText.trim().slice(0, MAX_RULES_TEXT_LENGTH),
        rulesJson: JSON.stringify(parsed.rules),
        createdAt: input.now ?? new Date(),
        confirmedAt: null,
      })
      .run();
  });
  return id;
}

/**
 * Drops the user's draft, if any. Called before every new attempt, so the
 * user can only ever confirm the last rules they were shown.
 */
export function discardDraft(db: Db, userId: string): void {
  db.delete(policies)
    .where(and(eq(policies.userId, userId), isNull(policies.version)))
    .run();
}

/** Confirms the user's own draft as their next policy version. */
export function confirmDraft(
  db: Db,
  input: { userId: string; draftId: string; now?: Date },
): ActivePolicy {
  if (!DRAFT_ID_PATTERN.test(input.draftId)) throw draftNotFound();
  return db.transaction((tx) => {
    const draft = tx
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.id, input.draftId),
          eq(policies.userId, input.userId),
          isNull(policies.version),
        ),
      )
      .get();
    if (!draft) throw draftNotFound();
    const rules = readRules(draft);
    if (!rules) throw new PolicyError("INVALID_RULES", "These rules are not valid.");

    const latest = tx
      .select({ version: max(policies.version) })
      .from(policies)
      .where(eq(policies.userId, input.userId))
      .get();
    const version = (latest?.version ?? 0) + 1;
    const confirmedAt = input.now ?? new Date();
    tx.update(policies)
      .set({ version, confirmedAt })
      .where(and(eq(policies.id, draft.id), isNull(policies.version)))
      .run();
    return { version, confirmedAt, sourceText: draft.sourceText, rules };
  });
}

/** The rules the engine must use now, or null if none are confirmed. */
export function getActivePolicy(db: Db, userId: string): ActivePolicy | null {
  const row = db
    .select()
    .from(policies)
    .where(and(eq(policies.userId, userId), isNotNull(policies.version)))
    .orderBy(desc(policies.version))
    .get();
  if (!row || row.version === null || row.confirmedAt === null) return null;
  const rules = readRules(row);
  if (!rules) {
    // Never fall back to an older version: no valid rules means no purchases.
    console.error("[policies] the latest confirmed policy is not valid; no rules apply");
    return null;
  }
  return { version: row.version, confirmedAt: row.confirmedAt, sourceText: row.sourceText, rules };
}

/** Confirmed versions, newest first. */
export function listPolicyVersions(db: Db, userId: string, limit = 10): PolicyVersionSummary[] {
  return db
    .select({ version: policies.version, confirmedAt: policies.confirmedAt })
    .from(policies)
    .where(and(eq(policies.userId, userId), isNotNull(policies.version)))
    .orderBy(desc(policies.version))
    .limit(limit)
    .all()
    .flatMap(({ version, confirmedAt }) =>
      version !== null && confirmedAt !== null ? [{ version, confirmedAt }] : [],
    );
}

function readRules(row: Policy): SpendingRules | null {
  let json: unknown;
  try {
    json = JSON.parse(row.rulesJson);
  } catch {
    return null;
  }
  const parsed = parseRules(json);
  return parsed.ok ? parsed.rules : null;
}

function draftNotFound(): PolicyError {
  return new PolicyError(
    "DRAFT_NOT_FOUND",
    "These rules are no longer waiting for confirmation. Please write them again.",
  );
}
