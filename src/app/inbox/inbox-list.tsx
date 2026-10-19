"use client";

import { useActionState } from "react";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { answerPurchase } from "./actions";
import type { InboxFormState } from "./state";

/** One pending purchase, as text for the UI. No PayPal IDs. */
export type PendingItem = {
  intentId: string;
  title: string;
  sourceLabel: string;
  merchantDomain: string;
  quantity: number;
  unitPrice: string | null;
  orderTotal: string | null;
  explanation: string;
  agentReason: string;
  proposedAt: string;
};

/** The pending purchases with one-tap Approve and Reject (US5). */
export function InboxList({ items }: { items: PendingItem[] }) {
  const [state, formAction, pending] = useActionState<InboxFormState, FormData>(answerPurchase, {
    kind: "idle",
  });
  const answerRef = useFocusOnAnswer(state, !pending && state.kind === "answered");

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="card p-4 text-sm">
            Saving your answer… Leash checks the price and your rules again first.
          </p>
        )}
        {!pending && state.kind === "answered" && (
          <p
            ref={answerRef}
            tabIndex={-1}
            role={state.ok ? "status" : "alert"}
            className={
              state.ok
                ? "card p-4 text-sm"
                : "card p-4 text-sm text-danger"
            }
          >
            {state.message}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing is waiting for you.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.intentId} className="card p-4 text-sm">
              {/* Shop and agent text, rendered as plain text (React escapes it). */}
              <p className="font-medium">
                {item.quantity} × {item.title}
              </p>
              <p className="text-muted">
                {item.sourceLabel} · {item.merchantDomain}
                {item.unitPrice && <> · €{item.unitPrice} each</>} · {item.proposedAt}
              </p>
              <p className="mt-2">{item.explanation}</p>
              <p className="mt-1 text-xs text-muted">
                Agent&apos;s reason: {item.agentReason}
              </p>
              <form action={formAction} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="intentId" value={item.intentId} />
                <SubmitButton
                  name="choice"
                  value="APPROVE"
                  pending={pending}
                  aria-label={`Approve and pay €${item.orderTotal ?? ""} for ${item.title}`}
                  className="btn btn-primary"
                >
                  Approve and pay €{item.orderTotal ?? ""}
                </SubmitButton>
                <SubmitButton
                  name="choice"
                  value="REJECT"
                  pending={pending}
                  aria-label={`Reject ${item.title}`}
                  className="btn btn-secondary"
                >
                  Reject
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
