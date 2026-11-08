import { describe, expect, it, vi } from "vitest";
import { EnvConfigError, PAYPAL_SANDBOX_API_BASE } from "@/config/env";
import {
  PayPalAuthError,
  requestAccessToken,
  type PayPalCredentials,
} from "./auth";

// Fake placeholder values only: never real credentials in tests.
const credentials: PayPalCredentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  apiBase: PAYPAL_SANDBOX_API_BASE,
};

function okResponse(expiresIn = 32_400, token = "test-access-token") {
  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope:
        "https://uri.paypal.com/services/payments/payment https://uri.paypal.com/services/vault/payment-tokens/readwrite",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("requestAccessToken", () => {
  it("calls the sandbox token endpoint with Basic auth and client credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    await requestAccessToken(credentials, fetchMock, () => 0);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("grant_type=client_credentials");
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const expected = Buffer.from("test-client-id:test-client-secret").toString(
      "base64",
    );
    expect(init.headers.Authorization).toBe(`Basic ${expected}`);
  });

  it("returns the token, its scopes and the expiry time", async () => {
    const token = await requestAccessToken(
      credentials,
      vi.fn().mockResolvedValue(okResponse(100)),
      () => 1_000,
    );
    expect(token.accessToken).toBe("test-access-token");
    expect(token.expiresAt).toBe(1_000 + 100_000);
    expect(token.scopes.some((scope) => scope.includes("/vault/"))).toBe(true);
  });

  it("refuses a non-sandbox API base before making any request", async () => {
    const fetchMock = vi.fn();
    await expect(
      requestAccessToken(
        { ...credentials, apiBase: "https://api-m.paypal.com" },
        fetchMock,
      ),
    ).rejects.toThrow(EnvConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a rejected login to PayPalAuthError with the debug id and no secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "Client Authentication failed",
        }),
        { status: 401, headers: { "paypal-debug-id": "abc123debug" } },
      ),
    );
    const error = await requestAccessToken(credentials, fetchMock).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PayPalAuthError);
    const authError = error as PayPalAuthError;
    expect(authError.status).toBe(401);
    expect(authError.errorCode).toBe("invalid_client");
    expect(authError.debugId).toBe("abc123debug");
    expect(authError.message).not.toContain("test-client-secret");
    expect(authError.message).not.toContain("test-client-id");
  });

  it("treats a 200 without a token as a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(requestAccessToken(credentials, fetchMock)).rejects.toThrow(
      PayPalAuthError,
    );
  });

  it("handles a non-JSON error body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("Service Unavailable", { status: 503 }));
    await expect(
      requestAccessToken(credentials, fetchMock),
    ).rejects.toMatchObject({ status: 503 });
  });
});
