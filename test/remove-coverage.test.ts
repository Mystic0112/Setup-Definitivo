import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { removeStateEntry } from "../src/installers/remove.js";
import { runRemove } from "../src/commands/remove.js";
import { upsertStateEntries, directoryDigest } from "../src/core/state.js";
import { upsertBlock } from "../src/installers/config.js";
import type { StateEntry } from "../src/core/state.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-cov-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

afterEach(() => {
  process.exitCode = undefined;
});

// levi (MÉDIA): o guard "dir virou symlink" só tinha teste para type:"file".
describe("remove — guard de diretório trocado por symlink", () => {
  it("recusa apagar quando o diretório instalado virou symlink", async () => {
    await withTempDir(async (dir) => {
      const skillDir = path.join(dir, ".claude", "skills", "x");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "conteúdo");
      // digest REAL do dir instalado — assim o digest bate e SÓ o guard de
      // symlink pode recusar (isola a proteção; senão a camada de digest mascara).
      const digest = await directoryDigest(skillDir);

      // alvo com conteúdo idêntico → mesmo digest do original
      const alvo = path.join(dir, "alheio");
      await fs.mkdir(alvo);
      await fs.writeFile(path.join(alvo, "SKILL.md"), "conteúdo");
      await fs.rm(skillDir, { recursive: true });
      await fs.symlink(alvo, skillDir);

      const entry: StateEntry = {
        itemId: "skill:x",
        kind: "skill",
        harness: "claude",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "dir", path: skillDir, digest }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };
      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      // o alvo do symlink (e seu conteúdo) continua intacto
      expect(await fs.readFile(path.join(alvo, "SKILL.md"), "utf-8")).toBe("conteúdo");
    });
  });
});

// levi (BAIXA): bloco já ausente deve curto-circuitar, sem backup nem reescrita.
describe("remove — bloco já ausente", () => {
  it("reporta ausência sem ação quando o bloco não está no arquivo", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".cursorrules");
      await fs.writeFile(file, "só texto do usuário, sem bloco\n");
      const entry: StateEntry = {
        itemId: "agent:x",
        kind: "agent",
        harness: "cursor",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "block", path: file, blockId: "agent:x" }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };
      const result = await removeStateEntry(entry, false);
      expect(result.message).toContain("já ausente");
      // arquivo intacto, nenhum backup criado no dir
      expect(await fs.readFile(file, "utf-8")).toBe("só texto do usuário, sem bloco\n");
    });
  });

  it("remove o bloco existente e preserva o resto", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".cursorrules");
      const original = "antes\n";
      await fs.writeFile(file, upsertBlock(original, "agent:x", "instrução") + "depois\n");
      const entry: StateEntry = {
        itemId: "agent:x",
        kind: "agent",
        harness: "cursor",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "block", path: file, blockId: "agent:x" }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };
      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("ok");
      const left = await fs.readFile(file, "utf-8");
      expect(left).toContain("antes");
      expect(left).toContain("depois");
      expect(left).not.toContain("instrução");
    });
  });
});

// levi (BAIXA): exit code em recusa — CI precisa detectar que algo não saiu.
describe("remove — exit code", () => {
  it("sai com código 1 quando uma remoção é recusada", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".claude", "agents", "backend.md");
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "original\n");
      // digest do manifesto não bate com o conteúdo atual → recusa
      const entry: StateEntry = {
        itemId: "agent:backend",
        kind: "agent",
        harness: "claude",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "file", path: file, digest: sha("outro conteúdo") }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };
      const manifest = path.join(dir, "state.json");
      await upsertStateEntries([entry], manifest);

      await runRemove(["agent:backend"], { all: false, dryRun: false, yes: true }, manifest);
      expect(process.exitCode).toBe(1);
      // recusado → arquivo preservado
      expect(await fs.readFile(file, "utf-8")).toBe("original\n");
    });
  });
});

// levi (BAIXA): o ramo que recusa quando o separador declarado não está mais
// antes da seção nunca era exercitado (os testes usavam separador presente).
describe("remove — separador da seção TOML alterado", () => {
  it("recusa quando o separador declarado não precede mais a seção", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".codex", "config.toml");
      await fs.mkdir(path.dirname(file), { recursive: true });
      // só UM \n antes da seção, mas o artefato declara separator "\n\n"
      const content = 'model = "x"\n[mcp_servers.alvo]\ncommand = "npx"\nargs = []\n';
      await fs.writeFile(file, content);
      const secao = '[mcp_servers.alvo]\ncommand = "npx"\nargs = []';

      const entry: StateEntry = {
        itemId: "mcp:alvo",
        kind: "mcp",
        harness: "codex",
        target: "project",
        projectRoot: dir,
        artifacts: [{
          type: "toml-section",
          path: file,
          name: "alvo",
          digest: sha(secao),
          separator: "\n\n",
        }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(result.message).toContain("separador");
      // arquivo intacto
      expect(await fs.readFile(file, "utf-8")).toBe(content);
    });
  });
});
