# Phase 3.2.0: Constants Infrastructure Extension -- Repair and Extend limits.ts

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.0
**Risk Level**: LOW
**Prerequisites**: Phase 3.1 (Logger Migration complete)
**Blocks**: ALL other Phase 3.2 tasks (3.2.1 through 3.2.7). No downstream task can begin until this task is verified complete.
**Estimated Files Touched**: 1 (`src/lib/constants/limits.ts`)
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Repair and extend `src/lib/constants/limits.ts` from its current 95-line, 95%-dead-code state into the single authoritative source of truth for all numeric literals in the Argos codebase. This task adds 8 new constant groups, extends 2 existing groups, and adds unit conversion helpers. All downstream Phase 3.2 tasks depend on the constants defined here.

## Current State Assessment

| Metric                                   | Value                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| File size                                | 95 lines                                                                                                                       |
| Constant groups defined                  | **6** (PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, GEO) -- CORRECTED from 7; original plan listed PORTS twice |
| Total named constants                    | ~40                                                                                                                            |
| Files importing from limits.ts           | 2 (`src/lib/validators/gsm.ts` uses GSM_LIMITS, `src/lib/server/db/geo.ts` uses GEO)                                           |
| Constants actually consumed              | 2 groups (GSM_LIMITS, GEO)                                                                                                     |
| **Constants defined but ZERO consumers** | **5 groups** (PORTS, TIMEOUTS, HACKRF_LIMITS, RESOURCE_LIMITS) -- all dead code                                                |

**Root Cause Finding**: `limits.ts` is 95% dead code. 40 constants are defined but only 2 files import anything from it. Every port, timeout, buffer limit, and retry constant in the codebase is a hardcoded literal that ignores the centralized definitions.

### Codebase-Wide Hardcoded Literal Inventory (CORRECTED per Verification Audit 2026-02-08)

| Category                         | Occurrences Outside limits.ts  | Unique Values    | In limits.ts?        |
| -------------------------------- | ------------------------------ | ---------------- | -------------------- |
| Port numbers                     | **98** across 13 unique ports  | 14               | 7 defined, 7 missing |
| setTimeout/setInterval literals  | **92** calls                   | 12 unique delays | 14 defined, unused   |
| AbortSignal.timeout literals     | **12** calls                   | 6 unique values  | 0 defined            |
| RF frequency values              | 80+                            | 30+ unique       | 0 defined            |
| Hardcoded file paths (/home/...) | **25** (3 different home dirs) | 12 unique        | 0 defined            |
| Hardcoded IPs/localhost          | **67**                         | 3 unique         | 0 defined            |
| Database config values           | ~25                            | 15 unique        | 0 defined            |
| Retention period values          | **14** (duplicated in 2 files) | 7 unique         | 0 defined            |
| Buffer/capacity limits           | 15                             | 10 unique        | 3 defined, unused    |
| Reconnect/retry limits           | 6 separate definitions         | 4 unique values  | 1 defined, unused    |
| **TOTAL**                        | **~393**                       | --               | --                   |

## Scope

### 1. Ports to ADD to Existing PORTS Object

The existing PORTS object defines 7 ports. The following 6 must be added to cover all 13 unique ports in the codebase:

```typescript
// Add to existing PORTS:
TERMINAL_WS: 3001,
GSM_EVIL_WEB: 8080,
GRGSM_COLLECTOR: 4729,
GPSD: 2947,
TILE_SERVER: 8088,
KISMET_WS_ALT: 8002,
```

After extension, PORTS will contain all 13 port constants required by Task 3.2.1.

### 2. Timeouts to ADD to Existing TIMEOUTS Object

The existing TIMEOUTS object defines 14 timeout constants. The following 25+ must be added:

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
TICK_MS: 100,
KISMET_WS_POLL_INTERVAL_MS: 2000,
```

**NOTE on KISMET_WS_POLL_INTERVAL_MS**: `src/lib/server/kismet/webSocketManager.ts` line 75 defines `POLL_INTERVAL = 2000` but the existing `TIMEOUTS.KISMET_POLL_INTERVAL_MS` is `5000`. These serve different purposes -- the webSocketManager polls faster for real-time data. Both values must be preserved under distinct names.

### 3. New Constant Group: RF_BANDS

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
```

