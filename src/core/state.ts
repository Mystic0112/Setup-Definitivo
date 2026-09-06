import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { backupFile, exists, writeFileEnsured } from "./fsx.js";
import { HarnessSchema, TargetSchema } from "../registry/schema.js";

const AbsolutePathSchema = z.string().refine(path.isAbsolute, "caminho deve ser absoluto");

const ArtifactSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dir"), path: AbsolutePathSchema, digest: z.string() }),
  // arquivo .md único (agent/command); digest permite recusar remoção se o usuário editou
  z.object({ type: z.literal("file"), path: AbsolutePathSchema, digest: z.string() }),
  z.object({ type: z.literal("block"), path: AbsolutePathSchema, blockId: z.string() }),
  z.object({
    type: z.literal("mcp"),
    path: AbsolutePathSchema,
    name: z.string(),
    digest: z.string(),
  }),
  z.object({
    type: z.literal("toml-section"),
    path: AbsolutePathSchema,
    name: z.string(),
    digest: z.string(),
    separator: z.enum(["", "\n", "\n\n"]),
  }),
  z.object({ type: z.literal("mcp-cli"), name: z.string(), command: z.string() }),
  z.object({ type: z.literal("tool"), command: z.string() }),
  z.object({ type: z.literal("settings"), path: AbsolutePathSchema, keys: z.array(z.string()) }),
]);

const StateEntrySchema = z.object({
  itemId: z.string(),
  kind: z.enum(["mcp", "skill", "agent", "command", "plugin", "tool", "config"]),
  harness: HarnessSchema,
  target: TargetSchema,
  projectRoot: AbsolutePathSchema.nullable(),
  artifacts: z.array(ArtifactSchema).nonempty(),
  installedAt: z.string().datetime(),
});

const StateSchema = z.object({
  version: z.literal(1),
  entries: z.array(StateEntrySchema),
});

export type Artifact = z.infer<typeof ArtifactSchema>;
export type StateEntry = z.infer<typeof StateEntrySchema>;
export type State = z.infer<typeof StateSchema>;

export function stateFile(): string {
  return path.join(os.homedir(), ".setup-definitivo", "state.json");
}

export function contentDigest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function directoryDigest(root: string): Promise<string> {
  const hash = createHash("sha256");

  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        hash.update(`dir\0${relative}\0`);
        await visit(absolute);
      } else if (entry.isFile()) {
        hash.update(`file\0${relative}\0`);
        hash.update(await fs.readFile(absolute));
        hash.update("\0");
      } else {
        hash.update(`other\0${relative}\0`);
      }
    }
  }

  await visit(root);
  return hash.digest("hex");
}

export function stateEntryKey(entry: StateEntry): string {
  return [entry.itemId, entry.harness, entry.target, entry.projectRoot ?? ""].join("\0");
}

export async function readState(file: string = stateFile()): Promise<State> {
  if (!(await exists(file))) return { version: 1, entries: [] };
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, "utf-8"));
    return StateSchema.parse(parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: manifesto de estado inválido — ${detail}`);
  }
}

export async function writeState(state: State, file: string = stateFile()): Promise<void> {
  const validated = StateSchema.parse(state);
  const content = JSON.stringify(validated, null, 2) + "\n";
  const fileExists = await exists(file);
  const current = fileExists ? await fs.readFile(file, "utf-8") : "";
  if (fileExists) await readState(file);
  if (content === current) {
    await fs.chmod(file, 0o600);
    return;
  }
  await backupFile(file);
  await writeFileEnsured(file, content);
  await fs.chmod(file, 0o600);
}

export async function upsertStateEntries(
  entries: StateEntry[],
  file: string = stateFile()
): Promise<void> {
  if (!entries.length) return;
  const state = await readState(file);
  const replacements = new Map(entries.map((entry) => [stateEntryKey(entry), entry]));
  const preserved = state.entries.filter((entry) => !replacements.has(stateEntryKey(entry)));
  await writeState({ version: 1, entries: [...preserved, ...entries] }, file);
}

export async function deleteStateEntries(
  keys: Set<string>,
  file: string = stateFile()
): Promise<void> {
  if (!keys.size) return;
  const state = await readState(file);
  await writeState({
    version: 1,
    entries: state.entries.filter((entry) => !keys.has(stateEntryKey(entry))),
  }, file);
}
