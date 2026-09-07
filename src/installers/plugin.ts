import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { backupFile, exists, writeFileEnsured } from "../core/fsx.js";
import type { Item } from "../registry/schema.js";

/**
 * Config do plugin: `$XDG_CONFIG_HOME/<nome>/config.json`, com fallback
 * `~/.config/<nome>/config.json`. ponytail e caveman leem `defaultMode` daí
 * (a precedência deles é env > config > embutido).
 */
export function pluginConfigFile(name: string): string {
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(base, name, "config.json");
}

/**
 * Grava o nível padrão preservando o resto do config do usuário.
 * Não sobrescreve um `defaultMode` que ele já tenha escolhido.
 */
export async function applyPluginLevel(
  name: string,
  level: string
): Promise<string> {
  const file = pluginConfigFile(name);
  let atual: Record<string, unknown> = {};
  if (await exists(file)) {
    const bruto = await fs.readFile(file, "utf-8");
    try {
      const parsed: unknown = JSON.parse(bruto);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        atual = parsed as Record<string, unknown>;
      }
    } catch {
      return `nível não aplicado: ${file} não é JSON válido`;
    }
    if (typeof atual.defaultMode === "string") {
      return `nível mantido: ${name} já está em "${atual.defaultMode}"`;
    }
    await backupFile(file);
  }
  await writeFileEnsured(file, JSON.stringify({ ...atual, defaultMode: level }, null, 2) + "\n");
  return `nível padrão: ${name} = ${level}`;
}

export interface PluginInstallResult {
  message: string;
  /** Comando para desinstalar; o remove não desfaz plugin, só reporta. */
  removeCommand: string;
}

/**
 * Instala um plugin pelo gerenciador do próprio harness.
 *
 * Não copiamos o conteúdo do plugin: registramos o marketplace e deixamos o
 * harness instalar. Assim o plugin continua recebendo atualizações do autor e
 * não redistribuímos trabalho de terceiro.
 */
export async function installClaudePlugin(
  item: Item,
  dryRun: boolean
): Promise<PluginInstallResult> {
  if (!item.plugin) throw new Error(`${item.id}: sem spec de plugin.`);
  const { marketplace, name } = item.plugin;

  const addMarketplace = ["plugin", "marketplace", "add", marketplace];
  const install = ["plugin", "install", name, "--yes"];
  const removeCommand = `claude plugin uninstall ${name}`;

  const { defaultLevel } = item.plugin;
  const nivel = defaultLevel ? ` (nível: ${defaultLevel})` : "";

  if (dryRun) {
    return {
      message: `[dry-run] claude ${addMarketplace.join(" ")} && claude ${install.join(" ")}${nivel}`,
      removeCommand,
    };
  }

  // Adicionar um marketplace já presente não é erro: seguimos para o install.
  try {
    await execa("claude", addMarketplace, { stdio: "pipe" });
  } catch (error) {
    const detail = (error as { shortMessage?: string }).shortMessage ?? "";
    if (!/already|já/i.test(detail)) throw error;
  }

  await execa("claude", install, { stdio: "pipe" });
  const aplicado = defaultLevel ? `; ${await applyPluginLevel(name, defaultLevel)}` : "";
  return {
    message: `plugin instalado: ${item.id} (${name} de ${marketplace})${aplicado}`,
    removeCommand,
  };
}
