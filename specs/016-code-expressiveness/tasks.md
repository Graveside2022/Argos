# Tasks: Code Expressiveness Improvement

**Feature Branch**: `016-code-expressiveness`
**Created**: 2026-02-23 | **Regenerated**: 2026-02-24 (V4 — all 32 audit findings now have tasks)
**Source**: plan.md (5 phases), spec.md (12 user stories, 33 FRs, 29 SCs), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Existing tests must continue to pass (FR-013). New shared utilities already have tests (prior art). No new test tasks generated.

**Phase Mapping** (plan.md → tasks.md → spec parts):

| Plan Phase | Task Phases | Spec Part |
|-----------|-------------|-----------|
| Phase 1 (Operational Hardening) | 11, 12, 13, 14 | Part C |
| Phase 2 (Route Migration) | 3, 4, 5 (done) | Part A |
| Phase 3 (Client Libraries) | 8 | Part B |
| Phase 4 (Structural Cleanup) | 7, 9, 15, 16 | Part A+C |
| Phase 5 (Verification) | 17 | All |

**Prior Art**: US3 (`safe()`), US6 (`withRetry()`, `withTimeout()`), and significant portions of US1/US2/US4/US5/US7 are already complete on this branch. Completed tasks are marked `[x]`. Remaining work focuses on Part C operational hardening, Part B client-side tooling, remaining route migration, and file decomposition.

**Live Verification** (all counts verified via grep against HEAD):

| Metric | Research Count | Verified Count | Delta |
|--------|----------------|----------------|-------|
| `createHandler()` consumers | 6 routes | 14 routes | +8 (prior work) |
| `process.env` (non-MCP) | 46 accesses | 33 accesses | -13 (prior work) |
| `logError()` calls | 60 | 60 | Match |
| Inline delay patterns | 38 | 38 | Match |
| `/tmp/` hardcoded | 17 | 17 | Match |
| `localhost:NNNN` hardcoded (non-MCP, non-test) | ~28 | 14 | -14 (prior work) |
| `6371000` magic number | 5 | 5 | Match |
| `111320` magic number | 3 | 3 | Match |
| Unsafe error casts | 8 | 7 | -1 (live grep 2026-02-24) |
| Local `errMsg` in routes | 19 | 1 | -18 (prior work) |
| Total route files | 66 | 66 | Match |
| Routes NOT using factory | ~60 | ~60 | 6 use factory (not 14 — see F2) |

## Task Summary

| Phase | Description | Tasks | Done | Remaining | Parallel |
|-------|-------------|-------|------|-----------|----------|
| 1 | Setup | 1 | 1 | 0 | No |
| 2 | Foundational (shared utilities) | 4 | 4 | 0 | Yes |
| 3 | US1 — Route Handler Factory (P1) | 4 | 4 | 0 | Partial |
| 4 | US2 — DRY Consolidation (P1) | 4 | 4 | 0 | Yes |
| 5 | US7 — Consistent Error Responses (P1) | 1 | 1 | 0 | No |
| 6 | US3 — Result Types (P2) | 1 | 1 | 0 | Yes |
| 7 | US4 — Dead Export Cleanup (P2) | 1 | 1 | 0 | Yes |
| 8 | US8 — Client-Side Libraries (P2) | 10 | 10 | 0 | Partial |
| 9 | US5 — Circular Dependency Resolution (P3) | 3 | 3 | 0 | Yes |
| 10 | US6 — Higher-Order Wrappers (P3) | 3 | 3 | 0 | Partial |
| 11 | **US9 — Env Centralization (P1) [NEW]** | 3 | 3 | 0 | Partial |
| 12 | **US10 — Hardcoded Paths/URLs (P1) [NEW]** | 2 | 2 | 0 | No |
| 13 | **US11 — DRY Violations (P1) [NEW]** | 11 | 11 | 0 | Partial |
| 14 | **US11 — Logging & Cleanup [NEW]** | 3 | 3 | 0 | Partial |
| 15 | **US12 — Oversized File Decomposition (P2) [NEW]** | 13 | 13 | 0 | Yes |
| 16 | **Cross-cutting — Type Safety [NEW]** | 5 | 5 | 0 | Partial |
| 17 | Final Verification & Metrics | 7 | 7 | 0 | No |
| 18 | **US1 — Route Migration at Scale [NEW — F2/F5/F7]** | 10 | 10 | 0 | Partial |
| **Total** | | **86** | **86** | **0** | |

---

## Phase 1: Setup

- [x] T001 Verify project builds cleanly and record baseline metrics (`npm run build`, `cloc`, `npx madge --circular src/`) in `specs/016-code-expressiveness/baseline-metrics.txt`

---

## Phase 2: Foundational (blocking prerequisites for all user stories)

These utilities are consumed by multiple user stories and MUST be completed before any story phase begins.

- [x] T002 [P] Create shared `errMsg()` utility in `src/lib/server/api/error-utils.ts` — handles Error instances, strings, objects with message property, and unknown types. Add JSDoc. Add unit tests in `src/lib/server/api/error-utils.test.ts`
- [x] T003 [P] Create shared `execFileAsync()` utility in `src/lib/server/exec.ts` — wraps `promisify(execFile)` with optional `maxBuffer`, `timeout`, `cwd`, `env` overrides. Add JSDoc. Add unit tests in `src/lib/server/exec.test.ts`
- [x] T004 [P] Create unified API response types in `src/lib/server/api/api-response.ts` — `ApiErrorResponse` (`{ success: false, error: string }`) and `ApiSuccessResponse<T>` (`{ success: true, ... }`) types per spec FR-014 and `contracts/api-error-response.ts`. Add JSDoc. Type-only file, no runtime code.
- [x] T005 [P] Create `safe()` result tuple utility in `src/lib/server/result.ts` — returns `[T, null] | [null, Error]`, normalizes non-Error thrown values. Add JSDoc. Add unit tests in `src/lib/server/result.test.ts`

