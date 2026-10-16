import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "@/db/client";
import { catalogSearches } from "@/db/schema";
import {
  CatalogError,
  CHANNEL3_MONTHLY_SEARCH_CAP,
  createCatalog,
  normalizeQuery,
  SEARCH_CACHE_TTL_MS,
  searchesThisMonth,
} from "./catalog";
import { Channel3Error, type Channel3Client } from "./channel3";
import { LOCAL_PRODUCTS, TRAP_PRODUCT_ID } from "./local";
import type { CatalogProduct } from "./product";

const NOW = new Date("2026-10-20T10:00:00Z");

const remote: CatalogProduct = {
  id: "2yh8WH5",
  source: "channel3",
  title: "A4 printer paper",
  description: null,
  category: "printer-paper",
  parentCategories: ["office-supplies"],
  offers: [{ merchantDomain: "shop.example", unitPrice: "5.99", currency: "EUR" }],
};

function fakeChannel3(overrides: Partial<Channel3Client> = {}) {
  const calls = { search: 0, getProduct: 0 };
  const client: Channel3Client = {
    search: async (...args) => {
      calls.search++;
      return overrides.search ? overrides.search(...args) : [remote];
    },
    getProduct: async (...args) => {
      calls.getProduct++;
      return overrides.getProduct ? overrides.getProduct(...args) : remote;
    },
  };
  return { client, calls };
}

