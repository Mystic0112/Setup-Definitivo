import path from "node:path";
import { harnessBase } from "../core/targets.js";
import { contentDigest } from "../core/state.js";
import { addCursorMcp, mcpName } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const cursorAdapter = createAdapter({
  id: "cursor",
  nativeSkills: false,
  nativeAgents: false,
  nativeCommands: false,
  plugins: false,
  settings: false,
  installMcp: async (item, ctx) => {
    const file = path.join(harnessBase("cursor", ctx.target), "mcp.json");
    const message = await addCursorMcp(item, file, ctx.dryRun);
    return {
      message,
      artifact: ctx.dryRun ? undefined : {
        type: "mcp",
        path: file,
        name: mcpName(item),
        digest: contentDigest(JSON.stringify({ command: item.mcp!.cmd, args: item.mcp!.args })),
      },
    };
  },
});
