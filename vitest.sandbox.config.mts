import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the real PayPal sandbox and partner APIs.
// They read .env.local and run locally only, never in CI.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/sandbox/**/*.sandbox.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
