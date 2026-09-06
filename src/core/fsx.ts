import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Home da CLI (~/.setup-definitivo), com override por env para isolar testes. */
export function setupHome(): string {
  return process.env.SETUP_DEFINITIVO_HOME ?? path.join(os.homedir(), ".setup-definitivo");
}

/** Diretório central de backups, fora de qualquer repositório do usuário. */
export function backupsDir(): string {
  return path.join(setupHome(), "backups");
}

/**
 * Backup de um arquivo antes de sobrescrever. Retorna o caminho do .bak ou null.
 *
 * Os backups vão para um diretório CENTRAL (~/.setup-definitivo/backups), não ao
 * lado do original: um backup de `mcp.json`/`config.toml` carrega credenciais, e
 * ao lado do original (escopo projeto) ele nasceria dentro do repositório git do
 * usuário — candidato a `git add .` e vazamento no histórico (nezuko, MEDIUM).
 * O nome achata o caminho de origem + hash curto para evitar colisão.
 */
export async function backupFile(file: string): Promise<string | null> {
  if (!(await exists(file))) return null;
  const dir = backupsDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const hash = createHash("sha256").update(path.resolve(file)).digest("hex").slice(0, 8);
  const base = path.join(dir, `${path.basename(file)}.${hash}.bak-${stamp}`);
  let bak = base;
  let suffix = 1;
  while (await exists(bak)) bak = `${base}-${suffix++}`;
  // Cria já com 0600 em vez de copyFile+chmod: evita janela em 0644 num arquivo
  // que pode ter API key. Buffer (sem encoding) preserva binário; "wx" evita corrida.
  const data = await fs.readFile(file);
  await fs.writeFile(bak, data, { mode: 0o600, flag: "wx" });
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
