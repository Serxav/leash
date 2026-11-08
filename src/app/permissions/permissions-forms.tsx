"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton, useFocusOnAnswer } from "@/components/submit-button";
import { connectPayPal, updatePermissions } from "./actions";
import type { PermissionsFormState } from "./state";

export type PermissionsView = {
  agentPaused: boolean;
  /** "Connected", "Not connected", "Revoked": the short state. */
  mandateLabel: string;
  paypalConnected: boolean;
  /** "Connected since …", as a sentence. */
  mandateText: string;
  canRevoke: boolean;
  /** Not connected (or revoked and deleted at PayPal): show "Connect PayPal". */
  canConnect: boolean;
  /** Revoked, but PayPal has not deleted the saved token yet. */
  deletionPending: boolean;
  /** The answer after PayPal sent the payer back, if any. */
  paypalNotice?: { ok: boolean; text: string };
};

const buttonClass = "btn btn-secondary shrink-0";

/** A green or grey dot with a short state, like iOS Settings. */
function State({ on, children }: { on: boolean; children: string }) {
  return (
    <span className="chip gap-1.5 font-medium">
      <span aria-hidden="true" className={`size-2 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-400"}`} />
      {children}
    </span>
  );
}

/** One group: a small heading over a card, the way iOS Settings groups rows. */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-1 text-sm font-medium text-muted">
        {title}
      </h2>
      <div className="card flex flex-col gap-3 p-4 text-sm">{children}</div>
    </section>
  );
}

/** The agent switch, the PayPal mandate, the demo reset and account deletion. */
export function PermissionsForms({ view }: { view: PermissionsView }) {
  const [state, formAction, pending] = useActionState<PermissionsFormState, FormData>(updatePermissions, {
    kind: "idle",
  });
  const answerRef = useFocusOnAnswer(state, !pending && state.kind === "answered");

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        {pending && (
          <p role="status" className="card rise-in p-4 text-sm">
            Saving…
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

      <Group id="agent-heading" title="Shopping agent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <State on={!view.agentPaused}>{view.agentPaused ? "Rex is paused" : "Rex is active"}</State>
          <form action={formAction}>
            <input type="hidden" name="action" value={view.agentPaused ? "resume" : "pause"} />
            <SubmitButton pending={pending} className={buttonClass}>
              {view.agentPaused ? "Resume Rex" : "Pause Rex"}
            </SubmitButton>
          </form>
        </div>
        <p className="text-muted">
          {view.agentPaused
            ? "Leash blocks every purchase, including approvals in your inbox, until you resume Rex."
            : "Rex can propose purchases, and Leash decides each one with your rules."}
        </p>
      </Group>

      <Group id="mandate-heading" title="PayPal (sandbox)">
        {view.paypalNotice && (
          <p
            role={view.paypalNotice.ok ? "status" : "alert"}
            className={`card-muted rise-in px-3.5 py-3 ${view.paypalNotice.ok ? "" : "text-danger"}`}
          >
            {view.paypalNotice.text}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <State on={view.paypalConnected}>{view.mandateLabel}</State>
          {view.canConnect && (
            <form action={connectPayPal}>
              <button type="submit" className="btn btn-primary shrink-0">
                Connect PayPal
              </button>
            </form>
          )}
          {(view.canRevoke || view.deletionPending) && (
            <form action={formAction}>
              <input type="hidden" name="action" value="revoke" />
              <SubmitButton pending={pending} className={buttonClass}>
                {view.deletionPending ? "Try deleting it at PayPal again" : "Disconnect"}
              </SubmitButton>
            </form>
          )}
        </div>
        <p className="text-muted">{view.mandateText}</p>
        {view.canConnect && (
          <p className="text-muted">
            You approve on PayPal&apos;s sandbox page, with the sandbox buyer account from the README. No real money
            moves.
          </p>
        )}
        {(view.canRevoke || view.deletionPending) && (
          <p className="text-muted">
            {view.deletionPending
              ? "Leash no longer charges it, but PayPal has not deleted your saved PayPal yet."
              : "Disconnecting revokes the mandate: every charge stops at once and your saved PayPal is deleted at PayPal. Purchases already charged stay in your history."}
          </p>
        )}
      </Group>

      <Group id="reset-heading" title="Demo">
        <form action={formAction} className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">Reset the demo</p>
          <input type="hidden" name="action" value="reset" />
          <SubmitButton pending={pending} className={buttonClass}>
            Reset demo
          </SubmitButton>
        </form>
        <p className="text-muted">
          Starts again from Marta&apos;s sample rules, with no purchases and PayPal not connected. Your saved PayPal is
          deleted at PayPal first.
        </p>
      </Group>

      <Group id="delete-heading" title="Your data">
        <form action={formAction} className="flex flex-col gap-3">
          <p className="font-medium">Delete my account and data</p>
          <p className="text-muted">
            Deletes your rules, Rex&apos;s proposals and decisions, your payments history, the security log and your
            saved PayPal (deleted at PayPal first). PayPal keeps its own records of past payments. This cannot be
            undone.
          </p>
          <input type="hidden" name="action" value="delete" />
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-5 shrink-0" />
            <span>I understand that this deletes everything Leash stores about me.</span>
          </label>
          <div>
            <SubmitButton pending={pending} className="btn btn-danger">
              Delete my account and data
            </SubmitButton>
          </div>
        </form>
      </Group>
    </div>
  );
}
