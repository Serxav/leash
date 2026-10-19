import type { MascotMood } from "@/components/mascot-mood";
import type { ProposalCardData } from "../labels";

export const AGENT_PATH = "/agent";

/**
 * The agent's answer to one chat message (D-042). Only text for the UI:
 * the summary is model text, shown escaped. An error can still carry the
 * proposals the agent made before it stopped.
 */
export type AgentReply =
  | { kind: "done"; summary: string; proposals: ProposalCardData[]; mood: MascotMood }
  | { kind: "error"; message: string; proposals: ProposalCardData[]; mood: MascotMood };
