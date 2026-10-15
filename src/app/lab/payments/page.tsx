import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FraudNet } from "@/components/fraudnet";
import { getServerEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { listPayments, newClientMetadataId } from "@/payments/charge";
import { getMandateView } from "@/payments/mandate";
import { paymentIssueMessage } from "@/payments/messages";
import { chargeFiveEuros, connectPayPal, refundLabPayment } from "./actions";
import { assertLabEnabled, LAB_USER_ID } from "./lab";

export const metadata: Metadata = {
  title: "Payments lab – Leash",
  robots: { index: false },
};

const STATUS_MESSAGES: Record<string, string> = {
  connected: "PayPal is connected. Leash can now charge approved purchases.",
  charged: "Charged €5.00 with your saved PayPal (sandbox).",
  refunded: "Refunded in full to the payer's PayPal (sandbox).",
  "refund-pending": "Refund requested. PayPal is still processing it.",
  cancelled: "You cancelled on PayPal. Nothing was saved.",
  declined: "Payment declined.",
  error: "Something went wrong.",
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
  const db = getDb();
  const mandate = getMandateView(db, LAB_USER_ID);
  const history = listPayments(db, LAB_USER_ID);
  const merchantId = getServerEnv().PAYPAL_MERCHANT_ID;
  // One FraudNet session per page view, sent as PayPal-Client-Metadata-Id.
  const clientMetadataId = newClientMetadataId();

  return (
    <>
      {status && STATUS_MESSAGES[status] && (
        <p
          role="status"
          className={`rounded-lg border p-4 text-sm ${
            status === "error" || status === "declined"
              ? "border-red-300 text-red-800 dark:border-red-800 dark:text-red-300"
              : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          }`}
        >
          <strong>{STATUS_MESSAGES[status]}</strong>
          {(status === "error" || status === "declined") && (
            <span className="mt-1 block">{paymentIssueMessage(issue)}</span>
          )}
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

      <section
        aria-labelledby="charge-heading"
        className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700"
      >
        <h2 id="charge-heading" className="text-xl font-semibold">
          2. Charge €5 with the saved PayPal
        </h2>
        {mandate.status !== "ACTIVE" ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Connect PayPal first.
          </p>
        ) : !merchantId ? (
          <p role="alert" className="text-sm text-red-800 dark:text-red-300">
            Set PAYPAL_MERCHANT_ID in .env.local (sandbox Business account) to
            enable FraudNet risk data before charging.
          </p>
        ) : (
          <>
            <FraudNet
              sessionId={clientMetadataId}
              merchantId={merchantId}
              pageId="checkout-page"
            />
            <form action={chargeFiveEuros} className="flex flex-wrap gap-3">
              <input type="hidden" name="clientMetadataId" value={clientMetadataId} />
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Charge €5.00 (sandbox)
              </button>
              <button
                type="submit"
                name="simulate"
                value="INSTRUMENT_DECLINED"
                className="rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Simulate a declined €5.00 charge
              </button>
            </form>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The simulation uses PayPal sandbox negative testing
              (PayPal-Mock-Response): PayPal answers INSTRUMENT_DECLINED and
              nothing is charged.
            </p>
          </>
        )}

        <h3 className="text-base font-semibold">Payments</h3>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((payment) => (
              <li
                key={payment.id}
                className="rounded border border-zinc-200 p-3 font-mono text-xs dark:border-zinc-800"
              >
                {payment.amount} {payment.currency} · <strong>{payment.status}</strong> ·{" "}
                {payment.initiator}
                {payment.captureId && <> · capture {payment.captureId}</>}
                {payment.refundId && <> · refund {payment.refundId}</>}
                {payment.status === "COMPLETED" && payment.refundId && <> · refund pending</>}
                {payment.failureIssue && <> · {payment.failureIssue}</>}
                {payment.debugId && <> · debug {payment.debugId}</>}
                {payment.status === "COMPLETED" && payment.withdrawalDeadline && (
                  <> · return window until {payment.withdrawalDeadline.toISOString().slice(0, 10)}</>
                )}
                {payment.failureIssue && (
                  <span className="mt-1 block font-sans">
                    {paymentIssueMessage(payment.failureIssue)}
                  </span>
                )}
                {payment.status === "COMPLETED" && !payment.refundId && (
                  <form action={refundLabPayment} className="mt-2">
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <button
                      type="submit"
                      aria-label={`Refund ${payment.amount} ${payment.currency}`}
                      className="rounded-full border border-zinc-400 px-4 py-2 font-sans text-xs font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      Refund in full
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
