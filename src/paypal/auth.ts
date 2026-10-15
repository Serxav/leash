import { assertSandboxApiBase, getServerEnv } from "@/config/env";

/**
 * Server-only PayPal OAuth 2.0 client (client credentials grant).
 * Docs: https://developer.paypal.com/api/rest/authentication/
 *
 * The client secret and the access token never leave the server:
 * they are not logged, not returned to the browser and not sent to the AI.
 */

export type PayPalCredentials = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
};

export type PayPalAccessToken = {
  accessToken: string;
  /** Space-separated permission URIs granted to the token, split into a list. */
  scopes: string[];
  /** Epoch milliseconds after which the token must not be used. */
  expiresAt: number;
};

/** A failed PayPal call. Holds the debug ID PayPal support asks for, never secrets. */
export class PayPalAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string | undefined,
    public readonly debugId: string | undefined,
  ) {
    super(
      `PayPal OAuth failed with HTTP ${status}` +
        (errorCode ? ` (${errorCode})` : "") +
        (debugId ? ` [debug_id ${debugId}]` : ""),
    );
    this.name = "PayPalAuthError";
  }
}

type FetchFn = typeof fetch;

/** Renew this long before expiry so a request never carries a stale token. */
const EXPIRY_MARGIN_MS = 60_000;

function credentialsFromEnv(): PayPalCredentials {
  const env = getServerEnv();
  return {
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    apiBase: env.paypalApiBase,
  };
}

/** Requests a fresh access token from PayPal (always a network call). */
export async function requestAccessToken(
  credentials: PayPalCredentials = credentialsFromEnv(),
  fetchImpl: FetchFn = fetch,
  now: () => number = Date.now,
): Promise<PayPalAccessToken> {
  // Refuse anything but the sandbox host before a single byte is sent.
  assertSandboxApiBase(credentials.apiBase);

  const basic = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`,
  ).toString("base64");

  const response = await fetchImpl(`${credentials.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: unknown;
    scope?: unknown;
    expires_in?: unknown;
    error?: unknown;
    debug_id?: unknown;
  };

  const debugId =
    response.headers.get("paypal-debug-id") ??
    (typeof body.debug_id === "string" ? body.debug_id : undefined);

  if (
    !response.ok ||
    typeof body.access_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw new PayPalAuthError(
      response.status,
      typeof body.error === "string" ? body.error : undefined,
      debugId,
    );
  }

  return {
    accessToken: body.access_token,
    scopes: typeof body.scope === "string" ? body.scope.split(" ") : [],
    expiresAt: now() + body.expires_in * 1000,
  };
}

/** Caches one token per process and renews it shortly before it expires. */
export function createTokenProvider(
  credentials?: PayPalCredentials,
  fetchImpl: FetchFn = fetch,
  now: () => number = Date.now,
) {
  let cached: PayPalAccessToken | undefined;
  let pending: Promise<PayPalAccessToken> | undefined;

  return async function getAccessToken(): Promise<string> {
    if (cached && now() < cached.expiresAt - EXPIRY_MARGIN_MS) {
      return cached.accessToken;
    }
    // Concurrent callers share one in-flight request.
    pending ??= requestAccessToken(credentials, fetchImpl, now).finally(() => {
      pending = undefined;
    });
    cached = await pending;
    return cached.accessToken;
  };
}

/** Process-wide token provider for server code. */
export const getPayPalAccessToken = createTokenProvider();
