# Phase 3.2: Constants Centralization and Magic Number Elimination

**Risk Level**: LOW-MEDIUM -- Literal-for-constant replacement, requires value verification
**Prerequisites**: Phase 3.1 (Logger Migration complete)
**Estimated Files Touched**: ~90
**Blocks**: Phase 4 (Type Safety), Phase 5 (Architecture Decomposition)
**Standards**: BARR-C Rule 8.1 (no magic numbers), MISRA Rule 7.1 (octal/hex constants defined), NASA/JPL Rule 20 (named constants for all literals), CERT INT09-C (define numeric constants)

---

## Current State Assessment (Verified 2026-02-07)

### `src/lib/constants/limits.ts` Status

| Metric                                   | Value                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| File size                                | 95 lines                                                                                                                 |
| Constant groups defined                  | 6 (PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, GEO) -- Note: PORTS was previously listed twice in error |
| Total named constants                    | ~40                                                                                                                      |
| Files importing from limits.ts           | 2 (`src/lib/validators/gsm.ts` uses GSM_LIMITS, `src/lib/server/db/geo.ts` uses GEO)                                     |
| Constants actually consumed              | 2 groups (GSM_LIMITS, GEO)                                                                                               |
| **Constants defined but ZERO consumers** | 5 groups (PORTS, TIMEOUTS, HACKRF_LIMITS, RESOURCE_LIMITS)                                                               |

**Root Cause Finding**: `limits.ts` is 95% dead code. 40 constants are defined but only 2 files import anything from it. Every port, timeout, buffer limit, and retry constant in the codebase is a hardcoded literal that ignores the centralized definitions.

### Hardcoded Literal Inventory

| Category                         | Occurrences Outside limits.ts                     | Unique Values    | In limits.ts?        |
| -------------------------------- | ------------------------------------------------- | ---------------- | -------------------- |
| Port numbers                     | 98 across 13 unique ports (corrected 2026-02-08)  | 14               | 7 defined, 7 missing |
| setTimeout/setInterval literals  | 92 calls (corrected 2026-02-08)                   | 12 unique delays | 14 defined, unused   |
| AbortSignal.timeout literals     | 12 calls                                          | 6 unique values  | 0 defined            |
| RF frequency values              | 80+                                               | 30+ unique       | 0 defined            |
| Hardcoded file paths (/home/...) | 25 (3 different home dirs) (corrected 2026-02-08) | 12 unique        | 0 defined            |
| Hardcoded IPs/localhost          | 67 (corrected 2026-02-08)                         | 3 unique         | 0 defined            |
| Database config values           | 25                                                | 15 unique        | 0 defined            |
| Retention period values          | 14 (duplicated in 2 files) (corrected 2026-02-08) | 7 unique         | 0 defined            |
| Buffer/capacity limits           | 15                                                | 10 unique        | 3 defined, unused    |
| Reconnect/retry limits           | 6 separate definitions                            | 4 unique values  | 1 defined, unused    |
| **TOTAL**                        | **~393 (corrected 2026-02-08)**                   | --               | --                   |

---

## Execution Order

```
Task 3.2.1: Repair and Extend limits.ts (add missing constant groups)
    |
    v
Task 3.2.2: Replace Hardcoded Port Numbers (98 occurrences)
    |
    v
Task 3.2.3: Replace Hardcoded Timeouts (104 occurrences: 92 setTimeout/setInterval + 12 AbortSignal)
    |
    v
Task 3.2.4: Replace Hardcoded RF Frequencies (80+ occurrences)
    |
    v
Task 3.2.5: Replace Hardcoded Database Configuration (25 occurrences)
    |
    v
Task 3.2.6: Replace Hardcoded Buffer/Capacity/Retention Limits (27 occurrences)
    |
    v
Task 3.2.7: Centralize Hardcoded File Paths (25 occurrences) -- ENV-VAR-BASED
    |
    v
Task 3.2.8: Centralize Hardcoded IP Addresses (67 occurrences) -- USES SERVICE_URLS
```

---

## Task 3.2.1: Repair and Extend `limits.ts`

**File**: `src/lib/constants/limits.ts`

The existing file defines PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, and GEO. The following constant groups must be ADDED. Existing groups must be EXTENDED where noted.

### New Constant Groups to Add

