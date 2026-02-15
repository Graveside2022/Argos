# Feature Specification: GSM Evil Page — UI Modernization & Component Decomposition

**Feature Branch**: `006-gsm-evil-modernization`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Modernize and professionally decompose the GSM Evil page — upgrade all interactive elements to match the dashboard's shadcn component standard and break the 2200-line monolithic file into proper sub-components"
**Depends on**: `004-ui-implementation` (dashboard component upgrades and theme system must be complete first, establishing the visual standard GSM Evil will match)

## Overview

The GSM Evil page (`/gsm-evil`) is a 2205-line monolithic Svelte file with 1108 lines of custom CSS, its own button/badge/table styling system completely independent from the dashboard. While functional, it looks and feels disconnected from the rest of Argos. This spec does two things:

1. **Visual modernization** — Replace all hand-crafted buttons, tables, badges, and status indicators with the same shadcn component library used by the dashboard (established in spec 004), ensuring the GSM Evil page is visually indistinguishable in quality from the rest of the app.

2. **Professional decomposition** — Break the monolithic `+page.svelte` into well-scoped sub-components with clear responsibilities, making the codebase maintainable, testable, and professionally structured.

**What changes**: Every interactive element gets upgraded to match the dashboard standard. The monolithic file becomes a component tree. Custom CSS is replaced by component-scoped styles and utility classes.

**What stays the same**: The entire layout. Every panel, table, console, and button stays exactly where it is. All GSM scanning, IMSI capture, tower lookup, and frame display functionality remains identical. Same page, professional internals and modern skin.

**Scope**: Only the GSM Evil page (`/gsm-evil`). The dashboard is handled by spec 004. Third-party native apps (OpenWebRx, Kismet) are excluded.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Modernized Buttons (Priority: P1)

As an operator using the GSM Evil page, I want all buttons (Start Scan/Stop Scan, Back to Console, Select frequency, sort column headers) to match the same modern component standard as the dashboard buttons — with smooth hover effects, clear focus indicators, and consistent sizing.

**Why this priority**: Buttons are the primary interaction mechanism on this page. The Start/Stop scan button is safety-critical (controls hardware). Upgrading buttons delivers the most visible quality improvement and aligns the page with the dashboard standard established in spec 004.

**Independent Test**: Open the GSM Evil page. The "Back to Console" link renders as a ghost-style button matching the dashboard's back button. The "Start Scan" button renders with a distinct primary/go style. When scanning is active, it becomes "Stop Scan" with destructive/red styling. Column sort headers in the tower table have clean hover states. "Select" buttons in the scan results table have consistent outline styling. All buttons match the dashboard's visual language exactly.

**Acceptance Scenarios**:

1. **Given** the "Back to Console" link, **When** upgraded, **Then** it renders as a ghost-variant button matching the dashboard's "Back" button styling.
2. **Given** the "Start Scan" button, **When** upgraded, **Then** it renders with primary/go styling matching the dashboard's "Start" buttons.
3. **Given** the "Stop Scan" button (active scan state), **When** upgraded, **Then** it renders with destructive (red) styling matching the dashboard's "Stop" buttons.
4. **Given** the 7 sortable column header buttons in the tower table, **When** upgraded, **Then** they render with subtle ghost styling, sort direction indicators, and smooth hover transitions.
5. **Given** the "Select" buttons in the scan results table, **When** upgraded, **Then** they render with outline styling consistent with the dashboard.
6. **Given** all GSM Evil page buttons are upgraded, **When** compared side-by-side with dashboard buttons, **Then** they are visually indistinguishable in quality — same sizing, spacing, border radius, and transition behavior.

---

### User Story 2 - Modernized Tables and Data Displays (Priority: P1)

As an operator viewing scan results or captured IMSI data, I want the data tables on the GSM Evil page to match the dashboard's table styling — clean row separation, consistent headers, subtle hover highlights — so the page looks professional.

**Why this priority**: Co-equal with buttons. The scan results table and IMSI tower table are the primary data displays on this page. They occupy the majority of the viewport and use entirely custom CSS that looks dated compared to modern standards.

