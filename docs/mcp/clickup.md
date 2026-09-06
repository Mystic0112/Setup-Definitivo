# Guia de conexão — ClickUp MCP

O `mcp:clickup` dá acesso a tarefas, docs e workspace do ClickUp. Precisa de um token da API e do ID do workspace.

## 1. Gerar o token

1. Em https://app.clickup.com, vá em **Settings → Apps**.
2. Em **API Token**, gere um **Personal Token** (`pk_...`).
3. Copie o token.

## 2. Descobrir o workspace ID

Está na URL do ClickUp: `https://app.clickup.com/<WORKSPACE_ID>/...` — o número após o domínio.

## 3. Onde colocar

A CLI **não grava o token**. Exporte no ambiente:

```bash
export CLICKUP_API_TOKEN="pk_xxx"
export CLICKUP_WORKSPACE_ID="90171199960"
```

(ou use o `.env` do projeto, nunca commitado).

## 4. Registrar o MCP

Feito pela `setup-definitivo init`. Exemplo genérico:

```bash
claude mcp add clickup -- npx -y @clickup/mcp-server@latest
```

> Confirme pacote/flags na doc oficial antes de publicar.

## 5. Testar

Peça ao harness "liste minhas listas do ClickUp". Se retornar dados, está conectado.

## Problemas comuns

- **Unauthorized**: token errado ou não exportado no shell atual.
- **Workspace não encontrado**: confira o `CLICKUP_WORKSPACE_ID`.
