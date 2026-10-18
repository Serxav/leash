"use client";

import { useActionState } from "react";
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

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            Asking PayPal for the refund…
          </p>
        )}
        {!pending && state.kind === "answered" && (
          <p
            role={state.ok ? "status" : "alert"}
            className={
              state.ok
                ? "rounded-lg border border-emerald-300 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:text-emerald-200"
                : "rounded-lg border border-red-300 p-4 text-sm text-red-800 dark:border-red-800 dark:text-red-300"
            }
          >
            {state.message}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No purchases yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.intentId} className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
              {/* Shop and agent text, rendered as plain text (React escapes it). */}
              <p className="font-medium">{row.title}</p>
              <p className="text-zinc-700 dark:text-zinc-300">{row.details}</p>
              <p className="mt-2">
                <strong>{row.status}</strong>
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">{row.explanation}</p>
              {row.paypalReference && (
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  PayPal transaction ID: <span className="font-mono">{row.paypalReference}</span>
                </p>
              )}
              {row.returnWindow && <p className="mt-1">{row.returnWindow}</p>}
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Agent&apos;s reason: {row.agentReason}</p>
              {row.refundLabel && (
                <form action={formAction} className="mt-3">
                  <input type="hidden" name="intentId" value={row.intentId} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    {row.refundLabel}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