let db: Db;
let now: Date;
beforeEach(() => {
  db = createDb(":memory:");
  now = NOW;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const catalogWith = (channel3: Channel3Client | null) => createCatalog({ db, channel3, now: () => now });

describe("catalog search", () => {
  it("uses only the demo catalog without a Channel3 key", async () => {
    const result = await catalogWith(null).search("printer paper");
    expect(result.products[0].id).toBe("local-printer-paper");
    expect(result.products.every((product) => product.source === "local")).toBe(true);
    expect(searchesThisMonth(db, NOW)).toBe(0);
  });

  it("returns Channel3 results first, then demo matches, and counts one credit (D-029)", async () => {
    const { client, calls } = fakeChannel3();
    const { products } = await catalogWith(client).search("A4  Printer PAPER");
    expect(products[0]).toEqual(remote);
    expect(products.length).toBeGreaterThan(1);
    expect(products.slice(1).every((product) => product.source === "local")).toBe(true);
    expect(products[1].id).toBe("local-printer-paper");
    expect(calls.search).toBe(1);
    expect(searchesThisMonth(db, NOW)).toBe(1);
  });

  it("serves the same search from the cache for a few hours (no credit)", async () => {
    const { client, calls } = fakeChannel3();
    const catalog = catalogWith(client);
    await catalog.search("printer paper");
    now = new Date(NOW.getTime() + SEARCH_CACHE_TTL_MS - 1000);
    expect((await catalog.search("  PRINTER paper ")).products[0]).toEqual(remote);
    expect(calls.search).toBe(1);
    expect(searchesThisMonth(db, NOW)).toBe(1);
  });

  it("searches again once the cache has expired", async () => {
    const { client, calls } = fakeChannel3();
    const catalog = catalogWith(client);
    await catalog.search("printer paper");
    now = new Date(NOW.getTime() + SEARCH_CACHE_TTL_MS + 1000);
    await catalog.search("printer paper");
    expect(calls.search).toBe(2);
  });

  it("ignores a cache row it cannot read", async () => {
    const { client, calls } = fakeChannel3();
    db.insert(catalogSearches).values({ queryKey: "printer paper", productsJson: '[{"id":"x"}]', createdAt: NOW }).run();
    await catalogWith(client).search("printer paper");
    expect(calls.search).toBe(1);
  });

  it(`stops calling Channel3 at ${CHANNEL3_MONTHLY_SEARCH_CAP} searches a month (no bills)`, async () => {
    const { client, calls } = fakeChannel3();
    const catalog = catalogWith(client);
    for (let i = 0; i < CHANNEL3_MONTHLY_SEARCH_CAP; i++) {
      await catalog.search(`query ${i}`);
    }
    const result = await catalog.search("printer paper");
    expect(result.products.every((product) => product.source === "local")).toBe(true);
    expect(calls.search).toBe(CHANNEL3_MONTHLY_SEARCH_CAP);
    expect(searchesThisMonth(db, NOW)).toBe(CHANNEL3_MONTHLY_SEARCH_CAP);
  });

  it("starts counting again in a new Madrid month", async () => {
    const { client } = fakeChannel3();
    const catalog = catalogWith(client);
    await catalog.search("paper");
    // 1 Nov 00:30 in Madrid is still 31 Oct in UTC.
    now = new Date("2026-10-31T23:30:00Z");
    await catalog.search("pens");
    expect(searchesThisMonth(db, NOW)).toBe(1);
    expect(searchesThisMonth(db, now)).toBe(1);
  });

  it("still returns demo results when Channel3 fails, and counts the credit", async () => {
    const { client } = fakeChannel3({
      search: async () => {
        throw new Channel3Error("UNAVAILABLE", 500);
      },
    });
    const result = await catalogWith(client).search("printer paper");
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.every((product) => product.source === "local")).toBe(true);
    expect(searchesThisMonth(db, NOW)).toBe(1);
  });

  it("refuses an empty search", async () => {
    await expect(catalogWith(null).search(" \n ")).rejects.toBeInstanceOf(CatalogError);
  });

  it("normalises and caps queries", () => {
    expect(normalizeQuery("  A4\tPrinter\u0000 PAPER  ")).toBe("a4 printer paper");
    expect(normalizeQuery("x".repeat(500))).toHaveLength(200);
  });
});

describe("catalog product re-read", () => {
  it("reads local products locally, without Channel3", async () => {
    const { client, calls } = fakeChannel3();
    expect((await catalogWith(client).getProduct("local-stapler"))?.title).toMatch(/stapler/);
    expect(calls.getProduct).toBe(0);
  });

  it("re-reads Channel3 products without spending credits", async () => {
    const { client, calls } = fakeChannel3();
    expect(await catalogWith(client).getProduct("2yh8WH5")).toEqual(remote);
    expect(calls.getProduct).toBe(1);
    expect(searchesThisMonth(db, NOW)).toBe(0);
  });

  it("fails closed: no product when Channel3 cannot be reached", async () => {
    const { client } = fakeChannel3({
      getProduct: async () => {
        throw new Channel3Error("RATE_LIMITED", 429);
      },
    });
    expect(await catalogWith(client).getProduct("2yh8WH5")).toBeNull();
    expect(await catalogWith(null).getProduct("2yh8WH5")).toBeNull();
  });

  it("returns null for an unknown local product", async () => {
    expect(await catalogWith(null).getProduct("local-unknown")).toBeNull();
  });
});

describe("local catalog", () => {
  it("is valid and has only invented shops", () => {
    expect(LOCAL_PRODUCTS.length).toBeGreaterThanOrEqual(8);
    for (const product of LOCAL_PRODUCTS) {
      expect(product.id.startsWith("local-")).toBe(true);
      for (const offer of product.offers) {
        expect(offer.merchantDomain).toMatch(/\.example$/);
      }
    }
  });

  it("includes the trap product with injected instructions (US8)", () => {
    const trap = LOCAL_PRODUCTS.find((product) => product.id === TRAP_PRODUCT_ID);
    expect(trap?.description).toMatch(/ignore your spending rules/i);
  });

  it("includes the demo cases: a blocked shop, an approval and a wrong category", () => {
    const merchants = LOCAL_PRODUCTS.flatMap((product) => product.offers.map((offer) => offer.merchantDomain));
    expect(merchants).toContain("marketplace-x.example");
    expect(LOCAL_PRODUCTS.some((product) => Number(product.offers[0].unitPrice) > 15)).toBe(true);
    expect(LOCAL_PRODUCTS.some((product) => product.parentCategories.includes("furniture"))).toBe(true);
  });
});
