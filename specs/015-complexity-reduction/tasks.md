# Tasks: Complexity Reduction

**Input**: Design documents from `/specs/015-complexity-reduction/`
**Prerequisites**: plan.md, spec.md, research.md

**Organization**: Tasks are grouped by file proximity clusters per plan.md execution order. Each cluster can be independently verified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=critical 25+, US2=moderate 16-24, US3=borderline 11-15)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Verify current violation inventory and establish baseline

- [ ] T001 Run full complexity audit and record baseline violation count with `npx eslint src/ --config config/eslint.config.js 2>&1 | grep -c complexity`
- [ ] T002 Verify all existing tests pass before refactoring with `npx vitest run --no-coverage`

**Checkpoint**: Baseline established, all tests green

---

## Phase 2: Dashboard Map Cluster (Priority: P1) — Critical

**Goal**: Refactor the highest-complexity functions in the dashboard map subsystem

**Independent Test**: `npx eslint src/lib/components/dashboard/map/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T003 [US1] Refactor `buildDeviceGeoJSON` (cyclomatic 35) in src/lib/components/dashboard/map/map-geojson.ts — extract `collectVisibilityCandidates`, `buildFeatureFromDevice`, and `classifyDeviceType` helpers
- [ ] T004 [US2] Refactor inner arrow function (cyclomatic 21) in src/lib/components/dashboard/map/map-geojson.ts:160 — extract coordinate-building and property-assembly helpers
- [ ] T005 [US1] Refactor `handleDeviceClick` (cyclomatic 29) in src/lib/components/dashboard/map/map-handlers.ts:38 — extract `resolveDevicePopupContent`, `findClickedDevice` helpers
- [ ] T006 [US2] Refactor `handleTowerClick` (cyclomatic 20) in src/lib/components/dashboard/map/map-handlers.ts:107 — extract `buildTowerPopupState` helper
- [ ] T007 Verify dashboard map cluster: lint + build + vitest for map-related tests

**Checkpoint**: Dashboard map cluster — all functions ≤10 complexity

---

## Phase 3: Server Services Cluster (Priority: P1/P2) — Critical + Moderate

**Goal**: Refactor complex server-side service functions

**Independent Test**: `npx eslint src/lib/server/services/ src/lib/server/hardware/ src/lib/server/kismet/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T008 [US1] Refactor `getHardwareDetails` (cognitive 51, cyclomatic 34) in src/lib/server/services/hardware/hardware-details-service.ts:112 — extract `detectHackRF`, `detectAlfa`, `detectGPS`, `detectUSRP`, `detectKismet` hardware-specific helpers
- [ ] T009 [US2] Refactor secondary function (cognitive 23, cyclomatic 19) in src/lib/server/services/hardware/hardware-details-service.ts:287 — extract focused helpers
- [ ] T010 [P] [US1] Refactor `fetchKismetDevices` (cyclomatic 25) in src/lib/server/services/kismet.service.ts:290 — extract `parseKismetResponse`, `mapDeviceFields` helpers
- [ ] T011 [P] [US2] Refactor inner function (cyclomatic 18) in src/lib/server/services/kismet.service.ts:226 — simplify conditional chain
- [ ] T012 [P] [US1] Refactor `manageService` (cognitive 32) in src/lib/server/kismet/service-manager.ts:96 — extract `checkServiceStatus`, `startService`, `stopService` helpers
- [ ] T013 [P] [US2] Refactor `transformProxy` (cognitive 22, cyclomatic 18) in src/lib/server/kismet/kismet-proxy-transform.ts:45 — use lookup table for field mapping
- [ ] T014 [P] [US2] Refactor secondary function (cognitive 23) in src/lib/server/kismet/kismet-proxy-transform.ts:105 — extract helper
- [ ] T015 [P] [US1] Refactor `detectNetworkUSRP` (cognitive 31, cyclomatic 16) in src/lib/server/hardware/detection/network-detector.ts:18 — extract `probeUSRPDevice`, `parseUSRPResponse` helpers
- [ ] T016 [P] [US1] Refactor `detectUSBSDR` (cognitive 28) in src/lib/server/hardware/detection/usb-sdr-detectors.ts:70 — extract per-device-type detection helpers
- [ ] T017 Verify server services cluster: lint + build

