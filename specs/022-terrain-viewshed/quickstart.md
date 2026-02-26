# Quickstart: Terrain-Aware Viewshed Development

**Feature**: 022-terrain-viewshed | **Date**: 2026-02-26

---

## Prerequisites

- Argos dev server running (`npm run dev`)
- GPS dongle connected and returning a fix (or mock position for dev)
- DTED Level 0 .zip file available at `docs/dtedlevel0.zip` (237 MB)
- Node.js 20+ on Raspberry Pi 5 (or dev machine)

## Step 0: Extract DTED Tiles

```bash
# Create data directory
mkdir -p data/dted

# Extract DTED tiles (one-time setup, ~597 MB extracted)
unzip -q docs/dtedlevel0.zip -d data/dted/

# Verify extraction — check NTC coverage tiles
ls data/dted/w117/n34.dt0 data/dted/w117/n35.dt0
# Expected: both files exist (~34 KB each)

# Count total tiles
find data/dted -name '*.dt0' | wc -l
# Expected: ~26,024 tiles
```

## Step 1: Install pngjs Dependency

```bash
# Pure JavaScript PNG encoder — zero native bindings, ARM-safe
npm install pngjs@7
```

## Build Order

Implementation follows the dependency chain in `plan.md`. Each phase is independently testable.

### Phase 1: DTED Parser + Tile Index

**Files to create**:

1. `src/lib/types/viewshed.ts` — TypeScript interfaces
2. `src/lib/server/services/terrain/dted-parser.ts` — Binary DTED file parser
3. `src/lib/server/services/terrain/dted-tile-index.ts` — Directory scanner + LRU cache
4. `src/lib/server/services/terrain/dted-parser.test.ts` — Parser unit tests
5. `src/lib/server/services/terrain/dted-tile-index.test.ts` — Tile index unit tests

**Test**:

```bash
# Run DTED parser tests
npx vitest run src/lib/server/services/terrain/dted-parser.test.ts

# Verify: parses UHL header, decodes signed-magnitude elevations,
# returns correct elevation at known coordinates, handles void data
```

**Manual verification**:

```bash
# Quick sanity check — read first 4 bytes of a DTED file
xxd -l 4 data/dted/w117/n34.dt0
# Expected: "UHL1" (55 48 4c 31)
```

---

### Phase 2: Viewshed Algorithm + API Endpoint

**Files to create**:

6. `src/lib/server/services/terrain/viewshed-compute.ts` — Radial LOS sweep + PNG encoding
7. `src/routes/api/viewshed/compute/+server.ts` — POST endpoint
8. `src/routes/api/viewshed/status/+server.ts` — GET endpoint (DTED status)
9. `src/lib/server/services/terrain/viewshed-compute.test.ts` — Algorithm unit tests

**Test**:

```bash
# Run viewshed algorithm tests
npx vitest run src/lib/server/services/terrain/viewshed-compute.test.ts

# Verify: all-visible on flat terrain, cells behind ridge are obstructed,
# completes 5 km radius in < 3 seconds
```

**Manual verification**:

```bash
# Start dev server
npm run dev

# Compute viewshed at NTC (Fort Irwin)
curl -s -X POST http://localhost:5173/api/viewshed/compute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $(grep ARGOS_API_KEY .env | cut -d= -f2)" \
  -d '{"lat":35.2622,"lon":-116.6831,"heightAgl":2,"radiusM":5000}' \
  | jq '{cached: .meta.cached, timeMs: .meta.computeTimeMs, cells: .meta.cellCount, tiles: .meta.tilesUsed, imgSize: (.meta.imageWidth | tostring) + "x" + (.meta.imageHeight | tostring)}'
# Expected: {"cached":false,"timeMs":<number>,"cells":~95,"tiles":1,"imgSize":"11x11"}

# Check DTED status
curl -s http://localhost:5173/api/viewshed/status \
  -H "X-API-Key: $(grep ARGOS_API_KEY .env | cut -d= -f2)" \
  | jq '{loaded, tileCount}'
# Expected: {"loaded":true,"tileCount":26024}
```

---

### Phase 3: Viewshed Store + Map Integration

**Files to create**:

10. `src/lib/stores/dashboard/viewshed-store.ts` — Persisted viewshed settings
11. `src/lib/components/dashboard/map/viewshed-derived.svelte.ts` — Reactive fetch + debounce

**Files to modify**:

12. `src/lib/components/dashboard/DashboardMap.svelte` — Replace GeoJSON rf-range with ImageSource
13. `src/lib/components/dashboard/dashboard-map-logic.svelte.ts` — Wire viewshed derived state

**Test**:

```bash
# Type check new and modified files
npx tsc --noEmit

# Lint new files
npx eslint \
  src/lib/stores/dashboard/viewshed-store.ts \
  src/lib/components/dashboard/map/viewshed-derived.svelte.ts \
  --config config/eslint.config.js

# Build to verify Svelte compilation
npm run build
```

**Manual verification**:

Open browser at `http://localhost:5173/dashboard`. Enable Line of Sight in Map Settings. With GPS fix and DTED tiles loaded:

- Green/red terrain overlay appears centered on operator position
- Old Friis concentric rings are gone
- Moving map shows overlay is georeferenced (stays fixed to terrain)

