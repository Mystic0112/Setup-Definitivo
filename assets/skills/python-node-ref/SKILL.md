---
name: python-node-ref
description: Referência de backend Python e Node fora do núcleo — FastAPI (async, Pydantic v2, DI), Express/Fastify, padrões async, CLIs (Typer/Click, Commander) e packaging (uv, pnpm). Carregue ao construir API/serviço/CLI em Python ou Node — puxe só quando a tarefa exigir esses detalhes.
user-invocable: false
---

# Python & Node — Backend

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### Python 3.12/3.13

- **PEP 695 — type aliases**: `type Vector = list[float]` substitui `TypeAlias`
- **`asyncio.TaskGroup`**: substitui `gather()` com tratamento de erro superior — falha de uma task cancela o grupo
- **GIL opcional (PEP 703)**: `python3.13t` sem GIL para paralelismo real em CPU-bound
- **`uv`**: substitui pip + virtualenv + pip-tools. `uv sync`, `uv run`, `uv add` — fluxo Cargo-like
- **`ruff`**: lint + format em um binário Rust. Substitui flake8 + black + isort. 10-100× mais rápido
- **`ty`** (Astral): type checker emergindo como alternativa ao mypy, integrado ao ecossistema uv/ruff

### FastAPI 0.115+

- **`lifespan`**: substitui `@app.on_event`. Use `asynccontextmanager` para startup/shutdown limpos
- **`Annotated` + `Depends`**: DI declarativa — `CurrentUser = Annotated[User, Depends(get_current_user)]`
- **Testes assíncronos**: `httpx.AsyncClient` com `ASGITransport` — sem servidor real, sem mock frágil
- **`dependency_overrides`**: troca dependências em teste sem alterar código de produção
- **Pydantic v2**: validação 5-10× mais rápida; `model_config = ConfigDict(strict=True)`

### Node.js 22/23

- **ESM nativo**: `"type": "module"` + `moduleResolution: NodeNext` — sem Babel, sem transpile step
- **`fetch` e `WebSocket` nativos**: sem precisar de `node-fetch` ou `ws`
- **`node:test` runner**: test runner embutido, sem Jest para projetos simples
- **`--experimental-strip-types`**: executa `.ts` diretamente no Node 22+ sem compilar
- **Top-level `await`**: em módulos ESM sem wrapper `async` desnecessário

### Bun 1.x

- **All-in-one**: runtime + package manager + bundler + test runner em um binário
- **`bun install`**: 35× mais rápido que npm; lockfile legível em texto
- **`bun:test`**: API compatível com Jest, sem configuração
- **`Bun.SQL` / `Bun.redis`**: clientes nativos Postgres e Redis sem dependência externa
- **Compatibilidade**: passa >90% da suite de testes do Node.js; drop-in para scripts e CLIs
- **Startup**: ideal para CLIs e lambdas — cold start desprezível vs Node

### TypeScript Moderno

- **`satisfies` operator**: valida tipo sem perder o tipo inferido — `const cfg = { port: 3000 } satisfies Config`
- **Template literal types**: `type Route = `/api/${string}`` para contratos de URL em compile time
- **`noUncheckedIndexedAccess`**: acesso a array retorna `T | undefined` — elimina crashes silenciosos
- **Utility types avançados**: `Awaited<T>`, `ReturnType<T>`, `Parameters<T>` para reuso sem duplicação
- **`zod` + inferência**: `z.infer<typeof schema>` — schema e tipo de uma fonte só

