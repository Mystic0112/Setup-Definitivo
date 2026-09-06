import { CATALOG } from "../registry/items.js";
import { ADAPTERS } from "../adapters/index.js";
import { applyPlan, type InitPlan } from "../wizard.js";
import type { Harness, Target } from "../registry/schema.js";

export interface AddOptions {
  harness: string[];
  project: boolean;
  dryRun: boolean;
}

/** Adiciona itens específicos sem o wizard. Resolve dependências e aplica. */
export async function runAdd(itemIds: string[], options: AddOptions): Promise<void> {
  if (!itemIds.length) {
    console.log('Informe ao menos um item. Ex.: setup-definitivo add agent:backend mcp:notebooklm');
    process.exitCode = 1;
    return;
  }

  // Valida os ids contra o catálogo antes de tocar em qualquer coisa.
  const known = new Set(CATALOG.map((item) => item.id));
  const desconhecidos = itemIds.filter((id) => !known.has(id));
  if (desconhecidos.length) {
    console.log(`Itens inexistentes no catálogo: ${desconhecidos.join(", ")}`);
    console.log("Use 'setup-definitivo list' para ver os ids disponíveis.");
    process.exitCode = 1;
    return;
  }

  // Resolve dependências declaradas em requires.
  const chosen = new Set(itemIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of CATALOG) {
      if (chosen.has(item.id) && item.requires) {
        for (const dep of item.requires) {
          if (!chosen.has(dep)) {
            chosen.add(dep);
            changed = true;
          }
        }
      }
    }
  }
  const added = [...chosen].filter((id) => !itemIds.includes(id));
  if (added.length) console.log(`Dependências adicionadas: ${added.join(", ")}`);

  // Harnesses: os passados em --harness, ou os detectados na máquina.
  const supported = Object.keys(ADAPTERS) as Harness[];
  let harnesses: Harness[];
  if (options.harness.length) {
    const invalid = options.harness.filter((h) => !supported.includes(h as Harness));
    if (invalid.length) {
      console.log(`Harness sem adapter: ${invalid.join(", ")}. Disponíveis: ${supported.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    harnesses = options.harness as Harness[];
  } else {
    harnesses = [];
    for (const h of supported) {
      if (await ADAPTERS[h]!.detect("global")) harnesses.push(h);
    }
    if (!harnesses.length) {
      console.log("Nenhum harness detectado. Use --harness <claude|cursor|codex>.");
      process.exitCode = 1;
      return;
    }
    console.log(`Harnesses detectados: ${harnesses.join(", ")}`);
  }

  const target: Target = options.project ? "project" : "global";
  const plan: InitPlan = {
    harnesses,
    pipeline: false,
    roles: {},
    target,
    items: [...chosen],
  };

  await applyPlan(plan, options.dryRun);
}
