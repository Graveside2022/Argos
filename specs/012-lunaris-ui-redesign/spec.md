# Feature Specification: Lunaris UI Redesign

**Feature Branch**: `012-lunaris-ui-redesign`
**Created**: 2026-02-21
**Status**: Draft
**Input**: User description: "Implement Lunaris design system as complete UI overhaul of the Argos dashboard, replacing the current ad-hoc styling with a unified dark-theme design language derived from the Pencil mockup, including new typography scale, color token system, layout structure, and component patterns"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Unified Visual Identity (Priority: P1)

An operator launches the Argos dashboard and immediately perceives a cohesive, professional dark-theme interface. Every panel, card, metric tile, status label, and interactive element follows the same visual language — consistent spacing, typography, color usage, and border treatment. The dashboard conveys "military-grade tool" rather than "cobbled-together prototype."

**Why this priority**: Visual coherence is the foundation. Without a unified token system, every subsequent UI change risks introducing inconsistency. This is the single most impactful change for operator trust and usability.

**Independent Test**: Can be fully tested by loading the dashboard in a browser and verifying that all visible elements conform to the Lunaris design token palette — no rogue colors, no mismatched fonts, no inconsistent spacing. Delivers immediate professional polish.

**Acceptance Scenarios**:

1. **Given** the operator opens the dashboard, **When** the page loads, **Then** all backgrounds use the defined dark palette (deep black base, slightly lighter card surfaces, distinct border separations)
2. **Given** the operator views any text on screen, **When** they inspect any label, value, or heading, **Then** all text uses one of exactly two font families — a monospace font for data/metrics and a sans-serif font for UI chrome/labels
3. **Given** the operator scans the full interface, **When** they look at spacing between elements, **Then** all gaps, paddings, and margins follow a consistent spacing scale with no ad-hoc values

---

### User Story 2 - Command Bar and Navigation (Priority: P1)

An operator uses the top command bar to understand system identity, connection status, and key hardware indicators at a glance. The bar shows the ARGOS brand mark, a mesh/connection indicator, hardware status icons (GPS satellites, signal strength), and the current timestamp — all in a compact 40px strip that anchors the interface.

**Why this priority**: The command bar is always visible and sets the tone for the entire application. It's also the primary orientation point — operators need to confirm "I'm connected, GPS is locked, system is live" within 2 seconds of looking at the screen.

**Independent Test**: Can be fully tested by loading the dashboard and verifying the command bar displays accurate, real-time data (GPS count, timestamp, mesh node count) with the correct visual treatment.

**Acceptance Scenarios**:

1. **Given** the operator opens the dashboard, **When** the page loads, **Then** a fixed command bar appears at the top spanning the full width, showing the ARGOS brand, connection status, and system clock
2. **Given** the GPS hardware is connected, **When** the operator glances at the command bar, **Then** satellite count is visible and updates in real-time
3. **Given** the operator is in any sub-view or panel state, **When** they look at the command bar, **Then** it remains persistently visible and unobstructed

---

### User Story 3 - System Overview Panel with Logs Section (Priority: P1)

An operator uses the left-side overview panel to monitor system health at a glance. The panel shows hardware metrics (CPU, disk, memory, power) as tile cards with progress bars, followed by categorized status sections (Network, Hardware, Tools, Services) using text-based status indicators without colored dots. The Network section includes a one-tap speed test that runs a lightweight bandwidth measurement and displays results inline. At the bottom, a Logs summary section shows aggregate event counts and the time since the last alert.

**Why this priority**: The overview panel is the operator's "heartbeat monitor" — the most-glanced area of the dashboard. Getting this right means operators can assess system health in under 3 seconds without clicking anything.

**Independent Test**: Can be fully tested by loading the dashboard and verifying all 9 blocks (4 metric tiles + 5 status sections including Logs) render with live data, correct typography hierarchy, and proper color-coded status text. Speed test can be triggered and results display inline.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** the operator views the overview panel, **Then** four metric tiles display CPU percentage, disk usage, memory usage, and power draw with visual progress bars
2. **Given** system services are running, **When** the operator views the Services section, **Then** each service shows its name and a text-based status label (e.g., "connected", "idle", "stopped") with color tinting to convey health — no colored dots
3. **Given** the system has recent log events, **When** the operator views the Logs section at the bottom, **Then** they see aggregate counters for total events (24h), warnings, errors, and time since last alert
4. **Given** the operator clicks the Speed Test button in the Network section, **When** the test completes, **Then** download speed, upload speed, and latency are displayed inline in the Network block. The test uses a lightweight CLI tool (librespeed-cli) that works with both public and self-hosted servers for field/LAN testing

