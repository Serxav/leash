import { existsSync } from "node:fs";
import { OrdersController } from "@paypal/paypal-server-sdk";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, DEFAULT_DB_PATH } from "@/db/client";
import { payments } from "@/db/schema";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { checkPurchaseStatus } from "@/agent/leashed-tools";
import { chargeWithMandate } from "@/payments/charge";
import { getActiveVaultToken } from "@/payments/mandate";
import { refundRequestId } from "@/payments/refund";
import { getToolkitRunner, ToolkitError } from "@/paypal/agent-toolkit";
import { getPayPalClient } from "@/paypal/sdk";

// Real PayPal Agent Toolkit calls in the sandbox (fake money). The reads use
// the newest completed agent purchase in the local database: run the agent
// once on /agent first. The refund test charges €1.00 and refunds it.
const db = existsSync(DEFAULT_DB_PATH) ? createDb(DEFAULT_DB_PATH) : undefined;
const payment = db
  ?.select()
  .from(payments)
  .where(and(eq(payments.userId, DEMO_USER_ID), eq(payments.status, "COMPLETED"), isNotNull(payments.intentId)))
  .orderBy(desc(payments.createdAt))
  .get();

describe("PayPal Agent Toolkit (sandbox)", () => {
  it.skipIf(!payment?.paypalOrderId)("reads a Leash order with get_order", async () => {
    const order = (await getToolkitRunner()("get_order", { id: payment!.paypalOrderId! })) as {
      id: string;
      status: string;
      purchase_units: Array<{ amount: { value: string; currency_code: string } }>;
    };
    expect(order.id).toBe(payment!.paypalOrderId);
    expect(order.status).toBe("COMPLETED");
    expect(order.purchase_units[0].amount).toMatchObject({ value: payment!.amount, currency_code: "EUR" });
  });

  it("reports an order that does not exist as a PayPal error", async () => {
    await expect(getToolkitRunner()("get_order", { id: "0NOTAREALORDER0" })).rejects.toMatchObject({
      code: "PAYPAL_ERROR",
    });
    await expect(getToolkitRunner()("get_order", { id: "0NOTAREALORDER0" })).rejects.toBeInstanceOf(ToolkitError);
  });

  it.skipIf(!payment?.intentId)("confirms the purchase through the leashed tool, with whitelisted fields only", async () => {
    const status = await checkPurchaseStatus(
      { db: db!, runToolkit: getToolkitRunner() },
      { userId: DEMO_USER_ID, purchaseRef: payment!.intentId! },
    );
    expect(status).toMatchObject({
      result: "CHECKED",
      orderStatus: "COMPLETED",
      paymentStatus: "COMPLETED",
      matchesLeashRecords: true,
    });
    expect(JSON.stringify(status)).not.toContain(payment!.paypalOrderId!);
  });

  it.skipIf(!db || !getActiveVaultToken(db, DEMO_USER_ID))(
    "refunds a capture in full once, even when the refund is sent twice",
    async () => {
      const charged = await chargeWithMandate(
        { db: db!, orders: new OrdersController(getPayPalClient()) },
        { userId: DEMO_USER_ID, amount: "1.00", description: "Leash sandbox test (toolkit refund)", initiator: "MERCHANT" },
      );
      expect(charged.status).toBe("COMPLETED");

      const requestId = refundRequestId(charged.id);
      const run = getToolkitRunner();
      const first = (await run("create_refund", { capture_id: charged.captureId! }, { requestId })) as {
        id: string;
        status: string;
      };
      expect(first.status).toBe("COMPLETED");
      // Same PayPal-Request-Id: PayPal returns the same refund, not a new one.
      const again = (await run("create_refund", { capture_id: charged.captureId! }, { requestId })) as { id: string };
      expect(again.id).toBe(first.id);

      // Keep the local record true: this €1.00 no longer counts toward the budget.
      db!.update(payments).set({ status: "REFUNDED", refundId: first.id }).where(eq(payments.id, charged.id)).run();
    },
    60_000,
  );
});
