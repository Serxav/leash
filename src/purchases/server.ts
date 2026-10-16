import "server-only";
import { OrdersController } from "@paypal/paypal-server-sdk";
import { getCatalog } from "@/catalog/server";
import { getDb } from "@/db/client";
import { chargeWithMandate } from "@/payments/charge";
import { getPayPalClient } from "@/paypal/sdk";
import { proposePurchase, type ProposalInput, type ProposalResult } from "./propose";

/** proposePurchase with the app's database, catalog and PayPal sandbox. */
export function proposeForUser(
  userId: string,
): (input: Omit<ProposalInput, "userId">) => Promise<ProposalResult> {
  const db = getDb();
  return (input) =>
    proposePurchase(
      {
        db,
        catalog: getCatalog(),
        charge: (charge) =>
          chargeWithMandate({ db, orders: new OrdersController(getPayPalClient()) }, charge),
      },
      { ...input, userId },
    );
}
