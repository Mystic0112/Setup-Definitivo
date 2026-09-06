# Setup Definitivo

CLI interativa para configurar um ambiente de IA completo — **MCPs, skills, ferramentas e configuração** — em **qualquer harness** (Claude, Cursor, Codex, Gemini CLI, opencode, OmniRoute…), perguntando no terminal o que você quer adicionar.

> Status: **Fase 0/1** — scaffold + wizard esqueleto. A aplicação real (adapters/installers) está no [roadmap](docs/PLAN.md).

## Uso (dev)

```bash
npm install
npm run dev -- init            # wizard interativo
npm run dev -- init --dry-run  # mostra o que faria, sem escrever
npm run dev -- list            # lista o catálogo
```

Quando publicado no npm:

```bash
npx setup-definitivo init
```

## Como funciona

Um **catálogo declarativo** (`src/registry/items.ts`) descreve *o que* instalar (uma capacidade abstrata). Uma camada de **adapters** por harness sabe *como* aplicar em cada CLI. Adicionar suporte novo = uma entrada no catálogo; adicionar um harness novo = um adapter, sem tocar no catálogo.

Categorias:

- **MCPs** — registra servidores MCP (ClickUp, NotebookLM, 21st.dev Magic, …). Os que exigem credencial trazem um guia em [`docs/mcp/`](docs/mcp).
- **Skills** — squad de agentes (backend, frontend, database, security, …) e skills de produtividade (graphify, caveman, ponytail). Skills de design (impeccable, motion, design-taste) vêm por **URL do GitHub**, sempre atualizadas.
- **Tools** — dependências externas (ex.: `graphify` via `uv`).
- **Config** — `settings.json`, hooks e arquivo de instruções (CLAUDE.md / AGENTS.md / .cursorrules) por harness.

## Segurança

Idempotente · backup antes de escrever · merge nunca overwrite · `--dry-run` real · reversível · **nunca grava segredo no repo** (só orienta via guia).

## Roadmap

Ver [docs/PLAN.md](docs/PLAN.md). Resumo: MVP (Claude) → config+tools+git → multi-harness (Cursor/Codex) → robustez+npm → mais harnesses.

## Licença

MIT
