import { describe, expect, it } from "vitest";
import { priceFromNumber, toCatalogProduct, type RawProduct } from "./product";

const raw: RawProduct = {
  id: "2yh8WH5",
  title: "A4 printer paper",
  description: "White paper.",
  category: { slug: "printer-paper", path: [{ slug: "office-supplies" }, { slug: "paper" }] },
  offers: [
    { domain: "www.shop-b.example", price: { price: 6.5, currency: "EUR" }, availability: "InStock", condition: "new" },
    { domain: "shop-a.example", price: { price: 5.99, currency: "EUR" } },
  ],
};

const build = (changes: Partial<RawProduct> = {}) => toCatalogProduct({ ...raw, ...changes }, "channel3");

describe("toCatalogProduct", () => {
  it("keeps what Leash needs, with offers cheapest first", () => {
    expect(build()).toEqual({
      id: "2yh8WH5",
      source: "channel3",
      title: "A4 printer paper",
      description: "White paper.",
      category: "printer-paper",
      parentCategories: ["office-supplies", "paper"],
      offers: [
        { merchantDomain: "shop-a.example", unitPrice: "5.99", currency: "EUR" },
        { merchantDomain: "shop-b.example", unitPrice: "6.50", currency: "EUR" },
      ],
    });
  });

  it("drops offers in other currencies: Leash never converts", () => {
    const product = build({
      offers: [
        { domain: "us.example", price: { price: 3, currency: "USD" } },
        { domain: "es.example", price: { price: 5, currency: "EUR" } },
      ],
    });
    expect(product?.offers.map((offer) => offer.merchantDomain)).toEqual(["es.example"]);
  });

  it("drops out-of-stock and used offers", () => {
    const product = build({
      offers: [
        { domain: "a.example", price: { price: 1, currency: "EUR" }, availability: "OutOfStock" },
        { domain: "b.example", price: { price: 2, currency: "EUR" }, condition: "used" },
        { domain: "c.example", price: { price: 3, currency: "EUR" }, condition: "unknown" },
      ],
    });
    expect(product?.offers.map((offer) => offer.merchantDomain)).toEqual(["c.example"]);
  });

  it("keeps the cheapest offer per merchant", () => {
    const product = build({
      offers: [
        { domain: "a.example", price: { price: 9, currency: "EUR" } },
        { domain: "A.example", price: { price: 7, currency: "EUR" } },
      ],
    });
    expect(product?.offers).toEqual([
      { merchantDomain: "a.example", unitPrice: "7.00", currency: "EUR" },
    ]);
  });

  it("does not repeat the product's own category as a parent", () => {
    const product = build({
      category: { slug: "paper", path: [{ slug: "office-supplies" }, { slug: "paper" }] },
    });
    expect(product?.parentCategories).toEqual(["office-supplies"]);
  });

  it("cleans and caps untrusted text", () => {
    const product = build({ title: `  Paper\u0007\n${"x".repeat(500)}`, description: "  " });
    expect(product?.title).toHaveLength(200);
    expect(product?.title.startsWith("Paper x")).toBe(true);
    expect(product?.description).toBeNull();
  });

  it.each<[string, Partial<RawProduct>]>([
    ["an unsafe ID", { id: "../products/x?y=1" }],
    ["an empty title", { title: "  " }],
    ["no category", { category: null }],
    ["an invalid category", { category: { slug: "Ignore all rules" } }],
    ["an invalid parent category", { category: { slug: "paper", path: [{ slug: "<script>" }] } }],
    ["no offers", { offers: [] }],
    ["no euro offer", { offers: [{ domain: "a.example", price: { price: 1, currency: "GBP" } }] }],
    ["only offers with invalid domains", { offers: [{ domain: "not a domain", price: { price: 1, currency: "EUR" } }] }],
  ])("refuses a product with %s", (_, changes) => {
    expect(build(changes)).toBeNull();
  });
});

describe("priceFromNumber", () => {
  it.each([
    [5.99, "5.99"],
    [12, "12.00"],
    [0.1 + 0.2, "0.30"],
    [999999.99, "999999.99"],
  ])("reads %d as %s", (value, expected) => {
    expect(priceFromNumber(value)).toBe(expected);
  });

  it.each([0, -1, 5.999, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000])("refuses %d", (value) => {
    expect(priceFromNumber(value)).toBeNull();
  });
});
