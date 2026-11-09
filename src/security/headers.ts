/**
 * HTTP security headers sent with every response (wired in `next.config.ts`).
 * Values follow the Next.js `headers` config docs.
 *
 * - No page may be shown inside another site's frame, so a hidden frame
 *   cannot trick someone into pressing "Approve" (clickjacking).
 * - Browsers must use HTTPS, must not guess file types, and send other
 *   sites only Leash's origin, never a full path.
 * - Leash needs no camera, microphone or location.
 *
 * There is no full Content Security Policy for scripts: it would need
 * nonces on every page and could break the demo days before judging.
 */
export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
] as const;
