# Tasks: Terrain-Aware Viewshed Analysis

**Input**: Design documents from `/specs/022-terrain-viewshed/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/viewshed-api.md, quickstart.md

**Tests**: Unit tests are included per plan.md Phase 1 and Phase 2 specifications.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extract DTED data and configure environment. `pngjs@7` already installed. `.gitignore` already covers `/data/`.

- [ ] T001 Extract DTED Level 0 tiles: `mkdir -p data/dted && unzip -q docs/dtedlevel0.zip -d data/dted/` (~597 MB, 26,024 tiles, ~5 min on NVMe). Verify: `ls data/dted/w117/n34.dt0` exists, `find data/dted -name '*.dt0' | wc -l` returns ~26,024. DTED zip structure is flat `<westing>/<northing>.dt0` (confirmed).
- [ ] T002 [P] Add `DTED_DATA_DIR=./data/dted` to `.env.example`
- [ ] T003 Add `DTED_DATA_DIR` env var to Zod schema in `src/lib/server/env.ts` (default: `./data/dted`, must be a valid directory path)

**Checkpoint**: `ls data/dted/w117/n34.dt0` returns a file (~34 KB). `DTED_DATA_DIR` validated by env module. `xxd -l 4 data/dted/w117/n34.dt0` shows `UHL1` (55 48 4c 31).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DTED parser, tile index, viewshed algorithm, and API endpoints — the backend engine that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Types

- [ ] T004 Create TypeScript types in `src/lib/types/viewshed.ts`: `DTEDTileHeader`, `DTEDTile`, `DTEDTileIndexEntry`, `ViewshedParams`, `ViewshedResult`, `ViewshedBounds`, `ViewshedMeta`, `ViewshedStoreState` per data-model.md. Note: `ViewshedStoreState` stores ONLY viewshed-specific fields (`isEnabled`, `heightAglM`, `radiusM`, `greenOpacity`, `redOpacity`, `adjustTogether`). Preset/frequency fields stay in `RFRangeStoreState` — no duplication.

### DTED Parser

- [ ] T005 Implement DTED Level 0 binary parser in `src/lib/server/services/terrain/dted-parser.ts`: parse UHL header (80 bytes), skip DSI (648) + ACC (2700), extract elevation grid from column-major blocks with signed-magnitude decoding, `getElevation()` and `getElevationNearest()` functions. Handle UHL sentinel scan (some files have VOL/HDR before UHL), void data (-32767 / raw 0x8001), and latitude-zone column count variation (121 cols at 0-50°, fewer at higher latitudes).
- [ ] T006 Write unit tests in `src/lib/server/services/terrain/dted-parser.test.ts`: parse real `.dt0` tile from `data/dted/w117/n34.dt0`, verify UHL header fields, verify elevation at known NTC coordinates, verify signed-magnitude decoding for negative elevations, verify void data handling

### Tile Index

- [ ] T007 Implement tile directory scanner + LRU cache in `src/lib/server/services/terrain/dted-tile-index.ts`: `DTEDTileIndex` class that scans `DTED_DATA_DIR` for `.dt0` files, builds `Map<string, DTEDTileIndexEntry>` lookup, provides `getTilesForArea(lat, lon, radiusM): DTEDTile[]` loading 1-4 tiles. LRU cache capacity 9 tiles (~520 KB). Exposes `tileCount`, `coverageBounds`, `cacheStats` for the status endpoint.
- [ ] T008 Write unit tests in `src/lib/server/services/terrain/dted-tile-index.test.ts`: tile path computation from lat/lon, cache hit/miss behavior, multi-tile coverage for edge positions, coverage bounding box calculation

### Viewshed Algorithm

- [ ] T009 Implement radial LOS sweep + PNG encoding in `src/lib/server/services/terrain/viewshed-compute.ts`: `computeViewshed(params, tileIndex)` — 360 rays at 1° intervals, sample elevation every ~half-post, track max elevation angle, classify visible/obstructed, output RGBA pixel buffer (green=visible R:0/G:200/B:0, red=obstructed R:200/G:0/B:0, alpha=configurable, nodata=transparent), encode to PNG via `pngjs` (use `Buffer.from(rgbaArray.buffer)` for zero-copy), return base64 data URI + bounding box. Cap output at 256×256 pixels.
- [ ] T010 Write unit tests in `src/lib/server/services/terrain/viewshed-compute.test.ts`: all-visible on flat terrain, cells behind known ridge are obstructed, boundary conditions at tile edge, 5 km radius completes in < 3 seconds on ARM, correct PNG encoding (starts with `data:image/png;base64,`)

### API Endpoints

- [ ] T011 Create POST endpoint in `src/routes/api/viewshed/compute/+server.ts`: validate request body with Zod schema (lat, lon, heightAgl, radiusM, greenOpacity, redOpacity per contracts/viewshed-api.md), export `POST: RequestHandler` (standard pattern), singleton `DTEDTileIndex` (initialized on first request), call `computeViewshed()`, return `{ imageDataUri, bounds, meta }`. Cache last result keyed by `floor(lat*1000), floor(lon*1000)` + params (~111m tolerance). Handle no-DTED-coverage (200 with null image + reason string). Support `noCache: true` for cache bypass.
- [ ] T012 [P] Create GET endpoint in `src/routes/api/viewshed/status/+server.ts`: return `{ loaded, tileCount, coverage, dataDir, cacheSizeBytes, cacheCapacity, cacheTiles }` per viewshed-api.md contract. When no tiles: return `{ loaded: false, tileCount: 0, message: "..." }`.

**Checkpoint**: `npx vitest run src/lib/server/services/terrain/` passes. `curl -X POST http://localhost:5173/api/viewshed/compute -H "X-API-Key: ..." -d '{"lat":35.2622,"lon":-116.6831,"heightAgl":2,"radiusM":5000}'` returns JSON with `imageDataUri` (base64 PNG) and `bounds`. `curl http://localhost:5173/api/viewshed/status` returns `{"loaded":true,"tileCount":26024,...}`.

