import { redirect } from "next/navigation";
import { currentUserId } from "@/account/visitor";
import { getDb } from "@/db/client";
import { cancelPendingMandate } from "@/payments/mandate";
import { PERMISSIONS_PATH } from "../../state";

/** PayPal sends the payer here if they cancel (the setup token's cancel_url). */
export async function GET() {
  cancelPendingMandate(getDb(), await currentUserId());
  redirect(`${PERMISSIONS_PATH}?paypal=cancelled`);
}
