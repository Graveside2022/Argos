# Research: Line-of-Sight RF Range Overlay

**Feature**: 020-los-rf-range | **Date**: 2026-02-26

---

## Research Questions & Findings

### RQ-1: Friis Free-Space Path Loss Model — Parameters & Formula

**Decision**: Use the standard Friis transmission equation to compute maximum range from TX/RX parameters.

**Formula**:

```
FSPL(dB) = 20·log₁₀(d) + 20·log₁₀(f) + 20·log₁₀(4π/c)
         = 20·log₁₀(d) + 20·log₁₀(f) - 147.55   [d in meters, f in Hz]
```

Rearranged to solve for maximum distance given a link budget:

```
Link Budget = Pt + Gt + Gr - Sensitivity   [all in dBm/dBi]
d_max = 10^((LinkBudget - 20·log₁₀(f) + 147.55) / 20)   [meters, f in Hz]
```

Where:

- `Pt` = transmit power (dBm)
- `Gt` = transmit antenna gain (dBi)
- `Gr` = receive antenna gain (dBi, assumed 0 for generic receiver)
- `Sensitivity` = receiver sensitivity threshold (dBm, negative number)
- `f` = frequency (Hz)

**Rationale**: Friis is the standard first-order RF range estimate used by every military planning tool (ATAK/TAKX LOS plugin, VMAX, STK). It overestimates real range (ignores atmosphere, terrain, multipath) but provides a useful upper bound. The spec explicitly requests this model for P1.

**Alternatives considered**:

- Log-distance path loss (n=2.0 for free-space, n=3.3 for suburban) — already used in codebase for WiFi (`rssiToMeters()`). More realistic but requires environment classification the operator doesn't have.
- ITU-R P.525 / P.526 — essentially Friis with atmospheric absorption corrections. Overkill for P1, potential enhancement for future.
- Two-ray ground reflection — accounts for ground bounce at long range. Only relevant for VHF/UHF at distances > 1km with low antenna heights. Could be a P3+ enhancement.

---

### RQ-2: Signal Quality Band Thresholds

**Decision**: Define 4 concentric bands as fractions of the maximum Friis range, labeled by signal margin above receiver sensitivity.

| Band     | Radius           | Margin Above Sensitivity | Color                               | Opacity |
| -------- | ---------------- | ------------------------ | ----------------------------------- | ------- |
| Strong   | 0–25% of d_max   | > 12 dB                  | `--signal-very-strong` (sage green) | 0.14    |
| Usable   | 25–50% of d_max  | 6–12 dB                  | `--signal-strong` (blue)            | 0.11    |
| Marginal | 50–75% of d_max  | 3–6 dB                   | `--signal-fair` (gold)              | 0.09    |
| Maximum  | 75–100% of d_max | 0–3 dB                   | `--signal-weak` (red/faded)         | 0.06    |

**Rationale**: Path loss grows logarithmically with distance, so linear distance fractions correspond to roughly equal dB steps. The 4-band structure matches the spec requirement (FR-009: "at least 3 concentric bands") and aligns with the existing 5-band WiFi detection pattern. Using the existing `SIGNAL_COLORS` and `resolveMapColor()` ensures design system compliance.

**Why proportional, not absolute**: Fixed dB thresholds (like -50, -60, -70, -80) would produce bands that overlap or collapse depending on frequency. Proportional fractions always produce 4 visible, well-spaced bands regardless of the computed d_max.

---

### RQ-3: Hardware Presets — Default Values

**Decision**: Provide 3 presets per spec requirement (FR-008), plus a "Custom" option for manual entry.

| Preset               | TX Power (dBm) | Antenna Gain (dBi) | Sensitivity (dBm) | Height AGL (m) |
| -------------------- | -------------- | ------------------ | ----------------- | -------------- |
| HackRF Bare          | 10             | 0                  | -90               | 1.5            |
| HackRF + Amplifier   | 20             | 0                  | -90               | 1.5            |
| HackRF + Directional | 10             | 12                 | -90               | 1.5            |
| Custom               | (user-defined) | (user-defined)     | (user-defined)    | (user-defined) |

**Rationale**: Values from spec assumptions section. HackRF One bare output is ~10 dBm (10 mW), typical inline amp adds +10 dB, directional Yagi/log-periodic adds 10-15 dBi gain. Sensitivity -90 dBm is a conservative general-purpose threshold.

**Future extensibility**: When the USRP B205-mini integration arrives (spec 021+), its presets will use real TX power from device configuration via SoapySDR. The profile type is device-agnostic — it just needs `txPower`, `antennaGain`, `sensitivity`, `heightAgl`.

---

### RQ-4: Maximum/Minimum Display Radius Capping

**Decision**: Cap display radius at 50 km max, 50 m minimum.

**Rationale**:

- At 1 MHz with HackRF bare defaults, Friis gives d_max ≈ 2,800 km — rendering a circle that large breaks MapLibre (polygon wraps the globe). 50 km is the practical limit of any VHF/UHF LOS link and keeps the overlay within a reasonable map viewport.
- At 6 GHz with HackRF bare defaults, Friis gives d_max ≈ 9 m — a circle smaller than the GPS accuracy indicator. 50 m minimum ensures the overlay is always visible and tappable.
- Edge case label: when the display is capped, show "(capped)" suffix in the overlay label to indicate the circle doesn't represent the full theoretical range.

