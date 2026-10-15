import { PaymentsController } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client";
import { payments, type Payment } from "@/db/schema";
import { stubPayPalClient, type StubReply, type StubRequest } from "@/paypal/testing/stub-client";
import { RefundError, refundPayment, refundRequestId } from "./refund";

const USER = "user-1";
const NOW = new Date("2026-10-20T10:00:00Z");

function seedPayment(values: Partial<Payment> = {}): Payment {
  const row: Payment = {
    id: "pay-1",
    userId: USER,
    intentId: null,
    amount: "5.00",
    currency: "EUR",
    initiator: "CUSTOMER",
    status: "COMPLETED",
    paypalOrderId: "ORDER1",
    captureId: "CAPTURE1",
    refundId: null,
    failureIssue: null,
    debugId: null,
    withdrawalDeadline: new Date(NOW.getTime() + 14 * 86_400_000),
    createdAt: NOW,
    updatedAt: NOW,
    ...values,
  };
  db.insert(payments).values(row).run();
  return row;
}

function refundReply(status: string) {
  return (): StubReply => ({
    status: 201,
    body: { id: "REFUND1", status, amount: { currency_code: "EUR", value: "5.00" } },
  });
}

function paypalError(issue: string, status = 422) {
  return (): StubReply => ({
    status,
    body: { name: "UNPROCESSABLE_ENTITY", message: "x", debug_id: "dbg-refund", details: [{ issue }] },
  });
}

function setup(reply: (request: StubRequest) => StubReply) {
  const { client, requests } = stubPayPalClient(reply);
  return { paymentsApi: new PaymentsController(client), requests };
}

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
});

describe("refundPayment", () => {
  it("refunds the whole capture and marks the payment REFUNDED", async () => {
    seedPayment();
    const { paymentsApi, requests } = setup(refundReply("COMPLETED"));
    const payment = await refundPayment(
      { db, payments: paymentsApi, now: () => NOW },
      { userId: USER, paymentId: "pay-1" },
    );

    expect(payment).toMatchObject({ status: "REFUNDED", refundId: "REFUND1" });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1/refund",
    );
    expect(request.headers["PayPal-Request-Id"]).toBe(refundRequestId("pay-1"));
    // An empty body asks PayPal for a full refund.
    expect(request.body).toEqual({});
  });

  it("keeps a pending refund as COMPLETED with its refund id", async () => {
    seedPayment();
    const { paymentsApi } = setup(refundReply("PENDING"));
    const payment = await refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" });
    expect(payment).toMatchObject({ status: "COMPLETED", refundId: "REFUND1" });
  });

  it("uses the same PayPal-Request-Id on every retry", async () => {
    seedPayment();
    const { paymentsApi, requests } = setup(refundReply("PENDING"));
    await refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" });
    await refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" });
    expect(requests.map((r) => r.headers["PayPal-Request-Id"])).toEqual([
      "refund-pay-1",
      "refund-pay-1",
    ]);
  });

  it("does not call PayPal again for a payment already refunded", async () => {
    seedPayment({ status: "REFUNDED", refundId: "REFUND1" });
    const { paymentsApi, requests } = setup(refundReply("COMPLETED"));
    const payment = await refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" });
    expect(payment.status).toBe("REFUNDED");
    expect(requests).toHaveLength(0);
  });

  it("syncs the record when PayPal says the capture is already refunded", async () => {
    seedPayment();
    const { paymentsApi } = setup(paypalError("CAPTURE_FULLY_REFUNDED"));
    const payment = await refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" });
    expect(payment.status).toBe("REFUNDED");
  });

  it.each(["REFUND_AMOUNT_EXCEEDED", "REFUND_TIME_LIMIT_EXCEEDED", "TRANSACTION_DISPUTED"])(
    "rethrows %s and leaves the payment unchanged",
    async (issue) => {
      seedPayment();
      const { paymentsApi } = setup(paypalError(issue));
      await expect(
        refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" }),
      ).rejects.toMatchObject({ failure: { issue, debugId: "dbg-refund" } });
      expect(db.select().from(payments).get()).toMatchObject({ status: "COMPLETED", refundId: null });
    },
  );

  it.each([
    ["a declined payment", { status: "DECLINED" as const, captureId: null }],
    ["a pending payment", { status: "PENDING" as const, captureId: null }],
  ])("refuses to refund %s", async (_, values) => {
    seedPayment(values);
    const { paymentsApi, requests } = setup(refundReply("COMPLETED"));
    await expect(
      refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" }),
    ).rejects.toMatchObject({ code: "NOT_REFUNDABLE" });
    expect(requests).toHaveLength(0);
  });

  it("never refunds another user's payment", async () => {
    seedPayment({ userId: "someone-else" });
    const { paymentsApi, requests } = setup(refundReply("COMPLETED"));
    await expect(
      refundPayment({ db, payments: paymentsApi }, { userId: USER, paymentId: "pay-1" }),
    ).rejects.toBeInstanceOf(RefundError);
    expect(requests).toHaveLength(0);
  });
});
