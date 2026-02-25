# Tasks: Lunaris UI Unification

**Input**: Design documents from `/specs/017-lunaris-ui-unification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/token-contract.md, quickstart.md

**Tests**: Not explicitly requested — omitted per constitution §3.1 exemption rationale: this is a pure CSS token value refactor with no behavioral changes. Traditional unit tests cannot assert CSS custom property values meaningfully. Verification is achieved via automated grep audits (T056-T057 check for zero hardcoded hex/font violations) and manual visual inspection (T058 layout measurement, T059 performance). These serve as the testing equivalent for styling-only changes.

**Organization**: Tasks grouped by user story (6 stories from spec.md). Since this is a CSS token refactor, the cascade order determines dependencies: base tokens → bridge layer → component fixes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Font Assets)

**Purpose**: Obtain and install the Geist font — the only new asset this feature requires.

- [x] T001 Download Geist woff2 font files (Regular, Medium, SemiBold) from Vercel's MIT-licensed release into `static/fonts/geist/`
- [x] T002 Create `@font-face` declarations for Geist in `static/fonts/geist.css` following the pattern in `static/fonts/firacode-nerd-font.css` (3 weights: 400, 500, 600; `font-display: swap`)
- [x] T003 Import `static/fonts/geist.css` in `src/app.css` (add `@import` alongside existing firacode-nerd-font.css import)

---

## Phase 2: Foundational — Token Rewrite (Blocking)

**Purpose**: Replace the entire CSS foundation. Every component in the dashboard inherits from these base tokens — this phase MUST complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. All downstream components automatically receive correct values once these tokens are set.

- [x] T004 Rewrite `src/app.css` `:root` block — remove the light mode `:root` block (lines ~7-41) with oklch whites; merge `.dark` block into a single `:root` with all Lunaris hex surface tokens (`--background: #111111`, `--card: #1A1A1A`, `--border: #2E2E2E`, etc.) per `data-model.md` Layer 1 table
- [x] T005 Rewrite `src/app.css` accent and text tokens — replace oklch accent (`--primary: #A8B8E0`, `--primary-foreground: #111111`, `--ring: #666666`) and text hierarchy (`--foreground: #FFFFFF`, `--muted-foreground: #666666`) in the merged `:root` block per `data-model.md` Accent and Text tables
- [x] T006 Add new tokens to `src/app.css` `:root` — add all tokens from `contracts/token-contract.md` "New Tokens" table: `--text-secondary`, `--text-tertiary`, `--text-inactive`, `--error-desat`, `--inactive`, `--success-bg`, `--warning-bg`, `--error-bg`, `--info-bg`, `--widget-bg`, `--hover-tint`, `--separator`, `--bar-track`, `--switch-off`, signal strength tokens, chart colors
- [x] T007 Replace semantic status tokens in `src/app.css` — change `--success` from `hsl(142 69% 58%)` to `#8BBFA0`, `--warning` from `hsl(43 96% 56%)` to `#D4A054`, `--destructive` from oklch to `#FF5C33`, `--info` to `#A8B8E0`, and update all `-foreground` variants per `contracts/token-contract.md` Semantic Status table
- [x] T008 Remove 7 shadcn palette blocks from `src/app.css` — delete all `[data-palette='blue']`, `[data-palette='green']`, `[data-palette='orange']`, `[data-palette='red']`, `[data-palette='rose']`, `[data-palette='violet']`, `[data-palette='yellow']` selectors (both `:root[data-palette=...]` and `.dark[data-palette=...]` variants)
- [x] T009 Add 13 Lunaris accent theme blocks to `src/app.css` — add `[data-palette='ash']` through `[data-palette='violet']` selectors, each only overriding `--primary` per `data-model.md` Layer 1a table (13 single-line rules)
- [x] T010 Update `@theme inline` block in `src/app.css` — ensure Tailwind color mappings include new tokens (`--color-widget-bg`, `--color-hover-tint`, `--color-bar-track`, `--color-switch-off`, signal tokens, chart tokens, status background tokens); verify existing mappings still reference correct `var()` names
- [x] T011 Update font stacks in `src/lib/styles/dashboard.css` — change `--font-sans` to `'Geist', system-ui, sans-serif`, `--font-mono` to `'Fira Code', 'JetBrains Mono', monospace`; add `--font-primary: var(--font-mono)` and `--font-secondary: var(--font-sans)` aliases
- [x] T012 Update layout dimensions in `src/lib/styles/dashboard.css` — change `--panel-width` from `320px` to `280px` and `--top-bar-height` from `48px` to `40px`
- [x] T013 Update body font declaration in `src/app.css` — change body `font-family` from `'Inter', system-ui, -apple-system, sans-serif` to `'Geist', system-ui, sans-serif`
- [x] T014 Rewrite `src/lib/styles/palantir-design-system.css` alias mappings — update all `--palantir-*` token aliases to reference new Lunaris base tokens per `data-model.md` Layer 2 table; replace any rgba() fallback values with solid hex equivalents; convert transparent border tiers (`rgba(255,255,255,0.06/0.1/0.15)`) to solid `#2E2E2E`
- [x] T015 Add typography scale tokens to `src/lib/styles/palantir-design-system.css` — add `--text-hero: 1.5rem`, `--text-brand: 0.8125rem`, `--text-status: 0.625rem`, `--text-section: 0.5625rem` alongside existing `--text-xs`/`--text-sm`/`--text-base`/`--text-lg` tokens
- [x] T016 Update `.tactical-sidebar` width in `src/lib/styles/palantir-design-system.css` — change from `320px` to `280px` to match `--panel-width`
- [x] T017 Update `src/lib/stores/theme-store.svelte.ts` — change `ThemePalette` type to 13 Lunaris names (ash|blue|blush|iron|iris|khaki|mauve|pewter|plum|rose|sand|silver|violet), update `VALID_PALETTES` array, change `DEFAULT_STATE.palette` from `'default'` to `'blue'`, remove special-case `'default'` logic from `applyPalette()` (always set `dataset.palette`), remove any `.dark` class toggling (dark-only system)
- [x] T018 Rewrite `src/lib/themes/palettes.ts` — replace 8 shadcn `PaletteDefinition` entries (default, blue, green, orange, red, rose, violet, yellow) with 13 Lunaris entries (ash through violet); each entry only needs to set `--primary` in its `cssVars` object since all other tokens are constant across themes
- [x] T019 Verify `src/lib/components/dashboard/panels/SettingsPanel.svelte` palette dropdown — confirm it renders all 13 Lunaris theme names correctly after T017+T018 changes; verify selected theme applies `data-palette` attribute and `--primary` updates visually

