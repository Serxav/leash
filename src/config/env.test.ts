import { describe, expect, it } from "vitest";
import {
  assertSandboxApiBase,
  EnvConfigError,
  parseServerEnv,
  PAYPAL_SANDBOX_API_BASE,
} from "./env";

// Fake placeholder values only: never real credentials in tests.
const validGoogleEnv = {
  PAYPAL_ENVIRONMENT: "SANDBOX",
  PAYPAL_CLIENT_ID: "test-client-id",
  PAYPAL_CLIENT_SECRET: "test-client-secret",
  AI_PROVIDER: "google",
  GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
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
  it("accepts a valid sandbox + Gemini configuration", () => {
    const env = parseServerEnv(validGoogleEnv);
    expect(env.PAYPAL_ENVIRONMENT).toBe("SANDBOX");
    expect(env.AI_PROVIDER).toBe("google");
    expect(env.paypalApiBase).toBe(PAYPAL_SANDBOX_API_BASE);
  });

  it("does not require ANTHROPIC_API_KEY while AI_PROVIDER=google", () => {
    expect(() =>
      parseServerEnv({ ...validGoogleEnv, ANTHROPIC_API_KEY: undefined }),
    ).not.toThrow();
  });

  it("treats empty values as missing", () => {
    expect(
      problemsOf({ ...validGoogleEnv, PAYPAL_CLIENT_SECRET: "  " }),
    ).toEqual(["PAYPAL_CLIENT_SECRET is missing"]);
  });

  it("refuses live PayPal", () => {
    expect(problemsOf({ ...validGoogleEnv, PAYPAL_ENVIRONMENT: "LIVE" })).toEqual(
      ["PAYPAL_ENVIRONMENT must be SANDBOX (Leash never uses live PayPal)"],
    );
  });

  it("refuses a missing PAYPAL_ENVIRONMENT", () => {
    expect(
      problemsOf({ ...validGoogleEnv, PAYPAL_ENVIRONMENT: undefined }),
    ).toHaveLength(1);
  });

  it("requires the Gemini key when AI_PROVIDER=google", () => {
    expect(
      problemsOf({ ...validGoogleEnv, GOOGLE_GENERATIVE_AI_API_KEY: "" }),
    ).toEqual([
      "GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=google",
    ]);
  });

  it("requires the Anthropic key when AI_PROVIDER=anthropic", () => {
    expect(
      problemsOf({ ...validGoogleEnv, AI_PROVIDER: "anthropic" }),
    ).toEqual(["ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic"]);
  });

  it("accepts AI_PROVIDER=anthropic with its key and no Gemini key", () => {
    const env = parseServerEnv({
      ...validGoogleEnv,
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "",
    });
    expect(env.AI_PROVIDER).toBe("anthropic");
  });

  it("rejects an unknown AI provider", () => {
    expect(problemsOf({ ...validGoogleEnv, AI_PROVIDER: "openai" })).toEqual([
      "AI_PROVIDER must be google or anthropic",
    ]);
  });

  it("allows a missing Channel3 key (local catalog fallback)", () => {
    expect(() =>
      parseServerEnv({ ...validGoogleEnv, CHANNEL3_API_KEY: "" }),
    ).not.toThrow();
  });

  it("lists every problem at once", () => {
    expect(problemsOf({})).toHaveLength(4);
  });

  it("never includes secret values in error messages", () => {
    const leaky = {
      ...validGoogleEnv,
      PAYPAL_ENVIRONMENT: "LIVE",
      AI_PROVIDER: "anthropic",
    };
    const message = problemsOf(leaky).join("\n");
    for (const secret of [
      "test-client-id",
      "test-client-secret",
      "test-google-key",
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
    expect(parseServerEnv(validGoogleEnv).PAYPAL_MERCHANT_ID).toBeUndefined();
  });

  it("accepts a PayPal Merchant ID", () => {
    expect(
      parseServerEnv({ ...validGoogleEnv, PAYPAL_MERCHANT_ID: "ABCDEFGH12345" })
        .PAYPAL_MERCHANT_ID,
    ).toBe("ABCDEFGH12345");
  });

  it("rejects values that are not a Merchant ID", () => {
    expect(
      problemsOf({ ...validGoogleEnv, PAYPAL_MERCHANT_ID: "sb-xyz@business.example.com" }),
    ).toEqual([
      "PAYPAL_MERCHANT_ID must be the PayPal Merchant ID (letters and digits)",
    ]);
  });
});
