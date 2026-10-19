"use client";

import { useActionState } from "react";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { updatePermissions } from "./actions";
import type { PermissionsFormState } from "./state";

export type PermissionsView = {
  agentPaused: boolean;
  /** "Connected on …", "Not connected", "Revoked", as text. */
  mandateText: string;
  canRevoke: boolean;
  /** Revoked, but PayPal has not deleted the saved token yet. */
  deletionPending: boolean;
};

const buttonClass =
  "rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800";

/** US7: the agent switch, the PayPal mandate and account deletion. */
export function PermissionsForms({ view }: { view: PermissionsView }) {
  const [state, formAction, pending] = useActionState<PermissionsFormState, FormData>(updatePermissions, {
    kind: "idle",
  });
  const answerRef = useFocusOnAnswer(state, !pending && state.kind === "answered");

  return (
    <div className="flex flex-col gap-8">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            Saving…
          </p>
        )}
        {!pending && state.kind === "answered" && (
          <p
            ref={answerRef}
            tabIndex={-1}
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

      <section aria-labelledby="agent-heading" className="flex flex-col gap-3">
        <h2 id="agent-heading" className="text-xl font-semibold">
          Shopping agent
        </h2>
        <p className="text-sm">
          The agent is <strong>{view.agentPaused ? "paused" : "active"}</strong>.{" "}
          {view.agentPaused
            ? "Leash blocks every purchase, including approvals in your inbox, until you resume it."
            : "It can propose purchases, and Leash decides each one with your rules."}
        </p>
        <form action={formAction}>
          <input type="hidden" name="action" value={view.agentPaused ? "resume" : "pause"} />
          <SubmitButton pending={pending} className={buttonClass}>
            {view.agentPaused ? "Resume the agent" : "Pause the agent"}
          </SubmitButton>
        </form>
      </section>

      <section aria-labelledby="mandate-heading" className="flex flex-col gap-3">
        <h2 id="mandate-heading" className="text-xl font-semibold">
          PayPal mandate
        </h2>
        <p className="text-sm">{view.mandateText}</p>
        {(view.canRevoke || view.deletionPending) && (
          <form action={formAction} className="flex flex-col gap-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {view.deletionPending
                ? "Leash no longer charges it, but PayPal has not deleted your saved PayPal yet."
                : "Revoking stops every charge at once and deletes your saved PayPal at PayPal. Purchases already charged stay in your history."}
            </p>
            <input type="hidden" name="action" value="revoke" />
            <div>
              <SubmitButton pending={pending} className={buttonClass}>
                {view.deletionPending ? "Try deleting it at PayPal again" : "Revoke the mandate"}
              </SubmitButton>
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="delete-heading" className="flex flex-col gap-3">
        <h2 id="delete-heading" className="text-xl font-semibold">
          Delete my account and data
        </h2>
        <form action={formAction} className="flex flex-col gap-3 text-sm">
          <p className="text-zinc-700 dark:text-zinc-300">
            Deletes your rules, the agent&apos;s proposals and decisions, your payments history, the
            security log and your saved PayPal (deleted at PayPal first). PayPal keeps its own records of
            past payments. This cannot be undone.
          </p>
          <input type="hidden" name="action" value="delete" />
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-5 shrink-0" />
            <span>I understand that this deletes everything Leash stores about me.</span>
          </label>
          <div>
            <SubmitButton
              pending={pending}
              className="rounded-full border border-red-400 px-5 py-3 text-sm font-medium text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete my account and data
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
