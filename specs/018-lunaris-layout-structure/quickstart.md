# Quickstart: Lunaris Layout Structure

**Feature**: 018-lunaris-layout-structure
**Branch**: `018-lunaris-layout-structure`
**Prereq**: spec-017 complete (Lunaris CSS tokens in place)

## What This Spec Does

Rebuilds Svelte component templates to match the pencil-lunaris.pen mockup layouts. Spec-017 replaced the "paint" (colors, fonts, tokens). This spec replaces the "walls" (component hierarchy, content slots, screen-specific panels).

## Key Architecture Decisions

1. **DashboardShell** — New shared layout component with two content modes:
    - `sidebar` mode (9 screens): 280px left panel + fill-width map/content
    - `full-width` mode (2 screens): TAK Config form, GSM Scanner
    - Shell owns: icon rail, command bar, content area, bottom panel frame

2. **Slot-based content injection** — Screen-specific sidebar content injected via Svelte 5 snippet slots. No screen duplicates the shell structure.

3. **Token extension** — ~10 new CSS custom properties added to `src/app.css`:
    - Surface: `--surface-elevated` (#151515), `--surface-hover` (#1E1E1E), `--surface-header` (#181818), `--surface-inset` (#0D0D0D), `--surface-terminal` (#0A0A0A), `--overlay-backdrop` (#0E1116E6)
    - Foreground: `--foreground-secondary` (#888888), `--foreground-tertiary` (#999999)
    - Interactive: `--interactive` (#4A8AF4) — palette-independent interactive blue

4. **Bottom panel tabs** reordered: Terminal → Chat → Logs → Captures → Devices. "GSM Evil" tab removed (full-screen view only). "Captures" tab added.

5. **Widgets** — 4 presentational sidebar widgets (Speed Test, Network Latency, Weather, Node Mesh). Props-driven, no stores.

6. **Hardware dropdowns** — 3 popup menus from command bar (WiFi 7 rows, SDR 6 rows, GPS 8 rows).

## File Map

### New Files (11)

```
src/lib/components/dashboard/DashboardShell.svelte         # Shell layout
src/lib/components/dashboard/panels/OnnetToolsPanel.svelte  # ONNET sidebar
src/lib/components/dashboard/panels/HardwareConfigPanel.svelte  # HW config sub-panel
src/lib/components/dashboard/panels/CapturesPanel.svelte    # Captures tab content
src/lib/components/dashboard/widgets/SpeedTestWidget.svelte
src/lib/components/dashboard/widgets/NetworkLatencyWidget.svelte
src/lib/components/dashboard/widgets/WeatherWidget.svelte
src/lib/components/dashboard/widgets/NodeMeshWidget.svelte
src/lib/components/gsm-evil/GsmEmptyState.svelte           # GSM Scanner state components
src/lib/components/gsm-evil/GsmActiveState.svelte
src/lib/components/gsm-evil/GsmExpandedState.svelte
```

### Modified Files (~18)

```
src/app.css                                           # Token extensions
src/lib/styles/dashboard.css                          # Layout dimensions
src/lib/stores/dashboard/dashboard-store.ts           # BottomTab type + height
src/routes/dashboard/+page.svelte                     # Use DashboardShell
src/routes/dashboard/BottomPanelTabs.svelte           # Tab reorder
src/lib/components/dashboard/TopStatusBar.svelte      # Segment restructure
src/lib/components/dashboard/PanelContainer.svelte    # Sidebar enforcement
src/lib/components/dashboard/ResizableBottomPanel.svelte  # Tab reorder
src/lib/components/dashboard/TerminalPanel.svelte     # Error overlay integration
src/lib/components/dashboard/TerminalErrorOverlay.svelte  # Rewrite: old tokens → Lunaris
src/lib/components/dashboard/AgentChatPanel.svelte    # Header/body/input layout
src/lib/components/dashboard/panels/overview/*        # Hero metrics + section order
src/lib/components/dashboard/panels/ToolsPanel.svelte # OFFNET 4-card
src/lib/components/dashboard/panels/LayersPanel.svelte # 4-section layout
src/lib/components/dashboard/panels/SettingsPanel.svelte # 4 category cards
src/lib/components/dashboard/panels/DevicesPanel.svelte   # Toolbar + 8-col table
src/lib/components/dashboard/status/*                 # Dropdown restructure
src/lib/components/dashboard/tak/TakConfigView.svelte # Full-width 7-section form
src/routes/gsm-evil/+page.svelte                      # 3 layout states (delegates to child components)
```

### Deleted Files (1)

```
src/lib/components/dashboard/panels/GsmEvilPanel.svelte  # Orphaned after tab removal
```

## Implementation Order (79 tasks, 18 phases)

```
Phase 1:  T001-T005  Setup (tokens + store type + widgets dir)
Phase 2:  T006-T010  Foundational (DashboardShell extraction) — BLOCKS all stories
Phase 3:  T011-T014  US2 Command Bar
Phase 4:  T015-T019  US3 Bottom Panel + GsmEvilPanel deletion
Phase 5:  T020-T025  US1 System Overview sidebar
Phase 6:  T026-T029  US12 Device Manager
Phase 7:  T030-T033  US13 Agent Chat
Phase 8:  T034-T035  US4 OFFNET Tools
Phase 9:  T036-T037  US5 Map Layers
Phase 10: T038-T040  US6 Settings
Phase 11: T041-T044  US9 TAK Config (full-width)
Phase 12: T045-T047  US7 Hardware Config
Phase 13: T048-T053  US8 Sidebar Widgets (4 parallel)
Phase 14: T054-T058  US10 GSM Scanner (full-width, 3 states)
Phase 15: T059-T063  US11 Dropdowns (3 parallel)
Phase 16: T064-T066  US14 Terminal Error Overlay
Phase 17: T067-T069  ONNET Tools
Phase 18: T070-T079  Polish & verification
```

## Verification

```bash
# After each task
npm run build                # Must pass
npx tsc --noEmit             # Must pass

# After Phase 0
# Verify dashboard loads identically to pre-refactor

# After Phase 5
npm run test:unit            # All tests pass
npm run test:e2e             # Visual regression against .pen mockups
```

## Design Reference

- **Authoritative source**: `docs/designs/pencil-lunaris.pen` (use pencil MCP tools to read)
- **Token reference**: `src/app.css` (Lunaris design tokens from spec-017)
- **Component contracts**: `specs/018-lunaris-layout-structure/contracts/` (9 contract files)
    - dashboard-shell.md, command-bar.md, bottom-panel.md, sidebar-panels.md
    - widgets.md, dropdowns.md, captures-panel.md, tak-config.md, gsm-scanner.md
