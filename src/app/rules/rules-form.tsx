"use client";

import { useActionState, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { MAX_RULES_TEXT_LENGTH } from "@/rules/limits";
import { confirmRules, proposeRules } from "./actions";
import { RuleList } from "./rule-list";
import type { RulesFormState } from "./state";

/**
 * What good rules say, in the order Leash checks them. Each tip adds an
 * example sentence the user then edits (D-042). Shops are optional.
 */
const TIPS = [
  { title: "Most per order", hint: "A bigger order is always blocked.", phrase: "Max €40 per order." },
  { title: "Most per month", hint: "Counts every charged order this month.", phrase: "Max €150 per month." },
  {
    title: "When to ask you",
    hint: "Above this amount, purchases wait in your inbox. Or say “never ask me”.",
    phrase: "Ask me before anything over €15.",
  },
  {
    title: "What it may buy",
    hint: "Simple product types, like office supplies, stationery or cleaning supplies.",
    phrase: "Only office supplies.",
  },
  { title: "Units of one item", hint: "The most of the same product in one order.", phrase: "At most 5 units of the same item." },
  {
    title: "Shops to avoid",
    hint: "Write the shop's web address.",
    phrase: "Never buy from marketplace-x.example.",
    optional: true,
  },
] as const;

const EXAMPLES = [
  {
    name: "Marta, office manager",
    text: "Max €40 per order, €150 per month, only office supplies, ask me before anything over €15, at most 5 units of the same item, never buy from marketplace-x.example",
  },
  {
    name: "Careful start",
    text: "Max €20 per order and €60 per month. Only stationery. Ask me before anything over €10. At most 3 units of the same item.",
  },
] as const;

/** Write rules → see questions or the exact rules → confirm (US2). */
export function RulesForm({ initialText }: { initialText: string }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState<RulesFormState, FormData>(proposeRules, {
    kind: "idle",
    text: initialText,
  });

  const write = (text: string, replace: boolean) => {
    const input = inputRef.current;
    if (!input) return;
    const current = input.value.trim();
    input.value = replace || current === "" ? text : `${current}${/[.,]$/.test(current) ? "" : "."} ${text}`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="tips-heading" className="flex flex-col gap-3">
        <h3 id="tips-heading" className="text-sm font-semibold">
          What to include
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TIPS.map((tip, index) => (
            <li key={tip.title} className="card-muted flex items-start gap-3 p-3">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-xs font-semibold text-accent"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-medium">
                  {tip.title}
                  {"optional" in tip && <span className="font-normal text-muted"> · optional</span>}
                </p>
                <p className="text-xs leading-5 text-muted">{tip.hint}</p>
                <button
                  type="button"
                  onClick={() => write(tip.phrase, false)}
                  aria-label={`Add “${tip.phrase}” to your rules`}
                  className="self-start rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs text-accent shadow-sm"
                >
                  + {tip.phrase}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="rules-text" className="text-sm font-semibold">
          Your rules, in your own words
        </label>
        <textarea
          ref={inputRef}
          // A new key after every answer keeps the text the user sent.
          key={`${state.kind}:${state.text}`}
          id="rules-text"
          name="text"
          required
          rows={5}
          maxLength={MAX_RULES_TEXT_LENGTH}
          defaultValue={state.text}
          placeholder="For example: Max €40 per order, €150 per month, only office supplies…"
          aria-describedby="rules-text-help"
          className="field text-base leading-6 sm:text-sm"
        />
        <p id="rules-text-help" className="text-xs leading-5 text-muted">
          Amounts in euros. Keep them in order: “ask me first” ≤ each order ≤ each month. Leash
          asks you about anything missing or unclear before it changes a rule.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pending={pending} className="btn btn-primary">
            {pending ? "Reading your rules…" : "Check my rules"}
          </SubmitButton>
          {EXAMPLES.map((example) => (
            <button
              key={example.name}
              type="button"
              onClick={() => write(example.text, true)}
              className="btn btn-secondary"
            >
              Use example: {example.name}
            </button>
          ))}
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-4">
        {!pending && state.kind === "error" && (
          <p role="alert" className="card p-4 text-sm text-danger">
            {state.message}
          </p>
        )}

        {!pending && state.kind === "questions" && (
          <div className="card flex flex-col gap-3 p-4 text-sm">
            <p className="font-medium">Leash needs a bit more detail</p>
            <ul className="card-muted flex flex-col gap-2 px-4 py-3">
              {state.questions.map((question) => (
                <li key={question} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">
                    ?
                  </span>
                  {question}
                </li>
              ))}
            </ul>
            <p className="text-muted">Add your answers to your text above and check again.</p>
          </div>
        )}

        {!pending && state.kind === "draft" && (
          <div className="card flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <p className="font-medium">Is this right?</p>
              <p className="text-sm text-muted">
                This is exactly what Leash will check before every purchase. Nothing changes
                until you confirm.
              </p>
            </div>
            <RuleList tags={state.tags} label="Rules to confirm" />
            <form action={confirmRules} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="draftId" value={state.draftId} />
              <button type="submit" className="btn btn-primary">
                Confirm these rules
              </button>
              <span className="text-xs text-muted">Not right? Change your text above and check again.</span>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
