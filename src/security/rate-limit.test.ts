import { describe, expect, it } from "vitest";
import { RateLimiter, rateLimitMessage } from "./rate-limit";

const MIN = 60_000;
const limiter = () => new RateLimiter({ max: 2, windowMs: 60 * MIN }, { max: 3, windowMs: 60 * MIN });

describe("AI rate limit (D-041)", () => {
  it("allows a visitor up to the limit, then says when to try again", () => {
    const limits = limiter();
    expect(limits.take("a", 0)).toEqual({ ok: true });
    expect(limits.take("a", 10 * MIN)).toEqual({ ok: true });
    expect(limits.take("a", 20 * MIN)).toEqual({ ok: false, scope: "visitor", retryAfterMs: 40 * MIN });
  });

  it("frees a call when the oldest one leaves the window", () => {
    const limits = limiter();
    limits.take("a", 0);
    limits.take("a", 10 * MIN);
    expect(limits.take("a", 60 * MIN - 1).ok).toBe(false);
    expect(limits.take("a", 60 * MIN)).toEqual({ ok: true });
  });

  it("does not count refused calls", () => {
    const limits = limiter();
    limits.take("a", 0);
    limits.take("a", 0);
    for (let i = 0; i < 5; i++) expect(limits.take("a", MIN).ok).toBe(false);
    expect(limits.take("b", MIN)).toEqual({ ok: true }); // the global count is 3 now, not 8
  });

  it("limits all visitors together, so a new cookie does not help", () => {
    const limits = limiter();
    expect(limits.take("a", 0).ok).toBe(true);
    expect(limits.take("b", 0).ok).toBe(true);
    expect(limits.take("c", 0).ok).toBe(true);
    expect(limits.take("d", 5 * MIN)).toEqual({ ok: false, scope: "global", retryAfterMs: 55 * MIN });
  });

  it("keeps visitors apart", () => {
    const limits = new RateLimiter({ max: 1, windowMs: 60 * MIN }, { max: 100, windowMs: 60 * MIN });
    expect(limits.take("a", 0).ok).toBe(true);
    expect(limits.take("a", 0).ok).toBe(false);
    expect(limits.take("b", 0).ok).toBe(true);
  });

  it("explains the limit in whole minutes", () => {
    expect(rateLimitMessage({ ok: false, scope: "visitor", retryAfterMs: 61_000 })).toBe(
      "You reached the demo's limit of AI requests for this hour. Please try again in 2 minutes.",
    );
    expect(rateLimitMessage({ ok: false, scope: "global", retryAfterMs: 1 })).toBe(
      "The demo is very busy right now. Please try again in 1 minute.",
    );
  });
});
