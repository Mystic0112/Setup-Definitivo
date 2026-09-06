---
name: mobile-ref
description: Referência mobile para React Native (New Architecture, Expo, navegação, push) e Flutter (Dart 3, state management, build). Carregue ao construir app mobile, configurar navegação/push, ou publicar nas stores — não é conhecimento de núcleo, puxe só quando a tarefa for mobile de verdade.
user-invocable: false
---

# Mobile — React Native & Flutter

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### React Native: New Architecture (padrão desde 0.76)

A New Architecture é **habilitada por padrão** desde RN 0.76. O que muda na prática:

- **JSI (JavaScript Interface)**: substitui o bridge assíncrono. JS mantém referência direta a objetos C++ — sem serialização JSON, chamadas síncronas possíveis.
- **Turbo Modules**: substitui `NativeModules`. Carregamento lazy + type-safety via Codegen. Apps com 20+ módulos nativos ganham 25–40% de redução no tempo de startup.
- **Fabric**: novo renderer UI. Layout calculado em C++ (Yoga), compartilhado entre plataformas. Permite renders síncronos — eliminando glitches em animações complexas.
- **Codegen**: gera bindings type-safe JS ↔ nativo a partir de arquivos de schema TypeScript. Obrigatório para Turbo Modules e Fabric Components customizados.
- **Bridgeless mode**: disponível desde 0.73, padrão em novas apps na 0.76+. Remove completamente o bridge legado.

**Migração**: use `npx @react-native-community/upgrade-helper`. Módulos de terceiros precisam suportar a New Architecture — cheque o diretório [reactnative.directory](https://reactnative.directory) com filtro `New Architecture`.

---

### Expo SDK 53+ e Expo Router v3

- **SDK 53** (maio 2025) roda sobre RN 0.79, New Architecture habilitada por padrão.
- **`npx create-expo-app`** já cria projetos com Expo Router + TypeScript por padrão.
- **Expo Router v3**: file-based routing com inferência completa de tipos. Suporta layouts aninhados (`_layout.tsx`), grupos de rotas `(auth)/`, rotas dinâmicas `[id].tsx` e rotas de API server-side.
- **EAS Build**: caching de builds reduz tempo em até 30%. Suporta custom build profiles e Apple team provisioning simplificado.
- **EAS Update (OTA)**: deploys incrementais sem passar pela store. Use `expo-updates` com `Updates.checkForUpdateAsync()`.
- **`expo/fetch`**: Fetch API WinterCG-compliant com suporte a streaming — ideal para APIs de IA (streaming de tokens).
- **expo-audio** substitui `expo-av` para áudio no SDK 53.
- **Edge-to-edge layouts** são padrão no Android a partir do SDK 53.

---

### Flutter 3.29+ e Impeller

- **Impeller é o renderer padrão** em iOS (desde 3.10) e Android (desde 3.27/3.29). Elimina shader compilation jank com shaders pré-compilados.
- **Vulkan backend** no Android: feature-complete desde 3.22. Habilitar explicitamente ainda pode ser necessário em alguns devices.
- **DevTools 2025**: Property Editor interativo para editar propriedades de widgets em runtime; memory leak detection automático.
- **Material 3**: componentes refinados — `NavigationRail` scrollável, `BottomSheet` com altura dinâmica, `Carousel`, `Badge` e `MenuAnchor` atualizados.
- **Dart 3.7**: pattern matching avançado, `if-case` expressions, records e sealed classes em produção.

---

### React Navigation v7 e v8-alpha

- **v7**: usa `useSyncExternalStore` (React 18) em vez de Context — 40–60% menos re-renders em navigators profundos. Integrado com `react-native-gesture-handler` v2 (gestos na UI thread).
- **`useLinkProps`** e `Link` agora aceitam `screen` + `params` tipados em vez de path strings.
- **v8-alpha** (disponível para teste): hooks `useNavigation`, `useRoute` e `useNavigationState` com inferência automática de tipos por nome de tela. Bottom Tab Navigator usa primitivos nativos por padrão (`react-native-screens`).

---

### State Management Mobile em 2025

| Biblioteca | Quando usar |
|---|---|
| **Zustand** | Estado global simples/médio. API mínima, sem boilerplate. Middleware para persist/devtools. Favorito para equipes vindas do Redux. |
| **Jotai** | Estado atômico com dependências complexas. Cada `atom` é independente — re-renders cirúrgicos. Ideal para forms e estado derivado. |
| **Context API** | Estado local de componente ou feature isolada. Evitar para estado global em apps médios/grandes. |
| **Redux Toolkit** | Apps enterprise com time grande e necessidade de auditoria de estado. Overhead justificado só nesse cenário. |

---

### Notificações Push em 2025

- **expo-notifications**: abordagem recomendada para projetos Expo. Token via `Notifications.getExpoPushTokenAsync()`. Backend agnostic — funciona com Expo Push Service, FCM ou OneSignal.
- **Firebase Cloud Messaging**: use a **FCM API v1** (modular SDK). A API legada foi descontinuada. Configure `google-services.json` (Android) e APNs key (iOS) via EAS.
- **Padrão recomendado**: registrar token no backend no login, renovar token em `AppState` changes, tratar notificações em foreground via `addNotificationReceivedListener` e taps via `addNotificationResponseReceivedListener`.

---

### Stack Recomendada para Novo Projeto Mobile em 2025

```
Framework:      Expo SDK 53+ com Expo Router v3 (file-based routing)
Linguagem:      TypeScript strict
Navegação:      Expo Router (wraps React Navigation v7)
State:          Zustand (global) + React Query/TanStack Query (server state)
Estilo:         NativeWind v4 (Tailwind para RN) ou StyleSheet + design tokens
Forms:          React Hook Form + Zod
Notificações:   expo-notifications + FCM v1
OTA Updates:    EAS Update
CI/CD:          EAS Build + GitHub Actions
Testes:         Jest + React Native Testing Library + Maestro (E2E)
```

> **Evitar em projetos novos**: Redux sem Redux Toolkit, `expo-av` para áudio, React Navigation standalone sem Expo Router, bridge legado do Firebase JS SDK (usar `@react-native-firebase` modular).

