# Setup Definitivo — Planejamento

CLI interativa (estilo `ruflo`) que configura um ambiente Claude Code completo — MCPs, skills/plugins, `settings.json`, `CLAUDE.md` e ferramentas externas — perguntando no terminal o que o usuário quer adicionar.

- **Distribuição:** `npx github:Mystic0112/Setup-Definitivo` (sem npm público; `prepare`
  compila o `dist/` na instalação). Alternativa: apontar a própria IA para o `SETUP.md`.
- **Alvo:** global **ou** projeto — perguntado na hora
- **Repo:** público
- **Gerencia:** MCPs · agents · commands · skills · settings/instruções · ferramentas externas
- **Harnesses com adapter:** Claude, Cursor, Codex

---

## 1. Visão

```
$ npx setup-definitivo init

  ┌─ Setup Definitivo ───────────────────────────┐
  │ Onde aplicar?   ( ) Global  ( ) Este projeto  │
  │ O que instalar? [x] MCPs                       │
  │                 [x] Skills                     │
  │                 [ ] Ferramentas               │
  │                 [x] settings.json + CLAUDE.md  │
  └───────────────────────────────────────────────┘
  → seleção granular de cada item → preview → aplica
```

Um comando, wizard guiado, resultado reprodutível. O usuário nunca edita JSON na mão.

## 2. Stack técnica

| Peça | Escolha | Por quê |
|---|---|---|
| Runtime | Node 20+ / TypeScript | igual ruflo, roda via `npx` |
| Prompts interativos | **@clack/prompts** | UI de terminal moderna, bonita, multiselect/spinner nativos |
| Parser de comandos | **commander** | padrão, leve |
| Merge de config | **deepmerge** + parse próprio | juntar settings.json sem sobrescrever |
| Exec de processos | **execa** | rodar `claude mcp add`, `uv tool install`, etc. |
| Validação | **zod** | validar o registry e inputs |
| Testes | **vitest** | rápido, TS nativo |

`ponytail:` nada de framework de plugin próprio no MVP — o "registry" é só um JSON/TS declarativo (ver §4). Adiciona complexidade só quando doer.

## 3. Comandos

| Comando | Faz |
|---|---|
| `init` | wizard completo (o principal) |
| `add <item>` | adiciona um item específico sem wizard (`add mcp:oraculo360`) |
| `remove <item>` | remove item e reverte config |
| `list` | lista o que está disponível no catálogo e o que já está instalado |
| `doctor` | diagnostica (MCPs registrados? skills presentes? deps instaladas?) e conserta com `--fix` |
| `update` | atualiza itens instalados p/ última versão do catálogo |

## 3.5 Multi-harness (roda em qualquer CLI/agente)

O setup precisa aplicar config em **vários harnesses**, não só Claude Code: Claude, Cursor, Codex, Gemini CLI, opencode, OmniRoute, etc. Cada um tem local de config, formato de MCP e conceito de "skill/instrução" diferentes. Solução: uma camada de **adapters** — o catálogo descreve *o que* instalar (capacidade abstrata); o adapter do harness sabe *como* aplicar ali.

```
        Catálogo (capacidade abstrata: "MCP oraculo360", "skill backend")
                                │
              ┌─────────────────┼─────────────────┬──────────────┐
              ▼                 ▼                 ▼              ▼
        AdapterClaude     AdapterCursor      AdapterCodex   AdapterGemini ...
        ~/.claude/        ~/.cursor/         ~/.codex/      ~/.gemini/
        mcp add           mcp.json           config.toml    settings
        skills/           rules/             AGENTS.md       extensions/
```

**Matriz de capacidade (nem tudo existe em todo harness — ser honesto):**

| Capacidade | Claude | Cursor | Codex | Gemini CLI | opencode | OmniRoute |
|---|---|---|---|---|---|---|
| Registrar MCP | ✅ `claude mcp add` | ✅ `mcp.json` | ✅ `config.toml` | ✅ | ✅ | ✅ (roteia) |
| Skills nativas | ✅ `skills/` | ⚠️ vira *rule* | ⚠️ vira seção AGENTS.md | ⚠️ extension/prompt | ⚠️ | ⚠️ |
| Arquivo de instrução | CLAUDE.md | .cursorrules / rules | AGENTS.md | GEMINI.md | AGENTS.md | — |
| Hooks/settings | ✅ | parcial | parcial | parcial | parcial | — |

