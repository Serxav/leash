import { Client, Environment } from "@paypal/paypal-server-sdk";

/**
 * Test-only PayPal client that never touches the network.
 *
 * Follows the APIMatic Context Plugin "typescript-testing" skill: a stub
 * axios adapter through `unstable_httpClientOptions`, and a seeded,
 * unexpired OAuth token so no token request is made.
 */
export type StubReply = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export type StubRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

export function stubPayPalClient(
  reply: (request: StubRequest) => StubReply,
): { client: Client; requests: StubRequest[] } {
  const requests: StubRequest[] = [];
  const client = new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: "test-client-id",
      oAuthClientSecret: "test-client-secret",
      oAuthToken: {
        accessToken: "test-seeded-token",
        tokenType: "Bearer",
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      },
    },
    httpClientOptions: { retryConfig: { maxNumberOfRetries: 0 } },
    unstable_httpClientOptions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapter: async (config: any) => {
        const request: StubRequest = {
          method: String(config.method).toUpperCase(),
          url: String(config.url),
          headers: { ...config.headers },
          body:
            typeof config.data === "string" && config.data
              ? JSON.parse(config.data)
              : undefined,
        };
        requests.push(request);
        const { status, body, headers } = reply(request);
        return {
          // The SDK expects the raw serialized body (transformResponse: []).
          data: typeof body === "string" ? body : JSON.stringify(body),
          status,
          statusText: "",
          headers: { "content-type": "application/json", ...headers },
          config,
        };
      },
    },
  });
  return { client, requests };
}
