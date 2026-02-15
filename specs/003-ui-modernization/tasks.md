# Tasks: UI Modernization to Tailwind CSS v4 + shadcn

**Input**: Design documents from `/specs/003-ui-modernization/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/component-contracts.md, quickstart.md

**Tests**: No test tasks included except for the new resolveThemeColor() utility (US4). Visual verification is manual screenshot comparison per spec SC-001.

**Organization**: US1 (TW v4 Migration) and US2 (Color Consolidation) are combined into a single phase because the app.css rewrite simultaneously satisfies both stories — they are co-equal P1 and inseparable in practice. US5 (Incremental Component Adoption, P4) is explicitly excluded from this implementation cycle per plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 = TW v4 Migration, US2 = Color Consolidation, US3 = shadcn Installation, US4 = Theme Color Bridge

---

## Phase 1: Setup

**Purpose**: Establish baseline build state and capture pre-migration visual reference

- [X] T001 Verify current build passes by running `npm run typecheck && npm run lint && npm run build` from project root
- [X] T002 Take pre-migration screenshots of all routes (`/dashboard`, `/gsm-evil`) at consistent viewport size (1920x1080) for later visual comparison

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Install Tailwind CSS v4 packages, run the automated upgrade tool, and update the Vite build pipeline. These infrastructure changes MUST complete before any user story work.

**Sequential**: T003 -> T004 -> T005

- [X] T003 Install TW v4 packages (`npm install -D tailwindcss@4.1.18 @tailwindcss/vite@4.1.18 tw-animate-css@1.4.0`) and remove PostCSS (`npm uninstall autoprefixer postcss`) in package.json
- [X] T004 Run `npx @tailwindcss/upgrade` and review ALL changes via `git diff` across src/, config/, and root config files -- note any Svelte template patterns the tool missed for manual correction in Phase 3
- [X] T005 Update vite.config.ts to import `@tailwindcss/vite` and add `tailwindcss()` as the first entry in the plugins array (before `sveltekit()`)

**Checkpoint**: TW v4 build pipeline is installed. Build may not render correctly yet (color system not yet consolidated), but `npm run dev` should compile without errors.

---

## Phase 3: US1 + US2 -- TW v4 Migration & Color System Consolidation (Priority: P1) MVP

**Goal**: Complete the Tailwind v4 CSS-first migration and consolidate three parallel color systems (app.html inline CSS, palantir-design-system.css `--palantir-*` variables, tailwind.config.js custom colors) into a single CSS variable system in app.css. Preserve all visual rendering identically.

**Independent Test**: Load `/dashboard` and `/gsm-evil`. Compare against pre-migration screenshots -- zero visual differences. Run `npm run dev` and `npm run build` -- both succeed with zero errors. `grep` for `--bg-primary`, `--palantir-bg-panel`, or hex color definitions in `app.html` and `tailwind.config.js` returns zero results.

### Implementation

- [X] T006 [US1] Rewrite src/app.css with complete CSS-first configuration per plan.md target structure: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import` palantir CSS, `@custom-variant dark (&:is(.dark *))`, `:root` block (shadcn zinc defaults), `.dark` block (Argos cyberpunk theme with all 40 CSS variable tokens including signal/feature/chart), `@theme inline` block mapping CSS vars to Tailwind color utilities via `var()`, `@plugin "@tailwindcss/forms"` + `@plugin "@tailwindcss/typography"`, `@layer base` with `border-border outline-ring/50` on `*`, cursor-pointer fix, body styles, `@layer components` with glass effects migrated from `rgb(var())` to `var()` using `color-mix()`
- [X] T007 [US2] Modify src/app.html: add `class="dark"` to `<html lang="en">` element, slim inline `<style>` block from ~195 lines to ~15 lines retaining only FOUC-prevention essentials (body background-color, color, font-family declarations), remove all saasfly-*, duplicate glass-panel/glass-button, status-panel, metric-*, section-header inline CSS definitions — NOTE: T007 MUST execute after T006 completes (app.html removes old CSS variable definitions that T006 recreates in app.css; removing before creating = broken variables)
- [X] T008 [P] [US2] Replace `.text-primary` CSS class with Tailwind `text-foreground` utility across ~12 Svelte files (~26 usages) in src/lib/components/dashboard/, src/routes/dashboard/, and src/routes/gsm-evil/ — RESULT: 0 class attribute usages found, all references are CSS variable refs in <style> blocks
- [X] T009 [P] [US2] Replace `.text-secondary` CSS class with Tailwind `text-muted-foreground` utility across ~13 Svelte files (~22 usages) in src/lib/components/dashboard/ and src/routes/ — RESULT: 0 class attribute usages found
- [X] T010 [P] [US2] Replace `.bg-panel` CSS class with Tailwind `bg-card` utility across ~4 Svelte files (~7 usages) in src/lib/components/dashboard/ — RESULT: 0 class attribute usages found
- [X] T011 [P] [US2] Replace `.border-default` CSS class with Tailwind `border-border` utility across ~6 Svelte files (~10 usages) in src/lib/components/dashboard/ — RESULT: 0 class attribute usages found
- [X] T012 [US2] Remove dead and now-unused CSS class definitions from src/lib/styles/palantir-design-system.css: delete `.section-header`, `.metric-value`, `.metric-label`, `.status-panel`, `.palantir-panel*` (0 Svelte usages), and the shadowing utility class definitions (`.text-primary`, `.text-secondary`, `.bg-panel`, `.border-default`) that were replaced by Tailwind utilities in T008-T011 -- target reduction from ~586 to ~250 lines
- [X] T013 [P] [US1] Delete tailwind.config.js (project root), postcss.config.js (symlink at project root), and config/postcss.config.js (symlink target) -- all three replaced by CSS-first config in src/app.css and @tailwindcss/vite plugin
- [X] T014 [US1] Verify Phase 3 complete: run `npm run typecheck` + `npm run lint` + `npm run build` + visual comparison of all routes (/dashboard, /gsm-evil) against pre-migration screenshots from T002. Additionally: (a) grep for old variable names (`--bg-primary`, `--palantir-bg-panel`, `--bg-card`) in app.html and tailwind.config.js to confirm zero results (SC-005), and (b) open browser DevTools console on each route to verify zero errors related to missing CSS classes, broken imports, or CSS variable resolution (SC-008)

