# Source Code Directory Context

This file documents key insights and context for AI agents working in the `/src` directory.

## 🏗️ Architecture & Organization

- **Feature-Based Structure**: Code is organized by feature within `src/lib/components/` (e.g., `dashboard/`, `gsm-evil/`).
- **Service Layer Pattern**: Business logic resides in `src/lib/services/` as singletons or classes, NOT directly in `+page.svelte` or `+server.ts` files.
- **State Management**:
    - **Global State**: Use Svelte stores in `src/lib/stores/` (e.g., `settings.ts`, `devices.ts`).
    - **Local State**: Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for component-local reactivity.
- **API**: Backend logic is exposed via `src/routes/api/`.

## 🛠️ Technology Stack Specifications

- **Framework**: SvelteKit 2.x with Svelte 5 (Runes mode).
- **Language**: TypeScript 5.8 (Strict Mode).
- **Styling**: Tailwind CSS 4.x. Use utility classes. Avoid custom CSS files unless absolutely necessary.
- **Database**: `better-sqlite3` via `src/lib/server/database/`.

## 🚨 Critical Coding Guidelines

### 1. Svelte 5 Reactivity (Runes)
- **Prefer Runes**: Use `$state`, `$derived`, and `$effect` over legacy `let` exports or `$:`.
- **No Manual Subscriptions**: Avoid `.subscribe()` in components. Use `$store` auto-subscription syntax.
- **Effects**: Use `$effect` sparingly for side effects, not for derived state.

### 2. TypeScript & Type Safety
- **Strict Mode**: `noImplicitAny` is ON. Define interfaces/types for all data structures in `src/lib/types/` or co-located if specific.
- **App.d.ts**: Global types (e.g., `App.Locals`, `App.PageData`) are defined here.
- **Generics**: Use generics for reusable components and functions.

### 3. Server-Side Logic
- **Validation**: Use `zod` for all input validation (API bodies, URL params).
- **Error Handling**: Use `sveltejs/kit`'s `error()` helper. Do not throw raw errors in routes.
- **Security**:
    - Sanitize all shell inputs using `src/lib/server/security/input-sanitizer.ts`.
    - Verify `ARGOS_API_KEY` in `hooks.server.ts` or via middleware.

### 4. Components
- **Shadcn UI**: Use `src/lib/components/ui` for base primitives.
- **Composition**: Prefer composition slots over complex prop drilling.
- **Icons**: Use `lucide-svelte` for icons.

## 🧪 Testing Strategy
- **Unit**: Vitest for utility functions and services (`src/**/*.test.ts`).
- **Component**: Vitest + Testing Library for component interactions.
- **E2E**: Playwright for critical flows (in `tests/e2e/`).

## ⚠️ Common Pitfalls to Avoid
- **DO NOT** use `document` or `window` in `load` functions (they run on server). Check `$app/environment` `browser` first.
- **DO NOT** import server-only modules (like `fs`, `child_process`, `better-sqlite3`) into client-side components (`.svelte` or `+page.ts`). Wrap them in `+page.server.ts` or API routes.
- **DO NOT** use `any` type aggressively. Fix the type definition.
