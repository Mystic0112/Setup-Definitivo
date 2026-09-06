import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backupFile, writeFileEnsured } from "../src/core/fsx.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-fsx-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

afterEach(() => vi.restoreAllMocks());

describe("writeFileEnsured", () => {
  it("cria diretórios e escreve com modo 0600", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "a", "b", "config.json");
      await writeFileEnsured(file, "conteúdo\n");
      expect(await fs.readFile(file, "utf-8")).toBe("conteúdo\n");
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    });
  });

  it("substitui o conteúdo anterior", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.json");
      await writeFileEnsured(file, "antigo");
      await writeFileEnsured(file, "novo");
      expect(await fs.readFile(file, "utf-8")).toBe("novo");
    });
  });

  // O ponto da escrita atômica: se falhar no meio, o arquivo antigo continua
  // íntegro. Com writeFile direto, o truncate já teria destruído o conteúdo.
  it("preserva o arquivo antigo quando a escrita falha", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.json");
      await writeFileEnsured(file, "conteúdo original\n");

      vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("ENOSPC simulado"));
      await expect(writeFileEnsured(file, "conteúdo novo")).rejects.toThrow("ENOSPC simulado");

      expect(await fs.readFile(file, "utf-8")).toBe("conteúdo original\n");
    });
  });

  it("não deixa arquivo temporário para trás quando falha", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.json");
      await writeFileEnsured(file, "original");

      vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("falha"));
      await expect(writeFileEnsured(file, "novo")).rejects.toThrow();

      expect(await fs.readdir(dir)).toEqual(["config.json"]);
    });
  });

  it("escritas seguidas não colidem no temporário", async () => {
    await withTempDir(async (dir) => {
      const files = ["a.json", "b.json", "c.json"].map((name) => path.join(dir, name));
      await Promise.all(files.map((file, index) => writeFileEnsured(file, `valor ${index}`)));
      for (const [index, file] of files.entries()) {
        expect(await fs.readFile(file, "utf-8")).toBe(`valor ${index}`);
      }
      expect((await fs.readdir(dir)).sort()).toEqual(["a.json", "b.json", "c.json"]);
    });
  });
});

describe("backupFile", () => {
  it("retorna null quando o arquivo não existe", async () => {
    await withTempDir(async (dir) => {
      expect(await backupFile(path.join(dir, "ausente.json"))).toBeNull();
    });
  });

  it("copia o conteúdo e restringe a permissão a 0600", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.json");
      await fs.writeFile(file, "segredo fake\n", { mode: 0o644 });

      const backup = await backupFile(file);

      expect(await fs.readFile(backup!, "utf-8")).toBe("segredo fake\n");
      expect((await fs.stat(backup!)).mode & 0o777).toBe(0o600);
    });
  });

  // Dois backups no mesmo milissegundo geravam o mesmo nome e o segundo
  // sobrescrevia o primeiro — perdendo o backup do arquivo ORIGINAL.
  it("não sobrescreve backup anterior feito no mesmo instante", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.json");
      const fixo = new Date("2026-09-06T12:00:00.000Z");
      vi.spyOn(globalThis, "Date").mockImplementation(() => fixo as unknown as Date);

      await fs.writeFile(file, "versão 1\n");
      const primeiro = await backupFile(file);
      await fs.writeFile(file, "versão 2\n");
      const segundo = await backupFile(file);

      expect(segundo).not.toBe(primeiro);
      expect(await fs.readFile(primeiro!, "utf-8")).toBe("versão 1\n");
      expect(await fs.readFile(segundo!, "utf-8")).toBe("versão 2\n");
    });
  });
});
