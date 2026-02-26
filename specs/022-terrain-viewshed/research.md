# Research: Terrain-Aware Viewshed Analysis

**Feature**: 022-terrain-viewshed | **Date**: 2026-02-26

---

## Research Questions & Findings

### RQ-1: DTED Level 0 Binary Format

**Decision**: Parse DTED `.dt0` files directly in TypeScript using Node.js `Buffer`. No npm package exists for DTED; port parsing logic from [bbonenfant/dted](https://github.com/bbonenfant/dted) (Python, MIT).

**Finding**: DTED binary layout is well-documented and straightforward to parse:

| Section                       | Offset | Size (bytes) | Contents                                                        |
| ----------------------------- | ------ | ------------ | --------------------------------------------------------------- |
| UHL (User Header Label)       | 0      | 80           | Sentinel `UHL1`, origin lat/lon, grid intervals, row/col counts |
| DSI (Data Set Identification) | 80     | 648          | Origin, shape, data block length, security                      |
| ACC (Accuracy Description)    | 728    | 2700         | Accuracy metadata (skip for our purposes)                       |
| Elevation Data                | 3428   | variable     | Column-major blocks of 16-bit big-endian elevation posts        |

**Elevation data block structure** (per column):

| Offset   | Size          | Contents                                              |
| -------- | ------------- | ----------------------------------------------------- |
| 0        | 1             | Sentinel byte `0xAA`                                  |
| 1-3      | 3             | Block count (sequential)                              |
| 4-5      | 2             | Longitude count                                       |
| 6-7      | 2             | Latitude count                                        |
| 8 to N-4 | lat_count × 2 | Elevation posts (16-bit big-endian, signed magnitude) |
| N-4 to N | 4             | Checksum (32-bit big-endian)                          |

**Signed magnitude encoding**: DTED does NOT use two's complement for negative elevations. Bit 15 is the sign bit; bits 0-14 are the magnitude. Conversion: if `raw & 0x8000`, then `elevation = -(raw & 0x7FFF)`.

**Void data**: Value `-32767` (`0x8001` in signed magnitude) indicates no elevation data.

**DTED Level 0 grid dimensions**: 121 longitude lines × 121 latitude points per tile (30 arc-second spacing). Each tile covers 1° × 1°. File size: ~34 KB per mid-latitude tile.

**Lat/lon → grid index**: `col = round((lon - origin_lon) * (num_cols - 1))`, `row = round((lat - origin_lat) * (num_rows - 1))`.

**Reference implementations**:

- [bbonenfant/dted](https://github.com/bbonenfant/dted) — Python, MIT — cleanest reference for byte offsets
- [arpadav/dted2](https://github.com/arpadav/dted2) — Rust — most rigorous edge case handling
- [perliedman/node-hgt](https://github.com/perliedman/node-hgt) — Node.js — HGT (SRTM) parser, similar binary pattern

**Memory footprint**: A single DTED Level 0 tile loaded into memory: 121 × 121 × 2 bytes = ~29 KB elevation data + ~3.4 KB headers = ~33 KB total. Loading 4 tiles (2×2 around operator position) = ~132 KB. Negligible.

---

### RQ-2: Viewshed Algorithm Selection

**Decision**: Use a simple radial sweep (R3) algorithm. At DTED Level 0 resolution (~900m posts) and typical radii (1-10 km), the grid is small enough (11×11 to 56×56 cells) that algorithmic sophistication is unnecessary.

**Finding**: Three classes of viewshed algorithms exist:

| Algorithm                | Complexity                           | Best for                           | Practical for JS on Pi 5?   |
| ------------------------ | ------------------------------------ | ---------------------------------- | --------------------------- |
| **R3 (radial sweep)**    | O(R × N) where R=rays, N=samples/ray | Small grids, simple implementation | Yes — ideal                 |
| **Wang reference-plane** | O(N log N)                           | Large DEMs (millions of cells)     | Overkill for our grid sizes |
| **Franklin & Ray**       | O(N)                                 | Very large DEMs                    | Overkill                    |

**R3 algorithm for our use case**:

1. Cast rays from observer at angular intervals (e.g., every 1°, so 360 rays)
2. Along each ray, sample elevation at regular distance intervals
3. For each sample point, compute the elevation angle from the observer: `angle = atan2(elevation_at_point - observer_elevation, distance_to_point)`
4. Track the maximum elevation angle seen so far along the ray
5. If the current point's angle exceeds the maximum, the point is **visible**; otherwise it's **obstructed**

**Performance estimation for 5 km radius on DTED Level 0**:

- Grid: ~11 cells across (5000m / 900m ≈ 5.6 → ~11×11 when considering diagonal)
- Rays: 360 (1° intervals)
- Samples per ray: ~6 (5000m / 900m)
- Total elevation lookups: 360 × 6 = ~2,160
- Each lookup: array index calculation + bounds check = ~50ns
- Total compute: < 1ms on ARM Cortex-A76

Even at 50 km radius (worst case): 360 × 56 = ~20,160 lookups. Still < 10ms. The bottleneck will be GeoJSON construction, not the LOS math.

**Reference**: [inveneo/RFAnalysisJS](https://github.com/inveneo/RFAnalysisJS) — JavaScript viewshed using radial sweep, renders green/red LOS overlay. Uses Google Elevation API (cloud); we replace with local DTED.

---

### RQ-3: Output Format — GeoJSON vs Image Overlay

**Decision**: Use MapLibre `ImageSource` with a server-rendered RGBA canvas image. Far more performant than GeoJSON polygons for grid-based viewshed output.

**Finding**: Three rendering approaches compared:

| Approach                          | Pros                                                             | Cons                                                          |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| **GeoJSON grid polygons**         | Standard MapLibre pattern, easy styling                          | 10,000+ features for a fine grid = slow render, large payload |
| **Merged GeoJSON polygons**       | Fewer features                                                   | Complex polygon union math, still large                       |
| **Image overlay** (`ImageSource`) | Single image, O(1) render cost, pixel-perfect grid, tiny payload | Requires server-side canvas rendering, no per-feature styling |

For a viewshed at 50 km radius with 900m cells, the grid has ~12,000 cells. As GeoJSON polygons, that's 12,000 features with 5 coordinate pairs each — ~1.5 MB of GeoJSON and MapLibre would struggle to render it smoothly. As a single RGBA PNG image (e.g., 256×256 pixels), it's ~50 KB and renders instantly.

**MapLibre `ImageSource`**: Accepts an image URL (or data URI) and a bounding box (4 corners). The image is georeferenced and draped on the map. Opacity controlled via layer paint. This is how satellite imagery works — proven for large-area overlays.

**Server-side approach**: The viewshed API endpoint computes the LOS grid, renders green/red pixels to a `<canvas>` (via `node-canvas` or raw RGBA buffer), encodes as PNG data URI, and returns it with the bounding box coordinates. The client simply sets the `ImageSource` URL.

**Alternative considered**: Client-side `<canvas>` overlay via MapLibre `CustomLayerInterface`. This avoids the API round-trip but requires client-side DTED access (can't read server files from browser). Would require shipping DTED tiles to the browser — adds latency and complexity.

---

### RQ-4: DTED Tile Loading Strategy

**Decision**: Extract the full `.zip` to a designated directory at setup time. At runtime, load only the tiles needed (1-4 tiles around operator position) using a tile index built from the directory listing.

**Finding**: The `dtedlevel0.zip` file (237 MB compressed, ~597 MB uncompressed) contains 26,024 tiles covering the entire globe. Options:

| Strategy                     | Disk usage      | Complexity               | Latency         |
| ---------------------------- | --------------- | ------------------------ | --------------- |
| Extract all at setup         | ~597 MB         | Low (one-time unzip)     | None at runtime |
| Extract on-demand per tile   | ~34 KB per tile | Medium (zip seeking)     | ~10ms per tile  |
| Keep zip, read via streaming | 0 extra         | High (zip random access) | ~50ms per tile  |

597 MB on a 500 GB NVMe SSD is trivial (0.12% of capacity). Extract-all is simplest and fastest at runtime.

**Tile index**: On startup, scan the DTED directory for `.dt0` files and build an in-memory map: `{ "w117/n34": "/path/to/dted/w117/n34.dt0" }`. Lookup by operator lat/lon → westing/northing directory/file path.

**Tile cache**: Keep the most recent 4-9 tiles in an LRU cache (each ~33 KB, so cache = ~300 KB). Tiles near the operator rarely change — cache hit rate will be >95%.

---

### RQ-5: Existing Argos Assets to Reuse

**Decision**: Reuse existing RF range store, types, UI components, and map rendering patterns. The viewshed replaces the Friis overlay but shares the same integration points.

**Finding — Codebase inventory**:

| Asset                           | Path                                          | Reuse                                                           |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `RFRangeProfile` type           | `src/lib/types/rf-range.ts`                   | Keep — presets cap viewshed radius                              |
| `PropagationModel` type         | `src/lib/types/rf-range.ts`                   | Already has `'terrain-aware'` reserved                          |
| `rfRangeStore`                  | `src/lib/stores/dashboard/rf-range-store.ts`  | Extend — add viewshed-specific fields (height, radius, opacity) |
| `LineOfSightView.svelte`        | `src/lib/components/dashboard/panels/`        | Rewrite — replace Friis UI with viewshed controls               |
| `rf-range-derived.svelte.ts`    | `src/lib/components/dashboard/map/`           | Rewrite — replace Friis GeoJSON with viewshed image fetch       |
| `rf-propagation.ts`             | `src/lib/utils/`                              | Keep — `calculateFriisRange()` still used to cap radius         |
| `DashboardMap.svelte`           | `src/lib/components/dashboard/`               | Modify — replace GeoJSON source/fill with ImageSource           |
| `dashboard-map-logic.svelte.ts` | `src/lib/components/dashboard/`               | Modify — wire new viewshed derived state                        |
| `map-settings-shared.css`       | `src/lib/components/dashboard/panels/`        | Extend — add slider styles                                      |
| GPS store                       | `src/lib/stores/tactical-map/gps-store.ts`    | Read — operator position                                        |
| HackRF store                    | `src/lib/stores/tactical-map/hackrf-store.ts` | Read — auto frequency                                           |
| `persistedWritable`             | `src/lib/stores/persisted-writable.ts`        | Use — persist viewshed settings                                 |

---

### RQ-6: API Design — Server-Side Viewshed Endpoint

**Decision**: Single POST endpoint `/api/viewshed/compute` that accepts observer position, height, radius, and returns a PNG image data URI + bounding box.

**Finding**: The viewshed computation must run server-side because:

1. DTED files are on the server's filesystem — browser can't read them
2. Node.js Buffer API is needed for binary parsing
3. Computation is CPU-bound — better on ARM Cortex-A76 than in browser JavaScript
4. Result (PNG image) is small and cacheable

The endpoint is stateless — all parameters are in the request body. No WebSocket needed because the viewshed is recomputed only on GPS movement (>50m) or parameter changes, not continuously.

**Response caching**: Cache the most recent viewshed result keyed by `{lat, lon, height, radius}` (rounded). If the operator hasn't moved and parameters haven't changed, return the cached result instantly.

---

### RQ-7: Image Rendering Without node-canvas

**Decision**: Generate raw RGBA pixel buffer in Node.js and encode to PNG using the `pngjs` or `sharp` library (already considering). Alternatively, generate a base64-encoded raw bitmap that MapLibre can consume.

**Finding**: `node-canvas` requires native Cairo bindings which may not build cleanly on ARM. Alternatives:

| Option                     | Dependency            | ARM support      | Speed                    |
| -------------------------- | --------------------- | ---------------- | ------------------------ |
| `sharp`                    | libvips (apt install) | Excellent on ARM | Fast                     |
| `pngjs`                    | Pure JS               | Universal        | Adequate                 |
| Raw RGBA buffer → data URI | None                  | Universal        | Fastest (no encode step) |

MapLibre's `ImageSource` can accept a `HTMLImageElement`, `ImageData`, or URL. If we generate a raw RGBA `Uint8ClampedArray` on the server and send it as a PNG data URI, the client can set it directly. `pngjs` (pure JS, zero native deps) can encode a 256×256 RGBA buffer to PNG in ~5ms.

**Alternative**: Use MapLibre's `addImage()` or a canvas-based `CustomLayerInterface` on the client side. The server sends the raw viewshed grid (binary array of 0/1 values), and the client renders it to a canvas. This avoids PNG encoding entirely but requires more client-side code.
