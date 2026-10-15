import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getServerEnv, type ServerEnv } from "@/config/env";

/**
 * The only place where Leash chooses the AI provider and models (CLAUDE.md).
 *
 * - Until Nov 1: AI_PROVIDER=google, gemini-3.1-flash-lite for everything
 *   (D-023: the cheapest working model, on the free tier), with invented data
 *   only.
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
  google: { agent: "gemini-3.1-flash-lite", rules: "gemini-3.1-flash-lite" },
  anthropic: { agent: "claude-sonnet-5-5", rules: "claude-haiku-5-5" },
} as const satisfies Record<ServerEnv["AI_PROVIDER"], Record<ModelRole, string>>;

type AiEnv = Pick<ServerEnv, "AI_PROVIDER" | "GOOGLE_GENERATIVE_AI_API_KEY" | "ANTHROPIC_API_KEY">;

export type Models = Record<ModelRole, LanguageModel>;

/** Builds the models for an environment. `fetch` is for tests only. */
export function createModels(env: AiEnv, options: { fetch?: typeof fetch } = {}): Models {
  const ids = MODEL_IDS[env.AI_PROVIDER];

  if (env.AI_PROVIDER === "google") {
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("The Google AI key is missing.");
    const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY, fetch: options.fetch });
    return { agent: google(ids.agent), rules: google(ids.rules) };
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
