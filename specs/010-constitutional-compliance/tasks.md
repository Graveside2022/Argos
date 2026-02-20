# Tasks: Constitutional Compliance Remediation

**Input**: Design documents from `/specs/010-constitutional-compliance/`
**Prerequisites**: spec.md, plan.md, full codebase audit (2026-02-20)

**Tests**: Not explicitly requested — tests omitted. Verification is via grep/search zero-count checks.

**Organization**: Tasks are grouped by user story (constitutional article). Each phase can be committed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Branch preparation and document alignment (already done)

- [ ] T001 Verify branch `010-constitutional-compliance` checked out from `dev` and constitution/CLAUDE.md fixes committed

**Checkpoint**: Branch ready, governing documents aligned

---

## Phase 2: User Story 1 — Deterministic Builds (Priority: P0) 🎯 MVP

**Goal**: Pin all 64 dependency versions to exact — zero `^` or `~` in package.json

**Independent Test**: `grep -E '[\^~]' package.json | grep -v '//' | wc -l` must return 0

- [ ] T002 [US1] Remove `^` and `~` prefixes from all devDependencies in `package.json`
- [ ] T003 [US1] Remove `^` and `~` prefixes from all dependencies in `package.json`
- [ ] T004 [US1] Run `npm install` and verify `package-lock.json` regenerates cleanly
- [ ] T005 [US1] Run `npm run typecheck && npm run test:unit && npm run build` to verify no breakage

**Checkpoint**: SC-001 verified — zero floating dependency versions

---

## Phase 3: User Story 2 — Production Log Hygiene (Priority: P1)

**Goal**: Replace all 224 console.log/warn/error calls with structured logger — zero raw console statements

**Independent Test**: `grep -rE 'console\.(log|warn|error)\(' src/lib/ src/routes/ --include='*.ts' --include='*.svelte' | grep -v logger.ts | wc -l` must return 0

### Implementation for User Story 2

Logger infrastructure (`src/lib/utils/logger.ts`) already exists with level control, context, rate limiting. Import pattern: `import { logger } from '$lib/utils/logger'`.

#### Server Services (src/lib/server/services/) — 13 files