- ✅ mapeia direto · ⚠️ degrada com elegância (ex.: skill vira arquivo de regra/instrução onde não há skills nativas) · — não suporta, item é pulado com aviso.
- Cada adapter implementa a mesma interface: `detect / applyMCP / applySkill / applyInstruction / applyConfig / remove`.
- **Detecção automática:** a CLI descobre quais harnesses existem na máquina (procura `~/.claude`, `~/.cursor`, binário `codex`, etc.) e pergunta em quais aplicar.
- `ponytail:` MVP cobre 3 harnesses (Claude + Cursor + Codex). Adicionar um harness novo **não**
  mexe no catálogo — isso se sustentou —, mas também **não é "só um adapter"**: são 7 pontos de
  edição (schema, targets ×2, installers/mcp, adapters/index, label do wizard, arquivo do adapter),
  todos verificados em tempo de compilação pelo `Record<Harness, …>` exaustivo.

## 3.6 Pipeline multi-harness (papéis) — gerar a skill na hora

Além de instalar itens, o setup pergunta **como os harnesses trabalham juntos**. Fluxo:

1. **Quais harnesses você usa?** (multiselect) — primeira pergunta.
2. **Usar em conjunto?** Se >1 harness → oferece montar um pipeline.
3. **Papel de cada um** (multiselect por harness): planejar / codar / revisar / documentar / uso geral.
   - Exemplo real: Gemini = planejar · Codex = codar · Claude = revisar.
4. A partir dos papéis, a CLI **gera na hora**:
   - uma **instrução/skill de papel** em cada harness (no formato dele — skill no Claude, rule no Cursor, seção AGENTS.md no Codex…),
   - um **protocolo de handoff** compartilhado (`HANDOFF.md` + convenção de branch/PR) descrevendo quem entrega o quê a quem.

**Escopo honesto do "orquestrar":** harnesses são CLIs separadas, sem runtime compartilhado. O setup gera o **papel + protocolo** (cada CLI sabe o que faz e como passar o bastão); handoff 100% automático (um chama o outro sozinho) exige um router tipo OmniRoute — fica pra fase futura (adapter OmniRoute).

## 4. Arquitetura — registry declarativo (coração do projeto)

Tudo que a CLI sabe instalar vem de um **catálogo declarativo**. Adicionar suporte a algo novo = adicionar uma entrada, não escrever código novo.

```ts
// src/registry/items.ts
type Item = {
  id: string;                       // "mcp:oraculo360"
  kind: "mcp" | "skill" | "agent" | "command" | "tool" | "config";
  name: string;
  description: string;
  targets: ("global" | "project")[];
  requires?: string[];              // deps de outros itens
  install: InstallSpec;             // como aplicar
  detect: DetectSpec;               // como saber se já está instalado
  remove?: RemoveSpec;              // como reverter
};
```

Exemplos de `install` por tipo:

```ts
// MCP → roda `claude mcp add`
{ kind: "mcp", cmd: "claude", args: ["mcp","add","oraculo360","--","npx","-y","..."] }

// Skill → copia diretório pro ~/.claude/skills/ ou .claude/skills/
{ kind: "skill", source: "assets/skills/graphify", dest: "skills/graphify" }

// Tool → instala dep externa
{ kind: "tool", cmd: "uv", args: ["tool","install","graphifyy"] }

// Config → merge em settings.json / append em CLAUDE.md (com marcadores)
{ kind: "config", file: "settings.json", merge: { hooks: {...} } }
```

## 5. Fluxo do `init` (passo a passo)

