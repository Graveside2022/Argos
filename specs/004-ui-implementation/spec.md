# Feature Specification: UI Modernization — Polished Components & Color Customization

**Feature Branch**: `004-ui-implementation`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Modernize the Argos UI look — upgrade interactive elements to higher-quality components and add color palette customization"
**Depends on**: `003-ui-modernization` (complete — modern CSS framework, unified color system, component library installed)

## Overview

Argos currently works well and the layout is good, but the interactive elements (buttons, tables, inputs, badges) use hand-crafted CSS that looks dated compared to modern UI standards. This spec modernizes the visual quality of those elements by upgrading them to polished, accessible, production-grade components. It also adds operator-facing color customization so users can personalize their console.

**What changes**: Buttons, tables, text inputs, and status badges get a visual upgrade — smoother hover effects, better focus indicators, consistent styling. Operators gain the ability to pick a color scheme and toggle dark/light mode.

**Scope includes**: The main dashboard (`/dashboard`) and all its sub-components. The GSM Evil page (`/gsm-evil`) is deferred to spec 006, which will handle both its component modernization and decomposition into proper sub-components. Third-party native applications rendered via iframe (OpenWebRx, Kismet) are excluded from component upgrades but will inherit theme colors where CSS variables are accessible.

**What stays the same**: The entire layout. Every panel, map, spectrum display, icon rail, and terminal stays exactly where it is. No features are added or removed. No functionality changes. Same building, modernized fixtures and fresh paint.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Modernized Buttons (Priority: P1)

As an operator using the Argos dashboard, I want the buttons throughout the app (Start, Stop, Open, Back, Add) to look and feel modern — with smooth hover effects, clear focus indicators, and consistent sizing — so the interface feels professional and polished.

**Why this priority**: Buttons are the most frequently used interactive elements in the app. They're the first thing operators interact with on every panel. Upgrading them delivers the most visible quality improvement across the entire interface.

**Independent Test**: Open the Tools panel. The Start, Stop, and Open buttons look visually sharper — consistent border radius, smooth color transitions on hover, clear visual feedback on click. Open the Devices panel. The "Add" button matches the same quality standard. Navigate to a tool view. The "Back" button has the same polish. All buttons still do exactly what they did before.

**Acceptance Scenarios**:

1. **Given** the "Open" buttons on tool cards, **When** upgraded to modern components, **Then** they render with consistent outline styling, smooth hover transitions, and proper focus rings.
2. **Given** the "Stop" button on tool cards, **When** upgraded, **Then** it renders with clear destructive (red) styling so operators immediately recognize it as a dangerous action.
3. **Given** the "Start" button on tool cards, **When** upgraded, **Then** it renders with a distinct visual style that communicates a positive/go action.
4. **Given** the "Back" button in tool views, **When** upgraded, **Then** it renders with subtle ghost styling that doesn't compete with primary actions.
5. **Given** the "Add" button in the Devices panel, **When** upgraded, **Then** it renders with secondary styling consistent with the rest of the app.
6. **Given** all dashboard buttons are upgraded, **When** viewed across the app, **Then** every button shares the same visual language — consistent sizing, spacing, border radius, and transition behavior.

---

### User Story 2 - Modernized Table, Inputs, and Badges (Priority: P2)

As an operator using the Devices panel, I want the device list table, search/filter inputs, and status badges to look modern and consistent with the upgraded buttons, so the entire interface has a unified, polished feel.

**Why this priority**: These elements appear together in the Devices panel. After buttons are upgraded, mismatched table/input/badge styling would stand out. Upgrading them completes the visual consistency.

**Independent Test**: Open the Devices panel. The device list table has clean row spacing, subtle hover highlights, and consistent header styling. The search input has a sharp focus ring and smooth transitions. Status badges use consistent color variants. Everything looks like it belongs together.

**Acceptance Scenarios**:

1. **Given** the device list table in DevicesPanel, **When** upgraded, **Then** it renders with clean row separation, consistent text alignment, and subtle hover highlights on rows.
2. **Given** the search and filter inputs in DevicesPanel, **When** upgraded, **Then** they render with consistent border styling, clear focus indicators, and smooth transitions.
3. **Given** the status badge in tool views (e.g., "Connected"), **When** upgraded, **Then** it renders with a clean pill shape and appropriate color variant (green for success, red for error, etc.).
4. **Given** all dashboard elements are upgraded, **When** the old hand-crafted CSS definitions for these elements are removed, **Then** the app's CSS footprint is reduced and no visual regressions occur.

---

### User Story 3 - Color Palette Selector (Priority: P2)

As an operator using the Argos dashboard, I want to open Settings, pick a color scheme from a dropdown (Default, Blue, Green, Orange, Red, Rose, Violet, or Yellow), and have the entire app's colors change instantly — so I can personalize my console or visually differentiate my session from other operators sharing the device.

