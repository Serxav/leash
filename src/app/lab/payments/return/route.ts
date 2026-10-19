import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { currentUserId } from "@/account/visitor";
import { completeMandate } from "@/payments/mandate";
import {
  assertLabEnabled,
  failureQuery,
  LAB_PATH,
  mandateDeps,
} from "../lab";

/**
 * PayPal sends the payer here after they approve (the setup token's
 * return_url). Leash exchanges the setup token it stored itself; the
 * `approval_token_id` in the URL is only checked to match it.
 */
export async function GET(request: NextRequest) {
  assertLabEnabled();
  let destination = `${LAB_PATH}?status=connected`;
  try {
    await completeMandate(mandateDeps(), {
      userId: await currentUserId(),
      approvalTokenId: request.nextUrl.searchParams.get("approval_token_id"),
    });
  } catch (error) {
    console.error("[lab] completeMandate failed:", (error as Error).message);
    destination = `${LAB_PATH}?${failureQuery(error)}`;
  }
  redirect(destination);
}
