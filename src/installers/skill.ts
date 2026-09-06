import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import type { Item, Harness, Target } from "../registry/schema.js";
import { skillsDir } from "../core/targets.js";
import { copyDir, exists } from "../core/fsx.js";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");

/** id da skill (skill:backend -> backend). */
export function skillName(item: Item): string {
  return item.id.split(":")[1];
}

/**
 * Instala uma skill num harness que suporta skills nativas (ex.: Claude).
 * - source local: copia de assets/ do pacote.
 * - source git: clona raso e copia o subdir.
 * Em dry-run só descreve.
 */
export async function installSkill(
  item: Item,
  harness: Harness,
  target: Target,
  dryRun: boolean
): Promise<string> {
  const dest = path.join(skillsDir(harness, target), skillName(item));

  if (!item.source) throw new Error(`${item.id}: sem source.`);

  if (item.source.type === "local") {
    const src = path.join(pkgRoot, item.source.path);
    if (dryRun) return `[dry-run] copiar ${item.source.path} -> ${dest}`;
    if (!(await exists(src)))
      return `PULADO ${item.id}: assets ausentes (${item.source.path}) — rodar 'npm run pack:skills'`;
    await copyDir(src, dest);
    return `skill instalada: ${item.id} -> ${dest}`;
  }

  // git
  const { repo, ref, subdir } = item.source;
  const line = `git clone --depth 1 --branch ${ref} ${repo}${subdir ? ` (subdir ${subdir})` : ""} -> ${dest}`;
  if (dryRun) return `[dry-run] ${line}`;
  if (repo.includes("OWNER/"))
    return `PULADO ${item.id}: URL placeholder (OWNER) — definir repo real no catálogo`;
  const tmp = path.join(pkgRoot, ".cache", skillName(item));
  await execa("git", ["clone", "--depth", "1", "--branch", ref, repo, tmp], { stdio: "pipe" });
  await copyDir(subdir ? path.join(tmp, subdir) : tmp, dest);
  return `skill instalada (git): ${item.id} -> ${dest}`;
}
