# Implementation Plan: Lunaris UI Redesign

**Branch**: `012-lunaris-ui-redesign` | **Date**: 2026-02-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-lunaris-ui-redesign/spec.md`

## Summary

Replace the current ad-hoc multi-layer CSS architecture (shadcn oklch tokens + Palantir bridge variables + dashboard layout tokens) with a unified Lunaris design token system. Restyle all dashboard components to match the Pencil mockup's Steel Blue accent variant, using a consolidated 6-token text hierarchy (R-011), Fira Code for data display and Geist for UI chrome. Remove colored dot status indicators in favor of text-based status labels with semantic color tinting. Add a Logs summary section and inline Speed Test button (librespeed-cli, R-010) to the overview panel. Preserve all existing functionality.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: Svelte 5.35.5, SvelteKit 2.22.3, Tailwind CSS 4.1.18, Vite 7.0.3
**Storage**: SQLite (rf_signals.db) — not affected by this feature
**Testing**: Vitest 3.2.4 — visual regression via screenshot comparison
**Target Platform**: Raspberry Pi 5, Kali Linux 2025.4, Chromium kiosk (1920x1080)
**Project Type**: Web application (SvelteKit full-stack)
**Performance Goals**: Full render < 2s on RPi 5. No layout shift during load.
**Constraints**: < 200MB heap. Dark mode only. No additional CSS framework dependencies. Self-hosted fonts (no CDN on field deployment).
**Scale/Scope**: ~80 Svelte components, 5 CSS files, 14 stores. 3 routes (/, /dashboard, /gsm-evil). Dashboard route is the primary target.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                           | Gate                                                                        | Status   | Notes                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I.1 Comprehension Lock            | End State, Current State, Problem, Constraints, Success Criteria documented | PASS     | Spec covers all five. Plan summary + technical context confirm understanding.                                                                                         |
| I.2 Codebase Inventory            | Modified/related files listed                                               | PASS     | Full CSS file inventory + component list in research. See Source Code section.                                                                                        |
| II.1 TypeScript Strict            | No `any`, no `@ts-ignore`                                                   | PASS     | This feature is primarily CSS/markup. No type system changes needed.                                                                                                  |
| II.2 Modularity                   | Max 50 lines/function, 300 lines/file                                       | PASS     | New token file is CSS declarations, not logic. Component changes are markup restyling.                                                                                |
| II.5 Documentation                | JSDoc for public functions                                                  | N/A      | No new public functions — CSS tokens + markup changes only.                                                                                                           |
| II.6 Forbidden: No hardcoded hex  | Use Tailwind theme variables                                                | CRITICAL | This is the _purpose_ of the feature. All hex values consolidated into CSS custom properties referenced via Tailwind utilities.                                       |
| II.6 Forbidden: No barrel files   | Direct imports only                                                         | PASS     | No new barrel files created.                                                                                                                                          |
| III.1 Test-First                  | Tests before implementation                                                 | PARTIAL  | Visual regression tests created alongside component changes. Pure CSS token changes have no unit test surface.                                                        |
| IV.1 Design Language              | Cyberpunk → Lunaris transition                                              | NOTE     | Constitution says "Cyberpunk theme" — this redesign replaces it with Lunaris. Constitution should be amended to reflect new design language after this feature lands. |
| IV.3 State Communication          | Handle ALL states                                                           | DEFERRED | Existing exemption (#11) carries forward. This feature restyles existing states, doesn't add new ones.                                                                |
| IV.4 Accessibility                | Contrast ratios, semantic HTML                                              | PASS     | FR-012 requires text labels alongside color. Desaturated semantic colors maintain WCAG AA contrast on #111111 background.                                             |
| V.2 Load                          | Initial load < 3s                                                           | PASS     | SC-009 targets 2s. Self-hosted fonts loaded via `@font-face` with `font-display: swap`.                                                                               |
| VI.2 Use Directly                 | Tailwind used directly                                                      | PASS     | Token system uses CSS custom properties consumed via Tailwind's `@theme inline` directive.                                                                            |
| VI.3 Forbidden: No CSS frameworks | No additional CSS frameworks                                                | PASS     | Tailwind is the only CSS framework. No additions.                                                                                                                     |
| IX.1 Spec/Plan separation         | Spec=WHAT, Plan=HOW                                                         | PASS     | Spec has no implementation details. Plan has concrete file paths and token values.                                                                                    |

**Complexity Tracking**: No violations requiring justification.

**Constitution Amendment Required**: Article IV.1 currently reads "Cyberpunk theme. Monospaced data. High density. Visual hierarchy." After this feature lands, it should be updated to: "Lunaris design system. Monospaced data (Fira Code). Sans-serif UI chrome (Geist). High density. Dark-first. Steel blue accent. Desaturated semantic status colors."

## Project Structure

### Documentation (this feature)

```text
specs/012-lunaris-ui-redesign/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: design token mapping, font strategy, migration plan
├── data-model.md        # Phase 1: token schema (CSS custom properties)
├── quickstart.md        # Phase 1: developer guide for using Lunaris tokens
├── contracts/           # Phase 1: component styling contracts
│   └── token-api.md     # Token naming conventions and usage rules
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app.css                                          # MODIFY: Replace oklch tokens + palette overrides with Lunaris hex tokens
├── lib/
│   ├── styles/
│   │   ├── lunaris-tokens.css                       # CREATE: Single source of truth for all Lunaris design tokens
│   │   ├── palantir-design-system.css               # DELETE: Replaced entirely by lunaris-tokens.css
│   │   └── dashboard.css                            # MODIFY: Update layout tokens, font stacks, keep Leaflet overrides
│   ├── components/
│   │   └── dashboard/
│   │       ├── TopStatusBar.svelte                  # MODIFY: Restyle command bar (brand, icons, indicators)
│   │       ├── IconRail.svelte                      # MODIFY: Restyle icon rail (48px, active/hover states)
│   │       ├── DashboardMap.svelte                  # MODIFY: Map chrome, marker colors, GPS indicator
│   │       ├── ResizableBottomPanel.svelte           # MODIFY: Tab bar, collapse caret, drag handle styling
│   │       ├── TerminalPanel.svelte                 # MODIFY: Terminal font/color tokens
│   │       ├── AgentChatPanel.svelte                # MODIFY: Chat bubble styling with Lunaris tokens
│   │       ├── LogsPanel.svelte                     # MODIFY: Log entry styling
│   │       ├── PanelContainer.svelte                # MODIFY: Panel wrapper styling
│   │       ├── panels/
│   │       │   ├── OverviewPanel.svelte             # MODIFY: Panel layout, add LogsSummaryCard import
│   │       │   ├── overview/
│   │       │   │   ├── SystemInfoCard.svelte        # MODIFY: Metric tile styling (progress bars, typography)
│   │       │   │   ├── HardwareCard.svelte          # MODIFY: Remove status dots, add text status labels
│   │       │   │   ├── ServicesCard.svelte           # MODIFY: Remove status dots, add text status labels
│   │       │   │   ├── WifiInterfacesCard.svelte    # MODIFY: Remove status dots, network status text
│   │       │   │   ├── GpsCard.svelte               # MODIFY: GPS tile with Lunaris typography
│   │       │   │   └── LogsSummaryCard.svelte       # CREATE: Aggregate log counters (events, warnings, errors, last alert)
│   │       │   ├── SettingsPanel.svelte             # MODIFY: Token updates
│   │       │   ├── DevicesPanel.svelte              # MODIFY: Token updates
│   │       │   ├── LayersPanel.svelte               # MODIFY: Token updates
│   │       │   ├── ToolsPanel.svelte                # MODIFY: Token updates
│   │       │   └── ToolsPanelHeader.svelte          # MODIFY: Token updates
│   │       ├── status/
│   │       │   ├── SdrDropdown.svelte               # MODIFY: Dropdown styling
│   │       │   ├── GpsDropdown.svelte               # MODIFY: Dropdown styling
│   │       │   ├── WifiDropdown.svelte              # MODIFY: Dropdown styling
│   │       │   ├── WeatherDropdown.svelte           # MODIFY: Dropdown styling
│   │       │   └── CoordsDisplay.svelte             # MODIFY: Coordinate typography
│   │       ├── map/
│   │       │   ├── TowerPopup.svelte                # MODIFY: Popup styling
│   │       │   └── DeviceOverlay.svelte             # MODIFY: Marker colors (accent for AP, red for target)
│   │       └── shared/
│   │           ├── ToolCard.svelte                  # MODIFY: Card styling
│   │           └── ToolCategoryCard.svelte          # MODIFY: Card styling
│   └── stores/
│       └── theme-store.svelte.ts                    # MODIFY: Remove palette system, simplify to accent-color-only
├── routes/
│   └── dashboard/
│       └── +page.svelte                             # MODIFY: Import lunaris-tokens.css instead of palantir-design-system.css
└── static/
    └── fonts/                                       # CREATE: Self-hosted Fira Code + Geist font files
        ├── FiraCode-Regular.woff2
        ├── FiraCode-SemiBold.woff2
        ├── FiraCode-Bold.woff2
        ├── Geist-Regular.woff2
        └── Geist-Medium.woff2
