"use client";

import { useActionState } from "react";
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

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            Saving your answer… Leash checks the price and your rules again first.
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

      {items.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing is waiting for you.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.intentId} className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
              {/* Shop and agent text, rendered as plain text (React escapes it). */}
              <p className="font-medium">
                {item.quantity} × {item.title}
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                {item.sourceLabel} · {item.merchantDomain}
                {item.unitPrice && <> · €{item.unitPrice} each</>} · {item.proposedAt}
              </p>
              <p className="mt-2">{item.explanation}</p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Agent&apos;s reason: {item.agentReason}
              </p>
              <form action={formAction} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="intentId" value={item.intentId} />
                <button
                  type="submit"
                  name="choice"
                  value="APPROVE"
                  disabled={pending}
                  aria-label={`Approve and pay €${item.orderTotal ?? ""} for ${item.title}`}
                  className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Approve and pay €{item.orderTotal ?? ""}
                </button>
                <button
                  type="submit"
                  name="choice"
                  value="REJECT"
                  disabled={pending}
                  aria-label={`Reject ${item.title}`}
                  className="rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Reject
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
