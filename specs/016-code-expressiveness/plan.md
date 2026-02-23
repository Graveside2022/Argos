# Implementation Plan: Code Expressiveness Improvement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Branch**: `016-code-expressiveness` | **Date**: 2026-02-23 | **Spec**: `specs/016-code-expressiveness/spec.md`
**Input**: Feature specification from `/specs/016-code-expressiveness/spec.md`

**Goal:** Raise Argos codebase expressiveness from C+ to B+ by eliminating 1,000+ lines of boilerplate through shared abstractions (route handler factory, result types, DRY utilities), cleaning dead exports, resolving circular dependencies, and closing client-side tooling gaps with production-grade headless libraries.

**Architecture:** Two-part approach — Part A (server-side) creates shared abstractions and migrates 66 route handlers to use them; Part B (client-side) integrates headless UI libraries for tables, forms, virtual lists, and toast notifications. Both parts are independent and can be executed in parallel.

**Tech Stack:** TypeScript strict, SvelteKit, Vite, Tailwind CSS, Zod, better-sqlite3, @tanstack/table-core, virtua, sveltekit-superforms, formsnap, svelte-sonner

---

## Summary

The Argos codebase has 66 API route handlers sharing identical boilerplate (~15-20 lines each of errMsg, try-catch, logger, json error formatting). Additionally, 19 files duplicate `errMsg()`, 36 files duplicate `execFileAsync`, 39 files use unsafe `(error as Error)` casts, 8 circular dependency cycles exist, and 25+ dead exports create noise. On the client side, `svelte-sonner` is installed but unused, tables lack sorting/filtering, forms lack schema validation, and the Kismet domain has two independent stores.

This plan creates shared abstractions (factory, result types, utilities), migrates all consumers, and integrates headless UI libraries — all while maintaining 100% backward compatibility and zero test regressions.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), SvelteKit 2.x, Svelte 5.35.5
**Primary Dependencies**: SvelteKit, Vite, Zod, better-sqlite3, @tanstack/table-core, virtua, sveltekit-superforms, formsnap, svelte-sonner, bits-ui 2.15.5
**Storage**: SQLite (rf_signals.db) via direct better-sqlite3 calls
**Testing**: Vitest (unit/integration), Playwright (e2e). Tests alongside source (`.test.ts`).
**Target Platform**: Raspberry Pi 5 (Kali Linux, ARM Cortex-A76, 8GB RAM)
**Project Type**: Web application (SvelteKit — single project, no monorepo)
**Performance Goals**: WebSocket <16ms, initial load <3s, <200MB heap, <15% CPU
**Constraints**: 8GB RAM shared with Claude Code + Chromium + Vite; OOM risk on concurrent heavy operations
**Scale/Scope**: 66 API route handlers, ~47,900 LOC, 19 API domains

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                                      | Gate                                             | Status                                                                         |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| **I.1** Comprehension Lock                   | End state, current state, constraints documented | **PASS** — spec.md §Summary + §Scope                                           |
| **I.2** Codebase Inventory                   | Existing implementations searched                | **PASS** — research.md R1-R10                                                  |
| **II.1** TypeScript Strict                   | No `any`, no `@ts-ignore`                        | **PASS** — all new code uses `unknown` + guards                                |
| **II.2** Modularity                          | Max 50 lines/function, 300 lines/file            | **PASS** — factory is ~30 lines; utilities are small                           |
| **II.3** Naming                              | kebab-case files, camelCase functions            | **PASS** — `create-handler.ts`, `errMsg()`                                     |
| **II.6** Forbidden: no barrel files          | No index.ts exports                              | **PASS** — each utility has its own file                                       |
| **II.6** Forbidden: no catch-all utils       | No utils.ts                                      | **PASS** — domain-specific modules                                             |
| **III.1** Test-First                         | Tests before implementation                      | **PASS** — TDD for all new utilities                                           |
| **IV.1** Lunaris Design Language             | Dark mode, Fira Code data, steel blue accent     | **PASS** — Part B components render through existing Lunaris-styled primitives |
| **V.2** No unused dependencies               | All deps must be used                            | **PASS** — svelte-sonner activation (FR-020)                                   |
| **VI.1** Pin exact versions                  | Every new package justified and pinned           | **PASS** — 5 new packages, all justified in spec §Reference                    |
| **VI.3** No npm install without approval     | ASK FIRST                                        | **GATE** — will ask before `npm install`                                       |
| **VIII.3** AI: ASK FIRST for package install | Explicit approval needed                         | **GATE** — deferred to task execution                                          |

