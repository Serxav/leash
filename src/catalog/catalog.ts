import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { catalogSearches, catalogUsage } from "@/db/schema";
import { madridMonth } from "@/rules/engine";
import { Channel3Error, type Channel3Client } from "./channel3";
import { getLocalProduct, isLocalProductId, searchLocal } from "./local";
import { catalogProductSchema, cleanText, type CatalogProduct } from "./product";

/**
 * The catalog the agent searches (D-028). Channel3 when possible, the local
 * catalog otherwise, and it never breaks: no key, an error, or the monthly
 * cap all fall back to the local catalog.
 *
 * No bills: Leash counts its Channel3 searches per Madrid month and stops
 * at CHANNEL3_MONTHLY_SEARCH_CAP, far below the 1,000 free credits. A search
 * is counted before it is sent, so failed calls count too (never under).
 * Re-reading a product is free on Channel3 and is not counted.
 */

export const CHANNEL3_MONTHLY_SEARCH_CAP = 300;
/** Channel3 recommends short caches; prices are re-read before deciding. */
export const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_QUERY_LENGTH = 200;
export const SEARCH_LIMIT = 10;

export type SearchResult = {
  source: "channel3" | "local";
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

  function local(query: string): SearchResult {
    return { source: "local", products: searchLocal(query, SEARCH_LIMIT) };
  }

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

  return {
    async search(query) {
      const queryKey = normalizeQuery(query);
      if (!queryKey) throw new CatalogError("EMPTY_QUERY");
      if (!deps.channel3) return local(queryKey);

      const at = now();
      const cached = readCache(queryKey, at);
      if (cached) return { source: "channel3", products: cached };

      if (!takeSearchCredit(at)) {
        console.warn("[catalog] monthly Channel3 search cap reached; using the local catalog");
        return local(queryKey);
      }
      try {
        const products = (await deps.channel3.search(queryKey, SEARCH_LIMIT)).slice(
          0,
          SEARCH_LIMIT,
        );
        writeCache(queryKey, products, at);
        return { source: "channel3", products };
      } catch (error) {
        const reason = error instanceof Channel3Error ? error.message : "unexpected error";
        console.warn(`[catalog] Channel3 search failed (${reason}); using the local catalog`);
        return local(queryKey);
      }
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
