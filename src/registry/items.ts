import { CatalogSchema } from "./schema.js";

/**
 * Catálogo declarativo. Adicionar suporte a algo novo = adicionar uma entrada aqui.
 * As skills da squad usam id por capacidade (rename aplicado no empacotamento);
 * libs externas de design vêm por git URL (não são copiadas pra dentro do repo).
 */
export const CATALOG = CatalogSchema.parse([
  // ── Squad: agents (definição de subagente) ───────────────────────────────
  { id: "agent:backend", kind: "agent", name: "Backend (Bruno)", description: "Backend PHP/Laravel: APIs, refactor, debugging.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/backend.md" }, needsSecret: false },
  { id: "agent:frontend", kind: "agent", name: "Frontend (Fiona)", description: "Frontend React/Vue/CSS, UI/UX e acessibilidade.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/frontend.md" }, needsSecret: false },
  { id: "agent:database", kind: "agent", name: "Database (Diana)", description: "Modelagem, queries, tuning, migrations.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/database.md" }, needsSecret: false },
  { id: "agent:qa", kind: "agent", name: "QA (Quinn)", description: "Testes, code review, SOLID, Clean Code.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/qa.md" }, needsSecret: false },
  { id: "agent:security", kind: "agent", name: "Security (Sam)", description: "OWASP, análise de vulnerabilidades, hardening.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/security.md" }, needsSecret: false },
  { id: "agent:devops", kind: "agent", name: "DevOps (Otto)", description: "Docker, CI/CD, deploy, infra, monitoramento.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/devops.md" }, needsSecret: false },
  { id: "agent:mobile", kind: "agent", name: "Mobile (Mia)", description: "React Native e Flutter.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/mobile.md" }, needsSecret: false },
  { id: "agent:scripting", kind: "agent", name: "Scripting (Nina)", description: "Python e Node: scripts, APIs, CLIs, automações.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/scripting.md" }, needsSecret: false },
  { id: "agent:architect", kind: "agent", name: "Architect (Artur)", description: "Arquitetura de software, DDD, ADRs.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/architect.md" }, needsSecret: false },
  { id: "agent:data", kind: "agent", name: "Data/BI (Dado)", description: "Data, BI, ETL, dashboards.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/data.md" }, needsSecret: false },
  { id: "agent:pm", kind: "agent", name: "PM (Pam)", description: "Planejamento, estimativas, documentação técnica.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/pm.md" }, needsSecret: false },
  { id: "agent:lead", kind: "agent", name: "Lead (Leo)", description: "Coordenação multi-domínio; orquestra os demais.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/lead.md" }, needsSecret: false },
  { id: "agent:agent-builder", kind: "agent", name: "Agent Builder (Vera)", description: "Cria outros agentes seguindo a arquitetura do squad: frontmatter, persona, regras e skills sob demanda.", targets: ["global", "project"], source: { type: "local", path: "assets/agents/agent-builder.md" }, needsSecret: false },

  // ── Squad: commands (slash command que invoca o subagente) ──────────────
  { id: "command:backend", kind: "command", name: "/backend — Backend (Bruno)", description: "Slash command que invoca o subagente backend.", targets: ["global", "project"], requires: ["agent:backend"], source: { type: "local", path: "assets/commands/backend.md" }, needsSecret: false },
  { id: "command:frontend", kind: "command", name: "/frontend — Frontend (Fiona)", description: "Slash command que invoca o subagente frontend.", targets: ["global", "project"], requires: ["agent:frontend"], source: { type: "local", path: "assets/commands/frontend.md" }, needsSecret: false },
  { id: "command:database", kind: "command", name: "/database — Database (Diana)", description: "Slash command que invoca o subagente database.", targets: ["global", "project"], requires: ["agent:database"], source: { type: "local", path: "assets/commands/database.md" }, needsSecret: false },
  { id: "command:qa", kind: "command", name: "/qa — QA (Quinn)", description: "Slash command que invoca o subagente qa.", targets: ["global", "project"], requires: ["agent:qa"], source: { type: "local", path: "assets/commands/qa.md" }, needsSecret: false },
  { id: "command:security", kind: "command", name: "/security — Security (Sam)", description: "Slash command que invoca o subagente security.", targets: ["global", "project"], requires: ["agent:security"], source: { type: "local", path: "assets/commands/security.md" }, needsSecret: false },
  { id: "command:devops", kind: "command", name: "/devops — DevOps (Otto)", description: "Slash command que invoca o subagente devops.", targets: ["global", "project"], requires: ["agent:devops"], source: { type: "local", path: "assets/commands/devops.md" }, needsSecret: false },
  { id: "command:mobile", kind: "command", name: "/mobile — Mobile (Mia)", description: "Slash command que invoca o subagente mobile.", targets: ["global", "project"], requires: ["agent:mobile"], source: { type: "local", path: "assets/commands/mobile.md" }, needsSecret: false },
  { id: "command:scripting", kind: "command", name: "/scripting — Scripting (Nina)", description: "Slash command que invoca o subagente scripting.", targets: ["global", "project"], requires: ["agent:scripting"], source: { type: "local", path: "assets/commands/scripting.md" }, needsSecret: false },
  { id: "command:architect", kind: "command", name: "/architect — Architect (Artur)", description: "Slash command que invoca o subagente architect.", targets: ["global", "project"], requires: ["agent:architect"], source: { type: "local", path: "assets/commands/architect.md" }, needsSecret: false },
  { id: "command:data", kind: "command", name: "/data — Data/BI (Dado)", description: "Slash command que invoca o subagente data.", targets: ["global", "project"], requires: ["agent:data"], source: { type: "local", path: "assets/commands/data.md" }, needsSecret: false },
  { id: "command:pm", kind: "command", name: "/pm — PM (Pam)", description: "Slash command que invoca o subagente pm.", targets: ["global", "project"], requires: ["agent:pm"], source: { type: "local", path: "assets/commands/pm.md" }, needsSecret: false },
  { id: "command:lead", kind: "command", name: "/lead — Lead (Leo)", description: "Slash command que invoca o subagente lead.", targets: ["global", "project"], requires: ["agent:lead"], source: { type: "local", path: "assets/commands/lead.md" }, needsSecret: false },
  { id: "command:agent-builder", kind: "command", name: "/agent-builder — Agent Builder (Vera)", description: "Slash command que invoca o subagente agent-builder.", targets: ["global", "project"], requires: ["agent:agent-builder"], source: { type: "local", path: "assets/commands/agent-builder.md" }, needsSecret: false },

  // ── Design & UI ─────────────────────────────────────────────────────────
  // taste-skill: MIT, github.com/leonxlnx/taste-skill. É um plugin com marketplace,
  // então o próprio harness instala — não redistribuímos o conteúdo e o autor
  // continua publicando atualizações.
  { id: "plugin:taste-skill", kind: "plugin", name: "Taste Skill (design)", description: "Skills de taste para frontend: brutalist, minimalist, soft, redesign, stitch.", targets: ["global"], harnesses: ["claude"], needsSecret: false, plugin: { marketplace: "leonxlnx/taste-skill", name: "taste-skill" } },
  // impeccable: verificado no npm (v4.0.3, Apache-2.0, github.com/pbakaus/impeccable).
  // O instalador dele é o próprio pacote, então entra como tool.
  { id: "tool:impeccable", kind: "tool", name: "Impeccable (design/UX)", description: "Skills e comandos de design para agentes; detecção de anti-padrões de UI.", targets: ["global"], needsSecret: false, tool: { cmd: "npx", args: ["-y", "impeccable@latest", "init"] } },

  // ── MCPs ─────────────────────────────────────────────────────────────────
  // Nomes verificados no registro npm em 2026-09-06. @21st-dev/magic era um proxy
  // de compatibilidade depreciado; o pacote atual é @21st-dev/cli.
  // O 21st é um MCP HTTP (url + header com API key), não um servidor stdio: o
  // próprio CLI dele faz o registro e o login. Por isso entra como tool, não mcp.
  { id: "tool:21st", kind: "tool", name: "21st.dev (componentes UI)", description: "Roda o instalador oficial do 21st, que registra o MCP e cuida do login.", targets: ["global"], needsSecret: true, guide: "docs/mcp/21st.md", tool: { cmd: "npx", args: ["-y", "@21st-dev/cli@latest", "init"] } },
  { id: "mcp:notebooklm", kind: "mcp", name: "NotebookLM", description: "Notebooks, fontes e geração (áudio/vídeo/slides).", targets: ["global", "project"], needsSecret: true, guide: "docs/mcp/notebooklm.md", mcp: { cmd: "npx", args: ["-y", "notebooklm-mcp@latest"] } },
  { id: "mcp:desktop-commander", kind: "mcp", name: "Desktop Commander", description: "Controle de terminal e arquivos.", targets: ["global", "project"], needsSecret: false, mcp: { cmd: "npx", args: ["-y", "@wonderwhy-er/desktop-commander@latest"] } },

  // ── Skills de referência (carregadas sob demanda pelos agents da squad) ──
  { id: "skill:php-laravel-ref", kind: "skill", name: "php-laravel-ref", description: "PHP 8.3/8.4 e Laravel 11/12/13: features por versão e breaking changes.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/php-laravel-ref" }, needsSecret: false },
  { id: "skill:react-ref", kind: "skill", name: "react-ref", description: "React 19: Server Components, Actions, use(), useOptimistic, compilador.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/react-ref" }, needsSecret: false },
  { id: "skill:frontend-ref", kind: "skill", name: "frontend-ref", description: "Frontend fora do núcleo: React/Vue, CSS avançado, animações, performance.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/frontend-ref" }, needsSecret: false },
  { id: "skill:db-engines-ref", kind: "skill", name: "db-engines-ref", description: "Engines de banco: Postgres, MySQL, SQLite, Redis — tuning e índices.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/db-engines-ref" }, needsSecret: false },
  { id: "skill:owasp-laravel-ref", kind: "skill", name: "owasp-laravel-ref", description: "OWASP Top 10 mapeado para Laravel/PHP, headers e checklist LGPD.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/owasp-laravel-ref" }, needsSecret: false },
  { id: "skill:devops-ref", kind: "skill", name: "devops-ref", description: "Docker avançado, CI/CD (GitHub Actions, GitLab CI), cloud e Terraform.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/devops-ref" }, needsSecret: false },
  { id: "skill:arch-ddd-ref", kind: "skill", name: "arch-ddd-ref", description: "Arquitetura e DDD: modular monolith, API design, event-driven.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/arch-ddd-ref" }, needsSecret: false },
  { id: "skill:pm-ref", kind: "skill", name: "pm-ref", description: "Gestão de projetos: metodologias, estimativas, priorização.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/pm-ref" }, needsSecret: false },
  { id: "skill:data-bi-ref", kind: "skill", name: "data-bi-ref", description: "Data/BI: ETL/ELT, warehouses, SQL analítico, dashboards.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/data-bi-ref" }, needsSecret: false },
  { id: "skill:mobile-ref", kind: "skill", name: "mobile-ref", description: "React Native (New Architecture, Expo) e Flutter (Dart 3).", targets: ["global", "project"], source: { type: "local", path: "assets/skills/mobile-ref" }, needsSecret: false },
  { id: "skill:python-node-ref", kind: "skill", name: "python-node-ref", description: "FastAPI, Express/Fastify, padrões async, CLIs e packaging.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/python-node-ref" }, needsSecret: false },
  { id: "skill:api-docs-ref", kind: "skill", name: "api-docs-ref", description: "OpenAPI/Swagger: Scramble, L5-Swagger, Scribe e fluxo contract-first.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/api-docs-ref" }, needsSecret: false },

  // ── Skills de produtividade ─────────────────────────────────────────────
  { id: "skill:codex-code", kind: "skill", name: "codex-code", description: "Delega implementação ao Codex e revisa o resultado com a squad.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/codex-code" }, needsSecret: false },
  { id: "skill:defuddle", kind: "skill", name: "defuddle", description: "Extrai markdown limpo de páginas web, economizando tokens.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/defuddle" }, needsSecret: false },
  { id: "skill:notebooklm", kind: "skill", name: "notebooklm", description: "API completa do Google NotebookLM: fontes, áudio, vídeo, slides.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/notebooklm" }, needsSecret: false },
  { id: "skill:obsidian-cli", kind: "skill", name: "obsidian-cli", description: "Lê, cria e busca notas em vaults do Obsidian.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/obsidian-cli" }, needsSecret: false },
  { id: "skill:json-canvas", kind: "skill", name: "json-canvas", description: "Cria e edita arquivos .canvas do Obsidian: mapas mentais, fluxogramas.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/json-canvas" }, needsSecret: false },
  { id: "skill:obsidian-markdown", kind: "skill", name: "obsidian-markdown", description: "Obsidian Flavored Markdown: wikilinks, embeds, callouts, properties e frontmatter.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/obsidian-markdown" }, needsSecret: false },
  { id: "skill:obsidian-bases", kind: "skill", name: "obsidian-bases", description: "Obsidian Bases (.base): views, filtros, fórmulas e agregações sobre notas.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/obsidian-bases" }, needsSecret: false },
  { id: "skill:skill-builder", kind: "skill", name: "skill-builder", description: "Cria novas skills com frontmatter e estrutura corretos.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/skill-builder" }, needsSecret: false },

  // ── Playbooks de pentest (Strix, Apache-2.0 — ver assets/playbooks/ATTRIBUTION.md)
  // O agent:security depende deles: referencia os arquivos por caminho.
  { id: "skill:strix-playbooks", kind: "skill", name: "Playbooks de pentest (Strix)", description: "63 playbooks por vulnerabilidade, framework, cloud e protocolo. Usados pelo agent:security.", targets: ["global"], source: { type: "local", path: "assets/playbooks" }, needsSecret: false },

  // ── Plugins de marketplace (o harness instala; nada é redistribuído) ────
  { id: "plugin:caveman", kind: "plugin", name: "caveman (estilo terso)", description: "Respostas compactas, sem perder substância técnica. Instalado em 'lite': sem enrolação, mantendo frases completas.", targets: ["global"], harnesses: ["claude"], needsSecret: false, plugin: { marketplace: "JuliusBrussee/caveman", name: "caveman", defaultLevel: "lite" } },
  { id: "plugin:ponytail", kind: "plugin", name: "ponytail (anti over-engineering)", description: "Sugere a solução mais simples que funciona. Instalado em 'lite': nomeia a alternativa mais enxuta e deixa você escolher.", targets: ["global"], harnesses: ["claude"], needsSecret: false, plugin: { marketplace: "DietrichGebert/ponytail", name: "ponytail", defaultLevel: "lite" } },

  // ── Ferramentas ─────────────────────────────────────────────────────────
  // O próprio graphify instala a skill dele em 19 plataformas — melhor que copiar.
  { id: "tool:graphify", kind: "tool", name: "graphify (grafo de conhecimento)", description: "Motor + skill: transforma código/docs em grafo consultável. Com --obsidian exporta um vault; as skills obsidian-* ajudam a navegar o resultado.", targets: ["global"], needsSecret: false, tool: { cmd: "uv", args: ["tool", "install", "graphifyy"] } },

  // ── Config ────────────────────────────────────────────────────────────────
  {
    id: "config:base-instructions", kind: "config", name: "Instruções base",
    description: "Bloco base no arquivo de instrução (CLAUDE.md / AGENTS.md / .cursorrules).",
    targets: ["global", "project"], needsSecret: false,
    config: {
      blockId: "base",
      instruction: [
        "## Setup Definitivo — base",
        "",
        "- Faça o que foi pedido; nada além.",
        "- Prefira editar arquivos existentes a criar novos.",
        "- Sempre leia um arquivo antes de editá-lo.",
        "- Nunca commite segredos, credenciais ou .env.",
        "- Rode testes/build após mudanças de código.",
      ].join("\n"),
    },
  },
  {
    id: "config:hooks-basicos", kind: "config", name: "Permissões básicas",
    description: "Permissões explícitas para comandos básicos em settings.json.",
    targets: ["global", "project"], harnesses: ["claude"], needsSecret: false,
    config: {
      settings: {
        permissions: {
          allow: [
            "Bash(git status)",
            "Bash(git diff)",
            "Bash(git diff --stat)",
            "Bash(git log --oneline -n 20)",
            "Bash(ls:*)",
          ],
        },
      },
    },
  },
]);