**Checkpoint**: Server services — all functions ≤10 complexity

---

## Phase 4: API Route Handlers (Priority: P2) — Moderate

**Goal**: Refactor API endpoint handlers using early returns and lookup tables

**Independent Test**: `npx eslint src/routes/api/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T018 [P] [US2] Refactor GET handler (cognitive 33, cyclomatic 22) in src/routes/api/system/info/+server.ts:14 — extract `collectSystemInfo`, `collectServiceStatus` helpers
- [ ] T019 [P] [US2] Refactor GET handler (cognitive 27, cyclomatic 18) in src/routes/api/gsm-evil/status/+server.ts:12 — extract `buildStatusResponse` helper
- [ ] T020 [P] [US2] Refactor GET handler (cyclomatic 26) in src/routes/api/gps/location/+server.ts:11 — extract `parseGpsData`, `formatGpsResponse` helpers
- [ ] T021 [P] [US2] Refactor POST handler (cognitive 24, cyclomatic 20) in src/routes/api/tak/import-package/+server.ts:14 — extract `validatePackage`, `processPackageContents` helpers
- [ ] T022 [P] [US2] Refactor POST handler (cognitive 23, cyclomatic 17) in src/routes/api/gsm-evil/intelligent-scan/+server.ts:13 — extract scan orchestration helpers
- [ ] T023 [P] [US2] Refactor POST handler (cognitive 22) in src/routes/api/gsm-evil/tower-location/+server.ts:45 — extract `lookupTowerLocation`, `formatTowerResponse` helpers
- [ ] T024 [P] [US2] Refactor POST handler (cyclomatic 22) in src/routes/api/gsm-evil/frames/+server.ts:53 — simplify frame processing logic
- [ ] T025 [P] [US2] Refactor GET handler (cyclomatic 17) in src/routes/api/gsm-evil/activity/+server.ts:14 — extract activity aggregation helper
- [ ] T026 [P] [US2] Refactor GET handler (cyclomatic 17) in src/routes/api/kismet/devices/+server.ts:57 — extract device filtering helpers
- [ ] T027 [P] [US2] Refactor POST handler (cyclomatic 16) in src/routes/api/signals/batch/+server.ts:42 — extract batch validation helper
- [ ] T028 [P] [US2] Refactor GET handler (cyclomatic 16) in src/routes/api/system/memory-pressure/+server.ts:10 — extract memory parsing helpers
- [ ] T029 [P] [US2] Refactor POST handler (cyclomatic 16) in src/routes/api/tak/enroll/+server.ts:17 — extract enrollment validation helper
- [ ] T030 [P] [US2] Refactor POST handler (cyclomatic 18) in src/routes/api/db/cleanup/+server.ts:54 — extract cleanup orchestration helper
- [ ] T031 Verify API route handlers: lint + build

**Checkpoint**: API routes — all handlers ≤10 complexity

---

## Phase 5: MCP Servers (Priority: P1/P2) — Critical + Moderate

**Goal**: Refactor MCP diagnostic server tool handlers

**Independent Test**: `npx eslint src/lib/server/mcp/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T032 [US1] Refactor `getSystemInfo` tool (cyclomatic 30, cognitive 23) in src/lib/server/mcp/servers/system-inspector.ts:38 — extract per-subsystem info collectors into lookup dispatch
- [ ] T033 [P] [US1] Refactor `debugHardware` tool (cognitive 27, cyclomatic 17) in src/lib/server/mcp/servers/hardware-debugger.ts:148 — extract per-hardware debug helpers
- [ ] T034 [P] [US1] Refactor `buildTools` (cyclomatic 25, cognitive 21) in src/lib/server/mcp/dynamic-server-tools.ts:62 and :93 — extract `createToolDefinition` and `buildToolHandler` helpers
- [ ] T035 [P] [US2] Refactor tertiary function (cyclomatic 16) in src/lib/server/mcp/dynamic-server-tools.ts:195 — simplify conditional
- [ ] T036 Verify MCP servers: lint + build

