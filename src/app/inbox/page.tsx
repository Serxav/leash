import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { LoadingCards, Page, Steps } from "@/components/page";
import { listPendingApprovals } from "@/purchases/propose";
import { proposalCard } from "../labels";
import { InboxList } from "./inbox-list";

export const metadata: Metadata = {
  title: "Approval inbox – Leash",
};

const STEPS = [
  { title: "Rex asks", text: "Purchases above your “ask me first” amount wait here." },
  { title: "You answer", text: "Approve or reject with one tap. Nothing is paid before." },
  { title: "Leash re-checks", text: "If the price went up or a rule changed, nothing is charged." },
] as const;

export default function InboxPage() {
  return (
    <Page title="Approval inbox" intro="Purchases Rex proposed that need your yes before PayPal (sandbox) pays.">
      <Steps label="How approvals work" steps={STEPS} />
      <Suspense fallback={<LoadingCards label="Loading the purchases waiting for you…" />}>
        <PendingPurchases />
      </Suspense>
    </Page>
  );
}

async function PendingPurchases() {
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const cards = listPendingApprovals(getDb(), userId).map(proposalCard);

  return (
    <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
      <h2 id="pending-heading" className="text-xl font-semibold">
        Waiting for you ({cards.length})
      </h2>
      <InboxList cards={cards} />
    </section>
  );
}
