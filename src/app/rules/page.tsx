import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { describeRules } from "@/rules/describe";
import { getActivePolicy, listPolicyVersions } from "@/rules/policies";
import { RulesForm } from "./rules-form";

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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-block py-1 text-sm text-zinc-600 underline dark:text-zinc-400">
          Leash
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Your spending rules</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Write your rules in plain language. An AI turns them into exact rules, and you
          check and confirm them. Then code, not the AI, applies them to every purchase.
        </p>
      </header>

      {/* Static shell above; request-time data streams in below (Cache Components). */}
      <Suspense fallback={<p className="text-sm text-zinc-600">Loading your rules…</p>}>
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
  await connection(); // reads the database: always render at request time
  const status = first((await searchParams).status);
  const message = status && Object.hasOwn(STATUS_MESSAGES, status) ? STATUS_MESSAGES[status] : null;
  const db = getDb();
  const active = getActivePolicy(db, DEMO_USER_ID);
  const versions = listPolicyVersions(db, DEMO_USER_ID);

  return (
    <>
      {message && (
        <p
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            message.error
              ? "border-red-300 text-red-800 dark:border-red-800 dark:text-red-300"
              : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          }`}
        >
          {message.text}
        </p>
      )}

      <section
        aria-labelledby="active-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700"
      >
        <h2 id="active-heading" className="text-xl font-semibold">
          Rules in use
        </h2>
        {active ? (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Version {active.version} · confirmed {dateTime.format(active.confirmedAt)}
            </p>
            <ul aria-label="Rules in use" className="flex flex-wrap gap-2">
              {describeRules(active.rules).map((tag) => (
                <li
                  key={tag.id}
                  className="rounded-full border border-zinc-400 px-3 py-1 text-sm dark:border-zinc-600"
                >
                  {tag.text}
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              You wrote: “{active.sourceText}”
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            No rules yet. Leash buys nothing until you confirm your rules.
          </p>
        )}
      </section>

      <section
        aria-labelledby="write-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700"
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
          <ul className="text-sm text-zinc-700 dark:text-zinc-300">
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
