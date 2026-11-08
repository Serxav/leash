import { describe, expect, it } from "vitest";
import { moodForOutcomes, outcomeSummary } from "./mascot-mood";

describe("Rex's mood follows the engine", () => {
  it("is idle when nothing was proposed", () => {
    expect(moodForOutcomes([])).toBe("idle");
  });

  it("is happy when every proposal was approved", () => {
    expect(moodForOutcomes(["APPROVE", "APPROVE"])).toBe("happy");
  });

  it("waits when a proposal needs the user", () => {
    expect(moodForOutcomes(["APPROVE", "NEEDS_APPROVAL"])).toBe("waiting");
  });

  it("is held back by the leash when anything was blocked", () => {
    expect(moodForOutcomes(["APPROVE", "NEEDS_APPROVAL", "BLOCK"])).toBe("stopped");
  });

  it("counts the decisions for the status line", () => {
    expect(outcomeSummary(["APPROVE", "APPROVE", "NEEDS_APPROVAL", "BLOCK"])).toBe(
      "2 approved · 1 waiting for you · 1 blocked",
    );
    expect(outcomeSummary(["BLOCK"])).toBe("1 blocked");
    expect(outcomeSummary([])).toBeNull();
  });
});
