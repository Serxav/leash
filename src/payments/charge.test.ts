import { OrdersController } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client";
import { mandates, payments } from "@/db/schema";
import { stubPayPalClient, type StubReply, type StubRequest } from "@/paypal/testing/stub-client";
import {
  ChargeError,
  chargeWithMandate,
  isSandboxMockIssue,
  listPayments,
  newClientMetadataId,
  RETURN_WINDOW_DAYS,
} from "./charge";

const USER = "user-1";
const CMID = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-10-20T10:00:00Z");

function completedOrder(request: StubRequest): StubReply {
  const body = request.body as { purchase_units: Array<{ amount: unknown }> };
  return {
    status: 201,
    body: {
      id: "ORDER1",
      status: "COMPLETED",
      purchase_units: [
        {
          reference_id: "default",
          payments: {
            captures: [
              { id: "CAPTURE1", status: "COMPLETED", amount: body.purchase_units[0].amount },
            ],
          },
        },
      ],
    },
  };
}

function setup(reply: (request: StubRequest) => StubReply) {
  const { client, requests } = stubPayPalClient(reply);
  return { orders: new OrdersController(client), requests };
}

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  db.insert(mandates)
    .values({
      id: "m1",
      userId: USER,
      status: "ACTIVE",
      setupTokenId: "SETUP1",
      paypalCustomerId: "customer_1",
      vaultTokenRef: "VAULTTOKEN1",
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
});

const customerCharge = {
  userId: USER,
  amount: "5.00",
  description: "Test charge",
  initiator: "CUSTOMER" as const,
  clientMetadataId: CMID,
};