```typescript
// --- RF Band Boundaries (MHz) ---
export const RF_BANDS = {
	// WiFi
	WIFI_2G_MIN: 2400,
	WIFI_2G_MAX: 2500,
	WIFI_5G_MIN: 5150,
	WIFI_5G_MAX: 5850,
	// Bluetooth
	BLUETOOTH_MIN: 2400,
	BLUETOOTH_MAX: 2485,
	// Cellular
	CELLULAR_1800_MIN: 1800,
	CELLULAR_1800_MAX: 1900,
	GSM_850_MIN: 824,
	GSM_850_MAX: 894,
	GSM_900_MIN: 880,
	GSM_900_MAX: 960,
	GSM_1800_UPLINK_MIN: 1710,
	GSM_1800_UPLINK_MAX: 1785,
	GSM_1800_DOWNLINK_MIN: 1805,
	GSM_1800_DOWNLINK_MAX: 1880,
	CELLULAR_1900_MIN: 1850,
	CELLULAR_1900_MAX: 1990,
	// ISM
	ISM_433: 433.92,
	ISM_433_MIN: 433,
	ISM_433_MAX: 435,
	ISM_868: 868,
	ISM_915: 915,
	ISM_915_MIN: 902,
	ISM_915_MAX: 928,
	// GPS
	GPS_L1: 1575.42,
	GPS_L1_MIN: 1575,
	GPS_L1_MAX: 1576,
	// Pager
	PAGER_DEFAULT: 152000000, // Hz (not MHz)
	// Drone common frequencies
	DRONE_24G_MIN: 2400,
	DRONE_24G_MAX: 2483,
	DRONE_58G_MIN: 5725,
	DRONE_58G_MAX: 5875,
	DRONE_5800: 5800,
	DRONE_1200: 1200
} as const;

// --- Service Base URLs ---
export const SERVICE_URLS = {
	KISMET: `http://localhost:${PORTS.KISMET_REST}`,
	HACKRF_API: `http://localhost:${PORTS.HACKRF_API}`,
	HACKRF_CONTROL: `http://localhost:${PORTS.HACKRF_CONTROL}`,
	SPECTRUM_WEB: `http://localhost:${PORTS.SPECTRUM_WEB}`,
	OLLAMA: `http://localhost:${PORTS.OLLAMA}`,
	ARGOS: `http://localhost:${PORTS.ARGOS_WEB}`,
	BETTERCAP: `http://127.0.0.1:${PORTS.BETTERCAP}`,
	GSM_EVIL: `http://localhost:${PORTS.GSM_EVIL_WEB}`,
	TILE_SERVER: `http://localhost:${PORTS.TILE_SERVER}`,
	GPSD: { host: '127.0.0.1', port: PORTS.GPSD }
} as const;

// --- Buffer & Capacity Limits ---
export const BUFFER_LIMITS = {
	LOG_BUFFER_SIZE: 1000,
	MAX_ALERTS: 500,
	MAX_FLAGGED_PACKETS: 500,
	MAX_SIGNALS_MAP: 5000,
	MAX_SCAN_PROGRESS: 500,
	MAX_CAPTURED_IMSI: 1000,
	MAX_RTL433_SIGNALS: 1000,
	MAX_FLIGHT_POINTS: 10000,
	MAX_MISSION_HISTORY: 50,
	CLEANUP_BATCH_SIZE: 1000,
	VACUUM_THRESHOLD: 10000,
	BTLE_PACKETS_CAP: 5000,
	DEVICE_HISTORY_CAP: 100,
	WIFITE_OUTPUT_CAP: 500,
	PAGERMON_MESSAGES_CAP: 1000,
	WEBSOCKET_CHUNK_SIZE: 1024,
	WEBSOCKET_LARGE_CHUNK_SIZE: 10240,
	WEBSOCKET_COMPRESSION_THRESHOLD: 1024,
	DB_QUERY_LIMIT_DEFAULT: 1000,
	RTL433_GLOBAL_OUTPUT_CAP: 100,
	SERVICE_LOG_LINES_DEFAULT: 100
} as const;

// --- Retry & Reconnection ---
export const RETRY_LIMITS = {
	MAX_RECONNECT_ATTEMPTS: 10,
	RECONNECT_BACKOFF_BASE_MS: 1000,
	RECONNECT_BACKOFF_MAX_MS: 30000
} as const;

// --- Data Retention Periods ---
export const RETENTION = {
	HACKRF_MS: 3600000, // 1 hour
	WIFI_MS: 604800000, // 7 days
	DEFAULT_MS: 3600000, // 1 hour
	DEVICE_MS: 604800000, // 7 days
	PATTERN_MS: 86400000, // 24 hours
	SPATIAL_DEFAULT_MS: 300000, // 5 minutes
	SPATIAL_WINDOW_MS: 3600000, // 1 hour
	KISMET_INACTIVE_S: 1800 // 30 minutes (seconds, Kismet API uses seconds)
} as const;

// --- Database Configuration ---
export const DB_CONFIG = {
	// Standard profile
	STANDARD_CACHE_SIZE: -2000, // 2MB (negative = KB)
	STANDARD_PAGE_SIZE: 4096,
	STANDARD_MMAP_SIZE: 30000000, // 30MB
	STANDARD_MEMORY_LIMIT: 52428800, // 50MB
	STANDARD_WAL_CHECKPOINT: 1000,
	// High-performance profile
	HIGH_PERF_CACHE_SIZE: -4000, // 4MB
	HIGH_PERF_MMAP_SIZE: 268435456, // 256MB
	HIGH_PERF_PAGE_SIZE: 8192,
	// Low-memory profile
	LOW_MEM_CACHE_SIZE: -1000, // 1MB
	LOW_MEM_WAL_CHECKPOINT: 100,
	// Init profile
	INIT_CACHE_SIZE: -64000, // 64MB
	INIT_MMAP_SIZE: 134217728, // 128MB
	INIT_PAGE_SIZE: 4096,
	// Thresholds
	VACUUM_SIZE_THRESHOLD: 104857600, // 100MB
	VACUUM_ROW_THRESHOLD: 100000,
	// Grid resolution
	GRID_MULTIPLIER: 10000
} as const;