```

**Structure Decision**: SvelteKit web application. Existing directory structure preserved. One new CSS file (`lunaris-tokens.css`) replaces `palantir-design-system.css`. One new component (`LogsSummaryCard.svelte`). Font files added to `static/fonts/`. No new routes, stores, or API endpoints.

## Phase 0: Research

### R-001: Font Loading Strategy for Field Deployment

**Decision**: Self-hosted WOFF2 font files in `static/fonts/`
**Rationale**: Field deployment on RPi 5 may have no internet access. Google Fonts CDN is unreliable in tactical environments. WOFF2 is the smallest format with universal browser support. Fira Code Regular/SemiBold/Bold (3 weights) + Geist Regular/Medium (2 weights) = ~5 files, ~250KB total.
**Alternatives considered**:

- Google Fonts CDN — rejected (no internet guarantee in field)
- System font fallback only — rejected (inconsistent rendering across Kali/Parrot/Debian)
- Fontsource npm packages — rejected (adds dependency, Constitution Art. VI.1 discipline)

### R-002: CSS Token Architecture — Single File vs Split

**Decision**: Single `lunaris-tokens.css` file containing all design tokens
**Rationale**: The current 3-file system (`app.css` tokens + `palantir-design-system.css` bridge + `dashboard.css` layout) creates confusion about which variable layer to use. A single token file with clear sections (colors, typography, spacing, layout) eliminates the "which `--bg` do I use?" problem. At ~150 lines, it's well within the 300-line file limit.
**Alternatives considered**:

- Keep 3-file split with renamed variables — rejected (same confusion, more maintenance)
- Tailwind config-only tokens (no CSS custom properties) — rejected (Tailwind v4 `@theme inline` needs CSS vars; components also need direct var() access for computed styles)

### R-003: Palette Override System Removal

**Decision**: Remove the `data-palette` attribute system and all palette override blocks from `app.css`
**Rationale**: The Lunaris design uses a single accent color (`--accent-color`) that components reference. The old 7-palette system (blue, green, orange, red, rose, violet, yellow) with `data-palette` attribute selectors is dead code after the redesign. The accent color token can be changed in one place for future theme variants.
**Alternatives considered**:

- Keep palette system alongside Lunaris — rejected (conflicting token values, dead code)
- Convert palettes to Lunaris accent presets — deferred to P3 accent theming story

### R-004: Migration Strategy — Big Bang vs Incremental

**Decision**: Incremental migration by component group, with token file landing first
**Rationale**: A big-bang rewrite of 80 components risks breaking functionality. Instead: (1) land the token file + font files first, (2) migrate the shell layout (command bar, icon rail, overview panel), (3) migrate content panels and cards, (4) migrate map chrome and bottom panel. Each phase is independently testable and committable per Constitution Art. IX.2.
**Alternatives considered**:

- Big bang (rewrite all CSS in one commit) — rejected (Constitution Art. IX.2 max 2 hours/5 files per task)
- Feature flag with old/new toggle — rejected (adds complexity, two code paths to maintain)

### R-005: Handling Existing Status Dot Classes

**Decision**: Remove `.status-dot`, `.status-indicator`, and related CSS classes. Replace with semantic text utilities.
**Rationale**: FR-007 and FR-012 mandate text-based status labels with color tinting. The existing `.status-dot-online`, `.status-dot-offline`, `.status-dot-warning` classes and `.status-connected`, `.status-disconnected`, `.status-connecting` classes will be replaced by Tailwind utilities referencing semantic color tokens (`text-status-healthy`, `text-status-warning`, `text-status-error`, `text-status-inactive`).
**Alternatives considered**:

- Keep dots alongside text labels — rejected (spec explicitly says "no colored dot indicators")

### R-006: oklch vs hex Color Format

**Decision**: Use hex color values in Lunaris tokens, not oklch
**Rationale**: The current `app.css` uses oklch format from shadcn's generator. The Pencil mockup and all design decisions use hex values (#111111, #1A1A1A, #809AD0, etc.). Hex is universally readable, directly maps to the design reference, and Tailwind v4's `@theme inline` works with any CSS color format. Converting to oklch would add a translation layer with no benefit.
**Alternatives considered**:

- Keep oklch for perceptual uniformity — rejected (design tokens are hand-tuned hex values from mockup; oklch conversion would slightly shift colors)
- HSL format — rejected (same issue; hex is the authoritative format from the design session)

### R-007: Panel Width Change (320px → 280px)

**Decision**: Reduce overview panel from 320px to 280px per Lunaris mockup
**Rationale**: Mockup uses 280px. Narrower panel gives more space to the map area. Content fits at 280px with tighter Lunaris typography (9-11px labels vs current 11-14px).
**Impact**: Test at 1920x1080 to verify no content overflow.

### R-008: Command Bar Height Change (48px → 40px)

**Decision**: Reduce top bar from 48px to 40px per Lunaris mockup
**Rationale**: 40px provides sufficient touch/click target while recovering 8px of vertical space for the map. Brand text at 13px + icons fit comfortably in 40px.

### R-009: Color Format — Hex Only

**Decision**: Hex values (#RRGGBB), not oklch — same as R-006 but explicitly covering the mockup
**Rationale**: Pencil mockup uses hex. Hand-tuned values lose precision in oklch conversion.

### R-010: Speed Test Tool Selection

**Decision**: librespeed-cli (Go static binary, v1.0.12)
**Rationale**: Field deployment on RPi 5 requires minimal resource usage and LAN/offline capability. librespeed-cli is a 3 MB static Go binary with zero runtime dependencies and pre-built ARM64 releases. Supports self-hosted LibreSpeed servers for LAN testing when internet is unavailable. JSON output for easy parsing.
**Alternatives rejected**: Ookla (proprietary, no LAN), fast-cli (requires Puppeteer ~280MB), speedtest-cli/sivel (archived July 2024).

### R-011: Gray Text Palette Consolidation (8 → 6 tokens)

**Decision**: Consolidate from 8 gray text values in the mockup to 6 named tokens
**Rationale**: Professional design systems (IBM Carbon, Google Material, Microsoft Fluent, Shopify Polaris, Salesforce Lightning) typically use 5-7 neutral text tokens. Two pairs in the mockup are perceptually near-identical at 9-11px: #BBBBBB/#B8B9B6 (1.4% luminance diff) and #666666/#888888. Fewer distinct tones improve scannability.
**Token mapping**: --text-primary (#FFF), --text-data (#BBB, absorbs #B8B9B6), --text-secondary (#AAA), --text-label (#999), --text-tertiary (#666, absorbs #888), --text-disabled (#555).
**Applied to mockup**: .pen file updated via `replace_all_matching_properties` on node yHSs9.

## Phase 1: Design & Contracts

### Token Schema (data-model.md content)

The Lunaris design token system has 5 categories:

**1. Surface Colors** (backgrounds, cards, borders)

- `--bg-base`: #111111 (deepest background)
- `--bg-card`: #1A1A1A (card/panel surfaces)
- `--bg-elevated`: #222222 (hover states, elevated surfaces)
- `--border-default`: #2E2E2E (standard borders)
- `--border-strong`: #333333 (tile borders, emphasis)
- `--border-subtle`: #1F1F1F (subtle separations)

**2. Text Colors** (6-token consolidated foreground hierarchy — see R-011 in research.md)

- `--text-primary`: #FFFFFF (primary content, metric values, tool names, active elements)
- `--text-data`: #BBBBBB (device names, hardware names, log event values, data display)
- `--text-secondary`: #AAAAAA (IP addresses, coordinates, latency values, descriptions)
- `--text-label`: #999999 (section headers UPPERCASE, letter-spaced tile labels)
- `--text-tertiary`: #666666 (sub-values, row labels, placeholders, secondary data)
- `--text-disabled`: #555555 (chevrons, inactive status, dates, expand icons, decorative)

**3. Accent Colors** (brand identity, interactive highlights)

- `--accent`: #809AD0 (steel blue — primary accent)
- `--accent-light`: #A8BBD8 (lighter tint for secondary bars)
- `--accent-muted`: rgba(128, 154, 208, 0.15) (hover backgrounds)

**4. Semantic Status Colors** (operational health — desaturated)

- `--status-healthy`: #8BBFA0 (muted sage green)
- `--status-warning`: #D4A054 (warm gold)
- `--status-error`: #FF5C33 (high-visibility alerts: REC indicator, target markers)
- `--status-error-soft`: #C45B4A (desaturated error: Logs error count, overview panel use)
- `--status-inactive`: #555555 (gray)
- `--status-info`: #7B9FCC (desaturated blue)

**5. Typography Tokens**

- `--font-mono`: 'Fira Code', 'SF Mono', 'JetBrains Mono', monospace
- `--font-sans`: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif
- Six-step size scale: `--text-hero` (24px), `--text-brand` (13px), `--text-data` (12px), `--text-row` (11px), `--text-status` (10px), `--text-label` (9px)
- Weights: `--weight-normal` (400), `--weight-medium` (500), `--weight-semibold` (600), `--weight-bold` (700)

**6. Layout Tokens**

- `--rail-width`: 48px
- `--panel-width`: 280px (changed from current 320px)
- `--command-bar-height`: 40px (changed from current 48px)
- `--bottom-panel-default`: 240px

**7. Spacing Scale** (preserved from existing, 4px base)

- `--space-1` through `--space-12` (4px to 48px)

### Component Styling Contracts

Each component commits to:

1. Reference only Lunaris token variables — no hard-coded colors, sizes, or fonts
2. Use Tailwind utilities where possible (`bg-[var(--bg-card)]`, `text-[var(--text-primary)]`)
3. Use `var()` directly only for computed/dynamic styles (progress bar widths, animation values)
4. Status indicators use text with semantic color class, never standalone colored dots
5. Data values use `--font-mono`; UI labels/navigation use `--font-sans`

### Quickstart Guide

For developers working on Lunaris-themed components:

1. **Colors**: Use `var(--bg-base)`, `var(--text-primary)`, `var(--accent)`, `var(--status-healthy)` etc.
2. **Typography**: Data = `font-family: var(--font-mono)`. UI = `font-family: var(--font-sans)`.
3. **Status text**: Use `class="text-[var(--status-healthy)]"` + always include text label alongside color.
4. **Accent elements**: Use `var(--accent)` for highlights, bar fills, active indicators. Never for status.
5. **Spacing**: Use `var(--space-N)` tokens or Tailwind's built-in spacing utilities.

## Files to Create

| File                                                                  | Purpose                                       | Size Est.  |
| --------------------------------------------------------------------- | --------------------------------------------- | ---------- |
| `src/lib/styles/lunaris-tokens.css`                                   | Single source of truth for all design tokens  | ~150 lines |
| `src/lib/components/dashboard/panels/overview/LogsSummaryCard.svelte` | Aggregate log counters component              | ~80 lines  |
| `static/fonts/FiraCode-Regular.woff2`                                 | Monospace font (regular weight)               | ~60KB      |
| `static/fonts/FiraCode-SemiBold.woff2`                                | Monospace font (semibold weight)              | ~60KB      |
| `static/fonts/FiraCode-Bold.woff2`                                    | Monospace font (bold weight)                  | ~60KB      |
| `static/fonts/Geist-Regular.woff2`                                    | Sans-serif font (regular weight)              | ~35KB      |
| `static/fonts/Geist-Medium.woff2`                                     | Sans-serif font (medium weight)               | ~35KB      |
| `specs/012-lunaris-ui-redesign/research.md`                           | This research consolidated                    | ~100 lines |
| `specs/012-lunaris-ui-redesign/data-model.md`                         | Token schema reference                        | ~80 lines  |
| `specs/012-lunaris-ui-redesign/quickstart.md`                         | Developer usage guide                         | ~50 lines  |
| `specs/012-lunaris-ui-redesign/contracts/token-api.md`                | Token naming rules                            | ~40 lines  |
| `src/routes/api/network/speed-test/+server.ts`                        | Speed test API endpoint (runs librespeed-cli) | ~60 lines  |
| `scripts/ops/install-librespeed.sh`                                   | Download librespeed-cli ARM64 binary          | ~30 lines  |

## Files to Modify

| File                                                                     | Changes                                                                                                          | Impact                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `src/app.css`                                                            | Replace oklch tokens with Lunaris hex, remove palette overrides, update `@theme inline`, change body font        | HIGH — root token source |
| `src/lib/styles/dashboard.css`                                           | Update `--font-sans`/`--font-mono`, change `--panel-width` to 280px, `--top-bar-height` to 40px                  | MEDIUM — layout tokens   |
| `src/routes/dashboard/+page.svelte`                                      | Change import from `palantir-design-system.css` to `lunaris-tokens.css`                                          | LOW — one import line    |
| `src/lib/stores/theme-store.svelte.ts`                                   | Remove palette switching logic, simplify to accent-color-only                                                    | MEDIUM — theme store     |
| `src/lib/components/dashboard/TopStatusBar.svelte`                       | Restyle brand text, status icons, indicator dropdowns                                                            | MEDIUM                   |
| `src/lib/components/dashboard/IconRail.svelte`                           | Active/hover states, terminal shortcut at top, waypoints logo below spacer (future feature, not yet implemented) | LOW                      |
| `src/lib/components/dashboard/panels/OverviewPanel.svelte`               | Add LogsSummaryCard, adjust panel width/spacing                                                                  | MEDIUM                   |
| `src/lib/components/dashboard/panels/overview/SystemInfoCard.svelte`     | Metric tile restyling (progress bars, typography)                                                                | MEDIUM                   |
| `src/lib/components/dashboard/panels/overview/HardwareCard.svelte`       | Remove dots, text status labels                                                                                  | MEDIUM                   |
| `src/lib/components/dashboard/panels/overview/ServicesCard.svelte`       | Remove dots, text status labels                                                                                  | MEDIUM                   |
| `src/lib/components/dashboard/panels/overview/WifiInterfacesCard.svelte` | Remove dots, network text status, add Speed Test button (FR-015)                                                 | MEDIUM                   |
| `src/lib/components/dashboard/panels/overview/GpsCard.svelte`            | Typography update                                                                                                | LOW                      |
| `src/lib/components/dashboard/ResizableBottomPanel.svelte`               | Tab bar, caret, drag handle styling                                                                              | MEDIUM                   |
| `src/lib/components/dashboard/DashboardMap.svelte`                       | Map chrome, marker tokens                                                                                        | LOW                      |
| `src/lib/components/dashboard/map/DeviceOverlay.svelte`                  | Marker color tokens (accent vs error)                                                                            | LOW                      |
| `src/lib/components/dashboard/map/TowerPopup.svelte`                     | Popup styling tokens                                                                                             | LOW                      |
| `src/lib/components/dashboard/TerminalPanel.svelte`                      | Font/color tokens                                                                                                | LOW                      |
| `src/lib/components/dashboard/AgentChatPanel.svelte`                     | Bubble styling tokens                                                                                            | LOW                      |
| `src/lib/components/dashboard/LogsPanel.svelte`                          | Log entry styling                                                                                                | LOW                      |
| `src/lib/components/dashboard/status/*.svelte` (6 files)                 | Dropdown/display token updates (incl. SatelliteTable.svelte)                                                     | LOW each                 |
| `src/lib/components/dashboard/panels/SettingsPanel.svelte`               | Token updates                                                                                                    | LOW                      |
| `src/lib/components/dashboard/panels/DevicesPanel.svelte`                | Token updates                                                                                                    | LOW                      |
| `src/lib/components/dashboard/panels/LayersPanel.svelte`                 | Token updates                                                                                                    | LOW                      |
| `src/lib/components/dashboard/panels/ToolsPanel.svelte`                  | Token updates                                                                                                    | LOW                      |
| `src/lib/components/dashboard/shared/ToolCard.svelte`                    | Card styling tokens                                                                                              | LOW                      |
| `src/lib/components/dashboard/shared/ToolCategoryCard.svelte`            | Card styling tokens                                                                                              | LOW                      |

## Files to Delete

| File                                        | Reason                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/styles/palantir-design-system.css` | Entirely replaced by `lunaris-tokens.css`. All 309 lines of Palantir bridge variables, status dot classes, signal indicator classes, and utility classes are superseded. |

## Post-Phase 1: Constitution Re-Check

| Article                 | Status           | Notes                                                                                                                |
| ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| II.6 No hardcoded hex   | ENFORCED         | All hex values centralized in `lunaris-tokens.css`. Components reference via `var()` or Tailwind utilities.          |
| II.2 Max 300 lines/file | PASS             | `lunaris-tokens.css` est. 150 lines. `LogsSummaryCard.svelte` est. 80 lines.                                         |
| IV.1 Design Language    | AMENDMENT NEEDED | Constitution currently says "Cyberpunk theme" — must be updated to "Lunaris design system" after this feature ships. |
| V.2 Initial load < 3s   | PASS             | Font files add ~250KB but are loaded async with `font-display: swap`. No blocking render.                            |
| VI.3 No CSS frameworks  | PASS             | No new CSS framework added. Only Tailwind.                                                                           |
