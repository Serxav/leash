import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** Local SQLite file. Git-ignored; on Render the disk is reset on restart. */
export const DEFAULT_DB_PATH = "data/leash.sqlite";

/** Opens a database and applies the migrations in ./drizzle. */
export function createDb(path: string = DEFAULT_DB_PATH): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

let instance: Db | undefined;

/** Process-wide database for server code. */
export function getDb(): Db {
  instance ??= createDb();
  return instance;
}
