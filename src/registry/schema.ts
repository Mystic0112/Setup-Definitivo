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
  kind: z.enum(["mcp", "skill", "tool", "config"]),
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
});

export type Item = z.infer<typeof ItemSchema>;
export type Harness = z.infer<typeof HarnessSchema>;
export type Target = z.infer<typeof TargetSchema>;

export const CatalogSchema = z.array(ItemSchema);
