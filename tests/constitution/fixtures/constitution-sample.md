# Argos Constitution

Version: 2.0.0

## Article I — Comprehension Before Action

### 1.1 Problem Definition

Before implementing any solution, the problem must be clearly defined.

### 1.2 Forbidden Patterns

- **Acting without understanding.** No code changes without comprehension.

## Article II — Code Quality Standards

### 2.1 Type Safety

TypeScript strict mode must be enabled.

- All variables must have explicit types
- No `any` type usage without justification
- No `@ts-ignore` without issue reference

### 2.7 Forbidden Patterns

- **Service layer pattern.** No `src/lib/services/` directory.
- **Barrel files.** No `index.ts` files with re-exports.
- **Catch-all utils.** No `utils.ts`, `helpers.ts`, `common.ts`, or `shared.ts`.
- **Hardcoded hex colors.** Use Tailwind theme only.
- **Browser alerts.** No `alert()`, `window.confirm()`, or `window.prompt()`.

## Article IX — Security

### 9.1 No Hardcoded Secrets

All credentials must be in environment variables.

### 9.4 Forbidden Patterns

- **eval() usage.** No dynamic code execution.
- **new Function().** No function constructor.
- **innerHTML assignment.** Use textContent or DOM APIs.
- **{@html} in Svelte.** Sanitize HTML before rendering.
