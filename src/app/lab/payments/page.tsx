import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { getMandateView } from "@/payments/mandate";
import { connectPayPal } from "./actions";
import { assertLabEnabled, LAB_USER_ID } from "./lab";

export const metadata: Metadata = {
  title: "Payments lab – Leash",
  robots: { index: false },
};

const STATUS_MESSAGES: Record<string, string> = {
  connected: "PayPal is connected. Leash can now charge approved purchases.",
  cancelled: "You cancelled on PayPal. Nothing was saved.",
  error: "Something went wrong with PayPal. Nothing was charged.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PaymentsLabPage({
  searchParams,
}: PageProps<"/lab/payments">) {
  assertLabEnabled();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Development lab · PayPal sandbox only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Payments lab</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Runs the F1 flow against the PayPal sandbox: save PayPal (mandate),
          charge, refund and a declined payment. No real money moves.
        </p>
      </header>

      {/* Static shell above; request-time data streams in below (Cache Components). */}
      <Suspense fallback={<p className="text-sm text-zinc-600">Loading lab state…</p>}>
        <LabState searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LabState({
  searchParams,
}: {
  searchParams: PageProps<"/lab/payments">["searchParams"];
}) {
  await connection(); // reads the database: always render at request time
  const params = await searchParams;
  const status = first(params.status);
  const issue = first(params.issue);
  const debug = first(params.debug);
  const mandate = getMandateView(getDb(), LAB_USER_ID);

  return (
    <>
      {status && STATUS_MESSAGES[status] && (
        <p
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            status === "error"
              ? "border-red-300 text-red-800 dark:border-red-800 dark:text-red-300"
              : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          }`}
        >
          {STATUS_MESSAGES[status]}
          {issue && (
            <span className="mt-1 block font-mono text-xs">Reason: {issue}</span>
          )}
          {debug && (
            <span className="block font-mono text-xs">PayPal debug ID: {debug}</span>
          )}
        </p>
      )}

      <section
        aria-labelledby="mandate-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700"
      >
        <h2 id="mandate-heading" className="text-xl font-semibold">
          1. Mandate (save PayPal)
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Status: <strong data-testid="mandate-status">{mandate.status}</strong>
          {mandate.connectedAt && (
            <> · connected {mandate.connectedAt.toISOString()}</>
          )}
        </p>
        {mandate.status !== "ACTIVE" && (
          <form action={connectPayPal}>
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Connect PayPal (sandbox)
            </button>
          </form>
        )}
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          You will approve on www.sandbox.paypal.com with the sandbox Personal
          account, then come back here. Leash only stores a PayPal payment token
          on the server.
        </p>
      </section>
    </>
  );
}
