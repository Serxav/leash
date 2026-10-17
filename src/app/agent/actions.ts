"use server";

import { refresh } from "next/cache";
import { AgentError, MAX_REQUEST_LENGTH, runShoppingAgent } from "@/agent/agent";
import { getModel } from "@/ai/models";
import { getCatalog } from "@/catalog/server";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getMandateView } from "@/payments/mandate";
import { proposeForUser } from "@/purchases/server";
import { describeRules } from "@/rules/describe";
import { getActivePolicy } from "@/rules/policies";
import { injectionEvent, logInjection } from "@/security/events";
import { securityEvents } from "@/db/schema";
import type { AgentFormState } from "./state";

/**
 * US3: the user asks the agent to restock. The agent searches and
 * proposes; every proposal is decided by the engine on the server.
 */
export async function runAgent(
  _previous: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const raw = formData.get("request");
  const request = typeof raw === "string" ? raw : "";
  const shown = request.slice(0, MAX_REQUEST_LENGTH);

  // Do not spend AI calls on runs where every proposal would be blocked.
  const db = getDb();
  const policy = getActivePolicy(db, DEMO_USER_ID);
  if (!policy) {
    return { kind: "error", request: shown, message: "Confirm your spending rules first." };
  }
  if (getMandateView(db, DEMO_USER_ID).status !== "ACTIVE") {
    return { kind: "error", request: shown, message: "Connect PayPal first, so Leash can pay approved purchases." };
  }

  try {
    const run = await runShoppingAgent(
      {
        model: getModel("agent"),
        catalog: getCatalog(),
        propose: proposeForUser(DEMO_USER_ID),
        reportInjection: (product, signals) => {
          db.insert(securityEvents)
            .values(injectionEvent({ userId: DEMO_USER_ID, stage: "SEARCH", product, signals, at: new Date() }))
            .run();
          logInjection("SEARCH", product.id, signals);
        },
      },
      { request, ruleTags: describeRules(policy.rules).map((tag) => tag.text) },
    );
    return { kind: "done", request: shown, summary: run.summary };
  } catch (error) {
    if (error instanceof AgentError) {
      return { kind: "error", request: shown, message: error.message };
    }
    // The user's request is not logged.
    console.error("[agent] runAgent failed:", (error as Error).name);
    return { kind: "error", request: shown, message: "Something went wrong. Please try again." };
  } finally {
    // Show the new proposals and decisions.
    refresh();
  }
}
