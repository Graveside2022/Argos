# Tasks: Lunaris UI Redesign

**Input**: Design documents from `/specs/012-lunaris-ui-redesign/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/token-api.md, quickstart.md

**Tests**: Not explicitly requested in spec. Visual validation via browser inspection and screenshot comparison at checkpoints. Visual regression snapshots captured at Phase 10 for key components.

**Constitution Override**: This feature operates under a planned Art. IV.1 amendment (T050). The current "Cyberpunk theme" principle is superseded by Lunaris for the scope of this feature branch.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Font files, token foundation, and import wiring — everything that must exist before any component can be restyled.

- [ ] T001 Download and add Fira Code WOFF2 font files (Regular, SemiBold, Bold) to static/fonts/
- [ ] T002 Download and add Geist WOFF2 font files (Regular, Medium) to static/fonts/
- [ ] T003 Create Lunaris design token file with @font-face declarations, all color tokens, typography scale, spacing scale, and layout tokens in src/lib/styles/lunaris-tokens.css
- [ ] T004a Replace oklch color tokens in src/app.css :root block with Lunaris hex token values from data-model.md
- [ ] T004b Remove all 7 data-palette override blocks ([data-palette="blue"] through [data-palette="yellow"]) from src/app.css
- [ ] T004c Update @theme inline block in src/app.css to map Lunaris tokens to Tailwind utilities, and change body font-family from Inter to Fira Code/Geist font stacks
- [ ] T005 Update src/lib/styles/dashboard.css to reference Lunaris tokens: change --font-sans and --font-mono stacks, update --panel-width from 320px to 280px, update --top-bar-height from 48px to 40px
- [ ] T006 Update src/routes/dashboard/+page.svelte to import lunaris-tokens.css instead of palantir-design-system.css
- [ ] T007 Delete src/lib/styles/palantir-design-system.css (replaced by lunaris-tokens.css)

**Checkpoint**: Token system is live. Dashboard should render with new colors/fonts but component-level styling still uses old class names. Verify fonts load and base colors appear.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove old utility classes that components depend on, provide Lunaris replacements, and simplify the theme store.

- [ ] T008 Add Lunaris utility classes to src/lib/styles/lunaris-tokens.css replacing Palantir utilities: .bg-surface, .bg-elevated, .bg-app, .text-tertiary, .text-brand, .border-subtle, .border-strong, .text-success, .text-error, .text-warning, .text-info, and all .bg-*-muted classes — mapped to new token values
- [ ] T009 Add Lunaris status text utilities to src/lib/styles/lunaris-tokens.css: .text-status-healthy, .text-status-warning, .text-status-error, .text-status-inactive, .text-status-info — mapped to desaturated semantic colors
- [ ] T010 Remove palette switching logic from src/lib/stores/theme-store.svelte.ts: eliminate palette list, data-palette attribute setter, simplify to dark-mode-only with single accent color token
- [ ] T011 Update Leaflet popup and zoom control overrides in src/lib/styles/dashboard.css to reference Lunaris tokens instead of --palantir-* variables

**Checkpoint**: Foundation ready. Old Palantir variables are gone, Lunaris utilities are available, theme store is simplified. Dashboard should render correctly with new token system. All user story work can now begin.

---

## Phase 3: User Story 1 — Unified Visual Identity (Priority: P1) MVP

**Goal**: All backgrounds, borders, text colors, fonts, and spacing across the dashboard use Lunaris tokens consistently.

**Independent Test**: Load the dashboard and verify: no rogue colors, all text uses Fira Code or Geist, consistent spacing. Inspect computed styles — all color values should trace to Lunaris tokens.

### Implementation for User Story 1

- [ ] T012 [P] [US1] Restyle src/lib/components/dashboard/PanelContainer.svelte: update background, border, and text colors to Lunaris tokens
- [ ] T013 [P] [US1] Restyle src/lib/components/dashboard/panels/SettingsPanel.svelte: update all hardcoded colors, fonts, and spacing to Lunaris tokens
- [ ] T014 [P] [US1] Restyle src/lib/components/dashboard/panels/DevicesPanel.svelte: update card backgrounds, text hierarchy, borders to Lunaris tokens
- [ ] T015 [P] [US1] Restyle src/lib/components/dashboard/panels/LayersPanel.svelte: update backgrounds, text, borders to Lunaris tokens
- [ ] T016 [P] [US1] Restyle src/lib/components/dashboard/panels/ToolsPanel.svelte and src/lib/components/dashboard/panels/ToolsPanelHeader.svelte: update panel styling to Lunaris tokens
- [ ] T017 [P] [US1] Restyle src/lib/components/dashboard/shared/ToolCard.svelte and src/lib/components/dashboard/shared/ToolCategoryCard.svelte: update card backgrounds, borders, text to Lunaris tokens
- [ ] T018 [US1] Visual validation checkpoint: load dashboard at 1920x1080, verify all visible panels use Lunaris token colors, Fira Code/Geist fonts, and consistent spacing — no fallback fonts or rogue hex colors

**Checkpoint**: Unified visual identity established across all panels and cards. Dashboard feels cohesive.

---

## Phase 4: User Story 2 — Command Bar and Navigation (Priority: P1)

**Goal**: Top command bar displays ARGOS brand, connection status, GPS, and clock with Lunaris styling at 40px height.

**Independent Test**: Load dashboard, verify command bar shows brand text in accent color, GPS satellite count updates, clock ticks, all indicators styled with Lunaris tokens.

### Implementation for User Story 2

- [ ] T019 [US2] Restyle src/lib/components/dashboard/TopStatusBar.svelte: update bar height to 40px, brand text ("ARGOS") in accent color with --text-brand size, replace hardcoded colors with Lunaris tokens, update font to --font-mono for data, --font-sans for labels
- [ ] T020 [P] [US2] Restyle src/lib/components/dashboard/status/GpsDropdown.svelte: update dropdown background, border, text hierarchy to Lunaris tokens
- [ ] T021 [P] [US2] Restyle src/lib/components/dashboard/status/SdrDropdown.svelte: update dropdown styling to Lunaris tokens
- [ ] T022 [P] [US2] Restyle src/lib/components/dashboard/status/WifiDropdown.svelte: update dropdown styling to Lunaris tokens
- [ ] T023 [P] [US2] Restyle src/lib/components/dashboard/status/WeatherDropdown.svelte: update dropdown styling to Lunaris tokens
- [ ] T024 [P] [US2] Restyle src/lib/components/dashboard/status/CoordsDisplay.svelte: update coordinate typography to --font-mono, accent color for GPS sat count
- [ ] T025 [US2] Remove hardware state dot indicators from TopStatusBar.svelte: replace colored dots with text-based status labels using --status-* colors

**Checkpoint**: Command bar is fully Lunaris-styled. Brand identity is clear, all indicators use semantic text labels.

---

## Phase 5: User Story 3 — System Overview Panel with Logs Section (Priority: P1)

**Goal**: Overview panel shows 4 metric tiles + 5 status sections (Network, Hardware, Tools, Services, Logs) with text-based status labels, no dots.

**Independent Test**: Load dashboard, verify all 9 blocks render, status labels use desaturated semantic colors with text (no dots), Logs section shows aggregate counters.

### Implementation for User Story 3

- [ ] T026 [P] [US3] Restyle src/lib/components/dashboard/panels/overview/SystemInfoCard.svelte: update metric tiles with Lunaris typography (--text-hero for values, --text-label for headers), progress bars using --accent color, tile backgrounds --bg-base with --border-strong
- [ ] T027 [P] [US3] Restyle src/lib/components/dashboard/panels/overview/HardwareCard.svelte: remove status dots, add text-based status labels with --status-* colors, update typography
- [ ] T028 [P] [US3] Restyle src/lib/components/dashboard/panels/overview/ServicesCard.svelte: remove status dots, add text-based status labels with --status-* colors, update typography
- [ ] T029 [P] [US3] Restyle src/lib/components/dashboard/panels/overview/WifiInterfacesCard.svelte: remove status dots, add text-based status labels, update typography
- [ ] T030 [P] [US3] Restyle src/lib/components/dashboard/panels/overview/GpsCard.svelte: update GPS display with Lunaris typography, accent color for satellite count
- [ ] T031 [US3] Create src/lib/components/dashboard/panels/overview/LogsSummaryCard.svelte: new component displaying aggregate counters — total events (24h), warnings, errors, time since last alert — with --text-label header, --text-row data, --status-* colored counts. Data source: static placeholder values initially (events: "—", warnings: 0, errors: 0, last alert: "—"); will be wired to a log store in a future feature when the expanded log viewer is built
- [ ] T032 [US3] Update src/lib/components/dashboard/panels/OverviewPanel.svelte: import and render LogsSummaryCard after ServicesCard, adjust panel width to 280px, update padding and gap values to Lunaris spacing tokens
- [ ] T032a [US3] Download librespeed-cli v1.0.12 linux_arm64 static binary (~3 MB) to static/bin/librespeed-cli, add to .gitignore (binary), document installation in specs/012-lunaris-ui-redesign/research.md
- [ ] T032b [US3] Create API endpoint src/routes/api/speedtest/+server.ts: POST triggers librespeed-cli execution via hostExec, streams JSON result (download, upload, latency, server); GET returns last cached result. Input-validate server URL if custom. Timeout: 30s.
- [ ] T032c [US3] Add speed test button and inline results display to the Network block in the overview panel: button styled per mockup (gauge icon, "Speed Test" label, --text-tertiary #666666 text, --bg-card #1A1A1A bg, --border-default #2E2E2E border), results replace button text temporarily showing "↓ XX Mbps ↑ XX Mbps · XXms", loading state shows spinner

**Checkpoint**: Overview panel is complete with all 9 blocks, text-based status indicators, new Logs summary, and working speed test. No colored dots remain.

---

## Phase 6: User Story 4 — Icon Rail Navigation (Priority: P2)

**Goal**: 48px icon rail with Lunaris-styled icons, active/hover states, terminal shortcut at top, waypoints logo below spacer.

**Independent Test**: Click each nav icon, verify correct panel opens with active state styling. Verify terminal icon (accent) focuses bottom panel. Verify waypoints logo is static (not clickable — reserved for future feature). Verify hover highlights.

### Implementation for User Story 4

- [ ] T033 [US4] Restyle src/lib/components/dashboard/IconRail.svelte: update rail background to --bg-card, active icon state with --accent color/background, hover state with --bg-elevated, terminal icon at top (accent-colored, focuses bottom panel terminal), waypoints logo below spacer (static, non-interactive — reserved for future feature, not yet implemented), update icon colors to --text-secondary (inactive) and --text-primary (active)

**Checkpoint**: Icon rail navigation works with Lunaris styling. Terminal shortcut works. Waypoints logo is a static brand mark (future feature placeholder).

---

## Phase 7: User Story 5 — Map Area with Tactical Overlay (Priority: P2)

**Goal**: Map chrome, markers, GPS indicator, and overlays all use Lunaris tokens. AP markers use accent color, target markers use error color.

**Independent Test**: Load dashboard with GPS, verify AP markers are steel blue, target markers are red-orange, GPS indicator styled with Lunaris tokens.

### Implementation for User Story 5

- [ ] T034 [P] [US5] Restyle src/lib/components/dashboard/DashboardMap.svelte: update map container background, any overlay chrome to Lunaris tokens
- [ ] T035 [P] [US5] Update src/lib/components/dashboard/map/DeviceOverlay.svelte: AP markers use --accent color, target/tracked markers use --status-error color
- [ ] T036 [P] [US5] Restyle src/lib/components/dashboard/map/TowerPopup.svelte: update popup background to --bg-card, borders to --border-default, text to Lunaris typography tokens
- [ ] T037 [US5] Update src/lib/components/dashboard/status/SatelliteTable.svelte: update satellite table styling to Lunaris tokens if present in map overlays

**Checkpoint**: Map chrome is Lunaris-styled. Color coding is correct: accent for AP markers, error for targets.

---

## Phase 8: User Story 6 — Resizable Bottom Panel with Tabs (Priority: P2)

**Goal**: Bottom panel tab bar, collapse caret, drag handle, and all tab content areas styled with Lunaris tokens.

**Independent Test**: Expand/collapse bottom panel, switch all tabs, drag to resize. Verify smooth transitions and Lunaris styling throughout.

### Implementation for User Story 6

- [ ] T038 [US6] Restyle src/lib/components/dashboard/ResizableBottomPanel.svelte: update tab bar background to --bg-card, active tab fill #222222 with #2E2E2E border and --accent text, inactive tabs with --text-data (#BBBBBB), add 5 tabs (Terminal|Chat|Logs|Captures|Network Map), Terminal tab gets plus icon for tmux, collapse caret with --text-secondary, drag handle with --border-default
- [ ] T039 [P] [US6] Restyle src/lib/components/dashboard/TerminalPanel.svelte and src/lib/components/dashboard/TerminalTabContent.svelte: update terminal font to --font-mono, background to --bg-base, text colors to Lunaris tokens
- [ ] T040 [P] [US6] Restyle src/lib/components/dashboard/AgentChatPanel.svelte: update chat bubble backgrounds, text colors, input field styling to Lunaris tokens
- [ ] T041 [P] [US6] Restyle src/lib/components/dashboard/LogsPanel.svelte: update log entry styling, severity colors using --status-* tokens, timestamps with --text-tertiary

**Checkpoint**: Bottom panel fully styled. All tabs render with Lunaris tokens. Collapse/expand/resize work smoothly.

---

## Phase 9: User Story 7 — Accent Color Theming (Priority: P3)

**Goal**: All accent-colored elements throughout the interface reference a single --accent token. Changing it updates everything. Semantic status colors remain independent.

**Independent Test**: Change --accent value in lunaris-tokens.css from #809AD0 to a different color (e.g., #D0809A), reload — verify all accent elements update and semantic colors remain unchanged.

### Implementation for User Story 7

- [ ] T042 [US7] Audit all components for hardcoded accent color values (#809AD0, #A8BBD8): grep for hex values in src/lib/components/dashboard/**/*.svelte, replace any instances with var(--accent) or var(--accent-light) references
- [ ] T043 [US7] Verify semantic color independence: temporarily change --accent in lunaris-tokens.css, reload dashboard, confirm --status-healthy/--status-warning/--status-error/--status-inactive colors are unchanged
- [ ] T044 [US7] Document accent color swapping in specs/012-lunaris-ui-redesign/quickstart.md: add section explaining how to change the accent color with before/after token values

**Checkpoint**: Accent theming is fully tokenized. All accent references use var(--accent). Semantic layer is independent.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and documentation

- [ ] T045 [P] Run full build validation: npm run build — verify zero errors with new token system
- [ ] T046 [P] Run TypeScript check: npx tsc --noEmit — verify no type errors introduced
- [ ] T047 Full visual validation at 1920x1080: load every dashboard view (Overview, Devices, Tools, Layers, Settings), verify all panels, cards, and interactive elements use Lunaris tokens consistently — no rogue colors, no fallback fonts, no layout breakage
- [ ] T048 Verify WCAG AA contrast ratios: spot-check text on background combinations match data-model.md contrast ratio table
- [ ] T049 Verify all status indicators have text labels alongside color (FR-012 compliance): grep for --status-* usage and confirm each instance has adjacent text content
- [ ] T050 [P] Capture visual regression baseline screenshots for key views (Overview, Command Bar, Bottom Panel expanded, Map with markers) using browser dev tools at 1920x1080 — save to specs/012-lunaris-ui-redesign/screenshots/
- [ ] T051 Verify FR-014 compliance (consistent spacing tokens): grep src/lib/components/dashboard/**/*.svelte for ad-hoc pixel values (inline px not from tokens) and replace with var(--space-N) or Tailwind utilities
- [ ] T052 Update .specify/memory/constitution.md Article IV.1 from "Cyberpunk theme" to "Lunaris design system. Monospaced data (Fira Code). Sans-serif UI chrome (Geist). High density. Dark-first. Steel blue accent. Desaturated semantic status colors."
- [ ] T053 Clean up any remaining references to palantir-design-system.css or --palantir-* variables across the codebase: grep and fix any stale imports or variable references

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories
- **User Stories (Phases 3-9)**: All depend on Foundational (Phase 2) completion
  - US1 (Phase 3), US2 (Phase 4), US3 (Phase 5): P1 priority — complete first
  - US4 (Phase 6), US5 (Phase 7), US6 (Phase 8): P2 priority — can run in parallel after P1 stories
  - US7 (Phase 9): P3 priority — depends on all prior stories being complete (needs all accent elements to be tokenized)
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 — Unified Visual Identity**: Can start after Foundational — no dependencies on other stories
- **US2 — Command Bar**: Can start after Foundational — independent of US1
- **US3 — Overview Panel + Logs**: Can start after Foundational — independent of US1/US2
- **US4 — Icon Rail**: Can start after Foundational — independent
- **US5 — Map Area**: Can start after Foundational — independent
- **US6 — Bottom Panel**: Can start after Foundational — independent
- **US7 — Accent Theming**: Depends on US1-US6 being complete (audit requires all components already tokenized)

### Within Each User Story

- Models/data first (if any)
- Component restyling can be parallel when targeting different files
- Integration/validation tasks are sequential (depend on component tasks)
- Story-level checkpoint validates before moving on

### Parallel Opportunities

- T001 and T002 (font downloads) can run in parallel
- T012-T017 (US1 panel restyling) can all run in parallel (different files)
- T020-T024 (US2 dropdown restyling) can all run in parallel (different files)
- T026-T030 (US3 overview card restyling) can all run in parallel (different files)
- T034-T036 (US5 map components) can all run in parallel (different files)
- T039-T041 (US6 tab content panels) can all run in parallel (different files)
- T045-T046 (build + type check) can run in parallel
- T050-T051 (screenshots + spacing audit) can run in parallel

---

## Parallel Example: User Story 3 (Overview Panel)

```bash
# Launch all card restyling tasks in parallel (different files):
Task: "Restyle SystemInfoCard.svelte with Lunaris tokens"
Task: "Remove dots from HardwareCard.svelte, add text status labels"
Task: "Remove dots from ServicesCard.svelte, add text status labels"
Task: "Remove dots from WifiInterfacesCard.svelte, add text status labels"
Task: "Restyle GpsCard.svelte with Lunaris typography"

