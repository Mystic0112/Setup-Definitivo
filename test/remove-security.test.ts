import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { removeStateEntry } from "../src/installers/remove.js";
import type { StateEntry } from "../src/core/state.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-sec-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Achado HIGH (auditoria de segurança): sem allowlist de raízes, um manifesto
// adulterado apagava arquivo arbitrário. O digest não protege — quem escreve a
// entrada escreve o digest. A defesa é confinar o caminho às raízes do harness.
describe("remove — allowlist de raízes", () => {
  it("recusa apagar arquivo fora das raízes gerenciadas, mesmo com digest válido", async () => {
    await withTempDir(async (dir) => {
      const victim = path.join(dir, "victim.txt");
      await fs.writeFile(victim, "conteúdo da vítima");

      const entry: StateEntry = {
        itemId: "file:evil",
        kind: "agent",
        harness: "claude",
        target: "global", // global → raiz permitida é ~/.claude, não o tmp
        projectRoot: null,
        artifacts: [{ type: "file", path: victim, digest: sha("conteúdo da vítima") }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(result.removed).toBe(false);
      expect(result.message).toContain("fora das raízes gerenciadas");
      // o arquivo continua lá
      expect(await fs.readFile(victim, "utf-8")).toBe("conteúdo da vítima");
    });
  });

  it("recusa rm -rf de diretório fora das raízes", async () => {
    await withTempDir(async (dir) => {
      const victimDir = path.join(dir, "importante");
      await fs.mkdir(victimDir);
      await fs.writeFile(path.join(victimDir, "dado.txt"), "não apague");

      const entry: StateEntry = {
        itemId: "dir:evil",
        kind: "skill",
        harness: "claude",
        target: "global",
        projectRoot: null,
        artifacts: [{ type: "dir", path: victimDir, digest: "qualquer" }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(await fs.access(path.join(victimDir, "dado.txt")).then(() => true)).toBe(true);
    });
  });

  it("um projectRoot forjado não amplia o escopo para fora dele", async () => {
    await withTempDir(async (dir) => {
      const victim = path.join(dir, "fora.txt");
      await fs.writeFile(victim, "x");
      // projectRoot aponta para um subdir; o artefato está FORA dele
      const projectRoot = path.join(dir, "projeto");
      await fs.mkdir(projectRoot);

      const entry: StateEntry = {
        itemId: "file:evil",
        kind: "agent",
        harness: "claude",
        target: "project",
        projectRoot,
        artifacts: [{ type: "file", path: victim, digest: sha("x") }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(await fs.readFile(victim, "utf-8")).toBe("x");
    });
  });

  it("permite remover dentro do projectRoot declarado", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".claude", "agents", "backend.md");
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "conteúdo");

      const entry: StateEntry = {
        itemId: "agent:backend",
        kind: "agent",
        harness: "claude",
        target: "project",
        projectRoot: dir,
        artifacts: [{ type: "file", path: file, digest: sha("conteúdo") }],
        installedAt: "2026-09-06T12:00:00.000Z",
      };

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("ok");
      await expect(fs.access(file)).rejects.toThrow();
    });
  });
});