// --- Security Thresholds ---
export const SECURITY_THRESHOLDS = {
	RECENT_ACTIVITY_MS: 300000, // 5 minutes
	EXTENDED_ACTIVITY_MS: 3600000, // 1 hour
	SCORE_BASE: 100
} as const;
```

### Ports to ADD to Existing PORTS Object

```typescript
// Add to existing PORTS:
TERMINAL_WS: 3001,
GSM_EVIL_WEB: 8080,
GRGSM_COLLECTOR: 4729,
GPSD: 2947,
TILE_SERVER: 8088,
KISMET_WS_ALT: 8002,
```

### Timeouts to ADD to Existing TIMEOUTS Object

```typescript
// Add to existing TIMEOUTS:
BTLE_POLL_INTERVAL_MS: 3000,
HARDWARE_ACQUIRE_TIMEOUT_MS: 5000,
RTL433_STREAM_CLEANUP_MS: 600000,
FETCH_ABORT_TIMEOUT_MS: 10000,
CONTAINER_STARTUP_DELAY_MS: 3000,
PROCESS_STARTUP_DELAY_MS: 2000,
SERIAL_READ_TIMEOUT_MS: 3000,
EXEC_TIMEOUT_MS: 30000,
WEBSOCKET_CONNECT_TIMEOUT_MS: 5000,
CLOCK_UPDATE_MS: 1000,
DATA_STALE_THRESHOLD_MS: 7200000,
NO_DATA_THRESHOLD_MS: 60000,
SWEEP_CYCLE_TIME_MS: 10000,
SWEEP_INIT_TIMEOUT_MS: 10000,
SWEEP_DATA_TIMEOUT_MS: 120000,
DEVICE_UPDATE_INTERVAL_MS: 5000,
DEVICE_CLEANUP_INTERVAL_MS: 60000,
CACHE_EXPIRY_MS: 300000,
THROTTLE_INTERVAL_MS: 500,
BETTERCAP_WAIT_API_MS: 15000,
MCP_FETCH_TIMEOUT_MS: 15000,
AGENT_OLLAMA_TIMEOUT_MS: 120000,
AGENT_ANTHROPIC_TIMEOUT_MS: 30000,
AGENT_HEALTH_CHECK_MS: 2000,
```

### Commit

```
refactor(constants): extend limits.ts with RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETENTION, DB_CONFIG
```

**Verification**:

```bash
npm run typecheck  # Must pass
grep -c "as const" src/lib/constants/limits.ts
# Expected: 13+ (PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, GEO, RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETRY_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS)
```

---

## Task 3.2.2: Replace Hardcoded Port Numbers

98 occurrences across 13 unique ports, 27+ files.

### Port 2501 (Kismet REST) -- 17 occurrences (corrected 2026-02-08)

| #   | File                                                    | Line | Current           | Replacement           |
| --- | ------------------------------------------------------- | ---- | ----------------- | --------------------- |
| 1   | `src/lib/components/dashboard/views/KismetView.svelte`  | 10   | `:2501/`          | `PORTS.KISMET_REST`   |
| 2   | `src/lib/server/hardware/detection/network-detector.ts` | 84   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 3   | `src/lib/server/kismet/api_client.ts`                   | 26   | `port: 2501`      | `PORTS.KISMET_REST`   |
| 4   | `src/lib/server/kismet/kismet_controller.ts`            | 50   | `restPort: 2501`  | `PORTS.KISMET_REST`   |
| 5   | `src/lib/server/kismet/fusion_controller.ts`            | 44   | `port: 2501`      | `PORTS.KISMET_REST`   |
| 6   | `src/lib/server/services/kismet.service.ts`             | 24   | `BASE_URL...2501` | `SERVICE_URLS.KISMET` |
| 7   | `src/lib/services/tactical-map/kismetService.ts`        | 9    | `:2501`           | `PORTS.KISMET_REST`   |
| 8   | `src/routes/api/kismet/proxy/[...path]/+server.ts`      | 7    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 9   | `src/routes/api/kismet/devices/list/+server.ts`         | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 10  | `src/routes/api/kismet/devices/+server.ts`              | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 11  | `src/routes/api/kismet/devices/stats/+server.ts`        | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 12  | `src/routes/api/kismet/status/+server.ts`               | 10   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 13  | `src/routes/api/kismet/config/+server.ts`               | 10   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 14  | `src/routes/api/kismet/interfaces/+server.ts`           | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 15  | `src/lib/server/kismet/kismetProxy.ts`                  | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 16  | `src/lib/server/kismet/webSocketManager.ts`             | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 17  | `src/routes/api/agent/tools/+server.ts`                 | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |

### Port 8092 (HackRF API) -- 4 occurrences (corrected 2026-02-08)

| #   | File                                                    | Line | Current                | Replacement               |
| --- | ------------------------------------------------------- | ---- | ---------------------- | ------------------------- |
| 1   | `src/lib/components/hackrf/AnalysisTools.svelte`        | 14   | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 2   | `src/lib/server/hardware/detection/network-detector.ts` | 125  | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 3   | `src/routes/api/agent/tools/+server.ts`                 | --   | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 4   | `src/lib/server/hardware/detection/network-detector.ts` | 167  | `localhost:8092` check | `SERVICE_URLS.HACKRF_API` |

### Port 8073 (Spectrum Web / OpenWebRX) -- 10 occurrences

| #    | File                                                      | Line | Current          | Replacement                 |
| ---- | --------------------------------------------------------- | ---- | ---------------- | --------------------------- |
| 1    | `src/lib/components/dashboard/views/OpenWebRXView.svelte` | 11   | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 2    | `src/lib/components/hackrf/AnalysisTools.svelte`          | 10   | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 3    | `src/lib/server/hardware/detection/network-detector.ts`   | 167  | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 4-10 | (additional occurrences in openwebrx routes and stores)   | --   | `8073`           | `PORTS.SPECTRUM_WEB`        |

### Port 3002 (HackRF Control) -- 1 occurrence

| #   | File                                         | Line | Current          | Replacement                   |
| --- | -------------------------------------------- | ---- | ---------------- | ----------------------------- |
| 1   | `src/routes/api/hackrf/[...path]/+server.ts` | 4    | `localhost:3002` | `SERVICE_URLS.HACKRF_CONTROL` |

### Port 11434 (Ollama) -- 4 occurrences

| #   | File                                     | Line | Current                            | Replacement           |
| --- | ---------------------------------------- | ---- | ---------------------------------- | --------------------- |
| 1   | `src/lib/server/agent/runtime.ts`        | 92   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 2   | `src/routes/api/agent/stream/+server.ts` | 43   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 3   | `src/routes/api/agent/status/+server.ts` | 15   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 4   | `src/lib/server/agent/runtime.ts`        | 215  | `localhost:11434` (2nd occurrence) | `SERVICE_URLS.OLLAMA` |

### Port 5173 (Argos Web) -- 21 occurrences (corrected 2026-02-08)

| #    | File                                     | Line | Current          | Replacement                               |
| ---- | ---------------------------------------- | ---- | ---------------- | ----------------------------------------- |
| 1-15 | Various WebSocket URLs and API base URLs | --   | `localhost:5173` | `SERVICE_URLS.ARGOS` or `PORTS.ARGOS_WEB` |

### Port 8081 (Bettercap/DroneID) -- 9 occurrences (corrected 2026-02-08)

| #   | File                                    | Line | Current               | Replacement              |
| --- | --------------------------------------- | ---- | --------------------- | ------------------------ |
| 1   | `src/lib/server/bettercap/apiClient.ts` | 7    | `127.0.0.1:8081`      | `SERVICE_URLS.BETTERCAP` |
| 2   | `src/lib/server/bettercap/apiClient.ts` | 96   | `-api-rest-port 8081` | `PORTS.BETTERCAP`        |
| 3   | `src/routes/droneid/+page.svelte`       | 78   | `ws://...8081`        | `PORTS.BETTERCAP`        |
| 4   | `src/routes/api/droneid/+server.ts`     | 132  | `-p 8081`             | `PORTS.BETTERCAP`        |
| 5   | `src/routes/api/droneid/+server.ts`     | 204  | `8081` in pkill       | `PORTS.BETTERCAP`        |

