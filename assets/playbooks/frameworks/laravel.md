---
name: laravel
description: Security testing playbook for Laravel/PHP applications covering Eloquent injection, mass assignment, auth (Sanctum/Passport), policies, blade XSS, queue and storage abuse
---

# Laravel

Security testing for Laravel applications (Laravel 10/11/12, PHP 8.1+). Focus on authorization drift across policies/middleware, mass assignment, injection surviving Eloquent, and misconfiguration exposed in production.

## Attack Surface

**Routing & Middleware**
- `routes/web.php`, `routes/api.php`; route model binding (`{user}` auto-resolves)
- Middleware groups (`web`, `api`), `auth`, `auth:sanctum`, `throttle`, custom middleware
- Signed URLs (`URL::signedRoute`), `hasValidSignature`

**Auth**
- Sanctum (SPA cookie + CSRF, or Personal Access Tokens with abilities)
- Passport (OAuth2), Fortify, Breeze/Jetstream
- Guards and providers in `config/auth.php`

**Data Layer**
- Eloquent ORM, query builder, raw (`DB::raw`, `whereRaw`, `DB::statement`)
- Mass assignment (`$fillable` / `$guarded`), `$request->all()` binding
- Model `$hidden` / `$visible`, API Resources

**Templating & Output**
- Blade: `{{ }}` (escaped) vs `{!! !!}` (raw), `@json`, `Js::from`

**Jobs, Storage, Misc**
- Queues (serialized job payloads), broadcasting (Reverb/Pusher channels auth)
- Filesystem (`Storage`), public disk symlink, uploaded file validation
- `.env`, `config/app.php` debug, Telescope/Horizon dashboards

## High-Value Targets

- Resource controllers missing `$this->authorize()` / policy checks (BOLA/IDOR)
- `$request->all()` or `Model::create($request->all())` (mass assignment → privilege escalation via `is_admin`, `role_id`)
- `whereRaw`/`DB::raw`/`orderByRaw` with request input (SQLi surviving ORM)
- `{!! $var !!}` rendering user input (stored/reflected XSS)
- `APP_DEBUG=true` in production (stack traces, env leak via Ignition)
- Exposed `/telescope`, `/horizon`, `/_ignition/execute-solution` (CVE-2021-3129 RCE)
- Broadcasting channel auth (`routes/channels.php`) allowing cross-user subscribe
- Unsigned or replayable password-reset / email-verification links

## Reconnaissance

- Fingerprint: `X-Powered-By`, `laravel_session` cookie, `XSRF-TOKEN` cookie, `/livewire/` assets
- Probe `/telescope`, `/horizon`, `/_ignition/health-check`, `/.env`, `/storage/logs/laravel.log`
- Enumerate routes if source available: `php artisan route:list --json`
- Check `composer.json`/`composer.lock` for known-CVE packages (see `custom/dependency_cve_scanning.md`)

## Testing Techniques

**Mass assignment**
- Add unexpected fields to write requests (`role`, `is_admin`, `user_id`, `verified_at`). If model uses `$guarded = []` or binds `$request->all()`, they persist.

**Broken object-level auth (IDOR/BOLA)**
- Route model binding does NOT authorize. Swap `{id}` to another user's resource; if no policy/`authorize()`, access leaks. See `vulnerabilities/idor.md`.

**SQL injection past Eloquent**
- Inputs reaching `whereRaw`, `havingRaw`, `orderByRaw`, `DB::raw`, or `->orderBy($request->col)` (column-name injection). See `vulnerabilities/sql_injection.md`.

**XSS via Blade raw**
- Grep `{!! !!}` and Livewire `wire:` bound HTML; inject payload where user data reaches raw echo. See `vulnerabilities/xss.md`.

**Debug / info disclosure**
- Trigger an error; if Ignition renders with `APP_DEBUG=true`, env vars and stack leak. On old Ignition, attempt CVE-2021-3129. See `vulnerabilities/information_disclosure.md`, `rce.md`.

**Auth & tokens**
- Sanctum SPA: verify `/sanctum/csrf-cookie` + `SameSite`; test token abilities (`tokenCan`). Passport: enforce PKCE, no implicit/ROPC. See `vulnerabilities/authentication_jwt.md`, `protocols/oauth.md`.

**File upload**
- Validate MIME/extension server-side; test polyglot, double extension, path traversal in stored name, public-disk exposure. See `vulnerabilities/insecure_file_uploads.md`, `path_traversal_lfi_rfi.md`.

**Business logic**
- Signed URL replay, race on wallet/stock endpoints, coupon/quantity tampering. See `vulnerabilities/business_logic.md`, `race_conditions.md`.

## Remediation Anchors

- `Model::create($request->validated())` + explicit `$fillable`; never `$request->all()`.
- Policies + `$this->authorize()` on every resource action; middleware `auth:sanctum`.
- Bindings only: `where('col', $v)`; never interpolate into `whereRaw`. Whitelist sortable columns.
- Blade `{{ }}` default; `{!! !!}` only on sanitized HTML (`Purifier`).
- `APP_DEBUG=false` in prod; protect Telescope/Horizon by gate; keep Ignition patched.
- `composer audit` in CI; `composer.lock` committed.
