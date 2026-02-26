# Tasks: Line-of-Sight RF Range Overlay

**Input**: Design documents from `/specs/020-los-rf-range/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rf-range-api.md, quickstart.md

**Tests**: Unit tests are requested (plan.md Phase 1 & Phase 2 include test files, quickstart.md lists test commands, spec Constitution Check III.1 = PASS). Test tasks are included for Phases 1 and 2.

**Organization**: Tasks grouped by user story (US1–US3). US4 (Terrain-Aware LOS, P3) is explicitly deferred per spec/plan — not included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Types & Pure Math)

**Purpose**: Type definitions and propagation math — zero UI, zero store, zero side effects. Everything here is pure functions and constants.

- [ ] T001 [P] Create RF range type definitions and hardware presets in `src/lib/types/rf-range.ts` — `RFRangeProfile`, `RFRangeBand`, `RFRangeState`, `PropagationModel`, `RF_RANGE_PRESETS` constant (3 presets + validation ranges from data-model.md)
- [ ] T002 [P] Create Friis propagation calculator in `src/lib/utils/rf-propagation.ts` — `calculateFriisRange(frequencyHz, txPowerDbm, txGainDbi, rxGainDbi, sensitivityDbm)`, `buildRFRangeBands(maxRangeMeters)` (4 bands at 25/50/75/100%), `clampDisplayRange(rangeMeters)` (50m min, 50km max), `RF_RANGE_LIMITS` constant
- [ ] T003 Write unit tests for propagation math in `src/lib/utils/rf-propagation.test.ts` — test matrix: 900 MHz / 2.4 GHz / 5.8 GHz × 3 presets = 9 known-good values, plus edge cases at 1 MHz (capped high) and 6 GHz (capped low), band proportions, clamp behavior

**Checkpoint**: `npx vitest run src/lib/utils/rf-propagation.test.ts` passes. All propagation math verified against known Friis values.

---

## Phase 2: Foundational (Store + Layer Registration)

**Purpose**: Reactive store for RF range configuration. Layer registered in the visibility system. No rendering yet — just plumbing.

**⚠️ CRITICAL**: Depends on Phase 1 types (`RFRangeProfile`, `RFRangeBand`). Must complete before US1 map rendering.

- [ ] T004 [P] Create RF range configuration store in `src/lib/stores/dashboard/rf-range-store.ts` — `persistedWritable` with `RFRangeStoreState` shape (isEnabled, activePresetId, customProfile, frequencySource, manualFrequencyMHz), convenience setters: `setRFRangeEnabled()`, `setActivePreset()`, `updateCustomProfile()`, `setFrequencySource()`, `setManualFrequency()`. Zod schema for localStorage hydration validation.
- [ ] T005 [P] Write unit tests for RF range store in `src/lib/stores/dashboard/rf-range-store.test.ts` — preset switching updates active profile, custom parameter changes persist, frequency source toggle, Zod validation rejects malformed localStorage data
- [ ] T006 Add `rfRange: false` to `layerVisibility` initial state in `src/lib/stores/dashboard/dashboard-store.ts` (line ~92, inside the writable object)
- [ ] T007 Add `rfRange: ['rf-range-fill']` to `LAYER_MAP` in `src/lib/components/dashboard/map/map-helpers.ts` (line ~201, inside the Record)

**Checkpoint**: `npx vitest run src/lib/stores/dashboard/rf-range-store.test.ts` passes. Store persists to localStorage. Layer key registered but not yet rendered.

---

## Phase 3: User Story 1 — View RF Range Circle on Map (Priority: P1) 🎯 MVP

**Goal**: When a HackRF is connected and GPS has a fix, a colored multi-band RF range overlay appears on the map centered on the operator's position. The overlay automatically resizes when the active frequency changes.

**Independent Test**: Connect HackRF, get GPS fix, verify 4 concentric colored rings appear on the map. Change frequency → rings resize. Disconnect SDR → rings disappear. Lose GPS fix → rings disappear.

### Implementation for User Story 1

- [ ] T008 [US1] Create HackRF data service in `src/lib/tactical-map/hackrf-data-service.ts` — `HackRFDataService` class: opens EventSource to `/api/hackrf/data-stream` with auth token, parses `status` events → calls `setTargetFrequency(status.currentFrequency)` and `setConnectionStatus('Connected')`, handles error/close → `setConnectionStatus('Disconnected')`, exponential backoff reconnection, `stop()` method to close EventSource
- [ ] T009 [US1] Create RF range GeoJSON derivation in `src/lib/components/dashboard/map/rf-range-derived.svelte.ts` — `createRFRangeDerivedState()` function taking reactive GPS, HackRF, and rfRange store refs. Uses `$derived.by()` with memoization guard (skip rebuild if position delta < 10m and frequency unchanged). Computes: resolve active profile from preset/custom → `calculateFriisRange()` → `clampDisplayRange()` → `buildRFRangeBands()` → `buildDetectionRangeGeoJSON(lat, lon, rfBands)`. Returns `{ rfRangeGeoJSON, rfRangeState }`. Returns empty FeatureCollection when prerequisites not met (no GPS fix, no SDR, overlay disabled).
- [ ] T010 [US1] Wire RF range derived state into map logic in `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — instantiate `createRFRangeDerivedState()` alongside existing map state orchestration, expose `rfRangeGeoJSON` on the returned state object
- [ ] T011 [US1] Add RF range GeoJSONSource + FillLayer to `src/lib/components/dashboard/DashboardMap.svelte` — add `<GeoJSONSource id="rf-range-src" data={ms.rfRangeGeoJSON}>` with `<FillLayer id="rf-range-fill">` using `['get', 'color']` paint and per-band opacity via `['match', ['get', 'band'], 'strong', 0.14, 'usable', 0.11, 'marginal', 0.09, 'maximum', 0.06, 0.07]`. Place before device layers so RF range renders behind devices.
- [ ] T012 [US1] Instantiate HackRFDataService in `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — wire lifecycle (start on mount, stop on unmount) alongside existing GPS service initialization, ensuring it populates `hackrfStore.targetFrequency` for the RF range derivation to consume

**Checkpoint**: With HackRF connected + GPS fix, 4 concentric colored rings appear on the map. Frequency change resizes rings. SDR disconnect / GPS loss removes overlay. `npm run build` succeeds.

---

## Phase 4: User Story 2 — Configure Transmission Parameters (Priority: P2)

**Goal**: The operator can adjust TX power, antenna gain, receiver sensitivity, and antenna height via a redesigned Map Settings panel with preset selection and custom parameter entry.

**Independent Test**: Open Map Settings → Line of Sight card → change preset from "HackRF Bare" to "HackRF + Amplifier" → range circle visibly grows. Enter custom TX power → overlay updates in real time. Settings persist across page reload.

### Implementation for User Story 2

- [ ] T013 [US2] Add `activeMapSettingsView` state to `src/lib/stores/dashboard/map-settings-store.ts` — `MapSettingsView` type (`'hub' | 'provider' | 'layers' | 'line-of-sight'`), `activeMapSettingsView` writable (default `'hub'`), `navigateToMapSettingsView()` and `navigateBackToHub()` helpers. Note: `'layers'` here means the "Map Layers subview" — distinct from the old `activePanel === 'layers'` panel identifier that T014 renames to `'map-settings'`.
- [ ] T014 [US2] Rename `'layers'` panel to `'map-settings'` in `src/lib/stores/dashboard/dashboard-store.ts` — update any references where `activePanel` is compared to `'layers'`
- [ ] T015 [P] [US2] Create MapSettingsPanel hub in `src/lib/components/dashboard/panels/MapSettingsPanel.svelte` — 3 clickable cards (Map Provider, Map Layers, Line of Sight) with chevron indicators. Reads `activeMapSettingsView` to conditionally render hub cards OR active subview + back button. Follows `ToolsNavigationView` + `ToolCategoryCard` pattern.
- [ ] T016 [P] [US2] Extract MapProviderView from LayersPanel into `src/lib/components/dashboard/panels/MapProviderView.svelte` — move MAP PROVIDER section (Tactical/Satellite selector + custom URL) from LayersPanel (lines ~50-83) to standalone component with back-to-hub navigation
- [ ] T017 [P] [US2] Extract MapLayersView from LayersPanel into `src/lib/components/dashboard/panels/MapLayersView.svelte` — move VISIBILITY FILTER + MAP LAYERS + SIGNAL STRENGTH sections (lines ~85-231) from LayersPanel to standalone component with back-to-hub navigation
- [ ] T018 [US2] Create LineOfSightView in `src/lib/components/dashboard/panels/LineOfSightView.svelte` — sections: (1) Enable toggle (master on/off), (2) Preset selector dropdown (3 presets + Custom), (3) TX parameter inputs (power slider, antenna gain, sensitivity, height AGL), (4) Computed range readout (d_max + band radii at current frequency), (5) Model badge ("Free-Space Estimate"), (6) RF Range layer visibility toggle. All inputs wire to `rfRangeStore` via convenience setters.
- [ ] T019 [US2] Update PanelContainer routing in `src/lib/components/dashboard/PanelContainer.svelte` — replace `{:else if $activePanel === 'layers'}` with `{:else if $activePanel === 'map-settings'}`, render `<MapSettingsPanel />` instead of `<LayersPanel />`
- [ ] T020 [US2] Update IconRail button in `src/lib/components/dashboard/IconRail.svelte` — change `'layers'` to `'map-settings'`, update title/label to "Map Settings", consider switching `Layers` icon to `Map` icon from Lucide
- [ ] T021 [US2] Rename `layers-panel.css` to `map-settings-shared.css` in `src/lib/components/dashboard/panels/` — update all import references in MapSettingsPanel, MapProviderView, MapLayersView, LineOfSightView
- [ ] T022 [US2] Delete `src/lib/components/dashboard/panels/LayersPanel.svelte` — all functionality now lives in MapSettingsPanel + 3 subviews. Verify no remaining imports reference the deleted file.

**Checkpoint**: Icon rail shows "Map Settings". Clicking it opens card hub with 3 cards. Each card drills into its subview with back button. Line of Sight view: preset switching and parameter adjustment update the overlay in real time. Settings persist across reload. `npm run build` succeeds.

---

## Phase 5: User Story 3 — Multi-Band Range Rings (Priority: P2)

**Goal**: The range overlay displays 4 concentric colored bands (strong → maximum) rather than a single circle, with distinct colors per signal quality zone.

**Independent Test**: Enable RF range overlay → verify 4 concentric colored rings are visible with distinct colors. Inner ring (strong/green) is densest; outer ring (maximum/faded red) is most transparent. Changing frequency maintains proportional spacing.

### Implementation for User Story 3

> **Note**: Multi-band rendering is largely built into US1 via `buildRFRangeBands()` and the FillLayer opacity matching. This phase is about ensuring the visual presentation is correct, the color mapping uses design tokens, and band labels are properly communicated in the UI.

- [ ] T023 [US3] Verify and tune band colors in `src/lib/utils/rf-propagation.ts` — ensure `buildRFRangeBands()` uses `resolveMapColor()` with signal color tokens (`--signal-very-strong`, `--signal-strong`, `--signal-fair`, `--signal-weak`) from `map-colors.ts`. Add fallback hex values for SSR/test contexts.
- [ ] T024 [US3] Add band legend to LineOfSightView in `src/lib/components/dashboard/panels/LineOfSightView.svelte` — below the computed range readout, show a small legend with 4 color swatches + labels (Strong / Usable / Marginal / Maximum) and their computed distance radii at the current frequency
- [ ] T025 [US3] Verify FillLayer opacity mapping matches research.md band definitions in `src/lib/components/dashboard/DashboardMap.svelte` — confirm `['match', ['get', 'band'], ...]` expression uses correct opacity values: strong=0.14, usable=0.11, marginal=0.09, maximum=0.06

**Checkpoint**: 4 distinctly colored concentric rings visible on map. Band legend in LineOfSightView matches rendered colors. Proportional spacing maintained across frequency changes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, edge cases, and cleanup across all stories.

- [ ] T026 [P] Add overlay label annotation near outer ring edge in `src/lib/components/dashboard/DashboardMap.svelte` — "Free-Space Estimate" text, with "(capped)" suffix when `isCapped === true`. Use a `<SymbolLayer>` or MapLibre text annotation on the outermost band centroid.
- [ ] T027 [P] Handle GPS fix loss gracefully — when GPS fix drops while overlay is active, freeze overlay at last known position with a stale indicator, then remove after `GPS_STALE_TIMEOUT_MS` (30 000 ms). Define the constant in `src/lib/utils/rf-propagation.ts` alongside `RF_RANGE_LIMITS`. Verify in `rf-range-derived.svelte.ts`.
- [ ] T028 [P] Handle SDR disconnect mid-display — verify overlay disappears within one update cycle when SDR goes offline. Verify `HackRFDataService` reconnection with exponential backoff works correctly.
- [ ] T029 Run full verification: `npx tsc --noEmit`, `npx eslint src/lib/utils/rf-propagation.ts src/lib/types/rf-range.ts src/lib/stores/dashboard/rf-range-store.ts --config config/eslint.config.js`, `npx vitest run src/lib/utils/rf-propagation.test.ts src/lib/stores/dashboard/rf-range-store.test.ts`, `npm run build`
- [ ] T030 Run quickstart.md verification checklist — all items from quickstart.md "Verification Checklist" section pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately. T001 and T002 are parallel (different files).
- **Phase 2 (Foundational)**: Depends on Phase 1 types (`rf-range.ts`). T004/T005 and T006/T007 are parallel (different files).
- **Phase 3 (US1 — MVP)**: Depends on Phase 2 store + layer registration. T008 can start as soon as Phase 1 completes (only needs `hackrfStore`, not `rfRangeStore`). T009-T012 are sequential (each builds on the previous).
- **Phase 4 (US2)**: Depends on Phase 3 being renderable on the map (needs working overlay to verify config changes). T013-T014 are sequential (store changes first). T015-T017 are parallel (3 independent subview components). T018-T022 are sequential (wire up, then clean up).
- **Phase 5 (US3)**: Depends on Phase 3 rendering + Phase 4 LineOfSightView. T023-T025 can be parallel.
- **Phase 6 (Polish)**: Depends on all user stories being complete. T026-T028 are parallel.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P2)**: Depends on US1 being renderable (needs visible overlay to verify config changes)
- **US3 (P2)**: Depends on US1 rendering + US2 LineOfSightView (for band legend)

### Within Each User Story

- Types before math (Phase 1)
- Store before rendering (Phase 2 → Phase 3)
- Data service before map integration (T008 → T009)
- GeoJSON derivation before map rendering (T009 → T010 → T011)
- Store/panel changes before UI components (T013-T014 → T015-T022)

### Parallel Opportunities

```
Phase 1: T001 ║ T002    (types and math in parallel — different files)
Phase 2: T004 ║ T005 ║ T006 ║ T007   (store, tests, dashboard-store, map-helpers — all different files)
Phase 4: T015 ║ T016 ║ T017   (3 independent panel subview components)
Phase 5: T023 ║ T024 ║ T025   (color tuning, legend, opacity — different files)
Phase 6: T026 ║ T027 ║ T028   (label, GPS edge case, SDR edge case — independent concerns)
```

---

## Parallel Example: Phase 1

```bash
# Launch types and math in parallel (different files, no dependencies):
Task: "Create RF range type definitions in src/lib/types/rf-range.ts"
Task: "Create Friis propagation calculator in src/lib/utils/rf-propagation.ts"