---

## Phase 3: US1 — Route Handler Factory (P1)

**Story goal**: A developer writes only business logic for a new API route. The factory handles try-catch, error extraction, logging, JSON wrapping, and optional Zod body validation.

**Independent test**: Create one new route using factory, verify success/error/validation paths. Migrate 3 existing routes and confirm identical behavior.

- [x] T006 [US1] Create `createHandler()` factory in `src/lib/server/api/create-handler.ts` per `contracts/route-handler-factory.ts` — wraps `HandlerFn` returning `HandlerResult` with try-catch, `errMsg()`, `logger.error()`, `json()` response. Ensure return type satisfies SvelteKit `RequestHandler` (FR-004/FR-005). Add JSDoc. Add unit tests in `src/lib/server/api/create-handler.test.ts`
- [x] T007 [US1] Migrate 3 pilot routes to factory: `src/routes/api/signals/+server.ts`, `src/routes/api/system/info/+server.ts`, `src/routes/api/db/cleanup/+server.ts` — verify identical behavior with existing tests
- [x] T008 [US1] Pilot migration (batch 1 — system, hackrf domains): Migrated `system/info`, `system/metrics`, `hackrf/root`, `hackrf/emergency-stop` to `createHandler()`. 6 routes total use factory as of HEAD `b8480ff`. **Note: original scope was broader but only pilot routes were completed.**
- [x] T009 [US1] Pilot migration (batch 2 — signals, db): Migrated `signals/root`, `db/cleanup` to `createHandler()`. Remaining ~52 routes deferred to Phase 18 (T068-T077).

---

## Phase 4: US2 — DRY Consolidation (P1)

**Story goal**: Zero local copies of `errMsg()` or `execFileAsync` remain. Abandoned abstractions are absorbed or removed.

**Independent test**: `grep -r "function errMsg" src/` returns only the shared module. `grep -r "promisify(execFile)" src/` returns only the shared module.

- [x] T010 [P] [US2] Replace all 19 local `errMsg()` definitions with import from `src/lib/server/api/error-utils.ts`
- [x] T011 [P] [US2] Replace all 36 local `execFileAsync`/`promisify(execFile)` declarations with import from `src/lib/server/exec.ts`
- [x] T012 [US2] Absorb `safeErrorResponse()` and `logAndRespond()` into factory pattern. Remove `src/lib/server/security/error-response.ts` if fully superseded (0 external consumers confirmed)
- [x] T013 [US2] Evaluate `safeJsonParse()` in `src/lib/server/security/safe-json.ts` (3 consumers: `gps-data-parser.ts`, `gps-satellite-service.ts`, `hardware-details-service.ts`) — keep as niche Zod-validated JSON parsing utility per research.md R7

---

## Phase 5: US7 — Consistent Error Responses (P1)

**Story goal**: Zero unsafe `(error as Error)` casts remain. All error handling routes through type-safe utilities.

**Independent test**: `grep -rn "(error as Error)\|(err as Error)" src/` returns zero results.

- [x] T014 [US7] Eliminate all 39 `(error as Error)` / `(err as Error)` casts across 23 files — replace with `errMsg()` calls or route through factory

---

## Phase 6: US3 — Result Types (P2)

**Story goal**: `safe()` utility is available and demonstrated in at least 3 converted call sites.

**Independent test**: Write `safe()` utility with unit tests, convert 3 existing try-catch sites.

- [x] T015 [P] [US3] Convert 3 existing try-catch sites to use `safe()` from `src/lib/server/result.ts` — choose sites within services (not route handlers) where conditional error handling adds value

---

## Phase 7: US4 — Dead Export Cleanup (P2)

**Story goal**: Zero exported-but-unused symbols remain.

**Independent test**: Run dead export analysis tool, confirm zero unused exports.

- [x] T016 [P] [US4] Run dead export analysis on codebase (ts-prune or grep-based), identify all exported-but-unused symbols, remove `export` keyword or delete unused functions. Verify with `npm run build`. Document removed exports in `specs/016-code-expressiveness/removed-exports.md`

---

## Phase 8: US8 — Client-Side Libraries (P2)

**Story goal**: Toast notifications active, one data table with sorting, one virtual list, one validated form — all rendering with Lunaris styling.

**Independent test**: Each library has one working implementation visible in the app with correct Lunaris dark theme styling.

### Sub-phase 8a: Activate svelte-sonner (lowest risk)

- [x] T017 [US8] Add `<Toaster />` component to `src/routes/+layout.svelte`. Add `toast()` calls to 2-3 existing API success/error handlers as proof of pattern. Verify Lunaris dark theme compatibility.

### Sub-phase 8b: Data Tables — SKIPPED (architecture review)

- [x] T018 [US8] ~~Install `@tanstack/table-core`~~ **SKIPPED**: Architecture review determined existing `device-filters.ts` (103 LOC of clean pure functions with typed `SORT_EXTRACTORS` map) is the correct abstraction. Adding a headless table state machine would create two table paradigms with no measurable benefit. Pagination solved by render cap in T087. See `specs/016-code-expressiveness/verification.md` for rationale.
- [x] T019 [US8] ~~Build production data table~~ **SKIPPED**: Depends on T018. Existing DeviceTable.svelte + device-filters.ts already provide sorting, filtering, and Lunaris styling. Pagination addressed by render cap T087.

### Sub-phase 8c: Virtual Scrolling — SKIPPED (structural mismatch)

- [x] T020 [P] [US8] ~~Install `virtua`~~ **SKIPPED**: Architecture review found hard structural mismatch — VList renders items as absolutely-positioned divs, but DeviceTable uses `<table>/<tbody>/<tr>` layout. Virtua cannot virtualize `<tr>` elements inside a `<table>` without a full component rewrite (abandon `<table>`, reimplement sticky headers, reimplement column alignment). Real-world device counts (40-400 after filters) do not justify this. Render cap T087 provides safety net.
- [x] T021 [US8] ~~Apply virtual scrolling~~ **SKIPPED**: Depends on T020. Render cap T087 addresses the DOM pressure concern.

