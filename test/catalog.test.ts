import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/registry/items.js";

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

describe("integridade do catálogo", () => {
  // O catálogo já declarou skills cujo assets/ estava vazio: todas retornavam
  // "PULADO: assets ausentes" e o setup não instalava nada. Este teste impede
  // que um item volte a prometer o que não entrega.
  it("todo item de source local tem os assets no repositório", async () => {
    const locais = CATALOG.filter((item) => item.source?.type === "local");
    expect(locais.length).toBeGreaterThan(0);

    const faltando: string[] = [];
    for (const item of locais) {
      const source = path.resolve(pkgRoot, (item.source as { path: string }).path);
      if (!(await exists(source))) faltando.push(`${item.id} -> ${(item.source as { path: string }).path}`);
    }
    expect(faltando).toEqual([]);
  });

  it("nenhum source escapa do pacote", () => {
    for (const item of CATALOG.filter((entry) => entry.source?.type === "local")) {
      const source = path.resolve(pkgRoot, (item.source as { path: string }).path);
      expect(source.startsWith(pkgRoot + path.sep)).toBe(true);
    }
  });

  // O README já ficou dizendo 53 enquanto o catálogo tinha 55. Número em
  // documentação deriva em silêncio; aqui ele falha alto.
  it("a contagem de itens no README bate com o catálogo", async () => {
    const readme = await fs.readFile(path.join(pkgRoot, "README.md"), "utf-8");
    const declarado = readme.match(/\*\*(\d+) itens\*\*/)?.[1];
    expect(declarado, "README precisa declarar '**N itens**'").toBeTruthy();
    expect(Number(declarado)).toBe(CATALOG.length);
  });

  it("ids são únicos", () => {
    const ids = CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda dependência declarada em requires existe no catálogo", () => {
    const ids = new Set(CATALOG.map((item) => item.id));
    for (const item of CATALOG) {
      for (const dependency of item.requires ?? []) {
        expect(ids, `${item.id} requer ${dependency}`).toContain(dependency);
      }
    }
  });

  it("todo item com needsSecret aponta um guia existente", async () => {
    for (const item of CATALOG.filter((entry) => entry.needsSecret)) {
      expect(item.guide, `${item.id} precisa de guia`).toBeTruthy();
      expect(await exists(path.resolve(pkgRoot, item.guide!))).toBe(true);
    }
  });

  it("todo plugin declara marketplace e nome", () => {
    for (const item of CATALOG.filter((entry) => entry.kind === "plugin")) {
      expect(item.plugin?.marketplace).toBeTruthy();
      expect(item.plugin?.name).toBeTruthy();
    }
  });

  it("todo mcp e tool declaram comando", () => {
    for (const item of CATALOG.filter((entry) => entry.kind === "mcp")) {
      expect(item.mcp?.cmd, `${item.id}`).toBeTruthy();
    }
    for (const item of CATALOG.filter((entry) => entry.kind === "tool")) {
      expect(item.tool?.cmd, `${item.id}`).toBeTruthy();
    }
  });

  // O agent:security referencia os playbooks por caminho; sem eles, ele está
  // quebrado por design no ambiente de quem instalar.
  it("os playbooks do Strix acompanham a squad, com atribuição", async () => {
    const item = CATALOG.find((entry) => entry.id === "skill:strix-playbooks");
    expect(item).toBeDefined();

    const dir = path.resolve(pkgRoot, "assets/playbooks");
    const arquivos = await fs.readdir(dir, { recursive: true });
    expect(arquivos.filter((name) => String(name).endsWith(".md")).length).toBeGreaterThan(50);

    const atribuicao = await fs.readFile(path.join(dir, "ATTRIBUTION.md"), "utf-8");
    expect(atribuicao).toContain("usestrix/strix");
    expect(atribuicao).toContain("Apache");
  });

  // Checa o home REAL do autor, não qualquer /home/. Os playbooks do Strix citam
  // /home/pentester (caminho de runtime do sandbox deles) — isso é documentação
  // legítima, não vazamento da máquina de quem empacotou.
  it("nenhum asset carrega o caminho da máquina do autor", async () => {
    const dir = path.resolve(pkgRoot, "assets");
    const homeAutor = os.homedir();
    const arquivos = await fs.readdir(dir, { recursive: true });
    const suspeitos: string[] = [];
    for (const nome of arquivos) {
      const alvo = path.join(dir, String(nome));
      if (!(await fs.stat(alvo)).isFile()) continue;
      const conteudo = await fs.readFile(alvo, "utf-8").catch(() => "");
      if (conteudo.includes(homeAutor)) suspeitos.push(String(nome));
    }
    expect(suspeitos).toEqual([]);
  });
});