## Project Structure

### Documentation (this feature)

```text
specs/016-code-expressiveness/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/           # Phase 1 API contracts
│   └── api-error-response.ts  # Unified error response type
└── tasks.md             # Phase 2 task list (created by /speckit.tasks)
```

### Source Code (new files this feature creates)

```text
src/lib/server/
├── api/
│   ├── create-handler.ts          # Route handler factory (FR-003)
│   ├── create-handler.test.ts     # Factory unit tests
│   ├── error-utils.ts             # Shared errMsg() (FR-001)
│   ├── error-utils.test.ts        # errMsg unit tests
│   └── api-response.ts            # Unified API response types (FR-014)
├── exec.ts                        # Shared execFileAsync (FR-002)
├── exec.test.ts                   # exec unit tests
├── result.ts                      # safe() result tuple (FR-006)
├── result.test.ts                 # Result type unit tests
├── retry.ts                       # withRetry (FR-010)
│   retry.test.ts                  # Retry unit tests
└── timeout.ts                     # withTimeout (FR-010)
    timeout.test.ts                # Timeout unit tests

# Circular dependency resolution (new type files):
src/lib/components/dashboard/map/
└── map-handler-types.ts           # Shared types for map-handlers cycle

src/lib/hackrf/sweep-manager/
└── sweep-types.ts                 # Shared types for process-lifecycle cycle

src/lib/server/gsm/
└── l3-types.ts                    # Shared types for l3-decoder cycle

src/lib/server/services/gps/
└── gps-types.ts                   # Shared types for gps cycle

src/lib/server/services/gsm-evil/
└── gsm-evil-types.ts              # Shared types for gsm-evil cycles (resolves 2)

src/routes/gsm-evil/
└── gsm-evil-shared.ts             # Shared types for page-logic cycle

# Part B — Client-side (new component integration files):
src/lib/components/
├── toast-provider.svelte          # Toaster mount for svelte-sonner (FR-020)
└── ui/data-table/                 # TanStack Table + shadcn integration (FR-017)
    ├── data-table.svelte
    └── data-table-helpers.ts
```

**Structure Decision**: Single SvelteKit project. New server-side utilities go in `src/lib/server/` in domain-specific modules per constitution Article II.6. New client-side components go in `src/lib/components/` following existing patterns.

### Files Modified (high-touch)

```text
# Route handler migration (~66 files):
src/routes/api/**/+server.ts       # Replace boilerplate with factory calls

# errMsg removal (19 files):
[See research.md R1 for full list]

# execFileAsync removal (36 files — overlap with routes):
[See research.md R2 for full list]

# (error as Error) elimination (23 files):
[See research.md R3 for full list]

# Circular dependency resolution (16 files in 8 pairs):
[See research.md R7 for full list]

# Kismet store unification (2 stores + consumers):
src/lib/kismet/stores.ts
src/lib/stores/tactical-map/kismet-store.ts
src/lib/kismet/websocket.ts
src/lib/kismet/websocket-handlers.ts

# Toast activation:
src/routes/+layout.svelte          # Mount <Toaster />
```

## Complexity Tracking

> No constitution violations requiring justification. All new files are domain-specific single-purpose modules under 300 lines.

---

## Phase 0: Foundation Utilities

**Goal**: Create the shared abstractions that all subsequent phases depend on. TDD — tests first, then implementation.

### Phase 0.1: Shared errMsg() Utility

**Create**: `src/lib/server/api/error-utils.ts` + `src/lib/server/api/error-utils.test.ts`

