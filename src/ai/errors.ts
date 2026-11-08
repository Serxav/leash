import { APICallError, RetryError } from "ai";

/**
 * A safe one-line description of an AI failure, for server logs only:
 * the error type and, for an HTTP answer from the provider, its status
 * code (401 key, 402/403 credits or access, 429 rate limit, 5xx provider).
 *
 * It never includes the error message, the request or the response body:
 * those can carry prompts, product text or provider details.
 */
export function describeAiError(error: unknown): string {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  const name = last instanceof Error ? last.name : typeof last;
  const status = APICallError.isInstance(last) && last.statusCode !== undefined ? ` HTTP ${last.statusCode}` : "";
  const retried = RetryError.isInstance(error) ? ` after ${error.errors.length} attempts` : "";
  return `${name}${status}${retried}`;
}
