# Tasks: Constitutional Compliance Follow-up

**Input**: Design documents from `/specs/011-compliance-followup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

**Tests**: Not explicitly requested — existing 190+ unit tests serve as regression gate.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create GitHub issues needed for placeholder replacement and verify baseline

- [x] T001 Run `npm run typecheck` and `npm run test:unit` to confirm baseline: 0 errors, 190+ tests pass
- [x] T002 Create GitHub issue for Article-IV-4.3 exemptions (component state handling, 18 occurrences) via `gh issue create` → **#11**
- [x] T003 [P] Create GitHub issue for Article-IV-4.2 exemptions (UI button patterns, 8 occurrences) via `gh issue create` → **#12**
- [x] T004 [P] Create GitHub issue for Article-IX-9.4 exemptions (static SVG icons, 18 occurrences) via `gh issue create` → **#13**
- [x] T005 [P] Create GitHub issue for Article-II-2.1 + IX-9.1 exemptions (type narrowing + HMAC salt, 9 occurrences) via `gh issue create` → **#14**

---

## Phase 2: Foundational

**Purpose**: No shared infrastructure needed — each user story is independent

**⚠️ NOTE**: This feature has no foundational phase. All user stories operate on independent file sets and can proceed directly after Setup.

---

## Phase 3: User Story 1 — Complete Boolean Property Naming (Priority: P1) 🎯 MVP

**Goal**: Rename all `running: boolean` properties to `isRunning` across type definitions, Zod schemas, and consumers

**Independent Test**: `npm run typecheck` passes with 0 errors; `npm run test:unit` passes 190+ tests; `grep -rn 'running: boolean' src/lib/` returns 0 results (excluding class private members if prefixed with `_`)

### Implementation for User Story 1

- [x] T006 [P] [US1] Rename `running` to `isRunning` in KismetStatus interface in `src/lib/kismet/api.ts:17`
- [x] T007 [P] [US1] Rename `running` to `isRunning` in KismetServiceStatus interface in `src/lib/server/kismet/types.ts:97`
- [x] T008 [P] [US1] Rename `running` to `isRunning` in KismetStatusResult interface in `src/lib/server/services/kismet/kismet-control-service-extended.ts:21`
- [x] T009 [P] [US1] Rename `running` to `isRunning` in GsmEvilHealth.grgsm and GsmEvilHealth.gsmevil in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts:12,18`
- [x] T010 [P] [US1] Rename `running` to `isRunning` in return type of getContainerStatus() in `src/lib/server/hardware/hackrf-manager.ts:72`
- [x] T011 [P] [US1] Rename private `running` property to `_isRunning` in HardwareMonitor class in `src/lib/server/hardware/detection/hardware-detector.ts` (5 sites)
- [x] T012 [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/server/kismet/service-manager.ts` (4 sites)
- [x] T013 [P] [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/server/hardware/resource-manager.ts` (2 sites)
- [x] T014 [P] [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/tactical-map/kismet-service.ts` (2 sites)
- [x] T015 [P] [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/components/dashboard/panels/ToolsNavigationView.svelte` (2 sites)
- [x] T016 [P] [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/components/dashboard/panels/GsmEvilPanel.svelte` (line 90)
- [x] T017 [P] [US1] Update all consumers of `.running` → `.isRunning` in `src/lib/server/mcp/servers/hardware-debugger.ts` (5 sites)
- [x] T018 [P] [US1] Update CSS class `.running` → `.isRunning` in `src/lib/components/dashboard/shared/ToolCard.svelte` (lines 129, 154) and all class binding references
- [x] T019 [US1] Run `npm run typecheck` and `npm run test:unit` to verify boolean rename — 0 errors, 190 tests pass
- [x] EXTRA: Updated Zod schema `KismetControlResponseSchema` in `src/lib/schemas/rf.ts` — `running` → `isRunning`
- [x] EXTRA: Updated JSON response keys in API routes (`/api/kismet/status`, `/api/kismet/control`, `/api/kismet/devices`, `/api/gsm-evil/status`, `/api/gsm-evil/health`)

**Checkpoint**: All boolean properties use is/has/should/can/will prefix. `grep -rn 'running: boolean' src/lib/` returns 0 interface/type results.

---

## Phase 4: User Story 2 — Decompose Oversized Dashboard Components (Priority: P1)

**Goal**: Split DevicesPanel (940 lines), DashboardMap (915 lines), HardwareCard (325 lines), and GpsDropdown (315 lines) into sub-components under 300 lines each

**Independent Test**: `wc -l` on each target file shows <300 lines; `npm run typecheck` passes; application renders correctly

### DevicesPanel Decomposition

- [ ] T020 [US2] Extract filter chip bar into `src/lib/components/dashboard/panels/devices/DeviceFilterBar.svelte` from DevicesPanel.svelte
- [ ] T021 [US2] Extract device list view into `src/lib/components/dashboard/panels/devices/DeviceList.svelte` from DevicesPanel.svelte
- [ ] T022 [US2] Extract device detail view into `src/lib/components/dashboard/panels/devices/DeviceDetail.svelte` from DevicesPanel.svelte
- [ ] T023 [US2] Extract whitelist management into `src/lib/components/dashboard/panels/devices/DeviceWhitelist.svelte` from DevicesPanel.svelte
- [ ] T024 [US2] Rewire DevicesPanel.svelte as orchestrator (<300 lines) importing sub-components from `src/lib/components/dashboard/panels/devices/`

### DashboardMap Decomposition

- [ ] T025 [US2] Extract map controls (style picker, zoom) into `src/lib/components/dashboard/map/MapControls.svelte` from DashboardMap.svelte
- [ ] T026 [US2] Extract popup/tooltip rendering into `src/lib/components/dashboard/map/MapPopup.svelte` from DashboardMap.svelte
- [ ] T027 [US2] Extract style/layer configuration into `src/lib/components/dashboard/map/map-styles.ts` from DashboardMap.svelte
- [ ] T028 [US2] Extract cone/bearing SVG generation into `src/lib/components/dashboard/map/map-overlays.ts` from DashboardMap.svelte
- [ ] T029 [US2] Rewire DashboardMap.svelte as orchestrator (<300 lines) importing sub-components from `src/lib/components/dashboard/map/`

### Minor Component Splits

- [ ] T030 [P] [US2] Split HardwareCard.svelte (325 lines) by extracting device sections into sub-components in `src/lib/components/dashboard/panels/overview/`
- [ ] T031 [P] [US2] Split GpsDropdown.svelte (315 lines) by extracting satellite table into `src/lib/components/dashboard/status/SatelliteTable.svelte`

### Verification

- [ ] T032 [US2] Run `npm run typecheck` and verify all decomposed files are under 300 lines with `wc -l src/lib/components/dashboard/**/*.svelte | sort -rn | head -20`

**Checkpoint**: No dashboard .svelte file in the 4 target components exceeds 300 lines. Application renders identically.

---

## Phase 5: User Story 3 — Extract Hardcoded Colors to Theme Constants (Priority: P2)

**Goal**: Move terminal ANSI palette and map paint colors from inline hex values to named TypeScript constants

**Independent Test**: `grep -rn '#[0-9a-fA-F]\{3,8\}' src/lib/components/dashboard/TerminalTabContent.svelte src/lib/components/dashboard/DashboardMap.svelte` returns 0 results (excluding CSS variable fallbacks)

### Implementation for User Story 3

- [ ] T033 [P] [US3] Create terminal ANSI color palette constants in `src/lib/components/dashboard/terminal/terminal-theme.ts` with typed ITerminalTheme export
- [ ] T034 [P] [US3] Create map paint color constants in `src/lib/components/dashboard/map/map-colors.ts` with named exports for each map style color
- [ ] T035 [US3] Update `src/lib/components/dashboard/TerminalTabContent.svelte` to import and use terminal theme from `terminal/terminal-theme.ts` instead of inline hex values
- [ ] T036 [US3] Update DashboardMap component (or its extracted `map-styles.ts` from T027) to import and use map colors from `map/map-colors.ts` instead of inline hex values
- [ ] T037 [US3] Run `npm run typecheck` to verify color extraction — 0 errors

**Checkpoint**: Terminal and map colors defined in dedicated constants files. Component files reference named imports, not hex literals.

---

## Phase 6: User Story 4 — Eliminate Module-Level Store Subscriptions (Priority: P2)

**Goal**: Create `persistedWritable()` utility and migrate 7 localStorage persistence subscriptions

**Independent Test**: `grep -rn '\.subscribe(' src/lib/stores/ src/lib/map/VisibilityEngine.ts` returns 0 results; stores still persist to and restore from localStorage on page reload

### Implementation for User Story 4

- [ ] T038 [US4] Create `persistedWritable<T>()` utility in `src/lib/stores/persisted-writable.ts` with localStorage read/write, JSON serialization, and graceful fallback on parse errors
- [ ] T039 [US4] Migrate `toolNavigationPath` and `expandedCategories` stores in `src/lib/stores/dashboard/tools-store.ts` to use `persistedWritable()` (remove .subscribe() at lines 148, 152)
- [ ] T040 [US4] Migrate `terminalPanelState` store in `src/lib/stores/dashboard/terminal-store.ts` to use `persistedWritable()` (remove .subscribe() at line 85)
- [ ] T041 [US4] Migrate `bottomPanelHeight` and `activeBottomTab` stores in `src/lib/stores/dashboard/dashboard-store.ts` to use `persistedWritable()` (remove .subscribe() at lines 54, 58)
- [ ] T042 [US4] Migrate `visibilityMode` and `promotedDevices` stores in `src/lib/map/VisibilityEngine.ts` to use `persistedWritable()` (remove .subscribe() at lines 46, 47)
- [ ] T043 [US4] Add constitutional exemption with real issue reference for HackRF spectrum `.subscribe()` in `src/lib/tactical-map/hackrf-service.ts:28` (legitimate reactive subscription, not persistence)
- [ ] T044 [US4] Run `npm run typecheck` and `npm run test:unit` to verify store migration — 0 errors, 190+ tests pass

**Checkpoint**: Zero `.subscribe()` calls in store modules (excluding hackrf-service.ts exemption and persistedWritable internal). Stores persist correctly.

---

## Phase 7: User Story 5 — Replace Placeholder Issue References (Priority: P3)

**Goal**: Replace all 54 `issue:#999` placeholders with real GitHub issue numbers created in Phase 1

**Independent Test**: `grep -rn '#999' src/` returns 0 results; each referenced issue exists on GitHub

### Implementation for User Story 5

- [ ] T045 [US5] Batch-replace all `issue:#999` occurrences with Article-IV-4.3 issue number (18 occurrences across 16 component files) — use the issue number from T002
- [ ] T046 [P] [US5] Batch-replace all `issue:#999` occurrences with Article-IV-4.2 issue number (8 occurrences across 8 component files) — use the issue number from T003
- [ ] T047 [P] [US5] Batch-replace all `issue:#999` occurrences with Article-IX-9.4 issue number (18 occurrences across 8 files) — use the issue number from T004
- [ ] T048 [P] [US5] Batch-replace all `issue:#999` occurrences with Article-II-2.1 + IX-9.1 issue number (9 occurrences across 9 files) — use the issue number from T005
- [ ] T049 [US5] Update template example in `src/lib/constitution/analysis-generator.ts` to use generic `issue:NNNN` placeholder instead of `issue:#999`
- [ ] T050 [US5] Run `grep -rn '#999' src/` to verify zero remaining placeholders

**Checkpoint**: Zero `#999` references in codebase. Each exemption comment references a real GitHub issue.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and commit hygiene

- [ ] T051 Run full verification suite: `npm run typecheck` (0 errors), `npm run test:unit` (190+ pass), `npm run test:security`, `npm run build` (success)
- [ ] T052 Verify SC-001 through SC-008 from spec.md — document pass/fail for each success criterion
- [ ] T053 Create GitHub issue to track remaining 6 oversized dashboard components (TerminalPanel 742, AgentChatPanel 619, LayersPanel 467, TerminalTabContent 387, IconRail 331, PanelContainer 317) for future work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — create issues first
- **US1 Boolean Rename (Phase 3)**: Independent — can start after Phase 1
- **US2 Component Decomposition (Phase 4)**: Independent — can start after Phase 1
- **US3 Theme Colors (Phase 5)**: Depends on US2 (T027 extracts map-styles.ts that T036 modifies)
- **US4 Persisted Stores (Phase 6)**: Independent — can start after Phase 1
- **US5 Issue References (Phase 7)**: Depends on Phase 1 (needs real issue numbers from T002-T005)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (Boolean Rename)**: Fully independent
- **US2 (Component Decomposition)**: Fully independent
- **US3 (Theme Colors)**: Soft dependency on US2 T027 (map-styles.ts extraction); can be done standalone if map colors are extracted directly from DashboardMap.svelte
- **US4 (Persisted Stores)**: Fully independent
- **US5 (Issue References)**: Depends on T002-T005 for real issue numbers

### Within Each User Story

- Type definitions renamed before consumers (US1)
- Extractions before rewiring orchestrator (US2)
- Constants files created before component updates (US3)
- Utility created before store migrations (US4)
- Issues created before replacements (US5)

### Parallel Opportunities

**Within US1**: T006-T011 (type definitions) all parallel; T012-T018 (consumers) all parallel after types
**Within US2**: T020-T024 (DevicesPanel) sequential; T025-T029 (DashboardMap) sequential; T030, T031 parallel with each other and with the main decompositions
**Within US3**: T033, T034 parallel (different files)
**Within US4**: T039-T042 parallel after T038 (utility creation)
**Within US5**: T045-T048 parallel (different article categories)

**Cross-story**: US1, US2, US4 can all proceed in parallel. US3 should follow US2. US5 follows Phase 1.

---

## Parallel Example: User Story 1

```bash
# Launch all type definition renames in parallel (T006-T011):
Task: "Rename running → isRunning in src/lib/kismet/api.ts"
Task: "Rename running → isRunning in src/lib/server/kismet/types.ts"
Task: "Rename running → isRunning in src/lib/server/services/kismet/kismet-control-service-extended.ts"
Task: "Rename running → isRunning in src/lib/server/services/gsm-evil/gsm-evil-health-service.ts"
Task: "Rename running → isRunning in src/lib/server/hardware/hackrf-manager.ts"
Task: "Rename running → isRunning in src/lib/server/hardware/detection/hardware-detector.ts"

# Then launch all consumer updates in parallel (T012-T018):
Task: "Update consumers in src/lib/server/kismet/service-manager.ts"
Task: "Update consumers in src/lib/server/hardware/resource-manager.ts"
Task: "Update consumers in src/lib/tactical-map/kismet-service.ts"
Task: "Update consumers in ToolsNavigationView.svelte"
Task: "Update consumers in GsmEvilPanel.svelte"
Task: "Update consumers in hardware-debugger.ts"
Task: "Update CSS class in ToolCard.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create GitHub issues)
2. Complete Phase 3: US1 Boolean Rename
3. **STOP and VALIDATE**: typecheck + tests pass, zero unprefixed booleans
4. Commit and verify

### Incremental Delivery

1. Phase 1 → Issues created
2. US1 → Boolean naming complete → Commit
3. US2 → Components decomposed → Commit
4. US3 → Colors extracted → Commit
5. US4 → Stores cleaned → Commit
6. US5 → References replaced → Commit
7. Phase 8 → Final verification → Ready for merge

### Recommended Execution Order (Sequential)

1. **US1** (boolean rename) — smallest blast radius, quick win
2. **US5** (issue references) — mechanical replacement, no logic changes
3. **US4** (persisted stores) — new utility + migrations, isolated to stores/
4. **US3** (theme colors) — new constants + component updates
5. **US2** (component decomposition) — largest change, highest risk, saved for when other stories are stable

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each phase or logical group of tasks
- OOM constraint: avoid running parallel subagents for component decomposition (large svelte-check runs)
- The 6 additional oversized components (TerminalPanel, AgentChatPanel, etc.) are out of scope — tracked in T053
