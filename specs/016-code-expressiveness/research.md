# Research: Code Expressiveness Improvement

**Date**: 2026-02-23 (original) | 2026-02-24 (updated with live verification)
**Branch**: `016-code-expressiveness`
**Method**: Live codebase research via targeted grep/glob against HEAD `b8480ff`

---

## Prior Art — What's Already Shipped

The following utilities were implemented in earlier tasks on this branch and are confirmed working with tests:

| Utility                 | Location                                  | Tests                      | Status                         |
| ----------------------- | ----------------------------------------- | -------------------------- | ------------------------------ |
| `errMsg()`              | `src/lib/server/api/error-utils.ts:23`    | Via create-handler.test.ts | Done — shared, JSDoc'd         |
| `normalizeError()`      | `src/lib/server/api/error-utils.ts:45`    | Via retry/result tests     | Done                           |
| `execFileAsync()`       | `src/lib/server/exec.ts:34`               | —                          | Done — shared, JSDoc'd         |
| `safe()` / `safeSync()` | `src/lib/server/result.ts:28,43`          | —                          | Done — 3 consumers (gsm-evil)  |
| `withRetry()`           | `src/lib/server/retry.ts:106`             | retry.test.ts (9 tests)    | Done — 2 consumers (kismet)    |
| `withTimeout()`         | `src/lib/server/timeout.ts:58`            | timeout.test.ts            | Done — 0 consumers yet         |
| `createHandler()`       | `src/lib/server/api/create-handler.ts:69` | create-handler.test.ts     | Done — 6 of 66 routes migrated |
| `safeErrorResponse`     | deleted                                   | —                          | Removed (0 consumers)          |
| `svelte-sonner`         | `+layout.svelte`, 2 components            | —                          | Activated — 3 imports          |

**Key insight**: The spec was written before these were implemented. The plan must focus on **migration** (spreading existing utilities across the codebase) rather than creation.

---

## R1. Route Handler Factory — Migration Scope

**Decision**: Extend existing `createHandler()` factory; migrate remaining ~60 routes.

**Current state (14 consumers — 6 original + 8 from T007-T009)**:

- `src/routes/api/system/info/+server.ts`
- `src/routes/api/system/metrics/+server.ts`
- `src/routes/api/signals/+server.ts`
- `src/routes/api/hackrf/+server.ts`
- `src/routes/api/hackrf/emergency-stop/+server.ts`
- `src/routes/api/db/cleanup/+server.ts`

**Remaining: ~60 route files** use 3 patterns:

1. `json(result)` with manual try-catch (most common, ~30 routes)
2. `new Response(JSON.stringify(...))` with manual status codes (~10 routes)
3. Bare `json(service.method())` with no error handling (~15 routes)
4. Streaming/SSE responses that cannot use factory (~5 routes — exempt)

**Factory may need enhancement for**: POST handlers that parse `request.json()` before calling business logic. Current factory has `validateBody` but the body isn't passed to `fn` — handler must still call `request.json()` itself.

---

## R2. `delay()` Utility — Needs Creation

**Decision**: Create `src/lib/utils/delay.ts`

**Rationale**: 38 inline `new Promise(resolve => setTimeout(resolve, N))` patterns across 21 files. `retry.ts:58` has a private `sleep()` helper but it's not exported and lives in server-only code. A shared `delay()` belongs in `src/lib/utils/` since some consumers are client-side stores.

**Alternatives considered**:

- Export `sleep()` from retry.ts — rejected: wrong location (server-only), wrong name
- Use `Atomics.wait` — rejected: not available in browser context

---

## R3. Environment Variable Centralization

**Decision**: Expand `src/lib/server/env.ts` Zod schema from 4 vars to ~19 vars.

**Current schema** (only 4 vars):

```typescript
(NODE_ENV, DATABASE_PATH, KISMET_API_URL, ARGOS_API_KEY);
```

**Vars to add** (from 46 `process.env` accesses across 22 files):

- Kismet: `KISMET_HOST`, `KISMET_PORT`, `KISMET_API_KEY`, `KISMET_USER`, `KISMET_PASSWORD`
- AI: `ANTHROPIC_API_KEY`
- Cell towers: `OPENCELLID_API_KEY`
- Public URLs: `PUBLIC_KISMET_API_URL`, `PUBLIC_HACKRF_API_URL`
- Self: `ARGOS_API_URL`, `ARGOS_CORS_ORIGINS`, `HOSTNAME`
- TLS: `NODE_TLS_REJECT_UNAUTHORIZED`
- New services: `GSM_EVIL_URL`, `OPENWEBRX_URL`, `BETTERCAP_URL`
- Temp: `ARGOS_TEMP_DIR`

**Exemptions**: MCP servers (`src/lib/server/mcp/`) — standalone processes, cannot import SvelteKit modules. ~8 `process.env` accesses acceptable.

---

## R4. Hardcoded Paths & URLs

**Temp paths**: 17 `/tmp/` instances across 10 files → replace with `path.join(env.ARGOS_TEMP_DIR, 'filename')`

**Service URLs**: ~28 hardcoded localhost URLs → reference env-backed constants after R3 expansion

**Implementation order**: R3 (env expansion) must complete before this phase, since URL constants source from env vars.

---

## R5. `logError()` → `logger.error()` Migration

**Decision**: Standardize on `logger.error()`. Migrate 60 remaining `logError()` call sites across 22 files.

**Note**: Audit said 86. Live grep shows 60 — 26 already migrated by prior work on this branch.

**Heaviest files**: `sweep-cycle-init.ts` (6), `process-lifecycle.ts` (5), `signal-repository.ts` (5), `sweep-manager.ts` (4), `sweep-coordinator.ts` (4), `sweep-health-checker.ts` (4)

