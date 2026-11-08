"use client";

import { useState, type ReactNode } from "react";
import type { ProposalCardData } from "@/app/labels";
import { AnswerButtons } from "./answer-buttons";

/** Colour and symbol per decision; the words always say it too. */
const MARKS: Record<ProposalCardData["outcome"], { symbol: string; className: string }> = {
  APPROVE: { symbol: "✓", className: "bg-emerald-600 text-white" },
  NEEDS_APPROVAL: { symbol: "?", className: "bg-amber-500 text-zinc-950" },
  BLOCK: { symbol: "✕", className: "bg-red-600 text-white" },
};

/**
 * One proposal and Leash's decision, as a permission card in Muse's style
 *: a question or result on top, the details in a grey box, and
 * Approve or Reject when Leash waits for the user. The chat and the inbox
 * show the same card. Once the user answers on the card, its mark and
 * headline follow the answer.
 */
export function ProposalCard({
  card,
  onAnswered,
  actions,
}: {
  card: ProposalCardData;
  onAnswered?: (approved: boolean) => void;
  /** Buttons of the page's own, in place of the card's Approve and Reject. */
  actions?: ReactNode;
}) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const outcome = answer === null ? card.outcome : answer ? "APPROVE" : "BLOCK";
  const headline =
    answer === null ? card.headline : answer ? "You approved this purchase" : "You rejected this purchase";
  const mark = MARKS[outcome];
  return (
    <article className="card rise-in flex flex-col gap-3 p-4 text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${mark.className}`}
        >
          {mark.symbol}
        </span>
        <p key={headline} className="rise-in flex-1 font-medium">
          {headline}
        </p>
        {card.orderTotal && <p className="shrink-0 font-semibold tabular-nums">€{card.orderTotal}</p>}
      </div>
      <div className="card-muted flex flex-col gap-1 px-3.5 py-3">
        <p className="text-xs text-muted">{card.status}</p>
        {/* Product and shop text, rendered as plain text (React escapes it). */}
        <h3 className="font-medium">{card.title}</h3>
        <p className="text-xs text-muted">{card.details}</p>
        <p className="mt-1">{card.reason}</p>
        <details className="group mt-1">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted [&::-webkit-details-marker]:hidden">
            Agent&apos;s reason
            <svg
              viewBox="0 0 12 12"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            >
              <path d="M3 4.5 6 7.5l3-3" />
            </svg>
          </summary>
          <p className="mt-1 text-xs">{card.agentReason}</p>
        </details>
      </div>
      {actions ??
        (card.needsAnswer && (
        <AnswerButtons
          intentId={card.intentId}
          title={card.title}
          orderTotal={card.orderTotal}
          onAnswered={(approved) => {
            setAnswer(approved);
            onAnswered?.(approved);
          }}
        />
        ))}
    </article>
  );
}
