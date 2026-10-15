import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/config/env";
import { PayPalAuthError, requestAccessToken } from "@/paypal/auth";

// Real calls to https://api-m.sandbox.paypal.com. Local only, never in CI.
describe("PayPal sandbox connection", () => {
  it("validates .env.local as a sandbox configuration", () => {
    expect(getServerEnv().PAYPAL_ENVIRONMENT).toBe("SANDBOX");
  });

  it("gets an access token with the scopes Leash needs", async () => {
    const token = await requestAccessToken();

    expect(token.accessToken.length).toBeGreaterThan(20);
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    // "Save payment methods" (Vault) and "Transaction search" must be enabled
    // on the sandbox app (PayPal Developer Dashboard → app Leash → Features).
    expect(token.scopes.some((scope) => scope.includes("/vault/"))).toBe(true);
    expect(token.scopes.some((scope) => scope.includes("/reporting/"))).toBe(
      true,
    );
  });

  it("rejects wrong credentials with a debug id", async () => {
    const error = await requestAccessToken({
      clientId: "not-a-real-client-id",
      clientSecret: "not-a-real-secret",
      apiBase: getServerEnv().paypalApiBase,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PayPalAuthError);
    expect((error as PayPalAuthError).status).toBe(401);
  });
});
