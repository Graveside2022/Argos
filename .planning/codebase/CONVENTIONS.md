# Code Conventions

> Mapped: 2026-02-24 | Source: CLAUDE.md, config/eslint.config.js, src/lib/server/, src/lib/components/

## TypeScript Conventions

### Strict Mode

- `strict: true` in tsconfig.json — no exceptions
- `@typescript-eslint/no-explicit-any`: `warn` (goal: zero `any`)
- `@typescript-eslint/no-non-null-assertion`: `warn` — prefer type guards
- Currently 16 `any` usages remain (8 core + 5 eslint-disable + 2 Record<string, any> + 1 alias)

### Naming

| Context                    | Convention           | Example                                |
| -------------------------- | -------------------- | -------------------------------------- |
| Files                      | kebab-case           | `gps-position-service.ts`              |
| Variables, functions       | camelCase            | `sweepManager`, `getSweepManager()`    |
| Types, interfaces, classes | PascalCase           | `RetryOptions`, `SweepManager`         |
| Constants                  | UPPER_SNAKE_CASE     | `MAX_BODY_SIZE`, `SHUTDOWN_KEY`        |
| Booleans                   | is/has/should prefix | `isKismetWsUpgrade`, `hasAttemptsLeft` |
| Type extraction files      | `-types.ts` suffix   | `gsm-evil-types.ts`                    |

### File Limits

- Max **300 lines** per file
- Max **50 lines** per function
- Single responsibility per file
- ~13 functions still exceed 50-line limit (known violations tracked in CONCERNS.md)

### Import Rules

- `eslint-plugin-simple-import-sort`: sorted imports enforced as errors
- **No barrel files** (`index.ts`) — eliminated project-wide. Direct imports only.
- Exception: `src/lib/components/ui/` (shadcn-svelte) historically used barrels, now removed
- Namespace pattern for compound components: `const Table = { Root, Header, Row, ... }`

### Module Boundaries

- `src/lib/server/` is server-only — never import from `$app/` or client stores
- MCP servers communicate via HTTP API (localhost:5173) — cannot import SvelteKit internals
- No catch-all `utils.ts` or `helpers.ts` — domain-specific modules only

## ESLint Configuration

Config: `config/eslint.config.js` (flat config format)

### Hard Errors

```javascript
complexity: ['error', 5]                    // Cyclomatic complexity ≤ 5
'sonarjs/cognitive-complexity': ['error', 5] // Cognitive complexity ≤ 5
'simple-import-sort/imports': 'error'        // Import ordering
'simple-import-sort/exports': 'error'        // Export ordering
```

### Warnings

```javascript
'@typescript-eslint/no-explicit-any': 'warn'
'@typescript-eslint/no-non-null-assertion': 'warn'
'no-console': ['warn', { allow: ['warn', 'error'] }]
```

### Svelte-specific

- `svelte-eslint-parser` with `tsParser` for `<script lang="ts">`
- Svelte 5 rune globals registered: `$state`, `$derived`, `$effect`, `$props`, `$bindable`, `$inspect`, `$host`
- `eslint-plugin-svelte` recommended rules applied to `.svelte` files

## Svelte 5 Patterns

### Component Anatomy

All components use Svelte 5 runes (not legacy `$:` syntax):

```svelte
<script lang="ts">
	import { type ComponentProps } from 'svelte';

	let { prop1, prop2 = 'default' }: { prop1: string; prop2?: string } = $props();
	let count = $state(0);
	let doubled = $derived(count * 2);

	$effect(() => {
		// side effects
	});
</script>
```

### State Handling Requirements

Every component must handle ALL states:

- **Empty** — no data available
- **Loading** — data being fetched
- **Default** — normal operation
- **Active** — user interaction state
- **Error** — operation failed (must suggest corrective action)
- **Success** — operation completed
- **Disabled** — component not interactive
- **Disconnected** — network/service unavailable

### Store Pattern

Stores use Svelte 5 runes in `.svelte.ts` files or plain `.ts` with custom reactivity:

```typescript
// theme-store.svelte.ts — uses .svelte.ts extension for rune support
let theme = $state('dark');
export function getTheme() {
	return theme;
}
```

Most stores are plain `.ts` files using custom event patterns or writable stores:

- `persisted-writable.ts` — localStorage-backed persistent store factory
- Domain stores aggregate API + WebSocket data

## CSS & Design System

### Token Architecture (Three Layers)

1. **shadcn tokens** (`src/app.css`): `--background`, `--card`, `--border`, `--primary`, etc.
    - Light + Dark mode (dark class only active)
    - 8 palette variants (blue, green, orange, red, rose, violet, yellow, default)
    - Mapped to Tailwind via `@theme inline` block

2. **Palantir tokens** (`src/lib/styles/palantir-design-system.css`): `--palantir-bg-*`, `--palantir-text-*`, etc.
    - Bridge layer that references shadcn tokens with hex fallbacks
    - Used by dashboard components (military aesthetic)
    - Includes spacing scale (8px grid), typography scale, radius scale

3. **Tailwind utilities** (`src/app.css`): `@theme inline` maps CSS vars to Tailwind colors
    - Custom colors: success, warning, info, signal-strength scale, feature categories
    - Glass effects: `.glass-panel`, `.glass-button`, `.glass-input`
    - Status indicators: `.status-connected`, `.status-disconnected`

### Design Rules (Lunaris)

- **Dark mode only** (light mode removed)
- Dual-font: Fira Code (data/metrics), Geist (navigation/chrome)
- All colors via design tokens — no hardcoded hex in components
- Status colors always desaturated; never sole indicator (pair with text label)
- Icons: Lucide for all navigation/status

### Layout Structure

```
TopStatusBar (40px)
├── IconRail (48px left)
├── PanelContainer (280px overview)
├── DashboardMap (fill, MapLibre GL)
└── ResizableBottomPanel (240px)
```

## Error Handling Conventions

### Preferred Pattern (new code): Result Tuples

```typescript
import { safe } from '$lib/server/result';

const [data, err] = await safe(() => fetchData());
if (err) {
	logger.error(err.message);
	return;
}
// data is non-null here
```

### Legacy Pattern (existing routes): try-catch + errMsg()

```typescript
import { errMsg } from '$lib/server/api/error-utils';

try {
	const result = await operation();
	return json(result);
} catch (error) {
	return json({ error: errMsg(error) }, { status: 500 });
}
```

### Higher-Order Wrappers

```typescript
import { withRetry } from '$lib/server/retry';
import { withTimeout } from '$lib/server/timeout';

const fetchWithRetry = withRetry(() => fetch(url), {
	attempts: 3,
	delayMs: 500,
	backoff: 'exponential'
});
```

### Error Rules

- Explicit handling for ALL external operations
- No swallowed errors — every catch must log or propagate
- User-visible errors must suggest corrective action
- Non-Error thrown values normalized via `normalizeError()`

## Git Conventions

### Branch Naming

- `feature/NNN-feature-name` or `NNN-feature-name`

### Commit Format

- `type(scope): TXXX — description`
- Types: feat, fix, refactor, docs, test, chore
- One commit per task, never WIP or mega commits
- No force-push

### Forbidden

- WIP commits, mega commits, generic messages ("fix stuff")
- Force-push, `@ts-ignore` without issue ID
- `npm install` without user approval (pin exact versions)
- ORMs, CSS frameworks beyond Tailwind, state management libraries, lodash
