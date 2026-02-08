# Phase 5.5.7 -- High DB, Recovery, and Hardware Decomposition

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.7                                                         |
| **Phase**            | 5.5.7                                                                      |
| **Title**            | High DB/Recovery/Hardware Decomposition (HIGH-04 through HIGH-08)          |
| **Risk Level**       | LOW -- internal refactors with no public API changes                       |
| **Prerequisites**    | Phase 5.5.0 (Assessment) complete                                          |
| **Estimated Effort** | 2.5 hours                                                                  |
| **Files Touched**    | 5 existing files refactored, 1-2 new helper files created                  |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Objective

Decompose five HIGH-priority functions (100-149 lines) across database, hardware detection, error recovery, and visualization domains:

1. `prepareStatements` (116 lines) -- SQLite prepared statement bulk creation
2. `getWifiDetails` (111 lines) -- WiFi interface detail parsing
3. `checkInstalledTools` (107 lines) -- External tool installation probing
4. `registerDefaultStrategies` (106 lines) -- Error recovery strategy registration
5. `updateVisualization` (105 lines) -- Leaflet flight path rendering

---

## 2. Function Inventory

| ID      | Lines | File                                                      | Line Start | Function                    | Pattern to Apply |
| ------- | ----- | --------------------------------------------------------- | ---------- | --------------------------- | ---------------- |
| HIGH-04 | 116   | `src/lib/server/db/cleanupService.ts`                     | 93         | `prepareStatements`         | Extract-and-Name |
| HIGH-05 | 111   | `src/routes/api/hardware/details/+server.ts`              | 83         | `getWifiDetails`            | Extract-and-Name |
| HIGH-06 | 107   | `src/lib/server/toolChecker.ts`                           | 11         | `checkInstalledTools`       | Data-Driven      |
| HIGH-07 | 106   | `src/lib/services/recovery/errorRecovery.ts`              | 291        | `registerDefaultStrategies` | Data-Driven      |
| HIGH-08 | 105   | `src/lib/components/drone/FlightPathVisualization.svelte` | 60         | `updateVisualization`       | Extract-and-Name |

---

## 3. HIGH-04: `prepareStatements` (116 lines)

**Location**: `src/lib/server/db/cleanupService.ts:93`
**Current size**: 116 lines
**Root cause**: Function prepares ~20 SQLite prepared statements for different cleanup operations. Each statement is a `db.prepare()` call with a multi-line SQL string. Statements serve 4 different table groups but are all declared in one function.

### 3.1 Decomposition Strategy

Group statements by table/concern and extract to sub-functions.

### 3.2 New Functions (in same file)

| Function Name                      | Estimated Lines | Table Group                                             |
| ---------------------------------- | --------------- | ------------------------------------------------------- |
| `prepareSignalStatements(db)`      | 20-30           | rf_signals table cleanup statements                     |
| `prepareDeviceStatements(db)`      | 15-25           | Device tracking table statements                        |
| `prepareAlertStatements(db)`       | 15-20           | Alert/event table statements                            |
| `prepareMaintenanceStatements(db)` | 15-20           | VACUUM, ANALYZE, integrity check statements             |
| `prepareStatements(db)`            | 15-20           | Orchestrator: call each group, merge into statement map |

### 3.3 Post-Decomposition

Target: 15-20 lines for orchestrator.

### 3.4 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/db/cleanupService.ts
# TARGET: 0 functions >60 lines
```

### 3.5 Test Requirements

| Extracted Function             | Test Cases Required                                      | Coverage Target   |
| ------------------------------ | -------------------------------------------------------- | ----------------- |
| `prepareSignalStatements`      | Valid db instance, statement preparation success/failure | 80% line coverage |
| `prepareMaintenanceStatements` | VACUUM statement prepared, ANALYZE statement prepared    | 80% line coverage |

Test file: `tests/unit/decomposition/db/cleanupStatements.test.ts`

---

## 4. HIGH-05: `getWifiDetails` (111 lines)

**Location**: `src/routes/api/hardware/details/+server.ts:83`
**Current size**: 111 lines
**Root cause**: Function parses WiFi interface details from system commands (`iw`, `iwconfig`, `ip`). Parsing logic for each data source (interface info, capabilities, supported modes, channel list) is inline.

### 4.1 Decomposition Strategy

Extract each parser to a named function.

### 4.2 New Functions (in `src/lib/server/hardware/detection/wifiParser.ts`)

| Function Name                           | Estimated Lines | Data Source                                               |
| --------------------------------------- | --------------- | --------------------------------------------------------- |
| `parseInterfaceInfo(iwOutput: string)`  | 15-25           | Parse `iw dev` output for interface name, MAC, channel    |
| `parseCapabilities(iwOutput: string)`   | 15-20           | Parse supported standards (a/b/g/n/ac/ax)                 |
| `parseSupportedModes(iwOutput: string)` | 10-15           | Parse monitor/managed/AP modes                            |
| `parseChannelList(iwOutput: string)`    | 15-20           | Parse available channels and frequencies                  |
| `getWifiDetails(iface: string)`         | 20-30           | Orchestrator: run commands, call parsers, assemble result |

### 4.3 Post-Decomposition

Target: 20-30 lines for orchestrator.

### 4.4 Cross-Phase Notes

- **Phase 2.1.2 (Shell Injection)**: `getWifiDetails` runs `iw` and `ip` commands. The interface name parameter must be validated (alphanumeric only, max length) before being interpolated into shell commands. Verify during extraction.

### 4.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/hardware/details/+server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/hardware/detection/wifiParser.ts
# TARGET: 0 functions >60 lines in both files
```

