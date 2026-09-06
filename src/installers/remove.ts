import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "smol-toml";
import { backupFile, exists, writeFileEnsured } from "../core/fsx.js";
import {
  contentDigest,
  directoryDigest,
  stateEntryKey,
  type Artifact,
  type StateEntry,
} from "../core/state.js";
import { removeBlock } from "./config.js";

export interface RemovalResult {
  itemId: string;
  status: "ok" | "skipped" | "error";
  message: string;
  removed: boolean;
  entryKey: string;
}

interface RemovalAction {
  message: string;
  run(): Promise<void>;
}

interface PreflightResult {
  action?: RemovalAction;
  alreadyAbsent?: string;
  refusal?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function preflightDir(artifact: Extract<Artifact, { type: "dir" }>): Promise<PreflightResult> {
  if (!(await exists(artifact.path))) return { alreadyAbsent: `diretório já ausente: ${artifact.path}` };
  const stat = await fs.lstat(artifact.path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    return { refusal: `RECUSADO: ${artifact.path} não é mais o diretório instalado` };
  }
  if (await directoryDigest(artifact.path) !== artifact.digest) {
    return { refusal: `RECUSADO: skill modificada pelo usuário -> ${artifact.path}` };
  }
  return {
    action: {
      message: `apagar diretório -> ${artifact.path}`,
      run: () => fs.rm(artifact.path, { recursive: true }),
    },
  };
}

async function preflightFile(artifact: Extract<Artifact, { type: "file" }>): Promise<PreflightResult> {
  if (!(await exists(artifact.path))) return { alreadyAbsent: `arquivo já ausente: ${artifact.path}` };
  const stat = await fs.lstat(artifact.path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return { refusal: `RECUSADO: ${artifact.path} não é mais o arquivo instalado` };
  }
  if (contentDigest(await fs.readFile(artifact.path, "utf-8")) !== artifact.digest) {
    return { refusal: `RECUSADO: arquivo modificado pelo usuário -> ${artifact.path}` };
  }
  return {
    action: {
      message: `apagar arquivo -> ${artifact.path}`,
      run: () => fs.rm(artifact.path),
    },
  };
}

async function preflightBlock(
  artifact: Extract<Artifact, { type: "block" }>
): Promise<PreflightResult> {
  if (!(await exists(artifact.path))) return { alreadyAbsent: `arquivo já ausente: ${artifact.path}` };
  const current = await fs.readFile(artifact.path, "utf-8");
  let updated: string;
  try {
    updated = removeBlock(current, artifact.blockId);
  } catch (error) {
    return { refusal: `RECUSADO: ${(error as Error).message} em ${artifact.path}` };
  }
  if (updated === current) return { alreadyAbsent: `bloco já ausente: ${artifact.path}` };
  return {
    action: {
      message: `remover bloco "${artifact.blockId}" -> ${artifact.path}`,
      run: async () => {
        await backupFile(artifact.path);
        await writeFileEnsured(artifact.path, updated);
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function preflightCursorMcp(
  artifact: Extract<Artifact, { type: "mcp" }>
): Promise<PreflightResult> {
  if (!(await exists(artifact.path))) return { alreadyAbsent: `arquivo já ausente: ${artifact.path}` };
  const currentText = await fs.readFile(artifact.path, "utf-8");
  let current: unknown;
  try {
    current = JSON.parse(currentText);
  } catch {
    return { refusal: `RECUSADO: JSON inválido em ${artifact.path}` };
  }
  if (!isObject(current) || !isObject(current.mcpServers)) {
    return { refusal: `RECUSADO: mcpServers inválido em ${artifact.path}` };
  }
  const server = current.mcpServers[artifact.name];
  if (server === undefined) return { alreadyAbsent: `MCP já ausente: ${artifact.name}` };
  if (!isObject(server) || contentDigest(JSON.stringify(server)) !== artifact.digest) {
    return { refusal: `RECUSADO: MCP ${artifact.name} foi alterado pelo usuário` };
  }

  const servers = { ...current.mcpServers };
  delete servers[artifact.name];
  const updated = JSON.stringify({ ...current, mcpServers: servers }, null, 2) + "\n";
  return {
    action: {
      message: `remover MCP ${artifact.name} -> ${artifact.path}`,
      run: async () => {
        await backupFile(artifact.path);
        await writeFileEnsured(artifact.path, updated);
      },
    },
  };
}

function tomlSectionRange(
  content: string,
  artifact: Extract<Artifact, { type: "toml-section" }>
): { start: number; end: number; section: string } | undefined {
  const name = escapeRegExp(artifact.name);
  const header = new RegExp(`^[ \\t]*\\[mcp_servers\\.${name}\\][ \\t]*(?:#.*)?(?:\\r?\\n|$)`, "m");
  const match = header.exec(content);
  if (!match) return undefined;
  const following = content.slice(match.index + match[0].length);
  const nextHeader = /^[ \t]*\[\[?[^\]\r\n]+\]\]?[ \t]*(?:#.*)?(?:\r?\n|$)/m.exec(following);
  const end = nextHeader
    ? match.index + match[0].length + nextHeader.index
    : content.length;
  return { start: match.index, end, section: content.slice(match.index, end) };
}

async function preflightCodexMcp(
  artifact: Extract<Artifact, { type: "toml-section" }>
): Promise<PreflightResult> {
  if (!(await exists(artifact.path))) return { alreadyAbsent: `arquivo já ausente: ${artifact.path}` };
  const current = await fs.readFile(artifact.path, "utf-8");
  try {
    parse(current);
  } catch {
    return { refusal: `RECUSADO: TOML inválido em ${artifact.path}` };
  }

  const name = escapeRegExp(artifact.name);
  const subtable = new RegExp(`^[ \\t]*\\[\\[?mcp_servers\\.${name}\\.`, "m");
  if (subtable.test(current)) {
    return { refusal: `RECUSADO: MCP ${artifact.name} possui sub-tabelas não gerenciadas` };
  }
  const range = tomlSectionRange(current, artifact);
  if (!range) return { alreadyAbsent: `seção TOML já ausente: ${artifact.name}` };
  if (contentDigest(range.section.trimEnd()) !== artifact.digest) {
    return { refusal: `RECUSADO: seção TOML ${artifact.name} foi alterada pelo usuário` };
  }

  let start = range.start;
  if (artifact.separator && current.slice(start - artifact.separator.length, start) === artifact.separator) {
    start -= artifact.separator.length;
  } else if (artifact.separator) {
    return { refusal: `RECUSADO: separador da seção TOML ${artifact.name} foi alterado` };
  }
  const updated = current.slice(0, start) + current.slice(range.end);
  try {
    parse(updated);
  } catch {
    return { refusal: `RECUSADO: remover ${artifact.name} deixaria o TOML inválido` };
  }

  return {
    action: {
      message: `remover seção TOML ${artifact.name} -> ${artifact.path}`,
      run: async () => {
        const backup = await backupFile(artifact.path);
        await writeFileEnsured(artifact.path, updated);
        try {
          parse(await fs.readFile(artifact.path, "utf-8"));
        } catch {
          if (backup) await fs.copyFile(backup, artifact.path);
          throw new Error(`${artifact.path} ficou inválido — backup restaurado`);
        }
      },
    },
  };
}

async function preflightArtifact(artifact: Artifact): Promise<PreflightResult> {
  switch (artifact.type) {
    case "dir": return preflightDir(artifact);
    case "file": return preflightFile(artifact);
    case "block": return preflightBlock(artifact);
    case "mcp": return preflightCursorMcp(artifact);
    case "toml-section": return preflightCodexMcp(artifact);
    case "mcp-cli":
      return { refusal: `RECUSADO: remova manualmente com: ${artifact.command}` };
    case "tool":
      return { refusal: `ferramenta mantida; remova manualmente com: ${artifact.command}` };
    case "settings":
      return {
        refusal: `settings mantidos em ${artifact.path}; revise manualmente as chaves: ${artifact.keys.join(", ")}`,
      };
  }
}

export async function removeStateEntry(
  entry: StateEntry,
  dryRun: boolean
): Promise<RemovalResult> {
  const checks = await Promise.all(entry.artifacts.map(preflightArtifact));
  const refusals = checks.flatMap((check) => check.refusal ? [check.refusal] : []);
  if (refusals.length) {
    return {
      itemId: entry.itemId,
      status: "skipped",
      message: `${entry.itemId}: ${refusals.join("; ")}`,
      removed: false,
      entryKey: stateEntryKey(entry),
    };
  }

  const actions = checks.flatMap((check) => check.action ? [check.action] : []);
  const absent = checks.flatMap((check) => check.alreadyAbsent ? [check.alreadyAbsent] : []);
  if (!dryRun) {
    for (const action of actions) await action.run();
  }
  const prefix = dryRun ? "[dry-run] " : "";
  const details = [...actions.map((action) => action.message), ...absent].join("; ");
  return {
    itemId: entry.itemId,
    status: "ok",
    message: `${prefix}${entry.itemId}: ${details || "nenhum artefato presente"}`,
    removed: true,
    entryKey: stateEntryKey(entry),
  };
}
