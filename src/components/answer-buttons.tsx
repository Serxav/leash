"use client";

import { useActionState } from "react";
import { answerPurchase } from "@/app/inbox/actions";
import type { InboxFormState } from "@/app/inbox/state";
import { SubmitButton, useFocusOnAnswer } from "./submit-button";

/**
 * Approve or reject a waiting purchase right on its card, like Muse's
 * Allow and Deny (D-042). Same server action as the inbox (US5): Leash
 * checks the price and the rules again before PayPal charges anything.
 */
export function AnswerButtons({
  intentId,
  title,
  orderTotal,
  onAnswered,
}: {
  intentId: string;
  title: string;
  orderTotal: string | null;
  /** Lets the chat update Rex once the user approved or rejected. */
  onAnswered?: (approved: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<InboxFormState, FormData>(
    async (previous, formData) => {
      const answer = await answerPurchase(previous, formData);
      if (answer.kind === "answered" && answer.ok) onAnswered?.(formData.get("choice") === "APPROVE");
      return answer;
    },
    { kind: "idle" },
  );
  const answered = !pending && state.kind === "answered";
  const answerRef = useFocusOnAnswer(state, answered);

  if (answered) {
    return (
      <p
        ref={answerRef}
        tabIndex={-1}
        role={state.ok ? "status" : "alert"}
        className={`text-sm font-medium ${state.ok ? "" : "text-danger"}`}
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="intentId" value={intentId} />
      <SubmitButton
        name="choice"
        value="APPROVE"
        pending={pending}
        aria-label={`Approve and pay €${orderTotal ?? ""} for ${title}`}
        className="btn btn-primary"
      >
        Approve €{orderTotal ?? ""}
      </SubmitButton>
      <SubmitButton name="choice" value="REJECT" pending={pending} aria-label={`Reject ${title}`} className="btn btn-secondary">
        Reject
      </SubmitButton>
      {pending && (
        <p role="status" className="text-xs text-muted">
          Leash checks the price and your rules again…
        </p>
      )}
    </form>
  );
}
