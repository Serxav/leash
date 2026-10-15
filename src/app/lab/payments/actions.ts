"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { chargeWithMandate } from "@/payments/charge";
import { startMandate } from "@/payments/mandate";
import {
  assertLabEnabled,
  chargeDeps,
  failureQuery,
  LAB_PATH,
  LAB_USER_ID,
  mandateDeps,
} from "./lab";

/** US1 step 1: start saving PayPal and send the payer to PayPal sandbox. */
export async function connectPayPal(): Promise<void> {
  assertLabEnabled();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  let destination: string;
  try {
    const { approveUrl } = await startMandate(mandateDeps(), {
      userId: LAB_USER_ID,
      returnUrl: `${origin}${LAB_PATH}/return`,
      cancelUrl: `${origin}${LAB_PATH}/cancel`,
    });
    destination = approveUrl;
  } catch (error) {
    console.error("[lab] connectPayPal failed:", (error as Error).message);
    destination = `${LAB_PATH}?${failureQuery(error)}`;
  }
  // redirect() throws, so it must stay outside the try block (Next.js docs).
  redirect(destination);
}

/**
 * Lab charge of €5 with the saved PayPal. The user clicks the button, so it
 * is customer-initiated and carries the page's FraudNet session id (RDA).
 */
export async function chargeFiveEuros(formData: FormData): Promise<void> {
  assertLabEnabled();
  const clientMetadataId = formData.get("clientMetadataId");

  let destination: string;
  try {
    const payment = await chargeWithMandate(chargeDeps(), {
      userId: LAB_USER_ID,
      amount: "5.00",
      description: "Leash lab test charge",
      initiator: "CUSTOMER",
      clientMetadataId:
        typeof clientMetadataId === "string" ? clientMetadataId : undefined,
    });
    const params = new URLSearchParams({ status: payment.status === "COMPLETED" ? "charged" : "error" });
    if (payment.failureIssue) params.set("issue", payment.failureIssue);
    if (payment.debugId) params.set("debug", payment.debugId);
    destination = `${LAB_PATH}?${params}`;
  } catch (error) {
    console.error("[lab] chargeFiveEuros failed:", (error as Error).message);
    destination = `${LAB_PATH}?${failureQuery(error)}`;
  }
  redirect(destination);
}
