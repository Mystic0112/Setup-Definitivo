import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { copyDir } from "../src/core/fsx.js";
import { skillsDir, instructionFile, settingsFile } from "../src/core/targets.js";
import {
  applyInstruction,
  applySettings,
  mergeSettings,
  upsertBlock,
} from "../src/installers/config.js";
import { claudeMcpArgs, mcpName } from "../src/installers/mcp.js";
import { roleSkillContent, handoffContent, type Pipeline } from "../src/generators/roles.js";
import { CATALOG } from "../src/registry/items.js";
import { CatalogSchema } from "../src/registry/schema.js";

describe("targets", () => {
  it("skills globais do Claude ficam em ~/.claude/skills", () => {
    expect(skillsDir("claude", "global")).toBe(path.join(os.homedir(), ".claude", "skills"));
  });
  it("skills de projeto ficam em ./.claude/skills", () => {
    expect(skillsDir("claude", "project", "/tmp/proj")).toBe("/tmp/proj/.claude/skills");
  });
  it("arquivo de instrução varia por harness", () => {
    expect(instructionFile("codex", "project", "/tmp/proj")).toBe("/tmp/proj/AGENTS.md");
    expect(instructionFile("cursor", "project", "/tmp/proj")).toBe("/tmp/proj/.cursorrules");
  });
  it("settings de projeto usam arquivo local", () => {
    expect(settingsFile("claude", "project", "/tmp/proj")).toBe(
      "/tmp/proj/.claude/settings.local.json"
    );
    expect(settingsFile("claude", "global")).toBe(
      path.join(os.homedir(), ".claude", "settings.json")
    );
  });
});

