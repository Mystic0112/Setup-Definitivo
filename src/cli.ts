#!/usr/bin/env node
import { Command } from "commander";
import { runDoctor } from "./commands/doctor.js";
import { CATALOG } from "./registry/items.js";
import { runInit } from "./wizard.js";

const program = new Command();

program
  .name("setup-definitivo")
  .description(
    "Configura um ambiente de IA completo (MCPs, skills, tools, config) em qualquer harness."
  )
  .version("0.0.1");

program
  .command("init")
  .description("Wizard interativo: escolhe harness, alvo e itens, e aplica.")
  .option("--dry-run", "mostra o que faria sem escrever nada", false)
  .action(async (opts) => {
    await runInit({ dryRun: opts.dryRun });
  });

program
  .command("list")
  .description("Lista os itens do catálogo.")
  .action(() => {
    const byKind: Record<string, typeof CATALOG> = {};
    for (const item of CATALOG) (byKind[item.kind] ??= []).push(item);
    for (const kind of Object.keys(byKind).sort()) {
      console.log(`\n${kind.toUpperCase()}`);
      for (const it of byKind[kind]) {
        const flag = it.needsSecret ? " 🔑" : "";
        console.log(`  ${it.id}${flag}  —  ${it.description}`);
      }
    }
    console.log("");
  });

program
  .command("doctor")
  .description("Diagnostica binários, harnesses e catálogo.")
  .action(async () => {
    await runDoctor();
  });

// Stubs das próximas fases — declarados para o --help já refletir o roadmap.
for (const [cmd, desc] of [
  ["add", "Adiciona um item específico sem o wizard."],
  ["remove", "Remove um item e reverte a config."],
  ["update", "Atualiza itens instalados para o catálogo atual."],
] as const) {
  program
    .command(cmd)
    .description(`${desc} (em construção)`)
    .action(() => {
      console.log(`\n"${cmd}" ainda não implementado — ver roadmap em docs/PLAN.md\n`);
      process.exitCode = 1;
    });
}

program.parseAsync();
