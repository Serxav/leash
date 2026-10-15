import { existsSync } from "node:fs";

// Sandbox tests need the real (sandbox) credentials from .env.local.
// Vitest runs with NODE_ENV=test, where Next.js skips .env.local, so load it
// with Node's built-in loader. Values stay inside the test process: never
// print them.
if (!existsSync(".env.local")) {
  throw new Error(
    "Sandbox tests need .env.local (copy .env.example and fill it in).",
  );
}
process.loadEnvFile(".env.local");
