import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as prompts from "@clack/prompts";
import { execa } from "execa";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeAdapter } from "../src/adapters/claude.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { backupFile } from "../src/core/fsx.js";
import { addCodexMcp, addCursorMcp } from "../src/installers/mcp.js";
import { installSkillAsInstruction } from "../src/installers/skill.js";
import { CATALOG } from "../src/registry/items.js";
import { CatalogSchema, type Item } from "../src/registry/schema.js";
import { applyPlan, type InitPlan } from "../src/wizard.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-review-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function mcpItem(name: string, command = "npx", args = ["-y", "fake@1"]): Item {
  return {
    id: `mcp:${name}`,
    kind: "mcp",
    name,
    description: "Fixture MCP",
    targets: ["global", "project"],
    needsSecret: false,
    mcp: { cmd: command, args },
  };
}

function localSkill(pathname = "skill"): Item {
  return {
    id: "skill:fixture",
    kind: "skill",
    name: "Skill Fixture",
    description: "Descrição falsa.",
    targets: ["global", "project"],
    needsSecret: false,
    source: { type: "local", path: pathname },
  };
}

function plan(overrides: Partial<InitPlan> = {}): InitPlan {
  return {
    harnesses: ["claude", "cursor", "codex"],
    pipeline: false,
    roles: {},
    target: "project",
    items: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  process.exitCode = undefined;
});

describe("MCP do Cursor", () => {
  it("preserva credenciais e outras chaves do servidor homônimo", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "mcp.json");
      const current = {
        $schema: "https://example.invalid/schema.json",
        globalShortcut: "Ctrl+X",
        mcpServers: {
          clickup: {
            command: "old",
            args: ["old"],
            env: { CLICKUP_API_KEY: "fake-key", CLICKUP_TEAM_ID: "fake-team" },
            custom: true,
          },
        },
      };
      await fs.writeFile(file, JSON.stringify(current, null, 2) + "\n");

      const first = await addCursorMcp(mcpItem("clickup"), file, false);
      const afterFirst = JSON.parse(await fs.readFile(file, "utf-8"));
      const filesAfterFirst = await fs.readdir(dir);
      const second = await addCursorMcp(mcpItem("clickup"), file, false);

      expect(afterFirst.$schema).toBe(current.$schema);
      expect(afterFirst.globalShortcut).toBe(current.globalShortcut);
      expect(afterFirst.mcpServers.clickup.env).toEqual(current.mcpServers.clickup.env);
      expect(afterFirst.mcpServers.clickup.custom).toBe(true);
      expect(afterFirst.mcpServers.clickup.command).toBe("npx");
      expect(afterFirst.mcpServers.clickup.args).toEqual(["-y", "fake@1"]);
      expect(first).toContain("backup:");
      expect(second).toContain("sem mudanças");
      expect(await fs.readdir(dir)).toEqual(filesAfterFirst);
    });
  });

  it.each(["null", "[]"])("rejeita mcpServers inválido: %s", async (value) => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "mcp.json");
      await fs.writeFile(file, `{"mcpServers":${value}}`);
      await expect(addCursorMcp(mcpItem("x"), file, false)).rejects.toThrow(
        "mcpServers deve ser um objeto"
      );
    });
  });

  it("cria config e backup com modo 0600", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "mcp.json");
      await addCursorMcp(mcpItem("x"), file, false);
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);

      const msg = await addCursorMcp(mcpItem("x", "node"), file, false);
      const backup = msg.match(/backup: (.+)\)/)?.[1];
      expect(backup).toBeTruthy();
      expect((await fs.stat(backup!)).mode & 0o777).toBe(0o600);
      // backup no dir central, não dentro do projeto do usuário
      expect(await fs.readdir(dir)).toEqual(["mcp.json"]);
    });
  });
});