### Sub-phase 8d: Form Validation — REPLACED (simpler utility)

- [x] T022 [US8] ~~Install `sveltekit-superforms` and `formsnap`~~ **REPLACED by T088**: Architecture review found superforms is designed for SvelteKit form actions (`+page.server.ts`), but Argos forms submit via `fetch()` to API routes. Architectural mismatch. Replaced with a 20-line `validateForm<T>()` Zod utility that fits the existing pattern. Zero new packages.

### Sub-phase 8e: Remaining Items

- [x] T023 [US8] ~~Install `@tanstack/svelte-query` v6~~ **SKIPPED**: Violates CLAUDE.md ("No state management libraries"). WebSocket-first architecture has no stale-data problem. `fetchJSON<T>()` (T078) is the correct abstraction for REST endpoints.
- [x] T024 [US8] Fix agent-context-store type safety — replace `buildDeviceDetails(device as Record<string, unknown>, $mac)` cast at line 166 with a typed function that uses `KismetDevice` interface fields directly. Eliminates 15+ unsafe `as` casts in helper functions (`devStr`, `devField`, `readSignal`, `resolveManuf`, `resolveSsid`, `resolveEncryption`). The raw Kismet field fallbacks (`kismet.device.base.channel`, `dot11.device.*`) are dead code — the Kismet WebSocket handler already normalizes these into typed `KismetDevice` fields upstream. SC-018.

### Sub-phase 8g: Render Cap & Form Validation Utility [NEW — architecture review replacements]

- [x] T087 [US8] Add device render cap to `src/lib/components/dashboard/panels/DevicesPanel.svelte` — limit `devices` to top 200 by current sort with `devices.slice(0, RENDER_CAP)`. Add "Showing N of M devices" badge to `DeviceToolbar.svelte` when cap is exceeded. Provides DOM pressure safety net without requiring virtual scrolling library. Zero packages.
- [x] T088 [US8] Create `src/lib/utils/validate-form.ts` — typed `validateForm<T>(schema: ZodSchema<T>, data: unknown)` utility that returns `{ data: T | null, errors: Record<string, string>, isValid: boolean }` using `schema.safeParse()` and Zod issue path mapping. Apply to one form (`TakConfigView.svelte` `handleSave()`) as pattern reference. Zero packages — uses existing Zod dependency.

### Sub-phase 8f: Client-Side Fetch Wrapper (B1 — P0)

- [x] T078 [P] [US8] Create `src/lib/utils/fetch-json.ts` with typed `fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null>` wrapper that handles try-catch, `response.ok` check, JSON parsing, and returns `null` on failure with `console.error()` logging. FR-034.
- [x] T079 [US8] Migrate ~37 client-side fetch try/catch/return-null patterns across 19 files to use `fetchJSON<T>()`. Heaviest files: `status-bar-data.ts` (5), `gsm-evil-page-logic.ts` (5), `tak-config-logic.ts` (4), `OverviewPanel.svelte` (3), `GsmEvilPanel.svelte` (3). SC-030.

---

## Phase 9: US5 — Circular Dependency Resolution (P3)

**Story goal**: `madge --circular src/` reports zero cycles.

**Independent test**: Run `npx madge --circular src/` and confirm zero output.

- [x] T025a [P] [US5] Resolve circular dependency cycles 1-3 (dashboard + hackrf + gsm-server):
  - `map-handlers.ts <-> map-handlers-helpers.ts` -> shared `map-handler-types.ts`
  - `process-lifecycle.ts <-> process-manager.ts` -> invert dependency direction
  - `l3-decoder.ts <-> l3-message-decoders.ts` -> shared `l3-types.ts`
  Verify with `npx madge --circular src/` (expect 5 remaining)
- [x] T025b [P] [US5] Resolve circular dependency cycles 4-6 (gps + gsm-evil services):
  - `gps-position-service.ts <-> gps-response-builder.ts` -> shared `gps-types.ts`
  - `gsm-evil-control-helpers.ts <-> gsm-evil-control-service.ts` -> shared `gsm-evil-types.ts`
  - `gsm-evil-control-service.ts <-> gsm-evil-stop-helpers.ts` -> same `gsm-evil-types.ts`
  Verify with `npx madge --circular src/` (expect 2 remaining)
- [x] T025c [P] [US5] Resolve circular dependency cycles 7-8 (kismet + gsm-evil page):
  - `kismet-service-transform.ts <-> kismet.service.ts` -> shared kismet types file
  - `gsm-evil-page-logic.ts <-> gsm-evil-scan-stream.ts` -> extract shared interface
  Verify with `npx madge --circular src/` (expect 0 remaining)

---

## Phase 10: US6 — Higher-Order Wrappers (P3)

**Story goal**: `withRetry()` and `withTimeout()` available as shared utilities. Existing ad-hoc patterns migrated.

**Independent test**: Unit tests for wrappers pass. 2-3 existing patterns converted.

- [x] T026 [P] [US6] Create `withRetry()` in `src/lib/server/retry.ts` — configurable `attempts`, `delayMs`, `backoff` (linear/exponential). Add JSDoc. Add unit tests in `src/lib/server/retry.test.ts`
- [x] T027 [P] [US6] Create `withTimeout()` in `src/lib/server/timeout.ts` — configurable `timeoutMs`. Add JSDoc. Add unit tests in `src/lib/server/timeout.test.ts`
- [x] T028 [US6] Identify and migrate 2-3 existing ad-hoc retry/timeout patterns in service files to use `withRetry()` / `withTimeout()` wrappers

---

## Phase 11: US9 — Environment Centralization (P1) [NEW — Part C]

**Story goal**: All environment variables validated and typed in a single module. Zero `process.env` in non-MCP files.

