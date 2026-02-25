# Research: Lunaris Layout Structure

**Feature**: 018-lunaris-layout-structure
**Date**: 2026-02-25
**Phase**: 0 (all NEEDS CLARIFICATION resolved)

## R1: Shell Extraction Pattern

**Decision**: Create a `DashboardShell.svelte` component that wraps the icon rail, command bar, and content area with two named Svelte 5 snippet slots.

**Rationale**: The current `+page.svelte` (223 lines) mixes layout orchestration with view switching, panel toggling, and keyboard shortcuts. Extracting the structural shell into a dedicated component:

- Enforces the shared shell contract (every screen gets icon rail + command bar)
- Makes sidebar vs. full-width mode a prop-driven switch rather than ad-hoc CSS
- Keeps `+page.svelte` focused on state management and routing
- Follows Article 2.2 (single responsibility, < 300 lines)

**Alternatives considered**:

1. _SvelteKit layout route (`+layout.svelte`)_: Rejected — the dashboard is a single route with client-side view switching, not multiple routes. A layout route would require refactoring to multi-route, which is out of scope.
2. _CSS-only mode switching_: Rejected — the sidebar vs. full-width distinction involves different DOM structures (sidebar slot vs. full-width slot), not just CSS display changes.
3. _Keep everything in `+page.svelte`_: Rejected — already at 223 lines and growing. Shell extraction reduces it and enables reuse.

## R2: Sidebar vs. Full-Width Content Mode

**Decision**: The DashboardShell accepts a `mode` prop (`'sidebar' | 'full-width'`) that controls which content slot is rendered.

**Rationale**: 9 of 11 screens use sidebar mode (280px left panel + map/content right). 2 screens (TAK Config, GSM Scanner) use full-width mode. The mode is determined by `activeView` in the dashboard store:

- `activeView === 'tak-config'` → full-width
- `activeView === 'gsm-evil'` → full-width
- Everything else → sidebar

**Alternatives considered**:

1. _Dynamic sidebar width (0px for full-width)_: Rejected — full-width screens have different DOM content (form vs. map), not just a hidden sidebar.
2. _Separate routes for full-width screens_: Rejected — TAK Config and GSM Evil are already accessible via the icon rail view switcher. Breaking them into separate routes would break the back/escape navigation pattern.

## R3: #4A8AF4 Interactive Blue Token

