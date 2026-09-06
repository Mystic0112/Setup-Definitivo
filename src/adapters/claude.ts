import path from "node:path";
import type { Adapter, ApplyContext } from "./types.js";
import type { Item, Target } from "../registry/schema.js";
import { harnessBase, skillsDir, settingsFile, instructionFile } from "../core/targets.js";
import { exists, writeFileEnsured, backupFile } from "../core/fsx.js";
import { installSkill } from "../installers/skill.js";
import { installTool } from "../installers/tool.js";
import { addClaudeMcp } from "../installers/mcp.js";
import { applySettings, applyInstruction } from "../installers/config.js";
import { roleSkillContent, handoffContent, type Role } from "../generators/roles.js";

export const claudeAdapter: Adapter = {
  id: "claude",

  async detect(target: Target): Promise<boolean> {
    return exists(harnessBase("claude", target));
  },

  async apply(items: Item[], ctx: ApplyContext): Promise<string[]> {
    const log: string[] = [];

    for (const item of items) {
      try {
        switch (item.kind) {
          case "skill":
            log.push(await installSkill(item, "claude", ctx.target, ctx.dryRun));
            break;
          case "mcp":
            log.push(await addClaudeMcp(item, ctx.dryRun));
            if (item.needsSecret && item.guide)
              log.push(`  ↳ credencial necessária — ver ${item.guide}`);
            break;
          case "tool":
            log.push(await installTool(item, ctx.dryRun));
            break;
          case "config": {
            if (item.config?.settings) {
              log.push(
                await applySettings(
                  settingsFile("claude", ctx.target),
                  item.config.settings,
                  ctx.dryRun
                )
              );
            }
            if (item.config?.instruction) {
              log.push(
                await applyInstruction(
                  instructionFile("claude", ctx.target),
                  item.config.blockId ?? item.id,
                  item.config.instruction,
                  ctx.dryRun
                )
              );
            }
            break;
          }
        }
      } catch (err) {
        log.push(`ERRO ${item.id}: ${(err as Error).message}`);
      }
    }

    // Skill de papel + handoff quando há pipeline
    if (ctx.pipeline && ctx.pipeline.roles["claude"]?.length) {
      const roles = ctx.pipeline.roles["claude"] as Role[];
      const skillFile = path.join(skillsDir("claude", ctx.target), "pipeline-role", "SKILL.md");
      const handoff = path.join(
        ctx.target === "project" ? process.cwd() : harnessBase("claude", "global"),
        "HANDOFF.md"
      );
      if (ctx.dryRun) {
        log.push(`[dry-run] gerar skill de papel -> ${skillFile}`);
        log.push(`[dry-run] gerar handoff -> ${handoff}`);
      } else {
        await writeFileEnsured(skillFile, roleSkillContent("claude", roles, ctx.pipeline));
        const bak = await backupFile(handoff);
        if (bak) log.push(`backup: ${bak}`);
        await writeFileEnsured(handoff, handoffContent(ctx.pipeline));
        log.push(`skill de papel gerada -> ${skillFile}`);
        log.push(`handoff gerado -> ${handoff}`);
      }
    }

    return log;
  },
};