**Independent test**: `grep -r 'process\.env\.' src/ --include='*.ts' | grep -v mcp/` returns empty.

**FR**: FR-023 | **SC**: SC-019

- [x] T031 [US9] Expand Zod schema in `src/lib/server/env.ts` from 4 to ~19 env vars per `contracts/env-schema.ts` — add Kismet auth (KISMET_HOST, KISMET_PORT, KISMET_API_KEY, KISMET_USER, KISMET_PASSWORD), API keys (ANTHROPIC_API_KEY, OPENCELLID_API_KEY), public URLs (PUBLIC_KISMET_API_URL, PUBLIC_HACKRF_API_URL), self/CORS (ARGOS_API_URL, ARGOS_CORS_ORIGINS), service URLs (GSM_EVIL_URL, OPENWEBRX_URL, BETTERCAP_URL), temp dir (ARGOS_TEMP_DIR). All new vars MUST have sensible defaults so existing deployments don't break. Update `.env.example` with new vars and comments.
- [x] T032 [US9] Migrate 33 `process.env` accesses across non-MCP files to typed `env` import from `$lib/server/env`. Target files (verified via `grep -r 'process\.env\.' src/ --include='*.ts' | grep -v mcp/`). MCP server files (`src/lib/server/mcp/`) are exempt — they are standalone processes that cannot import SvelteKit modules.
- [x] T033 [P] [US9] Add `ARGOS_TEMP_DIR` runtime resolution in `src/lib/server/env.ts` — default to `path.join(os.tmpdir(), 'argos')`, create directory on startup with `mkdirSync({ recursive: true })`.

**Checkpoint**: `npm run build` succeeds. `grep -r 'process\.env\.' src/ --include='*.ts' | grep -v mcp/` returns empty.

---

## Phase 12: US10 — Hardcoded Paths & URLs (P1) [NEW — Part C]

**Story goal**: All file paths and service URLs configurable through env vars. Zero hardcoded `/tmp/` or `localhost:NNNN`.

**Independent test**: `grep -r '/tmp/' src/ --include='*.ts'` returns empty. `grep -rn 'localhost:[0-9]' src/ --include='*.ts' | grep -v mcp/ | grep -v test` returns empty.

**FR**: FR-024, FR-025 | **SC**: SC-020, SC-021

**Depends on**: Phase 11 (T031 — env schema expansion must complete first, since URL/path constants source from env vars).

- [x] T034 [US10] Replace 17 hardcoded `/tmp/` paths across service files with `path.join(env.ARGOS_TEMP_DIR, 'filename')`. Targets found via `grep -rn '/tmp/' src/ --include='*.ts'`.
- [x] T035 [US10] Replace 14 hardcoded `localhost:NNNN` service URLs across non-MCP/non-test files with env-backed constants from the expanded `env.ts`. Reference `env.GSM_EVIL_URL`, `env.OPENWEBRX_URL`, `env.BETTERCAP_URL`, `env.KISMET_API_URL`, etc. Targets found via `grep -rn 'localhost:[0-9]' src/ --include='*.ts' | grep -v mcp/ | grep -v test`.

**Checkpoint**: Zero `/tmp/` literals. Zero hardcoded `localhost:NNNN` in non-MCP/non-test source. `npm run build` succeeds.

---

## Phase 13: US11 — DRY Violations (P1) [NEW — Part C]

**Story goal**: Common patterns extracted into shared utilities — `delay()`, consolidated haversine, unified MAC-to-angle, named constants.

**Independent test**:
- `grep -rn 'new Promise.*setTimeout' src/ --include='*.ts'` finds only `delay.ts` and `retry.ts`
- `grep -rn '6371000' src/ --include='*.ts'` finds only `constants/limits.ts`
- `grep -rn 'hashMAC\|macToAngle' src/ --include='*.ts'` finds only one canonical file

**FR**: FR-026, FR-027, FR-028, FR-029 | **SC**: SC-022, SC-023, SC-024, SC-025

- [x] T036 [P] [US11] Create `src/lib/utils/delay.ts` with `export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))`. Placed in `utils/` (not `server/`) because some consumers are client-side stores. FR-026.
- [x] T037 [US11] Migrate 38 inline `new Promise(resolve => setTimeout(resolve, N))` patterns across source files to use `import { delay } from '$lib/utils/delay'`. Heaviest in: services/, stores/, routes/api/. SC-022.
- [x] T038 [P] [US11] Export `GEO` constant object from `src/lib/constants/limits.ts` with `EARTH_RADIUS_M` (6371000) and `METERS_PER_DEGREE_LAT` (111320). Replace 4 hardcoded `6371000` instances in `kismet/devices/+server.ts:83`, `kismet.service.ts:155`, `status-bar-data.ts:95`, `map-helpers.ts:105` and 2 hardcoded `111320` in `map-helpers.ts:46-47` with `GEO.EARTH_RADIUS_M` / `GEO.METERS_PER_DEGREE_LAT`. Keep the canonical definition in `geo.ts:13` but have it import from `limits.ts`. FR-029, SC-025.
- [x] T039 [US11] Consolidate 5 haversine implementations to use canonical `calculateDistance()` from `src/lib/server/db/geo.ts:19`. Remove duplicates in: `status-bar-data.ts:94` (`haversineMeters`), `map-helpers.ts:105` (inline), `map-helpers.ts:174` (`haversineKm`), `kismet.service.ts:149` (approximation). Verify `map-handlers.ts:230` (`haversineKm` consumer) is updated. FR-027, SC-023.
- [x] T040 [US11] Unify 3 MAC-to-angle hash algorithms into 1 canonical implementation. Currently: DJB2-ish in `src/lib/components/dashboard/map/map-helpers.ts:9` (`macToAngle`), FNV-1a in `src/lib/server/services/kismet.service.ts:120` (`hashMAC`), and copied FNV-1a in `src/routes/api/kismet/devices/+server.ts:36` (`hashMAC`). All 3 sites also have `hashMAC2` for distance jitter. Consolidate into one canonical module. This is a **correctness bug** — same MAC produces different angles depending on code path. FR-028, SC-024.
- [x] T041 [P] [US11] Replace `process.env.USER || 'kali'` fallback in `src/lib/server/services/kismet/kismet-control-service-extended.ts:76` and `:183` with `os.userInfo().username`. FR-033, SC-029.
- [x] T080 [P] [US11] Extract FNV-1a MAC hash functions (`hashMAC`, `hashMAC2`, `signalToDistance`, `offsetGps`, `computeFallbackLocation`) from `kismet.service.ts` and `kismet/devices/+server.ts` into a shared `src/lib/server/services/kismet/kismet-geo-helpers.ts` module. Both files import from the shared module. ~80 LOC saved. FR-044, audit finding B2.
- [x] T081 [P] [US11] Consolidate 3 GPS coordinate validation implementations (`hasValidLocation`, `extractGpsCoords`, threshold check) into canonical function in `src/lib/server/db/geo.ts`. FR-041, audit finding B10.
- [x] T082 [P] [US11] Migrate remaining ad-hoc retry patterns in Kismet service manager (`kismet-control-service-extended.ts`) to use `withRetry()`. FR-042, audit finding B11.
- [x] T083 [P] [US11] Replace switch/case chain in `src/lib/server/services/gsm-evil/l3-message-decoders.ts` with lookup table (Record<number, DecoderFn>) pattern. FR-043, audit finding B12.
- [x] T084 [P] [US11] Make `/var/run/gpsd.sock` path configurable via `GPSD_SOCKET_PATH` env var in `src/lib/server/hardware/serial-detector.ts:83`. Add to env.ts schema with default `/var/run/gpsd.sock`. FR-040, audit finding A6.

