#!/usr/bin/env tsx
/**
 * Empacota a squad LOCAL do autor para `assets/`, aplicando o rename-map.
 *
 * A squad são AGENTS (`~/.claude/agents/<nome>.md`) e COMMANDS
 * (`~/.claude/commands/<nome>.md`) — arquivos .md únicos, não diretórios de skill.
 *
 * ATENÇÃO: o rename mecânico NÃO é suficiente. Os arquivos contêm prosa de persona
 * (referências a personagens) e ~227 referências cruzadas entre membros, incluindo a
 * tabela de roteamento do coordenador. Uma substituição de string deixa texto órfão
 * e referências para agentes que não existem.
 *
 * Por isso este script é um VERIFICADOR, não um renomeador: ele confere se
 * `assets/agents` e `assets/commands` estão completos e limpos. A reescrita de
 * conteúdo é feita à parte (ver docs/PLAN.md) e revisada antes de entrar no repo.
 *
 * Uso: npm run pack:squad
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

const FORBIDDEN = [
  "escanor", "bulma", "ippo", "nezuko", "saitama", "uraraka",
  "kurama", "ryuk", "shikamaru", "yagami", "shinigami", "quirk",
  "dempsey", "freecss", "youko", "hakusho", "nanatsu", "kyojin",
  "kimetsu", "death note",
];

async function main() {
  const map = JSON.parse(
    await fs.readFile(path.join(pkgRoot, "rename-map.json"), "utf-8")
  ).squad as Record<string, { id: string; label: string }>;

  const expected = Object.values(map).map((entry) => entry.id).sort();
  let problems = 0;

  for (const kind of ["agents", "commands"] as const) {
    const dir = path.join(pkgRoot, "assets", kind);
    let present: string[] = [];
    try {
      present = (await fs.readdir(dir))
        .filter((name) => name.endsWith(".md"))
        .map((name) => path.basename(name, ".md"))
        .sort();
    } catch {
      console.log(`  ${kind}: diretório ausente (${dir})`);
      problems++;
      continue;
    }

    const missing = expected.filter((id) => !present.includes(id));
    const extra = present.filter((id) => !expected.includes(id));
    console.log(`  ${kind}: ${present.length}/${expected.length} presentes`);
    if (missing.length) {
      console.log(`    faltando: ${missing.join(", ")}`);
      problems++;
    }
    if (extra.length) console.log(`    extras (ok se intencional): ${extra.join(", ")}`);

    for (const id of present) {
      const content = (await fs.readFile(path.join(dir, `${id}.md`), "utf-8")).toLowerCase();
      const hits = FORBIDDEN.filter((term) => content.includes(term));
      if (hits.length) {
        console.log(`    ${id}.md contém termo de persona antiga: ${hits.join(", ")}`);
        problems++;
      }
    }
  }

  // Referências cruzadas devem apontar para ids que existem.
  const agentsDir = path.join(pkgRoot, "assets", "agents");
  const ids = new Set(expected);
  const legacy = Object.keys(map);
  for (const kind of ["agents", "commands"] as const) {
    const dir = path.join(pkgRoot, "assets", kind);
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((name) => name.endsWith(".md"))) {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      const refs = new Set(
        [...content.matchAll(/`([a-z]+)`/g)].map((match) => match[1])
      );
      const orphan = [...refs].filter((ref) => legacy.includes(ref) && !ids.has(ref));
      if (orphan.length) {
        console.log(`    ${kind}/${file} referencia id inexistente: ${orphan.join(", ")}`);
        problems++;
      }
    }
  }
  void agentsDir;

  console.log(
    problems === 0
      ? "\nassets da squad: OK (completo, sem persona antiga, sem referência órfã)"
      : `\n${problems} problema(s) encontrado(s)`
  );
  process.exitCode = problems === 0 ? 0 : 1;
}

main();
