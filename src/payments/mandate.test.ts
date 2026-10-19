import { VaultController } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client";
import { mandates } from "@/db/schema";
import { PayPalRequestError } from "@/paypal/errors";
import { stubPayPalClient, type StubReply, type StubRequest } from "@/paypal/testing/stub-client";
import {
  cancelPendingMandate,
  completeMandate,
  getActiveVaultToken,
  getMandateView,
  MandateError,
  revokeMandate,
  startMandate,
} from "./mandate";

const USER = "user-1";
const urls = {
  returnUrl: "http://localhost:3000/lab/payments/return",
  cancelUrl: "http://localhost:3000/lab/payments",
};

const setupTokenCreated: StubReply = {
  status: 201,
  body: {
    id: "SETUP123",
    customer: { id: "customer_1" },
    status: "PAYER_ACTION_REQUIRED",
    links: [
      { href: "https://api-m.sandbox.paypal.com/v3/vault/setup-tokens/SETUP123", rel: "self", method: "GET" },
      { href: "https://www.sandbox.paypal.com/agreements/approve?approval_session_id=SETUP123", rel: "approve", method: "GET" },
    ],
  },
};

const paymentTokenCreated: StubReply = {
  status: 201,
  body: { id: "PAYTOKEN9", customer: { id: "customer_1" } },
};

function setup(reply: (request: StubRequest) => StubReply) {
  const { client, requests } = stubPayPalClient(reply);
  return { vault: new VaultController(client), requests };
}

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
});

describe("startMandate", () => {
  it("creates a setup token and stores a pending mandate", async () => {
    const { vault, requests } = setup(() => setupTokenCreated);
    const { approveUrl } = await startMandate({ db, vault }, { userId: USER, ...urls });

    expect(approveUrl).toBe(
      "https://www.sandbox.paypal.com/agreements/approve?approval_session_id=SETUP123",
    );
    expect(getMandateView(db, USER).status).toBe("PENDING");

    const request = requests.find((r) => r.url.endsWith("/v3/vault/setup-tokens"));
    expect(request?.method).toBe("POST");
    expect(request?.url.startsWith("https://api-m.sandbox.paypal.com/")).toBe(true);
    expect(request?.headers["PayPal-Request-Id"]).toMatch(/-setup$/);
    expect(request?.body).toMatchObject({
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          customer_type: "CONSUMER",
          permit_multiple_payment_tokens: true,
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: urls.returnUrl,
            cancel_url: urls.cancelUrl,
          },
        },
      },
    });
  });

  it("refuses an approval link outside PayPal sandbox", async () => {
    const { vault } = setup(() => ({
      status: 201,
      body: {
        id: "SETUP123",
        links: [{ href: "https://www.paypal.com/agreements/approve?x=1", rel: "approve", method: "GET" }],
      },
    }));
    await expect(
      startMandate({ db, vault }, { userId: USER, ...urls }),
    ).rejects.toMatchObject({ code: "UNEXPECTED_PAYPAL_RESPONSE" });
    expect(getMandateView(db, USER).status).toBe("NONE");
  });

  it("does not start a second mandate while one is active", async () => {
    const { vault } = setup((r) =>
      r.url.endsWith("/payment-tokens") ? paymentTokenCreated : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    await completeMandate({ db, vault }, { userId: USER });

    await expect(
      startMandate({ db, vault }, { userId: USER, ...urls }),
    ).rejects.toMatchObject({ code: "ALREADY_ACTIVE" });
  });

  it("replaces an unfinished attempt instead of piling them up", async () => {
    const { vault } = setup(() => setupTokenCreated);
    await startMandate({ db, vault }, { userId: USER, ...urls });
    await startMandate({ db, vault }, { userId: USER, ...urls });
    expect(db.select().from(mandates).all()).toHaveLength(1);
  });

  it("surfaces PayPal errors with their debug id", async () => {
    const { vault } = setup(() => ({
      status: 422,
      body: { name: "UNPROCESSABLE_ENTITY", message: "x", debug_id: "dbg9", details: [{ issue: "SOME_ISSUE" }] },
    }));
    const error = await startMandate({ db, vault }, { userId: USER, ...urls }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PayPalRequestError);
    expect((error as PayPalRequestError).failure).toMatchObject({ issue: "SOME_ISSUE", debugId: "dbg9" });
    expect(getMandateView(db, USER).status).toBe("NONE");
  });
});

