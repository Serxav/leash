import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  decisions,
  mandates,
  payments,
  policies,
  purchaseIntents,
  securityEvents,
  userSettings,
} from "@/db/schema";
import { revokeMandate, type RevokeDeps, type RevokeResult } from "@/payments/mandate";
import { oneAtATime } from "@/purchases/propose";

/**
 * The permissions panel (US7, D-038): revoke the mandate and delete the
 * account. Both run in the user's purchase queue, so they never interleave
 * with a decision and its charge: a purchase that started before finishes
 * first, and none starts after.
 */

export function revokeForUser(deps: RevokeDeps, userId: string): Promise<RevokeResult> {
  return oneAtATime(userId, () => revokeMandate(deps, userId));
}

export type DeleteResult =
  | { result: "DELETED" }
  /** Nothing was deleted: PayPal could not delete the saved PayPal first. */
  | { result: "PAYPAL_FAILED" };

/**
 * Deletes everything Leash stores about the user: rules, proposals and
 * decisions, payments, the security log, settings and the mandate. The
 * saved PayPal is deleted at PayPal first; if that fails, nothing is
 * deleted, so no orphan token stays at PayPal. PayPal keeps its own
 * records of past payments, which Leash cannot delete.
 */
export function deleteAccount(deps: RevokeDeps, userId: string): Promise<DeleteResult> {
  return oneAtATime(userId, async () => {
    const revoked = await revokeMandate(deps, userId);
    if (revoked === "PAYPAL_FAILED") return { result: "PAYPAL_FAILED" };
    deleteUserRows(deps.db, userId);
    return { result: "DELETED" };
  });
}

function deleteUserRows(db: Db, userId: string): void {
  db.transaction((tx) => {
    const intentIds = tx
      .select({ id: purchaseIntents.id })
      .from(purchaseIntents)
      .where(eq(purchaseIntents.userId, userId))
      .all()
      .map((row) => row.id);
    if (intentIds.length > 0) tx.delete(decisions).where(inArray(decisions.intentId, intentIds)).run();
    tx.delete(purchaseIntents).where(eq(purchaseIntents.userId, userId)).run();
    tx.delete(payments).where(eq(payments.userId, userId)).run();
    tx.delete(securityEvents).where(eq(securityEvents.userId, userId)).run();
    tx.delete(policies).where(eq(policies.userId, userId)).run();
    tx.delete(userSettings).where(eq(userSettings.userId, userId)).run();
    tx.delete(mandates).where(eq(mandates.userId, userId)).run();
  });
}
