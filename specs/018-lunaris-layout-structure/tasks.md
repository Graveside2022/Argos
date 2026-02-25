# Tasks: Lunaris Layout Structure

**Input**: Design documents from `/specs/018-lunaris-layout-structure/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md, quickstart.md

**Tests**: Component render tests required per Constitution Article 3.1/3.2. Each new component must have a `.test.ts` file verifying Empty, Error, and Default states render without error. Verification also includes `npm run build` + visual comparison against pencil-lunaris.pen mockups.

**Organization**: Tasks grouped by user story to enable independent implementation. Foundation phase (shell extraction) must complete before any user story work begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Token Extension)

**Purpose**: Extend the Lunaris design token set with surface-level, foreground, and interactive tokens required by all subsequent components.

- [ ] T001 Add surface tokens (--surface-elevated #151515, --surface-hover #1E1E1E, --surface-header #181818, --surface-inset #0D0D0D, --surface-terminal #0A0A0A, --overlay-backdrop #0E1116E6) and foreground tokens (--foreground-secondary #888888, --foreground-tertiary #999999, --foreground-muted #BBBBBB) and --interactive #4A8AF4 to `src/app.css` — add to :root dark mode block alongside existing Lunaris tokens
- [ ] T002 [P] Update `src/lib/styles/palantir-design-system.css` bridge to expose new tokens as component-level variables if needed
- [ ] T003 Update `src/lib/stores/dashboard/dashboard-store.ts` — change BottomTab type to `'terminal' | 'chat' | 'logs' | 'captures' | 'devices' | null`, update VALID_TABS array to match, update DEFAULT_BOTTOM_HEIGHT from 300 to 240; add graceful fallback for 'gsm-evil' in deserializer (map to null)
- [ ] T004 [P] Create `src/lib/components/dashboard/widgets/` directory (mkdir -p) for Phase 13 widget components
- [ ] T005 Verify all 13 palette themes still render correctly after token additions — run `npm run build`

---

## Phase 2: Foundational (DashboardShell Extraction)

**Purpose**: Extract the shared layout shell from `+page.svelte` into a reusable component with sidebar/full-width content modes. This is the structural backbone that ALL screen content plugs into.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Create `src/lib/components/dashboard/DashboardShell.svelte` with mode prop ('sidebar' | 'full-width'), Svelte 5 snippet slots (sidebar, content, fullWidth, bottomPanel), icon rail + command bar + content area layout per `contracts/dashboard-shell.md`
- [ ] T007 Update `src/lib/styles/dashboard.css` with shell layout CSS: .dashboard-shell (100vh flex row), .shell-right (flex column), .content-area (flex row for sidebar / block for full-width), .left-panel (280px, overflow-y: auto), .bottom-area
- [ ] T008 Refactor `src/routes/dashboard/+page.svelte` to use DashboardShell — move icon rail and top status bar rendering into the shell, pass existing panel content via snippet slots, derive mode from activeView store ('tak-config' | 'gsm-evil' → full-width, else → sidebar)
- [ ] T009 Update `src/lib/components/dashboard/PanelContainer.svelte` to enforce 280px fixed width and independent scroll (overflow-y: auto, overflow-x: hidden) per FR-016
- [ ] T010 Verify dashboard loads identically to pre-refactor state — run `npm run build` and confirm no visual regression

- [ ] T080 [P] Create `tests/unit/components/dashboard-shell.test.ts` — render DashboardShell in sidebar and full-width modes, verify no runtime errors, verify both content slots render child content

**Checkpoint**: DashboardShell renders the existing dashboard with sidebar mode. All existing panel/bottom panel/map functionality unchanged.

---

## Phase 3: User Story 2 — Command Bar (Priority: P1)

**Goal**: Restructure the command bar segment order to match FR-002: ARGOS brand → collection status → node callsign → spacer → latency → mesh → weather → date → Zulu time.

**Independent Test**: Navigate to any dashboard screen and verify the command bar renders all 9 segments in the correct left-to-right order with live data per `contracts/command-bar.md`.

### Implementation

- [ ] T011 [US2] Restructure `src/lib/components/dashboard/TopStatusBar.svelte` segment order: add ARGOS brand mark (Fira Code 14px 600 var(--primary), letter-spacing 2), collection status red dot indicator, node callsign segment; move hardware indicators to left group; add flex spacer; arrange right group as latency + mesh count + weather + date + Zulu time. If file exceeds 300 lines after changes, extract segment groups into child components (e.g., CommandBarLeftSegments.svelte, CommandBarRightSegments.svelte)
- [ ] T012 [US2] Add mesh node count segment to `src/lib/components/dashboard/TopStatusBar.svelte` — display "X/Y" connected/total format using TAK store data, with fallback "—/—" when no TAK connection
- [ ] T013 [US2] Add 1-second interval Zulu time update and date segment (DD MMM YYYY format, Fira Code 12px var(--muted-foreground), letter-spacing 0.5) to `src/lib/components/dashboard/TopStatusBar.svelte`
- [ ] T014 [US2] Verify command bar renders correctly on all screens with correct font/color per contracts — run `npm run build`

**Checkpoint**: Command bar shows all 9 segments. Hardware dropdowns still work. Zulu time ticks every second.

---

## Phase 4: User Story 3 — Bottom Panel with Tabbed Interface (Priority: P1)

**Goal**: Restructure bottom panel tab order to Terminal, Chat, Logs, Captures, Devices with Geist font labels and accent-colored active indicator.

**Independent Test**: Load dashboard, verify 5 tabs render in correct order. Click each tab — content switches without layout shift. Terminal scrollback preserved across tab switches.

**NOTE**: Store type update (BottomTab union) already completed in Phase 1 (T003).

### Implementation

- [ ] T015 [US3] Reorder tabs in `src/routes/dashboard/BottomPanelTabs.svelte` to: Terminal, Chat, Logs, Captures, Devices — rename "Kismet" to "Devices", remove "GSM Evil" tab, add "Captures" tab; update tab labels to Geist 14px font per `contracts/bottom-panel.md`
- [ ] T016 [US3] Create `src/lib/components/dashboard/panels/CapturesPanel.svelte` — minimal table layout with columns (Frequency, Power, Location, Time, Duration), empty state when no captures, data from `/api/signals` endpoint per `contracts/captures-panel.md`
- [ ] T017 [US3] Update `src/lib/components/dashboard/ResizableBottomPanel.svelte` to mount CapturesPanel in the Captures tab slot, verify mountedTabs Set preserves terminal scrollback (default height already updated to 240px in T003)
- [ ] T018 [P] [US3] Delete `src/lib/components/dashboard/panels/GsmEvilPanel.svelte` — orphaned after GSM Evil tab removal (GSM Scanner is now a full-screen view at `src/routes/gsm-evil/+page.svelte`); remove any imports referencing this file
- [ ] T019 [US3] Verify tab switching completes in < 100ms, terminal scrollback is preserved, and no layout shift — run `npm run build`

- [ ] T081 [P] Create `tests/unit/components/captures-panel.test.ts` — render CapturesPanel with empty data and with mock signal data, verify Empty state message and table header render

**Checkpoint**: Bottom panel shows 5 tabs. All tabs switch content correctly. Captures tab renders empty state or signal data.

---

## Phase 5: User Story 1 — System Overview Sidebar (Priority: P1) MVP

**Goal**: Restructure the System Overview sidebar to show 9 vertically stacked metric sections with hero metrics and progress bars per FR-003/FR-004.

**Independent Test**: Load dashboard at `/dashboard`, verify sidebar renders all 9 sections (CPU, Disk, Memory, Power, Network Status, Hardware, Tools, Services, Events Log) in correct vertical order with live data.

### Implementation

- [ ] T020 [US1] Restructure `src/lib/components/dashboard/panels/overview/SystemInfoCard.svelte` — add hero metric (24px font), progress bar, and 9px uppercase section header pattern per `contracts/sidebar-panels.md` for CPU, Disk, Memory sections
- [ ] T021 [P] [US1] Restructure `src/lib/components/dashboard/panels/overview/HardwareCard.svelte` — add device status dots (green/red) with text labels per FR-004, section header pattern
- [ ] T022 [P] [US1] Restructure `src/lib/components/dashboard/panels/overview/ServicesCard.svelte` — add connection indicators (running/stopped status) with section header pattern
- [ ] T023 [P] [US1] Restructure `src/lib/components/dashboard/panels/overview/GpsCard.svelte` — add Power and Network Status sections (IP, latency, DNS) with section header pattern
- [ ] T024 [US1] Update overview panel parent component to render all 9 sections in correct vertical order: CPU, Disk, Memory, Power, Network Status, Hardware, Tools, Services, Events Log — verify independent scroll in `src/lib/components/dashboard/panels/overview/`
- [ ] T025 [US1] Verify overview sidebar renders all sections with live data from systemHealth store and /api/system/services — run `npm run build`

**Checkpoint**: System Overview sidebar displays 9 metric sections with hero metrics, progress bars, and status indicators. Sidebar scrolls independently.

---

## Phase 6: User Story 12 — Device Manager (Priority: P2)

**Goal**: Restructure the Devices bottom panel tab to toolbar + 8-column data table layout per FR-020.

**Independent Test**: Click Devices tab, verify toolbar with search/filters and 8-column table render. Click a row — it receives selected styling.

### Implementation

- [ ] T026 [US12] Restructure `src/lib/components/dashboard/panels/DevicesPanel.svelte` (NOTE: file is at `panels/DevicesPanel.svelte`, sub-components in `panels/devices/`) — replace current layout with toolbar row (search input 200px, filter buttons 2.4G/5G/Hide No Signal with --surface-hover/--interactive active state, spacer, whitelist counter) + data table per `contracts/bottom-panel.md`
- [ ] T027 [US12] Update device table header in `src/lib/components/dashboard/panels/devices/DeviceTable.svelte` — 8 columns (MAC/NAME, RSSI, CHANNEL, TYPE, CLIENTS, ENCRYPTION, FIRST SEEN, ACTIONS) with --surface-header fill, Fira Code 10px 600 --foreground-secondary
- [ ] T028 [US12] Add row selection styling to device table in `src/lib/components/dashboard/panels/devices/DeviceTable.svelte` — selected row gets --surface-hover fill + 2px left --interactive accent border; add RSSI color-coding by signal band (Very Strong ≥-30: --status-healthy, Strong -30 to -50: --status-healthy, Moderate -50 to -60: --primary, Weak -60 to -70: --status-warning, Very Weak -70 to -80: --status-error-muted, No Signal <-80: --foreground-tertiary)
- [ ] T029 [US12] Verify Device Manager renders with toolbar and table from kismetStore data — run `npm run build`

**Checkpoint**: Devices tab shows toolbar with search, filters, and whitelist counter. Table renders 8 columns with selectable, color-coded rows.

---

## Phase 7: User Story 13 — Agent Chat (Priority: P2)

**Goal**: Restructure the Agent Chat bottom panel tab to header/body/input three-part layout per FR-021.

**Independent Test**: Click Chat tab, verify 36px header with bot icon, message body with distinct AI/user styles, and input bar with send button.

### Implementation

- [ ] T030 [US13] Restructure `src/lib/components/dashboard/AgentChatPanel.svelte` — replace current layout with 36px header (--card fill, bot icon --interactive, title, spacer, delete icon --muted-foreground), scrollable message body, and fixed input bar per `contracts/bottom-panel.md`
- [ ] T031 [US13] Update message styling in `src/lib/components/dashboard/AgentChatPanel.svelte` — AI messages get --surface-hover background cards (6px/12px padding), user messages get --card background with --border border
- [ ] T032 [US13] Update input bar in `src/lib/components/dashboard/AgentChatPanel.svelte` — --card fill, text input (32px height, --background fill, "Type a message..." placeholder Geist 13px --muted-foreground), 32x32px send button --interactive with white send icon
- [ ] T033 [US13] Verify Agent Chat renders header/body/input layout and existing SSE streaming still works — run `npm run build`

**Checkpoint**: Chat tab shows header with bot icon, distinct AI/user message styles, and input bar with send button. Streaming responses work.

---

## Phase 8: User Story 4 — OFFNET Tools Panel (Priority: P2)

**Goal**: Restructure OFFNET Tools sidebar with 4 category cards per FR-007.

**Independent Test**: Navigate to OFFNET Tools, verify back button and 4 cards (RECON, ATTACK, DEFENSE, UTILITIES) with names, descriptions, and tool counts.

### Implementation

- [ ] T034 [P] [US4] Restructure `src/lib/components/dashboard/panels/ToolsPanel.svelte` — add back button, "OFFNET" title, and 4 category cards (RECON, ATTACK, DEFENSE, UTILITIES) with --surface-elevated fill, --border bottom border, 8px/12px padding, showing category name, description, and dynamic tool count per `contracts/sidebar-panels.md`
- [ ] T035 [US4] Verify OFFNET Tools panel renders 4 cards with correct data from tools-store — run `npm run build`

**Checkpoint**: OFFNET Tools sidebar shows back button and 4 category cards with descriptions and tool counts.

---

## Phase 9: User Story 5 — Map Layers Panel (Priority: P2)

**Goal**: Restructure Map Layers sidebar to 4-section layout per FR-009.

**Independent Test**: Navigate to Map Layers, verify 4 sections: Map Provider tile selector, Visibility Filter buttons, Map Layers toggles, Signal Strength legend.

### Implementation

- [ ] T036 [P] [US5] Restructure `src/lib/components/dashboard/panels/LayersPanel.svelte` — reorganize into 4 sections: Map Provider (Tactical/Satellite tile selector with --primary 2px border on active), Visibility Filter (3-button row), Map Layers (toggle switches), Signal Strength legend (6 rows with colored dots and distance ranges) per `contracts/sidebar-panels.md`
- [ ] T037 [US5] Verify Map Layers panel renders all 4 sections with functional controls (tile selector switches map, toggles show/hide layers) — run `npm run build`

**Checkpoint**: Map Layers sidebar shows 4 organized sections. Tile selector and layer toggles function correctly.

---

## Phase 10: User Story 6 — Settings Panel (Priority: P2)

**Goal**: Restructure Settings sidebar to 4 category cards per FR-010.

**Independent Test**: Navigate to Settings, verify 4 cards (Appearance, Connectivity, Hardware, Logs & Analytics). Clicking Hardware navigates to sub-panel.

### Implementation

- [ ] T038 [P] [US6] Restructure `src/lib/components/dashboard/panels/SettingsPanel.svelte` — replace current layout with 4 category cards (Appearance, Connectivity, Hardware, Logs & Analytics) with descriptions, --surface-elevated fill, --border bottom border per `contracts/sidebar-panels.md`. If file exceeds 300 lines after changes, extract card content into a SettingsCategoryCard.svelte child component
- [ ] T039 [US6] Wire Hardware card click to navigate to HardwareConfigPanel (created in US7 phase) — add navigation state to panel container or settings panel
- [ ] T040 [US6] Verify Settings panel renders 4 cards with correct labels and descriptions — run `npm run build`

**Checkpoint**: Settings sidebar shows 4 category cards. Clicking cards navigates to appropriate settings section.

---

## Phase 11: User Story 9 — TAK Server Config Form (Priority: P2)

**Goal**: Rebuild TAK Server Config as a full-width 7-section scrollable form per FR-019.

**Independent Test**: Navigate to TAK Server Config, verify full-width layout (no sidebar), 48px header with status chip, 7 form sections, and Save button.

### Implementation

- [ ] T041 [US9] Restructure `src/lib/components/dashboard/tak/TakConfigView.svelte` — replace current layout with full-width form: 48px header bar (--surface-elevated fill, "TAK SERVER" title, connection status chip), scrollable body (24px/32px padding, 16px section gap) per `contracts/tak-config.md`
- [ ] T042 [US9] Implement 7 form sections in `src/lib/components/dashboard/tak/TakConfigView.svelte` — Status (connection indicator), Server (description + host/port + toggle), Authentication (import/enroll radio with --primary accent border), Client Certificate (file chooser + password + upload + notification), Trust Store (same pattern), Data Package (file chooser + import), Save button (--primary fill, Fira Code 12px 600). If file exceeds 300 lines, extract form sections into TakFormSection.svelte child components
- [ ] T043 [US9] Wire TAK Config view to shell full-width mode in `src/routes/dashboard/+page.svelte` — when activeView === 'tak-config', pass mode='full-width' to DashboardShell and render TakConfigView in fullWidth slot
- [ ] T044 [US9] Verify TAK form renders full-width with all 7 sections, existing validation and API calls still work — run `npm run build`

**Checkpoint**: TAK Config renders as a full-width form. All 7 sections present. Save action works. No sidebar visible.

---

## Phase 12: User Story 7 — Hardware Config Sub-Panel (Priority: P3)

**Goal**: Create Hardware Config sub-panel with 3 device category cards per FR-011.

**Independent Test**: Navigate to Settings → Hardware, verify back button, "HARDWARE" header, and 3 device cards (GPS, SDR, WiFi) with detected hardware and status dots.

### Implementation

- [ ] T045 [P] [US7] Create `src/lib/components/dashboard/panels/HardwareConfigPanel.svelte` — back button, "HARDWARE" header, 3 device category cards (GPS Devices, SDR Radios, WiFi Adapters) with --surface-elevated fill, detected device list from /api/hardware/details, status dots (green/red) with text labels per `contracts/sidebar-panels.md`
- [ ] T046 [US7] Wire HardwareConfigPanel into PanelContainer or SettingsPanel navigation — clicking Hardware card (from T039) renders this sub-panel with back navigation
- [ ] T047 [US7] Verify Hardware Config panel renders 3 device cards with live hardware data — run `npm run build`

- [ ] T082 [P] Create `tests/unit/components/hardware-config-panel.test.ts` — render HardwareConfigPanel with mock hardware data and with empty data, verify 3 device cards render and empty state works

**Checkpoint**: Hardware Config sub-panel shows 3 device cards with detected hardware. Back button returns to Settings.

---

## Phase 13: User Story 8 — Sidebar Widgets (Priority: P3)

**Goal**: Create 4 sidebar widgets (Speed Test, Network Latency, Weather, Node Mesh) with shared header/content/footer pattern per FR-012.

**Independent Test**: Verify widget components render at 264px width with correct layout. Place in System Overview sidebar below core metrics.

### Implementation

- [ ] T048 [P] [US8] Create `src/lib/components/dashboard/widgets/SpeedTestWidget.svelte` — 264px wide, --surface-elevated fill, --border border; header (SPEED TEST label, close icon), content (server info + DL/UL blocks with progress bars), footer (status dot + timestamp + "Retest" action) per `contracts/widgets.md`
- [ ] T049 [P] [US8] Create `src/lib/components/dashboard/widgets/NetworkLatencyWidget.svelte` — header (NETWORK LATENCY), content (server status row + latency block with progress bar + jitter/packet loss stats), footer (quality label + "Ping" action) per `contracts/widgets.md`
- [ ] T050 [P] [US8] Create `src/lib/components/dashboard/widgets/WeatherWidget.svelte` — header (WEATHER), content (source row + temperature block + conditions/wind/humidity/visibility rows), footer (sunrise/sunset times + "Refresh" action) per `contracts/widgets.md`
- [ ] T051 [P] [US8] Create `src/lib/components/dashboard/widgets/NodeMeshWidget.svelte` — header (NODE MESH + count), content (TAK Servers section with status list + divider + Peer Mesh section with callsign list), footer (mesh status + timestamp) per `contracts/widgets.md`
- [ ] T052 [US8] Integrate widgets into System Overview sidebar in overview panel parent — render below core metric sections, pass data from existing stores (systemHealth, gpsStore, takStore)
- [ ] T053 [US8] Verify all 4 widgets render correctly at 264px width with header/content/footer pattern — run `npm run build`

- [ ] T083 [P] Create `tests/unit/components/widgets.test.ts` — render all 4 widgets (SpeedTestWidget, NetworkLatencyWidget, WeatherWidget, NodeMeshWidget) with mock data and with no data, verify header/content/footer pattern renders

**Checkpoint**: 4 sidebar widgets render in System Overview with correct layout. Widgets receive data from existing stores.

---

## Phase 14: User Story 10 — GSM Scanner Layout (Priority: P3)

**Goal**: Restructure GSM Scanner page for 3 layout states (empty, active, expanded) — all full-width per FR-014.

**Independent Test**: Navigate to GSM Scanner in each state and verify correct panel structure.

### Implementation

- [ ] T054 [US10] Restructure `src/routes/gsm-evil/+page.svelte` empty state — 48px GSM header + "SCAN RESULTS" panel (--surface-inset fill, --border border) + "CONSOLE" panel (--card header, --surface-terminal body) per `contracts/gsm-scanner.md`. IMPORTANT: File is 291 lines; extract each state's panel content into child components (GsmEmptyState.svelte, GsmActiveState.svelte, GsmExpandedState.svelte in `src/lib/components/gsm-evil/`) to stay under 300-line limit
- [ ] T055 [US10] Restructure active state panel — GSM header + IMSI Capture Panel (data table with title row) + Live Frames Panel (36px --card header + 140px --surface-terminal body) in GsmActiveState.svelte
- [ ] T056 [US10] Restructure expanded state panel — full-width IMSI table + two stacked Live Frames panels, no sidebar, derive state from gsmEvilStore (empty/active/expanded) in GsmExpandedState.svelte
- [ ] T057 [US10] Wire GSM Scanner to shell full-width mode — when activeView === 'gsm-evil', pass mode='full-width' to DashboardShell; verify all 3 states render correctly in full-width content area
- [ ] T058 [US10] Verify GSM Scanner renders all 3 states correctly with live data — run `npm run build`

**Checkpoint**: GSM Scanner renders empty, active, and expanded states. All states use full-width mode. Existing scan/IMSI functionality preserved.

---

## Phase 15: User Story 11 — Status Bar Dropdown Menus (Priority: P3)

**Goal**: Restructure 3 hardware dropdown menus from command bar (WiFi 7 rows, SDR 6 rows, GPS 8 rows) per FR-013.

**Independent Test**: Click each hardware indicator in command bar, verify dropdown appears at 260px with correct title, row count, and styling.

### Implementation

- [ ] T059 [P] [US11] Restructure WiFi dropdown in `src/lib/components/dashboard/status/WifiDropdown.svelte` — 260px wide, --card fill, --border border, 4px radius, drop shadow; title "WIFI ADAPTER" (Fira Code 10px 600 --foreground-secondary, letter-spacing 1.5); 7 rows (Chipset, MAC, Driver, Interface, Mode, Bands, Used by) with Geist 12px labels and Fira Code 12px values per `contracts/dropdowns.md`
- [ ] T060 [P] [US11] Restructure SDR dropdown in `src/lib/components/dashboard/status/SdrDropdown.svelte` — same 260px pattern; title "SOFTWARE DEFINED RADIO"; 6 rows (Make, Model, Serial, FW API, USB, Used by) with "Used by" value in --status-healthy 600 weight per `contracts/dropdowns.md`
- [ ] T061 [P] [US11] Restructure GPS dropdown in `src/lib/components/dashboard/status/GpsDropdown.svelte` — same 260px pattern; title "GPS RECEIVER"; rows (Fix with color-coded status, Satellites, Speed, Accuracy, divider, Device, Protocol); Fix color: 3D=--status-healthy, 2D=--status-warning, None=--status-error-muted per `contracts/dropdowns.md`
- [ ] T062 [US11] Add click-outside close behavior and single-dropdown-at-a-time constraint — verify openDropdown state in TopStatusBar ensures only one dropdown visible
- [ ] T063 [US11] Verify all 3 dropdowns render with correct row counts and no-hardware empty state ("No device detected") — run `npm run build`

**Checkpoint**: WiFi (7 rows), SDR (6 rows), GPS (8 rows) dropdowns render from command bar. Only one dropdown open at a time. Empty states work.

---

## Phase 16: User Story 14 — Terminal Error Overlay (Priority: P3)

**Goal**: Create terminal error overlay with centered error card per FR-022.

**Independent Test**: Simulate terminal WebSocket failure, verify overlay appears over terminal content with icon, title, message, and recovery command.

### Implementation

- [ ] T064 [P] [US14] Rewrite `src/lib/components/dashboard/TerminalErrorOverlay.svelte` (file already exists with old --palantir-* tokens) — update to Lunaris tokens: --overlay-backdrop semi-transparent fill, centered card (32px padding): terminal icon (32px --muted-foreground), "Terminal Unavailable" title (Geist 16px 600), error message (Geist 14px --foreground-secondary), recovery command block (--card fill, --border border, Fira Code 14px --interactive link) per `contracts/bottom-panel.md`
- [ ] T065 [US14] Integrate TerminalErrorOverlay into `src/lib/components/dashboard/TerminalPanel.svelte` — render conditionally when WebSocket connection fails after max retries; overlay covers terminal content area only (not tab bar)
- [ ] T066 [US14] Verify overlay renders on connection failure and recovery link triggers reconnection — run `npm run build`

- [ ] T084 [P] Create `tests/unit/components/terminal-error-overlay.test.ts` — render TerminalErrorOverlay, verify icon/title/message/recovery-command elements present

**Checkpoint**: Terminal error overlay appears on WebSocket failure. Recovery command visible. Overlay covers only terminal content.

---

## Phase 17: User Story ONNET Tools (from US4 extension — FR-008)

**Goal**: Create ONNET Tools sidebar with 2 category cards per FR-008.

**Independent Test**: Navigate to ONNET Tools, verify back button with "TOOLS" in accent color, "ONNET" title, and 2 cards (RECON, ATTACK).

### Implementation

- [ ] T067 [P] [US4] Create `src/lib/components/dashboard/panels/OnnetToolsPanel.svelte` — back button (arrow-left + "TOOLS" in --primary), "ONNET" title (Fira Code 12px 600 --foreground-muted, letter-spacing 1.5), 2 category cards (RECON, ATTACK) with same --surface-elevated card pattern as OFFNET per `contracts/sidebar-panels.md`
- [ ] T068 [US4] Wire OnnetToolsPanel into icon rail / panel container — add ONNET Tools as a navigable panel, distinguish OFFNET vs ONNET via tools-store navigation path
- [ ] T069 [US4] Verify ONNET Tools panel renders 2 cards and navigation between OFFNET/ONNET works — run `npm run build`

- [ ] T085 [P] Create `tests/unit/components/onnet-tools-panel.test.ts` — render OnnetToolsPanel, verify 2 category cards render with back button

**Checkpoint**: ONNET Tools sidebar shows 2 category cards. Back navigation works. OFFNET/ONNET distinction is clear.

---

## Phase 18: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting polish, scroll behavior, edge cases, performance, and visual validation.

- [ ] T070 Ensure sidebar scrolls independently (overflow-y: auto) without affecting map or bottom panel in `src/lib/components/dashboard/PanelContainer.svelte` — test with long content in System Overview
- [ ] T071 [P] Handle edge cases in command bar: truncate long node callsigns with ellipsis, show "--" for missing weather/mesh data in `src/lib/components/dashboard/TopStatusBar.svelte`
- [ ] T072 [P] Handle bottom panel collapse edge case: when collapsed to minimum height, tab bar remains visible and content area hides in `src/lib/components/dashboard/ResizableBottomPanel.svelte`
- [ ] T073 [P] Handle no-hardware empty states in dropdowns: show "No device detected" row when WiFi/SDR/GPS hardware is not present in `src/lib/components/dashboard/status/`
- [ ] T074 [P] Update `src/lib/components/dashboard/IconRail.svelte` if tab reordering is needed — ensure Devices icon triggers bottom panel Devices tab (not a separate view)
- [ ] T075 Verify all modified files are under 300-line constitution limit — check TopStatusBar, SettingsPanel, gsm-evil/+page.svelte; split any that exceed
- [ ] T076 Perform build verification — run `npm run build` and `npx tsc --noEmit` to confirm zero errors
- [ ] T077 Visual regression — compare each dashboard screen against pencil-lunaris.pen mockups using pencil MCP screenshot tool; document any remaining gaps
- [ ] T078 Performance validation — verify < 3s initial load, < 100ms tab switch, < 200MB heap usage on Raspberry Pi 5
- [ ] T086 [P] Verify FR-015 (slot injection): audit all 11 dashboard screens to confirm NONE duplicate the shell structure (icon rail, command bar) — each screen must inject content through DashboardShell's snippet slots only. Check `src/routes/dashboard/+page.svelte` and `src/routes/gsm-evil/+page.svelte`
- [ ] T087 [P] Verify FR-017 (font consistency): grep all modified `.svelte` files for font-family declarations — confirm data sections use Fira Code (monospace) and tab/navigation chrome uses Geist (sans-serif). No component should hardcode font-family inline; must use CSS classes or design tokens
- [ ] T088 Verify FR-018 (preserve functionality): run `npm run test:unit` to confirm all existing tests pass. Manually verify: (1) WebSocket connections establish on dashboard load, (2) system health API data appears in overview cards, (3) hardware status indicators update in command bar, (4) terminal session connects and accepts input, (5) Kismet device data populates Devices tab
- [ ] T079 Run `.specify/scripts/bash/update-agent-context.sh claude` to sync agent context after all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US2 Command Bar (Phase 3)**: Depends on Foundational
- **US3 Bottom Panel (Phase 4)**: Depends on Foundational
- **US1 System Overview (Phase 5)**: Depends on Foundational
- **US12 Device Manager (Phase 6)**: Depends on US3 (bottom panel tab reorder)
- **US13 Agent Chat (Phase 7)**: Depends on US3 (bottom panel tab reorder)
- **US4 OFFNET Tools (Phase 8)**: Depends on Foundational
- **US5 Map Layers (Phase 9)**: Depends on Foundational
- **US6 Settings (Phase 10)**: Depends on Foundational
- **US9 TAK Config (Phase 11)**: Depends on Foundational (uses full-width mode)
- **US7 Hardware Config (Phase 12)**: Depends on US6 (Settings navigation)
- **US8 Sidebar Widgets (Phase 13)**: Depends on US1 (System Overview sidebar)
- **US10 GSM Scanner (Phase 14)**: Depends on Foundational (uses full-width mode)
- **US11 Dropdowns (Phase 15)**: Depends on US2 (Command Bar restructure)
- **US14 Terminal Error (Phase 16)**: Depends on US3 (Bottom Panel)
- **ONNET Tools (Phase 17)**: Depends on US4 (OFFNET Tools panel pattern)
- **Polish (Phase 18)**: Depends on all user stories complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation)
                        ↓
          ┌─────────────┼─────────────┬──────────────┬──────────┐
          ↓             ↓             ↓              ↓          ↓
     Phase 3 (US2)  Phase 4 (US3)  Phase 5 (US1)  Phase 8-10  Phase 11,14
     Cmd Bar        Bottom Panel   Overview        (US4-6)     (US9,US10)
          ↓             ↓             ↓              ↓
     Phase 15       Phase 6,7      Phase 13      Phase 12
     (US11 DD)      (US12,US13)    (US8 Widgets) (US7 HW)
          ↓             ↓             ↓              ↓
     Phase 17       ────────────────→ Phase 18 (Polish) ←───────
     (ONNET)
```

