import type { ProposalView } from "@/purchases/propose";

/** Where a proposed product came from (D-035). */
export const SOURCE_LABELS: Record<ProposalView["source"], string> = {
  channel3: "Channel3 offer",
  local: "Demo shop",
};

export const OUTCOME_LABELS: Record<ProposalView["outcome"], string> = {
  APPROVE: "Approved",
  NEEDS_APPROVAL: "Needs your approval",
  BLOCK: "Blocked",
};

/** The outcome, saying when it was the user's own answer (D-036). */
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