---

### RQ-5: How to Get Active Frequency on the Client

**Decision**: Subscribe to the HackRF SSE data stream (`/api/hackrf/data-stream`) for real-time `status` events that contain `currentFrequency`. Fall back to hardware status polling for connection state.

**Finding**: The `hackrfStore` already has `targetFrequency` and `connectionStatus` fields, plus setter functions (`setTargetFrequency`, `setConnectionStatus`), but **no code currently calls these setters**. The SSE stream emits `status` events with `SweepStatus.currentFrequency` and `sweep_data` events with `center_freq`/`peak_freq`.

**Approach**:

1. Create a lightweight `HackRFDataService` (analogous to `GPSService`) that opens an EventSource to `/api/hackrf/data-stream`
2. On `status` events: call `setTargetFrequency(status.currentFrequency)` and `setConnectionStatus('Connected')`
3. On `error`/`close`: call `setConnectionStatus('Disconnected')`
4. The RF range store reads `hackrfStore.targetFrequency` reactively
5. Hardware detection state (`sdrState: 'active'|'standby'|'offline'`) comes from existing TopStatusBar polling — no new polling needed

**Alternative rejected**: Adding frequency info to the WebSocket `/hackrf` channel. The SSE stream already carries this data and is the established pattern for HackRF real-time updates.

---

### RQ-6: Where to Place the RF Range Configuration UI

> **⚠️ SUPERSEDED**: This initial decision was replaced during plan.md Phase 5 design. The final approach is a card-based "Map Settings" hub that replaces the existing Layers panel — no new IconRail button needed. See plan.md Phase 5 for the authoritative design.

**Original Decision**: New sidebar panel (`activePanel === 'rf-range'`), accessible from a new IconRail button.

**Final Decision (plan.md)**: Redesign the existing Layers panel into a card-based "Map Settings" hub with 3 drill-down subviews: Map Provider, Map Layers, and Line of Sight. The Line of Sight subview contains all RF range configuration. This avoids adding a 4th icon rail button and keeps map-related settings co-located.

**UI structure** (LineOfSightView subview):

- Section 1: Enable toggle (master on/off)
- Section 2: Preset selector (dropdown with 3 presets + Custom)
- Section 3: Parameter sliders/inputs (TX power, antenna gain, sensitivity, height AGL)
- Section 4: Computed range readout (text display of d_max and band radii at current frequency)
- Section 5: Model badge ("Free-Space Estimate")
- Section 6: RF Range layer visibility toggle

---

### RQ-7: Terrain-Aware LOS (P3) — Data Source Options

**Decision**: Defer to Phase 3 implementation. Document options for future reference.

**Options evaluated**:

1. **Open-Meteo Elevation API** (free, no key) — batch query up to 100 points. Rate-limited. Requires network.
2. **Mapbox Terrain-DEM v1 tiles** — raster-dem tiles already supported by MapLibre GL for terrain visualization. Could query elevation client-side via `map.queryTerrainElevation()`.
3. **Local SRTM/DTED tiles** — 30m resolution elevation tiles cached locally. ~50 MB per 1°×1° tile. Works offline. Standard military format (DTED Level 1).
4. **USGS 3DEP** — 10m resolution but US-only. Overkill for training exercises.

**Recommended for P3**: MapLibre terrain query (option 2) for online use + local SRTM cache (option 3) for field deployment. This avoids external API dependencies while leveraging MapLibre's existing terrain rendering capabilities.

---

### RQ-8: Existing Infrastructure Reuse Audit

| Need                              | Existing Asset                                           | Reuse?                                                                   |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| GeoJSON ring polygon              | `createRingPolygon()` in `map-helpers.ts`                | Direct reuse                                                             |
| Concentric band FeatureCollection | `buildDetectionRangeGeoJSON()` in `map-geojson.ts`       | Direct reuse                                                             |
| `RangeBand` interface             | `map-geojson.ts`                                         | Direct reuse                                                             |
| Color resolution                  | `SIGNAL_COLORS` + `resolveMapColor()` in `map-colors.ts` | Direct reuse                                                             |
| MapLibre FillLayer pattern        | `detection-range-fill` in `DashboardMap.svelte`          | Parallel (new source+layer)                                              |
| Layer toggle infrastructure       | `LAYER_MAP`, `layerVisibility`, `syncLayerVisibility()`  | Extend (add entry)                                                       |
| GPS reactive state                | `createGpsDerivedState()` in `map-gps-derived.svelte.ts` | Pattern reuse (RF derivation wires into `dashboard-map-logic.svelte.ts`) |
| Memoized GeoJSON derivation       | `$derived.by()` with lat/lon guard                       | Pattern reuse                                                            |
| Sidebar panel switch              | `PanelContainer.svelte`                                  | Extend (add case)                                                        |
| Icon rail                         | `IconRail.svelte`                                        | Extend (add button)                                                      |
| Earth radius constant             | `GEO.EARTH_RADIUS_M` in `src/lib/constants/limits.ts`    | Direct reuse                                                             |
