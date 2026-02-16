# Implementation Plan: UI Modernization — Polished Components & Color Customization

**Branch**: `004-ui-implementation` | **Date**: 2026-02-15 | **Spec**: [specs/004-ui-implementation/spec.md](spec.md)
**Input**: Feature specification from `/specs/004-ui-implementation/spec.md`

## Summary

Replace hand-crafted CSS components (buttons, tables, inputs, badges) across the Argos dashboard with shadcn-svelte equivalents for a polished, accessible UI. Add operator-facing color customization via a Settings panel — palette selector (8 shadcn themes), dark/light mode toggle, and semantic colors toggle. All changes are color/component-only; zero layout changes.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**:

- SvelteKit 2.22.3, Svelte 5.35.5
- Tailwind CSS 4.1.18 (@tailwindcss/vite JIT)
- bits-ui ^2.15.5 (headless primitives)
- shadcn ^3.8.4 (CLI for component scaffolding)
- tailwind-variants ^3.2.2, tailwind-merge ^3.4.0, clsx ^2.1.1
- @lucide/svelte ^0.564.0 (icons)
- mode-watcher (TO INSTALL — FOUC prevention + dark/light mode)
  **Storage**: localStorage (theme preferences)
  **Testing**: Vitest (unit), Playwright (e2e)
  **Target Platform**: Raspberry Pi 5 (ARM64), Kali Linux 2025.4, Docker v27.5.1
  **Project Type**: SvelteKit web application
  **Performance Goals**: <100ms UI interaction response, zero layout shift on theme change
  **Constraints**: 1024MB Node.js heap, dark-first (light mode secondary), no layout changes
  **Scale/Scope**: 1 main dashboard page, ~19 custom components, 1 Settings panel to build

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                         | Status              | Notes                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Comprehension Before Action | PASS                | Full codebase inventory completed (4 parallel agents), all files read                                                                                                                                                                                                           |
| II — Code Quality Standards     | PASS                | TypeScript strict, no `any`, shadcn barrel files exempt per constitution §2.7                                                                                                                                                                                                   |
| III — Testing Standards         | PASS                | Unit tests for theme store, visual regression for component upgrades                                                                                                                                                                                                            |
| IV — UX Consistency             | PASS (w/ deviation) | Reuse-before-create: using shadcn components (not creating custom), all states handled. Deviation: US5 adds light mode — constitution Preamble amended from "not a consideration" to "secondary option for daylight operations" per Art X §10.3 trigger #6 (dependency change). |
| V — Performance                 | PASS                | Theme CSS is lightweight (<5KB), localStorage access is synchronous                                                                                                                                                                                                             |
| VI — Dependency Management      | NEEDS APPROVAL      | mode-watcher package must be installed (requires user approval per §6.3/§9.3)                                                                                                                                                                                                   |
| VII — Debugging                 | PASS                | Theme changes are purely visual, no hardware/network impact                                                                                                                                                                                                                     |
| VIII — Verification             | PASS                | Verification commands defined per task                                                                                                                                                                                                                                          |
| IX — Security                   | PASS                | No secrets, no hardware changes, localStorage only                                                                                                                                                                                                                              |
| X — Governance                  | PASS                | Constitution check present                                                                                                                                                                                                                                                      |
| XI — Spec-Kit Workflow          | PASS                | Spec is technology-agnostic, plan contains all technical details                                                                                                                                                                                                                |
| XII — Git Workflow              | PASS                | One commit per task, structured messages                                                                                                                                                                                                                                        |

**Deviation**: Article VI §6.3 — `mode-watcher` is a new npm package. Justified because: (1) it's the shadcn-svelte recommended library for dark mode FOUC prevention, (2) it's from the svecosystem (same org as bits-ui), (3) it provides synchronous `<script>` injection that prevents theme flash, (4) alternative would be hand-rolling the same functionality.

## Project Structure

### Documentation (this feature)

```text
specs/004-ui-implementation/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (files affected)

```text
# NEW FILES
src/lib/stores/theme-store.ts              # Theme state: palette, mode, semantic toggle
src/lib/themes/                            # Theme palette CSS definitions
  └── palettes.ts                          # 8 palette objects with CSS variable overrides

