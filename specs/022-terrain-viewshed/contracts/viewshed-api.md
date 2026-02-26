# API Contracts: Terrain-Aware Viewshed Analysis

**Feature**: 022-terrain-viewshed | **Date**: 2026-02-26

---

## Overview

The viewshed feature introduces a single new REST API endpoint for server-side terrain analysis. The computation runs server-side because DTED files reside on the server filesystem, Node.js Buffer API is needed for binary parsing, and computation is CPU-bound.

No WebSocket channels are added — the viewshed is recomputed only on GPS movement (>50m) or parameter changes, not continuously. The client polls via REST when needed.

---

## REST API Endpoints

### POST `/api/viewshed/compute`

Compute a terrain-aware viewshed from the given observer position and return a georeferenced PNG image overlay.

**Authentication**: Required (X-API-Key header or session cookie, per existing auth middleware).

**Rate Limit**: Standard API rate (200 req/min). In practice, called at most once every few seconds.

#### Request

```http
POST /api/viewshed/compute HTTP/1.1
Content-Type: application/json
X-API-Key: <api-key>
```

```json
{
	"lat": 35.2622,
	"lon": -116.6831,
	"heightAgl": 2.0,
	"radiusM": 5000,
	"greenOpacity": 0.37,
	"redOpacity": 0.92
}
```

| Field          | Type   | Required | Range           | Default | Description                                     |
| -------------- | ------ | -------- | --------------- | ------- | ----------------------------------------------- |
| `lat`          | number | Yes      | -90.0 to 90.0   | —       | Observer latitude (decimal degrees)             |
| `lon`          | number | Yes      | -180.0 to 180.0 | —       | Observer longitude (decimal degrees)            |
| `heightAgl`    | number | No       | 0.5 to 100.0    | 2.0     | Height above ground level (meters)              |
| `radiusM`      | number | No       | 100 to 50000    | 5000    | Maximum viewshed radius (meters)                |
| `greenOpacity` | number | No       | 0.0 to 1.0      | 0.37    | Opacity for visible (green) cells in PNG alpha  |
| `redOpacity`   | number | No       | 0.0 to 1.0      | 0.92    | Opacity for obstructed (red) cells in PNG alpha |

**Validation** (Zod schema):

```typescript
const viewshedRequestSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
	heightAgl: z.number().min(0.5).max(100).default(2.0),
	radiusM: z.number().min(100).max(50000).default(5000),
	greenOpacity: z.number().min(0).max(1).default(0.37),
	redOpacity: z.number().min(0).max(1).default(0.92)
});
```

#### Response — Success (200)

```json
{
	"imageDataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
	"bounds": {
		"north": 35.3072,
		"south": 35.2172,
		"east": -116.6281,
		"west": -116.7381
	},
	"meta": {
		"computeTimeMs": 12,
		"cellCount": 95,
		"tilesUsed": 1,
		"imageWidth": 11,
		"imageHeight": 11,
		"cached": false
	}
}
```

| Field                | Type    | Description                                              |
| -------------------- | ------- | -------------------------------------------------------- |
| `imageDataUri`       | string  | Base64-encoded PNG data URI for MapLibre ImageSource     |
| `bounds.north`       | number  | Northern latitude of the image bounding box              |
| `bounds.south`       | number  | Southern latitude of the image bounding box              |
| `bounds.east`        | number  | Eastern longitude of the image bounding box              |
| `bounds.west`        | number  | Western longitude of the image bounding box              |
| `meta.computeTimeMs` | number  | Wall-clock computation time in milliseconds              |
| `meta.cellCount`     | number  | Total grid cells evaluated                               |
| `meta.tilesUsed`     | number  | Number of DTED tiles loaded for this computation         |
| `meta.imageWidth`    | number  | Output image width in pixels                             |
| `meta.imageHeight`   | number  | Output image height in pixels                            |
| `meta.cached`        | boolean | True if the result was served from the server-side cache |

**MapLibre ImageSource coordinates format**: The client converts `bounds` to the corner array:

