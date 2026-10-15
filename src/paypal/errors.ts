import { ApiError, CustomError } from "@paypal/paypal-server-sdk";

/**
 * What Leash keeps from a failed PayPal call: enough to branch on and to
 * quote to PayPal support, never credentials, tokens or request headers.
 */
export type PayPalFailure = {
  status: number;
  /** PayPal error name, e.g. UNPROCESSABLE_ENTITY. */
  name?: string;
  /** details[0].issue, e.g. INSTRUMENT_DECLINED: the field to branch on. */
  issue?: string;
  /** PayPal's debug_id, asked for in support tickets. */
  debugId?: string;
};

export class PayPalRequestError extends Error {
  constructor(public readonly failure: PayPalFailure) {
    super(
      `PayPal request failed with HTTP ${failure.status}` +
        (failure.issue ? ` (${failure.issue})` : failure.name ? ` (${failure.name})` : "") +
        (failure.debugId ? ` [debug_id ${failure.debugId}]` : ""),
    );
    this.name = "PayPalRequestError";
  }
}

type ErrorPayload = {
  name?: unknown;
  debug_id?: unknown;
  details?: Array<{ issue?: unknown }>;
};

function fromPayload(status: number, payload: ErrorPayload | undefined) {
  const issue = payload?.details?.[0]?.issue;
  return {
    status,
    name: typeof payload?.name === "string" ? payload.name : undefined,
    issue: typeof issue === "string" ? issue : undefined,
    debugId:
      typeof payload?.debug_id === "string" ? payload.debug_id : undefined,
  } satisfies PayPalFailure;
}

/**
 * Converts an SDK error into a PayPalFailure, or returns undefined for
 * errors that are not PayPal API responses (network, timeout, bugs).
 *
 * Per the SDK error-handling skill: typed subclasses (CustomError) carry the
 * parsed payload on `result`, using the API's snake_case field names; a bare
 * ApiError only has the raw `body`. OAuthProviderError is shadowed by a
 * same-named model in the package root, so it cannot be used with
 * instanceof: auth failures fall through to the ApiError branch.
 */
export function toPayPalFailure(error: unknown): PayPalFailure | undefined {
  if (error instanceof CustomError) {
    return fromPayload(error.statusCode, error.result as ErrorPayload);
  }
  if (error instanceof ApiError) {
    let payload: ErrorPayload | undefined;
    if (typeof error.body === "string") {
      try {
        payload = JSON.parse(error.body) as ErrorPayload;
      } catch {
        payload = undefined;
      }
    }
    const failure = fromPayload(error.statusCode, payload);
    failure.debugId ??= error.headers?.["paypal-debug-id"];
    return failure;
  }
  return undefined;
}

/** Runs a PayPal call and rethrows API failures as PayPalRequestError. */
export async function callPayPal<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const failure = toPayPalFailure(error);
    if (failure) throw new PayPalRequestError(failure);
    throw error;
  }
}
