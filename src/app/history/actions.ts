"use server";

import { refresh } from "next/cache";
import { currentUserId } from "@/account/visitor";
import { refundForUser } from "@/purchases/server";
import type { HistoryFormState } from "./state";

/**
 * US6: the user refunds one purchase in full. The user comes from the
 * server, never from the form; the purchase must be theirs, charged and
 * inside its return window (checked in refundPurchase).
 */
export async function refundPurchaseAction(
  _previous: HistoryFormState,
  formData: FormData,
): Promise<HistoryFormState> {
  const intentId = formData.get("intentId");
  if (typeof intentId !== "string") {
    return { kind: "answered", ok: false, message: "That refund could not be read. Please try again." };
  }
  try {
    const refund = await refundForUser(await currentUserId(), intentId);
    const ok = refund.result === "REFUNDED" || refund.result === "PENDING";
    return { kind: "answered", ok, message: refund.message };
  } catch (error) {
    console.error("[history] refundPurchaseAction failed:", (error as Error).name);
    return { kind: "answered", ok: false, message: "Something went wrong. Reload the page before trying again." };
  } finally {
    refresh();
  }
}
