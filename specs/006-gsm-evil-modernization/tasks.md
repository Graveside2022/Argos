# Tasks: GSM Evil Page — UI Modernization & Component Decomposition

**Input**: Design documents from `/specs/006-gsm-evil-modernization/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/component-interfaces.md, quickstart.md

**Tests**: Not requested — no new test tasks. Existing `tests/unit/utils/gsm-tower-utils.test.ts` must keep passing throughout.

**Organization**: Tasks follow the plan's decomposition-first strategy. US4 (Component Decomposition) is elevated to Foundational phase because the plan requires extraction before visual modernization. Remaining user stories proceed in priority order (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify prerequisites and create component directory structure

- [X] T001 Verify branch is `006-gsm-evil-modernization`, types pass (`npm run typecheck`), and existing tests pass (`npm run test:unit`)
- [X] T002 Create component directory `src/lib/components/gsm-evil/` and verify `src/lib/components/ui/` has button, table, badge, alert-dialog installed

---

## Phase 2: Foundational — Component Extraction (US4)

**Purpose**: Decompose the 2204-line monolithic `+page.svelte` into 6 sub-components. Each extraction moves template markup + relevant scoped CSS into a new component file, adds the Svelte 5 `$props()` interface per `data-model.md`, wires the component into the parent via props/callbacks, and verifies identical rendering.

**CRITICAL**: Extractions are sequential — each modifies `src/routes/gsm-evil/+page.svelte`. Order follows plan (simplest → most complex). Existing CSS moves with the template; no visual changes yet.

- [X] T003 [US4] Extract ErrorDialog to `src/lib/components/gsm-evil/ErrorDialog.svelte` — move AlertDialog markup (lines ~1086-1096) + add `{open, message}` bindable props per contracts — update `src/routes/gsm-evil/+page.svelte` to import and use `<ErrorDialog>`
- [X] T004 [US4] Extract ScanConsole to `src/lib/components/gsm-evil/ScanConsole.svelte` — move scan progress console markup + `.scan-progress-console`, `.console-*` CSS — add `{scanProgress, isScanning}` props per contracts — update `src/routes/gsm-evil/+page.svelte`
- [X] T005 [US4] Extract LiveFramesConsole to `src/lib/components/gsm-evil/LiveFramesConsole.svelte` — move live frames display markup + `.live-frames-console`, `.frame-line` CSS — add `{gsmFrames, activityStatus, capturedIMSIs, selectedFrequency}` props per contracts — update `src/routes/gsm-evil/+page.svelte`
- [X] T006 [US4] Extract GsmHeader to `src/lib/components/gsm-evil/GsmHeader.svelte` — move header section markup (logo, title, status, Start/Stop button) + `.header`, `.control-btn`, `.scan-btn-*`, `.back-btn-style`, `.gsm-brand`, `.evil-brand`, `.subtitle` CSS — add `{isActive, buttonText, imsiCaptureActive, onscanbutton}` props per contracts — update `src/routes/gsm-evil/+page.svelte`
- [X] T007 [US4] Extract ScanResultsTable to `src/lib/components/gsm-evil/ScanResultsTable.svelte` — move frequency scan results table markup + `.frequency-table`, `.quality-badge`, `.channel-type`, `.select-btn` CSS — add `{scanResults, selectedFrequency, onselect}` props per contracts — update `src/routes/gsm-evil/+page.svelte`
- [X] T008 [US4] Extract TowerTable to `src/lib/components/gsm-evil/TowerTable.svelte` — move IMSI tower table markup + `.tower-*`, `.device-*`, `.header-sortable`, `.sort-indicator` CSS — move `handleSort`, `toggleTowerExpansion`, `formatTimestamp` functions into component as internal state — add `{groupedTowers, towerLocations, towerLookupAttempted, selectedFrequency}` props per contracts — update `src/routes/gsm-evil/+page.svelte`
- [X] T009 [US4] Slim `src/routes/gsm-evil/+page.svelte` to orchestrator pattern — verify script section is under 150 lines (FR-006), template only composes sub-components with props/callbacks, remaining CSS is page-level layout only — run `npm run typecheck && npm run lint`

**Checkpoint**: Decomposition complete — 6 components extracted, parent is slim orchestrator, page renders identically, all types pass. No visual changes yet.

---

## Phase 3: User Story 1 — Modernized Buttons (Priority: P1)

**Goal**: Replace all custom-styled buttons with shadcn Button component variants matching the dashboard standard.

**Independent Test**: All buttons (Back to Console, Start/Stop Scan, sort headers, Select frequency) render with shadcn Button styling — ghost, default/destructive, ghost, outline variants respectively. Visually indistinguishable from dashboard buttons.

### Implementation for User Story 1

- [X] T010 [P] [US1] Replace "Back to Console" link and "Start/Stop Scan" button with shadcn `Button` in `src/lib/components/gsm-evil/GsmHeader.svelte` — use `variant="ghost"` for back link, `variant="default"` for Start, `variant="destructive"` for Stop — import from `$lib/components/ui/button`
- [X] T011 [P] [US1] Replace 7 sortable column header buttons with shadcn `Button variant="ghost"` in `src/lib/components/gsm-evil/TowerTable.svelte` — add sort direction indicator, smooth hover transitions
- [X] T012 [P] [US1] Replace "Select" frequency buttons with shadcn `Button variant="outline"` in `src/lib/components/gsm-evil/ScanResultsTable.svelte`
- [X] T013 [US1] Remove replaced button CSS classes (`.control-btn`, `.scan-btn-*`, `.back-btn-style`, `.select-btn`, `.header-sortable`) from component `<style>` blocks — run `npm run typecheck && npm run lint`

**Checkpoint**: All buttons use shadcn Button. Visual match with dashboard confirmed. Types and lint pass.

---

## Phase 4: User Story 2 — Modernized Tables and Data Displays (Priority: P1)

**Goal**: Replace custom HTML tables with shadcn Table component hierarchy matching the dashboard table standard.

**Independent Test**: Frequency scan results table and IMSI tower table have clean row separation, consistent headers, subtle hover highlights. Tower table expansion behavior works correctly with shadcn Table sub-components.

### Implementation for User Story 2

- [X] T014 [P] [US2] Replace frequency scan results table with shadcn `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell` in `src/lib/components/gsm-evil/ScanResultsTable.svelte` — import from `$lib/components/ui/table`
- [X] T015 [P] [US2] Replace IMSI tower table with shadcn Table components in `src/lib/components/gsm-evil/TowerTable.svelte` — preserve expandable device sub-rows using `{#if}` blocks inside `TableBody`, consistent header/row/cell styling
- [X] T016 [US2] Remove replaced table CSS classes (`.frequency-table`, `.tower-*`, `.device-*`) from component `<style>` blocks — run `npm run typecheck && npm run lint`

**Checkpoint**: Both tables use shadcn Table components. Row separation, hover highlights, and expansion behavior work correctly. Types and lint pass.

---

## Phase 5: User Story 3 — Modernized Badges and Status Indicators (Priority: P2)

**Goal**: Replace all custom-styled badges and indicators with shadcn Badge component variants.

**Independent Test**: Signal quality badges (Excellent/Strong/Moderate/Weak) render as clean pills with color variants. Channel type badges, IMSI capture status, scan progress badge, and activity indicators all use consistent Badge styling.

### Implementation for User Story 3

- [X] T017 [P] [US3] Replace signal quality badges and channel type badges with shadcn `Badge` in `src/lib/components/gsm-evil/ScanResultsTable.svelte` — quality colors: green for Excellent/Very Strong, yellow for Moderate, red for Weak — channel type: `variant="secondary"` for CONTROL, `variant="outline"` for unknown — import from `$lib/components/ui/badge`
- [X] T018 [P] [US3] Replace "IMSI Capture Active" status indicator with shadcn `Badge` in `src/lib/components/gsm-evil/GsmHeader.svelte`
- [X] T019 [P] [US3] Replace "SCANNING..."/"COMPLETE" status badge with shadcn `Badge` in `src/lib/components/gsm-evil/ScanConsole.svelte`
- [X] T020 [P] [US3] Replace activity indicators (checkmark/X, packet count, frequency display) with shadcn `Badge` and consistent iconography in `src/lib/components/gsm-evil/LiveFramesConsole.svelte`
- [X] T021 [US3] Remove replaced badge/indicator CSS classes (`.quality-badge`, `.channel-type`, `.status-indicator`) from component `<style>` blocks — run `npm run typecheck && npm run lint`

**Checkpoint**: All badges and indicators use shadcn Badge. Consistent pill shapes and color variants across all components. Types and lint pass.

---

## Phase 6: User Story 5 — CSS Reduction (Priority: P2)

**Goal**: Reduce custom CSS from 1107 lines to under 200 lines by removing all styles replaced by component library equivalents and Tailwind utilities.

**Independent Test**: Total custom CSS across all GSM Evil components and the parent page is under 200 lines. Remaining CSS contains only: console monospace formatting, brand typography, animations, and layout-specific grid/flex patterns. No visual regressions.

### Implementation for User Story 5

- [X] T022 [US5] Audit all `<style>` blocks across `src/lib/components/gsm-evil/*.svelte` and `src/routes/gsm-evil/+page.svelte` — identify and delete all CSS classes already replaced by shadcn components or Tailwind utilities
- [X] T023 [US5] Delete utility class redefinitions (`.flex`, `.items-center`, `.gap-3`, `.text-xs`, etc.) and unused CSS (`.btn-settings`, dead selectors) from all component `<style>` blocks
- [X] T024 [US5] Convert remaining layout-specific inline styles to Tailwind utility classes where possible — keep scoped CSS only for: console monospace, brand typography (`.gsm-brand`, `.evil-brand`), `@keyframes` animations (spin, blink, pulse)
- [X] T025 [US5] Verify CSS reduction target: count total `<style>` lines across all GSM Evil files, confirm under 200 lines (FR-007) — run `npm run typecheck && npm run lint && npm run build`

**Checkpoint**: CSS reduced from 1107 to <200 lines. No visual regressions. Build passes.

---

## Phase 7: User Story 6 — Theme Palette Integration (Priority: P3)

**Goal**: Replace all remaining hardcoded hex colors with CSS custom properties so the GSM Evil page inherits the active theme palette from spec 003's theme system (8 palettes, dark-mode only).

**Independent Test**: Set palette to "Green" in Settings, navigate to GSM Evil — accent colors are green. Switch to "Violet" — accent colors update to violet. All 8 palettes render correctly with no hardcoded colors breaking the theme.

### Implementation for User Story 6

- [X] T026 [US6] Replace remaining hardcoded colors in all `src/lib/components/gsm-evil/*.svelte` per plan color mapping: `#dc2626` → `text-destructive`, `#000` → `bg-background`, `#fff` → `text-foreground`, `#9ca3af` → `text-muted-foreground`, `rgba(255,0,0,0.2)` → `border-destructive/20`
- [X] T027 [US6] Replace remaining hardcoded colors in `src/routes/gsm-evil/+page.svelte` page-level styles — ensure all accent/highlight colors derive from CSS custom properties (`var(--destructive)`, `var(--foreground)`, etc.)
- [X] T028 [US6] Verify all 8 palettes (default, blue, green, orange, red, rose, violet, yellow) render correctly on GSM Evil page — no stale hardcoded hex values, accent colors consistent with dashboard — run `npm run typecheck && npm run lint`

**Checkpoint**: Theme palette integration complete. All 8 palettes render correctly. No hardcoded colors remain.

---

## Phase 8: Polish & Final Verification

**Purpose**: Full verification, regression testing, and compliance checks

- [X] T029 Run full verification workflow: `npm run typecheck && npm run lint && npm run test:unit && npm run build`
- [X] T030 Verify FR compliance checklist: parent script <150 lines (FR-006), total custom CSS <200 lines (FR-007), 6 components exist in `src/lib/components/gsm-evil/` (FR-005), zero layout changes (FR-011)
- [X] T031 Verify zero behavioral regressions: GSM scanning start/stop, IMSI capture, tower grouping/sorting, tower expansion, frequency selection, frame display, scan progress console, error dialogs (FR-008)
- [X] T032 Run quickstart.md validation sequence and verify zero browser console errors (SC-009)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2 / US4)**: Depends on Setup — BLOCKS all visual modernization
- **US1 Buttons (Phase 3)**: Depends on Foundational completion
- **US2 Tables (Phase 4)**: Depends on Foundational completion — can run in parallel with US1 (different element types) but some tasks touch same files, recommend sequential
- **US3 Badges (Phase 5)**: Depends on Foundational completion — can run after or in parallel with US1/US2
- **US5 CSS Reduction (Phase 6)**: Depends on US1 + US2 + US3 completion (all replacements must be done before cleanup)
- **US6 Theme Integration (Phase 7)**: Depends on US5 completion (hardcoded colors addressed during CSS cleanup)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

