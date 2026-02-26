# Data Model: Terrain-Aware Viewshed Analysis

**Feature**: 022-terrain-viewshed | **Date**: 2026-02-26

---

## Entities

### DTEDTileHeader

Parsed metadata from the UHL (User Header Label) section of a DTED `.dt0` file. The UHL occupies the first 80 bytes.

```typescript
interface DTEDTileHeader {
	/** Origin longitude in decimal degrees (southwest corner) */
	originLon: number;
	/** Origin latitude in decimal degrees (southwest corner) */
	originLat: number;
	/** Longitude interval in arc-seconds (e.g., 30 for Level 0 at mid-latitudes) */
	lonIntervalArcSec: number;
	/** Latitude interval in arc-seconds (always 30 for Level 0) */
	latIntervalArcSec: number;
	/** Number of longitude lines (columns). Varies by latitude zone: 121 at 0-50°, fewer at higher latitudes */
	numLonLines: number;
	/** Number of latitude points per column (rows). Always 121 for Level 0 */
	numLatPoints: number;
}
```

**Validation rules**:

- `originLon`: -180.0 to 180.0
- `originLat`: -90.0 to 90.0
- `lonIntervalArcSec`: Positive integer (30 for Level 0 at equatorial latitudes)
- `latIntervalArcSec`: Positive integer (always 30 for Level 0)
- `numLonLines`: 2 to 3601 (varies by DTED level and latitude zone)
- `numLatPoints`: 2 to 3601 (varies by DTED level)

---

### DTEDTile

A fully parsed DTED tile with header metadata and elevation grid loaded into memory for fast random-access lookups.

```typescript
interface DTEDTile {
	/** Parsed header metadata */
	header: DTEDTileHeader;
	/** Absolute file path on disk */
	filePath: string;
	/**
	 * Elevation grid in meters above mean sea level.
	 * Column-major layout: elevations[col * numLatPoints + row].
	 * Stored as Float32Array for fast arithmetic. Size: numLonLines × numLatPoints.
	 */
	elevations: Float32Array;
}
```

**Derived methods** (on the parser module, not the interface):

- `getElevation(tile: DTEDTile, lat: number, lon: number): number | null` — Bilinear interpolation of elevation at the given coordinate. Returns `null` for void data or out-of-bounds queries.
- `getElevationNearest(tile: DTEDTile, lat: number, lon: number): number | null` — Nearest-neighbor lookup (faster, used during viewshed sweep).

**Memory footprint**: A single DTED Level 0 tile at 121×121 posts = 14,641 × 4 bytes = ~57 KB in Float32Array. With header overhead: ~58 KB per tile. LRU cache of 9 tiles: ~520 KB.

**Void data**: Elevation value `-32767` indicates no data. Parsed from DTED signed-magnitude encoding: raw `0x8001` → sign bit set, magnitude 1 → but the DTED spec defines the void sentinel as `-(2^15 - 1) = -32767`.

---

### ViewshedParams

Input parameters for a viewshed computation request.

```typescript
interface ViewshedParams {
	/** Observer latitude in decimal degrees */
	lat: number;
	/** Observer longitude in decimal degrees */
	lon: number;
	/** Observer height above ground level in meters */
	heightAgl: number;
	/** Maximum viewshed radius in meters */
	radiusM: number;
	/** Opacity for visible (green) areas: 0.0 to 1.0 */
	greenOpacity: number;
	/** Opacity for obstructed (red) areas: 0.0 to 1.0 */
	redOpacity: number;
}
```

**Validation rules**:

- `lat`: -90.0 to 90.0
- `lon`: -180.0 to 180.0
- `heightAgl`: 0.5 to 100.0 (meters) — matches FR-005
- `radiusM`: 100 to 50000 (meters) — matches FR-006
- `greenOpacity`: 0.0 to 1.0
- `redOpacity`: 0.0 to 1.0

---

### ViewshedResult

Output of a viewshed computation, returned by the API.

```typescript
interface ViewshedResult {
	/** PNG image as a base64 data URI: "data:image/png;base64,..." */
	imageDataUri: string;
	/** Geographic bounding box for the image overlay */
	bounds: ViewshedBounds;
	/** Computation metadata */
	meta: ViewshedMeta;
}

interface ViewshedBounds {
	/** Northern boundary latitude */
	north: number;
	/** Southern boundary latitude */
	south: number;
	/** Eastern boundary longitude */
	east: number;
	/** Western boundary longitude */
	west: number;
}

interface ViewshedMeta {
	/** Wall-clock computation time in milliseconds */
	computeTimeMs: number;
	/** Number of grid cells in the output */
	cellCount: number;
	/** Number of DTED tiles used */
	tilesUsed: number;
	/** Output image dimensions */
	imageWidth: number;
	/** Output image dimensions */
	imageHeight: number;
	/** Whether the result was served from cache */
	cached: boolean;
}
```

