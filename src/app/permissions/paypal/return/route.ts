import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appDeps } from "@/account/server";
import { currentUserId } from "@/account/visitor";
import { completeMandate } from "@/payments/mandate";
import { PERMISSIONS_PATH } from "../../state";

/**
 * PayPal sends the payer here after they approve (the setup token's
 * return_url). Leash exchanges the setup token it stored itself for this
 * visitor; the `approval_token_id` in the URL is only checked to match it.
 */
export async function GET(request: NextRequest) {
  // Outside the try block: reading the cookie makes the route dynamic, and
  // Next.js signals that with an error that must not be caught here.
  const userId = await currentUserId();
  let destination = `${PERMISSIONS_PATH}?paypal=connected`;
  try {
    await completeMandate(appDeps(), {
      userId,
      approvalTokenId: request.nextUrl.searchParams.get("approval_token_id"),
    });
  } catch (error) {
    console.error("[permissions] completeMandate failed:", (error as Error).name);
    destination = `${PERMISSIONS_PATH}?paypal=error`;
  }
  redirect(destination);
}
