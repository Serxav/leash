import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        PayPal sandbox only · no real money moves
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">Leash</h1>
      <p className="text-lg leading-8 text-zinc-700 dark:text-zinc-300">
        Give your AI agent a budget, not your wallet. Plain-language spending
        rules, one-tap human approval and PayPal checkout.
      </p>
      <p
        role="note"
        className="rounded-lg border border-zinc-300 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        Purchases in Leash are proposed by an AI agent. Every purchase is
        checked against your rules by code, not by the AI, before PayPal
        charges anything.
      </p>
      <p>
        <Link
          href="/rules"
          className="inline-block rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Set your spending rules
        </Link>{" "}
        <Link
          href="/agent"
          className="inline-block rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Ask the shopping agent
        </Link>{" "}
        <Link
          href="/inbox"
          className="inline-block rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Approval inbox
        </Link>{" "}
        <Link
          href="/history"
          className="inline-block rounded-full border border-zinc-400 px-5 py-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Purchase history
        </Link>
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Under construction for the PayPal AI Hackathon.
      </p>
    </main>
  );
}