```typescript
// src/lib/server/api/error-utils.ts
export function errMsg(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	return String(err);
}
```

**Tests**: Error instance, string, number, null, undefined, object, symbol.

### Phase 0.2: Shared execFileAsync

**Create**: `src/lib/server/exec.ts` + `src/lib/server/exec.test.ts`

```typescript
// src/lib/server/exec.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

export const execFileAsync = promisify(execFile);
```

**Tests**: Successful execution, failed execution, timeout option.

### Phase 0.3: Unified API Response Types

**Create**: `src/lib/server/api/api-response.ts`

```typescript
// src/lib/server/api/api-response.ts

/** Success response — all API endpoints return this shape on success (FR-014). */
export interface ApiSuccessResponse {
	success: true;
	[key: string]: unknown; // Domain-specific data fields
}

/** Error response — all API endpoints return this shape on failure (FR-014). */
export interface ApiErrorResponse {
	success: false;
	error: string;
	details?: unknown; // Optional: Zod validation issues
}

/** Discriminated union for all API responses. */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
```

**Note on `success` field (FR-014)**: The spec mandates `{ success: boolean }` in every response. Some existing routes omit it (e.g., `{ error: string }` without `success`). The factory MUST add `success: true` on success and `success: false` on error. Routes that already include `success` are compatible.

### Phase 0.4: Route Handler Factory

**Create**: `src/lib/server/api/create-handler.ts` + `src/lib/server/api/create-handler.test.ts`

```typescript
// src/lib/server/api/create-handler.ts
import { json, type RequestEvent } from '@sveltejs/kit';
import type { ZodSchema } from 'zod';
import { errMsg } from './error-utils';
import { logger } from '$lib/utils/logger';

type HandlerResult = Record<string, unknown> | Response;

interface HandlerOptions {
	validateBody?: ZodSchema;
}

export function createHandler(
	fn: (event: RequestEvent) => Promise<HandlerResult> | HandlerResult,
	options?: HandlerOptions
): (event: RequestEvent) => Promise<Response> {
	return async (event: RequestEvent) => {
		try {
			if (options?.validateBody) {
				const body = await event.request.json();
				const parsed = options.validateBody.safeParse(body);
				if (!parsed.success) {
					return json(
						{ success: false, error: parsed.error.issues[0].message },
						{ status: 400 }
					);
				}
				event.locals.validatedBody = parsed.data;
			}
			const result = await fn(event);
			if (result instanceof Response) return result;
			return json(result);
		} catch (err) {
			const message = errMsg(err);
			logger.error(`[${event.url.pathname}] ${message}`);
			return json({ success: false, error: 'Internal server error' }, { status: 500 });
		}
	};
}
```

**Tests**: Success path, error path, validation pass, validation fail, Response passthrough, custom error shapes.

### Phase 0.5: Result Type (safe())

**Create**: `src/lib/server/result.ts` + `src/lib/server/result.test.ts`

```typescript
// src/lib/server/result.ts
export type Result<T> = [T, null] | [null, Error];

export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
	try {
		const data = await fn();
		return [data, null];
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return [null, error];
	}
}

export function safeSync<T>(fn: () => T): Result<T> {
	try {
		const data = fn();
		return [data, null];
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return [null, error];
	}
}
```

**Tests**: Success tuple, error tuple, non-Error thrown, sync variant.

### Phase 0.6: Async Wrappers (withRetry, withTimeout)

**Create**: `src/lib/server/retry.ts` + `src/lib/server/retry.test.ts`, `src/lib/server/timeout.ts` + `src/lib/server/timeout.test.ts`

```typescript
// src/lib/server/retry.ts
interface RetryOptions {
	attempts: number;
	delayMs: number;
	backoff?: 'linear' | 'exponential';
}

export function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): () => Promise<T> {
	return async () => {
		let lastError: Error | undefined;
		for (let i = 0; i < options.attempts; i++) {
			try {
				return await fn();
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				if (i < options.attempts - 1) {
					const delay =
						options.backoff === 'exponential'
							? options.delayMs * 2 ** i
							: options.delayMs;
					await new Promise((r) => setTimeout(r, delay));
				}
			}
		}
		throw lastError!;
	};
}

// src/lib/server/timeout.ts
export function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): () => Promise<T> {
	return async () => {
		return Promise.race([
			fn(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
			)
		]);
	};
}
```

