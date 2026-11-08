import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { Mascot } from "./mascot";
import type { RestingMood } from "./mascot-mood";

/**
 * Every page's frame: the same width, a title with one sentence on
 * what the page is for, and a soft fade and rise when you move between
 * pages. The animation only plays on navigation, and never for people who
 * ask the system for reduced motion (globals.css).
 */
export function Page({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-muted">{intro}</p>
        </header>
        {children}
      </main>
    </PageTransition>
  );
}

/** The fade between pages, for pages that draw their own frame. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}

/** "How it works" in numbered steps, so nobody wonders what happens next. */
export function Steps({ label, steps }: { label: string; steps: ReadonlyArray<{ title: string; text: string }> }) {
  return (
    <ol
      aria-label={label}
      className="card grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3 p-4 sm:flex-col sm:gap-1">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent-fill)] text-xs font-semibold text-white"
          >
            {index + 1}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{step.title}</span>
            <span className="text-sm leading-5 text-muted">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** An empty list that says why it is empty and what to do next. */
export function EmptyState({
  mood = "idle",
  title,
  text,
  action,
}: {
  mood?: RestingMood;
  title: string;
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card rise-in flex flex-col items-center gap-2 px-6 py-8 text-center">
      <Mascot mood={mood} size={64} framing="tile" />
      <p className="mt-1 font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && (
        <Link href={action.href} className="btn btn-secondary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Grey placeholder cards while a list loads, instead of a "Loading…" line. */
export function LoadingCards({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="card flex flex-col gap-2.5 p-4">
          <span className="skeleton h-4 w-2/3" />
          <span className="skeleton h-3 w-1/2" />
          <span className="skeleton h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}