### Parallel Opportunities

After Phase 2 (Foundational) completes, the following can run in parallel:
- **Stream A**: US2 (Command Bar) → US11 (Dropdowns)
- **Stream B**: US3 (Bottom Panel) → US12 (Device Mgr) + US13 (Agent Chat) + US14 (Terminal Error)
- **Stream C**: US1 (Overview) → US8 (Widgets)
- **Stream D**: US4 (OFFNET) → ONNET, US5 (Layers), US6 (Settings) → US7 (HW Config)
- **Stream E**: US9 (TAK Config) + US10 (GSM Scanner)

---

## Parallel Example: Phase 13 (Sidebar Widgets)

```bash
# All 4 widgets can be created in parallel (different files, no dependencies):
T048: Create SpeedTestWidget.svelte
T049: Create NetworkLatencyWidget.svelte
T050: Create WeatherWidget.svelte
T051: Create NodeMeshWidget.svelte
# Then sequentially:
T052: Integrate widgets into overview panel
T053: Verify all widgets
```

## Parallel Example: Phase 15 (Dropdowns)

```bash
# All 3 dropdowns can be restructured in parallel (different files):
T059: Restructure WifiDropdown.svelte
T060: Restructure SdrDropdown.svelte
T061: Restructure GpsDropdown.svelte
# Then sequentially:
T062: Add click-outside behavior
T063: Verify all dropdowns
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (tokens)
2. Complete Phase 2: Foundational (DashboardShell)
3. Complete Phase 3: US2 (Command Bar)
4. Complete Phase 4: US3 (Bottom Panel)
5. Complete Phase 5: US1 (System Overview)
6. **STOP and VALIDATE**: The shared shell, command bar, bottom panel, and System Overview sidebar are fully functional. This is a usable dashboard.

### Incremental Delivery

1. **MVP** → Phases 1–5 (Shell + P1 stories) — 27 tasks (+T080, T081)
2. **+P2 Content** → Phases 6–11 (Device Mgr, Chat, OFFNET, Layers, Settings, TAK) — 22 tasks
3. **+P3 Polish** → Phases 12–17 (HW Config, Widgets, GSM, Dropdowns, Terminal Error, ONNET) — 26 tasks (+T082, T083, T084, T085)
4. **Final** → Phase 18 (Polish & verification) — 13 tasks (+T086, T087, T088)

### Total: 88 tasks across 18 phases

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after its phase
- Verify `npm run build` passes after each task
- Commit after each completed phase: `feat(ui): T0XX — description`
- All hex values MUST use design tokens from Phase 1 — no hardcoded colors in component markup
- Reference `contracts/` for exact prop interfaces and DOM structure
- Reference `pencil-lunaris.pen` via pencil MCP tools for pixel-level visual validation
