import { addClaudeMcp, mcpName } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const claudeAdapter = createAdapter({
  id: "claude",
  nativeSkills: true,
  nativeAgents: true,
  nativeCommands: true,
  settings: true,
  installMcp: async (item, ctx) => ({
    message: await addClaudeMcp(item, ctx.dryRun),
    artifact: ctx.dryRun ? undefined : {
      type: "mcp-cli",
      name: mcpName(item),
      command: `claude mcp remove ${mcpName(item)}`,
    },
  }),
});
