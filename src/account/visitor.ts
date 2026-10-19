import "server-only";
import { cookies } from "next/headers";
import { after, connection } from "next/server";
import { getDb } from "@/db/client";
import { appDeps } from "./server";
import { ensureDemoUser, pruneDemoUsers } from "./demo-users";
import { isVisitorId, VISITOR_COOKIE } from "./visitor-cookie";

/**
 * The visitor's own demo user (D-040). Server code reads the user only from
 * here: the ID comes from the httpOnly cookie that `src/proxy.ts` issues,
 * never from a form field or the URL. The first read creates the user with
 * Marta's rules, and then removes expired demo users after the response.
 */
export async function currentUserId(): Promise<string> {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) {
    throw new Error("No visitor cookie: src/proxy.ts did not run for this request.");
  }
  await connection(); // reads and writes the database: always at request time
  const now = new Date();
  if (ensureDemoUser(getDb(), visitorId, now).created) {
    after(() =>
      pruneDemoUsers(appDeps(), now).catch((error: Error) => {
        console.error("[demo-users] pruning failed:", error.name);
      }),
    );
  }
  return visitorId;
}