### Ports NOT Currently in limits.ts -- 6 new ports

| Port | Service         | Occurrences               | Files                                             |
| ---- | --------------- | ------------------------- | ------------------------------------------------- |
| 3001 | Terminal WS     | 2                         | TerminalView.svelte, TerminalTabContent.svelte    |
| 8080 | GSM Evil Web    | 9 (corrected 2026-02-08)  | gsm-evil/control, health, status                  |
| 4729 | grgsm collector | 14 (corrected 2026-02-08) | gsm-evil/scan, intelligent-scan, activity, health |
| 2947 | gpsd            | 2                         | hardware/details, gps/position                    |
| 8088 | Tile Server     | 1                         | mapConfig.ts                                      |
| 8002 | Kismet WS alt   | 1                         | services/websocket/kismet.ts                      |

### Procedure

Replace in groups of one port at a time. Run `npm run typecheck` after each port group.

**Note on client-side imports**: Svelte components cannot import server-only modules. `$lib/constants/limits.ts` is a shared module (no server-only imports), so it is safe to import in both contexts.

### Commit

```
refactor(constants): replace 98 hardcoded port literals with PORTS/SERVICE_URLS constants
```

**Verification**:

```bash
grep -Prn '\b(2501|8092|3002|8073|11434|8081|8080|4729|2947|8088|8002|3001)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "\.md" | wc -l
# Target: 0
```

---

## Task 3.2.3: Replace Hardcoded Timeouts

104 total: 92 setTimeout/setInterval with numeric literals + 12 AbortSignal.timeout with numeric literals (corrected 2026-02-08).