**Independent Test**: Start a scan. The frequency scan results table has clean row separation, consistent header styling, and subtle hover highlights. Trigger IMSI capture. The tower table has the same quality — sortable headers, clean expansion behavior, and consistent typography. Both tables match the visual standard of the dashboard's DevicesPanel table.

**Acceptance Scenarios**:

1. **Given** the frequency scan results table, **When** upgraded, **Then** it renders with clean row separation, consistent text alignment, and subtle hover highlights matching the dashboard table standard.
2. **Given** the IMSI tower table, **When** upgraded, **Then** it renders with clean headers, consistent row styling, and smooth expansion behavior for device lists.
3. **Given** the expanded device list within a tower row, **When** displayed, **Then** it renders with clean sub-row styling, consistent with the parent table's visual language.
4. **Given** both tables are upgraded, **When** the old custom CSS table definitions are removed, **Then** no visual regressions occur.

---

### User Story 3 - Modernized Badges and Status Indicators (Priority: P2)

As an operator monitoring GSM activity, I want status badges (signal quality, channel type, activity indicators, IMSI capture status) to match the dashboard's badge components — clean pill shapes, appropriate color variants, consistent sizing.

**Why this priority**: Badges and indicators are secondary to buttons and tables but critical for operational awareness. The current quality badges (Excellent/Strong/Weak), channel type badges (CONTROL/unknown), and activity indicators use hand-crafted CSS. Aligning them with the dashboard completes the visual consistency.

**Independent Test**: View scan results. Signal quality badges (Excellent, Strong, Moderate, Weak) render as clean pills with appropriate color variants. Channel type badges (CONTROL, unknown) use distinct colors. The "IMSI Capture Active" indicator uses the same status badge styling as dashboard connection indicators. Activity checkmarks and X marks are clean and consistent.

**Acceptance Scenarios**:

1. **Given** signal quality badges (Excellent/Very Strong/Strong/Good/Moderate/Weak), **When** upgraded, **Then** they render as modern badge components with color variants mapping to signal strength (green for excellent, yellow for moderate, red for weak).
2. **Given** channel type badges (CONTROL/unknown), **When** upgraded, **Then** they render as badge components with distinct color variants.
3. **Given** the "IMSI Capture Active" status indicator, **When** upgraded, **Then** it renders with the same badge styling as dashboard status indicators.
4. **Given** activity indicators (checkmark/X), **When** upgraded, **Then** they use consistent iconography and coloring matching the dashboard standard.
5. **Given** the scan progress status badge ("SCANNING..."/"COMPLETE"), **When** upgraded, **Then** it renders as a modern badge with appropriate variant.

---

### User Story 4 - Component Decomposition (Priority: P2)

As a developer maintaining the Argos codebase, I want the GSM Evil page decomposed from a 2205-line monolithic file into well-scoped sub-components with clear responsibilities, so the code is maintainable, testable, and professionally structured.

**Why this priority**: The monolithic structure makes the page difficult to maintain, test, and reason about. Decomposition enables independent development and testing of each section. This is a code-quality investment that pays dividends for every future change to this page.

**Independent Test**: Open the GSM Evil page source. Instead of a single 2205-line file, the page component imports and composes sub-components. Each sub-component has a single clear responsibility. The page still renders and functions identically — all scanning, IMSI capture, tower display, and frame output work exactly as before.

**Acceptance Scenarios**:

1. **Given** the monolithic `+page.svelte`, **When** decomposed, **Then** the page component becomes an orchestrator that imports and composes sub-components, with its own script section under 150 lines.
2. **Given** the header section (logo, title, status, Start/Stop button), **When** extracted, **Then** it becomes a `GsmHeader` component with props for scan state and event callbacks for start/stop actions.
3. **Given** the IMSI tower table, **When** extracted, **Then** it becomes a `TowerTable` component that receives tower data as props and manages its own sort/expansion state internally.
4. **Given** the scan results table, **When** extracted, **Then** it becomes a `ScanResultsTable` component that receives results as props and emits frequency selection events.
5. **Given** the console displays (scan progress + live frames), **When** extracted, **Then** they become `ScanConsole` and `LiveFramesConsole` components that receive their respective data streams as props.
6. **Given** the decomposed page, **When** all sub-components are composed, **Then** the page renders and functions identically to the monolithic version — zero behavioral regressions.

