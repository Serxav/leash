import type { Metadata } from "next";
import { Suspense } from "react";
import { isAgentPaused } from "@/account/settings";
import { currentUserId } from "@/account/visitor";
import { getDb } from "@/db/client";
import { getMandateView, type MandateView } from "@/payments/mandate";
import { PermissionsForms, type PermissionsView } from "./permissions-forms";

export const metadata: Metadata = {
  title: "Permissions – Leash",
};

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Madrid" });

export default function PermissionsPage({ searchParams }: PageProps<"/permissions">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Permissions</h1>
        <p
          role="note"
          className="card p-4 text-sm leading-6 text-muted"
        >
          You stay in control of the AI agent: pause it, disconnect PayPal, or delete everything
          Leash stores about you. Each switch works at once, for purchases the agent has not made
          yet.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Permissions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function mandateText(mandate: MandateView): string {
  switch (mandate.status) {
    case "ACTIVE":
      return `PayPal (sandbox) is connected${mandate.connectedAt ? ` since ${date.format(mandate.connectedAt)}` : ""}. Leash can charge it only for purchases your rules allow or you approve.`;
    case "REVOKED":
      return "You revoked the mandate. Leash cannot charge your PayPal.";
    case "PAUSED":
      return "The mandate is paused. Leash cannot charge your PayPal.";
    case "PENDING":
      return "PayPal is waiting for your approval on PayPal's page.";
    default:
      return "PayPal is not connected, so Leash cannot charge anything.";
  }
}

/** The answer after PayPal sends the payer back. */
const PAYPAL_NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "PayPal (sandbox) is connected. Leash can now pay what your rules allow or you approve." },
  cancelled: { ok: true, text: "You cancelled on PayPal. Nothing was saved." },
  error: { ok: false, text: "PayPal could not be connected. Nothing was saved. Please try again." },
};

async function Permissions({ searchParams }: { searchParams: PageProps<"/permissions">["searchParams"] }) {
  const userId = await currentUserId(); // reads the visitor cookie: always render at request time
  const { paypal } = await searchParams;
  const db = getDb();
  const mandate = getMandateView(db, userId);
  const view: PermissionsView = {
    agentPaused: isAgentPaused(db, userId),
    mandateText: mandateText(mandate),
    canRevoke: mandate.status === "ACTIVE" || mandate.status === "PAUSED",
    canConnect: mandate.status === "NONE" || mandate.status === "PENDING" || (mandate.status === "REVOKED" && !mandate.deletionPending),
    deletionPending: Boolean(mandate.deletionPending),
    paypalNotice: typeof paypal === "string" ? PAYPAL_NOTICES[paypal] : undefined,
  };
  return <PermissionsForms view={view} />;
}