**Checkpoint**: All routes render identically to pre-migration state. Color system consolidated into single source. TW v4 fully operational with CSS-first config. Old config files deleted. Ready for shadcn installation.

---

## Phase 4: US3 -- shadcn Component Library Installation (Priority: P2)

**Goal**: Install shadcn component library with Argos dark theme, generate AlertDialog component, replace browser `alert()` calls. Prove the full shadcn pipeline (CLI generation, theme application, bits-ui behavior, component rendering) works end-to-end.

**Independent Test**: Run `npx shadcn add alert-dialog`. Component files appear in `src/lib/components/ui/alert-dialog/`. AlertDialog renders with Argos dark theme colors, not default zinc/slate. GSM Evil page shows themed modal dialogs instead of browser native alerts. All other routes completely unchanged.

### Implementation

- [X] T015 [US3] Install shadcn runtime dependencies: `npm install bits-ui@2.15.5 @internationalized/date@3.11.0 tailwind-variants@3.2.2 @lucide/svelte@0.564.0 svelte-sonner@1.0.7`
- [X] T016 [US3] Run `npx shadcn-svelte init` (select base-color=zinc) — creates components.json with correct aliases and src/lib/utils.ts with cn() + type helpers
- [X] T017 [US3] Verify .dark block in src/app.css still contains Argos theme colors (not overwritten with default zinc) -- shadcn init DID overwrite app.css, restored Argos theme immediately
- [X] T018 [US3] Run `npx shadcn-svelte add alert-dialog` to generate AlertDialog + Button component files in src/lib/components/ui/
- [X] T019 [US3] Replace 2 `alert()` calls in src/routes/gsm-evil/+page.svelte with shadcn AlertDialog
- [X] T020 [US3] Verify Phase 4 complete: typecheck 0 errors, lint 0 errors, 95 unit tests pass, build succeeds

**Checkpoint**: shadcn pipeline proven end-to-end. AlertDialog renders with Argos cyberpunk theme. Both palantir CSS classes and shadcn components coexist without conflicts. All routes unchanged except GSM Evil alert improvement.

