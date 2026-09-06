import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as prompts from "@clack/prompts";
import { parse } from "smol-toml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRemove } from "../src/commands/remove.js";
import { applyPlan } from "../src/wizard.js";
import {
  contentDigest,
  directoryDigest,
  readState,
  upsertStateEntries,
  writeState,
  type Artifact,
  type StateEntry,
} from "../src/core/state.js";
import { removeBlock, upsertBlock } from "../src/installers/config.js";
import { addCodexMcp, codexMcpBlock } from "../src/installers/mcp.js";
import { removeStateEntry } from "../src/installers/remove.js";
import type { Item } from "../src/registry/schema.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-remove-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// projectRoot é derivado do próprio tempdir onde o artefato vive (o guard de
// raízes permitidas de remove.ts exige que o caminho caia sob projectRoot ou sob
// o dir de config do harness — um projectRoot fixo que não bate seria recusado).
function entry(itemId: string, artifact: Artifact): StateEntry {
  const kind = itemId.split(":")[0] as StateEntry["kind"];
  const match = "path" in artifact
    ? artifact.path.match(/^(.*setup-definitivo-remove-[^/]+)/)
    : null;
  return {
    itemId,
    kind,
    harness: artifact.type === "toml-section" ? "codex" : "cursor",
    target: "project",
    projectRoot: match ? match[1] : "/tmp/projeto-falso",
    artifacts: [artifact],
    installedAt: "2026-09-06T12:00:00.000Z",
  };
}

function mcpItem(name: string): Item {
  return {
    id: `mcp:${name}`,
    kind: "mcp",
    name,
    description: "Fixture falsa",
    targets: ["global", "project"],
    needsSecret: false,
    mcp: { cmd: "npx", args: ["-y", "fake@1"] },
  };
}

function cursorArtifact(file: string, name = "clickup"): Artifact {
  return {
    type: "mcp",
    path: file,
    name,
    digest: contentDigest(JSON.stringify({ command: "npx", args: ["-y", "fake@1"] })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("manifesto de estado", () => {
  it("grava, relê e substitui a mesma entrada com modo 0600", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "nested", "state.json");
      const original = entry("skill:fixture", {
        type: "block",
        path: path.join(dir, "AGENTS.md"),
        blockId: "skill:fixture",
      });
      await upsertStateEntries([original], file);
      const replacement = { ...original, installedAt: "2026-09-06T13:00:00.000Z" };
      await upsertStateEntries([replacement], file);

      expect((await readState(file)).entries).toEqual([replacement]);
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    });
  });

  it("lança claramente quando o manifesto está corrompido", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "state.json");
      await fs.writeFile(file, "{ inválido");
      const replacement = entry("skill:fixture", {
        type: "block", path: path.join(dir, "AGENTS.md"), blockId: "skill:fixture",
      });
      await expect(upsertStateEntries([replacement], file)).rejects.toThrow(
        "manifesto de estado inválido"
      );
      expect(await fs.readFile(file, "utf-8")).toBe("{ inválido");
    });
  });
});

describe("removeBlock", () => {
  it("remove o bloco e preserva exatamente o texto antes e depois", () => {
    const original = "antes\n";
    const managed = upsertBlock(original, "a+b(c)", "conteúdo com $& e $`") + "depois\n";
    expect(removeBlock(managed, "a+b(c)")).toBe(original + "depois\n");
  });

  it("mantém texto sem bloco e rejeita marcadores órfãos", () => {
    expect(removeBlock("texto $& intacto", "skill:x")).toBe("texto $& intacto");
    expect(() => removeBlock(
      "<!-- setup-definitivo:start:skill:x -->\ntexto",
      "skill:x"
    )).toThrow("marcadores inválidos");
    const duplicated = upsertBlock("", "skill:x", "um");
    expect(() => removeBlock(duplicated + duplicated, "skill:x")).toThrow(
      "marcadores inválidos"
    );
  });
});

