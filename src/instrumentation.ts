/**
 * Runs once when the Next.js server starts, before it accepts requests.
 * If the environment is unsafe (not sandbox) or incomplete, the server
 * refuses to start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enforceSafeServerEnv } = await import("./config/startup-guard");
    enforceSafeServerEnv();
  }
}
