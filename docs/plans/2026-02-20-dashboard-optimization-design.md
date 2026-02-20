# Dashboard Optimization Design

**Date**: 2026-02-20
**Branch**: pencil_test
**Scope**: Full dashboard audit + fixes (6 issues)

## Problem Statement

The Argos dashboard has accumulated structural debt across 47 Svelte components. Key issues: duplicated CSS (~120 lines across 7 files), redundant API fetching (same endpoints called from 2 components), 6 independent polling intervals, zero responsive design outside the status bar, swallowed errors, and missing loading/error states.

## Issue 1: CSS Deduplication

**Current**: `.panel-section`, `.section-label`, `.info-grid`, `.info-item`, `.info-label`, `.info-value`, `.no-data` are copy-pasted across 7 files.

**Fix**: Create `src/lib/styles/panel-shared.css` with the shared class definitions. Import it in each component's `<style>` block via Svelte's `:global()` wrapper OR create a `PanelSection.svelte` wrapper component.

**Recommended approach**: Shared CSS file, because a wrapper component would change the DOM structure and potentially break existing styles. The shared CSS approach is non-breaking.

**Files touched**: `panel-shared.css` (new), `SystemInfoCard.svelte`, `GpsCard.svelte`, `HardwareCard.svelte`, `ServicesCard.svelte`, `WifiInterfacesCard.svelte`, `LayersPanel.svelte`, `DeviceWhitelist.svelte`

## Issue 2: Shared Hardware Store

**Current**: Both `TopStatusBar` (via `status-bar-data.ts`) and `OverviewPanel` independently fetch `/api/hardware/status` every 5s and `/api/hardware/details` on mount.

**Fix**: Create `src/lib/stores/hardware-store.ts`:
- Exports reactive state: `hardwareStatus`, `hardwareDetails`, `systemInfo`
- Single 5s polling interval for status, one-time fetch for details
- `startPolling()` / `stopPolling()` lifecycle methods
- Both `TopStatusBar` and `OverviewPanel` subscribe to the store instead of fetching directly

**Files touched**: `hardware-store.ts` (new), `TopStatusBar.svelte`, `status-bar-data.ts`, `OverviewPanel.svelte`

## Issue 3: Polling Consolidation

**Current**: 6 independent `setInterval` calls across the dashboard.

**Fix**: The hardware store (Issue 2) eliminates 1 redundant poll. Additionally:
- Move system info fetching into the hardware store (it's related data, same refresh cycle)
- Keep clock interval in TopStatusBar (1s clock is UI-only, no API)
- Keep weather in TopStatusBar (10min interval, GPS-dependent)
- Keep satellite polling in SatelliteTable (only active when dropdown open)
- Keep GSM IMSI polling in GsmEvilPanel (only active when GSM is running)

**Net result**: 6 intervals → 5 intervals, but the critical win is eliminating duplicate `/api/hardware/status` calls (was 2 calls every 5s = 17,280 wasted requests/day).

## Issue 4: Responsive Design Basics

**Current**: Only TopStatusBar and its dropdowns have media queries. The rest of the dashboard assumes 1440px+.

**Fix**: Add minimal responsive support to the dashboard shell (`+page.svelte`):
- Below 1024px: collapse the overview panel behind a toggle button
- Below 768px: convert icon rail to a bottom tab bar
- Add `overflow-y: auto` to the overview panel scroll content (already partially there)
- Add text truncation to overview card values that could overflow

**Files touched**: `+page.svelte`, `IconRail.svelte`, `PanelContainer.svelte`

**Note**: This is not a full mobile redesign. The RPi5 dashboard primarily runs on its connected display or via VNC. These breakpoints handle tablet/laptop access gracefully.

## Issue 5: Error Handling

**Current**: All API fetches catch errors silently with `/* silent */`.

**Fix**: Add a lightweight toast/notification system:
- Create `src/lib/stores/notifications-store.ts` with a simple queue
- Create `src/lib/components/ui/NotificationToast.svelte`
- Replace `/* silent */` catches with `notifications.error('Hardware status unavailable')`
- Auto-dismiss after 5 seconds, max 3 visible at once
- Only show each unique error once per 30 seconds (debounce)

**Files touched**: `notifications-store.ts` (new), `NotificationToast.svelte` (new), `OverviewPanel.svelte`, `TopStatusBar.svelte`, `+page.svelte` (mount the toast container)

## Issue 6: Loading/Error States

**Current**: Components show "Loading..." text or nothing when data is unavailable. Constitutional exemptions acknowledge this.

**Fix**: Add skeleton loading states to the overview cards:
- Create `src/lib/components/ui/Skeleton.svelte` (a simple animated placeholder bar)
- Replace "Loading system info..." with skeleton placeholder rows
- Add a retry button when data fails to load after 10 seconds

**Files touched**: `Skeleton.svelte` (new), `SystemInfoCard.svelte`, `GpsCard.svelte`, `HardwareCard.svelte`, `ServicesCard.svelte`

## Implementation Order

1. **Issue 1** (CSS dedup) — zero risk, no logic changes
2. **Issue 2** (hardware store) — medium risk, changes data flow
3. **Issue 3** (polling consolidation) — depends on Issue 2
4. **Issue 6** (loading states) — low risk, visual only
5. **Issue 5** (error handling) — depends on notification store
6. **Issue 4** (responsive) — highest risk, layout changes

## Files Summary

**New files** (5):
- `src/lib/styles/panel-shared.css`
- `src/lib/stores/hardware-store.ts`
- `src/lib/stores/notifications-store.ts`
- `src/lib/components/ui/NotificationToast.svelte`
- `src/lib/components/ui/Skeleton.svelte`

**Modified files** (~15):
- Overview cards (5): SystemInfoCard, GpsCard, HardwareCard, ServicesCard, WifiInterfacesCard
- Panels (2): OverviewPanel, LayersPanel
- Status bar (2): TopStatusBar, status-bar-data.ts
- Layout (3): +page.svelte, IconRail, PanelContainer
- Other (1): DeviceWhitelist

**Estimated total**: ~20 files touched, 5 new files created.
