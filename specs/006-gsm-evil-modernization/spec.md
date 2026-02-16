# Feature Specification: GSM Evil Page — UI Modernization & Component Decomposition

**Feature Branch**: `006-gsm-evil-modernization`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Modernize and professionally decompose the GSM Evil page — upgrade all interactive elements to match the dashboard's shadcn component standard and break the 2200-line monolithic file into proper sub-components"
**Depends on**: `003-ui-modernization` (Complete — dashboard component upgrades and theme system are established, providing the visual standard GSM Evil will match)

## Clarifications

### Session 2026-02-16

- Q: Where should extracted GSM Evil sub-components live? → A: In a dedicated GSM Evil component directory, mirroring the dashboard component organization pattern.
- Q: Should the error dialog be a GSM-specific wrapper or standalone? → A: Thin wrapper around the shared alert dialog component — GSM-specific content/logic only, delegates presentation to the shared primitive.

## Overview

The GSM Evil page (`/gsm-evil`) is a 2204-line monolithic file with 1107 lines of custom CSS, its own button/badge/table styling system completely independent from the dashboard. While functional, it looks and feels disconnected from the rest of Argos. This spec does two things:

1. **Visual modernization** — Replace all hand-crafted buttons, tables, badges, and status indicators with the same component library used by the dashboard (established in spec 003), ensuring the GSM Evil page is visually indistinguishable in quality from the rest of the app.

2. **Professional decomposition** — Break the monolithic page into well-scoped sub-components with clear responsibilities, making the codebase maintainable, testable, and professionally structured.

**What changes**: Every interactive element gets upgraded to match the dashboard standard. The monolithic file becomes a component tree. Custom CSS is replaced by component-scoped styles and utility classes.

**What stays the same**: The entire layout. Every panel, table, console, and button stays exactly where it is. All GSM scanning, IMSI capture, tower lookup, and frame display functionality remains identical. Same page, professional internals and modern skin.

**Scope**: Only the GSM Evil page (`/gsm-evil`). The dashboard is handled by spec 003. Third-party native apps (OpenWebRx, Kismet) are excluded.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Modernized Buttons (Priority: P1)

As an operator using the GSM Evil page, I want all buttons (Start Scan/Stop Scan, Back to Console, Select frequency, sort column headers) to match the same modern component standard as the dashboard buttons — with smooth hover effects, clear focus indicators, and consistent sizing.

**Why this priority**: Buttons are the primary interaction mechanism on this page. The Start/Stop scan button is safety-critical (controls hardware). Upgrading buttons delivers the most visible quality improvement and aligns the page with the dashboard standard established in spec 003.

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

As a developer maintaining the Argos codebase, I want the GSM Evil page decomposed from a 2204-line monolithic file into well-scoped sub-components with clear responsibilities, so the code is maintainable, testable, and professionally structured.

**Why this priority**: The monolithic structure makes the page difficult to maintain, test, and reason about. Decomposition enables independent development and testing of each section. This is a code-quality investment that pays dividends for every future change to this page.

**Independent Test**: Open the GSM Evil page source. Instead of a single 2204-line file, the page component imports and composes sub-components. Each sub-component has a single clear responsibility. The page still renders and functions identically — all scanning, IMSI capture, tower display, and frame output work exactly as before.

**Acceptance Scenarios**:

1. **Given** the monolithic page file, **When** decomposed, **Then** the page component becomes an orchestrator that imports and composes sub-components, with its own logic section under 150 lines.
2. **Given** the header section (logo, title, status, Start/Stop button), **When** extracted, **Then** it becomes an independent header component with inputs for scan state and event callbacks for start/stop actions.
3. **Given** the IMSI tower table, **When** extracted, **Then** it becomes an independent tower table component that receives tower data as inputs and manages its own sort/expansion state internally.
4. **Given** the scan results table, **When** extracted, **Then** it becomes an independent scan results component that receives results as inputs and emits frequency selection events.
5. **Given** the console displays (scan progress + live frames), **When** extracted, **Then** they become independent console components that receive their respective data streams as inputs.
6. **Given** the decomposed page, **When** all sub-components are composed, **Then** the page renders and functions identically to the monolithic version — zero behavioral regressions.