**Checkpoint**: `npm run build` succeeds. `npm run test:unit` passes. Zero inline delay patterns (except `retry.ts` private `sleep()`). Zero magic number literals outside constants module. One canonical haversine. One canonical MAC-to-angle. Zero `'kali'` fallback.

---

## Phase 14: US11 — Logging & Cleanup [NEW — Part C]

**Purpose**: Standardize error logging API. Add missing cleanup methods. Fix remaining unsafe error casts.

**FR**: FR-030, FR-032 | **SC**: SC-026, SC-028

- [x] T042 [US11] Migrate 60 `logError()` call sites across 22 files to `logger.error()`. Pattern: `logError('msg', error)` -> `logger.error('msg', { error: errMsg(error) })`. Each migrated file MUST add `import { errMsg } from '$lib/server/api/error-utils'` if not already present. After migration, remove `logError` export from `logger.ts` to prevent reintroduction. Heaviest files: `sweep-cycle-init.ts` (6), `process-lifecycle.ts` (5), `signal-repository.ts` (5), `sweep-manager.ts` (4), `sweep-coordinator.ts` (4), `sweep-health-checker.ts` (4). FR-032, SC-028.
- [x] T043 [P] [US11] Add `dispose()` or cleanup methods to server-side `setInterval` instances lacking cleanup. Verified targets: `src/lib/server/hardware/resource-manager.ts:19` (no clearInterval), `src/lib/server/services/gsm-evil/gsm-monitor-service.ts:27` (no clearInterval), `src/lib/server/middleware/rate-limit-middleware.ts:20` (globalThis, no cleanup), `src/lib/utils/logger.ts:74` (no cleanup). FR-030, SC-026.
- [x] T044 [P] Fix 7 remaining unsafe `(error as ...)` casts using `errMsg()` + targeted type guards. Verified locations (live grep `b8480ff`): `hooks.server.ts:248`, `kismet-control-service-extended.ts:278`, `gsm-evil-stop-helpers.ts:74`, `sweep-coordinator.ts:117+267`, `sweep-cycle-init.ts:197`, `gsm-evil/activity/+server.ts:24`. For `.stdout` and `.signal` property accesses, use `typeof (error as Record<string, unknown>).stdout === 'string'` guards. FR-015, SC-011, audit finding B8.

**Checkpoint**: Zero `logError(` in source. All `setInterval` has matching cleanup path. Zero unsafe error casts. `npm run build` succeeds.

---

## Phase 15: US12 — Oversized File Decomposition (P2) [NEW — Part C]

**Story goal**: Zero non-exempt source files exceed 300 lines (MCP tool-definition files and test files exempt).

**Independent test**: `find src/ -name '*.ts' -o -name '*.svelte' | xargs wc -l | sort -rn | head -20` shows no non-exempt files > 300 lines.

**FR**: FR-031 | **SC**: SC-027

**Depends on**: Phases 11-14 (migration may change file sizes). All 13 tasks below are [P] — they can run in parallel since they touch completely independent files.

