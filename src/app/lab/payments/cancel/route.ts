import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cancelPendingMandate } from "@/payments/mandate";
import { assertLabEnabled, LAB_PATH, LAB_USER_ID } from "../lab";

/** PayPal sends the payer here if they cancel (the setup token's cancel_url). */
export async function GET() {
  assertLabEnabled();
  cancelPendingMandate(getDb(), LAB_USER_ID);
  redirect(`${LAB_PATH}?status=cancelled`);
}
