"use server";

import { cookies, headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { setAgentPaused } from "@/account/settings";
import { appDeps, deleteAccountForUser, resetDemoForUser, revokeMandateForUser } from "@/account/server";
import { currentUserId } from "@/account/visitor";
import { VISITOR_COOKIE, visitorCookieOptions } from "@/account/visitor-cookie";
import { appOrigin } from "@/config/app-origin";
import { getDb } from "@/db/client";
import { startMandate } from "@/payments/mandate";
import { PAYPAL_PATH, PERMISSIONS_PATH, type PermissionsFormState } from "./state";

const REVOKE_MESSAGES = {
  REVOKED: "PayPal is disconnected. Leash deleted your saved PayPal and will never charge it again.",
  PAYPAL_FAILED:
    "Leash will never charge your saved PayPal again, but PayPal could not delete it right now. Try again in a moment.",
  NOT_CONNECTED: "PayPal is not connected.",
} as const;

const PAYPAL_FIRST_FAILED =
  "PayPal could not delete your saved PayPal first, so nothing changed. Try again in a moment.";

/**
 * US7: pause or resume the agent, revoke the mandate, reset the demo,
 * delete the account. The user comes from the visitor cookie, never from
 * the form.
 */
export async function updatePermissions(
  _previous: PermissionsFormState,
  formData: FormData,
): Promise<PermissionsFormState> {
  const action = formData.get("action");
  try {
    const userId = await currentUserId();
    switch (action) {
      case "pause":
      case "resume":
        setAgentPaused(getDb(), userId, action === "pause", new Date());
        return {
          kind: "answered",
          ok: true,
          message:
            action === "pause"
              ? "The agent is paused. Leash blocks every purchase until you resume it."
              : "The agent is active again, within your rules.",
        };
      case "revoke": {
        const result = await revokeMandateForUser(userId);
        return { kind: "answered", ok: result !== "PAYPAL_FAILED", message: REVOKE_MESSAGES[result] };
      }
      case "reset": {
        const { result } = await resetDemoForUser(userId);
        return result === "DELETED"
          ? { kind: "answered", ok: true, message: "The demo starts again: Marta's rules, no purchases, PayPal not connected." }
          : { kind: "answered", ok: false, message: PAYPAL_FIRST_FAILED };
      }
      case "delete": {
        if (formData.get("confirm") !== "yes") {
          return { kind: "answered", ok: false, message: "Tick the box to confirm before deleting." };
        }
        const { result } = await deleteAccountForUser(userId);
        if (result !== "DELETED") return { kind: "answered", ok: false, message: PAYPAL_FIRST_FAILED };
        // Forget the old anonymous ID too: the next page gets a new demo user.
        (await cookies()).set(VISITOR_COOKIE, crypto.randomUUID(), visitorCookieOptions());
        return {
          kind: "answered",
          ok: true,
          message: "Deleted. Leash no longer stores your rules, purchases or PayPal connection. You now have a new demo space.",
        };
      }
      default:
        return { kind: "answered", ok: false, message: "That action could not be read. Please try again." };
    }
  } catch (error) {
    console.error("[permissions] updatePermissions failed:", (error as Error).name);
    return { kind: "answered", ok: false, message: "Something went wrong. Reload the page before trying again." };
  } finally {
    refresh();
  }
}

/**
 * US1: save PayPal (sandbox) for this visitor. Sends the payer to PayPal's
 * sandbox page to approve; PayPal sends them back to PAYPAL_PATH.
 */
export async function connectPayPal(): Promise<void> {
  const requestHeaders = await headers();
  const userId = await currentUserId();

  let destination: string;
  try {
    const origin = appOrigin(process.env, {
      host: requestHeaders.get("host"),
      proto: requestHeaders.get("x-forwarded-proto"),
    });
    const { approveUrl } = await startMandate(appDeps(), {
      userId,
      returnUrl: `${origin}${PAYPAL_PATH}/return`,
      cancelUrl: `${origin}${PAYPAL_PATH}/cancel`,
    });
    destination = approveUrl;
  } catch (error) {
    console.error("[permissions] connectPayPal failed:", (error as Error).name);
    destination = `${PERMISSIONS_PATH}?paypal=error`;
  }
  // redirect() throws, so it must stay outside the try block (Next.js docs).
  redirect(destination);
}
