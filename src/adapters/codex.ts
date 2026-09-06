import fs from "node:fs/promises";
import path from "node:path";
import { harnessBase } from "../core/targets.js";
import { exists } from "../core/fsx.js";
import { contentDigest } from "../core/state.js";
import { addCodexMcp, codexMcpBlock, mcpName } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const codexAdapter = createAdapter({
  id: "codex",
  nativeSkills: false,
  nativeAgents: false,
  nativeCommands: false,
  settings: false,
  installMcp: async (item, ctx) => {
    const file = path.join(harnessBase("codex", "global"), "config.toml");
    const existing = !ctx.dryRun && await exists(file) ? await fs.readFile(file, "utf-8") : "";
    const separator = existing
      ? existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n"
      : "";
    const result = await addCodexMcp(
      item,
      file,
      ctx.dryRun
    );
    const message = ctx.target === "project"
      ? `${result} (escopo global — Codex não suporta MCP por projeto)`
      : result;
    return {
      message,
      artifact: ctx.dryRun || result.includes("pulado") ? undefined : {
        type: "toml-section",
        path: file,
        name: mcpName(item),
        digest: contentDigest(codexMcpBlock(item).trimEnd()),
        separator,
      },
    };
  },
});
