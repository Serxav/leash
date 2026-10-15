import { describe, expect, it } from "vitest";
import { fromCents, isMoney, toCents } from "./money";

describe("money", () => {
  it.each([
    ["0.01", 1],
    ["15.00", 1500],
    ["40.99", 4099],
    ["999999.99", 99_999_999],
  ])("converts %s to %i cents and back", (text, cents) => {
    expect(toCents(text)).toBe(cents);
    expect(fromCents(cents)).toBe(text);
  });

  it.each(["40", "40.0", "40.000", "-1.00", "01.00", "1e3", " 1.00", "1,00", "1234567.00", ""])(
    "rejects %j",
    (text) => {
      expect(isMoney(text)).toBe(false);
      expect(() => toCents(text)).toThrow(RangeError);
    },
  );

  it("avoids floating point errors", () => {
    expect(toCents("0.10") + toCents("0.20")).toBe(toCents("0.30"));
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("refuses %d cents", (cents) => {
    expect(() => fromCents(cents)).toThrow(RangeError);
  });
});
