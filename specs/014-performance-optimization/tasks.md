# Tasks: Performance Optimization & Complexity Reduction

**Input**: Design documents from `/specs/014-performance-optimization/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Performance benchmark tests are included (FR-015 in spec). Existing tests must pass unmodified (FR-016).

**Organization**: Tasks follow the plan's safety-ordered execution (dead code → perf optimization → refactoring → guardrails) with user story labels for traceability. The Verification-First Protocol (spec.md) applies to every task.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US9 from spec.md)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/`, `scripts/`, `config/` at repository root

---

## Phase 1: User Story 1 — Dead Code Eliminated (Priority: P1) 🎯 MVP

**Goal**: Remove ~11,000+ lines of verified dead code across 80+ files in 5 incremental batches, each followed by `npm run build` verification.

**Independent Test**: For each batch: delete files → `npm run build` passes. If build breaks, the file was not dead — revert immediately.

**Safety Rule**: `grep -rn "from.*<module-path>" src/ tests/` MUST confirm zero imports before EVERY deletion. `npm run build` MUST pass after EVERY batch. No exceptions.

### Batch 1 — Confirmed Dead Files (zero imports, zero risk)

- [x] T001 [US1] Verify zero imports and delete `src/lib/hackrf/sweep-manager/error-recovery.ts` (266 lines — orphaned duplicate of error-analysis.ts)
- [x] T002 [P] [US1] Verify zero imports and delete `src/lib/types/errors.ts` (195 lines — pre-Zod dead code)
- [x] T003 [P] [US1] Verify zero imports and delete `src/lib/types/validation.ts` (173 lines — pre-Zod dead code)
- [x] T004 [P] [US1] Verify zero imports and delete `src/lib/tactical-map/utils/map-utils.ts` (283 lines — Leaflet-era remnant)
- [x] T005 [P] [US1] Verify zero imports and delete `src/lib/kismet/api.ts` (281 lines — zero external consumers)
- [x] T006 [P] [US1] Verify zero imports and delete `src/lib/tactical-map/hackrf-service.ts` (107 lines — never instantiated, references nonexistent `/viewspectrum`)
- [x] T007 [P] [US1] Delete empty file `src/lib/hackrf/websocket.ts` (0 lines)
- [x] T008 [US1] Run `npm run build` — MUST pass. If failure, revert last deletion and investigate.

**Commit**: `refactor(cleanup): T001 — delete verified dead code files`

### Batch 2 — Orphaned HackRF Client Cluster

**CRITICAL**: `src/lib/hackrf/sweep-manager/` MUST NOT be deleted — it powers live `/api/hackrf/` and `/api/rf/` routes.

- [x] T009 [US1] Delete `src/lib/hackrf/types.ts` (83 lines) — verified zero imports from `src/lib/server/hackrf/` (server uses its own `src/lib/server/hackrf/types.ts`). No type extraction needed — all 4 consumers of `SignalDetection`/`HackRFStatus` from `api/hackrf.ts` are being deleted in this batch.
- [x] T010 [US1] Delete orphaned HackRF client files: `src/lib/hackrf/stores.ts` (286 lines), `src/lib/hackrf/api-legacy.ts` (225 lines), `src/lib/hackrf/api-legacy-stream.ts` (266 lines), `src/lib/hackrf/spectrum-time-filter.ts` (270 lines), `src/lib/hackrf/spectrum-time-helpers.ts` (86 lines), `src/lib/hackrf/spectrum.ts` (74 lines), `src/lib/hackrf/format-utils.ts` (29 lines), `src/lib/hackrf/sweep.ts` (9 lines)
- [x] T011 [US1] Run `npm run build` — MUST pass. Verify `src/lib/hackrf/sweep-manager/` is untouched.

**Commit**: `refactor(cleanup): T002 — remove orphaned HackRF UI code`

### Batch 3 — Transitively Dead Files

