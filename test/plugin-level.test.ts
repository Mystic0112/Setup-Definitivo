import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyPluginLevel, pluginConfigFile } from "../src/installers/plugin.js";
import { CATALOG } from "../src/registry/items.js";

let tmp: string;
let xdgAnterior: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "setup-definitivo-lvl-"));
  xdgAnterior = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tmp; // isola do ~/.config real
});

afterEach(async () => {
  if (xdgAnterior === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = xdgAnterior;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("nível padrão dos plugins", () => {
  // ponytail e caveman vêm em "full" de fábrica, e full IMPÕE comportamento.
  // Quem instala um setup não pediu para mudar como o agente decide arquitetura.
  it("caveman e ponytail entram no catálogo com o nível mínimo", () => {
    for (const id of ["plugin:caveman", "plugin:ponytail"]) {
      const item = CATALOG.find((entry) => entry.id === id);
      expect(item, id).toBeDefined();
      expect(item!.plugin?.defaultLevel, id).toBe("lite");
    }
  });

  it("cria o config com defaultMode quando não existe", async () => {
    const msg = await applyPluginLevel("ponytail", "lite");
    const file = pluginConfigFile("ponytail");
    expect(JSON.parse(await fs.readFile(file, "utf-8"))).toEqual({ defaultMode: "lite" });
    expect(msg).toContain("lite");
  });

  // A escolha do usuário ganha da nossa sugestão — sempre.
  it("NÃO sobrescreve um defaultMode que o usuário já escolheu", async () => {
    const file = pluginConfigFile("ponytail");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ defaultMode: "ultra" }) + "\n");

    const msg = await applyPluginLevel("ponytail", "lite");

    expect(JSON.parse(await fs.readFile(file, "utf-8")).defaultMode).toBe("ultra");
    expect(msg).toContain("já está");
  });

  it("preserva as outras chaves do config do usuário", async () => {
    const file = pluginConfigFile("caveman");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ outraCoisa: 42 }) + "\n");

    await applyPluginLevel("caveman", "lite");

    expect(JSON.parse(await fs.readFile(file, "utf-8"))).toEqual({
      outraCoisa: 42,
      defaultMode: "lite",
    });
  });

  it("recusa mexer em config que não é JSON válido", async () => {
    const file = pluginConfigFile("ponytail");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{ quebrado");

    const msg = await applyPluginLevel("ponytail", "lite");

    expect(msg).toContain("não é JSON válido");
    expect(await fs.readFile(file, "utf-8")).toBe("{ quebrado"); // intacto
  });

  it("respeita XDG_CONFIG_HOME no caminho do config", () => {
    expect(pluginConfigFile("ponytail")).toBe(path.join(tmp, "ponytail", "config.json"));
  });
});
