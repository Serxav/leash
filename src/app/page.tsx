import Link from "next/link";
import { NavIcon } from "@/components/app-nav";
import { Mascot } from "@/components/mascot";
import { MASCOT_NAME } from "@/components/mascot-mood";
import { PageTransition, Steps } from "@/components/page";

const STEPS = [
  { title: "Set your rules", text: "Write them in plain words. An AI turns them into exact rules that you confirm." },
  { title: `${MASCOT_NAME} shops`, text: "The AI agent looks for real offers, only inside your rules, and proposes." },
  { title: "Leash decides", text: "Code, not the AI, approves, asks you first or blocks. PayPal pays." },
] as const;

const PAGES = [
  { href: "/agent", title: `Chat with ${MASCOT_NAME}`, text: "Tell it what you need. It proposes; Leash decides." },
  { href: "/rules", title: "Spending rules", text: "Budgets, limits, shops to avoid, when to ask you." },
  { href: "/inbox", title: "Approval inbox", text: "Purchases that wait for your one-tap answer." },
  { href: "/history", title: "Purchase history", text: "Every decision and its reason, with refunds." },
] as const;

export default function Home() {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6">
        <section className="flex flex-col items-center gap-4 text-center">
          <Mascot mood="idle" size={180} interactive />
          <h1 className="text-5xl font-semibold">Leash</h1>
          <p className="max-w-lg text-xl leading-8 text-muted">
            Give your AI agent a budget, not your wallet. Plain-language spending rules, one-tap
            human approval and PayPal checkout.
          </p>
          <p className="flex flex-wrap justify-center gap-2 pt-2">
            <Link href="/agent" className="btn btn-primary">
              Chat with {MASCOT_NAME}
            </Link>
            <Link href="/rules" className="btn btn-secondary">
              Set your spending rules
            </Link>
          </p>
          {/* Required notice: purchases are proposed by an AI (transparency). */}
          <p role="note" className="max-w-md text-sm leading-6 text-muted">
            {MASCOT_NAME} is an AI agent: it proposes, and Leash&apos;s code checks every purchase
            against your rules before PayPal charges anything.
          </p>
        </section>

        <section aria-labelledby="how-heading" className="flex flex-col gap-3">
          <h2 id="how-heading" className="px-1 text-sm font-medium text-muted">
            How it works
          </h2>
          <Steps label="How Leash works" steps={STEPS} />
        </section>

        <nav aria-label="Leash pages">
          <ul className="grid gap-3 sm:grid-cols-2">
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="card flex h-full items-start gap-3 p-4 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-accent">
                    <NavIcon href={page.href} size={22} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{page.title}</span>
                    <span className="text-sm text-muted">{page.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="text-center text-xs leading-5 text-muted">
          <p>
            Demo on PayPal sandbox: no real money moves. Your own demo space starts with the sample
            rules of Marta, an invented office manager.{" "}
            <Link href="/permissions" className="text-accent">
              Reset demo
            </Link>
            {" · "}
            <Link href="/privacy" className="text-accent">
              Privacy
            </Link>
          </p>
        </footer>
      </main>
    </PageTransition>
  );
}
