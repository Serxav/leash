import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the real PayPal sandbox and partner APIs.
// They read .env.local and run locally only, never in CI.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js handles "server-only"; in tests it is a no-op stub.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/sandbox/**/*.sandbox.test.ts"],
    setupFiles: ["tests/sandbox/load-env.ts"],
    testTimeout: 150_000, // the AI may take up to 60 s for rules and 120 s for the agent
  },
});
