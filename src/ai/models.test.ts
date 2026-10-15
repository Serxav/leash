import { generateText, type LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";

// "server-only" throws outside Next.js server code; tests are server code.
vi.mock("server-only", () => ({}));

const { createModels, MODEL_IDS } = await import("./models");

const FAKE_GOOGLE_KEY = "test-google-key";
const FAKE_ANTHROPIC_KEY = "test-anthropic-key";

type Captured = { url: string; headers: Headers };

/** Calls the model once with a fetch that records the request and stops. */
async function captureRequest(build: (fetch: typeof globalThis.fetch) => LanguageModel) {
  const captured: Captured[] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), headers: new Headers(init?.headers) });
    throw new Error("network disabled in tests");
  }) as typeof globalThis.fetch;
  await expect(
    generateText({ model: build(fakeFetch), prompt: "Hello", maxRetries: 0 }),
  ).rejects.toThrow();
  expect(captured).toHaveLength(1);
  return captured[0];
}

describe("createModels", () => {
  it("uses gemini-3.1-flash-lite for every role with AI_PROVIDER=google (D-023)", () => {
    const models = createModels({ AI_PROVIDER: "google", GOOGLE_GENERATIVE_AI_API_KEY: FAKE_GOOGLE_KEY });
    expect(models.agent).toMatchObject({ provider: "google.generative-ai", modelId: "gemini-3.1-flash-lite" });
    expect(models.rules).toMatchObject({ modelId: "gemini-3.1-flash-lite" });
  });

  it("uses Sonnet for the agent and Haiku for rules with AI_PROVIDER=anthropic", () => {
    const models = createModels({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY });
    expect(models.agent).toMatchObject({ provider: "anthropic.messages", modelId: "claude-sonnet-5-5" });
    expect(models.rules).toMatchObject({ provider: "anthropic.messages", modelId: "claude-haiku-5-5" });
  });

  it("returns provider instances, never gateway model-ID strings", () => {
    for (const env of [
      { AI_PROVIDER: "google" as const, GOOGLE_GENERATIVE_AI_API_KEY: FAKE_GOOGLE_KEY },
      { AI_PROVIDER: "anthropic" as const, ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY },
    ]) {
      const models = createModels(env);
      expect(typeof models.agent).toBe("object");
      expect(typeof models.rules).toBe("object");
    }
  });

  it("refuses to build models without the selected provider's key", () => {
    expect(() => createModels({ AI_PROVIDER: "google", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY })).toThrow(
      "The Google AI key is missing.",
    );
    expect(() => createModels({ AI_PROVIDER: "anthropic", GOOGLE_GENERATIVE_AI_API_KEY: FAKE_GOOGLE_KEY })).toThrow(
      "The Anthropic key is missing.",
    );
  });

  it("talks directly to Google with the key from the validated env", async () => {
    const request = await captureRequest(
      (fetch) =>
        createModels(
          { AI_PROVIDER: "google", GOOGLE_GENERATIVE_AI_API_KEY: FAKE_GOOGLE_KEY },
          { fetch },
        ).rules,
    );
    expect(new URL(request.url).origin).toBe("https://generativelanguage.googleapis.com");
    expect(request.url).toContain("gemini-3.1-flash-lite");
    expect(request.headers.get("x-goog-api-key")).toBe(FAKE_GOOGLE_KEY);
  });

  it("talks directly to Anthropic with the key from the validated env", async () => {
    const request = await captureRequest(
      (fetch) =>
        createModels(
          { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY },
          { fetch },
        ).agent,
    );
    expect(new URL(request.url).origin).toBe("https://api.anthropic.com");
    expect(request.headers.get("x-api-key")).toBe(FAKE_ANTHROPIC_KEY);
  });

  it("never sends the other provider's key", async () => {
    const request = await captureRequest(
      (fetch) =>
        createModels(
          {
            AI_PROVIDER: "google",
            GOOGLE_GENERATIVE_AI_API_KEY: FAKE_GOOGLE_KEY,
            ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY,
          },
          { fetch },
        ).agent,
    );
    expect([...request.headers.values()].join(" ")).not.toContain(FAKE_ANTHROPIC_KEY);
  });
});

describe("MODEL_IDS", () => {
  it("pins exact model versions (no -latest aliases)", () => {
    for (const id of Object.values(MODEL_IDS).flatMap((roles) => Object.values(roles))) {
      expect(id).not.toMatch(/latest/);
    }
  });
});
