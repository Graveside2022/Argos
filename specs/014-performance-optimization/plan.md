# Implementation Plan: Performance Optimization & Complexity Reduction

**Branch**: `014-performance-optimization` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-performance-optimization/spec.md`

## Summary

Full codebase audit and remediation addressing three layers of technical debt: ~4,000 lines of verified dead code, ~1,500 lines of structural bloat, and 7 algorithmic performance hotspots. Installs automated ESLint complexity guardrails to prevent future regressions. All changes follow a Verification-First Protocol: grep before delete, build after every batch, tests after every refactor.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) + Svelte 5
**Primary Dependencies**: SvelteKit, Vite, better-sqlite3, maplibre-gl, eslint-plugin-sonarjs (new)
**Storage**: SQLite (rf_signals.db) — additive composite index only
**Testing**: Vitest (unit/integration), Playwright (e2e)
**Target Platform**: Raspberry Pi 5 (Kali Linux, ARM Cortex-A76, 8GB RAM)
**Project Type**: Web application (SvelteKit — server + client in single project)
**Performance Goals**: Kismet batch <50ms, GSM Evil <=5 writes/scan, GPS 0 rebuilds/min stationary, initial JS -20%, health check -30% latency
**Constraints**: <200MB heap, <15% CPU, <3s initial load, <16ms WebSocket processing
**Scale/Scope**: ~436 files / 63,231 lines in src/. Touching ~50 files across 4 work streams.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                 | Requirement                                                  | Status        | Notes                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| I.1 Comprehension Lock  | Problem fully understood before coding                       | PASS          | Triple-verified audit with grep + build confirmation                                                                                                |
| I.2 Codebase Inventory  | Search existing implementations before modifying             | PASS          | Comprehensive exploration agents mapped all affected files                                                                                          |
| II.1 TypeScript Strict  | No `any`, no `@ts-ignore`                                    | PASS          | No new `any` introduced; existing violations untouched                                                                                              |
| II.2 Modularity         | Max 50 lines/function, 300 lines/file                        | ACKNOWLEDGED  | 21 pre-existing violations receive `eslint-disable` annotations (not fixed in this spec). New code must comply. ESLint rules enforce going forward. |
| II.3 Naming             | kebab-case files, camelCase vars                             | PASS          | No new files violate naming conventions                                                                                                             |
| II.5 Documentation      | JSDoc for public functions                                   | PASS          | New public functions (batchUpdateDevices, toolFactory) will have JSDoc                                                                              |
| II.6 Forbidden Patterns | No barrel files, no catch-all utils                          | PASS          | No new barrel files. `toolFactory()` lives alongside the offnet data files, not in a catch-all utils file.                                          |
| III.1 Test-First        | Tests before/alongside implementation                        | PASS          | Performance benchmarks written for optimized paths. Existing tests must pass unmodified after refactors.                                            |
| V.1 Real-Time           | WebSocket <16ms, interaction <100ms                          | PASS — TARGET | This spec directly addresses Article V compliance                                                                                                   |
| V.2 Load                | Initial load <3s, lazy load heavy components                 | PASS — TARGET | Chunk splitting + lazy loading for maplibre-gl, mil-sym-ts-web                                                                                      |
| V.3 Resources           | <15% CPU, <200MB heap                                        | PASS — TARGET | GPS memoization, Kismet batching, GSM Evil debounce all reduce resource usage                                                                       |
| VI.3 Forbidden          | No npm install without approval                              | ACKNOWLEDGED  | `eslint-plugin-sonarjs` requires explicit user approval before installation                                                                         |
| VIII.3 AI Permissions   | ASK FIRST for delete/rename, install packages, modify config | ACKNOWLEDGED  | User explicitly approved dead code deletion scope and ESLint config changes during planning                                                         |
| IX.1 Documents          | spec.md = WHAT, plan.md = HOW                                | PASS          | Spec is tech-agnostic; plan contains implementation details                                                                                         |
| IX.2 Task Granularity   | 1 task = 1 commit, 5min–2hr                                  | PASS          | Each stream step is a single commit-sized unit                                                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/014-performance-optimization/
├── plan.md              # This file
├── spec.md              # Feature specification (written)
├── research.md          # Phase 0 research findings
├── checklists/
│   └── requirements.md  # Spec quality checklist (written)
└── tasks.md             # Phase 2 task list (created by /speckit.tasks)
```

