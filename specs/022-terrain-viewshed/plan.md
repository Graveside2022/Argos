# Implementation Plan: Terrain-Aware Viewshed Analysis

**Branch**: `022-terrain-viewshed` | **Date**: 2026-02-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/022-terrain-viewshed/spec.md`

## Summary

Replace the Friis free-space circular RF range overlay with an ATAK-style terrain-aware viewshed. A server-side DTED parser reads locally-stored Level 0 elevation tiles, a radial line-of-sight algorithm computes visible vs obstructed cells, and the result renders as a georeferenced image overlay on the MapLibre map. The Line of Sight card in Map Settings gains ATAK-style controls: Height Above Ground, Radius, and independent green/red opacity sliders. Existing hardware presets and frequency source controls are retained to cap the viewshed radius by RF range.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: SvelteKit 2, MapLibre GL JS (existing), pngjs (new — pure JS PNG encoder, zero native deps)
**Storage**: Filesystem (DTED `.dt0` tiles on NVMe SSD, ~597 MB extracted)
**Testing**: Vitest (unit tests for DTED parser, viewshed algorithm, API endpoint)
**Target Platform**: Raspberry Pi 5, Kali Linux, Chromium, 8 GB RAM
**Project Type**: SvelteKit web application (existing)
**Performance Goals**: Viewshed computation < 3s for 5 km radius (SC-001/SC-003). Image overlay render < 100ms.
**Constraints**: < 200 MB RAM for viewshed (SC-005), < 50% CPU. Fully offline — no cloud elevation APIs.
**Scale/Scope**: ~10 new files, ~6 modified files. 1 new npm dependency (pngjs). 1 new API endpoint.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                  | Requirement                         | Status         | Notes                                                                   |
| ------------------------ | ----------------------------------- | -------------- | ----------------------------------------------------------------------- |
| I.1 Comprehension Lock   | Confirmed understanding             | PASS           | End state: terrain viewshed overlay. Current: Friis circular rings.     |
| I.2 Codebase Inventory   | Search existing before creating     | PASS           | Full inventory in research.md RQ-5. 12 reusable assets identified.      |
| II.1 TypeScript Strict   | No `any`, no `@ts-ignore`           | PASS           | DTED parser uses typed Buffer reads. Viewshed grid is `Uint8Array`.     |
| II.2 Modularity          | < 300 lines/file, < 50 lines/fn     | PASS           | DTED parser ~150 lines. Viewshed ~100 lines. API route ~80 lines.       |
| II.3 Naming              | kebab-case files, camelCase vars    | PASS           | `dted-parser.ts`, `viewshed-compute.ts`, `viewshed-store.ts`.           |
| II.6 Forbidden           | No barrel files, no catch-all utils | PASS           | Each module is domain-specific.                                         |
| III.1 Test-First         | Tests before/alongside impl         | PASS           | Unit tests for DTED parser and viewshed algorithm.                      |
| IV.1 Design Language     | Lunaris, dark mode, design tokens   | PASS           | Viewshed controls use existing shared CSS + design tokens.              |
| IV.3 State Communication | All states handled                  | PASS           | States: Disabled, Loading (computing), Active, Error (no DTED), No GPS. |
| V.1 Real-Time            | < 16ms WebSocket                    | N/A            | Viewshed uses REST API, not WebSocket.                                  |
| V.3 Resources            | < 15% CPU, < 200 MB heap            | PASS           | Viewshed computation < 10ms for typical radius. DTED tiles ~33 KB each. |
| VI.3 Forbidden           | No `npm install` without approval   | NEEDS APPROVAL | `pngjs` — pure JS PNG encoder, zero native deps, ~50 KB.                |
| VIII.1 Security          | Validate inputs                     | PASS           | API validates lat/lon/height/radius ranges. DTED files read-only.       |
| IX.1 Documents           | spec → plan → tasks                 | PASS           | This document.                                                          |

**Gate result: PASS with exception** — VI.3: `pngjs` is a required new npm dependency for encoding the viewshed image on the server. Pure JavaScript, zero native bindings, ~50 KB. Justification: MapLibre `ImageSource` needs a PNG image; encoding a raw RGBA buffer to PNG requires a library.

## Project Structure

### Documentation (this feature)

```text
specs/022-terrain-viewshed/
├── spec.md                         # Feature specification
├── plan.md                         # This file
├── research.md                     # Phase 0 research findings
├── data-model.md                   # Entity definitions
├── quickstart.md                   # Build order and verification
├── contracts/
│   └── viewshed-api.md             # REST API contract
├── checklists/
│   └── requirements.md             # Specification quality checklist
└── tasks.md                        # Task breakdown (from /speckit.tasks)
```

### Source Code (new + modified)

```text
# ── New files ──────────────────────────────────────────────────

