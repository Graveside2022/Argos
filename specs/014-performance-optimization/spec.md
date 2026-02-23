# Feature Specification: Performance Optimization & Complexity Reduction

**Feature Branch**: `014-performance-optimization`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Full codebase audit for performance, code verbosity/bloat, dead code, and algorithmic complexity. Make code clean and professional. Establish automated guardrails."

## Verification-First Protocol _(non-negotiable)_

**Every change in this feature MUST follow this protocol. No exceptions.**

1. **Before deleting any file**: Run `grep -rn "from.*<module-path>" src/ tests/` to confirm zero imports. Also check for dynamic imports, re-exports, and test references. If ANY import is found, the file is NOT dead — stop and reassess.
2. **Before refactoring any function**: Read the file. Read its tests. Read its callers. Understand the current behavior completely before changing a single line.
3. **After every deletion batch**: Run `npm run build`. If it fails, the deletion was wrong — revert immediately and investigate which file had a hidden consumer.
4. **After every refactor**: Run `npm run build` AND the file's associated tests. If tests fail, the refactor changed behavior — revert and fix.
5. **After all changes in a stream**: Run `npm run build` + `npm run lint` + targeted tests for modified files.
6. **No speculative deletions**: If unsure whether something is used, it stays. The build is the final arbiter, but grep is the first gate.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Dead Code Eliminated (Priority: P1)

All files with zero imports/consumers are removed from the codebase. Stale scripts referencing deleted infrastructure (hackrf_emitter, Docker-era Feature Creep Framework) are deleted. The orphaned HackRF client-side cluster (remnants of the deleted sweep UI page) is removed while preserving the server-side sweep-manager that powers live API routes. The constitution auditor infrastructure (~5,000 lines across 24 source files + test fixtures) — a one-time audit tool with zero runtime consumers — is removed entirely.

**Why this priority**: ~11,000+ lines of dead code create confusion during searches, inflate bundle analysis, and impose maintenance burden. The constitution infra is the single largest dead module (5,028 source lines + 2,155 test lines). Removing verified-dead files is zero-risk and immediately improves code navigability for any developer reading this codebase.

**Independent Test**: For each file targeted for deletion: (1) grep confirms zero imports, (2) delete the file, (3) `npm run build` passes. If the build breaks, the file was not dead — revert and investigate.

**Acceptance Scenarios**:

1. **Given** files with zero imports exist (verified list in plan document), **When** they are deleted, **Then** `npm run build` and `npm run lint` pass without errors
2. **Given** the HackRF sweep UI page was previously deleted but its client-side code remains (`src/lib/hackrf/stores.ts`, `api-legacy.ts`, `spectrum-*.ts`, etc.), **When** the orphaned client-side files are removed, **Then** `src/lib/hackrf/sweep-manager/` and `src/lib/server/hackrf/` remain untouched and the `/api/hackrf/` and `/api/rf/` routes continue to function
3. **Given** stale scripts reference nonexistent directories (`hackrf_emitter/`, old CSS paths, port 8006), **When** removed along with their npm script entries, **Then** all remaining npm scripts execute correctly
4. **Given** `src/lib/api/hackrf.ts` exports `SignalDetection` and `HackRFStatus` types used by 4 files via type-only imports, **When** the HackRF client cluster is deleted, **Then** no type extraction is needed because all 4 consuming files are also deleted in the same batch — the build never breaks at any intermediate step
5. **Given** the constitution auditor infrastructure (`src/lib/constitution/`, 24 files, ~5,000 lines) was a one-time audit tool with zero runtime consumers, **When** the entire directory and its tests (`tests/constitution/`) are deleted, **Then** `npm run build` passes and no runtime functionality is affected

---

### User Story 2 - Dashboard Remains Responsive During Active Kismet Session (Priority: P1)

An operator opens the Argos dashboard while Kismet is tracking 100+ wireless devices. The map, device table, and overview panels update smoothly every 10 seconds without visible UI stutter, dropped frames, or input lag. The operator can pan/zoom the map and switch tabs during device updates without the interface freezing.

**Why this priority**: The Kismet device update path fires 100+ individual `kismetStore.update()` calls per 10-second poll cycle (one per device in a forEach loop at `kismet-service.ts:170-183`). Each call triggers all derived GeoJSON rebuilds and DOM reconciliation across multiple subscribers. On RPi 5 this causes visible frame drops.

**Independent Test**: Start Kismet with 100+ devices visible. Open dashboard. Verify map pans smoothly during a device update cycle. Measure: the entire store update batch should complete in < 50ms total, with derived GeoJSON recalculating exactly once (not 100+ times).

**Acceptance Scenarios**:

1. **Given** Kismet is tracking 150 devices, **When** a device poll completes, **Then** the store updates in a single batch operation and all derived GeoJSON recalculates exactly once (not 150+ times)
2. **Given** 200 devices in the Kismet store, **When** distributions are requested, **Then** they are updated incrementally via maintained counters (not rebuilt from scratch by iterating the entire device Map)
3. **Given** the batch update is implemented, **When** existing Kismet-related tests run, **Then** all tests pass with identical observable behavior

---

### User Story 3 - GSM Evil Scans Don't Freeze the Browser (Priority: P1)

An operator runs a GSM Evil frequency scan. Progress messages stream in rapidly (multiple per second). The browser remains responsive — the scan progress log scrolls smoothly, other tabs remain interactive, and no main-thread blocking occurs from state serialization.

**Why this priority**: Currently every scan progress message triggers `JSON.stringify` of the entire GSM Evil state (up to 500 progress lines + 1000 IMSIs) followed by a synchronous `localStorage.setItem` call. This blocks the main thread multiple times per second during active scans.

**Independent Test**: Run a GSM Evil scan across 20 frequencies. Verify the UI remains interactive during scanning. Measure: no localStorage write should serialize the transient progress log, and writes should be debounced to at most once per 2 seconds.

**Acceptance Scenarios**:

1. **Given** a GSM scan is running, **When** progress messages arrive rapidly, **Then** the transient progress log is NOT serialized to localStorage
2. **Given** the GSM Evil store receives 10 updates/second, **When** state persistence triggers, **Then** writes are debounced to at most once per 2 seconds
3. **Given** a scan completes with 60 results, **When** results are persisted, **Then** only structural data (scan results, captured IMSIs, tower locations, selected frequency) is serialized — not the progress log or abort controller state
4. **Given** the persistence is refactored, **When** the GSM Evil page is reloaded, **Then** all previously persisted scan results and IMSIs are restored correctly (no data loss from debouncing)

---

### User Story 4 - Code Is Clean and Professional (Priority: P2)

Verbose patterns (copy-paste boilerplate, passthrough wrappers, over-documented trivial methods, redundant store helpers) are replaced with idiomatic, DRY alternatives. The goal is not line-count minimization — it is ensuring every line earns its place and the code reads clearly to senior developers.

**Why this priority**: ~1,500 lines of structural bloat across stores, sweep managers, data files, and tests. This bloat increases cognitive load when reading the code, makes search results noisy, and hides the actual logic behind repetitive boilerplate.

**Independent Test**: For each refactored file: (1) read the current code and its tests, (2) refactor, (3) run associated tests — all must pass with identical observable behavior, (4) run `npm run build`.

**Acceptance Scenarios**:

1. **Given** 10 identical single-field store setters in `gsm-evil-store.ts`, **When** refactored, **Then** replaced with a generic pattern that reduces repetition while preserving identical store update behavior
2. **Given** copy-paste boilerplate patterns across sweep-manager files (duplicated types, passthrough wrappers, redundant cleanup methods), **When** consolidated, **Then** single source of truth for shared types and reduced method count — all sweep-manager behavior unchanged
3. **Given** 80+ tool entries across 5 `offnet-*.ts` files each with 7 identical default fields, **When** refactored, **Then** a tool factory function eliminates the repetition while producing identical data structures
4. **Given** duplicate utility functions exist across hardware managers (`getBlockingProcesses`/`killBlockingProcesses` in hackrf-manager + alfa-manager, `detectHackRF` in hackrf-manager + usb-sdr-detectors) and sweep-manager (`convertToMHz`/`convertToHz` in sweep-utils + frequency-utils), **When** consolidated to single implementations, **Then** all callers use the canonical copy and behavior is unchanged
5. **Given** any file is refactored, **When** its tests run, **Then** all tests pass without modification (if tests need changes, the refactor changed behavior — stop and reassess)

---

### User Story 5 - Dashboard Loads Within Performance Budget (Priority: P2)

The dashboard page loads within the existing 3-second budget on RPi 5, with heavy libraries (map renderer, military symbology) loaded on-demand rather than eagerly. The initial JavaScript payload is reduced by deferring non-essential vendor chunks.

**Why this priority**: Currently `maplibre-gl` (~800KB gzipped) and `mil-sym-ts-web` are statically imported at module level. No manual chunk splitting is configured in `vite.config.ts`. This inflates the initial bundle and slows first-paint on RPi 5.

**Independent Test**: Run `npm run build` and check output chunk sizes. The map library and military symbology library should be in separate chunks loaded only when the map component mounts.

**Acceptance Scenarios**:

1. **Given** a user navigates to the dashboard, **When** the page loads, **Then** map and military symbology libraries load only after the initial render (not in the main bundle)
2. **Given** the Vite build runs, **When** output is analyzed, **Then** maplibre-gl, mil-sym-ts-web, and xterm are in separate vendor chunks (not bundled into the main chunk)
3. **Given** chunk splitting is configured, **When** the dashboard loads, **Then** the map still renders correctly and all existing functionality works