- [x] T045 [P] [US12] Decompose `src/lib/websocket/base.ts` (394→281 LOC) — extract reconnect logic, message handler, and heartbeat into separate modules in `src/lib/websocket/`.
- [x] T046 [P] [US12] Decompose `src/lib/stores/gsm-evil-store.ts` (380→233 LOC) — split into state, actions, and derived/computed modules in `src/lib/stores/`.
- [x] T047 [P] [US12] Decompose `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts` (370→138 LOC) — split into health checks and status parsing modules.
- [x] T048 [P] [US12] Decompose `src/lib/stores/dashboard/terminal-store.ts` (347→290 LOC) — split into terminal state and WebSocket communication modules.
- [x] T049 [P] [US12] Decompose `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` (335→260 LOC) — extract map-gps-derived.svelte.ts (GPS memoization & derived state).
- [x] T050 [P] [US12] Decompose `src/lib/components/dashboard/tak/TakConfigView.svelte` (329→219 LOC) — extract TakServerForm and TakAuthMethodPicker sub-components.
- [x] T051 [P] [US12] Decompose `src/lib/hackrf/sweep-manager/error-tracker.ts` (321→221 LOC) — extract error-recovery.ts (RecoveryManager class).
- [x] T052 [P] [US12] Decompose `src/lib/server/services/gsm-evil/gsm-scan-frequency-analysis.ts` (316→264 LOC) — extract gsm-grgsm-process.ts (spawn/verify/log helpers).
- [x] T053 [P] [US12] Decompose `src/lib/server/services/gsm-evil/gsm-scan-capture.ts` (313→169 LOC) — extract gsm-scan-events.ts (cell-identity event formatting).
- [x] T054 [P] [US12] Decompose `src/lib/server/hackrf/sweep-manager.ts` (313→300 LOC) — extract sweep-manager-lifecycle.ts (startup validation, event emission).
- [x] T055 [P] [US12] Decompose `src/lib/server/tak/tak-service.ts` (312→298 LOC) — extract tak-broadcast.ts (WebSocket broadcast helpers).
- [x] T056 [P] [US12] Decompose `src/lib/server/services/kismet/kismet-control-service-extended.ts` (308→241 LOC) — extract kismet-status-checker.ts (process detection, WiFi adapter discovery, API health).
- [x] T057 [US12] Evaluate `src/lib/components/dashboard/DashboardMap.svelte` (300 LOC) — at exactly 300 (within limit), purely declarative MapLibre markup. No clean split exists. No changes needed.

**Checkpoint**: Zero non-exempt files > 300 LOC. All imports updated across consumers. `npm run build` succeeds. All tests pass.

---

## Phase 16: Cross-cutting — Type Safety [NEW]

**Purpose**: Address audit findings C2, C3, D1 that span multiple user stories.

- [x] T058 [P] Declare `globalThis` types in `src/app.d.ts` for all `globalThis['__argos_*']` singleton augmentations (C2 fix from audit). Reference existing singletons: SweepManager, WebSocketManager, RateLimiter, RFDatabase. FR-036, SC-032.
- [x] T059 [P] Add runtime validation to unguarded `JSON.parse()` calls at trust boundaries (C3 fix from audit) — use `safeParseWithHandling` or `safeJsonParse` where external data enters the system (WebSocket messages, SSE events, GPS NMEA data). FR-037, SC-033.
- [x] T060 Fix swallowed errors in `src/lib/components/dashboard/panels/OverviewPanel.svelte` (D1 fix from audit) — ensure all error paths log via `console.error()` and surface user-visible feedback via toast or status indicator. FR-038, SC-034.
- [x] T085 [P] Define typed interfaces for all external API response shapes: `OpenCellIDCell` (for `cell-tower-service.ts`), `GpsdSatelliteEntry` (for `gps-satellite-service.ts` — extracted from Zod schema), `OpenMeteoCurrentWeather` (for `status-bar-data.ts`). Migrate unsafe `as string`/`as number` casts to use typed interfaces. FR-035, SC-031, audit findings C1/C4/C5.
- [x] T086 [P] Audit and resolve 3 `eslint-disable` directives: `hackrf/data-stream/+server.ts:110` (justified — Node.js EventEmitter constraint, comment updated), `symbol-factory.ts:56` (fixed — `MilStdRenderer` type derived from module), `validation-error.ts:47` (fixed — `(issue: ZodIssue)` with code-narrowing). `dynamic-server.ts:14` was already gone. FR-039, SC-035, audit finding D2.

**Checkpoint**: `npm run build` succeeds. No swallowed errors. Typed globals.

---

## Phase 18: Route Handler Migration at Scale (SC-004) [NEW — Analysis Finding F2/F5/F7]

**Story goal**: At least 50 of 66 route handler files use `createHandler()` factory (SC-004). Currently only 6 routes use it.

**Independent test**: `grep -r 'createHandler(' src/routes/ --include='*.ts' -l | wc -l` returns 50+.

**FR**: FR-003, FR-014 | **SC**: SC-004, SC-012

**Depends on**: Phase 11 (env constants must exist before routes reference them). Independent of Phase 8/13/15.

**Note**: Streaming/SSE routes (~5) and WebSocket proxy routes are exempt from factory migration.