### 4. New Constant Group: SERVICE_URLS

```typescript
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
```

### 5. New Constant Group: BUFFER_LIMITS

```typescript
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
```

### 6. New Constant Group: RETRY_LIMITS

```typescript
// --- Retry & Reconnection ---
export const RETRY_LIMITS = {
	MAX_RECONNECT_ATTEMPTS: 10,
	RECONNECT_BACKOFF_BASE_MS: 1000,
	RECONNECT_BACKOFF_MAX_MS: 30000
} as const;
```

### 7. New Constant Group: RETENTION

```typescript
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
```

### 8. New Constant Group: DB_CONFIG

```typescript
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
```

### 9. New Constant Group: SECURITY_THRESHOLDS

```typescript
// --- Security Thresholds ---
export const SECURITY_THRESHOLDS = {
	RECENT_ACTIVITY_MS: 300000, // 5 minutes
	EXTENDED_ACTIVITY_MS: 3600000, // 1 hour
	SCORE_BASE: 100
} as const;
```

### 10. New Constant Group: BIND_ADDRESSES

```typescript
// --- Bind Addresses ---
export const BIND_ADDRESSES = {
	ALL_INTERFACES: '0.0.0.0',
	LOCALHOST: '127.0.0.1'
} as const;
```

### 11. Unit Conversion Helpers

```typescript
// --- Unit Conversion Constants ---
export const MHZ_TO_HZ = 1e6;
export const GHZ_TO_MHZ = 1e3;
```

## Execution Steps

1. **Open** `src/lib/constants/limits.ts` (95 lines).
2. **Verify** existing 6 groups: PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, GEO.
3. **Extend PORTS** with 6 new port constants (TERMINAL_WS, GSM_EVIL_WEB, GRGSM_COLLECTOR, GPSD, TILE_SERVER, KISMET_WS_ALT).
4. **Extend TIMEOUTS** with 26 new timeout constants as listed above.
5. **Add TICK_MS: 100** to TIMEOUTS for 100ms setTimeout replacements.
6. **Add KISMET_WS_POLL_INTERVAL_MS: 2000** to TIMEOUTS (distinct from existing KISMET_POLL_INTERVAL_MS: 5000).
7. **Append** all 8 new constant groups: RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETRY_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS, BIND_ADDRESSES.
8. **Append** conversion helpers: MHZ_TO_HZ, GHZ_TO_MHZ.
9. **Run** `npm run typecheck` -- must exit 0.
10. **Verify** `as const` count is 15 (PORTS, TIMEOUTS, HACKRF_LIMITS, GSM_LIMITS, RESOURCE_LIMITS, GEO, RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETRY_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS, BIND_ADDRESSES + existing).

## Commit Message

