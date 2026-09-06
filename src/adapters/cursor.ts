import path from "node:path";
import { harnessBase } from "../core/targets.js";
import { addCursorMcp } from "../installers/mcp.js";
import { createAdapter } from "./base.js";

export const cursorAdapter = createAdapter({
  id: "cursor",
  nativeSkills: false,
  settings: false,
  installMcp: (item, ctx) =>
    addCursorMcp(item, path.join(harnessBase("cursor", ctx.target), "mcp.json"), ctx.dryRun),
});
