---
name: rule
description: Registra uma regra de bloqueio que o hook rule-guard passa a IMPÔR em toda escrita de arquivo (Write/Edit/MultiEdit). Use quando o usuário digitar /rule ou pedir "proibir X", "nunca deixar escrever Y", "bloquear Z no arquivo". Cada regra vira uma linha em ~/.claude/rules.jsonl e o hook PreToolUse nega a escrita que violar.
---

# /rule — correção vira regra que BLOQUEIA

Traduz um pedido em linguagem natural numa regra JSONL e faz **append** em
`~/.claude/rules.jsonl`. O hook `~/.claude/hooks/rule-guard.py` (PreToolUse) lê
esse arquivo e NEGA qualquer Write/Edit/MultiEdit que viole uma regra `block`.

## Como montar a linha

Uma regra por linha, JSON compacto, com estes campos:

```json
{"id": "kebab-curto", "glob": "**/*.php", "forbid": "regex_proibido", "message": "motivo mostrado no deny", "severity": "block"}
```

- `id` — identificador curto em kebab-case, único.
- `glob` — a quais paths a regra se aplica. `**` ou vazio = todos. Ex.: `**/*.php`, `**/*.vue`, `src/**/*.ts`.
- `forbid` — **regex** que, se casar no conteúdo novo sendo escrito, dispara. Escape para JSON: `var_dump\\(`, `console\\.log\\(`, `dd\\(`.
- `message` — por que é proibido e o que fazer em vez disso.
- `severity` — `block` (nega a escrita) ou `warn` (deixa passar, injeta aviso).

## Passos

1. Extraia do pedido: o padrão proibido, o glob-alvo e o motivo.
   Ex.: `/rule "proibir dd( em **/*.php: sobra de debug"` →
   `forbid="dd\\("`, `glob="**/*.php"`, `message="dd() é sobra de debug; remova antes de escrever."`.
2. Monte a linha JSON válida (regex escapado para JSON). Default `severity: "block"`
   salvo se o pedido disser "só avisa"/"warn".
3. Faça **append** dela em `~/.claude/rules.jsonl` (nunca reescreva o arquivo; só acrescente a linha).
4. Confirme ao usuário: id, glob, forbid e severity registrados.

Não precisa de código próprio: monte o JSON e acrescente a linha. O hook faz o resto.