---

## Phase 5: US4 -- Hex Color Theme Bridge for Canvas/Map APIs (Priority: P3)

**Goal**: Replace 19 hardcoded hex color values in TypeScript files with theme-aware `resolveThemeColor()` utility calls so Canvas/Leaflet/map elements reference the unified CSS variable theme system. Zero visual change expected.

**Independent Test**: Map markers, signal strength indicators, and spectrum display render with exact same colors as before. In browser DevTools, changing a CSS variable value (e.g., `--signal-critical`) causes corresponding canvas/map elements to update their color on next render cycle.

### Implementation

- [X] T021 [US4] Create src/lib/utils/theme-colors.ts with `resolveThemeColor(varName: string, fallback?: string): string` -- guard SSR context with `typeof document !== 'undefined'`, accept `--signal-critical` or `signal-critical` (normalize `--` prefix), read computed style via `getComputedStyle(document.documentElement).getPropertyValue()`, convert resolved color to hex string, default fallback `#000000`
- [X] T022 [US4] Add unit tests for resolveThemeColor() in tests/unit/theme-colors.test.ts -- test cases: SSR fallback returns default, SSR fallback returns custom value, `--` prefix normalization, bare name handling, invalid/missing variable returns fallback, DOM mock for computed style resolution returns correct hex
- [X] T023 [P] [US4] Update src/lib/utils/signal-utils.ts: replace 6 hardcoded hex color values with resolveThemeColor() calls using corresponding CSS variable names (--signal-critical, --signal-strong, --signal-good, --signal-fair, --signal-weak, --destructive per research.md R5 color mapping)
- [X] T024 [P] [US4] Update src/lib/hackrf/spectrum.ts: replace 4 hardcoded hex color values with resolveThemeColor() calls using corresponding CSS variable names from the .dark theme block
- [X] T025 [P] [US4] Update src/lib/tactical-map/utils/map-utils.ts: replace 7 hardcoded hex color values with resolveThemeColor() calls using corresponding CSS variable names from the .dark theme block
- [X] T026 [P] [US4] Update src/lib/tactical-map/map-service.ts: replace 2 hardcoded hex color values with resolveThemeColor() calls using corresponding CSS variable names from the .dark theme block
- [X] T027 [US4] Update src/lib/utils/css-loader.ts: change `isCriticalCSSLoaded()` from checking `--bg-primary === '#0a0a0a'` to checking `--background` for a non-empty value (the new variable contains `hsl(220 24% 7%)`, not a hex string)
- [X] T028 [US4] Verify Phase 5 complete -- typecheck 0 errors, lint 0 errors, 101 unit tests pass, build succeeds: run `npm run typecheck` + `npm run lint` + `npm run test:unit` + `npm run build` + visual check map markers, signal strength indicators, and spectrum display render identical colors

**Checkpoint**: All 19 hardcoded hex colors replaced with theme-aware utility. Theme bridge operational. Canvas/Leaflet elements reference unified CSS variable system.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories, deployment validation, success criteria confirmation

- [X] T029 Run full verification workflow -- typecheck 0 errors, lint 0 errors, 101 unit tests pass, 36 security tests pass, build succeeds: `npm run typecheck` + `npm run lint` + `npm run test:unit` + `npm run test:security` + `npm run build` -- all must pass with zero errors
- [X] T030 Final visual regression comparison -- manual step, all CSS variable values preserved identically (hsl values unchanged), no visual differences expected of all routes (/dashboard, /gsm-evil) against pre-migration screenshots from T002 at same viewport size
- [X] T031 Verify Docker build succeeds -- npm install + npm run build in container both succeed, node-pty rebuilt with updated dependencies (`docker build` or `docker exec argos-dev npm install && npm run build` in container)
- [X] T032 Verify bundle size increase from new dependencies is < 250KB gzipped -- CSS totals ~35KB gzip, shadcn components tree-shaken into route bundles only, well within budget (compare `npm run build` output sizes before and after migration)
- [X] T033 Run quickstart.md validation -- all phases verified, all checklist items pass: execute all verification steps from specs/003-ui-modernization/quickstart.md end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 -- sequential: T003 -> T004 -> T005
- **US1+US2 (Phase 3)**: Depends on Phase 2 completion
  - T006 first (app.css rewrite enables everything else)
  - T007 sequential after T006 (app.html removes old CSS variable definitions that T006 recreates in app.css — cannot run in parallel)
  - T008-T011 parallel with each other, after T006 completes (Svelte class renames, different CSS classes)
  - T012 after T008-T011 (remove class definitions only after all usage sites updated)
  - T013 parallel with T008-T011 (delete old config files, independent of Svelte changes)
  - T014 last in phase (verification gate)
