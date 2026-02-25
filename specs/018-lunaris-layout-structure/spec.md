# Feature Specification: Lunaris Layout Structure

**Feature Branch**: `018-lunaris-layout-structure`
**Created**: 2026-02-25
**Status**: Draft
**Predecessor**: `017-lunaris-ui-unification` (CSS token refactor — complete)
**Input**: Rebuild Svelte component templates to match pencil-lunaris.pen mockup structures — sidebar content, command bar, bottom panel, screen-specific layouts, widgets, panels, and dropdowns.

## Overview

Spec 017 replaced the visual "paint" — colors, fonts, shadows, tokens — but left the structural "walls" untouched. The pencil-lunaris.pen mockups define a complete layout system for every dashboard screen. This spec closes the structural gap by rebuilding Svelte component templates to match the mockup's information architecture, content hierarchy, and widget placement.

All 11 dashboard screens share a common shell: **48px Icon Rail → Right Area (Command Bar + Content Area)**. The Command Bar is a **40px** strip fixed at the top. The Content Area below it operates in two modes:

- **Sidebar mode** (9 of 11 screens): 280px left panel + fill-width main right (map area + 240px bottom panel). The left panel content varies per screen.
- **Full-width mode** (2 of 11 screens): TAK Server Config and GSM Scanner (Expanded) use the entire content area width — no left sidebar panel. TAK renders a scrollable form; GSM Expanded renders a full-width data table.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — System Overview Sidebar (Priority: P1)

An operator opens the dashboard and sees a left sidebar with vertically stacked, real-time system metrics: CPU usage with a hero percentage and progress bar, Disk usage, Memory usage, Power status, Network Status (IP, latency, DNS), Hardware status with device status dots, active Services with connection indicators, and a recent Events Log.

**Why this priority**: The System Overview is the default landing screen. Every operator session begins here. Getting the sidebar structure right establishes the visual pattern for all other screens.

**Independent Test**: Load the dashboard at `/dashboard` and verify the sidebar renders all metric sections in the correct order with live data from existing API endpoints.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** the operator views the System Overview sidebar, **Then** they see vertically stacked sections: CPU (hero metric + progress bar), Disk, Memory, Power, Network Status, Hardware, Services, and Events Log.
2. **Given** system metrics are updating, **When** CPU usage changes, **Then** the hero metric (24px font) and progress bar update in real time without page reload.
3. **Given** a hardware device goes offline, **When** the operator views the Hardware section, **Then** the device's status dot changes from green to red with a text label.

---

### User Story 2 — Command Bar (Priority: P1)

An operator sees a persistent 40px command bar at the top of every screen displaying mission-critical status at a glance: the ARGOS brand mark, collection/recording status, node identifier, network latency, mesh node count, weather conditions, and current date/time in Zulu format.

**Why this priority**: The command bar is present on every screen and provides situational awareness that operators rely on continuously. It is shared infrastructure for all screens.

**Independent Test**: Navigate to any dashboard screen and verify the command bar renders with all status segments populated from live data.

**Acceptance Scenarios**:

1. **Given** any dashboard screen loads, **When** the operator views the command bar, **Then** they see (left to right): ARGOS brand mark, collection status indicator, node callsign, a spacer, network latency, mesh node count, weather summary, date, and Zulu time.
2. **Given** the system clock advances, **When** the operator watches the command bar, **Then** the Zulu time updates every second.
3. **Given** mesh connectivity changes, **When** a node drops, **Then** the mesh count updates (e.g., "2/4" instead of "3/4").

---

### User Story 3 — Bottom Panel with Tabbed Interface (Priority: P1)

An operator accesses a 240px bottom panel with tabs for Terminal, Chat, Logs, Captures, and Devices. The active tab is highlighted with the accent color and a 2px bottom border. Switching tabs reveals the corresponding content area. The panel is resizable.

**Why this priority**: The bottom panel is shared across all screens and provides core operational tools (terminal access, log monitoring, device tracking). It completes the shared shell that all screen-specific content sits within.

**Independent Test**: Load any dashboard screen and verify the bottom panel renders with all five tabs, the Terminal tab is active by default, and clicking other tabs switches content.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** the operator views the bottom panel, **Then** they see five tabs: Terminal, Chat, Logs, Captures, Devices — in that order.
2. **Given** the Terminal tab is active, **When** the operator clicks the Logs tab, **Then** the Logs content replaces the Terminal content and the Logs tab receives the accent-colored underline.
3. **Given** the bottom panel is at default height (240px), **When** the operator drags the resize handle, **Then** the panel resizes and the map/content area adjusts accordingly.