describe("remoção conservadora de artefatos", () => {
  it("apaga skill nativa intacta", async () => {
    await withTempDir(async (dir) => {
      const skill = path.join(dir, "skills", "fixture");
      await fs.mkdir(skill, { recursive: true });
      await fs.writeFile(path.join(skill, "SKILL.md"), "conteúdo falso");
      const result = await removeStateEntry(entry("skill:fixture", {
        type: "dir",
        path: skill,
        digest: await directoryDigest(skill),
      }), false);
      expect(result.removed).toBe(true);
      await expect(fs.access(skill)).rejects.toThrow();
    });
  });

  it("recusa apagar skill nativa com arquivo extra do usuário", async () => {
    await withTempDir(async (dir) => {
      const skill = path.join(dir, "skills", "fixture");
      await fs.mkdir(skill, { recursive: true });
      await fs.writeFile(path.join(skill, "SKILL.md"), "instalado");
      const digest = await directoryDigest(skill);
      await fs.writeFile(path.join(skill, "nota-do-usuario.md"), "não apagar");

      const result = await removeStateEntry(entry("skill:fixture", {
        type: "dir", path: skill, digest,
      }), false);
      expect(result.removed).toBe(false);
      expect(result.message).toContain("skill modificada");
      expect(await fs.readFile(path.join(skill, "nota-do-usuario.md"), "utf-8")).toBe("não apagar");
    });
  });

  it("remove bloco degradado sem tocar no resto do AGENTS.md", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "AGENTS.md");
      const original = "texto do usuário\n";
      await fs.writeFile(file, upsertBlock(original, "skill:fixture", "skill falsa"));
      const result = await removeStateEntry(entry("skill:fixture", {
        type: "block", path: file, blockId: "skill:fixture",
      }), false);
      expect(result.removed).toBe(true);
      expect(await fs.readFile(file, "utf-8")).toBe(original);
    });
  });

  it("remove só o MCP Cursor e preserva schema e outros servidores", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "mcp.json");
      const config = {
        $schema: "https://example.invalid/fake.json",
        mcpServers: {
          clickup: { command: "npx", args: ["-y", "fake@1"] },
          outro: { command: "node", args: ["server.js"] },
        },
      };
      await fs.writeFile(file, JSON.stringify(config, null, 2) + "\n");
      const result = await removeStateEntry(entry("mcp:clickup", cursorArtifact(file)), false);
      const updated = JSON.parse(await fs.readFile(file, "utf-8"));
      expect(result.removed).toBe(true);
      expect(updated.$schema).toBe(config.$schema);
      expect(updated.mcpServers).toEqual({ outro: config.mcpServers.outro });
    });
  });

  it("recusa remover MCP Cursor que ganhou env", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "mcp.json");
      const config = {
        mcpServers: {
          clickup: {
            command: "npx",
            args: ["-y", "fake@1"],
            env: { TOKEN_FALSO: "valor-falso" },
          },
        },
      };
      await fs.writeFile(file, JSON.stringify(config, null, 2) + "\n");
      const before = await fs.readFile(file, "utf-8");
      const result = await removeStateEntry(entry("mcp:clickup", cursorArtifact(file)), false);
      expect(result.removed).toBe(false);
      expect(result.message).toContain("alterado pelo usuário");
      expect(await fs.readFile(file, "utf-8")).toBe(before);
    });
  });

  it("remove seção Codex preservando comentários, próxima seção e TOML válido", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const block = codexMcpBlock(mcpItem("clickup"));
      const next = '[mcp_servers.outro]\ncommand = "node"\nargs = []\n';
      const originalPrefix = '# comentário falso\nmodel = "fake"\n\n';
      await fs.writeFile(file, originalPrefix + block + "\n" + next);
      const artifact: Artifact = {
        type: "toml-section",
        path: file,
        name: "clickup",
        digest: contentDigest(block.trimEnd()),
        separator: "",
      };
      const result = await removeStateEntry(entry("mcp:clickup", artifact), false);
      const updated = await fs.readFile(file, "utf-8");
      expect(result.removed).toBe(true);
      expect(updated).toContain("# comentário falso");
      expect(updated).toContain("[mcp_servers.outro]");
      expect(updated).not.toContain("[mcp_servers.clickup]");
      expect(() => parse(updated)).not.toThrow();
    });
  });

  it("recusa seção Codex com sub-tabela http_headers", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const block = codexMcpBlock(mcpItem("clickup"));
      const current = block + '[mcp_servers.clickup.http_headers]\nAuthorization = "falso"\n';
      await fs.writeFile(file, current);
      const artifact: Artifact = {
        type: "toml-section", path: file, name: "clickup",
        digest: contentDigest(block.trimEnd()), separator: "",
      };
      const result = await removeStateEntry(entry("mcp:clickup", artifact), false);
      expect(result.removed).toBe(false);
      expect(result.message).toContain("sub-tabelas");
      expect(await fs.readFile(file, "utf-8")).toBe(current);
    });
  });

  it("append seguido de remove devolve o config.toml aos bytes originais", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const original = '# manual falso\nmodel = "fake"';
      const item = mcpItem("clickup");
      await fs.writeFile(file, original);
      await addCodexMcp(item, file, false);
      const artifact: Artifact = {
        type: "toml-section", path: file, name: "clickup",
        digest: contentDigest(codexMcpBlock(item).trimEnd()), separator: "\n\n",
      };
      expect((await removeStateEntry(entry(item.id, artifact), false)).removed).toBe(true);
      expect(await fs.readFile(file, "utf-8")).toBe(original);
    });
  });

  it("tool e settings só informam a remoção manual", async () => {
    await withTempDir(async (dir) => {
      const tool = await removeStateEntry(entry("tool:fixture", {
        type: "tool", command: "uv tool uninstall fixture",
      }), false);
      const settings = await removeStateEntry(entry("config:fixture", {
        type: "settings", path: path.join(dir, "settings.json"), keys: ["permissions.allow"],
      }), false);
      expect(tool.removed).toBe(false);
      expect(tool.message).toContain("manualmente");
      expect(settings.removed).toBe(false);
      expect(settings.message).toContain("permissions.allow");
    });
  });
});

