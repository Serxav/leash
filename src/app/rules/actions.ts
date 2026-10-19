"use server";

import { redirect } from "next/navigation";
import { getModel } from "@/ai/models";
import { getDb } from "@/db/client";
import { currentUserId } from "@/account/visitor";
import { buildRules, MAX_RULES_TEXT_LENGTH, RulesBuilderError } from "@/rules/builder";
import { describeRules } from "@/rules/describe";
import { confirmDraft, discardDraft, PolicyError, saveDraft } from "@/rules/policies";
import { RULES_PATH, type RulesFormState } from "./state";

/**
 * US2 step 1: the AI turns the text into exact rules, or asks questions.
 * The rules stay on the server as a draft; the browser gets readable tags
 * and a random draft ID. Nothing applies yet. Every new attempt first drops
 * the previous draft, so only the last rules shown can be confirmed.
 */
export async function proposeRules(
  _previous: RulesFormState,
  formData: FormData,
): Promise<RulesFormState> {
  const raw = formData.get("text");
  const text = typeof raw === "string" ? raw : "";
  // Never send a huge body back to the browser.
  const shown = text.slice(0, MAX_RULES_TEXT_LENGTH);

  const db = getDb();
  const userId = await currentUserId();
  discardDraft(db, userId);
  try {
    const result = await buildRules({ model: getModel("rules") }, text);
    if (result.kind === "questions") {
      return { kind: "questions", text: shown, questions: result.questions };
    }
    const draftId = saveDraft(db, {
      userId,
      sourceText: text,
      rules: result.rules,
    });
    return { kind: "draft", text: shown, draftId, tags: describeRules(result.rules) };
  } catch (error) {
    if (error instanceof RulesBuilderError) {
      return { kind: "error", text: shown, message: error.message };
    }
    // The user's text is not logged.
    console.error("[rules] proposeRules failed:", (error as Error).name);
    return {
      kind: "error",
      text: shown,
      message: "Something went wrong. Your rules were not changed. Please try again.",
    };
  }
}

/** US2 step 2: the user confirms their draft; it becomes the next version. */
export async function confirmRules(formData: FormData): Promise<void> {
  const draftId = formData.get("draftId");

  let status: string;
  try {
    confirmDraft(getDb(), {
      userId: await currentUserId(),
      draftId: typeof draftId === "string" ? draftId : "",
    });
    status = "confirmed";
  } catch (error) {
    if (!(error instanceof PolicyError)) {
      console.error("[rules] confirmRules failed:", (error as Error).name);
    }
    status = error instanceof PolicyError && error.code === "DRAFT_NOT_FOUND" ? "expired" : "error";
  }
  // redirect() throws, so it must stay outside the try block (Next.js docs).
  redirect(`${RULES_PATH}?status=${status}`);
}