### setTimeout Occurrences by Delay Value (69 total, corrected 2026-02-08)

| Delay (ms) | Count | Constant to Use                         |
| ---------- | ----- | --------------------------------------- |
| 100        | 3     | `TIMEOUTS.TICK_MS` (new, add value 100) |
| 300        | 1     | Inline acceptable (UI debounce)         |
| 500        | 7     | `TIMEOUTS.GSM_CLEANUP_DELAY_MS`         |
| 1000       | 18    | `TIMEOUTS.SHORT_DELAY_MS`               |
| 2000       | 18    | `TIMEOUTS.PROCESS_STARTUP_DELAY_MS`     |
| 3000       | 7     | `TIMEOUTS.CONTAINER_STARTUP_DELAY_MS`   |
| 5000       | 3     | `TIMEOUTS.KISMET_RECONNECT_DELAY_MS`    |
| 600000     | 1     | `TIMEOUTS.RTL433_STREAM_CLEANUP_MS`     |

**Full file-level inventory available in verification agent output. Each replacement must be verified against the semantic meaning of the delay -- not all 1000ms delays serve the same purpose.**

### setInterval Occurrences (23 total, corrected 2026-02-08)

| Interval (ms) | Count | Constant to Use                     |
| ------------- | ----- | ----------------------------------- |
| 1000          | 2     | `TIMEOUTS.CLOCK_UPDATE_MS`          |
| 2000          | 2     | `TIMEOUTS.PROCESS_STARTUP_DELAY_MS` |
| 3000          | 1     | `TIMEOUTS.BTLE_POLL_INTERVAL_MS`    |
| 5000          | 5     | `TIMEOUTS.KISMET_POLL_INTERVAL_MS`  |
| 10000         | 2     | `TIMEOUTS.FETCH_ABORT_TIMEOUT_MS`   |
| 30000         | 1     | `TIMEOUTS.HEALTH_CHECK_INTERVAL_MS` |

### AbortSignal.timeout Occurrences (12 total)

| Timeout (ms) | Count | Constant to Use                    |
| ------------ | ----- | ---------------------------------- |
| 1000         | 2     | `TIMEOUTS.SHORT_DELAY_MS`          |
| 2000         | 4     | `TIMEOUTS.AGENT_HEALTH_CHECK_MS`   |
| 10000        | 1     | `TIMEOUTS.FETCH_ABORT_TIMEOUT_MS`  |
| 15000        | 1     | `TIMEOUTS.MCP_FETCH_TIMEOUT_MS`    |
| 30000        | 1     | `TIMEOUTS.EXEC_TIMEOUT_MS`         |
| 120000       | 1     | `TIMEOUTS.AGENT_OLLAMA_TIMEOUT_MS` |

### Value Mismatch Alert

**IMPORTANT**: `src/lib/server/kismet/webSocketManager.ts` line 75 defines `POLL_INTERVAL = 2000` but the existing `TIMEOUTS.KISMET_POLL_INTERVAL_MS` is `5000`. These serve different purposes -- the webSocketManager polls faster for real-time data. Resolution: Keep both values, use different constant names:

- `TIMEOUTS.KISMET_POLL_INTERVAL_MS: 5000` (general status polling)
- `TIMEOUTS.KISMET_WS_POLL_INTERVAL_MS: 2000` (WebSocket real-time data polling)

### Procedure

Replace in groups of 5 files. Run `npm run typecheck` after each group.

### Commit

```
refactor(constants): replace 104 hardcoded timeout/interval literals with TIMEOUTS constants
```

**Verification**:

```bash
grep -Prn '(setTimeout|setInterval)\([^,]+,\s*\d{3,}\)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l
# Target: 0 (allow 300ms UI debounce as exception)

grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" | grep -v limits.ts | wc -l
# Target: 0
```

---

## Task 3.2.4: Replace Hardcoded RF Frequencies

80+ occurrences across 20+ files.

### Primary Files and Replacement Strategy