**Checkpoint**: MCP servers — all functions ≤10 complexity

---

## Phase 6: Agent, GSM Evil, and Utility Functions (Priority: P1/P2) — Mixed

**Goal**: Refactor AI agent runtime, GSM Evil page logic, and utility functions

**Independent Test**: `npx eslint src/lib/server/agent/ src/routes/gsm-evil/ src/lib/utils/ src/lib/server/services/gsm-evil/ src/lib/server/services/cell-towers/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T037 [US1] Refactor `processWithAnthropic` (cognitive 38, cyclomatic 23) in src/lib/server/agent/runtime.ts:104 — extract `buildMessagePayload`, `handleStreamChunk`, `processToolCall` helpers
- [ ] T038 [P] [US2] Refactor `getSystemPrompt` (cyclomatic 23) in src/lib/server/agent/tools.ts:61 — use template composition with lookup table
- [ ] T039 [P] [US2] Refactor GSM Evil page logic (cognitive 28) in src/routes/gsm-evil/gsm-evil-page-logic.ts:177 — extract scan workflow helpers
- [ ] T040 [P] [US2] Refactor `gsm-tower-utils` functions (cyclomatic 25 + 16) in src/lib/utils/gsm-tower-utils.ts:79 and :172 — replace conditional chains with lookup tables
- [ ] T041 [P] [US2] Refactor `parseProtocol` (cognitive 24) in src/lib/server/services/gsm-evil/protocol-parser.ts:158 — extract per-protocol parse helpers
- [ ] T042 [P] [US2] Refactor `analyzeFrequency` (cyclomatic 19) in src/lib/server/services/gsm-evil/gsm-scan-frequency-analysis.ts:53 — extract band classification helper
- [ ] T043 [P] [US2] Refactor `fetchCellTower` (cyclomatic 19) in src/lib/server/services/cell-towers/cell-tower-service.ts:121 — extract API response parsing helper
- [ ] T044 Verify agent/GSM/utility cluster: lint + build

**Checkpoint**: Agent, GSM Evil, utilities — all functions ≤10 complexity

---

## Phase 7: Hooks, Components, and Stores (Priority: P1/P2/P3) — Mixed

**Goal**: Refactor hooks.server.ts, dashboard components, stores, and remaining functions

**Independent Test**: `npx eslint src/hooks.server.ts src/lib/components/ src/lib/stores/ src/lib/kismet/ src/lib/hackrf/ src/routes/dashboard/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T045 [US1] Refactor `handle` middleware (cognitive 27, cyclomatic 25) in src/hooks.server.ts:73 — extract `applyRateLimiting`, `applySecurityHeaders`, `authenticateRequest` helpers
- [ ] T046 [P] [US1] Refactor `agent-context-store` (cyclomatic 35) in src/lib/stores/dashboard/agent-context-store.ts:72 — extract context-building helpers and use lookup table for context sections
- [ ] T047 [P] [US2] Refactor `HardwareCard` functions (cyclomatic 25 + 18) in src/lib/components/dashboard/panels/overview/HardwareCard.svelte:31 and :14 — extract status rendering helpers
- [ ] T048 [P] [US2] Refactor `ToolsNavigationView` (cognitive 24) in src/lib/components/dashboard/panels/ToolsNavigationView.svelte:58 — extract tool categorization helper
- [ ] T049 [P] [US2] Refactor `getWeatherCondition` (cyclomatic 23, cognitive 22) in src/lib/components/dashboard/status/weather-helpers.ts:37 — replace if-else chain with lookup table
- [ ] T050 [P] [US2] Refactor `agent-chat-logic` (cognitive 23) in src/lib/components/dashboard/agent-chat-logic.svelte.ts:122 — extract message handling helpers
- [ ] T051 [P] [US2] Refactor `device-filters` (cyclomatic 22) in src/lib/components/dashboard/panels/devices/device-filters.ts:61 — extract filter predicate builders
- [ ] T052 [P] [US2] Refactor `TerminalTabContent` (cognitive 21, cyclomatic 17) in src/lib/components/dashboard/TerminalTabContent.svelte:68 — extract terminal lifecycle helpers
- [ ] T053 [P] [US2] Refactor `websocket-handlers` (cyclomatic 22) in src/lib/kismet/websocket-handlers.ts:169 — extract per-message-type handlers into dispatch map
- [ ] T054 [P] [US2] Refactor `sweep-health-checker` (cyclomatic 17) in src/lib/hackrf/sweep-manager/sweep-health-checker.ts:41 — extract health evaluation helpers
- [ ] T055 [P] [US2] Refactor `+page.svelte` (cyclomatic 16) in src/routes/dashboard/+page.svelte:67 — extract view-switching logic into helper
- [ ] T056 [P] [US2] Refactor `kismet-control-service-extended` (cognitive 22, cyclomatic 23) in src/lib/server/services/kismet/kismet-control-service-extended.ts:40 — extract command builders
- [ ] T057 [P] [US2] Refactor `performHealthCheck` (cyclomatic 17) in src/lib/server/services/gsm-evil/gsm-evil-health-service.ts:41 — extract per-component health check helpers
- [ ] T058 Verify hooks/components/stores cluster: lint + build + full test suite

