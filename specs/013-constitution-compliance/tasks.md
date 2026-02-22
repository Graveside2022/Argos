# Tasks: Constitution Compliance Remediation

**Input**: Design documents from `/specs/013-constitution-compliance/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md
**Branch**: `013-constitution-compliance`

**Tests**: Not requested — existing tests serve as regression verification. No new test tasks unless fixing pre-existing failures (US6).

**Organization**: Tasks grouped by user story. US3/US4/US5 are fully independent. US1 should complete before US2 (function extraction shrinks files). US6 is independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Baseline verification and constitution amendment

- [x] T001 Verify baseline: run `npm run build` and `npm run test:unit` to confirm current state, document pass/fail counts
- [x] T002 [P] Amend constitution Article 2.6 in `.specify/memory/constitution.md` to add exemption: "Hex values are permitted as CSS `var()` fallback parameters" (resolves US5)
- [x] T003 [P] Delete dead code file `src/lib/map/MapSourceParser.ts` (zero importers confirmed in research.md)

**Checkpoint**: Baseline documented, constitution amended, dead code removed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking prerequisites for this refactoring — each user story is independent. US1 should complete before US2 for optimal file-size reduction.

**⚠️ NOTE**: Skip directly to Phase 3. This phase is empty because all violation categories are independent refactoring units.

---

## Phase 3: User Story 1 — Oversized Function Refactoring (Priority: P1) 🎯 MVP

**Goal**: All functions in `src/` comply with the 50-line limit (Article 2.2). Extract oversized functions into co-located helpers with JSDoc.

**Independent Test**: `find src/ -name '*.ts' -not -name '*.test.ts' | xargs ...` function-length scan reports zero violations. `npm run build` passes.

### GSM Evil Functions (Critical — largest violations)

- [x] T004 [US1] Extract `performGsmScan` (374 lines) into scan-phase helpers in `src/lib/server/services/gsm-evil/gsm-scan-service.ts` — split into: initScan, executeFrequencyScan, parseResults, buildScanResponse
- [x] T004b [P] [US1] Extract `createGSMEvilStore` (321 lines) into store-action helpers in `src/lib/stores/gsm-evil-store.ts` — split into: createScanActions, createCaptureActions, createPersistenceActions, initializeStore
- [x] T005 [P] [US1] Extract `checkGsmEvilHealth` (242 lines) into health-check helpers in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts` — split into: checkProcess, checkDatabase, checkFrequency, aggregateHealthStatus
- [x] T006 [P] [US1] Extract `startGsmEvil` (232 lines) into startup-phase helpers in `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts` — split into: validateConfig, spawnProcess, setupMonitoring, handleStartupErrors

### Constitution Module Functions

- [x] T007 [P] [US1] Extract `generateMasterREADME` (249 lines) and `generateCategoryREADME` (162 lines) into markdown-generation helpers in `src/lib/constitution/master-report-generator.ts`
- [x] T008 [P] [US1] Extract `organizeViolations` (159 lines) and `generateAnalysis` (146 lines) into category-processing helpers in `src/lib/constitution/analysis-generator.ts`
- [x] T009 [P] [US1] Extract `generateDependencyReport` (149 lines) into report-section helpers in `src/lib/constitution/dependency-analyzer.ts`
- [x] T010 [P] [US1] Extract `validateArticleIII` (~95 lines) by splitting `shouldHaveTests` (108 lines) and `shouldRequireHighCoverage` (129 lines) into focused validators in `src/lib/constitution/validators/article-iii-testing.ts`

### Server Functions

- [x] T011 [P] [US1] Extract `initializeWebSocketServer` (162 lines) into setup helpers in `src/lib/server/websocket-server.ts` — split into: createServer, setupVerifyClient, setupConnectionHandler, registerMessageHandlers
- [x] T012 [P] [US1] Extract `decodeRR` (128 lines) and `decodeMM` (98 lines) into message-type decoders in `src/lib/server/gsm/l3-decoder.ts`
- [x] T013 [P] [US1] Extract `updateGPSPosition` (125 lines) into position-parsing helpers in `src/lib/server/services/gps/gps-position-service.ts`
- [x] T014 [P] [US1] Extract `startGPSSatelliteTracking` (122 lines) into satellite-parsing helpers in `src/lib/server/services/gps/gps-satellite-service.ts`
- [x] T015 [P] [US1] Extract `detectHardwareDevices` (~110 lines) into detection-phase helpers in `src/lib/server/hardware/detection/hardware-detector.ts`
- [x] T016 [P] [US1] Extract `runMigrations` (~108 lines) into migration-phase helpers in `scripts/db-migrate.ts`

