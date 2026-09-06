import * as p from "@clack/prompts";
import { CATALOG } from "./registry/items.js";
import type { Harness } from "./registry/schema.js";

const HARNESS_LABELS: Record<Harness, string> = {
  claude: "Claude",
  cursor: "Cursor",
  codex: "Codex",
  gemini: "Gemini CLI",
  opencode: "opencode",
  omniroute: "OmniRoute",
};

export interface InitOptions {
  dryRun: boolean;
}

/**
 * Fase 0/1: wizard esqueleto. Coleta escolhas e mostra o preview.
 * A aplicação real (adapters/installers) entra nas próximas fases — ver docs/PLAN.md.
 */
export async function runInit(opts: InitOptions): Promise<void> {
  p.intro("Setup Definitivo");

  const harnesses = await p.multiselect({
    message: "Em quais harnesses aplicar?",
    options: (Object.keys(HARNESS_LABELS) as Harness[]).map((h) => ({
      value: h,
      label: HARNESS_LABELS[h],
    })),
    required: true,
  });
  if (p.isCancel(harnesses)) return void p.cancel("Cancelado.");

  const target = await p.select({
    message: "Alvo da configuração?",
    options: [
      { value: "global", label: "Global (ambiente do usuário)" },
      { value: "project", label: "Este projeto (diretório atual)" },
    ],
  });
  if (p.isCancel(target)) return void p.cancel("Cancelado.");

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

  const preview = [
    `Harnesses: ${(harnesses as Harness[]).map((h) => HARNESS_LABELS[h]).join(", ")}`,
    `Alvo: ${target}`,
    "",
    "Itens a instalar:",
    ...selected.map((it) => `  • ${it.id} — ${it.name}`),
    needSecret.length
      ? `\nPrecisam de credencial (guia será exibido): ${needSecret.map((i) => i.id).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  p.note(preview, opts.dryRun ? "PREVIEW (dry-run)" : "PREVIEW");

  if (opts.dryRun) {
    p.outro("dry-run: nada foi escrito.");
    return;
  }

  const go = await p.confirm({ message: "Aplicar?" });
  if (p.isCancel(go) || !go) return void p.cancel("Cancelado.");

  // TODO(fase 1+): despachar para adapters/installers por harness.
  p.note(
    "A aplicação real entra na Fase 1+ (adapters/installers).\nVer docs/PLAN.md.",
    "Ainda não implementado"
  );
  p.outro("Escolhas coletadas.");
}
