import "server-only";
import { getDb } from "@/db/client";
import { getToolkitRunner } from "@/paypal/agent-toolkit";
import { checkPurchaseStatus, type PurchaseStatus } from "./leashed-tools";

/** The leashed status check with the app's database and the sandbox toolkit. */
export function checkStatusForUser(userId: string): (purchaseRef: string) => Promise<PurchaseStatus> {
  const db = getDb();
  return (purchaseRef) =>
    checkPurchaseStatus({ db, runToolkit: getToolkitRunner() }, { userId, purchaseRef });
}
