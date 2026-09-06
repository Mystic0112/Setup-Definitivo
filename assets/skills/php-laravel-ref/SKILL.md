---
name: php-laravel-ref
description: Referência de PHP 8.3/8.4 e Laravel 11/12/13 (features por versão, breaking changes, APIs modernas). Carregue ao escrever backend PHP/Laravel que dependa de detalhe de versão — o núcleo (SOLID, PSR, arquitetura de API) o agente já tem.
user-invocable: false
---

# PHP & Laravel

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### PHP 8.3 / 8.4

**Preferir (8.3):**
- Typed class constants: `const string VERSION = '1.0';`
- `readonly` em propriedades de classes anônimas
- `json_validate()` nativo — sem `json_decode` + verificação manual
- Enum em expressões constantes: `Color::Red->value` em `match` e constantes

**Preferir (8.4 — novembro 2024):**
- Property hooks (getters/setters nativos): `public string $name { get => ...; set => ...; }`
- Asymmetric visibility: `public private(set) string $id` — leitura pública, escrita privada
- `array_find()`, `array_find_key()`, `array_any()`, `array_all()` nativos
- Typed constants em traits

**Evitar:**
- Mixins de visibility redundantes quando hooks resolvem
- `json_decode` apenas para validar — use `json_validate()`
- Arrays associativos como pseudo-objetos — use classes tipadas ou enums

---

### Laravel 11

**Estrutura nova (obrigatória em projetos novos):**
- Sem `app/Http/Kernel.php` e `app/Console/Kernel.php` — removidos
- Middlewares, rotas e exceções configurados em `bootstrap/app.php`:
  ```php
  ->withMiddleware(function (Middleware $m) { $m->append(MyMiddleware::class); })
  ->withExceptions(function (Exceptions $e) { $e->report(...); })
  ```
- Apenas um `AppServiceProvider` por padrão — consolidar o que antes era 5 providers
- Console commands em `routes/console.php` diretamente com `Schedule` e `Artisan::command`

**Preferir:**
- **Laravel Reverb** (WebSocket first-party): substitui Pusher/Soketi para real-time, escala horizontalmente via Redis pub/sub
- `php artisan install:api` para scaffolding de API sem Sanctum manual
- Lazy loading prevention em testes: `Model::preventLazyLoading()`
- `Schedule::call()->everyMinute()` em `routes/console.php` sem kernel

**Evitar:**
- Criar `Http/Kernel.php` ou `Console/Kernel.php` — padrão obsoleto no L11
- Múltiplos Service Providers para separar concerns — consolidar em `AppServiceProvider`
- Broadcasting manual sem Reverb em projetos novos

**Requisito mínimo:** PHP 8.2+

---

### Laravel 12 e 13

#### Laravel 12 (lançado fevereiro 2025)

**Contexto:** release de manutenção — foco em qualidade e dependências, sem ruptura de arquitetura.

**Novidades relevantes:**
- **Starter Kits modernos**: React, Vue, Svelte e Livewire com Shadcn UI; suporte a WorkOS AuthKit como provider de autenticação
- **Automatic Eager Loading** (v12.8+): resolve N+1 automaticamente sem precisar declarar `with()` em todo lugar
- **Route Attributes** (PHP 8+ attributes): define rotas diretamente sobre o método do controller, eliminando rotas em arquivo separado
  ```php
  #[Get('/users/{id}')]
  public function show(User $user): JsonResponse { ... }
  ```
- **Health Checks built-in**: rota de status do sistema disponível por padrão, sem pacote extra
- **UUID v7 em `HasUuids`**: substitui UUID v4 — mantém ordem temporal nativa, melhor para índices
- **xxHash substitui MD5** para hashing interno — mais rápido em grande escala
- **Job Batching aprimorado**: progresso, detecção de falha parcial e callbacks de conclusão mais robustos

**Breaking changes:**
- **Carbon 3.x obrigatório** — Carbon 2.x removido (principal ponto de atenção no upgrade)
- `DatabaseTokenRepository`: parâmetro `$expires` agora em **segundos**, não minutos
- Container de DI respeita valor default de propriedades de classe ao resolver instâncias
- Classes de banco de dados de baixo nível exigem `Illuminate\Database\Connection` explícita

**Requisito mínimo:** PHP 8.2+

---

#### Laravel 13 (lançado março 2026)

**Contexto:** sem breaking changes — upgrade suave do L12; exige PHP 8.3 mínimo.

**Novidades relevantes:**
- **PHP Attributes em modelos, jobs, commands, listeners e mais** (15+ locais): `$fillable`, `$table`, `$hidden`, `$primaryKey` como attributes nativos no topo da classe
- **Laravel AI SDK** (production-stable junto com L13): interface provider-agnóstica para text generation, tool-calling, image, audio e embeddings
- **JSON:API first-party**: resource classes com serialização, sparse fieldsets, links e headers conformes ao spec automaticamente
- **Passkeys** integrado aos starter kits e ao Fortify
- **CSRF aprimorado**: middleware renomeado para `PreventRequestForgery`; verificação de origem adicionada sobre o token existente

**Requisito mínimo:** PHP 8.3+

---