- [ ] T006 [P] [US2] Migrate console calls in `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts`
- [ ] T007 [P] [US2] Migrate console calls in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts`
- [ ] T008 [P] [US2] Migrate console calls in `src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts`
- [ ] T009 [P] [US2] Migrate console calls in `src/lib/server/services/gsm-evil/gsm-scan-service.ts`
- [ ] T010 [P] [US2] Migrate console calls in `src/lib/server/services/gsm-evil/gsm-monitor-service.ts`
- [ ] T011 [P] [US2] Migrate console calls in `src/lib/server/services/kismet/kismet-control-service.ts` and `kismet-control-service-extended.ts`
- [ ] T012 [P] [US2] Migrate console calls in `src/lib/server/services/hardware/hardware-details-service.ts`
- [ ] T013 [P] [US2] Migrate console calls in `src/lib/server/services/cell-towers/cell-tower-service.ts`
- [ ] T014 [P] [US2] Migrate console calls in `src/lib/server/services/gps/gps-position-service.ts`

#### Hardware & Infrastructure (src/lib/server/) — 12 files

- [ ] T015 [P] [US2] Migrate console calls in `src/lib/server/hardware/detection/hardware-detector.ts`, `network-detector.ts`, `serial-detector.ts`, `usb-detector.ts`
- [ ] T016 [P] [US2] Migrate console calls in `src/lib/server/hardware/hardware-registry.ts` and `resource-manager.ts`
- [ ] T017 [P] [US2] Migrate console calls in `src/lib/server/kismet/service-manager.ts`, `fusion-controller.ts`, `kismet-proxy.ts`
- [ ] T018 [P] [US2] Migrate console calls in `src/lib/server/websocket-server.ts`
- [ ] T019 [P] [US2] Migrate console calls in `src/lib/server/agent/runtime.ts`
- [ ] T020 [P] [US2] Migrate console calls in `src/lib/server/db/geo.ts` and `src/lib/server/db/migrations/run-migrations.ts`
- [ ] T021 [P] [US2] Migrate console calls in `src/lib/server/security/error-response.ts` and `safe-json.ts`
- [ ] T022 [P] [US2] Migrate console calls in `src/lib/server/tak/TakService.ts`

#### MCP Servers (src/lib/server/mcp/) — 8 files

- [ ] T023 [P] [US2] Migrate console calls in `src/lib/server/mcp/dynamic-server.ts` and `config-generator.ts`
- [ ] T024 [P] [US2] Migrate console calls in `src/lib/server/mcp/shared/base-server.ts`
- [ ] T025 [P] [US2] Migrate console calls in `src/lib/server/mcp/servers/system-inspector.ts`, `database-inspector.ts`, `streaming-inspector.ts`
- [ ] T026 [P] [US2] Migrate console calls in `src/lib/server/mcp/servers/api-debugger.ts`, `hardware-debugger.ts`, `gsm-evil-server.ts`, `test-runner.ts`

#### Client-Side Libraries (src/lib/) — 12 files

- [ ] T027 [P] [US2] Migrate console calls in `src/lib/tactical-map/hackrf-service.ts`, `kismet-service.ts`, `gps-service.ts`
- [ ] T028 [P] [US2] Migrate console calls in `src/lib/websocket/base.ts`
- [ ] T029 [P] [US2] Migrate console calls in `src/lib/map/MapSourceParser.ts` and `src/lib/map/layers/SymbolLayer.ts`
- [ ] T030 [P] [US2] Migrate console calls in `src/lib/hackrf/api-legacy.ts` and `src/lib/kismet/websocket.ts`
- [ ] T031 [P] [US2] Migrate console calls in `src/lib/utils/cot-parser.ts` and `src/lib/utils/validation-error.ts`
- [ ] T032 [P] [US2] Migrate console calls in `src/lib/stores/dashboard/terminal-store.ts`, `tools-store.ts`, `gsm-evil-store.ts`
- [ ] T033 [P] [US2] Migrate console calls in `src/lib/types/signal.ts`

#### Svelte Components (src/lib/components/) — 2 files

- [ ] T034 [P] [US2] Migrate console calls in `src/lib/components/dashboard/tak/TakConfigView.svelte`
- [ ] T035 [P] [US2] Migrate console calls in `src/lib/components/dashboard/panels/GsmEvilPanel.svelte` and `src/lib/components/dashboard/TerminalTabContent.svelte`

#### API Routes (src/routes/) — 40 files

- [ ] T036 [P] [US2] Migrate console calls in `src/routes/api/gsm-evil/*.ts` (8 route files: activity, control, frames, health, imsi, imsi-data, intelligent-scan, live-frames, status, tower-location)
- [ ] T037 [P] [US2] Migrate console calls in `src/routes/api/hackrf/*.ts` (3 route files: start-sweep, status, stop-sweep)
- [ ] T038 [P] [US2] Migrate console calls in `src/routes/api/kismet/*.ts` (4 route files: devices, start, status, stop)
- [ ] T039 [P] [US2] Migrate console calls in `src/routes/api/rf/*.ts` (5 route files: data-stream, emergency-stop, start-sweep, status, stop-sweep)
- [ ] T040 [P] [US2] Migrate console calls in `src/routes/api/signals/*.ts` (4 route files: batch, cleanup, statistics, +server)
- [ ] T041 [P] [US2] Migrate console calls in `src/routes/api/tak/*.ts` (4 route files: config, enroll, import-package, truststore)
- [ ] T042 [P] [US2] Migrate console calls in `src/routes/api/system/*.ts` (4 route files: docker/[action], info, metrics, stats)
- [ ] T043 [P] [US2] Migrate console calls in `src/routes/api/hardware/scan/+server.ts`, `src/routes/api/terminal/shells/+server.ts`, `src/routes/api/openwebrx/control/+server.ts`, `src/routes/api/db/cleanup/+server.ts`, `src/routes/api/gps/location/+server.ts`
- [ ] T044 [P] [US2] Migrate console calls in `src/routes/gsm-evil/+page.svelte`

#### Verification

- [ ] T045 [US2] Run `npm run typecheck && npm run build` after all console migrations
- [ ] T046 [US2] Verify zero console.log/warn/error remain: `grep -rE 'console\.(log|warn|error)\(' src/lib/ src/routes/ --include='*.ts' --include='*.svelte' | grep -v logger.ts`

**Checkpoint**: SC-002 verified — zero console statements in production code

---

## Phase 4: User Story 3 — Svelte 5 Runes Compliance (Priority: P1)

**Goal**: Eliminate all 16 `.subscribe()` calls and 14 `$:` declarations

**Independent Test**: `grep -r '\.subscribe(' src/ --include='*.ts' --include='*.svelte' | grep -v node_modules | grep -v CLAUDE.md | wc -l` must return 0; `grep '\$:' src/routes/gsm-evil/+page.svelte | wc -l` must return 0

### Subscribe Migration (6 files)

- [ ] T047 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/stores/dashboard/dashboard-store.ts` (2 calls — localStorage persistence)
- [ ] T048 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/stores/dashboard/terminal-store.ts` (1 call — localStorage persistence)
- [ ] T049 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/stores/dashboard/tools-store.ts` (3 calls — localStorage persistence, tool state)
- [ ] T050 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/map/VisibilityEngine.ts` (visibility mode subscription)
- [ ] T051 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/tactical-map/hackrf-service.ts` (2 calls — spectrum data, hackrf state)
- [ ] T052 [P] [US3] Replace `.subscribe()` with `get()` in `src/lib/tactical-map/kismet-service.ts` (5 calls — kismet state reads)

### Reactive Declaration Migration (1 file)

- [ ] T053 [US3] Convert all 14 `$:` declarations to `$derived()`/`$effect()` in `src/routes/gsm-evil/+page.svelte`

### Verification

- [ ] T054 [US3] Run `npm run typecheck && npm run build` after runes migration
- [ ] T055 [US3] Verify zero subscribe/reactive: confirm `.subscribe(` count is 0 and `$:` count is 0

**Checkpoint**: SC-003 and SC-004 verified — zero subscribe calls, zero $: declarations

---

## Phase 5: User Story 4 — Boolean Naming (Priority: P2)

**Goal**: Rename ~20 boolean properties to use `is/has/should` prefix across all type definitions and consumers

**Independent Test**: Grep for boolean interface properties without is/has/should prefix — count must be zero

### Type Definition Updates

- [ ] T056 [P] [US4] Rename boolean props in `src/lib/hackrf/stores.ts` (active→isActive, connected→isConnected, connecting→isConnecting) and update all consumers
- [ ] T057 [P] [US4] Rename boolean props in `src/lib/stores/connection.ts` (connected→isConnected, connecting→isConnecting, running→isRunning) and update all consumers
- [ ] T058 [P] [US4] Rename boolean props in `src/lib/types/tools.ts` (installed→isInstalled, showControls→shouldShowControls) and update all consumers
- [ ] T059 [P] [US4] Rename boolean props in `src/lib/types/system.ts` (charging→isCharging) and update all consumers
- [ ] T060 [P] [US4] Rename boolean props in `src/lib/types/tak.ts` (connectOnStartup→shouldConnectOnStartup) and update all consumers
- [ ] T061 [P] [US4] Rename boolean props in `src/lib/types/service-responses.ts` (running→isRunning, connected→isConnected, sweeping→isSweeping) and update all consumers
- [ ] T062 [P] [US4] Rename boolean props in `src/lib/api/hackrf.ts` (connected→isConnected, sweeping→isSweeping) and update all consumers
- [ ] T063 [P] [US4] Rename boolean props in `src/lib/server/hardware/types.ts` (available→isAvailable) and update all consumers
- [ ] T064 [P] [US4] Rename boolean props in `src/lib/kismet/api.ts` (running→isRunning, active→isActive) and update all consumers
- [ ] T065 [P] [US4] Rename boolean props in `src/lib/server/mcp/dynamic-server.ts` (installed→isInstalled) and update all consumers
- [ ] T066 [P] [US4] Rename boolean props in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts` (running→isRunning) and update all consumers
- [ ] T067 [P] [US4] Rename boolean props in `src/lib/hackrf/sweep-manager/process-manager.ts` (detached→isDetached) and update all consumers
- [ ] T068 [P] [US4] Rename boolean props in `src/lib/types/gps.ts` (used→isUsed) and update all consumers

### Verification

- [ ] T069 [US4] Run `npm run typecheck && npm run build` after all boolean renames
- [ ] T070 [US4] Verify zero boolean naming violations remain (excluding third-party types)

**Checkpoint**: SC-005 verified — zero unprefixed boolean properties

---

## Phase 6: User Story 5 — Theme Color Extraction (Priority: P2)

**Goal**: Extract all hardcoded hex colors from 28 Svelte files into CSS custom properties

**Independent Test**: `grep -rE '#[0-9a-fA-F]{3,8}' src/lib/components/ src/routes/ --include='*.svelte' | grep -v 'var(--' | wc -l` must return 0

### Theme Definition

- [ ] T071 [US5] Define comprehensive CSS custom properties for the Palantir/cyberpunk palette in `src/app.css` (@theme layer) — accent, surface, border, text, status, and ANSI terminal colors

### Component Migrations (grouped by area)

- [ ] T072 [P] [US5] Replace hex colors in `src/lib/components/dashboard/DashboardMap.svelte` with CSS custom properties
- [ ] T073 [P] [US5] Replace hex colors in `src/lib/components/dashboard/TopStatusBar.svelte` with CSS custom properties
- [ ] T074 [P] [US5] Replace hex colors in `src/lib/components/dashboard/TerminalPanel.svelte` with CSS custom properties
- [ ] T075 [P] [US5] Replace hex colors in `src/lib/components/dashboard/TerminalTabContent.svelte` with CSS custom properties (ANSI palette)
- [ ] T076 [P] [US5] Replace hex colors in `src/lib/components/dashboard/panels/DevicesPanel.svelte` with CSS custom properties
- [ ] T077 [P] [US5] Replace hex colors in `src/lib/components/dashboard/panels/OverviewPanel.svelte` with CSS custom properties
- [ ] T078 [P] [US5] Replace hex colors in `src/lib/components/dashboard/panels/LayersPanel.svelte` with CSS custom properties
- [ ] T079 [P] [US5] Replace hex colors in `src/lib/components/dashboard/map/DeviceOverlay.svelte` and `TowerPopup.svelte` with CSS custom properties
- [ ] T080 [P] [US5] Replace hex colors in remaining ~19 Svelte files with CSS custom properties (batch by directory)

### Verification

- [ ] T081 [US5] Run `npm run typecheck && npm run build` after color extraction
- [ ] T082 [US5] Visual verification — confirm pixel-identical appearance in browser
- [ ] T083 [US5] Verify zero hardcoded hex colors remain in component files

**Checkpoint**: SC-006 verified — zero hardcoded hex colors in components

---

## Phase 7: User Story 6 — Component Decomposition (Priority: P2)

**Goal**: Split 4 oversized dashboard components to under 300 lines each

**Independent Test**: `wc -l` on all 4 target files must return <300

- [ ] T084 [P] [US6] Decompose `src/lib/components/dashboard/panels/DevicesPanel.svelte` (938 lines) into focused subcomponents in `src/lib/components/dashboard/panels/devices/`
- [ ] T085 [P] [US6] Decompose `src/lib/components/dashboard/DashboardMap.svelte` (915 lines) into focused subcomponents in `src/lib/components/dashboard/map/`
- [ ] T086 [P] [US6] Decompose `src/lib/components/dashboard/TopStatusBar.svelte` (794 lines) into focused subcomponents in `src/lib/components/dashboard/status/`
- [ ] T087 [P] [US6] Decompose `src/lib/components/dashboard/panels/OverviewPanel.svelte` (769 lines) into focused subcomponents in `src/lib/components/dashboard/panels/overview/`
- [ ] T088 [US6] Run `npm run typecheck && npm run build` after decomposition
- [ ] T089 [US6] Visual verification — confirm all dashboard functionality works with no regression

**Checkpoint**: SC-007 verified — all 4 components under 300 lines

---

## Phase 8: User Story 7 — Test Co-location & TODOs (Priority: P3)

**Goal**: Co-locate unit tests with source files; track all TODOs with issue references

**Independent Test**: `find src/ -name '*.test.ts' | wc -l` must be > 0; `grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ | grep -v 'TODO(' | wc -l` must return 0

### Test Co-location

- [ ] T090 [P] [US7] Move unit tests from `tests/unit/` to co-locate with source in `src/` (e.g., `tests/unit/server/services/kismet.service.test.ts` → `src/lib/server/services/kismet/kismet-control-service.test.ts`)
- [ ] T091 [P] [US7] Move schema tests from `tests/lib/schemas/` to co-locate in `src/lib/schemas/`
- [ ] T092 [US7] Update vitest config if needed to discover `.test.ts` files in `src/`
- [ ] T093 [US7] Verify all moved tests still pass: `npm run test:unit`

### TODO Tracking

- [ ] T094 [P] [US7] Add issue references to TODOs in `src/lib/constitution/auditor.ts` and 4 validator stubs
- [ ] T095 [P] [US7] Add issue references to TODOs in `src/lib/server/db/device-service.ts`, `network-repository.ts`, `cleanup-service.ts`
- [ ] T096 [US7] Verify zero bare TODOs remain: `grep -rn 'TODO\|FIXME' src/ | grep -v 'TODO(' | grep -v 'FIXME('`

**Checkpoint**: SC-008 and SC-009 verified — tests co-located, TODOs tracked

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all phases

- [ ] T097 Run full verification suite: `npm run typecheck && npm run test:unit && npm run test:security && npm run build`
- [ ] T098 Run constitutional audit: `npx tsx scripts/run-audit.ts`
- [ ] T099 Commit all phases and prepare for merge to `dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — immediate
- **Phase 2 (P0 Dependencies)**: No dependencies — can start immediately
- **Phase 3 (P1 Logger)**: Independent — can run in parallel with Phase 2
- **Phase 4 (P1 Svelte 5)**: Independent — can run in parallel with Phase 2/3
- **Phase 5 (P2 Boolean)**: Independent — can run in parallel with Phases 2-4
- **Phase 6 (P2 Colors)**: Independent — can run in parallel with Phases 2-5
- **Phase 7 (P2 Decomposition)**: Should run AFTER Phase 6 (color extraction changes same files)
- **Phase 8 (P3 Tests/TODOs)**: Independent — can run in parallel
- **Phase 9 (Polish)**: Depends on ALL phases complete

### User Story Dependencies

- **US1 (P0 Deps)**: No dependencies on other stories
- **US2 (P1 Logger)**: No dependencies — logger.ts already exists
- **US3 (P1 Svelte 5)**: No dependencies on other stories
- **US4 (P2 Boolean)**: No dependencies — may overlap with US2 files but different changes
- **US5 (P2 Colors)**: No dependencies on other stories
- **US6 (P2 Decomposition)**: Should follow US5 (same component files)
- **US7 (P3 Tests)**: No dependencies on other stories

### Parallel Opportunities

**Maximum parallelism** (6 agents):
- Agent 1: US1 (T002-T005) — 10 min
- Agent 2: US2 server services (T006-T014) — 30 min
- Agent 3: US2 routes (T036-T044) — 30 min
- Agent 4: US3 subscribe migration (T047-T055) — 20 min
- Agent 5: US4 boolean naming (T056-T070) — 30 min
- Agent 6: US7 test co-location (T090-T096) — 15 min

Then sequentially: US5 colors → US6 decomposition → verification

---

## Implementation Strategy

### MVP First (P0 Only)

1. Complete Phase 2: Pin dependencies (T002-T005)
2. **STOP and VALIDATE**: Deterministic builds confirmed
3. Can deploy immediately — highest-impact, lowest-risk change

### Incremental Delivery

1. P0: Pin deps → commit → deploy
2. P1: Logger + Svelte 5 → commit → deploy
3. P2: Boolean + Colors + Decomposition → commit → deploy
4. P3: Test co-location + TODOs → commit → deploy
5. Each phase adds compliance without breaking previous phases

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All console migrations follow the same pattern: `import { logger } from '$lib/utils/logger'` then replace `console.log(msg)` → `logger.info(msg, { service: 'name' })`
- Boolean renames must update ALL consumers — use TypeScript compiler errors as guide
- Color extraction preserves visual appearance — CSS custom property fallbacks match current hex values
- Component decomposition preserves public API — only internal structure changes
- Test moves must update import paths if any tests reference relative paths
