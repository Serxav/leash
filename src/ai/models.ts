import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";
import { getServerEnv, type ServerEnv } from "@/config/env";

/**
 * The only place where Leash chooses the AI provider and models.
 *
 * - AI_PROVIDER=meta: Meta's muse-spark-1.3 through Meta's Model
 *   API, in Standard mode (Meta does not train on the requests), paid with
 *   Sergi's Meta credits. Model API speaks the OpenAI Chat Completions
 *   protocol at https://api.meta.ai/v1.
 * - AI_PROVIDER=anthropic (Sonnet for the agent, Haiku for rules) stays
 *   available, but is not used.
 *
 * Security:
 * - Server only: importing this file from browser code fails the build, so
 *   the API keys can never reach the client.
 * - Keys come from the validated environment (src/config/env.ts) and are
 *   passed explicitly; nothing is read implicitly from process.env.
 * - Models are always provider instances, never plain model-ID strings,
 *   which the AI SDK would route through a third-party gateway.
 */

/** What each model is used for. */
export type ModelRole =
  /** The shopping agent: searches, compares and proposes purchases. */
  | "agent"
  /** Plain language → rules, and short summaries. */
  | "rules";

export const MODEL_IDS = {
  meta: { agent: "muse-spark-1.3", rules: "muse-spark-1.3" },
  anthropic: { agent: "claude-sonnet-5-5", rules: "claude-haiku-5-5" },
} as const satisfies Record<ServerEnv["AI_PROVIDER"], Record<ModelRole, string>>;

/** Meta's Model API, OpenAI-compatible (dev.meta.ai/docs/quickstart). */
export const META_API_BASE = "https://api.meta.ai/v1";

/**
 * How hard Muse Spark thinks before answering (`reasoning_effort`, Meta's
 * Chat Completions docs). Rule conversion only extracts values, and at the
 * default effort it sometimes took over 60 s, so it thinks less. The agent
 * keeps Meta's default: it compares offers and plans tool calls.
 */
export const META_REASONING_EFFORT: Record<ModelRole, string | undefined> = {
  agent: undefined,
  rules: "low",
};

type AiEnv = Pick<ServerEnv, "AI_PROVIDER" | "META_MODEL_API_KEY" | "ANTHROPIC_API_KEY">;

export type Models = Record<ModelRole, LanguageModel>;

/** Builds the models for an environment. `fetch` is for tests only. */
export function createModels(env: AiEnv, options: { fetch?: typeof fetch } = {}): Models {
  const ids = MODEL_IDS[env.AI_PROVIDER];

  if (env.AI_PROVIDER === "meta") {
    if (!env.META_MODEL_API_KEY) throw new Error("The Meta key is missing.");
    const meta = createOpenAICompatible({
      name: "meta",
      baseURL: META_API_BASE,
      apiKey: env.META_MODEL_API_KEY,
      // Model API returns JSON that matches a schema (response_format
      // json_schema); the rules converter relies on it.
      supportsStructuredOutputs: true,
      fetch: options.fetch,
    });
    const withEffort = (role: ModelRole) => {
      const reasoningEffort = META_REASONING_EFFORT[role];
      if (!reasoningEffort) return meta(ids[role]);
      return wrapLanguageModel({
        model: meta(ids[role]),
        middleware: defaultSettingsMiddleware({ settings: { providerOptions: { meta: { reasoningEffort } } } }),
      });
    };
    return { agent: withEffort("agent"), rules: withEffort("rules") };
  }

  if (!env.ANTHROPIC_API_KEY) throw new Error("The Anthropic key is missing.");
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY, fetch: options.fetch });
  return { agent: anthropic(ids.agent), rules: anthropic(ids.rules) };
}

let cached: Models | undefined;

/** The model for a role, built once per process from the server env. */
export function getModel(role: ModelRole): LanguageModel {
  cached ??= createModels(getServerEnv());
  return cached[role];
}

/**
 * Which AI is in use, safe to show to users (transparency notice): the
 * provider and model names, never keys.
 */
export function describeModels(): { provider: ServerEnv["AI_PROVIDER"] } & Record<ModelRole, string> {
  const provider = getServerEnv().AI_PROVIDER;
  return { provider, ...MODEL_IDS[provider] };
}