### Source Code (files affected)

```text
# Stream A — Dead Code Elimination (DELETE these files)
src/lib/hackrf/sweep-manager/error-recovery.ts       # 266 lines — orphaned duplicate
src/lib/types/errors.ts                                # 195 lines — pre-Zod dead code
src/lib/types/validation.ts                            # 173 lines — pre-Zod dead code
src/lib/tactical-map/utils/map-utils.ts                # 283 lines — Leaflet-era remnant
src/lib/kismet/api.ts                                  # 281 lines — zero consumers
src/lib/tactical-map/hackrf-service.ts                 # 107 lines — never instantiated
src/lib/hackrf/websocket.ts                            # 0 lines — empty file
src/lib/hackrf/stores.ts                               # 286 lines — orphaned UI code
src/lib/hackrf/api-legacy.ts                           # 225 lines — orphaned UI code
src/lib/hackrf/api-legacy-stream.ts                    # 266 lines — orphaned UI code
src/lib/hackrf/spectrum-time-filter.ts                 # 270 lines — orphaned UI code
src/lib/hackrf/spectrum-time-helpers.ts                # 86 lines — orphaned UI code
src/lib/hackrf/spectrum.ts                             # 74 lines — orphaned UI code
src/lib/hackrf/format-utils.ts                         # 29 lines — orphaned UI code
src/lib/hackrf/sweep.ts                                # 9 lines — orphaned UI code
src/lib/api/hackrf.ts                                  # 286 lines — class dead, extract types first
src/lib/api/config.ts                                  # 164 lines — transitively dead
scripts/dev/start-all-services.sh                      # 274 lines — hackrf_emitter/ gone
scripts/build/ (5 files)                               # 1,339 lines — stale framework
build-tools/ (3 files)                                 # Stale duplicate package.json + baselines
src/lib/constitution/ (24 files)                       # 5,028 lines — one-time audit tool, zero runtime consumers
tests/constitution/ (52 files incl. fixtures)          # 2,155 lines — tests + fixture data for dead constitution infra

# Stream A — Verified safe to delete (code review confirmed zero server imports)
src/lib/hackrf/types.ts                                # 83 lines — server uses src/lib/server/hackrf/types.ts instead

# Stream B — Structural Bloat Reduction (MODIFY these files)
src/lib/stores/gsm-evil-store.ts                       # 385 → ~265 lines
src/lib/stores/connection.ts                           # 163 → ~63 lines
src/lib/hackrf/sweep-manager/error-tracker.ts          # Consolidate types with error-analysis.ts
src/lib/hackrf/sweep-manager/error-analysis.ts         # Remove duplicated functions
src/lib/hackrf/sweep-manager/frequency-cycler.ts       # 311 → ~230 lines
src/lib/data/offnet-recon-tracking.ts                  # Tool factory pattern
src/lib/data/offnet-utilities.ts                       # Tool factory pattern
src/lib/data/offnet-attack-wifi.ts                     # Tool factory pattern
src/lib/data/offnet-attack-rf.ts                       # Tool factory pattern
src/lib/data/offnet-recon-signals.ts                   # Tool factory pattern
src/lib/server/db/database.ts                          # 360 → ~280 lines
src/lib/components/dashboard/map/map-helpers.ts        # 280 → ~200 lines
src/lib/hackrf/sweep-manager/sweep-utils.ts            # Consolidate convertToMHz/convertToHz with frequency-utils.ts
src/lib/hackrf/sweep-manager/frequency-utils.ts        # Remove duplicates (keep canonical in one file)
src/lib/server/hardware/hackrf-manager.ts              # Consolidate getBlockingProcesses/killBlockingProcesses
src/lib/server/hardware/alfa-manager.ts                # Remove duplicate hardware mgmt functions
src/lib/server/hardware/detection/usb-sdr-detectors.ts # Remove duplicate detectHackRF
tests/integration/api.test.ts                          # Extract shared helpers
tests/setup.ts                                         # Collapse canvas mock

# Stream C — Performance Optimization (MODIFY these files)
src/lib/tactical-map/kismet-service.ts                 # Batch store updates
src/lib/stores/tactical-map/kismet-store.ts            # batchUpdateDevices + incremental distributions
src/lib/stores/gsm-evil-store.ts                       # Debounce persistence (also Stream B)
src/lib/components/dashboard/dashboard-map-logic.svelte.ts      # GPS memoization
vite.config.ts                                         # Manual chunk splitting
src/lib/map/symbols/symbol-factory.ts                  # Lazy load mil-sym-ts-web
src/lib/server/services/gsm-evil/gsm-evil-health-service.ts  # Promise.all
src/lib/server/db/signal-repository.ts                 # Cached prepared statement
src/lib/components/dashboard/map/map-geojson.ts        # Reduce allocations
src/lib/components/dashboard/map/map-handlers.ts       # Skip unchanged rebuilds

# Stream D — Guardrails (MODIFY/CREATE these files)
config/eslint.config.js                                # Add complexity rules
tests/performance/store-benchmarks.test.ts             # NEW — Kismet batch benchmarks
tests/performance/persistence-benchmarks.test.ts       # NEW — GSM Evil debounce benchmarks

# Database migration
scripts/db-migrate.ts or new migration SQL             # Composite spatial+timestamp index
```

