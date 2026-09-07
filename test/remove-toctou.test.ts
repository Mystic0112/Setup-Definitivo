import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { removeStateEntry } from "../src/installers/remove.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { upsertBlock } from "../src/installers/config.js";
import type { StateEntry } from "../src/core/state.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-toctou-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

function blockEntry(dir: string, file: string): StateEntry {
  return {
    itemId: "agent:x",
    kind: "agent",
    harness: "cursor",
    target: "project",
    projectRoot: dir,
    artifacts: [{ type: "block", path: file, blockId: "agent:x" }],
    installedAt: "2026-09-06T12:00:00.000Z",
  };
}

// nezuko (LOW): o preflight calcula o conteúdo novo a partir da versão lida
// naquele momento; a escrita acontece depois. Se o arquivo mudar no meio, escrever
// o conteúdo obsoleto apagaria a edição do usuário. Deve falhar fechado.
describe("remove — TOCTOU entre preflight e escrita", () => {
  it("não escreve conteúdo obsoleto se o arquivo mudar no meio", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".cursorrules");
      await fs.writeFile(file, upsertBlock("antes\n", "agent:x", "instrução"));

      // simula edição concorrente: a primeira leitura é a do preflight; logo
      // depois o arquivo é alterado por "outro processo".
      const real = fs.readFile.bind(fs);
      let leituras = 0;
      vi.spyOn(fs, "readFile").mockImplementation(async (...args: unknown[]) => {
        const resultado = await (real as (...a: unknown[]) => Promise<string | Buffer>)(...args);
        if (args[0] === file && ++leituras === 1) {
          await fs.writeFile(file, "conteúdo NOVO do usuário\n");
        }
        return resultado;
      });

      // vai pelo adapter, como o comando faz: ele embrulha a exceção em
      // status:"error" em vez de deixar propagar.
      const [result] = await cursorAdapter.remove([blockEntry(dir, file)], { dryRun: false });
      vi.restoreAllMocks();

      expect(result.status).toBe("error");
      expect(result.message).toContain("mudou durante a remoção");
      expect(result.removed).toBe(false);
      // a edição concorrente sobreviveu
      expect(await fs.readFile(file, "utf-8")).toBe("conteúdo NOVO do usuário\n");
    });
  });

  it("caminho normal (arquivo estável) continua removendo", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, ".cursorrules");
      await fs.writeFile(file, upsertBlock("antes\n", "agent:x", "instrução"));
      const result = await removeStateEntry(blockEntry(dir, file), false);
      expect(result.status).toBe("ok");
      expect(await fs.readFile(file, "utf-8")).not.toContain("instrução");
    });
  });
});
