"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startMandate } from "@/payments/mandate";
import {
  assertLabEnabled,
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
