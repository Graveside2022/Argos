# Implementation Plan: Line-of-Sight RF Range Overlay

**Branch**: `020-los-rf-range` | **Date**: 2026-02-26 | **Spec**: [specs/020-los-rf-range/spec.md](spec.md)
**Input**: Feature specification from `/specs/020-los-rf-range/spec.md`

## Summary

Display an RF range overlay on the MapLibre map centered on the operator's GPS position, sized by Friis free-space path loss calculations driven by the active HackRF frequency and configurable TX parameters. Renders as 4 concentric colored bands (strong → maximum) reusing the existing `buildDetectionRangeGeoJSON()` pipeline. No new server-side endpoints — all propagation math runs client-side. P1 delivers the core overlay; P2 adds parameter configuration and preset selection; P3 (deferred) adds terrain-aware viewshed.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: SvelteKit 2, Svelte 5 (runes), MapLibre GL JS, svelte-maplibre
**Storage**: localStorage via `persistedWritable` (client-side profile persistence). No database changes.
**Testing**: Vitest (unit tests for propagation math + store logic)
**Target Platform**: Raspberry Pi 5 (Kali Linux), Chromium browser
**Project Type**: Web application (SvelteKit)
**Performance Goals**: Overlay renders < 2s after prerequisites met (SC-001). Updates < 500ms on frequency change (SC-002). < 15 MB memory, < 5% CPU (SC-005).
**Constraints**: < 200 MB heap total (shared with rest of app). GeoJSON polygon generation must be memoized to prevent per-frame recomputation. No external API dependencies for P1/P2.
**Scale/Scope**: 6 new files, ~8 modified files, ~800 lines new code. No new npm dependencies.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                  | Requirement                           | Status | Notes                                                                                   |
| ------------------------ | ------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| I.1 Comprehension Lock   | Confirmed understanding               | PASS   | End state: RF range rings on map. Current: WiFi rings exist, no RF propagation.         |
| I.2 Codebase Inventory   | Search existing before creating       | PASS   | Full audit in research.md RQ-8. 11 reusable assets identified.                          |
| II.1 TypeScript Strict   | No `any`, no `@ts-ignore`             | PASS   | All new types are strict. `RFRangeProfile` fully typed.                                 |
| II.2 Modularity          | <300 lines/file, <50 lines/fn         | PASS   | Propagation math ~80 lines. Store ~60 lines. Derived state ~80 lines. Panel ~150 lines. |
| II.3 Naming              | kebab-case files, camelCase vars      | PASS   | `rf-propagation.ts`, `rf-range-store.ts`, `calculateFriisRange()`                       |
| II.6 Forbidden           | No barrel files, no catch-all utils   | PASS   | No index.ts. `rf-propagation.ts` is domain-specific, not a catch-all.                   |
| III.1 Test-First         | Tests before/alongside implementation | PASS   | Propagation math + store get unit tests.                                                |
| IV.1 Design Language     | Lunaris, dark mode, design tokens     | PASS   | Uses `SIGNAL_COLORS` + `resolveMapColor()`. No hardcoded hex.                           |
| IV.3 State Communication | All states handled                    | PASS   | Active, inactive (no SDR), inactive (no GPS), disabled, capped — all defined.           |
| V.1 Real-Time            | <16ms WebSocket, zero leaks           | PASS   | No WebSocket changes. SSE consumption only. GeoJSON memoized.                           |
| V.3 Resources            | <15% CPU, <200MB heap                 | PASS   | 4-band GeoJSON ~12 KB. Friis is one `Math.pow()` call.                                  |
| VI.3 Forbidden           | No `npm install`                      | PASS   | Zero new dependencies.                                                                  |
| VIII.1 Security          | No secrets, validate inputs           | PASS   | No API changes. Client-side math only. Input validation via Zod on store.               |
| IX.1 Documents           | spec → plan → tasks                   | PASS   | This document.                                                                          |

