import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getMandateView } from "@/payments/mandate";
import { listProposals } from "@/purchases/propose";
import { describeRules } from "@/rules/describe";
import { getActivePolicy } from "@/rules/policies";
import { listSecurityEvents, type SecurityEventView } from "@/security/events";
import { describeSignals } from "@/security/untrusted-text";
import { outcomeLabel, PAYMENT_LABELS, SOURCE_LABELS } from "../labels";
import { AgentForm } from "./agent-form";

export const metadata: Metadata = {
  title: "Shopping agent – Leash",
};

const STAGE_LABELS: Record<SecurityEventView["stage"], string> = {
  SEARCH: "Hidden from the agent",
  PROPOSAL: "Proposal blocked",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

export default function AgentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          Leash
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Shopping agent</h1>
        <p
          role="note"
          className="rounded-lg border border-zinc-300 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Purchases here are proposed by an AI agent. The agent cannot pay: Leash&apos;s code
          checks every proposal against your confirmed rules before PayPal (sandbox) charges
          anything. Products come from Channel3 (real offers, searched only inside your allowed
          categories and price limit) and a small Leash demo catalog with invented shops; either
          way the payee is the Leash demo store.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
        <AgentState />
      </Suspense>
    </main>
  );
}

async function AgentState() {
  await connection(); // reads the database: always render at request time
  const db = getDb();
  const policy = getActivePolicy(db, DEMO_USER_ID);
  const mandate = getMandateView(db, DEMO_USER_ID);
  const proposals = listProposals(db, DEMO_USER_ID);
  const securityLog = listSecurityEvents(db, DEMO_USER_ID, 10);

  return (
    <>
      <section aria-labelledby="rules-heading" className="flex flex-col gap-2">
        <h2 id="rules-heading" className="text-base font-semibold">
          Your rules
        </h2>
        {policy ? (
          <ul aria-label="Rules in use" className="flex flex-wrap gap-2">
            {describeRules(policy.rules).map((tag) => (
              <li key={tag.id} className="rounded-full border border-zinc-400 px-3 py-1 text-xs dark:border-zinc-600">
                {tag.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">
            No rules yet. <Link href="/rules" className="underline">Write and confirm your rules</Link> first.
          </p>
        )}
        {mandate.status !== "ACTIVE" && (
          <p className="text-sm text-red-800 dark:text-red-300">
            PayPal is not connected, so Leash cannot pay. Connect it in the payments lab first.
          </p>
        )}
      </section>

      <section
        aria-labelledby="ask-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700"
      >
        <h2 id="ask-heading" className="text-xl font-semibold">
          Ask the agent
        </h2>
        <AgentForm />
      </section>

      <section aria-labelledby="proposals-heading" className="flex flex-col gap-3">
        <h2 id="proposals-heading" className="text-xl font-semibold">
          Latest proposals
        </h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No proposals yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {proposals.map((proposal) => (
              <li key={proposal.intentId} className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                <p className="font-medium">
                  {proposal.quantity} × {proposal.productTitle ?? "Unknown product"}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  {SOURCE_LABELS[proposal.source]} · {proposal.merchantDomain}
                  {proposal.unitPrice && <> · €{proposal.unitPrice} each</>}
                  {proposal.orderTotal && <> · total €{proposal.orderTotal}</>}
                  {" · "}
                  {dateTime.format(proposal.createdAt)}
                </p>
                <p className="mt-2">
                  <strong>{outcomeLabel(proposal)}</strong>
                  {proposal.paymentStatus && <> · {PAYMENT_LABELS[proposal.paymentStatus] ?? proposal.paymentStatus}</>}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">{proposal.explanation}</p>
                {proposal.outcome === "NEEDS_APPROVAL" && !proposal.paymentStatus && (
                  <p className="mt-1">
                    <Link href="/inbox" className="underline">
                      Approve or reject it in your inbox
                    </Link>
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Agent&apos;s reason: {proposal.agentReason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="security-heading" className="flex flex-col gap-3">
        <h2 id="security-heading" className="text-xl font-semibold">
          Security log
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Products whose shop text tried to give orders to the AI. Leash&apos;s code hides them from
          the agent and never buys them, whatever your rules say.
        </p>
        {securityLog.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing suspicious so far.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {securityLog.map((event) => (
              <li key={event.id} className="rounded-lg border border-red-300 p-4 text-sm dark:border-red-800">
                <p>
                  <strong>{STAGE_LABELS[event.stage]}</strong>
                  {" · "}
                  {dateTime.format(event.createdAt)}
                </p>
                {/* Shop text, rendered as plain text (React escapes it). */}
                <p className="font-medium">{event.productTitle}</p>
                {event.merchantDomain && (
                  <p className="text-zinc-700 dark:text-zinc-300">{event.merchantDomain}</p>
                )}
                {event.signals.length > 0 && (
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    Its text {describeSignals(event.signals)}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
