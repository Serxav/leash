import type { RestingMood } from "@/components/mascot-mood";
import type { ProposalCardData } from "../labels";

/**
 * The agent's answer to one chat message. Only text for the UI:
 * the summary is model text, shown escaped. An error can still carry the
 * proposals the agent made before it stopped.
 */
export type AgentReply =
  | { kind: "done"; summary: string; proposals: ProposalCardData[]; mood: RestingMood }
  | { kind: "error"; message: string; proposals: ProposalCardData[]; mood: RestingMood };
