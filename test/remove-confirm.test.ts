import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @clack/prompts tem exports read-only (não dá para vi.spyOn no confirm).
// Mockamos o módulo inteiro e controlamos o confirm por teste.
const confirmMock = vi.fn();
vi.mock("@clack/prompts", () => ({
  note: () => {},
  cancel: () => {},
  intro: () => {},
  outro: () => {},
  confirm: (...args: unknown[]) => confirmMock(...args),
  isCancel: (value: unknown) => value === null,
  log: { step: () => {}, warn: () => {}, info: () => {} },
  spinner: () => ({ start() {}, stop() {}, message() {} }),
}));

const { runRemove } = await import("../src/commands/remove.js");
const { upsertStateEntries, readState } = await import("../src/core/state.js");
import type { StateEntry } from "../src/core/state.js";

let tmp: string;

beforeEach(async () => {
  confirmMock.mockReset();
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-confirm-"));
});

afterEach(async () => {
  process.exitCode = undefined;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function seedAgent(): Promise<{ file: string; manifest: string }> {
  const file = path.join(tmp, ".claude", "agents", "backend.md");
  await fs.mkdir(path.dirname(file), { recursive: true });
  const conteudo = "# agente backend\n";
  await fs.writeFile(file, conteudo);
  const digest = createHash("sha256").update(conteudo).digest("hex");
  const entry: StateEntry = {
    itemId: "agent:backend",
    kind: "agent",
    harness: "claude",
    target: "project",
    projectRoot: tmp,
    artifacts: [{ type: "file", path: file, digest }],
    installedAt: "2026-09-06T12:00:00.000Z",
  };
  const manifest = path.join(tmp, "state.json");
  await upsertStateEntries([entry], manifest);
  return { file, manifest };
}

describe("remove — portão de confirmação", () => {
  it("pede confirmação quando não é --yes nem --dry-run", async () => {
    const { manifest } = await seedAgent();
    confirmMock.mockResolvedValue(true);
    await runRemove(["agent:backend"], { all: false, dryRun: false, yes: false }, manifest);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it("cancelar aborta sem apagar nem tocar no manifesto", async () => {
    const { file, manifest } = await seedAgent();
    confirmMock.mockResolvedValue(false); // usuário respondeu "não"
    await runRemove(["agent:backend"], { all: false, dryRun: false, yes: false }, manifest);

    expect(await fs.readFile(file, "utf-8")).toContain("agente backend"); // não apagou
    const state = await readState(manifest);
    expect(state.entries).toHaveLength(1); // manifesto intacto
  });

  it("confirmar apaga o artefato e limpa o manifesto", async () => {
    const { file, manifest } = await seedAgent();
    confirmMock.mockResolvedValue(true);
    await runRemove(["agent:backend"], { all: false, dryRun: false, yes: false }, manifest);

    await expect(fs.access(file)).rejects.toThrow(); // apagou
    const state = await readState(manifest);
    expect(state.entries).toHaveLength(0); // manifesto limpo
  });

  it("--yes não pede confirmação", async () => {
    const { manifest } = await seedAgent();
    await runRemove(["agent:backend"], { all: false, dryRun: false, yes: true }, manifest);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("--dry-run não pede confirmação nem apaga", async () => {
    const { file, manifest } = await seedAgent();
    await runRemove(["agent:backend"], { all: false, dryRun: true, yes: false }, manifest);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(await fs.readFile(file, "utf-8")).toContain("agente backend");
  });
});
