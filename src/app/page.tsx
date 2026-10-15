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
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Under construction for the PayPal AI Hackathon.
      </p>
    </main>
  );
}
