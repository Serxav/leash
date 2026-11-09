import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_USER_TTL_MS } from "@/account/demo-users";
import { VISITOR_COOKIE } from "@/account/visitor-cookie";
import * as schema from "@/db/schema";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("privacy page", () => {
  it("states the retention the cleanup really uses", () => {
    expect(DEMO_USER_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(page).toContain("DEMO_USER_TTL_MS");
    expect(VISITOR_COOKIE).toBe("leash_visitor");
  });

  it("promises no personal fields the database could hold", () => {
    const columns = Object.values(schema)
      .flatMap((table) => Object.keys(table as object))
      .join(" ")
      .toLowerCase();
    for (const field of ["email", "name", "password", "address", "phone", "card"]) {
      expect(columns).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });
});