---

## R6. Unsafe Error Casts — 9 Remaining

**Live grep results** (down from audit's 14, +1 found in hooks):

- `(error as { stdout: string }).stdout` — `gsm-evil/activity/+server.ts:24`
- `(error as { message?: string }).message` — `kismet-control-service-extended.ts:278`
- `(error as { signal?: string }).signal` — `gsm-evil-stop-helpers.ts:74`
- `(validationError as Error).message` — `cell-towers/nearby/+server.ts:25`
- `(logError as Error).message` — `gsm-scan-helpers.ts:176`
- `(dbErr as Error).message` — `cell-tower-service.ts:211`
- `(validationError as Error).message` — `gsm-evil/tower-location/+server.ts:211`
- `(parseError as Error).message` — `streaming-inspector.ts:94`
- `(error as Error)` — `hooks.server.ts:248`

**Fix**: Use `errMsg()` for message extraction. For `.stdout` and `.signal`, write targeted type guards.

---

## R7. safeJsonParse — Keep (3 Consumers)

**Decision**: Keep `src/lib/server/security/safe-json.ts`. Optionally extend to WebSocket/SSE trust boundaries.

**Consumers**: `gps-data-parser.ts`, `gps-satellite-service.ts`, `hardware-details-service.ts`

**Rationale**: Unique value — Zod-validated JSON parsing at external API boundaries. Not duplicated by route handler factory (which validates HTTP request bodies).

---

## R8. Client-Side Libraries — Installation Status

| Library                | Installed? | Version | Current Imports                     |
| ---------------------- | ---------- | ------- | ----------------------------------- |
| svelte-sonner          | Yes        | 1.0.7   | 3 (layout, ToolsNav, TakAuthEnroll) |
| bits-ui                | Yes        | 2.15.5  | Yes — used by shadcn components     |
| @tanstack/table-core   | **No**     | —       | —                                   |
| virtua                 | **No**     | —       | —                                   |
| sveltekit-superforms   | **No**     | —       | —                                   |
| formsnap               | **No**     | —       | —                                   |
| @tanstack/svelte-query | **No**     | —       | —                                   |

**Svelte version**: 5.35.5 (SvelteKit 2.22.3) — compatible with all listed libraries.

**Existing UI components** (`src/lib/components/ui/`): table (8 files), button, input, badge, switch, select (11 files), separator, alert-dialog (12 files). No data-table helper, no form components, no virtual list.

---

## R9. Kismet Dual Store Architecture

**Two stores confirmed**:

1. `src/lib/stores/tactical-map/kismet-store.ts` — Svelte writable, Map-based devices, markers, affiliations, distributions. Primary consumer of tactical map UI.
2. `src/lib/stores/dashboard/agent-context-store.ts` — Contains Kismet device data for AI agent context. References raw Kismet shapes with 15+ `as` casts.

**Recommendation**: Unify data source, keep separate views. The tactical-map store becomes the canonical Kismet data store; agent-context-store derives from it rather than maintaining independent state.

---

## R10. Circular Dependencies

**Status**: `madge` not installed. Manual import tracing needed.

**Known cycles** (8 from spec):

1. `process-lifecycle.ts ↔ process-manager.ts` (pre-existing)
   2-7. Helper extraction cycles from complexity reduction work
2. One new cycle

**Resolution strategy**: Extract shared types to dedicated `*-types.ts` modules. For the process-lifecycle cycle, invert dependency direction (lifecycle depends on manager, not vice versa).

---

## R11. Dead Exports

**Status**: Requires systematic `ts-prune` or manual grep analysis. 25+ symbols per spec.

**Known dead**: `safeErrorResponse` (already removed). Remaining need identification during task planning.

---

## R12. Oversized Files (>300 LOC)

**14 actionable files** (5 MCP server tool files exempt):

- `base.ts` (394) — split reconnect/message/heartbeat
- `gsm-evil-store.ts` (380) — split state/actions/computed
- `gsm-evil-health-service.ts` (370) — split health checks/status parsing
- `terminal-store.ts` (347) — split terminal state/WebSocket
- `dashboard-map-logic.svelte.ts` (335) — split init/markers
- `TakConfigView.svelte` (329) — extract sub-components
- `error-tracker.ts` (321) — split tracking/analysis
- `gsm-scan-frequency-analysis.ts` (313) — split analysis/reporting
- `gsm-scan-capture.ts` (313) — split capture/processing
- `sweep-manager.ts` (313) — split coordination/config
- `tak-service.ts` (312) — split connection/operations
- `kismet-control-service-extended.ts` (306) — split control/status
- `DashboardMap.svelte` (300) — borderline, extract logic

---

## R13. Magic Numbers

**Confirmed duplicates**:

- `6371000` (Earth radius) — `GEO.EARTH_RADIUS_M` exists in `constants/limits.ts:21`, but 4 files use raw number
- `111320` (meters/degree lat) — constant in `geo.ts:13` (unexported), `map-helpers.ts:46-47` uses raw number
- Haversine: 6 implementations, canonical `calculateDistance()` in `geo.ts:19`
- MAC-to-angle: 3 algorithms (DJB2-ish in `map-helpers.ts:9`, FNV-1a in `kismet.service.ts:120` and `kismet/devices/+server.ts:36`)

---

## R14. `process.env.USER || 'kali'` Fallback

**Location**: `kismet-control-service-extended.ts:76` (and line 183 in status string)

**Fix**: Replace with `os.userInfo().username` — platform-independent, no hardcoded fallback.