```typescript
const coordinates: [number, number][] = [
	[bounds.west, bounds.north], // top-left
	[bounds.east, bounds.north], // top-right
	[bounds.east, bounds.south], // bottom-right
	[bounds.west, bounds.south] // bottom-left
];
```

#### Response — No DTED Coverage (200, with empty result)

When the observer position has no DTED tile coverage, the endpoint returns a success response with a null image and an explanatory reason.

```json
{
	"imageDataUri": null,
	"bounds": null,
	"meta": {
		"computeTimeMs": 0,
		"cellCount": 0,
		"tilesUsed": 0,
		"imageWidth": 0,
		"imageHeight": 0,
		"cached": false
	},
	"reason": "No DTED elevation data available for coordinates (35.262, -116.683). Load DTED tiles covering this area."
}
```

#### Response — Validation Error (400)

```json
{
	"error": "Validation failed",
	"details": [{ "path": "lat", "message": "Number must be between -90 and 90" }]
}
```

#### Response — Authentication Error (401)

```json
{
	"error": "Authentication required"
}
```

#### Response — Server Error (500)

```json
{
	"error": "Viewshed computation failed",
	"message": "Failed to parse DTED tile: w117/n34.dt0"
}
```

---

### GET `/api/viewshed/status`

Return DTED tile index status — how many tiles are loaded, coverage bounding box, and data directory path.

**Authentication**: Required.

#### Response — DTED Loaded (200)

```json
{
	"loaded": true,
	"tileCount": 26024,
	"coverage": {
		"north": 83.0,
		"south": -90.0,
		"east": 180.0,
		"west": -180.0
	},
	"dataDir": "/home/kali/Documents/Argos/Argos/data/dted",
	"cacheSizeBytes": 522240,
	"cacheCapacity": 9,
	"cacheTiles": 4
}
```

#### Response — No DTED Data (200)

```json
{
	"loaded": false,
	"tileCount": 0,
	"coverage": null,
	"dataDir": "/home/kali/Documents/Argos/Argos/data/dted",
	"message": "No DTED tiles found. Extract DTED .zip to data/dted/ directory."
}
```

---

## Server-Side Caching

The viewshed API caches the most recent computation result to avoid redundant work when the client re-requests with identical parameters.

**Cache key**: `floor(lat * 1000), floor(lon * 1000), heightAgl, radiusM, greenOpacity, redOpacity`

The 3-decimal rounding means positions within ~111m (at the equator) share the same cache key, preventing recomputation for minor GPS jitter.

**Cache invalidation**: Any parameter change beyond the rounding tolerance invalidates the cache. The cache holds exactly one entry (the most recent result) — this is sufficient because there is only one operator position at a time.

**Cache bypass**: The client may include `"noCache": true` in the request body to force recomputation.

---

## Integration with Existing Endpoints

### Consumed (read-only, not modified)

| Endpoint                 | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `GET /api/gps/position`  | Client reads operator GPS position to pass to viewshed |
| `GET /api/hackrf/status` | Client reads SDR frequency for RF range cap            |

### Not Modified

No existing API endpoints are modified by this feature. The viewshed is a purely additive API surface.

---

## Image Format Details

The PNG image returned by `/api/viewshed/compute` is an RGBA raster with these pixel values:

| Cell Type    | R   | G   | B   | A                     |
| ------------ | --- | --- | --- | --------------------- |
| Visible      | 0   | 200 | 0   | `greenOpacity × 255`  |
| Obstructed   | 200 | 0   | 0   | `redOpacity × 255`    |
| No data      | 0   | 0   | 0   | 0 (fully transparent) |
| Out of range | 0   | 0   | 0   | 0 (fully transparent) |

The image dimensions match the DTED grid cells within the radius, capped at 256×256 pixels. MapLibre stretches the image to fill the geographic bounding box, so even an 11×11 pixel image renders correctly at any zoom level.

**Encoding**: `pngjs` (pure JavaScript, zero native dependencies). Encoding a 256×256 RGBA buffer takes < 20ms on the Pi 5.
