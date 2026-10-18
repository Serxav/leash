import { existsSync } from "node:fs";
import { OrdersController } from "@paypal/paypal-server-sdk";
import { describe, expect, it } from "vitest";
import { createDb, DEFAULT_DB_PATH } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { chargeWithMandate } from "@/payments/charge";
import { getActiveVaultToken } from "@/payments/mandate";
import { getPayPalClient } from "@/paypal/sdk";

// Real €1.00 sandbox charge with the demo user's saved PayPal (fake money).
// Needs an ACTIVE mandate: connect PayPal once in /lab/payments first.
// The €1.00 counts toward the demo user's budget, like a charge from the lab.
const db = existsSync(DEFAULT_DB_PATH) ? createDb(DEFAULT_DB_PATH) : undefined;
const hasMandate = Boolean(db && getActiveVaultToken(db, DEMO_USER_ID));

describe("PayPal sandbox charge with the vaulted token", () => {
  it.skipIf(!hasMandate)("captures a merchant-initiated EUR payment", async () => {
    const payment = await chargeWithMandate(
      { db: db!, orders: new OrdersController(getPayPalClient()) },
      {
        userId: DEMO_USER_ID,
        amount: "1.00",
        description: "Leash sandbox test (merchant-initiated)",
        initiator: "MERCHANT",
      },
    );
    expect(payment.status).toBe("COMPLETED");
    expect(payment.currency).toBe("EUR");
    expect(payment.captureId).toBeTruthy();
  });

  it.skipIf(!hasMandate)("records a declined payment (negative testing)", async () => {
    const payment = await chargeWithMandate(
      { db: db!, orders: new OrdersController(getPayPalClient()) },
      {
        userId: DEMO_USER_ID,
        amount: "1.00",
        description: "Leash sandbox test (declined)",
        initiator: "MERCHANT",
        sandboxMockIssue: "INSTRUMENT_DECLINED",
      },
    );
    expect(payment.status).toBe("DECLINED");
    expect(payment.failureIssue).toBe("INSTRUMENT_DECLINED");
    expect(payment.debugId).toBeTruthy();
    expect(payment.captureId).toBeNull();
  });
});
