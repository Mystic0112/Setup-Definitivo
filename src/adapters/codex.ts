import path from "node:path";
import { harnessBase } from "../core/targets.js";
import { addCodexMcp } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const codexAdapter = createAdapter({
  id: "codex",
  nativeSkills: false,
  settings: false,
  installMcp: async (item, ctx) => {
    const result = await addCodexMcp(
      item,
      path.join(harnessBase("codex", "global"), "config.toml"),
      ctx.dryRun
    );
    return ctx.target === "project"
      ? `${result} (escopo global — Codex não suporta MCP por projeto)`
      : result;
  },
});
