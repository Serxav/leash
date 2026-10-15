import { VaultController } from "@paypal/paypal-server-sdk";
import { describe, expect, it } from "vitest";
import { callPayPal, PayPalRequestError, toPayPalFailure } from "./errors";
import { stubPayPalClient } from "./testing/stub-client";

async function failingCall(status: number, body: unknown, headers = {}) {
  const { client } = stubPayPalClient(() => ({ status, body, headers }));
  const vault = new VaultController(client);
  return vault
    .createSetupToken({ body: { paymentSource: { paypal: {} } } })
    .then(() => {
      throw new Error("expected the call to fail");
    })
    .catch((error: unknown) => error);
}

describe("toPayPalFailure", () => {
  it("reads name, issue and debug_id from a typed 422 error", async () => {
    const error = await failingCall(422, {
      name: "UNPROCESSABLE_ENTITY",
      message: "The requested action could not be performed.",
      debug_id: "abc123",
      details: [{ issue: "INSTRUMENT_DECLINED", description: "Declined" }],
    });
    expect(toPayPalFailure(error)).toEqual({
      status: 422,
      name: "UNPROCESSABLE_ENTITY",
      issue: "INSTRUMENT_DECLINED",
      debugId: "abc123",
    });
  });

  it("handles a status the operation maps to no typed error", async () => {
    const error = await failingCall(
      401,
      { error: "invalid_token" },
      { "paypal-debug-id": "hdr456" },
    );
    expect(toPayPalFailure(error)).toMatchObject({
      status: 401,
      debugId: "hdr456",
    });
  });

  it("ignores errors that are not PayPal API responses", () => {
    expect(toPayPalFailure(new TypeError("network down"))).toBeUndefined();
  });
});

describe("callPayPal", () => {
  it("rethrows API failures as PayPalRequestError without secrets", async () => {
    const { client } = stubPayPalClient(() => ({
      status: 422,
      body: {
        name: "UNPROCESSABLE_ENTITY",
        message: "x",
        debug_id: "dbg1",
        details: [{ issue: "INSTRUMENT_DECLINED" }],
      },
    }));
    const vault = new VaultController(client);
    const error = await callPayPal(() =>
      vault.createSetupToken({ body: { paymentSource: { paypal: {} } } }),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PayPalRequestError);
    const message = (error as PayPalRequestError).message;
    expect(message).toContain("INSTRUMENT_DECLINED");
    expect(message).toContain("dbg1");
    expect(message).not.toContain("test-seeded-token");
    expect(message).not.toContain("test-client-secret");
  });

  it("lets non-API errors through unchanged", async () => {
    const boom = new TypeError("boom");
    await expect(callPayPal(() => Promise.reject(boom))).rejects.toBe(boom);
  });
});