---

### User Story 4 — OFFNET Tools Panel (Priority: P2)

An operator navigates to the OFFNET Tools screen and sees a sidebar with categorized tool cards: RECON, ATTACK, DEFENSE, and UTILITIES. Each card shows a category name, brief description, and tool count. Selecting a category reveals the available tools.

**Why this priority**: Tools panels are the primary interaction point for field operations. They need to match the mockup's card-based category layout to improve tool discoverability.

**Independent Test**: Navigate to the OFFNET Tools screen and verify four category cards render with correct labels, descriptions, and tool counts.

**Acceptance Scenarios**:

1. **Given** the operator navigates to OFFNET Tools, **When** the sidebar loads, **Then** they see four cards: RECON, ATTACK, DEFENSE, UTILITIES — each with a name, description, and tool count.
2. **Given** the OFFNET Tools sidebar is visible, **When** the operator clicks a category card, **Then** the card expands or navigates to show the tools in that category.

---

### User Story 5 — Map Layers Panel (Priority: P2)

An operator navigates to the Map Layers screen and sees a sidebar with four sections: a Map Provider selector (tile toggle between Tactical and Satellite), a Visibility Filter (3-button row), Map Layers with toggle switches for each layer, and a Signal Strength legend showing 6 color-coded bands with distance ranges.

**Why this priority**: Map configuration is essential for field operations. The structured sidebar with tile selectors, filters, toggles, and the signal legend replaces a less organized layout.

**Independent Test**: Navigate to Map Layers and verify all four sections render with interactive controls (tile selector, filter buttons, toggle switches, legend).

**Acceptance Scenarios**:

1. **Given** the operator opens Map Layers, **When** the sidebar loads, **Then** they see four sections: Map Provider, Visibility Filter, Map Layers, and Signal Strength legend.
2. **Given** the Map Provider section is visible, **When** the operator clicks "Satellite", **Then** the Satellite tile receives a 2px accent border and the map tiles switch.
3. **Given** the Signal Strength legend is visible, **Then** it displays 6 bands (Very Strong through No Signal) with colored dots and estimated distance ranges.

---

### User Story 6 — Settings Panel (Priority: P2)

An operator navigates to Settings and sees a sidebar with four category cards: Appearance, Connectivity, Hardware, and Logs & Analytics. Each card shows a brief description of what settings it contains. Selecting a card navigates to that settings section.

**Why this priority**: Settings discoverability improves when categories are visually distinct cards rather than a flat list.

**Independent Test**: Navigate to Settings and verify four category cards render. Clicking a card navigates to the appropriate settings section.

**Acceptance Scenarios**:

1. **Given** the operator opens Settings, **When** the sidebar loads, **Then** they see four cards: Appearance, Connectivity, Hardware, Logs & Analytics.
2. **Given** the operator clicks "Hardware", **When** the Hardware settings load, **Then** they see a back button, "HARDWARE" header, and sub-cards for GPS, SDR, and WiFi devices.

---

### User Story 7 — Hardware Config Sub-Panel (Priority: P3)

An operator navigates to Hardware Config (from Settings → Hardware) and sees collapsible sections for GPS Devices, SDR/Software Defined Radios, and WiFi Adapters. Each section shows detected devices with status indicators and configuration options.

**Why this priority**: Hardware configuration is accessed less frequently but is critical for device setup. The collapsible card layout improves organization.

**Independent Test**: Navigate to Settings → Hardware and verify three device category cards render with detected devices listed.

**Acceptance Scenarios**:

1. **Given** the operator opens Hardware Config, **When** the sub-panel loads, **Then** they see three sections: GPS Devices, SDR Radios, WiFi Adapters — each showing detected hardware.
2. **Given** a GPS device is connected, **When** the operator views the GPS section, **Then** they see the device name, connection status dot, and accuracy info.

---

### User Story 8 — Sidebar Widgets (Priority: P3)

An operator views the System Overview sidebar and optionally sees additional data widgets: Speed Test (DL/UL metrics with progress bars), Network Latency (ping, jitter, packet loss), Weather (temperature, conditions, wind, humidity, visibility), and Node Mesh (TAK servers + peer mesh with latency). These widgets are 264px wide and match the sidebar card styling.

**Why this priority**: Widgets extend the System Overview with contextual data. They are additive — the core sidebar works without them.

**Independent Test**: Verify that widget components render with correct layout and can be placed in the sidebar without breaking the scroll behavior.

**Acceptance Scenarios**:

1. **Given** the System Overview sidebar is visible, **When** the Speed Test widget is enabled, **Then** it renders below the core metric sections with DL/UL progress bars.
2. **Given** the Weather widget is visible, **When** weather data updates, **Then** the widget reflects the new conditions without full page reload.

---

### User Story 9 — TAK Server Config Form (Priority: P2)

An operator navigates to the TAK Server Config screen and sees a full-width form layout (no left sidebar). The screen has a 48px header bar with status chip, followed by a scrollable form with seven sections: Status (connection indicator), Server (description input, host/port fields, connect toggle), Authentication (import certificate / enroll radio buttons), Client Certificate (file chooser, password input, upload button, inline notification), Trust Store (same pattern as certificate), Data Package (file chooser, import button), and a Save Configuration button at the bottom.

**Why this priority**: TAK integration is critical for military interoperability. The form layout is completely different from other sidebar-based screens — it uses full-width content, so it validates the shell's full-width mode.

**Independent Test**: Navigate to TAK Server Config and verify all seven form sections render with appropriate input controls. The save button should be visible after scrolling.

**Acceptance Scenarios**:

1. **Given** the operator navigates to TAK Server Config, **When** the screen loads, **Then** they see a full-width form (no sidebar) with a 48px header showing "TAK SERVER" and a connection status chip.
2. **Given** the TAK form is visible, **When** the operator scrolls down, **Then** they see sections in order: Status, Server, Authentication, Client Certificate, Trust Store, Data Package, Save Configuration button.
3. **Given** the Authentication section is visible, **When** the operator clicks "Import Certificate", **Then** the radio button activates with accent border (#809AD0) and the certificate fields become visible.
4. **Given** the operator fills in all fields, **When** they click "Save Configuration", **Then** the accent-filled button triggers a save action.

---

### User Story 10 — GSM Scanner Layout (Priority: P3)

An operator navigates to the GSM Scanner screen and sees the appropriate layout state. The **empty state** shows a full-width area (no sidebar) with a 48px GSM header bar, a "SCAN RESULTS" panel containing an empty results area, and a "CONSOLE" panel below with a dark (#0A0A0A) terminal body. The **active state** shows a full-width area with an IMSI Capture Panel (data table with title row) and a Live Frames Panel (header + dark body). The **expanded state** uses the full screen width (no sidebar) with the IMSI table plus two Live Frames panels stacked vertically.

**Why this priority**: GSM scanning is a specialized tool used in specific operational contexts. Layout refinement improves usability but is not blocking.

**Independent Test**: Navigate to GSM Scanner in each state (empty, active, expanded) and verify the layout matches the mockup structure.

**Acceptance Scenarios**:

1. **Given** no GSM scan is active, **When** the operator opens GSM Scanner, **Then** they see a 48px GSM header, a "SCAN RESULTS" panel with empty results area (#0D0D0D fill, #2E2E2E border), and a CONSOLE panel below with #1A1A1A header and #0A0A0A body.
2. **Given** a scan is running, **When** results arrive, **Then** the IMSI Capture Panel shows a data table with title row, and a Live Frames Panel appears below with a 36px header (#1A1A1A) and 140px body (#0A0A0A).
3. **Given** the operator switches to expanded view, **When** the expanded state renders, **Then** the IMSI table takes full width with two stacked Live Frames panels below — no left sidebar is shown.

---

### User Story 11 — Status Bar Dropdown Menus (Priority: P3)

An operator clicks on a hardware status indicator in the command bar (WiFi, SDR, or GPS) and sees a dropdown menu. Each dropdown is 260px wide, has a #1A1A1A fill, #2E2E2E border, 4px corner radius, and a drop shadow (blur 8, #00000040). The dropdown has a title row (device type label in Fira Code 10px #888888, letter-spacing 1.5) separated by a bottom border, followed by key-value data rows. Row labels use Geist 12px #888888 (left-aligned), values use Fira Code 12px #FFFFFF (right-aligned), with rows justified space-between. The WiFi dropdown shows 7 rows: Chipset, MAC, Driver, Interface, Mode, Bands, Used by. The SDR dropdown shows 6 rows: Make, Model, Serial, FW API, USB, Used by. The GPS dropdown shows: Fix, satellite details, Speed, Accuracy, a divider, Device, Protocol. The "Used by" row value is colored #8BBFA0 with 600 weight to indicate active service binding.

**Why this priority**: Dropdown menus provide quick device switching without navigating to Hardware Config. They are a convenience feature that enhances the command bar.

**Independent Test**: Click each hardware indicator in the command bar and verify a dropdown appears with the exact row content and styling specified.

**Acceptance Scenarios**:

1. **Given** the command bar is visible, **When** the operator clicks the WiFi indicator, **Then** a 260px dropdown appears with title "WIFI ADAPTER" and 7 key-value rows (Chipset, MAC, Driver, Interface, Mode, Bands, Used by).
2. **Given** the command bar is visible, **When** the operator clicks the SDR indicator, **Then** a 260px dropdown appears with title "SOFTWARE DEFINED RADIO" and 6 key-value rows (Make, Model, Serial, FW API, USB, Used by).
3. **Given** the command bar is visible, **When** the operator clicks the GPS indicator, **Then** a 260px dropdown appears with title "GPS RECEIVER" and rows for Fix, satellite info, Speed, Accuracy, a divider, Device, Protocol.
4. **Given** a dropdown is open, **When** the operator clicks outside the dropdown, **Then** the dropdown closes.

---

### User Story 12 — Bottom Panel Content: Device Manager (Priority: P2)

An operator clicks the "Devices" tab in the bottom panel and sees the Device Manager layout: a toolbar row (8px/12px padding, #2E2E2E bottom border) containing a search input (200px, "Search MAC or name..."), filter buttons (2.4G, 5G, Hide No Signal) with active state (#1E1E1E fill, #4A8AF4 border, accent text), a flexible spacer, and a "Whitelisted: 0 MACs" counter. Below the toolbar is a data table with a header row (#181818 fill, Fira Code 10px 600 #888888 column headers: MAC/NAME, RSSI, CHANNEL, TYPE, CLIENTS, ENCRYPTION, FIRST SEEN, ACTIONS) and data rows with alternating selection highlight (selected row gets #1E1E1E fill + 2px left #4A8AF4 accent border). RSSI values are color-coded by signal strength. The panel is 1116px wide × 200px tall.

**Why this priority**: The Devices tab is a core operational tool for monitoring all detected wireless devices. The toolbar + table layout is fundamentally different from the current implementation and needs to match the mockup exactly.

**Independent Test**: Click the Devices tab and verify the toolbar renders with search, filters, and whitelist counter. Verify the table renders with correct column headers and data row styling.

**Acceptance Scenarios**:

1. **Given** the bottom panel is visible, **When** the operator clicks the Devices tab, **Then** they see a toolbar with search input, filter buttons, and a data table below with 8 column headers.
2. **Given** the Device Manager table has data, **When** the operator clicks a row, **Then** the row receives a #1E1E1E fill and 2px left accent border.
3. **Given** the filter buttons are visible, **When** the operator clicks "Hide No Signal", **Then** the button toggles to active state (#1E1E1E fill, #4A8AF4 border).

---

### User Story 13 — Bottom Panel Content: Agent Chat (Priority: P2)

An operator clicks the "Chat" tab in the bottom panel and sees the Agent Chat layout: a 36px header (#1A1A1A fill, #2E2E2E bottom border) with a bot icon (Material Symbols "bot", 18px, #4A8AF4), chat title text, a spacer, and a delete icon (#555555). Below is a message body with AI messages (#1E1E1E rounded cards, 6px/12px padding) and user messages (#1A1A1A cards with #2E2E2E border). At the bottom is an input bar (#1A1A1A fill, #2E2E2E top border) containing a text input (32px height, #111111 fill, "Type a message..." placeholder in Geist 13px #555555) and a 32×32px accent-colored send button (#4A8AF4 with white send icon).

**Why this priority**: The Agent Chat is a key operator interaction surface. The header/body/input three-part layout with clear message distinction is critical for usability.

**Independent Test**: Click the Chat tab and verify the header, message body, and input bar all render with correct structure and styling.

**Acceptance Scenarios**:

1. **Given** the bottom panel is visible, **When** the operator clicks the Chat tab, **Then** they see a 36px header with bot icon and title, a message area, and an input bar with text field and send button.
2. **Given** the chat has messages, **When** the operator views them, **Then** AI messages have #1E1E1E background and user messages have #1A1A1A background with border.
3. **Given** the input bar is visible, **When** the operator types a message and clicks send, **Then** the message appears in the chat body.

---

### User Story 14 — Terminal Error Overlay (Priority: P3)

When the terminal connection fails, an operator sees a centered overlay (#0E1116E6 semi-transparent fill) over the terminal area containing a vertically stacked error card (32px padding): a terminal icon (Material Symbols "terminal", 32px, #555555), "Terminal Unavailable" title (Geist 16px 600 #DDDDDD), a descriptive error message (Geist 14px #888888, e.g., "Could not connect to terminal server after 5 attempts."), and a recovery command in a code block (#1A1A1A fill, #2E2E2E border, Fira Code 14px #4A8AF4 link text).

**Why this priority**: Terminal errors need clear recovery guidance. The overlay pattern prevents confusion about why the terminal is blank.

**Independent Test**: Simulate a terminal connection failure and verify the overlay appears with all four elements (icon, title, message, recovery command).

**Acceptance Scenarios**:

1. **Given** the terminal WebSocket connection fails after 5 attempts, **When** the error state triggers, **Then** a semi-transparent overlay appears centered over the terminal area with icon, title, message, and recovery command.
2. **Given** the error overlay is visible, **When** the operator clicks the recovery command link, **Then** the suggested action is initiated.

---

### Edge Cases

- What happens when the sidebar overflows with too many metric sections? → Sidebar must scroll independently of the map area.
- How does the command bar handle very long node callsigns? → Text truncation with ellipsis at a maximum character width.
- What happens when the bottom panel is collapsed to minimum height? → Tab row remains visible; content area hides.
- How does the layout behave on narrow viewports (< 1280px)? → The sidebar collapses to icon-only mode; the icon rail remains visible.
- What happens when no GPS/SDR/WiFi hardware is detected? → Dropdown shows "No devices detected" empty state.
- How does the system handle the transition between GSM Scanner empty/active/expanded states? → Smooth state transition without layout jank; terminal console maintains scroll position.
- What happens when TAK certificate upload fails? → Inline notification card appears within the Client Certificate section with error details.
- What happens when the Agent Chat has no messages? → Message body shows an empty state (no placeholder needed — the input bar is always visible).
- What happens when the Device Manager has no data? → Table body shows empty state, toolbar remains functional.
- How does the terminal error overlay interact with panel resize? → Overlay covers the terminal content area only, not the tab bar; resizing the panel resizes the overlay.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render a shared dashboard shell on all screens consisting of: 48px icon rail, 40px command bar, and a content area. The content area operates in two modes: **sidebar mode** (280px left panel + fill-width main right with 240px bottom panel) used by 9 of 11 screens, and **full-width mode** (entire width used for content) used by TAK Server Config and GSM Scanner (Expanded).
- **FR-002**: System MUST render the command bar (40px height, `$--card` fill, `$--border` bottom border, 16px horizontal padding, 12px gap) with these segments left-to-right: ARGOS brand mark (Fira Code 14px 600 #809AD0, letter-spacing 2), collection status indicator (red dot when recording), node callsign (Fira Code 12px 500, letter-spacing 1), flexible spacer (fill-width), network latency with signal icon, mesh node count (connected/total format), weather summary, date (Fira Code 12px #666666, letter-spacing 0.5), and Zulu time (Fira Code 12px 600, letter-spacing 1).
- **FR-003**: System MUST render the System Overview sidebar with vertically stacked sections in order: CPU (hero metric + progress bar), Disk, Memory, Power, Network Status, Hardware, Tools, Services, Events Log.
- **FR-004**: Each sidebar metric section MUST display a section header (9px uppercase with letter-spacing), a hero metric value (24px), and a contextual sub-element (progress bar, status list, or data rows) appropriate to the metric type.
- **FR-005**: System MUST render the bottom panel with a tab bar containing: Terminal, Chat, Logs, Captures, Devices — using Geist font at 14px, with the active tab highlighted by accent color and 2px bottom border.
- **FR-006**: The bottom panel MUST be resizable via drag handle, with the map/content area adjusting to fill remaining space.
- **FR-007**: System MUST render the OFFNET Tools sidebar with a back navigation button and category cards for RECON, ATTACK, DEFENSE, and UTILITIES — each card showing category name, description, and tool count.
- **FR-008**: System MUST render the ONNET Tools sidebar with a back button (arrow-left icon + "TOOLS" label in accent color + "ONNET" title right-aligned in Fira Code 12px 600 #BBBBBB, letter-spacing 1.5) and two category cards: RECON and ATTACK — using the same card pattern as OFFNET Tools (#151515 fill, #2E2E2E bottom border, 8px/12px padding).
- **FR-009**: System MUST render the Map Layers sidebar with four sections: Map Provider tile selector (Tactical/Satellite with accent border on active), Visibility Filter (3-button row), Map Layers (toggle switches for each layer), Signal Strength legend (6 rows with color dots and distance ranges).
- **FR-010**: System MUST render the Settings sidebar with four category cards: Appearance, Connectivity, Hardware, Logs & Analytics — each with description text.
- **FR-011**: System MUST render the Hardware Config sub-panel with a back button, "HARDWARE" header, and three device category cards: GPS Devices, SDR Radios, WiFi Adapters — each listing detected hardware with status indicators.
- **FR-012**: System MUST implement four sidebar widgets (264px wide, #151515 fill, #2E2E2E border, 8px/12px padding, 8px gap, vertical layout) each following a consistent pattern — header row (label in Fira Code 10px 600 #999999 letter-spacing 1.2 + spacer + close icon 12px #666666), data section, and footer row (status dot + quality label + timestamp + spacer + refresh icon + action label in Fira Code 10px #666666):
    - **Speed Test**: server info row + DL block (icon #8BBFA0, label "DOWNLOAD", value, 3px progress bar on #1E1E1E track) + UL block (icon #809AD0, label "UPLOAD", value, progress bar) + footer with "Retest" action.
    - **Network Latency**: server status row ("Connected — XXms" in #8BBFA0) + latency block (icon #809AD0, "LATENCY" label, value, progress bar) + stats block (Jitter row + Packet Loss row) + footer with "Ping" action.
    - **Weather**: source row (map-pin icon, "Open-Meteo — Local GPS") + temperature block (#809AD0 thermometer icon, "TEMPERATURE" label) + key-value rows: Conditions, Wind, Humidity, Visibility + footer with sunrise/sunset times (#D4A054 sun icon) and "Refresh" action.
    - **Node Mesh**: header with connected/total count + TAK Servers section (#809AD0 radio-tower icon, server list with status dots, port, latency, client count, TLS indicator) + divider + Peer Mesh section (#888888 network icon, peer list with callsigns, latency, OFFLINE status in #C45B4A) + footer with "Mesh OK" status.
- **FR-013**: System MUST implement three dropdown menus (260px wide, #1A1A1A fill, #2E2E2E border, 12px padding, 8px gap, 4px corner radius, drop shadow blur 8 #00000040) triggered from command bar hardware indicators:
    - **WiFi Adapter**: title "WIFI ADAPTER" (Fira Code 10px 600 #888888, letter-spacing 1.5, bottom border) + 7 rows (Chipset, MAC, Driver, Interface, Mode, Bands, Used by). Labels in Geist 12px #888888, values in Fira Code 12px #FFFFFF, "Used by" value in #8BBFA0 600.
    - **SDR Radio**: title "SOFTWARE DEFINED RADIO" + 6 rows (Make, Model, Serial, FW API, USB, Used by). Same label/value styling.
    - **GPS Device**: title "GPS RECEIVER" + rows (Fix with #8BBFA0 "3D Fix", satellite PRN/signal detail, Speed, Accuracy, divider #2E2E2E, Device, Protocol). Fix status color-coded by quality.
- **FR-014**: System MUST render the GSM Scanner in three layout states: **empty** (full-width, 48px GSM header + Scan Results panel with empty area (#0D0D0D fill) + Console panel with #1A1A1A header and #0A0A0A body), **active** (full-width, GSM header + IMSI Capture Panel with data table + Live Frames Panel with 36px header and 140px body), and **expanded** (full-width, no sidebar, IMSI table + two stacked Live Frames panels). All GSM Scanner states use full-width content mode (no sidebar).
- **FR-015**: All screen-specific left panel content MUST be injected into the shared shell's left panel slot — no screen should duplicate the shell structure. Screens using full-width mode (TAK Config, GSM Scanner) inject content into the full-width content slot instead.
- **FR-019**: System MUST render the TAK Server Config as a full-width form (no sidebar) with a 48px header bar (#151515 fill, 12px gap, #2E2E2E bottom border) and a scrollable form body (24px/32px padding, 16px section gap) containing seven sections: Status, Server (description input + host/port row + connect toggle), Authentication (import/enroll radio buttons with accent border on active), Client Certificate (file chooser + password + upload + inline notification), Trust Store (same pattern), Data Package (file chooser + import button), and a Save Configuration button (#809AD0 fill, Fira Code 12px 600, 10px/24px padding).
- **FR-020**: The "Devices" bottom panel tab MUST render the Device Manager layout: toolbar (search input 200px, filter buttons with #1E1E1E/#4A8AF4 active state, spacer, whitelist counter) + data table (header row #181818, columns: MAC/NAME, RSSI, CHANNEL, TYPE, CLIENTS, ENCRYPTION, FIRST SEEN, ACTIONS in Fira Code 10px 600 #888888). Selected rows show #1E1E1E fill with 2px left #4A8AF4 accent border. RSSI values are color-coded by signal band.
- **FR-021**: The "Chat" bottom panel tab MUST render the Agent Chat layout: 36px header (#1A1A1A, bot icon #4A8AF4, delete icon #555555) + message body (AI messages in #1E1E1E cards, user messages in #1A1A1A cards with #2E2E2E border) + input bar (#1A1A1A, text input 32px height #111111, send button 32×32px #4A8AF4).
- **FR-022**: The terminal area MUST support an error overlay state: semi-transparent #0E1116E6 fill covering the terminal content, centered error card with terminal icon (32px #555555), title (Geist 16px 600), error message (Geist 14px #888888), and recovery command block (#1A1A1A fill, Fira Code 14px #4A8AF4 link).
- **FR-016**: The sidebar MUST scroll independently when content exceeds the viewport height, without affecting the map area or bottom panel scroll behavior.
- **FR-017**: All text in data sections MUST use Fira Code (monospace) at the appropriate Lunaris scale step. Tab labels and navigation chrome MUST use Geist (sans-serif).
- **FR-018**: System MUST preserve all existing functionality (WebSocket connections, API calls, real-time data updates, hardware control) — this is a structural layout change only, not a behavioral change.

### Key Entities

- **Dashboard Shell**: The shared layout frame (icon rail, command bar, content area with sidebar/full-width modes, bottom panel) reused across all screens.
- **Command Bar**: Persistent 40px top bar ($--card fill, $--border bottom border) with mission-critical status segments in a fixed left-to-right order.
- **Left Panel**: 280px sidebar ($--card fill, $--border right border) whose content varies by screen — System Overview metrics, Tools categories, Map Layers controls, Settings cards, or Hardware Config sections. Not present on TAK Config or GSM Expanded screens.
- **Bottom Panel**: 240px resizable tabbed panel with Terminal, Chat, Logs, Captures, Devices. Each tab renders a specific panel layout (terminal emulator, Agent Chat, log viewer, capture list, Device Manager table).
- **Sidebar Widget**: 264px-wide self-contained data card (#151515 fill, #2E2E2E border) with header/content/footer pattern. Four types: Speed Test, Network Latency, Weather, Node Mesh.
- **Hardware Dropdown**: 260px-wide popup menu (#1A1A1A fill, drop shadow) triggered from command bar hardware indicators. Three types: WiFi Adapter (7 rows), SDR Radio (6 rows), GPS Device (8 rows with divider).
- **Screen Layout State**: Variant configurations for screens with multiple modes (GSM Scanner: empty/active/expanded, Terminal: connected/error overlay).
- **TAK Server Config Form**: Full-width scrollable form with 7 card sections (#151515 fill, #2E2E2E border, 16px/20px padding) and an accent-filled save button.
- **Device Manager Panel**: Toolbar + data table layout for the Devices bottom panel tab. Toolbar has search, filter buttons, whitelist counter. Table has 8 columns with sortable headers and selectable rows.
- **Agent Chat Panel**: Header/body/input three-part layout for the Chat bottom panel tab. Supports AI and user message types with distinct visual styling.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 11 dashboard screens render the shared shell (icon rail, command bar, content area) without any screen duplicating shell structure. 9 screens use sidebar mode, 2 use full-width mode.
- **SC-002**: The System Overview sidebar displays all 9 metric sections (CPU, Disk, Memory, Power, Network Status, Hardware, Tools, Services, Events Log) in the correct vertical order with live data.
- **SC-003**: The command bar displays all 9 status segments (brand, collection status, node callsign, spacer, latency, mesh, weather, date, Zulu time) on every screen, with correct fonts and colors matching the .pen mockup.
- **SC-004**: Bottom panel tab switching between all 5 tabs (Terminal, Chat, Logs, Captures, Devices) completes in under 100ms with no layout shift.
- **SC-005**: Bottom panel resize via drag handle works smoothly, with the map area adjusting without visible jank or re-render artifacts.
- **SC-006**: All screen-specific sidebars render their content matching the mockup: OFFNET Tools (4 cards), ONNET Tools (2 cards), Map Layers (4 sections including tile selector and signal legend), Settings (4 cards), Hardware Config (3 device cards).
- **SC-007**: The four sidebar widgets render at 264px width with header/content/footer pattern, correct icons, progress bars, and action footers.
- **SC-008**: All three hardware dropdowns open from command bar indicators at 260px width with correct row counts (WiFi: 7, SDR: 6, GPS: 8), correct fonts (Geist labels, Fira Code values), and drop shadow.
- **SC-009**: GSM Scanner renders correctly in all three layout states (empty, active, expanded). All three states use full-width content mode (no sidebar). Expanded state shows IMSI table + two stacked Live Frames panels.
- **SC-010**: Dashboard initial load time remains under 3 seconds and heap usage stays below 200MB on Raspberry Pi 5.
- **SC-011**: All existing real-time data flows (WebSocket push, API polling, hardware status) continue to function identically after the layout restructuring.
- **SC-012**: TAK Server Config renders as a full-width form with all 7 sections (Status, Server, Authentication, Client Certificate, Trust Store, Data Package, Save) and correct input controls.
- **SC-013**: The Devices tab renders the Device Manager layout with toolbar (search + filters + whitelist counter) and 8-column data table with selectable rows.
- **SC-014**: The Chat tab renders the Agent Chat layout with header (bot icon + title), message body (distinct AI/user message styles), and input bar (text field + send button).
- **SC-015**: Terminal error overlay appears when WebSocket connection fails, showing centered error card with icon, title, message, and recovery command over a semi-transparent backdrop.

## Assumptions

- Existing API endpoints provide all data needed for the System Overview sidebar metrics (CPU, disk, memory, power, network, hardware, services). No new API routes are needed.
- The icon rail (48px left) already exists and does not need rebuilding — only the content panels to its right need restructuring.
- The bottom panel's resize behavior can build on the existing `ResizableBottomPanel.svelte` component.
- Sidebar widgets (Speed Test, Network Latency, Weather, Node Mesh) will initially render with available data; widgets requiring new data sources (e.g., speed test on-demand) will show a "Retest" / "Ping" / "Refresh" action state.
- The ONNET Tools screen has exactly 2 category cards (RECON, ATTACK) — confirmed by .pen mockup extraction. OFFNET has 4 (RECON, ATTACK, DEFENSE, UTILITIES).
- The TAK Server Config form is partially implemented; this spec rebuilds it to match the .pen mockup's 7-section full-width form layout.
- Weather data for the command bar and Weather widget comes from an existing or planned data source (Open-Meteo via GPS); if unavailable, the segment shows a placeholder.
- The Agent Chat panel uses the existing Agent Chat component architecture but restructures the template to match the .pen mockup's header/body/input layout.
- The Device Manager panel reuses existing device data from the Kismet/WiFi stores but restructures the template to match the .pen mockup's toolbar + 8-column table layout.
- All GSM Scanner states (empty, active, expanded) use full-width content mode — there is no sidebar on any GSM screen, confirmed by .pen mockup.
- The .pen mockup uses #4A8AF4 for interactive accents in the Device Manager and Agent Chat panels. This may map to an existing design token or be a dedicated "interactive blue" value distinct from the primary accent (#809AD0).

## Scope Boundaries

**In Scope**:

- Rebuilding Svelte component templates to match mockup layout structures
- Creating the shared dashboard shell as a layout component with sidebar and full-width content slots
- Restructuring the command bar content and segment order to match .pen mockup exactly
- Restructuring the bottom panel tab order (Terminal, Chat, Logs, Captures, Devices) and naming
- Creating screen-specific sidebar content components (System Overview, OFFNET/ONNET Tools, Map Layers, Settings, Hardware Config)
- Creating sidebar widget components (Speed Test, Network Latency, Weather, Node Mesh)
- Creating hardware dropdown components (WiFi, SDR, GPS) with exact row counts and content
- Rebuilding TAK Server Config as a full-width 7-section form
- Rebuilding GSM Scanner in three layout states (empty, active, expanded) — all full-width
- Rebuilding the Device Manager panel (Devices tab content) with toolbar + 8-column table
- Rebuilding the Agent Chat panel (Chat tab content) with header/body/input layout
- Implementing the Terminal Error Overlay as an error state within the terminal area

**Out of Scope**:

- CSS token changes (completed in spec 017)
- Font changes (completed in spec 017)
- New API routes or backend logic
- New data sources or hardware integrations
- Icon rail redesign (icon rail is unchanged — only content to its right)
- Map rendering changes (MapLibre GL configuration)
- Authentication or security changes
- Mobile/responsive layout (dashboard targets 1920×1080+ displays)
- The Reference — Color Palette frame in the .pen file (design reference only, not a UI component)

## Dependencies

- **spec-017** (Lunaris UI Unification) must be complete — provides the CSS token foundation. ✅ Complete.
- **pencil-lunaris.pen** design file — authoritative visual reference for all layout structures.
- Existing API endpoints for system metrics, hardware status, and tool configuration.
- Existing WebSocket infrastructure for real-time data push.
