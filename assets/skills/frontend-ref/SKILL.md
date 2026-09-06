---
name: frontend-ref
description: Referência de frontend fora do núcleo — detalhes de React/Vue, CSS avançado, animações, performance e specifics de framework. Carregue ao implementar UI que dependa desses detalhes; a base de componentes e acessibilidade o agente já tem.
user-invocable: false
---

# Frontend

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### Vue 3.5+ — APIs e padrões obrigatórios

**Prefira sempre:**
- `<script setup>` — nunca Options API em código novo
- `defineModel()` (estável desde 3.4) — substitui o padrão `emit('update:modelValue')` em componentes com v-model
- `useTemplateRef('id')` (3.5) — substitui `ref()` para template refs; suporta IDs dinâmicos e funciona dentro de composables
- Reactive Props Destructure (3.5, habilitado por padrão) — `const { title } = defineProps<{title: string}>()` é reativo sem `toRefs`
- `useId()` (3.5) — gera IDs únicos e estáveis para SSR/hidratação, use em form elements e aria attributes

**Anti-patterns a rejeitar:**
- `this.$emit('update:modelValue')` — use `defineModel()` 
- `const el = ref(null)` para template refs — use `useTemplateRef('el')`
- `toRefs(props)` apenas para reatividade — reactive destructure resolve isso
- Options API (`data()`, `methods`, `computed` como objeto) em qualquer componente novo

**Performance (3.5):** reactivity system com -56% de uso de memória; arrays reativos grandes até 10x mais rápidos.

---

### Inertia.js v2/v3 — Padrões com Vue 3

**useForm** — padrão para formulários que fazem navegação (POST/PUT/DELETE com redirect):
```ts
const form = useForm({ name: '', email: '' })
form.post('/users', { onSuccess: () => form.reset() })
```
**useHttp** (novo no v3) — para requests sem navegação (fetch sem redirecionar a página).

**Instant Visits** (v3) — troca imediata para o componente alvo enquanto o servidor responde em background; use `<Link prefetch>` para pré-aquecimento.

**SSR no v3:** funciona automaticamente com o plugin Vite — sem servidor Node.js separado em desenvolvimento.

**Anti-patterns:** usar axios/fetch manual para submissões que deveriam usar `useForm`; misturar SPA fetch com Inertia visits na mesma rota.

---

### PrimeVue 4.x — Sistema de temas

**Arquitetura de tokens em 3 camadas:**
1. **Primitive** — paleta bruta (`blue-500`, `gray-100`)
2. **Semantic** — intenção (`primary`, `surface`, `text-color`)
3. **Component** — token específico (`button.background`, `inputtext.border.color`)

**Configuração correta (4.x):**
```ts
// main.ts
app.use(PrimeVue, {
  theme: { preset: Aura, options: { darkModeSelector: '.dark', cssLayer: true } }
})
```
Presets built-in: `Aura`, `Material`, `Lara`, `Nora`. Para customizar, sobrescreva tokens sem tocar em CSS:
```ts
theme: { preset: Aura, extend: { primary: { color: '{blue.500}' } } }
```
**Atenção:** desde 4.3.0 importar de `@primevue/themes/xxxxx` é deprecated — use o objeto preset direto.

---

### Tailwind CSS v4 — Nova engine (Oxide/Rust)

**Mudanças obrigatórias de conhecer:**
- Zero `tailwind.config.js` — configuração via CSS com `@theme`:
```css
@import "tailwindcss";
@theme {
  --color-brand: oklch(55% 0.2 260);
  --font-display: "Inter", sans-serif;
}
```
- Detecção de conteúdo automática — sem array `content:[]`
- Todos os tokens `@theme` viram CSS custom properties, acessíveis em qualquer CSS/inline style
- Engine Rust (Oxide): builds completos até 5x mais rápidos, incremental >100x mais rápido
- Usa `cascade layers`, `@property` e `color-mix()` nativos do CSS

**Anti-patterns:** criar `tailwind.config.js` em projeto v4; usar `theme.extend` em JS quando `@theme` resolve.

---

### Vite 6 — Configuração moderna

- Node.js mínimo: **20.0.0** (18 chegou ao EOL)
- **Environment API** (experimental): permite múltiplos ambientes (client, SSR, Cloudflare Worker) com entry points distintos
- Sass usa API moderna por padrão (sem warnings de deprecation)
- `@vitejs/plugin-react` deve ser **v5.0+** para suporte ao React 19
- Rolldown como bundler unificado (dev + prod com a mesma lógica) — já disponível via flag experimental

---

### Stack preferencial (2025)

Para projetos Laravel + SPA: **Vue 3.5 + Inertia v2/v3 + PrimeVue 4 (preset Aura) + Tailwind CSS v4 + Vite 6**

Para projetos Next.js: **React 19 + Server Components + Tailwind CSS v4 + Vite 6 (ou Turbopack)**
---

