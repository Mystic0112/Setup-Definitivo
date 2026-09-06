# SETUP.md — instruções para o agente de IA

> Este arquivo é lido por uma IA (Claude Code, Codex, Cursor, Gemini CLI, opencode…)
> para configurar o ambiente de quem clonou este repositório.
>
> **Humano:** aponte seu agente para cá — *"leia o SETUP.md e configure meu ambiente"* —
> ou use a CLI determinística: `npx github:Mystic0112/Setup-Definitivo init`.

---

## O que este repositório é

Um catálogo de MCPs, agentes, comandos, skills e configurações, mais duas formas de aplicá-lo:

| Forma | Quando usar |
|---|---|
| **CLI** (`npx … init`) | quer execução determinística, com `--dry-run`, backup automático e `remove` |
| **Você, agente, lendo este arquivo** | quer adaptação ao ambiente real, inclusive em harness sem adapter na CLI |

As duas convivem. Se a CLI cobre o caso, prefira chamá-la — ela já tem as proteções testadas.

---

## Fonte da verdade

**Não confie neste arquivo para saber o que existe.** Leia o catálogo:

```
src/registry/items.ts     ← todos os itens: id, kind, descrição, o que precisa de credencial
```

Cada item tem um `kind` que define como se instala:

| kind | O que é | Onde vai |
|---|---|---|
| `mcp` | servidor MCP | depende do harness (ver abaixo) |
| `skill` | skill/capacidade | `<harness>/skills/<nome>/` |
| `agent` | definição de subagente | `<harness>/agents/<nome>.md` |
| `command` | slash command | `<harness>/commands/<nome>.md` |
| `tool` | dependência externa | global na máquina |
| `config` | settings / instruções | arquivo de config do harness |

Itens com `needsSecret: true` têm um guia em `docs/mcp/<nome>.md`. **Leia o guia e mostre ao usuário — nunca peça nem manipule a credencial você mesmo.**

---

## Onde cada harness guarda as coisas

| Harness | MCP | Instruções | Skills nativas |
|---|---|---|---|
| Claude | `claude mcp add <nome> -- <cmd>` | `CLAUDE.md` | sim |
| Cursor | `~/.cursor/mcp.json` → `{"mcpServers":{…}}` | `.cursorrules` (projeto) · `~/.cursor/rules/` (global) | não |
| Codex | `~/.codex/config.toml` → `[mcp_servers.<nome>]` | `~/.codex/AGENTS.md` (global) · `AGENTS.md` (projeto) | não |
| Outros | consulte a doc do harness | idem | provavelmente não |

**Harness sem skills nativas:** converta a skill em um bloco de instrução no arquivo de instruções, delimitado por marcadores (ver "Blocos gerenciados").

---

## Procedimento

1. **Detecte o ambiente.** Quais harnesses existem? (`~/.claude`, `~/.cursor`, `~/.codex`, binários no PATH). Quais já têm itens deste catálogo instalados?
2. **Mostre ao usuário o que encontrou** e pergunte o que ele quer: quais harnesses, alvo global ou projeto, quais itens.
3. **Apresente um plano** — a lista exata de comandos que vai rodar e arquivos que vai tocar. Para itens que concedem permissão, **mostre as strings literais**, não só o rótulo.
4. **Espere confirmação explícita.**
5. **Aplique**, seguindo as regras de segurança abaixo.
6. **Verifique**: o harness sobe? o MCP responde? Reporte o que funcionou e o que falhou.
7. **Aponte os guias** dos itens que precisam de credencial.

---

## Regras de segurança — não negociáveis

Estas regras vieram de defeitos reais encontrados em revisão. Cada uma evitou perda de dado.

### Nunca destrua o que o usuário escreveu

- **Faça backup antes de escrever** em qualquer arquivo existente (`arquivo.bak-<timestamp>`), e diga ao usuário onde ficou.
- **Merge, nunca substitua.** Ao registrar um MCP que já existe, preserve as chaves que já estavam lá — em especial `env`, que é onde ficam tokens. Substituir a entrada inteira apaga a credencial do usuário.
- **Se não tem certeza, não apague.** Reporte e deixe para o usuário decidir. Resto para limpar à mão é melhor que dado perdido.

### `~/.codex/config.toml` merece cuidado extra

Esse arquivo costuma conter **chaves de API em texto puro** (`[mcp_servers.<x>.http_headers]`).

- **Nunca reescreva o arquivo inteiro** (parse → serialize destrói comentários e formatação). **Anexe** a seção nova no fim.
- **Antes de anexar, verifique se a seção já existe** — e cuidado: TOML aceita várias grafias equivalentes (`[mcp_servers.x]`, `[mcp_servers."x"]`, `[mcp_servers]` + `x = {…}`, `mcp_servers.x.command = …`). Duplicar a tabela **quebra o arquivo inteiro** e o Codex para de subir.
- **Depois de escrever, valide que o TOML ainda parseia.** Se quebrou, restaure do backup e avise.
- **Nunca imprima o conteúdo desse arquivo** em log, resposta ou mensagem.

### Permissões e credenciais

- No alvo "projeto", escreva permissões em `settings.local.json`, não no `settings.json` versionado — senão você concede privilégio para todo mundo que clonar o repo.
- **Nunca peça, digite ou grave credencial.** Mostre o guia e deixe o usuário colocar a key no ambiente dele.
- Cuidado com regras de permissão amplas: `Bash(git diff:*)` **não é read-only** — `git diff --output=<arquivo>` sobrescreve arquivo arbitrário. Prefira formas fechadas.

### Blocos gerenciados

Ao inserir conteúdo em arquivo de instrução, delimite:

```
<!-- setup-definitivo:start:<id> -->
…conteúdo…
<!-- setup-definitivo:end:<id> -->
```

- Reaplicar o mesmo id **substitui** o bloco; não duplica.
- Se o conteúdo que você vai inserir contiver esses marcadores, **neutralize-os** antes — senão ele escapa do bloco e vira texto que ninguém consegue mais atualizar ou remover.
- Se encontrar marcadores órfãos ou duplicados, **pare e avise** em vez de tentar consertar apagando.

### Conteúdo de terceiros

Itens vindos de repositório git externo são **instruções que o agente vai obedecer**. Antes de instalar:
- prefira um commit fixo a um branch mutável;
- **leia o conteúdo** antes de colocá-lo num diretório carregado automaticamente;
- desconfie de symlink apontando para fora do repositório.

---

## Se preferir delegar à CLI

Ela já implementa tudo acima, testado:

```bash
npx github:Mystic0112/Setup-Definitivo init --dry-run   # mostra o plano, não escreve
npx github:Mystic0112/Setup-Definitivo init             # aplica
npx github:Mystic0112/Setup-Definitivo doctor           # diagnóstico
npx github:Mystic0112/Setup-Definitivo remove <id>      # remove, recusando o que foi alterado
```

Onde a CLI não tiver adapter para o harness do usuário, faça você mesmo seguindo as regras acima.

---

## Limites — seja honesto com o usuário

- Se não souber onde um harness guarda config, **pergunte** em vez de chutar um caminho.
- Se um item não se aplica ao harness escolhido, **diga que pulou e por quê** — não silencie.
- Se algo falhar, reporte o erro real. Não declare sucesso parcial como sucesso.
