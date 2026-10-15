import { connection } from "next/server";

/**
 * Liveness check for the hosted demo (Render health check and the
 * Dec 1–15 judging period). Exposes no configuration or secrets.
 */
export async function GET() {
  // Always answer at request time, never from a build-time prerender.
  await connection();
  return Response.json(
    { status: "ok", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
