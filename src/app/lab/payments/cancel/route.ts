import { redirect } from "next/navigation";
import { currentUserId } from "@/account/visitor";
import { getDb } from "@/db/client";
import { cancelPendingMandate } from "@/payments/mandate";
import { assertLabEnabled, LAB_PATH } from "../lab";

/** PayPal sends the payer here if they cancel (the setup token's cancel_url). */
export async function GET() {
  assertLabEnabled();
  cancelPendingMandate(getDb(), await currentUserId());
  redirect(`${LAB_PATH}?status=cancelled`);
}
