import type { Item, Harness, Target } from "../registry/schema.js";
import type { Pipeline } from "../generators/roles.js";

export interface ApplyContext {
  target: Target;
  dryRun: boolean;
  pipeline?: Pipeline; // presente quando há pipeline multi-harness
}

export interface Adapter {
  id: Harness;
  /** True se o harness parece instalado na máquina. */
  detect(target: Target): Promise<boolean>;
  /** Aplica os itens escolhidos + (se houver) a skill de papel. Retorna log de ações. */
  apply(items: Item[], ctx: ApplyContext): Promise<string[]>;
}
