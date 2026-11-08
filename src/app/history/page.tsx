import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { listHistory, type HistoryItem } from "@/purchases/history";
import { outcomeLabel, PAYMENT_LABELS, reasonText, SOURCE_LABELS } from "../labels";
import { LoadingCards, Page } from "@/components/page";
import { HistoryList, type HistoryRow, type HistoryTone } from "./history-list";

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
    <Page
      title="Purchase history"
      intro="Every purchase Rex proposed, what Leash decided and why. You can refund a paid purchase for 14 days; Rex cannot."
    >
      <Suspense fallback={<LoadingCards label="Loading your purchases…" count={3} />}>
        <Purchases />
      </Suspense>
    </Page>
  );
}

function toneOf(item: HistoryItem): HistoryTone {
  if (item.refundPending || item.paymentStatus === "REFUNDED" || item.paymentStatus === "PARTIALLY_REFUNDED") {
    return "refunded";
  }
  if (item.outcome === "BLOCK" || item.paymentStatus === "DECLINED" || item.paymentStatus === "FAILED") {
    return "stopped";
  }
  if (item.paymentStatus === "COMPLETED") return "paid";
  return "waiting";
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
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const rows: HistoryRow[] = listHistory(getDb(), userId, new Date()).map((item) => ({
    intentId: item.intentId,
    tone: toneOf(item),
    title: `${item.quantity} × ${item.productTitle ?? "Unknown product"}`,
    amount: item.orderTotal ? `€${item.orderTotal}` : null,
    details: [SOURCE_LABELS[item.source], item.merchantDomain, dateTime.format(item.createdAt)]
      .filter(Boolean)
      .join(" · "),
    status: statusText(item),
    explanation: reasonText(item.explanation),
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