# MODIFIED FILES (Component Upgrades — US1, US2)
src/lib/components/dashboard/shared/ToolCard.svelte               # Button + badge upgrades (US1, US2)
src/lib/components/dashboard/views/ToolViewWrapper.svelte         # Button + badge upgrades (US1, US2)
src/lib/components/dashboard/panels/DevicesPanel.svelte           # Table, Input upgrades (US2)
src/lib/styles/palantir-design-system.css                         # Remove replaced CSS classes

# MODIFIED FILES (Theme System — US3-US7)
src/lib/components/dashboard/panels/SettingsPanel.svelte          # Full Settings panel UI
src/app.css                                                       # Add palette CSS variable blocks
src/app.html                                                      # FOUC prevention script + dynamic class
src/lib/components/dashboard/DashboardMap.svelte                  # Replace hardcoded hex colors (25)
src/lib/components/dashboard/AgentChatPanel.svelte                # Replace hardcoded hex colors (28+)
src/lib/components/dashboard/TerminalTabContent.svelte            # Theme-map 5 UI chrome colors (16 ANSI fixed)
src/lib/components/dashboard/panels/LayersPanel.svelte            # Replace hardcoded hex color (1)
src/routes/+layout.svelte                                         # mode-watcher integration

# ALREADY THEME-AWARE (no changes needed — use resolveThemeColor() with CSS vars)
# src/lib/utils/theme-colors.ts, src/lib/utils/signal-utils.ts, spectrum.ts, map-utils.ts, map-service.ts

