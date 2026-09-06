---
name: vue
description: Security testing playbook for Vue.js (2/3) SPAs covering XSS via v-html, template injection, SSR (Nuxt) leaks, client-side auth bypass, and API trust boundaries
---

# Vue.js

Security testing for Vue 2/3 single-page apps (and Nuxt SSR). Focus: client-side rendering is not a trust boundary — the real gate is the API. Hunt XSS sinks, secrets shipped to the client, and auth enforced only in the UI.

## Attack Surface

**Rendering sinks**
- `v-html` (raw HTML injection)
- Dynamic `:href` / `:src` binding (`javascript:` URIs)
- `<component :is="userControlled">` (dynamic component)
- Runtime template compilation (`template` option with user data, Vue 2 full build)
- Render functions / JSX with unescaped input

**State & routing**
- Vue Router guards (`beforeEach`) — client-side only, bypassable
- Vuex/Pinia store holding tokens/PII
- `localStorage`/`sessionStorage` holding JWT (XSS-exfil risk)

**Build & config**
- `import.meta.env` / `VUE_APP_*` — anything not prefixed still may leak if referenced; secrets baked into bundle
- Source maps shipped to production
- Nuxt: `asyncData`/`useAsyncData`, server routes (`server/api`), runtime config public vs private

**API boundary**
- Axios/fetch base URL, interceptors, CORS reliance
- CSRF token handling for cookie-auth backends (Sanctum SPA)

## High-Value Targets

- `v-html` bound to any user-influenced string (comments, profile, markdown render)
- Tokens in `localStorage` reachable by any XSS
- Router guard as the ONLY access control (view + underlying API unprotected)
- Secrets/API keys in the JS bundle or `VUE_APP_*` env
- Nuxt `runtimeConfig` leaking private keys to `public`
- `:href="userUrl"` enabling `javascript:` or open redirect

## Reconnaissance

- Grep bundle/source for `v-html`, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`
- Check for shipped source maps (`.js.map`) and secrets: `grep -rE "(api[_-]?key|secret|token|password)" dist/`
- Enumerate API calls from the bundle; test each endpoint directly (bypass UI)
- Nuxt: inspect `nuxt.config` `runtimeConfig`, `/server/api/*` routes

## Testing Techniques

**XSS via v-html / dynamic bind**
- Inject `<img src=x onerror=alert(1)>` into any field rendered with `v-html`. For `:href`, try `javascript:alert(1)`. See `vulnerabilities/xss.md`, `open_redirect.md`.

**Client-side auth bypass**
- Router guards run in the browser. Call the underlying API endpoints directly (curl/Burp) without the SPA; if the backend trusts the UI, access leaks. The SPA is never the control — test the API with `frameworks/laravel.md` / `vulnerabilities/idor.md`.

**Token theft surface**
- If JWT sits in `localStorage`, any XSS exfiltrates it. Prefer `HttpOnly` cookies. Confirm storage location and chain with an XSS sink.

**Secret leakage**
- Search the production bundle and env for baked keys. Anything in the client is public. See `vulnerabilities/information_disclosure.md`.

**Nuxt SSR**
- Test `runtimeConfig` public/private split; SSR injection via `asyncData` reflecting request data; server routes for SSRF/IDOR. See `vulnerabilities/ssrf.md`.

**Prototype pollution (client)**
- Deep-merge of user JSON into objects (query parsers, config merges) can pollute `__proto__`, escalating to DOM XSS. See `vulnerabilities/prototype_pollution.md`.

## Remediation Anchors

- Avoid `v-html`; if unavoidable, sanitize with DOMPurify before binding.
- Never store JWT in `localStorage`; use `HttpOnly; Secure; SameSite` cookies (fits Laravel Sanctum SPA).
- Treat every route guard as UX only; enforce authz on the API for every object and action.
- No secrets in the bundle; server-side proxy for privileged calls. Disable prod source maps.
- Nuxt: private keys only in server `runtimeConfig`, never `public`.