src/lib/server/services/terrain/
├── dted-parser.ts              # NEW — DTED Level 0 binary file parser
├── dted-tile-index.ts          # NEW — Tile directory scanner + LRU cache
└── viewshed-compute.ts         # NEW — Radial LOS algorithm + PNG output

src/lib/types/
└── viewshed.ts                 # NEW — ViewshedParams, ViewshedResult types

src/routes/api/viewshed/
└── compute/+server.ts          # NEW — POST /api/viewshed/compute endpoint

src/lib/stores/dashboard/
└── viewshed-store.ts           # NEW — Persisted viewshed settings (height, radius, opacity)

src/lib/components/dashboard/map/
└── viewshed-derived.svelte.ts  # NEW — Reactive state: fetch viewshed, manage ImageSource

# ── Modified files ─────────────────────────────────────────────

src/lib/types/rf-range.ts                           # MODIFY — Add viewshed-specific fields to store state
src/lib/stores/dashboard/rf-range-store.ts           # MODIFY — Add viewshed settings to persisted state
src/lib/components/dashboard/panels/
    └── LineOfSightView.svelte                       # REWRITE — Replace Friis UI with viewshed controls
src/lib/components/dashboard/DashboardMap.svelte     # MODIFY — Replace GeoJSON rf-range with ImageSource
src/lib/components/dashboard/
    └── dashboard-map-logic.svelte.ts                # MODIFY — Wire viewshed derived state
src/lib/components/dashboard/panels/
    └── map-settings-shared.css                      # MODIFY — Add opacity slider styles

# ── Deleted code (within files, not whole files) ───────────────

src/lib/utils/rf-propagation.ts                      # KEEP — buildRFRangeBands() unused but calculateFriisRange() retained
src/lib/components/dashboard/map/
    └── rf-range-derived.svelte.ts                   # REWRITE → viewshed-derived.svelte.ts