```
1. Detecta ambiente        → node? uv? git?  + quais HARNESSES existem
                             (~/.claude, ~/.cursor, codex, gemini, opencode...)
2. Pergunta HARNESSES       → em quais aplicar (multiselect; NADA pré-marcado — a CLI
                             escreve em config do usuário, então é opt-in explícito.
                             Os detectados aparecem com hint, sem virem selecionados)
3. Pergunta ALVO           → global ou projeto (por harness que suporta os dois)
4. Pergunta CATEGORIAS     → MCPs / Skills / Tools / Config  (multiselect)
5. Para cada categoria     → multiselect dos itens do catálogo
                             (marca os já instalados; oculta itens sem suporte no harness)
6. Resolve dependências    → item requer outro? adiciona automático + avisa
7. PREVIEW                 → por harness, o que vai rodar/escrever (dry-run)
8. Confirma                → aplica com spinner por item × harness
9. Backup + escreve        → configs com backup .bak antes
10. Relatório final        → instalado/falhou por harness + guias de MCP a ler
```

## 6. Regras de segurança (não-negociáveis)

- **Idempotente:** rodar 2x não duplica. `detect` sempre roda antes de `install`.
- **Backup antes de escrever:** `settings.json` → `settings.json.bak-<timestamp>` antes de qualquer merge.
- **Merge, nunca overwrite:** config nova entra por deep-merge; `CLAUDE.md` usa blocos com marcadores (`<!-- setup-definitivo:start -->` … `:end`) pra poder atualizar/remover sem tocar no resto.
- **`--dry-run` de verdade:** mostra tudo que faria sem escrever nada.
- **Reversível:** todo item com `remove` desfaz limpo.
- **Nunca commita segredo:** MCPs que precisam de key → pede a key em runtime ou aponta pra `.env`, nunca grava no repo.

## 7. Estrutura do repositório

```
setup-definitivo/
├─ package.json            # bin: { "setup-definitivo": "dist/cli.js" }
├─ tsconfig.json
├─ src/
│  ├─ cli.ts               # commander: init/add/remove/list/doctor/update
│  ├─ wizard.ts            # fluxo @clack/prompts do init
│  ├─ registry/
│  │  ├─ items.ts          # o catálogo declarativo
│  │  └─ schema.ts         # zod do Item
│  ├─ installers/
│  │  ├─ mcp.ts            # claude mcp add / remove
│  │  ├─ skill.ts          # copia/remove diretório de skill
│  │  ├─ tool.ts           # uv/npm/pipx install
│  │  └─ config.ts         # merge settings.json + blocos CLAUDE.md
│  ├─ core/
│  │  ├─ detect.ts         # o que já está instalado
│  │  ├─ backup.ts         # .bak antes de escrever
│  │  ├─ targets.ts        # resolve caminho global vs projeto
│  │  └─ env.ts            # checa claude/node/uv/git
│  └─ report.ts
├─ assets/
│  └─ skills/              # skills empacotadas (graphify, caveman, ...)
├─ test/
└─ README.md
```

## 8. Catálogo inicial (o teu stack de hoje)

### Squad: agents + commands (NÃO são skills)

> **Correção de premissa.** O plano original modelava a squad como `skill` (diretório com
> `SKILL.md`). Está errado: são **agents** (`~/.claude/agents/<nome>.md`, definição de
> subagente) e **commands** (`~/.claude/commands/<nome>.md`, slash command que invoca o
> subagente) — arquivos `.md` únicos, em diretórios diferentes. Com o modelo errado, nada
> da squad instalava. Cada membro gera **duas** entradas de catálogo, e o command declara
> `requires` do agent correspondente.

> **Regra:** o rename vale apenas para o que é distribuído no GitHub. O ambiente local do
> autor permanece com os nomes originais (ESCANOR, BULMA, ...). Ver §8.1.

| id agent | id command | label (UI) | Origem local (não muda) |
|---|---|---|---|
| `agent:backend` | `command:backend` | Backend (Bruno) | ESCANOR |
| `agent:frontend` | `command:frontend` | Frontend (Fiona) | BULMA |
| `agent:database` | `command:database` | Database (Diana) | IPPO |
| `agent:qa` | `command:qa` | QA (Quinn) | LEVI |
| `agent:security` | `command:security` | Security (Sam) | NEZUKO |
| `agent:devops` | `command:devops` | DevOps (Otto) | SAITAMA |
| `agent:mobile` | `command:mobile` | Mobile (Mia) | GON |
| `agent:scripting` | `command:scripting` | Scripting (Nina) | URARAKA |
| `agent:architect` | `command:architect` | Architect (Artur) | KURAMA |
| `agent:data` | `command:data` | Data/BI (Dado) | RYUK |
| `agent:pm` | `command:pm` | PM (Pam) | SHIKAMARU |
| `agent:lead` | `command:lead` | Lead (Leo) | LIGHT |

