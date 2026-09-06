---
name: db-engines-ref
description: Referência de engines de banco — Postgres/MySQL/SQLite/Redis (features específicas, tuning, índices avançados, replicação). Carregue ao otimizar ou usar recurso específico de engine; modelagem e queries de núcleo o agente já tem.
user-invocable: false
---

# Bancos de Dados — Engines

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### PostgreSQL 16/17 — Features Novas

**PostgreSQL 16 (set/2023):**
- Paralelismo expandido: `FULL JOIN`, `RIGHT JOIN` e `SELECT DISTINCT` agora podem ser paralelizados
- `COPY` em modo concorrente com até 300% de ganho em bulk loads
- `SQL/JSON` constructors nativos: `JSON_OBJECT()`, `JSON_ARRAY()`, `JSON_EXISTS()`
- Logical replication: roles de replicação sem superusuário, replicação de DDL parcial

**PostgreSQL 17 (set/2024):**
- `MERGE ... RETURNING` — retorna linhas afetadas do MERGE (INSERT/UPDATE/DELETE) em uma única query
- `pg_stat_io` — view que detalha I/O por tipo de backend (vacuum, checkpoint, cliente); use para identificar a origem real do I/O wait
- Logical replication com failover: slots sincronizados com standby, `pg_createsubscriber` converte standby físico em réplica lógica
- `identity columns` melhoradas: `ALTER TABLE ... ADD COLUMN` com identity/serial herda persistência da tabela

```sql
-- MERGE com RETURNING (PG17)
MERGE INTO estoque USING pedidos ON estoque.produto_id = pedidos.produto_id
WHEN MATCHED THEN UPDATE SET quantidade = estoque.quantidade - pedidos.qtd
WHEN NOT MATCHED THEN INSERT (produto_id, quantidade) VALUES (pedidos.produto_id, 0)
RETURNING estoque.produto_id, estoque.quantidade;

-- pg_stat_io — checar I/O de vacuum
SELECT backend_type, object, context, reads, writes, extends
FROM pg_stat_io WHERE backend_type = 'autovacuum worker';
```

### Redis 7/8 — Redis Stack e Casos de Uso Modernos

**Redis 8 (2025):** módulos integrados ao core — RedisSearch, RedisJSON, RedisTimeSeries, RedisBloom são nativos, sem instalação separada de módulos.

- **RedisJSON**: `JSON.MERGE` e `JSON.MSET` (2.6+); manipulação de documentos sem reescrita total
- **RediSearch**: `GEOSHAPE` com polígonos WKT, `FT.SEARCH FORMAT JSON` (RESP3), performance melhorada em `SORT BY`
- **RESP3**: tipos nativos (Map, Set, Double), push notifications para client-side cache
- **Padrão moderno**: Redis como banco vetorial com `FT.CREATE ... VECTOR FLAT/HNSW`

```bash
# Índice vetorial no Redis (RedisSearch)
FT.CREATE idx:embeddings ON HASH PREFIX 1 emb: SCHEMA vec VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE
FT.SEARCH idx:embeddings "*=>[KNN 10 @vec $query_vec AS score]" PARAMS 2 query_vec <blob> SORTBY score
```

### Eloquent Patterns para Grandes Volumes (Laravel 11/12)

```php
// upsert — insert ou update em batch atômico
User::upsert(
    [['email' => 'a@x.com', 'name' => 'A'], ['email' => 'b@x.com', 'name' => 'B']],
    uniqueBy: ['email'],
    update: ['name', 'updated_at']
);

// chunk — processa em lotes, suporta eager loading, seguro para dados estáticos
User::with('orders')->chunk(1000, fn($users) => processUsers($users));

// lazy — LazyCollection, melhor sintaxe que chunk, NÃO suporta eager loading
User::lazy(500)->each(fn($user) => exportUser($user));

// cursor — single model em memória, thread-safe, NÃO suporta eager loading
foreach (User::cursor() as $user) { ... }

// chunkById — seguro para dados que mudam durante o processo (usa PK como cursor)
User::chunkById(500, fn($users) => archiveUsers($users));
```

**Regra de escolha:** `chunk` com eager loading para relacionamentos; `lazy` para pipelines simples; `cursor` para altíssimo volume sem relações; `chunkById` quando os dados mudam durante o processo.

**UUID v7 no Laravel 11/12:** nativo via `$model->useUniqueIds()` + `newUniqueId()`. UUIDv7 é time-sortable — mantém localidade de inserção no B-tree, reduz fragmentação de índice.

```php
// Migration com UUID v7 nativo
$table->uuid('id')->primary(); // Laravel gera v7 automaticamente se configurado

// Cast customizado para tipos Postgres nativos (tpetry/laravel-postgresql-enhanced)
// Suporte a INET, CIDR, INT4RANGE, TSVECTOR, etc. via casts
```

---