**Structure Decision**: No new directories. All changes fit within the existing Argos project structure. New files limited to 2 benchmark test files and 1 DB migration.

## Complexity Tracking

| Violation                                        | Why Needed                                                                                                | Simpler Alternative Rejected Because                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| eslint-plugin-sonarjs (new dependency)           | Enforces cognitive complexity — built-in ESLint `complexity` rule only measures cyclomatic, not cognitive | No alternative provides cognitive complexity measurement without a plugin                                       |
| 21 existing functions exceed Article II.2 limits | Receive `eslint-disable` annotations, not refactoring                                                     | Full refactoring of 21 functions is a separate spec — too large to combine with performance optimization safely |

## Implementation Approach

### Stream A — Dead Code Elimination

**Approach**: Incremental deletion with build verification between each batch.

**Batch 1 (zero-risk confirmed dead):**

1. Delete `error-recovery.ts`, `types/errors.ts`, `types/validation.ts`, `map-utils.ts`, `kismet/api.ts`, `hackrf-service.ts`, `hackrf/websocket.ts`
2. Run `npm run build` — must pass

**Batch 2 (HackRF client cluster):**

1. Delete `src/lib/hackrf/types.ts` — verified zero imports from `src/lib/server/hackrf/` (server uses `src/lib/server/hackrf/types.ts` instead)
2. No type extraction needed — all 4 consumers of `SignalDetection`/`HackRFStatus` from `api/hackrf.ts` are themselves being deleted in this batch
3. Delete the orphaned client files: `types.ts`, `stores.ts`, `api-legacy.ts`, `api-legacy-stream.ts`, `spectrum-time-filter.ts`, `spectrum-time-helpers.ts`, `spectrum.ts`, `format-utils.ts`, `sweep.ts`
4. Run `npm run build` — must pass

**Batch 3 (transitively dead):**

1. Delete `api/hackrf.ts` and `api/config.ts` (consumers gone from Batch 2)
2. Run `npm run build` — must pass

**Batch 4 (scripts):**

1. Delete `scripts/dev/start-all-services.sh`
2. Delete `scripts/build/` directory (5 files)
3. Delete `build-tools/` directory (3 files — stale duplicate package.json + baselines)
4. Remove dead npm scripts from `package.json`: `dev:full`, `kill-all`, `framework:*` (8 scripts)
5. Run `npm run build` — must pass

**Batch 5 (constitution auditor infrastructure):**

