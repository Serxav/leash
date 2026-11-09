import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_USER_TTL_MS } from "@/account/demo-users";
import { VISITOR_COOKIE } from "@/account/visitor-cookie";
import { Page } from "@/components/page";

export const metadata: Metadata = {
  title: "Privacy – Leash",
};

/** Days a demo space is kept after the last visit (the same constant the cleanup uses). */
const RETENTION_DAYS = Math.round(DEMO_USER_TTL_MS / (24 * 60 * 60 * 1000));

const STORED = [
  ["A random visitor ID", `In one cookie, ${VISITOR_COOKIE}. It names your demo space, nothing else.`],
  ["Your rules", "The words you wrote and the exact rules you confirmed, with their version."],
  ["Rex's proposals", "Product, shop, price, quantity and Rex's reason for each purchase it proposed."],
  ["Leash's decisions", "Approve, ask first or block, the rule behind it and the one-sentence reason."],
  ["Payments", "Amount, status and PayPal's order, capture and refund references."],
  ["Your saved PayPal", "A reference to the token PayPal keeps for you, never your PayPal login or card."],
  ["The security log", "Products Leash hid because their shop text tried to give orders to the AI."],
  ["One switch", "Whether you paused Rex."],
] as const;

const NEVER = [
  "Your name, email, password or address",
  "Card or bank numbers: PayPal holds them, Leash never sees them",
  "Your messages to Rex: only the purchases it proposes are saved",
  "Analytics, advertising or tracking cookies",
] as const;

const SHARED = [
  [
    "Meta (Model API)",
    "Your rule text and your messages to Rex, public product data, Leash's decisions and a short summary of past purchases. Never your visitor ID, PayPal references, tokens or emails. Standard mode, which Meta says it does not use for training.",
  ],
  ["Channel3", "The search words and filters Rex writes, like “sticky notes, office supplies, up to €40”. Nothing about you."],
  [
    "PayPal (sandbox)",
    "You sign in on PayPal's own page, so Leash never sees your password. PayPal gives Leash a token to charge purchases your rules allow or you approve.",
  ],
  ["Render", "Hosts the app and its database in Oregon, USA."],
] as const;

export default function PrivacyPage() {
  return (
    <Page
      title="Privacy"
      intro="What Leash and Rex keep about you, who else sees what, and how to delete it. In short: very little, nothing that names you, and one tap deletes it."
    >
      <Section title="What Leash stores">
        <dl className="card divide-y divide-[var(--border)]">
          {STORED.map(([term, text]) => (
            <div key={term} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:gap-4">
              <dt className="font-medium sm:w-44 sm:shrink-0">{term}</dt>
              <dd className="text-sm leading-6 text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="What Leash never stores">
        <ul className="card flex flex-col gap-2 p-4 text-sm leading-6">
          {NEVER.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-danger">
                ✕
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Who else sees what">
        <dl className="card divide-y divide-[var(--border)]">
          {SHARED.map(([term, text]) => (
            <div key={term} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:gap-4">
              <dt className="font-medium sm:w-44 sm:shrink-0">{term}</dt>
              <dd className="text-sm leading-6 text-muted">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm leading-6 text-muted">
          Each of them handles that data under its own terms. Rex is an AI agent: it only proposes, and Leash&apos;s
          code, with no AI, decides every purchase.
        </p>
      </Section>

      <Section title="How long, and how to delete it">
        <ul className="card flex flex-col gap-2 p-4 text-sm leading-6">
          <li>
            Your demo space is deleted {RETENTION_DAYS} days after your last visit, with your saved PayPal. The free
            server also starts with an empty database after every restart.
          </li>
          <li>
            <Link href="/permissions" className="text-accent">
              Permissions
            </Link>{" "}
            → <strong>Delete my account and data</strong> deletes everything at once, and asks PayPal to delete your
            saved PayPal first. PayPal keeps its own records of past payments.
          </li>
          <li>Server logs keep only error types, status codes and product IDs, never messages, emails or tokens.</li>
        </ul>
      </Section>

      <p className="text-sm leading-6 text-muted">
        Leash is a demo on the PayPal sandbox: no real money moves, and you do not need real personal data to try it.
        Questions:{" "}
        <a href="https://github.com/Serxav/leash/issues" className="text-accent">
          open an issue on GitHub
        </a>
        .
      </p>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