---

## Phase 3: User Story 1 — Terrain-Aware Line of Sight Overlay (Priority: P1) 🎯 MVP

**Goal**: Replace Friis circular RF range rings with terrain-aware viewshed on the map. Green = visible, red = obstructed. Recalculates on GPS movement (>50m) or parameter changes within 3 seconds (end-to-end: GPS change → API call → overlay update).

**Independent Test**: Enable Line of Sight overlay with GPS fix and DTED tiles. Verify green areas in clear sightlines, red areas behind ridges. Adjust Height Above Ground — visible area expands. Adjust radius — overlay extends/contracts. Old Friis rings are completely gone.

### Implementation for User Story 1

- [ ] T013 [US1] Create viewshed store in `src/lib/stores/dashboard/viewshed-store.ts`: persisted via `persistedWritable`, Zod validation on hydration. Viewshed-only fields: `isEnabled` (default false), `heightAglM` (default 2), `radiusM` (default 5000), `greenOpacity` (default 0.37), `redOpacity` (default 0.92), `adjustTogether` (default true). Reads preset/frequency from existing `rfRangeStore` — NO duplication of `activePresetId`, `frequencySource`, `manualFrequencyMHz`. Convenience setters with min/max clamping per FR-005 and FR-006.
- [ ] T014 [US1] Create reactive viewshed state in `src/lib/components/dashboard/map/viewshed-derived.svelte.ts`: watch GPS position (from `gpsStore`) + viewshed store + `rfRangeStore` (for preset/frequency). When enabled + GPS fix available, fetch `/api/viewshed/compute` with current params. Debounce 500ms after last param change. Skip if position delta < 50m and params unchanged. Expose `viewshedImageUrl`, `viewshedBounds`, `viewshedActive`, `viewshedInactiveReason`, `isComputing`. Log `meta.computeTimeMs` for SLA tracking. Rename `layerVisibility` key from `rfRange` to `viewshed` in `src/lib/stores/dashboard/dashboard-store.ts`.
- [ ] T015 [US1] Modify `src/lib/components/dashboard/DashboardMap.svelte`: remove `rf-range-src` GeoJSONSource + FillLayer (lines ~48-68) and `rf-range-label-src` GeoJSONSource + SymbolLayer (lines ~70-80). Add MapLibre `ImageSource` id `viewshed-src` using `viewshedImageUrl` and `viewshedBounds` coordinates `[[west,north],[east,north],[east,south],[west,south]]`. Single `RasterLayer` id `viewshed-layer` renders the image. Use `source.updateImage()` for atomic swap (no flicker).
- [ ] T016 [US1] Modify `src/lib/components/dashboard/dashboard-map-logic.svelte.ts`: replace `import { createRFRangeDerivedState }` with viewshed derived state. Remove `rfRangeDerived` and its 6 getter delegations (lines ~255-268). Expose `viewshedImageUrl`, `viewshedBounds`, `viewshedActive`, `isComputingViewshed`, `viewshedInactiveReason` getters.

