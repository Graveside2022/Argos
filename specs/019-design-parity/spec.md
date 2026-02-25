# Feature Specification: Lunaris Design Parity

**Feature Branch**: `019-design-parity`
**Created**: 2026-02-25
**Status**: Draft
**Input**: User description: "Fix dashboard default state and command bar alignment with pencil-lunaris.pen design"
**Codebase Reference**: [`docs/CODEBASE_MAP.md`](file:///home/kali/Documents/Argos/Argos/docs/CODEBASE_MAP.md) — canonical file path index

## Context

A visual audit comparing the Pencil design file (`pencil-lunaris.pen`, frame "Dashboard — System Overview") against the live Argos dashboard at `/dashboard` revealed significant discrepancies. The design represents the intended Lunaris UI specification completed in spec-018; the live app diverges primarily in **default state behavior** (what users see on first load) and **command bar content density**.

### Screenshot References

| Reference               | Description                               | Location                                                                               |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Pencil Full Dashboard   | Complete designed layout with all panels  | `pencil-lunaris.pen` frame `ZQUdr`                                                     |
| Codebase Map            | Canonical file index for all source paths | [`docs/CODEBASE_MAP.md`](file:///home/kali/Documents/Argos/Argos/docs/CODEBASE_MAP.md) |
| Pencil Overview Panel   | Overview panel with 9 data tiles          | `pencil-lunaris.pen` frame `SydG2`                                                     |
| Pencil Command Bar      | Command bar with compact indicators       | `pencil-lunaris.pen` frame `nsKH5`                                                     |
| Pencil Bottom Panel     | Terminal tab with tab bar                 | `pencil-lunaris.pen` frame `sEDB5`                                                     |
| Live — Before Cache Fix | Missing command bar (Vite cache bug)      | `screenshots/live-dashboard-before-cache-fix.png`                                      |
| Live — Default State    | Command bar visible, panels closed        | `screenshots/live-dashboard-default-state.png`                                         |
| Live — With Panels Open | Panels manually opened for comparison     | `screenshots/live-dashboard-with-panels.png`                                           |

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Dashboard Shows Complete Layout on Load (Priority: P1)

As an EW operator opening the Argos dashboard for the first time (or after a browser refresh), I see the full operational layout immediately — command bar at top, system overview panel on the left, map in the center, and terminal panel at the bottom — without needing to click any icons.

**Why this priority**: The dashboard is the primary operational interface. Operators in field conditions cannot spend time discovering which icons to click to assemble the standard layout. The design assumes a "ready state" on load.

**Independent Test**: Load `/dashboard` in a fresh browser (cleared localStorage). Verify all four zones (command bar, overview panel, map area, bottom terminal panel) are visible without any user interaction.

**Acceptance Scenarios**:

1. **Given** a fresh browser session with no persisted state, **When** the user navigates to `/dashboard`, **Then** the Overview panel (280px left sidebar) is visible with the "SYSTEM OVERVIEW" header and all data tiles.
2. **Given** a fresh browser session, **When** the dashboard loads, **Then** the bottom panel is open at 240px fixed height showing the Terminal tab as active.
3. **Given** an existing session where the user previously closed the overview panel, **When** the user refreshes the page, **Then** the overview panel returns to its open default state (non-persisted preference — always opens on load).
4. **Given** the user clicks the Overview icon to close the panel, **When** the panel closes, **Then** the map expands to fill the freed space and the icon state updates to "inactive."

---

### User Story 2 — Command Bar Matches Design Density (Priority: P2)

As an EW operator, the command bar at the top of the dashboard shows a compact, information-dense status line that matches the Lunaris design — with abbreviated hardware indicators (dot-only), a callsign identifier, and status segments for network latency, mesh count, weather, date, and Zulu time.

**Why this priority**: The command bar is always visible and provides at-a-glance situational awareness. Its current text-heavy hardware labels waste horizontal space and diverge from the designed compact aesthetic.

**Independent Test**: Compare the live command bar against the Pencil design frame `nsKH5`. Every element (brand mark, collection dot, callsign, hardware dots, latency, mesh, weather, date, time) should be present and visually match.

**Acceptance Scenarios**:

1. **Given** hardware is detected (WiFi, SDR, GPS), **When** the command bar renders, **Then** each hardware type shows as a colored status dot only (no text label), matching the design's compact indicator style.
2. **Given** the dashboard loads, **When** the command bar renders, **Then** it shows a "REC" badge (red text `#FF5C33`) next to the collection status dot when data collection is active.
3. **Given** the dashboard loads, **When** the command bar renders, **Then** the callsign field shows the configured tactical identifier (defaulting to "ARGOS-1") rather than a reverse-geocoded location name.
4. **Given** GPS has a fix and network connectivity exists, **When** the command bar renders, **Then** the right side shows: GPS coordinates, network latency value, mesh node count, weather, date in MIL-DTG format, and Zulu time.

---

### User Story 3 — Bottom Panel Collapse Uses Design Caret Icon (Priority: P3)

As an operator, the bottom panel's collapse control uses a downward caret icon (matching the Pencil design) instead of an "X" close button, communicating "minimize" rather than "dismiss."

**Why this priority**: Minor visual polish. The caret communicates that the panel slides down (minimizes) rather than being destroyed. This matches the design specification's use of Material Symbols Sharp `keyboard_arrow_down`.

**Independent Test**: Open the terminal bottom panel and verify the collapse control shows a downward caret icon, not an "X."

**Acceptance Scenarios**:

1. **Given** the bottom panel is open, **When** the user looks at the top-right area of the tab bar, **Then** a downward caret icon is displayed (not an "X" or close button).
2. **Given** the bottom panel is open, **When** the user clicks the caret, **Then** the panel slides down/closes smoothly.

---

### User Story 4 — CSS Variable Namespace Matches Lunaris Tokens (Priority: P1)

As an EW operator, the dashboard uses the Lunaris design system colors consistently — every panel, border, and text element uses the correct Lunaris token values (`$--sidebar=#18181b`, `$--card=#1A1A1A`, `$--border=#2E2E2E`, accent `var(--primary)` = `#A8B8E0` for Blue palette) instead of the divergent `--palantir-*` variable namespace.

**Why this priority**: The `--palantir-*` CSS variables are the root cause of 90% of the visual discrepancies. Every component references these variables for backgrounds, borders, and text colors, producing different values than the Lunaris design.

**Independent Test**: Inspect any dashboard component's computed styles and verify background/border/text colors match Lunaris token values exactly.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** inspecting the Icon Rail background, **Then** it resolves to `#18181b` (via `var(--sidebar)`, not `--palantir-bg-chrome`).
2. **Given** the dashboard loads, **When** inspecting any panel border, **Then** it resolves to `#2E2E2E` (via `var(--border)`, not `--palantir-border-subtle`).
3. **Given** an active icon or tab, **When** inspecting its color, **Then** it resolves to `var(--primary)` (`#A8B8E0` for Blue palette — the Lunaris accent).

---

### User Story 5 — Icon Rail Matches Lunaris Layout (Priority: P2)

As an EW operator, the Icon Rail shows exactly the icons specified in the Lunaris design — Overview, Devices, Tools, then a spacer, then Logo, Layers, separator, and Settings — using Lucide icon fonts at 18×18px in 32px hit zones with a subtle fill-based active state.

**Why this priority**: The current Icon Rail has Terminal and Chat buttons that don't exist in the design. Those functions belong in the Bottom Panel tab bar.

**Independent Test**: Compare the live Icon Rail against Pencil frame `NHlPD` — icons, order, sizing, active state treatment.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** viewing the Icon Rail, **Then** it contains exactly: Overview, Devices, Tools, [spacer], Logo, Layers, [separator], Settings.
2. **Given** the Overview icon is active, **When** viewing its style, **Then** it has a `#ffffff14` background fill (not a left-bar pseudo-element).
3. **Given** any icon button, **When** measuring its size, **Then** it is 32px tall (not 40px).

---

### User Story 6 — Bottom Panel Uses Fixed Named Tabs (Priority: P2)

As an EW operator, the bottom panel has a fixed set of named tabs — Terminal, Chat, Logs, Captures, Devices — matching the Lunaris design, with a 240px fixed height and no drag-to-resize handle.

**Why this priority**: The current bottom panel uses dynamic terminal session tabs and is resizable. The Lunaris design specifies fixed named tabs that switch between integrated views (terminal, chat, logs, device list, captures).

**Independent Test**: Open the bottom panel and verify all 5 named tabs are visible with Terminal selected by default.

**Acceptance Scenarios**:

1. **Given** the bottom panel is open, **When** viewing the tab bar, **Then** it shows: Terminal, Chat, Logs, Captures, Devices, +, and ▽ (collapse caret).
2. **Given** the Terminal tab is active, **When** viewing its indicator, **Then** it has a 2px bottom border in `#809AD0`.
3. **Given** the bottom panel, **When** attempting to resize, **Then** there is no drag handle — the height is fixed at 240px.

---

### User Story 7 — Widgets Are Standalone Components (Priority: P3)

As a developer, the Speed Test, Network Latency, Weather, and Node Mesh widgets are standalone 264px-wide components — not embedded inside the Overview Panel sidebar.

**Why this priority**: The current code stuffs all 4 widgets inside the sidebar's scroll area, changing the layout structure. In the Lunaris design, these are independent frames.

**Independent Test**: Verify widgets are not children of the OverviewPanel component.

---

### Edge Cases

- What happens when localStorage has a persisted `activeBottomTab` of `null` from a previous session? The default should still open the Terminal tab on fresh loads.
- What happens when the Vite dev server has a stale compilation cache for a Svelte component? The system should detect empty compiled output and warn (or auto-invalidate).
- What happens on a narrow viewport (< 768px) where the command bar can't fit all compact indicators? Responsive rules should hide lower-priority segments (coordinates, date) as designed.
- What happens when GPS has no fix? The "REC" badge should still appear if any hardware is active (it is independent of GPS). The coordinates segment should be hidden.

### Known Accessibility Trade-offs (WCAG AA)

The Lunaris dark aesthetic produces several color combinations below WCAG AA contrast ratios. These are acknowledged design decisions:

| Element                           | Colors             | Contrast | WCAG AA                    | Decision                                               |
| --------------------------------- | ------------------ | -------- | -------------------------- | ------------------------------------------------------ |
| Section headers (CPU, DISK, etc.) | #888888 on #151515 | 4.07:1   | FAIL (needs 4.5:1 for 9px) | Accept — uppercase + letter-spacing aids readability   |
| Muted text (dates, secondary)     | #666666 on #1A1A1A | 2.84:1   | FAIL                       | Accept — paired with primary text above                |
| Inactive text                     | #555555 on #111111 | 2.45:1   | FAIL                       | Accept — per CLAUDE.md, inactive always has text label |
| REC badge                         | #FF5C33 on #1A1A1A | 3.64:1   | FAIL at 10px               | Accept — paired with red dot visual indicator          |

### Deferred to Future Specs

These Pencil design elements are NOT in scope for this spec:

- **Terminal Unavailable overlay** (Pencil frame `hKXlP`) — error state styling deferred
- **Agent Chat panel content** (Pencil frame `j0YYx`) — chat UI deferred
- **Device Manager table content** (Pencil frame `LFDvo`) — table UI deferred
- **Custom map zoom controls** (28x28px buttons at map bottom-right) — map controls deferred
- **Map grid overlay** (4×4 subtle lines at #1A1A1A) — decorative element deferred
- **Widget extraction from Overview Panel** (Phase 10) — deferred; widgets remain in sidebar to avoid UI disappearance
- **Bottom panel "Network Map" tab variant** visible in some Pencil frames — tab set is fixed as: Terminal, Chat, Logs, Captures, Devices

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Overview panel MUST default to open (`activePanel = 'overview'`) when the dashboard loads with no persisted state.
- **FR-002**: The bottom panel MUST default to the Terminal tab open at 240px height when the dashboard loads with no persisted state.
- **FR-003**: The command bar MUST display hardware status as compact dot indicators (colored circles: green for active, amber for standby, gray for offline) without text labels like "WiFi Adapter" or "Software Defined Radio."
- **FR-004**: The command bar MUST display a "REC" badge (red text `#FF5C33`) adjacent to the collection status dot when active data collection is occurring.
- **FR-005**: The command bar callsign field MUST display the system's configured tactical identifier (default: "ARGOS-1"), not a reverse-geocoded location name.
- **FR-006**: The bottom panel collapse control MUST use a downward caret icon instead of an "X" close icon.
- **FR-007**: The command bar right group MUST include a network latency indicator showing current ping time in milliseconds.
- **FR-008**: When the Vite dev server compiles a Svelte component to an empty output (< 2KB for a component with a template), the system SHOULD log a warning to help developers identify stale cache issues.
- **FR-009**: All dashboard CSS MUST use Lunaris design tokens directly (`--sidebar`, `--card`, `--border`, `--foreground`, `--primary`, etc.) instead of `--palantir-*` variables. The `palantir-design-system.css` bridge file MUST be deleted and all **32 consumer files** (231 `var(--palantir-*)` references) plus the bridge file's own 61 internal references (292 total `var(--palantir-*)` across 33 files) MUST be migrated to direct Lunaris token references. Additionally, 1 `class="palantir-popup"` reference (FR-019), 1 `@import` path in `app.css`, 1 duplicate import in `+page.svelte`, and 1 comment in `src/lib/map/layers/symbol-layer.ts` must also be cleaned — bringing the total "palantir" mentions to **295 across 36 files**. This includes `src/lib/components/status/TAKIndicator.svelte` (12 refs) and `src/routes/dashboard/dashboard-page.css` (1 ref) which are outside the `dashboard/` directory.
- **FR-009a**: The non-palantir tokens defined in `palantir-design-system.css` `:root` block (`--space-*`, `--text-*`, `--font-weight-*`, `--letter-spacing-*`) MUST be migrated to `app.css` BEFORE the bridge file `:root` block is deleted. These tokens have 274 references across 40+ files and deleting them without migration would break the entire UI.
- **FR-009b**: The `--radius-sm/md/lg/xl` tokens in `palantir-design-system.css` (fixed values: 4px, 6px, 8px, 12px) conflict with `app.css` `@theme inline` definitions (computed values: 6.4px, 8.4px, 10.4px, 14.4px). The bridge file values MUST be preserved as the authoritative source since components were built against them. Migrate fixed-value radius definitions to `app.css` and remove the conflicting `calc()` definitions.
- **FR-009c**: The `--palantir-accent-muted` token uses `color-mix(in srgb, var(--primary) 15%, transparent)` which is not a simple variable swap. A new `--accent-muted` token MUST be defined in `app.css` `:root` with this expression, and all
  `var(--palantir-accent-muted)` usages replaced with `var(--accent-muted)`.
- **FR-010**: The Icon Rail MUST contain exactly these items in order: Overview (`house`), Devices (`list`), Tools (`zap`), [spacer], Logo (`waypoints`), Layers (`layers`), [separator line], Settings (`settings`). Terminal and Chat buttons MUST NOT appear in the rail.
- **FR-011**: Icon Rail hit zones MUST be 48px wide × 32px tall with 4px corner radius. Active state MUST use background fill `#ffffff14` (not a left-bar pseudo-element).
- **FR-012**: All dashboard icons MUST use `@lucide/svelte` component imports (already installed, v0.561.0) at 18×18px, replacing inline SVG strings. No new dependency required.
- **FR-013**: The bottom panel MUST have a fixed height of 240px with no drag-to-resize handle.
- **FR-014**: The bottom panel tab bar MUST contain fixed named tabs: Terminal, Chat, Logs, Captures, Devices. The active tab indicator MUST be a 2px bottom border in `var(--primary)` (`#A8B8E0` for Blue palette). (Note: the Pencil design used `#809AD0` which maps to `--signal-weak`, not `--primary`. Using `var(--primary)` ensures palette switching works — see FR-017 note.)
- **FR-015**: The Icon Rail background MUST be `var(--sidebar)` which resolves to `#18181b`, not `#111111` or `--palantir-bg-chrome`. (Note: previous draft incorrectly stated `#141414`; the actual `--sidebar` token value is `#18181b`.)
- **FR-016**: Font families MUST resolve to `Geist` (sans) and `Fira Code` (mono) explicitly.
- **FR-017**: The command bar brand mark "ARGOS" MUST use color `var(--primary)` (`#A8B8E0` for Blue palette), Fira Code 14px, weight 600, letter-spacing 2px. (Note: the Pencil design used `#809AD0` which maps to `--signal-weak`/`--feature-drone`, not `--primary`. The accent MUST use `var(--primary)` so it responds to palette switching.)
- **FR-018**: The TAK indicator in the command bar (`src/lib/components/status/TAKIndicator.svelte`) is NOT present in the Pencil design. It MUST be retained in the live implementation as it provides critical operational status for TAK Server connectivity. Its 12 `--palantir-*` references MUST be migrated alongside dashboard components.
- **FR-019**: The `class="palantir-popup"` CSS class in `DashboardMap.svelte` line 257 MUST be renamed to `class="map-popup"` (matching the existing `.map-popup` utility class) as part of the namespace elimination.

## Assumptions

- The Pencil design file (`pencil-lunaris.pen`) is the authoritative visual reference for the Lunaris UI specification.
- The "REC" badge (red text `#FF5C33`, via `var(--destructive)`) appearance is tied to any active data collection service (Kismet scanning, GPS tracking, HackRF sweep) — if at least one is running, show "REC."
- The callsign "ARGOS-1" is the implementation default; future work may make this user-configurable via Settings.
- Network latency is measured as the HTTP round-trip time of the existing `/api/system/status` health check (not ICMP ping). This measures approximate request RTT including server processing, not pure network latency. Sufficient for at-a-glance situational awareness; on localhost it will show ~1-5ms.
- The overview panel default-open behavior overrides any previously persisted `null` state.
- The `--palantir-*` CSS variable namespace (**292 `var(--palantir-*)` references across 33 files**; 295 total "palantir" mentions across 36 files when including class names, import paths, and comments) will be fully eliminated and replaced with direct Lunaris tokens. `palantir-design-system.css` will be deleted (utility classes migrated to `dashboard-utilities.css`). **Note**: `TAKIndicator.svelte` (in `src/lib/components/status/`, not dashboard/) has 12 `--palantir-*` refs and MUST be included in migration scope.
- The non-palantir tokens defined in `palantir-design-system.css` `:root` block (`--space-*`, `--text-*`, `--font-weight-*`, `--letter-spacing-*`, `--radius-*`) are used by **274 references across 40+ files**. These MUST be migrated to `app.css` or the renamed `dashboard-utilities.css` BEFORE the `:root` block is deleted.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On first load in a fresh browser, all four dashboard zones (command bar, overview panel, map, bottom terminal panel) are visible within 3 seconds without user interaction.
- **SC-002**: The command bar occupies no more than 40px vertical height and fits all indicator segments without wrapping on a 1440px-wide viewport.
- **SC-003**: 100% visual alignment with the Pencil design file for the command bar layout — every element present in design frame `nsKH5` has a corresponding rendered element.
- **SC-004**: Hardware status indicators reduce horizontal space usage by at least 60% compared to current text-label implementation.
- **SC-005**: The bottom panel caret icon matches the chevron-down glyph from the Pencil design.
- **SC-006**: Zero `--palantir-*` CSS variable references remain in any dashboard component file.
- **SC-007**: Icon Rail contains exactly 6 icon buttons + 1 separator + 1 spacer, matching Pencil frame `NHlPD`.
- **SC-008**: Bottom panel tab bar contains 5 fixed named tabs matching Pencil frame `sEDB5`.