**Checkpoint**: All remaining functions ≤10 complexity

---

## Phase 8: Final Verification

**Purpose**: Full codebase verification — zero complexity violations

- [ ] T059 Run `npx eslint src/ --config config/eslint.config.js 2>&1 | grep -c "complexity"` — must output 0
- [ ] T060 Run `npm run build` — must pass clean
- [ ] T061 Run `npx vitest run --no-coverage` — all tests pass
- [ ] T062 Run `git diff --stat main...HEAD` to document total scope of changes
- [ ] T063 Verify no file exceeds 300 lines with `find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | sort -rn | head -20`

**Checkpoint**: SC-001 through SC-006 verified — zero complexity violations, all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Phases 2-7**: All depend on Phase 1. Can proceed in any order (grouped by proximity, not dependency)
- **Phase 8**: Depends on ALL Phases 2-7 completing

### User Story Dependencies

- **US1 (Critical, 25+)**: Functions in Phases 2, 3, 5, 6, 7 — no inter-story dependencies
- **US2 (Moderate, 16-24)**: Functions in Phases 2, 3, 4, 5, 6, 7 — no inter-story dependencies
- **US3 (Borderline, 11-15)**: No tasks generated — if borderline violations exist at implementation time, they will be caught by Phase 8 verification

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel since they target different files:
- Phase 3: T010-T016 all target different server files
- Phase 4: T018-T030 all target different API route files
- Phase 5: T033-T035 target different MCP files
- Phase 6: T038-T043 target different files
- Phase 7: T046-T057 target different component/store files

---

## Implementation Strategy

### MVP First (Phase 2 Only)

1. Complete Phase 1: Setup baseline
2. Complete Phase 2: Dashboard map cluster (highest complexity, most visible)
3. **STOP and VALIDATE**: Confirm map functions pass lint at error level 10
4. This alone removes the worst offenders (complexity 35, 29)

### Incremental Delivery

1. Phase 2: Dashboard map (complexity 35, 29) → Verify
2. Phase 3: Server services (complexity 51, 34, 32, 31, 28, 25) → Verify
3. Phase 4: API routes (13 handlers, moderate complexity) → Verify
4. Phase 5: MCP servers (complexity 30, 27, 25) → Verify
5. Phase 6: Agent + GSM + utils (complexity 38, 25, 28) → Verify
6. Phase 7: Hooks + components + stores (remaining) → Verify
7. Phase 8: Final full-codebase verification

---

## Notes

- Pure structural refactoring — NO behavioral changes
- If a refactored function's tests break, the refactoring has a bug — do not modify the test
- Use `--no-verify` on commits only during active refactoring; final commits must pass all hooks
- Files exceeding 300 lines after helper extraction must be split per research.md Decision 4
- The 68-violation count may differ at execution time if spec-014 branch merges first; Phase 1 establishes the actual baseline
