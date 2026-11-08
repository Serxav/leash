import { describe, expect, it } from "vitest";
import {
  assertSandboxApiBase,
  EnvConfigError,
  parseServerEnv,
  PAYPAL_SANDBOX_API_BASE,
} from "./env";

// Fake placeholder values only: never real credentials in tests.
const validEnv = {
  PAYPAL_ENVIRONMENT: "SANDBOX",
  PAYPAL_CLIENT_ID: "test-client-id",
  PAYPAL_CLIENT_SECRET: "test-client-secret",
  AI_PROVIDER: "meta",
  META_MODEL_API_KEY: "test-meta-key",
  ANTHROPIC_API_KEY: "",
  CHANNEL3_API_KEY: "test-channel3-key",
};

function problemsOf(source: Record<string, string | undefined>): string[] {
  try {
    parseServerEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvConfigError);
    return (error as EnvConfigError).problems;
  }
  throw new Error("expected parseServerEnv to throw");
}

describe("parseServerEnv", () => {
  it("accepts a valid sandbox + Meta configuration", () => {
    const env = parseServerEnv(validEnv);
    expect(env.PAYPAL_ENVIRONMENT).toBe("SANDBOX");
    expect(env.AI_PROVIDER).toBe("meta");
    expect(env.paypalApiBase).toBe(PAYPAL_SANDBOX_API_BASE);
  });

  it("does not require ANTHROPIC_API_KEY while AI_PROVIDER=meta", () => {
    expect(() =>
      parseServerEnv({ ...validEnv, ANTHROPIC_API_KEY: undefined }),
    ).not.toThrow();
  });

  it("treats empty values as missing", () => {
    expect(
      problemsOf({ ...validEnv, PAYPAL_CLIENT_SECRET: "  " }),
    ).toEqual(["PAYPAL_CLIENT_SECRET is missing"]);
  });

  it("refuses live PayPal", () => {
    expect(problemsOf({ ...validEnv, PAYPAL_ENVIRONMENT: "LIVE" })).toEqual(
      ["PAYPAL_ENVIRONMENT must be SANDBOX (Leash never uses live PayPal)"],
    );
  });

  it("refuses a missing PAYPAL_ENVIRONMENT", () => {
    expect(
      problemsOf({ ...validEnv, PAYPAL_ENVIRONMENT: undefined }),
    ).toHaveLength(1);
  });

  it("requires the Meta key when AI_PROVIDER=meta (D-043)", () => {
    expect(problemsOf({ ...validEnv, META_MODEL_API_KEY: "" })).toEqual([
      "META_MODEL_API_KEY is required when AI_PROVIDER=meta",
    ]);
  });

  it("requires the Anthropic key when AI_PROVIDER=anthropic", () => {
    expect(
      problemsOf({ ...validEnv, AI_PROVIDER: "anthropic" }),
    ).toEqual(["ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic"]);
  });

  it("accepts AI_PROVIDER=anthropic with its key and no Meta key", () => {
    const env = parseServerEnv({
      ...validEnv,
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      META_MODEL_API_KEY: "",
    });
    expect(env.AI_PROVIDER).toBe("anthropic");
  });

  it("rejects google, which Leash no longer uses (D-043)", () => {
    expect(problemsOf({ ...validEnv, AI_PROVIDER: "google" })).toEqual([
      "AI_PROVIDER must be meta or anthropic",
    ]);
  });

  it("rejects an unknown AI provider", () => {
    expect(problemsOf({ ...validEnv, AI_PROVIDER: "openai" })).toEqual([
      "AI_PROVIDER must be meta or anthropic",
    ]);
  });

  it("allows a missing Channel3 key (local catalog fallback)", () => {
    expect(() =>
      parseServerEnv({ ...validEnv, CHANNEL3_API_KEY: "" }),
    ).not.toThrow();
  });

  it("lists every problem at once", () => {
    expect(problemsOf({})).toHaveLength(4);
  });

  it("never includes secret values in error messages", () => {
    const leaky = {
      ...validEnv,
      PAYPAL_ENVIRONMENT: "LIVE",
      AI_PROVIDER: "anthropic",
    };
    const message = problemsOf(leaky).join("\n");
    for (const secret of [
      "test-client-id",
      "test-client-secret",
      "test-meta-key",
      "test-channel3-key",
    ]) {
      expect(message).not.toContain(secret);
    }
  });
});

describe("assertSandboxApiBase", () => {
  it("accepts the sandbox API host", () => {
    expect(() => assertSandboxApiBase(PAYPAL_SANDBOX_API_BASE)).not.toThrow();
    expect(() =>
      assertSandboxApiBase(`${PAYPAL_SANDBOX_API_BASE}/v2/checkout/orders`),
    ).not.toThrow();
  });

  it("refuses the live API host", () => {
    expect(() => assertSandboxApiBase("https://api-m.paypal.com")).toThrow(
      EnvConfigError,
    );
  });

  it("refuses look-alike hosts and plain http", () => {
    for (const url of [
      "http://api-m.sandbox.paypal.com",
      "https://api-m.sandbox.paypal.com.evil.example",
      "https://api.sandbox.paypal.com",
      "not a url",
    ]) {
      expect(() => assertSandboxApiBase(url)).toThrow(EnvConfigError);
    }
  });
});

describe("PAYPAL_MERCHANT_ID", () => {
  it("is optional", () => {
    expect(parseServerEnv(validEnv).PAYPAL_MERCHANT_ID).toBeUndefined();
  });

  it("accepts a PayPal Merchant ID", () => {
    expect(
      parseServerEnv({ ...validEnv, PAYPAL_MERCHANT_ID: "ABCDEFGH12345" })
        .PAYPAL_MERCHANT_ID,
    ).toBe("ABCDEFGH12345");
  });

  it("rejects values that are not a Merchant ID", () => {
    expect(
      problemsOf({ ...validEnv, PAYPAL_MERCHANT_ID: "sb-xyz@business.example.com" }),
    ).toEqual([
      "PAYPAL_MERCHANT_ID must be the PayPal Merchant ID (letters and digits)",
    ]);
  });
});
