import { asc, eq, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { demoUsers } from "@/db/schema";
import type { RevokeDeps } from "@/payments/mandate";
import { confirmDraft, saveDraft } from "@/rules/policies";
import type { SpendingRules } from "@/rules/schema";
import { deleteAccount, type DeleteResult } from "./account";

/**
 * Anonymous demo users (brief §5 "Access", D-040).
 *
 * Every visitor gets an isolated space of their own, so two judges at once
 * never step on each other. The user is a random ID in an httpOnly cookie
 * (`src/proxy.ts`): no name, email or password. A new user starts with
 * Marta's rules already confirmed, so the agent can be tried at once.
 *
 * Users not seen for a week are deleted with all their data and their saved
 * PayPal (deleted at PayPal first), and there is a cap on how many exist.
 */

const HOUR_MS = 3_600_000;

/** A user not seen for this long is deleted. */
export const DEMO_USER_TTL_MS = 7 * 24 * HOUR_MS;
/** The most demo users kept at once; the least recently seen go first. */
export const MAX_DEMO_USERS = 500;
/** `lastSeenAt` is written at most this often per user, not on every request. */
const LAST_SEEN_PRECISION_MS = HOUR_MS;

/** The demo persona's rules (brief §2): Marta, office manager in Barcelona. */
export const MARTA_RULES_TEXT =
  "Max 40 € per order, 150 € per month, only office supplies, ask me before anything over 15 €, " +
  "max 5 units of the same item, never buy from marketplace-x.example";

export const MARTA_RULES: SpendingRules = {
  formatVersion: 1,
  currency: "EUR",
  maxPerOrder: "40.00",
  monthlyBudget: "150.00",
  approvalThreshold: "15.00",
  allowedCategories: ["office-supplies"],
  blockedMerchants: ["marketplace-x.example"],
  maxUnitsPerItem: 5,
};

/**
 * Makes sure the visitor's demo user exists. A new one gets Marta's rules,
 * confirmed as version 1. Synchronous, so two requests from the same new
 * visitor never create it twice.
 */
export function ensureDemoUser(db: Db, userId: string, now: Date): { created: boolean } {
  const existing = db.select().from(demoUsers).where(eq(demoUsers.userId, userId)).get();
  if (existing) {
    if (now.getTime() - existing.lastSeenAt.getTime() >= LAST_SEEN_PRECISION_MS) {
      db.update(demoUsers).set({ lastSeenAt: now }).where(eq(demoUsers.userId, userId)).run();
    }
    return { created: false };
  }
  db.insert(demoUsers).values({ userId, createdAt: now, lastSeenAt: now }).run();
  const draftId = saveDraft(db, { userId, sourceText: MARTA_RULES_TEXT, rules: MARTA_RULES, now });
  confirmDraft(db, { userId, draftId, now });
  return { created: true };
}

/** Users to delete: not seen for a week, then the least recently seen above the cap. */
export function demoUsersToPrune(db: Db, now: Date, max = MAX_DEMO_USERS): string[] {
  const expired = db
    .select({ userId: demoUsers.userId })
    .from(demoUsers)
    .where(lt(demoUsers.lastSeenAt, new Date(now.getTime() - DEMO_USER_TTL_MS)))
    .all()
    .map((row) => row.userId);
  const rest = db
    .select({ userId: demoUsers.userId })
    .from(demoUsers)
    .orderBy(asc(demoUsers.lastSeenAt), asc(demoUsers.createdAt))
    .all()
    .map((row) => row.userId)
    .filter((id) => !expired.includes(id));
  const overCap = rest.slice(0, Math.max(0, rest.length - max));
  return [...expired, ...overCap];
}

/**
 * Deletes expired demo users and the ones above the cap, each with its
 * saved PayPal. A user whose token PayPal could not delete stays, and the
 * next run tries again.
 */
export async function pruneDemoUsers(
  deps: RevokeDeps,
  now: Date,
  max = MAX_DEMO_USERS,
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const userId of demoUsersToPrune(deps.db, now, max)) {
    const { result } = await deleteAccount(deps, userId);
    if (result === "DELETED") deleted++;
    else failed++;
  }
  if (deleted || failed) console.info(`[demo-users] pruned ${deleted}, failed ${failed}`);
  return { deleted, failed };
}

/**
 * "Reset demo": deletes everything about the user, saved PayPal included,
 * and starts again from Marta's rules with the same cookie.
 */
export async function resetDemoUser(deps: RevokeDeps, userId: string, now: Date): Promise<DeleteResult> {
  const result = await deleteAccount(deps, userId);
  if (result.result === "DELETED") ensureDemoUser(deps.db, userId, now);
  return result;
}
