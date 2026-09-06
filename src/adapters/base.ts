import path from "node:path";
import type { Item, Harness } from "../registry/schema.js";
import { harnessBase, instructionFile, settingsFile, skillsDir } from "../core/targets.js";
import { exists, writeFileEnsured } from "../core/fsx.js";
import { directoryDigest, stateEntryKey, type Artifact } from "../core/state.js";
import { applyInstruction, applySettings } from "../installers/config.js";
import {
  installSkill,
  installSkillAsInstruction,
  instructionMarkdown,
  skillName,
} from "../installers/skill.js";
import { installMarkdownFile, markdownFileAsInstruction } from "../installers/markdownFile.js";
import { removeStateEntry } from "../installers/remove.js";
import { roleSkillContent } from "../generators/roles.js";
import type { Adapter, ApplyContext, ItemResult } from "./types.js";

export interface McpInstallResult {
  message: string;
  artifact?: Artifact;
}

interface AdapterOptions {
  id: Harness;
  nativeSkills: boolean;
  nativeAgents: boolean;
  nativeCommands: boolean;
  settings: boolean;
  installMcp(item: Item, ctx: ApplyContext): Promise<McpInstallResult>;
}

function nestedKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null && !Array.isArray(child)
      ? nestedKeys(child as Record<string, unknown>, full)
      : [full];
  });
}

function itemResult(itemId: string, message: string, artifacts?: Artifact[]): ItemResult {
  return {
    itemId,
    status: message.split("\n").every((line) => line.startsWith("PULADO"))
      ? "skipped"
      : "ok",
    message,
    ...(artifacts?.length ? { artifacts } : {}),
  };
}

