import type { Harness } from "../registry/schema.js";

export type Role = "plan" | "code" | "review" | "docs" | "solo";

export const ROLE_LABEL: Record<Role, string> = {
  plan: "Planejar",
  code: "Codar",
  review: "Revisar",
  docs: "Documentar",
  solo: "Uso geral",
};

const HARNESS_LABEL: Record<Harness, string> = {
  claude: "Claude",
  cursor: "Cursor",
  codex: "Codex",
  gemini: "Gemini",
  opencode: "opencode",
  omniroute: "OmniRoute",
};

export interface Pipeline {
  harnesses: Harness[];
  roles: Record<string, Role[]>;
}

/** Conteúdo da skill de papel de um harness (formato SKILL.md, funciona no Claude). */
export function roleSkillContent(harness: Harness, roles: Role[], pipe: Pipeline): string {
  const mine = roles.map((r) => ROLE_LABEL[r]).join(" + ");
  const others = pipe.harnesses
    .filter((h) => h !== harness)
    .map((h) => `- **${HARNESS_LABEL[h]}**: ${(pipe.roles[h] ?? []).map((r) => ROLE_LABEL[r]).join(" + ")}`)
    .join("\n");

  return `---
name: pipeline-role
description: Papel deste harness (${HARNESS_LABEL[harness]}) no pipeline multi-harness do Setup Definitivo.
---

# Papel: ${mine}

Você é o **${HARNESS_LABEL[harness]}** neste projeto. Seu papel é: **${mine}**.

## Outros harnesses no pipeline
${others || "- (nenhum)"}

## Protocolo de handoff
Siga o \`HANDOFF.md\` na raiz do projeto. Ao concluir sua etapa, registre o estado
e o que o próximo harness precisa saber, conforme a convenção descrita lá.

- Não invada o papel dos outros (ex.: se seu papel é revisar, não reescreva do zero).
- Ao terminar, escreva um bloco de handoff no \`HANDOFF.md\` para o próximo papel.
`;
}

/** Conteúdo do HANDOFF.md compartilhado descrevendo o pipeline. */
export function handoffContent(pipe: Pipeline): string {
  const order = pipe.harnesses
    .map((h) => `${HARNESS_LABEL[h]} (${(pipe.roles[h] ?? []).map((r) => ROLE_LABEL[r]).join(" + ")})`)
    .join(" → ");

  const rows = pipe.harnesses
    .map((h) => `| ${HARNESS_LABEL[h]} | ${(pipe.roles[h] ?? []).map((r) => ROLE_LABEL[r]).join(" + ")} |`)
    .join("\n");

  return `# HANDOFF — pipeline multi-harness

Gerado pelo Setup Definitivo. Define quem faz o quê e como passar o bastão.

## Fluxo
${order}

## Papéis
| Harness | Papel |
|---|---|
${rows}

## Convenção de handoff
1. Cada harness executa **apenas seu papel**.
2. Ao concluir, adiciona um bloco abaixo com: o que fez, arquivos tocados, e o que falta.
3. O próximo harness lê o último bloco antes de começar.
4. Trabalhe sempre num branch por tarefa; revisão vira PR.

## Registro
<!-- handoffs abaixo, mais recente no topo -->
`;
}