```
Setup (Phase 1)
  └── US4 Decomposition (Phase 2) ← FOUNDATIONAL, BLOCKS ALL
        ├── US1 Buttons (Phase 3) ──┐
        ├── US2 Tables (Phase 4) ───┼── Can run in parallel (recommend sequential)
        └── US3 Badges (Phase 5) ──┘
              └── US5 CSS Reduction (Phase 6)
                    └── US6 Theme Integration (Phase 7)
                          └── Polish (Phase 8)
```

### Within Each User Story

- Component-level tasks marked [P] can run in parallel (different files)
- CSS cleanup tasks depend on all component upgrades within that story
- Verification tasks depend on all tasks within the story

### Parallel Opportunities

**Phase 2 (Extraction)**: Sequential only — all tasks modify `+page.svelte`

**Phase 3 (Buttons)**: T010, T011, T012 can run in parallel (different component files)

**Phase 4 (Tables)**: T014, T015 can run in parallel (different component files)

**Phase 5 (Badges)**: T017, T018, T019, T020 can run in parallel (four different component files)

**Phase 6-8**: Sequential — each depends on previous phase

---

## Parallel Example: User Story 3 (Badges)

```bash
# Launch all badge replacements in parallel (different files):
Task: "Replace quality/channel badges in ScanResultsTable.svelte"    # T017
Task: "Replace IMSI status indicator in GsmHeader.svelte"            # T018
Task: "Replace scan progress badge in ScanConsole.svelte"            # T019
Task: "Replace activity indicators in LiveFramesConsole.svelte"      # T020

# Then sequentially:
Task: "Remove replaced badge CSS classes"                            # T021
```