**Why this priority**: The unified color system from 003 makes this straightforward — every color in the app flows through ~40 named color tokens. Changing those values changes everything at once. This is the most visible personalization feature an operator can use.

**Independent Test**: Click the gear icon on the icon rail. The Settings panel opens. A "Theme" section shows a dropdown with 8 color options. Select "Green." All panels, borders, accent colors, and highlights shift to green tones. Select "Default." Everything shifts to neutral gray. No panel moves, no button breaks, no feature stops working. Just the colors change.

**Acceptance Scenarios**:

1. **Given** the Settings panel currently shows "Settings options coming soon", **When** the theme section is added, **Then** the panel displays a "Theme" section with a labeled color palette dropdown.
2. **Given** 8 available palettes (Default, Blue, Green, Orange, Red, Rose, Violet, Yellow — sourced from shadcn-svelte themes), **When** the operator selects a palette, **Then** all accent/decorative colors across the entire UI update instantly without page reload.
3. **Given** each palette defines colors for backgrounds, text, borders, accents, charts, signal indicators, and feature categories, **When** a palette is applied, **Then** everything — panels, buttons, status indicators, map markers, charts — renders with harmonized colors from that palette.
4. **Given** the palette only changes color values, **When** any palette is selected, **Then** zero layout changes occur — no panels resize, no buttons move, no text reflows.

---

### User Story 4 - Theme Persistence (Priority: P2)

As an operator, I want my selected color scheme to be remembered when I refresh the page or reopen the browser, so I don't have to re-select it every time.

**Why this priority**: Co-equal with the palette selector because a theme that resets on every page load feels broken. The operator should set it once and forget about it.

**Independent Test**: Select "Orange." Close the browser tab. Reopen the app. The Orange theme is immediately active — no flash of Blue, no flicker, no delay. It loads directly into the saved theme.

**Acceptance Scenarios**:

1. **Given** the operator selects a palette, **When** they refresh the page, **Then** the selected palette persists.
2. **Given** a saved theme preference, **When** the page loads, **Then** the theme is applied before the screen renders — no flash of the default theme.
3. **Given** the browser's local storage is unavailable (private browsing), **When** the page loads, **Then** the app falls back gracefully to Blue/Dark with no errors.

---

### User Story 5 - Dark/Light Mode Toggle (Priority: P3)

As an operator, I want a toggle in the Settings panel to switch between Dark and Light mode so I can use the console in bright ambient conditions (e.g., daylight field operations) without eye strain.

**Why this priority**: Lower than palette selection because Argos is primarily used in dark tactical environments. Light mode is useful for daylight operations but is not the primary use case.

**Independent Test**: Open Settings. Toggle the Dark/Light switch. Backgrounds go white, text goes dark, all panels and components remain functional. Toggle back — the dark aesthetic returns. The selected palette's colors adapt to both modes (e.g., Green palette in Light mode uses green accents on white backgrounds).

**Acceptance Scenarios**:

1. **Given** a "Mode" toggle (Dark / Light) in the Settings panel, **When** the operator toggles to Light mode, **Then** backgrounds become light, text becomes dark, and the interface remains fully functional.
2. **Given** Light mode is active, **When** toggled back to Dark, **Then** the dark theme returns.
3. **Given** the mode preference, **When** the page is refreshed, **Then** the mode persists alongside the palette selection.
4. **Given** each palette has both dark and light color sets, **When** the operator switches modes, **Then** the active palette's corresponding mode colors are applied.

---

### User Story 6 - Semantic Colors Toggle (Priority: P3)

As an operator, I want a "Semantic Colors" toggle in the Settings panel so I can choose between fixed MIL-STD/NATO-standard operational colors (red=danger, green=good, yellow=warning) or full palette harmonization where all colors — including signal strength and status indicators — adapt to my selected accent palette.

**Why this priority**: Co-equal with Dark/Light mode. The semantic toggle is a safety-vs-aesthetics tradeoff that the operator should control. Default ON preserves operational familiarity; turning it OFF lets power users fully customize their visual experience.

**Independent Test**: Open Settings. The "Semantic Colors" toggle is ON by default. RSSI signal strength shows universal red/yellow/green. Status indicators show green=connected, red=error. Now toggle Semantic Colors OFF. With "Rose" palette active, signal strength indicators and status colors shift to rose-tinted variants. Toggle back ON — operational colors return to universal red/yellow/green regardless of palette.

**Acceptance Scenarios**:

1. **Given** the Semantic Colors toggle is ON (default), **When** any palette is selected, **Then** RSSI signal strength colors (red/yellow/green), status indicators (connected/error), and destructive action buttons retain their universal operational colors.
2. **Given** the Semantic Colors toggle is OFF, **When** a palette is selected, **Then** all colors including signal strength, status indicators, and action buttons harmonize with the accent palette.
3. **Given** the Semantic Colors preference, **When** the page is refreshed, **Then** the toggle state persists alongside palette and mode selections.
4. **Given** the operator toggles Semantic Colors, **When** the map and spectrum displays are visible, **Then** those displays update their indicator colors accordingly.

---

### User Story 7 - Map and Spectrum Theme Consistency (Priority: P3)

As an operator viewing the tactical map or spectrum display while changing themes, I want the map markers, signal indicators, and spectrum colors to update to match the new color scheme so the entire display is visually consistent.

**Why this priority**: The map and spectrum use rendered graphics (Canvas/Leaflet) that don't automatically pick up color changes the way regular UI elements do. Without explicit handling, the dashboard would show mixed old/new colors after a theme switch.

**Independent Test**: With the tactical map visible, switch from Blue to Red palette. Map markers and signal strength indicators update their colors. No stale Blue-colored markers remain on a Red-themed map.

**Acceptance Scenarios**:

1. **Given** the tactical map displays colored markers, **When** the color palette changes, **Then** the map markers update to match the new palette within one render cycle.
2. **Given** the spectrum display renders with color-coded signal strength, **When** a new palette is applied, **Then** spectrum colors reflect the new palette.
3. **Given** theme changes only affect colors, **When** the map/spectrum re-renders with updated colors, **Then** no data is lost, no connections are interrupted, and no scan state is reset.

---

### Edge Cases

- What happens if the operator selects Light mode but some panels have hardcoded dark styling? Any panel using the unified color system will adapt automatically. Panels with hardcoded dark colors in their own style blocks will be identified and corrected during implementation.
- What happens if the operator changes theme mid-scan (HackRF sweep or Kismet running)? Only color values change — no scan state, WebSocket connections, or data flows are affected.
- What happens if local storage is unavailable (private browsing)? The app falls back to the Default/Dark/Semantic-ON theme with no errors.
- What happens if a component upgrade changes the visual spacing or sizing? Each upgrade is verified independently — before/after comparison confirms identical layout. Interactive states (hover, focus, disabled) are tested for each upgraded element.
- What happens if the operator selects the "Red" palette with Semantic Colors OFF? Destructive buttons will blend with the accent color. This is by design — the operator has explicitly opted out of semantic color safety and accepts the visual tradeoff.

## Clarifications

### Session 2026-02-15

- Q: Should operational colors (RSSI signal strength, status indicators, destructive actions) remain fixed across palettes or adapt? → A: Toggle — Settings panel includes a "Semantic Colors" toggle (default ON). ON = fixed MIL-STD/NATO operational colors. OFF = all colors harmonize with the selected accent palette. Operator's choice.
- Q: What are the exact 8 palette names? → A: Sourced from shadcn-svelte themes page: Default, Blue, Green, Orange, Red, Rose, Violet, Yellow (not "Zinc").
- Q: Is the GSM Evil page in scope for component upgrades? → A: Deferred to spec 006. GSM Evil is a 2200+ line monolithic page that needs both component modernization AND decomposition into sub-components — too much risk to bundle with dashboard upgrades.
- Q: Should the GSM Evil page be decomposed into sub-components? → A: Yes, in spec 006. The page needs professional decomposition into sub-components alongside its visual modernization.
- Q: What FOUC prevention mechanism should be used? → A: Blocking inline `<script>` in `app.html` that reads localStorage and sets theme attributes on `<html>` before first paint (standard shadcn approach).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST upgrade all hand-crafted buttons on the dashboard to modern, polished button components with consistent hover, focus, and disabled states.
- **FR-002**: System MUST upgrade the device list table on the dashboard to a modern table component with clean row separation and consistent styling.
- **FR-003**: System MUST upgrade text inputs on the dashboard to modern input components with clear focus indicators.
- **FR-004**: System MUST upgrade status badges on the dashboard to modern badge components with proper color variants.
- **FR-005**: System MUST remove the old hand-crafted CSS class definitions for each upgraded element family after it is verified. GSM Evil page modernization is deferred to spec 006.
- **FR-006**: System MUST display a "Theme" section in the Settings panel with a color palette dropdown offering 8 options.
- **FR-007**: System MUST apply the selected palette instantly by updating all color values — no page reload required.
- **FR-008**: System MUST persist the selected palette and mode preference so it survives page refreshes.
- **FR-009**: System MUST apply the saved theme before the screen renders via a blocking inline `<script>` in `app.html` that reads localStorage and sets theme attributes on `<html>` before first paint — preventing any flash of the default theme.
- **FR-010**: System MUST provide a Dark/Light mode toggle.
- **FR-011**: System MUST define both dark and light mode color values for each of the 8 palettes.
- **FR-012**: System MUST NOT cause any layout changes, feature disruption, or functionality loss when switching palettes or modes.
- **FR-013**: System MUST provide a "Semantic Colors" toggle (default ON) that preserves universal operational colors (RSSI red/yellow/green, status green/red, destructive action red) regardless of palette.
- **FR-014**: When the Semantic Colors toggle is OFF, system MUST harmonize all colors — including signal strength, status indicators, chart colors, and feature category colors — with the selected palette.
- **FR-015**: System MUST persist the Semantic Colors toggle state alongside palette and mode preferences.
- **FR-016**: System MUST notify the map and spectrum displays when colors change (palette, mode, or semantic toggle) so they re-render with updated colors.
- **FR-017**: System MUST gracefully handle unavailable local storage by falling back to the Default/Dark/Semantic-ON theme (neutral gray).
- **FR-018**: System MUST pass all quality checks (type safety, code quality, unit tests, build) after each story is completed.

