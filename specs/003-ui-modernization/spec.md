# Feature Specification: UI Modernization to Tailwind CSS v4 + shadcn

**Feature Branch**: `003-ui-modernization`
**Created**: 2026-02-15
**Status**: Complete (US1-US4 implemented, US5 deferred to future spec)
**Input**: User description: "UI modernization to Tailwind 4 and shadcn - preserve existing layout, no functionality breakage, modern UI component library"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tailwind CSS v3 to v4 Migration (Priority: P1)

As an operator using the Argos dashboard, I expect the application to look and behave identically after the CSS framework is upgraded from Tailwind v3 to v4. No visual regression, no broken layouts, no missing styles.

**Why this priority**: This is the foundational prerequisite. Every subsequent story depends on a working Tailwind v4 build. If this fails, nothing else can proceed. The existing dark cyberpunk tactical theme must survive intact.

**Independent Test**: Load every route in the application (`/dashboard`, `/gsm-evil`) before and after migration. Take screenshots at the same viewport size. Overlay-diff should show zero visual differences. Run `npm run dev` and `npm run build` -- both must succeed with zero errors.

**Acceptance Scenarios**:

1. **Given** the application on Tailwind v3.4.19, **When** migrated to Tailwind v4.1.18 with the @tailwindcss/vite plugin, **Then** `npm run dev` starts without errors and all routes render identically to pre-migration screenshots.
2. **Given** 193 border utility usages across 20 Svelte files, **When** Tailwind v4 changes border default from gray-200 to currentColor, **Then** all borders render with the theme's `--border` color (dark subtle borders), not bright white/currentColor.
3. **Given** 29 shadow/rounded/blur utilities across 8 files that get renamed in v4 (e.g., `shadow-sm` to `shadow-xs`), **When** the upgrade tool runs, **Then** all utilities are correctly renamed and shadows/radii appear identical.
4. **Given** `@tailwindcss/forms` (0.5.10) and `@tailwindcss/typography` (0.5.19) plugins, **When** migrated from JS config `plugins: [require()]` to CSS-first `@plugin` directives, **Then** form inputs and prose content render identically.
5. **Given** `postcss.config.js` (symlink to `config/postcss.config.js`) and `autoprefixer`, **When** replaced by `@tailwindcss/vite` plugin, **Then** both files are deleted and build succeeds without PostCSS.
6. **Given** `tailwind.config.js` with custom colors and the `@tailwindcss/forms` plugin, **When** config moves to CSS-first `@theme inline` in `app.css`, **Then** all custom color utilities (`bg-bg-card`, `text-text-primary`, `border-border-primary`) still resolve correctly.
7. **Given** buttons default to `cursor: default` in Tailwind v4, **When** a global base style restores `cursor: pointer`, **Then** all clickable elements show pointer cursor on hover.

---

### User Story 2 - Color System Consolidation (Priority: P1)

As a developer working on Argos, I need the three parallel color systems (app.html inline CSS variables, palantir-design-system.css `--palantir-*` variables, tailwind.config.js color utilities) consolidated into a single source of truth using CSS custom properties compatible with both the Argos theme and shadcn's variable naming convention.

**Why this priority**: Co-equal with P1 because shadcn installation (P2) depends on a unified color system. Without this, shadcn's `--background`, `--primary`, `--border` variables will conflict with existing definitions. Also resolves the pre-mortem finding that `class="dark"` is missing from `<html>`.

