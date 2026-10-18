import { describe, expect, it } from "vitest";
import { Channel3Error, createChannel3Client } from "./channel3";

const KEY = "test-channel3-key";

const product = {
  id: "2yh8WH5",
  title: "A4 printer paper",
  description: "White paper.",
  brands: [{ id: "b1", name: "Some Brand" }],
  images: [],
  category: { slug: "printer-paper", title: "Printer paper", has_children: false, path: [{ slug: "office-supplies", title: "Office" }] },
  offers: [
    { url: "https://buy.example/x", domain: "shop.example", price: { price: 5.99, currency: "EUR", compare_at_price: null }, availability: "InStock", condition: "new", max_commission_rate: 0 },
  ],
  structured_attributes: {},
};

type Sent = { url: URL; init: RequestInit; headers: Headers };

function fakeChannel3(reply: (sent: Sent) => Response) {
  const sent: Sent[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = { url: new URL(String(input)), init: init ?? {}, headers: new Headers(init?.headers) };
    sent.push(request);
    return reply(request);
  }) as typeof globalThis.fetch;
  return { client: createChannel3Client({ apiKey: KEY, fetch }), sent };
}

describe("Channel3 search", () => {
  it("searches Spain + EUR with the documented request", async () => {
    const { client, sent } = fakeChannel3(() => Response.json({ products: [product], next_page_token: null }));
    const products = await client.search("a4 printer paper", 10);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ id: "2yh8WH5", source: "channel3", category: "printer-paper" });
    const [request] = sent;
    expect(request.url.href).toBe("https://api.trychannel3.com/v1/search");
    expect(request.init.method).toBe("POST");
    expect(request.headers.get("x-api-key")).toBe(KEY);
    expect(JSON.parse(String(request.init.body))).toEqual({
      query: "a4 printer paper",
      limit: 10,
      config: { country: "ES", currency: "EUR" },
      filters: { availability: ["InStock"], conditions: ["new"] },
    });
  });

  it("narrows the search to the given categories and price limit (D-035)", async () => {
    const { client, sent } = fakeChannel3(() => Response.json({ products: [product], next_page_token: null }));
    await client.search("stapler", 10, { categoryIds: ["office-supplies", "paper"], maxPrice: "12.99" });

    expect(JSON.parse(String(sent[0].init.body)).filters).toEqual({
      availability: ["InStock"],
      conditions: ["new"],
      category_ids: ["office-supplies", "paper"],
      price: { min_price: null, max_price: 12.99 },
    });
  });

  it("drops products it cannot use and keeps the rest", async () => {
    const { client } = fakeChannel3(() =>
      Response.json({
        products: [
          product,
          { id: "x", title: "No offers", offers: [] },
          { title: "No ID" },
          "not an object",
          { ...product, id: "3abc", offers: [{ domain: "us.example", price: { price: 1, currency: "USD" } }] },
        ],
      }),
    );
    expect((await client.search("paper", 10)).map((p) => p.id)).toEqual(["2yh8WH5"]);
  });

  it.each([
    [429, "RATE_LIMITED"],
    [500, "UNAVAILABLE"],
    [401, "UNAVAILABLE"],
  ])("reports HTTP %i as %s without the key or the body", async (status, code) => {
    const { client } = fakeChannel3(() => new Response(`secret details ${KEY}`, { status }));
    const error = await client.search("paper", 10).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Channel3Error);
    expect(error).toMatchObject({ code, status });
    expect(String((error as Error).message)).not.toContain(KEY);
    expect(String((error as Error).message)).not.toContain("secret");
  });

  it("reports network errors as unavailable without details", async () => {
    const fetch = (async () => {
      throw new Error(`connect failed with x-api-key ${KEY}`);
    }) as typeof globalThis.fetch;
    const error = await createChannel3Client({ apiKey: KEY, fetch })
      .search("paper", 10)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "UNAVAILABLE" });
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it.each([
    ["not JSON", () => new Response("<html>", { status: 200 })],
    ["the wrong shape", () => Response.json({ items: [] })],
  ])("reports %s as a bad response", async (_, reply) => {
    const { client } = fakeChannel3(reply);
    await expect(client.search("paper", 10)).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});

describe("Channel3 product re-read", () => {
  it("reads one product in Spain + EUR (free endpoint)", async () => {
    const { client, sent } = fakeChannel3(() => Response.json(product));
    const result = await client.getProduct("2yh8WH5");
    expect(result?.offers).toEqual([{ merchantDomain: "shop.example", unitPrice: "5.99", currency: "EUR" }]);
    const [request] = sent;
    expect(request.url.origin + request.url.pathname).toBe("https://api.trychannel3.com/v1/products/2yh8WH5");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({ country: "ES", currency: "EUR" });
    expect(request.init.method).toBe("GET");
    expect(request.headers.get("x-api-key")).toBe(KEY);
  });

  it("returns null for an unknown product", async () => {
    const { client } = fakeChannel3(() => new Response("", { status: 404 }));
    expect(await client.getProduct("2yh8WH5")).toBeNull();
  });

  it("returns null when the product has no euro offer left", async () => {
    const { client } = fakeChannel3(() =>
      Response.json({ ...product, offers: [{ domain: "us.example", price: { price: 1, currency: "USD" } }] }),
    );
    expect(await client.getProduct("2yh8WH5")).toBeNull();
  });

  it("returns null if Channel3 answers with another product", async () => {
    const { client } = fakeChannel3(() => Response.json({ ...product, id: "other1" }));
    expect(await client.getProduct("2yh8WH5")).toBeNull();
  });

  it.each(["../search", "a/b", "x?country=US", "", "a".repeat(65)])(
    "never sends an unsafe product ID (%j)",
    async (id) => {
      const { client, sent } = fakeChannel3(() => Response.json(product));
      expect(await client.getProduct(id)).toBeNull();
      expect(sent).toHaveLength(0);
    },
  );
});
