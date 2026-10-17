import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { catalogSearches, catalogUsage } from "@/db/schema";
import { madridMonth } from "@/rules/engine";
import { Channel3Error, type Channel3Client } from "./channel3";
import { getLocalProduct, isLocalProductId, searchLocal } from "./local";
import { catalogProductSchema, cleanText, type CatalogProduct } from "./product";

/**
 * The catalog the agent searches (D-028, D-029). Every search returns real
 * Channel3 offers (when available) plus matches from Leash's demo catalog
 * of invented shops; each product says where it comes from. Channel3's
 * Spanish catalog has few everyday office supplies and its titles carry
 * brands, so the demo catalog keeps the demo reliable and brand-free. It
 * never breaks: no key, an error or the monthly cap just mean no Channel3
 * results.
 *
 * No bills: Leash counts its Channel3 searches per Madrid month and stops
 * at CHANNEL3_MONTHLY_SEARCH_CAP. Even at the cap every month until judging
 * ends, Leash stays far below the 20,000 hackathon credits (D-031). A search
 * is counted before it is sent, so failed calls count too (never under).
 * Re-reading a product is free on Channel3 and is not counted.
 */

export const CHANNEL3_MONTHLY_SEARCH_CAP = 2_000;
/** Channel3 recommends short caches; prices are re-read before deciding. */
export const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_QUERY_LENGTH = 200;
export const SEARCH_LIMIT = 10;
export const DEMO_SEARCH_LIMIT = 5;

export type SearchResult = {
  /** Channel3 products first, then demo ones; see each product's `source`. */
  products: CatalogProduct[];
};

export type Catalog = {
  search(query: string): Promise<SearchResult>;
  /**
   * The product with fresh prices, or null if it cannot be checked right
   * now. Callers must treat null as "do not buy" (fail closed).
   */
  getProduct(id: string): Promise<CatalogProduct | null>;
};

export class CatalogError extends Error {
  constructor(public readonly code: "EMPTY_QUERY") {
    super("Write what to search for.");
    this.name = "CatalogError";
  }
}

const cachedProducts = z.array(catalogProductSchema);

/** "  A4  Printer PAPER " → "a4 printer paper". */
export function normalizeQuery(query: string): string {
  return cleanText(query, MAX_QUERY_LENGTH).toLowerCase();
}

export function createCatalog(deps: {
  db: Db;
  /** null without a Channel3 key: local catalog only. */
  channel3: Channel3Client | null;
  now?: () => Date;
}): Catalog {
  const now = deps.now ?? (() => new Date());


  function readCache(queryKey: string, at: Date): CatalogProduct[] | null {
    const row = deps.db
      .select()
      .from(catalogSearches)
      .where(eq(catalogSearches.queryKey, queryKey))
      .get();
    if (!row || at.getTime() - row.createdAt.getTime() > SEARCH_CACHE_TTL_MS) return null;
    try {
      const parsed = cachedProducts.safeParse(JSON.parse(row.productsJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  function writeCache(queryKey: string, products: CatalogProduct[], at: Date): void {
    deps.db.transaction((tx) => {
      // Keep the table small: drop expired searches.
      tx.delete(catalogSearches)
        .where(lt(catalogSearches.createdAt, new Date(at.getTime() - SEARCH_CACHE_TTL_MS)))
        .run();
      tx.insert(catalogSearches)
        .values({ queryKey, productsJson: JSON.stringify(products), createdAt: at })
        .onConflictDoUpdate({
          target: catalogSearches.queryKey,
          set: { productsJson: JSON.stringify(products), createdAt: at },
        })
        .run();
    });
  }

  /** Counts one search for this month, or returns false at the cap. */
  function takeSearchCredit(at: Date): boolean {
    const month = madridMonth(at);
    return deps.db.transaction((tx) => {
      const row = tx.select().from(catalogUsage).where(eq(catalogUsage.month, month)).get();
      if ((row?.searches ?? 0) >= CHANNEL3_MONTHLY_SEARCH_CAP) return false;
      tx.insert(catalogUsage)
        .values({ month, searches: 1 })
        .onConflictDoUpdate({
          target: catalogUsage.month,
          set: { searches: sql`${catalogUsage.searches} + 1` },
        })
        .run();
      return true;
    });
  }

  /** Channel3 results, or none without a key, at the cap or on errors. */
  async function searchChannel3(queryKey: string): Promise<CatalogProduct[]> {
    if (!deps.channel3) return [];
    const at = now();
    const cached = readCache(queryKey, at);
    if (cached) return cached;
    if (!takeSearchCredit(at)) {
      console.warn("[catalog] monthly Channel3 search cap reached; demo catalog only");
      return [];
    }
    try {
      const products = (await deps.channel3.search(queryKey, SEARCH_LIMIT)).slice(0, SEARCH_LIMIT);
      writeCache(queryKey, products, at);
      return products;
    } catch (error) {
      const reason = error instanceof Channel3Error ? error.message : "unexpected error";
      console.warn(`[catalog] Channel3 search failed (${reason}); demo catalog only`);
      return [];
    }
  }

  return {
    async search(query) {
      const queryKey = normalizeQuery(query);
      if (!queryKey) throw new CatalogError("EMPTY_QUERY");
      const demo = searchLocal(queryKey, DEMO_SEARCH_LIMIT);
      return { products: [...(await searchChannel3(queryKey)), ...demo] };
    },

    async getProduct(id) {
      if (isLocalProductId(id)) return getLocalProduct(id);
      if (!deps.channel3) return null;
      try {
        return await deps.channel3.getProduct(id);
      } catch (error) {
        const reason = error instanceof Channel3Error ? error.message : "unexpected error";
        console.warn(`[catalog] Channel3 product re-read failed (${reason})`);
        return null;
      }
    },
  };
}

/** Searches spent this Madrid month, for the transparency panel and tests. */
export function searchesThisMonth(db: Db, at: Date): number {
  return (
    db.select().from(catalogUsage).where(eq(catalogUsage.month, madridMonth(at))).get()
      ?.searches ?? 0
  );
}
