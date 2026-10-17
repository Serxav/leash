import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CatalogProduct } from "@/catalog/product";
import type { Db } from "@/db/client";
import { securityEvents, type SecurityEventRow } from "@/db/schema";
import { INJECTION_SIGNALS, type InjectionSignal } from "./untrusted-text";

/**
 * The security log (US8): products Leash refused because their shop text
 * carried instructions for AI agents. The injected text is never stored or
 * logged, only which signals were found.
 */

export type SecurityStage = SecurityEventRow["stage"];

/** The row for one refused product; insert it with db or inside a transaction. */
export function injectionEvent(input: {
  userId: string;
  stage: SecurityStage;
  product: Pick<CatalogProduct, "id" | "source" | "title" | "offers">;
  signals: readonly InjectionSignal[];
  merchantDomain?: string;
  intentId?: string;
  at: Date;
}): typeof securityEvents.$inferInsert {
  return {
    id: randomUUID(),
    userId: input.userId,
    stage: input.stage,
    productId: input.product.id,
    productSource: input.product.source,
    productTitle: input.product.title,
    merchantDomain: input.merchantDomain ?? input.product.offers[0]?.merchantDomain ?? null,
    signalsJson: JSON.stringify(input.signals),
    intentId: input.intentId ?? null,
    createdAt: input.at,
  };
}

/** Server log line: product ID and signals only, never shop text. */
export function logInjection(stage: SecurityStage, productId: string, signals: readonly InjectionSignal[]) {
  console.warn(`[security] ${stage} refused ${productId}: ${signals.join(", ")}`);
}

export type SecurityEventView = {
  id: string;
  stage: SecurityStage;
  productTitle: string;
  merchantDomain: string | null;
  signals: InjectionSignal[];
  createdAt: Date;
};

const KNOWN_SIGNALS = new Set<string>(INJECTION_SIGNALS);

export function listSecurityEvents(db: Db, userId: string, limit = 20): SecurityEventView[] {
  return db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit)
    .all()
    .map((row) => {
      let signals: InjectionSignal[] = [];
      try {
        const parsed: unknown = JSON.parse(row.signalsJson);
        if (Array.isArray(parsed)) {
          signals = parsed.filter((s): s is InjectionSignal => KNOWN_SIGNALS.has(s));
        }
      } catch {
        signals = [];
      }
      return {
        id: row.id,
        stage: row.stage,
        productTitle: row.productTitle,
        merchantDomain: row.merchantDomain,
        signals,
        createdAt: row.createdAt,
      };
    });
}