---

### User Story 4 - Icon Rail Navigation (Priority: P2)

An operator uses a narrow vertical icon rail on the far left to switch between dashboard views — Overview, Devices, Tools/Integrations, Layers, and Settings. The rail is compact (48px) and uses subtle iconography. The Argos logo sits at the top of the rail as a brand anchor, not a clickable toggle.

**Why this priority**: The icon rail is the primary navigation mechanism but is structurally simpler than the content panels it controls. It already exists in code and primarily needs visual refinement.

**Independent Test**: Can be fully tested by clicking each icon in the rail and verifying the correct panel opens in the left sidebar area, with proper active/hover state styling.

**Acceptance Scenarios**:

1. **Given** the operator views the dashboard, **When** they see the icon rail, **Then** the Argos logo appears at the top as a static brand mark (not interactive)
2. **Given** the operator clicks a navigation icon, **When** the corresponding panel loads, **Then** the active icon is visually distinguished from inactive icons
3. **Given** the operator hovers over any icon, **When** the cursor enters the icon area, **Then** a subtle highlight indicates interactivity

---

### User Story 5 - Map Area with Tactical Overlay (Priority: P2)

An operator monitors the central map area showing the geographic operating environment. Detected access points, mesh nodes, and target devices appear as markers on the map. A GPS lock indicator and satellite count are visible in the map region. The map fills the remaining space after the overview panel and command bar.

**Why this priority**: The map is the largest visual area and provides spatial awareness critical to EW operations. However, the map rendering itself (Leaflet) is already functional — this story focuses on styling the map chrome, markers, legends, and overlay elements to match the Lunaris aesthetic.

**Independent Test**: Can be fully tested by loading the dashboard with GPS active and verifying that map markers, the GPS indicator, and map overlay elements all conform to the Lunaris color palette and typography.

**Acceptance Scenarios**:

1. **Given** the dashboard loads with GPS locked, **When** the operator views the map area, **Then** a GPS satellite count indicator appears with the correct Lunaris styling
2. **Given** access points are detected, **When** they appear on the map, **Then** AP markers use the accent color (not the semantic status colors reserved for health indication)
3. **Given** a target device is being tracked, **When** it appears on the map, **Then** the target marker uses the error/alert color to visually distinguish it from normal nodes

---

### User Story 6 - Resizable Bottom Panel with Tabs (Priority: P2)

An operator accesses secondary tools through a bottom panel that can be expanded, collapsed, and resized by dragging. The panel contains tabs for Terminal, Chat (AI Agent), Logs, Captures, and Network Map. A downward caret collapses the panel; clicking it again restores it. The panel can be dragged to resize vertically.

**Why this priority**: The bottom panel provides the interactive workspace (terminal, captures, chat) and already exists functionally. This story focuses on styling the tab bar, collapse/expand behavior, and drag handle to match the Lunaris design language.

**Independent Test**: Can be fully tested by expanding, collapsing, and resizing the bottom panel, then switching between all four tabs and verifying consistent Lunaris styling.

**Acceptance Scenarios**:

1. **Given** the bottom panel is visible, **When** the operator clicks the collapse caret, **Then** the panel smoothly collapses to a minimal tab bar
2. **Given** the bottom panel is collapsed, **When** the operator clicks the expand caret, **Then** the panel restores to its previous height
3. **Given** the operator drags the panel's top edge, **When** they move the cursor vertically, **Then** the panel resizes smoothly between minimum and maximum heights
4. **Given** the operator clicks a tab label, **When** the tab content changes, **Then** the active tab is visually distinguished and content transitions cleanly

---

### User Story 7 - Accent Color Theming (Priority: P3)