**Gate result: PASS** — No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/020-los-rf-range/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity definitions and relationships
├── quickstart.md        # Build order and verification
├── contracts/
│   └── rf-range-api.md  # Client-side module contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (new and modified files)

```text
src/lib/
├── types/
│   └── rf-range.ts                          # NEW — RFRangeProfile, RFRangeBand, presets
├── utils/
│   └── rf-propagation.ts                    # NEW — Friis math, band builder, clamping
│   └── rf-propagation.test.ts               # NEW — Unit tests for propagation math
├── stores/dashboard/
│   ├── rf-range-store.ts                    # NEW — Persisted RF range configuration store
│   ├── rf-range-store.test.ts               # NEW — Unit tests for store
│   ├── dashboard-store.ts                   # MODIFY — Add rfRange to layerVisibility
│   └── map-settings-store.ts               # MODIFY — Add activeMapSettingsView state
├── tactical-map/
│   └── hackrf-data-service.ts               # NEW — SSE subscriber, populates hackrfStore
├── components/dashboard/
│   ├── map/
│   │   ├── rf-range-derived.svelte.ts       # NEW — Reactive GeoJSON derivation
│   │   ├── map-helpers.ts                   # MODIFY — Add rfRange to LAYER_MAP
│   ├── dashboard-map-logic.svelte.ts        # MODIFY — Wire rfRangeGeoJSON into map state
│   ├── DashboardMap.svelte                  # MODIFY — Add GeoJSONSource + FillLayer
│   ├── PanelContainer.svelte                # MODIFY — Rename 'layers' panel to 'map-settings'
│   ├── IconRail.svelte                      # MODIFY — Rename Layers → Map Settings (icon + label)
│   └── panels/
│       ├── MapSettingsPanel.svelte           # NEW — Card-based hub (replaces LayersPanel)
│       ├── MapProviderView.svelte            # NEW — Extracted from old LayersPanel (provider section)
│       ├── MapLayersView.svelte              # NEW — Extracted from old LayersPanel (filters + toggles + bands)
│       ├── LineOfSightView.svelte            # NEW — RF range configuration (presets, params, range readout)
│       ├── LayersPanel.svelte               # DELETE — Replaced by MapSettingsPanel + subviews
│       └── layers-panel.css                 # MODIFY — Rename to map-settings.css, reuse shared styles
```

**Structure Decision**: The "Layers" panel is decomposed into a card-based navigation hub (`MapSettingsPanel`) with 3 subviews, mirroring the Tools panel's `ToolsNavigationView` + `ToolCategoryCard` pattern. Each subview is a standalone component that can be tested independently. The `LayersPanel.svelte` file is removed and replaced by the new structure. Shared toggle/section styles from `layers-panel.css` are renamed and reused across all 3 subviews. No new icon rail button — the existing Layers button is renamed to "Map Settings".

## Implementation Phases

### Phase 1: Core Propagation Math (P1 — Pure Functions)

**Goal**: Friis equation + band builder + clamping as tested pure functions.

**New files**:

- `src/lib/types/rf-range.ts` — Type definitions + preset constants
- `src/lib/utils/rf-propagation.ts` — `calculateFriisRange()`, `buildRFRangeBands()`, `clampDisplayRange()`
- `src/lib/utils/rf-propagation.test.ts` — Unit tests

**Key design decisions**:

- Frequency input is Hz (consistent with Friis formula). Conversion from MHz happens at the boundary.
- Band radii are proportional (25/50/75/100% of d_max), not absolute dB thresholds — ensures 4 visible bands at any frequency.
- Clamping: 50m min, 50km max. Returns `{ displayRange, isCapped }` for UI labeling.
- The `RFRangeBand` type is compatible with the existing `RangeBand` interface so it can feed directly into `buildDetectionRangeGeoJSON()`.

**Test matrix**: 900 MHz / 2.4 GHz / 5.8 GHz × 3 presets = 9 known-good values. Plus edge cases at 1 MHz and 6 GHz (clamping).

