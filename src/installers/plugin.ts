import { execa } from "execa";
import type { Item } from "../registry/schema.js";

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

  if (dryRun) {
    return {
      message: `[dry-run] claude ${addMarketplace.join(" ")} && claude ${install.join(" ")}`,
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
  return { message: `plugin instalado: ${item.id} (${name} de ${marketplace})`, removeCommand };
}
