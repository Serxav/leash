import { generateText, type LanguageModel } from "ai";
import { describe, expect, it } from "vitest";
import { createModels, MODEL_IDS } from "./models";

const FAKE_META_KEY = "test-meta-key";
const FAKE_ANTHROPIC_KEY = "test-anthropic-key";

type Captured = { url: string; headers: Headers; body: string };

/** Calls the model once with a fetch that records the request and stops. */
async function captureRequest(build: (fetch: typeof globalThis.fetch) => LanguageModel) {
  const captured: Captured[] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), headers: new Headers(init?.headers), body: String(init?.body ?? "") });
    throw new Error("network disabled in tests");
  }) as typeof globalThis.fetch;
  await expect(
    generateText({ model: build(fakeFetch), prompt: "Hello", maxRetries: 0 }),
  ).rejects.toThrow();
  expect(captured).toHaveLength(1);
  return captured[0];
}

describe("createModels", () => {
  it("uses Meta's muse-spark-1.3 for every role with AI_PROVIDER=meta (D-043)", () => {
    const models = createModels({ AI_PROVIDER: "meta", META_MODEL_API_KEY: FAKE_META_KEY });
    expect(models.agent).toMatchObject({ modelId: "muse-spark-1.3" });
    expect(models.rules).toMatchObject({ modelId: "muse-spark-1.3" });
  });

  it("uses Sonnet for the agent and Haiku for rules with AI_PROVIDER=anthropic", () => {
    const models = createModels({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY });
    expect(models.agent).toMatchObject({ provider: "anthropic.messages", modelId: "claude-sonnet-5-5" });
    expect(models.rules).toMatchObject({ provider: "anthropic.messages", modelId: "claude-haiku-5-5" });
  });

  it("returns provider instances, never gateway model-ID strings", () => {
    for (const env of [
      { AI_PROVIDER: "meta" as const, META_MODEL_API_KEY: FAKE_META_KEY },
      { AI_PROVIDER: "anthropic" as const, ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY },
    ]) {
      const models = createModels(env);
      expect(typeof models.agent).toBe("object");
      expect(typeof models.rules).toBe("object");
    }
  });

  it("refuses to build models without the selected provider's key", () => {
    expect(() => createModels({ AI_PROVIDER: "meta", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY })).toThrow(
      "The Meta key is missing.",
    );
    expect(() => createModels({ AI_PROVIDER: "anthropic", META_MODEL_API_KEY: FAKE_META_KEY })).toThrow(
      "The Anthropic key is missing.",
    );
  });

  it("talks directly to Meta's Model API with the key from the validated env", async () => {
    const request = await captureRequest(
      (fetch) => createModels({ AI_PROVIDER: "meta", META_MODEL_API_KEY: FAKE_META_KEY }, { fetch }).agent,
    );
    expect(request.url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(request.headers.get("authorization")).toBe(`Bearer ${FAKE_META_KEY}`);
  });

  it("asks Meta to think less for rule conversion, but not for the agent", async () => {
    const env = { AI_PROVIDER: "meta" as const, META_MODEL_API_KEY: FAKE_META_KEY };
    const rules = await captureRequest((fetch) => createModels(env, { fetch }).rules);
    expect(JSON.parse(rules.body)).toMatchObject({ model: "muse-spark-1.3", reasoning_effort: "low" });
    const agent = await captureRequest((fetch) => createModels(env, { fetch }).agent);
    expect(JSON.parse(agent.body)).not.toHaveProperty("reasoning_effort");
  });

  it("talks directly to Anthropic with the key from the validated env", async () => {
    const request = await captureRequest(
      (fetch) =>
        createModels({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY }, { fetch }).agent,
    );
    expect(new URL(request.url).origin).toBe("https://api.anthropic.com");
    expect(request.headers.get("x-api-key")).toBe(FAKE_ANTHROPIC_KEY);
  });

  it("never sends the other provider's key", async () => {
    const request = await captureRequest(
      (fetch) =>
        createModels(
          { AI_PROVIDER: "meta", META_MODEL_API_KEY: FAKE_META_KEY, ANTHROPIC_API_KEY: FAKE_ANTHROPIC_KEY },
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

  it("uses Meta's Standard mode, where Meta does not train on the requests (D-043)", () => {
    for (const id of Object.values(MODEL_IDS.meta)) {
      expect(id).not.toMatch(/contributor/);
    }
  });
});
