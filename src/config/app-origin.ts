/**
 * The address PayPal sends the payer back to after saving PayPal (D-041).
 *
 * The request's Host header is set by the client, so a deployed app never
 * builds its PayPal return URL from it. In order:
 *   1. APP_URL, if set (for example to try a production build locally);
 *   2. RENDER_EXTERNAL_URL, which Render sets to the service's
 *      https://….onrender.com address;
 *   3. in development only, the request's own host (localhost).
 */
export function appOrigin(
  env: Record<string, string | undefined>,
  request: { host: string | null; proto: string | null },
): string {
  const configured = env.APP_URL?.trim() || env.RENDER_EXTERNAL_URL?.trim();
  if (configured) return checkedOrigin(configured);
  if (env.NODE_ENV === "production") {
    throw new Error("APP_URL or RENDER_EXTERNAL_URL is required in production.");
  }
  if (!request.host) throw new Error("The request has no Host header.");
  return checkedOrigin(`${request.proto ?? "http"}://${request.host}`);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Only https addresses, or http on this computer, and only the origin. */
function checkedOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The app URL is not a valid URL.");
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("The app URL must use https.");
  }
  return url.origin;
}