- [x] T068 [US1] Migrate system domain routes to factory (batch 1): `src/routes/api/system/stats/+server.ts`, `src/routes/api/system/memory/+server.ts`, `src/routes/api/system/services/+server.ts`, `src/routes/api/system/logs/+server.ts`, `src/routes/api/system/docker/[action]/+server.ts`. 5 files.
- [x] T069 [US1] Migrate hackrf + rf domain routes to factory (batch 2): `src/routes/api/hackrf/start/+server.ts`, `src/routes/api/hackrf/stop/+server.ts`, `src/routes/api/hackrf/status/+server.ts`, `src/routes/api/rf/+server.ts`, `src/routes/api/rf/[id]/+server.ts`. Exempt: `hackrf/data-stream` (streaming). 5 files.
- [x] T070 [US1] Migrate gsm-evil domain routes to factory (batch 3): `src/routes/api/gsm-evil/scan/+server.ts`, `src/routes/api/gsm-evil/status/+server.ts`, `src/routes/api/gsm-evil/control/+server.ts`, `src/routes/api/gsm-evil/frames/+server.ts`, `src/routes/api/gsm-evil/activity/+server.ts`. 5 files.
- [x] T071 [US1] Migrate gsm-evil domain routes to factory (batch 4): `src/routes/api/gsm-evil/imsi/+server.ts`, `src/routes/api/gsm-evil/imsi-data/+server.ts`, `src/routes/api/gsm-evil/intelligent-scan/+server.ts`, `src/routes/api/gsm-evil/tower-location/+server.ts`, `src/routes/api/gsm-evil/gsm-evil-status/+server.ts`. 5 files.
- [x] T072 [US1] Migrate kismet domain routes to factory (batch 5): `src/routes/api/kismet/devices/+server.ts`, `src/routes/api/kismet/status/+server.ts`, `src/routes/api/kismet/start/+server.ts`, `src/routes/api/kismet/stop/+server.ts`, `src/routes/api/kismet/control/+server.ts`. Exempt: `kismet/ws` (WebSocket proxy). 5 files.
- [x] T073 [US1] Migrate tak domain routes to factory (batch 6): `src/routes/api/tak/config/+server.ts`, `src/routes/api/tak/connection/+server.ts`, `src/routes/api/tak/certs/+server.ts`, `src/routes/api/tak/enroll/+server.ts`, `src/routes/api/tak/import/+server.ts`. 5 files.
- [x] T074 [US1] Migrate signals + rf remaining routes to factory (batch 7): `src/routes/api/signals/batch/+server.ts`, `src/routes/api/signals/statistics/+server.ts`, `src/routes/api/signals/cleanup/+server.ts`, `src/routes/api/rf/statistics/+server.ts`. 4 files.
- [x] T075 [US1] Migrate gps + cell-towers + weather routes to factory (batch 8): `src/routes/api/gps/position/+server.ts`, `src/routes/api/gps/location/+server.ts`, `src/routes/api/gps/satellites/+server.ts`, `src/routes/api/cell-towers/nearby/+server.ts`, `src/routes/api/weather/current/+server.ts`. 5 files.
- [x] T076 [US1] Migrate remaining misc routes to factory (batch 9): `src/routes/api/terminal/shells/+server.ts`, `src/routes/api/openwebrx/control/+server.ts`, `src/routes/api/map-tiles/[...path]/+server.ts`, `src/routes/api/agent/status/+server.ts`, `src/routes/api/database/query/+server.ts`. Exempt: `agent/stream` (streaming), `streaming/status` (SSE). 5 files.
- [x] T077 [US1] Migrate final routes + verify SC-004 (batch 10): `src/routes/api/database/schema/+server.ts`, `src/routes/api/database/health/+server.ts`, `src/routes/api/db/+server.ts`, `src/routes/api/hardware/scan/+server.ts`, `src/routes/api/hardware/status/+server.ts`, `src/routes/api/hardware/details/+server.ts`. Verify: `grep -r 'createHandler(' src/routes/ -l | wc -l` ≥ 50. 5 files.

**Checkpoint**: 50+ routes use `createHandler()`. Zero local `errMsg()` definitions. `npm run build` succeeds. All tests pass.

---

## Phase 17: Final Verification & Metrics

**Purpose**: Validate all 35 success criteria (SC-001 through SC-035). Record before/after metrics. Depends on ALL other phases.

- [x] T061 Run full test suite: `npm run test:unit`, `npm run test:integration`, `npm run test:security`. All must pass. (Use targeted tests on RPi if memory-constrained.) **Coverage gate**: Run `npx vitest run --coverage` on new shared utilities (`error-utils.ts`, `exec.ts`, `result.ts`, `retry.ts`, `timeout.ts`, `delay.ts`, `fetch-json.ts`) and verify ≥80% branch coverage per Constitution Article III.2.
- [x] T062 Run `npm run build` — verify zero new warnings.
- [x] T063 Measure LOC delta (target: -1,000 from Part A+C net). `cloc src/` or `find src/ -name '*.ts' -o -name '*.svelte' | xargs wc -l`.
- [x] T064 Verify each SC-001 through SC-035 with targeted grep/search. Document pass/fail for each criterion. **Includes FR-014 validation**: spot-check 10 migrated routes to confirm unified error response shape (`{ success: false, error: string }`) by sending invalid requests and inspecting response bodies.
- [x] T065 Run `npx madge --circular src/` — confirm 0 cycles remain.
- [x] T066 Run production build, measure bundle size delta. Compare to pre-branch baseline from T001.
- [x] T067 Document final metrics in verification report at `specs/016-code-expressiveness/verification.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Already Complete (Phases 1-7, 9-10):
  Setup → Foundational → US1 Factory → US2 DRY → US7 Errors
  US3 Result Types  |  US4 Dead Exports  |  US5 Circular Deps  |  US6 Wrappers
  US8a Sonner

Remaining work (Phases 8b-e, 11-18):

Phase 11 (US9 Env) ──→ Phase 12 (US10 Paths/URLs)
        │                           │
Phase 13 (US11 DRY) ──────────────┤
        │                           │
Phase 14 (US11 Logging) ──────────┤──→ Phase 15 (US12 Decompose)
        │                           │
Phase 11 (US9 Env) ──→ Phase 18 (Route Migration) ──┤
        │                                             │
Phase 8b-e (US8 Libs) ───────────────────────────────┤──→ Phase 17 (Verification)
        │                                             │
Phase 16 (Type Safety) ──────────────────────────────┘
```

### Remaining Story Completion Order

| Priority | Story | Phase | Can Start After | Deps |
|----------|-------|-------|-----------------|------|
| P1 | US9 (env centralization) | 11 | Immediately | None |
| P1 | US10 (hardcoded paths/URLs) | 12 | T031 (env schema) | US9 partial |
| P1 | US11 (DRY violations) | 13, 14 | Immediately | None |
| P1 | US1 (route migration at scale) | 18 | Phase 11 (env) | US9 |
| P2 | US8 (client libraries) | 8b-e | Immediately | None (independent layer) |
| P2 | US12 (oversized files) | 15 | Phases 11-14, 18 | Migration changes file sizes |
| — | Type safety fixes | 16 | Immediately | None |

### Within Each Phase

- Tasks marked [P] can run in parallel (different files, no shared state)
- Non-[P] tasks must run sequentially within their sub-phase
- Verify `npm run build` after each batch of parallel tasks

### Parallel Opportunities

