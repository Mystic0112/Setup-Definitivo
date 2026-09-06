---
name: codex-code
description: Delega a implementação pro Codex (OpenAI) rodando como agente da gorila-squad, e depois revisa o resultado com os agentes da squad no Claude. Use quando o usuário pedir pro Codex codar/implementar/consertar algo, ou disser "manda o codex fazer", "codex implementa", "delega pro codex", "codex escreve e você revisa". Não use para revisão pura de código já existente (use /codex:review) nem quando o usuário pedir explicitamente que VOCÊ implemente.
---

# Codex coda como gorila-squad, Claude revisa como gorila-squad

Codex escreve, você revisa. Você **não** implementa — achado vira prompt de
correção pro Codex, não edição sua. Duas exceções: usuário mandar você arrumar, e
**cota do Codex estourada** (ver "Quando a cota estoura", abaixo).

## 1. Escolhe agente e modelo

**Agente** (`~/.codex/agents/<nome>.toml`) — pelo domínio da tarefa:

| Domínio | Agente |
|---|---|
| PHP / Laravel / API backend | `escanor` |
| Python / Node / FastAPI / Express / CLI / script | `uraraka` |
| Frontend / React / Vue / CSS / a11y | `bulma` |
| SQL / schema / migration / query / índice | `ippo` |
| Mobile / React Native / Flutter | `gon` |
| Docker / CI-CD / deploy / infra | `saitama` |
| Testes / QA / code quality | `levi` |
| Segurança / auth / OWASP | `nezuko` |
| Arquitetura / DDD / decisão de design | `kurama` |
| ETL / BI / SQL analítico / dashboard | `ryuk` |
| Toca 3+ domínios | `light` |

**Modelo** — nunca deixe implícito, sempre passe `-m`:

- `gpt-5.6-terra` — tarefa **simples**: CRUD, script isolado, ajuste localizado,
  boilerplate, correção de bug óbvio, arquivo único.
- `gpt-5.6-sol` — tarefa **complexa**: multi-arquivo, refactor, decisão de
  arquitetura, concorrência, performance, segurança, bug de causa não óbvia.

Esforço **padrão médio**: `-c model_reasoning_effort=medium`.

`high` só com motivo declarado, porque ele custa caro de verdade: uma rodada de
redesenho em `sol` + `high` queimou 192.800 tokens e estourou a cota da conta no meio
da tarefa, deixando o repositório pela metade. O médio resolve a esmagadora maioria.

Suba para `high` apenas quando: máquina de estados com transições que se invertem
(disjuntor, retry, reconciliação), concorrência entre processos, ou correção de
achado que já voltou errado uma vez. Nesses casos diga no relatório por que subiu.

Na dúvida entre terra e sol → sol. Errar pra cima custa tokens, errar pra baixo
custa uma segunda rodada e uma revisão inteira.

## 2. Marca o ponto de partida

Repo git: guarde `git rev-parse HEAD` e `git status --porcelain`.
Sem git: `ls -la` dos arquivos relevantes. É o que localiza o que mudou.

## 3. Roda o Codex com a persona do agente

### Sessão nova ou continuação? (decida ANTES de rodar)

Continuidade dá as duas coisas que o usuário quer: o Codex lembra o que fez (mais
performance, menos re-explicação) e reaproveita cache (menos token). Cada sessão
nova recarrega o piso fixo (~94k: system prompt + tools + skills) **mais** a persona
(~5,7k) — pagar isso de novo só se justifica em tarefa realmente nova.

**`codex exec resume --last`** (mesma sessão) quando:
- a tarefa é continuação da última delegação (mesmo arquivo/subsistema/assunto), ou
- o usuário disse "agora", "continua", "ajusta", "também", "e o X", ou
- é correção de um achado da revisão.

Ao resumir: **não** reinjete a persona (a sessão já a tem) — passe só a nova
instrução. Mesmo `-m` e effort da sessão. Sandbox via `-c sandbox_mode="workspace-write"`,
dir herdado (resume não aceita `--sandbox`/`-C`).

**`codex exec` fresco** (sessão nova) quando:
- tarefa nova sem relação com a anterior, ou troca de projeto/diretório, ou
- **a sessão já ficou longa** (muitas rodadas). Resumir não é grátis: o histórico
  cresce e, passado um ponto, reenviar uma sessão gigante custa mais que recomeçar.
  Fio de trabalho coerente → resume; troca de assunto ou sessão inchada → fresco.

O bloco abaixo (persona + tarefa via stdin) é o caminho da **sessão nova**. Pro
resume, pule a persona e rode `codex exec resume --last -c sandbox_mode="workspace-write" -m <mesmo> -o /tmp/codex-last.md "<nova instrução>"`.

### Sessão nova (persona + tarefa)

Monte o prompt em arquivo (persona + tarefa) e passe por stdin — o
`developer_instructions` tem alguns milhares de chars, não cabe bem em argv:

```bash
AG=uraraka   # agente escolhido no passo 1
python3 - "$AG" > /tmp/codex-prompt.txt <<'EOF'
import os, sys, tomllib, pathlib
ag = sys.argv[1]
d = tomllib.load(open(os.path.expanduser(f"~/.codex/agents/{ag}.toml"), "rb"))
print(d["developer_instructions"])
print("\n---\n")
print(pathlib.Path("/tmp/codex-task.txt").read_text())
EOF

codex exec --sandbox workspace-write \
  --skip-git-repo-check -C "<dir>" \
  -m gpt-5.6-sol -c model_reasoning_effort=medium \
  -o /tmp/codex-last.md - < /tmp/codex-prompt.txt
```

