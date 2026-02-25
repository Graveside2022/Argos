# Quickstart: 019-design-parity

## What This Feature Does

Aligns the live Argos dashboard with the Pencil Lunaris design (`pencil-lunaris.pen`). Fixes **40 discrepancies** across 8 areas: CSS variable tokens, Icon Rail structure, Command Bar density, Overview Panel defaults, Map layout, Bottom Panel tabs, Widget placement, and Dropdown styling.

## Prerequisites

- Dev server running: `npm run dev`
- Chromium open to `http://localhost:5173/dashboard`
- Pencil design file accessible for visual comparison
- Pencil export PNGs in `screenshots/` for side-by-side reference

## Development Workflow

```bash
# 1. Clear Vite cache (prevents stale compilation issues found during audit)
rm -rf node_modules/.vite

# 2. Start dev server
npm run dev

# 3. Clear browser localStorage (test fresh defaults)
#    In browser console: localStorage.clear(); location.reload()

# 4. Run targeted tests
npx vitest run tests/unit/components/dashboard-store-defaults.test.ts
npx vitest run tests/unit/components/command-bar-compact.test.ts

# 5. Verify file-scoped types
npx tsc --noEmit src/lib/stores/dashboard/dashboard-store.ts
npx tsc --noEmit src/lib/components/dashboard/TopStatusBar.svelte
```

## Visual Verification

After implementation, compare these Pencil frames against the live dashboard:

| Pencil Frame                | Node ID | Screenshot File                            | What to Check                                     |
| --------------------------- | ------- | ------------------------------------------ | ------------------------------------------------- |
| Dashboard — System Overview | `ZQUdr` | `Dashboard — System Overview.png`          | Full layout: all 4 zones visible on load          |
| Icon Rail                   | `NHlPD` | `Icon Rail.png`                            | 6 icons + separator + spacer, 32px hit zones      |
| Command Bar                 | `nsKH5` | (in Right Area.png)                        | Compact dots, REC badge, callsign, latency, time  |
| Overview Panel              | `SydG2` | (in Dashboard — System Overview.png)       | Panel open by default, 280px width                |
| Bottom Panel                | `sEDB5` | (in Dashboard — System Overview.png)       | 5 fixed tabs, Terminal active, chevron-down caret  |
| Dashboard — OFFNET Tools    | `TWcPt` | `Dashboard — OFFNET Tools.png`             | Tool categories match                             |
| Dashboard — ONNET Tools     | `mVkzP` | `Dashboard — ONNET Tools.png`              | Tool categories match                             |
| Dashboard — Settings        | `1AY5e` | `Dashboard — Settings.png`                 | Settings categories match                         |
| Dashboard — Hardware Config | `4ZHnB` | `Dashboard — Hardware Config.png`          | Hardware sections match                           |
| Dashboard — TAK Server      | `D4cfM` | `Dashboard — TAK Server Config.png`        | TAK config form matches                           |
| WiFi Dropdown               | `kOTKu` | `Dropdown — WiFi Adapter.png`              | 260px, shadow, radius 4px                         |
| SDR Dropdown                | `E5ylj` | `Dropdown — SDR Radio.png`                 | 260px, shadow, radius 4px                         |
| GPS Dropdown                | `EOA6K` | `Dropdown — GPS Device.png`               | 260px, shadow, radius 4px                         |
| Device Manager              | `LFDvo` | `Panel — Device Manager.png`               | Table columns, toolbar                            |
| Agent Chat                  | `j0YYx` | `Panel — Agent Chat.png`                   | Chat layout, bubble styling                       |
| Terminal Error              | `hKXlP` | `Overlay — Terminal Error.png`             | Error overlay styling                             |

## CSS Variable Verification

After Phase 7 (CSS migration), verify these token values resolve correctly:

```bash
# Check no --palantir-* references remain in dashboard components
grep -r 'palantir' src/lib/components/dashboard/ --include='*.svelte' --include='*.css' -l
# Expected: empty output (zero files)
```

| Lunaris Token      | Expected Value | Where to Check                        |
|--------------------|---------------|---------------------------------------|
| `--sidebar`        | `#141414`     | Icon Rail background                  |
| `--card`           | `#151515`     | Command Bar, panels, terminal body    |
| `--border`         | `#2E2E2E`     | All 1px borders                       |
| `--foreground`     | `#E0E0E0`     | Primary text                          |
| Accent             | `#809AD0`     | Active nav, brand mark, selected tabs |
| Font sans          | `Geist`       | UI labels, tabs                       |
| Font mono          | `Fira Code`   | Command Bar data, terminal            |

## Key Files

| File                                                      | What Changes                                    |
| --------------------------------------------------------- | ----------------------------------------------- |
| `src/lib/stores/dashboard/dashboard-store.ts`             | Default panel states                            |
| `src/lib/components/dashboard/TopStatusBar.svelte`        | REC badge, callsign, latency                    |
| `src/lib/components/dashboard/status/WifiDropdown.svelte` | Remove text label                               |
| `src/lib/components/dashboard/status/SdrDropdown.svelte`  | Remove text label                               |
| `src/lib/components/dashboard/status/GpsDropdown.svelte`  | Remove text label                               |
| `src/routes/dashboard/BottomPanelTabs.svelte`             | Chevron-down + fixed named tabs                 |
| `src/lib/components/dashboard/command-bar.css`            | REC badge styles                                |
| `src/lib/styles/palantir-design-system.css`               | Map --palantir-* vars to Lunaris token values   |
| `src/lib/components/dashboard/IconRail.svelte`            | Restructure icons, resize, fix active state     |
| `src/lib/components/dashboard/icon-rail.css`              | Replace --palantir-* vars, 32px hit zones       |
| `src/lib/components/dashboard/ResizableBottomPanel.svelte`| Remove drag handle, fix height 240px            |
| `src/lib/components/dashboard/TerminalTabBar.svelte`      | Fixed named tabs replacing dynamic sessions     |
| `src/lib/components/dashboard/panels/OverviewPanel.svelte`| Extract widgets, reorder sections               |

## Gotchas

1. **Vite cache corruption**: If a component renders empty after edits, `touch` the `.svelte` file or `rm -rf node_modules/.vite`. This was discovered during the audit — TopStatusBar compiled to 970 bytes (should be ~31KB).
2. **localStorage persistence**: Existing users with `activeBottomTab=null` in localStorage will still see the panel closed. Clear localStorage or the `persistedWritable` key to test fresh defaults.
3. **No Material Symbols font**: The chevron-down caret uses inline SVG, not the Material Symbols Sharp icon font referenced in the Pencil design. This is intentional (consistency + no new font dependency).
4. **`--palantir-*` migration approach**: Update values in `palantir-design-system.css` rather than renaming every variable reference. This is the lowest-risk migration path.
5. **Terminal/Chat moving out of Icon Rail**: These buttons move to the Bottom Panel fixed tab bar. Verify both locations are updated simultaneously to avoid losing access.