| #   | File                                                                | Occurrences | Strategy                                         |
| --- | ------------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| 1   | `src/lib/server/db/geo.ts`                                          | 9           | Replace with `RF_BANDS.WIFI_2G_MIN/MAX`, etc.    |
| 2   | `src/lib/services/map/signalFiltering.ts`                           | 12          | Replace with RF_BANDS constants                  |
| 3   | `src/lib/services/map/droneDetection.ts`                            | 15          | Replace with RF*BANDS.DRONE*\* constants         |
| 4   | `src/lib/services/map/aiPatternDetector.ts`                         | 10          | Replace with RF_BANDS constants                  |
| 5   | `src/lib/services/map/signalClustering.ts`                          | 6           | Replace (note: uses GHz, not MHz -- convert)     |
| 6   | `src/lib/services/db/signalDatabase.ts`                             | 4           | Replace with RF_BANDS constants                  |
| 7   | `src/lib/components/map/AirSignalOverlay.svelte`                    | 10          | Replace with RF_BANDS constants                  |
| 8   | `src/lib/server/usrp/sweepManager.ts`                               | 14          | Replace with RF_BANDS preset objects             |
| 9   | `src/lib/services/hackrfsweep/frequencyService.ts`                  | 12          | Replace with RF_BANDS constants                  |
| 10  | `src/lib/services/hackrf/signalProcessor.ts`                        | 4           | Replace (note: uses Hz not MHz)                  |
| 11  | `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 1           | Replace `433.92e6` with `RF_BANDS.ISM_433 * 1e6` |
| 12  | `src/lib/server/websocket-server.ts`                                | 8           | Replace mock/demo data with RF_BANDS             |
| 13  | `src/lib/components/hackrf/TimeFilterDemo.svelte`                   | 4           | Replace                                          |
| 14  | `src/lib/components/hackrfsweep/frequency/FrequencyControls.svelte` | 3           | Replace                                          |
| 15  | `src/lib/components/tactical-map/hackrf/FrequencySearch.svelte`     | 6           | Replace                                          |
| 16  | `src/routes/hackrfsweep/+page.svelte`                               | 1           | Replace                                          |
| 17  | `src/routes/rfsweep/+page.svelte`                                   | 1           | Replace                                          |
| 18  | `src/lib/stores/hackrfsweep/frequencyStore.ts`                      | 1           | Replace                                          |
| 19  | `src/lib/stores/rtl433Store.ts`                                     | 1           | Replace                                          |
| 20  | `src/routes/rtl-433/+page.svelte`                                   | 4           | Replace                                          |
| 21  | `src/lib/server/hackrf/sweepManager.ts`                             | 3           | Replace threshold values                         |

### Unit Conversion Note

The codebase inconsistently uses MHz, GHz, and Hz:

- Most files use MHz (2400, 5150, etc.)
- `signalClustering.ts` uses GHz (0.824, 0.433)
- `signalProcessor.ts` uses Hz (1710e6, 1805e6)
- `gnuradio/spectrum_analyzer.ts` uses Hz (433.92e6)
- `pagermon/processManager.ts` uses Hz (152000000)

**All RF_BANDS constants are in MHz.** Add a helper or document conversion:

```typescript
// In limits.ts:
export const MHZ_TO_HZ = 1e6;
export const GHZ_TO_MHZ = 1e3;
```

### Commit

```
refactor(constants): replace 80+ hardcoded RF frequency literals with RF_BANDS constants
```

**Verification**:

```bash
grep -Prn '\b(2400|2500|5150|5850|2485|1800|1900|824|894|880|960)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v "\.md" | wc -l
# Target: 0
```

---

## Task 3.2.5: Replace Hardcoded Database Configuration

25 occurrences across 3 files.

### Target Files

| File                                  | Occurrences | Values                                                                                                    |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/dbOptimizer.ts`    | 17          | cache_size, page_size, mmap_size, memory_limit, wal_autocheckpoint, vacuum thresholds, query cost scoring |
| `src/lib/server/db/database.ts`       | 6           | cache_size, mmap_size, page_size, grid multiplier                                                         |
| `src/lib/server/db/cleanupService.ts` | 2           | batchSize, VACUUM threshold                                                                               |

### Duplicate Retention Configs

`db/database.ts` lines 262-270 and `db/cleanupService.ts` lines 43-59 define identical retention periods independently. Both must be replaced with `RETENTION.*` constants.

### Commit

```
refactor(constants): replace 25 hardcoded database config values with DB_CONFIG/RETENTION constants
```

---

## Task 3.2.6: Replace Hardcoded Buffer/Capacity/Retention Limits

27 occurrences across 10+ files.

### Key Replacements

| File                                        | Line     | Current                  | Replacement                            |
| ------------------------------------------- | -------- | ------------------------ | -------------------------------------- |
| `src/lib/server/btle/processManager.ts`     | 44       | `5000` packets cap       | `BUFFER_LIMITS.BTLE_PACKETS_CAP`       |
| `src/lib/server/kismet/device_tracker.ts`   | 305      | `100` history cap        | `BUFFER_LIMITS.DEVICE_HISTORY_CAP`     |
| `src/lib/server/wifite/processManager.ts`   | 228,238  | `500` output cap         | `BUFFER_LIMITS.WIFITE_OUTPUT_CAP`      |
| `src/lib/server/pagermon/processManager.ts` | 51       | `1000` messages cap      | `BUFFER_LIMITS.PAGERMON_MESSAGES_CAP`  |
| `src/lib/server/websocket-server.ts`        | 32,37,43 | `1024`, `10240`, `1024`  | `BUFFER_LIMITS.WEBSOCKET_*`            |
| `src/lib/server/db/signalRepository.ts`     | 191      | `1000` limit             | `BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT` |
| `src/lib/server/db/networkRepository.ts`    | 63       | `1000` limit             | `BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT` |
| `src/lib/server/db/cleanupService.ts`       | 54       | `1000` batchSize         | `BUFFER_LIMITS.CLEANUP_BATCH_SIZE`     |
| `src/lib/server/db/cleanupService.ts`       | 317      | `10000` VACUUM threshold | `BUFFER_LIMITS.VACUUM_THRESHOLD`       |

### Duplicate Earth Radius Constants

