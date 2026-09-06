---
name: react-ref
description: Referência de React 19: Server Components, Actions e useActionState, use(), ref como prop, hook useOptimistic e o compilador. Carregue apenas em projeto React — a stack padrão dos projetos é Vue 3 + Inertia + PrimeVue.
user-invocable: false
---

# React 19 — Padrões Modernos


**Server Components:** renderizam no servidor, enviam HTML puro, zero JS no cliente. Use para componentes que só leem dados.

**Actions:** substitui o padrão manual de `loading/error/success state` em formulários:
```tsx
<form action={async (formData) => { await saveUser(formData) }}>
```

**`use` hook:** lê Promises e Contexts diretamente no render — sem `useEffect` + `useState` para data fetching.

**React Compiler (2025):** otimiza re-renders automaticamente — reduz necessidade de `useMemo`/`useCallback` manual. Habilitar via babel plugin.

**Anti-patterns no React 19:** `useEffect` para buscar dados iniciais (use Server Components ou `use(promise)`); `useMemo`/`useCallback` defensivo sem profiling (compiler resolve); `useReducer` para estado simples que cabe em `useState` + Actions.

---

