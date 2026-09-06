#!/usr/bin/env tsx
/**
 * Empacota as skills LOCAIS do autor (ex.: ~/.claude/skills/escanor) para assets/
 * aplicando o rename-map (escanor -> backend). NÃO altera o ambiente local.
 *
 * Uso:  npm run pack:skills [-- --from <dir> --dry-run]
 * Padrão de origem: ~/.claude/skills
 *
 * ATENÇÃO: isto copia conteúdo das suas skills para dentro do repositório (público).
 * Revise o que será copiado antes de commitar. Roda em --dry-run por padrão se
 * a flag --write não for passada.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

async function exists(p: string) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  const from = fromIdx >= 0 ? args[fromIdx + 1] : path.join(os.homedir(), ".claude", "skills");
  const write = args.includes("--write");

  const mapPath = path.join(pkgRoot, "rename-map.json");
  const map = JSON.parse(await fs.readFile(mapPath, "utf-8")).skills as Record<
    string,
    { id: string; label: string }
  >;

  console.log(`Origem: ${from}`);
  console.log(write ? "Modo: WRITE (vai copiar)" : "Modo: dry-run (use --write para copiar)\n");

  for (const [localName, { id }] of Object.entries(map)) {
    const src = path.join(from, localName);
    const dest = path.join(pkgRoot, "assets", "skills", id);
    if (!(await exists(src))) {
      console.log(`  - ${localName}: origem ausente, pulado`);
      continue;
    }
    console.log(`  ${localName} -> assets/skills/${id}`);
    if (!write) continue;

    await fs.rm(dest, { recursive: true, force: true });
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.cp(src, dest, { recursive: true });

    // Reescreve o name: no frontmatter do SKILL.md para o id novo.
    const skillMd = path.join(dest, "SKILL.md");
    if (await exists(skillMd)) {
      let c = await fs.readFile(skillMd, "utf-8");
      c = c.replace(/^name:\s*.+$/m, `name: ${id}`);
      await fs.writeFile(skillMd, c, "utf-8");
    }
  }

  console.log("\nRevise assets/skills/ antes de commitar (conteúdo vai pro repo público).");
}

main();