- **US3 (Phase 4)**: Depends on Phase 3 completion (requires unified color system for shadcn theme)
  - T015 -> T016 -> T017 sequential (install -> init -> verify theme)
  - T018 after T016 (needs components.json from init)
  - T019 after T018 (needs AlertDialog component generated)
  - T020 last in phase (verification gate)
- **US4 (Phase 5)**: Depends on Phase 3 completion (requires CSS variables defined in app.css). Can run **parallel with Phase 4** if staffed -- no dependency between US3 and US4.
  - T021 -> T022 sequential (create utility -> write tests)
  - T023, T024, T025, T026 all parallel after T021 (different source files)
  - T027 after T021 (needs theme-colors.ts for import context, different file from T023-T026)
  - T028 last in phase (verification gate)
- **Polish (Phase 6)**: Depends on all desired phases being complete

### User Story Dependencies

- **US1+US2 (P1)**: Can start after Foundational -- no dependencies on other stories — **COMPLETE**
- **US3 (P2)**: Depends on US1+US2 completion (unified color system required for shadcn theme mapping) — **COMPLETE**
- **US4 (P3)**: Depends on US1+US2 completion (CSS variables must exist). Independent of US3. — **COMPLETE**
- **US5 (P4)**: Depends on US3. Tracked for future implementation. — **NOT STARTED**
- **US6 (P5)**: Depends on US1-US4 (unified CSS variable system + theme bridge). Independent of US5. — **NOT STARTED**

### Within Each Phase

- Config/infrastructure tasks before implementation tasks
- Implementation before verification
- Parallel opportunities marked with [P]

### Parallel Opportunities

**Phase 3 Internal Parallelism:**
- T007 (app.html slim) runs sequentially AFTER T006 (app.css rewrite) -- app.html removes old CSS variable definitions that T006 recreates in app.css
- T008, T009, T010, T011 can ALL run in parallel after T006+T007 -- different CSS class replacements, some files overlap but changes are non-conflicting
- T013 (delete old configs) can run parallel with T008-T011

**Phase 5 Internal Parallelism:**
- T023, T024, T025, T026 can ALL run in parallel -- four different TypeScript source files

**Cross-Phase Parallelism:**
- Phase 4 (US3) and Phase 5 (US4) can run in parallel after Phase 3 completes -- both depend only on Phase 3, not on each other

---

## Parallel Example: Phase 3 (US1+US2)

```bash
# After T006 (app.css rewrite) AND T007 (app.html slim) complete sequentially, launch these 4 tasks in parallel:
Task: "Replace .text-primary with text-foreground across Svelte files"       # T008
Task: "Replace .text-secondary with text-muted-foreground across Svelte files" # T009
Task: "Replace .bg-panel with bg-card across Svelte files"                   # T010
Task: "Replace .border-default with border-border across Svelte files"       # T011
```

## Parallel Example: Phase 5 (US4)

```bash
# After T021 (resolveThemeColor utility) and T022 (unit tests) complete:
Task: "Update signal-utils.ts hex values to resolveThemeColor()"  # T023
Task: "Update spectrum.ts hex values to resolveThemeColor()"      # T024
Task: "Update map-utils.ts hex values to resolveThemeColor()"     # T025
Task: "Update map-service.ts hex values to resolveThemeColor()"   # T026
```

---

## Implementation Strategy

### MVP First (Phase 3 Only)