| File                                                            | Line | Value     | Replacement                            |
| --------------------------------------------------------------- | ---- | --------- | -------------------------------------- |
| `src/lib/server/services/kismet.service.ts`                     | 202  | `6371000` | `GEO.EARTH_RADIUS_M`                   |
| `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 198  | `6371`    | `GEO.EARTH_RADIUS_M / 1000`            |
| `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 199  | `3959`    | New `GEO.EARTH_RADIUS_MI` (add to GEO) |

### Commit

```
refactor(constants): replace 27 hardcoded buffer/capacity/retention literals
```

---

## Task 3.2.7: Centralize Hardcoded File Paths

25 occurrences across 3 different home directories (`/home/pi/`, `/home/ubuntu/`, `/home/kali/`) (corrected 2026-02-08).

**Root Cause**: The codebase was developed across 3 different hosts without environment-variable parameterization. This is a deployment portability failure.

### Strategy

Create `src/lib/constants/paths.ts`:

```typescript
import { env } from '$env/dynamic/private';

// Base directories -- resolved from environment at runtime
export const PATHS = {
	// Primary project root
	PROJECT_ROOT: env.ARGOS_PROJECT_ROOT || '/home/kali/Documents/Argos/Argos',

	// Data directories
	DATA_DIR: env.ARGOS_DATA_DIR || '/home/kali/Documents/Argos/Argos/data',
	CELL_TOWER_DB:
		env.ARGOS_CELL_TOWER_DB || '/home/kali/Documents/Argos/Argos/data/celltowers/towers.db',

	// External tool directories
	GSM_EVIL_DIR: env.GSM_EVIL_DIR || '/home/kali/gsmevil-user',
	GSM_EVIL_DB: env.GSM_EVIL_DB || '/home/kali/gsmevil-user/database/imsi.db',
	DRONEID_DIR: env.DRONEID_DIR || '/home/kali/Documents/Argos/RemoteIDReceiver/Receiver',

	// Kismet directories
	KISMET_SCRIPTS_DIR: env.KISMET_SCRIPTS_DIR || '/home/kali/Scripts',
	KISMET_OPS_DIR: env.KISMET_OPS_DIR || '/home/kali/kismet_ops',
	KISMET_TMP_DIR: env.KISMET_TMP_DIR || '/tmp',

	// Temp/Log directories
	TMP_DIR: '/tmp'
} as const;
```

**NOTE**: This file uses `$env/dynamic/private` which is server-only. Client-side components that reference paths will need the path passed via props or API responses, not direct imports.

### Files to Update

| #   | File                                                               | Lines     | Current Path                          | Replacement                                        |
| --- | ------------------------------------------------------------------ | --------- | ------------------------------------- | -------------------------------------------------- |
| 1   | `src/lib/server/kismet/serviceManager.ts`                          | 10-12     | `/home/pi/Scripts/`, `/home/pi/tmp/`  | `PATHS.KISMET_SCRIPTS_DIR`, `PATHS.KISMET_TMP_DIR` |
| 2   | `src/lib/server/kismet/scriptManager.ts`                           | 12-13,181 | `/home/pi/Scripts`, `/home/pi/stinky` | `PATHS.KISMET_SCRIPTS_DIR`                         |
| 3   | `src/routes/api/kismet/scripts/execute/+server.ts`                 | 20        | `/home/pi/Scripts`, `/home/pi/stinky` | `PATHS.KISMET_SCRIPTS_DIR`                         |
| 4   | `src/routes/api/kismet/control/+server.ts`                         | 91,93     | `/home/kali`                          | `PATHS.PROJECT_ROOT`                               |
| 5   | `src/routes/api/droneid/+server.ts`                                | 8-10      | `/home/ubuntu/projects/Argos/`        | `PATHS.DRONEID_DIR`                                |
| 6   | `src/routes/api/cell-towers/nearby/+server.ts`                     | 48-49     | Two paths with different home dirs    | `PATHS.CELL_TOWER_DB`                              |
| 7   | `src/routes/api/tactical-map/cell-towers/+server.ts`               | 24        | `/home/ubuntu/projects/Argos/`        | `PATHS.CELL_TOWER_DB`                              |
| 8   | `src/routes/api/gsm-evil/imsi-data/+server.ts`                     | 9         | `/home/kali/gsmevil-user/`            | `PATHS.GSM_EVIL_DB`                                |
| 9   | `src/routes/api/gsm-evil/imsi/+server.ts`                          | 9         | `/home/kali/gsmevil-user/`            | `PATHS.GSM_EVIL_DB`                                |
| 10  | `src/routes/api/gsm-evil/control/+server.ts`                       | 79        | `/home/kali/gsmevil-user`             | `PATHS.GSM_EVIL_DIR`                               |
| 11  | `src/lib/services/localization/coral/CoralAccelerator.ts`          | 33-34     | `/home/ubuntu/projects/Argos/`        | `PATHS.PROJECT_ROOT`                               |
| 12  | `src/lib/services/localization/coral/CoralAccelerator.v2.ts`       | 35,45     | `/home/ubuntu/projects/Argos/`        | `PATHS.PROJECT_ROOT`                               |
| 13  | `src/lib/components/wigletotak/directory/DirectoryCard.svelte`     | --        | `/home/pi/kismet_ops` (x2)            | `PATHS.KISMET_OPS_DIR`                             |
| 14  | `src/lib/server/agent/tool-execution/detection/binary-detector.ts` | --        | `/home/kali/.local/bin`               | `PATHS.LOCAL_BIN_DIR`                              |
| 15  | `src/lib/server/gsm-database-path.ts`                              | --        | `/home/ubuntu/gsmevil-user`           | `PATHS.GSM_EVIL_DIR`                               |
| 16  | `src/lib/stores/wigletotak/wigleStore.ts`                          | --        | `/home/pi/kismet_ops`                 | `PATHS.KISMET_OPS_DIR`                             |
| 17  | `src/lib/server/kismet/scriptManager.ts`                           | 181       | `/home/pi/tmp/*.log`                  | `PATHS.KISMET_TMP_DIR`                             |

