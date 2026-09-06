import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { skillsDir, instructionFile } from "../src/core/targets.js";
import { claudeMcpArgs, mcpName } from "../src/installers/mcp.js";
import { roleSkillContent, handoffContent, type Pipeline } from "../src/generators/roles.js";
import { CATALOG } from "../src/registry/items.js";
import { CatalogSchema } from "../src/registry/schema.js";

describe("targets", () => {
  it("skills globais do Claude ficam em ~/.claude/skills", () => {
    expect(skillsDir("claude", "global")).toBe(path.join(os.homedir(), ".claude", "skills"));
  });
  it("skills de projeto ficam em ./.claude/skills", () => {
    expect(skillsDir("claude", "project", "/tmp/proj")).toBe("/tmp/proj/.claude/skills");
  });
  it("arquivo de instrução varia por harness", () => {
    expect(instructionFile("codex", "project", "/tmp/proj")).toBe("/tmp/proj/AGENTS.md");
    expect(instructionFile("cursor", "project", "/tmp/proj")).toBe("/tmp/proj/.cursorrules");
  });
});

describe("mcp", () => {
  it("deriva o nome curto do id", () => {
    const item = CATALOG.find((i) => i.id === "mcp:clickup")!;
    expect(mcpName(item)).toBe("clickup");
  });
  it("monta os args do claude mcp add", () => {
    const item = CATALOG.find((i) => i.id === "mcp:21st")!;
    expect(claudeMcpArgs(item)).toEqual([
      "mcp", "add", "21st", "--", "npx", "-y", "@21st-dev/magic@latest",
    ]);
  });
});

describe("roles", () => {
  const pipe: Pipeline = {
    harnesses: ["gemini", "codex", "claude"],
    roles: { gemini: ["plan"], codex: ["code"], claude: ["review"] },
  };
  it("skill de papel cita o papel e os outros harnesses", () => {
    const c = roleSkillContent("claude", ["review"], pipe);
    expect(c).toContain("name: pipeline-role");
    expect(c).toContain("Revisar");
    expect(c).toContain("Codex");
    expect(c).toContain("Gemini");
  });
  it("handoff descreve o fluxo na ordem", () => {
    const h = handoffContent(pipe);
    expect(h).toContain("Gemini (Planejar) → Codex (Codar) → Claude (Revisar)");
  });
});

describe("catálogo", () => {
  it("passa na validação da schema (zod)", () => {
    expect(() => CatalogSchema.parse(CATALOG)).not.toThrow();
  });
});