---

### User Story 5 - CSS Reduction (Priority: P2)

As a developer, I want the 1108 lines of custom CSS in the GSM Evil page replaced by component-scoped styles and utility classes, reducing the styling footprint and eliminating the page's independent design system.

**Why this priority**: The custom CSS is the root cause of the page looking different from the dashboard. Replacing it with component styles and Tailwind utilities ensures the page automatically inherits theme changes from spec 004 (palettes, dark/light mode, semantic colors toggle).

**Independent Test**: After all upgrades, the GSM Evil page's total custom CSS is under 200 lines (down from 1108). The page correctly inherits theme palette changes, dark/light mode, and semantic colors toggle from the Settings panel. No standalone CSS class definitions duplicate what the component library provides.

**Acceptance Scenarios**:

1. **Given** the 1108 lines of custom CSS, **When** buttons, tables, badges are replaced by component library equivalents, **Then** at least 800 lines of custom CSS are eliminated.
2. **Given** the remaining custom CSS, **When** reviewed, **Then** it contains only layout-specific styles that components don't cover (e.g., console monospace formatting, page-level grid).
3. **Given** the theme system from spec 004, **When** the operator changes palette or mode, **Then** the GSM Evil page colors update correctly — no stale hardcoded colors remain.
4. **Given** the CSS reduction, **When** compared to the original, **Then** no visual regressions occur — layout, spacing, and visual hierarchy remain identical.

---

### User Story 6 - Theme Integration (Priority: P3)

As an operator who has set a custom color palette and dark/light mode in Settings, I want the GSM Evil page to respect those choices — so navigating from the dashboard to the GSM Evil page feels seamless.

**Why this priority**: Depends on spec 004's theme system being complete. Once it is, the GSM Evil page should inherit theme preferences automatically through the shared CSS custom properties and component library.

**Independent Test**: Set the theme to "Green" palette in dark mode on the dashboard. Navigate to the GSM Evil page. All colors use green accents on dark backgrounds. Switch to light mode. The GSM Evil page backgrounds become light, text becomes dark. Toggle semantic colors OFF. Signal quality badges adapt to the accent palette. Everything matches the dashboard seamlessly.

**Acceptance Scenarios**:

1. **Given** the operator has set a palette in Settings, **When** navigating to the GSM Evil page, **Then** all components render with the selected palette colors.
2. **Given** dark/light mode is toggled, **When** viewing the GSM Evil page, **Then** the page correctly switches between dark and light color sets.
3. **Given** the semantic colors toggle is OFF, **When** viewing signal quality badges on GSM Evil, **Then** they harmonize with the accent palette instead of using fixed operational colors.
4. **Given** theme changes made while on the GSM Evil page, **When** colors update, **Then** no scan state, IMSI data, or frame display is disrupted.

---

### Edge Cases

- What happens if the component decomposition introduces a reactivity bug? Each sub-component is tested independently and in composition. The existing `gsmEvilStore` remains the single source of truth for scan/IMSI state, minimizing reactivity changes.
- What happens if a scan is active during the upgrade (hot reload in dev)? Theme/style changes don't affect scan state. WebSocket connections, scan progress, and IMSI capture continue uninterrupted.
- What happens to the tower row expansion state during decomposition? Expansion state (`expandedTowers` Set) is managed by `TowerTable` internally, preserving behavior.
- What happens to the 3 CSS animations (spin, blink, pulse)? Animations are preserved in the relevant sub-component's scoped styles or moved to a shared utility file.
- What if some custom CSS selectors are used by the `gsmEvilStore` or utility functions? CSS classes are presentation-only in this page — no JavaScript references to class names. Safe to replace.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST upgrade all buttons on the GSM Evil page (Start/Stop Scan, Back to Console, Select frequency, 7 sort column headers) to the same modern button components used by the dashboard.
- **FR-002**: System MUST upgrade the frequency scan results table to a modern table component matching the dashboard's table standard.
- **FR-003**: System MUST upgrade the IMSI tower table (including expandable device lists) to a modern table component with consistent header, row, and expansion styling.
- **FR-004**: System MUST upgrade all status badges (signal quality, channel type, activity indicators, IMSI capture status, scan progress) to modern badge components with appropriate color variants.
- **FR-005**: System MUST decompose `+page.svelte` into sub-components: at minimum `GsmHeader`, `TowerTable`, `ScanResultsTable`, `ScanConsole`, `LiveFramesConsole`, and `ErrorDialog`.
- **FR-006**: System MUST keep the parent `+page.svelte` script section under 150 lines after decomposition.
- **FR-007**: System MUST reduce the custom CSS from 1108 lines to under 200 lines by using component library equivalents and utility classes.
- **FR-008**: System MUST preserve all existing functionality: GSM scanning, IMSI capture, tower grouping/sorting, device expansion, frame display, scan progress console, error dialogs.
- **FR-009**: System MUST ensure the GSM Evil page inherits theme palette, dark/light mode, and semantic colors toggle from the spec 004 theme system.
- **FR-010**: System MUST remove all old hand-crafted CSS class definitions that are replaced by component library equivalents.
- **FR-011**: System MUST NOT cause any layout changes — every element stays in the same position.
- **FR-012**: System MUST pass all quality checks (type safety, code quality, unit tests, build) after each story is completed.

