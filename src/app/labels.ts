import type { ProposalView } from "@/purchases/propose";

/** Where a proposed product came from. */
export const SOURCE_LABELS: Record<ProposalView["source"], string> = {
  channel3: "Channel3 offer",
  local: "Demo shop",
};

export const OUTCOME_LABELS: Record<ProposalView["outcome"], string> = {
  APPROVE: "Approved",
  NEEDS_APPROVAL: "Needs your approval",
  BLOCK: "Blocked",
};

/** The outcome, saying when it was the user's own answer. */
export function outcomeLabel(proposal: Pick<ProposalView, "outcome" | "decidedBy">): string {
  if (proposal.decidedBy === "USER") {
    return proposal.outcome === "APPROVE" ? "Approved by you" : "Rejected by you";
  }
  return OUTCOME_LABELS[proposal.outcome];
}

export const PAYMENT_LABELS: Record<string, string> = {
  COMPLETED: "charged with PayPal (sandbox)",
  PENDING: "payment pending at PayPal",
  DECLINED: "payment declined",
  FAILED: "payment failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partly refunded",
};

const LABEL_PREFIX = /^(Approved|Blocked|Needs your approval):\s+/;

/**
 * The engine's explanation without its leading status word, for cards that
 * already show the status as a badge ("Needs your approval: Needs your
 * approval…" read twice). Stored decisions keep the full sentence.
 */
export function reasonText(explanation: string): string {
  const rest = explanation.replace(LABEL_PREFIX, "");
  return rest === explanation ? explanation : rest.charAt(0).toUpperCase() + rest.slice(1);
}

export const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

/** One proposal card, as plain text for the agent page and its chat. */
export type ProposalCardData = {
  intentId: string;
  /** The card's question or result, like Muse's "Allow Muse to…?". */
  headline: string;
  title: string;
  details: string;
  outcome: ProposalView["outcome"];
  status: string;
  orderTotal: string | null;
  reason: string;
  agentReason: string;
  /** Waiting in the inbox: the card links there. */
  needsAnswer: boolean;
};

export function proposalCard(view: ProposalView): ProposalCardData {
  const payment = view.paymentStatus ? PAYMENT_LABELS[view.paymentStatus] ?? view.paymentStatus : null;
  return {
    intentId: view.intentId,
    headline: headline(view),
    title: `${view.quantity} × ${view.productTitle ?? "Unknown product"}`,
    details: [
      SOURCE_LABELS[view.source],
      view.merchantDomain,
      view.unitPrice && `€${view.unitPrice} each`,
      view.orderTotal && `total €${view.orderTotal}`,
      dateTime.format(view.createdAt),
    ]
      .filter(Boolean)
      .join(" · "),
    outcome: view.outcome,
    status: payment ? `${outcomeLabel(view)} · ${payment}` : outcomeLabel(view),
    orderTotal: view.orderTotal,
    reason: reasonText(view.explanation),
    agentReason: view.agentReason,
    needsAnswer: view.outcome === "NEEDS_APPROVAL" && view.paymentStatus === null,
  };
}

function headline(view: Pick<ProposalView, "outcome" | "decidedBy">): string {
  if (view.decidedBy === "USER") {
    return view.outcome === "APPROVE" ? "You approved this purchase" : "You rejected this purchase";
  }
  if (view.outcome === "APPROVE") return "Leash approved this purchase";
  if (view.outcome === "NEEDS_APPROVAL") return "Approve this purchase?";
  return "Leash blocked this purchase";
}
