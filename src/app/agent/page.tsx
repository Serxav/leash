import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getMandateView } from "@/payments/mandate";
import { listProposals, type ProposalView } from "@/purchases/propose";
import { describeRules } from "@/rules/describe";
import { getActivePolicy } from "@/rules/policies";
import { AgentForm } from "./agent-form";

export const metadata: Metadata = {
  title: "Shopping agent – Leash",
};

const OUTCOME_LABELS: Record<ProposalView["outcome"], string> = {
  APPROVE: "Approved",
  NEEDS_APPROVAL: "Needs your approval",
  BLOCK: "Blocked",
};

const PAYMENT_LABELS: Record<string, string> = {
  COMPLETED: "charged with PayPal (sandbox)",
  PENDING: "payment pending at PayPal",
  DECLINED: "payment declined",
  FAILED: "payment failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partly refunded",
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
          anything. Products come from Channel3 (real offers) and a small Leash demo catalog with
          invented shops; either way the payee is the Leash demo store.
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
                  {proposal.merchantDomain}
                  {proposal.unitPrice && <> · €{proposal.unitPrice} each</>}
                  {proposal.orderTotal && <> · total €{proposal.orderTotal}</>}
                  {" · "}
                  {dateTime.format(proposal.createdAt)}
                </p>
                <p className="mt-2">
                  <strong>{OUTCOME_LABELS[proposal.outcome]}</strong>
                  {proposal.paymentStatus && <> · {PAYMENT_LABELS[proposal.paymentStatus] ?? proposal.paymentStatus}</>}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">{proposal.explanation}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Agent&apos;s reason: {proposal.agentReason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