### 4.6 Test Requirements

| Extracted Function    | Test Cases Required                                                | Coverage Target      |
| --------------------- | ------------------------------------------------------------------ | -------------------- |
| `parseInterfaceInfo`  | Valid iw output, empty output, missing fields, multiple interfaces | 90% line coverage    |
| `parseCapabilities`   | All standards present, subset only, unknown standard               | 90% line coverage    |
| `parseSupportedModes` | Monitor mode available, managed only, AP mode included             | 100% branch coverage |
| `parseChannelList`    | Valid channel list, empty list, DFS channels marked                | 90% line coverage    |

Test file: `tests/unit/decomposition/hardware/wifiParser.test.ts`

---

## 5. HIGH-06: `checkInstalledTools` (107 lines)

**Location**: `src/lib/server/toolChecker.ts:11`
**Current size**: 107 lines
**Root cause**: Function checks installation status of 15+ external tools (Kismet, tshark, hackrf_transfer, grgsm_livemon, bettercap, etc.) by probing the filesystem and running version commands. Each tool check is 5-10 lines, but aggregated they exceed the limit.

### 5.1 Decomposition Strategy

Define tool check specifications as a data-driven lookup table. Extract the check-execution logic to a generic function. Uses the **Data-Driven** pattern.

### 5.2 New Functions (in same file)

| Item                                    | Estimated Lines | Responsibility                                                       |
| --------------------------------------- | --------------- | -------------------------------------------------------------------- |
| `TOOL_CHECKS: ToolCheckSpec[]`          | 30-40           | Data table: tool name, binary path, version command, docker check    |
| `executeToolCheck(spec: ToolCheckSpec)` | 15-25           | Run one tool check: probe binary, run version command, return status |
| `checkInstalledTools()`                 | 15-20           | Map TOOL_CHECKS through executeToolCheck, collect results            |

### 5.3 Before/After Structure

**Before** (107 lines):

```typescript
async function checkInstalledTools(): Promise<ToolStatus[]> {
    const results: ToolStatus[] = [];

    // Check kismet (8 lines)
    try { await access('/usr/bin/kismet'); results.push({...}); } catch { ... }

    // Check tshark (8 lines)
    try { await access('/usr/bin/tshark'); results.push({...}); } catch { ... }

    // ... 13 more tool checks ...
}
```

**After** (15-20 lines for function, 30-40 for data table):

```typescript
const TOOL_CHECKS: ToolCheckSpec[] = [
	{ name: 'kismet', binary: '/usr/bin/kismet', versionCmd: 'kismet --version' },
	{ name: 'tshark', binary: '/usr/bin/tshark', versionCmd: 'tshark --version' }
	// ... 13 more entries ...
];

async function checkInstalledTools(): Promise<ToolStatus[]> {
	return Promise.all(TOOL_CHECKS.map(executeToolCheck));
}
```

### 5.4 Post-Decomposition

Target: 15-20 lines for `checkInstalledTools`. The `TOOL_CHECKS` array is data at module scope, not inside any function. It does not count toward function length.

### 5.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/toolChecker.ts
# TARGET: 0 functions >60 lines
```

### 5.6 Test Requirements

| Extracted Function | Test Cases Required                                               | Coverage Target      |
| ------------------ | ----------------------------------------------------------------- | -------------------- |
| `executeToolCheck` | Binary exists, binary missing, version command fails, Docker tool | 100% branch coverage |

Test file: `tests/unit/decomposition/server/toolChecker.test.ts`

---

## 6. HIGH-07: `registerDefaultStrategies` (106 lines)

**Location**: `src/lib/services/recovery/errorRecovery.ts:291`
**Current size**: 106 lines
**Root cause**: Function registers 8-10 error recovery strategies (restart service, reconnect WebSocket, clear cache, fallback to defaults, etc.) by calling `this.register()` with inline strategy objects. Each strategy definition is 8-15 lines.

### 6.1 Decomposition Strategy

Define strategies as module-level constants. The registration function iterates over the array. Uses the **Data-Driven** pattern.

### 6.2 New Structure

| Item                                              | Estimated Lines | Responsibility                                               |
| ------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[]` | 50-60           | Array of strategy objects (data, not logic)                  |
| `registerDefaultStrategies()`                     | 8-12            | `DEFAULT_RECOVERY_STRATEGIES.forEach(s => this.register(s))` |

