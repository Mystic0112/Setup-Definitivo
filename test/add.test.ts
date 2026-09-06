import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as prompts from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdd } from "../src/commands/add.js";

let logs: string[] = [];
let previousCwd: string;
let tmp: string;

beforeEach(async () => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args) => {
    logs.push(args.join(" "));
  });
  vi.spyOn(prompts.log, "step").mockImplementation(() => {});
  vi.spyOn(prompts.log, "warn").mockImplementation(() => {});
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-add-"));
  previousCwd = process.cwd();
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(previousCwd);
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("comando add", () => {
  it("rejeita quando nenhum item é passado", async () => {
    await runAdd([], { harness: [], project: false, dryRun: true });
    expect(process.exitCode).toBe(1);
    expect(logs.join("\n")).toContain("ao menos um item");
  });

  it("rejeita id inexistente sem tocar em nada", async () => {
    await runAdd(["mcp:naoexiste"], { harness: ["claude"], project: false, dryRun: false });
    expect(process.exitCode).toBe(1);
    expect(logs.join("\n")).toContain("inexistentes no catálogo");
  });

  it("rejeita harness sem adapter", async () => {
    await runAdd(["agent:backend"], { harness: ["gemini"], project: false, dryRun: true });
    expect(process.exitCode).toBe(1);
    expect(logs.join("\n")).toContain("Harness sem adapter");
  });

  it("resolve dependências: command puxa o agent", async () => {
    await runAdd(["command:backend"], { harness: ["claude"], project: true, dryRun: false });
    // command requer agent:backend — ambos os arquivos devem existir
    expect(await fs.readFile(path.join(tmp, ".claude/agents/backend.md"), "utf-8")).toContain("backend");
    expect(await fs.readFile(path.join(tmp, ".claude/commands/backend.md"), "utf-8")).toBeTruthy();
    expect(logs.join("\n")).toContain("Dependências adicionadas: agent:backend");
  });

  it("dry-run não escreve nada", async () => {
    await runAdd(["agent:backend"], { harness: ["claude"], project: true, dryRun: true });
    await expect(fs.access(path.join(tmp, ".claude"))).rejects.toThrow();
  });
});
