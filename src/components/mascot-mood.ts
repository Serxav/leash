import type { Outcome } from "@/rules/engine";

/**
 * How Rex, the agent's mascot, looks. It perks up while the user
 * types and works at a tiny laptop while the agent runs; after a run, the
 * mood only follows what Leash's code decided. The mascot decides nothing.
 */
export type MascotMood = "idle" | "listening" | "working" | "happy" | "waiting" | "stopped";

/** Every mood except "working", which only lasts while the agent runs. */
export type RestingMood = Exclude<MascotMood, "working">;

export const MASCOT_NAME = "Rex";

/**
 * The mood after an agent run. A blocked proposal wins, because it shows
 * the leash working; then one waiting for the user; then approved ones.
 */
export function moodForOutcomes(outcomes: readonly Outcome[]): RestingMood {
  if (outcomes.includes("BLOCK")) return "stopped";
  if (outcomes.includes("NEEDS_APPROVAL")) return "waiting";
  if (outcomes.includes("APPROVE")) return "happy";
  return "idle";
}

/**
 * The status line under Rex's name, in a dog's words, so the mood is never
 * only a picture. While it works, the line comes from WORK_STEPS instead.
 */
export const MOOD_STATUS: Record<RestingMood, string> = {
  idle: "Ready to fetch",
  listening: "Ears up, listening…",
  happy: "Fetched!",
  waiting: "Sitting, waiting for you",
  stopped: "Held back by the leash",
};

/**
 * What the agent does in a run, in order: in plain words for the
 * chat, and in a dog's words under Rex. The chat moves through them while
 * the agent runs; the real decisions arrive with the reply.
 */
export const WORK_STEPS = [
  { agent: "Reading your confirmed rules…", dog: "Putting the leash on…" },
  { agent: "Searching Channel3 offers inside your rules…", dog: "Sniffing around the shops…" },
  { agent: "Comparing prices and shops…", dog: "Following a scent…" },
  { agent: "Proposing purchases to Leash…", dog: "Found something! Bringing it back…" },
  { agent: "Leash's code is checking each proposal…", dog: "Sitting still while Leash checks…" },
  { agent: "Paying approved purchases with PayPal (sandbox)…", dog: "Tail wagging, almost done…" },
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