---

### Phase 2: RF Range Store + Layer Registration

**Goal**: Reactive store for profile configuration. Layer registered in visibility system.

**New files**:

- `src/lib/stores/dashboard/rf-range-store.ts` — `persistedWritable` with preset selection, custom profile, frequency source
- `src/lib/stores/dashboard/rf-range-store.test.ts` — Unit tests

**Modified files**:

- `src/lib/stores/dashboard/dashboard-store.ts` — Add `rfRange: false` to `layerVisibility`
- `src/lib/components/dashboard/map/map-helpers.ts` — Add `rfRange: ['rf-range-fill']` to `LAYER_MAP`

**Key design decisions**:

- Store uses `persistedWritable` pattern from `map-settings-store.ts` for localStorage persistence
- Default state: `isEnabled: false`, preset: `'hackrf-bare'`, frequency source: `'auto'`
- Custom profile initialized from HackRF Bare preset values
- Zod schema validates store shape on hydration from localStorage

---

### Phase 3: HackRF Data Service (Wire SDR → Store)

**Goal**: Client-side EventSource subscriber that populates `hackrfStore.targetFrequency` and `connectionStatus`.

**New files**:

- `src/lib/tactical-map/hackrf-data-service.ts` — `HackRFDataService` class (analogous to `GPSService`)

**Key design decisions**:

- Opens EventSource to `/api/hackrf/data-stream` with auth token
- Parses `status` events → `setTargetFrequency(status.currentFrequency)`
- Handles reconnection with exponential backoff (same pattern as GPS polling)
- Destroyable — `stop()` closes the EventSource
- Does NOT duplicate hardware detection polling (that stays in TopStatusBar)

---

### Phase 4: Map Rendering Integration

**Goal**: RF range rings appear on the map when prerequisites are met.

**New files**:

- `src/lib/components/dashboard/map/rf-range-derived.svelte.ts` — `createRFRangeDerivedState()`

**Modified files**:

- `src/lib/components/dashboard/DashboardMap.svelte` — Add `<GeoJSONSource id="rf-range-src">` + `<FillLayer id="rf-range-fill">`
- `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — Instantiate RF range derived state, expose `rfRangeGeoJSON`

**Key design decisions**:

- GeoJSON derivation uses `$derived.by()` with memoization guards on lat, lon, frequencyHz, and profile hash
- Reuses `buildDetectionRangeGeoJSON(lat, lon, rfBands)` — same function that renders WiFi rings
- FillLayer uses `['get', 'color']` paint expression with per-band opacity via `['match', ['get', 'band'], ...]`
- When prerequisites not met (no GPS fix, no SDR), returns empty FeatureCollection — layer exists but shows nothing
- Overlay label ("Free-Space Estimate" / "(capped)") rendered as a small text annotation near the outer ring edge

---

### Phase 5: Map Settings Panel Redesign (Layers → Card Navigation)

**Goal**: Transform the flat "Layers" panel into a card-based "Map Settings" hub with drill-down subviews. This follows the same UX pattern as the Tools panel (`ToolCategoryCard` → subview with back button).

**New files**:

- `src/lib/components/dashboard/panels/MapSettingsPanel.svelte` — Card-based hub with 3 clickable cards
- `src/lib/components/dashboard/panels/MapProviderView.svelte` — Extracted from old LayersPanel: Tactical/Satellite selector + custom URL
- `src/lib/components/dashboard/panels/MapLayersView.svelte` — Extracted from old LayersPanel: Visibility Filter + Map Layer toggles + Signal Strength band toggles
- `src/lib/components/dashboard/panels/LineOfSightView.svelte` — RF range configuration: enable toggle, preset selector, TX params, computed range readout, model badge

**Modified files**:

- `src/lib/components/dashboard/PanelContainer.svelte` — Change `'layers'` case to `'map-settings'`, render `MapSettingsPanel`
- `src/lib/components/dashboard/IconRail.svelte` — Change button from `'layers'` to `'map-settings'`, update title/label to "Map Settings" (keep `Layers` icon from Lucide or switch to `Map` icon)
- `src/lib/stores/dashboard/dashboard-store.ts` — Change `activePanel` default for `'layers'` → `'map-settings'`
- `src/lib/stores/dashboard/map-settings-store.ts` — Add `activeMapSettingsView` writable state

**Delete**:

- `src/lib/components/dashboard/panels/LayersPanel.svelte` — Replaced by MapSettingsPanel + 3 subviews

**Card layout** (MapSettingsPanel):

```
┌─────────────────────────────────┐
│  MAP SETTINGS                   │  ← panel header
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ 🗺  Map Provider          │  │  ← card 1: Tactical/Satellite/Custom
│  │     Tile source & style   │  │
│  │                        ›  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📶  Map Layers            │  │  ← card 2: Visibility + Layers + Signal
│  │     Filters & overlays    │  │
│  │                        ›  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📡  Line of Sight         │  │  ← card 3: RF range config (NEW)
│  │     RF range overlay      │  │
│  │                        ›  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Subview navigation**: Each card sets `activeMapSettingsView` to `'provider'` | `'layers'` | `'line-of-sight'`. The MapSettingsPanel conditionally renders the hub cards OR the active subview + back button, using the same pattern as `ToolsPanelHeader.svelte` (breadcrumb + back).

