"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { runAgent } from "./actions";
import type { AgentFormState } from "./state";

/** Keep in sync with MAX_REQUEST_LENGTH in src/agent/agent.ts. */
const MAX_REQUEST_LENGTH = 500;

const EXAMPLE = "We are out of printer paper and sticky notes, restock for the month.";

/** Ask the agent to restock (US3). */
export function AgentForm() {
  const [state, formAction, pending] = useActionState<AgentFormState, FormData>(runAgent, {
    kind: "idle",
    request: "",
  });

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="agent-request" className="font-medium">
          What should the agent buy?
        </label>
        <textarea
          // A new key after every answer keeps the text the user sent.
          key={`${state.kind}:${state.request}`}
          id="agent-request"
          name="request"
          required
          rows={3}
          maxLength={MAX_REQUEST_LENGTH}
          defaultValue={state.request}
          placeholder={EXAMPLE}
          className="rounded-lg border border-zinc-400 bg-transparent p-3 text-base leading-6 sm:text-sm dark:border-zinc-600"
        />
        <div>
          <SubmitButton
            pending={pending}
            className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "The agent is shopping…" : "Ask the agent"}
          </SubmitButton>
        </div>
      </form>

      <div aria-live="polite">
        {!pending && state.kind === "error" && (
          <p role="alert" className="rounded-lg border border-red-300 p-4 text-sm text-red-800 dark:border-red-800 dark:text-red-300">
            {state.message}
          </p>
        )}
        {!pending && state.kind === "done" && (
          <div className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            <p className="font-medium">The agent says:</p>
            {/* Model text, rendered as plain text (React escapes it). */}
            <p className="mt-1 whitespace-pre-line">{state.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
