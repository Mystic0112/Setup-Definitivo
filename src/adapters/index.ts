import type { Adapter } from "./types.js";
import type { Harness } from "../registry/schema.js";
import { claudeAdapter } from "./claude.js";

/** Adapters implementados. Harness sem adapter ainda cai no aviso "não implementado". */
export const ADAPTERS: Partial<Record<Harness, Adapter>> = {
  claude: claudeAdapter,
};

export function getAdapter(harness: Harness): Adapter | undefined {
  return ADAPTERS[harness];
}
