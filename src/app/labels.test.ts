import { describe, expect, it } from "vitest";
import type { ProposalView } from "@/purchases/propose";
import { proposalCard, reasonText } from "./labels";

describe("reason text on cards (D-042)", () => {
  it("drops the status word the badge already shows", () => {
    expect(reasonText("Needs your approval: €24.00 is above €15.00, the amount you asked to approve.")).toBe(
      "€24.00 is above €15.00, the amount you asked to approve.",
    );
    expect(reasonText("Blocked: you paused the agent.")).toBe("You paused the agent.");
    expect(reasonText("Approved: €6.90 is within all your spending rules.")).toBe(
      "€6.90 is within all your spending rules.",
    );
  });

  it("leaves other sentences as they are", () => {
    expect(reasonText("You rejected it, so Leash did not buy it.")).toBe(
      "You rejected it, so Leash did not buy it.",
    );
  });
});

describe("proposal cards (D-042)", () => {
  const view: ProposalView = {
    intentId: "i1",
    productTitle: "Toner",
    source: "local",
    merchantDomain: "office-supplies-demo.example",
    quantity: 1,
    unitPrice: "24.00",
    agentReason: "Low on toner.",
    createdAt: new Date("2026-10-19T18:30:00Z"),
    outcome: "NEEDS_APPROVAL",
    ruleIds: ["approval_threshold"],
    explanation: "Needs your approval: €24.00 is above €15.00, the amount you asked to approve.",
    decidedBy: "ENGINE",
    orderTotal: "24.00",
    paymentStatus: null,
  };

  it("says the status once and links a waiting proposal to the inbox", () => {
    expect(proposalCard(view)).toEqual({
      intentId: "i1",
      headline: "Approve this purchase?",
      title: "1 × Toner",
      details: "Demo shop · office-supplies-demo.example · €24.00 each · total €24.00 · 19 Oct 2026, 20:30",
      outcome: "NEEDS_APPROVAL",
      status: "Needs your approval",
      orderTotal: "24.00",
      reason: "€24.00 is above €15.00, the amount you asked to approve.",
      agentReason: "Low on toner.",
      needsAnswer: true,
    });
  });

  it("adds the payment to the status of a charged purchase", () => {
    const card = proposalCard({ ...view, outcome: "APPROVE", decidedBy: "USER", paymentStatus: "COMPLETED" });
    expect(card.status).toBe("Approved by you · charged with PayPal (sandbox)");
    expect(card.headline).toBe("You approved this purchase");
    expect(card.needsAnswer).toBe(false);
  });

  it("asks a question only while Leash waits for the user", () => {
    expect(proposalCard({ ...view, outcome: "BLOCK" }).headline).toBe("Leash blocked this purchase");
    expect(proposalCard({ ...view, outcome: "BLOCK", decidedBy: "USER" }).headline).toBe("You rejected this purchase");
    expect(proposalCard({ ...view, outcome: "APPROVE" }).headline).toBe("Leash approved this purchase");
  });
});
