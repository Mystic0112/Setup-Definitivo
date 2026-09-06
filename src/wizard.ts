import path from "node:path";
import * as p from "@clack/prompts";
import { CATALOG } from "./registry/items.js";
import type { Harness, Item } from "./registry/schema.js";
import { getAdapter } from "./adapters/index.js";
import { handoffContent, type Role } from "./generators/roles.js";
import { exists, writeFileEnsured } from "./core/fsx.js";
import { installTool } from "./installers/tool.js";
import { stateFile, upsertStateEntries, type Artifact, type StateEntry } from "./core/state.js";
import type { ItemResult } from "./adapters/types.js";

const HARNESS_LABELS: Record<Harness, string> = {
  claude: "Claude",
  cursor: "Cursor",
  codex: "Codex",
  gemini: "Gemini CLI",
  opencode: "opencode",
  omniroute: "OmniRoute",
};

/** Papéis possíveis num pipeline multi-harness. */
const ROLES = [
  { value: "plan", label: "Planejar" },
  { value: "code", label: "Codar" },
  { value: "review", label: "Revisar" },
  { value: "docs", label: "Documentar" },
  { value: "solo", label: "Uso geral (sozinho)" },
] as const;

export interface InitOptions {
  dryRun: boolean;
}

export interface InitPlan {
  harnesses: Harness[];
  pipeline: boolean;
  roles: Record<string, Role[]>; // harness -> papéis
  target: "global" | "project";
  items: string[];
}

function permissionPreviewLines(item: Item): string[] {
  const permissions = item.config?.settings?.permissions;
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return [];
  }
  const allow = (permissions as Record<string, unknown>).allow;
  if (!Array.isArray(allow)) return [];
  return allow
    .filter((permission): permission is string => typeof permission === "string")
    .map((permission) => `      permissão: ${permission}`);
}

async function detectedHarnesses(harnesses: Harness[]): Promise<Harness[]> {
  const detected = await Promise.all(harnesses.map(async (harness) => {
    const adapter = getAdapter(harness);
    if (!adapter) return undefined;
    try {
      return await adapter.detect("global") ? harness : undefined;
    } catch {
      return undefined;
    }
  }));
  return detected.filter((harness): harness is Harness => harness !== undefined);
}

/**
 * Fase 0/1: wizard esqueleto. Coleta escolhas (incluindo pipeline de papéis
 * multi-harness) e mostra o preview. A aplicação real (adapters/installers e
 * geração das skills de papel) entra nas próximas fases — ver docs/PLAN.md.
 */
export async function runInit(opts: InitOptions): Promise<InitPlan | void> {
  p.intro("Setup Definitivo");

  // 1) Quais harnesses você usa?
  // Nada vem pré-marcado de propósito: a CLI escreve em config do usuário, então
  // a seleção é opt-in explícito. A detecção só informa, via hint.
  const availableHarnesses = Object.keys(HARNESS_LABELS) as Harness[];
  const detected = new Set(await detectedHarnesses(availableHarnesses));
  const harnesses = await p.multiselect({
    message: "Quais harnesses você vai usar?",
    options: availableHarnesses.map((h) => ({
      value: h,
      label: HARNESS_LABELS[h],
      hint: !getAdapter(h)
        ? "adapter não implementado"
        : detected.has(h)
          ? "detectado nesta máquina"
          : undefined,
    })),
    required: true,
  });
  if (p.isCancel(harnesses)) return void p.cancel("Cancelado.");
  const hs = harnesses as Harness[];

  // 2) Usar em conjunto (pipeline de papéis)?
  const roles: Record<string, Role[]> = {};
  let pipeline = false;

  if (hs.length > 1) {
    const combine = await p.confirm({
      message:
        "Usar os harnesses em conjunto? (ex.: Gemini planeja, Codex coda, Claude revisa)",
      initialValue: false,
    });
    if (p.isCancel(combine)) return void p.cancel("Cancelado.");
    pipeline = combine;

    if (pipeline) {
      for (const h of hs) {
        const r = await p.multiselect({
          message: `Papel de ${HARNESS_LABELS[h]} no pipeline:`,
          options: ROLES.map((x) => ({ value: x.value, label: x.label })),
          required: true,
        });
        if (p.isCancel(r)) return void p.cancel("Cancelado.");
        roles[h] = r as Role[];
      }
    }
  } else {
    roles[hs[0]] = ["solo"];
  }

  // 3) Alvo
  const target = await p.select({
    message: "Alvo da configuração?",
    options: [
      { value: "global", label: "Global (ambiente do usuário)" },
      { value: "project", label: "Este projeto (diretório atual)" },
    ],
  });
  if (p.isCancel(target)) return void p.cancel("Cancelado.");

  // 4) O que instalar
  const items = await p.multiselect({
    message: "O que instalar?",
    options: CATALOG.map((it) => ({
      value: it.id,
      label: `${it.name}${it.needsSecret ? " 🔑" : ""}`,
      hint: it.kind,
    })),
    required: true,
  });
  if (p.isCancel(items)) return void p.cancel("Cancelado.");

  // Resolve dependências (requires) declaradas no catálogo.
  const chosen = new Set(items as string[]);
  for (const it of CATALOG) {
    if (chosen.has(it.id) && it.requires) {
      for (const dep of it.requires) chosen.add(dep);
    }
  }
  const selected = CATALOG.filter((it) => chosen.has(it.id));
  const needSecret = selected.filter((it) => it.needsSecret);

  // Preview
  const roleLine = (h: Harness) =>
    `  • ${HARNESS_LABELS[h]}: ${(roles[h] ?? ["solo"])
      .map((r) => ROLES.find((x) => x.value === r)?.label)
      .join(" + ")}`;

  const previewLines = [
    `Harnesses: ${hs.map((h) => HARNESS_LABELS[h]).join(", ")}`,
    pipeline ? "Modo: pipeline em conjunto" : "Modo: independente",
    ...(pipeline || hs.length === 1 ? hs.map(roleLine) : []),
    `Alvo: ${target}`,
    "",
    "Itens a instalar:",
    ...selected.flatMap((it) => [
      `  • ${it.id} — ${it.name}`,
      ...permissionPreviewLines(it),
    ]),
    needSecret.length
      ? `\nPrecisam de credencial (guia será exibido): ${needSecret
          .map((i) => i.id)
          .join(", ")}`
      : "",
    pipeline
      ? "\nSerá gerada uma skill de papel por harness + protocolo de handoff."
      : "",
  ].filter(Boolean);

  p.note(previewLines.join("\n"), opts.dryRun ? "PREVIEW (dry-run)" : "PREVIEW");

  const plan: InitPlan = {
    harnesses: hs,
    pipeline,
    roles,
    target: target as "global" | "project",
    items: [...chosen],
  };

  if (opts.dryRun) {
    p.outro("dry-run: nada foi escrito.");
    return plan;
  }

  const go = await p.confirm({ message: "Aplicar?" });
  if (p.isCancel(go) || !go) return void p.cancel("Cancelado.");

  await applyPlan(plan, opts.dryRun);
  p.outro(opts.dryRun ? "dry-run concluído." : "Concluído.");
  return plan;
}