describe("comando remove", () => {
  it("applyPlan registra o bloco realmente aplicado", async () => {
    await withTempDir(async (dir) => {
      const previousCwd = process.cwd();
      const manifest = path.join(dir, "state.json");
      process.chdir(dir);
      vi.spyOn(prompts.log, "step").mockImplementation(() => {});
      try {
        await applyPlan({
          harnesses: ["cursor"],
          pipeline: false,
          roles: {},
          target: "project",
          items: ["config:base-instructions"],
        }, false, manifest);
        const state = await readState(manifest);
        expect(state.entries).toHaveLength(1);
        expect(state.entries[0]).toMatchObject({
          itemId: "config:base-instructions",
          harness: "cursor",
          projectRoot: dir,
          artifacts: [{ type: "block", path: path.join(dir, ".cursorrules"), blockId: "base" }],
        });
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

  it("dry-run não altera artefato nem manifesto", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "AGENTS.md");
      const manifest = path.join(dir, "state.json");
      await fs.writeFile(file, upsertBlock("texto\n", "skill:fixture", "fake"));
      await writeState({ version: 1, entries: [entry("skill:fixture", {
        type: "block", path: file, blockId: "skill:fixture",
      })] }, manifest);
      const beforeFile = await fs.readFile(file, "utf-8");
      const beforeManifest = await fs.readFile(manifest, "utf-8");
      vi.spyOn(prompts.log, "step").mockImplementation(() => {});

      await runRemove(["skill:fixture"], { all: false, dryRun: true, yes: true }, manifest);

      expect(await fs.readFile(file, "utf-8")).toBe(beforeFile);
      expect(await fs.readFile(manifest, "utf-8")).toBe(beforeManifest);
    });
  });

  it("mantém no manifesto a entrada cuja remoção foi recusada", async () => {
    await withTempDir(async (dir) => {
      const skill = path.join(dir, "skill");
      const manifest = path.join(dir, "state.json");
      await fs.mkdir(skill);
      await fs.writeFile(path.join(skill, "SKILL.md"), "original");
      const digest = await directoryDigest(skill);
      await fs.writeFile(path.join(skill, "usuario.md"), "preservar");
      const stateEntry = entry("skill:fixture", { type: "dir", path: skill, digest });
      await writeState({ version: 1, entries: [stateEntry] }, manifest);
      vi.spyOn(prompts.log, "step").mockImplementation(() => {});

      await runRemove(["skill:fixture"], { all: false, dryRun: false, yes: true }, manifest);

      expect((await readState(manifest)).entries).toEqual([stateEntry]);
      expect(await fs.readFile(path.join(skill, "usuario.md"), "utf-8")).toBe("preservar");
    });
  });

  it("remove do manifesto somente após apagar o artefato", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "AGENTS.md");
      const manifest = path.join(dir, "state.json");
      await fs.writeFile(file, upsertBlock("texto\n", "skill:fixture", "fake"));
      await writeState({ version: 1, entries: [entry("skill:fixture", {
        type: "block", path: file, blockId: "skill:fixture",
      })] }, manifest);
      vi.spyOn(prompts.log, "step").mockImplementation(() => {});

      await runRemove(["skill:fixture"], { all: false, dryRun: false, yes: true }, manifest);

      expect((await readState(manifest)).entries).toEqual([]);
      expect(await fs.readFile(file, "utf-8")).toBe("texto\n");
    });
  });
});
