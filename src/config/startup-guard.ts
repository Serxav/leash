import { EnvConfigError, getServerEnv } from "./env";

/**
 * Validates the environment at server start. On an unsafe or incomplete
 * configuration the process exits, so the server never serves requests.
 * Only variable names are logged, never values.
 */
export function enforceSafeServerEnv(): void {
  try {
    getServerEnv();
  } catch (error) {
    if (error instanceof EnvConfigError) {
      console.error(`[leash] Refusing to start. ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
