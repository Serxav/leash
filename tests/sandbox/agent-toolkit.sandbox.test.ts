import { existsSync } from "node:fs";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, DEFAULT_DB_PATH } from "@/db/client";
import { payments } from "@/db/schema";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { checkPurchaseStatus } from "@/agent/leashed-tools";
import { getToolkitRunner, ToolkitError } from "@/paypal/agent-toolkit";

// Real PayPal Agent Toolkit calls in the sandbox (read only, no money moves).
// Uses the newest completed agent purchase in the local database: run the
// agent once on /agent first.
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
});
