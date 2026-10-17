import { describe, expect, it } from "vitest";
import { assertToolkitSandbox, ToolkitError } from "./agent-toolkit";

describe("assertToolkitSandbox", () => {
  it.each(["https://api.sandbox.paypal.com", "https://api-m.sandbox.paypal.com/v2/checkout/orders"])(
    "accepts the PayPal sandbox host %s",
    (url) => {
      expect(() => assertToolkitSandbox(url)).not.toThrow();
    },
  );

  it.each([
    "https://api.paypal.com",
    "https://api-m.paypal.com",
    "http://api.sandbox.paypal.com",
    "https://api.sandbox.paypal.com.evil.example",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertToolkitSandbox(url)).toThrow(ToolkitError);
  });
});
