# Implementation Plan: Lunaris Design Parity

**Branch**: `019-design-parity` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/019-design-parity/spec.md`
**Codebase Reference**: [`docs/CODEBASE_MAP.md`](file:///home/kali/Documents/Argos/Argos/docs/CODEBASE_MAP.md) — canonical file path index

## Summary

Fix **40 discrepancies** across 8 areas between the Pencil Lunaris design (`pencil-lunaris.pen`) and the live Argos dashboard. The gap report identified systemic issues beyond the initial 7: (1) `--palantir-*` CSS variable namespace must be replaced with Lunaris tokens, (2) Icon Rail needs restructuring (remove Terminal/Chat, resize to 32px hit zones, switch to Lucide icons, fix active state), (3) Bottom Panel needs fixed named tabs replacing dynamic terminal sessions, (4) Widgets must be extracted from the sidebar, (5) Command Bar needs REC badge, NODE prefix, and compact dots. All changes are UI-only — no new APIs, no schema changes, no new dependencies.

> [!IMPORTANT]
> **Gap Report Reference:** See `gap_report.md` in the conversation artifacts for the complete 40-item discrepancy analysis with Pencil screenshots and code excerpts.
> **Pencil Export PNGs:** All 23 component screenshots now live in `specs/019-design-parity/screenshots/`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: SvelteKit 2, Svelte 5 (runes), Tailwind CSS v4
**Storage**: N/A (no data model changes)
**Testing**: Vitest (unit), visual comparison against Pencil screenshots
**Target Platform**: Chromium on RPi 5 (Kali Linux ARM64), 1440x900 viewport
**Project Type**: Web (SvelteKit monolith)
**Performance Goals**: Command bar render < 16ms, no additional network requests on initial load
**Constraints**: < 200MB heap, no new npm dependencies, no font additions
**Scale/Scope**: ~35 files modified (29 palantir migration + 6 feature changes), 0 files created (aside from tests), 1 file deleted (`palantir-design-system.css`), ~800 lines changed

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                   | Requirement                                  | Status | Notes                                                 |
| ------------------------- | -------------------------------------------- | ------ | ----------------------------------------------------- |
| I-1.1 Comprehension Lock  | End state, current state, problem identified | PASS   | Spec + visual audit complete                          |
| I-1.2 Codebase Inventory  | Search existing before modifying             | PASS   | Inventory below                                       |
| II-2.1 TypeScript Strict  | No `any`, strict mode                        | PASS   | No type changes needed                                |
| II-2.2 Modularity         | < 300 lines/file, < 50 lines/function        | PASS   | Changes are small edits to existing files             |
| II-2.3 Naming             | kebab-case files, camelCase vars             | PASS   | No new files beyond tests                             |
| II-2.6 Forbidden Patterns | No hardcoded hex                             | PASS   | All colors via design tokens                          |
| III-3.1 Test-First        | Tests before implementation                  | PASS   | Unit tests for store defaults and component rendering |
| IV-4.1 Design Language    | Lunaris system, Fira Code/Geist, steel blue  | PASS   | This spec IS about matching the design                |
| V-5.2 Load                | Initial load < 3s                            | PASS   | Removing text labels reduces DOM weight               |
| VI-6.3 Forbidden          | No npm install                               | PASS   | No new packages — chevron-down is inline SVG          |
| VIII-8.1 Security         | No secrets, validate inputs                  | PASS   | UI-only changes                                       |

**Gate result**: PASS — no violations.

## Codebase Inventory

### Files to Modify

| File                                                       | Purpose                    | Change                                                                                                                 |
| ---------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/lib/stores/dashboard/dashboard-store.ts`              | Panel state management     | Change `activePanel` default from `null` to `'overview'`; change `activeBottomTab` default from `null` to `'terminal'` |
| `src/lib/components/dashboard/TopStatusBar.svelte`         | Command bar component      | Remove text labels from hardware indicators; add REC badge; change callsign to ARGOS-1; add latency indicator          |
| `src/lib/components/dashboard/status/WifiDropdown.svelte`  | WiFi status in command bar | Remove `<span class="status-label">WiFi Adapter</span>`                                                                |
| `src/lib/components/dashboard/status/SdrDropdown.svelte`   | SDR status in command bar  | Remove `<span class="status-label">Software Defined Radio</span>`                                                      |
| `src/lib/components/dashboard/status/GpsDropdown.svelte`   | GPS status in command bar  | Remove text label, keep dot + sat count                                                                                |
| `src/routes/dashboard/BottomPanelTabs.svelte`              | Bottom panel tab bar       | Replace X close SVG with chevron-down; add fixed named tabs                                                            |
| `src/lib/components/dashboard/command-bar.css`             | Command bar styles         | Add `.rec-badge` styles; adjust `.status-label` removal                                                                |
| `src/lib/components/dashboard/icon-rail.css`               | Icon Rail styles           | Replace `--palantir-*` vars; resize hit zones to 32px; fix active state                                                |
| `src/lib/components/dashboard/ResizableBottomPanel.svelte` | Bottom panel container     | Remove drag handle; fix height to 240px; replace `--palantir-*` vars                                                   |
| `src/lib/components/dashboard/TerminalTabBar.svelte`       | Terminal tab bar           | Replace dynamic session tabs with fixed named tabs; replace `--palantir-*` vars                                        |
| `src/lib/components/dashboard/panels/OverviewPanel.svelte` | Overview sidebar           | Extract widgets to external placement; reorder sections                                                                |
| `src/lib/styles/palantir-design-system.css`                | Token bridge (DELETE)      | Delete `:root` var defs; migrate utility classes to Lunaris tokens; rename to `dashboard-utilities.css`                |
| `src/app.css`                                              | Root stylesheet            | Update import from `palantir-design-system.css` to `dashboard-utilities.css`                                           |
| `src/lib/styles/dashboard.css`                             | Dashboard layout           | Replace 9 `--palantir-*` refs with direct Lunaris tokens                                                               |
| + 26 additional dashboard component files                  | Palantir migration         | Replace all `var(--palantir-*)` refs with direct Lunaris tokens (see Phase 7 mapping table)                            |
| `src/lib/components/dashboard/status/dropdown.css`         | Dropdown panel styles      | Fix shadow, radius, width to match Lunaris spec                                                                        |