```

**Structure Decision**: The terrain service goes in `src/lib/server/services/terrain/` following the existing pattern of domain-specific service directories (`services/media/`, `services/gps/`). The viewshed API follows the existing `/api/` route convention with `createHandler`. DTED parsing and viewshed computation are separate files (single responsibility), both under the terrain service directory.

## Implementation Phases

### Phase 1: DTED Parser + Tile Index (Foundation)

**Goal**: Parse raw DTED `.dt0` binary files in TypeScript. Build a tile index that locates and caches tiles by geographic coordinates.

**New files**:

- `src/lib/types/viewshed.ts` — TypeScript types: `DTEDTileHeader` (origin, shape, intervals), `ElevationGrid` (2D typed array wrapper), `ViewshedParams` (lat, lon, heightAgl, radiusM), `ViewshedResult` (image data URI, bounding box, metadata)
- `src/lib/server/services/terrain/dted-parser.ts` — `parseDTEDFile(filePath): DTEDTile` reads a `.dt0` file, parses UHL header (80 bytes), skips DSI (648) + ACC (2700), extracts elevation grid from column-major blocks with signed-magnitude decoding. Returns typed `DTEDTile` with `getElevation(lat, lon): number` method.
- `src/lib/server/services/terrain/dted-tile-index.ts` — `DTEDTileIndex` class: scans a directory for `.dt0` files, builds a lookup map `(westing, northing) → filePath`, provides `getTilesForArea(lat, lon, radiusM): DTEDTile[]` that loads 1-4 tiles covering the viewshed area. LRU cache (capacity 9 tiles, ~300 KB).
- `src/lib/server/services/terrain/dted-parser.test.ts` — Unit tests: parse a real `.dt0` tile from the extracted DTED data, verify header fields, verify elevation values at known coordinates, verify signed-magnitude decoding, verify void data handling.
- `src/lib/server/services/terrain/dted-tile-index.test.ts` — Unit tests: tile path computation from lat/lon, cache hit/miss behavior, multi-tile coverage for edge positions.

**Key design decisions**:

- **No npm DTED package exists** — we write our own parser (~150 lines), referencing [bbonenfant/dted](https://github.com/bbonenfant/dted) (Python) for byte offsets. The format is simple: 3 fixed headers + column-major elevation blocks.
- **Signed magnitude**: DTED stores negative elevations as sign-magnitude (bit 15 = sign, bits 0-14 = magnitude), not two's complement. Parser converts: `if (raw & 0x8000) elevation = -(raw & 0x7FFF)`.
- **In-memory tile**: Each DTED Level 0 tile is ~33 KB — trivially fits in memory. `DTEDTile` loads the entire elevation grid into a `Float32Array` on parse for fast repeated lookups.
- **LRU cache**: 9-tile capacity covers a 3×3 grid around the operator. At ~33 KB per tile, the cache uses ~300 KB. Tiles evict by least-recent access.

**Checkpoint**: `npx vitest run src/lib/server/services/terrain/dted-parser.test.ts` passes. Can parse a real `.dt0` file and query elevation at a known coordinate.

---

### Phase 2: Viewshed Algorithm + API Endpoint

**Goal**: Implement the radial LOS sweep, encode the result as a PNG image, and expose it via a REST endpoint.

**New files**:

- `src/lib/server/services/terrain/viewshed-compute.ts` — `computeViewshed(params: ViewshedParams, tileIndex: DTEDTileIndex): ViewshedResult`. Implements radial sweep: 360 rays at 1° intervals, sample elevation every ~half-post along each ray, track max elevation angle, classify each cell as visible (1) or obstructed (0). Outputs an RGBA pixel buffer (green = visible, red = obstructed, alpha = configurable), encodes to PNG via `pngjs`, returns as base64 data URI with geographic bounding box.
- `src/routes/api/viewshed/compute/+server.ts` — POST endpoint. Validates request body (lat, lon, heightAgl, radiusM, greenOpacity, redOpacity). Loads tiles via DTEDTileIndex singleton. Calls `computeViewshed()`. Returns JSON `{ imageDataUri, bounds: { north, south, east, west }, meta: { computeTimeMs, cellCount, tilesUsed } }`. Caches last result — if params match within tolerance, returns cached.
- `src/lib/server/services/terrain/viewshed-compute.test.ts` — Unit tests: viewshed on flat terrain (all visible), viewshed with a known ridge (cells behind ridge obstructed), boundary conditions (observer at tile edge), performance test (5 km radius completes < 3s).

**Key design decisions**:

- **Image resolution**: The output image is sized to match the DTED grid resolution within the radius. For 5 km at DTED Level 0, that's ~11×11 cells → 11×11 pixel image (MapLibre stretches it to fill the bounding box, so it looks correct at any zoom). For 50 km, ~111×111 pixels. Maximum: 256×256 pixels (capped for performance).
- **PNG encoding**: Use `pngjs` (pure JS, ~50 KB, zero native deps). Encoding an 111×111 RGBA image takes < 5ms. Much lighter than `sharp` or `node-canvas`.
- **Response caching**: Store the last viewshed result keyed by `floor(lat*1000), floor(lon*1000), height, radius`. If the operator hasn't moved >50m and params are unchanged, skip recomputation.
- **Singleton tile index**: Initialized on first request, persists for server lifetime. Directory scan happens once.

**Checkpoint**: `curl -X POST http://localhost:5173/api/viewshed/compute -H "X-API-Key: ..." -d '{"lat":35.26,"lon":-116.68,"heightAgl":2,"radiusM":5000}'` returns a JSON response with `imageDataUri` (base64 PNG) and `bounds`.

---

### Phase 3: Viewshed Store + Map Integration

**Goal**: Wire the viewshed into the MapLibre map as an image overlay. Create the reactive store and derived state.

**New files**:

- `src/lib/stores/dashboard/viewshed-store.ts` — Persisted store extending RF range state with viewshed-specific fields: `heightAglM` (default 2), `radiusM` (default 5000), `greenOpacity` (default 0.37), `redOpacity` (default 0.92), `adjustTogether` (default true). Convenience setters with clamping. Zod validation on hydration.
- `src/lib/components/dashboard/map/viewshed-derived.svelte.ts` — Reactive state: watches GPS position + viewshed store + hackrf store. When viewshed is enabled and GPS fix available, fetches `/api/viewshed/compute` with current params. Debounces: skips if position delta < 50m and params unchanged. Exposes `viewshedImageUrl`, `viewshedBounds`, `viewshedActive`, `viewshedInactiveReason`, `isComputing` (loading state).

**Modified files**:

- `src/lib/components/dashboard/DashboardMap.svelte` — Remove `rf-range-src` GeoJSONSource + FillLayer and `rf-range-label-src` GeoJSONSource + SymbolLayer. Add MapLibre `ImageSource` for viewshed overlay with two `RasterLayer` elements (or a single layer with data-driven color). The image source uses `viewshedImageUrl` and `viewshedBounds` from derived state.
- `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — Replace `createRFRangeDerivedState()` with `createViewshedDerivedState()`. Expose new getters: `viewshedImageUrl`, `viewshedBounds`, `viewshedActive`, `isComputingViewshed`.

**Key design decisions**:

- **MapLibre ImageSource**: The viewshed PNG is set as the `url` property of an `ImageSource`. The `coordinates` property is the bounding box `[[west,north],[east,north],[east,south],[west,south]]`. MapLibre georeferences the image automatically.
- **Opacity control**: MapLibre `RasterLayer` has a `raster-opacity` paint property. However, since we need independent green/red opacity, the opacity values are baked into the PNG alpha channel server-side. The API endpoint receives `greenOpacity` and `redOpacity` as parameters.
- **Debouncing**: The viewshed fetch is debounced with a 500ms delay after the last parameter change. This prevents rapid recomputation when the operator drags a slider.
- **Loading state**: While the viewshed is computing, the previous overlay stays visible. An `isComputing` flag drives a small loading indicator in the Line of Sight panel.

**Checkpoint**: Enable the viewshed in the Line of Sight panel. With GPS fix and DTED tiles loaded, a green/red terrain overlay appears on the map centered on operator position. Moving > 50m triggers recalculation. The old Friis rings are gone.

---

### Phase 4: Line of Sight Panel Redesign (UI)

**Goal**: Rewrite the LineOfSightView.svelte component to match ATAK-style viewshed controls.

**Modified files**:

- `src/lib/components/dashboard/panels/LineOfSightView.svelte` — **Full rewrite**. New layout:
    1. **Enable toggle** (existing pattern, retained)
    2. **DTED Status indicator** — "Loaded: X tiles covering [region]" or "No elevation data — place DTED tiles in /data/dted/"
    3. **Height Above Ground** — labeled slider (0.5–100m, default 2m) + numeric readout
    4. **Radius** — labeled slider (100m–50km, default 5km) + numeric readout + "RF CAPPED" badge when RF range limits the radius
    5. **Hardware Preset selector** (existing, retained — caps radius)
    6. **Frequency source** (existing, retained — Auto/Manual)
    7. **Computed RF Range readout** (existing, retained — shows max RF range)
    8. **Opacity section header** — "OVERLAY OPACITY"
    9. **Visible (Green) slider** — 0–100%, default 37%
    10. **Obstructed (Red) slider** — 0–100%, default 92%
    11. **Adjust Together toggle** — when ON, moving either slider moves the other proportionally
    12. **Show on Map toggle** (existing pattern, syncs with `layerVisibility`)

- `src/lib/components/dashboard/panels/map-settings-shared.css` — Add `.opacity-slider` styles, `.dted-status` indicator styles.

**Key design decisions**:

- **Removed elements**: The 4-band color legend (Strong/Usable/Marginal/Maximum) is removed entirely — viewshed uses only green/red.
- **ATAK alignment**: The Height Above Ground, Radius, and opacity sliders directly mirror ATAK's Viewshed tab (page 53). The "Adjust Together" toggle matches ATAK's behavior.
- **State mapping**: The panel reads from `viewshedStore` for height/radius/opacity settings, from `rfRangeStore` for preset/frequency, and from `viewshedDerived` for DTED status and computation state.
- **Slider design**: Lunaris-styled range inputs with Fira Code numeric readouts. Matches existing toggle/slider patterns in the codebase.

**Checkpoint**: Open Map Settings → Line of Sight. Panel shows DTED status, Height/Radius sliders, opacity controls. Adjusting any slider triggers viewshed recomputation. "Adjust Together" links the two opacity sliders.

---

### Phase 5: DTED Extraction + Setup

**Goal**: Extract the DTED .zip file and configure the data directory. Add setup script support.

**New files**:

- `scripts/ops/extract-dted.sh` — Shell script: takes a `.zip` path as argument, extracts to `/home/kali/Documents/Argos/Argos/data/dted/`, verifies tile count, reports coverage summary.

**Modified files**:

- `src/lib/server/env.ts` — Add `DTED_DATA_DIR` env var (default: `./data/dted`) with Zod validation.
- `.env.example` — Add `DTED_DATA_DIR=./data/dted`.
- `.gitignore` — Add `data/dted/` (elevation tiles are large binary data, not committed).
- `scripts/ops/setup-host.sh` — Add DTED extraction step (conditional — only if `.zip` exists in `/docs/`).

**Key design decisions**:

- **Data directory**: `data/dted/` at project root, gitignored. Standard DTED directory structure: `data/dted/w117/n34.dt0`.
- **One-time extraction**: The setup script extracts the zip once. The app reads the directory at runtime.
- **Env var**: `DTED_DATA_DIR` allows deployment flexibility (different path in production vs dev).

**Checkpoint**: Run `bash scripts/ops/extract-dted.sh docs/dtedlevel0.zip`. Verify `data/dted/w117/n34.dt0` exists. Start dev server, verify the tile index logs "Loaded 26,024 DTED tiles".

---

## Dependency Graph

```
Phase 1: DTED Parser + Tile Index (no dependencies)
    ↓
