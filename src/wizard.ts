import * as p from "@clack/prompts";
import { CATALOG } from "./registry/items.js";
import type { Harness } from "./registry/schema.js";
import { getAdapter } from "./adapters/index.js";
import type { Role } from "./generators/roles.js";

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

/**
 * Fase 0/1: wizard esqueleto. Coleta escolhas (incluindo pipeline de papéis
 * multi-harness) e mostra o preview. A aplicação real (adapters/installers e
 * geração das skills de papel) entra nas próximas fases — ver docs/PLAN.md.
 */
export async function runInit(opts: InitOptions): Promise<InitPlan | void> {
  p.intro("Setup Definitivo");

  // 1) Quais harnesses você usa?
  const harnesses = await p.multiselect({
    message: "Quais harnesses você vai usar?",
    options: (Object.keys(HARNESS_LABELS) as Harness[]).map((h) => ({
      value: h,
      label: HARNESS_LABELS[h],
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
      initialValue: true,
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
    ...selected.map((it) => `  • ${it.id} — ${it.name}`),
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
export async function applyPlan(plan: InitPlan, dryRun: boolean): Promise<void> {
  const selected = CATALOG.filter((it) => plan.items.includes(it.id));
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
    const forHarness = selected.filter(
      (it) => !it.harnesses || it.harnesses.includes(h)
    );
    const s = p.spinner();
    s.start(`${HARNESS_LABELS[h]}: aplicando ${forHarness.length} itens`);
    const logs = await adapter.apply(forHarness, {
      target: plan.target,
      dryRun,
      pipeline: pipe,
    });
    s.stop(`${HARNESS_LABELS[h]}:`);
    for (const line of logs) p.log.step(line);
  }
}
