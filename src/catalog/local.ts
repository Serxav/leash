import localCatalog from "./local-catalog.json";
import { toCatalogProduct, type CatalogProduct, type RawProduct } from "./product";

/**
 * The local fallback catalog (brief §5): generic office products from
 * invented shops (".example" domains, no brands). Used for tests, without a
 * Channel3 key, when Channel3 fails, and after the monthly search cap.
 *
 * It includes, on purpose:
 * - an offer from marketplace-x.example (blocked in Marta's rules);
 * - a toner above Marta's approval amount and a chair outside her categories;
 * - the trap product "local-sticky-notes-deal", whose description carries
 *   injected instructions for AI agents (US8).
 */
export const LOCAL_PRODUCTS: readonly CatalogProduct[] = (localCatalog as RawProduct[]).map(
  (raw) => {
    const product = toCatalogProduct(raw, "local");
    if (!product || !product.id.startsWith("local-")) {
      throw new Error(`Invalid local catalog product: ${raw.id}`);
    }
    return product;
  },
);

export const TRAP_PRODUCT_ID = "local-sticky-notes-deal";

export function isLocalProductId(id: string): boolean {
  return id.startsWith("local-");
}

/** Simple word match on title and categories; best matches first. */
export function searchLocal(query: string, limit: number): CatalogProduct[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (words.length === 0) return [];
  return LOCAL_PRODUCTS.map((product) => {
    const text = [product.title, product.category, ...product.parentCategories]
      .join(" ")
      .toLowerCase();
    return { product, score: words.filter((word) => text.includes(word)).length };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
}

export function getLocalProduct(id: string): CatalogProduct | null {
  return LOCAL_PRODUCTS.find((product) => product.id === id) ?? null;
}