**Independent Test**: After consolidation, all color values must resolve to the exact same hex values as before. Run `getComputedStyle(document.documentElement).getPropertyValue('--background')` in browser console and verify it matches the current `--bg-primary` value (#0e1116). Every panel, card, border, and text element must be visually identical.

**Acceptance Scenarios**:

1. **Given** CSS variables defined in `app.html` (:root block, lines 15-37), `palantir-design-system.css` (--palantir-\* prefix, 45 variables), and `tailwind.config.js` (20 custom colors), **When** consolidated into `app.css` using shadcn-compatible naming (`--background`, `--foreground`, `--primary`, `--card`, `--border`, etc.), **Then** all three old sources are either removed or updated to reference the unified variables.
2. **Given** `app.html` contains 186 lines of inline CSS including `!important` overrides of Tailwind classes, duplicate `.glass-panel`/`.glass-button` definitions, and `saasfly-*` styles, **When** slimmed to FOUC-prevention only, **Then** `app.html` inline `<style>` contains only body background/color, font declarations, and `class="dark"` is added to `<html>`.
3. **Given** `--border-primary: 44 47 54` uses bare RGB triplet format for opacity support via `rgb(var(--border-primary) / 0.8)`, **When** converted to HSL format for shadcn compatibility, **Then** all 12+ `color-mix()` / `rgb(var())` patterns in app.html and app.css render identical colors.
4. **Given** palantir-design-system.css defines utility classes `.text-primary`, `.bg-panel`, `.text-secondary`, `.border-default` that shadow Tailwind utility class names, **When** these CSS classes are removed and all Svelte usage sites are updated to use corresponding Tailwind utilities (`text-foreground`, `bg-card`, etc.), **Then** no naming collision exists between custom CSS classes and Tailwind-generated utilities.
5. **Given** Argos operates exclusively in dark mode, **When** `class="dark"` is added to `<html lang="en">` in `app.html`, **Then** shadcn's `@custom-variant dark (&:is(.dark *))` directive activates the `.dark {}` CSS variable block.

---

### User Story 3 - shadcn Component Library Installation (Priority: P2)

As a developer, I can use shadcn's component generation CLI to add pre-built, accessible UI components (Button, Dialog, AlertDialog, Table, Badge, Input) to the project. The components use the Argos cyberpunk theme and coexist with existing custom components.

**Why this priority**: Depends on P1 (Tailwind v4 working) and P1 (color consolidation). This is the core deliverable -- making shadcn available for use. However, actual component adoption (replacing existing palantir CSS classes) is a separate incremental effort.

**Independent Test**: Run `npx shadcn add alert-dialog`. The generated component files appear in `src/lib/components/ui/alert-dialog/`. Import and use `<AlertDialog>` in a test page. It renders with Argos dark theme colors, not default shadcn zinc/slate. The existing dashboard and all other routes are completely unchanged.

**Acceptance Scenarios**:

1. **Given** `bits-ui@2.15.5`, `@internationalized/date@3.11.0`, `tailwind-variants@3.2.2`, `@lucide/svelte@0.564.0`, `svelte-sonner@1.0.7`, and `tw-animate-css@1.4.0` are installed, **When** `npx shadcn init` runs with style=new-york, **Then** `components.json` is created and `src/lib/utils.ts` contains the `cn()` utility function.
2. **Given** shadcn init generates default CSS variable values (zinc/slate), **When** the Argos dark theme values are mapped onto the `.dark {}` block in the same commit, **Then** no commit exists with default shadcn colors.
3. **Given** the existing palantir-design-system.css has dead CSS classes (`.glass-*`, `.saasfly-*`, `.palantir-panel*`, `.section-header`, `.metric-*` -- all 0 usages in Svelte files), **When** dead classes are removed, **Then** the CSS file is reduced from 586 lines to approximately 250 lines (retaining only actively-used classes and token definitions).
4. **Given** 2 `alert()` calls exist in `src/routes/gsm-evil/+page.svelte` (lines 258 and 267), **When** replaced with shadcn `<AlertDialog>`, **Then** alert messages display in a themed modal dialog instead of the browser's native alert, and the GSM Evil page functions identically.
5. **Given** existing `.btn-*` (6 elements across 3 files), `.badge-*` (1 element in 1 file), `.input-field` (3 usages in 1 file), and `.data-table` (1 usage in 1 file) palantir CSS classes, **When** shadcn components are installed alongside them, **Then** both systems coexist without CSS conflicts and no existing component changes appearance.

---

### User Story 4 - Hex Color Theme Bridge for Canvas/Map APIs (Priority: P3)

As a developer, I need hardcoded hex color values in TypeScript files (used by Leaflet map markers, Canvas spectrum rendering, and signal strength indicators) to reference the unified theme system so that colors are consistent and future theme changes apply everywhere.

**Why this priority**: Lower priority because the existing hex colors work correctly -- they just aren't theme-aware. This can be done incrementally alongside or after component adoption. No user-visible change expected.

**Independent Test**: After replacing hex values with `resolveThemeColor()` calls, map markers, signal strength indicators, and spectrum age indicators render with the exact same colors as before. Changing a CSS variable value in the theme causes the corresponding canvas/map elements to update.

**Acceptance Scenarios**:

1. **Given** 19 hardcoded hex color values across 5 TypeScript files (`signal-utils.ts`, `spectrum.ts`, `map-utils.ts`, `map-service.ts`, `css-loader.ts`), **When** a `resolveThemeColor(varName: string): string` utility function is created that reads CSS variables via `getComputedStyle()`, **Then** each hex value is replaced with a call to this utility using the corresponding CSS variable name.
2. **Given** Leaflet's marker API requires hex string values (not CSS variable syntax), **When** `resolveThemeColor('--signal-critical')` is called, **Then** it returns the computed hex string (e.g., `#dc2626`) that Leaflet can consume.
3. **Given** signal strength colors (critical, strong, good, fair, weak) are defined as CSS variables `--signal-critical` through `--signal-weak`, **When** rendering signal indicators on the map or in spectrum analysis, **Then** colors are resolved from the theme at runtime, not hardcoded.

---

### User Story 5 - Incremental Component Adoption (Priority: P4)

As a developer, I can incrementally replace palantir CSS class-based components with shadcn Svelte components, one component family at a time, with full regression testing between each swap.

**Why this priority**: This is the long-tail effort that delivers the full value of the shadcn migration. It depends on all previous stories. Each replacement is independent and can be done over weeks/months during normal development.

**Independent Test**: After each component family replacement (e.g., all `.data-table` usages replaced with shadcn `<Table>`), `grep` confirms zero remaining references to the old class, the replaced components render identically, and the palantir CSS class definition can be safely deleted.

**Acceptance Scenarios**:

1. **Given** `.data-table` (1 usage in DevicesPanel.svelte), **When** replaced with shadcn `<Table>`, **Then** the devices panel table renders with identical layout, sorting works, and the `.data-table` CSS class is removed from palantir-design-system.css.
2. **Given** `.input-field` (3 usages in DevicesPanel.svelte), **When** replaced with shadcn `<Input>`, **Then** form inputs render with identical styling and focus behavior.
3. **Given** `.badge-*` palantir CSS classes (1 element in 1 file uses palantir badge classes; the word "badge" appears 27 times across 6 files but most are non-palantir references), **When** replaced with shadcn `<Badge>` with variant props mapping (success, warning, error, info, neutral), **Then** all badges render with identical colors and the badge CSS classes are removed.
4. **Given** `.btn-*` palantir CSS classes (6 elements across 3 files use palantir btn classes; the word "btn" appears 79 times across 11 files but includes scoped CSS definitions and non-palantir local styles), **When** replaced with shadcn `<Button>` with variant mapping (primary to default, secondary to secondary, ghost to ghost, danger to destructive, start to outline+success, open to outline+accent), **Then** all buttons render with identical styling, hover states, and disabled states.

---

### User Story 6 - Theme Switcher (Priority: P5)

As an operator using the Argos dashboard, I want to click the Settings gear icon on the left icon rail, see a "Theme" section in the settings panel, and select a color palette from a dropdown menu so I can customize the look of the application without breaking any layouts or functionality.

**Why this priority**: Depends on US1-US4 (the unified CSS variable system must exist for theme switching to work). The infrastructure built in US1-US4 was specifically designed to make this feature straightforward — every color in the app flows through ~30 CSS variables. Swapping those variable values changes the entire app's appearance instantly without touching layouts, buttons, or component structure.

**Context**: The operator is not a software engineer or UI developer. They want to pick a color and have everything "just work." No technical knowledge required. The current cyberpunk blue theme looks good, but operators want the ability to personalize their console appearance — especially when multiple operators share a device and want visual differentiation between sessions.

**Independent Test**: Click the gear icon on the icon rail. The settings panel opens. A "Theme" section shows a dropdown with color palette options. Select "Green." All panels, buttons, borders, charts, map markers, and signal indicators shift to green-tinted colors. No layout shifts, no broken buttons, no missing elements. Refresh the page — the green theme persists. Switch to "Zinc" — the app shifts to neutral gray tones. Toggle "Light Mode" — backgrounds go white, text goes dark. Toggle back to "Dark Mode" — returns to dark backgrounds. At no point does any button, panel, or feature stop working.

**Acceptance Scenarios**:

1. **Given** the Settings panel currently shows "Settings options coming soon" (`src/lib/components/dashboard/panels/SettingsPanel.svelte`), **When** the theme switcher is implemented, **Then** the panel displays a "Theme" section with a labeled dropdown/select component.
2. **Given** the available color palettes are Blue (current default), Green, Orange, Red, Rose, Violet, Yellow, and Zinc, **When** the operator selects a palette from the dropdown, **Then** all CSS variables in the `.dark` block (or `:root` for light mode) update to the corresponding palette values and the entire UI reflects the new colors instantly (no page reload required).
3. **Given** the operator selects a theme, **When** they refresh the page or close and reopen the browser, **Then** the selected theme persists (stored in `localStorage`).
4. **Given** each color palette defines values for all ~30 CSS variables (background, foreground, primary, secondary, muted, accent, destructive, border, input, ring, chart-1 through chart-6), **When** a palette is applied, **Then** all shadcn components, glass effects, palantir CSS classes, status indicators, and map markers render with the new palette colors.
5. **Given** the theme switcher changes only CSS variable values, **When** any palette is selected, **Then** zero layout changes occur — no panels resize, no buttons move, no text reflows, no icons disappear, no features break.
6. **Given** Argos has custom domain-specific CSS variables (--signal-critical through --signal-weak, --feature-rf/drone/radio, --success/warning/info), **When** a palette is applied, **Then** these domain tokens also update to harmonize with the selected palette (e.g., Green palette uses green-tinted signal indicators, not the Blue palette's blue-tinted ones).
7. **Given** a "Mode" toggle (Dark / Light) in the settings panel, **When** the operator toggles to Light mode, **Then** the `class="dark"` is removed from `<html>`, the `:root` CSS variables activate, backgrounds become light, and text becomes dark. **When** toggled back to Dark, **Then** `class="dark"` is restored and the cyberpunk dark aesthetic returns.
8. **Given** the shadcn-svelte themes page (https://www.shadcn-svelte.com/themes) provides pre-built color palettes as CSS variable blocks, **When** generating palette definitions for Argos, **Then** the standard shadcn variables use the official palette values and the Argos-custom variables (signal, feature, chart) are extended with palette-harmonized values.

**UI Design Notes** (for the Settings Panel):

- The theme section should appear as the first section in the Settings panel
- Use a shadcn `<Select>` component for the palette dropdown (consistent with the component library)
- Show a small color swatch preview next to each palette name in the dropdown
- The Dark/Light mode toggle should use a shadcn `<Switch>` component
- Consider showing a mini preview of the selected palette (e.g., 4-5 color dots) below the dropdown
- The settings panel structure should accommodate future settings sections below the theme section

**Technical Approach** (high-level, for planning reference):

- Each palette is a JavaScript object mapping CSS variable names to HSL values
- A Svelte store (`theme-store.ts`) manages the active palette name and mode (dark/light)
- On palette change: iterate over the palette object, call `document.documentElement.style.setProperty()` for each variable
- On mode change: toggle `class="dark"` on `<html>` element
- On page load: read `localStorage`, apply saved palette before first paint (in `app.html` to prevent flash)
- Palette definitions can be sourced from the shadcn-svelte themes page and extended with Argos-custom tokens

---

### Edge Cases

- What happens if the Tailwind v4 upgrade tool fails on a specific Svelte file? Manual fix required -- the upgrade tool does not handle all Svelte template syntax. Run `git diff` to review all changes before committing.
- What happens if `@plugin "@tailwindcss/forms"` causes a build error? Fall back to keeping PostCSS alongside the Vite plugin using `@tailwindcss/postcss` as documented in the TW v4 upgrade guide.
- What happens if `npx shadcn init` overwrites `app.css`? Use `--no` flag to skip CSS generation, or immediately restore from git and apply theme mapping manually.
- What happens if `resolveThemeColor()` is called before the DOM is ready (SSR context)? Return a hardcoded fallback hex value since Leaflet/Canvas only run client-side. Guard with `typeof document !== 'undefined'` check.
- What happens if a palantir utility class (`.text-primary`) is used alongside a Tailwind utility (`text-primary`) on the same element? The shadowing palantir classes (`.text-primary`, `.bg-panel`, `.text-secondary`, `.border-default`) are removed during P1 color consolidation and all usage sites updated to Tailwind utilities, eliminating this conflict before it can occur.
- What happens if the operator selects Light mode but some components only have dark-specific styling? The `:root` block already contains valid light mode values (shadcn zinc defaults). Components using Tailwind utilities (`bg-background`, `text-foreground`, etc.) will automatically pick up light values. Components with hardcoded dark colors in `<style>` blocks using `--palantir-*` variables will need their CSS variables to also respond to light mode — this is a known gap to address during implementation.
- What happens if `localStorage` is unavailable (private browsing)? Fall back to the default Blue/Dark theme. Wrap `localStorage` access in try/catch.
- What happens if the operator changes theme mid-scan (HackRF sweep or Kismet running)? Only CSS variable values change — no JavaScript state, WebSocket connections, or data flows are affected. Canvas/Leaflet elements using `resolveThemeColor()` will pick up new colors on their next render cycle.

## Clarifications

### Session 2026-02-15

- Q: How should palantir CSS classes that shadow Tailwind utility names (`.text-primary`, `.bg-panel`, `.text-secondary`, `.border-default`) be resolved? → A: Remove classes entirely and update all Svelte usage sites to use corresponding Tailwind utilities (`text-foreground`, `bg-card`, etc.).
- Q: How should visual regression be verified (SC-001)? → A: Manual side-by-side screenshot comparison per route. No automated visual regression tooling needed for this one-time migration.
- Q: Which shadcn components should be generated during P2 (installation phase)? → A: AlertDialog only. Other components (Button, Badge, Input, Table) generated on-demand during P4 adoption.
- Q: What values should the `:root` (light mode) CSS variable block contain? → A: shadcn defaults (zinc/slate). Standard convention; originally never visible to users since Argos was dark-mode only, but US6 (Theme Switcher) will enable light mode as an option.
- Q: How does the shadcn-svelte themes page (https://www.shadcn-svelte.com/themes) relate to Argos? → A: The themes page generates CSS variable blocks in the exact same format Argos uses (`:root` + `.dark` blocks with `--background`, `--primary`, `--border`, etc.). The "Copy Code" button gives pre-built color palettes that can be used as palette definitions for US6. Argos extends these with domain-specific tokens (signal strength, feature categories) that shadcn doesn't include.
- Q: How exactly will the UI update when a theme is selected? → A: Only CSS variable _values_ change. The variable _names_ (`--background`, `--primary`, etc.) stay the same. Every component already references these names through Tailwind utilities (`bg-background`, `text-primary`) and `resolveThemeColor()`. Changing the values is like changing the paint on a building — the building structure stays identical.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST start successfully (`npm run dev` launches dev server, all routes load without errors) and produce a deployable build (`npm run build`) after each migration phase.
- **FR-002**: System MUST preserve the existing cyberpunk dark theme across all routes with zero visual regression.
- **FR-003**: System MUST NOT change page layouts, route structure, component hierarchy, or data flow.
- **FR-004**: System MUST consolidate color definitions from three sources (app.html, palantir-design-system.css, tailwind.config.js) into a single CSS variable system in app.css.
- **FR-005**: System MUST support shadcn's `@custom-variant dark` mechanism with `class="dark"` on the root `<html>` element.
- **FR-006**: System MUST use `@tailwindcss/vite` plugin instead of PostCSS for Tailwind processing.
- **FR-007**: System MUST use `@plugin` directives for `@tailwindcss/forms` and `@tailwindcss/typography` in app.css.
- **FR-008**: System MUST generate shadcn components in `src/lib/components/ui/` directory using the `cn()` utility from `src/lib/utils.ts`.
- **FR-009**: System MUST replace the 2 browser `alert()` calls in gsm-evil page with shadcn AlertDialog component.
- **FR-010**: System MUST apply `cursor: pointer` to all buttons and `[role="button"]` elements globally.
- **FR-011**: System MUST apply `border-border` to all elements globally to prevent the Tailwind v4 border color default change from affecting the dark theme.
- **FR-012**: System MUST NOT break Docker builds -- all dependency changes must work in the node:22-bookworm container.
- **FR-013**: System MUST pass `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build` after each phase.
- **FR-014**: System MUST delete dead CSS classes from palantir-design-system.css and app.html that have zero references in Svelte components.
- **FR-015**: System MUST provide a `resolveThemeColor()` utility for Leaflet/Canvas APIs that require hex color strings.
- **FR-016**: System MUST provide a theme switcher in the Settings panel accessible via the gear icon on the icon rail.
- **FR-017**: System MUST support 8 color palettes: Blue (default), Green, Orange, Red, Rose, Violet, Yellow, Zinc.
- **FR-018**: System MUST support Dark/Light mode toggle.
- **FR-019**: System MUST persist the selected palette and mode to `localStorage` and restore on page load without visual flash.
- **FR-020**: System MUST NOT cause any layout changes, button breakage, or feature disruption when switching themes — only color values change.
- **FR-021**: System MUST update all domain-specific tokens (signal strength, feature categories, chart colors) to harmonize with the selected palette.

### Key Entities

- **CSS Variable Token**: A named design token (e.g., `--background`, `--primary`, `--border`) defined in app.css that controls a visual property across all components. Format: HSL values without the `hsl()` wrapper.
- **shadcn Component**: A Svelte component source file in `src/lib/components/ui/` generated by the shadcn CLI, using bits-ui for headless behavior and Tailwind for styling. Owned by the project, not an npm dependency.
- **Palantir CSS Class**: A utility CSS class defined in `src/lib/styles/palantir-design-system.css` that is being incrementally replaced by shadcn components. Active palantir class usages in Svelte templates: `.btn-*` (6 elements across 3 files), `.badge-*` (1 element in 1 file), `.input-field` (3 usages in 1 file), `.data-table` (1 usage in 1 file).
- **Theme Color Bridge**: A runtime utility (`resolveThemeColor()`) that converts CSS variable names to hex strings for APIs that cannot consume CSS variables directly (Leaflet, Canvas 2D).
- **Theme Palette**: A JavaScript object containing a complete set of CSS variable name-to-value mappings for one color scheme. Each palette defines values for all ~30+ standard and Argos-custom variables. Palettes are stored as static data in the application code.
- **Theme Store**: A Svelte store (`src/lib/stores/dashboard/theme-store.ts`) that manages the active palette name and dark/light mode preference, persisting to `localStorage`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All routes render pixel-identically to pre-migration screenshots (verified by manual side-by-side screenshot comparison of every route at the same viewport size).
- **SC-002**: `npm run build` produces a deployable output with zero errors and no increase in build time greater than 20%.
- **SC-003**: `npm run typecheck` reports zero type errors.
- **SC-004**: `npm run test:unit` and `npm run test:security` pass with zero failures.
- **SC-005**: Color definitions exist in exactly one location (`app.css`) -- `grep` for `--bg-card`, `--palantir-bg-panel`, or hex color definitions in `app.html` and `tailwind.config.js` returns zero results after consolidation.
- **SC-006**: At least one shadcn component (AlertDialog) is added and functional, replacing browser `alert()` calls -- proving the full pipeline (CLI generation, theme application, bits-ui behavior, component rendering) works end-to-end.
- **SC-007**: Dead CSS classes (`.section-header`, `.metric-*`, `.status-panel`, `.palantir-panel*`, `.glass-*` from app.html, `.saasfly-*`) and shadowing utility classes (`.text-primary`, `.text-secondary`, `.bg-panel`, `.border-default`) removed from palantir-design-system.css and app.html -- palantir CSS file reduced from 585 lines to 200-300 lines.
- **SC-008**: Zero browser console errors related to missing CSS classes, broken imports, or CSS variable resolution on any route.
- **SC-009**: Docker build succeeds with updated dependencies.
- **SC-010**: Bundle size increase from new dependencies is less than 250KB gzipped.
- **SC-011**: Settings panel gear icon opens a panel with a functional "Theme" section containing a palette dropdown and dark/light mode toggle.
- **SC-012**: Selecting any of the 8 palettes updates all UI colors instantly without layout changes, button breakage, or feature disruption.
- **SC-013**: Selected theme persists across page refreshes via `localStorage`.
- **SC-014**: Dark/Light mode toggle correctly switches between `.dark` and `:root` CSS variable sets.
- **SC-015**: Map markers, signal indicators, and chart colors update to match the selected palette.

## Assumptions

- Argos defaults to dark mode but US6 enables light mode as an option. The `:root` (light mode) CSS variables will need proper palette-specific values for each of the 8 color palettes.
- The `@tailwindcss/forms` plugin will continue to work in Tailwind v4 via the `@plugin` directive, as confirmed by community testing (GitHub Discussion #15816) and peer dependency declarations supporting `>=4.0.0-beta.1`.
- The Tailwind v4 upgrade tool (`npx @tailwindcss/upgrade`) will correctly handle Svelte template files. Any files it misses will be manually corrected.
- Leaflet and MapLibre-GL APIs require hex color strings and cannot consume CSS variable references directly. A runtime bridge function is needed.
- The `shadcn` CLI (v3.8.4, already installed) is the unified CLI that replaced the separate `shadcn-svelte` package and supports SvelteKit projects.
- `clsx` (2.1.1) and `tailwind-merge` (3.4.0), already installed, satisfy shadcn's requirements and do not need version changes.

## Constraints

- **Memory**: Node.js heap capped at 1024MB. No dependency or build process change may increase peak memory usage beyond this limit.
- **Hardware**: Target deployment is Raspberry Pi 5 (8GB RAM, ARM64). All dependencies must be compatible with `linux-arm64`.
- **Browser Baseline**: Tailwind v4 requires Safari 16.4+, Chrome 111+, Firefox 128+. Argos users access via Kali Linux Chromium, which satisfies this.
- **No Layout Changes**: Page structure, grid/flex arrangements, panel sizes, map rendering, and SDR waterfall display must remain identical.
- **No Functionality Changes**: All API endpoints, WebSocket connections, hardware integrations, and data flows remain untouched.
- **Incremental Adoption**: Component replacement (P4/P5) is explicitly incremental. No big-bang rewrite. Both palantir CSS classes and shadcn components coexist during transition.

## Dependencies (Validated)

### Packages to Install

| Package                   | Version | Type   | Purpose                                          |
| ------------------------- | ------- | ------ | ------------------------------------------------ |
| `tailwindcss`             | 4.1.18  | devDep | CSS framework upgrade                            |
| `@tailwindcss/vite`       | 4.1.18  | devDep | Replaces PostCSS pipeline                        |
| `tw-animate-css`          | 1.4.0   | devDep | CSS animations for shadcn components             |
| `bits-ui`                 | 2.15.5  | dep    | Headless behavioral engine for shadcn components |
| `@internationalized/date` | 3.11.0  | dep    | Peer dependency of bits-ui                       |
| `tailwind-variants`       | 3.2.2   | dep    | Variant system for component style props         |
| `@lucide/svelte`          | 0.564.0 | dep    | Icon library for shadcn components               |
| `svelte-sonner`           | 1.0.7   | dep    | Toast notification component                     |

### Packages to Remove

| Package        | Version | Reason                        |
| -------------- | ------- | ----------------------------- |
| `autoprefixer` | 10.4.24 | Replaced by @tailwindcss/vite |
| `postcss`      | 8.5.6   | Replaced by @tailwindcss/vite |

### Packages Already Installed (No Change)

| Package                   | Version | Note                               |
| ------------------------- | ------- | ---------------------------------- |
| `shadcn`                  | 3.8.4   | CLI already present as devDep      |
| `clsx`                    | 2.1.1   | Already present as dep             |
| `tailwind-merge`          | 3.4.0   | Already present as dep             |
| `@tailwindcss/forms`      | 0.5.10  | Keep, migrate to @plugin directive |
| `@tailwindcss/typography` | 0.5.19  | Keep, migrate to @plugin directive |

### All Peer Dependencies Verified

| Package                 | Peer Requirement               | Installed    | Satisfied |
| ----------------------- | ------------------------------ | ------------ | --------- |
| bits-ui                 | svelte ^5.33.0                 | 5.36.16      | Yes       |
| bits-ui                 | @internationalized/date ^3.8.1 | 3.11.0 (new) | Yes       |
| tailwind-variants       | tailwind-merge >=3.0.0         | 3.4.0        | Yes       |
| tailwind-variants       | tailwindcss \*                 | 4.1.18 (new) | Yes       |
| @tailwindcss/vite       | vite ^5.2 or ^6 or ^7          | 7.3.1        | Yes       |
| @lucide/svelte          | svelte ^5                      | 5.36.16      | Yes       |
| svelte-sonner           | svelte ^5.0.0                  | 5.36.16      | Yes       |
| @tailwindcss/forms      | tailwindcss >=4.0.0-beta.1     | 4.1.18 (new) | Yes       |
| @tailwindcss/typography | tailwindcss >=4.0.0-beta.1     | 4.1.18 (new) | Yes       |

### Color Mapping (3 Sources to 1)

| Current Variable                                            | Current Value | shadcn Variable                 |
| ----------------------------------------------------------- | ------------- | ------------------------------- |
| `--bg-primary` (app.html)                                   | #0e1116       | `--background`                  |
| `--bg-card` (app.html) / `--palantir-bg-panel`              | #1c1f26       | `--card`                        |
| `--bg-input` (app.html) / `--palantir-bg-input`             | #1a1d23       | `--input`                       |
| `--bg-button` (app.html) / `--palantir-bg-elevated`         | #2a2d35       | `--secondary`                   |
| `--bg-secondary` (tw config) / `--palantir-bg-surface`      | #16181d       | `--muted`                       |
| `--text-primary` (app.html) / `--palantir-text-primary`     | #e8eaed       | `--foreground`                  |
| `--text-secondary` (app.html) / `--palantir-text-secondary` | #9aa0a6       | `--muted-foreground`            |
| `--text-muted` (app.html) / `--palantir-text-tertiary`      | #5f6368       | custom `--text-muted`           |
| `--accent-primary` (app.html) / `--palantir-accent`         | #4a9eff       | `--primary`                     |
| `--border-primary` (app.html)                               | rgb(44,47,54) | `--border`                      |
| `--palantir-error` / status-error (tw config)               | #f87171       | `--destructive`                 |
| `--palantir-success` / status-success (tw config)           | #4ade80       | custom `--success`              |
| `--palantir-warning` / status-warning (tw config)           | #fbbf24       | custom `--warning`              |
| `--palantir-info`                                           | #60a5fa       | custom `--info`                 |
| `--palantir-signal-critical` / signal-critical (tw config)  | #dc2626       | custom `--signal-critical`      |
| `--palantir-signal-strong` / signal-strong (tw config)      | #f97316       | custom `--signal-strong`        |
| `--palantir-signal-good` / signal-good (tw config)          | #fbbf24       | custom `--signal-good`          |
| `--palantir-signal-fair` / signal-fair (tw config)          | #10b981       | custom `--signal-fair`          |
| `--palantir-signal-weak` / signal-weak (tw config)          | #4a90e2       | custom `--signal-weak`          |
| `--palantir-chart-1` through `--palantir-chart-6`           | Various       | `--chart-1` through `--chart-6` |

### Files Affected Summary

| Action  | File                                        | Lines Changed                       |
| ------- | ------------------------------------------- | ----------------------------------- |
| REWRITE | `src/app.css`                               | ~94 lines to ~120 lines             |
| SLIM    | `src/app.html`                              | 186 lines to ~15 lines              |
| MODIFY  | `src/lib/styles/palantir-design-system.css` | 586 lines to ~250 lines             |
| MODIFY  | `vite.config.ts`                            | Add 1 import + 1 plugin             |
| CREATE  | `src/lib/utils.ts`                          | ~15 lines (cn() utility)            |
| CREATE  | `src/lib/utils/theme-colors.ts`             | ~20 lines (resolveThemeColor())     |
| CREATE  | `src/lib/components/ui/alert-dialog/`       | Generated by shadcn CLI             |
| CREATE  | `components.json`                           | Generated by shadcn CLI             |
| DELETE  | `postcss.config.js` (symlink)               | Entire file                         |
| DELETE  | `config/postcss.config.js` (target)         | Entire file                         |
| DELETE  | `tailwind.config.js`                        | Entire file                         |
| MODIFY  | `src/routes/gsm-evil/+page.svelte`          | ~10 lines (alert to AlertDialog)    |
| MODIFY  | `src/lib/utils/signal-utils.ts`             | 6 hex values to resolveThemeColor() |
| MODIFY  | `src/lib/hackrf/spectrum.ts`                | 4 hex values to resolveThemeColor() |
| MODIFY  | `src/lib/tactical-map/utils/map-utils.ts`   | 7 hex values to resolveThemeColor() |
| MODIFY  | `src/lib/tactical-map/map-service.ts`       | 2 hex values to resolveThemeColor() |
| MODIFY  | `src/lib/utils/css-loader.ts`               | 1 hex check to CSS variable         |