Phase 2: Viewshed Algorithm + API (depends on Phase 1)
    ↓
Phase 3: Store + Map Integration (depends on Phase 2)
    ↓
Phase 4: Line of Sight Panel Redesign (depends on Phase 3)

Phase 5: DTED Extraction + Setup (independent — can run in parallel with any phase)
```

## Risk Assessment

| Risk                                                                | Likelihood | Impact | Mitigation                                                                                                                                                                    |
| ------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DTED Level 0 too coarse for useful viewshed at short range (< 2 km) | MEDIUM     | MEDIUM | At < 2 km, the ~900m grid produces only ~4 cells. The viewshed will look blocky. Mitigate by documenting minimum useful radius (~2 km) in UI. Future: support DTED Level 1/2. |
| `pngjs` encoding too slow for large viewshed grids                  | LOW        | LOW    | Max grid 256×256. Encoding < 20ms. Fallback: send raw binary array, render client-side.                                                                                       |
| MapLibre `ImageSource` update flickers on recomputation             | MEDIUM     | LOW    | Keep previous image visible until new one is ready. Swap atomically via `source.updateImage()`.                                                                               |
| DTED signed-magnitude parsing edge case                             | LOW        | HIGH   | Unit test with known negative elevation values. Reference bbonenfant/dted Python implementation.                                                                              |
| Viewshed at 50 km radius exceeds 3-second target                    | LOW        | MEDIUM | At DTED Level 0, 50 km = ~111×111 grid = ~12,000 cells × 360 rays = 4.3M lookups. Estimate ~200ms on ARM. Well within budget. If slow, reduce ray count to 180.               |
| Operator expects building-level accuracy from Level 0 data          | MEDIUM     | LOW    | Level 0 has ~900m resolution — cannot see individual buildings. Document clearly in UI: "Terrain analysis — does not model structures or vegetation."                         |

## Complexity Tracking

| Violation             | Why Needed                            | Simpler Alternative Rejected Because                                    |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| New npm dep (`pngjs`) | PNG encoding for MapLibre ImageSource | Raw bitmap not supported by ImageSource; sharp requires native bindings |
