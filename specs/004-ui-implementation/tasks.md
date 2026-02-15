# Tasks: UI Modernization — Polished Components & Color Customization

**Input**: Design documents from `/specs/004-ui-implementation/`
**Prerequisites**: Spec 003 complete (Tailwind v4, shadcn CLI, Button + AlertDialog installed)

**Tests**: Not explicitly requested — verification commands included in polish phase per Definition of Done.

**Organization**: Tasks grouped by user story. Two parallel tracks: Track A (US1, US2 — component upgrades) and Track B (US3-US7 — theme system).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install all new dependencies and scaffold shadcn components

- [x] T001 Install mode-watcher npm dependency via `npm install mode-watcher` (FOUC prevention library from svecosystem, Svelte 5 compatible)
- [x] T002 [P] Install 5 shadcn components via `npx shadcn@latest add table input badge select switch` into src/lib/components/ui/

---

## Phase 2: Foundational (Theme Infrastructure)

**Purpose**: Core theme system that US3-US7 depend on. US1 can start immediately (no dependencies); US2 can start after Phase 1 (needs T002 components).

**CRITICAL**: US3-US7 cannot begin until this phase is complete.

- [x] T003 Create theme store with reactive Svelte 5 state ($state for palette/mode/semanticColors), DOM attribute management (data-palette on `<html>`, dark class toggle, semantic-colors-off class toggle), localStorage persistence under key 'argos-theme' (JSON-serialized ThemeState), and QuotaExceededError fallback to defaults `{palette:'default', mode:'dark', semanticColors:true}`. Export `setPalette()`, `setMode()`, `setSemanticColors()` methods. Follow terminal-store.ts pattern for localStorage serialization. File: src/lib/stores/theme-store.ts
- [x] T003b Create unit tests for theme store (depends on T003) in src/lib/stores/theme-store.test.ts — test cases: (1) default state is {palette:'default', mode:'dark', semanticColors:true}, (2) setPalette('green') updates state and sets document.documentElement.dataset.palette='green', (3) setPalette('default') removes data-palette attribute, (4) setMode('light') removes 'dark' class from html, (5) setMode('dark') adds 'dark' class, (6) setSemanticColors(false) adds 'semantic-colors-off' class, (7) state persists to localStorage under 'argos-theme' key as JSON, (8) reads saved state from localStorage on initialization, (9) falls back to defaults when localStorage throws QuotaExceededError, (10) falls back to defaults when localStorage contains invalid JSON. Mock document.documentElement and localStorage. Follow vitest patterns from existing test files.
- [x] T004 [P] Create PaletteDefinition[] array with complete HSL CSS variable values for all 8 palettes (Default/Zinc, Blue/Slate, Green/Zinc+custom, Orange/Stone, Red/Neutral, Rose/Zinc+custom, Violet/Gray, Yellow/Stone) — both dark and light mode values sourced from research.md R2. Include name (display), label (ThemePalette key), and cssVars.light + cssVars.dark Record<string, string> maps. File: src/lib/themes/palettes.ts
- [x] T005 [P] Add [data-palette] CSS variable override blocks for 7 non-default palettes to src/app.css — each palette gets both `:root[data-palette="X"]` (light) and `.dark[data-palette="X"]` (dark) selectors overriding --background, --foreground, --card, --card-foreground, --popover, --popover-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --destructive-foreground, --border, --input, --ring. Add universal chart colors (--chart-1 through --chart-5) to base :root and .dark blocks. Default palette uses existing :root/.dark block with no data-palette attribute. File: src/app.css
- [x] T006 [P] Add FOUC prevention inline `<script>` block to `<head>` in src/app.html — synchronously reads `localStorage.getItem('argos-theme')`, parses JSON, sets `document.documentElement.dataset.palette` to saved palette value (omit attribute for 'default'), and adds 'dark' class if saved mode is 'dark' or mode key is absent. Must execute before any CSS loads. Wrap in try/catch for JSON parse errors. File: src/app.html
- [x] T007 Wire mode-watcher ModeWatcher component into root layout for dark/light class synchronization — import and render `<ModeWatcher />` component. Keep existing markCSSLoaded() call (it handles CSS custom property detection, complementary to mode-watcher's dark/light class management). File: src/routes/+layout.svelte

**Checkpoint**: Theme infrastructure ready — palette switching works programmatically via theme store, CSS cascade responds to data-palette attribute, theme persists across refresh with no FOUC

---

## Phase 3: US1 - Modernized Buttons (Priority: P1) MVP

**Goal**: Replace all hand-crafted .btn-* buttons across the dashboard with shadcn Button components for consistent, modern styling with smooth hover transitions and clear focus indicators

**Independent Test**: Open Tools panel -> Start, Stop, Open buttons render with consistent border radius, smooth color transitions on hover, clear focus rings. Navigate to a tool view -> Back button has subtle ghost styling. All button actions (start/stop scan, open tool, go back) still work exactly as before.

- [x] T008 [US1] Replace .btn-start, .btn-danger, .btn-open buttons with shadcn Button components in src/lib/components/dashboard/shared/ToolCard.svelte — Start buttons use variant="default" with green accent class, Stop buttons use variant="destructive", Open buttons use variant="outline". Preserve all onclick handlers and disabled states. Use size="sm" to match existing compact layout. Note: ToolsNavigationView.svelte has NO button elements — it delegates rendering to ToolCard via {#each} blocks.
- [x] T009 [P] [US1] Replace .btn-ghost Back button with shadcn Button variant="ghost" size="sm" in src/lib/components/dashboard/views/ToolViewWrapper.svelte — preserve navigation onclick handler, maintain icon + text layout

**Checkpoint**: All dashboard buttons render with modern shadcn styling, identical click behavior

---

## Phase 4: US2 - Modernized Table, Inputs, Badges (Priority: P2)

**Goal**: Replace hand-crafted table, inputs, and badges with shadcn equivalents so all interactive elements share unified modern styling consistent with upgraded buttons

**Independent Test**: Open Devices panel -> device list table has clean row spacing, subtle hover highlights, consistent header styling. Search input has sharp focus ring and smooth transitions. Status badges use consistent pill shapes with appropriate color variants. Everything looks unified with the upgraded buttons.

- [x] T010 [US2] Replace .data-table-compact device list with shadcn Table.Root + Table.Header + Table.Row + Table.Head + Table.Body + Table.Cell components in src/lib/components/dashboard/panels/DevicesPanel.svelte — preserve column structure, row click handlers, hover highlight behavior, and selected row indicator. Use class="text-xs" for compact sizing. Also replace the whitelist "Add" button (.btn .btn-secondary .btn-sm, ~line 607) with shadcn Button variant="secondary" size="sm".
- [x] T011 [US2] Replace .input-field search/filter inputs with shadcn Input component in src/lib/components/dashboard/panels/DevicesPanel.svelte — preserve placeholder text, onInput/bind:value handlers, and monospace font class if used for technical data entry
- [x] T012 [US2] Replace all .badge, .badge-success, .badge-warning, .badge-error, .badge-info, .badge-neutral instances with shadcn Badge component across dashboard: variant mappings are success->default with green class, warning->default with yellow class, error->destructive, info->secondary, neutral->outline. Files: src/lib/components/dashboard/shared/ToolCard.svelte, src/lib/components/dashboard/views/ToolViewWrapper.svelte. Note: DevicesPanel badges (.type-badge, .enc-badge, .filter-badge) are component-scoped custom CSS, NOT Palantir .badge classes — they are out of scope for this task.
- [x] T013 [US2] Remove replaced CSS class definitions from src/lib/styles/palantir-design-system.css — remove .btn through .btn-full (lines ~170-262), .data-table blocks (lines ~140-168, ~471-500), .input-field blocks (lines ~502-529), .badge blocks (lines ~97-138). GSM Evil page (/gsm-evil) uses its own scoped button/badge classes (.control-btn, .scan-btn-red, .scan-btn-green, .back-btn-style) — no Palantir design system class dependencies to preserve. All targeted class blocks can be safely removed. Verify net CSS reduction >= 100 lines.

**Checkpoint**: All interactive elements share unified modern styling, old CSS removed, zero visual regressions

---

## Phase 5: US3 + US4 - Color Palette Selector & Theme Persistence (Priority: P2)

**Goal**: Operators can pick a color scheme from 8 palettes in the Settings panel; selection persists across page refreshes with no flash of default theme

**Independent Test**: Click gear icon -> Settings panel opens with "Appearance" section -> palette dropdown shows 8 options -> Select "Green" -> all panels, borders, accent colors shift to green tones instantly -> Refresh page -> Green palette loads immediately with no flash of default -> Select "Default" -> neutral gray returns

**US4 Note**: Theme persistence (localStorage read/write, FOUC prevention, private browsing fallback) is implemented in Phase 2 foundational tasks (T003 store persistence, T006 FOUC script, T007 mode-watcher). US4 acceptance criteria are satisfied when Phase 2 + US3 UI tasks are complete.

- [x] T014 [US3] Build "Appearance" section in Settings panel replacing "Settings options coming soon" placeholder — add section header "Appearance", shadcn Select dropdown with 8 palette options (Default, Blue, Green, Orange, Red, Rose, Violet, Yellow) each showing palette display name. Initialize Select value from $themeStore.palette. Import palette definitions from src/lib/themes/palettes.ts to populate options dynamically. File: src/lib/components/dashboard/panels/SettingsPanel.svelte
- [x] T015 [US3] Wire Select onValueChange callback to themeStore.setPalette(value as ThemePalette) — verify instant CSS variable cascade: selecting a palette updates data-palette attribute on `<html>`, CSS cascade applies new variable values from app.css [data-palette] blocks, all shadcn-styled components reflect new colors without page reload or layout shift

**Checkpoint**: Palette selector functional, color changes instant, persistence verified across refresh, no FOUC

---

## Phase 6: US5 - Dark/Light Mode Toggle (Priority: P3)

**Goal**: Operators can toggle between Dark and Light mode; backgrounds and text colors invert while palette accent colors adapt to the selected mode

**Independent Test**: Open Settings -> toggle Mode switch to Light -> backgrounds go white, text goes dark, all panels functional -> toggle back to Dark -> dark aesthetic returns. Palette colors adapt to both modes (e.g., Green palette in Light mode uses green accents on white backgrounds).

- [x] T016 [US5] Add "Mode" row with label and shadcn Switch toggle (Dark/Light) to Settings panel Appearance section, below the palette selector. Initialize Switch checked state from `$themeStore.mode === 'dark'`. Display descriptive label showing current mode. File: src/lib/components/dashboard/panels/SettingsPanel.svelte
- [x] T017 [US5] Wire mode Switch onCheckedChange to `themeStore.setMode(checked ? 'dark' : 'light')` — verify mode-watcher syncs dark class on `<html>`, palette CSS cascade applies correct mode-specific variable values from :root vs .dark selectors, backgrounds and text colors invert properly while accent colors adapt

**Checkpoint**: Dark/Light mode toggle works, persists alongside palette selection, no FOUC on refresh

---

## Phase 7: US6 - Semantic Colors Toggle (Priority: P3)

**Goal**: Operators can control whether operational colors (RSSI red/yellow/green, status indicators) remain fixed universal values or harmonize with the selected palette

**Independent Test**: Open Settings -> "Semantic Colors" toggle is ON by default -> RSSI colors show universal red/yellow/green -> Toggle OFF with "Rose" palette active -> signal indicators shift to rose-tinted variants -> Toggle ON -> operational colors return to universal values regardless of palette

- [x] T018 [US6] Add .semantic-colors-off CSS variable overrides to src/app.css — when `html.semantic-colors-off` class is present, redefine BOTH signal variable sets: (1) `--signal-critical` through `--signal-weak` (HSL, in app.css .dark block) and (2) `--palantir-signal-critical` through `--palantir-signal-weak` (hex, in palantir-design-system.css) to derive from palette's primary/accent/muted scale instead of fixed operational colors. Add both `.semantic-colors-off` (light) and `.dark.semantic-colors-off` (dark) blocks.
- [x] T019 [US6] Add "Semantic Colors" row with shadcn Switch toggle (default ON/checked) and explanatory subtext "Fixed red/yellow/green for signal & status" to Settings panel Appearance section. File: src/lib/components/dashboard/panels/SettingsPanel.svelte
- [x] T020 [US6] Wire semantic Switch onCheckedChange to `themeStore.setSemanticColors(checked)` — verify .semantic-colors-off class toggles on `<html>` element and signal/status CSS variables update accordingly when inspected via browser dev tools

**Checkpoint**: Semantic toggle functional — signal colors switch between fixed operational and palette-harmonized values

---

## Phase 8: US7 - Map & Spectrum Theme Consistency (Priority: P3)

**Goal**: Map markers, signal indicators, chat panel, terminal, and rendered graphics update colors when palette, mode, or semantic toggle changes — no stale colors remain

**Independent Test**: With tactical map visible -> switch from Default to Red palette -> map markers and signal indicators update colors -> no stale Default-colored markers remain. Toggle semantic colors OFF -> RANGE_BANDS colors shift to palette-harmonized. Switch to Light mode -> map overlays adapt. Open Agent Chat -> chat surfaces use theme-appropriate colors.

- [ ] T021 [US7] Replace 25 hardcoded hex colors in src/lib/components/dashboard/DashboardMap.svelte — convert RANGE_BANDS hex values (5), SVG gradient/connection stroke colors (6), MapLibre paint property hex values (8+), and CSS style block hex colors (12+) to CSS variable references via resolveThemeColor(). Subscribe to themeStore via $effect() to re-resolve all colors and call map.setPaintProperty() on each affected layer when palette/mode/semantic changes. Preserve all map data and interaction behavior.
- [ ] T022 [P] [US7] Replace 28+ hardcoded hex colors in src/lib/components/dashboard/AgentChatPanel.svelte per the AgentChatPanel Hex Mapping table in plan.md — map VS Code-style grays to shadcn semantic CSS variable references: --background for base surface, --card for chat bubbles, --muted for secondary surfaces, --accent for highlights, --border for dividers, --foreground/--muted-foreground for text hierarchy, --chart-1/2/4 for role colors. Use Tailwind utility classes (bg-card, text-muted-foreground, border-border) where possible; use resolveThemeColor() where inline style objects are required.
- [ ] T023 [P] [US7] Theme-map 5 xterm.js UI chrome colors in src/lib/components/dashboard/TerminalTabContent.svelte — xterm.js theme requires hex strings (not CSS var()), so resolve via resolveThemeColor() at init. Map ONLY UI chrome: background→resolveThemeColor('--background', '#0e1116'), foreground→resolveThemeColor('--foreground', '#e8eaed'), cursor→resolveThemeColor('--primary', '#4a9eff'), cursorAccent→resolveThemeColor('--background', '#0e1116'), selectionBackground→resolveThemeColor('--accent', 'rgba(74,158,255,0.3)'). Keep all 16 ANSI standard colors (black through brightWhite) FIXED — these are terminal color standards for CLI output (ls --color, git diff, error messages) and must not change with palette. Subscribe to themeStore via $effect() to re-resolve the 5 UI chrome colors and re-apply via terminal.options.theme when palette/mode changes.
- [ ] T024 [P] [US7] Replace 1 hardcoded hex color (band dot indicator) in src/lib/components/dashboard/panels/LayersPanel.svelte with CSS variable reference — use var(--primary) in inline style or resolveThemeColor('--primary') if hex string is needed

**Checkpoint**: All rendered graphics (map, chat, terminal, layers) respond to palette/mode/semantic changes — zero stale colors

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across all stories

- [ ] T025 Run full verification suite per Definition of Done: `npm run typecheck` (0 errors) && `npm run lint` (0 errors) && `npm run test:unit` (all pass) && `npm run build` (builds successfully)
- [ ] T026 Manually verify each palette (8) x mode (2) on /dashboard — confirm zero browser console errors, no layout shifts, all interactive elements functional, all rendered graphics (map, chat, terminal) reflect active theme colors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Only T007 depends on Phase 1 (T001 mode-watcher install); T003-T006 can start immediately in parallel with Phase 1 — BLOCKS US3-US7
- **US1 (Phase 3)**: No dependencies — Button component already installed from spec 003. Can start immediately, in parallel with Phase 1 and Phase 2.
- **US2 (Phase 4)**: Depends on Phase 1 ONLY — can start in parallel with Phase 2
- **US3+US4 (Phase 5)**: Depends on Phase 2 completion
- **US5 (Phase 6)**: Depends on US3 (Settings panel Appearance section must exist)
- **US6 (Phase 7)**: Depends on US3 (Settings panel must exist); independent of US5 but sequential due to same-file edits
- **US7 (Phase 8)**: Depends on Phase 2 + US6 (semantic toggle CSS must be in place so hex replacements support all theme dimensions)
- **Polish (Phase 9)**: Depends on all user stories complete

### User Story Dependencies

```
Start
  |
  +---> US1 (no dependencies — Button already installed from spec 003)
  |
  +---> Phase 1 (T001 mode-watcher, T002 shadcn components)
  |       |
  |       +---> US2 (needs T002: table/input/badge components)
  |
  +---> Phase 2 (T003-T006 start immediately; T007 waits for T001)
          |
          +---> US3+US4 ---> US5 ---> US7 ---> Polish
          |                    |                    ^
          |                    +---> US6 ----------+
```

- **US1 (P1)**: No dependencies — Button already installed from spec 003. Can start immediately.
- **US2 (P2)**: Independent — only needs Phase 1 components (table, input, badge)
- **US3+US4 (P2)**: Needs theme store + palette CSS + FOUC script (Phase 2)
- **US5 (P3)**: Needs Settings panel built (US3) for mode toggle placement
- **US6 (P3)**: Needs Settings panel built (US3) for semantic toggle placement; independent of US5
- **US7 (P3)**: Needs complete theme system (Phase 2 + US6 semantic CSS) so hex replacements respond to all theme dimensions

### Within Each User Story

- Implementation files modified one at a time (sequential within same file)
- Tasks touching the same file must be sequential
- [P] tasks touch different files and can run in parallel

### Parallel Opportunities

**Track-level parallelism**:
- Track A (US1 + US2) runs entirely in parallel with Track B (Phase 2 -> US3 -> US5 -> US6 -> US7)
- Within Track A: US1 and US2 share files (badges in T012 touch ToolCard + ToolViewWrapper) — run US1 first, then US2

**Task-level parallelism** (marked [P]):
- T001 || T002 (npm install vs npx shadcn CLI — independent tools)
- T003 || T004 (theme-store.ts vs palettes.ts — different new files)
- T005 || T006 || T007 (app.css vs app.html vs +layout.svelte — all different files, no import dependencies)
- T008 || T009 (ToolCard.svelte vs ToolViewWrapper.svelte)
- T022 || T023 || T024 (AgentChatPanel vs TerminalTabContent vs LayersPanel — all different files, all [P])

---

## Parallel Example: Two-Agent Strategy

```bash
# Agent A — Track A (Component Upgrades):
T008 (US1 buttons in ToolCard)
  -> T009 (US1 button in ToolViewWrapper)
  -> T010 (US2 table in DevicesPanel)
  -> T011 (US2 inputs in DevicesPanel)
  -> T012 (US2 badges across 2 files: ToolCard + ToolViewWrapper)
  -> T013 (US2 remove old CSS)

# Agent B — Track B (Theme System):
T003 (theme store) + T004 (palette defs) [parallel]
  -> T005 (palette CSS in app.css)
  -> T006 (FOUC script in app.html)
  -> T007 (mode-watcher in layout)
  -> T014 (US3 Settings panel dropdown)
  -> T015 (US3 wire palette selection)
  -> T016 (US5 mode toggle UI)
  -> T017 (US5 wire mode toggle)
  -> T018 (US6 semantic CSS)
  -> T019 (US6 semantic toggle UI)
  -> T020 (US6 wire semantic toggle)
  -> T021 (US7 DashboardMap hex replacement)

# After T020, launch parallel hex replacement agents:
Agent C: T022 (AgentChatPanel)
Agent D: T023 (TerminalTabContent)
Agent E: T024 (LayersPanel)

# All agents converge:
T025 (full verification)
T026 (manual palette verification)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (install deps)
2. Complete Phase 3: US1 (button upgrades in 2 files)
3. **STOP and VALIDATE**: All buttons render with modern styling, all click actions work
4. This is the minimum valuable increment — immediate visual quality improvement

### Incremental Delivery

1. Setup -> US1 -> buttons modernized **(MVP)**
2. US2 -> table/inputs/badges modernized, old CSS removed
3. Phase 2 -> theme infrastructure ready (store, palettes, CSS, FOUC, mode-watcher)
4. US3+US4 -> palette selector with persistence, no FOUC
5. US5 -> dark/light mode toggle
6. US6 -> semantic colors toggle
7. US7 -> map/chat/terminal/layers respond to theme changes
8. Polish -> full verification, console error check

Each increment is independently deployable and testable.

### Single-Agent Sequential Strategy

For single-agent execution, follow task IDs in order (T001 -> T026). The dependency ordering is already encoded in the task sequence. Commit after each task.

---

## Summary

| Metric | Value |
|---|---|
| Total tasks | 27 |
| US1 tasks | 2 (T008-T009) |
| US2 tasks | 4 (T010-T013) |
| US3 tasks | 2 (T014-T015) |
| US4 tasks | 0 (covered by Phase 2 foundational) |
| US5 tasks | 2 (T016-T017) |
| US6 tasks | 3 (T018-T020) |
| US7 tasks | 4 (T021-T024) |
| Setup tasks | 2 (T001-T002) |
| Foundational tasks | 6 (T003-T003b-T007) |
| Polish tasks | 2 (T025-T026) |
| Parallel groups | 4 (setup, foundational, US1 buttons, US7 hex replacement) |
| Track-level parallelism | Track A (US1+US2) || Track B (Phase 2 + US3-US7) |
| Suggested MVP | Phase 1 + US1 (3 tasks) |