**LineOfSightView sections**:

1. **Enable toggle** — master on/off for the overlay
2. **Preset selector** — dropdown with 3 presets + Custom
3. **Parameters** — TX power (slider), antenna gain (input), sensitivity (input), height AGL (slider)
4. **Computed range** — read-only display showing d_max and band radii at current frequency
5. **Model badge** — "Free-Space Estimate" label (future: toggleable to "Terrain-Aware" for P3)
6. **Layer visibility toggle** — RF Range on/off (same toggle style as Map Layers view)

---

## Dependency Graph

```
Phase 1: Types + Math (no dependencies)
    ↓
Phase 2: Store + Layer Registration (depends on Phase 1 types)
    ↓
Phase 3: HackRF Data Service (depends on hackrfStore, independent of Phase 1/2)
    ↓
Phase 4: Map Rendering (depends on Phase 1 math, Phase 2 store, Phase 3 frequency)
    ↓
Phase 5: Map Settings Panel Redesign (depends on Phase 2 store, Phase 4 rendering)
         Includes: card hub + 3 subviews (provider, layers, line-of-sight)
         Subsumes old Phase 6 (layer toggle now lives inside LineOfSightView)
```

Note: Phase 3 can be done in parallel with Phase 1+2 since it only touches the HackRF store (not the RF range store). Within Phase 5, the MapProviderView and MapLayersView are pure refactors of existing LayersPanel code (no new logic), while LineOfSightView is the only subview with new functionality.

## Risk Assessment

| Risk                                                        | Likelihood           | Impact | Mitigation                                                                            |
| ----------------------------------------------------------- | -------------------- | ------ | ------------------------------------------------------------------------------------- |
| MapLibre polygon rendering artifacts at large radii         | Medium               | Medium | Clamp at 50 km. Test at 1 MHz edge case.                                              |
| `hackrfStore` frequency never populated (SSE not connected) | High (current state) | High   | Phase 3 creates HackRFDataService. Manual frequency fallback in store.                |
| GeoJSON rebuilds on every GPS tick (2s)                     | Medium               | Low    | Memoization guard: skip rebuild if position delta < 10m                               |
| Color resolution fails in SSR                               | Low                  | Low    | GeoJSON only computed in browser. FillLayer only renders client-side.                 |
| OOM from too many concurrent polygon calculations           | Very Low             | Medium | Single `$derived.by()` — no parallel computation. 4 bands × 48 vertices = 192 points. |
