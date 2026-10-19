import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { listPendingApprovals } from "@/purchases/propose";
import { SOURCE_LABELS } from "../labels";
import { InboxList, type PendingItem } from "./inbox-list";

export const metadata: Metadata = {
  title: "Approval inbox – Leash",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

export default function InboxPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-block py-1 text-sm text-zinc-600 underline dark:text-zinc-400">
          Leash
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Approval inbox</h1>
        <p
          role="note"
          className="rounded-lg border border-zinc-300 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Purchases the AI agent proposed above the amount you want to approve. Approving pays with
          your saved PayPal (sandbox), but Leash first checks the price and your rules again: if
          the price went up or a rule no longer allows it, nothing is charged.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
        <PendingPurchases />
      </Suspense>

      <p className="text-sm">
        <Link href="/agent" className="inline-block py-1 underline">
          Back to the shopping agent
        </Link>
      </p>
    </main>
  );
}

async function PendingPurchases() {
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const items: PendingItem[] = listPendingApprovals(getDb(), userId).map((view) => ({
    intentId: view.intentId,
    title: view.productTitle ?? "Unknown product",
    sourceLabel: SOURCE_LABELS[view.source],
    merchantDomain: view.merchantDomain,
    quantity: view.quantity,
    unitPrice: view.unitPrice,
    orderTotal: view.orderTotal,
    explanation: view.explanation,
    agentReason: view.agentReason,
    proposedAt: dateTime.format(view.createdAt),
  }));

  return (
    <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
      <h2 id="pending-heading" className="text-xl font-semibold">
        Waiting for you ({items.length})
      </h2>
      <InboxList items={items} />
    </section>
  );
}
