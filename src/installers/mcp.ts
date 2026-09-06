import { execa } from "execa";
import type { Item } from "../registry/schema.js";

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
