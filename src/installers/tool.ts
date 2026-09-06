import { execa } from "execa";
import type { Item } from "../registry/schema.js";

/** Instala uma ferramenta externa (ex.: uv tool install graphifyy). */
export async function installTool(item: Item, dryRun: boolean): Promise<string> {
  if (!item.tool) throw new Error(`${item.id}: sem spec de tool (cmd/args).`);
  const line = `${item.tool.cmd} ${item.tool.args.join(" ")}`;
  if (dryRun) return `[dry-run] ${line}`;
  await execa(item.tool.cmd, item.tool.args, { stdio: "pipe" });
  return `tool instalada: ${line}`;
}
