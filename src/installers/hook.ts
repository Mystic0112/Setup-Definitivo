import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Item, Harness, Target } from "../registry/schema.js";
import { harnessBase, settingsFile } from "../core/targets.js";
import { exists, writeFileEnsured } from "../core/fsx.js";
import { contentDigest, type Artifact } from "../core/state.js";
import { localSourceDir } from "./skill.js";
import { applySettings } from "./config.js";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");

// ponytail: um hook existe hoje (rule-guard). Matcher/evento/script são
// constantes; se um segundo hook aparecer, mova esta fiação para o catálogo
// (campo `hook` no schema) em vez de generalizar por antecipação.
const ENTRY_SCRIPT = "rule-guard.py";
const HOOK_EVENT = "PreToolUse";
const HOOK_MATCHER = "Write|Edit|MultiEdit";
const HOOK_TIMEOUT = 10;

// Arquivos da source que são SEMENTE de dados do usuário: vão para a raiz do
// harness (ex.: ~/.claude/rules.jsonl) e só se ainda não existirem — nunca
// sobrescrevem o que o usuário já tem.
const SEED_FILES = new Set(["rules.jsonl"]);

interface HookInstall {
  message: string;
  artifacts: Artifact[];
}

function hookEntry(scriptDest: string): Record<string, unknown> {
  return {
    matcher: HOOK_MATCHER,
    hooks: [{ type: "command", command: `python3 "${scriptDest}"`, timeout: HOOK_TIMEOUT }],
  };
}

/**
 * Instala um hook Claude: copia o(s) script(s) para <base>/hooks/, semeia os
 * arquivos de dados do usuário só se ausentes, e patcha settings.json
 * ADITIVAMENTE com a entrada em hooks.<evento>. Reversível: o script vira
 * artefato `file` (digest) e a entrada de settings vira `settings-hook`.
 */
export async function installHook(
  item: Item,
  harness: Harness,
  target: Target,
  dryRun: boolean
): Promise<HookInstall> {
  if (item.source?.type !== "local") throw new Error(`${item.id}: source local esperado.`);
  const src = localSourceDir(item, pkgRoot);
  const base = harnessBase(harness, target);
  const hooksDir = path.join(base, "hooks");
  const settings = settingsFile(harness, target);
  const scriptDest = path.join(hooksDir, ENTRY_SCRIPT);

  if (dryRun) {
    return {
      message: [
        `[dry-run] copiar scripts de ${item.source.path} -> ${hooksDir}`,
        `[dry-run] semear arquivos de regra (se ausentes) -> ${base}`,
        `[dry-run] patch hooks.${HOOK_EVENT} -> ${settings}`,
      ].join("\n"),
      artifacts: [],
    };
  }

  if (!(await exists(src))) {
    return {
      message: `PULADO ${item.id}: assets ausentes (${item.source.path}) — rodar 'npm run pack:skills'`,
      artifacts: [],
    };
  }

  const messages: string[] = [];
  const artifacts: Artifact[] = [];

  for (const name of await fs.readdir(src)) {
    const from = path.join(src, name);
    if (!(await fs.stat(from)).isFile()) continue;
    const content = await fs.readFile(from, "utf-8");

    if (SEED_FILES.has(name)) {
      const seedDest = path.join(base, name);
      if (await exists(seedDest)) {
        messages.push(`semente preservada (já existe) -> ${seedDest}`);
      } else {
        await writeFileEnsured(seedDest, content);
        messages.push(`semente criada -> ${seedDest}`);
      }
      continue;
    }

    const dest = path.join(hooksDir, name);
    await writeFileEnsured(dest, content);
    messages.push(`script copiado -> ${dest}`);
    // Só o script de entrada vira artefato rastreável; se houver auxiliares,
    // eles são apagados junto pela remoção do diretório do script de entrada?
    // Não — cada um é um `file`. Rastreamos o de entrada; os demais idem.
    artifacts.push({ type: "file", path: dest, digest: contentDigest(content) });
  }

  const entry = hookEntry(scriptDest);
  messages.push(await applySettings(settings, { hooks: { [HOOK_EVENT]: [entry] } }, false));
  artifacts.push({
    type: "settings-hook",
    path: settings,
    event: HOOK_EVENT,
    entry: JSON.stringify(entry),
  });

  return { message: messages.join("\n"), artifacts };
}