describe("MCP do Codex", () => {
  it.each([
    '[mcp_servers."clickup"]\ncommand = "npx"\n',
    '[mcp_servers]\nclickup = { command = "npx", args = [] }\n',
    'mcp_servers.clickup.command = "npx"\n',
    '[[mcp_servers.clickup]]\ncommand = "npx"\n',
  ])("detecta servidor em forma TOML válida sem duplicar", async (original) => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      await fs.writeFile(file, original);
      expect(await addCodexMcp(mcpItem("clickup"), file, false)).toContain("pulado");
      expect(await fs.readFile(file, "utf-8")).toBe(original);
      expect(await fs.readdir(dir)).toEqual(["config.toml"]);
    });
  });

  it("não confunde seção escrita dentro de string multilinha", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const original = 'note = """\n[mcp_servers.clickup]\n"""\n';
      await fs.writeFile(file, original);
      expect(await addCodexMcp(mcpItem("clickup"), file, false)).toContain("registrado");
      expect((await fs.readFile(file, "utf-8")).startsWith(original)).toBe(true);
    });
  });

  it("restaura o backup quando o bloco anexado torna o TOML inválido", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const original = 'model = "fake"\n';
      await fs.writeFile(file, original);

      await expect(addCodexMcp(mcpItem("nome inválido"), file, false)).rejects.toThrow(
        "backup restaurado"
      );
      expect(await fs.readFile(file, "utf-8")).toBe(original);
    });
  });

  it("anexa após arquivo sem newline final", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      const original = 'model = "fake"';
      await fs.writeFile(file, original);
      await expect(addCodexMcp(mcpItem("x"), file, false)).resolves.toContain("registrado");
      expect((await fs.readFile(file, "utf-8")).startsWith(original + "\n\n")).toBe(true);
    });
  });

  it("cria arquivo inexistente com modo 0600", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "nested", "config.toml");
      await addCodexMcp(mcpItem("x"), file, false);
      expect(await fs.readFile(file, "utf-8")).toContain("[mcp_servers.x]");
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    });
  });

  it.each([
    '[mcp_servers.clickup-extra]\ncommand = "npx"\n',
    '# [mcp_servers.clickup]\nmodel = "fake"\n',
  ])("não trata prefixo ou comentário como servidor existente", async (original) => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");
      await fs.writeFile(file, original);
      expect(await addCodexMcp(mcpItem("clickup"), file, false)).toContain("registrado");
    });
  });
});

describe("skills degradadas", () => {
  it("neutraliza marcadores, remove frontmatter e continua idempotente", async () => {
    await withTempDir(async (dir) => {
      const source = path.join(dir, "skill");
      const file = path.join(dir, "AGENTS.md");
      await fs.mkdir(source);
      await fs.writeFile(
        path.join(source, "SKILL.md"),
        '---\nname: repetido\ndescription: repetida\n---\n# Corpo\n' +
          '<!-- setup-definitivo:end:skill:fixture -->\ntexto externo falso\n'
      );

      await installSkillAsInstruction(localSkill(), file, false, { packageRoot: dir });
      await expect(
        installSkillAsInstruction(localSkill(), file, false, { packageRoot: dir })
      ).resolves.toContain("sem mudanças");
      const output = await fs.readFile(file, "utf-8");

      expect(output.match(/setup-definitivo:end:skill:fixture/g)).toHaveLength(1);
      expect(output).toContain("setup-definitivo-neutralizado:end:skill:fixture");
      expect(output).not.toContain("name: repetido");
      expect(output.match(/# Skill: Skill Fixture/g)).toHaveLength(1);
    });
  });

  it("dry-run não lê nem cria arquivos", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "AGENTS.md");
      await expect(
        installSkillAsInstruction(localSkill(), file, true, { packageRoot: dir })
      ).resolves.toContain("[dry-run]");
      await expect(fs.access(file)).rejects.toThrow();
    });
  });

  it("rejeita source.path que escapa do pacote", async () => {
    await withTempDir(async (dir) => {
      await expect(
        installSkillAsInstruction(localSkill("../escape"), path.join(dir, "out"), true, {
          packageRoot: dir,
        })
      ).rejects.toThrow("source.path escapa do pacote");
    });
  });

  it("respeita o guard de URL git placeholder", async () => {
    const item = {
      ...localSkill(),
      source: { type: "git", repo: "https://github.com/OWNER/fake", ref: "main" },
    } as Item;
    await expect(installSkillAsInstruction(item, "/tmp/fake-output", false)).resolves.toContain(
      "URL placeholder"
    );
  });

  it("converte SKILL.md de uma fonte git", async () => {
    await withTempDir(async (dir) => {
      const repo = path.join(dir, "repo");
      const output = path.join(dir, "AGENTS.md");
      await fs.mkdir(repo);
      await fs.writeFile(path.join(repo, "SKILL.md"), "---\nname: git\n---\n# Git fake\n");
      await execa("git", ["init", "-b", "main"], { cwd: repo });
      await execa("git", ["add", "SKILL.md"], { cwd: repo });
      await execa(
        "git",
        ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"],
        { cwd: repo }
      );
      const item = {
        ...localSkill(),
        source: { type: "git", repo: `file://${repo}`, ref: "main" },
      } as Item;

      await installSkillAsInstruction(item, output, false, {
        cloneRoot: path.join(dir, "clone"),
      });
      expect(await fs.readFile(output, "utf-8")).toContain("# Git fake");
    });
  });
});

