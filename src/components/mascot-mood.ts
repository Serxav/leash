import type { Outcome } from "@/rules/engine";

/**
 * How Pip, the agent's mascot, looks (D-042). It perks up while the user
 * types and works at a tiny laptop while the agent runs; after a run, the
 * mood only follows what Leash's code decided. The mascot decides nothing.
 */
export type MascotMood = "idle" | "listening" | "working" | "happy" | "waiting" | "stopped";

export const MASCOT_NAME = "Pip";

/**
 * The mood after an agent run. A blocked proposal wins, because it shows
 * the leash working; then one waiting for the user; then approved ones.
 */
export function moodForOutcomes(outcomes: readonly Outcome[]): MascotMood {
  if (outcomes.includes("BLOCK")) return "stopped";
  if (outcomes.includes("NEEDS_APPROVAL")) return "waiting";
  if (outcomes.includes("APPROVE")) return "happy";
  return "idle";
}

/** The status line under Pip's name, so the mood is never only a picture. */
export const MOOD_STATUS: Record<MascotMood, string> = {
  idle: "Ready",
  listening: "Listening…",
  working: "Working…",
  happy: "Leash approved it",
  waiting: "Waiting for your answer",
  stopped: "Leash held me back",
};

/**
 * What the agent does in a run, in order (D-042). The status shows them one
 * after another while it works; the real decisions arrive with the reply.
 */
export const WORK_STEPS = [
  "Reading your rules…",
  "Searching the shops…",
  "Proposing purchases…",
  "Leash is checking each one…",
  "Paying approved ones with PayPal…",
] as const;

/** A short count of the decisions, for the status line after a run. */
export function outcomeSummary(outcomes: readonly Outcome[]): string | null {
  const count = (outcome: Outcome) => outcomes.filter((each) => each === outcome).length;
  const parts = [
    count("APPROVE") && `${count("APPROVE")} approved`,
    count("NEEDS_APPROVAL") && `${count("NEEDS_APPROVAL")} waiting for you`,
    count("BLOCK") && `${count("BLOCK")} blocked`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
