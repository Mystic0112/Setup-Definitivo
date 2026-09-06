import path from "node:path";
import type { Item, Harness } from "../registry/schema.js";
import { harnessBase, instructionFile, settingsFile, skillsDir } from "../core/targets.js";
import { exists, writeFileEnsured } from "../core/fsx.js";
import { applyInstruction, applySettings } from "../installers/config.js";
import {
  installSkill,
  installSkillAsInstruction,
  instructionMarkdown,
} from "../installers/skill.js";
import { roleSkillContent } from "../generators/roles.js";
import type { Adapter, ApplyContext } from "./types.js";

interface AdapterOptions {
  id: Harness;
  nativeSkills: boolean;
  settings: boolean;
  installMcp(item: Item, ctx: ApplyContext): Promise<string>;
}

async function applyConfig(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<string[]> {
  const log: string[] = [];
  if (item.config?.settings) {
    log.push(options.settings
      ? await applySettings(settingsFile(options.id, ctx.target), item.config.settings, ctx.dryRun)
      : `PULADO ${item.id}: ${options.id} não possui settings.json equivalente`);
  }
  if (item.config?.instruction) {
    log.push(await applyInstruction(
      instructionFile(options.id, ctx.target),
      item.config.blockId ?? item.id,
      item.config.instruction,
      ctx.dryRun
    ));
  }
  return log;
}

async function applyItem(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<string[]> {
  switch (item.kind) {
    case "skill":
      return [options.nativeSkills
        ? await installSkill(item, options.id, ctx.target, ctx.dryRun)
        : await installSkillAsInstruction(
          item,
          instructionFile(options.id, ctx.target),
          ctx.dryRun
        )];
    case "mcp": {
      const log = [await options.installMcp(item, ctx)];
      if (item.needsSecret && item.guide) {
        log.push(`  ↳ credencial necessária — ver ${item.guide}`);
      }
      return log;
    }
    case "tool":
      return [`PULADO ${item.id}: tools são aplicadas fora do adapter`];
    case "config":
      return applyConfig(options, item, ctx);
  }
}

async function applyItems(
  options: AdapterOptions,
  items: Item[],
  ctx: ApplyContext
): Promise<string[]> {
  const log: string[] = [];
  for (const item of items) {
    try {
      log.push(...await applyItem(options, item, ctx));
    } catch (err) {
      log.push(`ERRO ${item.id}: ${(err as Error).message}`);
    }
  }
  return log;
}

async function applyPipelineRole(
  options: AdapterOptions,
  ctx: ApplyContext,
  log: string[]
): Promise<void> {
  const roles = ctx.pipeline?.roles[options.id];
  if (!ctx.pipeline || !roles?.length) return;
  const content = roleSkillContent(options.id, roles, ctx.pipeline);
  if (!options.nativeSkills) {
    const result = await applyInstruction(
      instructionFile(options.id, ctx.target),
      "pipeline-role",
      instructionMarkdown(content),
      ctx.dryRun
    );
    log.push(`papel convertido em instrução (harness sem skills nativas): ${result}`);
    return;
  }

  const file = path.join(skillsDir(options.id, ctx.target), "pipeline-role", "SKILL.md");
  if (ctx.dryRun) log.push(`[dry-run] gerar skill de papel -> ${file}`);
  else {
    await writeFileEnsured(file, content);
    log.push(`skill de papel gerada -> ${file}`);
  }
}

export function createAdapter(options: AdapterOptions): Adapter {
  return {
    id: options.id,
    detect(target) {
      return exists(harnessBase(options.id, target));
    },
    async apply(items, ctx) {
      const log = await applyItems(options, items, ctx);
      await applyPipelineRole(options, ctx, log);
      return log;
    },
  };
}
