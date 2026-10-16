import "server-only";
import { Client, Environment } from "@paypal/paypal-server-sdk";
import { getServerEnv } from "@/config/env";

/**
 * PayPal Server SDK client (APIMatic-generated), sandbox only.
 *
 * Built following the APIMatic Context Plugin skills for this SDK:
 * - one long-lived client per process (it caches the OAuth token);
 * - credentials as the `clientCredentialsAuthCredentials` object;
 * - an explicit timeout (the SDK default is none);
 * - SDK logging left at its default NullLogger, so tokens and request
 *   bodies are never logged;
 * - default retry policy kept: it never retries POST, so a charge is
 *   never sent twice by the SDK.
 */
export const PAYPAL_TIMEOUT_MS = 30_000;

export function createPayPalClient(credentials: {
  clientId: string;
  clientSecret: string;
}): Client {
  return new Client({
    // Never Production: Leash is sandbox-only (see src/config/env.ts).
    environment: Environment.Sandbox,
    timeout: PAYPAL_TIMEOUT_MS,
    clientCredentialsAuthCredentials: {
      oAuthClientId: credentials.clientId,
      oAuthClientSecret: credentials.clientSecret,
      oAuthClockSkew: 60,
    },
  });
}

let instance: Client | undefined;

/** Process-wide PayPal client. Validates the sandbox-only env first. */
export function getPayPalClient(): Client {
  if (!instance) {
    const env = getServerEnv();
    instance = createPayPalClient({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
    });
  }
  return instance;
}
