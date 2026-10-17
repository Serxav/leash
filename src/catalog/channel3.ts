import "server-only";
import { z } from "zod";
import { PRODUCT_ID_PATTERN, toCatalogProduct, type CatalogProduct } from "./product";

/**
 * Channel3 product catalog, called through its documented REST API (D-028):
 * - POST /v1/search: 1 credit per call (free hackathon credits, D-031);
 * - GET /v1/products/{id}: free, used to re-read price and merchant.
 * Docs: https://docs.trychannel3.com/api-reference/v1/search and
 * https://docs.trychannel3.com/api-reference/v1/product-detail
 *
 * Always Spain + EUR: Leash never converts currencies (D-015). Every
 * response is validated; anything unexpected is dropped, never guessed.
 * The API key travels only in the x-api-key header and is never logged.
 */

export const CHANNEL3_API_URL = "https://api.trychannel3.com";
/**
 * Spain + EUR. No language: Channel3 infers it from the country, and on
 * Oct 16 an explicit "en" gave clearly worse results for Spain (D-028).
 */
export const CHANNEL3_LOCALE = { country: "ES", currency: "EUR" } as const;
const TIMEOUT_MS = 10_000;

export type Channel3Client = {
  search(query: string, limit: number): Promise<CatalogProduct[]>;
  /** The product with fresh offers, or null if Channel3 does not know it. */
  getProduct(id: string): Promise<CatalogProduct | null>;
};

export class Channel3Error extends Error {
  constructor(
    public readonly code: "UNAVAILABLE" | "RATE_LIMITED" | "BAD_RESPONSE",
    /** HTTP status, when there was one. Safe to log. */
    public readonly status?: number,
  ) {
    super(`Channel3 ${code}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "Channel3Error";
  }
}

/** Only the fields Leash reads; everything else in the response is dropped. */
const rawProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  category: z
    .object({
      slug: z.string(),
      path: z.array(z.object({ slug: z.string() })).nullish(),
    })
    .nullish(),
  offers: z
    .array(
      z.object({
        domain: z.string(),
        price: z.object({ price: z.number(), currency: z.string() }),
        availability: z.string().nullish(),
        condition: z.string().nullish(),
      }),
    )
    .nullish(),
});

const searchResponseSchema = z.object({ products: z.array(z.unknown()) });

/** Each product is checked on its own: one odd product never breaks a search. */
function toProducts(items: unknown[]): CatalogProduct[] {
  return items.flatMap((item) => {
    const raw = rawProductSchema.safeParse(item);
    const product = raw.success ? toCatalogProduct(raw.data, "channel3") : null;
    return product ? [product] : [];
  });
}

export function createChannel3Client(options: {
  apiKey: string;
  /** For tests only. */
  fetch?: typeof globalThis.fetch;
}): Channel3Client {
  const doFetch = options.fetch ?? globalThis.fetch;

  async function call(path: string, init: RequestInit): Promise<unknown | null> {
    let response: Response;
    try {
      response = await doFetch(`${CHANNEL3_API_URL}${path}`, {
        ...init,
        headers: {
          "x-api-key": options.apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "error",
      });
    } catch {
      // Network errors and timeouts: no details, they may carry the request.
      throw new Channel3Error("UNAVAILABLE");
    }
    if (response.status === 404) return null;
    if (response.status === 429) throw new Channel3Error("RATE_LIMITED", 429);
    if (!response.ok) throw new Channel3Error("UNAVAILABLE", response.status);
    try {
      return await response.json();
    } catch {
      throw new Channel3Error("BAD_RESPONSE", response.status);
    }
  }

  return {
    async search(query, limit) {
      const body = await call("/v1/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          config: CHANNEL3_LOCALE,
          filters: { availability: ["InStock"], conditions: ["new"] },
        }),
      });
      const parsed = searchResponseSchema.safeParse(body);
      if (!parsed.success) throw new Channel3Error("BAD_RESPONSE");
      return toProducts(parsed.data.products);
    },

    async getProduct(id) {
      // Never put an unchecked ID into the URL.
      if (!PRODUCT_ID_PATTERN.test(id)) return null;
      const params = new URLSearchParams(CHANNEL3_LOCALE);
      const body = await call(`/v1/products/${encodeURIComponent(id)}?${params}`, {
        method: "GET",
      });
      if (body === null) return null;
      const raw = rawProductSchema.safeParse(body);
      if (!raw.success) throw new Channel3Error("BAD_RESPONSE");
      // A product with no valid euro offer cannot be bought: same as unknown.
      const product = toCatalogProduct(raw.data, "channel3");
      return product && product.id === id ? product : null;
    },
  };
}
