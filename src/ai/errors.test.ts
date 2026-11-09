import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { describeAiError } from "./errors";

function apiError(statusCode: number, responseBody = '{"error":"details"}') {
  return new APICallError({
    message: "secret-ish provider message with the prompt inside",
    url: "https://api.meta.ai/v1/chat/completions",
    requestBodyValues: { messages: [{ role: "user", content: "the user's request" }] },
    statusCode,
    responseBody,
  });
}

describe("describeAiError", () => {
  it("names the error type and the provider's HTTP status", () => {
    expect(describeAiError(apiError(401))).toBe("AI_APICallError HTTP 401 at /v1/chat/completions");
  });

  it("looks inside retries for the last answer", () => {
    const error = new RetryError({
      message: "Failed after 2 attempts",
      reason: "maxRetriesExceeded",
      errors: [apiError(503), apiError(429)],
    });
    expect(describeAiError(error)).toBe("AI_APICallError HTTP 429 at /v1/chat/completions after 2 attempts");
  });

  it("never logs the message, the request or the response body", () => {
    const line = describeAiError(apiError(403));
    for (const secret of ["secret-ish", "the user's request", "details", "api.meta.ai"]) {
      expect(line).not.toContain(secret);
    }
  });

  it("adds the provider's short error code, never its message", () => {
    const body = JSON.stringify({ error: { code: "model_not_found", message: "the user's request was about toner" } });
    const line = describeAiError(apiError(404, body));
    expect(line).toBe("AI_APICallError HTTP 404 code model_not_found at /v1/chat/completions");
    expect(line).not.toContain("toner");
  });

  it("drops a code that looks like free text", () => {
    const body = JSON.stringify({ error: { code: "the user's request about toner" } });
    expect(describeAiError(apiError(404, body))).toBe("AI_APICallError HTTP 404 at /v1/chat/completions");
  });

  it("handles timeouts and non-errors", () => {
    expect(describeAiError(new DOMException("timed out", "TimeoutError"))).toBe("TimeoutError");
    expect(describeAiError("boom")).toBe("string");
  });
});