**Decision**: Map `#4A8AF4` to a new `--interactive` CSS custom property, separate from `--primary` (#809AD0).

**Rationale**: The .pen mockup uses two distinct blue values:

- `#809AD0` (steel blue): Brand text, accent borders, save buttons, progress bars — the thematic primary
- `#4A8AF4` (vivid blue): Device Manager filter active state, Agent Chat send button, selected row accent — interactive controls

These serve different purposes. The primary accent is palette-swappable (13 themes), but interactive blue should remain constant for usability (clickable elements always look the same regardless of palette). If we merge them into `--primary`, changing the palette to "rose" or "sand" would make the Device Manager filter buttons pink or tan, which is confusing for interactive affordances.

**Alternatives considered**:

1. _Merge into `--primary`_: Rejected — palette swapping would change interactive control colors.
2. _Use Tailwind `blue-500`_: Rejected — no Tailwind color utilities in the design system (all custom properties).
3. _Use `--ring` or `--accent`_: Considered — `--ring` exists but is for focus rings. A dedicated `--interactive` token is clearer.

## R4: Bottom Panel Tab Names and Order

**Decision**: Tab order becomes: Terminal, Chat, Logs, Captures, Devices. Tab labels use Geist font.

**Rationale**: The .pen mockup specifies this exact order. Current order is: Terminal, Logs, GSM Evil, Kismet (Devices), Chat (hidden). Changes:

- "Kismet" renamed to "Devices" (operator-friendly, not tool-specific)
- "GSM Evil" removed from tabs (GSM scanner is a full-screen view, not a bottom panel tab)
- "Chat" moved from hidden to always-visible position 2
- "Captures" added as new tab (position 4) for RF signal captures

The GSM Evil panel content currently in the bottom panel (`GsmEvilPanel.svelte`, 121 lines) was a quick-access shortcut. With the full GSM Scanner view accessible from the icon rail, the bottom panel slot is freed for "Captures" which better matches the operational workflow.

**Alternatives considered**:

1. _Keep GSM Evil tab_: Rejected — the mockup doesn't include it, and it duplicates the full GSM view.
2. _Add Captures later_: Rejected — the mockup includes it, and the tab bar should match from the start.

## R5: Sidebar Widget Data Sources

**Decision**: Widgets are presentational components that receive data via props. No new stores or API calls.

**Rationale**: The 4 sidebar widgets (Speed Test, Network Latency, Weather, Node Mesh) display data that either:

- Already exists in stores (`systemHealth` for latency, `gpsStore` for weather location)
- Comes from existing API endpoints (`/api/weather/current`, `/api/system/metrics`)
- Will be fetched on demand (speed test "Retest" action triggers a one-shot API call)

Widgets don't own their data — they render what the parent passes. This keeps them testable (pass mock props), lightweight (no subscriptions), and reusable.

**Alternatives considered**:

1. _Widget-owned stores_: Rejected — violates single responsibility. Widgets should render, not fetch.
2. _Global widget store_: Rejected — over-engineering for 4 components that each show different data shapes.

## R6: GSM Scanner Layout States

**Decision**: The GSM Scanner page (`gsm-evil/+page.svelte`) uses a reactive state variable to switch between three layout templates.

**Rationale**: The three states have significantly different DOM structures:

- **Empty**: Header + "Scan Results" panel (empty body) + Console panel
- **Active**: Header + IMSI Capture Panel (data table) + Live Frames Panel
- **Expanded**: Header + IMSI table (full-width) + 2 stacked Live Frames panels

The state is derived from `gsmEvilStore`: empty (no scan results, no active scan), active (scanning or results exist), expanded (user toggles expand mode). The page already has state-dependent rendering — this refactoring aligns the DOM structures with the mockup.

**Alternatives considered**:

1. _Three separate Svelte components_: Rejected — they share the GSM header and state logic. Splitting would duplicate state management.
2. _CSS-only state switching_: Rejected — DOM structures differ too much (different child counts, different panel components).

## R7: Terminal Error Overlay Integration

**Decision**: `TerminalErrorOverlay.svelte` is a child of `TerminalPanel.svelte`, rendered conditionally when WebSocket connection fails.

**Rationale**: The overlay covers only the terminal content area (not the tab bar), so it must be positioned within the terminal panel's content container. The existing terminal WebSocket connection logic already tracks connection state and retry attempts via `TerminalTabContent.svelte`. The overlay renders when `connectionFailed === true` (after max retry attempts).

**Alternatives considered**:

1. _Global error overlay_: Rejected — the error is specific to the terminal, not system-wide.
2. _Toast notification_: Rejected — the mockup specifies a centered overlay with recovery guidance, not a transient toast.

## R8: Existing Component Size Compliance

**Research**: Several existing files exceed the 300-line limit (Article 2.2):

- `TopStatusBar.svelte`: 280 lines (close to limit)
- `TerminalTabBar.svelte`: 299 lines (at limit)
- `TerminalToolbar.svelte`: 270 lines
- `gsm-evil/+page.svelte`: 350+ lines (over limit)
- `SettingsPanel.svelte`: 296 lines (close to limit)

**Decision**: During refactoring, split any file that would exceed 300 lines post-modification. Priority targets:

- `gsm-evil/+page.svelte` (350+ → split into layout wrapper + state components)
- `TopStatusBar.svelte` (280 → may grow with new segments; extract segment components if needed)

## R9: Captures Panel Content

**Decision**: The Captures tab will initially render a minimal panel with column headers (Frequency, Power, Location, Time, Duration) and an empty state. It reads from the existing `/api/signals` endpoint and `rf_signals.db`.

**Rationale**: The .pen mockup includes a "Captures" tab but doesn't show detailed content. The signals database already stores captured RF data. A minimal table view with the existing data model is sufficient for Phase 1. Enhancement can follow in a future spec.

**Alternatives considered**:

1. _Skip Captures entirely_: Rejected — the mockup tab bar includes it. An empty placeholder breaks the layout contract.
2. _Full capture management UI_: Rejected — out of scope. Basic table view with existing data is sufficient.
