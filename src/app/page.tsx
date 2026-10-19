import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { MASCOT_NAME } from "@/components/mascot-mood";

const PAGES = [
  { href: "/rules", title: "Spending rules", text: "Write them in plain words; you confirm the exact version." },
  { href: "/agent", title: `Chat with ${MASCOT_NAME}`, text: "The AI shopping agent proposes; Leash decides." },
  { href: "/inbox", title: "Approval inbox", text: "Purchases that wait for your one-tap answer." },
  { href: "/history", title: "Purchase history", text: "Every decision and its reason, with refunds." },
  { href: "/permissions", title: "Permissions", text: "Connect PayPal (sandbox), pause the agent, reset or delete." },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6">
      <section className="flex flex-col items-center gap-4 text-center">
        <p className="chip text-muted">PayPal sandbox only · no real money moves</p>
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
      </section>

      {/* Required notice: purchases are proposed by an AI (CLAUDE.md, transparency). */}
      <div className="flex flex-col gap-1 text-center text-sm leading-6 text-muted">
        <p role="note">
          {MASCOT_NAME} is an AI agent: it proposes, and Leash&apos;s code checks every purchase
          against your rules before PayPal charges anything.
        </p>
        <p>
          Your own demo space, no sign-up, with the sample rules of Marta, an invented office
          manager.{" "}
          <Link href="/permissions" className="text-accent">
            Reset demo
          </Link>
        </p>
      </div>

      <nav aria-label="Leash pages">
        <ul className="grid gap-3 sm:grid-cols-2">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="card flex h-full flex-col gap-1 p-4 transition-transform hover:-translate-y-0.5"
              >
                <span className="font-medium">{page.title}</span>
                <span className="text-sm text-muted">{page.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-center text-xs text-muted">Under construction for the PayPal AI Hackathon.</p>
    </main>
  );
}
