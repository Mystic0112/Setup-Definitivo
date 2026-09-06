import { addClaudeMcp } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const claudeAdapter = createAdapter({
  id: "claude",
  nativeSkills: true,
  settings: true,
  installMcp: (item, ctx) => addClaudeMcp(item, ctx.dryRun),
});
