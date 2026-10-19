/**
 * The anonymous visitor cookie (D-040). It holds only a random ID that
 * names the visitor's demo user: no name, email or password. httpOnly, so
 * page scripts cannot read it; SameSite=Lax, so it comes back when PayPal
 * sends the payer back to Leash after approving.
 */
export const VISITOR_COOKIE = "leash_visitor";

/** Kept for a week after the last visit, like the demo user itself. */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Only random UUIDs that Leash issued itself are accepted as visitor IDs. */
export function isVisitorId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