**Part C creation tasks (independent files, run first)**:
```
T033 (ARGOS_TEMP_DIR) ──┐
T036 (delay.ts)         ┤── all different files, no deps
T038 (GEO constants)    ┤
T041 (kali user)        ┤
T043 (dispose methods)  ┤
T044 (error casts)      ┤
T058 (globalThis types) ┤
T059 (JSON validation)  ┤
T078 (fetchJSON)        ┤
T080 (MAC hash extract) ┤
T085 (API interfaces)   ┤
T086 (eslint-disable)   ┘
```

**Phase 8 library setup (independent component families)**:
```
T018 (data-table) ──→ T019 (data-table apply)
T020 (virtua)     ──→ T021 (virtua apply)
T022 (superforms) ── independent
T023 (svelte-query) ── independent

T018 ┐
T020 ┤── can run in parallel (different component families)
T022 ┤
T023 ┘
```

**Phase 15 decomposition (13 independent files)**:
```
T045 through T056 — ALL can run in parallel (different files, no shared state)
T057 — sequential (depends on evaluating borderline case)
```

---

## Parallel Execution Plan (2 Agents)

### Wave 1 — Part C Foundation
```
Agent A: T031 (env schema) → T032 (process.env migration) → T034 (/tmp/ paths) → T035 (localhost URLs)
Agent B: T036 (delay.ts) → T037 (delay migration) → T038 (GEO) → T039 (haversine) → T040 (MAC-to-angle) → T041 (kali)
```

### Wave 2 — Logging + Client Libraries
```
Agent A: T042 (logError migration) → T044 (error casts) → T043 (dispose)
Agent B: T018 (data-table) → T019 (data-table apply) → T020 (virtua) → T021 (virtua apply)
```

### Wave 3 — Decomposition + Forms
```
Agent A: T045-T051 (decompose files batch 1 — 7 files)
Agent B: T022 (superforms) → T023 (svelte-query) → T024 (Kismet store) → T052-T057 (decompose batch 2 — 6 files)
```

### Wave 4 — Cleanup + Verification
```
Agent A: T058-T060 (type safety fixes)
Agent B: T061-T067 (final verification)
```

---

## Implementation Strategy

### MVP First (Recommended — Phase 11 + 13)

1. **Phase 11**: Env centralization (T031-T033) — operational foundation
2. **Phase 13**: DRY violations (T036-T041) — includes correctness bug fix (MAC-to-angle)
3. **STOP and VALIDATE**: `npm run build`, `npm run test:unit`, grep checks
4. This alone delivers US9, US11 — the highest operational value with zero behavioral changes

### Incremental Delivery After MVP

1. Phases 11, 13 → Operational foundation + DRY (US9, US11)
2. Phase 12 → Hardcoded paths/URLs (US10)
3. Phase 14 → Logging & cleanup (US11 continued)
4. Phase 8b-e → Client tooling gaps closed (US8) — independent, can interleave
5. Phase 15 → Oversized files decomposed (US12)
6. Phase 16 → Type safety fixes
7. Phase 17 → Verification against all 29 success criteria

### Already Delivered (23 tasks, 10 phases complete)

| Story | What | Status |
|-------|------|--------|
| US1 | Route handler factory — `createHandler()` in 6 route files (pilot). Scale migration in Phase 18 | Partial |
| US2 | DRY consolidation — `errMsg()`, `execFileAsync()` shared | Done |
| US3 | Result types — `safe()`, `safeSync()` with 3 consumers | Done |
| US4 | Dead exports — identified and removed | Done |
| US5 | Circular deps — all 8 cycles resolved | Done |
| US6 | HO wrappers — `withRetry()`, `withTimeout()` with tests | Done |
| US7 | Error casts — 30 of 39 original eliminated (9 remain in T044) | Done |
| US8 partial | svelte-sonner activated (3 imports) | 1/8 done |
| US8 extended | Client fetch wrapper (B1) — new sub-phase 8f | Pending |
| US11 extended | B2, B10-B12, A6 DRY fixes — 5 new tasks | Pending |
| Type safety extended | C1/C4/C5 API typing, D2 eslint-disable — 2 new tasks | Pending |

---

## Format Validation

All tasks verified against checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- 86 total tasks, all have checkbox + task ID
- [P] marker present only on tasks with no file-level dependencies
- [Story] label present on all user story phase tasks (US1-US12)
- Setup/Foundational/Polish tasks have NO story label
- Every task includes file path or grep command for verification
- Completed tasks marked `[x]` with original IDs preserved for commit message traceability

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 and US6 are fully DONE — `safe()`, `withRetry()`, `withTimeout()` already implemented with tests
- `svelte-sonner` is already installed (v1.0.7) with 3 imports — T018+ extends other library coverage
- `createHandler()` exists with 6 consumers (pilot routes). T008-T009 completed pilot migration only. Phase 18 (T068-T077) handles remaining ~60 routes in 10 batches of 5 files each (SC-004 target: 50+)
- MCP server files (`src/lib/server/mcp/`) are exempt from env centralization (standalone processes)
- Streaming/SSE route handlers are exempt from factory migration (can't wrap streaming responses)
- Four dependency gates require user approval: T018 (@tanstack/table-core), T020 (virtua), T022 (superforms+formsnap), T023 (svelte-query)
- `madge` is already installed as devDependency (installed during US5 work)
- Commit after each task or logical group. Format: `type(scope): TXXX — description`
- RPi 5 memory constraint: Never run concurrent `svelte-check` or full test suite while Antigravity is active
- **Deferred P2 audit findings (acknowledged, no tasks)**: A5 (client-side setInterval consistency — all components already have cleanup, just inconsistent pattern), C6 (milsymbol `any` — external library limitation), C7 (type branding for domain IDs — significant refactor for marginal compile-time safety), C8 (typed WebSocket message discriminated union — nice-to-have), C9 (repository/data access abstraction — would require new architectural pattern, out of scope), D5 (`@ts-expect-error` in tests — 2 instances for SSR testing, acceptable). These are documented in `codebase-audit-findings.md` for future work.
