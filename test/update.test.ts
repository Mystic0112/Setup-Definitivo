import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as prompts from "@clack/prompts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runUpdate } from "../src/commands/update.js";
import { claudeAdapter } from "../src/adapters/claude.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { agentsDir } from "../src/core/targets.js";
import { readState, upsertStateEntries, writeState } from "../src/core/state.js";
import type { StateEntry } from "../src/core/state.js";

function silenceLog() {
  vi.spyOn(prompts.log, "step").mockImplementation(() => {});
  vi.spyOn(prompts.log, "warn").mockImplementation(() => {});
}

async function inTempProject(
  run: (dir: string, manifest: string) => Promise<void>
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-update-"));
  const previous = process.cwd();
  process.chdir(dir);
  silenceLog();
  try {
    await run(dir, path.join(dir, "state.json"));
  } finally {
    process.chdir(previous);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function installAgent(dir: string, manifest: string): Promise<StateEntry> {
  const { CATALOG } = await import("../src/registry/items.js");
  const item = CATALOG.find((candidate) => candidate.id === "agent:backend")!;
  const results = await claudeAdapter.apply([item], { target: "project", dryRun: false });
  const entry: StateEntry = {
    itemId: "agent:backend",
    kind: "agent",
    harness: "claude",
    target: "project",
    projectRoot: dir,
    artifacts: results[0].artifacts as StateEntry["artifacts"],
    installedAt: new Date(0).toISOString(),
  };
  await upsertStateEntries([entry], manifest);
  return entry;
}

describe("update", () => {
  it("avisa e não faz nada com manifesto vazio", async () => {
    await inTempProject(async (_dir, manifest) => {
      await writeState({ version: 1, entries: [] }, manifest);
      await runUpdate({ dryRun: false }, manifest);
      expect((await readState(manifest)).entries).toHaveLength(0);
    });
  });

  it("reaplica o item e atualiza o installedAt no manifesto", async () => {
    await inTempProject(async (dir, manifest) => {
      const entry = await installAgent(dir, manifest);
      const file = path.join(agentsDir("claude", "project", dir), "backend.md");
      await fs.rm(file); // simula arquivo perdido

      await runUpdate({ dryRun: false }, manifest);

      expect(await fs.readFile(file, "utf-8")).toContain("name: backend");
      const after = (await readState(manifest)).entries[0];
      expect(after.installedAt).not.toBe(entry.installedAt);
    });
  });

  it("é idempotente: não reescreve arquivo idêntico nem gera backup", async () => {
    await inTempProject(async (dir, manifest) => {
      await installAgent(dir, manifest);
      const directory = agentsDir("claude", "project", dir);
      const before = (await fs.readdir(directory)).sort();

      await runUpdate({ dryRun: false }, manifest);
      await runUpdate({ dryRun: false }, manifest);

      expect((await fs.readdir(directory)).sort()).toEqual(before);
      expect(before.some((name) => name.includes(".bak-"))).toBe(false);
    });
  });

  it("dry-run não escreve arquivo nem toca o manifesto", async () => {
    await inTempProject(async (dir, manifest) => {
      const entry = await installAgent(dir, manifest);
      const file = path.join(agentsDir("claude", "project", dir), "backend.md");
      await fs.rm(file);

      await runUpdate({ dryRun: true }, manifest);

      await expect(fs.access(file)).rejects.toThrow();
      expect((await readState(manifest)).entries[0].installedAt).toBe(entry.installedAt);
    });
  });

  // Hoje os adapters não retornam artifacts em dry-run, então a guarda de
  // dryRun no update fica sombreada por esse invariante implícito. Este teste
  // força um adapter a devolver artifacts em dry-run: sem a guarda, o manifesto
  // seria gravado durante um dry-run.
  it("não grava manifesto em dry-run nem se o adapter devolver artifacts", async () => {
    await inTempProject(async (dir, manifest) => {
      const entry = await installAgent(dir, manifest);
      vi.spyOn(claudeAdapter, "apply").mockResolvedValue([
        {
          itemId: "agent:backend",
          status: "ok",
          message: "[dry-run] simulado",
          artifacts: [{ type: "file", path: path.join(dir, "x.md"), digest: "novo-digest" }],
        },
      ]);

      await runUpdate({ dryRun: true }, manifest);

      const after = (await readState(manifest)).entries[0];
      expect(after.installedAt).toBe(entry.installedAt);
      expect(after.artifacts).toEqual(entry.artifacts);
    });
  });

  it("mantém item que saiu do catálogo, sem apagar nem falhar", async () => {
    await inTempProject(async (dir, manifest) => {
      const orphan: StateEntry = {
        itemId: "agent:nao-existe-mais",
        kind: "agent",
        harness: "claude",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "file", path: path.join(dir, "orfao.md"), digest: "x" }],
        installedAt: new Date(0).toISOString(),
      };
      await fs.writeFile(path.join(dir, "orfao.md"), "conteúdo\n");
      await upsertStateEntries([orphan], manifest);

      await runUpdate({ dryRun: false }, manifest);

      expect(await fs.readFile(path.join(dir, "orfao.md"), "utf-8")).toBe("conteúdo\n");
      expect((await readState(manifest)).entries).toHaveLength(1);
    });
  });

  it("não duplica o bloco de instrução em harness degradado", async () => {
    await inTempProject(async (dir, manifest) => {
      const { CATALOG } = await import("../src/registry/items.js");
      const item = CATALOG.find((candidate) => candidate.id === "agent:backend")!;
      const results = await cursorAdapter.apply([item], { target: "project", dryRun: false });
      await upsertStateEntries(
        [{
          itemId: "agent:backend",
          kind: "agent",
          harness: "cursor",
          target: "project",
          projectRoot: dir,
          artifacts: results[0].artifacts as StateEntry["artifacts"],
          installedAt: new Date(0).toISOString(),
        }],
        manifest
      );

      await runUpdate({ dryRun: false }, manifest);
      await runUpdate({ dryRun: false }, manifest);

      const rules = await fs.readFile(path.join(dir, ".cursorrules"), "utf-8");
      expect(rules.match(/setup-definitivo:start:agent:backend/g)).toHaveLength(1);
    });
  });

  it("preserva conteúdo do usuário fora do bloco gerenciado", async () => {
    await inTempProject(async (dir, manifest) => {
      const { CATALOG } = await import("../src/registry/items.js");
      const item = CATALOG.find((candidate) => candidate.id === "agent:backend")!;
      const results = await cursorAdapter.apply([item], { target: "project", dryRun: false });
      await upsertStateEntries(
        [{
          itemId: "agent:backend",
          kind: "agent",
          harness: "cursor",
          target: "project",
          projectRoot: dir,
          artifacts: results[0].artifacts as StateEntry["artifacts"],
          installedAt: new Date(0).toISOString(),
        }],
        manifest
      );
      const rules = path.join(dir, ".cursorrules");
      await fs.appendFile(rules, "\n## Regra própria do usuário\n");

      await runUpdate({ dryRun: false }, manifest);

      expect(await fs.readFile(rules, "utf-8")).toContain("## Regra própria do usuário");
    });
  });
});