**Checkpoint**: Open dashboard with GPS fix and DTED loaded. Enable Line of Sight → green/red terrain overlay appears centered on operator. Old Friis concentric rings are completely gone. Moving >50m triggers recalculation. Adjusting height/radius recomputes within 3 seconds. Verify: close browser tab, reopen → settings persist (FR-013).

---

## Phase 4: User Story 2 — DTED Tile Management (Priority: P1)

**Goal**: Operator can see DTED coverage status — which geographic areas have elevation data. Clear messaging when no data is available.

**Independent Test**: Open Line of Sight panel. Verify DTED status shows tile count and coverage region. Navigate outside coverage — verify "No elevation data" message. Extract fresh DTED .zip — verify system detects new tiles.

### Implementation for User Story 2

- [ ] T017 [US2] Create DTED extraction script in `scripts/ops/extract-dted.sh`: takes `.zip` path as arg 1, optional output dir as arg 2 (default: `data/dted`). Creates output dir if missing, extracts with `unzip -q`, counts `.dt0` files, computes and prints coverage summary (min/max lat/lon from directory names). Exit 1 on invalid zip or zero tiles extracted.
- [ ] T018 [US2] Create DTED status sub-component in `src/lib/components/dashboard/panels/viewshed/DTEDStatus.svelte`: fetch `/api/viewshed/status` on mount (with API key from session cookie), display "Loaded: X tiles covering [lat range] × [lon range]" when tiles present, or "No elevation data — extract DTED tiles to data/dted/" with guidance when absent. Handle loading/error states. < 80 lines.
- [ ] T019 [US2] Handle no-DTED-coverage response in `src/lib/components/dashboard/map/viewshed-derived.svelte.ts`: when API returns `imageDataUri: null`, set `viewshedInactiveReason` to the `reason` string from the response, clear any existing image overlay from the map source.

**Checkpoint**: Line of Sight panel shows DTED status indicator with tile count. Outside coverage area shows clear "no data" message. `bash scripts/ops/extract-dted.sh docs/dtedlevel0.zip` extracts and reports summary.

---

## Phase 5: User Story 3 — Viewshed Appearance Controls (Priority: P2)

**Goal**: Independent opacity sliders for visible (green) and obstructed (red) areas, with "Adjust Together" toggle. ATAK-style controls. Full panel rewrite as component composition.

**Independent Test**: Enable viewshed. Adjust "Visible" opacity — green areas change without affecting red. Adjust "Obstructed" opacity — red changes independently. Toggle "Adjust Together" — both sliders move in sync. Close and reopen panel — settings persist.

### Implementation for User Story 3

- [ ] T020 [US3] Create viewshed controls sub-component in `src/lib/components/dashboard/panels/viewshed/ViewshedControls.svelte`: Height Above Ground slider (0.5–100m, default 2m, step 0.5) with Fira Code numeric readout, Radius slider (100m–50km, default 5km, logarithmic scale) with readout and "RF CAPPED" badge slot. Reads/writes viewshed store. < 100 lines.
- [ ] T021 [US3] Create opacity controls sub-component in `src/lib/components/dashboard/panels/viewshed/OpacityControls.svelte`: "OVERLAY OPACITY" section header, Visible (green) slider 0–100% (default 37%), Obstructed (red) slider 0–100% (default 92%), "Adjust Together" toggle. Self-contained proportional linking logic. Reads/writes viewshed store. < 100 lines.
- [ ] T022 [US3] Rewrite `src/lib/components/dashboard/panels/LineOfSightView.svelte` as composition shell: import and compose `<DTEDStatus />`, `<ViewshedControls />`, `<OpacityControls />`. Retain: enable toggle, hardware preset selector, frequency source selector, computed RF range readout, "Show on Map" toggle (using `layerVisibility.viewshed`). Remove: old TX parameters section, 4-band color legend, band radii computation. Update model badge text to "Terrain-Aware Viewshed". Target: < 200 lines (down from 518).
- [ ] T023 [US3] Add opacity slider and DTED status indicator styles to `src/lib/components/dashboard/panels/map-settings-shared.css`: Lunaris-themed range inputs with Fira Code readouts, `.dted-status` indicator, `.opacity-slider` styles, `.rf-capped-badge` styles — all using design tokens (no hardcoded hex).
- [ ] T024 [US3] Wire "Adjust Together" logic in viewshed store `src/lib/stores/dashboard/viewshed-store.ts`: when `adjustTogether` is true and either opacity changes, compute proportional adjustment for the other slider. Add `setGreenOpacity(value)` and `setRedOpacity(value)` methods that respect the toggle.

