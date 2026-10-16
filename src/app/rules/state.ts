import type { RuleTag } from "@/rules/describe";

export const RULES_PATH = "/rules";

/** What the rules form shows. Only text for the UI: no rules JSON. */
export type RulesFormState =
  | { kind: "idle"; text: string }
  | { kind: "error"; text: string; message: string }
  | { kind: "questions"; text: string; questions: string[] }
  | { kind: "draft"; text: string; draftId: string; tags: RuleTag[] };
