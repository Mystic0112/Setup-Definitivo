import os from "node:os";
import path from "node:path";
import type { Harness, Target } from "../registry/schema.js";

/** Diretório base de config de cada harness, por alvo. */
export function harnessBase(
  harness: Harness,
  target: Target,
  cwd: string = process.cwd()
): string {
  const home = os.homedir();
  const dirName: Record<Harness, string> = {
    claude: ".claude",
    cursor: ".cursor",
    codex: ".codex",
    gemini: ".gemini",
    opencode: ".opencode",
    omniroute: ".omniroute",
  };
  const d = dirName[harness];
  return target === "global" ? path.join(home, d) : path.join(cwd, d);
}

/** Onde as skills vivem no harness (quando ele suporta skills nativas). */
export function skillsDir(harness: Harness, target: Target, cwd?: string): string {
  return path.join(harnessBase(harness, target, cwd), "skills");
}

/** Arquivo settings.json de cada harness (onde o conceito existe). */
export function settingsFile(harness: Harness, target: Target, cwd?: string): string {
  const name = target === "project" ? "settings.local.json" : "settings.json";
  return path.join(harnessBase(harness, target, cwd), name);
}

/** Arquivo de instruções principal de cada harness. */
export function instructionFile(
  harness: Harness,
  target: Target,
  cwd: string = process.cwd()
): string {
  const root = target === "global" ? os.homedir() : cwd;
  const byHarness: Record<Harness, string> = {
    claude: path.join(harnessBase("claude", target, cwd), "CLAUDE.md"),
    cursor:
      target === "global"
        ? path.join(harnessBase("cursor", "global", cwd), "rules", "setup-definitivo.md")
        : path.join(root, ".cursorrules"),
    codex:
      target === "global"
        ? path.join(harnessBase("codex", "global", cwd), "AGENTS.md")
        : path.join(root, "AGENTS.md"),
    gemini: path.join(root, "GEMINI.md"),
    opencode: path.join(root, "AGENTS.md"),
    omniroute: path.join(harnessBase("omniroute", target, cwd), "instructions.md"),
  };
  return byHarness[harness];
}