**Checkpoint**: Panel shows all ATAK-style controls via sub-components. Opacity sliders work independently and linked. Settings persist across page reloads. All design tokens used — no hardcoded hex. LineOfSightView.svelte < 200 lines (Article II.2 compliant).

---

## Phase 6: User Story 4 — RF-Aware Viewshed with Hardware Presets (Priority: P2)

**Goal**: Viewshed radius is capped by calculated RF range for the active hardware preset and frequency. Switching presets adjusts the viewshed radius.

**Independent Test**: Enable viewshed with HackRF Bare at 2.4 GHz — note radius. Switch to HackRF + Amplifier — radius expands. Set manual radius exceeding RF range — verify radius caps with "RF CAPPED" badge. Change frequency — radius adjusts.

### Implementation for User Story 4

- [ ] T025 [US4] Wire RF range capping in `src/lib/components/dashboard/map/viewshed-derived.svelte.ts`: read active preset from `rfRangeStore` (not duplicated in viewshed store), read frequency from `hackrfStore` (auto) or `rfRangeStore.manualFrequencyMHz` (manual), call `calculateFriisRange()` from `src/lib/utils/rf-propagation.ts`, cap `radiusM` param sent to API at the computed RF range. Expose `isRfCapped` and `effectiveRadiusM`.
- [ ] T026 [US4] Wire "RF CAPPED" badge in `src/lib/components/dashboard/panels/viewshed/ViewshedControls.svelte`: when `isRfCapped` is true (passed as prop from parent), show badge next to radius readout. Display computed max RF range value. Update model badge text: "Terrain-Aware Viewshed" when active, note "RF-limited" when capped.
- [ ] T027 [US4] Ensure preset and frequency changes trigger viewshed recalculation via store reactivity in `src/lib/components/dashboard/map/viewshed-derived.svelte.ts`: `rfRangeStore` changes (preset, frequency source, manual frequency) → RF range recalculation → new effective radius → viewshed API refetch

**Checkpoint**: Viewshed radius adjusts when switching presets. "RF CAPPED" badge appears when manual radius exceeds RF range. Frequency changes trigger recalculation. Hardware preset selector and frequency source controls work as before.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, cleanup, and validation across all stories

- [ ] T028 [P] Handle GPS loss in viewshed derived state (`viewshed-derived.svelte.ts`): freeze overlay at last position for 30s (matching `GPS_STALE_TIMEOUT_MS` from rf-propagation.ts), then clear with "GPS signal lost" indicator
- [ ] T029 [P] Handle tile-edge viewshed (`viewshed-compute.ts`): when observer is near tile boundary, render for covered area, mark uncovered sectors as transparent (RGBA 0,0,0,0)
- [ ] T030 [P] Add loading indicator in Line of Sight panel when `isComputing` is true (for radii > 500ms compute time per FR-015)
- [ ] T031 [P] Add DTED extraction step to `scripts/ops/setup-host.sh` (conditional — only if `docs/dtedlevel0.zip` exists and `data/dted/` is empty)
- [ ] T032 Verify `npm run build` succeeds with all changes
- [ ] T033 Run quickstart.md verification checklist (all 9 items)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core map integration
- **US2 (Phase 4)**: Depends on Phase 2 + partially on US1 (shares derived state)
- **US3 (Phase 5)**: Depends on US1 (needs viewshed store wired). Creates the sub-components that US2's DTEDStatus sits alongside.
- **US4 (Phase 6)**: Depends on US1 + US3 (needs panel sub-components and derived state)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependencies on other stories.
- **US2 (P1)**: Can start after Phase 2. DTEDStatus sub-component is independent but consumed by the panel shell in US3.
- **US3 (P2)**: Depends on US1 (viewshed store must exist) and US2 (DTEDStatus component). Does the full panel rewrite as composition shell.
- **US4 (P2)**: Depends on US3 (needs ViewshedControls sub-component for RF CAPPED badge).