### Client Functions

- [x] T017 [P] [US1] Extract `createKismetStore` (~125 lines) into store-action helpers in `src/lib/kismet/websocket.ts`
- [x] T018 [P] [US1] Extract `setupMap` (118 lines) into map-initialization helpers in `src/lib/components/dashboard/map/map-setup.ts`
- [x] T019 [US1] Run `npm run build` and `npm run test:unit` to verify zero regressions from function extraction

**Checkpoint**: All functions ≤50 lines. Build passes. Existing tests pass. Ready for US2 (file splitting).

---

## Phase 4: User Story 2 — Oversized File Decomposition (Priority: P1)

**Goal**: All non-test source files in `src/` comply with the 300-line limit (Article 2.2). Split by domain responsibility.

**Independent Test**: `find src/ -name '*.ts' -o -name '*.svelte' | grep -v test | xargs wc -l | awk '$1>300'` reports zero files. `npm run build` passes.

**NOTE**: After US1 function extraction, re-measure file sizes. Many files will have shrunk. Only split files still exceeding 300 lines.

### Static Data Files (Critical — largest files)

- [ ] T020 [US2] Split `src/lib/data/tool-hierarchy.ts` (1,491 lines) by tool category into: `tool-hierarchy-offnet.ts`, `tool-hierarchy-onnet.ts`, `tool-hierarchy-types.ts`, and a thin `tool-hierarchy.ts` aggregator
- [ ] T021 [P] [US2] Split `src/lib/data/carrier-mappings.ts` (809 lines) by region into: `carrier-mappings-americas.ts`, `carrier-mappings-europe.ts`, `carrier-mappings-asia.ts`, `carrier-mappings-types.ts`

### Svelte Components (extract logic to .svelte.ts modules)

- [ ] T022 [P] [US2] Split `src/lib/components/dashboard/TerminalPanel.svelte` (766 lines) — extract session management logic to `terminal-panel-logic.svelte.ts`
- [ ] T023 [P] [US2] Split `src/lib/components/dashboard/AgentChatPanel.svelte` (619 lines) — extract message handling to `agent-chat-logic.svelte.ts`
- [ ] T024 [P] [US2] Split `src/lib/components/dashboard/DashboardMap.svelte` (584 lines) — extract layer management and popup logic to `dashboard-map-logic.svelte.ts`
- [ ] T025 [P] [US2] Split `src/routes/gsm-evil/+page.svelte` (566 lines) — extract scan/IMSI logic to `gsm-evil-page-logic.svelte.ts`
- [ ] T026 [P] [US2] Split `src/routes/dashboard/+page.svelte` (506 lines) — extract panel state logic to `dashboard-page-logic.svelte.ts`
- [ ] T027 [P] [US2] Split `src/lib/components/dashboard/panels/LayersPanel.svelte` (467 lines) — extract band filtering logic to `layers-panel-logic.svelte.ts`
- [ ] T028 [P] [US2] Split `src/lib/components/dashboard/tak/TakConfigView.svelte` (441 lines) — extract cert management to `tak-config-logic.svelte.ts`
- [ ] T029 [P] [US2] Split `src/lib/components/dashboard/TerminalTabContent.svelte` (355 lines) — extract xterm integration to `terminal-tab-logic.svelte.ts`
- [ ] T030 [P] [US2] Split `src/lib/components/dashboard/IconRail.svelte` (331 lines) — extract navigation logic to `icon-rail-logic.svelte.ts`
- [ ] T031 [P] [US2] Split `src/lib/components/dashboard/PanelContainer.svelte` (317 lines) — extract resize logic to `panel-container-logic.svelte.ts`

### Server Modules (extract helper functions)