# Then sequential (depends on parallel tasks):
Task: "Create LogsSummaryCard.svelte"
Task: "Update OverviewPanel.svelte to import LogsSummaryCard and adjust layout"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup (T001-T007) — token system and fonts
2. Complete Phase 2: Foundational (T008-T011) — utility classes and theme store
3. Complete Phase 3: US1 Unified Visual Identity (T012-T018) — all panels tokenized
4. Complete Phase 4: US2 Command Bar (T019-T025) — top bar restyled
5. Complete Phase 5: US3 Overview Panel + Logs (T026-T032) — overview with logs section
6. **STOP and VALIDATE**: Dashboard has new visual identity, command bar, and overview panel
7. Deploy/demo if ready — this covers all P1 stories

### Incremental Delivery

1. Setup + Foundational → Token system live
2. Add US1 → Test independently → Visual coherence established (MVP!)
3. Add US2 + US3 → Test independently → Core dashboard surfaces complete
4. Add US4 + US5 + US6 → Test independently → All interactive areas styled
5. Add US7 → Test independently → Accent theming verified
6. Polish → Final validation → Ready for merge

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group per Constitution Art. IX.2
- Stop at any checkpoint to validate story independently
- This feature is primarily CSS/markup — no new API endpoints, no database changes, no TypeScript logic changes
- Constitution Article IV.1 amendment (T050) should be the last non-validation task