**Tests**: Retry success after failures, retry exhaustion, exponential backoff timing, timeout trigger, timeout success.

---

## Phase 1: Migration — errMsg & execFileAsync Consolidation

**Goal**: Replace all 19 local `errMsg()` definitions and 36 `execFileAsync` declarations with shared imports. Mechanical find-and-replace with build verification after each batch.

### Phase 1.1: Migrate errMsg (19 files)

For each file in research.md R1 list:

1. Remove `function errMsg(...)` definition
2. Add `import { errMsg } from '$lib/server/api/error-utils';`
3. Verify: `npx tsc --noEmit <file>` passes

**Batch by domain** (5 batches of ~4 files each):

- Batch 1: TAK routes (4 files: certs, enroll, truststore, import-package)
- Batch 2: RF/HackRF routes (4 files: rf/stop-sweep, rf/emergency-stop, rf/start-sweep, hackrf/start-sweep)
- Batch 3: System routes (4 files: docker, docker/[action], services, info, memory-pressure)
- Batch 4: Signal routes (3 files: signals/+server, signals/batch, signals/statistics)
- Batch 5: Remaining (4 files: openwebrx/control, db/cleanup, buffer-parser + verification build)

### Phase 1.2: Migrate execFileAsync (36 files)

For each file with `const execFileAsync = promisify(execFile)`:

1. Remove local declaration + `import { execFile }` + `import { promisify }`
2. Add `import { execFileAsync } from '$lib/server/exec';`
3. Remove unused `child_process`/`util` imports if no other usage
4. Verify: `npx tsc --noEmit <file>` passes

**Batch by directory** (~6 batches of ~6 files each).

### Phase 1.3: Eliminate (error as Error) casts (23 files, 39 instances)

For each `(error as Error).message` or `(error as Error)`:

1. Replace with `errMsg(error)` (if used for message extraction)
2. Or replace with proper type guard (if used for other Error properties)
3. Verify: `npx tsc --noEmit <file>` passes

---

## Phase 2: Migration — Route Handler Factory

**Goal**: Migrate route handlers to use `createHandler()`. Start with simple GET endpoints, then POST/PUT/DELETE.

### Phase 2.1: Migrate Simple GET Handlers (~25 routes)

Routes that follow the pattern: try { result; return json(result) } catch { return json({ error }); }

Example before:

```typescript
export const GET: RequestHandler = async () => {
	try {
		const results = await doWork();
		return json({ success: true, ...results });
	} catch (error) {
		return json({ success: false, error: errMsg(error) });
	}
};
```

Example after:

```typescript
export const GET = createHandler(async () => {
	const results = await doWork();
	return { success: true, ...results };
});
```

### Phase 2.2: Migrate POST/PUT/DELETE Handlers (~25 routes)

Same pattern but with body parsing. Handlers that use Zod validation get `validateBody` option.

### Phase 2.3: Review Remaining Handlers (~16 routes)

Routes that return streaming responses, non-JSON, or have complex custom error shapes — document which ones stay manual and why.

---

## Phase 3: Dead Exports & Circular Dependencies

### Phase 3.1: Remove Dead Exports

1. Run dead export analysis (grep each exported symbol for import consumers)
2. For each dead export:
    - If unused internally too → remove the function/const entirely
    - If used internally only → remove `export` keyword
3. Special cases:
    - `safeErrorResponse` + `logAndRespond` (0 consumers) → delete `error-response.ts`
    - `safeJsonParse` (3 consumers) → keep; it serves a valid niche
4. Verify: `npm run build` passes

### Phase 3.2: Resolve 8 Circular Dependencies

For each cycle (see research.md R7):

