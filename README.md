# Setup Definitivo

CLI interativa para configurar um ambiente de IA completo — **MCPs, skills, ferramentas e configuração** — em **qualquer harness** (Claude, Cursor, Codex, Gemini CLI, opencode, OmniRoute…), perguntando no terminal o que você quer adicionar.

Duas formas de usar — escolha a que preferir.

## 1. Deixe sua IA configurar

Aponte seu agente (Claude Code, Codex, Cursor, Gemini CLI, opencode…) para o repositório:

> *"Leia o SETUP.md deste repositório e configure meu ambiente."*

O [`SETUP.md`](SETUP.md) instrui o agente a detectar o que existe na máquina, propor um plano,
esperar sua confirmação e aplicar — com as mesmas proteções da CLI. Funciona inclusive em
harness que ainda não tem adapter, porque quem executa é o próprio agente.

## 2. Use a CLI

Determinística, com `--dry-run`, backup automático e `remove` conservador:

```bash
npx github:Mystic0112/Setup-Definitivo init --dry-run   # mostra o plano, não escreve
npx github:Mystic0112/Setup-Definitivo init             # wizard interativo
npx github:Mystic0112/Setup-Definitivo doctor           # diagnóstico do ambiente
npx github:Mystic0112/Setup-Definitivo remove <id>      # remove o que instalou
```

Desenvolvimento local:

```bash
npm install
npm run dev -- init --dry-run
npm run dev -- list
```

> Status: adapters de Claude, Cursor e Codex funcionando; `remove` implementado.
> Roadmap em [docs/PLAN.md](docs/PLAN.md).

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