async function applyConfig(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<ItemResult> {
  const messages: string[] = [];
  const artifacts: Artifact[] = [];
  if (item.config?.settings) {
    const file = settingsFile(options.id, ctx.target);
    if (options.settings) {
      messages.push(await applySettings(file, item.config.settings, ctx.dryRun));
      if (!ctx.dryRun) artifacts.push({
        type: "settings",
        path: file,
        keys: nestedKeys(item.config.settings),
      });
    } else {
      messages.push(`PULADO ${item.id}: ${options.id} não possui settings.json equivalente`);
    }
  }
  if (item.config?.instruction) {
    const file = instructionFile(options.id, ctx.target);
    const blockId = item.config.blockId ?? item.id;
    messages.push(await applyInstruction(file, blockId, item.config.instruction, ctx.dryRun));
    if (!ctx.dryRun) artifacts.push({ type: "block", path: file, blockId });
  }
  return itemResult(item.id, messages.join("\n"), artifacts);
}

async function applySkill(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<ItemResult> {
  if (!options.nativeSkills) {
    const file = instructionFile(options.id, ctx.target);
    const message = await installSkillAsInstruction(item, file, ctx.dryRun);
    const artifacts = !ctx.dryRun && !message.startsWith("PULADO")
      ? [{ type: "block", path: file, blockId: item.id } satisfies Artifact]
      : undefined;
    return itemResult(item.id, message, artifacts);
  }

  const directory = path.join(skillsDir(options.id, ctx.target), skillName(item));
  const existedBefore = await exists(directory);
  const message = await installSkill(item, options.id, ctx.target, ctx.dryRun);
  const artifacts = !ctx.dryRun && !message.startsWith("PULADO") && !existedBefore
    ? [{ type: "dir", path: directory, digest: await directoryDigest(directory) } satisfies Artifact]
    : undefined;
  return itemResult(item.id, message, artifacts);
}

/**
 * agent e command são arquivos .md únicos. Onde o harness não tem esses
 * conceitos, degradam para bloco de instrução — igual às skills.
 */
async function applyMarkdownFile(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<ItemResult> {
  const supported = item.kind === "command" ? options.nativeCommands : options.nativeAgents;

  if (!supported) {
    const file = instructionFile(options.id, ctx.target);
    if (ctx.dryRun) {
      return itemResult(
        item.id,
        `[dry-run] ${item.kind} convertido em instrução (harness sem ${item.kind}) -> ${file}`
      );
    }
    const content = await markdownFileAsInstruction(item);
    if (content === null) {
      return itemResult(item.id, `PULADO ${item.id}: assets ausentes — rodar 'npm run pack:skills'`);
    }
    const message = await applyInstruction(file, item.id, content, false);
    return itemResult(
      item.id,
      `${item.kind} convertido em instrução (harness sem ${item.kind}): ${message}`,
      [{ type: "block", path: file, blockId: item.id } satisfies Artifact]
    );
  }

  const installed = await installMarkdownFile(item, options.id, ctx.target, ctx.dryRun);
  return itemResult(
    item.id,
    installed.message,
    installed.artifacts.length ? installed.artifacts : undefined
  );
}

async function applyItem(
  options: AdapterOptions,
  item: Item,
  ctx: ApplyContext
): Promise<ItemResult> {
  switch (item.kind) {
    case "skill":
      return applySkill(options, item, ctx);
    case "agent":
    case "command":
      return applyMarkdownFile(options, item, ctx);
    case "mcp": {
      const installed = await options.installMcp(item, ctx);
      const guide = item.needsSecret && item.guide
        ? `\n  ↳ credencial necessária — ver ${item.guide}`
        : "";
      return itemResult(
        item.id,
        installed.message + guide,
        installed.artifact ? [installed.artifact] : undefined
      );
    }
    case "tool":
      return itemResult(item.id, `PULADO ${item.id}: tools são aplicadas fora do adapter`);
    case "config":
      return applyConfig(options, item, ctx);
  }
}

async function applyItems(
  options: AdapterOptions,
  items: Item[],
  ctx: ApplyContext
): Promise<ItemResult[]> {
  const results: ItemResult[] = [];
  for (const item of items) {
    try {
      results.push(await applyItem(options, item, ctx));
    } catch (error) {
      results.push({
        itemId: item.id,
        status: "error",
        message: `ERRO ${item.id}: ${(error as Error).message}`,
      });
    }
  }
  return results;
}

async function applyPipelineRole(
  options: AdapterOptions,
  ctx: ApplyContext
): Promise<ItemResult | undefined> {
  const roles = ctx.pipeline?.roles[options.id];
  if (!ctx.pipeline || !roles?.length) return undefined;
  const content = roleSkillContent(options.id, roles, ctx.pipeline);
  if (!options.nativeSkills) {
    const file = instructionFile(options.id, ctx.target);
    const message = await applyInstruction(
      file,
      "pipeline-role",
      instructionMarkdown(content),
      ctx.dryRun
    );
    return itemResult(
      "skill:pipeline-role",
      `papel convertido em instrução (harness sem skills nativas): ${message}`,
      ctx.dryRun ? undefined : [{ type: "block", path: file, blockId: "pipeline-role" }]
    );
  }

  const file = path.join(skillsDir(options.id, ctx.target), "pipeline-role", "SKILL.md");
  const directory = path.dirname(file);
  const existedBefore = await exists(directory);
  const message = ctx.dryRun
    ? `[dry-run] gerar skill de papel -> ${file}`
    : `skill de papel gerada -> ${file}`;
  if (!ctx.dryRun) await writeFileEnsured(file, content);
  const artifacts = !ctx.dryRun && !existedBefore
    ? [{ type: "dir", path: directory, digest: await directoryDigest(directory) } satisfies Artifact]
    : undefined;
  return itemResult("skill:pipeline-role", message, artifacts);
}

export function createAdapter(options: AdapterOptions): Adapter {
  return {
    id: options.id,
    detect(target) {
      return exists(harnessBase(options.id, target));
    },
    async apply(items, ctx) {
      const results = await applyItems(options, items, ctx);
      const pipelineRole = await applyPipelineRole(options, ctx);
      if (pipelineRole) results.push(pipelineRole);
      return results;
    },
    async remove(entries, ctx) {
      const results = [];
      for (const entry of entries) {
        try {
          results.push(await removeStateEntry(entry, ctx.dryRun));
        } catch (error) {
          results.push({
            itemId: entry.itemId,
            status: "error" as const,
            message: `ERRO ${entry.itemId}: ${(error as Error).message}`,
            removed: false,
            entryKey: stateEntryKey(entry),
          });
        }
      }
      return results;
    },
  };
}