describe("completeMandate", () => {
  it("exchanges the stored setup token for a payment token", async () => {
    const { vault, requests } = setup((r) =>
      r.url.endsWith("/payment-tokens") ? paymentTokenCreated : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    const view = await completeMandate({ db, vault }, { userId: USER });

    expect(view.status).toBe("ACTIVE");
    expect(getActiveVaultToken(db, USER)).toBe("PAYTOKEN9");
    const request = requests.find((r) => r.url.endsWith("/v3/vault/payment-tokens"));
    expect(request?.body).toEqual({
      payment_source: { token: { id: "SETUP123", type: "SETUP_TOKEN" } },
    });
    expect(request?.headers["PayPal-Request-Id"]).toMatch(/-payment-token$/);
  });

  it("never exposes the vault token in the UI view", async () => {
    const { vault } = setup((r) =>
      r.url.endsWith("/payment-tokens") ? paymentTokenCreated : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    await completeMandate({ db, vault }, { userId: USER });
    expect(JSON.stringify(getMandateView(db, USER))).not.toContain("PAYTOKEN9");
  });

  it("accepts the matching approval_token_id from the return URL", async () => {
    const { vault } = setup((r) =>
      r.url.endsWith("/payment-tokens") ? paymentTokenCreated : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    const view = await completeMandate({ db, vault }, { userId: USER, approvalTokenId: "SETUP123" });
    expect(view.status).toBe("ACTIVE");
  });

  it("rejects an approval_token_id that is not the pending setup token", async () => {
    const { vault, requests } = setup((r) =>
      r.url.endsWith("/payment-tokens") ? paymentTokenCreated : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    await expect(
      completeMandate({ db, vault }, { userId: USER, approvalTokenId: "SOMEONE_ELSE" }),
    ).rejects.toMatchObject({ code: "SETUP_TOKEN_MISMATCH" });
    expect(requests.some((r) => r.url.endsWith("/payment-tokens"))).toBe(false);
    expect(getMandateView(db, USER).status).toBe("PENDING");
  });

  it("fails cleanly when nothing is waiting for approval", async () => {
    const { vault } = setup(() => paymentTokenCreated);
    await expect(
      completeMandate({ db, vault }, { userId: USER }),
    ).rejects.toBeInstanceOf(MandateError);
  });

  it("keeps the mandate pending when PayPal rejects the exchange", async () => {
    const { vault } = setup((r) =>
      r.url.endsWith("/payment-tokens")
        ? { status: 422, body: { name: "UNPROCESSABLE_ENTITY", message: "x", debug_id: "d1", details: [{ issue: "SETUP_TOKEN_NOT_APPROVED" }] } }
        : setupTokenCreated,
    );
    await startMandate({ db, vault }, { userId: USER, ...urls });
    await expect(
      completeMandate({ db, vault }, { userId: USER }),
    ).rejects.toBeInstanceOf(PayPalRequestError);
    expect(getMandateView(db, USER).status).toBe("PENDING");
    expect(getActiveVaultToken(db, USER)).toBeUndefined();
  });
});

describe("cancelPendingMandate", () => {
  it("removes the pending attempt", async () => {
    const { vault } = setup(() => setupTokenCreated);
    await startMandate({ db, vault }, { userId: USER, ...urls });
    cancelPendingMandate(db, USER);
    expect(getMandateView(db, USER).status).toBe("NONE");
  });
});

describe("revokeMandate (US7, D-038)", () => {
  const connected = (status: "ACTIVE" | "PAUSED" = "ACTIVE", id = "m1", at = new Date("2026-10-20T10:00:00Z")) =>
    db.insert(mandates).values({
      id, userId: USER, status, vaultTokenRef: `PAYTOKEN-${id}`, createdAt: at, updatedAt: at,
    }).run();
  const deleted: StubReply = { status: 204, body: "" };

  it("stops charges and deletes the saved PayPal at PayPal", async () => {
    connected();
    const { vault, requests } = setup(() => deleted);
    expect(await revokeMandate({ db, vault }, USER)).toBe("REVOKED");

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url).toMatch(/\/v3\/vault\/payment-tokens\/PAYTOKEN-m1$/);
    expect(getActiveVaultToken(db, USER)).toBeUndefined();
    expect(getMandateView(db, USER)).toEqual({ status: "REVOKED", connectedAt: undefined, deletionPending: false });
    expect(db.select().from(mandates).get()?.vaultTokenRef).toBeNull();
  });

  it("stops charges even when PayPal fails, and deletes it on the next try", async () => {
    connected();
    const failing = setup(() => ({ status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "dbg1" } }));
    expect(await revokeMandate({ db, vault: failing.vault }, USER)).toBe("PAYPAL_FAILED");
    expect(getActiveVaultToken(db, USER)).toBeUndefined();
    expect(getMandateView(db, USER)).toMatchObject({ status: "REVOKED", deletionPending: true });

    const { vault, requests } = setup(() => deleted);
    expect(await revokeMandate({ db, vault }, USER)).toBe("REVOKED");
    expect(requests[0].url).toMatch(/PAYTOKEN-m1$/);
    expect(getMandateView(db, USER).deletionPending).toBe(false);
  });

  it("counts a token PayPal no longer knows as deleted", async () => {
    connected();
    const { vault } = setup(() => ({ status: 404, body: { name: "RESOURCE_NOT_FOUND", debug_id: "dbg2" } }));
    expect(await revokeMandate({ db, vault }, USER)).toBe("REVOKED");
    expect(getMandateView(db, USER).deletionPending).toBe(false);
  });

  it("revokes a paused mandate too", async () => {
    connected("PAUSED");
    const { vault } = setup(() => deleted);
    expect(await revokeMandate({ db, vault }, USER)).toBe("REVOKED");
    expect(getMandateView(db, USER).status).toBe("REVOKED");
  });

  it("does nothing without a connection, and never touches other users", async () => {
    db.insert(mandates).values({
      id: "other", userId: "someone-else", status: "ACTIVE", vaultTokenRef: "OTHER",
      createdAt: new Date(), updatedAt: new Date(),
    }).run();
    const { vault, requests } = setup(() => deleted);
    expect(await revokeMandate({ db, vault }, USER)).toBe("NOT_CONNECTED");
    expect(requests).toEqual([]);
    expect(getActiveVaultToken(db, "someone-else")).toBe("OTHER");
  });

  it("lets the user connect PayPal again afterwards", async () => {
    connected();
    await revokeMandate({ db, vault: setup(() => deleted).vault }, USER);
    const { vault } = setup(() => setupTokenCreated);
    await expect(startMandate({ db, vault }, { userId: USER, ...urls })).resolves.toHaveProperty("approveUrl");
  });
});
