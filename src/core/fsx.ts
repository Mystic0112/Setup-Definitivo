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

/** Sufixo incremental para o temporário, evitando colisão entre escritas seguidas. */
let counter = 0;

/**
 * Escreve um arquivo de forma atômica, criando os diretórios necessários.
 *
 * `fs.writeFile` trunca antes de escrever: um Ctrl-C ou ENOSPC no meio deixa a
 * config do usuário pela metade. Escrever num temporário no MESMO diretório e
 * renomear é atômico no mesmo filesystem — o arquivo ou é o antigo, ou é o novo.
 */
export async function writeFileEnsured(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${counter++}`);
  try {
    await fs.writeFile(tmp, content, { encoding: "utf-8", mode: 0o600 });
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}
