import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { describeModels, getModel } from "@/ai/models";

// One tiny real call to the configured provider (free tier, invented data).
describe("AI provider", () => {
  it("answers with the configured rules model", async () => {
    const { text } = await generateText({
      model: getModel("rules"),
      prompt: "Reply with the single word OK and nothing else.",
      maxRetries: 1,
    });
    expect(text.trim().toUpperCase()).toContain("OK");
    expect(describeModels().rules).toMatch(/^(gemini|claude)-/);
  });
});
