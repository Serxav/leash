import "server-only";
import { OrdersController } from "@paypal/paypal-server-sdk";
import { getCatalog } from "@/catalog/server";
import { getDb } from "@/db/client";
import { chargeWithMandate } from "@/payments/charge";
import { getPayPalClient } from "@/paypal/sdk";
import { answerApproval, type ApprovalChoice, type ApprovalResult } from "./approve";
import { proposePurchase, type ProposalInput, type ProposalResult, type ProposeDeps } from "./propose";

/** The app's database, catalog and PayPal sandbox. */
function appDeps(): ProposeDeps {
  const db = getDb();
  return {
    db,
    catalog: getCatalog(),
    charge: (charge) =>
      chargeWithMandate({ db, orders: new OrdersController(getPayPalClient()) }, charge),
  };
}

/** proposePurchase for one user, with the app's dependencies. */
export function proposeForUser(
  userId: string,
): (input: Omit<ProposalInput, "userId">) => Promise<ProposalResult> {
  const deps = appDeps();
  return (input) => proposePurchase(deps, { ...input, userId });
}

/** The user's answer in the inbox, with the app's dependencies. */
export function answerForUser(
  userId: string,
  input: { intentId: string; choice: ApprovalChoice },
): Promise<ApprovalResult> {
  return answerApproval(appDeps(), { ...input, userId });
}
