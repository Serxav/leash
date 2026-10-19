import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { listHistory, type HistoryItem } from "@/purchases/history";
import { outcomeLabel, PAYMENT_LABELS, SOURCE_LABELS } from "../labels";
import { HistoryList, type HistoryRow } from "./history-list";

export const metadata: Metadata = {
  title: "Purchase history – Leash",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Madrid" });

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-block py-1 text-sm text-zinc-600 underline dark:text-zinc-400">
          Leash
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Purchase history</h1>
        <p
          role="note"
          className="rounded-lg border border-zinc-300 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Every purchase the AI agent proposed, with the decision and the rule behind it. Charged
          purchases have a 14-day return window: until it closes, you can refund one in full to
          your PayPal (sandbox). Only you can start a refund; the agent cannot.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
        <Purchases />
      </Suspense>

      <p className="text-sm">
        <Link href="/agent" className="inline-block py-1 underline">
          Back to the shopping agent
        </Link>
      </p>
    </main>
  );
}

function statusText(item: HistoryItem): string {
  const outcome = outcomeLabel(item);
  if (item.refundPending) return `${outcome} · refund on its way`;
  const payment = item.paymentStatus ? PAYMENT_LABELS[item.paymentStatus] ?? item.paymentStatus : null;
  return payment ? `${outcome} · ${payment}` : outcome;
}

function windowText(item: HistoryItem): string | null {
  const window = item.returnWindow;
  if (window.state === "OPEN") {
    const days = window.daysLeft === 1 ? "1 day" : `${window.daysLeft} days`;
    return `14-day return window: ${days} left (until ${date.format(window.until)}).`;
  }
  if (window.state === "CLOSED") return `14-day return window closed on ${date.format(window.until)}.`;
  return null;
}

async function Purchases() {
  await connection(); // reads the database: always render at request time
  const rows: HistoryRow[] = listHistory(getDb(), DEMO_USER_ID, new Date()).map((item) => ({
    intentId: item.intentId,
    title: `${item.quantity} × ${item.productTitle ?? "Unknown product"}`,
    details: [
      SOURCE_LABELS[item.source],
      item.merchantDomain,
      item.orderTotal ? `€${item.orderTotal}` : null,
      dateTime.format(item.createdAt),
    ]
      .filter(Boolean)
      .join(" · "),
    status: statusText(item),
    explanation: item.explanation,
    agentReason: item.agentReason,
    paypalReference: item.paypalReference,
    returnWindow: windowText(item),
    refundLabel: item.canRefund ? `Refund €${item.orderTotal}` : null,
  }));

  return (
    <section aria-labelledby="purchases-heading" className="flex flex-col gap-3">
      <h2 id="purchases-heading" className="text-xl font-semibold">
        Purchases
      </h2>
      <HistoryList rows={rows} />
    </section>
  );
}