describe("chargeWithMandate", () => {
  it("creates a captured EUR order with the vaulted token", async () => {
    const { orders, requests } = setup(completedOrder);
    const payment = await chargeWithMandate({ db, orders, now: () => NOW }, customerCharge);

    expect(payment).toMatchObject({
      status: "COMPLETED",
      amount: "5.00",
      currency: "EUR",
      initiator: "CUSTOMER",
      paypalOrderId: "ORDER1",
      captureId: "CAPTURE1",
    });
    expect(payment.withdrawalDeadline?.getTime()).toBe(
      NOW.getTime() + RETURN_WINDOW_DAYS * 86_400_000,
    );

    const request = requests.find((r) => r.url.endsWith("/v2/checkout/orders"));
    expect(request?.method).toBe("POST");
    expect(request?.url.startsWith("https://api-m.sandbox.paypal.com/")).toBe(true);
    expect(request?.headers["PayPal-Request-Id"]).toBe(payment.id);
    expect(request?.headers["PayPal-Client-Metadata-Id"]).toBe(CMID);
    expect(request?.body).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [
        { amount: { currency_code: "EUR", value: "5.00" }, invoice_id: payment.id },
      ],
      payment_source: {
        paypal: {
          vault_id: "VAULTTOKEN1",
          stored_credential: { payment_initiator: "CUSTOMER", usage_pattern: "IMMEDIATE" },
        },
      },
    });
  });

  it("marks agent charges as merchant-initiated without risk data", async () => {
    const { orders, requests } = setup(completedOrder);
    await chargeWithMandate(
      { db, orders },
      { ...customerCharge, initiator: "MERCHANT", clientMetadataId: undefined },
    );
    const request = requests.find((r) => r.url.endsWith("/v2/checkout/orders"));
    expect(request?.headers["PayPal-Client-Metadata-Id"]).toBeUndefined();
    expect(request?.body).toMatchObject({
      payment_source: { paypal: { stored_credential: { payment_initiator: "MERCHANT" } } },
    });
  });

  it("requires FraudNet risk data for customer-initiated charges", async () => {
    const { orders, requests } = setup(completedOrder);
    await expect(
      chargeWithMandate({ db, orders }, { ...customerCharge, clientMetadataId: undefined }),
    ).rejects.toMatchObject({ code: "MISSING_RISK_DATA" });
    await expect(
      chargeWithMandate({ db, orders }, { ...customerCharge, clientMetadataId: "not-hex!" }),
    ).rejects.toMatchObject({ code: "INVALID_RISK_DATA" });
    expect(requests).toHaveLength(0);
  });

  it.each(["5", "5.0", "-5.00", "0.00", "1e3", "5.001", "abc"])(
    "rejects the malformed amount %s before calling PayPal",
    async (amount) => {
      const { orders, requests } = setup(completedOrder);
      await expect(
        chargeWithMandate({ db, orders }, { ...customerCharge, amount }),
      ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
      expect(requests).toHaveLength(0);
    },
  );

  it("refuses to charge without an active mandate", async () => {
    db.delete(mandates).run();
    const { orders, requests } = setup(completedOrder);
    await expect(
      chargeWithMandate({ db, orders }, customerCharge),
    ).rejects.toBeInstanceOf(ChargeError);
    expect(requests).toHaveLength(0);
  });

  it("records a declined payment with its issue and debug id", async () => {
    const { orders } = setup(() => ({
      status: 422,
      body: {
        name: "UNPROCESSABLE_ENTITY",
        message: "x",
        debug_id: "dbg-decline",
        details: [{ issue: "INSTRUMENT_DECLINED", description: "declined" }],
      },
    }));
    const payment = await chargeWithMandate({ db, orders }, customerCharge);
    expect(payment).toMatchObject({
      status: "DECLINED",
      failureIssue: "INSTRUMENT_DECLINED",
      debugId: "dbg-decline",
      captureId: null,
      withdrawalDeadline: null,
    });
  });

  it("asks the sandbox for a declined payment with PayPal-Mock-Response", async () => {
    const { orders, requests } = setup(() => ({
      status: 422,
      body: {
        name: "UNPROCESSABLE_ENTITY",
        message: "x",
        debug_id: "dbg-mock",
        details: [{ issue: "INSTRUMENT_DECLINED" }],
      },
    }));
    const payment = await chargeWithMandate(
      { db, orders },
      { ...customerCharge, sandboxMockIssue: "INSTRUMENT_DECLINED" },
    );
    expect(requests[0]?.headers["PayPal-Mock-Response"]).toBe(
      '{"mock_application_codes":"INSTRUMENT_DECLINED"}',
    );
    expect(payment).toMatchObject({ status: "DECLINED", failureIssue: "INSTRUMENT_DECLINED" });
  });

  it("sends no PayPal-Mock-Response header on normal charges", async () => {
    const { orders, requests } = setup(completedOrder);
    await chargeWithMandate({ db, orders }, customerCharge);
    expect(requests[0]?.headers["PayPal-Mock-Response"]).toBeUndefined();
  });

  it("records other PayPal errors as FAILED", async () => {
    const { orders } = setup(() => ({
      status: 422,
      body: { name: "UNPROCESSABLE_ENTITY", message: "x", debug_id: "d2", details: [{ issue: "PAYEE_ACCOUNT_RESTRICTED" }] },
    }));
    const payment = await chargeWithMandate({ db, orders }, customerCharge);
    expect(payment).toMatchObject({ status: "FAILED", failureIssue: "PAYEE_ACCOUNT_RESTRICTED" });
  });

  it("keeps a pending capture as PENDING", async () => {
    const { orders } = setup(() => ({
      status: 201,
      body: {
        id: "ORDER2",
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: "CAP2", status: "PENDING" }] } }],
      },
    }));
    const payment = await chargeWithMandate({ db, orders }, customerCharge);
    expect(payment.status).toBe("PENDING");
    expect(payment.withdrawalDeadline).toBeNull();
  });

  it("keeps the attempt PENDING when the outcome is unknown", async () => {
    const orders = {
      createOrder: () => Promise.reject(new TypeError("socket hang up")),
    } as unknown as OrdersController;
    await expect(chargeWithMandate({ db, orders }, customerCharge)).rejects.toThrow("socket hang up");
    expect(db.select().from(payments).all()[0]?.status).toBe("PENDING");
  });

  it("never exposes the vault token in payment views", async () => {
    const { orders } = setup(completedOrder);
    await chargeWithMandate({ db, orders }, customerCharge);
    expect(JSON.stringify(listPayments(db, USER))).not.toContain("VAULTTOKEN1");
  });
});

describe("newClientMetadataId", () => {
  it("is 32 lowercase hex characters and unique", () => {
    const a = newClientMetadataId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newClientMetadataId()).not.toBe(a);
  });
});

describe("isSandboxMockIssue", () => {
  it("accepts only the supported negative-testing issues", () => {
    expect(isSandboxMockIssue("INSTRUMENT_DECLINED")).toBe(true);
    expect(isSandboxMockIssue("DUPLICATE_INVOICE_ID")).toBe(false);
    expect(isSandboxMockIssue(null)).toBe(false);
  });
});