1. Delete entire `src/lib/constitution/` directory (24 files, 5,028 lines — one-time audit tool, zero runtime consumers, zero imports from any other module)
2. Delete entire `tests/constitution/` directory (54 files including fixtures, 2,155 lines)
3. Delete `docs/constitutional-audit-tool/` directory (3 files, 1,384 lines — documentation for the dead tool)
4. Run `npm run build` — must pass
5. NOTE: `.specify/memory/constitution.md` (project governance document) is NOT deleted — it is the living constitution, not audit tooling

### Stream B — Structural Bloat Reduction

**Approach**: Refactor one file at a time. Run its tests after each change. Never batch refactors without intermediate verification.

**B.1 — gsm-evil-store.ts** (also covers Stream C.2 debounce):

- Replace 10 identical single-field setters with generic `updateField` pattern
- Remove duplicate `updateScanResults`/`setScanResults`
- Replace `getAbortController` anti-pattern with `get(store).scanAbortController`
- Split `updateAndPersist` into `updateOnly` (transient) and `updateAndDebouncedPersist` (structural)
- Exclude `scanProgress`, `scanAbortController` from serialized state shape
- Add 2-second trailing debounce via `setTimeout`/`clearTimeout`

**B.2 — connection.ts**:

- Deduplicate 3x identical initial state objects into a single `DEFAULT_CONNECTION_STATUS` constant
- Extract `connections` array to eliminate 12 repeated store references in derived stores
- Verify `hackrfConnection` and `expressConnection` usage in derived stores (`allConnected`, `anyConnecting`, `connectionErrors`, `totalReconnectAttempts`) — if derived stores also have zero external consumers, remove both; otherwise refactor derived stores to only use surviving connections

**B.3 — sweep-manager cleanup** (files that STAY because server uses them):

- `error-tracker.ts` + `error-analysis.ts`: Consolidate duplicated `DeviceState`, `RecoveryConfig`, `ErrorAnalysis` types into `error-analysis.ts`. Remove redundant `calculateHealthScore`/`findMostProblematicFrequency` copies from `error-tracker.ts`.
- `frequency-cycler.ts`: Remove 5 passthrough delegation methods. Merge 4 redundant cleanup methods (`stopCycling`, `clearAllTimers`, `emergencyStop`, `resetCycling`) into 2. Use `Object.assign` for state init.

**B.4 — offnet-\*.ts tool factory**:

- Create a `createTool()` factory function in the first offnet file (or a shared location within `src/lib/data/`)
- Apply to all 80+ tool entries across 5 files, replacing 7 identical default fields per entry

**B.5 — Duplicate function consolidation (hardware managers + sweep utils)**:

- `sweep-utils.ts` + `frequency-utils.ts`: Both export identical `convertToMHz`/`convertToHz`. Keep canonical in `frequency-utils.ts`, update callers of `sweep-utils` versions, remove duplicates from `sweep-utils.ts`.
- `hackrf-manager.ts` + `alfa-manager.ts`: Both export `getBlockingProcesses`/`killBlockingProcesses`. Extract shared implementation to a hardware utility or have one import from the other.
- `hackrf-manager.ts` + `usb-sdr-detectors.ts`: Both export `detectHackRF`. The USB detector returns `DetectedHardware[]` while hackrf-manager returns `boolean`. Keep both (different signatures/purposes) but add JSDoc distinguishing them.

**B.6 — database.ts + map-helpers.ts (formerly B.5)**:

- `database.ts`: Remove self-evident JSDoc on delegation methods. Consolidate SIGTERM/SIGINT handlers into a shared loop. Reference existing constants for retention durations.
- `map-helpers.ts`: Eliminate `createCirclePolygon` (delegate to `createRingPolygon` with innerRadius=0). Replace `getRadioColor` switch with a lookup table. Collapse `formatTimeAgo` to array-driven pattern.

**B.7 — Test file cleanup (formerly B.6)**:

- Extract `createMockResponse` from `tests/integration/api.test.ts` to `tests/helpers/api-test-utils.ts`
- Replace `createMockResponse` duplicate in `tests/performance/benchmarks.test.ts` with import from shared helper
- Move 5-line security test boilerplate from 7 `tests/security/*.test.ts` files to shared helper
- Collapse 110-line canvas mock in `tests/setup.ts` to ~10-line stub

### Stream C — Performance Optimization

**C.1 — Batch Kismet store updates**:

- In `kismet-service.ts:170-183`: Replace `devices.forEach(d => addKismetDevice(d))` with a single `batchUpdateDevices(devices)` call
- In `kismet-store.ts`: Add `batchUpdateDevices(devices: KismetDevice[])` that calls `kismetStore.update()` once with all devices merged into the Map
- Convert `updateDistributions` from full-Map rebuild to incremental counters maintained inside `batchUpdateDevices`
- Verify: existing Kismet tests pass, dashboard renders correctly

**C.2 — Debounce GSM Evil persistence** (implemented as part of B.1):

- See B.1 above — same file, same refactor

**C.3 — Memoize GPS GeoJSON**:

- In `src/lib/components/dashboard/dashboard-map-logic.svelte.ts`: Add `let prevLat: number | null, prevLng: number | null, prevAccuracy: number | null` tracking variables
- Before calling `buildAccuracyGeoJSON` and `buildDetectionRangeGeoJSON`, compare current values against previous with epsilon (0.00001 for lat/lng, 0.1 for accuracy)
- If unchanged, skip rebuild and reuse cached GeoJSON
- If null, treat as "no change"

**C.4 — Vite chunk splitting + lazy loading**:

- In `vite.config.ts`: Add `build.rollupOptions.output.manualChunks` function that puts `maplibre-gl` → `vendor-maplibre`, `mil-sym-ts-web` → `vendor-milsym`, `xterm` → `vendor-xterm`
- In `src/lib/components/dashboard/dashboard-map-logic.svelte.ts`: Convert `import maplibregl from 'maplibre-gl'` to `const maplibregl = await import('maplibre-gl')`
- In `symbol-factory.ts`: Lazy-load the mil-sym-ts-web library
- Verify: `npm run build` produces separate chunks. Dashboard map still renders.

**C.5 — Parallelize health checks**:

- In `gsm-evil-health-service.ts:319-338`: Replace 4 sequential `await` with `const [a, b, c, d] = await Promise.all([...])`. Wrap each in individual try/catch so one failure doesn't block others.

**C.6 — Composite DB index**:

- Add migration: `CREATE INDEX IF NOT EXISTS idx_signals_spatial_timestamp ON signals(CAST(latitude * 10000 AS INTEGER), CAST(longitude * 10000 AS INTEGER), timestamp DESC)`
- In `signal-repository.ts`: Cache the `updateSignal` prepared statement in the `statements` Map alongside `insertSignal`

**C.7 — GeoJSON allocation reduction**:

- In `map-geojson.ts:buildDeviceGeoJSON`: Reuse the `devicesForVisibility` array where possible instead of allocating new arrays
- In `map-handlers.ts:updateSymbolLayer`: Skip the full `.map()` rebuild if the feature count and composition haven't changed since last call

### Stream D — Automated Guardrails

**D.1 — ESLint complexity rules**:

- Install: `npm install --save-dev eslint-plugin-sonarjs` (requires user approval)
- In `config/eslint.config.js`: Add `sonarjs` plugin. Add rules: `complexity: ['warn', 15]`, `sonarjs/cognitive-complexity: ['warn', 20]`
- Use `warn` not `error` so existing violations don't block `npm run lint` entirely
- Add `eslint-disable-next-line` with `// TODO(014): Refactor — cyclomatic complexity N` on the 21 known oversized functions

**D.2 — Performance benchmark tests**:

- `tests/performance/store-benchmarks.test.ts`: Benchmark Kismet `batchUpdateDevices` with 150 mock devices — must complete in <50ms
- `tests/performance/persistence-benchmarks.test.ts`: Benchmark GSM Evil debounce — 500 rapid `addScanProgress` calls must produce <=5 actual localStorage writes