---

### User Story 5 - CSS Reduction (Priority: P2)

As a developer, I want the 1107 lines of custom CSS in the GSM Evil page replaced by component-scoped styles and utility classes, reducing the styling footprint and eliminating the page's independent design system.

**Why this priority**: The custom CSS is the root cause of the page looking different from the dashboard. Replacing it with component styles and Tailwind utilities ensures the page automatically inherits theme palette changes from the spec 003 theme system.

**Independent Test**: After all upgrades, the GSM Evil page's total custom CSS is under 200 lines (down from 1107). The page correctly inherits theme palette changes from the Settings panel. No standalone CSS class definitions duplicate what the component library provides.

**Acceptance Scenarios**:

1. **Given** the 1107 lines of custom CSS, **When** buttons, tables, badges are replaced by component library equivalents, **Then** at least 800 lines of custom CSS are eliminated.
2. **Given** the remaining custom CSS, **When** reviewed, **Then** it contains only layout-specific styles that components don't cover (e.g., console monospace formatting, page-level grid).
3. **Given** the theme system from spec 003, **When** the operator changes palette, **Then** the GSM Evil page colors update correctly — no stale hardcoded colors remain.
4. **Given** the CSS reduction, **When** compared to the original, **Then** no visual regressions occur — layout, spacing, and visual hierarchy remain identical.

---

### User Story 6 - Theme Palette Integration (Priority: P3)

As an operator who has set a custom color palette in Settings, I want the GSM Evil page to respect that palette choice — so navigating from the dashboard to the GSM Evil page feels seamless.

**Why this priority**: The spec 003 theme system is complete. The GSM Evil page should inherit palette preferences automatically through shared CSS custom properties and the component library. Argos is dark-mode only; palette selection (8 options: default, blue, green, orange, red, rose, violet, yellow) is the primary theming mechanism.

**Independent Test**: Set the theme to "Green" palette on the dashboard. Navigate to the GSM Evil page. All accent colors use green variants on dark backgrounds. Switch to "Violet" palette. The GSM Evil page accent colors update to violet. All 8 palettes render correctly with no hardcoded colors breaking the theme.

**Acceptance Scenarios**:

1. **Given** the operator has set a palette in Settings, **When** navigating to the GSM Evil page, **Then** all components render with the selected palette accent colors on the dark background.
2. **Given** the palette is changed while on the GSM Evil page, **When** colors update, **Then** no scan state, IMSI data, or frame display is disrupted.
3. **Given** all 8 palettes are tested, **When** viewing the GSM Evil page, **Then** no hardcoded hex colors override the palette — all accent/highlight colors derive from CSS custom properties.
4. **Given** the GSM Evil page with any palette, **When** compared to the dashboard, **Then** accent colors are consistent across both pages.

---

### Edge Cases

- What happens if the component decomposition introduces a reactivity bug? Each sub-component is tested independently and in composition. The existing store remains the single source of truth for scan/IMSI state, minimizing reactivity changes.
- What happens if a scan is active during the upgrade (hot reload in dev)? Theme/style changes don't affect scan state. WebSocket connections, scan progress, and IMSI capture continue uninterrupted.
- What happens to the tower row expansion state during decomposition? Expansion state is managed by the tower table component internally, preserving behavior.
- What happens to the 3 CSS animations (spin, blink, pulse)? Animations are preserved in the relevant sub-component's scoped styles or moved to a shared utility file.
- What if some custom CSS selectors are used by the store or utility functions? CSS classes are presentation-only in this page — no JavaScript references to class names. Safe to replace.
- What happens when the store has stale data from a previous session (local persistence) and the page loads with outdated captured IMSIs or scan results? The page refreshes data from the API on mount; stale state renders correctly during the brief loading window.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST upgrade all buttons on the GSM Evil page (Start/Stop Scan, Back to Console, Select frequency, 7 sort column headers) to the same modern button components used by the dashboard.
- **FR-002**: System MUST upgrade the frequency scan results table to a modern table component matching the dashboard's table standard.
- **FR-003**: System MUST upgrade the IMSI tower table (including expandable device lists) to a modern table component with consistent header, row, and expansion styling.
- **FR-004**: System MUST upgrade all status badges (signal quality, channel type, activity indicators, IMSI capture status, scan progress) to modern badge components with appropriate color variants.
- **FR-005**: System MUST decompose the monolithic page into at least 6 independently maintainable sub-components: a page header, IMSI tower table, scan results table, scan progress console, live frames console, and error dialog.
- **FR-006**: System MUST keep the parent page's logic section under 150 lines after decomposition.
- **FR-007**: System MUST reduce the custom CSS from 1107 lines to under 200 lines by using component library equivalents and utility classes.
- **FR-008**: System MUST preserve all existing functionality: GSM scanning, IMSI capture, tower grouping/sorting, device expansion, frame display, scan progress console, error dialogs.
- **FR-009**: System MUST ensure the GSM Evil page inherits the active theme palette (8 palettes, dark-mode only) established by the dashboard theme system.
- **FR-010**: System MUST remove all old hand-crafted CSS class definitions that are replaced by component library equivalents.
- **FR-011**: System MUST NOT cause any layout changes — every element stays in the same position.
- **FR-012**: System MUST pass all quality checks (type safety, code quality, unit tests, build) after each story is completed.

