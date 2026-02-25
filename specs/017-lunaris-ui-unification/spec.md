# Feature Specification: Lunaris UI Unification

**Feature Branch**: `017-lunaris-ui-unification`
**Created**: 2026-02-24
**Status**: Draft
**Input**: Unify Argos dashboard UI with Lunaris design system — replace shadcn defaults with Lunaris tokens, fix typography, eliminate light mode, align layout dimensions, and close all design-to-implementation gaps found in E2E audit.

**Design Reference**: `pencil-lunaris.pen` (21 screens, authoritative visual spec)
**Design Reference Doc**: `specs/012-lunaris-ui-redesign/design-reference.md` (referenced in CLAUDE.md)

## Background

An end-to-end audit comparing the Lunaris `.pen` design file (21 screens) against the live Argos dashboard revealed systematic gaps between the design intent and the current implementation. The root cause: the CSS foundation was built from **shadcn/ui defaults** (oklch color space, multi-palette system, Inter font) rather than from the Lunaris design tokens. The `palantir-design-system.css` bridge layer wraps these wrong base values, so every component inherits incorrect colors, fonts, and spacing.

### Audit-Identified Issues (P0-P3)

| Priority | Issue                    | Current State                            | Required State                                  |
| -------- | ------------------------ | ---------------------------------------- | ----------------------------------------------- |
| P0       | Surface colors           | oklch warm purples                       | #111111 / #1A1A1A / #2E2E2E                     |
| P0       | Accent color             | Golden yellow (oklch)                    | #A8B8E0 (Blue ★ default, per palette swatch)    |
| P0       | Mono font stack          | SF Mono first, Fira Code second          | Fira Code primary                               |
| P0       | Sans font                | Inter / system-ui                        | Geist for navigation chrome                     |
| P1       | Light mode CSS           | Full :root light block exists            | Dark mode only — remove light mode              |
| P1       | Palette overrides        | 7 shadcn palette variants                | 13 Lunaris MIL-STD accent themes                |
| P1       | Semantic colors          | Vivid/saturated (#4ade80, #fbbf24)       | Desaturated per .pen (#B6FFCE fg, #8BBFA0 spec) |
| P2       | Panel width              | 320px                                    | 280px per Lunaris spec                          |
| P2       | Command bar height       | 48px                                     | 40px per Lunaris spec                           |
| P2       | Typography scale         | Missing 13px, 10px, 9px                  | Full 6-step scale: 24/13/12/11/10/9px           |
| P2       | Component state handling | Exempted (no loading/error/disconnected) | All 8 states per component                      |
| P3       | Hardcoded fonts          | 2 components with Mac-specific stacks    | Use --font-mono / --font-sans tokens            |
| P3       | Inline SVG icons         | Hardcoded SVG strings in IconRail        | Lucide icon imports                             |

### Authoritative Token Values (from .pen rendered nodes, verified via `search_all_unique_properties`)

**NOTE**: The `.pen` file's document-level variable `--primary` was set to `#FF8400` (orange), but the actual rendered design nodes use `#809AD0` (steel blue) for all accent elements. The **rendered node values** are authoritative — they represent the designer's final intent. The orange value is not used anywhere in the rendered design.

**Design principle**: Lunaris uses **opaque flat surfaces only** — no glass/blur effects, no backdrop-filter, no glow box-shadows on status dots. All elements are flat-filled with solid colors. Drop shadows are limited to popover/dropdown containers (`0 4px 16px #00000040`).

**Dark mode surfaces & structure:**

| Token          | Value       | Purpose                            |
| -------------- | ----------- | ---------------------------------- |
| `--background` | `#111111`   | App background (deepest black)     |
| `--card`       | `#1A1A1A`   | Card/panel surfaces                |
| `--border`     | `#2E2E2E`   | Borders and dividers               |
| `--secondary`  | `#2E2E2E`   | Secondary backgrounds              |
| `--muted`      | `#2E2E2E`   | Muted backgrounds                  |
| `--input`      | `#2E2E2E`   | Input field borders/backgrounds    |
| `--sidebar`    | `#18181b`   | Sidebar/icon rail background       |
| `--popover`    | `#1A1A1A`   | Popover/dropdown background        |
| `--widget-bg`  | `#151515`   | Widget card backgrounds            |
| `--hover-tint` | `#ffffff14` | Hover/active state tint (white 8%) |
| `--separator`  | `#ffffff1a` | Fine separators (white 10%)        |
| `--bar-track`  | `#1E1E1E`   | Progress bar track background      |

**Accent colors (default = Blue ★):**

Each theme's swatch value from the palette table below is applied directly as `--primary`. For the default Blue ★ theme, this means `#A8B8E0`.

| Token                  | Value     | Purpose                                                    |
| ---------------------- | --------- | ---------------------------------------------------------- |
| `--primary`            | `#A8B8E0` | Accent color — set by active theme swatch (Blue ★ default) |
| `--primary-foreground` | `#111111` | Text on accent backgrounds                                 |
| `--ring`               | `#666666` | Focus ring                                                 |

**Swappable accent palette (13 themes, selectable in Settings):**

All themes are MIL-STD-1472 safe, desaturated, and span cool→warm. Starred (★) are designer-recommended.

| Name     | Hex       | Hue  | Notes              |
| -------- | --------- | ---- | ------------------ |
| Ash      | `#AEAEB4` | 240° | Neutral cool gray  |
| Blue ★   | `#A8B8E0` | 225° | **Default accent** |
| Blush    | `#D8BDB4` | 12°  | Warm peach         |
| Iron     | `#B4BBC4` | 214° | Cool steel         |
| Iris     | `#ACAFE0` | 237° | Cool purple-blue   |
| Khaki    | `#CCBC9E` | 30°  | Earth tone         |
| Mauve    | `#D0B0C0` | 320° | Pink-purple        |
| Pewter   | `#C0C0C8` | 240° | Light neutral      |
| Plum     | `#C4B0C8` | 292° | Warm purple        |
| Rose     | `#D4B4BC` | 340° | Dusty pink         |
| Sand ★   | `#E0D4BC` | 38°  | Warm sand          |
| Silver   | `#B8B8C0` | 240° | Neutral            |
| Violet ★ | `#BDB2D4` | 264° | Purple             |

When the user selects an accent theme, only `--primary` changes — all other tokens (surfaces, text, semantic status) remain constant. This ensures the dashboard identity stays cohesive regardless of accent choice.

**Text hierarchy (5-tier grayscale):**

| Token                | Value     | Purpose                               |
| -------------------- | --------- | ------------------------------------- |
| `--foreground`       | `#FFFFFF` | Primary text (data values, headings)  |
| `--text-secondary`   | `#BBBBBB` | Secondary text (descriptions, labels) |
| `--text-tertiary`    | `#888888` | Tertiary text (timestamps, metadata)  |
| `--muted-foreground` | `#666666` | Muted text (placeholders, hints)      |
| `--text-inactive`    | `#555555` | Inactive/disabled text                |

**Semantic status colors (rendered node values):**

| Token           | Value     | Purpose                                   |
| --------------- | --------- | ----------------------------------------- |
| `--success`     | `#8BBFA0` | Healthy (muted sage green)                |
| `--warning`     | `#D4A054` | Warning (warm gold)                       |
| `--destructive` | `#FF5C33` | Error high-visibility (bright orange-red) |
| `--error-desat` | `#C45B4A` | Error desaturated (panel/row use)         |
| `--inactive`    | `#555555` | Inactive/offline indicator                |

**Signal strength colors (from .pen Map Layers panel):**

| Label       | Hex       | Notes                                  |
| ----------- | --------- | -------------------------------------- |
| Very Strong | `#C45B4A` | Reuses `--error-desat` (closest tower) |
| Strong      | `#D4A054` | Reuses `--warning`                     |
| Good        | `#C4A84A` | Unique warm yellow-green               |
| Fair        | `#8BBFA0` | Reuses `--success`                     |
| Weak        | `#809AD0` | Accent blue (farthest viable signal)   |
| No RSSI     | `#555555` | Reuses `--inactive`                    |

**Toggle switch pattern (from .pen Settings screen):**

| State | Fill                 | Notes               |
| ----- | -------------------- | ------------------- |
| On    | `--primary` (accent) | Active theme swatch |
| Off   | `#2A2A2A`            | Dark neutral        |

**ARGOS brand mark (from .pen TopStatusBar):**

| Property       | Value       | Notes                                      |
| -------------- | ----------- | ------------------------------------------ |
| Font           | Fira Code   | Monospace, not sans-serif                  |
| Size           | 14px        | Brand-tier exemption (not in 6-step scale) |
| Weight         | 600         | Semibold                                   |
| Letter-spacing | 2px         | Wide tracking for brand presence           |
| Color          | `--primary` | Accent-colored (not white)                 |

**Fonts:**

- `--font-primary`: Fira Code (monospace — all data, metrics, labels)
- `--font-secondary`: Geist (sans-serif — tab labels, nav chrome, weather text)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Correct Visual Identity (Priority: P1)

An EW operator opens the Argos dashboard and sees a cohesive dark interface with deep black surfaces (#111111), steel blue accent (#A8B8E0, the default Blue ★ theme), Fira Code monospace for all data readouts, and Geist sans-serif for navigation labels. The visual presentation matches the Lunaris design reference with no color, font, or spacing discrepancies visible at normal viewing distance.

**Why this priority**: The color and font tokens are the foundation — every other visual element (widgets, panels, dropdowns) inherits from them. Fixing tokens first ensures all subsequent UI work builds on the correct base.

**Independent Test**: Can be validated by taking a screenshot of the live dashboard and comparing side-by-side with the `.pen` file "Dashboard — System Overview" screen. Colors, fonts, and surface depths should match within perceptual tolerance.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded in a browser, **When** inspecting the root background color, **Then** it resolves to `#111111` (not oklch purple).
2. **Given** any card or panel element, **When** inspecting its background, **Then** it resolves to `#1A1A1A`.
3. **Given** any border element, **When** inspecting its border-color, **Then** it resolves to `#2E2E2E` (solid, not transparent).
4. **Given** any accent-colored element (active icon, progress bar, link), **When** inspecting its color, **Then** it resolves to the active theme's `--primary` value (`#A8B8E0` for Blue ★ default).
5. **Given** a data readout element (CPU %, IP address, frequency), **When** inspecting font-family, **Then** Fira Code is the first resolved font.
6. **Given** a navigation label (tab name, sidebar heading), **When** inspecting font-family, **Then** Geist is the first resolved font.
7. **Given** the browser is set to prefer light color-scheme, **When** loading the dashboard, **Then** it still renders in dark mode — there is no light mode.

---

### User Story 2 - Correct Layout Dimensions (Priority: P2)

An operator sees the dashboard laid out with precise dimensions: a 48px icon rail on the left, a 280px overview panel (when open), the map filling remaining space, and a 40px command bar at the top. These measurements match the Lunaris design reference pixel-for-pixel.

**Why this priority**: Layout dimensions affect spatial perception and information density. The current 320px panel wastes 40px of map space; the 48px command bar steals 8px of vertical space from content. Correcting these improves map visibility — the most critical display element.

**Independent Test**: Can be measured using browser DevTools on the live dashboard. Each structural element should match its specified pixel dimension.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** measuring the icon rail width, **Then** it is exactly 48px.
2. **Given** the overview panel is open, **When** measuring its width, **Then** it is exactly 280px (reduced from 320px).
3. **Given** the command bar (TopStatusBar), **When** measuring its height, **Then** it is exactly 40px (reduced from 48px).
4. **Given** the bottom panel is collapsed, **When** checking the map area height, **Then** it fills from below the 40px command bar to the viewport bottom.

---

### User Story 3 - Correct Semantic Status Colors (Priority: P2)

An operator glances at the status bar and instantly reads hardware health: green text for connected devices, orange for warnings, red-orange for errors. The status colors are desaturated (not vivid/neon) to reduce eye fatigue during extended field use, and every color indicator is paired with a text label so status is never communicated by color alone.

**Why this priority**: Saturated status colors cause visual fatigue in extended field use and fail accessibility tests for color-blind operators. The Lunaris palette uses desaturated semantic colors specifically designed for MIL-STD-1472 compliance.

**Independent Test**: Trigger each status state (connect a device, disconnect a device, create a warning condition) and verify both the color value and the presence of a text label.

**Acceptance Scenarios**:

1. **Given** a hardware device is connected (success state), **When** inspecting the status text color, **Then** it is `#8BBFA0` (muted sage green per `--success` token, not vivid #4ade80).
2. **Given** a warning condition exists, **When** inspecting the warning indicator, **Then** the text color is `#D4A054` (warm gold) and the background is `#291C0F`.
3. **Given** an error condition exists, **When** inspecting the error indicator, **Then** the text color is `#FF5C33` and the background is `#24100B`.
4. **Given** any status indicator with a colored dot, **When** examining the adjacent markup, **Then** a text label describing the status is also present.

---

### User Story 4 - Dead Code Removal (Priority: P2)

The codebase contains no light mode CSS declarations, no shadcn palette overrides (replaced by 13 Lunaris accent themes), and no font stacks referencing fonts outside the Lunaris spec (Inter, SF Mono, Menlo, Monaco). All CSS is Lunaris-aligned with no vestigial shadcn defaults.

**Why this priority**: Dead code creates maintenance confusion and risks accidental activation. The light mode block and old shadcn palettes are misleading CSS that should be replaced with the correct Lunaris values. Non-Lunaris font references create visual inconsistency.

**Independent Test**: Search the CSS files for light mode declarations, old shadcn palette names, and non-Lunaris font references. Light mode and old palettes return zero results; new Lunaris accent themes are present.

**Acceptance Scenarios**:

1. **Given** the `app.css` file, **When** searching for `:root` blocks with light-mode color values, **Then** none exist — only a single `:root` with Lunaris dark-mode defaults.
2. **Given** the `app.css` file, **When** searching for shadcn palette names (`blue`, `green`, `orange`, `red`, `rose`, `violet`, `yellow`), **Then** none exist — replaced by 13 Lunaris accent themes (Ash, Blue, Blush, Iron, Iris, Khaki, Mauve, Pewter, Plum, Rose, Sand, Silver, Violet).
3. **Given** all `.svelte` and `.css` files, **When** searching for `font-family` declarations containing `Inter`, `SF Mono`, `Menlo`, or `Monaco`, **Then** none are found.
4. **Given** the body element's computed font-family, **When** inspected, **Then** it resolves to Geist (not Inter or system-ui).

---

### User Story 5 - Complete Typography Scale (Priority: P3)

Data displayed in the dashboard uses a consistent 6-step type scale (24px hero metrics, 13px brand text, 12px secondary data, 11px primary data rows, 10px status text, 9px section headers) with uppercase styling and letter-spacing on the smallest tier. The scale is defined as design tokens so all components reference shared values.

**Why this priority**: The current type scale skips sizes used by many Lunaris components (13px brand, 10px status, 9px section headers), causing inconsistent visual hierarchy. While not blocking functionality, the incorrect scale undermines the military-grade information density the design targets.

**Independent Test**: Inspect text elements at each hierarchy level across dashboard components and verify their computed font-size matches the 6-step scale.

**Acceptance Scenarios**:

1. **Given** a hero metric (e.g., "47%" CPU usage), **When** inspecting font-size, **Then** it is 24px.
2. **Given** a section header (e.g., "SYSTEM STATUS", "HARDWARE"), **When** inspecting the text, **Then** it is 9px, uppercase, with letter-spacing >= 1.2px.
3. **Given** the dashboard CSS, **When** examining the token definitions, **Then** tokens exist for all 6 sizes: 24px, 13px, 12px, 11px, 10px, 9px.

---

### User Story 6 - Hardcoded Color and Font Cleanup (Priority: P3)

No component uses hardcoded hex colors outside of CSS variable fallback values (i.e., `var(--token, #fallback)` is acceptable; bare `#ffffff` is not). No component uses a font-family declaration that doesn't reference `--font-primary` or `--font-secondary` tokens.

**Why this priority**: Hardcoded values bypass the design token system, making future theme changes partial and error-prone. This is a hygiene task that ensures the token architecture actually works end-to-end.

**Independent Test**: Grep all `.svelte` files for bare hex color values not wrapped in `var()` and for `font-family` declarations not referencing design tokens.

**Acceptance Scenarios**:

1. **Given** `TowerPopup.svelte`, **When** inspecting the `font-family` CSS property, **Then** it references `var(--font-primary)` (not bare `monospace`).
2. **Given** `AgentChatPanel.svelte`, **When** inspecting the chat message font, **Then** it references `var(--font-primary)` (not `Menlo, Monaco, Courier New`).
3. **Given** `app.css` `.sweep-brand` rule, **When** inspecting its color, **Then** it uses a design token (not bare `#ffffff !important`).

---

### Edge Cases

- What happens when Fira Code or Geist fonts fail to load? The fallback chain should degrade gracefully to system monospace / system sans-serif while preserving layout (no font-size jumps causing reflow).
- What happens when a component references an old shadcn palette name (`data-palette="blue"`)? The system should gracefully fall back to the default Lunaris accent (Blue ★ / `#A8B8E0`) — no broken styling.
- What happens on viewports smaller than 1440px? The layout should not break — the 280px panel and 48px rail should remain fixed; only the map area compresses.
- How does the bottom panel default height behave? If 240px is specified but the user has previously resized it, the persisted preference should take precedence.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Dashboard MUST use the Lunaris dark-mode color tokens as the sole `:root` / `.dark` values in `app.css` — no light mode, no palette overrides.
- **FR-002**: All surface backgrounds MUST resolve to the 3-tier depth system: `#111111` (app), `#1A1A1A` (card/panel), `#2E2E2E` (border/muted).
- **FR-003**: The default accent color (`--primary`) MUST be `#A8B8E0` (Blue ★ steel blue, from palette swatch). Users MUST be able to select from 13 MIL-STD-1472-safe accent themes in Settings, which changes only `--primary` — all other tokens remain constant. Each theme's swatch hex from the palette table is applied directly as `--primary`.
- **FR-004**: Semantic status colors MUST use the desaturated values from the `.pen` rendered nodes: success `#8BBFA0` (muted sage), warning `#D4A054` (warm gold), error `#FF5C33` (high-vis), error-desat `#C45B4A` (panel use), inactive `#555555`.
- **FR-005**: Semantic status backgrounds MUST use the dark-tinted values: success `#222924`, warning `#291C0F`, error `#24100B`, info `#222229`.
- **FR-006**: The mono font stack (`--font-mono` / `--font-primary`) MUST list Fira Code first, with JetBrains Mono and monospace as fallbacks.
- **FR-007**: The sans-serif font stack (`--font-sans` / `--font-secondary`) MUST list Geist first, with system-ui and sans-serif as fallbacks.
- **FR-008**: The body default font MUST be Geist (replacing Inter).
- **FR-009**: All data readouts (metrics, IPs, coordinates, frequencies, timestamps) MUST use the mono font stack.
- **FR-010**: All navigation chrome (tab labels, sidebar headings, button labels) MUST use the sans-serif stack.
- **FR-011**: The typography scale MUST define tokens for all 6 sizes: 24px, 13px, 12px, 11px, 10px, 9px.
- **FR-012**: Section headers at the 9px tier MUST be uppercase with letter-spacing >= 1.2px.
- **FR-013**: The overview panel width MUST be 280px (not 320px).
- **FR-014**: The command bar (TopStatusBar) height MUST be 40px (not 48px).
- **FR-015**: Light mode CSS (the `:root` block with light-color values) MUST be removed from `app.css`.
- **FR-016**: The 7 shadcn palette overrides (`[data-palette='blue']`, `green`, `orange`, `red`, `rose`, `violet`, `yellow`) MUST be replaced with the 13 Lunaris accent themes (Ash through Sand), each only overriding `--primary`.
- **FR-017**: Every hardcoded `font-family` in `.svelte` files MUST be replaced with a `var(--font-primary)` or `var(--font-secondary)` token reference.
- **FR-018**: Bare hardcoded hex colors in `.svelte` component styles (not inside `var()` fallbacks) MUST be replaced with design token references. Glow effects (`box-shadow` with colored spread) on status dots MUST be removed — Lunaris uses flat solid fills only.
- **FR-019**: The `palantir-design-system.css` bridge layer MUST be updated so its `--palantir-*` aliases map correctly to the new Lunaris base token values.
- **FR-020**: Color MUST never be the sole status indicator — every colored status element MUST have an adjacent text label.
- **FR-021**: The icon rail width MUST remain 48px (already correct — no change needed).
- **FR-022**: Progress bar tracks MUST use `--bar-track` (`#1E1E1E`) — a neutral dark gray with no hue tint. This ensures tracks remain visually correct across all 13 accent themes.
- **FR-023**: The ARGOS brand mark in the TopStatusBar MUST be Fira Code 14px semibold (600 weight), letter-spacing 2px, colored with `--primary` (accent-colored, not white).
- **FR-024**: Popover/dropdown containers MUST use a standard drop shadow (`0 4px 16px #00000040`) — no `backdrop-filter`, no glass/blur effects, no frosted overlays.
- **FR-025**: Toggle switches MUST use `--primary` (accent) for the "on" state and `#2A2A2A` for the "off" state.

### Key Entities

- **Design Token**: A CSS custom property (`--name: value`) that defines a visual attribute (color, spacing, font). All components reference tokens, never raw values.
- **Surface Tier**: One of 3 background depth levels (app/card/border) creating spatial hierarchy through luminance.
- **Font Stack**: An ordered list of font families with fallbacks, referenced via a single CSS variable.
- **Typography Scale Step**: A predefined font-size value in the 6-step scale, each assigned a semantic purpose (hero/brand/secondary/primary/status/header).

### Assumptions

- The `.pen` file's rendered node values (inspected via Pencil MCP `batch_get` with `resolveVariables: true`) are the authoritative source of truth for design token values.
- The `.pen` file's document-level variable `--primary` was `#FF8400` (orange), but the palette reference card's Blue ★ swatch is `#A8B8E0` and rendered accent nodes use `#809AD0`. Per user decision: each theme's palette swatch hex IS the `--primary` value. For Blue ★, `--primary` = `#A8B8E0`. The `#809AD0` value seen in rendered nodes is a pre-palette legacy color that will be superseded.
- Fira Code and Geist web fonts are already available on the target device (RPi 5 running Kali Linux) or will be bundled/self-hosted. Font loading strategy is an implementation detail.
- The 48px icon rail width is already correct per the `.pen` file and Lunaris spec — it does not need to change.
- The 7 shadcn palette variants are replaced (not just removed) with 13 Lunaris accent themes. The Settings panel has an Appearance section in the `.pen` file where the user selects their accent via a dropdown (styled: current theme name + chevron). The theme store's palette mechanism is preserved but rewired to Lunaris values.
- Chart line/area colors, animated transitions, and motion timing are NOT defined in the `.pen` file (it is a static design format). These are deferred to implementation judgment, staying within the established token palette.
- Borders throughout Lunaris are solid `#2E2E2E` (opaque), not alpha-transparent. All existing `rgba()` or `hsla()` border values should be converted to solid equivalents.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every resolved background color on the dashboard matches its Lunaris token value within color distance deltaE < 1.0 (perceptually identical).
- **SC-002**: 100% of `font-family` declarations in `.svelte` and `.css` files reference design tokens (`--font-primary`, `--font-secondary`, `--font-mono`, `--font-sans`) — zero hardcoded font stacks.
- **SC-003**: Zero instances of light mode CSS or old shadcn palette CSS remain. All 13 Lunaris accent themes are defined and selectable.
- **SC-004**: The overview panel, command bar, and icon rail match their specified pixel dimensions (280px, 40px, 48px respectively) when measured in browser DevTools.
- **SC-005**: All semantic status indicators (success, warning, error, info) pair a colored element with a text label — no color-only indicators.
- **SC-006**: The dashboard initial load time remains under 3 seconds on the target hardware (RPi 5), with no regression from the UI changes.
- **SC-007**: Dashboard memory usage remains under 200MB heap, with no regression from font loading or CSS changes.
- **SC-008**: All 6 typography scale sizes (24/13/12/11/10/9px) are defined as tokens and used by at least one component each.