### Key Entities

- **Theme Palette**: A named color scheme sourced from shadcn-svelte themes (Default, Blue, Green, Orange, Red, Rose, Violet, Yellow) that defines color values for all ~40+ visual tokens in the app — backgrounds, text, borders, accents, charts, signal indicators, and feature categories. Each palette has both dark and light mode versions.
- **Theme Store**: The system that manages which palette, mode, and semantic colors toggle the operator has selected, saves all three for next time, and applies the colors to the screen.
- **Semantic Colors**: A toggle (default ON) that controls whether operational colors (RSSI signal strength red/yellow/green, status indicators, destructive actions) use fixed universal values or harmonize with the selected accent palette.
- **Theme Change Notification**: A mechanism that tells the map and spectrum displays to re-render when colors change, since they use rendered graphics that don't automatically pick up color changes.
- **FOUC Prevention**: A blocking inline `<script>` in `app.html` that synchronously reads localStorage and sets `data-theme` and dark/light class attributes on the `<html>` element before the browser paints any content. This runs before SvelteKit hydration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All buttons across the app render with consistent, modern styling — uniform sizing, smooth hover transitions, clear focus indicators, and proper disabled states.
- **SC-002**: The device list table, text inputs, and status badges render with modern styling consistent with the upgraded buttons.
- **SC-003**: The old hand-crafted CSS definitions for buttons, tables, inputs, and badges are removed — the app's CSS footprint is reduced by at least 100 lines.
- **SC-004**: Settings panel displays a functional "Theme" section with a color palette dropdown, dark/light mode toggle, and semantic colors toggle.
- **SC-005**: Selecting any of the 8 palettes (from shadcn-svelte themes) updates all UI colors instantly without layout changes or feature disruption.
- **SC-006**: Selected theme (palette + mode + semantic toggle) persists across page refreshes with no flash of the default theme.
- **SC-007**: Dark/Light mode toggle correctly switches color sets for the active palette.
- **SC-008**: Semantic Colors toggle ON: RSSI, status, and destructive colors remain fixed. Toggle OFF: all colors harmonize with the palette.
- **SC-009**: Map markers, signal indicators, and chart colors update to match the selected palette (respecting semantic toggle state).
- **SC-010**: All quality checks pass (type safety, code quality, unit tests, build) after all changes.
- **SC-011**: Zero browser console errors on any route with any palette selected.

## Assumptions

- The 003 spec is fully complete: modern CSS framework operational, color system unified, component library installed and proven, color bridge for map/spectrum operational.
- Pre-built color palettes in the exact format Argos uses are available from the component library's themes page. Argos-specific colors (signal strength, feature categories) must be manually harmonized for each palette.
- The operator is not a software developer. The Settings panel theme section must be dead simple — one dropdown to pick a color, one toggle for dark/light, one toggle for semantic colors. No technical jargon.
- The existing Button component (already installed) can be used directly for button upgrades. Additional components (Table, Input, Badge, Select, Switch) will be installed as needed.
- Each element upgrade is independent — a failure in one doesn't block others.

## Constraints

- **Memory**: Node.js heap capped at 1024MB. Theme data must be lightweight.
- **Hardware**: Target is Raspberry Pi 5 (8GB RAM, ARM64). All dependencies must work on ARM.
- **No Layout Changes**: Every panel, map, spectrum display, icon rail, and terminal stays exactly where it is across all palettes and modes.
- **No Functionality Changes**: All scanning, monitoring, data capture, and communication features remain untouched.
- **Incremental Delivery**: Component upgrades (US1-US2) can ship independently from color customization (US3-US7), and vice versa.
- **Step-by-step Implementation**: Each change is implemented, verified, and committed individually before moving to the next. No multi-file changes without intermediate verification (lesson from previous rollback).