Harness sem esses conceitos (Cursor, Codex) recebe o conteúdo como **bloco de instrução**,
igual à degradação já usada para skills.

### Skills/repos externos de design & UI (empacotados via URL do GitHub)

Esses **não** são copiados pra dentro do repo — o catálogo aponta pro repo git deles e a CLI busca na instalação (pinado num ref; `update` repuxa). Assim eles seguem atualizando sem virar fork estagnado.

| id | kind | source (git) | Observação |
|---|---|---|---|
| `skill:impeccable` | skill (git) | repo do impeccable | design/UX frontend |
| `skill:design-taste` | skill (git) | repo taste-skills | design-taste-frontend |
| `skill:motion` | skill (git) | repo motion | animação/motion |
| `mcp:21st` | mcp | `@21st-dev/magic` | Magic MCP — geração de componentes UI. Guia + API key (ver §8.2) |

Spec de item com fonte git:

```ts
{ kind: "skill", source: { type: "git", repo: "https://github.com/<owner>/<repo>",
  ref: "v1.4.0", subdir: "skills/impeccable" } }
// install = git clone --depth 1 --branch <ref> + copia subdir; update = re-fetch do ref
```

### 8.2 Guias de conexão de MCP (dentro do repo)

MCPs que exigem credencial/login ganham um doc de conexão em `docs/mcp/<id>.md`, e a CLI, após registrar, **imprime o resumo e aponta o guia**. A CLI nunca pede/grava a key no repo — só orienta.

| MCP | Guia | O que o guia cobre |
|---|---|---|
| `mcp:21st` | `docs/mcp/21st.md` | criar conta 21st.dev, gerar API key, onde colar (env), teste |
| `mcp:clickup` | `docs/mcp/clickup.md` | token da API, workspace id, teste |

(Outros MCPs com login, como notebooklm, também ganham guia curto.)

**Repositório:** `git@github.com:Mystic0112/Setup-Definitivo.git` (público)

### Ferramentas & infra

| id | kind | Observação |
|---|---|---|
| `mcp:clickup` | mcp | token |
| `mcp:notebooklm` | mcp | login interativo (`notebooklm login`) |
| `mcp:desktop-commander` | mcp | |
| `skill:graphify` | skill | + `requires: tool:graphify` |
| `skill:caveman` | skill | |
| `skill:ponytail` | skill | |
| `tool:graphify` | tool | `uv tool install graphifyy` |
| `config:base-claude-md` | config | CLAUDE.md com regras padrão |
| `config:hooks-basicos` | config | hooks de settings.json |

### 8.1 Empacotamento & rename (fonte × distribuído)

Separação dura entre **o que o autor usa** e **o que vai no repo**:

```
~/.claude/agents/escanor.md      (LOCAL do autor — nome original, NUNCA muda)
~/.claude/commands/escanor.md
        │
        ▼  reescrita de conteúdo (ver abaixo), guiada por rename-map.json
        ▼
repo/assets/agents/backend.md    (DISTRIBUÍDO)
repo/assets/commands/backend.md
        │
        ▼  usuário roda `npx github:Mystic0112/Setup-Definitivo init`
        ▼
usuário/.claude/agents/backend.md   (instalado no ambiente de QUEM CLONOU)
```

- `rename-map.json` guarda o de-para (`escanor→backend`, etc.). Único ponto de verdade.
- O ambiente local do autor não é tocado em momento nenhum.

