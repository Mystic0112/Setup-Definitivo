#!/usr/bin/env node
import { Command } from "commander";
import { runAdd } from "./commands/add.js";
import { runDoctor } from "./commands/doctor.js";
import { runRemove } from "./commands/remove.js";
import { runUpdate } from "./commands/update.js";
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

program
  .command("remove")
  .description("Remove itens registrados no manifesto, com verificações conservadoras.")
  .argument("[itemId...]", "IDs dos itens a remover")
  .option("--all", "remove todas as entradas do manifesto", false)
  .option("--dry-run", "mostra exatamente o que removeria sem escrever", false)
  .option("--yes", "não pede confirmação", false)
  .action(async (itemIds: string[], opts) => {
    await runRemove(itemIds, {
      all: opts.all,
      dryRun: opts.dryRun,
      yes: opts.yes,
    });
  });

program
  .command("update")
  .description("Reaplica os itens do manifesto usando o catálogo atual.")
  .option("--dry-run", "mostra o que reaplicaria sem escrever", false)
  .action(async (opts) => {
    await runUpdate({ dryRun: opts.dryRun });
  });

program
  .command("add")
  .description("Adiciona itens específicos sem o wizard (resolve dependências).")
  .argument("<itemId...>", "IDs do catálogo (ex.: agent:backend mcp:notebooklm)")
  .option("--harness <name...>", "harness alvo; padrão: os detectados", [])
  .option("--project", "aplica no projeto atual em vez de global", false)
  .option("--dry-run", "mostra o que faria sem escrever", false)
  .action(async (itemIds: string[], opts) => {
    await runAdd(itemIds, {
      harness: opts.harness,
      project: opts.project,
      dryRun: opts.dryRun,
    });
  });

program.parseAsync();
