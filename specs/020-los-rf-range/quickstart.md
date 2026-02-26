# Quickstart: RF Range Overlay Development

**Feature**: 020-los-rf-range | **Date**: 2026-02-26

---

## Prerequisites

- Argos dev server running (`npm run dev`)
- HackRF One connected (or mock via existing hardware status API)
- GPS fix (or simulated via gpsd)

## Build Order

Implementation follows a bottom-up dependency chain. Each phase is independently testable.

### Phase 1: Core Propagation Math (no UI, pure functions)

**Files to create**:

1. `src/lib/types/rf-range.ts` — Types: `RFRangeProfile`, `RFRangeBand`, `PropagationModel`, presets constant
2. `src/lib/utils/rf-propagation.ts` — `calculateFriisRange()`, `buildRFRangeBands()`, `clampDisplayRange()`

**Test**: `npx vitest run src/lib/utils/rf-propagation.test.ts`

- Verify Friis at known frequencies (900 MHz, 2.4 GHz, 5.8 GHz)
- Verify band proportions (25/50/75/100% of d_max)
- Verify capping at 50m min, 50km max

### Phase 2: RF Range Store (reactive state, no rendering)

**Files to create**: 3. `src/lib/stores/dashboard/rf-range-store.ts` — Persisted store with preset selection, custom profile, frequency source

**Files to modify**: 4. `src/lib/stores/dashboard/dashboard-store.ts` — Add `rfRange: false` to `layerVisibility`

**Test**: `npx vitest run src/lib/stores/dashboard/rf-range-store.test.ts`

- Verify preset switching updates active profile
- Verify custom parameter changes persist
- Verify frequency source toggle

### Phase 3: HackRF Data Service (wires SDR frequency to store)

**Files to create**: 5. `src/lib/tactical-map/hackrf-data-service.ts` — EventSource subscriber to `/api/hackrf/data-stream`, populates `hackrfStore`

**Test**: Integration test with mock SSE server

### Phase 4: Map Integration (GeoJSON derivation + rendering)

**Files to create**: 6. `src/lib/components/dashboard/map/rf-range-derived.svelte.ts` — Reactive GeoJSON from GPS + frequency + profile

**Files to modify**: 7. `src/lib/components/dashboard/map/map-helpers.ts` — Add `rfRange` to `LAYER_MAP` 8. `src/lib/components/dashboard/DashboardMap.svelte` — Add `<GeoJSONSource>` + `<FillLayer>` for RF range 9. `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — Wire `rfRangeGeoJSON` into map state

**Test**: Visual — enable overlay, change frequency, verify rings appear and resize

### Phase 5: Map Settings Panel Redesign (Layers → Card Navigation)

**Files to create**:

- `src/lib/components/dashboard/panels/MapSettingsPanel.svelte` — Card hub with 3 clickable cards + subview routing
- `src/lib/components/dashboard/panels/MapProviderView.svelte` — Extracted: Tactical/Satellite/Custom URL
- `src/lib/components/dashboard/panels/MapLayersView.svelte` — Extracted: Visibility Filter + Layer toggles + Signal Strength bands
- `src/lib/components/dashboard/panels/LineOfSightView.svelte` — NEW: RF range config (presets, params, range readout, enable toggle)

**Files to modify**:

- `src/lib/components/dashboard/PanelContainer.svelte` — Swap `'layers'` → `'map-settings'`, render `MapSettingsPanel`
- `src/lib/components/dashboard/IconRail.svelte` — Rename Layers → Map Settings
- `src/lib/stores/dashboard/dashboard-store.ts` — Update `activePanel` default
- `src/lib/stores/dashboard/map-settings-store.ts` — Add `activeMapSettingsView` state

**Files to delete**:

- `src/lib/components/dashboard/panels/LayersPanel.svelte` — Replaced by MapSettingsPanel + subviews

**Test**: Visual — click Map Settings icon → see 3 cards → drill into each → back button returns to cards. Line of Sight view: switch presets, adjust params, verify overlay updates on map.

---

## Verification Checklist

```bash
# Type check
npx tsc --noEmit

# Lint new files
npx eslint src/lib/utils/rf-propagation.ts src/lib/types/rf-range.ts src/lib/stores/dashboard/rf-range-store.ts --config config/eslint.config.js

# Unit tests
npx vitest run src/lib/utils/rf-propagation.test.ts
npx vitest run src/lib/stores/dashboard/rf-range-store.test.ts

# Build
npm run build
```

## Key Gotchas

1. **Frequency units**: HackRF SSE sends Hz internally but `targetFrequency` in `hackrfStore` is MHz (default 2437). Be explicit about Hz vs MHz at every boundary.
2. **GeoJSON memoization**: The `$derived.by()` must guard on GPS position + frequency + profile to avoid rebuilding 60 times/second.
3. **Color resolution**: `resolveMapColor()` reads CSS custom properties — only works in the browser. Tests need to mock or use the fallback hex values.
4. **Layer visibility sync**: Adding to `LAYER_MAP` is sufficient — `syncLayerVisibility()` iterates the map automatically. No changes needed in the sync function itself.
5. **Performance budget**: SC-005 says < 15 MB additional memory, < 5% CPU. The GeoJSON FeatureCollection for 4 bands with 48-step polygons is ~12 KB — well within budget. The Friis calculation is a single `Math.pow(10, ...)` — negligible CPU.
6. **Panel rename migration**: Any code that references `activePanel === 'layers'` must be updated to `'map-settings'`. Search for `'layers'` in stores and components. The `layerVisibility` store key stays the same — only the panel identifier changes.
7. **CSS extraction**: The shared toggle/section styles from `layers-panel.css` must be preserved and importable by all 3 subview components. Consider renaming to `map-settings-shared.css` or creating a shared import pattern.