> **Rename mecânico NÃO funciona aqui.** Medido: 227 ocorrências dos nomes em 24 arquivos.
> Duas razões:
> 1. **Prosa de persona.** Ex.: *"Meu Quirk é Zero Gravity… Float!"* — trocar `uraraka` por
>    `scripting` deixa a referência órfã e o texto sem sentido.
> 2. **Referências cruzadas.** O coordenador (`light`→`lead`) sozinho tem 71 linhas citando
>    outros membros, incluindo a tabela de roteamento. Trocar só o nome do arquivo faz a
>    squad apontar para agentes que não existem.
>
> Por isso a reescrita é feita por agentes de IA (um lote por grupo de membros), preservando
> tom e conteúdo técnico e removendo a temática, com revisão antes de entrar no repo.
> Também exige ajuste de **concordância de gênero** (`nezuko`→`security` vira masculino).

- `npm run pack:squad` é um **verificador**, não um renomeador: confere completude dos 24
  arquivos, ausência de termos da persona antiga e referências cruzadas órfãs.

## 9. Roadmap por fases

**Fase 0 — Scaffold (1 dia)**
Repo público, package.json com `bin`, commander com `init` esqueleto, CI (lint+test), README.

**Fase 1 — MVP, só Claude (2-4 dias)**
Wizard `init` p/ 1 harness (Claude) e 2 tipos: `skill` (copiar, com rename da squad) + `mcp` (claude mcp add). Alvo global/projeto. Backup + dry-run. Catálogo com 4-5 itens reais.

**Fase 2 — Config + Tools + git-source (2-3 dias)**
Installer de `config` (merge settings.json + blocos CLAUDE.md), `tool` (uv/npm) e `skill` via git URL (impeccable/motion/design-taste). `doctor` + `list`. Guias de MCP em `docs/mcp/`.

**Fase 3 — Multi-harness (3-5 dias)**
Camada de adapters. Adicionar Cursor e Codex além do Claude. Detecção automática de harness. Preview e apply por harness. Matriz de capacidade com degradação elegante.

**Fase 4 — Robustez** ✅ concluída
`remove` (manifesto de estado + remoção conservadora) e `update` (reaplicação idempotente),
testes vitest. Publicação no npm **saiu do escopo**: a distribuição é via
`npx github:Mystic0112/Setup-Definitivo`, com `prepare` compilando o `dist/` na instalação.

**Fase 4.5 — Modelo agent/command + SETUP.md** ✅ concluída
Squad remodelada como agents + commands; `SETUP.md` para apontar a própria IA ao repositório.

**Fase 5 — Mais harnesses + extras (backlog)**
Adapters de Gemini CLI, opencode, OmniRoute. Perfis prontos ("full", "só design", "só monitoramento"), export/import de config, `--profile`.

## 10. Pendências conhecidas

**Bloqueiam divulgar o repositório:**

- **URLs `OWNER/` no catálogo.** `skill:impeccable`, `skill:design-taste` e `skill:motion`
  apontam para placeholders. Hoje são pulados com aviso; precisam do repo/ref reais.
- **Nomes de pacote dos MCPs não conferidos.** `@21st-dev/magic`, `@clickup/mcp-server`,
  `notebooklm-mcp`, `@wonderwhy-er/desktop-commander` e `graphifyy` foram inferidos, não
  verificados no registro. Nome inexistente = qualquer um pode registrá-lo e ganhar execução
  na máquina de quem instalar (dependency confusion). **Conferir antes de divulgar.**

**Dívida técnica registrada (não bloqueia):**

- Escrita não atômica (`writeFile` trunca; falta tmp + `rename`).
- `.bak-*` acumulam sem poda; em alvo projeto caem na raiz do repo do usuário, que
  provavelmente não os ignora no `.gitignore`.
- Preview do wizard é global, não por harness: mostra permissões do Claude mesmo com só
  Cursor selecionado.
- `item.targets` é campo declarado sem nenhum leitor em `src/` — parece garantia e não é.
- Clone git usa branch mutável (`ref: "main"`), sem pin de SHA, e o conteúdo vai para um
  diretório carregado automaticamente pelo agente.
- `settingsFile()` devolve caminho para os 6 harnesses, mas só o Claude tem esse conceito —
  armadilha para o próximo adapter.
- Skills de fonte git ainda não convertem para instrução em harness degradado.