**No database storage**: Viewshed results are ephemeral — computed on demand, cached in memory (single most-recent result keyed by rounded params). They do not persist across server restarts. This matches ATAK behavior where viewsheds do not survive app restart.

---

### ViewshedStoreState

Client-side persisted store state for viewshed settings. Extends the pattern of `RFRangeStoreState`.

```typescript
interface ViewshedStoreState {
	/** Whether the viewshed overlay is enabled */
	isEnabled: boolean;
	/** Observer height above ground level in meters */
	heightAglM: number;
	/** Viewshed radius in meters */
	radiusM: number;
	/** Visible (green) area opacity: 0.0 to 1.0 */
	greenOpacity: number;
	/** Obstructed (red) area opacity: 0.0 to 1.0 */
	redOpacity: number;
	/** Whether opacity sliders are linked */
	adjustTogether: boolean;
	/** Active RF range preset ID (retained from existing LOS card) */
	activePresetId: string;
	/** Frequency source: 'auto' (from SDR) or 'manual' (user-entered) */
	frequencySource: FrequencySource;
	/** Manual frequency in MHz (when frequencySource is 'manual') */
	manualFrequencyMHz: number;
}
```

**Persistence**: `localStorage` via `persistedWritable` (existing utility). Zod schema validates on hydration — invalid values reset to defaults.

**Defaults**:

| Field                | Default         | Rationale                                      |
| -------------------- | --------------- | ---------------------------------------------- |
| `isEnabled`          | `false`         | Overlay off by default                         |
| `heightAglM`         | `2.0`           | Eye-level for standing operator (ATAK default) |
| `radiusM`            | `5000`          | 5 km — practical LOS range for most terrain    |
| `greenOpacity`       | `0.37`          | ATAK default for "seen" overlay                |
| `redOpacity`         | `0.92`          | ATAK default for "unseen" overlay              |
| `adjustTogether`     | `true`          | ATAK default behavior                          |
| `activePresetId`     | `'hackrf-bare'` | First hardware preset                          |
| `frequencySource`    | `'auto'`        | Match SDR frequency when available             |
| `manualFrequencyMHz` | `2400`          | 2.4 GHz default                                |

---

### DTEDTileIndexEntry

An entry in the in-memory tile index, mapping geographic coordinates to filesystem paths.

```typescript
interface DTEDTileIndexEntry {
	/** Westing directory name, e.g., "w117" */
	westing: string;
	/** Northing filename (without extension), e.g., "n34" */
	northing: string;
	/** Absolute file path to the .dt0 file */
	filePath: string;
	/** Origin longitude in decimal degrees (parsed from directory name) */
	originLon: number;
	/** Origin latitude in decimal degrees (parsed from filename) */
	originLat: number;
}
```

**Index structure**: `Map<string, DTEDTileIndexEntry>` keyed by `"${westing}/${northing}"` (e.g., `"w117/n34"`). Built once on first API request by scanning the DTED data directory.

---

## Relationships

```
DTEDTileIndex ──1:N──> DTEDTileIndexEntry  (one index, many tiles on disk)
DTEDTileIndexEntry ──1:1──> DTEDTile       (loaded on demand, cached in LRU)
ViewshedParams ──uses──> DTEDTile[]         (1-4 tiles loaded for computation)
ViewshedParams ──produces──> ViewshedResult (single computation output)
ViewshedStoreState ──drives──> ViewshedParams (client settings → API request)
RFRangeProfile ──caps──> ViewshedParams.radiusM (RF range limits viewshed radius)
```

---

## Storage

### Server-Side (runtime only)

- **DTED tiles on disk**: Read-only `.dt0` files at `${DTED_DATA_DIR}/<westing>/<northing>.dt0`. Not modified at runtime.
- **Tile index**: In-memory `Map`, built from directory scan on first request. ~1 KB per 100 tiles.
- **Tile cache**: In-memory LRU, capacity 9 tiles. ~520 KB maximum. Evicts by least-recent access.
- **Result cache**: Single most-recent `ViewshedResult` + params hash. ~100 KB (PNG image). Invalidated when params change beyond tolerance.

### Client-Side (persisted)

- **ViewshedStoreState**: `localStorage` key `argos-viewshed-settings`. ~200 bytes JSON. Validated by Zod on hydration.

### No Database Tables

This feature requires no SQLite migrations. All data is either read-only (DTED tiles on disk), ephemeral (viewshed computation results), or client-persisted (localStorage). This keeps the implementation simple and avoids database growth from high-frequency computation results.
