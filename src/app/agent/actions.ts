"use server";

import { refresh } from "next/cache";
import { isAgentPaused } from "@/account/settings";
import { AgentError, runShoppingAgent } from "@/agent/agent";
import { checkStatusForUser } from "@/agent/server";
import { getModel } from "@/ai/models";
import { searchScopeFromRules } from "@/catalog/catalog";
import { getCatalog } from "@/catalog/server";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { getMandateView } from "@/payments/mandate";
import { listProposalsByIds } from "@/purchases/propose";
import { proposeForUser } from "@/purchases/server";
import { describeRules } from "@/rules/describe";
import { getActivePolicy } from "@/rules/policies";
import { injectionEvent, logInjection } from "@/security/events";
import { agentRuns, rateLimitMessage } from "@/security/rate-limit";
import { securityEvents } from "@/db/schema";
import { moodForOutcomes } from "@/components/mascot-mood";
import { proposalCard } from "../labels";
import type { AgentReply } from "./state";

/**
 * US3: the user asks the agent to restock. The agent searches and
 * proposes; every proposal is decided by the engine on the server. The
 * reply carries this run's proposals for the chat (D-042).
 */
export async function runAgent(formData: FormData): Promise<AgentReply> {
  const raw = formData.get("request");
  const request = typeof raw === "string" ? raw : "";
  const refusal = (message: string): AgentReply => ({ kind: "error", message, proposals: [], mood: "idle" });

  // Do not spend AI calls on runs where every proposal would be blocked.
  const db = getDb();
  const userId = await currentUserId();
  const policy = getActivePolicy(db, userId);
  if (!policy) {
    return refusal("Confirm your spending rules first.");
  }
  if (isAgentPaused(db, userId)) {
    return refusal("You paused the agent. Resume it in Permissions first.");
  }
  if (getMandateView(db, userId).status !== "ACTIVE") {
    return refusal("Connect PayPal in Permissions first, so Leash can pay approved purchases.");
  }

  // Last check before spending AI calls and Channel3 credits (D-041).
  const limit = agentRuns.take(userId, Date.now());
  if (!limit.ok) {
    return refusal(rateLimitMessage(limit));
  }

  // Channel3 searches only what these rules could allow (D-035).
  const catalog = getCatalog();
  const scope = searchScopeFromRules(policy.rules);
  const propose = proposeForUser(userId);
  const madeInThisRun: string[] = [];
  const reply = (kind: "done" | "error", text: string): AgentReply => {
    const proposals = listProposalsByIds(db, userId, madeInThisRun).map(proposalCard);
    const mood = moodForOutcomes(proposals.map((card) => card.outcome));
    return kind === "done"
      ? { kind, summary: text, proposals, mood }
      : { kind, message: text, proposals, mood };
  };

  try {
    const run = await runShoppingAgent(
      {
        model: getModel("agent"),
        catalog: { search: (query) => catalog.search(query, scope) },
        propose: async (input) => {
          const result = await propose(input);
          if (result.purchaseRef) madeInThisRun.push(result.purchaseRef);
          return result;
        },
        checkPurchaseStatus: checkStatusForUser(userId),
        reportInjection: (product, signals) => {
          db.insert(securityEvents)
            .values(injectionEvent({ userId, stage: "SEARCH", product, signals, at: new Date() }))
            .run();
          logInjection("SEARCH", product.id, signals);
        },
      },
      { request, ruleTags: describeRules(policy.rules).map((tag) => tag.text) },
    );
    return reply("done", run.summary);
  } catch (error) {
    if (error instanceof AgentError) {
      return reply("error", error.message);
    }
    // The user's request is not logged.
    console.error("[agent] runAgent failed:", (error as Error).name);
    return reply("error", "Something went wrong. Please try again.");
  } finally {
    // Show the new proposals and decisions.
    refresh();
  }
}