```
refactor(constants): extend limits.ts with RF_BANDS, SERVICE_URLS, BUFFER_LIMITS, RETENTION, DB_CONFIG

Phase 3.2 Task 0: Repair and Extend Constants Infrastructure
- Extended PORTS with 6 new port constants (3001, 8080, 4729, 2947, 8088, 8002)
- Extended TIMEOUTS with 26 new timeout/interval constants
- Added 8 new constant groups: RF_BANDS, SERVICE_URLS, BUFFER_LIMITS,
  RETRY_LIMITS, RETENTION, DB_CONFIG, SECURITY_THRESHOLDS, BIND_ADDRESSES
- Added MHZ_TO_HZ and GHZ_TO_MHZ conversion helpers
- Prerequisite for all downstream Phase 3.2 literal replacement tasks

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 2 -- Correct number of constant groups**:

```bash
grep -c "as const" src/lib/constants/limits.ts
```

**Expected result**: 14 or higher (6 existing + 8 new = 14 minimum; SERVICE_URLS uses PORTS references so template literals resolve at import time).

**Command 3 -- All new groups exported**:

```bash
grep -c "^export const" src/lib/constants/limits.ts
```

**Expected result**: 16 or higher (14 object constants + MHZ_TO_HZ + GHZ_TO_MHZ).

**Command 4 -- File size sanity check**:

```bash
wc -l src/lib/constants/limits.ts
```

**Expected result**: ~300-350 lines (up from 95).

## Audit Corrections Applied

| Original Claim                 | Corrected Value                | Source                                         |
| ------------------------------ | ------------------------------ | ---------------------------------------------- |
| 7 constant groups in limits.ts | **6** (PORTS was listed twice) | Verification Audit Claim 1, rated 4/5          |
| Total hardcoded literals: ~334 | **~393**                       | Verification Audit recalculated all categories |

The verification audit found the plan originally listed PORTS twice in its group enumeration, inflating the count from 6 to 7. This is corrected throughout this document.

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                                      |
| ------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------- |
| Circular import from SERVICE_URLS -> PORTS | NONE       | --     | Both constants in same file; no import cycle possible                           |
| SERVICE_URLS template literal resolution   | LOW        | LOW    | PORTS constants are static `as const`; template literals resolve at import time |
| Existing importers break on file growth    | NONE       | --     | Only additive changes; existing exports unchanged                               |
| Name collision with existing constants     | LOW        | LOW    | All new names verified unique against existing 40 constants                     |

## Success Criteria

- `npm run typecheck` exits 0
- `grep -c "as const" src/lib/constants/limits.ts` returns 14+
- All 13 port constants present in PORTS
- All 40+ timeout constants present in TIMEOUTS
- File is the sole definition point for all numeric constants consumed by Tasks 3.2.1-3.2.7
- No existing importers broken (gsm.ts, geo.ts still compile)

## Cross-References

- **Depends on**: Phase 3.1 (Logger Migration)
- **Blocks**: Phase-3.2.1 (Port Replacement), Phase-3.2.2 (Timeout Replacement), Phase-3.2.3 (RF Frequency Replacement), Phase-3.2.4 (DB Config Replacement), Phase-3.2.5 (Buffer/Retention Replacement), Phase-3.2.6 (File Path Centralization), Phase-3.2.7 (IP Address Centralization)
- **Related**: Phase 3.3 (ESLint `no-magic-numbers` rule depends on constants being centralized first)
- **Related**: Phase 5 (Architecture decomposition benefits from centralized configuration)
- **Related**: Phase 6 (Infrastructure modernization benefits from env-var-based paths)

## Execution Tracking

| Subtask  | Description                              | Status  | Started | Completed | Verified By |
| -------- | ---------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.0.1  | Extend PORTS with 6 new ports            | PENDING | --      | --        | --          |
| 3.2.0.2  | Extend TIMEOUTS with 26 new values       | PENDING | --      | --        | --          |
| 3.2.0.3  | Add RF_BANDS constant group              | PENDING | --      | --        | --          |
| 3.2.0.4  | Add SERVICE_URLS constant group          | PENDING | --      | --        | --          |
| 3.2.0.5  | Add BUFFER_LIMITS constant group         | PENDING | --      | --        | --          |
| 3.2.0.6  | Add RETRY_LIMITS constant group          | PENDING | --      | --        | --          |
| 3.2.0.7  | Add RETENTION constant group             | PENDING | --      | --        | --          |
| 3.2.0.8  | Add DB_CONFIG constant group             | PENDING | --      | --        | --          |
| 3.2.0.9  | Add SECURITY_THRESHOLDS + BIND_ADDRESSES | PENDING | --      | --        | --          |
| 3.2.0.10 | Add MHZ_TO_HZ, GHZ_TO_MHZ helpers        | PENDING | --      | --        | --          |
| 3.2.0.11 | Typecheck verification                   | PENDING | --      | --        | --          |
