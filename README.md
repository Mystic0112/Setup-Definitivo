<div align="center">

# ⚙️ Setup Definitivo

**Um comando. Todo o teu ambiente de IA configurado — em qualquer harness.**

Agentes, slash commands, MCPs, plugins, skills e configuração,
instalados de forma **reprodutível, reversível e auditável**.

[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Catálogo](https://img.shields.io/badge/cat%C3%A1logo-declarativo-blue)](#-cat%C3%A1logo)
[![Harnesses](https://img.shields.io/badge/harnesses-Claude%20%C2%B7%20Cursor%20%C2%B7%20Codex-purple)](#-harnesses)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

</div>

---

## 🌊 O problema

Você monta um ambiente de IA bom — agentes especializados, MCPs, skills, permissões — e aí:

- troca de máquina e perde tudo
- quer usar no Cursor e no Codex, mas cada um guarda config num formato diferente
- alguém do time pede "como você configurou isso?" e a resposta é meia hora de instrução
- tenta desfazer e não sabe o que era seu e o que a ferramenta criou

**Setup Definitivo** resolve isso: um catálogo declarativo do teu ambiente + duas formas de aplicá-lo.

---

## 🚀 Início rápido

### Caminho A — deixe sua IA configurar

Aponte seu agente (Claude Code, Codex, Cursor, Gemini CLI, opencode…) para o repositório:

> *"Leia o SETUP.md deste repositório e configure meu ambiente."*

O [`SETUP.md`](SETUP.md) instrui o agente a detectar o ambiente, propor um plano, **esperar sua
confirmação** e aplicar — com as mesmas regras de segurança da CLI. Funciona até em harness que
ainda não tem adapter, porque quem executa é o próprio agente.

### Caminho B — use a CLI

```bash
# vê o plano, sem escrever nada
npx github:Mystic0112/Setup-Definitivo init --dry-run

# wizard interativo
npx github:Mystic0112/Setup-Definitivo init
```

Nada de publicação no npm: `prepare` compila na instalação, então o `npx` do GitHub já funciona.

---

## 🤖 Comandos

| Comando | O que faz |
|---|---|
| `init` | Wizard interativo: harness → papéis → alvo → itens → preview → aplica |
| `add <id...>` | Instala itens pelo id, sem wizard; resolve dependências |
| `list` | Lista o catálogo inteiro por categoria |
| `doctor` | Diagnostica binários, harnesses detectados e catálogo |
| `update` | Reaplica o que está no manifesto usando o catálogo atual |
| `remove <id...>` | Desfaz o que instalou — **recusando** o que você editou |

Todos aceitam `--dry-run`. `remove` pede confirmação (a menos de `--yes`).

---

## 📦 Catálogo

**59 itens** organizados em 7 categorias. O wizard pergunta uma categoria por vez.

<details open>
<summary><b>🧠 Agentes (13)</b> — especialistas por domínio</summary>

| id | Domínio |
|---|---|
| `agent:backend` | PHP/Laravel: APIs, refactor, debugging |
| `agent:frontend` | React/Vue/CSS, UI/UX, acessibilidade |
| `agent:database` | Modelagem, queries, tuning, migrations |
| `agent:qa` | Testes, code review, SOLID, Clean Code |
| `agent:security` | OWASP, análise de vulnerabilidades, hardening |
| `agent:devops` | Docker, CI/CD, deploy, monitoramento |
| `agent:mobile` | React Native e Flutter |
| `agent:scripting` | Python e Node: scripts, APIs, CLIs |
| `agent:architect` | Arquitetura de software, DDD, ADRs |
| `agent:data` | Data, BI, ETL, dashboards |
| `agent:pm` | Planejamento, estimativas, documentação |
| `agent:lead` | Coordenação multi-domínio; orquestra os demais |
| `agent:agent-builder` | **Cria outros agentes** seguindo esta mesma arquitetura |

Cada agente tem um **slash command** correspondente (`command:backend` → `/backend`), que declara
dependência do agente — marcar o command puxa o agente junto.

</details>

<details>
<summary><b>🔌 MCPs (2) e Plugins (4)</b></summary>

| id | O que dá |
|---|---|
| `mcp:notebooklm` 🔑 | Notebooks, fontes, geração de áudio/vídeo/slides |
| `mcp:desktop-commander` | Terminal e arquivos |
| `plugin:caveman` | Respostas compactas, sem perder substância |
| `plugin:ponytail` | Força a solução mais simples que funciona |
| `plugin:taste-skill` | Design frontend: brutalist, minimalist, redesign, stitch |
| `plugin:codex` | Delega tarefa ao Codex e traz o resultado para revisão |

Plugins vêm pelo **marketplace do harness** — nada de terceiro é redistribuído aqui.

</details>

<details>
<summary><b>📚 Skills (21)</b> — conhecimento carregado sob demanda</summary>

**Referência técnica** (os agentes carregam quando a tarefa pede):
`php-laravel-ref` · `react-ref` · `frontend-ref` · `db-engines-ref` · `owasp-laravel-ref` ·
`devops-ref` · `arch-ddd-ref` · `pm-ref` · `data-bi-ref` · `mobile-ref` · `python-node-ref` ·
`api-docs-ref`

**Produtividade**:
`codex-code` · `defuddle` · `notebooklm` · `skill-builder`

**Obsidian / grafo de conhecimento**:
`obsidian-cli` · `obsidian-markdown` · `obsidian-bases` · `json-canvas`

**Pentest**: `strix-playbooks` — 63 playbooks por vulnerabilidade, framework, cloud e protocolo.
Do [usestrix/strix](https://github.com/usestrix/strix) (Apache-2.0, com
[atribuição](assets/playbooks/ATTRIBUTION.md)). O `agent:security` depende deles.

</details>

<details>
<summary><b>🛠️ Ferramentas (4) e Configuração (2)</b></summary>

| id | O que faz |
|---|---|
| `tool:motion` | Motion AI Kit: skills e MCP de animação nos agentes |
| `tool:graphify` | Motor de grafo de conhecimento: código/docs → grafo consultável |
| `tool:impeccable` | Design/UX, detecção de anti-padrões de UI |
| `tool:21st` 🔑 | Roda o instalador oficial do 21st (componentes de UI) |
| `config:base-instructions` | Bloco base no CLAUDE.md / AGENTS.md / .cursorrules |
| `config:hooks-basicos` | Permissões explícitas de comandos básicos |

🔑 = precisa de credencial. Cada um tem guia em [`docs/mcp/`](docs/mcp) — a CLI **nunca** pede,
lê ou grava a tua credencial.

</details>

---

## 🎯 Harnesses

O catálogo descreve **o que** instalar. Um adapter por harness sabe **como** aplicar ali.

```
              Catálogo declarativo (capacidade abstrata)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   AdapterClaude         AdapterCursor        AdapterCodex
   ~/.claude/            ~/.cursor/           ~/.codex/
   claude mcp add        mcp.json             config.toml
   agents/ commands/     .cursorrules         AGENTS.md
   skills/               (degrada)            (degrada)
```

| Capacidade | Claude | Cursor | Codex |
|---|---|---|---|
| Registrar MCP | ✅ `claude mcp add` | ✅ `mcp.json` | ✅ `config.toml` |
| Agents / commands | ✅ nativo | ⚠️ vira instrução | ⚠️ vira instrução |
| Skills | ✅ nativo | ⚠️ vira instrução | ⚠️ vira instrução |
| Arquivo de instrução | `CLAUDE.md` | `.cursorrules` / `rules/` | `AGENTS.md` |
| settings.json | ✅ | — | — |

⚠️ = **degradação elegante**: onde o conceito não existe, o conteúdo entra como bloco marcado no
arquivo de instrução, individualmente removível.

Gemini CLI, opencode e OmniRoute aparecem no wizard marcados como *adapter não implementado* —
para eles, use o **Caminho A** (sua IA lê o `SETUP.md`).

---

## 🔗 Pipeline multi-harness

Usa mais de uma IA? O wizard pergunta o papel de cada uma:

```
Gemini planeja  →  Codex coda  →  Claude revisa
```

A partir disso ele gera, na hora, uma **instrução de papel** em cada harness (no formato dele) e um
`HANDOFF.md` compartilhado com o protocolo de quem passa o bastão pra quem.

> **Escopo honesto:** harnesses são CLIs separadas, sem runtime compartilhado. O setup gera o
> *papel + protocolo* — cada uma sabe o que faz e como entregar. Handoff 100% automático (uma
> chamando a outra) exigiria um router; não está aqui.

---

## 🔄 Este repositório é vivo

**Sempre atualizado com novidades.** À medida que o ecossistema muda — MCPs novos, harnesses novos,
skills melhores, plugins que valem a pena — o catálogo acompanha.

O que está no radar:

- adapters de **Gemini CLI**, **opencode** e **OmniRoute**
- mais MCPs e plugins conforme aparecem
- perfis prontos (`--profile completo | design | mínimo`)
- preview por harness no wizard

Sugestões, issues e PRs são bem-vindos. Se você usa um MCP, plugin ou skill que merece entrar no
catálogo, abra uma issue — o catálogo é declarativo justamente para ser fácil de estender.

---

<div align="center">

**MIT** · feito para quem cansou de reconfigurar o ambiente do zero

</div>
