import { describe, expect, it } from "vitest";
import { parseAgentText, parseInline } from "./agent-text";

const plain = (text: string) => ({ text, strong: false });
const bold = (text: string) => ({ text, strong: true });

describe("agent summary text", () => {
  it("turns **bold** into strong text instead of printing the marks", () => {
    expect(parseInline("Paper is **approved**, toner **needs you**.")).toEqual([
      plain("Paper is "),
      bold("approved"),
      plain(", toner "),
      bold("needs you"),
      plain("."),
    ]);
  });

  it("drops code marks around shop names", () => {
    expect(parseInline("from `office-supplies-demo.example` at €24.00")).toEqual([
      plain("from office-supplies-demo.example at €24.00"),
    ]);
  });

  it("drops italic marks but keeps bold", () => {
    expect(parseInline("*(Note: 1 product was hidden.)* and **Approved**")).toEqual([
      plain("(Note: 1 product was hidden.) and "),
      bold("Approved"),
    ]);
  });

  it("keeps a lone ** as typed", () => {
    expect(parseInline("2 ** 3")).toEqual([plain("2 ** 3")]);
  });

  it("reads bullet and numbered lists", () => {
    expect(parseAgentText("I proposed:\n- **Paper**: approved\n* Pens: blocked\n1. First\n2) Second")).toEqual([
      { kind: "paragraph", lines: [[plain("I proposed:")]] },
      {
        kind: "list",
        ordered: false,
        items: [[bold("Paper"), plain(": approved")], [plain("Pens: blocked")]],
      },
      { kind: "list", ordered: true, items: [[plain("First")], [plain("Second")]] },
    ]);
  });

  it("splits paragraphs on empty lines and shows headings as bold lines", () => {
    expect(parseAgentText("## Summary\nAll done.\r\n\r\nCharged €6.90.")).toEqual([
      { kind: "paragraph", lines: [[bold("Summary")], [plain("All done.")]] },
      { kind: "paragraph", lines: [[plain("Charged €6.90.")]] },
    ]);
  });

  it("never turns text into markup: HTML stays plain text", () => {
    expect(parseAgentText("<img src=x onerror=alert(1)>")).toEqual([
      { kind: "paragraph", lines: [[plain("<img src=x onerror=alert(1)>")]] },
    ]);
  });
});