---

### User Story 6 - GPS Overlay Skips Unnecessary Computation (Priority: P2)

The GPS accuracy circle and detection range rings only recalculate when the GPS position actually changes, not on every 2-second poll tick. If the device is stationary, the expensive trigonometric computations (5 rings x 48 points = 240 trig operations per tick) are skipped entirely.

**Why this priority**: GPS polls every 2 seconds. Each poll rebuilds accuracy GeoJSON (48-point circle) and detection range GeoJSON (5 concentric rings x 48 points = 240 trig ops) regardless of whether the position changed. On a stationary RPi 5, this is pure CPU waste ~30 times per minute.

**Independent Test**: With GPS running at a fixed position, verify that GeoJSON rebuild only occurs when lat/lng/accuracy actually change. The rebuild count should be 0/minute when stationary.

**Acceptance Scenarios**:

1. **Given** GPS position hasn't changed since last poll, **When** a new GPS update arrives, **Then** accuracy and detection range GeoJSON are NOT recalculated
2. **Given** GPS position changes by > 1 meter, **When** the update arrives, **Then** GeoJSON IS recalculated with the new position
3. **Given** GPS returns null coordinates, **When** update arrives, **Then** treated as "no change" (skip rebuild, keep previous GeoJSON)

---

### User Story 7 - Health Checks Return Faster (Priority: P3)

The GSM Evil health check endpoint returns results in the time of the slowest individual check, not the sum of all checks. Independent subprocess-based health checks run in parallel.

**Why this priority**: Currently 4 sequential `await` calls on entirely independent I/O operations in `gsm-evil-health-service.ts:319-338`. Total latency = sum of all 4 checks instead of max.

**Independent Test**: Call the GSM Evil health endpoint and measure response time. Should be roughly equal to the slowest individual check (not their sum).

**Acceptance Scenarios**:

1. **Given** the health check endpoint is called, **When** all 4 checks run, **Then** independent checks execute in parallel via `Promise.all`
2. **Given** one check takes 500ms and another takes 200ms, **When** the endpoint responds, **Then** total time is ~500ms (not ~700ms)
3. **Given** one check fails, **When** other checks succeed, **Then** the health response still includes results from all checks (one failure doesn't prevent others from reporting)

---

### User Story 8 - Database Uses Optimal Indexes (Priority: P3)

Spatial signal queries that filter by location AND sort by timestamp can satisfy both the filter and the sort from a single composite index, avoiding a post-filter sort step on large result sets.

**Why this priority**: The current spatial index doesn't include timestamp. SQLite must sort filtered results in a separate step. Adding a composite index is a low-risk, additive-only migration.

**Independent Test**: Run `EXPLAIN QUERY PLAN` on the spatial query before and after the index addition. Verify the sort step disappears.

**Acceptance Scenarios**:

1. **Given** a spatial query with `ORDER BY timestamp DESC`, **When** executed after migration, **Then** the query plan uses the composite spatial+timestamp index without a separate SORT step
2. **Given** the migration runs, **When** existing data is queried, **Then** all existing queries return identical results (the index is additive, not behavioral)

---

### User Story 9 - Automated Guardrails Prevent Regressions (Priority: P2)

The project's ESLint configuration includes cyclomatic and cognitive complexity rules that flag overly complex functions at lint time. Performance benchmark tests catch throughput regressions. New code that exceeds complexity thresholds fails the lint check.

**Why this priority**: Without guardrails, the 21 existing oversized functions (some 375 lines) will be joined by more. Automated enforcement catches the problem at development time, not after deployment.

**Independent Test**: Run `npm run lint` — verify complexity rules are active. Write a test function with cyclomatic complexity > 15 and verify it triggers a lint error.

**Acceptance Scenarios**:

1. **Given** a function with cyclomatic complexity > 15, **When** ESLint runs, **Then** a complexity violation is reported
2. **Given** a function with cognitive complexity > 20, **When** ESLint runs, **Then** a cognitive complexity violation is reported
3. **Given** existing code that exceeds thresholds (21 known oversized functions), **When** ESLint runs, **Then** pre-existing violations are annotated with `eslint-disable` + tracking comments and do NOT block the build
4. **Given** the ESLint plugin is unavailable or incompatible, **When** lint runs, **Then** it degrades gracefully (warns, does not hard-fail the entire lint pass)

---

### Edge Cases

- What happens when Kismet returns 0 devices? Batch update should be a no-op — no empty store write.
- What happens when GPS returns null coordinates? Memoization treats null as "no change" — skip rebuild, keep previous GeoJSON.
- What happens when localStorage is full? Debounced persist should catch `QuotaExceededError` and log a warning, not crash.
- What happens if the ESLint complexity plugin is unavailable? Lint should degrade gracefully (warn, not error).
- What happens when deleting the HackRF client cluster? The `sweep-manager/` subdirectory MUST remain untouched — it powers live `/api/hackrf/` and `/api/rf/` routes.
- What happens when a file claimed as "dead" actually has a hidden consumer (dynamic import, eval, string-based require)? The incremental `npm run build` after each deletion batch catches this immediately — revert and investigate.

## Requirements _(mandatory)_

### Functional Requirements

**Dead Code Elimination:**

- **FR-001**: All files confirmed to have zero imports MUST be deleted, including the constitution auditor infrastructure (`src/lib/constitution/` + `tests/constitution/`)
- **FR-002**: The orphaned HackRF client-side cluster MUST be removed; `src/lib/hackrf/sweep-manager/` and `src/lib/server/hackrf/` MUST be preserved untouched
- **FR-003**: Dead npm scripts (`dev:full`, `framework:*`, `kill-all`) MUST be removed from `package.json`
- **FR-004**: `npm run build` MUST pass after every individual deletion batch — no batch deletions without intermediate build verification

**Performance Optimization:**

- **FR-005**: System MUST batch Kismet device store updates into a single atomic update per poll cycle (not per-device updates in a forEach loop)
- **FR-006**: System MUST debounce GSM Evil state persistence to at most once per 2 seconds
- **FR-007**: System MUST NOT serialize transient state (scan progress log, abort controllers) to localStorage
- **FR-008**: System MUST memoize GPS-derived GeoJSON computations, skipping recalculation when position/accuracy are unchanged
- **FR-009**: Vite config MUST split maplibre-gl, mil-sym-ts-web, and xterm into separate deferred vendor chunks
- **FR-010**: Independent health check operations MUST execute concurrently via `Promise.all`
- **FR-011**: Database MUST have a composite spatial+timestamp index for signal queries

**Code Quality:**

- **FR-012**: Redundant copy-paste patterns (identical store setters, tool entry boilerplate, duplicate utility functions across hardware managers and sweep-manager) MUST be replaced with DRY alternatives (factories, helpers, lookup tables, consolidated single-source functions)
- **FR-013**: ESLint configuration MUST report cyclomatic complexity (max 15) and cognitive complexity (max 20) at lint time (warn level — pre-existing violations are annotated, not blocked)
- **FR-014**: Pre-existing complexity violations MUST be annotated with `eslint-disable` comments referencing a tracking issue
- **FR-015**: Performance benchmark tests MUST cover the optimized hot paths (Kismet batch update, GeoJSON build time, GSM Evil persistence throughput)

**Safety:**

- **FR-016**: Every refactored file's existing tests MUST continue to pass without modification — if tests need changes, the refactor altered behavior and must be reassessed
- **FR-017**: The full `npm run build` MUST pass at every intermediate step — never accumulate multiple unverified changes

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 11,000 lines of verified dead code removed including constitution infra (measured by `git diff --stat` against the branch point)
- **SC-002**: At least 1,000 lines of structural bloat reduced through DRY refactoring (measured by `git diff --stat`)
- **SC-003**: Kismet batch update (150 devices) completes store update + all derived recalculations in < 50ms total
- **SC-004**: GSM Evil scan with 500 progress messages produces at most 5 localStorage writes (not 500)
- **SC-005**: GPS GeoJSON rebuilds 0 times per minute when the device is stationary (was ~30/minute)
- **SC-006**: Initial dashboard JS payload decreases by at least 20% (map and symbology chunks deferred)
- **SC-007**: GSM Evil health check endpoint latency reduces by at least 30% (parallel vs sequential)
- **SC-008**: All new functions pass cyclomatic complexity <= 15 and cognitive complexity <= 20 at lint time
- **SC-009**: All existing tests continue to pass — zero test regressions
- **SC-010**: `npm run build` passes after every deletion and refactoring step — never broken at any intermediate point

## Assumptions

- `eslint-plugin-sonarjs` is available and compatible with the project's ESLint flat config (will verify before installing)
- `maplibre-gl` can be dynamically imported without breaking SSR (the dashboard route already has `ssr: false`)
- All files claimed as dead truly have zero consumers — grep verification is the first gate, `npm run build` is the final arbiter
- Structural refactoring preserves identical observable behavior — the test suite is the verification mechanism
- The 21 existing oversized functions receive `eslint-disable` annotations, NOT full refactoring (that is a separate future spec)
- `better-sqlite3`'s internal statement cache handles the `updateSignal` `prepare()` adequately; caching in the statements Map is a minor optimization
