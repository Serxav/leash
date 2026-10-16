"use client";

import { useActionState } from "react";
import { MAX_RULES_TEXT_LENGTH } from "@/rules/limits";
import { confirmRules, proposeRules } from "./actions";
import type { RulesFormState } from "./state";

const EXAMPLE =
  "Max 40 € per order, 150 € per month, only office supplies, ask me before anything over 15 €, max 5 units of the same item, never buy from marketplace-x.example";

const primaryButton =
  "rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

/** Write rules → see questions or readable tags → confirm (US2). */
export function RulesForm({ initialText }: { initialText: string }) {
  const [state, formAction, pending] = useActionState<RulesFormState, FormData>(proposeRules, {
    kind: "idle",
    text: initialText,
  });

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="rules-text" className="font-medium">
          Your rules, in your own words
        </label>
        <textarea
          // A new key after every answer keeps the text the user sent.
          key={`${state.kind}:${state.text}`}
          id="rules-text"
          name="text"
          required
          rows={5}
          maxLength={MAX_RULES_TEXT_LENGTH}
          defaultValue={state.text}
          placeholder={EXAMPLE}
          aria-describedby="rules-text-help"
          className="rounded-lg border border-zinc-400 bg-transparent p-3 text-sm leading-6 dark:border-zinc-600"
        />
        <p id="rules-text-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          Amounts in euros. Say how much per order and per month, what kind of products,
          when to ask you, how many units of the same item and any shops to avoid.
        </p>
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Reading your rules…" : "Turn into exact rules"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-4">
        {!pending && state.kind === "error" && (
          <p role="alert" className="rounded-lg border border-red-300 p-4 text-sm text-red-800 dark:border-red-800 dark:text-red-300">
            {state.message}
          </p>
        )}

        {!pending && state.kind === "questions" && (
          <div className="rounded-lg border border-amber-400 p-4 text-sm dark:border-amber-700">
            <p className="font-medium">Leash needs a bit more detail:</p>
            <ul className="mt-2 list-disc pl-5">
              {state.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              Add your answers to your text and try again.
            </p>
          </div>
        )}

        {!pending && state.kind === "draft" && (
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <p className="text-sm font-medium">
              Check your rules. Nothing applies until you confirm them.
            </p>
            <ul aria-label="Rules to confirm" className="flex flex-wrap gap-2">
              {state.tags.map((tag) => (
                <li
                  key={tag.id}
                  className="rounded-full border border-zinc-400 px-3 py-1 text-sm dark:border-zinc-600"
                >
                  {tag.text}
                </li>
              ))}
            </ul>
            <form action={confirmRules}>
              <input type="hidden" name="draftId" value={state.draftId} />
              <button type="submit" className={primaryButton}>
                Confirm these rules
              </button>
            </form>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Not right? Change your text above and try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
