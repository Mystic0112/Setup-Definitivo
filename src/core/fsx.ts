import fs from "node:fs/promises";
import path from "node:path";

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Backup de um arquivo antes de sobrescrever. Retorna o caminho do .bak ou null. */
export async function backupFile(file: string): Promise<string | null> {
  if (!(await exists(file))) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `${file}.bak-${stamp}`;
  let bak = base;
  let suffix = 1;
  while (await exists(bak)) bak = `${base}-${suffix++}`;
  await fs.copyFile(file, bak);
  await fs.chmod(bak, 0o600);
  return bak;
}

/** Copia um diretório recursivamente (Node 20 fs.cp). */
export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true, dereference: true });
}

/** Escreve um arquivo criando os diretórios necessários. */
export async function writeFileEnsured(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, { encoding: "utf-8", mode: 0o600 });
}
