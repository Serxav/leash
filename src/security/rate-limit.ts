/**
 * Rate limits for the AI calls of the public demo (D-041).
 *
 * Every agent run and every rules conversion calls the AI model, and agent
 * runs may also spend Channel3 credits. On a free plan with no billing, a
 * visitor (or a script) must not be able to use them up. Two limits, each
 * over a sliding window:
 *   - per visitor: the visitor's anonymous ID (D-040);
 *   - global: all visitors together, because clearing the cookie gives a
 *     new visitor ID.
 *
 * Kept in memory: the demo runs as one instance (Render Free), and a
 * restart only resets the counts, which is harmless.
 */

export type RateLimit = { max: number; windowMs: number };

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "visitor" | "global"; retryAfterMs: number };

export class RateLimiter {
  private readonly visitors = new Map<string, number[]>();
  private all: number[] = [];

  constructor(
    private readonly perVisitor: RateLimit,
    private readonly global: RateLimit,
  ) {}

  /** Counts one call if both limits allow it; otherwise counts nothing. */
  take(visitorId: string, now: number): RateLimitResult {
    this.all = this.all.filter((at) => at > now - this.global.windowMs);
    const mine = (this.visitors.get(visitorId) ?? []).filter((at) => at > now - this.perVisitor.windowMs);

    if (mine.length >= this.perVisitor.max) {
      this.visitors.set(visitorId, mine);
      return { ok: false, scope: "visitor", retryAfterMs: mine[0] + this.perVisitor.windowMs - now };
    }
    if (this.all.length >= this.global.max) {
      return { ok: false, scope: "global", retryAfterMs: this.all[0] + this.global.windowMs - now };
    }
    mine.push(now);
    this.all.push(now);
    this.visitors.set(visitorId, mine);
    this.forgetIdleVisitors(now);
    return { ok: true };
  }

  /** Keeps memory small: drops visitors with no call inside the window. */
  private forgetIdleVisitors(now: number): void {
    if (this.visitors.size < 1000) return;
    for (const [id, calls] of this.visitors) {
      if (calls.every((at) => at <= now - this.perVisitor.windowMs)) this.visitors.delete(id);
    }
  }
}

const HOUR_MS = 3_600_000;

/** Agent runs: 10 per visitor and 100 in total per hour. */
export const agentRuns = new RateLimiter({ max: 10, windowMs: HOUR_MS }, { max: 100, windowMs: HOUR_MS });
/** Rules conversions: 20 per visitor and 200 in total per hour. */
export const rulesConversions = new RateLimiter({ max: 20, windowMs: HOUR_MS }, { max: 200, windowMs: HOUR_MS });

/** A short message for the UI, in whole minutes. */
export function rateLimitMessage(result: Exclude<RateLimitResult, { ok: true }>): string {
  const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
  const wait = `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  return result.scope === "visitor"
    ? `You reached the demo's limit of AI requests for this hour. ${wait}`
    : `The demo is very busy right now. ${wait}`;
}
