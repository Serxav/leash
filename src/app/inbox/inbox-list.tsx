"use client";

import { useActionState } from "react";
import type { ProposalCardData } from "@/app/labels";
import { EmptyState } from "@/components/page";
import { ProposalCard } from "@/components/proposal-card";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { answerPurchase } from "./actions";
import type { InboxFormState } from "./state";

/**
 * The pending purchases with one-tap Approve and Reject, on the same
 * cards as the chat. One form state for the whole list: an answered
 * purchase leaves the inbox, so its answer is shown above the list.
 */
export function InboxList({ cards }: { cards: ProposalCardData[] }) {
  const [state, formAction, pending] = useActionState<InboxFormState, FormData>(answerPurchase, {
    kind: "idle",
  });
  const answerRef = useFocusOnAnswer(state, !pending && state.kind === "answered");

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="card rise-in p-4 text-sm">
            Saving your answer… Leash checks the price and your rules again first.
          </p>
        )}
        {!pending && state.kind === "answered" && (
          <p
            ref={answerRef}
            tabIndex={-1}
            role={state.ok ? "status" : "alert"}
            className={`card rise-in p-4 text-sm ${state.ok ? "" : "text-danger"}`}
          >
            {state.message}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="Nothing is waiting for you"
          text="When Rex finds something above your “ask me first” amount, it waits here until you approve or reject it."
          action={{ href: "/agent", label: "Chat with Rex" }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li key={card.intentId}>
              {/* Shop and agent text, rendered as plain text (React escapes it). */}
              <ProposalCard
                card={card}
                actions={
                  <form action={formAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="intentId" value={card.intentId} />
                    <SubmitButton
                      name="choice"
                      value="APPROVE"
                      pending={pending}
                      aria-label={`Approve and pay €${card.orderTotal ?? ""} for ${card.title}`}
                      className="btn btn-primary"
                    >
                      Approve and pay €{card.orderTotal ?? ""}
                    </SubmitButton>
                    <SubmitButton
                      name="choice"
                      value="REJECT"
                      pending={pending}
                      aria-label={`Reject ${card.title}`}
                      className="btn btn-secondary"
                    >
                      Reject
                    </SubmitButton>
                  </form>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
