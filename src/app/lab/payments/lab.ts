import { OrdersController, VaultController } from "@paypal/paypal-server-sdk";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { ChargeError, type ChargeDeps } from "@/payments/charge";
import { MandateError, type MandateDeps } from "@/payments/mandate";
import { PayPalRequestError } from "@/paypal/errors";
import { getPayPalClient } from "@/paypal/sdk";

/**
 * F1 sandbox lab: a minimal page to run the payment flow end to end.
 * Development only; the real UI replaces it in F4/F5.
 */
export const LAB_USER_ID = "lab-user";
export const LAB_PATH = "/lab/payments";

/** The lab never exists in production builds (the public demo). */
export function assertLabEnabled(): void {
  if (process.env.NODE_ENV === "production") notFound();
}

export function mandateDeps(): MandateDeps {
  return { db: getDb(), vault: new VaultController(getPayPalClient()) };
}

export function chargeDeps(): ChargeDeps {
  return { db: getDb(), orders: new OrdersController(getPayPalClient()) };
}

/** Query string describing a failure, safe to show: no secrets or tokens. */
export function failureQuery(error: unknown): string {
  const params = new URLSearchParams({ status: "error" });
  if (error instanceof PayPalRequestError) {
    if (error.failure.issue) params.set("issue", error.failure.issue);
    else if (error.failure.name) params.set("issue", error.failure.name);
    if (error.failure.debugId) params.set("debug", error.failure.debugId);
  } else if (error instanceof MandateError || error instanceof ChargeError) {
    params.set("issue", error.code);
  } else {
    params.set("issue", "UNEXPECTED_ERROR");
  }
  return params.toString();
}
