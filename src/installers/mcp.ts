import fs from "node:fs/promises";
import { execa } from "execa";
import { parse } from "smol-toml";
import { backupFile, exists, writeFileEnsured } from "../core/fsx.js";
import type { Item } from "../registry/schema.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function parseToml(content: string, file: string): Record<string, unknown> {
  try {
    const parsed: unknown = parse(content);
    if (!isObject(parsed)) throw new Error("raiz não é objeto");
    return parsed;
  } catch {
    throw new Error(`${file} não é TOML válido — nenhuma mudança aplicada`);
  }
}

function hasCodexServer(config: Record<string, unknown>, name: string): boolean {
  const servers = config.mcp_servers;
  return isObject(servers) && Object.prototype.hasOwnProperty.call(servers, name);
}

/** Nome curto do MCP a partir do id (mcp:clickup -> clickup). */
export function mcpName(item: Item): string {
  return item.id.split(":")[1];
}

/** Args do `claude mcp add <name> -- <cmd> <args...>`. */
export function claudeMcpArgs(item: Item): string[] {
  if (!item.mcp) throw new Error(`${item.id}: sem spec de mcp (cmd/args).`);
  return ["mcp", "add", mcpName(item), "--", item.mcp.cmd, ...item.mcp.args];
}

/** Registra o MCP no Claude. Em dry-run só descreve. */
export async function addClaudeMcp(
  item: Item,
  dryRun: boolean
): Promise<string> {
  const args = claudeMcpArgs(item);
  const line = `claude ${args.join(" ")}`;
  if (dryRun) return `[dry-run] ${line}`;
  await execa("claude", args, { stdio: "pipe" });
  return `registrado: ${line}`;
}

/** Registra um MCP no mcp.json do Cursor, preservando os demais servidores. */
export async function addCursorMcp(
  item: Item,
  file: string,
  dryRun: boolean
): Promise<string> {
  if (!item.mcp) throw new Error(`${item.id}: sem spec de mcp (cmd/args).`);
  if (dryRun) return `[dry-run] registrar ${item.id} -> ${file}`;

  const fileExists = await exists(file);
  const existing = fileExists ? await fs.readFile(file, "utf-8") : "";
  let current: Record<string, unknown> = {};
  if (fileExists) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      throw new Error(`${file} não é JSON válido — nenhuma mudança aplicada`);
    }
    if (!isObject(parsed)) throw new Error(`${file} deve conter um objeto JSON`);
    current = parsed;
  }

  const servers = current.mcpServers;
  if (servers !== undefined && !isObject(servers)) {
    throw new Error(`${file}: mcpServers deve ser um objeto JSON`);
  }
  const name = mcpName(item);
  const currentServers = servers ?? {};
  const previous = isObject(currentServers[name]) ? currentServers[name] : {};
  const updated = JSON.stringify({
    ...current,
    mcpServers: {
      ...currentServers,
      [name]: { ...previous, command: item.mcp.cmd, args: item.mcp.args },
    },
  }, null, 2) + "\n";
  if (updated === existing) return `já existe: ${item.id}, sem mudanças`;

  const backup = await backupFile(file);
  await writeFileEnsured(file, updated);
  return `registrado: ${item.id} -> ${file}${backup ? ` (backup: ${backup})` : ""}`;
}

/** Serializa apenas o bloco simples aceito pelo config.toml do Codex. */
export function codexMcpBlock(item: Item): string {
  if (!item.mcp) throw new Error(`${item.id}: sem spec de mcp (cmd/args).`);
  const args = item.mcp.args.map(tomlString).join(", ");
  return [
    `[mcp_servers.${mcpName(item)}]`,
    `command = ${tomlString(item.mcp.cmd)}`,
    `args = [${args}]`,
    "",
  ].join("\n");
}

/** Acrescenta um MCP ao config.toml do Codex sem reescrever conteúdo existente. */
export async function addCodexMcp(
  item: Item,
  file: string,
  dryRun: boolean
): Promise<string> {
  const block = codexMcpBlock(item);
  if (dryRun) return `[dry-run] anexar ${item.id} -> ${file}`;

  const fileExists = await exists(file);
  const existing = fileExists ? await fs.readFile(file, "utf-8") : "";
  const parsed = parseToml(existing, file);
  if (hasCodexServer(parsed, mcpName(item))) return `já existe: ${item.id}, pulado`;

  if (!fileExists) {
    parseToml(block, file);
    await writeFileEnsured(file, block);
    return `registrado: ${item.id} -> ${file}`;
  }

  const separator = existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  const backup = await backupFile(file);
  await fs.appendFile(file, separator + block, "utf-8");
  try {
    parseToml(await fs.readFile(file, "utf-8"), file);
  } catch {
    if (backup) await fs.copyFile(backup, file);
    throw new Error(`${file} ficaria inválido — backup restaurado`);
  }
  return `registrado: ${item.id} -> ${file} (backup: ${backup})`;
}
