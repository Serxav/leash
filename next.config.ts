import path from "node:path";
import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/security/headers";

const nextConfig: NextConfig = {
  // Security headers on every response (see src/security/headers.ts).
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  // Do not announce the framework in an `x-powered-by` header.
  poweredByHeader: false,
  // Agent notes live outside the repo, so `next dev` must not write AGENTS.md.
  agentRules: false,
  cacheComponents: true,
  // The dev-only Next.js button sat on top of the nav's last icon.
  devIndicators: { position: "top-right" },
  partialPrefetching: true,
  turbopack: {
    // The project folder is the root. Without this, Next.js may pick a
    // lockfile in a parent folder and warn about it (see next.config docs).
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
