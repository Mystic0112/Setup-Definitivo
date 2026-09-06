---
name: data-bi-ref
description: Referência de Data/BI — ETL/ELT (dbt, Airflow, Dagster), data warehouses (BigQuery, Snowflake, DuckDB), SQL analítico (window functions, CTEs) e ferramentas de dashboard (Metabase, Superset, Power BI). Carregue ao construir pipeline de dados, modelar warehouse ou montar dashboard — puxe só quando a tarefa for analítica de verdade.
user-invocable: false
---

# Data & BI

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### SQL Analítico avançado

Window functions eliminam self-joins e subqueries custosas. Dominá-las é obrigatório:

```sql
-- Ranking com partição
SELECT
  vendedor,
  regiao,
  total_vendas,
  RANK() OVER (PARTITION BY regiao ORDER BY total_vendas DESC) AS rank_regiao,
  DENSE_RANK() OVER (ORDER BY total_vendas DESC) AS rank_global,

  -- Comparação com período anterior
  LAG(total_vendas, 1) OVER (PARTITION BY vendedor ORDER BY mes) AS vendas_mes_anterior,
  LEAD(total_vendas, 1) OVER (PARTITION BY vendedor ORDER BY mes) AS vendas_proximo_mes,

  -- Média móvel 3 meses
  AVG(total_vendas) OVER (
    PARTITION BY vendedor
    ORDER BY mes
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) AS media_movel_3m

FROM vendas;
```

CTEs recursivas para hierarquias (pai/filho): `WITH RECURSIVE` une o nó raiz com os filhos iterativamente até esgotar a árvore.

Use `EXPLAIN ANALYZE` em queries que passem de 1s. Indexes em colunas de filtro e join. Materialized views para queries pesadas recorrentes.

### Polars vs Pandas

**Pandas**: ideal para exploração interativa, datasets até ~1GB, ecossistema maduro com sklearn/matplotlib.

**Polars**: preferível para volumes maiores, processamento em batch, performance crítica. API lazy evaluation evita carregar tudo em memória:

```python
import polars as pl

# Lazy — só executa no .collect()
df = (
    pl.scan_parquet("dados/*.parquet")
    .filter(pl.col("status") == "ativo")
    .group_by("regiao")
    .agg(pl.col("valor").sum().alias("total"))
    .sort("total", descending=True)
    .collect()
)
```

Polars é até 10x mais rápido que pandas em operações de agregação em datasets grandes.

### dbt — Transformações auditáveis

Estrutura de projeto dbt:

```
models/
  staging/      ← limpeza 1:1 das fontes (renomeia, casteamentos)
  intermediate/ ← lógica de negócio, joins entre entidades
  marts/        ← tabelas finais para o BI (fatos e dimensões)
```

Materializations por camada:
- `staging` → `view` (não ocupa espaço, sempre atualizado)
- `intermediate` → `ephemeral` ou `table`
- `marts` → `table` ou `incremental`

Snapshots para SCD Type 2 (histórico de mudanças):

```yaml
# snapshots/clientes_snapshot.sql
{% snapshot clientes_snapshot %}
  {{ config(target_schema='snapshots', unique_key='id',
            strategy='timestamp', updated_at='updated_at') }}
  SELECT * FROM {{ source('crm', 'clientes') }}
{% endsnapshot %}
```

Testes obrigatórios em todo modelo de mart:
```yaml
columns:
  - name: id
    tests: [not_null, unique]
  - name: status
    tests:
      - accepted_values:
          values: ['ativo', 'inativo', 'pendente']
```

### Metabase vs Superset

| Critério | Metabase | Apache Superset |
|---|---|---|
| Público-alvo | Times não-técnicos | Analistas e engenheiros |
| Setup | Simples (JAR ou Docker) | Requer mais configuração |
| Visualizações | Suficientes para o dia a dia | Avançadas e customizáveis |
| SQL nativo | Sim (SQL Lab) | Sim (SQL Lab avançado) |
| Row-level security | Plano pago | Open source |
| Quando usar | Self-service para o negócio | Times técnicos com análises complexas |

### Modern Data Stack 2025

O padrão consolidado em 2025 é **ELT > ETL**:

```
Fontes → Airbyte (ingestão) → Warehouse (BigQuery/Snowflake/DuckDB)
                                    ↓
                              dbt (transformação)
                                    ↓
                          Metabase / Superset (visualização)
```

ELT vence porque os warehouses modernos têm poder computacional para transformar em-loco, e manter o dado bruto permite reprocessar com novas regras sem reextração.

Para times menores ou análises locais: **DuckDB** substitui o warehouse com zero infra.

### DuckDB — o banco analítico embutido

DuckDB roda in-process (sem servidor), lê Parquet/CSV diretamente e é mais rápido que pandas para agregações:

```python
import duckdb

# Lê parquet diretamente sem carregar em memória
result = duckdb.sql("""
  SELECT
    regiao,
    SUM(valor) AS total,
    COUNT(*) AS qtd
  FROM read_parquet('dados/*.parquet')
  WHERE data >= '2025-01-01'
  GROUP BY regiao
  ORDER BY total DESC
""").df()  # retorna pandas DataFrame
```

Ideal para: análises locais sem infra, substituir pandas em scripts ETL, prototipagem antes de mover para warehouse.