### Related Files (read-only reference)

| File                                                 | Purpose                                                 |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/lib/components/dashboard/DashboardShell.svelte` | Shell layout (verify `--panel-width` and `--card` vars) |
| `src/lib/components/dashboard/PanelContainer.svelte` | Panel container (reactive to `activePanel` store)       |
| `src/lib/components/status/TAKIndicator.svelte`      | TAK indicator (keep as-is, already compact)             |

### Existing Types/Patterns

- `DeviceState = 'active' | 'standby' | 'offline'` — already maps to dot colors
- `status-bar-data.ts` — already has `fetchHardwareStatus()` returning device states
- Dropdown pattern: `.device-wrapper` > `.status-item.device-btn` > `.status-dot` + `.status-label`
- All three hardware dropdowns (Wifi, SDR, GPS) follow identical structure

## Project Structure

### Documentation (this feature)

```text
specs/019-design-parity/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (below)
├── screenshots/         # Visual reference captures
│   ├── live-dashboard-before-cache-fix.png
│   ├── live-dashboard-default-state.png
│   └── live-dashboard-with-panels.png
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (files touched)

```text
src/
├── lib/
│   ├── stores/dashboard/
│   │   └── dashboard-store.ts         # FR-001, FR-002: default panel states
│   ├── components/dashboard/
│   │   ├── TopStatusBar.svelte        # FR-003–FR-005, FR-007: compact indicators
│   │   ├── command-bar.css            # Styling for compact dots, REC badge
│   │   └── status/
│   │       ├── WifiDropdown.svelte    # FR-003: remove text label
│   │       ├── SdrDropdown.svelte     # FR-003: remove text label
│   │       └── GpsDropdown.svelte     # FR-003: remove text label
│   └── styles/                        # Read-only reference
├── routes/dashboard/
│   └── BottomPanelTabs.svelte         # FR-006: chevron-down icon
tests/
└── unit/components/
    ├── dashboard-store-defaults.test.ts  # New: verify default states
    └── command-bar-compact.test.ts       # New: verify compact rendering
```