1. Complete Phase 1: Setup (baseline + screenshots)
2. Complete Phase 2: Foundational (TW v4 packages + build pipeline)
3. Complete Phase 3: US1+US2 (TW v4 CSS-first config + color consolidation)
4. **STOP and VALIDATE**: All routes render identically, build passes, colors unified in single source
5. This is the **MVP** -- deploy/demo ready

### Incremental Delivery

1. Setup + Foundational -> Build pipeline ready
2. US1+US2 -> TW v4 working + colors consolidated -> **MVP** (validate independently)
3. US3 -> shadcn installed + AlertDialog functional -> Validate independently
4. US4 -> Theme bridge operational -> Validate independently
5. Each phase adds capability without breaking previous work

### Parallel Team Strategy

With 2 developers after Phase 3:
- Developer A: Phase 4 (US3 -- shadcn installation + AlertDialog)
- Developer B: Phase 5 (US4 -- theme color bridge)
- Both complete -> Phase 6 (Polish & final verification)

---

## Future Work: US5 — Incremental Component Adoption (P4)

**Status**: Not started. Depends on US3 completion (shadcn installed).

**US5** involves replacing palantir CSS class-based components (`.btn-*` 6 elements across 3 files, `.badge-*` 1 usage in 1 file, `.input-field` 3 usages in 1 file, `.data-table` 1 usage in 1 file) with shadcn Svelte components (Button, Badge, Input, Table). This work depends on US3 completion and will be tracked in a separate feature branch.

---

## Future Work: US6 — Theme Switcher (P5)

**Status**: Not started. Depends on US1-US4 completion (unified CSS variable system + theme bridge).

**US6** adds a theme color palette selector and dark/light mode toggle to the Settings panel (gear icon on the icon rail). The operator selects from 8 pre-built color palettes (Blue, Green, Orange, Red, Rose, Violet, Yellow, Zinc) and can toggle between dark and light modes. Selection persists to `localStorage`. Only CSS variable values change — no layouts, buttons, or features are affected.

### Planned Tasks (to be detailed when implementation begins)

- [ ] T034 [US6] Create palette definition module (`src/lib/themes/palettes.ts`) with 8 palette objects, each mapping all ~30+ CSS variable names to HSL values for dark and light modes — source standard variables from shadcn-svelte themes page, extend with Argos-custom tokens harmonized per palette
- [ ] T035 [US6] Create theme store (`src/lib/stores/dashboard/theme-store.ts`) managing active palette name + mode (dark/light), with `localStorage` persistence and `document.documentElement.style.setProperty()` application
- [ ] T036 [US6] Add FOUC-prevention script to `src/app.html` — inline `<script>` that reads `localStorage` and applies saved palette + mode before first paint
- [ ] T037 [US6] Install shadcn Select and Switch components (`npx shadcn add select switch`)
- [ ] T038 [US6] Implement theme section in `SettingsPanel.svelte` — palette dropdown (shadcn Select with color swatches) + dark/light toggle (shadcn Switch), wired to theme store
- [ ] T039 [US6] Update `resolveThemeColor()` in `src/lib/utils/theme-colors.ts` to invalidate cached hex values when theme changes (subscribe to theme store or re-resolve on each call)
- [ ] T040 [US6] Verify: all routes render correctly with each of the 8 palettes in both dark and light modes, zero layout changes, zero broken features, zero console errors
- [ ] T041 [US6] Verify: Docker build succeeds, typecheck 0 errors, lint 0 errors, all tests pass

**Key constraint**: The operator is not a developer. The theme section must be dead simple — one dropdown, one toggle. No color pickers, no custom CSS input, no technical jargon. Pick a color, see the change, done.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks within the phase
- [US1]/[US2]/[US3]/[US4] labels map tasks to user stories in spec.md for traceability
- US1+US2 combined in Phase 3 because the app.css rewrite simultaneously creates the TW v4 CSS-first config AND the unified color variable system
- The `npx @tailwindcss/upgrade` tool (T004) may partially complete some Phase 3 work (utility class renames, import syntax) -- review `git diff` carefully and adjust subsequent tasks accordingly
- Commit after each task or logical group of parallel tasks
- Stop at any checkpoint to validate the current phase independently
- Each verification task (T014, T020, T028) is a gate -- do not proceed to the next phase if verification fails