---

## Implementation Strategy

### MVP First (US4 + US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Component Extraction (US4) — page decomposed, renders identically
3. Complete Phase 3: Buttons (US1) — most visible quality improvement
4. **STOP and VALIDATE**: Page is decomposed AND buttons are modern
5. Commit/push — working increment

### Incremental Delivery

1. Setup + US4 Extraction → Decomposed page, identical rendering → Commit
2. Add US1 Buttons → Modern buttons, dashboard-quality interactions → Commit
3. Add US2 Tables → Modern tables, clean row styling → Commit
4. Add US3 Badges → Modern badges, consistent indicators → Commit
5. Add US5 CSS Cleanup → Lean styling footprint (<200 lines) → Commit
6. Add US6 Theme → Full palette integration, seamless navigation → Commit
7. Polish → Final verification, regression check → PR-ready

### Key Decisions

- **US4 elevated to Foundational**: The plan requires decomposition before visual modernization. Even though US4 is P2 in the spec, it's a prerequisite for all visual work.
- **No new tests**: The spec does not request new component tests. Existing `gsm-tower-utils.test.ts` must pass throughout.
- **Sequential extraction**: Each extraction modifies `+page.svelte`, preventing parallel execution during Phase 2.
- **Parallel visual upgrades**: Within each visual story (US1/US2/US3), component-level tasks can run in parallel since they modify different files.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks within same phase
- [US*] label maps task to specific user story for traceability
- Commit after each task or logical group per constitution (XII §12.1)
- Verify `npm run typecheck && npm run lint` after each extraction and upgrade
- Full verification (`typecheck + lint + test:unit + build`) at phase boundaries
- No layout changes (FR-011) — pixel-identical positioning throughout
- Store (`gsmEvilStore`) remains unchanged — sub-components receive data via props only
