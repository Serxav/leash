import { defineConfig } from "drizzle-kit";

// `npx drizzle-kit generate` writes SQL migrations to ./drizzle (committed).
// The app applies them at startup (src/db/client.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
