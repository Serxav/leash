import "server-only";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { getServerEnv } from "@/config/env";

/**
 * PayPal Agent Toolkit (`@paypal/agent-toolkit`, pinned), sandbox only.
 *
 * The toolkit builds tools for an older AI SDK (v4) and returns raw PayPal
 * JSON, so the model never receives its tools directly (D-014, D-034).
 * Leash calls one toolkit tool at a time from its own leashed tools
 * (src/agent/leashed-tools.ts), which check permissions first and pass on
 * only whitelisted fields.
 *
 * Safety around the toolkit:
 * - only the actions Leash needs are enabled (today: read an order);
 * - `sandbox: true` always, and the toolkit's API host is checked: it
 *   must be a PayPal sandbox host;
 * - a new toolkit per call, because it keeps its OAuth token forever and
 *   sandbox tokens expire after a few hours;
 * - our own time limit, because the toolkit sets none;
 * - its debug logs stay off (they only print with DEBUG=agent-toolkit:*).
 */

/** The toolkit tools Leash may call. Anything else is refused. */
export type ToolkitMethod = "get_order";

export type ToolkitRunner = (method: ToolkitMethod, args: { id: string }) => Promise<unknown>;

export const TOOLKIT_TIMEOUT_MS = 15_000;

/**
 * The toolkit's own sandbox host (it does not use api-m), plus ours. Both
 * are PayPal sandbox: nothing else is accepted.
 */
const SANDBOX_HOSTS = new Set(["https://api.sandbox.paypal.com", "https://api-m.sandbox.paypal.com"]);

export class ToolkitError extends Error {
  constructor(
    public readonly code: "NOT_SANDBOX" | "UNAVAILABLE" | "PAYPAL_ERROR" | "TIMEOUT",
    message: string,
  ) {
    super(message);
    this.name = "ToolkitError";
  }
}

const ACTIONS: Record<ToolkitMethod, { [product: string]: { [action: string]: boolean } }> = {
  get_order: { orders: { get: true } },
};

/** Throws unless the URL's origin is a PayPal sandbox API host. */
export function assertToolkitSandbox(url: string): void {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    throw new ToolkitError("NOT_SANDBOX", "The Agent Toolkit has no valid PayPal API host.");
  }
  if (!SANDBOX_HOSTS.has(origin)) {
    throw new ToolkitError("NOT_SANDBOX", "The Agent Toolkit is not pointed at the PayPal sandbox.");
  }
}

export function createToolkitRunner(credentials: {
  clientId: string;
  clientSecret: string;
}): ToolkitRunner {
  return async (method, args) => {
    const toolkit = new PayPalAgentToolkit({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      configuration: { actions: ACTIONS[method], context: { sandbox: true } },
    });
    assertToolkitSandbox(toolkit.client.getBaseUrl());

    const tool = toolkit.getTools()[method];
    if (!tool?.execute) throw new ToolkitError("UNAVAILABLE", `The Agent Toolkit has no ${method} tool.`);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ToolkitError("TIMEOUT", "PayPal did not answer in time.")),
        TOOLKIT_TIMEOUT_MS,
      );
    });
    let raw: unknown;
    try {
      raw = await Promise.race([
        tool.execute(args, { toolCallId: "leash", messages: [] }),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }

    // The toolkit answers with a JSON string, also for errors.
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new ToolkitError("UNAVAILABLE", "The Agent Toolkit returned an unreadable answer.");
    }
    if (isToolkitFailure(parsed)) {
      throw new ToolkitError("PAYPAL_ERROR", "PayPal could not return this order.");
    }
    return parsed;
  };
}

/** Toolkit errors look like {error: {...}} or {ok: false, ...}. */
function isToolkitFailure(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return "error" in value || ("ok" in value && (value as { ok: unknown }).ok === false);
}

let runner: ToolkitRunner | undefined;

/** The app's runner, with the sandbox-only credentials from the env. */
export function getToolkitRunner(): ToolkitRunner {
  if (!runner) {
    const env = getServerEnv();
    runner = createToolkitRunner({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
    });
  }
  return runner;
}