The dashboard supports swappable accent colors that pervade the entire interface — command bar highlights, progress bar fills, map markers, active tab indicators, and interactive element focus states all reflect a single configurable accent hue. The initial deployment uses a steel blue accent (#809AD0). Semantic status colors (healthy, warning, error, inactive) remain independent of the accent and are desaturated to harmonize with the dark theme.

**Why this priority**: Accent theming is a "design system completeness" concern. The core value is delivered with a single accent color. Making it swappable is a polish feature that ensures the system is architected correctly but isn't needed for initial field deployment.

**Independent Test**: Can be fully tested by changing the accent color token and verifying that all accent-colored elements throughout the interface update accordingly, while semantic colors remain unchanged.

**Acceptance Scenarios**:

1. **Given** the accent color is set to steel blue, **When** the operator views the dashboard, **Then** all accent-colored elements (brand text, bar fills, active indicators, map markers for non-target nodes) display in steel blue
2. **Given** the accent color is changed to a different hue, **When** the page reloads, **Then** all accent elements reflect the new color without any elements retaining the old accent
3. **Given** a service is in "warning" state, **When** the operator views its status text, **Then** the warning color is a desaturated warm gold that harmonizes with the dark theme, regardless of the current accent color

---

### Edge Cases

- What happens when the overview panel has more content than vertical space allows (e.g., many services listed)? The panel should scroll internally without affecting the command bar or map.
- What happens when the browser window is resized below 1024px width? The layout should degrade gracefully — the overview panel may collapse to icons-only or hide behind a toggle.
- What happens when a metric value is unavailable (e.g., GPS not connected, CPU reading fails)? Display a placeholder dash ("—") in the metric tile rather than "0" or an empty space.
- What happens when the operator uses the dashboard on a high-DPI display? All fonts and spacing should scale correctly without pixelation or layout breakage.
- What happens when dark mode is the only mode? The design is dark-first; light mode support is not required for initial deployment.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Dashboard MUST render with a dark-theme color palette using defined background, card, and border token values consistently across all components
- **FR-002**: All text MUST use one of exactly two font families — a monospace font for data/metrics/code and a sans-serif font for UI navigation/labels
- **FR-003**: Typography MUST follow a defined size scale (6 distinct sizes from section labels to hero metrics) with consistent weight and letter-spacing assignments
- **FR-004**: The command bar MUST be fixed at the top, spanning full width, showing system identity, connection status indicators, and a real-time clock
- **FR-005**: The icon rail MUST be fixed at the far left, 48px wide, with navigation icons for at least 5 views (Overview, Devices, Tools, Layers, Settings)
- **FR-006**: The overview panel MUST display hardware metric tiles with visual progress bars for CPU, disk, memory, and power
- **FR-007**: Status sections (Network, Hardware, Tools, Services) MUST use text-based status labels with color tinting — no colored dot indicators
- **FR-008**: A Logs summary section MUST appear at the bottom of the overview panel showing aggregate event counters (total events 24h, warnings, errors, time since last alert)
- **FR-009**: The bottom panel MUST support collapse/expand via a caret toggle and vertical resize via drag
- **FR-010**: The bottom panel MUST contain tabs for Terminal, Chat, Logs, Captures, and Network Map
- **FR-011**: Semantic status colors (healthy, warning, error, inactive) MUST be independent of the accent color and MUST be visually desaturated to harmonize with the dark theme
- **FR-012**: Color MUST NOT be the sole means of conveying status — every color-coded element MUST also have a text label or icon that communicates the same information
- **FR-013**: The map area MUST fill remaining horizontal and vertical space after the icon rail, command bar, overview panel, and bottom panel are positioned
- **FR-014**: All spacing (gaps, padding, margins) MUST follow a consistent spacing token scale — no ad-hoc pixel values
- **FR-015**: The Network section MUST include a Speed Test button that triggers a lightweight bandwidth measurement (download, upload, latency) using librespeed-cli, displaying results inline without navigating away from the overview panel

### Key Entities

- **Design Token**: A named value (color, size, font, spacing) that defines a single visual property. Tokens are the atomic building blocks of the design system. All UI components reference tokens rather than hard-coded values.
- **Accent Color**: A single configurable hue used for brand identity, interactive highlights, and non-semantic emphasis throughout the dashboard. Independent of the semantic color layer.
- **Semantic Status Color**: A fixed set of colors (healthy, warning, error, inactive) that convey operational state. These never change with accent theming and are always paired with text labels.
- **Metric Tile**: A card component displaying a single hardware metric (CPU, disk, memory, power) with a label, numeric value, secondary detail, and a visual progress bar.
- **Status Section**: A grouped list of related system items (services, hardware devices, tools, network interfaces) where each item shows a name and a text-based colored status label.
- **Logs Summary**: An aggregate counter display showing event totals, warning/error counts, and recency of last alert — designed as a quick-glance summary that will later expand into a full log viewer.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An operator can assess overall system health (CPU, memory, disk, power, service states) within 3 seconds of viewing the dashboard, without clicking or scrolling
- **SC-002**: 100% of visible text elements use one of exactly two designated font families — zero instances of fallback or unintended fonts
- **SC-003**: 100% of color values in the rendered dashboard trace back to defined design tokens — zero hard-coded hex values in component markup
- **SC-004**: The dashboard renders correctly at standard deployment resolution (1920x1080) with no overlapping elements, clipped text, or broken layouts
- **SC-005**: Changing the accent color token updates all accent-colored elements throughout the entire interface — verified by visual inspection at page reload
- **SC-006**: Every status indicator that uses color also includes a text label conveying the same information, verifiable by grayscale screenshot comparison
- **SC-007**: The overview panel displays all 9 content blocks (4 metric tiles + Network + Hardware + Tools + Services + Logs) without requiring scrolling at 1080p resolution
- **SC-008**: The bottom panel can be collapsed, expanded, and resized in under 1 second with smooth visual transitions
- **SC-009**: Page load to full visual render completes within 2 seconds on the target hardware (Raspberry Pi 5, 8GB RAM)
- **SC-010**: The redesigned dashboard maintains all existing functional capabilities — no features are lost or degraded during the visual overhaul

## Assumptions

- Dark mode is the only required theme for initial deployment. Light mode token values exist in the design system but implementation is deferred.
- The target deployment resolution is 1920x1080. Responsive behavior below 1024px is a future concern.
- The Leaflet map library and its tile rendering are out of scope — only the map chrome (overlays, markers, legends, GPS indicator) will be restyled.
- Existing component functionality (terminal, chat, captures, services management) is preserved exactly. This spec covers visual treatment only, not behavioral changes.
- The steel blue accent color (#809AD0) is the initial deployment color. The design system supports swapping to other accent hues, but only steel blue is required at launch.
- Font files (Fira Code monospace, Geist sans-serif) are self-hosted as WOFF2 in `static/fonts/`. No CDN dependency — field deployment may have no internet access.
- The Logs summary section displays static/polling counters only. Real-time streaming log events are a separate future feature (the "expanded log viewer" mentioned by the user).

## Design Reference

The definitive visual reference for this redesign is the Pencil mockup file `pencil-lunaris.pen`, specifically:

- **Primary reference**: Node `yHSs9` — "Argos — Lunaris [Steel Blue Accent]" (the steel blue themed variant with desaturated semantic colors)
- **Secondary reference**: Node `sUfN2` — "Argos — Variant B (Lunaris)" (the base orange-accent variant showing the layout structure)

### Design Token Summary (Dark Mode)

**Backgrounds**: Deep black base (#111111), slightly lighter card surfaces (#1A1A1A), border separations (#2E2E2E)

**Text**: White foreground (#FFFFFF), muted foreground (#B8B9B6), secondary/disabled (#666666), section labels (#999999 equivalent via muted)

**Accent Layer (Steel Blue)**: Primary accent #809AD0, lighter tint #A8BBD8 for secondary bars

**Semantic Layer (Desaturated)**: Healthy #8BBFA0 (muted sage green), Warning #D4A054 (warm gold), Error #FF5C33 (unchanged, high-visibility), Inactive #555555 (gray)

**Typography**: Monospace primary (Fira Code) for all data, metrics, labels. Sans-serif secondary (Geist) for tab labels and UI navigation. Six-step size scale: 24px hero → 13px brand → 12px secondary data → 11px primary rows → 10px status text → 9px section headers.

**Layout**: 48px icon rail, 280px overview panel, 40px command bar height, 240px default bottom panel height. Tile backgrounds #111111 with #333333 borders.