# SHADCN COMPONENTS TO INSTALL (via CLI)
src/lib/components/ui/table/                                      # shadcn Table (new)
src/lib/components/ui/input/                                      # shadcn Input (new)
src/lib/components/ui/badge/                                      # shadcn Badge (new)
src/lib/components/ui/select/                                     # shadcn Select (new)
src/lib/components/ui/switch/                                     # shadcn Switch (new)
```

**Structure Decision**: SvelteKit single-project layout. New theme store follows existing store patterns in `src/lib/stores/`. Palette definitions isolated in `src/lib/themes/` to keep app.css manageable.

## Complexity Tracking

| Deviation                | Why Needed                                                      | Simpler Alternative Rejected Because                                                                         |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| mode-watcher dependency  | FOUC prevention requires synchronous script before first paint  | Hand-rolling would duplicate mode-watcher's exact functionality, which is maintained by the svecosystem team |
| Palette definitions file | 8 palettes × 2 modes × ~30 vars = ~480 CSS variable assignments | Inlining in app.css would make the file unmanageably long; per-palette CSS files would mean 8 imports        |

---

## Phase 0: Research

### R1: shadcn Theme Architecture

**Decision**: shadcn themes use full variable redefinition per palette. Each palette overrides ALL ~25 CSS variables (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar-_, chart-_) — not just accent vars. Each palette is paired with a specific neutral base (Blue→Slate, Green→Zinc, Orange→Stone, Red→Slate, Rose→Stone, Violet→Gray, Yellow→Zinc, Default→Zinc).

**Rationale**: This was verified from the official source (`shadcn-ui/ui` repo, `apps/v4/registry/_legacy-base-colors.ts`). The full redefinition approach ensures each palette feels cohesive — background tones are tuned to complement the accent color. Chart colors are universal across all palettes.

**Alternatives considered**:

- Accent-only overrides with shared neutral base (rejected: doesn't match how shadcn actually works — verified from source)
- Single-hue generation from a base hue value (rejected: doesn't match shadcn's carefully tuned palettes)

### R2: FOUC Prevention Mechanism

**Decision**: Use `mode-watcher` library from svecosystem.

**Rationale**: mode-watcher injects a synchronous `<script>` before SvelteKit hydration that reads localStorage and applies the correct `class` (dark/light) and data attributes to `<html>` before the browser paints. This is the shadcn-svelte recommended approach. The current app.html has a basic inline `<style>` with hardcoded dark colors — this only prevents white flash, not wrong-theme flash.

**Alternatives considered**:

- Manual blocking `<script>` in app.html (rejected: would duplicate mode-watcher's logic exactly)
- Server-side cookie-based theme detection (rejected: adds complexity, Argos runs locally)

### R3: Component Installation

**Decision**: Install 5 new shadcn components via CLI: Table, Input, Badge, Select, Switch.

**Rationale**: These are the exact components needed for US1 (buttons already installed) and US2 (table, inputs, badges) and the Settings panel (Select for palette dropdown, Switch for toggles). CLI installation ensures proper bits-ui integration and correct TypeScript types.

**Alternatives considered**:

- Hand-coding components with Tailwind (rejected: loses shadcn's tested accessibility, variant system, and consistent theming)
- Installing all shadcn components (rejected: dependency minimalism per Article VI)

### R4: Semantic Colors Implementation

**Decision**: Implement semantic colors as a CSS class toggle. When semantic colors are ON (default), signal-strength and status CSS variables use fixed universal values. When OFF, they inherit from the palette's accent color scale.

**Rationale**: The existing signal system uses CSS variables (`--signal-critical`, `--signal-strong`, etc.) which are already consumed by `resolveThemeColor()` in map markers and `getSignalHex()` in signal-utils. Redefining these variables per palette is the most non-invasive approach.

**Alternatives considered**:

- JavaScript-level color switching in each component (rejected: invasive, fragile)
- Separate CSS file per semantic mode (rejected: unnecessary complexity)

### R5: Dashboard Hardcoded Hex Color Replacement

**Decision**: Replace ALL hardcoded hex colors across dashboard components with CSS variable references via `resolveThemeColor()` or direct `var()` usage. Subscribe affected components to theme store changes. Scope: ~90 hex values across 4 files. GSM Evil page (~120 hex values) deferred to spec 006.

**Files and counts** (verified 2026-02-15):

- `DashboardMap.svelte` (25 hex): RANGE_BANDS (5), SVG gradients/radio-type colors (6+), MapLibre paint properties (8), CSS style block (6). Note: some inline styles already use `var(--palantir-*, #hex)` fallback pattern.
- `AgentChatPanel.svelte` (28+ hex): VS Code-inspired chat styling — backgrounds (#1e1e1e, #252526), borders (#3c3c3c), text (#cccccc, #888), role colors (#4ec9b0, #dcdcaa, #569cd6), status (#3fb950, #0e4429), interactive (#007acc, #0e639c), scrollbar (#424242, #4e4e4e). See AgentChatPanel Hex Mapping table below.
- `TerminalTabContent.svelte` (22 hex total, 5 theme-mapped): UI chrome (background, foreground, cursor, cursorAccent, selection) mapped to CSS vars; 16 ANSI standard colors kept fixed — terminal color standards for CLI output must not change with palette.
- `LayersPanel.svelte` (1 hex): Band dot color (#9a9a9a)

**Already theme-aware (no changes needed)**:

- Files using `resolveThemeColor()` with hex fallbacks: `signal-utils.ts`, `spectrum.ts`, `map-utils.ts`, `map-service.ts`, `theme-colors.ts`
- Files using `var(--palantir-*, #hex)` pattern: `ResizableBottomPanel.svelte`, `TerminalPanel.svelte`, `dashboard/+page.svelte`

**Rationale**: The existing `resolveThemeColor()` utility handles CSS-to-hex conversion. Files already using it with hex fallbacks are already theme-aware. The ~90 pure hardcoded hex values bypass the CSS variable system entirely, meaning they won't respond to palette or mode changes. Converting them is essential for US3 (palette selector) and US5 (dark/light mode) to deliver a consistent experience.

**Alternatives considered**:

- Map tile re-theming (rejected: out of scope, map tiles are external)
- Complete map re-render on theme change (rejected: heavy, data loss risk)
- Only fix RANGE_BANDS (rejected: user directed "Everything except GSM Evil" — leaving 85 other hex values would create visual inconsistency)

### R6: Dual Color System (Palantir + Tailwind)

**Decision**: Maintain both color systems during this spec. Palantir CSS variables (`--palantir-*`) remain for components not yet migrated. shadcn CSS variables (`--primary`, `--background`, etc.) power the new components. Signal variables exist in both systems and are kept in sync.

**Rationale**: The Palantir design system is deeply embedded in ~19 dashboard components. Ripping it out entirely in this spec would be too risky (lesson from previous rollback). Components upgraded to shadcn will use shadcn variables. Un-upgraded components continue using Palantir variables. Both systems read from the same underlying HSL values.

**Alternatives considered**:

- Remove Palantir system entirely (rejected: too many components depend on it, scope creep)
- Convert Palantir variables to point at shadcn variables (rejected: could be done later, adds risk now)

---

## Phase 1: Design

### Data Model: Theme Store

```typescript
// src/lib/stores/theme-store.ts

type ThemePalette = 'default' | 'blue' | 'green' | 'orange' | 'red' | 'rose' | 'violet' | 'yellow';
type ThemeMode = 'dark' | 'light';

interface ThemeState {
	palette: ThemePalette; // Default: 'default' (neutral gray)
	mode: ThemeMode; // Default: 'dark'
	semanticColors: boolean; // Default: true (fixed operational colors)
}

// localStorage key: 'argos-theme'
// Serialized as JSON string
// Read synchronously by FOUC prevention script in app.html
```

**State transitions**:

- `setPalette(palette)` → Updates CSS variables for accent colors, persists to localStorage
- `setMode(mode)` → Toggles `dark` class on `<html>`, switches CSS variable block, persists
- `setSemanticColors(enabled)` → Toggles semantic color class, updates signal/status vars, persists

**Consumers**:

- `SettingsPanel.svelte` — reads/writes all three preferences
- `DashboardMap.svelte` — subscribes for color re-resolution on change
- `signal-utils.ts` — reads semantic toggle to determine color source
- `app.html` FOUC script — reads from localStorage before paint
- `+layout.svelte` — mode-watcher integration

### Data Model: Palette Definitions

```typescript
// src/lib/themes/palettes.ts

interface PaletteDefinition {
	name: string; // Display name (e.g., "Blue")
	label: ThemePalette; // Key (e.g., 'blue')
	cssVars: {
		light: Record<string, string>; // CSS variable overrides for light mode
		dark: Record<string, string>; // CSS variable overrides for dark mode
	};
}
```

Each palette overrides ALL CSS variables (full redefinition per palette, per R1):

- `--background`, `--foreground` (base surface + text)
- `--card`, `--card-foreground`, `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`
- `--sidebar-*` (7 sidebar variants)
- `--chart-1` through `--chart-5` (universal across palettes)

Each palette is paired with a harmonized neutral base (e.g., Blue→Slate, Orange→Stone). Values sourced from official `shadcn-ui/ui` repo (see research.md R2).

### CSS Architecture

```
app.css structure:
  :root { ... }           ← Light mode base (neutral scheme) — EXISTS, update chart colors
  .dark { ... }           ← Dark mode base (Argos cyberpunk) — EXISTS, update chart colors

  [data-palette="blue"] { ... }     ← Blue palette overrides (both modes)
  [data-palette="green"] { ... }    ← Green palette overrides
  [data-palette="orange"] { ... }   ← Orange palette overrides
  [data-palette="red"] { ... }      ← Red palette overrides
  [data-palette="rose"] { ... }     ← Rose palette overrides
  [data-palette="violet"] { ... }   ← Violet palette overrides
  [data-palette="yellow"] { ... }   ← Yellow palette overrides
  (no data-palette or data-palette="default" uses the base neutral)

  .semantic-colors-off .dark { ... }  ← Signal/status colors harmonized with palette
  .semantic-colors-off :root { ... }  ← Same for light mode
```

**Key insight**: Palette switching applies a `data-palette` attribute on `<html>`. The CSS cascade means palette-specific `--primary` overrides the base `--primary`. Mode switching toggles the `dark` class. Semantic toggle adds/removes `semantic-colors-off` class.

### Component Migration Map

| Old CSS Class              | Replacement                                    | Files Affected                |
| -------------------------- | ---------------------------------------------- | ----------------------------- |
| `.btn` (base)              | `<Button>` component                           | ToolCard, ToolViewWrapper     |
| `.btn-primary`             | `<Button variant="default">`                   | ToolCard                      |
| `.btn-secondary`           | `<Button variant="secondary">`                 | DevicesPanel (whitelist Add)  |
| `.btn-ghost`               | `<Button variant="ghost">`                     | ToolViewWrapper (Back button) |
| `.btn-start` / `.btn-open` | `<Button variant="default">` (green/primary)   | ToolCard                      |
| `.btn-danger`              | `<Button variant="destructive">`               | ToolCard                      |
| `.btn-sm`                  | `<Button size="sm">`                           | All                           |
| `.data-table`              | `<Table.Root>` + sub-components                | DevicesPanel                  |
| `.data-table-compact`      | `<Table.Root class="text-xs">`                 | DevicesPanel                  |
| `.input-field`             | `<Input>`                                      | DevicesPanel (search)         |
| `.badge`                   | `<Badge>`                                      | ToolCard, ToolViewWrapper     |
| `.badge-success`           | `<Badge variant="default" class="bg-success">` | Status badges                 |
| `.badge-warning`           | `<Badge variant="default" class="bg-warning">` | Warning badges                |
| `.badge-error`             | `<Badge variant="destructive">`                | Error badges                  |

### Settings Panel UI Design

```
┌─ SETTINGS ─────────────────────┐
│                                │
│  APPEARANCE                    │
│  ┌──────────────────────────┐  │
│  │ Color Palette            │  │
│  │ ┌────────────────────┐   │  │
│  │ │ Default          ▼ │   │  │ ← Select dropdown (8 options)
│  │ └────────────────────┘   │  │
│  │                          │  │
│  │ Mode                     │  │
│  │ Dark          ○────●     │  │ ← Switch toggle (Dark/Light)
│  │                          │  │
│  │ Semantic Colors          │  │
│  │ ON            ●────○     │  │ ← Switch toggle (ON/OFF)
│  │ Fixed red/yellow/green   │  │   with explanatory text
│  │ for signal & status      │  │
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

Components used: `Select` (palette dropdown), `Switch` (mode toggle, semantic toggle), `Label` (from existing Tailwind).

### File Impact Summary

| File                            | Action | Reason                                                |
| ------------------------------- | ------ | ----------------------------------------------------- |
| `src/lib/stores/theme-store.ts` | CREATE | Theme state management (palette, mode, semantic)      |
| `src/lib/themes/palettes.ts`    | CREATE | 8 palette CSS variable definitions                    |
| `src/app.css`                   | MODIFY | Add palette CSS blocks, semantic color overrides      |
| `src/app.html`                  | MODIFY | Add FOUC prevention script, dynamic data-palette attr |
| `src/routes/+layout.svelte`     | MODIFY | mode-watcher integration                              |
| `SettingsPanel.svelte`          | MODIFY | Full theme settings UI                                |
| `ToolCard.svelte`               | MODIFY | Replace .btn-\* and .badge with shadcn components     |
| `ToolViewWrapper.svelte`        | MODIFY | Replace .btn-ghost, .badge with shadcn                |
| `DevicesPanel.svelte`           | MODIFY | Replace table, input with shadcn; Add button upgrade  |
| `DashboardMap.svelte`           | MODIFY | Replace hardcoded hex colors (25) with CSS vars       |
| `AgentChatPanel.svelte`         | MODIFY | Replace hardcoded hex colors (28+) with CSS vars      |
| `TerminalTabContent.svelte`     | MODIFY | Theme-map 5 UI chrome colors (16 ANSI kept fixed)     |
| `LayersPanel.svelte`            | MODIFY | Replace hardcoded hex color (1) with CSS var          |
| `palantir-design-system.css`    | MODIFY | Remove replaced CSS class definitions                 |
| `package.json`                  | MODIFY | Add mode-watcher dependency                           |

### Dependency Inventory

**New direct dependency**:

- `mode-watcher` — FOUC prevention, dark/light mode management. From svecosystem (same team as bits-ui). MIT licensed. Actively maintained.

**New shadcn components** (installed via CLI, not npm):

- Table, Input, Badge, Select, Switch — these are source-copied into `src/lib/components/ui/`, not npm packages

**Existing dependencies used**:

- `bits-ui ^2.15.5` — headless primitives (already installed, powers all shadcn components)
- `tailwind-variants ^3.2.2` — CV API for component variants (already installed)
- `tailwind-merge ^3.4.0` — class merging (already installed)
- `clsx ^2.1.1` — conditional classes (already installed)
- `@lucide/svelte ^0.564.0` — icons (already installed)

**No new transitive concerns**: mode-watcher has minimal dependencies (svelte peer dep only).

### Critical Path

```
[Create theme store] ──FS──┐
                            ├──> [Build Settings panel] ──FS──> [Semantic toggle CSS]
[Define palette CSS] ──FS──┘                                         │
[FOUC script] ─────────────────────────────────────────────────      │
[Install mode-watcher] ──FS──> [Wire mode-watcher] ────────────     │
                                                                     │
                                                          [Hex color replacement]
                                                                │
                                                    ┌───────────┼───────────┐──────────┐
                                              [DashboardMap] [AgentChat] [Terminal] [Layers]
                                                    └───────────┼───────────┘──────────┘
                                                                │
                                                    [Final verification]

[Upgrade buttons (US1)] ──────────────────────────────── (independent, no deps)
[Install shadcn components] ──FS──> [Upgrade table/inputs/badges (US2)] ──FS──> [Remove old CSS]
```

**Critical path (Track B)**: Create theme store → Define palette CSS → Build Settings panel → Semantic toggle CSS → Hex color replacement (4 files parallel) → Final verification.

**Parallel tracks** (independent of critical path):

- Track A: Component upgrades (US1, US2) proceed independently. US1 has zero dependencies. US2 needs T002 (shadcn component install) only.
- Theme store (T003), palette CSS (T005), FOUC script (T006), and palette definitions (T004) can all start immediately — no Phase 1 dependency. Only mode-watcher wiring (T007) depends on T001.
- Hex color replacement across 4 files (DashboardMap, AgentChatPanel, TerminalTabContent, LayersPanel) can run in parallel with each other, but depends on theme store + palette CSS being in place first.

### Risk Register

| Risk                                                                  | Impact | Likelihood | Mitigation                                                                                                                            |
| --------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| mode-watcher incompatible with SvelteKit 2.22.3 / Svelte 5            | HIGH   | LOW        | Check compatibility before install; fallback: manual FOUC script                                                                      |
| shadcn component visual mismatch with Palantir aesthetic              | MEDIUM | MEDIUM     | Test each component in isolation; use Tailwind classes to adjust                                                                      |
| Hex color replacement breaks component rendering (~90 values)         | HIGH   | MEDIUM     | Incremental: replace per-component, verify after each. `resolveThemeColor` fallback mechanism proven for map colors                   |
| xterm.js ANSI colors don't support CSS variables                      | MEDIUM | MEDIUM     | xterm.js theme accepts hex strings; resolve CSS vars to hex at init + re-resolve on theme change via store subscription               |
| AgentChatPanel hex replacement scope (28+ values)                     | MEDIUM | LOW        | Define new CSS variables for chat surfaces; map VS Code-style colors to shadcn tokens (muted, card, accent). See mapping table below. |
| CSS specificity conflicts between palette overrides and Palantir vars | MEDIUM | MEDIUM     | Use `data-palette` attribute selector (higher specificity than class)                                                                 |
| localStorage quota exceeded (unlikely with <1KB theme data)           | LOW    | VERY LOW   | Catch QuotaExceededError, fall back to defaults (pattern from gsm-evil-store)                                                         |
| Light mode reveals hardcoded dark colors in un-upgraded components    | MEDIUM | HIGH       | Known: Palantir vars use hardcoded hex. Mitigation: light mode is P3 priority, document which components need future updates          |

### Pre-Mortem Analysis

**Assumed failure**: "The plan was executed as written. It failed completely."

1. **Palantir variables don't respond to palette changes** — Components using `--palantir-accent` (#4a9eff) won't change when palette switches because Palantir vars are defined in `:root` with hardcoded hex, not HSL functions. **Mitigation**: This is expected. Only shadcn-upgraded components and components using `--primary`/`--accent` CSS vars will respond. The Palantir system is kept for backward compatibility. Document which components are palette-aware vs not.

2. **Light mode looks broken on un-upgraded components** — The Palantir system has no light mode definitions. Components not yet upgraded will show dark backgrounds on light mode. **Mitigation**: Light mode is P3. Add a known-limitations section. Only the Settings panel, upgraded shadcn components, and the layout (body/backgrounds) will properly support light mode in this spec.

3. **FOUC script reads localStorage key that doesn't exist yet** — On first visit, there's no saved theme. **Mitigation**: FOUC script defaults to `dark` mode + `default` palette when localStorage has no `argos-theme` key.

4. **Semantic toggle OFF makes signal colors unreadable on certain palettes** — e.g., Red palette with semantic OFF means signal-critical (red) blends with the accent. **Mitigation**: This is by design (documented in spec edge cases). The operator explicitly opts out of semantic safety.

5. **DashboardMap doesn't re-render on theme change** — MapLibre uses pre-rendered tiles and data-driven styling. Changing CSS variables doesn't trigger map layer re-paint. **Mitigation**: Subscribe map component to theme store, call `map.setPaintProperty()` to update fill/stroke colors when theme changes.

6. **xterm.js terminal colors can't use CSS variables directly** — xterm.js `theme` option accepts hex strings, not CSS `var()` references. Simply replacing hex values with `var()` won't work. **Mitigation**: Resolve CSS variables to hex values at terminal init using `resolveThemeColor()`. Subscribe to theme store to re-apply the resolved theme when palette/mode changes.

7. **AgentChatPanel loses visual distinction after hex replacement** — The VS Code-inspired styling uses specific grays (#1e1e1e, #252526) that create a distinct chat aesthetic. Replacing with generic shadcn tokens (card, muted) may flatten the visual hierarchy. **Mitigation**: Map to appropriate shadcn semantic tokens that preserve the layered surface hierarchy (background → card → muted). Test each palette visually. See AgentChatPanel Hex Mapping table below.

### AgentChatPanel Hex → CSS Variable Mapping

| Hex Value | Usage                                          | Target CSS Variable / Tailwind Class           |
| --------- | ---------------------------------------------- | ---------------------------------------------- |
| `#1e1e1e` | Panel background, input bg, scrollbar track    | `--background` / `bg-background`               |
| `#252526` | Toolbar bg, input area bg                      | `--card` / `bg-card`                           |
| `#3c3c3c` | Toolbar border, input border, badge offline bg | `--border` / `border-border`                   |
| `#cccccc` | Panel text, toolbar title, button text, input  | `--foreground` / `text-foreground`             |
| `#888`    | Badge offline text, timestamp, typing dots     | `--muted-foreground` / `text-muted-foreground` |
| `#2a2d2e` | Button hover                                   | `--accent` / `hover:bg-accent`                 |
| `#00d4ff` | Agent icon                                     | `--primary` / `text-primary`                   |
| `#4ec9b0` | User role color, user border-left              | `--chart-2` (teal/green)                       |
| `#dcdcaa` | Assistant role color, assistant border-left    | `--chart-4` (yellow)                           |
| `#569cd6` | System role color, system border-left          | `--chart-1` (blue)                             |
| `#6a737d` | Timestamp color                                | `--muted-foreground`                           |
| `#1a3a52` | User message bg                                | `--accent` with opacity                        |
| `#2d2d2d` | Assistant message bg                           | `--card` / `bg-card`                           |
| `#1f2937` | System message bg                              | `--muted` / `bg-muted`                         |
| `#007acc` | Input focus border                             | `--ring` / `focus:ring-ring`                   |
| `#0e639c` | Send button bg                                 | `--primary` / `bg-primary`                     |
| `#1177bb` | Send button hover                              | `--primary` with brightness modifier           |
| `#3fb950` | Online badge text                              | `--success` (existing var)                     |
| `#0e4429` | Online badge bg                                | `--success` with low opacity                   |
| `#424242` | Scrollbar thumb                                | `--muted`                                      |
| `#4e4e4e` | Scrollbar thumb hover                          | `--muted-foreground` with opacity              |

### Definition of Done

**Overall task DONE when**:

- All 7 user stories pass their acceptance scenarios
- All buttons, tables, inputs, badges render with shadcn styling (SC-001, SC-002)
- Old hand-crafted CSS removed, net CSS reduction ≥100 lines (SC-003)
- Settings panel functional with palette selector, mode toggle, semantic toggle (SC-004)
- Theme persists across refresh with no FOUC (SC-006)
- Map/spectrum colors update on theme change (SC-009)
- All hardcoded hex colors across dashboard replaced with CSS variable references (~90 values across 4 files)
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors
- `npm run test:unit` — all pass
- `npm run build` — builds successfully
- Zero browser console errors on `/dashboard` with each palette

**Out of scope**:

- GSM Evil page modernization (deferred to spec 006)
- Palantir design system removal (future spec)
- Map tile theming (external tiles)
- Third-party iframe theming (OpenWebRx, Kismet web UI)
- Custom palette creation (operator creates own colors)
