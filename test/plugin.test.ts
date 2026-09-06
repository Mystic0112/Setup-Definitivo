import { afterEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { installClaudePlugin } from "../src/installers/plugin.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { CATALOG } from "../src/registry/items.js";
import type { Item } from "../src/registry/schema.js";

vi.mock("execa", () => ({ execa: vi.fn() }));
const execaMock = vi.mocked(execa);

const item = CATALOG.find((entry) => entry.id === "plugin:taste-skill")!;

afterEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

describe("catálogo de plugin", () => {
  it("declara marketplace e nome", () => {
    expect(item.kind).toBe("plugin");
    expect(item.plugin).toEqual({ marketplace: "leonxlnx/taste-skill", name: "taste-skill" });
  });
});

describe("installClaudePlugin", () => {
  it("dry-run não executa nada e descreve os dois comandos", async () => {
    const result = await installClaudePlugin(item, true);
    expect(execaMock).not.toHaveBeenCalled();
    expect(result.message).toContain("plugin marketplace add leonxlnx/taste-skill");
    expect(result.message).toContain("plugin install taste-skill");
  });

  it("adiciona o marketplace antes de instalar", async () => {
    execaMock.mockResolvedValue({} as never);
    await installClaudePlugin(item, false);

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(execaMock.mock.calls[0]?.[1]).toEqual([
      "plugin", "marketplace", "add", "leonxlnx/taste-skill",
    ]);
    expect(execaMock.mock.calls[1]?.[1]).toEqual([
      "plugin", "install", "taste-skill", "--yes",
    ]);
  });

  // Marketplace já registrado é o caso comum na segunda execução; não pode abortar.
  it("segue para o install quando o marketplace já existe", async () => {
    execaMock
      .mockRejectedValueOnce(Object.assign(new Error("falhou"), {
        shortMessage: "marketplace already exists",
      }))
      .mockResolvedValueOnce({} as never);

    const result = await installClaudePlugin(item, false);

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(result.message).toContain("plugin instalado");
  });

  it("propaga falha real do marketplace sem tentar instalar", async () => {
    execaMock.mockRejectedValueOnce(Object.assign(new Error("falhou"), {
      shortMessage: "network unreachable",
    }));

    await expect(installClaudePlugin(item, false)).rejects.toThrow();
    expect(execaMock).toHaveBeenCalledTimes(1);
  });

  it("registra o comando de desinstalação para o remove reportar", async () => {
    execaMock.mockResolvedValue({} as never);
    const result = await installClaudePlugin(item, false);
    expect(result.removeCommand).toBe("claude plugin uninstall taste-skill");
  });

  it("lança quando o item não tem spec de plugin", async () => {
    const invalid = { ...item, plugin: undefined } as Item;
    await expect(installClaudePlugin(invalid, false)).rejects.toThrow("sem spec de plugin");
  });
});

describe("plugin em harness sem gerenciador", () => {
  it("é pulado com aviso, sem executar comando", async () => {
    const results = await cursorAdapter.apply([item], { target: "global", dryRun: false });
    expect(results[0].message).toContain("não tem gerenciador de plugins");
    expect(execaMock).not.toHaveBeenCalled();
  });
});