### Key Entities

- **GSM Evil Page Component Tree**: The decomposed structure where `+page.svelte` orchestrates sub-components (`GsmHeader`, `TowerTable`, `ScanResultsTable`, `ScanConsole`, `LiveFramesConsole`, `ErrorDialog`), each with clear props interfaces and event callbacks.
- **gsmEvilStore**: The existing Svelte store that remains the single source of truth for scan state, IMSI data, tower locations, and scan progress. Sub-components receive data from this store via props passed down from the parent page.
- **Tower Sort/Expansion State**: UI-only state (sort column, sort direction, expanded towers) managed by `TowerTable` internally — not persisted, not in the global store.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All buttons on the GSM Evil page are visually indistinguishable in quality from dashboard buttons — same component library, same variants, same transitions.
- **SC-002**: Both data tables (scan results, IMSI towers) match the dashboard's table styling standard.
- **SC-003**: All badges and status indicators use the same badge component as the dashboard.
- **SC-004**: The monolithic `+page.svelte` is decomposed into at least 6 sub-components, with the parent page script under 150 lines.
- **SC-005**: Custom CSS reduced from 1108 lines to under 200 lines.
- **SC-006**: The GSM Evil page correctly inherits theme palette, dark/light mode, and semantic colors toggle.
- **SC-007**: Zero behavioral regressions — all scanning, IMSI capture, tower display, frame output, and error handling work identically.
- **SC-008**: All quality checks pass (type safety, code quality, unit tests, build) after all changes.
- **SC-009**: Zero browser console errors on the GSM Evil page with any palette/mode combination.

## Assumptions

- Spec 004 is complete before implementation begins — the theme system, component library standard, and dashboard component upgrades are established and can be directly replicated.
- The existing `gsmEvilStore` is well-structured and does not need refactoring — sub-components receive store data via props.
- The shadcn-svelte Table, Badge, and Button components support all the variants needed (sortable headers, color-coded quality badges, destructive/primary/ghost button styles).
- The 3 CSS animations (spin, blink, pulse) are simple enough to keep in component-scoped styles.
- The carrier-mappings, gsm-tower-utils, and gsm types imports remain unchanged.

## Constraints

- **Memory**: Node.js heap capped at 1024MB. Decomposition must not increase memory usage.
- **Hardware**: Target is Raspberry Pi 5 (8GB RAM, ARM64). All dependencies must work on ARM.
- **No Layout Changes**: Every element stays exactly where it is. Decomposition and styling changes are invisible to the operator.
- **No Functionality Changes**: All GSM scanning, IMSI capture, tower lookup, frame display, and error handling remain identical.
- **Store Preservation**: The `gsmEvilStore` remains unchanged. Sub-components consume it via props, not direct store imports (except the parent page).
- **Step-by-step Implementation**: Each change is implemented, verified, and committed individually. Decomposition and visual upgrades can proceed in any order but each step must pass verification before the next begins.
- **Dependency on spec 004**: Theme integration (US6) cannot be tested until spec 004's theme system is complete. Component upgrades (US1-US3) can proceed independently using the same component library.
