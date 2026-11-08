"use client";

import { useActionState } from "react";
import { EmptyState } from "@/components/page";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { refundPurchaseAction } from "./actions";
import type { HistoryFormState } from "./state";

/** How a purchase ended, for its coloured mark. The words always say it too. */
export type HistoryTone = "paid" | "waiting" | "stopped" | "refunded";

/** One purchase, as text for the UI. */
export type HistoryRow = {
  intentId: string;
  tone: HistoryTone;
  title: string;
  /** "€24.00", or null when the price is unknown. */
  amount: string | null;
  details: string;
  status: string;
  explanation: string;
  agentReason: string;
  /** PayPal's transaction ID, shown to the user only. */
  paypalReference: string | null;
  returnWindow: string | null;
  refundLabel: string | null;
};

const MARKS: Record<HistoryTone, { symbol: string; className: string }> = {
  paid: { symbol: "✓", className: "bg-emerald-600 text-white" },
  waiting: { symbol: "?", className: "bg-amber-500 text-zinc-950" },
  stopped: { symbol: "✕", className: "bg-red-600 text-white" },
  refunded: { symbol: "↩", className: "bg-zinc-500 text-white" },
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
          <p role="status" className="card rise-in p-4 text-sm">
            Asking PayPal for the refund…
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

      {rows.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          text="Tell Rex what you need. Every purchase it proposes shows up here, with what Leash decided and why."
          action={{ href: "/agent", label: "Chat with Rex" }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const mark = MARKS[row.tone];
            return (
              <li key={row.intentId} className="card rise-in flex flex-col gap-3 p-4 text-sm">
                {/* Shop and agent text, rendered as plain text (React escapes it). */}
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${mark.className}`}
                  >
                    {mark.symbol}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3 className="font-medium">{row.title}</h3>
                    <p className="text-xs text-muted">{row.details}</p>
                  </div>
                  {row.amount && <p className="shrink-0 font-semibold tabular-nums">{row.amount}</p>}
                </div>
                <div className="card-muted flex flex-col gap-1 px-3.5 py-3">
                  <p className="font-medium">{row.status}</p>
                  <p className="text-muted">{row.explanation}</p>
                  {row.returnWindow && <p className="mt-1">{row.returnWindow}</p>}
                  {row.paypalReference && (
                    <p className="mt-1 text-xs text-muted">
                      PayPal transaction ID: <span className="font-mono">{row.paypalReference}</span>
                    </p>
                  )}
                  <details className="group mt-1">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted [&::-webkit-details-marker]:hidden">
                      Agent&apos;s reason
                      <svg
                        viewBox="0 0 12 12"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                        className="transition-transform group-open:rotate-180"
                      >
                        <path d="M3 4.5 6 7.5l3-3" />
                      </svg>
                    </summary>
                    <p className="mt-1 text-xs">{row.agentReason}</p>
                  </details>
                </div>
                {row.refundLabel && (
                  <form action={formAction}>
                    <input type="hidden" name="intentId" value={row.intentId} />
                    <SubmitButton pending={pending} className="btn btn-secondary">
                      {row.refundLabel}
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
