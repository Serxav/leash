"use client";

import { useActionState } from "react";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { refundPurchaseAction } from "./actions";
import type { HistoryFormState } from "./state";

/** One purchase, as text for the UI. */
export type HistoryRow = {
  intentId: string;
  title: string;
  details: string;
  status: string;
  explanation: string;
  agentReason: string;
  /** PayPal's transaction ID, shown to the user only. */
  paypalReference: string | null;
  returnWindow: string | null;
  refundLabel: string | null;
};

/** The purchase history with a refund button inside the return window (US6). */
export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const [state, formAction, pending] = useActionState<HistoryFormState, FormData>(refundPurchaseAction, {
    kind: "idle",
  });
  const answerRef = useFocusOnAnswer(state, !pending && state.kind === "answered");

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="card p-4 text-sm">
            Asking PayPal for the refund…
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No purchases yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.intentId} className="card p-4 text-sm">
              {/* Shop and agent text, rendered as plain text (React escapes it). */}
              <p className="font-medium">{row.title}</p>
              <p className="text-muted">{row.details}</p>
              <p className="mt-2">
                <strong>{row.status}</strong>
              </p>
              <p className="text-muted">{row.explanation}</p>
              {row.paypalReference && (
                <p className="mt-1 text-muted">
                  PayPal transaction ID: <span className="font-mono">{row.paypalReference}</span>
                </p>
              )}
              {row.returnWindow && <p className="mt-1">{row.returnWindow}</p>}
              <p className="mt-1 text-xs text-muted">Agent&apos;s reason: {row.agentReason}</p>
              {row.refundLabel && (
                <form action={formAction} className="mt-3">
                  <input type="hidden" name="intentId" value={row.intentId} />
                  <SubmitButton
                    pending={pending}
                    className="btn btn-secondary"
                  >
                    {row.refundLabel}
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
