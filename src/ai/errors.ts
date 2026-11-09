import { APICallError, RetryError } from "ai";

/**
 * A safe one-line description of an AI failure, for server logs only:
 * the error type and, for an HTTP answer from the provider, its status
 * code (401 key, 402/403 credits or access, 429 rate limit, 5xx provider).
 *
 * It never includes the error message, the request or the response body:
 * those can carry prompts, product text or provider details. It may add the
 * provider's short error code (like `model_not_found`) and the URL path,
 * which carry neither.
 */
export function describeAiError(error: unknown): string {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  const name = last instanceof Error ? last.name : typeof last;
  const status = APICallError.isInstance(last) && last.statusCode !== undefined ? ` HTTP ${last.statusCode}` : "";
  const retried = RetryError.isInstance(error) ? ` after ${error.errors.length} attempts` : "";
  const code = APICallError.isInstance(last) ? providerCode(last.responseBody) : undefined;
  const path = APICallError.isInstance(last) ? urlPath(last.url) : undefined;
  return `${name}${status}${code ? ` code ${code}` : ""}${path ? ` at ${path}` : ""}${retried}`;
}

/** Only a short identifier is kept: anything that looks like free text is dropped. */
const SAFE_CODE = /^[A-Za-z0-9_.-]{1,40}$/;

function providerCode(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const json: unknown = JSON.parse(body);
    const error = (json as { error?: unknown }).error;
    const candidates = [
      typeof error === "object" && error ? (error as { code?: unknown }).code : undefined,
      typeof error === "object" && error ? (error as { type?: unknown }).type : undefined,
      (json as { code?: unknown }).code,
    ];
    const code = candidates.find((c) => (typeof c === "string" || typeof c === "number") && SAFE_CODE.test(String(c)));
    return code === undefined ? undefined : String(code);
  } catch {
    return undefined;
  }
}

function urlPath(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    return SAFE_PATH.test(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

const SAFE_PATH = /^[A-Za-z0-9/_.-]{1,80}$/;