If `DEFAULT_RECOVERY_STRATEGIES` exceeds 60 lines when including strategy handler functions, extract each handler to a named function:

| Function Name                     | Estimated Lines |
| --------------------------------- | --------------- |
| `restartServiceStrategy(ctx)`     | 10-15           |
| `reconnectWebSocketStrategy(ctx)` | 10-15           |
| `clearCacheStrategy(ctx)`         | 8-12            |
| `fallbackToDefaultsStrategy(ctx)` | 8-12            |

### 6.3 Cross-Phase Notes

- **Phase 5.5.10**: `attemptRecovery` (75 lines) in the same file is a STANDARD-priority function. Process both functions in the same commit to avoid intermediate states.

### 6.4 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/recovery/errorRecovery.ts
# TARGET: 0 functions >60 lines
```

### 6.5 Test Requirements

| Extracted Function           | Test Cases Required                                   | Coverage Target      |
| ---------------------------- | ----------------------------------------------------- | -------------------- |
| `restartServiceStrategy`     | Service restarts successfully, restart fails, timeout | 100% branch coverage |
| `reconnectWebSocketStrategy` | Connection restored, connection fails, max retries    | 100% branch coverage |

Test file: `tests/unit/decomposition/recovery/strategies.test.ts`

---

## 7. HIGH-08: `updateVisualization` (105 lines)

**Location**: `src/lib/components/drone/FlightPathVisualization.svelte:60`
**Current size**: 105 lines
**Root cause**: Leaflet polyline/marker update function that handles: clearing old markers, calculating path segments from flight data, rendering polylines with color gradients based on altitude/speed, placing waypoint markers, and updating the viewport to fit the path bounds.

### 7.1 Decomposition Strategy

Extract rendering phases. Uses the **Extract-and-Name** pattern.

### 7.2 New Functions (in same file or `src/lib/components/drone/flightPathRenderer.ts`)

| Function Name                                             | Estimated Lines | Responsibility                                                |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `clearFlightLayers(layerGroup: L.LayerGroup)`             | 5-10            | Remove all existing path/marker layers                        |
| `buildPathSegments(points: FlightPoint[])`                | 15-25           | Convert flight points to colored polyline segments            |
| `renderFlightPath(map: L.Map, segments: PathSegment[])`   | 15-25           | Draw polyline segments on map                                 |
| `placeWaypointMarkers(map: L.Map, waypoints: Waypoint[])` | 15-20           | Place numbered waypoint markers                               |
| `updateVisualization(map, flightData)`                    | 15-20           | Orchestrator: clear -> build -> render -> place -> fit bounds |

### 7.3 Post-Decomposition

Target: 15-20 lines for orchestrator.

### 7.4 Cross-Phase Notes

- **Phase 5.5.11**: `addFlightMarkers` (73 lines) in the same file is a STANDARD-priority function. Process both functions in the same commit.

### 7.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/drone/FlightPathVisualization.svelte
# TARGET: 0 functions >60 lines
```

### 7.6 Test Requirements

| Extracted Function  | Test Cases Required                                             | Coverage Target   |
| ------------------- | --------------------------------------------------------------- | ----------------- |
| `buildPathSegments` | Linear path, circular path, single point, altitude-colored path | 90% line coverage |
| `clearFlightLayers` | Non-empty group, empty group                                    | 80% line coverage |

Test file: `tests/unit/decomposition/drone/flightPathRenderer.test.ts`

---

## 8. Execution Order

1. `prepareStatements` (HIGH-04) -- database, independent
2. `checkInstalledTools` (HIGH-06) -- server, independent
3. `registerDefaultStrategies` (HIGH-07) + `attemptRecovery` (same file) -- services
4. `getWifiDetails` (HIGH-05) -- routes/server, independent
5. `updateVisualization` (HIGH-08) + `addFlightMarkers` (same file) -- components
6. Run full verification suite

**Commit strategy**: One commit per file (multi-function files in single commit).

```
refactor(phase-5.5): decompose prepareStatements into 4 table groups (116 -> 18 lines)
refactor(phase-5.5): convert checkInstalledTools to data-driven pattern (107 -> 15 lines)
refactor(phase-5.5): decompose 2 functions in errorRecovery.ts (106+75 -> <60 each)
refactor(phase-5.5): decompose getWifiDetails, extract wifiParser.ts (111 -> 25 lines)
refactor(phase-5.5): decompose 2 functions in FlightPathVisualization.svelte (105+73 -> <60 each)
```

---

**END OF DOCUMENT**
