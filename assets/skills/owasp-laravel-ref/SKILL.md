---
name: owasp-laravel-ref
description: Referência-resumo de OWASP Top 10 mapeado para Laravel/PHP, headers de segurança recomendados e checklist LGPD/API. Quick-reference; para metodologia profunda de cada vuln, use os playbooks strix em ~/.claude/strix-agentes/.
user-invocable: false
---

# OWASP → Laravel (referência rápida)

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### OWASP Top 10 2021 — Mapeamento para Laravel/PHP

| # | Categoria | Manifestação em Laravel | Mitigação |
|---|-----------|------------------------|-----------|
| A01 | Broken Access Control | Falta de `$this->authorize()`, rotas sem middleware `auth` | Policies obrigatórias em todo resource controller |
| A02 | Cryptographic Failures | Armazenar dados sensíveis sem criptografia, uso de MD5/SHA1 | `encrypt()`/`decrypt()` do Laravel, Argon2id para senhas |
| A03 | Injection | Query concatenada, `DB::statement()` com input direto | Eloquent ORM ou `DB::select()` com bindings sempre |
| A04 | Insecure Design | Sem rate limit em login, reset de senha sem expiração | `ThrottleRequests` middleware, tokens com TTL curto |
| A05 | Security Misconfiguration | `APP_DEBUG=true` em produção, Telescope/Horizon públicos | `.env` nunca commitado; Telescope protegido por gate |
| A06 | Vulnerable Components | Pacotes Composer com CVEs não monitorados | `composer audit` no CI/CD pipeline |
| A07 | Auth Failures | Sessão não invalidada no logout, tokens sem rotação | `Auth::logoutOtherDevices()`, rotação de refresh tokens |
| A08 | Software Integrity Failures | Sem verificação de integridade de pacotes | `composer.lock` commitado; Dependabot ativo |
| A09 | Logging Failures | Sem log de tentativas de login, dados sensíveis em log | Laravel Log com níveis; nunca logar passwords/tokens |
| A10 | SSRF | `Http::get($url_do_usuario)` sem validação | Whitelist de domínios permitidos; bloquear IPs internos |

### Autenticação Recomendada em 2025

**Sanctum (padrão para SPAs e mobile):**
- `php artisan install:api` — instala Sanctum por padrão no Laravel 11+
- SPA: autenticar via cookie de sessão + CSRF (`/sanctum/csrf-cookie` primeiro)
- Mobile/API: Personal Access Tokens com escopos (`tokenCan('read:orders')`)
- Revogar todos os tokens em logout: `$user->tokens()->delete()`

**Passport (apenas se OAuth2 full é obrigatório):**
- Usar Authorization Code + PKCE obrigatório (fluxo Implicit e ROPC são depreciados no OAuth 2.1)
- `code_verifier` / `code_challenge` em todo cliente público

**JWT (quando stateless é requisito):**
- Access token: vida máxima 15 min; Refresh token: 7–30 dias
- Assinar com RS256 (assimétrico) — nunca `none` ou HS256 com segredo fraco
- Validar: `exp`, `iss`, `aud` em toda requisição
- Armazenar em cookie `HttpOnly; Secure; SameSite=Strict` — nunca em `localStorage`

### Headers HTTP de Segurança — Valores Recomendados 2025

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
```
Em Laravel, usar middleware ou pacote `spatie/laravel-csp` para CSP dinâmico com nonces.

### Checklist de Segurança para APIs REST Modernas

**Autenticação & Autorização:**
- [ ] Toda rota protegida tem middleware `auth:sanctum` (ou equivalente)
- [ ] Rate limiting configurado: `throttle:60,1` no mínimo; endpoints de login: `throttle:5,1`
- [ ] Policies verificadas com `$this->authorize()` — nunca só no front
- [ ] Tokens com escopo mínimo necessário (princípio do menor privilégio)

**Dados & Input:**
- [ ] Form Requests com `rules()` em todos os endpoints de escrita
- [ ] `$request->validated()` — nunca `$request->all()` em mass assignment
- [ ] Paginação obrigatória — nunca retornar coleções ilimitadas
- [ ] Campos sensíveis excluídos do `$visible` do modelo (CPF, senha, token)

**Supply Chain:**
- [ ] `composer audit` e `npm audit` rodando no CI antes do deploy
- [ ] Dependabot ou Renovate configurado no repositório
- [ ] `composer.lock` e `package-lock.json` sempre commitados
- [ ] SBOM gerado em formato CycloneDX para projetos críticos

**LGPD/GDPR — Obrigações Técnicas:**
- [ ] Coletar apenas dados necessários para a finalidade declarada (minimização)
- [ ] Logs de auditoria para acesso a dados pessoais (quem acessou, quando)
- [ ] Endpoint de exportação de dados do usuário (direito de portabilidade)
- [ ] Rotina de exclusão completa (soft delete não é suficiente para LGPD)
- [ ] Dados pessoais criptografados em repouso (AES-256 ou Libsodium)
- [ ] ANPD: multas chegaram a R$12M em Q1/2025; GDPR acumulou €5,88B desde 2018