### Key Entities

- **GSM Evil Page Component Tree**: The decomposed structure where the parent page orchestrates 6 sub-components (header, tower table, scan results table, scan console, live frames console, error dialog), each with clear input interfaces and event callbacks.
- **GSM Evil State Store**: The existing store that remains the single source of truth for scan state, IMSI data, tower locations, and scan progress. Sub-components receive data from this store via inputs passed down from the parent page.
- **Tower Sort/Expansion State**: UI-only state (sort column, sort direction, expanded towers) managed by the tower table component internally — not persisted, not in the global store.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All buttons on the GSM Evil page are visually indistinguishable in quality from dashboard buttons — same component library, same variants, same transitions.
- **SC-002**: Both data tables (scan results, IMSI towers) match the dashboard's table styling standard.
- **SC-003**: All badges and status indicators use the same badge component as the dashboard.
- **SC-004**: The monolithic page is decomposed into at least 6 sub-components, with the parent page logic section under 150 lines.
- **SC-005**: Custom CSS reduced from 1107 lines to under 200 lines.
- **SC-006**: The GSM Evil page correctly inherits the active theme palette (all 8 palettes render correctly).
- **SC-007**: Zero behavioral regressions — all scanning, IMSI capture, tower display, frame output, and error handling work identically.
- **SC-008**: All quality checks pass (type safety, code quality, unit tests, build) after all changes.
- **SC-009**: Zero browser console errors on the GSM Evil page with any palette selection.

## Assumptions

- Spec 003 (UI Modernization) is complete — the theme system (dark-mode only, 8 palettes), component library standard, and dashboard component upgrades are established and can be directly replicated.
- The existing GSM Evil state store is well-structured and does not need refactoring — sub-components receive store data via inputs.
- The component library's table, badge, button, and alert dialog components support all the variants needed (sortable headers, color-coded quality badges, destructive/primary/ghost button styles, error dialogs).
- The 3 CSS animations (spin, blink, pulse) are simple enough to keep in component-scoped styles.
- The carrier-mapping data, tower utility functions, and GSM type definitions remain unchanged.

## Constraints

- **Memory**: Node.js heap capped at 1024MB. Decomposition must not increase memory usage.
- **Hardware**: Target is Raspberry Pi 5 (8GB RAM, ARM64). All dependencies must work on ARM.
- **No Layout Changes**: Every element stays exactly where it is. Decomposition and styling changes are invisible to the operator.
- **No Functionality Changes**: All GSM scanning, IMSI capture, tower lookup, frame display, and error handling remain identical.
- **Store Preservation**: The GSM Evil state store remains unchanged. Sub-components consume it via inputs passed from the parent page, not direct store access.
- **Step-by-step Implementation**: Each change is implemented, verified, and committed individually. Decomposition and visual upgrades can proceed in any order but each step must pass verification before the next begins.
- **Dark Mode Only**: Argos uses dark mode exclusively. No light mode support needed. Theme integration means palette inheritance only.
