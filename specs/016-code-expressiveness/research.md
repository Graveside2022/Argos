# Research: Code Expressiveness Improvement

**Date**: 2026-02-23 | **Branch**: `016-code-expressiveness`

## R1: errMsg() Duplication — Verified

**Decision**: Extract to shared `src/lib/server/api/error-utils.ts`
**Rationale**: All 19 copies are functionally identical: `err instanceof Error ? err.message : String(err)`. Mechanical find-and-replace.
**Alternatives considered**:

- Inline the pattern at each site (rejected: defeats DRY purpose)
- Put in a barrel file (rejected: constitution forbids barrel files)

**Files containing `function errMsg`** (19):

1. `src/lib/hackrf/sweep-manager/buffer-parser.ts`
2. `src/routes/api/openwebrx/control/+server.ts`
3. `src/routes/api/signals/statistics/+server.ts`
4. `src/routes/api/system/docker/[action]/+server.ts`
5. `src/routes/api/system/docker/+server.ts`
6. `src/routes/api/signals/batch/+server.ts`
7. `src/routes/api/signals/+server.ts`
8. `src/routes/api/system/services/+server.ts`
9. `src/routes/api/system/info/+server.ts`
10. `src/routes/api/system/memory-pressure/+server.ts`
11. `src/routes/api/hackrf/start-sweep/+server.ts`
12. `src/routes/api/db/cleanup/+server.ts`
13. `src/routes/api/rf/stop-sweep/+server.ts`
14. `src/routes/api/rf/emergency-stop/+server.ts`
15. `src/routes/api/rf/start-sweep/+server.ts`
16. `src/routes/api/tak/certs/+server.ts`
17. `src/routes/api/tak/enroll/+server.ts`
18. `src/routes/api/tak/truststore/+server.ts`
19. `src/routes/api/tak/import-package/+server.ts`

## R2: execFileAsync Duplication — Verified

**Decision**: Extract to shared `src/lib/server/exec.ts`
**Rationale**: All 36 files use `promisify(execFile)` with the same pattern. Some additionally configure `maxBuffer` or `timeout` options — the shared utility should accept optional overrides.
**Files**: 36 files (see plan.md for full list — 15 in routes/api, 21 in lib/server)

## R3: Error Cast Analysis — Corrected Count

**Decision**: Route all error handling through `errMsg()` or factory
**Rationale**: Original analysis said 129 `(error as Error)` casts. Live grep found **39 occurrences across 23 files**. The discrepancy likely includes `as Error` in non-error contexts (type assertions for other purposes). The 39 confirmed instances are in catch blocks and should all be eliminated.

**Heaviest offenders**:

- `gsm-evil-control-service.ts` (3 casts)
- `kismet/stop/+server.ts` (3 casts)
- Multiple GSM Evil routes (2 casts each)

## R4: Abandoned Abstractions — Corrected Assessment

**Decision**: Only `safeErrorResponse` is truly abandoned. Keep `safeParseWithHandling`.

| Function                | File                      | Consumers                                                                  | Verdict                               |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `safeParseWithHandling` | `validation-error.ts:186` | 30+ across 14 files                                                        | **KEEP** — highest-adopted utility    |
| `safeJsonParse`         | `safe-json.ts:16`         | 3 files (gps-data-parser, gps-satellite-service, hardware-details-service) | **KEEP** — niche but valid use case   |
| `safeErrorResponse`     | `error-response.ts:15`    | 0 consumers (only `logAndRespond` calls it)                                | **ABSORB** into factory → remove file |
| `logAndRespond`         | `error-response.ts:29`    | 0 external consumers                                                       | **ABSORB** into factory → remove file |
| `handleCatchError`      | (in TAK routes)           | 2 files (tak/enroll, tak/import-package)                                   | **ABSORB** into factory               |

## R5: Route Handler Factory Design

**Decision**: `createHandler()` factory wrapping SvelteKit `RequestHandler`

```typescript
// Pattern: src/lib/server/api/create-handler.ts
type HandlerFn = (event: RequestEvent) => Promise<unknown> | unknown;

interface HandlerOptions {
	method?: string; // For logging context
	validateBody?: ZodSchema; // Optional Zod validation
}

function createHandler(fn: HandlerFn, options?: HandlerOptions): RequestHandler {
	return async (event) => {
		try {
			const result = await fn(event);
			return json(result);
		} catch (err) {
			const message = errMsg(err);
			logger.error(`[${options?.method ?? event.url.pathname}] ${message}`);
			return json({ error: 'Internal server error' }, { status: 500 });
		}
	};
}
```

**Key design decisions**:

1. Returns SvelteKit `RequestHandler` — zero type friction
2. Business logic function returns data (not Response) — factory wraps in `json()`
3. Handlers that need custom Response (streaming, non-JSON) bypass factory
4. Error response uses `{ error: string }` shape (most common existing pattern)
5. Optional Zod body validation built in

## R6: Error Response Shapes — Audit

Current shapes found in route handlers:

1. **`json({ error: string }, { status })`** — 20+ routes (most common)
2. **`error(status, message)`** — SvelteKit throw helper (signals, some others)
3. **`json({ success: boolean, error?: string })`** — a few routes
4. **`json({ success: true, id: ... })`** — success responses in some routes
5. **`logAndRespond(context, error, status, message)`** — 0 routes currently

Factory should standardize on shape 1 as default. Shape 3 can be opt-in.

## R7: Circular Dependencies — Resolution Strategy

| #   | Cycle                                                        | Strategy                                              |
| --- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 1   | `map-handlers.ts ↔ map-handlers-helpers.ts`                 | Move shared types to `map-handler-types.ts`           |
| 2   | `process-lifecycle.ts ↔ process-manager.ts`                 | Invert: lifecycle depends on manager (not vice versa) |
| 3   | `l3-decoder.ts ↔ l3-message-decoders.ts`                    | Move shared types to `l3-types.ts`                    |
| 4   | `gps-position-service.ts ↔ gps-response-builder.ts`         | Move shared types to `gps-types.ts`                   |
| 5   | `gsm-evil-control-helpers.ts ↔ gsm-evil-control-service.ts` | Move shared types to `gsm-evil-types.ts`              |
| 6   | `gsm-evil-control-service.ts ↔ gsm-evil-stop-helpers.ts`    | Same `gsm-evil-types.ts` resolves both                |
| 7   | `kismet-service-transform.ts ↔ kismet.service.ts`           | Move shared types to kismet types file                |
| 8   | `gsm-evil-page-logic.ts ↔ gsm-evil-scan-stream.ts`          | Extract shared interface                              |

## R8: Client-Side Library Compatibility

| Library                  | Version | Svelte 5.35.5                       | shadcn-svelte                           | Lunaris Theme                                   | Notes                                           |
| ------------------------ | ------- | ----------------------------------- | --------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `@tanstack/table-core`   | latest  | Via `createSvelteTable` from shadcn | YES — data-table helper                 | YES — renders through existing Table primitives | Framework-agnostic core                         |
| `virtua`                 | latest  | YES — Svelte 5 snippets             | N/A                                     | YES — headless, custom rendering                | ~3kB bundle                                     |
| `sveltekit-superforms`   | latest  | Legacy mode (runes in v3)           | YES — formsnap is shadcn form component | YES — headless                                  | Works with existing Zod schemas                 |
| `formsnap`               | latest  | YES via bits-ui                     | YES — IS the shadcn form component      | YES — headless                                  | 790 stars (exception: tightly coupled to stack) |
| `@tanstack/svelte-query` | 6.x     | YES (needs 5.25.0+, we have 5.35.5) | N/A                                     | N/A — data layer                                | `$derived.by(createQuery({...}))` pattern       |
| `svelte-sonner`          | 1.0.7   | YES                                 | N/A                                     | YES — CSS customizable                          | Already installed, zero imports                 |

## R9: Kismet Dual Store Architecture

**Current state**: One store at `src/lib/stores/tactical-map/kismet-store.ts` using Svelte writable. Additionally, `src/lib/stores/connection.ts` and `src/lib/stores/dashboard/dashboard-store.ts` reference Kismet data.

**Key finding**: Two distinct Kismet stores exist:

1. `src/lib/kismet/stores.ts` — WebSocket-fed, array-based devices, alerts, status, GPS. Used by `websocket.ts` and `websocket-handlers.ts`.
2. `src/lib/stores/tactical-map/kismet-store.ts` — Map-based devices, markers, affiliations, distributions. Used by tactical map components (DevicesPanel, OverviewPanel, DeviceTable, DeviceOverlay, ToolsNavigationView).

The "dual store" is confirmed: two independently managed stores for the same domain (Kismet devices). Unification should keep the tactical-map store as primary (richer state, more consumers) and feed it from WebSocket data. The `kismet/stores.ts` becomes a thin adapter or is absorbed.

## R10: Existing UI Component Inventory

**shadcn-svelte components** in `src/lib/components/ui/`:

- alert-dialog, badge, button, input, select, separator, switch, table

**Table component exists** but is basic — no sorting, filtering, or pagination. TanStack Table would add headless state management on top.

**svelte-sonner**: Installed (`1.0.7`) but zero imports anywhere in `src/`. Needs explicit `<Toaster />` component mount + `toast()` calls.

**No existing retry/timeout wrappers**: `withRetry`, `withTimeout` patterns are absent from the codebase. These are genuinely new abstractions.

## R11: safeJsonParse — Keep as Niche Utility (T013 Decision)

**Decision**: Keep `src/lib/server/security/safe-json.ts` as-is.
**Rationale**: 3 active consumers (gps-data-parser, gps-satellite-service, hardware-details-service) use it for raw-string → typed-data parsing at the service layer. This is a different use case from the route handler factory's Zod body validation (HTTP request → business logic). Not a duplication.
**Also**: `safeErrorResponse()` and `logAndRespond()` in `src/lib/server/security/error-response.ts` had zero consumers — file deleted (T012).
