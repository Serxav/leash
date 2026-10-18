"use server";

import { refresh } from "next/cache";
import { setAgentPaused } from "@/account/settings";
import { deleteAccountForUser, revokeMandateForUser } from "@/account/server";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import type { PermissionsFormState } from "./state";

const REVOKE_MESSAGES = {
  REVOKED: "PayPal is disconnected. Leash deleted your saved PayPal and will never charge it again.",
  PAYPAL_FAILED:
    "Leash will never charge your saved PayPal again, but PayPal could not delete it right now. Try again in a moment.",
  NOT_CONNECTED: "PayPal is not connected.",
} as const;

/**
 * US7: pause or resume the agent, revoke the mandate, delete the account.
 * The user comes from the server, never from the form.
 */
export async function updatePermissions(
  _previous: PermissionsFormState,
  formData: FormData,
): Promise<PermissionsFormState> {
  const action = formData.get("action");
  try {
    switch (action) {
      case "pause":
      case "resume":
        setAgentPaused(getDb(), DEMO_USER_ID, action === "pause", new Date());
        return {
          kind: "answered",
          ok: true,
          message:
            action === "pause"
              ? "The agent is paused. Leash blocks every purchase until you resume it."
              : "The agent is active again, within your rules.",
        };
      case "revoke": {
        const result = await revokeMandateForUser(DEMO_USER_ID);
        return { kind: "answered", ok: result !== "PAYPAL_FAILED", message: REVOKE_MESSAGES[result] };
      }
      case "delete": {
        if (formData.get("confirm") !== "yes") {
          return { kind: "answered", ok: false, message: "Tick the box to confirm before deleting." };
        }
        const { result } = await deleteAccountForUser(DEMO_USER_ID);
        return result === "DELETED"
          ? { kind: "answered", ok: true, message: "Deleted. Leash no longer stores your rules, purchases or PayPal connection." }
          : {
              kind: "answered",
              ok: false,
              message: "Nothing was deleted: PayPal could not delete your saved PayPal first. Try again in a moment.",
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
