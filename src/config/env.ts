import { z } from "zod";

/**
 * The only PayPal API host Leash is allowed to talk to.
 * Leash is sandbox-only: real money must never move.
 */
export const PAYPAL_SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";

/** Thrown when the server configuration is unsafe or incomplete. */
export class EnvConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid server configuration:\n- ${problems.join("\n- ")}`);
    this.name = "EnvConfigError";
  }
}

// `KEY=` lines in .env files produce empty strings: treat them as missing.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredSecret = z.preprocess(blankToUndefined, z.string());
const optionalSecret = z.preprocess(blankToUndefined, z.string().optional());

const envSchema = z
  .object({
    PAYPAL_ENVIRONMENT: z.literal("SANDBOX", {
      error: "PAYPAL_ENVIRONMENT must be SANDBOX (Leash never uses live PayPal)",
    }),
    PAYPAL_CLIENT_ID: requiredSecret,
    PAYPAL_CLIENT_SECRET: requiredSecret,
    AI_PROVIDER: z.enum(["google", "anthropic"], {
      error: "AI_PROVIDER must be google or anthropic",
    }),
    GOOGLE_GENERATIVE_AI_API_KEY: optionalSecret,
    ANTHROPIC_API_KEY: optionalSecret,
    // Optional: without it, the app uses the local fallback catalog.
    CHANNEL3_API_KEY: optionalSecret,
  })
  .superRefine((env, ctx) => {
    // Only the keys of the selected AI provider are required.
    if (env.AI_PROVIDER === "google" && !env.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_GENERATIVE_AI_API_KEY"],
        message: "is required when AI_PROVIDER=google",
      });
    }
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "is required when AI_PROVIDER=anthropic",
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema> & {
  paypalApiBase: typeof PAYPAL_SANDBOX_API_BASE;
};

/**
 * Validates the server environment. Error messages name the variables
 * but never include their values, so secrets cannot leak into logs.
 */
export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join(".") || "environment";
      // Missing values come back as "expected string": say it plainly.
      const message =
        issue.code === "invalid_type" ? "is missing" : issue.message;
      return message.startsWith(name) ? message : `${name} ${message}`;
    });
    throw new EnvConfigError(problems);
  }
  return { ...result.data, paypalApiBase: PAYPAL_SANDBOX_API_BASE };
}

/** Refuses any PayPal host other than the sandbox API. */
export function assertSandboxApiBase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new EnvConfigError([`PayPal API URL is not a valid URL`]);
  }
  if (parsed.origin !== PAYPAL_SANDBOX_API_BASE) {
    throw new EnvConfigError([
      `PayPal API URL must be ${PAYPAL_SANDBOX_API_BASE} (got ${parsed.origin})`,
    ]);
  }
}

let cached: ServerEnv | undefined;

/** Server-only accessor, validated once per process. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  assertSandboxApiBase(cached.paypalApiBase);
  return cached;
}
