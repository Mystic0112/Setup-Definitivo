import fs from "node:fs/promises";
import deepmerge from "deepmerge";
import { exists, backupFile, writeFileEnsured } from "../core/fsx.js";

const START = (id: string) => `<!-- setup-definitivo:start:${id} -->`;
const END = (id: string) => `<!-- setup-definitivo:end:${id} -->`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertValidMarkers(existing: string, id: string): void {
  const startCount = existing.split(START(id)).length - 1;
  const endCount = existing.split(END(id)).length - 1;
  if (startCount !== endCount || startCount > 1) {
    throw new Error(
      `bloco "${id}" com marcadores inválidos: esperado no máximo um par start/end`
    );
  }
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge de settings (arrays concatenados sem duplicar). Função pura. */
export function mergeSettings(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return deepmerge(current, patch, {
    arrayMerge: (target, source) => {
      const seen = new Set<string | undefined>();
      return [...target, ...source].filter((value) => {
        const key = JSON.stringify(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });
}

/**
 * Insere ou substitui um bloco marcado num texto. Idempotente:
 * rodar de novo com o mesmo id só atualiza o conteúdo do bloco. Função pura.
 */
export function upsertBlock(existing: string, id: string, content: string): string {
  assertValidMarkers(existing, id);
  const block = `${START(id)}\n${content}\n${END(id)}`;
  const re = new RegExp(`${escapeRegExp(START(id))}[\\s\\S]*?${escapeRegExp(END(id))}`);
  if (re.test(existing)) return existing.replace(re, () => block);
  const sep = existing.trim().length ? "\n\n" : "";
  return `${existing}${sep}${block}\n`;
}

/** Remove um bloco gerenciado sem tocar no texto externo. Função pura. */
export function removeBlock(existing: string, id: string): string {
  assertValidMarkers(existing, id);
  const re = new RegExp(
    `${escapeRegExp(START(id))}[\\s\\S]*?${escapeRegExp(END(id))}`
  );
  const match = re.exec(existing);
  if (!match) return existing;
  let start = match.index;
  let end = match.index + match[0].length;
  if (existing.slice(start - 2, start) === "\n\n") start -= 2;
  if (existing[end] === "\n") end += 1;
  return existing.slice(0, start) + existing.slice(end);
}

/** Aplica patch de settings.json com backup. */
export async function applySettings(
  file: string,
  patch: Record<string, unknown>,
  dryRun: boolean
): Promise<string> {
  if (dryRun) return `[dry-run] merge settings -> ${file}`;
  let current: Record<string, unknown> = {};
  let existing = "";
  if (await exists(file)) {
    existing = await fs.readFile(file, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      throw new Error(`${file} não é JSON válido — nenhuma mudança aplicada`);
    }
    if (!isSettingsObject(parsed)) {
      throw new Error(`${file} deve conter um objeto JSON — nenhuma mudança aplicada`);
    }
    current = parsed;
  }
  const merged = mergeSettings(current, patch);
  const updated = JSON.stringify(merged, null, 2) + "\n";
  if (updated === existing) return `settings sem mudanças -> ${file}`;
  const backup = await backupFile(file);
  await writeFileEnsured(file, updated);
  return `settings mesclado -> ${file}${backup ? ` (backup: ${backup})` : ""}`;
}

/** Aplica um bloco de instrução com backup. */
export async function applyInstruction(
  file: string,
  id: string,
  content: string,
  dryRun: boolean
): Promise<string> {
  if (dryRun) return `[dry-run] upsert bloco "${id}" -> ${file}`;
  const existing = (await exists(file)) ? await fs.readFile(file, "utf-8") : "";
  const updated = upsertBlock(existing, id, content);
  if (updated === existing) return `bloco "${id}" sem mudanças -> ${file}`;
  const backup = await backupFile(file);
  await writeFileEnsured(file, updated);
  return `bloco "${id}" aplicado -> ${file}${backup ? ` (backup: ${backup})` : ""}`;
}
