import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { userSettings } from "@/db/schema";

/** Whether the user paused the agent (US7). No settings row: active. */
export function isAgentPaused(db: Db, userId: string): boolean {
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()?.agentPaused ?? false;
}

export function setAgentPaused(db: Db, userId: string, paused: boolean, at: Date): void {
  db.insert(userSettings)
    .values({ userId, agentPaused: paused, updatedAt: at })
    .onConflictDoUpdate({ target: userSettings.userId, set: { agentPaused: paused, updatedAt: at } })
    .run();
}