**Structure Decision**: All changes are edits to existing files in the established SvelteKit structure. Two new test files follow the existing `tests/unit/components/` convention.

## Implementation Phases

### Phase 1: Default Panel States (FR-001, FR-002) — P1

**Goal**: Dashboard loads with Overview panel and Terminal bottom panel visible.

**Changes**:

1. `dashboard-store.ts` line 7: Change `writable<string | null>(null)` to `writable<string | null>('overview')`
2. `dashboard-store.ts` line 14: Change `persistedWritable<BottomTab>('activeBottomTab', null, ...)` to `persistedWritable<BottomTab>('activeBottomTab', 'terminal', ...)`
3. For the bottom panel: the `persistedWritable` will load from localStorage first. If localStorage has `null`, the deserialized value stays `null`. Need to ensure the default `'terminal'` is used when no persisted value exists (not when the user explicitly set it to `null`). The current `deserialize` function returns `null` for unknown values but doesn't distinguish "never set" from "set to null". Solution: the `persistedWritable` helper checks localStorage — if the key doesn't exist at all, it uses the default. If the key exists with value `'null'`, it uses `null`. This is already how `persistedWritable` works (it only reads from storage if the key exists). So changing the default parameter is sufficient.

**Test**: Load `/dashboard` with cleared localStorage → both panels visible.

### Phase 2: Compact Hardware Indicators (FR-003) — P2

**Goal**: Replace text labels with dot-only indicators in command bar.

**Changes**:

1. `WifiDropdown.svelte` line 22: Remove `<span class="status-label">WiFi Adapter</span>`
2. `SdrDropdown.svelte`: Remove `<span class="status-label">Software Defined Radio</span>`
3. `GpsDropdown.svelte`: Remove text label, keep `GPS {sats} SAT` → change to just dot + small sat count badge
4. `command-bar.css`: Remove `.status-label` styles (or leave for dropdown internal use). Add tooltip on `.status-dot` hover to show device name.
5. Each `.device-btn` gets a `title="WiFi Adapter"` attribute for accessibility (hover tooltip replaces visual label).

**Design reference**: Pencil frame `nsKH5` shows 3 compact dots between callsign and spacer, each ~8px with 8px gap.

### Phase 3: REC Badge + Callsign (FR-004, FR-005) — P2

**Goal**: Add "REC" badge next to collection dot; fix callsign to show tactical ID.

**Changes**:

1. `TopStatusBar.svelte`: After the collection dot, add conditional `<span class="rec-badge">REC</span>` shown when any collection service is active (derive from existing `wifiState`, `sdrState`, `gpsState` — if any is `'active'`, show REC).
2. `TopStatusBar.svelte`: Change callsign from `{locationName || 'ARGOS-1'}` to just `{'ARGOS-1'}` (hardcoded default; future setting for callsign config is out of scope).
3. `command-bar.css`: Add `.rec-badge { color: var(--destructive); font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 1px; }` (uses `--destructive` = `#FF5C33` per Lunaris tokens).

### Phase 4: Network Latency Indicator (FR-007) — P2

**Goal**: Show current network latency in command bar right group.

**Changes**:

1. `TopStatusBar.svelte`: Add a periodic latency check (ping the gateway via the existing `/api/system/status` endpoint which already returns uptime — piggyback latency measurement on the response time of this existing call).
2. Display as `{latencyMs}ms` in the right group between coordinates and mesh count.
3. If no network, show `--ms`.

**Design reference**: Pencil shows `12ms` with a small wifi/signal icon.

### Phase 5: Bottom Panel Caret Icon (FR-006) — P3

**Goal**: Replace X close icon with chevron-down.

**Changes**:

1. `BottomPanelTabs.svelte` lines 66-76: Replace the X SVG path with chevron-down: `<polyline points="6 9 12 15 18 9" />`
2. Update `title` from "Close panel" to "Collapse panel".

### Phase 6: Tests — All

**New test files**:

1. `tests/unit/components/dashboard-store-defaults.test.ts`: Import `activePanel` and `activeBottomTab`, verify defaults are `'overview'` and `'terminal'`.
2. `tests/unit/components/command-bar-compact.test.ts`: Mount `WifiDropdown` with `deviceState='active'`, verify no `.status-label` element exists, verify `.status-dot` is rendered with correct class.

### Phase 7: CSS Variable Namespace Elimination (FR-009, FR-015, FR-016, FR-017) — P1

**Goal**: Eliminate the entire `--palantir-*` CSS variable namespace. Replace every reference across all 29+ dashboard component files with direct Lunaris tokens. Delete `palantir-design-system.css`.

**Migration mapping** (every `var(--palantir-*)` reference → direct Lunaris token):

| `--palantir-*` variable       | → Lunaris token                                       | Resolved value   |
| ----------------------------- | ----------------------------------------------------- | ---------------- |
| `--palantir-bg-app`           | `--background`                                        | `#111111`        |
| `--palantir-bg-chrome`        | `--background`                                        | `#111111`        |
| `--palantir-bg-surface`       | `--card`                                              | `#1A1A1A`        |
| `--palantir-bg-panel`         | `--card`                                              | `#1A1A1A`        |
| `--palantir-bg-elevated`      | `--surface-elevated`                                  | `#151515`        |
| `--palantir-bg-input`         | `--input`                                             | `#2E2E2E`        |
| `--palantir-bg-hover`         | `--surface-hover`                                     | `#1E1E1E`        |
| `--palantir-bg-button`        | `--secondary`                                         | `#2E2E2E`        |
| `--palantir-bg-header`        | `--surface-header`                                    | `#181818`        |
| `--palantir-bg-inset`         | `--surface-inset`                                     | `#0D0D0D`        |
| `--palantir-bg-terminal`      | `--surface-terminal`                                  | `#0A0A0A`        |
| `--palantir-overlay-backdrop` | `--overlay-backdrop`                                  | `#0E1116E6`      |
| `--palantir-border-subtle`    | `--border`                                            | `#2E2E2E`        |
| `--palantir-border-default`   | `--border`                                            | `#2E2E2E`        |
| `--palantir-border-strong`    | `--border`                                            | `#2E2E2E`        |
| `--palantir-text-primary`     | `--foreground`                                        | `#FFFFFF`        |
| `--palantir-text-secondary`   | `--foreground-muted`                                  | `#BBBBBB`        |
| `--palantir-text-tertiary`    | `--foreground-secondary`                              | `#888888`        |
| `--palantir-text-on-accent`   | `--primary-foreground`                                | `#111111`        |
| `--palantir-interactive`      | `--interactive`                                       | `#4A8AF4`        |
| `--palantir-accent`           | `--primary`                                           | `#A8B8E0`        |
| `--palantir-accent-hover`     | `--ring`                                              | `#666666`        |
| `--palantir-accent-muted`     | `color-mix(in srgb, var(--primary) 15%, transparent)` | —                |
| `--palantir-success`          | `--success`                                           | `#8BBFA0`        |
| `--palantir-warning`          | `--warning`                                           | `#D4A054`        |
| `--palantir-error`            | `--destructive`                                       | `#FF5C33`        |
| `--palantir-info`             | `--info`                                              | `#A8B8E0`        |
| `--palantir-signal-*`         | `--signal-*`                                          | (already direct) |
| `--palantir-chart-*`          | `--chart-*`                                           | (already direct) |

**Changes**:

1. All 29 dashboard component files (`.svelte` + `.css`): Find-and-replace every `var(--palantir-*)` with `var(--lunaris-equivalent)` per mapping table above.
2. `dashboard.css`: Replace 9 `--palantir-*` references with direct Lunaris tokens.
3. `palantir-design-system.css`: Delete the `:root` variable definition block (lines 12-106). Migrate utility classes (`.map-popup`, `.status-dot`, `.tactical-sidebar`, etc.) to use direct Lunaris tokens, then rename file to `dashboard-utilities.css`.
4. `app.css`: Update `@import './lib/styles/palantir-design-system.css'` to `@import './lib/styles/dashboard-utilities.css'`.
5. Verify `--font-sans` resolves to `Geist` and `--font-mono` resolves to `Fira Code` (already correct in `dashboard.css`).

**Scope**: ~206 replacements across 29 component files + 2 CSS files. ~400 lines changed.

### Phase 8: Icon Rail Restructuring (FR-010, FR-011, FR-012) — P2

**Goal**: Make the Icon Rail match Pencil frame `NHlPD` exactly.

**Changes**:

1. `IconRail.svelte`: Remove Terminal and Chat buttons from the rail. Add Logo (`waypoints`) icon between spacer and Layers. Add separator line before Settings.
2. `IconRail.svelte`: Resize hit zones from 40×40px to 48×32px.
3. `IconRail.svelte` + `icon-rail.css`: Replace active state `::before` left-bar pseudo-element with background fill `#ffffff14`.
4. `IconRail.svelte`: Replace inline SVG strings with Lucide icon references at 18×18px.
5. `icon-rail.css`: Update `--palantir-*` vars, set padding to 10px top/bottom, gap to 4px.

### Phase 9: Bottom Panel Tab Architecture (FR-013, FR-014) — P2

**Goal**: Replace dynamic terminal session tabs with fixed named tabs matching Pencil frame `sEDB5`.

**Changes**:

1. `ResizableBottomPanel.svelte`: Remove drag handle, fix height to 240px, remove resize logic.
2. `TerminalTabBar.svelte` / `BottomPanelTabs.svelte`: Replace dynamic session tab list with fixed named tabs: Terminal, Chat, Logs, Captures, Devices.
3. Active tab indicator: Replace background fill with 2px bottom border in `#809AD0`.
4. Tab font: Geist 14px weight 500, active color `#809AD0`, inactive `#BBBBBB`.
5. Tab bar height: 40px, padding 4px 12px, gap 4px.

### Phase 10: Widget Placement (FR-017 scope expansion) — P3

**Goal**: Extract widgets from OverviewPanel sidebar to standalone components.

**Changes**:

1. `OverviewPanel.svelte`: Remove SpeedTestWidget, NetworkLatencyWidget, WeatherWidget, NodeMeshWidget imports and `.widgets-container` div.
2. Determine new placement for widgets (future spec — may defer).

## Complexity Tracking

No constitution violations requiring justification. All changes are within existing file/function size limits.

## Risk Assessment

| Risk                                                             | Likelihood | Impact                       | Mitigation                                                                                                                                    |
| ---------------------------------------------------------------- | ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite cache serves stale TopStatusBar again                       | Medium     | High (invisible command bar) | Touch file after edits; document `rm -rf node_modules/.vite` in quickstart                                                                    |
| Persisted `null` in localStorage overrides new default           | Low        | Medium (panels don't open)   | `persistedWritable` already uses default when key missing; users with existing `null` will see closed panels until they clear storage         |
| Removing text labels confuses users unfamiliar with dot meanings | Low        | Low                          | Tooltip on hover; dropdown still shows full names on click                                                                                    |
| Latency indicator adds network request overhead                  | Low        | Low                          | Piggyback on existing `/api/system/status` call, no additional request                                                                        |
| `--palantir-*` elimination breaks non-dashboard components       | Medium     | Medium                       | Full grep confirms 206 refs across 29 files, all in `src/lib/components/dashboard/` + 2 CSS files. No non-dashboard usage. Safe to eliminate. |
| Icon Rail restructuring removes Terminal/Chat quick access       | Low        | Low                          | Terminal and Chat move to Bottom Panel fixed tabs; same functionality, different location                                                     |
| Fixed 240px bottom panel limits vertical space on small screens  | Low        | Medium                       | Design targets 1440×900; smaller viewports may need responsive rules in future spec                                                           |
