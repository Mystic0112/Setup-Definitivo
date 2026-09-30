import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installHook } from "../src/installers/hook.js";
import { removeStateEntry } from "../src/installers/remove.js";
import { CATALOG } from "../src/registry/items.js";
import type { Artifact, StateEntry } from "../src/core/state.js";

const item = CATALOG.find((i) => i.id === "hook:rule-guard")!;

let tmp: string;
let home: string;
let claudeDir: string;
let settingsPath: string;
let scriptPath: string;
let rulesPath: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-hook-"));
  home = path.join(tmp, "home");
  await fs.mkdir(home, { recursive: true });
  process.env.SETUP_DEFINITIVO_HOME = path.join(tmp, "sd-home");
  vi.spyOn(os, "homedir").mockReturnValue(home);
  claudeDir = path.join(home, ".claude");
  settingsPath = path.join(claudeDir, "settings.json");
  scriptPath = path.join(claudeDir, "hooks", "rule-guard.py");
  rulesPath = path.join(claudeDir, "rules.jsonl");
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.SETUP_DEFINITIVO_HOME;
  await fs.rm(tmp, { recursive: true, force: true });
});

function entryFrom(artifacts: Artifact[]): StateEntry {
  return {
    itemId: item.id,
    kind: "hook",
    harness: "claude",
    target: "global",
    projectRoot: null,
    artifacts: artifacts as [Artifact, ...Artifact[]],
    installedAt: "2026-09-30T12:00:00.000Z",
  };
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(file, "utf-8"));
}

describe("hook:rule-guard", () => {
  it("install copia o script, semeia rules.jsonl e patcha settings preservando o resto", async () => {
    // settings pré-existente: o patch deve ser aditivo, não destrutivo.
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }, null, 2));

    const { artifacts } = await installHook(item, "claude", "global", false);

    expect(await fs.readFile(scriptPath, "utf-8")).toContain("PreToolUse");
    expect(await fs.readFile(rulesPath, "utf-8")).toContain("rule-guard");

    const settings = await readJson(settingsPath);
    const pre = (settings.hooks as any).PreToolUse[0];
    expect(pre.matcher).toBe("Write|Edit|MultiEdit");
    expect(pre.hooks[0].command).toContain(scriptPath);
    // preservou o que já existia
    expect((settings.permissions as any).allow).toContain("Bash(ls:*)");

    // artefatos: um file (script) e um settings-hook; rules.jsonl NÃO é rastreado
    expect(artifacts.map((a) => a.type).sort()).toEqual(["file", "settings-hook"]);
  });

  it("remove tira só o script e a entrada de hook, preservando rules.jsonl e o resto do settings", async () => {
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }, null, 2));
    const { artifacts } = await installHook(item, "claude", "global", false);

    const result = await removeStateEntry(entryFrom(artifacts), false);
    expect(result.status).toBe("ok");

    // script apagado
    await expect(fs.access(scriptPath)).rejects.toThrow();
    // rules.jsonl preservado (dado do usuário)
    expect(await fs.readFile(rulesPath, "utf-8")).toContain("rule-guard");
    // entrada de hook removida, mas o resto do settings intacto
    const settings = await readJson(settingsPath);
    expect(settings.hooks).toBeUndefined();
    expect((settings.permissions as any).allow).toContain("Bash(ls:*)");
  });

  it("dry-run não escreve nada", async () => {
    const { artifacts } = await installHook(item, "claude", "global", true);
    expect(artifacts).toEqual([]);
    await expect(fs.access(claudeDir)).rejects.toThrow();
  });

  it("semente preservada: rules.jsonl do usuário nunca é sobrescrito", async () => {
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(rulesPath, '{"id":"minha","glob":"**","forbid":"x","message":"m","severity":"block"}\n');

    const { message } = await installHook(item, "claude", "global", false);
    expect(message).toContain("semente preservada");
    expect(await fs.readFile(rulesPath, "utf-8")).toContain('"minha"');
  });
});