---

### Phase 4: Line of Sight Panel Redesign

**Files to modify**:

14. `src/lib/components/dashboard/panels/LineOfSightView.svelte` — Full rewrite
15. `src/lib/components/dashboard/panels/map-settings-shared.css` — New slider styles

**Test**:

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint \
  src/lib/components/dashboard/panels/LineOfSightView.svelte \
  --config config/eslint.config.js

# Build
npm run build
```

**Manual verification**:

Open Map Settings → Line of Sight. Verify:

- DTED status indicator shows tile count
- Height Above Ground slider (0.5–100m) adjusts viewshed
- Radius slider (100m–50km) adjusts viewshed
- Visible (green) opacity slider works independently
- Obstructed (red) opacity slider works independently
- "Adjust Together" toggle links both opacity sliders
- Hardware preset selector still present and caps radius
- Frequency source selector still present
- Computed RF Range readout still shown

---

### Phase 5: DTED Extraction + Setup

**Files to create**:

16. `scripts/ops/extract-dted.sh` — Shell extraction script

**Files to modify**:

17. `src/lib/server/env.ts` — Add `DTED_DATA_DIR` env var
18. `.env.example` — Document DTED_DATA_DIR
19. `.gitignore` — Add `data/dted/`

**Test**:

```bash
# Test extraction script (on a clean directory)
rm -rf /tmp/dted-test && mkdir /tmp/dted-test
bash scripts/ops/extract-dted.sh docs/dtedlevel0.zip /tmp/dted-test
# Expected: extracts tiles, prints coverage summary

# Clean up
rm -rf /tmp/dted-test
```

---

## Verification Checklist

```bash
# 1. DTED tiles extracted
ls data/dted/w117/n34.dt0
# Expected: file exists

# 2. Unit tests pass
npx vitest run src/lib/server/services/terrain/

# 3. API endpoint works
curl -s -X POST http://localhost:5173/api/viewshed/compute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $(grep ARGOS_API_KEY .env | cut -d= -f2)" \
  -d '{"lat":35.2622,"lon":-116.6831,"heightAgl":2,"radiusM":5000}' \
  | jq '.meta'

# 4. Type check passes
npx tsc --noEmit

# 5. Lint passes on new files
npx eslint src/lib/server/services/terrain/ src/lib/stores/dashboard/viewshed-store.ts \
  --config config/eslint.config.js

# 6. Build succeeds
npm run build

# 7. No Friis rings visible
# Open dashboard → Map Settings → Line of Sight → Enable
# Expected: terrain viewshed overlay, NOT concentric circles

# 8. Viewshed responds to controls
# Adjust Height Above Ground → viewshed changes
# Adjust Radius → viewshed changes
# Adjust opacity sliders → overlay transparency changes

# 9. DTED status displayed
# Line of Sight panel shows "Loaded: 26,024 tiles"
```

## Key Gotchas

1. **DTED signed-magnitude encoding**: DTED does NOT use two's complement for negative elevations. Bit 15 is the sign bit, bits 0-14 are the magnitude. The parser must convert: `if (raw & 0x8000) elevation = -(raw & 0x7FFF)`. Getting this wrong produces wildly incorrect elevations in Death Valley and other below-sea-level areas.

2. **DTED void sentinel**: Value `-32767` (raw `0x8001`) means "no data". Treat as transparent in the viewshed output, not as an elevation of -32,767 meters.

3. **Column-major layout**: DTED stores elevation data column-by-column (longitude-major), not row-by-row. The first data block after the headers contains all latitude points for the westernmost longitude line.

4. **UHL sentinel scan**: Some DTED files have optional VOL/HDR records before the UHL. Scan for the `"UHL1"` sentinel rather than assuming it starts at byte 0.

5. **Latitude zone column count**: DTED Level 0 has 121 longitude columns at latitudes 0-50°, but fewer at higher latitudes (e.g., 61 columns at 50-70°). Always read the column count from the UHL header, don't hardcode 121.

6. **MapLibre ImageSource coordinates**: The corner order is `[top-left, top-right, bottom-right, bottom-left]` — NOT `[NW, NE, SE, SW]` (same thing, but easy to confuse lon/lat order). Each coordinate is `[longitude, latitude]`.

7. **pngjs encoding**: `pngjs` expects RGBA data as a `Buffer`, not `Uint8ClampedArray`. Use `Buffer.from(rgbaArray.buffer)` for zero-copy conversion.

8. **Opacity baked into PNG**: Since we need independent green/red opacity, the alpha channel values are set during PNG generation on the server. Changing opacity requires a new API call (not just a MapLibre paint property change). This is a deliberate trade-off for simplicity.

9. **GPS position rounding for cache**: The server caches the last viewshed result keyed by `floor(lat*1000), floor(lon*1000)`. This means positions within ~111m share a cache key. If the operator moves < 111m, they get the cached result instantly.

10. **Memory on Pi 5**: A single DTED Level 0 tile in Float32Array is ~57 KB (larger than the ~29 KB raw file because we expand Int16 to Float32). The 9-tile LRU cache uses ~520 KB. This is negligible on 8 GB RAM but worth knowing for profiling.