### Commit

```
refactor(paths): centralize 25 hardcoded file paths into env-var-backed PATHS constants
```

**Verification**:

```bash
grep -Prn '/home/(pi|ubuntu|kali)/' src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "\.md" | wc -l
# Target: 0
```

---

## Task 3.2.8: Centralize Hardcoded IP Addresses

67 occurrences of `localhost`, `127.0.0.1`, and `0.0.0.0` (corrected 2026-02-08).

**Strategy**: Most of these are replaced automatically by Task 3.2.2 (port replacement uses `SERVICE_URLS` which includes the host). The remaining cases are:

1. `127.0.0.1` in shell command strings (gsm-evil grep patterns) -- these reference tcpdump output patterns, not connection strings. Leave as-is with explanatory comment.
2. `0.0.0.0` bind addresses -- these are intentional "all interfaces" bindings. Centralize as:
    ```typescript
    export const BIND_ADDRESSES = {
    	ALL_INTERFACES: '0.0.0.0',
    	LOCALHOST: '127.0.0.1'
    } as const;
    ```
3. Default values in UI forms (TAK settings) -- leave as-is, they are user-facing defaults.

### Commit

```
refactor(constants): centralize IP address literals into BIND_ADDRESSES constants
```

---

## Verification Checklist (Phase 3.2 Complete)

| #   | Check                                 | Command                                                                                                                                                              | Expected              |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | No hardcoded port literals            | `grep -Prn '\b(2501\|8092\|3002\|8073\|11434\|8081\|8080\|4729\|2947\|8088\|8002\|3001)\b' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l` | 0                     |
| 2   | No raw timeout literals in setTimeout | `grep -Prn '(setTimeout\|setInterval)\([^,]+,\s*\d{4,}\)' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l`                                  | 0                     |
| 3   | No raw AbortSignal timeouts           | `grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                                        | 0                     |
| 4   | No hardcoded RF frequencies in server | `grep -Prn '\b(2400\|2500\|5150\|5850\|2485)\b' src/lib/server/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                      | 0                     |
| 5   | No /home/pi or /home/ubuntu paths     | `grep -Prn '/home/(pi\|ubuntu)/' src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                                                | 0                     |
| 6   | limits.ts has 13+ constant groups     | `grep -c "as const" src/lib/constants/limits.ts`                                                                                                                     | 13+                   |
| 7   | paths.ts exists and uses env vars     | `grep -c "env\." src/lib/constants/paths.ts`                                                                                                                         | 8+                    |
| 8   | No duplicate retention configs        | `grep -c "604800000" src/ -r --include="*.ts"`                                                                                                                       | 1 (only in limits.ts) |
| 9   | TypeScript compiles                   | `npm run typecheck`                                                                                                                                                  | Exit 0                |
| 10  | Build succeeds                        | `npm run build`                                                                                                                                                      | Exit 0                |
| 11  | Unit tests pass                       | `npm run test:unit`                                                                                                                                                  | Exit 0                |

---

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                                                  |
| ------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| Timeout value change alters behavior       | MEDIUM     | MEDIUM | Replace literal-for-literal; do NOT change any timeout values during this phase             |
| Client-side import of server-only paths.ts | MEDIUM     | LOW    | paths.ts uses $env/dynamic/private -- Vite will error at build time if imported client-side |
| RF frequency constant precision loss       | LOW        | MEDIUM | Use exact same numeric values; verify with typecheck                                        |
| SERVICE_URLS template literal resolution   | LOW        | LOW    | PORTS constants are static `as const`; template literals resolve at import time             |
| Circular import between limits.ts sections | LOW        | LOW    | All constants are in one file; no circular risk                                             |
| Phase 0 file renames break paths           | LOW        | LOW    | Path references are to runtime directories, not source files                                |

---

## Dependencies

- **Phase 3.1**: Must be complete (logger migration uses these constants in log messages).
- **Phase 3.3**: ESLint `no-magic-numbers` rule depends on constants being centralized first.
- **Phase 5**: Architecture decomposition benefits from centralized configuration.
- **Phase 6**: Infrastructure modernization (Docker, SystemD) benefits from env-var-based paths.
