import { describe, expect, it } from "vitest";
import { createChannel3Client } from "@/catalog/channel3";
import { getServerEnv } from "@/config/env";

// Real Channel3 calls. Each run spends 1 free search credit (D-031); the
// product re-read is free. Skipped without CHANNEL3_API_KEY.
const apiKey = getServerEnv().CHANNEL3_API_KEY;

describe.skipIf(!apiKey)("Channel3 catalog (live)", () => {
  it("finds office products in Spain with euro prices, and re-reads one for free", async () => {
    const client = createChannel3Client({ apiKey: apiKey! });
    const products = await client.search("a4 printer paper 500 sheets", 5);

    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(product.offers.length).toBeGreaterThan(0);
      for (const offer of product.offers) {
        expect(offer.currency).toBe("EUR");
        expect(offer.unitPrice).toMatch(/^\d+\.\d{2}$/);
      }
    }

    const fresh = await client.getProduct(products[0].id);
    expect(fresh?.id).toBe(products[0].id);
    expect(fresh?.offers.length).toBeGreaterThan(0);

    // What the catalog really looks like, for D-028 (no keys, no prices).
    console.log(
      "categories:",
      products.map((product) => [...product.parentCategories, product.category].join(" > ")),
    );
  }, 60_000);
});