## Execution Order

| Step | Stream  | Task                                       | Commit Format                                                   | Verify                                    |
| ---- | ------- | ------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------- |
| 1    | A.1     | Delete confirmed-dead files (batch 1)      | `refactor(cleanup): T001 — delete verified dead code files`     | `npm run build`                           |
| 2    | A.2     | Delete HackRF client cluster (batch 2)     | `refactor(cleanup): T002 — remove orphaned HackRF UI code`      | `npm run build`                           |
| 3    | A.3     | Delete transitively dead files (batch 3)   | `refactor(cleanup): T003 — remove transitively dead API files`  | `npm run build`                           |
| 4    | A.4     | Clean dead scripts + npm entries (batch 4) | `refactor(cleanup): T004 — remove dead scripts and npm targets` | `npm run build` + `npm run lint`          |
| 5    | A.5     | Delete constitution infra (batch 5)        | `refactor(cleanup): T005 — remove constitution audit tooling`   | `npm run build`                           |
| 6    | C.1     | Batch Kismet store updates                 | `perf(kismet): T006 — batch device store updates`               | `npm run build` + Kismet tests            |
| 7    | B.1+C.2 | Refactor gsm-evil-store + debounce         | `perf(gsm-evil): T007 — debounce persistence, clean store`      | `npm run build` + GSM Evil tests          |
| 8    | C.3     | Memoize GPS GeoJSON                        | `perf(gps): T008 — memoize GPS-derived GeoJSON`                 | `npm run build`                           |
| 9    | C.5     | Parallelize health checks                  | `perf(gsm-evil): T009 — parallelize health checks`              | `npm run build`                           |
| 10   | C.6     | DB composite index + cached statement      | `perf(db): T010 — add composite spatial+timestamp index`        | `npm run build` + `npm run db:migrate`    |
| 11   | B.2     | Clean connection.ts                        | `refactor(stores): T011 — deduplicate connection stores`        | `npm run build`                           |
| 12   | B.3     | Clean sweep-manager files                  | `refactor(hackrf): T012 — consolidate sweep-manager types`      | `npm run build`                           |
| 13   | B.4     | offnet-\*.ts tool factory                  | `refactor(data): T013 — create tool factory for offnet files`   | `npm run build`                           |
| 14   | B.5     | Consolidate duplicate utility functions    | `refactor(hardware): T014 — consolidate duplicate functions`    | `npm run build`                           |
| 15   | B.6     | Clean database.ts + map-helpers.ts         | `refactor(core): T015 — clean database facade and map helpers`  | `npm run build`                           |
| 16   | C.4     | Vite chunk splitting + lazy loading        | `perf(build): T016 — chunk split heavy vendor libs`             | `npm run build` + check chunks            |
| 17   | C.7     | GeoJSON allocation reduction               | `perf(map): T017 — reduce GeoJSON allocation churn`             | `npm run build`                           |
| 18   | B.7     | Test file cleanup                          | `refactor(tests): T018 — extract shared test helpers`           | `npm run build` + `npx vitest run tests/` |
| 19   | D.1     | ESLint complexity guardrails               | `feat(lint): T019 — add cyclomatic/cognitive complexity rules`  | `npm run lint`                            |
| 20   | D.2     | Performance benchmark tests                | `test(perf): T020 — add store and persistence benchmarks`       | `npx vitest run tests/performance/`       |

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                       |
| --------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| Deleting a file that has a hidden consumer          | Low        | High   | Grep verification + incremental build after each batch           |
| Refactoring changes observable behavior             | Medium     | High   | Run file's tests after each refactor; FR-016                     |
| Lazy-loaded maplibre-gl breaks map rendering        | Low        | Medium | Dashboard has ssr: false; test manually after chunk splitting    |
| eslint-plugin-sonarjs incompatible with flat config | Low        | Low    | Use `warn` level; graceful degradation                           |
| Performance benchmarks flaky on RPi 5 under load    | Medium     | Low    | Use generous thresholds; document hardware-specific expectations |
