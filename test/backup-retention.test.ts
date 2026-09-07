import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { backupFile, backupsDir } from "../src/core/fsx.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-ret-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Backups deste arquivo no dir central. */
async function backupsDe(file: string): Promise<string[]> {
  const dir = backupsDir();
  const nomes = await fs.readdir(dir).catch(() => [] as string[]);
  return nomes.filter((n) => n.startsWith(`${path.basename(file)}.`)).sort();
}

// nezuko (MEDIUM): sem poda, uma chave rotacionada continua viva para sempre nos
// backups antigos — a revogação por edição do config vira ilusória.
describe("retenção de backups", () => {
  it("mantém no máximo 5 backups por arquivo, descartando os mais antigos", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "config.toml");

      for (let i = 1; i <= 8; i++) {
        await fs.writeFile(file, `versao ${i}\n`);
        await backupFile(file);
      }

      const restantes = await backupsDe(file);
      expect(restantes).toHaveLength(5);

      // os 5 que sobraram são os das versões mais recentes (4..8), não as antigas
      const conteudos = await Promise.all(
        restantes.map((n) => fs.readFile(path.join(backupsDir(), n), "utf-8"))
      );
      const versoes = conteudos.map((c) => Number(c.match(/versao (\d+)/)![1])).sort((a, b) => a - b);
      expect(versoes).toEqual([4, 5, 6, 7, 8]);
    });
  });

  it("a poda não afeta backups de outros arquivos", async () => {
    await withTempDir(async (dir) => {
      const a = path.join(dir, "a.json");
      const b = path.join(dir, "b.json");
      await fs.writeFile(b, "b original\n");
      await backupFile(b);

      for (let i = 1; i <= 7; i++) {
        await fs.writeFile(a, `a ${i}\n`);
        await backupFile(a);
      }

      expect(await backupsDe(a)).toHaveLength(5);
      expect(await backupsDe(b)).toHaveLength(1); // intacto
    });
  });

  it("backups seguem com modo 0600 após a poda", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "settings.json");
      for (let i = 1; i <= 6; i++) {
        await fs.writeFile(file, `{"v":${i}}\n`);
        await backupFile(file);
      }
      for (const nome of await backupsDe(file)) {
        const modo = (await fs.stat(path.join(backupsDir(), nome))).mode & 0o777;
        expect(modo).toBe(0o600);
      }
    });
  });
});