**Frontend/mobile (agente `bulma` ou `gon`): acrescente `-p frontend`.** Os plugins
de UI (visualize, sites, presentations, template-creator) vivem desligados no base
pra não gastar token nas tarefas de código; o profile `frontend`
(`~/.codex/frontend.config.toml`) religa eles só nessas calls. Qualquer outro agente
roda sem `-p` (base enxuto). Não use `-p frontend` fora de bulma/gon — é gasto à toa.

Escreva a tarefa em `/tmp/codex-task.txt` antes: o que fazer, quais arquivos, e o
**critério de pronto** verificável. Não resolva a tarefa — só especifique.

Regras:
- **Nunca canalize a saída do `codex` para `tail`/`head`/`grep`.** O código de saída
  que volta é o do último comando do cano, não o do Codex. Isso já fez uma rodada de
  correção falhar por erro de sintaxe e ser reportada como sucesso — o Codex nunca
  executou e o diff continuou idêntico. Rode limpo e leia o arquivo do `-o` depois.
- **`codex exec resume` tem flags DIFERENTES do `codex exec`**: não aceita
  `--sandbox` nem `-C`. Sandbox vai por `-c sandbox_mode="workspace-write"`, e o
  diretório é herdado da sessão. Aceita `-m`, `-c`, `-o`, `--last`,
  `--skip-git-repo-check`.
- **Binário**: `codex` do PATH (nvm, 0.150.1). Se aparecer
  `requires a newer version of Codex`, o PATH caiu no `/usr/local/bin/codex`
  antigo (0.139, root, shadowed) — confirme com `codex --version` e use
  `~/.nvm/versions/node/v20.20.2/bin/codex` direto nesse caso.
- `timeout: 600000`. Tarefa grande → `run_in_background: true`.
- Sandbox `workspace-write`. **Nunca** `--dangerously-bypass-approvals-and-sandbox`.
- Falha de login → `codex login`, o usuário roda, não você.
- Não existe flag `--agent` no `codex exec`. A injeção do `.toml` acima é o
  mecanismo — não invente flag.

## 3.1 Quando a cota estoura: assuma na hora

`ERROR: You've hit your usage limit` no meio da tarefa. **Não espere, não pergunte:
termine você.** A janela de reset é de horas, não de minutos — confira o relógio
LOCAL antes de estimar (`date`), porque o horário que aparece no banco/servidor pode
estar em UTC e dar 3h de erro na sua conta.

Sequência:

1. **Meça o estado antes de tocar.** `git status --porcelain` e a verificação do
   projeto (testes/build/lint). O Codex é cortado no meio de uma escrita, então o
   repositório pode estar incoerente — e "quase coerente" é o caso comum: costuma
   faltar um chamador que ele não atualizou depois de mudar uma assinatura.
2. **Feche só o buraco.** Não redesenhe, não "melhore enquanto está aqui": o desenho
   é o que estava no briefing e o diff dele já é grande. Diff seu misturado ao dele
   destrói a revisão dos dois.
3. **A revisão continua obrigatória, e com mais razão.** Spawne a squad normalmente.
   Você acabou de escrever parte do código — não pode ser o único revisor dele, que
   é justamente o motivo desta skill existir.
4. **No relatório, diga o que é seu.** Uma linha: `Assumido por cota: <o que você
   escreveu>`. Sem isso, o usuário lê tudo como saída do Codex e confia na revisão
   errada.

Se o buraco não for mecânico — falta decisão de desenho, ou o que existe está errado
— aí PERGUNTE em vez de escolher sozinho. "Terminar" vale para o que já foi
especificado, não para o que ficou em aberto.

## 4. Revisão pelos agentes da squad

Você não revisa sozinho. Spawne, **em uma única mensagem**, com
`run_in_background: true`:

- `levi` — sempre. Correção, casos de borda, SOLID/Clean Code, cobertura.
- o **especialista do domínio** (mesmo do passo 1, versão Claude) — sempre.
  Idiomático pra stack, reinvenção de helper que já existe no repo.
- `nezuko` — se o diff toca auth, input externo, query, upload, secret, permissão.
- `ippo` — se toca schema, migration ou query.
- `kurama` — se o diff mudou fronteira de módulo ou contrato público.

Passe pra cada um: o diff (ou os arquivos tocados), o critério de pronto do passo
1, e a ordem explícita de **não editar nada** — só reportar achados.

```bash
git --no-pager diff HEAD
```

Sem git: leia os arquivos que o Codex reportou ter tocado.

Enquanto eles rodam, você roda a verificação do projeto (testes, build, lint). Se
não existir e a lógica não é trivial, escreva **um** check runnable mínimo — isso
é revisão, não implementação.

## 5. Reporta

```
Agente/modelo: <ag> em <terra|sol>, effort <medium|high — se high, por quê>
Codex fez: <1-2 linhas>
Assumido por cota: <o que VOCÊ escreveu — omita a linha se não houve>
Revisão (<agentes>): <achados, mais grave primeiro — ou "sem achados">
Verificação: <comando + resultado, ou "não há">
```

Achado só conta como corrigido depois de você **desfazer o conserto e ver o teste
morrer**. Teste que passa nas duas versões não guarda nada — e já aconteceu de 31
testes ficarem verdes com o argumento do `dispatch` trocado. Ao sabotar, o script
tem de AFIRMAR que a sabotagem foi aplicada (`assert padrão in arquivo`): `sed` que
não casa devolve suíte verde e você mede um arquivo intacto.

Achado que precisa de código → volta ao passo 3 com prompt de correção:
`codex exec resume --last "<correção>"` (mesmo binário, mesmo `-m`, mesmo effort).

Rodada em andamento NÃO se mata para trocar de esforço: o gasto dela já aconteceu, e
abortar joga fora o gasto E o trabalho. Troca vale da próxima em diante.

Nunca aprove sem ter lido o diff. "Parece ok" não é revisão.
