import "server-only";
import { getServerEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { createCatalog, type Catalog } from "./catalog";
import { createChannel3Client } from "./channel3";

let instance: Catalog | undefined;

/** Process-wide catalog: Channel3 when CHANNEL3_API_KEY is set, else local. */
export function getCatalog(): Catalog {
  if (!instance) {
    const apiKey = getServerEnv().CHANNEL3_API_KEY;
    instance = createCatalog({
      db: getDb(),
      channel3: apiKey ? createChannel3Client({ apiKey }) : null,
    });
  }
  return instance;
}