# Then tests (depends on both T001 and T002):
Task: "Write unit tests in src/lib/utils/rf-propagation.test.ts"
```

## Parallel Example: Phase 4 Subview Extraction

```bash
# Launch 3 subview extractions in parallel (different files, no dependencies):
Task: "Create MapSettingsPanel hub in panels/MapSettingsPanel.svelte"
Task: "Extract MapProviderView from LayersPanel into panels/MapProviderView.svelte"
Task: "Extract MapLayersView from LayersPanel into panels/MapLayersView.svelte"
```

---

## Implementation Strategy

### MVP First (US1 Only — Phases 1-3)

1. Complete Phase 1: Types + Math (T001-T003)
2. Complete Phase 2: Store + Layer Registration (T004-T007)
3. Complete Phase 3: US1 — Map Rendering (T008-T012)
4. **STOP AND VALIDATE**: RF range rings visible on map with real HackRF + GPS
5. This is a fully usable feature with default HackRF Bare preset

### Incremental Delivery

1. Phases 1-3 → MVP: RF range rings on map with default preset → **Deployable**
2. Phase 4 → US2: Configurable parameters + Map Settings panel redesign → **Deployable**
3. Phase 5 → US3: Band legend + visual polish → **Deployable**
4. Phase 6 → Polish: Edge cases, labels, verification → **Final**

Each increment adds value without breaking previous functionality.

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- US4 (Terrain-Aware LOS, P3) is explicitly deferred per spec — not included in these tasks
- Multiple SDR edge case (spec Edge Cases §6) deferred — P1/P2 uses the primary HackRF only. Multi-SDR selection will be addressed by spec-021 (USRP/SoapySDR integration)
- No new npm dependencies required (all math is native JS, all rendering reuses existing MapLibre patterns)
- No new server-side API endpoints — all computation is client-side
- `dashboard-map-logic.svelte.ts` lives at `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` (NOT in the `map/` subdirectory) — RF range derivation wires into this file as the map state orchestrator
- `hackrfStore` lives in `src/lib/stores/tactical-map/`, not `src/lib/stores/dashboard/` — import paths must reflect this
- The `RangeBand.rssi` field is not present on `RFRangeBand` — this is fine because `buildDetectionRangeGeoJSON()` only reads `outerR`, `innerR`, `band`, and `color`