### Recommended Sequential Order

```
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7
```

### Within Each Phase

- Types before implementations (T004 first)
- Parser before tile index (T005 before T007)
- Tile index before viewshed algorithm (T007 before T009)
- Algorithm before API endpoint (T009 before T011)
- Store before derived state (T013 before T014)
- Derived state before map integration (T014 before T015)
- Tests alongside their implementation (T006 with T005, T008 with T007, T010 with T009)

### Parallel Opportunities

**Phase 2**: T006 can run in parallel with T007 (test file vs next implementation). T012 can run in parallel with T011 (different endpoint files).
**Phase 4**: T017 (shell script) and T018 (Svelte component) are fully parallel.
**Phase 5**: T020 and T021 can run in parallel (different sub-component files). T023 (CSS) should complete before T022 (panel shell).
**Phase 7**: T028, T029, T030, T031 are all independent of each other.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Sequential chain (each depends on the previous):
T004 → T005+T006 → T007+T008 → T009+T010 → T011

# T012 (status endpoint) can run in parallel with T011 (compute endpoint):
Task: "Create POST /api/viewshed/compute endpoint"     # T011
Task: "Create GET /api/viewshed/status endpoint"        # T012  [P]
```

## Parallel Example: Phase 5 (UI Sub-Components)

```bash
# Sub-components can be built in parallel:
Task: "Create ViewshedControls.svelte"                  # T020  [P]
Task: "Create OpacityControls.svelte"                   # T021  [P]

# Then compose:
Task: "Rewrite LineOfSightView.svelte as shell"         # T022 (depends on T020, T021, T018)
```

## Parallel Example: Phase 7 (Polish)

```bash
# All four edge-case tasks can run in parallel:
Task: "Handle GPS loss in viewshed derived state"       # T028  [P]
Task: "Handle tile-edge viewshed rendering"             # T029  [P]
Task: "Add loading indicator for slow computations"     # T030  [P]
Task: "Add DTED extraction to setup-host.sh"            # T031  [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (extract DTED, configure env)
2. Complete Phase 2: Foundational (parser, tile index, algorithm, API)
3. Complete Phase 3: User Story 1 (store, derived state, map integration)
4. **STOP and VALIDATE**: Viewshed overlay appears on map, Friis rings gone, recalculates on movement
5. This is a fully functional terrain viewshed — deploy/demo ready

### Incremental Delivery

1. Setup + Foundational → Backend engine ready
2. Add US1 → Terrain viewshed on map (MVP!)
3. Add US2 → DTED status visibility for operators
4. Add US3 → ATAK-style opacity controls + component split
5. Add US4 → RF-aware radius capping
6. Polish → Edge cases, loading states, setup script
7. Each story adds value without breaking previous stories

---

## Notes

- `pngjs@7` is already installed in package.json — no `npm install` needed
- `.gitignore` already covers `/data/` — no gitignore edit needed
- Viewshed store holds ONLY viewshed-specific fields (height, radius, opacity, adjustTogether). Preset and frequency stay in `rfRangeStore` — zero duplication.
- LineOfSightView.svelte split into 3 sub-components (`DTEDStatus`, `ViewshedControls`, `OpacityControls`) under `panels/viewshed/` — each < 100 lines, shell < 200 lines (Article II.2 compliant)
- `layerVisibility` key renamed from `rfRange` to `viewshed` in dashboard-store.ts
- DTED zip confirmed: flat `<westing>/<northing>.dt0` structure, 26,024 files, 596 MB, NTC tiles (`w117/n34.dt0`, `w117/n35.dt0`) present at ~34 KB each
- No database migrations needed — all data is filesystem (DTED), ephemeral (viewshed cache), or client-persisted (localStorage)
- Performance target: viewshed computation < 3s for 5 km radius on Pi 5 ARM Cortex-A76
- Total new files: 13 (10 original + 3 sub-components) | Modified files: 5 | New npm deps: 0