**Checkpoint**: All CSS tokens are Lunaris-compliant. Every component that references `var(--background)`, `var(--primary)`, `var(--font-mono)`, etc. now inherits correct values without any component-level changes. Build should pass.

---

## Phase 3: User Story 1 — Correct Visual Identity (Priority: P1) 🎯 MVP

**Goal**: Dashboard renders with correct Lunaris dark surfaces, steel blue accent, Fira Code data fonts, and Geist nav fonts. No color/font/spacing discrepancies visible at normal viewing distance.

**Independent Test**: Screenshot the live dashboard and compare side-by-side with the `.pen` "Dashboard — System Overview" screen. Colors, fonts, and surfaces should match within perceptual tolerance.

**Depends on**: Phase 2 (all foundational tokens must be in place)

### Implementation for User Story 1

- [x] T020 [P] [US1] Delete glass-\* utility classes from `src/app.css` — remove `.glass-panel`, `.glass-panel-light`, `.glass-button`, `.glass-input` and their hover/focus states (lines ~273-309); these classes have zero consumers in the codebase (confirmed by grep audit) — no replacement needed
- [x] T021 [P] [US1] Remove glow shadow classes from `src/app.css` — delete `.shadow-red-glow` and `.shadow-mono-glow` classes (lines ~338-344)
- [x] T022 [P] [US1] Remove glow box-shadows from signal indicator classes in `src/lib/styles/palantir-design-system.css` — remove `box-shadow` from `.signal-critical`, `.signal-strong`, `.signal-good`, `.signal-fair`, `.signal-weak` (lines ~154-175); keep background-color as flat fills
- [x] T023 [P] [US1] Remove glow box-shadows from status dot classes in `src/lib/styles/palantir-design-system.css` — remove `box-shadow` from `.status-dot-online` and `.status-dot-warning` (lines ~187, ~196); remove `.accent-glow` and `.accent-glow-strong` classes (lines ~200-206)
- [x] T024 [P] [US1] Remove rgba() muted backgrounds in `src/lib/styles/palantir-design-system.css` — replace `rgba(74, 222, 128, 0.12)` and similar muted status backgrounds with dark-tinted hex values (`--success-bg: #222924`, `--warning-bg: #291C0F`, `--error-bg: #24100B`, `--info-bg: #222229`)
- [x] T025 [P] [US1] Update signal indicator background colors in `src/lib/styles/palantir-design-system.css` — set `.signal-critical` to `var(--signal-very-strong)`, `.signal-strong` to `var(--signal-strong)`, `.signal-good` to `var(--signal-good)`, `.signal-fair` to `var(--signal-fair)`, `.signal-weak` to `var(--signal-weak)` per `data-model.md` Signal Strength table
- [x] T026 [P] [US1] Grep all `.svelte` and `.css` files for remaining `oklch(` references — replace any found with corresponding Lunaris hex tokens; report count of replacements
- [x] T027 [P] [US1] Replace `.sweep-brand` hardcoded color in `src/app.css` — change `color: #ffffff !important` to `color: var(--foreground)` (or remove `!important` if no specificity battle remains)
- [x] T028 [US1] Verify `npm run build` passes after Phase 2 + US1 changes — fix any type errors or CSS parsing failures