- [ ] T032 [P] [US2] Split `src/lib/server/mcp/dynamic-server.ts` (720 lines) — extract tool definitions into `dynamic-server-tools.ts`
- [ ] T033 [P] [US2] Split `src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts` (675 lines) — extract frequency analysis to `gsm-frequency-analyzer.ts`
- [ ] T034 [P] [US2] Split `src/lib/server/hackrf/sweep-manager.ts` (635 lines) — extract coordination logic to `sweep-coordinator.ts`
- [ ] T035 [P] [US2] Split `src/lib/server/kismet/web-socket-manager.ts` (611 lines) — extract message parsers to `kismet-message-parser.ts`
- [ ] T036 [P] [US2] Split `src/lib/server/mcp/servers/hardware-debugger.ts` (558 lines) — extract tool handlers to `hardware-debugger-tools.ts`
- [ ] T037 [P] [US2] Split `src/lib/server/kismet/kismet-proxy.ts` (545 lines) — extract device filtering to `kismet-device-filter.ts`
- [ ] T038 [P] [US2] Split `src/lib/server/db/db-optimizer.ts` (520 lines) — extract strategy implementations to `db-optimization-strategies.ts`
- [ ] T039 [P] [US2] Split `src/lib/server/db/cleanup-service.ts` (509 lines) — extract retention policies to `cleanup-policies.ts`
- [ ] T040 [P] [US2] Split `src/lib/server/mcp/servers/streaming-inspector.ts` (502 lines) — extract SSE tool handlers to `streaming-inspector-tools.ts`
- [ ] T041 [P] [US2] Split `src/hooks.server.ts` (501 lines) — extract rate limiter and CSP logic to `src/lib/server/security/rate-limiter.ts` and `src/lib/server/security/csp-headers.ts`

### Client Modules

- [ ] T042 [P] [US2] Split `src/lib/hackrf/api-legacy.ts` (509 lines) — extract EventSource management to `api-legacy-stream.ts`
- [ ] T043 [P] [US2] Split `src/lib/hackrf/sweep-manager/buffer-manager.ts` (505 lines) — extract parsing logic to `buffer-parser.ts`
- [ ] T044 [P] [US2] Split `src/lib/hackrf/spectrum.ts` (492 lines) — extract time-window logic to `spectrum-time-filter.ts`
- [ ] T045 [P] [US2] Split `src/lib/hackrf/sweep-manager/error-tracker.ts` (485 lines) — extract recovery logic to `error-recovery.ts`
- [ ] T046 [P] [US2] Split `src/lib/server/websocket-server.ts` (473 lines) — extract Zod schemas to `websocket-schemas.ts` (if still >300 after T011)
- [ ] T047 [P] [US2] Split `src/lib/server/mcp/servers/system-inspector.ts` (449 lines) — extract diagnostic tools to `system-inspector-tools.ts`
- [ ] T048 [P] [US2] Split `src/lib/kismet/websocket.ts` (444 lines) — extract message handlers to `kismet-ws-handlers.ts` (if still >300 after T017)
- [ ] T049 [P] [US2] Split `src/lib/hackrf/sweep-manager/frequency-cycler.ts` (434 lines) — extract cycle state logic to `frequency-cycle-state.ts`
- [ ] T050 [P] [US2] Split `src/lib/constitution/master-report-generator.ts` (433 lines) — extract markdown builders to `report-markdown-builders.ts` (if still >300 after T007)
- [ ] T051 [P] [US2] Split `src/lib/kismet/api.ts` (429 lines) — extract retry logic to `kismet-api-retry.ts`
- [ ] T052 [P] [US2] Split `src/lib/server/mcp/servers/database-inspector.ts` (424 lines) — extract query tools to `database-inspector-tools.ts`
- [ ] T053 [P] [US2] Split `src/lib/server/services/gps/gps-position-service.ts` (423 lines) — extract socket management to `gps-socket-manager.ts` (if still >300 after T013)
- [ ] T054 [P] [US2] Split `src/lib/constitution/analysis-generator.ts` (422 lines) — extract category formatters to `analysis-formatters.ts` (if still >300 after T008)

### Remaining 300-500 line files

- [ ] T055a [P] [US2] Split remaining oversized files (370-420 lines, batch 1/5): `src/lib/stores/gsm-evil-store.ts`, `src/lib/server/services/gsm-evil/gsm-scan-service.ts`, `src/lib/server/hardware/detection/usb-detector.ts`, `src/lib/hackrf/sweep-manager/process-manager.ts` — extract helpers (if still >300 after US1)
- [ ] T055b [P] [US2] Split remaining oversized files (360-392 lines, batch 2/5): `src/lib/server/gsm/l3-decoder.ts`, `src/lib/websocket/base.ts`, `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts`, `src/lib/constitution/constitution-parser.ts` — extract helpers (if still >300 after US1)
- [ ] T055c [P] [US2] Split remaining oversized files (360-369 lines, batch 3/5): `src/lib/server/agent/frontend-tools.ts`, `src/lib/server/services/hardware/hardware-details-service.ts`, `src/lib/server/services/kismet.service.ts`, `src/lib/server/db/database.ts` — extract helpers (if still >300 after US1)
- [ ] T056a [P] [US2] Split remaining oversized files (300-350 lines, batch 4/5): `terminal-store.ts`, `auditor.ts`, `article-iii-testing.ts`, `api-debugger.ts`, `resource-manager.ts` — extract helpers (if still >300 after US1)
- [ ] T056b [P] [US2] Split remaining oversized files (300-350 lines, batch 5/5): `types.ts`, `hackrf/stores.ts`, `gps-satellite-service.ts`, `kismet-control-service-extended.ts`, `agent/tools.ts` — extract helpers (if still >300 after US1)
- [ ] T057 [US2] Run `npm run build` and full line-count verification scan to confirm zero files >300 lines

