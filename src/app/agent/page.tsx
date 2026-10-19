import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { isAgentPaused } from "@/account/settings";
import { currentUserId } from "@/account/visitor";
import { ProposalCard } from "@/components/proposal-card";
import { getDb } from "@/db/client";
import { getMandateView } from "@/payments/mandate";
import { listProposals } from "@/purchases/propose";
import { describeRules } from "@/rules/describe";
import { getActivePolicy } from "@/rules/policies";
import { listSecurityEvents, type SecurityEventView } from "@/security/events";
import { describeSignals } from "@/security/untrusted-text";
import { dateTime, proposalCard } from "../labels";
import { AgentChat } from "./agent-chat";

export const metadata: Metadata = {
  title: "Rex, shopping agent – Leash",
};

const STAGE_LABELS: Record<SecurityEventView["stage"], string> = {
  SEARCH: "Hidden from the agent",
  PROPOSAL: "Proposal blocked",
};

export default function AgentPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="p-6 text-center text-sm text-muted">Loading…</p>}>
        <AgentState />
      </Suspense>
    </main>
  );
}

async function AgentState() {
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const db = getDb();
  const policy = getActivePolicy(db, userId);
  const mandate = getMandateView(db, userId);
  const paused = isAgentPaused(db, userId);
  const proposals = listProposals(db, userId, 10);
  const securityLog = listSecurityEvents(db, userId, 10);

  // What stops the agent, as cards at the top of the chat.
  const notices = (
    <>
      {!policy && (
        <Notice title="No spending rules yet" href="/rules" action="Write your rules">
          Rex can only shop once you confirm your rules.
        </Notice>
      )}
      {paused && (
        <Notice title="You paused the agent" href="/permissions" action="Resume in Permissions">
          Leash blocks every purchase until you resume it.
        </Notice>
      )}
      {mandate.status !== "ACTIVE" && (
        <Notice title="Connect PayPal (sandbox)" href="/permissions" action="Connect in Permissions">
          PayPal is not connected, so Leash cannot pay approved purchases.
        </Notice>
      )}
    </>
  );

  const activity = (
    <>
      <section aria-labelledby="rules-heading" className="flex flex-col gap-2">
        <h2 id="rules-heading" className="text-sm font-semibold">
          Your rules
        </h2>
        {policy ? (
          <ul aria-label="Rules in use" className="flex flex-wrap gap-1.5">
            {describeRules(policy.rules).map((tag) => (
              <li key={tag.id} className="chip">
                {tag.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No rules yet.</p>
        )}
        <p className="text-sm">
          <Link href="/rules" className="text-accent">
            Change your rules
          </Link>
        </p>
      </section>

      <section aria-labelledby="about-heading" className="flex flex-col gap-1">
        <h2 id="about-heading" className="text-sm font-semibold">
          About Rex
        </h2>
        <p role="note" className="text-xs leading-5 text-muted">
          Purchases here are proposed by an AI agent. The agent cannot pay: Leash&apos;s code checks
          every proposal against your confirmed rules before PayPal (sandbox) charges anything.
          Products come from Channel3 (real offers, searched only inside your allowed categories and
          price limit) and a small Leash demo catalog with invented shops; either way the payee is
          the Leash demo store.
        </p>
      </section>

      <section aria-labelledby="proposals-heading" className="flex flex-col gap-2">
        <h2 id="proposals-heading" className="text-sm font-semibold">
          Latest proposals
        </h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-muted">No proposals yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {proposals.map((proposal) => (
              <li key={proposal.intentId}>
                <ProposalCard card={proposalCard(proposal)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="security-heading" className="flex flex-col gap-2">
        <h2 id="security-heading" className="text-sm font-semibold">
          Security log
        </h2>
        <p className="text-xs leading-5 text-muted">
          Products whose shop text tried to give orders to the AI. Leash&apos;s code hides them from
          the agent and never buys them, whatever your rules say.
        </p>
        {securityLog.length === 0 ? (
          <p className="text-sm text-muted">Nothing suspicious so far.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {securityLog.map((event) => (
              <li key={event.id} className="card flex flex-col gap-0.5 p-3 text-sm">
                <p className="text-xs font-medium text-danger">
                  {STAGE_LABELS[event.stage]} · {dateTime.format(event.createdAt)}
                </p>
                {/* Shop text, rendered as plain text (React escapes it). */}
                <p className="font-medium">{event.productTitle}</p>
                {event.merchantDomain && <p className="text-xs text-muted">{event.merchantDomain}</p>}
                {event.signals.length > 0 && <p className="text-xs">Its text {describeSignals(event.signals)}.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  return <AgentChat activity={activity} notices={notices} />;
}

function Notice({
  title,
  href,
  action,
  children,
}: {
  title: string;
  href: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <div className="card flex max-w-xl flex-col gap-3 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="card-muted px-3.5 py-3 text-muted">{children}</p>
      <p>
        <Link href={href} className="btn btn-primary">
          {action}
        </Link>
      </p>
    </div>
  );
}