describe("filesystem", () => {
  it("copia o conteúdo de symlinks em vez de preservá-los", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-copy-"));
    try {
      const source = path.join(dir, "source");
      const destination = path.join(dir, "destination");
      await fs.mkdir(source);
      await fs.writeFile(path.join(source, "target.txt"), "conteúdo");
      await fs.symlink("target.txt", path.join(source, "link.txt"));

      await copyDir(source, destination);

      expect((await fs.lstat(path.join(destination, "link.txt"))).isSymbolicLink()).toBe(false);
      expect(await fs.readFile(path.join(destination, "link.txt"), "utf-8")).toBe("conteúdo");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("mcp", () => {
  it("deriva o nome curto do id", () => {
    const item = CATALOG.find((i) => i.id === "mcp:clickup")!;
    expect(mcpName(item)).toBe("clickup");
  });
  it("monta os args do claude mcp add", () => {
    const item = CATALOG.find((i) => i.id === "mcp:21st")!;
    expect(claudeMcpArgs(item)).toEqual([
      "mcp", "add", "21st", "--", "npx", "-y", "@21st-dev/magic@latest",
    ]);
  });
});

describe("config", () => {
  it("faz merge profundo e concatena arrays sem duplicar", () => {
    const current = {
      permissions: { allow: ["Bash(git status)"], deny: ["Read(.env)"] },
      theme: "dark",
    };
    const patch = {
      permissions: {
        allow: ["Bash(git status)", "Bash(git diff:*)"],
      },
    };

    expect(mergeSettings(current, patch)).toEqual({
      permissions: {
        allow: ["Bash(git status)", "Bash(git diff:*)"],
        deny: ["Read(.env)"],
      },
      theme: "dark",
    });
  });

  it("preserva todos os valores no merge assimétrico", () => {
    expect(mergeSettings({ a: ["x", "y"] }, { a: ["z"] })).toEqual({
      a: ["x", "y", "z"],
    });
  });

  it("deduplica arrays de objetos por valor", () => {
    const hook = { matcher: "Write", hooks: [{ type: "command", command: "lint" }] };
    const once = mergeSettings({ hooks: [hook] }, { hooks: [{ ...hook }] });
    const twice = mergeSettings(once, { hooks: [{ ...hook }] });

    expect(twice).toEqual({ hooks: [hook] });
  });

  it("não adiciona separador antes do bloco em texto vazio", () => {
    expect(upsertBlock("", "config:base-instructions", "conteúdo")).toBe(
      "<!-- setup-definitivo:start:config:base-instructions -->\n" +
        "conteúdo\n" +
        "<!-- setup-definitivo:end:config:base-instructions -->\n"
    );
  });

  it("insere um bloco marcado quando ele não existe", () => {
    const result = upsertBlock("texto existente", "base", "novo conteúdo");

    expect(result).toBe(
      "texto existente\n\n" +
        "<!-- setup-definitivo:start:base -->\n" +
        "novo conteúdo\n" +
        "<!-- setup-definitivo:end:base -->\n"
    );
  });

  it("substitui o mesmo bloco sem duplicar e preserva o texto externo", () => {
    const initial = upsertBlock("antes", "base", "conteúdo antigo") + "depois\n";
    const result = upsertBlock(initial, "base", "conteúdo novo");

    expect(result).toContain("antes");
    expect(result).toContain("depois");
    expect(result).toContain("conteúdo novo");
    expect(result).not.toContain("conteúdo antigo");
    expect(result.match(/setup-definitivo:start:base/g)).toHaveLength(1);
    expect(result.match(/setup-definitivo:end:base/g)).toHaveLength(1);
  });

  it.each(["config:base-instructions", "a+b(c)"])(
    "substitui bloco com id literal %s",
    (id) => {
      const initial = upsertBlock("antes", id, "antigo");
      const result = upsertBlock(initial, id, "novo");

      expect(result).toContain(`setup-definitivo:start:${id}`);
      expect(result).toContain("novo");
      expect(result).not.toContain("antigo");
      expect(result.match(new RegExp(`setup-definitivo:start:`, "g"))).toHaveLength(1);
    }
  );

  it("trata conteúdo com padrões especiais de replacement literalmente", () => {
    const content = "use sed 's/x/$&/' e $` e $'";
    const initial = upsertBlock("topo", "config:base-instructions", "antigo");
    const result = upsertBlock(initial, "config:base-instructions", content);

    expect(result).toContain(content);
    expect(result).not.toContain("antigo");
    expect(result.match(/topo/g)).toHaveLength(1);
  });

  it("rejeita marcador final ausente", () => {
    const malformed =
      "antes\n<!-- setup-definitivo:start:config:base-instructions -->\n" +
      "TEXTO IMPORTANTE DO USUARIO\n";

    expect(() => upsertBlock(malformed, "config:base-instructions", "novo")).toThrow(
      "marcadores inválidos"
    );
  });

  it("rejeita marcadores duplicados", () => {
    const block = upsertBlock("", "base", "conteúdo");
    expect(() => upsertBlock(block + block, "base", "novo")).toThrow(
      "marcadores inválidos"
    );
  });

  it("mantém blocos de ids diferentes independentes", () => {
    const first = upsertBlock("texto externo", "config:base-instructions", "primeiro");
    const both = upsertBlock(first, "a+b(c)", "segundo");
    const updated = upsertBlock(both, "config:base-instructions", "atualizado");

    expect(updated).toContain("texto externo");
    expect(updated).toContain("atualizado");
    expect(updated).toContain("segundo");
    expect(updated.match(/setup-definitivo:start:/g)).toHaveLength(2);
  });

  it("mantém o matcher de bloco não guloso", async () => {
    const source = await fs.readFile(
      new URL("../src/installers/config.ts", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("[\\\\s\\\\S]*?");
  });
});

describe("aplicação de config", () => {
  it("rejeita JSON inválido sem alterar o arquivo", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-settings-"));
    const file = path.join(dir, "settings.json");
    try {
      await fs.writeFile(file, "{ inválido");

      await expect(applySettings(file, { ok: true }, false)).rejects.toThrow(
        "não é JSON válido"
      );
      expect(await fs.readFile(file, "utf-8")).toBe("{ inválido");
      expect(await fs.readdir(dir)).toEqual(["settings.json"]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it.each(["[1,2]", "null", '"x"', "42"])(
    "rejeita JSON não-objeto: %s",
    async (value) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-settings-"));
      const file = path.join(dir, "settings.json");
      try {
        await fs.writeFile(file, value);
        await expect(applySettings(file, { ok: true }, false)).rejects.toThrow(
          "deve conter um objeto JSON"
        );
        expect(await fs.readFile(file, "utf-8")).toBe(value);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  );

  it("mescla settings, reporta backup e evita backup sem mudança", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-settings-"));
    const file = path.join(dir, "settings.json");
    const original = JSON.stringify({ permissions: { allow: ["A"] } }, null, 2) + "\n";
    try {
      await fs.writeFile(file, original);

      const changed = await applySettings(file, { permissions: { allow: ["B"] } }, false);
      const filesAfterChange = await fs.readdir(dir);
      const backup = filesAfterChange.find((name) => name.startsWith("settings.json.bak-"));
      expect(changed).toContain(`backup: ${path.join(dir, backup!)}`);
      expect(JSON.parse(await fs.readFile(file, "utf-8"))).toEqual({
        permissions: { allow: ["A", "B"] },
      });
      expect(await fs.readFile(path.join(dir, backup!), "utf-8")).toBe(original);

      const unchanged = await applySettings(file, { permissions: { allow: ["B"] } }, false);
      expect(unchanged).toContain("sem mudanças");
      expect(await fs.readdir(dir)).toEqual(filesAfterChange);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("aplica instrução, reporta backup e evita backup sem mudança", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-instruction-"));
    const file = path.join(dir, "CLAUDE.md");
    const original = "texto do usuário\n";
    try {
      await fs.writeFile(file, original);

      const changed = await applyInstruction(file, "config:base", "instrução", false);
      const filesAfterChange = await fs.readdir(dir);
      const backup = filesAfterChange.find((name) => name.startsWith("CLAUDE.md.bak-"));
      expect(changed).toContain(`backup: ${path.join(dir, backup!)}`);
      expect(await fs.readFile(path.join(dir, backup!), "utf-8")).toBe(original);

      const unchanged = await applyInstruction(file, "config:base", "instrução", false);
      expect(unchanged).toContain("sem mudanças");
      expect(await fs.readdir(dir)).toEqual(filesAfterChange);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("roles", () => {
  const pipe: Pipeline = {
    harnesses: ["gemini", "codex", "claude"],
    roles: { gemini: ["plan"], codex: ["code"], claude: ["review"] },
  };
  it("skill de papel cita o papel e os outros harnesses", () => {
    const c = roleSkillContent("claude", ["review"], pipe);
    expect(c).toContain("name: pipeline-role");
    expect(c).toContain("Revisar");
    expect(c).toContain("Codex");
    expect(c).toContain("Gemini");
  });
  it("handoff descreve o fluxo na ordem", () => {
    const h = handoffContent(pipe);
    expect(h).toContain("Gemini (Planejar) → Codex (Codar) → Claude (Revisar)");
  });
});

describe("catálogo", () => {
  it("passa na validação da schema (zod)", () => {
    expect(() => CatalogSchema.parse(CATALOG)).not.toThrow();
  });
  it("não concede variantes abertas de git diff ou git log", () => {
    const item = CATALOG.find((candidate) => candidate.id === "config:hooks-basicos")!;
    const permissions = item.config?.settings?.permissions as { allow: string[] };

    expect(permissions.allow).toEqual([
      "Bash(git status)",
      "Bash(git diff)",
      "Bash(git diff --stat)",
      "Bash(git log --oneline -n 20)",
      "Bash(ls:*)",
    ]);
  });
});