/** Fase 1: despacha os itens escolhidos para o adapter de cada harness. */
function stateEntry(
  result: ItemResult,
  plan: InitPlan,
  harness: Harness,
  kind: Item["kind"]
): StateEntry | undefined {
  if (result.status !== "ok" || !result.artifacts?.length) return undefined;
  return {
    itemId: result.itemId,
    kind,
    harness,
    target: plan.target,
    projectRoot: plan.target === "project" ? path.resolve(process.cwd()) : null,
    artifacts: result.artifacts as [Artifact, ...Artifact[]],
    installedAt: new Date().toISOString(),
  };
}

export async function applyPlan(
  plan: InitPlan,
  dryRun: boolean,
  manifestFile: string = stateFile()
): Promise<void> {
  const selected = CATALOG.filter((it) => plan.items.includes(it.id));
  const installedEntries: StateEntry[] = [];
  const tools = selected.filter((item) => item.kind === "tool");
  for (const item of tools) {
    try {
      const message = await installTool(item, dryRun);
      p.log.step(message);
      if (!dryRun) {
        installedEntries.push({
          itemId: item.id,
          kind: item.kind,
          harness: plan.harnesses[0],
          target: "global",
          projectRoot: null,
          artifacts: [{
            type: "tool",
            command: `uv tool uninstall ${item.tool?.args.at(-1) ?? item.id.split(":")[1]}`,
          }],
          installedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      p.log.step(`ERRO ${item.id}: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }
  const adapterItems = selected.filter((item) => item.kind !== "tool");
  const pipe = plan.pipeline
    ? { harnesses: plan.harnesses, roles: plan.roles }
    : undefined;

  for (const h of plan.harnesses) {
    const adapter = getAdapter(h);
    if (!adapter) {
      p.log.warn(`${HARNESS_LABELS[h]}: adapter ainda não implementado — pulado.`);
      continue;
    }
    // Só itens que fazem sentido no harness (harnesses vazio = todos).
    const forHarness = adapterItems.filter(
      (it) => !it.harnesses || it.harnesses.includes(h)
    );
    const s = p.spinner();
    s.start(`${HARNESS_LABELS[h]}: aplicando ${forHarness.length} itens`);
    const results = await adapter.apply(forHarness, {
      target: plan.target,
      dryRun,
      pipeline: pipe,
    });
    s.stop(`${HARNESS_LABELS[h]}:`);
    for (const result of results) {
      p.log.step(result.message);
      if (result.status === "error") process.exitCode = 1;
      const catalogItem = selected.find((item) => item.id === result.itemId);
      const entry = stateEntry(result, plan, h, catalogItem?.kind ?? "skill");
      if (entry) installedEntries.push(entry);
    }
  }

  if (pipe && plan.target === "project") {
    const file = path.join(process.cwd(), "HANDOFF.md");
    if (dryRun) p.log.step(`[dry-run] gerar handoff -> ${file}`);
    else if (await exists(file)) p.log.step(`handoff existente, preservado -> ${file}`);
    else {
      await writeFileEnsured(file, handoffContent(pipe));
      p.log.step(`handoff gerado -> ${file}`);
    }
  }

  if (!dryRun) await upsertStateEntries(installedEntries, manifestFile);
}