**Checkpoint**: Dashboard visual identity matches Lunaris spec. Surface colors (#111111/#1A1A1A/#2E2E2E), accent (Blue ★ #A8B8E0), fonts (Fira Code data / Geist chrome), no glass effects, no glow shadows. Screenshot comparison should show perceptual match.

---

## Phase 4: User Story 2 — Correct Layout Dimensions (Priority: P2)

**Goal**: Dashboard structural dimensions match Lunaris spec: 48px icon rail, 280px overview panel, 40px command bar.

**Independent Test**: Measure each structural element in browser DevTools — each should match its specified pixel dimension.

**Depends on**: Phase 2 (T012 already sets token values; this phase fixes any components that hardcode dimensions instead of using tokens; T018+T019 ensure palette data is correct)

### Implementation for User Story 2

- [x] T029 [US2] Audit all `.svelte` and `.css` files for hardcoded `320px` panel width — replace with `var(--panel-width)` or `280px` where token reference isn't possible; check `src/lib/components/dashboard/` components that reference panel width
- [x] T030 [US2] Audit all `.svelte` and `.css` files for hardcoded `48px` command bar height — replace with `var(--top-bar-height)` or `40px` where token reference isn't possible; check `src/lib/components/dashboard/TopStatusBar.svelte` and any layout containers
- [x] T031 [US2] Verify map fill area adjusts correctly — confirm the map container's CSS calc accounts for `40px` top bar (not `48px`) and `280px` panel (not `320px`) with no overflow or gap

**Checkpoint**: DevTools measurement confirms 48px icon rail, 280px panel, 40px command bar. Map fills remaining space correctly.

---

## Phase 5: User Story 3 — Correct Semantic Status Colors (Priority: P2)

**Goal**: Status indicators use desaturated Lunaris colors (#8BBFA0 success, #D4A054 warning, #FF5C33 error) with dark-tinted backgrounds, and every color indicator is paired with a text label.

**Independent Test**: Trigger each status state on the dashboard and verify color values + text label presence.

**Depends on**: Phase 2 (T007 already sets semantic tokens; this phase fixes component-level overrides)

### Implementation for User Story 3

- [x] T032 [P] [US3] Audit `src/lib/styles/palantir-design-system.css` for any remaining hardcoded semantic colors — replace vivid green (#4ade80), vivid gold (#fbbf24), or vivid blue (#60a5fa) with `var(--success)`, `var(--warning)`, `var(--destructive)`, `var(--info)` tokens
- [x] T033 [P] [US3] Audit `src/lib/components/dashboard/` for color-only status indicators — ensure every colored dot/badge has an adjacent text label per FR-020; add `<span>` labels where missing
- [x] T034 [P] [US3] Audit `src/lib/components/status/` for color-only status indicators — ensure every colored element has a text label; check `HardwareStatusPanel.svelte`, `SystemMetricsBar.svelte`, and related files
- [x] T035 [P] [US3] Replace Tailwind status utility classes in `src/app.css` — change `.status-connected` from `@apply bg-green-500` to `background: var(--success)`, `.status-disconnected` from `@apply bg-red-500` to `background: var(--destructive)`, `.status-connecting` from `@apply bg-yellow-500` to `background: var(--warning)` (lines ~311-326)
- [x] T036 [US3] Update status background usage — ensure components that show status backgrounds (connection alerts, error banners) use `var(--success-bg)`, `var(--warning-bg)`, `var(--error-bg)`, `var(--info-bg)` tokens instead of inline rgba()

**Checkpoint**: All status indicators show desaturated Lunaris colors with text labels. No vivid/neon status colors remain.

---

## Phase 6: User Story 4 — Dead Code Removal (Priority: P2)

**Goal**: Zero light mode CSS, zero shadcn palette remnants, zero non-Lunaris font references in CSS/component files.

**Independent Test**: Grep-based verification returns zero results for light mode, old palettes, and non-Lunaris fonts.

**Depends on**: Phase 2 (T004 removes light mode, T008 removes shadcn palettes), Phase 3 (US1 component work)

### Implementation for User Story 4

- [x] T037 [P] [US4] Grep all files for `:root` blocks with light-mode values — remove any surviving light mode CSS; verify only one `:root` block exists in `src/app.css` (plus `[data-palette]` variants)
- [x] T038 [P] [US4] Grep all files for old shadcn palette names used as data-palette values — remove any references to `data-palette="green"`, `data-palette="orange"`, `data-palette="red"`, `data-palette="yellow"` from `.svelte` or `.ts` files (the Settings UI palette list)
- [x] T039 [P] [US4] Grep all `.svelte` and `.css` files for `font-family` containing `Inter` — remove all instances; verify body resolves to Geist
- [x] T040 [P] [US4] Grep all `.svelte` and `.css` files for `font-family` containing `SF Mono`, `Menlo`, or `Monaco` — remove from `src/lib/styles/` CSS files; fix component-level instances (handled in US6 but verify here)
- [x] T041 [US4] Grep for any remaining `oklch(` or `hsl(` color values in `src/app.css` and `src/lib/styles/` — convert to hex equivalents or token references

**Checkpoint**: `grep -r "oklch" src/app.css` returns 0. `grep -r "Inter" src/` returns 0 in CSS. `grep -r "SF Mono" src/lib/styles/` returns 0. Only one `:root` block in app.css. 13 Lunaris themes present, 0 shadcn palettes.

---

## Phase 7: User Story 5 — Complete Typography Scale (Priority: P3)

**Goal**: All 6 Lunaris type scale sizes (24/13/12/11/10/9px) are defined as tokens and applied to components at the correct hierarchy level.

**Independent Test**: Inspect text elements at each hierarchy level in DevTools; computed font-size matches the 6-step scale.

**Depends on**: Phase 2 (T015 adds the tokens; this phase applies them to components)

### Implementation for User Story 5

- [x] T042 [US5] Audit current font-sizes across all dashboard components — grep `src/lib/components/dashboard/` and `src/lib/components/status/` for `font-size` declarations; produce a mapping of component → element → current size → target Lunaris tier (hero 24px / brand 13px / sm 12px / xs 11px / status 10px / section 9px) to guide T043-T046
- [x] T043 [P] [US5] Apply `--text-hero` (24px) to hero metric elements — verify large data values (CPU %, signal count, etc.) in `src/lib/components/dashboard/` use `font-size: var(--text-hero)` or equivalent Tailwind class
- [x] T044 [P] [US5] Apply `--text-section` (9px) with uppercase + letter-spacing to section headers — update section header styling in `src/lib/styles/palantir-design-system.css` and/or component `<style>` blocks; add `.section-header` utility class if useful: `font-size: var(--text-section); text-transform: uppercase; letter-spacing: 1.2px;`
- [x] T045 [P] [US5] Apply `--text-status` (10px) to status text elements — identify status text in `src/lib/components/status/` and `src/lib/components/dashboard/` that should use the 10px tier; update font-size
- [x] T046 [P] [US5] Apply `--text-brand` (13px) to brand-tier text elements — identify elements using the brand tier (e.g., section titles, panel headers); update font-size

**Checkpoint**: DevTools inspection shows all 6 scale sizes applied correctly: 24px hero metrics, 13px brand text, 12px secondary data, 11px primary rows, 10px status text, 9px section headers (uppercase, letter-spacing >= 1.2px).

---

## Phase 8: User Story 6 — Hardcoded Color and Font Cleanup (Priority: P3)

**Goal**: Zero hardcoded hex colors outside `var()` fallbacks in component styles. Zero hardcoded font-family declarations not referencing design tokens.

**Independent Test**: Grep all `.svelte` files for bare hex colors and bare font-family — zero violations.

**Depends on**: Phase 2 (tokens defined), Phase 3 (glass/glow removal already done)

### Implementation for User Story 6

- [x] T047 [P] [US6] Fix `src/lib/components/dashboard/map/TowerPopup.svelte` — replace `font-family: monospace` (line ~88) with `font-family: var(--font-primary, monospace)`
- [x] T048 [P] [US6] Fix `src/lib/components/dashboard/AgentChatPanel.svelte` — replace Mac-specific `font-family: 'Menlo', 'Monaco', 'Courier New', monospace` (line ~142) with `font-family: var(--font-primary, monospace)`
- [x] T049 [P] [US6] Fix `src/lib/components/gsm-evil/ScanConsole.svelte` — replace `font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace` (line ~63) with `font-family: var(--font-primary, monospace)`
- [x] T050 [P] [US6] Fix `src/lib/components/dashboard/map/DeviceOverlay.svelte` — remove `backdrop-filter: blur(8px)` (line ~131); replace with `background: var(--card)` or `background: var(--popover)` with `border: 1px solid var(--border)`
- [x] T051 [P] [US6] Clean `src/lib/components/dashboard/TerminalTabContent.svelte` font stack — remove `SF Mono`, `Menlo`, `Monaco` from fallback chain (line ~182); keep `'FiraCode Nerd Font'` first, add `var(--font-primary)` as fallback
- [x] T052 [P] [US6] Fix TopStatusBar ARGOS brand mark in `src/lib/components/dashboard/TopStatusBar.svelte` — change font-size from `15px` to `14px`, letter-spacing from `0.14em` to `2px`, color from `var(--palantir-text-primary)` to `var(--primary)` per spec FR-023
- [x] T053 [US6] Comprehensive grep for remaining bare hex colors in all `.svelte` component `<style>` blocks — identify any `#XXXXXX` not inside a `var()` fallback; replace with token references or `var(--token, #fallback)` pattern

**Checkpoint**: `grep -rn "font-family.*Menlo\|font-family.*Monaco\|font-family.*SF Mono" src/lib/components/` returns 0. `grep -rn "font-family: monospace" src/lib/components/` returns 0 (all use token). No bare hex in component styles outside `var()` fallbacks.

---

## Phase 9: Verification & Cross-Cutting Polish

**Purpose**: Verify success criteria, fix toggle switch and popover compliance, run final audits.

- [x] T054 [P] Verify and fix shadcn-svelte Switch component on/off colors — confirm checked state uses `var(--primary)` and unchecked uses `var(--switch-off, #2A2A2A)` per FR-025; if Switch CSS doesn't natively reference `--switch-off`, update `src/lib/components/ui/switch/` to use it
- [x] T055 [P] Verify popover/dropdown shadow standard — confirm all popover containers use `box-shadow: 0 4px 16px #00000040` per FR-024; check `src/lib/components/ui/popover/`, `src/lib/components/ui/dropdown-menu/`, and custom dropdown components
- [x] T056 [P] Apply `--bar-track` to progress bar components — grep for progress bar track backgrounds in `src/lib/components/` and replace hardcoded values with `var(--bar-track)` per FR-022
- [x] T057 Verify `npm run build` passes with zero errors
- [x] T058 Run token audit: grep `src/app.css` and `src/lib/styles/` for any remaining `oklch(`, `hsl(`, `rgba(` (outside `var()` fallbacks) — must be zero
- [x] T059 Run font audit: grep all `.svelte` and `.css` files for `font-family` declarations not referencing `--font-primary`, `--font-secondary`, `--font-mono`, or `--font-sans` tokens — must be zero (except TerminalTabContent's FiraCode Nerd Font which is acceptable)
- [x] T060 Run layout measurement: verify via the running dashboard that `--panel-width` resolves to `280px`, `--top-bar-height` to `40px`, `--icon-rail-width` to `48px`
- [x] T061 Run performance check: verify initial load < 3s and < 200MB heap on RPi 5 — no regression from font loading or CSS changes
- [x] T062 Run `quickstart.md` verification checklist — execute all verification commands from the quickstart guide and confirm zero violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T003 font import) — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 (T012 sets dimensions) — can run parallel with US1
- **Phase 5 (US3)**: Depends on Phase 2 (T007 sets semantic tokens) — can run parallel with US1/US2
- **Phase 6 (US4)**: Depends on Phases 2+3 (needs token rewrite + glass/glow removal)
- **Phase 7 (US5)**: Depends on Phase 2 (T015 adds type scale tokens) — can run parallel with US1-US4
- **Phase 8 (US6)**: Depends on Phase 2 (tokens defined) — can run parallel with US1-US5
- **Phase 9 (Verification)**: Depends on ALL prior phases being complete

### User Story Dependencies

- **US1 (P1) — Visual Identity**: Foundation only. No cross-story dependencies. **MVP scope.**
- **US2 (P2) — Layout**: Foundation only. Independent of US1.
- **US3 (P2) — Semantic Colors**: Foundation only. Independent of US1/US2.
- **US4 (P2) — Dead Code**: Depends on US1 (glass/glow removal contributes to dead code cleanup)
- **US5 (P3) — Typography Scale**: Foundation only. Independent of other stories.
- **US6 (P3) — Hardcoded Cleanup**: Foundation only. Independent of other stories.

### Within Each Phase

1. Tasks marked [P] within a phase can run in parallel
2. Non-[P] tasks must run after all [P] tasks in the same phase
3. Build verification (T028) must follow all Phase 3 implementation tasks

### Critical Path

```
Phase 1 (T001-T003)
  → Phase 2 (T004-T019) [LONGEST PHASE — 16 tasks, includes palettes.ts + SettingsPanel]
    → Phase 3 (US1: T020-T028) [MVP milestone]
      → Phase 6 (US4: T037-T041) [dead code depends on US1]
    → Phase 4 (US2: T029-T031) [parallel with US1]
    → Phase 5 (US3: T032-T036) [parallel with US1]
    → Phase 7 (US5: T042-T046) [parallel with US1]
    → Phase 8 (US6: T047-T053) [parallel with US1]
  → Phase 9 (T054-T062) [after ALL stories]
```

### Parallel Opportunities

**Within Phase 2** (Foundational):
- T011 + T012 (dashboard.css font + layout — same file but different sections, sequential safer)
- T014 + T015 + T016 (palantir-design-system.css — same file, sequential safer)
- T004 + T005 + T006 + T007 + T008 + T009 (app.css — same file, must be sequential)
- T017 + T018 (theme-store.svelte.ts + palettes.ts — different files, parallel with CSS work)

**Across User Stories** (after Phase 2):
- US1 (T020-T028), US2 (T029-T031), US3 (T032-T036), US5 (T042-T046), US6 (T047-T053) can all run in parallel since they touch different files
- US4 (T037-T041) should wait for US1 completion

**Within User Stories**:
- US1: T020-T027 all marked [P] (different files/sections)
- US3: T032-T035 all marked [P] (different component directories)
- US5: T042 discovery first, then T043-T046 all marked [P] (different component areas)
- US6: T047-T052 all marked [P] (each is a different component file)

---

## Parallel Example: User Story 1 (Visual Identity)

```bash
# Launch all glass/glow removal in parallel (different files):
Task: "T020 [P] [US1] Remove glass-* classes from src/app.css"
Task: "T022 [P] [US1] Remove signal glow in palantir-design-system.css"
Task: "T023 [P] [US1] Remove status dot glow in palantir-design-system.css"

# These can also run in parallel with the above:
Task: "T026 [P] [US1] Grep for remaining oklch references"
Task: "T027 [P] [US1] Fix .sweep-brand hardcoded color"
```

## Parallel Example: User Story 6 (Hardcoded Cleanup)

```bash
# Launch all component font fixes in parallel (each is a different file):
Task: "T047 [P] [US6] Fix TowerPopup.svelte font"
Task: "T048 [P] [US6] Fix AgentChatPanel.svelte font"
Task: "T049 [P] [US6] Fix ScanConsole.svelte font"
Task: "T050 [P] [US6] Fix DeviceOverlay.svelte backdrop-filter"
Task: "T051 [P] [US6] Fix TerminalTabContent.svelte font"
Task: "T052 [P] [US6] Fix TopStatusBar.svelte brand mark"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Geist font install)
2. Complete Phase 2: Foundational (token rewrite — **largest phase**)
3. Complete Phase 3: US1 — Visual Identity (glass/glow removal, oklch cleanup)
4. **STOP and VALIDATE**: Dashboard should visually match Lunaris spec
5. `npm run build` must pass

### Incremental Delivery

1. Setup + Foundational → All tokens correct (components auto-inherit)
2. US1 → Visual identity verified → **MVP milestone** ✓
3. US2 → Layout dimensions correct → Build passes ✓
4. US3 → Semantic colors correct → Status indicators accessible ✓
5. US4 → Dead code removed → Clean CSS ✓
6. US5 → Typography scale applied → Information hierarchy correct ✓
7. US6 → Hardcoded values eliminated → Token system fully enforced ✓
8. Verification → All success criteria met → Feature complete ✓

### Key Risk: Same-File Edits in Phase 2

Phase 2 has ~10 tasks touching `src/app.css`. These **cannot** run in parallel — they must be sequential to avoid merge conflicts. The `theme-store.svelte.ts` update (T017) CAN run parallel with CSS work since it's a different file.

---

## Notes

- **Total tasks**: 62 (T001-T062)
- Total file count: ~7 CSS/TS files modified extensively, ~8 component files with targeted fixes
- No new components, no new API routes, no new npm dependencies
- The only new files are Geist font assets in `static/fonts/geist/`
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each phase completion (not each task) to keep history clean
- This is 90% CSS, 10% TypeScript — primary risk is cascading style regressions, not type errors
