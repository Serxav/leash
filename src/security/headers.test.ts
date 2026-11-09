import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { SECURITY_HEADERS } from "./headers";

describe("security headers", () => {
  it("are sent on every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all?.headers).toEqual(SECURITY_HEADERS);
  });

  it("forbid framing the app", () => {
    const value = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;
    expect(value("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("X-Content-Type-Options")).toBe("nosniff");
  });

  it("do not announce the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
