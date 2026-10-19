"use server";

import { refresh } from "next/cache";
import { currentUserId } from "@/account/visitor";
import { answerForUser } from "@/purchases/server";
import type { InboxFormState } from "./state";

/**
 * US5: the user approves or rejects one pending purchase. The user comes
 * from the server, never from the form; the purchase must be theirs and
 * still waiting (checked in answerApproval).
 */
export async function answerPurchase(
  _previous: InboxFormState,
  formData: FormData,
): Promise<InboxFormState> {
  const intentId = formData.get("intentId");
  const choice = formData.get("choice");
  if (typeof intentId !== "string" || (choice !== "APPROVE" && choice !== "REJECT")) {
    return { kind: "answered", ok: false, message: "That answer could not be read. Please try again." };
  }
  try {
    const answer = await answerForUser(await currentUserId(), { intentId, choice });
    const ok =
      answer.result === "REJECTED" ||
      (answer.result === "APPROVED" && answer.paymentStatus === "COMPLETED");
    return { kind: "answered", ok, message: answer.message };
  } catch (error) {
    console.error("[inbox] answerPurchase failed:", (error as Error).name);
    return { kind: "answered", ok: false, message: "Something went wrong. Reload the page before trying again." };
  } finally {
    // Show the purchase leaving the inbox.
    refresh();
  }
}
