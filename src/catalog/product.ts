import { z } from "zod";
import { fromCents, isMoney, toCents } from "@/lib/money";
import { normalizeCategory, normalizeMerchantDomain } from "@/rules/schema";

/**
 * A product as Leash uses it, whatever the source (Channel3 or the local
 * catalog). Built only by code from validated data.
 *
 * Security: `title` and `description` are untrusted catalog text. They are
 * data for the user and the model, never instructions, and never decide
 * anything: price, merchant and category come from the fields below.
 */
export type CatalogOffer = {
  /**
   * The merchant website, e.g. "shop.example". Channel3 offers have no ID
   * of their own, so a product's offer is identified by its merchant.
   */
  merchantDomain: string;
  /** Price of one unit in euros, e.g. "12.99". */
  unitPrice: string;
  currency: "EUR";
};

export type CatalogProduct = {
  id: string;
  source: "channel3" | "local";
  title: string;
  description: string | null;
  /** The product's own category slug, e.g. "printer-paper". */
  category: string;
  /** Its parent categories, from the top, e.g. ["office-supplies", "paper"]. */
  parentCategories: string[];
  /** In-stock, new, euro offers only; one per merchant, cheapest first. */
  offers: CatalogOffer[];
};

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_OFFERS = 10;
const MAX_PARENT_CATEGORIES = 10;

/** Channel3 product IDs (e.g. "2yh8WH5") and local ones ("local-…"). */
export const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Single-line text without control characters, capped. */
export function cleanText(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * A price as a JSON number (e.g. 12.99) → "12.99", or null if it is not a
 * positive amount with at most two decimals. Floats are never used later.
 */
export function priceFromNumber(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-6) return null;
  const amount = fromCents(cents);
  return isMoney(amount) ? amount : null;
}

/** What a source gives us before Leash builds a CatalogProduct. */
export type RawProduct = {
  id: string;
  title: string;
  description?: string | null;
  category?: { slug: string; path?: Array<{ slug: string }> | null } | null;
  offers?: Array<{
    domain: string;
    price: { price: number; currency: string };
    availability?: string | null;
    condition?: string | null;
  }> | null;
};

/**
 * Builds a CatalogProduct, or null if it cannot be bought safely: no valid
 * ID, no category, or no new in-stock euro offer. Never converts currencies.
 */
export function toCatalogProduct(
  raw: RawProduct,
  source: CatalogProduct["source"],
): CatalogProduct | null {
  if (!PRODUCT_ID_PATTERN.test(raw.id)) return null;
  const title = cleanText(raw.title, MAX_TITLE_LENGTH);
  if (!title) return null;

  const category = raw.category ? normalizeCategory(raw.category.slug) : null;
  if (!category) return null;
  const parents: string[] = [];
  for (const node of raw.category?.path ?? []) {
    const slug = normalizeCategory(node.slug);
    if (!slug) return null;
    if (slug !== category && !parents.includes(slug)) parents.push(slug);
  }
  if (parents.length > MAX_PARENT_CATEGORIES) return null;

  const cheapest = new Map<string, CatalogOffer>();
  for (const offer of raw.offers ?? []) {
    if (offer.price.currency !== "EUR") continue;
    // Missing availability or condition count as in stock and new (Channel3 docs).
    if (offer.availability != null && offer.availability !== "InStock") continue;
    if (offer.condition != null && offer.condition !== "new" && offer.condition !== "unknown") {
      continue;
    }
    const merchantDomain = normalizeMerchantDomain(offer.domain);
    const unitPrice = priceFromNumber(offer.price.price);
    if (!merchantDomain || !unitPrice) continue;
    const known = cheapest.get(merchantDomain);
    if (!known || toCents(unitPrice) < toCents(known.unitPrice)) {
      cheapest.set(merchantDomain, { merchantDomain, unitPrice, currency: "EUR" });
    }
  }
  const offers = [...cheapest.values()]
    .sort((a, b) => toCents(a.unitPrice) - toCents(b.unitPrice))
    .slice(0, MAX_OFFERS);
  if (offers.length === 0) return null;

  const description = raw.description ? cleanText(raw.description, MAX_DESCRIPTION_LENGTH) : "";
  return {
    id: raw.id,
    source,
    title,
    description: description || null,
    category,
    parentCategories: parents,
    offers,
  };
}

/** Zod for a stored CatalogProduct (cache rows): read back fail-closed. */
export const catalogProductSchema = z.strictObject({
  id: z.string().regex(PRODUCT_ID_PATTERN),
  source: z.enum(["channel3", "local"]),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).nullable(),
  category: z.string().min(1),
  parentCategories: z.array(z.string()).max(MAX_PARENT_CATEGORIES),
  offers: z
    .array(
      z.strictObject({
        merchantDomain: z.string().min(1),
        unitPrice: z.string().refine(isMoney),
        currency: z.literal("EUR"),
      }),
    )
    .min(1)
    .max(MAX_OFFERS),
});