**Checkpoint**: All source files ≤300 lines. Build passes. All tests pass.

---

## Phase 5: User Story 3 — File Naming Convention Compliance (Priority: P2)

**Goal**: All TypeScript files use kebab-case naming (Article 2.3). Rename via `git mv` and update all imports.

**Independent Test**: `find src/ -name '*.ts' -not -name '*.d.ts' | grep '[A-Z][a-z]*[A-Z]'` returns nothing. `npm run build` passes.

### Map Module Renames

- [x] T058 [P] [US3] Rename `src/lib/map/symbols/SymbolFactory.ts` to `symbol-factory.ts` via `git mv`, update 3 importers: `SymbolLayer.ts`/`symbol-layer.ts`, `map-setup.ts`, `map-handlers.ts`
- [x] T059 [P] [US3] Rename `src/lib/map/layers/SatelliteLayer.ts` to `satellite-layer.ts` via `git mv`, update 1 importer: `map-setup.ts`
- [x] T060 [P] [US3] Rename `src/lib/map/layers/SymbolLayer.ts` to `symbol-layer.ts` via `git mv`, update 1 importer: `map-setup.ts`
- [x] T061 [P] [US3] Rename `src/lib/map/VisibilityEngine.ts` to `visibility-engine.ts` via `git mv`, update 2 importers: `LayersPanel.svelte`, `map-setup.ts`

### TAK Module Renames

- [x] T062 [P] [US3] Rename `src/lib/server/tak/CertManager.ts` to `cert-manager.ts` via `git mv`, update 4 importers: `TakService.ts`/`tak-service.ts`, `TakPackageParser.ts`/`tak-package-parser.ts`, 2 API routes
- [x] T063 [P] [US3] Rename `src/lib/server/tak/TakPackageParser.ts` to `tak-package-parser.ts` via `git mv`, update 2 importers: `TakService.ts`/`tak-service.ts`, API route
- [x] T064 [US3] Rename `src/lib/server/tak/TakService.ts` to `tak-service.ts` via `git mv`, update all importers: `src/hooks.server.ts`, `src/routes/api/tak/connection/+server.ts`, `src/routes/api/tak/config/+server.ts`, and any test files
- [x] T065 [US3] Run `npm run build` to verify all import paths resolve correctly after all renames

**Checkpoint**: Zero PascalCase TypeScript files. Build passes.

**NOTE**: T058-T061 should execute before T062-T064 because TAK renames reference map files that may change. T064 (TakService) has the highest blast radius (11 importers) — do last within TAK group.

---

## Phase 6: User Story 4 — Eliminate `any` Types (Priority: P2)

**Goal**: Zero `any` type usages in production code (Article 2.1). Replace with `unknown` + type guards.

**Independent Test**: `grep -rn ': any\b\|as any\b' src/ --include='*.ts' | grep -v test | grep -v '.d.ts'` returns nothing. `npx tsc --noEmit` passes.

