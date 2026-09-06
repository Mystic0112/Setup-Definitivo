# Guia de conexão — NotebookLM

O `mcp:notebooklm` dá acesso ao Google NotebookLM: criar notebooks, adicionar fontes e
gerar áudio, vídeo, slides, quiz e mapas mentais. Precisa de login na conta Google.

## 1. Registrar o MCP

Feito pela `setup-definitivo init`. Manualmente, no Claude:

```bash
claude mcp add notebooklm -- npx -y notebooklm-mcp@latest
```

## 2. Login (é interativo, não é uma API key)

O NotebookLM não usa token: você entra na conta Google uma vez e a sessão fica salva.

```bash
npx notebooklm-mcp login    # abre o navegador para você entrar
npx notebooklm-mcp list     # confirma que autenticou
```

- O login abre um navegador; funciona em qualquer ambiente com display.
- A sessão salva (`storage_state.json`) é uma **credencial de portador**: quem tiver o
  arquivo age como sua conta Google. Mantenha-o privado (`0600`), nunca versione nem
  compartilhe.
- Se os comandos falharem com erro de autenticação, rode `login` de novo.

## 3. Testar

Peça ao harness: *"liste meus notebooks do NotebookLM"*. Se retornar a lista, está conectado.

## Problemas comuns

- **Erro de autenticação**: sessão expirada — rode `npx notebooklm-mcp login` de novo.
- **command not found**: falta Node/npx no PATH.
- **Ambiente sem navegador (headless/CI)**: gere o `storage_state.json` numa máquina com
  display e reutilize-o via a variável de ambiente que o pacote documenta — nunca comite o
  arquivo.

> A `setup-definitivo` nunca pede, lê ou grava essa credencial — o login é sempre feito por
> você, direto no CLI do NotebookLM.