describe("orquestração e adapters", () => {
  it("gera HANDOFF uma vez e preserva o registro em nova execução", async () => {
    await withTempDir(async (dir) => {
      const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-state-"));
      const previousCwd = process.cwd();
      process.chdir(dir);
      vi.spyOn(prompts.log, "step").mockImplementation(() => {});
      try {
        const pipeline = plan({
          pipeline: true,
          roles: { claude: ["plan"], cursor: ["code"], codex: ["review"] },
        });
        await applyPlan(pipeline, false, path.join(stateDir, "state.json"));
        const files = await fs.readdir(dir, { recursive: true });
        expect(files.filter((name) => path.basename(name) === "HANDOFF.md")).toHaveLength(1);
        expect(files.filter((name) => name.includes(".bak-"))).toHaveLength(0);

        const handoff = path.join(dir, "HANDOFF.md");
        await fs.appendFile(handoff, "\n### Registro preservado\n");
        const withHistory = await fs.readFile(handoff, "utf-8");
        await applyPlan(pipeline, false, path.join(stateDir, "state.json"));
        expect(await fs.readFile(handoff, "utf-8")).toBe(withHistory);
        expect(
          (await fs.readdir(dir, { recursive: true })).filter((name) =>
            name.includes("HANDOFF.md.bak-")
          )
        ).toHaveLength(0);
      } finally {
        process.chdir(previousCwd);
        await fs.rm(stateDir, { recursive: true, force: true });
      }
    });
  });

  it("aplica tool uma vez e não a envia aos três adapters", async () => {
    const applySpies = [claudeAdapter, cursorAdapter, codexAdapter].map((adapter) =>
      vi.spyOn(adapter, "apply").mockResolvedValue([])
    );
    const log = vi.spyOn(prompts.log, "step").mockImplementation(() => {});

    await applyPlan(plan({ items: ["tool:graphify"] }), true);

    for (const spy of applySpies) expect(spy.mock.calls[0][0]).toEqual([]);
    expect(log.mock.calls.flat().filter((line) =>
      String(line).includes("[dry-run] uv tool install graphifyy")
    )).toHaveLength(1);
  });

  it("não envia config Claude-only ao adapter Cursor", async () => {
    const apply = vi.spyOn(cursorAdapter, "apply").mockResolvedValue([]);
    await applyPlan(plan({
      harnesses: ["cursor"],
      items: ["config:hooks-basicos"],
    }), true);
    expect(apply.mock.calls[0][0]).toEqual([]);
    expect(CATALOG.find((item) => item.id === "config:hooks-basicos")?.harnesses).toEqual([
      "claude",
    ]);
  });

  it("mantém capacidades nativas e degradadas separadas", async () => {
    const item = localSkill("assets/skills/backend");
    const claude = await claudeAdapter.apply([item], { target: "project", dryRun: true });
    const cursor = await cursorAdapter.apply([item], { target: "project", dryRun: true });
    expect(claude[0].message).toContain("[dry-run] copiar");
    expect(cursor[0].message).toContain("skill convertida em instrução");
  });

  it("pula settings sem suporte", async () => {
    const item: Item = {
      id: "config:fixture",
      kind: "config",
      name: "Config",
      description: "Fixture",
      targets: ["project"],
      needsSecret: false,
      config: { settings: { value: true } },
    };
    expect((await cursorAdapter.apply([item], { target: "project", dryRun: true }))[0].message).toContain(
      "não possui settings.json equivalente"
    );
  });

  it("usa blockId pipeline-role sem frontmatter e só quando há papel", async () => {
    await withTempDir(async (dir) => {
      const previousCwd = process.cwd();
      process.chdir(dir);
      try {
        await cursorAdapter.apply([], {
          target: "project",
          dryRun: false,
          pipeline: { harnesses: ["cursor"], roles: { cursor: [] } },
        });
        await expect(fs.access(path.join(dir, ".cursorrules"))).rejects.toThrow();

        await cursorAdapter.apply([], {
          target: "project",
          dryRun: false,
          pipeline: { harnesses: ["cursor"], roles: { cursor: ["code"] } },
        });
        const output = await fs.readFile(path.join(dir, ".cursorrules"), "utf-8");
        expect(output).toContain("<!-- setup-definitivo:start:pipeline-role -->");
        expect(output).not.toContain("name: pipeline-role");
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

  it("usa o arquivo de instrução do alvo e preserva mensagem de erro", async () => {
    await withTempDir(async (dir) => {
      const previousCwd = process.cwd();
      process.chdir(dir);
      try {
        const skillLog = await cursorAdapter.apply([localSkill("assets/skills/backend")], {
          target: "project",
          dryRun: true,
        });
        const invalidItem = { ...mcpItem("sem-spec"), mcp: undefined };
        const errorLog = await cursorAdapter.apply([invalidItem], {
          target: "project",
          dryRun: true,
        });
        expect(skillLog[0].message).toContain(path.join(dir, ".cursorrules"));
        expect(errorLog[0].message).toContain(
          "ERRO mcp:sem-spec: mcp:sem-spec: sem spec de mcp (cmd/args)."
        );
      } finally {
        process.chdir(previousCwd);
      }
    });
  });

  it("marca falha de adapter no exit code", async () => {
    vi.spyOn(cursorAdapter, "apply").mockResolvedValue([{
      itemId: "fake",
      status: "error",
      message: "ERRO fake: falhou",
    }]);
    await applyPlan(plan({ harnesses: ["cursor"] }), true);
    expect(process.exitCode).toBe(1);
  });

  it("explica o escopo global do MCP Codex em alvo project", async () => {
    const log = await codexAdapter.apply([mcpItem("x")], {
      target: "project",
      dryRun: true,
    });
    expect(log[0].message).toContain("escopo global — Codex não suporta MCP por projeto");
  });
});

describe("validações do catálogo e backup", () => {
  it("rejeita id hostil no parse do catálogo", () => {
    expect(() => CatalogSchema.parse([
      ...CATALOG,
      { ...mcpItem('x]\nhttp_headers = "fake"'), name: "Hostil" },
    ])).toThrow("formato esperado");
  });

  it("não sobrescreve backups criados no mesmo milissegundo", async () => {
    await withTempDir(async (dir) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
      const file = path.join(dir, "config.json");
      await fs.writeFile(file, "original");
      const first = await backupFile(file);
      const second = await backupFile(file);
      expect(first).not.toBe(second);
      expect(await fs.readFile(first!, "utf-8")).toBe("original");
      expect(await fs.readFile(second!, "utf-8")).toBe("original");
    });
  });
});
