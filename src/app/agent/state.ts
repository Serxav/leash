export const AGENT_PATH = "/agent";

/** What the agent form shows. Only text for the UI. */
export type AgentFormState =
  | { kind: "idle"; request: string }
  | { kind: "error"; request: string; message: string }
  | { kind: "done"; request: string; summary: string };
