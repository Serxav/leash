import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { describeRules } from "@/rules/describe";
import { getActivePolicy, listPolicyVersions } from "@/rules/policies";
import { RuleList } from "./rule-list";
import { RulesForm } from "./rules-form";

/** The three steps, so nobody wonders what happens to their words. */
const STEPS = [
  { title: "Write", text: "Say in your own words what Pip may buy, and how much." },
  { title: "Check", text: "An AI turns your words into exact rules. You read them." },
  { title: "Confirm", text: "From then on, code, not the AI, checks every purchase with them." },
] as const;

export const metadata: Metadata = {
  title: "Spending rules – Leash",
};

const STATUS_MESSAGES: Record<string, { text: string; error?: boolean }> = {
  confirmed: { text: "Rules confirmed. Leash uses them from now on." },
  expired: {
    text: "Those rules were no longer waiting for confirmation. Nothing changed. Please write them again.",
    error: true,
  },
  error: { text: "Something went wrong. Your rules were not changed.", error: true },
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function RulesPage({ searchParams }: PageProps<"/rules">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Spending rules</h1>
        <p className="text-muted">
          Your rules are Pip&apos;s leash: they decide what the AI shopping agent may buy, how much
          and when it must ask you first.
        </p>
      </header>

      <ol
        aria-label="How it works"
        className="card grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3 p-4 sm:flex-col sm:gap-1">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent-fill)] text-xs font-semibold text-white"
            >
              {index + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{step.title}</span>
              <span className="text-sm leading-5 text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* Static shell above; request-time data streams in below (Cache Components). */}
      <Suspense fallback={<p className="text-sm text-muted">Loading your rules…</p>}>
        <RulesState searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RulesState({
  searchParams,
}: {
  searchParams: PageProps<"/rules">["searchParams"];
}) {
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const status = first((await searchParams).status);
  const message = status && Object.hasOwn(STATUS_MESSAGES, status) ? STATUS_MESSAGES[status] : null;
  const db = getDb();
  const active = getActivePolicy(db, userId);
  const versions = listPolicyVersions(db, userId);

  return (
    <>
      {message && (
        <p
          role="status"
          className={`card p-4 text-sm ${message.error ? "text-danger" : ""}`}
        >
          {message.text}
        </p>
      )}

      <section
        aria-labelledby="active-heading"
        className="card flex flex-col gap-4 p-5 sm:p-6"
      >
        <h2 id="active-heading" className="text-xl font-semibold">
          Rules in use
        </h2>
        {active ? (
          <>
            <p className="text-sm text-muted">
              Version {active.version} · confirmed {dateTime.format(active.confirmedAt)}
            </p>
            <RuleList tags={describeRules(active.rules)} label="Rules in use" />
            <p className="text-xs leading-5 text-muted">You wrote: “{active.sourceText}”</p>
          </>
        ) : (
          <p className="card-muted px-4 py-3 text-sm text-muted">
            No rules yet. Leash buys nothing until you confirm your rules.
          </p>
        )}
      </section>

      <section
        aria-labelledby="write-heading"
        className="card flex flex-col gap-4 p-5 sm:p-6"
      >
        <h2 id="write-heading" className="text-xl font-semibold">
          {active ? "Change your rules" : "Write your rules"}
        </h2>
        {/* A new key after each confirmation clears the confirmed draft. */}
        <RulesForm key={active?.version ?? 0} initialText={active?.sourceText ?? ""} />
      </section>

      {versions.length > 1 && (
        <section aria-labelledby="versions-heading" className="flex flex-col gap-2">
          <h2 id="versions-heading" className="text-base font-semibold">
            Earlier versions
          </h2>
          <ul className="text-sm text-muted">
            {versions.slice(1).map((version) => (
              <li key={version.version}>
                Version {version.version} · confirmed {dateTime.format(version.confirmedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