- [x] T066 [P] [US4] Replace `[key: string]: any` with `[key: string]: unknown` in `src/lib/kismet/types.ts:85`, verify downstream consumers handle `unknown`
- [x] T067 [P] [US4] Replace `[key: string]: any` with `[key: string]: unknown` in `src/lib/types/tak.ts:62`, verify downstream consumers handle `unknown`
- [x] T068 [P] [US4] Replace `child?: any` and `children?: any` with `unknown` in generics at `src/lib/utils.ts:9,11`, verify Svelte component type compatibility
- [x] T069 [P] [US4] Replace `as any` cast with typed interface assertion in `src/lib/tactical-map/tak-service.ts:14`
- [x] T069b [P] [US4] Replace `type LeafletLibrary = any` with proper Leaflet type import or `unknown` in `src/lib/tactical-map/map-service.ts:14`
- [x] T070 [P] [US4] Replace `as any` WebSocket constructor cast with proper typing in `src/lib/websocket/base.ts:73`
- [x] T071 [P] [US4] Replace `as any` service access cast with typed accessor in `src/routes/api/tak/connection/+server.ts:28`
- [x] T072 [P] [US4] Replace `(db as any).db` casts with properly typed database accessor in `src/routes/api/database/health/+server.ts:11`, `src/routes/api/database/query/+server.ts:77`, `src/routes/api/database/schema/+server.ts:12`
- [x] T073 [P] [US4] Replace `Record<string, any[]>` with typed alternative in `src/routes/api/hardware/scan/+server.ts:25` and `Record<string, any>` in `src/lib/server/mcp/types.ts:15`
- [x] T074 [P] [US4] Replace `as any` test casts with `as unknown as Type` pattern in `src/lib/utils/gsm-tower-utils.test.ts:403,423,442`
- [x] T075 [US4] Run `npx tsc --noEmit` to verify zero type errors after all `any` replacements

**Checkpoint**: Zero `any` types in production code. TypeScript strict mode passes.

---

## Phase 7: User Story 5 — Hardcoded Hex Color Resolution (Priority: P2)

**Goal**: Constitutional exemption for CSS `var()` fallback hex values documented and enforced.

**Independent Test**: Constitution audit does not flag `var()` fallback hex values as violations.

- [x] T076 [US5] Verify T002 constitutional amendment is in place, then update the constitution auditor's hex-color detection in `src/lib/constitution/validators/article-ii-code-quality.ts` to skip hex values inside `var()` fallback positions
- [x] T077 [US5] Run constitution audit to verify zero hex-color violations are reported for `var()` fallbacks

**Checkpoint**: Hex colors in `var()` fallbacks are no longer flagged. Constitution amended.

---

## Phase 8: User Story 6 — Fix Pre-existing Test Failures (Priority: P3)

**Goal**: All tests pass with zero failures. Test suite runs green.

**Independent Test**: `npm run test:all` reports zero failures.

- [x] T078 [P] [US6] Fix 5 failures in `tests/constitution/auditor.test.ts` — update mock constitution string to include valid Zod-schema-compliant sections structure (at least 1 section with articles)
- [x] T079 [P] [US6] Fix 2 failures in `tests/constitution/validators/article-ix-security.test.ts` — align dynamic constructor detection test and multi-violation count test with actual validator behavior
- [x] T080 [P] [US6] Fix 3 failures in `tests/load/dataVolumes.test.ts` — fix test data generator: use `Math.floor()` for timestamps, convert frequencies from Hz to MHz (divide by 1e6), adjust event scenario expectations, increase timeout to 120s for 24-hour test
- [x] T081 [P] [US6] Fix 1 failure in `tests/performance/tak-markers.test.ts` — mock SvelteKit `__sveltekit` package import or restructure test to avoid SvelteKit runtime dependency
- [x] T082 [US6] Run `npm run test:all` to verify zero failures across all test suites

**Checkpoint**: All tests pass. Zero pre-existing failures.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and documentation

- [ ] T083 Run full verification suite: `npm run build && npx tsc --noEmit && npm run lint && npm run test:all`
- [ ] T084 [P] Run constitution compliance audit and verify zero violations across all checked articles
- [ ] T085 [P] Run quickstart.md verification commands to confirm all success criteria (SC-001 through SC-009) are met
- [ ] T086 Update `specs/013-constitution-compliance/plan.md` with final task completion status

---

## Task Count Summary

| Category | Tasks | IDs |
|----------|-------|-----|
| Setup | 3 | T001-T003 |
| US1 Functions (P1) | 17 | T004-T004b, T005-T019 |
| US2 Files (P1) | 41 | T020-T054, T055a-c, T056a-b, T057 |
| US3 Renames (P2) | 8 | T058-T065 |
| US4 Any Types (P2) | 11 | T066-T069b, T070-T075 |
| US5 Hex Colors (P2) | 2 | T076-T077 |
| US6 Test Fixes (P3) | 5 | T078-T082 |
| Polish | 4 | T083-T086 |
| **Total** | **91** | **T001-T086 + T004b + T069b (T055/T056 split into 5 sub-tasks)** |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Empty — skip
- **US1 Functions (Phase 3)**: No dependencies — start after Setup
- **US2 Files (Phase 4)**: Depends on US1 completion (function extraction shrinks files)
- **US3 Renames (Phase 5)**: Independent — can run in parallel with US1/US4/US5/US6
- **US4 Any Types (Phase 6)**: Independent — can run in parallel with US1/US3/US5/US6
- **US5 Hex Colors (Phase 7)**: Depends on T002 (constitution amendment in Setup)
- **US6 Test Fixes (Phase 8)**: Independent — can run in parallel with all others
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup (T001-T003)
    │
    ├──→ US1: Functions (T004-T019) ──→ US2: Files (T020-T057) ──→ Polish
    │                                                                 ↑
    ├──→ US3: Renames (T058-T065) ────────────────────────────────────┤
    ├──→ US4: Any Types (T066-T075) ──────────────────────────────────┤
    ├──→ US5: Hex Colors (T076-T077) ─────────────────────────────────┤
    └──→ US6: Test Fixes (T078-T082) ─────────────────────────────────┘
