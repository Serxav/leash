import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import { describe, expect, it } from "vitest";
import { createDb, DEFAULT_DB_PATH } from "@/db/client";
import { chargeWithMandate } from "@/payments/charge";
import { getActiveVaultToken } from "@/payments/mandate";
import { refundPayment } from "@/payments/refund";
import { callPayPal } from "@/paypal/errors";
import { getPayPalClient } from "@/paypal/sdk";

// Real sandbox charge of €1.00 and its full refund (fake money).
// Needs an ACTIVE mandate: connect PayPal once in /lab/payments first.
const LAB_USER_ID = "lab-user";
const db = existsSync(DEFAULT_DB_PATH) ? createDb(DEFAULT_DB_PATH) : undefined;
const hasMandate = Boolean(db && getActiveVaultToken(db, LAB_USER_ID));

describe("PayPal sandbox refund", () => {
  it.skipIf(!hasMandate)("refunds a capture once and only once", async () => {
    const client = getPayPalClient();
    const paymentsApi = new PaymentsController(client);

    const charged = await chargeWithMandate(
      { db: db!, orders: new OrdersController(client) },
      {
        userId: LAB_USER_ID,
        amount: "1.00",
        description: "Leash sandbox test (refund)",
        initiator: "MERCHANT",
      },
    );
    expect(charged.status).toBe("COMPLETED");

    const refunded = await refundPayment(
      { db: db!, payments: paymentsApi },
      { userId: LAB_USER_ID, paymentId: charged.id },
    );
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundId).toBeTruthy();

    // A second refund with a new request id is the documented error case.
    await expect(
      callPayPal(() =>
        paymentsApi.refundCapturedPayment({
          captureId: charged.captureId!,
          paypalRequestId: randomUUID(),
          body: {},
        }),
      ),
    ).rejects.toMatchObject({ failure: { issue: "CAPTURE_FULLY_REFUNDED" } });
  });
});