- [x] T012 [US1] Delete `src/lib/api/hackrf.ts` (286 lines — all consumers removed in Batch 2) and `src/lib/api/config.ts` (164 lines — only consumers were hackrf.ts + kismet/api.ts, both now deleted)
- [x] T013 [US1] Run `npm run build` — MUST pass.

**Commit**: `refactor(cleanup): T003 — remove transitively dead API files`

### Batch 4 — Dead Scripts and npm Entries

- [x] T014 [P] [US1] Delete `scripts/dev/start-all-services.sh` (274 lines — references nonexistent `hackrf_emitter/` directory)
- [x] T015 [P] [US1] Delete `scripts/build/` directory (5 files, ~1,339 lines — stale Feature Creep Framework monitoring CSS/components/ports that don't exist)
- [x] T016 [P] [US1] Delete `build-tools/` directory (3 files — stale duplicate package.json + css-integrity-baselines.json from deleted framework). NOTE: root package.json was a symlink to build-tools/package.json — replaced with real file.
- [x] T017 [US1] Remove dead npm scripts from `package.json`: `dev:full`, `kill-all`, `framework:check-css`, `framework:check-html`, `framework:check-visual`, `framework:generate-baselines`, `framework:generate-visual-baselines`, `framework:validate-all`, `framework:full-check`, `framework:install`
- [x] T018 [US1] Run `npm run build` and `npm run lint` — both MUST pass. Verify remaining npm scripts execute correctly.

**Commit**: `refactor(cleanup): T004 — remove dead scripts and npm targets`

### Batch 5 — Constitution Auditor Infrastructure

**Context**: The constitution auditor (`src/lib/constitution/`) was a one-time audit tool used early in the project to measure codebase compliance against `.specify/memory/constitution.md`. It has zero runtime consumers and zero imports from any live code. The governance document itself (`.specify/memory/constitution.md`) MUST be preserved — only the tooling that measured against it is deleted.

- [x] T019 [US1] Verify zero imports from live code: `grep -rn "from.*constitution" src/ --include="*.ts" --include="*.svelte" | grep -v "src/lib/constitution/" | grep -v "// "` — must return only JSDoc/comment references, not actual imports
- [x] T020 [US1] Delete `src/lib/constitution/` directory (24 files, ~5,028 lines — auditor, parsers, validators, report generators, types)
- [x] T021 [P] [US1] Delete `tests/constitution/` directory (54 files including fixtures, ~2,155 lines — test suite for deleted auditor)
- [x] T022 [P] [US1] Delete `docs/constitutional-audit-tool/` directory (3 files: README.md, usage-guide.md, how-it-works.md — ~1,384 lines of orphaned documentation)
- [x] T023 [US1] Run `npm run build` — MUST pass. Verify `.specify/memory/constitution.md` is untouched.

**Commit**: `refactor(cleanup): T005 — remove constitution audit tooling`

**Checkpoint**: ~11,000+ lines of dead code removed across 5 batches. `npm run build` and `npm run lint` pass. SC-001 target met.

---

## Phase 2: User Story 2 — Dashboard Responsive During Kismet Session (Priority: P1)

**Goal**: Replace per-device `kismetStore.update()` forEach (100+ calls per poll) with single atomic batch update. Derived GeoJSON recalculates exactly once per poll cycle.

**Independent Test**: Kismet with 150 devices → store batch completes in <50ms total. Existing Kismet tests pass unmodified.

- [ ] T024 [US2] Read and understand `src/lib/stores/tactical-map/kismet-store.ts` — map current `addKismetDevice()` call flow, identify all derived stores and subscribers
- [ ] T025 [US2] Add `batchUpdateDevices(devices: KismetDevice[])` function to `src/lib/stores/tactical-map/kismet-store.ts` — single `kismetStore.update()` call merging all devices into the Map at once
- [ ] T026 [US2] Convert `updateDistributions()` in `src/lib/stores/tactical-map/kismet-store.ts` from full-Map rebuild to incremental counters maintained inside `batchUpdateDevices`
- [ ] T027 [US2] Update `src/lib/tactical-map/kismet-service.ts:170-183` — replace `devices.forEach(d => addKismetDevice(d))` with single `batchUpdateDevices(devices)` call
- [ ] T028 [US2] Run `npm run build` and `npx vitest run --no-coverage src/lib/stores/tactical-map/` — build MUST pass, all existing Kismet tests MUST pass unmodified

**Commit**: `perf(kismet): T006 — batch device store updates`

**Checkpoint**: Kismet batch update implemented. SC-003 target achievable. Dashboard should update smoothly during 100+ device polls.

---

## Phase 3: User Story 3 — GSM Evil Scans Don't Freeze Browser (Priority: P1)

**Goal**: Debounce GSM Evil state persistence to ≤1 write per 2 seconds. Exclude transient state (progress log, abort controller) from serialization. Also clean store boilerplate (US4 overlap).

**Independent Test**: 500 rapid `addScanProgress` calls produce ≤5 localStorage writes. Page reload restores structural data correctly.

- [ ] T029 [US3] Read and understand `src/lib/stores/gsm-evil-store.ts` — map all `updateAndPersist` calls, identify which state is transient vs structural
- [ ] T030 [US3] Split persistence in `src/lib/stores/gsm-evil-store.ts` — create `updateOnly()` for transient updates (scanProgress) and `updateAndDebouncedPersist()` for structural updates. Implement 2-second trailing debounce via `setTimeout`/`clearTimeout`.
- [ ] T031 [US3] Exclude `scanProgress` and `scanAbortController` from the serialized state shape in `src/lib/stores/gsm-evil-store.ts` — modify the persistence function to omit these fields before `JSON.stringify`
- [ ] T032 [US3] Add `QuotaExceededError` catch in the debounced persist function — log warning, do not crash (edge case from spec)
- [ ] T033 [US3] Collapse 10 identical single-field setters in `src/lib/stores/gsm-evil-store.ts` to generic `updateField` pattern. Remove duplicate `updateScanResults`/`setScanResults`. Replace `getAbortController` anti-pattern with `get(store).scanAbortController`.
- [ ] T034 [US3] Run `npm run build` and `npx vitest run --no-coverage src/lib/stores/gsm-evil` — build MUST pass, all existing GSM Evil tests MUST pass unmodified

**Commit**: `perf(gsm-evil): T007 — debounce persistence, clean store`

**Checkpoint**: GSM Evil persistence debounced. SC-004 target achievable. Browser stays responsive during scans.

---

## Phase 4: User Story 6 — GPS Overlay Skips Unnecessary Computation (Priority: P2)

**Goal**: GPS-derived GeoJSON (accuracy circle + 5 detection range rings = 288 trig ops) only recalculates when position actually changes. Zero rebuilds per minute when stationary.

**Independent Test**: GPS at fixed position → GeoJSON rebuild count = 0/minute.

- [ ] T035 [US6] Add memoization variables (`prevLat`, `prevLng`, `prevAccuracy`) to `src/lib/components/dashboard/dashboard-map-logic.svelte.ts`. Before calling `buildAccuracyGeoJSON` and `buildDetectionRangeGeoJSON`, compare with epsilon (0.00001 lat/lng, 0.1 accuracy). Skip rebuild if unchanged. Treat null as "no change".
- [ ] T036 [US6] Run `npm run build` — MUST pass.

**Commit**: `perf(gps): T008 — memoize GPS-derived GeoJSON`

---

## Phase 5: User Story 7 — Health Checks Return Faster (Priority: P3)

**Goal**: 4 independent GSM Evil health checks run in parallel via `Promise.all`. Response time = max(individual checks), not sum.

**Independent Test**: Health endpoint response time ~= slowest individual check.

- [ ] T037 [US7] Replace 4 sequential `await` calls in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts:319-338` with `const [a, b, c, d] = await Promise.all([...])`. Wrap each check in individual try/catch so one failure doesn't block others.
- [ ] T038 [US7] Run `npm run build` — MUST pass.

**Commit**: `perf(gsm-evil): T009 — parallelize health checks`

---

## Phase 6: User Story 8 — Database Uses Optimal Indexes (Priority: P3)

**Goal**: Composite spatial+timestamp index eliminates post-filter sort step on spatial queries.

**Independent Test**: `EXPLAIN QUERY PLAN` on spatial query shows no separate SORT step after migration.

- [ ] T039 [US8] Add migration SQL: `CREATE INDEX IF NOT EXISTS idx_signals_spatial_timestamp ON signals(CAST(latitude * 10000 AS INTEGER), CAST(longitude * 10000 AS INTEGER), timestamp DESC)` via `scripts/db-migrate.ts`
- [ ] T040 [P] [US8] Cache the `updateSignal` prepared statement in the `statements` Map in `src/lib/server/db/signal-repository.ts` alongside `insertSignal`
- [ ] T041 [US8] Run `npm run build` and `npm run db:migrate` — both MUST pass. Verify existing queries return identical results.

**Commit**: `perf(db): T010 — add composite spatial+timestamp index`

---

## Phase 7: User Story 4 — Code Is Clean and Professional (Priority: P2)

**Goal**: Replace ~1,500 lines of structural bloat (copy-paste boilerplate, passthrough wrappers, redundant helpers) with DRY alternatives. Every refactored file's tests MUST pass unmodified.

**Independent Test**: For each refactored file: (1) read code + tests, (2) refactor, (3) run tests — all pass with identical behavior, (4) `npm run build` passes.

**Safety Rule**: If any test needs modification, the refactor changed behavior — STOP and reassess.

### B.2 — Connection Store Cleanup

- [ ] T042 [US4] Deduplicate 3x identical initial state objects into `DEFAULT_CONNECTION_STATUS` constant in `src/lib/stores/connection.ts`. Extract `connections` array. Verify `hackrfConnection`/`expressConnection` usage in derived stores (`allConnected`, `anyConnecting`, `connectionErrors`, `totalReconnectAttempts`) — if derived stores also have zero external consumers, remove both; otherwise refactor derived stores to only use surviving connections.
- [ ] T043 [US4] Run `npm run build` — MUST pass.

**Commit**: `refactor(stores): T011 — deduplicate connection stores`

### B.3 — Sweep Manager Consolidation

- [ ] T044 [US4] Consolidate duplicated types (`DeviceState`, `RecoveryConfig`, `ErrorAnalysis`) from `src/lib/hackrf/sweep-manager/error-tracker.ts` into `src/lib/hackrf/sweep-manager/error-analysis.ts`. Remove redundant `calculateHealthScore`/`findMostProblematicFrequency` copies from error-tracker.ts.
- [ ] T045 [P] [US4] Remove 5 passthrough delegation methods in `src/lib/hackrf/sweep-manager/frequency-cycler.ts`. Merge 4 redundant cleanup methods (`stopCycling`, `clearAllTimers`, `emergencyStop`, `resetCycling`) into 2. Use `Object.assign` for state init.
- [ ] T046 [US4] Run `npm run build` — MUST pass.

**Commit**: `refactor(hackrf): T012 — consolidate sweep-manager types`

### B.4 — Offnet Tool Factory

- [ ] T047 [US4] Create `createTool()` factory function in `src/lib/data/` that provides the 7 identical default fields. Apply to all 80+ tool entries across `src/lib/data/offnet-recon-tracking.ts`, `src/lib/data/offnet-utilities.ts`, `src/lib/data/offnet-attack-wifi.ts`, `src/lib/data/offnet-attack-rf.ts`, `src/lib/data/offnet-recon-signals.ts`.
- [ ] T048 [US4] Run `npm run build` — MUST pass.

**Commit**: `refactor(data): T013 — create tool factory for offnet files`

### B.5 — Duplicate Function Consolidation

- [ ] T049 [US4] Consolidate `convertToMHz` and `convertToHz` — pick canonical home in `src/lib/hackrf/sweep-manager/sweep-utils.ts`, update `src/lib/hackrf/sweep-manager/frequency-utils.ts` to import from sweep-utils instead of re-implementing. Verify all callers use the canonical copy.
- [ ] T050 [P] [US4] Consolidate `getBlockingProcesses` and `killBlockingProcesses` — pick canonical home between `src/lib/server/hardware/hackrf-manager.ts` and `src/lib/server/hardware/alfa-manager.ts`. Move shared implementation to one file, have the other import from it.
- [ ] T051 [US4] Run `npm run build` — MUST pass. Verify behavior unchanged by checking that calling code paths still work.

**NOTE**: `detectHackRF` in `hackrf-manager.ts` (returns `boolean`) and `usb-sdr-detectors.ts` (returns `DetectedHardware[]`) are NOT duplicates — different return types serve different purposes. Both kept, documented with JSDoc.

**Commit**: `refactor(hardware): T014 — consolidate duplicate functions`

### B.6 — Database Facade and Map Helpers

- [ ] T052 [P] [US4] Clean `src/lib/server/db/database.ts`: remove self-evident JSDoc on delegation methods, consolidate SIGTERM/SIGINT handlers into shared loop, reference existing constants for retention durations (360 → ~280 lines)
- [ ] T053 [P] [US4] Clean `src/lib/components/dashboard/map/map-helpers.ts`: eliminate `createCirclePolygon` (delegate to `createRingPolygon` with innerRadius=0), replace `getRadioColor` switch with lookup table, collapse `formatTimeAgo` to array-driven pattern (280 → ~200 lines)
- [ ] T054 [US4] Run `npm run build` — MUST pass.

**Commit**: `refactor(core): T015 — clean database facade and map helpers`

**Checkpoint**: ~1,000+ lines of structural bloat reduced. SC-002 target met. All existing tests still pass.

---

## Phase 8: User Story 5 — Dashboard Loads Within Performance Budget (Priority: P2)

**Goal**: Split maplibre-gl (~800KB gzipped), mil-sym-ts-web, and xterm into separate deferred vendor chunks. Dynamic import for map and symbology libraries.

**Independent Test**: `npm run build` → output shows separate vendor-maplibre, vendor-milsym, vendor-xterm chunks. Dashboard map still renders correctly.

- [ ] T055 [US5] Add `build.rollupOptions.output.manualChunks` to `vite.config.ts` — maplibre-gl → `vendor-maplibre`, mil-sym-ts-web → `vendor-milsym`, xterm → `vendor-xterm`
- [ ] T056 [P] [US5] Convert static `import maplibregl from 'maplibre-gl'` to dynamic `const maplibregl = await import('maplibre-gl')` in `src/lib/components/dashboard/dashboard-map-logic.svelte.ts`
- [ ] T057 [P] [US5] Lazy-load mil-sym-ts-web in `src/lib/map/symbols/symbol-factory.ts`
- [ ] T058 [US5] Run `npm run build` — MUST pass. Verify output chunks: vendor-maplibre, vendor-milsym, vendor-xterm exist as separate files. Verify dashboard map renders correctly.

**Commit**: `perf(build): T016 — chunk split heavy vendor libs`

---

## Phase 9: GeoJSON Allocation Reduction (Priority: P2)

**Goal**: Reduce allocation churn in GeoJSON builders and skip unchanged symbol layer rebuilds.

- [ ] T059 [US6] Reuse `devicesForVisibility` array where possible in `src/lib/components/dashboard/map/map-geojson.ts:buildDeviceGeoJSON` instead of allocating new arrays
- [ ] T060 [P] [US6] Skip full `.map()` rebuild in `src/lib/components/dashboard/map/map-handlers.ts:updateSymbolLayer` if feature count and composition haven't changed since last call
- [ ] T061 [US6] Run `npm run build` — MUST pass.

**Commit**: `perf(map): T017 — reduce GeoJSON allocation churn`

---

## Phase 10: Test File Cleanup (Priority: P2)

**Goal**: Extract shared test helpers, collapse bloated mocks, reduce test file duplication.

- [ ] T062 [P] [US4] Extract `createMockResponse` from `tests/integration/api.test.ts` to new `tests/helpers/api-test-utils.ts`. Replace duplicate in `tests/performance/benchmarks.test.ts` with import from shared helper.
- [ ] T063 [P] [US4] Move 5-line security test boilerplate from 7 `tests/security/*.test.ts` files to shared helper in `tests/helpers/security-test-utils.ts`
- [ ] T064 [US4] Collapse 110-line canvas mock in `tests/setup.ts` to ~10-line stub
- [ ] T065 [US4] Run `npm run build` and `npx vitest run --no-coverage tests/integration/ tests/security/` — build MUST pass, all tests MUST pass.

**Commit**: `refactor(tests): T018 — extract shared test helpers`

---

## Phase 11: User Story 9 — Automated Guardrails (Priority: P2)

**Goal**: Install ESLint complexity rules + performance benchmark tests. Prevent future regressions.

**Independent Test**: `npm run lint` reports complexity violations. New function with complexity > 15 triggers warning. Benchmark tests pass.

### D.1 — ESLint Complexity Rules

- [ ] T066 [US9] Install `eslint-plugin-sonarjs` as devDependency (REQUIRES USER APPROVAL: `npm install --save-dev eslint-plugin-sonarjs`)
- [ ] T067 [US9] Add sonarjs plugin to `config/eslint.config.js`. Add rules: `complexity: ['warn', 15]`, `sonarjs/cognitive-complexity: ['warn', 20]`. Use `warn` level (not `error`) so pre-existing violations don't block lint.
- [ ] T068 [US9] Add `eslint-disable-next-line` annotations with `// TODO(014): Refactor — cyclomatic/cognitive complexity N` tracking comments on the 21 known oversized functions across the codebase
- [ ] T069 [US9] Run `npm run lint` — MUST pass (warnings allowed for annotated functions, no errors). Verify a test function with complexity > 15 triggers the warning.

**Commit**: `feat(lint): T019 — add cyclomatic/cognitive complexity rules`

### D.2 — Performance Benchmark Tests

- [ ] T070 [P] [US9] Create `tests/performance/store-benchmarks.test.ts` — benchmark Kismet `batchUpdateDevices` with 150 mock devices, must complete in <50ms (SC-003)
- [ ] T071 [P] [US9] Create `tests/performance/persistence-benchmarks.test.ts` — benchmark GSM Evil debounce: 500 rapid `addScanProgress` calls must produce ≤5 actual localStorage writes (SC-004)
- [ ] T072 [US9] Run `npx vitest run --no-coverage tests/performance/` — all benchmarks MUST pass.

**Commit**: `test(perf): T020 — add store and persistence benchmarks`

**Checkpoint**: Automated guardrails installed. SC-008 target met. New code that exceeds complexity thresholds fails lint.

---

## Phase 12: Final Verification

**Purpose**: Full-project verification confirming all success criteria are met.

- [ ] T073 Run `npm run build` — MUST pass (SC-010)
- [ ] T074 Run `npm run lint` — MUST pass with only pre-existing annotated warnings (SC-008)
- [ ] T075 Run `npx vitest run --no-coverage src/lib/stores/ tests/performance/ tests/integration/` — all tests MUST pass (SC-009)
- [ ] T076 Verify `git diff --stat` against branch point shows ≥11,000 lines removed (SC-001) and ≥1,000 lines of bloat reduced (SC-002)

**Commit**: No commit — verification only.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1 — Dead Code)**: No dependencies — start immediately. MUST complete before Phase 7 (some B.3 files reference deleted types).
- **Phase 2 (US2 — Kismet Batch)**: No dependency on Phase 1 (different files). Can start after Phase 1 or in parallel if careful.
- **Phase 3 (US3 — GSM Evil)**: No dependency on Phase 2 (different files). Includes US4 store boilerplate overlap.
- **Phases 4–6 (US6, US7, US8)**: Independent of each other. Each touches different files.
- **Phase 7 (US4 — Code Cleanup)**: Depends on Phase 1 (dead code removed first) and Phase 3 (gsm-evil-store refactored). B.3 sweep-manager cleanup depends on Batch 1 deletion of error-recovery.ts.
- **Phase 8 (US5 — Chunks)**: Independent. Can run any time after Phase 1.
- **Phase 9 (GeoJSON)**: Depends on Phase 4 (GPS memoization).
- **Phase 10 (Test Cleanup)**: Independent. Can run any time.
- **Phase 11 (US9 — Guardrails)**: Depends on Phases 2–3 (benchmarks test the optimized paths). D.1 ESLint is independent.
- **Phase 12 (Verification)**: Depends on ALL previous phases.

### User Story Dependencies

- **US1 (Dead Code)**: Independent — start first for maximum safety margin
- **US2 (Kismet)**: Independent of US1 (different files)
- **US3 (GSM Evil)**: Independent of US1/US2
- **US4 (Code Cleanup)**: Partially depends on US1 (sweep-manager cleanup after dead file removal) and US3 (gsm-evil-store already refactored)
- **US5 (Chunks)**: Independent
- **US6 (GPS)**: Independent
- **US7 (Health)**: Independent
- **US8 (DB Index)**: Independent
- **US9 (Guardrails)**: D.2 benchmarks depend on US2 + US3 being complete

### Recommended Execution: Sequential (single developer)

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

This order matches the plan's safety-driven execution: deletions first (zero risk), then behavioral changes (medium risk with test verification), then pure refactors (low risk), then config/tests (zero risk).

### Parallel Opportunities (within phases)

**Phase 1**: T002–T007 can run in parallel (different files, all zero-import confirmed)
**Phase 1**: T015–T016 can run in parallel (different file paths)
**Phase 1**: T021–T022 can run in parallel (different constitution directories)
**Phase 6**: T039–T040 can run in parallel (different files)
**Phase 7**: T044–T045 can run in parallel (different sweep-manager files)
**Phase 7**: T052–T053 can run in parallel (database.ts vs map-helpers.ts)
**Phase 8**: T055–T057 can run in parallel after T055 (different files)
**Phase 9**: T059–T060 can run in parallel (different files)
**Phase 10**: T062–T063 can run in parallel (different test directories)
**Phase 11**: T070–T071 can run in parallel (different benchmark files)

---

## Implementation Strategy

### MVP First (Phase 1 Only — Dead Code Elimination)

1. Complete Phase 1: All 5 deletion batches with build verification
2. **STOP and VALIDATE**: `npm run build` + `npm run lint` + `git diff --stat` (≥11,000 lines removed)
3. This alone delivers US1 (P1) and immediately improves codebase navigability

### Incremental Delivery

1. Phase 1 → Dead code gone (US1) → build passes
2. Phase 2 → Kismet responsive (US2) → dashboard smooth
3. Phase 3 → GSM Evil responsive (US3) → scans don't freeze
4. Phases 4–6 → GPS/health/DB optimized (US6, US7, US8)
5. Phase 7 → Code cleaned (US4) → DRY patterns applied
6. Phase 8 → Chunks split (US5) → initial load faster
7. Phases 9–10 → GeoJSON + test cleanup
8. Phase 11 → Guardrails installed (US9) → no future regressions
9. Phase 12 → Full verification → all SC targets met

### Safety Checkpoints

After EVERY phase: `npm run build` MUST pass. If it doesn't, the last change broke something — revert and investigate before proceeding.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verification-First Protocol applies to ALL tasks: grep before delete, build after every batch, tests after every refactor
- The 21 oversized functions get `eslint-disable` annotations only — full refactoring is a separate future spec
- `eslint-plugin-sonarjs` installation (T058) requires explicit user approval per CLAUDE.md dependency rules
- Never run `npm run test:unit` (full suite) while Antigravity/VS Code is running — OOM risk on RPi 5. Use targeted `npx vitest run --no-coverage <specific files>` instead.
- Total: 76 tasks across 12 phases, mapping to 20 commits
