import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claudeAdapter } from "../src/adapters/claude.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { removeStateEntry } from "../src/installers/remove.js";
import { agentsDir, commandsDir } from "../src/core/targets.js";
import { CATALOG } from "../src/registry/items.js";
import type { StateEntry } from "../src/core/state.js";

async function inTempProject(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-agent-"));
  const previous = process.cwd();
  process.chdir(dir);
  try {
    await run(dir);
  } finally {
    process.chdir(previous);
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const agentItem = CATALOG.find((item) => item.id === "agent:backend")!;
const commandItem = CATALOG.find((item) => item.id === "command:backend")!;

function entryFor(itemId: string, artifacts: StateEntry["artifacts"], dir: string): StateEntry {
  return {
    itemId,
    kind: itemId.startsWith("command") ? "command" : "agent",
    harness: "claude",
    target: "project",
    projectRoot: dir,
    artifacts,
    installedAt: new Date(0).toISOString(),
  };
}

describe("catálogo de agents e commands", () => {
  // Checa o pareamento em vez de um número fixo: o que importa é que todo agent
  // tenha seu command e vice-versa. Fixar a contagem só obriga a editar o teste
  // toda vez que um agente novo entra, sem provar nada a mais.
  it("todo agent tem command e todo command tem agent", () => {
    const agents = CATALOG.filter((item) => item.kind === "agent").map((i) => i.id.split(":")[1]);
    const commands = CATALOG.filter((item) => item.kind === "command").map((i) => i.id.split(":")[1]);
    expect(agents.length).toBeGreaterThanOrEqual(12);
    expect([...agents].sort()).toEqual([...commands].sort());
  });

  it("todo command declara dependência do agent correspondente", () => {
    for (const command of CATALOG.filter((item) => item.kind === "command")) {
      const name = command.id.split(":")[1];
      expect(command.requires).toContain(`agent:${name}`);
    }
  });
});

describe("instalação de agent e command", () => {
  it("vai para agents/ e commands/ no harness com suporte nativo", async () => {
    await inTempProject(async (dir) => {
      const results = await claudeAdapter.apply([agentItem, commandItem], {
        target: "project",
        dryRun: false,
      });
      expect(results.every((result) => result.status === "ok")).toBe(true);

      const agentFile = path.join(agentsDir("claude", "project", dir), "backend.md");
      const commandFile = path.join(commandsDir("claude", "project", dir), "backend.md");
      expect(await fs.readFile(agentFile, "utf-8")).toContain("name: backend");
      expect(await fs.readFile(commandFile, "utf-8")).toContain("backend");
    });
  });

  it("degrada para bloco de instrução em harness sem esses conceitos", async () => {
    await inTempProject(async (dir) => {
      const results = await cursorAdapter.apply([agentItem], {
        target: "project",
        dryRun: false,
      });
      expect(results[0].message).toContain("convertido em instrução");
      const rules = await fs.readFile(path.join(dir, ".cursorrules"), "utf-8");
      expect(rules).toContain("<!-- setup-definitivo:start:agent:backend -->");
      // frontmatter do agente não deve vazar para o arquivo de regras
      expect(rules).not.toContain("name: backend\ndescription:");
    });
  });

  it("dry-run não escreve nada", async () => {
    await inTempProject(async (dir) => {
      await claudeAdapter.apply([agentItem, commandItem], { target: "project", dryRun: true });
      await expect(fs.readdir(path.join(dir, ".claude"))).rejects.toThrow();
    });
  });

  it("reinstalar não duplica nem gera backup", async () => {
    await inTempProject(async (dir) => {
      await claudeAdapter.apply([agentItem], { target: "project", dryRun: false });
      const before = await fs.readdir(agentsDir("claude", "project", dir));
      const second = await claudeAdapter.apply([agentItem], { target: "project", dryRun: false });
      expect(second[0].message).toContain("já atualizado");
      expect(await fs.readdir(agentsDir("claude", "project", dir))).toEqual(before);
    });
  });
});

describe("remoção de agent", () => {
  it("apaga o arquivo instalado e é idempotente", async () => {
    await inTempProject(async (dir) => {
      const results = await claudeAdapter.apply([agentItem], { target: "project", dryRun: false });
      const entry = entryFor("agent:backend", results[0].artifacts!, dir);
      const file = path.join(agentsDir("claude", "project", dir), "backend.md");

      const dry = await removeStateEntry(entry, true);
      expect(dry.message).toContain("[dry-run]");
      expect(await fs.readFile(file, "utf-8")).toContain("name: backend");

      const real = await removeStateEntry(entry, false);
      expect(real.status).toBe("ok");
      await expect(fs.access(file)).rejects.toThrow();

      const again = await removeStateEntry(entry, false);
      expect(again.message).toContain("já ausente");
    });
  });

  it("recusa apagar arquivo que o usuário editou", async () => {
    await inTempProject(async (dir) => {
      const results = await claudeAdapter.apply([agentItem], { target: "project", dryRun: false });
      const entry = entryFor("agent:backend", results[0].artifacts!, dir);
      const file = path.join(agentsDir("claude", "project", dir), "backend.md");
      await fs.appendFile(file, "\nlinha do usuário\n");

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(result.removed).toBe(false);
      expect(result.message).toContain("modificado pelo usuário");
      expect(await fs.readFile(file, "utf-8")).toContain("linha do usuário");
    });
  });

  // O alvo do symlink tem o MESMO conteúdo do original de propósito: assim o
  // digest bate e só a verificação de symlink pode recusar. Com alvo diferente,
  // o teste passaria pelo digest e não exercitaria este guard.
  it("recusa apagar quando o destino virou symlink", async () => {
    await inTempProject(async (dir) => {
      const results = await claudeAdapter.apply([agentItem], { target: "project", dryRun: false });
      const entry = entryFor("agent:backend", results[0].artifacts!, dir);
      const file = path.join(agentsDir("claude", "project", dir), "backend.md");
      const conteudo = await fs.readFile(file, "utf-8");

      const alvo = path.join(dir, "alvo.md");
      await fs.writeFile(alvo, conteudo);
      await fs.rm(file);
      await fs.symlink(alvo, file);

      const result = await removeStateEntry(entry, false);
      expect(result.status).toBe("skipped");
      expect(result.message).toContain("não é mais o arquivo instalado");
      expect(await fs.readFile(alvo, "utf-8")).toBe(conteudo);
    });
  });
});
