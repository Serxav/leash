import { VaultController } from "@paypal/paypal-server-sdk";
import { describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { getMandateView, PAYPAL_SANDBOX_APPROVAL_HOST, startMandate } from "@/payments/mandate";
import { getPayPalClient } from "@/paypal/sdk";

// Real call to the PayPal sandbox vault (Spain account). Local only.
// The payer approval itself is manual: open /lab/payments and connect.
describe("PayPal sandbox vault", () => {
  it("creates a setup token with an approval link on PayPal sandbox", async () => {
    const db = createDb(":memory:");
    const vault = new VaultController(getPayPalClient());

    const { approveUrl } = await startMandate(
      { db, vault },
      {
        userId: "sandbox-test-user",
        returnUrl: "http://localhost:3000/lab/payments/return",
        cancelUrl: "http://localhost:3000/lab/payments/cancel",
      },
    );

    expect(new URL(approveUrl).host).toBe(PAYPAL_SANDBOX_APPROVAL_HOST);
    expect(getMandateView(db, "sandbox-test-user").status).toBe("PENDING");
  });
});
