import type { Item, Harness, Target } from "../registry/schema.js";
import type { Pipeline } from "../generators/roles.js";
import type { Artifact, StateEntry } from "../core/state.js";
import type { RemovalResult } from "../installers/remove.js";

export interface ApplyContext {
  target: Target;
  dryRun: boolean;
  pipeline?: Pipeline; // presente quando há pipeline multi-harness
}

export interface RemoveContext {
  dryRun: boolean;
}

export interface ItemResult {
  itemId: string;
  status: "ok" | "skipped" | "error";
  message: string;
  artifacts?: Artifact[];
}

export interface Adapter {
  id: Harness;
  /** True se o harness parece instalado na máquina. */
  detect(target: Target): Promise<boolean>;
  /** Aplica os itens escolhidos + (se houver) a skill de papel. */
  apply(items: Item[], ctx: ApplyContext): Promise<ItemResult[]>;
  /** Remove apenas artefatos cuja integridade ainda pode ser comprovada. */
  remove(entries: StateEntry[], ctx: RemoveContext): Promise<RemovalResult[]>;
}
