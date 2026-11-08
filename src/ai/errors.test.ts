import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { describeAiError } from "./errors";

function apiError(statusCode: number) {
  return new APICallError({
    message: "secret-ish provider message with the prompt inside",
    url: "https://api.meta.ai/v1/chat/completions",
    requestBodyValues: { messages: [{ role: "user", content: "the user's request" }] },
    statusCode,
    responseBody: '{"error":"details"}',
  });
}

describe("describeAiError", () => {
  it("names the error type and the provider's HTTP status", () => {
    expect(describeAiError(apiError(401))).toBe("AI_APICallError HTTP 401");
  });

  it("looks inside retries for the last answer", () => {
    const error = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(503), apiError(429)],
    });
    expect(describeAiError(error)).toBe("AI_APICallError HTTP 429 after 2 attempts");
  });

  it("never logs the message, the request or the response body", () => {
    const line = describeAiError(apiError(403));
    for (const secret of ["secret-ish", "the user's request", "details", "api.meta.ai"]) {
      expect(line).not.toContain(secret);
    }
  });

  it("handles timeouts and non-errors", () => {
    expect(describeAiError(new DOMException("timed out", "TimeoutError"))).toBe("TimeoutError");
    expect(describeAiError("boom")).toBe("string");
  });
});
