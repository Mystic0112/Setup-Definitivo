import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import type { Item, Harness, Target } from "../registry/schema.js";
import { skillsDir } from "../core/targets.js";
import { copyDir, exists } from "../core/fsx.js";
import { applyInstruction } from "./config.js";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");
const cloneRoot = path.join(pkgRoot, ".cache");

interface SkillPaths {
  packageRoot?: string;
  cloneRoot?: string;
}

function localSourceDir(item: Item, root: string): string {
  if (item.source?.type !== "local") throw new Error(`${item.id}: source local esperado.`);
  const source = path.resolve(root, item.source.path);
  if (!source.startsWith(root + path.sep)) {
    throw new Error(`${item.id}: source.path escapa do pacote`);
  }
  return source;
}

async function cloneGitSource(item: Item, root: string): Promise<string> {
  if (item.source?.type !== "git") throw new Error(`${item.id}: source git esperado.`);
  const destination = path.join(root, skillName(item));
  await fs.mkdir(root, { recursive: true });
  await execa(
    "git",
    ["clone", "--depth", "1", "--branch", item.source.ref, item.source.repo, destination],
    { stdio: "pipe" }
  );
  return item.source.subdir ? path.join(destination, item.source.subdir) : destination;
}

/** Remove metadados de skill e neutraliza marcadores antes de virar instrução. */
export function instructionMarkdown(source: string): string {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
    .replace(/<!--\s*setup-definitivo:/g, "<!-- setup-definitivo-neutralizado:");
}

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
    const src = localSourceDir(item, pkgRoot);
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
  const source = await cloneGitSource(item, cloneRoot);
  await copyDir(source, dest);
  return `skill instalada (git): ${item.id} -> ${dest}`;
}

/** Converte uma skill em instrução para harnesses sem skills nativas. */
export async function installSkillAsInstruction(
  item: Item,
  file: string,
  dryRun: boolean,
  paths: SkillPaths = {}
): Promise<string> {
  if (!item.source) throw new Error(`${item.id}: sem source.`);
  const root = paths.packageRoot ?? pkgRoot;
  let sourceDir = item.source.type === "local" ? localSourceDir(item, root) : undefined;
  if (dryRun) {
    return `[dry-run] skill convertida em instrução (harness sem skills nativas): ${item.id} -> ${file}`;
  }
  if (item.source.type === "git") {
    if (item.source.repo.includes("OWNER/")) {
      return `PULADO ${item.id}: URL placeholder (OWNER) — definir repo real no catálogo`;
    }
    sourceDir = await cloneGitSource(item, paths.cloneRoot ?? cloneRoot);
  }

  const skillFile = path.join(sourceDir!, "SKILL.md");
  if (!(await exists(skillFile))) {
    const location = item.source.type === "local" ? item.source.path : item.source.repo;
    return `PULADO ${item.id}: SKILL.md ausente (${location})`;
  }

  const source = instructionMarkdown(await fs.readFile(skillFile, "utf-8"));
  const content = `# Skill: ${item.name}\n\n${item.description}\n\n${source}`;
  const result = await applyInstruction(file, item.id, content, false);
  return `skill convertida em instrução (harness sem skills nativas): ${result}`;
}
