import { describe, expect, it } from "vitest";
import { paymentIssueMessage } from "./messages";

describe("paymentIssueMessage", () => {
  it("explains a declined payment and says nothing was charged", () => {
    const message = paymentIssueMessage("INSTRUMENT_DECLINED");
    expect(message).toContain("declined");
    expect(message).toContain("Nothing was charged");
  });

  it.each([undefined, null, "", "UNEXPECTED_ERROR", "SOMETHING_NEW", "toString", "__proto__"])(
    "never claims no money moved for an unknown issue (%s)",
    (issue) => {
      const message = paymentIssueMessage(issue);
      expect(message).toContain("Check your payment history");
      expect(message).not.toMatch(/nothing was charged|no money moved/i);
    },
  );

  it("does not mix up refund and charge messages", () => {
    expect(paymentIssueMessage("CAPTURE_FULLY_REFUNDED")).toContain("already refunded");
  });
});
