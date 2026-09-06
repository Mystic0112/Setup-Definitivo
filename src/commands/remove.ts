import * as p from "@clack/prompts";
import { getAdapter } from "../adapters/index.js";
import {
  deleteStateEntries,
  readState,
  stateFile,
  type Artifact,
  type StateEntry,
} from "../core/state.js";

export interface RemoveOptions {
  all: boolean;
  dryRun: boolean;
  yes: boolean;
}

function artifactLabel(artifact: Artifact): string {
  if ("path" in artifact) return artifact.path;
  if (artifact.type === "mcp-cli") return artifact.command;
  return artifact.command;
}

function selectedEntries(
  entries: StateEntry[],
  itemIds: string[],
  all: boolean
): StateEntry[] {
  if (all) return entries;
  const requested = new Set(itemIds);
  return entries.filter((entry) => requested.has(entry.itemId));
}

export async function runRemove(
  itemIds: string[],
  options: RemoveOptions,
  manifestFile: string = stateFile()
): Promise<void> {
  if (!options.all && !itemIds.length) {
    console.log("Informe ao menos um itemId ou use --all.");
    process.exitCode = 1;
    return;
  }

  const state = await readState(manifestFile);
  const entries = selectedEntries(state.entries, itemIds, options.all);
  if (!options.all) {
    const found = new Set(entries.map((entry) => entry.itemId));
    for (const itemId of itemIds) {
      if (!found.has(itemId)) console.log(`${itemId}: não consta no manifesto; nada a fazer.`);
    }
  }
  if (!entries.length) {
    if (options.all) console.log("Manifesto vazio; nada a remover.");
    return;
  }

  const paths = [...new Set(entries.flatMap((entry) => entry.artifacts.map(artifactLabel)))];
  p.note(paths.map((value) => `  • ${value}`).join("\n"),
    options.dryRun ? "Remoção prevista (dry-run)" : "Artefatos selecionados");
  if (!options.yes && !options.dryRun) {
    const confirmed = await p.confirm({ message: "Remover os artefatos listados?" });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cancelado; nenhum arquivo foi alterado.");
      return;
    }
  }

  const removedKeys = new Set<string>();
  for (const harness of [...new Set(entries.map((entry) => entry.harness))]) {
    const harnessEntries = entries.filter((entry) => entry.harness === harness);
    const adapter = getAdapter(harness);
    if (!adapter) {
      for (const entry of harnessEntries) {
        p.log.warn(`${entry.itemId}: adapter ${harness} não implementado; manifesto preservado.`);
      }
      process.exitCode = 1;
      continue;
    }
    const results = await adapter.remove(harnessEntries, { dryRun: options.dryRun });
    for (const result of results) {
      p.log.step(result.message);
      if (result.removed) removedKeys.add(result.entryKey);
      if (result.status === "error" || !result.removed) process.exitCode = 1;
    }
  }

  if (!options.dryRun) await deleteStateEntries(removedKeys, manifestFile);
}
