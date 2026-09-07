import { z } from "zod";

/** Onde a config pode ser aplicada. */
export const TargetSchema = z.enum(["global", "project"]);

/** Harnesses suportados (crescem por adapter, sem mudar o catálogo). */
export const HarnessSchema = z.enum([
  "claude",
  "cursor",
  "codex",
  "gemini",
  "opencode",
  "omniroute",
]);

/** Fonte de um item empacotado a partir de um repositório git. */
export const GitSourceSchema = z.object({
  type: z.literal("git"),
  repo: z.string().url().or(z.string().startsWith("git@")),
  ref: z.string().default("main"),
  subdir: z.string().optional(),
});

/** Fonte local (empacotada dentro de assets/). */
export const LocalSourceSchema = z.object({
  type: z.literal("local"),
  path: z.string(),
});

export const SourceSchema = z.discriminatedUnion("type", [
  GitSourceSchema,
  LocalSourceSchema,
]);

/** Item do catálogo — descreve O QUE instalar (o adapter sabe COMO). */
export const ItemSchema = z.object({
  id: z.string().regex(/^[a-z]+:[a-z0-9-]+$/, "formato esperado: kind:nome"),
  // `agent` e `command` são arquivos .md únicos (definição de subagente e slash
  // command); `skill` é um diretório com SKILL.md. Destinos diferentes no harness.
  // `plugin` é instalado pelo gerenciador do próprio harness a partir de um
  // marketplace — não copiamos o conteúdo, só registramos a fonte.
  kind: z.enum(["mcp", "skill", "agent", "command", "plugin", "tool", "config"]),
  name: z.string(),
  description: z.string(),
  targets: z.array(TargetSchema).nonempty(),
  /** Harnesses onde este item faz sentido. Vazio = todos os suportados. */
  harnesses: z.array(HarnessSchema).optional(),
  /** Dependências de outros itens (por id). */
  requires: z.array(z.string()).optional(),
  /** Fonte para skills/tools empacotadas. */
  source: SourceSchema.optional(),
  /** Precisa de credencial/login em runtime. Se sim, aponta o guia. */
  needsSecret: z.boolean().default(false),
  guide: z.string().optional(),
  /** Como registrar um MCP (comando do servidor). Ex.: npx -y @pkg. */
  mcp: z
    .object({ cmd: z.string(), args: z.array(z.string()).default([]) })
    .optional(),
  /** Como instalar uma tool externa. Ex.: uv tool install graphifyy. */
  tool: z
    .object({ cmd: z.string(), args: z.array(z.string()).default([]) })
    .optional(),
  /** Plugin de marketplace: repo que hospeda o marketplace + nome do plugin. */
  plugin: z
    .object({
      marketplace: z.string(),
      name: z.string(),
      /**
       * Nível de intensidade sugerido para plugins que têm um.
       *
       * Plugins como ponytail e caveman vêm em `full` de fábrica, e `full`
       * IMPÕE comportamento (o ponytail força a escada de decisão: stdlib antes
       * de dependência, one-liner antes de 50 linhas). Quem instala um setup não
       * pediu para mudar como o agente decide arquitetura. O mínimo sugere sem
       * impor — quem quiser mais sobe depois, conscientemente.
       */
      defaultLevel: z.string().optional(),
    })
    .optional(),
  /** Payload de config: patch de settings.json e/ou bloco de instrução. */
  config: z
    .object({
      settings: z.record(z.unknown()).optional(),
      instruction: z.string().optional(),
      blockId: z.string().optional(),
    })
    .optional(),
});

export type Item = z.infer<typeof ItemSchema>;
export type Harness = z.infer<typeof HarnessSchema>;
export type Target = z.infer<typeof TargetSchema>;

export const CatalogSchema = z.array(ItemSchema);