```

### Critical Path

**Setup → US1 (Functions) → US2 (Files) → Polish** — this is the longest chain because file splitting depends on function extraction completing first.

### Parallel Opportunities

- **After Setup**: US3, US4, US5, US6 can ALL start immediately in parallel
- **After Setup**: US1 can start (but US2 must wait for US1)
- **Within US1**: T005-T018 are all [P] — can run in parallel (different files)
- **Within US2**: T021-T056 are all [P] — can run in parallel (different files)
- **Within US3**: T058-T063 are [P] — can run in parallel (T064 last due to blast radius)
- **Within US4**: T066-T074 are all [P] — can run in parallel (different files, T075 is verification)
- **Within US6**: T078-T081 are all [P] — can run in parallel (different test files)

---

## Parallel Example: Maximum Parallelism After Setup

```bash
# Stream 1: US1 Function extraction (critical path)
Task: T004 "Extract performGsmScan in gsm-scan-service.ts"
Task: T005 "Extract checkGsmEvilHealth in gsm-evil-health-service.ts"  # [P]
Task: T006 "Extract startGsmEvil in gsm-evil-control-service.ts"       # [P]
# ... all T007-T018 in parallel

# Stream 2: US3 PascalCase renames (independent)
Task: T058 "Rename SymbolFactory.ts to symbol-factory.ts"              # [P]
Task: T059 "Rename SatelliteLayer.ts to satellite-layer.ts"            # [P]
# ... all T060-T064 in sequence for TAK group

# Stream 3: US4 Any type fixes (independent)
Task: T066 "Fix any in kismet/types.ts"                                # [P]
Task: T067 "Fix any in types/tak.ts"                                   # [P]
# ... all T068-T074 in parallel

# Stream 4: US6 Test fixes (independent)
Task: T078 "Fix auditor.test.ts mock constitution"                     # [P]
Task: T079 "Fix article-ix-security.test.ts expectations"              # [P]
Task: T080 "Fix dataVolumes.test.ts data generator"                    # [P]
Task: T081 "Fix tak-markers.test.ts SvelteKit import"                  # [P]
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 3: US1 Function Extraction (T004-T019)
3. **STOP and VALIDATE**: `npm run build && npm run test:unit` — all functions ≤50 lines
4. This alone resolves the highest-impact violations

### Incremental Delivery

1. Setup → US1 Functions → Validate (MVP!)
2. + US3 Renames + US4 Any Types + US5 Hex Colors (quick wins, parallel) → Validate
3. + US2 File Splits (large effort, depends on US1) → Validate
4. + US6 Test Fixes → Full green suite
5. Polish → Constitution audit reports zero violations

### Parallel Team Strategy

With multiple agents/developers:

1. All complete Setup together
2. Once Setup done:
   - Agent A: US1 (critical path — blocks US2)
   - Agent B: US3 + US4 (quick, independent)
   - Agent C: US6 (test fixes, independent)
3. After US1: Agent A → US2 (file splits)
4. After US3+US4: Agent B → help Agent A with US2
5. Polish when all complete

---

## Notes

- **Constitution Article 9.2 compliance**: Each task is 5min-2hr, touches max 5 files
- **Constitution Article 9.3 compliance**: One commit per task, verify-pass before commit
- **FR-007**: All refactored modules MUST preserve existing public API signatures
- **FR-010**: Extracted helpers MUST be co-located (same directory, not generic utils)
- **Art 2.5**: New extracted public functions need JSDoc
- Commit format: `refactor(scope): TXXX — description`
- After each function extraction: verify the parent function is now ≤50 lines
- After each file split: verify all resulting files are ≤300 lines
- "if still >300 after TXXX" tasks: Skip if function extraction already brought file under limit
