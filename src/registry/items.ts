import { CatalogSchema } from "./schema.js";

/**
 * Catálogo declarativo. Adicionar suporte a algo novo = adicionar uma entrada aqui.
 * As skills da squad usam id por capacidade (rename aplicado no empacotamento);
 * libs externas de design vêm por git URL (não são copiadas pra dentro do repo).
 */
export const CATALOG = CatalogSchema.parse([
  // ── Squad (nomes por capacidade; label híbrido com persona) ──────────────
  { id: "skill:backend", kind: "skill", name: "Backend (Bruno)", description: "Backend PHP/Laravel: APIs, refactor, debugging.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/backend" }, needsSecret: false },
  { id: "skill:frontend", kind: "skill", name: "Frontend (Fiona)", description: "Frontend React/Vue/CSS, UI/UX e acessibilidade.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/frontend" }, needsSecret: false },
  { id: "skill:database", kind: "skill", name: "Database (Diana)", description: "Modelagem, queries, tuning, migrations.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/database" }, needsSecret: false },
  { id: "skill:qa", kind: "skill", name: "QA (Quinn)", description: "Testes, code review, SOLID, Clean Code.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/qa" }, needsSecret: false },
  { id: "skill:security", kind: "skill", name: "Security (Sam)", description: "OWASP, análise de vulnerabilidades, hardening.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/security" }, needsSecret: false },
  { id: "skill:devops", kind: "skill", name: "DevOps (Otto)", description: "Docker, CI/CD, deploy, infra, monitoramento.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/devops" }, needsSecret: false },
  { id: "skill:mobile", kind: "skill", name: "Mobile (Mia)", description: "React Native e Flutter.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/mobile" }, needsSecret: false },
  { id: "skill:scripting", kind: "skill", name: "Scripting (Nina)", description: "Python e Node: scripts, APIs, CLIs, automações.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/scripting" }, needsSecret: false },
  { id: "skill:architect", kind: "skill", name: "Architect (Artur)", description: "Arquitetura de software, DDD, ADRs.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/architect" }, needsSecret: false },
  { id: "skill:data", kind: "skill", name: "Data/BI (Dado)", description: "Data, BI, ETL, dashboards.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/data" }, needsSecret: false },
  { id: "skill:pm", kind: "skill", name: "PM (Pam)", description: "Planejamento, estimativas, documentação técnica.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/pm" }, needsSecret: false },
  { id: "skill:lead", kind: "skill", name: "Lead (Leo)", description: "Coordenação multi-domínio; orquestra os demais.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/lead" }, needsSecret: false },

  // ── Design & UI (via git URL — preenchê-las com o repo/ref reais) ────────
  { id: "skill:impeccable", kind: "skill", name: "Impeccable", description: "Design/UX frontend anti-slop.", targets: ["global", "project"], source: { type: "git", repo: "https://github.com/OWNER/impeccable", ref: "main" }, needsSecret: false },
  { id: "skill:design-taste", kind: "skill", name: "Design Taste", description: "taste-skills / design-taste-frontend.", targets: ["global", "project"], source: { type: "git", repo: "https://github.com/OWNER/taste-skills", ref: "main" }, needsSecret: false },
  { id: "skill:motion", kind: "skill", name: "Motion", description: "Biblioteca de animação/motion.", targets: ["global", "project"], source: { type: "git", repo: "https://github.com/OWNER/motion", ref: "main" }, needsSecret: false },

  // ── MCPs ─────────────────────────────────────────────────────────────────
  // NB: cmd/args de cada MCP precisam de conferência na doc oficial antes de publicar.
  { id: "mcp:21st", kind: "mcp", name: "21st.dev Magic", description: "Geração de componentes UI via Magic MCP.", targets: ["global", "project"], needsSecret: true, guide: "docs/mcp/21st.md", mcp: { cmd: "npx", args: ["-y", "@21st-dev/magic@latest"] } },
  { id: "mcp:clickup", kind: "mcp", name: "ClickUp", description: "Tarefas, docs e workspace do ClickUp.", targets: ["global", "project"], needsSecret: true, guide: "docs/mcp/clickup.md", mcp: { cmd: "npx", args: ["-y", "@clickup/mcp-server@latest"] } },
  { id: "mcp:notebooklm", kind: "mcp", name: "NotebookLM", description: "Notebooks, fontes e geração (áudio/vídeo/slides).", targets: ["global", "project"], needsSecret: true, guide: "docs/mcp/notebooklm.md", mcp: { cmd: "npx", args: ["-y", "notebooklm-mcp@latest"] } },
  { id: "mcp:desktop-commander", kind: "mcp", name: "Desktop Commander", description: "Controle de terminal e arquivos.", targets: ["global", "project"], needsSecret: false, mcp: { cmd: "npx", args: ["-y", "@wonderwhy-er/desktop-commander@latest"] } },

  // ── Ferramentas + skills de produtividade ────────────────────────────────
  { id: "tool:graphify", kind: "tool", name: "graphify (motor)", description: "uv tool install graphifyy — motor de grafo de conhecimento.", targets: ["global"], needsSecret: false, tool: { cmd: "uv", args: ["tool", "install", "graphifyy"] } },
  { id: "skill:graphify", kind: "skill", name: "graphify (skill)", description: "Orquestra o graphify: código/docs → grafo consultável.", targets: ["global", "project"], requires: ["tool:graphify"], source: { type: "local", path: "assets/skills/graphify" }, needsSecret: false },
  { id: "skill:caveman", kind: "skill", name: "caveman", description: "Estilo de resposta terso.", targets: ["global", "project"], source: { type: "local", path: "assets/skills/caveman" }, needsSecret: false },
  { id: "skill:ponytail", kind: "skill", name: "ponytail", description: "Solução mais simples que funciona (anti over-engineering).", targets: ["global", "project"], source: { type: "local", path: "assets/skills/ponytail" }, needsSecret: false },

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