1. Identify the shared types/constants causing the bidirectional import
2. Extract them to a new `*-types.ts` file (only when 3+ consumers; otherwise move to the lower-dep module)
3. Update both files to import from the new types file
4. Verify: `npx madge --circular src/` shows one fewer cycle
5. After all 8: confirm zero cycles

---

## Phase 4: Client-Side Tooling (Part B)

### Phase 4.1: Activate svelte-sonner (FR-020)

**No install needed** — already in `package.json` at `1.0.7`.

1. Create `src/lib/components/toast-provider.svelte` that wraps `<Toaster />` with Lunaris theme
2. Mount in `src/routes/+layout.svelte`
3. Add `toast()` calls to 2-3 existing API response handlers as proof of concept
4. Verify: toasts appear with correct dark theme styling

### Phase 4.2: Install & Integrate TanStack Table (FR-017)

**Install**: `@tanstack/table-core` (exact version pinned)

1. Add shadcn-svelte data-table helper components to `src/lib/components/ui/data-table/`
2. Convert one existing table (e.g., DeviceTable in DevicesPanel) to use TanStack Table
3. Add sorting + filtering capabilities
4. Verify: table renders with Lunaris styling, sorting works

### Phase 4.3: Install & Integrate Virtua (FR-018)

**Install**: `virtua` (exact version pinned)

1. Add `VList` to one existing long list (signal entries or device list)
2. Verify: smooth scrolling with 1,000+ items, only visible rows render

### Phase 4.4: Install & Integrate Superforms + Formsnap (FR-019)

**Install**: `sveltekit-superforms`, `formsnap` (exact versions pinned)

1. Convert one existing form (e.g., GSM Evil settings) to use superforms + Zod schema
2. Verify: server+client validation, error messages render in Lunaris theme

### Phase 4.5: TanStack Query (FR-021 — Optional)

**Decision gate**: Evaluate whether `@tanstack/svelte-query` provides enough value over a simple `fetchJSON<T>()` wrapper. If the project doesn't have REST endpoints that benefit from caching/background refetch, defer this.

### Phase 4.6: Unify Kismet Stores (FR-022)

1. Designate `src/lib/stores/tactical-map/kismet-store.ts` as the single source of truth
2. Modify `src/lib/kismet/websocket-handlers.ts` to update the tactical-map store directly
3. Replace `src/lib/kismet/stores.ts` with a thin derived adapter (or remove if no consumers remain)
4. Verify: all Kismet UI components still work, device counts are consistent

---

## Phase 5: Verification & Cleanup

### Phase 5.1: Full Test Suite

```bash
npm run test:unit          # All unit tests pass
npm run test:integration   # Integration tests pass
npm run build              # Production build succeeds
npx madge --circular src/  # Zero cycles
```

### Phase 5.2: Success Criteria Verification

- [ ] SC-001: LOC decreased by 1,000+ (Part A only)
- [ ] SC-002: Zero local `errMsg()` definitions (only shared export)
- [ ] SC-003: Zero local `execFileAsync` declarations (only shared export)
- [ ] SC-004: 50+ routes use factory
- [ ] SC-005: Zero dead exports
- [ ] SC-006: Zero circular dependencies
- [ ] SC-007: `npm run build` — zero new warnings
- [ ] SC-008: All existing tests pass
- [ ] SC-009: New utilities have 100% branch coverage
- [ ] SC-010: New route handler < 10 lines
- [ ] SC-011: Zero `(error as Error)` casts
- [ ] SC-012: Unified error response shape
- [ ] SC-013: Zero abandoned abstractions
- [ ] SC-014: 1+ data table with sorting/filtering
- [ ] SC-015: 1+ virtual list
- [ ] SC-016: 1+ superforms form
- [ ] SC-017: svelte-sonner active
- [ ] SC-018: Single Kismet store

### Phase 5.3: Cleanup

- Remove `src/lib/server/security/error-response.ts` (absorbed into factory)
- Remove any files emptied by migration
- Final `npm run lint:fix`
