import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { APICallError, wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { getServerEnv, type ServerEnv } from "@/config/env";

/**
 * The only place where Leash chooses the AI provider and models (CLAUDE.md).
 *
 * - Until Nov 1: AI_PROVIDER=google, gemini-3.5-flash-lite for everything,
 *   on the free tier with invented data only (D-023, D-027). When Google
 *   says that model is busy, the same call goes to gemini-3.1-flash-lite.
 * - From Nov 2 and always in the public demo, video and submission:
 *   AI_PROVIDER=anthropic, Sonnet for the agent and Haiku for rules.
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
  google: { agent: "gemini-3.5-flash-lite", rules: "gemini-3.5-flash-lite" },
  anthropic: { agent: "claude-sonnet-5-5", rules: "claude-haiku-5-5" },
} as const satisfies Record<ServerEnv["AI_PROVIDER"], Record<ModelRole, string>>;

/**
 * Free-tier Gemini models are often "experiencing high demand" (D-027). If
 * Google answers busy (503) or over the free rate limit (429), the call is
 * sent once to this other free model. Both are free tier: no bills.
 */
export const GOOGLE_FALLBACK_MODEL_ID = "gemini-3.1-flash-lite";

/** Google's "model busy" (503) and "free rate limit reached" (429) answers. */
export function isBusyError(error: unknown): boolean {
  return APICallError.isInstance(error) && (error.statusCode === 503 || error.statusCode === 429);
}

type GoogleModel = ReturnType<ReturnType<typeof createGoogle>>;

/** `primary`, but a busy answer sends the same call to `fallback` instead. */
function withFallback(primary: GoogleModel, fallback: GoogleModel): LanguageModel {
  const middleware: LanguageModelMiddleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (error) {
        if (!isBusyError(error)) throw error;
        return fallback.doGenerate(params);
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (error) {
        if (!isBusyError(error)) throw error;
        return fallback.doStream(params);
      }
    },
  };
  return wrapLanguageModel({ model: primary, middleware });
}

type AiEnv = Pick<ServerEnv, "AI_PROVIDER" | "GOOGLE_GENERATIVE_AI_API_KEY" | "ANTHROPIC_API_KEY">;

export type Models = Record<ModelRole, LanguageModel>;

/** Builds the models for an environment. `fetch` is for tests only. */
export function createModels(env: AiEnv, options: { fetch?: typeof fetch } = {}): Models {
  const ids = MODEL_IDS[env.AI_PROVIDER];

  if (env.AI_PROVIDER === "google") {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("The Google AI key is missing.");
    const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY, fetch: options.fetch });
    const fallback = google(GOOGLE_FALLBACK_MODEL_ID);
    return {
      agent: withFallback(google(ids.agent), fallback),
      rules: withFallback(google(ids.rules), fallback),
    };
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
