import "server-only";
import { VaultController } from "@paypal/paypal-server-sdk";
import { getDb } from "@/db/client";
import { getPayPalClient } from "@/paypal/sdk";
import { deleteAccount, revokeForUser, type DeleteResult } from "./account";
import type { RevokeResult } from "@/payments/mandate";

/** The app's database and the PayPal sandbox vault. */
const appDeps = () => ({ db: getDb(), vault: new VaultController(getPayPalClient()) });

export function revokeMandateForUser(userId: string): Promise<RevokeResult> {
  return revokeForUser(appDeps(), userId);
}

export function deleteAccountForUser(userId: string): Promise<DeleteResult> {
  return deleteAccount(appDeps(), userId);
}
