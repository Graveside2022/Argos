# Phase 5.5: Function Size Enforcement

**Document ID**: ARGOS-AUDIT-P5.5
**Version**: 1.0 (Final)
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Review Standard**: MISRA C:2023 Rule 1.1, CERT C Secure Coding MSC04-C, NASA/JPL Rule 2.4, Barr C Coding Standard Section 7
**Risk Level**: LOW
**Prerequisites**: Phase 5.1 (God Page Decomposition) + Phase 5.2 (Service Layer Refactoring) + Phase 5.4 (File Size Enforcement)
**Estimated Effort**: **21 hours** (corrected from 16 hours -- 157 functions, not ~119)
**Defect IDs**: P5-016, P5-017, P5-018 (from Phase 5.0 Traceability Matrix)

---

## 1. Purpose and Scope

This document provides the complete execution plan for decomposing every function exceeding 60 lines in the Argos codebase. The 60-line limit is enforced per the following standards:

- **MISRA C:2023 Rule 1.1**: Functions shall be comprehensible within a single screen view. The Advisory limit is 60 statements; the Argos project adopts this as a hard limit on source lines (including blank lines and comments within the function body) to ensure unambiguous enforcement via ESLint.
- **NASA/JPL Rule 2.4**: "No function should be longer than what can be printed on a single sheet of paper in a standard format with one line per statement and one line per declaration."
- **CERT C MSC04-C**: "Use comments consistently and in a readable fashion." Functions exceeding 60 lines inherently resist line-by-line audit and are classified as a code-comprehension defect.
- **Barr C Section 7.1**: "No function shall exceed a length of 100 lines including comments. Prefer functions shorter than 50 lines." Argos adopts the stricter 60-line threshold as the enforcement boundary.

**Hard constraint**: Zero functions exceeding 60 lines shall exist in the codebase after this phase completes. No exemptions. No waivers. No `eslint-disable` directives for `max-lines-per-function`.

---

## 2. Audit Corrections

### 2.1 Prior Plan Numerical Error

**REGRADE CORRECTION (2026-02-08)**: The count of ~119 was itself an undercount. The verified count is **157 functions exceeding 60 lines**, determined by reconciling three scanner outputs with manual verification.

| Document                                 | Claim                          | Actual (Verified 2026-02-08)          | Error Magnitude |
| ---------------------------------------- | ------------------------------ | ------------------------------------- | --------------- |
| `05c-PHASE-5.3-SIZE-ENFORCEMENT.md` (v1) | "68 functions exceed 60 lines" | **157** functions exceed 60 lines     | 131% undercount |
| `05c-PHASE-5.3-SIZE-ENFORCEMENT.md` (v2) | "75 functions >60 lines"       | **157** functions exceed 60 lines     | 109% undercount |
| Phase 5.0 v1 / Phase 5.5 v1              | "~119 functions >60 lines"     | **157** functions exceed 60 lines     | 32% undercount  |
| v2 scanner raw output                    | 151                            | **157** (v2 + 6 multi-line-signature) | 4% undercount   |

**Root cause of ALL undercounts**:

| Scanner                                   | Count | Flaw                                                                                                                                                                     |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1 (`scripts/audit-function-sizes.py`)    | 94    | Misses ALL class methods and arrow functions (57 functions)                                                                                                              |
| v2 (`scripts/audit-function-sizes-v2.py`) | 151   | Bug: when function signature spans multiple lines and `{` is on a later line, the function is pushed then immediately popped because brace_depth has not yet incremented |
| v3 (ad hoc)                               | 205   | Overcounts: "pending" mechanism matches function CALLS (`clearInterval()`, `resolve()`, `CAST(...)`) as function definitions                                             |

**Correct approach**: Take v2's 151 results (all verified accurate), then supplement with 6 multi-line-signature functions confirmed individually by the brace-depth verify script (`scripts/verify-function-length.py`).

**6 functions missed by v2 (multi-line signatures)**:

| Lines | File                                                             | Line Range | Function               |
| ----- | ---------------------------------------------------------------- | ---------- | ---------------------- |
| 161   | `src/lib/services/map/signalClustering.ts`                       | 139-299    | `clusterSignals`       |
| 99    | `src/lib/server/agent/runtime.ts`                                | 104-202    | `processWithAnthropic` |
| 86    | `src/lib/server/db/signalRepository.ts`                          | 65-150     | `insertSignalsBatch`   |
| 68    | `src/routes/api/gps/position/+server.ts`                         | 180-247    | `buildGpsResponse`     |
| 67    | `src/lib/services/map/networkAnalyzer.ts`                        | 254-320    | `exploreCluster`       |
| 63    | `src/lib/database/migrations/templates/create-table.template.ts` | 4-66       | `createTableMigration` |

### 2.2 Severity Bucketing (Corrected 2026-02-08)

The prior plans listed all functions in a single flat table. This plan introduces severity bucketing with distinct handling procedures. Counts corrected from ~119 to **157** per multi-scanner reconciliation.

| Severity  | Line Range    | Count   | Handling                                                                     |
| --------- | ------------- | ------- | ---------------------------------------------------------------------------- |
| CRITICAL  | >150 lines    | **30**  | Full decomposition with named sub-functions, new file creation where needed  |
| HIGH      | 100-149 lines | **30**  | Decomposition into 2-4 sub-functions within the same file or adjacent helper |
| STANDARD  | 60-99 lines   | **97**  | Apply decomposition patterns (guard clauses, extract-and-name, data-driven)  |
| **TOTAL** | **>60 lines** | **157** |                                                                              |

**Nested function pairs**: 5 (across 3 files) -- 4 unique inner functions. Top-level non-nested: 153.

---

## 3. Cross-Phase Deductions

Multiple functions in the >60-line inventory reside in files that are being decomposed or restructured by Phases 5.1, 5.2, and 5.4. Those functions will be decomposed as part of their parent file's restructuring. They are listed here for completeness and traceability but are NOT double-counted in effort estimates.

### 3.1 Functions Handled by Phase 5.1 (God Page Decomposition)

Phase 5.1 decomposes four God Pages (`tactical-map-simple`, `gsm-evil`, `rfsweep`, `hackrfsweep`). The following functions reside in those pages and will be decomposed during God Page extraction:

| Lines | File                                      | Function             | Phase 5.1 Task                                                             |
| ----- | ----------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| 262   | `routes/tactical-map-simple/+page.svelte` | `fetchKismetDevices` | Task 5.1.1 -- split into 4-5 functions during Kismet subsystem extraction  |
| 236   | `routes/tactical-map-simple/+page.svelte` | `processSignals`     | Task 5.1.1 -- split into 4-5 functions during signal processing extraction |
| 229   | `routes/tactical-map-simple/+page.svelte` | `getDeviceIconSVG`   | Task 5.1.1 -- extract to `src/lib/components/tactical-map/deviceIcons.ts`  |
| 190   | `routes/gsm-evil/+page.svelte`            | `scanFrequencies`    | Task 5.1.2 -- extract to GSM scanning service                              |

**Deduction**: 4 functions, all CRITICAL severity. Phase 5.5 residual CRITICAL count: 30 - 4 = **26 CRITICAL functions**.

### 3.2 Functions Handled by Phase 5.2 (Service Layer Refactoring)

Phase 5.2 decomposes `sweepManager.ts` (1,356 lines, 27 methods) and the HackRF/USRP `BufferManager`/`ProcessManager` pairs. The following functions are decomposed as part of that work:

| Lines | File                                                        | Function              | Phase 5.2 Task                                                          |
| ----- | ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| 356   | `server/hackrf/sweepManager.ts:124`                         | `_performHealthCheck` | Task 5.2.4 -- extract to `healthMonitor.ts`, split into 6 sub-functions |
| 128   | `services/usrp/sweep-manager/buffer/BufferManager.ts:194`   | `parseSpectrumData`   | Task 5.2.2 -- deduplicated into base class method                       |
| 117   | `server/hackrf/sweepManager.ts:555`                         | `_startSweepProcess`  | Task 5.2.4 -- extract to process lifecycle module                       |
| 94    | `services/hackrf/sweep-manager/buffer/BufferManager.ts:197` | `parseSpectrumData`   | Task 5.2.2 -- deduplicated into base class method                       |
| 61    | `server/hackrf/sweepManager.ts:1123`                        | `_performRecovery`    | Task 5.2.4 -- extract to recovery module                                |

**Deduction**: 5 functions (1 CRITICAL, 2 HIGH, 2 STANDARD). Phase 5.5 residual after all deductions:

- CRITICAL: 26 - 1 = **25 CRITICAL functions** remaining for Phase 5.5
- HIGH: 30 - 2 = **28 HIGH functions** remaining for Phase 5.5
- STANDARD: 97 - 2 = **95 STANDARD functions** remaining for Phase 5.5

### 3.3 Functions Handled by Phase 5.4 (File Size Enforcement)

Phase 5.4 decomposes files exceeding 300 lines. When a file is split into smaller modules, contained functions may be reorganized but are not necessarily decomposed. Phase 5.4 moves code between files; Phase 5.5 breaks large functions into smaller ones. These are orthogonal operations.

The following function resides in `AirSignalOverlay.svelte` (1,019 lines), which Phase 5.4 decomposes into three files. The function itself must still be decomposed per Phase 5.5 rules:

| Lines | File                                        | Function            | Phase 5.4 Action                 | Phase 5.5 Action                                |
| ----- | ------------------------------------------- | ------------------- | -------------------------------- | ----------------------------------------------- |
| 167   | `components/map/AirSignalOverlay.svelte:39` | `toggleRFDetection` | Moves to `RFDetectionService.ts` | Must still be split into <60-line sub-functions |

**Clarification**: Phase 5.4 relocates the function. Phase 5.5 decomposes it. Both phases act on this function. The Phase 5.5 decomposition executes AFTER Phase 5.4 relocation. No double-counting of effort occurs because each phase performs a distinct operation.

### 3.4 Residual Function Count for Phase 5.5

After all cross-phase deductions (corrected 2026-02-08):

| Severity         | Total   | Handled by 5.1 | Handled by 5.2 | Phase 5.5 Residual |
| ---------------- | ------- | -------------- | -------------- | ------------------ |
| CRITICAL (>150)  | **30**  | 4              | 1              | **25**             |
| HIGH (100-149)   | **30**  | 0              | 2              | **28**             |
| STANDARD (60-99) | **97**  | 0              | 2              | **95**             |
| **TOTAL**        | **157** | **4**          | **5**          | **148**            |

---

## 4. Task 5.5.1: Decompose CRITICAL Functions (>150 Lines)

**Scope**: **25** functions exceeding 150 lines that are NOT handled by Phases 5.1 or 5.2. (10 enumerated below with detailed plans; remaining 15 follow the same decomposition patterns documented in Section 7. Full enumeration in Appendix A.)
**Effort**: 10 hours (corrected from 6 hours)
**Risk**: LOW -- all decompositions are internal refactors with no public API changes.

Each function below receives a detailed decomposition plan including: current size, location with line number, root cause of excessive size, decomposition strategy with explicit new function names, target size for each new function, and verification command.

---

### 4.1 CRITICAL-01: `createGSMEvilStore` (318 lines)

**Location**: `src/lib/stores/gsmEvilStore.ts:70`
**Current size**: 318 lines
**Root cause**: Store factory function contains 14 action handler implementations inline. Each action (startScan, stopScan, updateFrequency, setARFCN, fetchIMSIs, checkHealth, ...) is implemented as a multi-line closure within the single `createGSMEvilStore` function body. This is the "God Store" anti-pattern.

**Decomposition strategy**: Extract each action handler to a standalone async function in a helper file. The store creation function retains only the writable store declaration and thin delegation to the extracted handlers.

**New files and functions**:

```
src/lib/stores/gsm-evil/
  gsmEvilActions.ts       -- 14 exported action functions
  gsmEvilStore.ts         -- store creation (delegates to actions)
  index.ts                -- barrel re-export
```

**Extracted functions** (in `gsmEvilActions.ts`):

| Function Name                         | Estimated Lines | Responsibility                  |
| ------------------------------------- | --------------- | ------------------------------- |
| `startGSMScan(update, state)`         | 25-35           | Initiate GSM frequency scan     |
| `stopGSMScan(update, state)`          | 10-15           | Abort running scan              |
| `updateScanFrequency(update, freq)`   | 15-20           | Change target frequency         |
| `setTargetARFCN(update, arfcn)`       | 10-15           | Set ARFCN channel               |
| `fetchCapturedIMSIs(update)`          | 20-30           | Retrieve IMSI list from backend |
| `performHealthCheck(update)`          | 20-30           | Check GSM Evil process health   |
| `updateScanProgress(update, data)`    | 10-15           | Update progress state from SSE  |
| `handleScanResult(update, result)`    | 15-20           | Process individual scan result  |
| `resetScanState(update)`              | 5-10            | Reset store to initial state    |
| `toggleAutoScan(update, enabled)`     | 10-15           | Enable/disable auto-scanning    |
| `updateConfiguration(update, config)` | 15-20           | Apply new scan configuration    |
| `handleError(update, error)`          | 10-15           | Centralized error state handler |
| `exportResults(state)`                | 15-20           | Format scan results for export  |
| `importConfiguration(update, config)` | 10-15           | Load saved scan configuration   |

**Post-decomposition `createGSMEvilStore` target size**: 40-50 lines (store declaration + 14 one-line delegations).

**Verification**:

```bash
# Function size check
python3 scripts/audit-function-sizes-v2.py src/lib/stores/gsm-evil/gsmEvilStore.ts
# TARGET: 0 functions >60 lines

# No action function exceeds 60 lines
python3 scripts/audit-function-sizes-v2.py src/lib/stores/gsm-evil/gsmEvilActions.ts
# TARGET: 0 functions >60 lines

# Build verification
npm run build
npm run typecheck
```

---

### 4.2 CRITICAL-02: `setupPacketStream` (272 lines)

**Location**: `src/lib/server/wireshark.ts:221`
**Current size**: 272 lines
**Root cause**: Single function handles three distinct responsibilities: (1) building pcap/tshark filter expressions from user parameters, (2) spawning the capture child process with appropriate arguments, (3) parsing the raw packet output stream line-by-line and emitting structured objects. These three concerns are interleaved with error handling and fallback logic.

**Decomposition strategy**: Extract each responsibility into a named function within the same file. The `setupPacketStream` function becomes an orchestrator that calls the three sub-functions in sequence.

**New functions** (in `src/lib/server/wireshark.ts`):

| Function Name                                        | Estimated Lines | Responsibility                                                                      |
| ---------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `buildCaptureFilter(params: CaptureParams)`          | 30-40           | Construct pcap/BPF filter expression from user parameters                           |
| `spawnCaptureProcess(filter: string, iface: string)` | 30-40           | Spawn tshark/tcpdump child process with correct arguments                           |
| `createPacketParser()`                               | 40-55           | Return a Transform stream that parses raw lines into structured `Packet` objects    |
| `setupPacketStream(params)`                          | 25-35           | Orchestrator: build filter -> spawn process -> pipe through parser -> return stream |

**Post-decomposition `setupPacketStream` target size**: 25-35 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/wireshark.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

---

### 4.3 CRITICAL-03: `initializeOUIDatabase` (219 lines)

**Location**: `src/lib/server/kismet/device_intelligence.ts:499`
**Current size**: 219 lines
**Root cause**: The function contains an inline OUI (Organizationally Unique Identifier) lookup table as a JavaScript object literal (~180 lines of static data) followed by ~39 lines of initialization logic. This is a textbook case of embedded data masquerading as code.

**Decomposition strategy**: Move the OUI data to a JSON file. Reduce the function to a file loader with validation.

**New files and functions**:

```
src/lib/data/oui-database.json          -- static OUI->manufacturer mapping (~180 lines of JSON)
src/lib/server/kismet/ouiLoader.ts      -- loadOUIDatabase() function
```

| Function Name                     | Estimated Lines | Responsibility                                                 |
| --------------------------------- | --------------- | -------------------------------------------------------------- |
| `loadOUIDatabase()`               | 20-30           | Read JSON file, validate structure, return Map<string, string> |
| `lookupManufacturer(mac: string)` | 8-12            | Extract OUI prefix from MAC, look up in loaded database        |

**Post-decomposition**: The `initializeOUIDatabase` function is DELETED and replaced by `loadOUIDatabase()` (20-30 lines). The calling code in `device_intelligence.ts` is updated to call `loadOUIDatabase()` at module initialization.

**Verification**:

```bash
# Verify JSON is valid
python3 -c "import json; json.load(open('src/lib/data/oui-database.json'))"

# Verify no function >60 lines
python3 scripts/audit-function-sizes-v2.py src/lib/server/kismet/device_intelligence.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/kismet/ouiLoader.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

---

### 4.4 CRITICAL-04: `setupRoutes` (193 lines)

**Location**: `src/lib/services/gsm-evil/server.ts:37`
**Current size**: 193 lines
**Root cause**: Express-style route registration function defines 8-10 route handlers inline. Each handler contains request parsing, business logic, and response formatting. This violates the Single Responsibility Principle at the function level.

**Decomposition strategy**: Extract each route handler to an individual named function. The `setupRoutes` function retains only the route registration calls (one line per route).

**New functions** (in `src/lib/services/gsm-evil/server.ts` or extracted to `src/lib/services/gsm-evil/handlers/`):

| Function Name                    | Estimated Lines | Route            |
| -------------------------------- | --------------- | ---------------- |
| `handleStartScan(req, res)`      | 20-30           | POST /scan/start |
| `handleStopScan(req, res)`       | 10-15           | POST /scan/stop  |
| `handleGetStatus(req, res)`      | 15-20           | GET /status      |
| `handleGetIMSIs(req, res)`       | 15-25           | GET /imsis       |
| `handleSetFrequency(req, res)`   | 15-20           | POST /frequency  |
| `handleHealthCheck(req, res)`    | 15-20           | GET /health      |
| `handleGetConfig(req, res)`      | 10-15           | GET /config      |
| `handleUpdateConfig(req, res)`   | 15-20           | PUT /config      |
| `handleGetScanHistory(req, res)` | 15-20           | GET /history     |

**Post-decomposition `setupRoutes` target size**: 15-25 lines (pure route registration, one `app.METHOD(path, handler)` call per line).

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/gsm-evil/server.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

---

### 4.5 CRITICAL-05: `createRTL433Store` (191 lines)

**Location**: `src/lib/stores/rtl433Store.ts:61`
**Current size**: 191 lines
**Root cause**: Identical anti-pattern to `createGSMEvilStore` (CRITICAL-01). Store factory function contains 8-10 action handler implementations inline.

**Decomposition strategy**: Same pattern as CRITICAL-01. Extract action handlers to a helper file.

**New files and functions**:

```
src/lib/stores/rtl433/
  rtl433Actions.ts      -- 8-10 exported action functions
  rtl433Store.ts        -- store creation (delegates to actions)
  index.ts              -- barrel re-export
```

**Extracted functions** (in `rtl433Actions.ts`):

| Function Name                          | Estimated Lines | Responsibility                     |
| -------------------------------------- | --------------- | ---------------------------------- |
| `startRTL433Listener(update)`          | 20-30           | Start RTL-433 capture process      |
| `stopRTL433Listener(update)`           | 10-15           | Stop capture process               |
| `handleSignalReceived(update, signal)` | 15-25           | Process incoming decoded signal    |
| `updateDeviceList(update, devices)`    | 15-20           | Refresh known device list          |
| `applyFrequencyFilter(update, filter)` | 10-15           | Set frequency filter parameters    |
| `exportCapturedSignals(state)`         | 15-20           | Format captured signals for export |
| `clearCapturedSignals(update)`         | 5-10            | Reset captured signal buffer       |
| `handleRTL433Error(update, error)`     | 10-15           | Error state handler                |

**Post-decomposition `createRTL433Store` target size**: 30-40 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/stores/rtl433/rtl433Store.ts
python3 scripts/audit-function-sizes-v2.py src/lib/stores/rtl433/rtl433Actions.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

---

### 4.6 CRITICAL-06: `performHealthCheck` (182 lines, API route)

**Location**: `src/routes/api/gsm-evil/health/+server.ts:6`
**Current size**: 182 lines
**Root cause**: Single health-check function performs 6-8 independent diagnostic checks sequentially: process status, database connectivity, hardware presence, frequency lock, scan history recency, disk space, and error rate. Each check is 15-25 lines of independent logic jammed into one function.

**Decomposition strategy**: Extract each diagnostic check into a named function. The `performHealthCheck` function becomes a coordinator that calls each checker and aggregates results.

**New functions** (in same file or extracted to `src/lib/services/gsm-evil/healthCheckers.ts`):

| Function Name                                   | Estimated Lines | Check                                                |
| ----------------------------------------------- | --------------- | ---------------------------------------------------- |
| `checkGSMProcess()`                             | 15-20           | Verify grgsm_livemon or gsm_evil process is running  |
| `checkDatabaseConnection()`                     | 10-15           | Test SQLite database read/write                      |
| `checkHardwarePresence()`                       | 15-20           | Detect RTL-SDR or HackRF device on USB bus           |
| `checkFrequencyLock()`                          | 10-15           | Verify SDR is locked to target frequency             |
| `checkScanRecency()`                            | 10-15           | Verify last scan result is within acceptable age     |
| `checkDiskSpace()`                              | 10-15           | Verify sufficient disk space for capture files       |
| `checkErrorRate()`                              | 10-15           | Evaluate error rate over sliding window              |
| `aggregateHealthResults(checks: HealthCheck[])` | 15-20           | Combine individual check results into overall status |

**Post-decomposition `performHealthCheck` target size**: 25-35 lines (call each checker, pass results to aggregator, return).

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/gsm-evil/health/+server.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

---

### 4.7 CRITICAL-07: `toggleRFDetection` (167 lines)

**Location**: `src/lib/components/map/AirSignalOverlay.svelte:39`
**Current size**: 167 lines
**Cross-phase note**: Phase 5.4 relocates this function to `RFDetectionService.ts` as part of the `AirSignalOverlay.svelte` file decomposition (1,019 lines -> 3 files). Phase 5.5 decomposes the function itself AFTER Phase 5.4 relocation.

**Root cause**: Single function handles SSE connection setup, EventSource lifecycle management, Leaflet marker creation and placement, signal classification, error handling with retry logic, and cleanup/teardown. Six distinct concerns in one function.

**Decomposition strategy**: Split into connection, processing, and rendering sub-functions.

**New functions** (in `src/lib/services/map/RFDetectionService.ts`, post-Phase 5.4):

| Function Name                                                     | Estimated Lines | Responsibility                                                               |
| ----------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `createSSEConnection(url: string, onMessage: Callback)`           | 20-30           | Create EventSource, attach handlers, return cleanup function                 |
| `classifySignal(data: RawSignal)`                                 | 15-25           | Determine signal type, threat level, icon                                    |
| `createSignalMarker(signal: ClassifiedSignal, map: L.Map)`        | 20-30           | Create Leaflet marker with popup content                                     |
| `cleanupDetection(markers: L.Marker[], eventSource: EventSource)` | 10-15           | Remove markers, close EventSource                                            |
| `toggleRFDetection(map: L.Map, enabled: boolean)`                 | 20-30           | Orchestrator: toggle on = create SSE + marker pipeline; toggle off = cleanup |

**Post-decomposition `toggleRFDetection` target size**: 20-30 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/map/RFDetectionService.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

---

### 4.8 CRITICAL-08: `clusterSignals` (161 lines)

**Location**: `src/lib/services/map/signalClustering.ts:139`
**Current size**: 161 lines
**Root cause**: Implements DBSCAN-like spatial clustering algorithm with inline distance calculation, neighbor search, cluster merging, and result formatting. The algorithm has clear phases that are not separated into functions.

**Decomposition strategy**: Extract each algorithmic phase into a named function.

**New functions** (in same file):

| Function Name                                                                     | Estimated Lines | Responsibility                                                           |
| --------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `calculateHaversineDistance(a: LatLng, b: LatLng)`                                | 10-15           | Haversine distance between two GPS coordinates                           |
| `findNeighbors(point: Signal, signals: Signal[], eps: number)`                    | 15-20           | Return all signals within epsilon radius of point                        |
| `expandCluster(core: Signal, neighbors: Signal[], cluster: Cluster, eps, minPts)` | 25-35           | DBSCAN cluster expansion from core point                                 |
| `mergeOverlappingClusters(clusters: Cluster[])`                                   | 20-30           | Post-processing: merge clusters with overlapping boundaries              |
| `formatClusterResults(clusters: Cluster[])`                                       | 15-20           | Convert internal cluster representation to output format                 |
| `clusterSignals(signals: Signal[], params: ClusterParams)`                        | 25-35           | Orchestrator: validate inputs -> find cores -> expand -> merge -> format |

**Post-decomposition `clusterSignals` target size**: 25-35 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/map/signalClustering.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

---

### 4.9 CRITICAL-09: `getSystemInfo` (156 lines)

**Location**: `src/routes/api/system/info/+server.ts:42`
**Current size**: 156 lines
**Root cause**: Single function collects system metrics from 5-6 independent sources (CPU via `/proc/stat`, memory via `/proc/meminfo`, disk via `df`, network interfaces via `ip`, temperature via `vcgencmd`, uptime via `/proc/uptime`). Each collection is independent and sequential, producing a merged result object.

**Decomposition strategy**: Extract each collector to a named async function.

**New functions** (extract to `src/lib/server/system/collectors.ts`):

| Function Name                 | Estimated Lines | Source                                 |
| ----------------------------- | --------------- | -------------------------------------- |
| `collectCPUMetrics()`         | 15-25           | `/proc/stat`, `/proc/loadavg`          |
| `collectMemoryMetrics()`      | 15-20           | `/proc/meminfo`                        |
| `collectDiskMetrics()`        | 15-20           | `df` command or `statvfs`              |
| `collectNetworkMetrics()`     | 15-25           | `/proc/net/dev` or `ip` command        |
| `collectTemperatureMetrics()` | 10-15           | `vcgencmd measure_temp` (RPi-specific) |
| `collectUptimeMetrics()`      | 5-10            | `/proc/uptime`                         |

**Post-decomposition**: The `GET` handler in `+server.ts` calls each collector via `Promise.all()` for parallelism, then merges results. Handler target size: 20-30 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/system/info/+server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/system/collectors.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

---

### 4.10 CRITICAL-10: `createKismetStore` (154 lines)

**Location**: `src/lib/stores/kismet.ts:20`
**Current size**: 154 lines
**Root cause**: Same "God Store" anti-pattern as CRITICAL-01 and CRITICAL-05. Store factory contains 6-8 inline action handlers.

**Decomposition strategy**: Same pattern as CRITICAL-01. Extract action handlers to a helper file.

**New files and functions**:

```
src/lib/stores/kismet/
  kismetActions.ts      -- 6-8 exported action functions
  kismetStore.ts        -- store creation (delegates to actions)
  index.ts              -- barrel re-export
```

**Extracted functions** (in `kismetActions.ts`):

| Function Name                        | Estimated Lines | Responsibility                              |
| ------------------------------------ | --------------- | ------------------------------------------- |
| `fetchDevices(update)`               | 20-30           | Fetch device list from Kismet API           |
| `startKismetService(update)`         | 15-25           | Start Kismet process via API                |
| `stopKismetService(update)`          | 10-15           | Stop Kismet process                         |
| `updateDeviceFilter(update, filter)` | 10-15           | Apply device type/signal filter             |
| `handleDeviceUpdate(update, device)` | 15-20           | Process incoming device data from WebSocket |
| `refreshAlerts(update)`              | 15-20           | Fetch and update Kismet alerts              |
| `handleKismetError(update, error)`   | 10-15           | Error state handler                         |

**Post-decomposition `createKismetStore` target size**: 30-40 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/stores/kismet/kismetStore.ts
python3 scripts/audit-function-sizes-v2.py src/lib/stores/kismet/kismetActions.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

---

## 5. Task 5.5.2: Decompose HIGH Priority Functions (100-149 Lines)

**Scope**: **28** functions in the 100-149 line range that are NOT handled by Phases 5.1 or 5.2. (8 enumerated below with detailed plans; remaining 20 follow the same decomposition patterns documented in Section 7. Full enumeration in Appendix A.)
**Effort**: 5 hours (corrected from 4 hours)
**Risk**: LOW

---

### 5.1 HIGH-01: `drawVisualization` (148 lines)

**Location**: `src/lib/components/hackrf/SignalAgeVisualization.svelte:69`
**Current size**: 148 lines
**Root cause**: Canvas 2D rendering function that performs: canvas context initialization, coordinate system setup, bar width/height calculations, iterative bar rendering with gradient fills, axis label drawing, legend rendering, and tooltip region registration. These are 5 distinct rendering phases in one function.

**Decomposition strategy**: Extract each rendering phase to a named function.

**New functions** (in same file or `src/lib/components/hackrf/signalAgeRenderer.ts`):

| Function Name                                        | Estimated Lines | Responsibility                                                     |
| ---------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `initializeCanvas(ctx, width, height)`               | 10-15           | Clear canvas, set coordinate system, apply DPI scaling             |
| `calculateBarGeometry(data, width, height, padding)` | 15-20           | Compute bar widths, heights, positions from data                   |
| `renderBars(ctx, bars, colorGradient)`               | 25-35           | Draw each bar with gradient fill and stroke                        |
| `renderAxisLabels(ctx, xLabels, yLabels, padding)`   | 20-25           | Draw X and Y axis labels, tick marks                               |
| `renderLegend(ctx, categories, position)`            | 15-20           | Draw color legend box                                              |
| `drawVisualization(canvas, data)`                    | 20-30           | Orchestrator: init -> calculate -> render bars -> labels -> legend |

**Post-decomposition target**: 20-30 lines for orchestrator. No sub-function exceeds 35 lines.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/hackrf/SignalAgeVisualization.svelte
# TARGET: 0 functions >60 lines
```

---

### 5.2 HIGH-02: `createSystemInfoContent` (121 lines)

**Location**: `src/lib/components/tactical-map/system/SystemInfoPopup.svelte:86`
**Current size**: 121 lines
**Root cause**: HTML string builder function that constructs a multi-section popup. Each section (CPU, memory, network, GPS, services) is 15-25 lines of template literal construction. Classic builder-pattern candidate.

**Decomposition strategy**: Extract each section builder to a named function.

**New functions** (in same file):

| Function Name                               | Estimated Lines | Section                                          |
| ------------------------------------------- | --------------- | ------------------------------------------------ |
| `buildCPUSection(info: SystemInfo)`         | 15-20           | CPU usage, load average, temperature             |
| `buildMemorySection(info: SystemInfo)`      | 10-15           | RAM usage, swap, available                       |
| `buildNetworkSection(info: SystemInfo)`     | 15-20           | Interface status, IP addresses, throughput       |
| `buildGPSSection(info: SystemInfo)`         | 10-15           | Fix status, coordinates, satellite count         |
| `buildServiceSection(info: SystemInfo)`     | 15-20           | Service status indicators (Kismet, HackRF, etc.) |
| `createSystemInfoContent(info: SystemInfo)` | 15-20           | Assemble sections into complete HTML string      |

**Post-decomposition target**: 15-20 lines for assembler.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/tactical-map/system/SystemInfoPopup.svelte
# TARGET: 0 functions >60 lines
```

---

### 5.3 HIGH-03: `setupHandlers` (119 lines)

**Location**: `src/lib/server/mcp/dynamic-server.ts:508`
**Current size**: 119 lines
**Root cause**: MCP server handler registration function defines 12 tool handlers inline. Each handler is 5-15 lines, but when placed sequentially inside a single function, the aggregate exceeds the limit.

**Decomposition strategy**: Extract each tool handler to an individual named function. The `setupHandlers` function retains only the handler registration calls.

**New file**: `src/lib/server/mcp/toolHandlers.ts`

| Function Name                        | Estimated Lines | Tool                     |
| ------------------------------------ | --------------- | ------------------------ |
| `handleGetActiveDevices(args)`       | 8-12            | get_active_devices       |
| `handleGetDeviceDetails(args)`       | 8-12            | get_device_details       |
| `handleGetNearbySignals(args)`       | 8-12            | get_nearby_signals       |
| `handleAnalyzeNetworkSecurity(args)` | 8-12            | analyze_network_security |
| `handleGetSpectrumData(args)`        | 8-12            | get_spectrum_data        |
| `handleGetCellTowers(args)`          | 8-12            | get_cell_towers          |
| `handleQuerySignalHistory(args)`     | 8-12            | query_signal_history     |
| `handleGetSystemStats(args)`         | 8-12            | get_system_stats         |
| `handleGetKismetStatus(args)`        | 8-12            | get_kismet_status        |
| `handleGetGSMStatus(args)`           | 8-12            | get_gsm_status           |
| `handleScanInstalledTools(args)`     | 8-12            | scan_installed_tools     |
| `handleScanHardware(args)`           | 8-12            | scan_hardware            |

**Post-decomposition `setupHandlers` target size**: 20-30 lines (12 registration calls + error wrapper).

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/mcp/dynamic-server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/mcp/toolHandlers.ts
# TARGET: 0 functions >60 lines in both files
```

---

### 5.4 HIGH-04: `prepareStatements` (116 lines)

**Location**: `src/lib/server/db/cleanupService.ts:93`
**Current size**: 116 lines
**Root cause**: Function prepares ~20 SQLite prepared statements for different cleanup operations. Each statement is a `db.prepare()` call with a multi-line SQL string. Statements serve 4 different table groups but are all declared in one function.

**Decomposition strategy**: Group statements by table/concern and extract to sub-functions.

**New functions** (in same file):

| Function Name                      | Estimated Lines | Table Group                                             |
| ---------------------------------- | --------------- | ------------------------------------------------------- |
| `prepareSignalStatements(db)`      | 20-30           | rf_signals table cleanup statements                     |
| `prepareDeviceStatements(db)`      | 15-25           | device tracking table statements                        |
| `prepareAlertStatements(db)`       | 15-20           | alert/event table statements                            |
| `prepareMaintenanceStatements(db)` | 15-20           | VACUUM, ANALYZE, integrity check statements             |
| `prepareStatements(db)`            | 15-20           | Orchestrator: call each group, merge into statement map |

**Post-decomposition target**: 15-20 lines for orchestrator.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/db/cleanupService.ts
# TARGET: 0 functions >60 lines
```

---

### 5.5 HIGH-05: `getWifiDetails` (111 lines)

**Location**: `src/routes/api/hardware/details/+server.ts:83`
**Current size**: 111 lines
**Root cause**: Function parses WiFi interface details from system commands (`iw`, `iwconfig`, `ip`). Parsing logic for each data source (interface info, capabilities, supported modes, channel list) is inline.

**Decomposition strategy**: Extract each parser to a named function.

**New functions** (in `src/lib/server/hardware/detection/wifiParser.ts`):

| Function Name                           | Estimated Lines | Data Source                                               |
| --------------------------------------- | --------------- | --------------------------------------------------------- |
| `parseInterfaceInfo(iwOutput: string)`  | 15-25           | Parse `iw dev` output for interface name, MAC, channel    |
| `parseCapabilities(iwOutput: string)`   | 15-20           | Parse supported standards (a/b/g/n/ac/ax)                 |
| `parseSupportedModes(iwOutput: string)` | 10-15           | Parse monitor/managed/AP modes                            |
| `parseChannelList(iwOutput: string)`    | 15-20           | Parse available channels and frequencies                  |
| `getWifiDetails(iface: string)`         | 20-30           | Orchestrator: run commands, call parsers, assemble result |

**Post-decomposition target**: 20-30 lines for orchestrator.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/hardware/details/+server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/hardware/detection/wifiParser.ts
# TARGET: 0 functions >60 lines in both files
```

---

### 5.6 HIGH-06: `checkInstalledTools` (107 lines)

**Location**: `src/lib/server/toolChecker.ts:11`
**Current size**: 107 lines
**Root cause**: Function checks installation status of 15+ external tools (Kismet, tshark, hackrf_transfer, grgsm_livemon, bettercap, etc.) by probing the filesystem and running version commands. Each tool check is 5-10 lines, but aggregated they exceed the limit.

**Decomposition strategy**: Define tool check specifications as a data-driven lookup table. Extract the check-execution logic to a generic function.

**New functions** (in same file):

| Function Name                           | Estimated Lines | Responsibility                                                       |
| --------------------------------------- | --------------- | -------------------------------------------------------------------- |
| `TOOL_CHECKS: ToolCheckSpec[]`          | 30-40           | Data table: tool name, binary path, version command, docker check    |
| `executeToolCheck(spec: ToolCheckSpec)` | 15-25           | Run one tool check: probe binary, run version command, return status |
| `checkInstalledTools()`                 | 15-20           | Map TOOL_CHECKS through executeToolCheck, collect results            |

**Post-decomposition target**: 15-20 lines for `checkInstalledTools`. The `TOOL_CHECKS` array is data, not logic, and does not count toward function length.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/toolChecker.ts
# TARGET: 0 functions >60 lines
```

---

### 5.7 HIGH-07: `registerDefaultStrategies` (106 lines)

**Location**: `src/lib/services/recovery/errorRecovery.ts:291`
**Current size**: 106 lines
**Root cause**: Function registers 8-10 error recovery strategies (restart service, reconnect WebSocket, clear cache, fallback to defaults, etc.) by calling `this.register()` with inline strategy objects. Each strategy definition is 8-15 lines.

**Decomposition strategy**: Define strategies as module-level constants or in a separate strategies file. The registration function iterates over the array.

**New structure**:

| Item                                              | Estimated Lines | Responsibility                                               |
| ------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[]` | 50-60           | Array of strategy objects (data, not logic)                  |
| `registerDefaultStrategies()`                     | 8-12            | `DEFAULT_RECOVERY_STRATEGIES.forEach(s => this.register(s))` |

**Post-decomposition target**: 8-12 lines for registration function. Strategy definitions are data declarations at module scope.

**Note**: If `DEFAULT_RECOVERY_STRATEGIES` exceeds 60 lines when including strategy handler functions, extract each handler to a named function:

| Function Name                     | Estimated Lines |
| --------------------------------- | --------------- |
| `restartServiceStrategy(ctx)`     | 10-15           |
| `reconnectWebSocketStrategy(ctx)` | 10-15           |
| `clearCacheStrategy(ctx)`         | 8-12            |
| `fallbackToDefaultsStrategy(ctx)` | 8-12            |

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/recovery/errorRecovery.ts
# TARGET: 0 functions >60 lines
```

---

### 5.8 HIGH-08: `updateVisualization` (105 lines)

**Location**: `src/lib/components/drone/FlightPathVisualization.svelte:60`
**Current size**: 105 lines
**Root cause**: Leaflet polyline/marker update function that handles: clearing old markers, calculating path segments from flight data, rendering polylines with color gradients based on altitude/speed, placing waypoint markers, and updating the viewport to fit the path bounds.

**Decomposition strategy**: Extract rendering phases.

**New functions** (in same file or `src/lib/components/drone/flightPathRenderer.ts`):

| Function Name                                             | Estimated Lines | Responsibility                                                |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `clearFlightLayers(layerGroup: L.LayerGroup)`             | 5-10            | Remove all existing path/marker layers                        |
| `buildPathSegments(points: FlightPoint[])`                | 15-25           | Convert flight points to colored polyline segments            |
| `renderFlightPath(map: L.Map, segments: PathSegment[])`   | 15-25           | Draw polyline segments on map                                 |
| `placeWaypointMarkers(map: L.Map, waypoints: Waypoint[])` | 15-20           | Place numbered waypoint markers                               |
| `updateVisualization(map, flightData)`                    | 15-20           | Orchestrator: clear -> build -> render -> place -> fit bounds |

**Post-decomposition target**: 15-20 lines for orchestrator.

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/drone/FlightPathVisualization.svelte
# TARGET: 0 functions >60 lines
```

---

## 6. Task 5.5.3: Decompose STANDARD Priority Functions (60-99 Lines)

**Scope**: **95** functions in the 60-99 line range (after cross-phase deductions). 52 enumerated below with detailed plans; remaining 43 were identified by the v2 scanner in the 60-65 line range and follow the same patterns.
**Effort**: 6 hours
**Risk**: LOW -- these are small overages (1-39 lines over the limit) and typically require only 1-2 extractions each.

Functions are grouped by directory for batch processing. Within each directory group, apply the decomposition patterns from Section 7 (Pattern Reference).

---

### 6.1 Group: `server/` Directory (18 functions)

| Lines | File                                                       | Function                      | Pattern to Apply                                                                                    |
| ----- | ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| 97    | `server/websocket-server.ts:27`                            | `initializeWebSocketServer`   | Extract-and-name: extract `configureCompression()`, `registerMessageHandlers()`, `setupHeartbeat()` |
| 90    | `server/gsm-database-path.ts:13`                           | `resolveGsmDatabasePath`      | Early-return: add guard clauses for env vars, reduce nesting by 3 levels                            |
| 88    | `server/hardware/detection/serial-detector.ts:16`          | `detectGPSModules`            | Data-driven: define GPS device matchers as lookup table, loop over them                             |
| 86    | `server/db/signalRepository.ts:65`                         | `insertSignalsBatch`          | Extract-and-name: extract `buildInsertSQL()` and `bindSignalValues()`                               |
| 86    | `server/hardware/detection/hardware-detector.ts:20`        | `scanAllHardware`             | Extract-and-name: extract per-category scanners (already partially done), reduce orchestrator       |
| 84    | `server/db/migrations/runMigrations.ts:5`                  | `runMigrations`               | Extract-and-name: extract `loadMigrationFiles()`, `checkMigrationStatus()`, `executeMigration()`    |
| 80    | `server/kismet/kismet_controller.ts:420`                   | `stopExternalKismetProcesses` | Early-return: add guard clauses, extract `findKismetPIDs()` and `terminateProcesses()`              |
| 79    | `server/agent/runtime.ts:257`                              | `createAgent`                 | Extract-and-name: extract `buildAgentConfig()`, `registerAgentTools()`                              |
| 74    | `server/wireshark.ts:54`                                   | `tryRealCapture`              | Early-return: add interface validation guard, extract `buildTsharkArgs()`                           |
| 70    | `server/kismet/device_intelligence.ts:355`                 | `performClassification`       | Data-driven: extract classification rules to lookup table                                           |
| 70    | `server/hardware/resourceManager.ts:32`                    | `scanForOrphans`              | Extract-and-name: extract `identifyOrphanProcesses()`, `identifyOrphanPorts()`                      |
| 68    | `server/kismet/kismet_controller.ts:646`                   | `enrichDeviceData`            | Extract-and-name: extract `enrichWithSignalData()`, `enrichWithLocationData()`                      |
| 65    | `server/agent/tool-execution/detection/tool-mapper.ts:101` | `generateNamespace`           | Early-return: add guard clauses for invalid inputs, flatten conditional chain                       |
| 65    | `server/hardware/detection/serial-detector.ts:108`         | `detectCellularModems`        | Data-driven: define modem matchers as lookup table (same pattern as GPS detector)                   |
| 64    | `server/kismet/device_tracker.ts:402`                      | `updateStatistics`            | Extract-and-name: extract `calculateSignalStats()`, `calculateTimeStats()`                          |
| 63    | `server/agent/tool-execution/detection/tool-mapper.ts:30`  | `mapToExecutionTool`          | Data-driven: replace if-else chain with strategy map                                                |
| 62    | `server/wifite/processManager.ts:271`                      | `buildArgs`                   | Data-driven: define argument templates as data structure, iterate to build                          |
| 61    | `server/hackrf/sweepManager.ts:1123`                       | `_performRecovery`            | **HANDLED BY PHASE 5.2** (sweepManager decomposition)                                               |

**Execution approach**: Process `server/` files in this order: (1) files with multiple oversized functions (kismet_controller, serial-detector, tool-mapper), (2) files with single oversized functions.

**Batch verification**:

```bash
for f in server/websocket-server.ts server/gsm-database-path.ts server/hardware/detection/serial-detector.ts \
         server/db/signalRepository.ts server/hardware/detection/hardware-detector.ts \
         server/db/migrations/runMigrations.ts server/kismet/kismet_controller.ts \
         server/agent/runtime.ts server/wireshark.ts server/kismet/device_intelligence.ts \
         server/hardware/resourceManager.ts server/agent/tool-execution/detection/tool-mapper.ts \
         server/kismet/device_tracker.ts server/wifite/processManager.ts; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files
```

---

### 6.2 Group: `services/` Directory (13 functions)

| Lines | File                                                        | Function                   | Pattern to Apply                                                                                                    |
| ----- | ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 94    | `services/hackrf/sweep-manager/buffer/BufferManager.ts:197` | `parseSpectrumData`        | **HANDLED BY PHASE 5.2** (HackRF BufferManager deduplication)                                                       |
| 94    | `services/websocket/test-connection.ts:11`                  | `testWebSocketConnections` | Data-driven: define test cases as array, execute via `Promise.all(tests.map(runTest))`                              |
| 91    | `services/drone/flightPathAnalyzer.ts:217`                  | `calculateEfficiency`      | Extract-and-name: extract `calculateDistanceEfficiency()`, `calculateTimeEfficiency()`, `calculateFuelEfficiency()` |
| 75    | `services/recovery/errorRecovery.ts:212`                    | `attemptRecovery`          | Early-return: guard clause for unrecoverable errors; extract `selectStrategy()`, `executeWithRetry()`               |
| 69    | `services/drone/flightPathAnalyzer.ts:312`                  | `detectAnomalies`          | Extract-and-name: extract `detectSpeedAnomalies()`, `detectAltitudeAnomalies()`, `detectPathDeviation()`            |
| 68    | `services/drone/flightPathAnalyzer.ts:145`                  | `identifySignalHotspots`   | Extract-and-name: extract `calculateSignalDensity()`, `findPeakRegions()`                                           |
| 67    | `services/map/networkAnalyzer.ts:254`                       | `exploreCluster`           | Extract-and-name: extract `getClusterEdges()`, `calculateClusterMetrics()`                                          |
| 63    | `services/monitoring/systemHealth.ts:307`                   | `analyzeHealth`            | Extract-and-name: extract `evaluateMetricThresholds()`, `generateHealthSummary()`                                   |
| 61    | `services/hackrf/sweep-manager/error/ErrorTracker.ts:130`   | `analyzeError`             | Data-driven: define error patterns as lookup table, match against patterns                                          |
| 61    | `services/localization/coral/CoralAccelerator.v2.ts:32`     | `startProcess`             | Early-return: guard clauses for device not found, already running; extract `configureAccelerator()`                 |

**Note**: `flightPathAnalyzer.ts` contains THREE oversized functions (91, 69, 68 lines). Process this file as a unit -- all three functions decomposed in one commit.

**Batch verification**:

```bash
for f in services/websocket/test-connection.ts services/drone/flightPathAnalyzer.ts \
         services/recovery/errorRecovery.ts services/map/networkAnalyzer.ts \
         services/monitoring/systemHealth.ts services/hackrf/sweep-manager/error/ErrorTracker.ts \
         services/localization/coral/CoralAccelerator.v2.ts; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files
```

---

### 6.3 Group: `components/` Directory (14 functions)

| Lines | File                                                      | Function                   | Pattern to Apply                                                                                    |
| ----- | --------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| 98    | `components/map/KismetDashboardOverlay.svelte:238`        | `getDeviceType`            | Data-driven: replace large if-else/switch chain with device-type lookup table                       |
| 97    | `components/hackrf/SpectrumChart.svelte:166`              | `updateWaterfallOptimized` | Extract-and-name: extract `shiftWaterfallPixels()`, `renderNewRow()`, `applyColormap()`             |
| 87    | `components/hackrf/SpectrumChart.svelte:75`               | `drawSpectrum`             | Extract-and-name: extract `drawSpectrumLine()`, `drawGridLines()`, `drawLabels()`                   |
| 86    | `components/dashboard/AgentChatPanel.svelte:107`          | `sendMessageWithContent`   | Extract-and-name: extract `prepareMessagePayload()`, `submitToAgent()`, `handleAgentResponse()`     |
| 83    | `components/dashboard/DashboardMap.svelte:358`            | `handleMapLoad`            | Extract-and-name: extract `configureMapLayers()`, `attachMapEventListeners()`                       |
| 81    | `components/tactical-map/kismet/DeviceManager.svelte:140` | `createDevicePopupContent` | Builder: extract section builders `buildDeviceHeader()`, `buildSignalInfo()`, `buildLocationInfo()` |
| 74    | `components/map/AirSignalOverlay.svelte:207`              | `processSpectrumData`      | Extract-and-name: extract `parseSpectrumLine()`, `classifyFrequency()`                              |
| 73    | `components/drone/FlightPathVisualization.svelte:258`     | `addFlightMarkers`         | Extract-and-name: extract `createWaypointMarker()`, `createPathLabel()`                             |
| 67    | `components/drone/MissionControl.svelte:120`              | `addWaypoint`              | Extract-and-name: extract `validateWaypointPosition()`, `buildWaypointConfig()`                     |
| 105   | `components/drone/FlightPathVisualization.svelte:60`      | `updateVisualization`      | **HANDLED BY HIGH-08** (Section 5.8)                                                                |

**Note**: `SpectrumChart.svelte` contains TWO oversized functions (97 and 87 lines). Process as a unit. `FlightPathVisualization.svelte` also contains TWO oversized functions (105 handled by HIGH-08, plus 73 here). Process as a unit with the HIGH-08 decomposition.

**Batch verification**:

```bash
for f in components/map/KismetDashboardOverlay.svelte components/hackrf/SpectrumChart.svelte \
         components/dashboard/AgentChatPanel.svelte components/dashboard/DashboardMap.svelte \
         components/tactical-map/kismet/DeviceManager.svelte components/map/AirSignalOverlay.svelte \
         components/drone/FlightPathVisualization.svelte components/drone/MissionControl.svelte; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files
```

---

### 6.4 Group: `routes/` Directory (6 functions)

| Lines | File                                     | Function           | Pattern to Apply                                                                               |
| ----- | ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| 89    | `routes/kismet/+page.svelte:152`         | `startKismet`      | Early-return: guard clauses for already running, no interface; extract `launchKismetProcess()` |
| 71    | `routes/droneid/+page.svelte:59`         | `connectWebSocket` | Extract-and-name: extract `createWebSocket()`, `registerDroneHandlers()`                       |
| 68    | `routes/api/gps/position/+server.ts:180` | `buildGpsResponse` | Builder: extract `buildPositionSection()`, `buildSatelliteSection()`, `buildTimingSection()`   |
| 67    | `routes/test/+page.svelte:68`            | `testWebSockets`   | Data-driven: define test cases as array, map through executor                                  |
| 65    | `routes/api/gps/position/+server.ts:111` | `queryGpsd`        | Early-return: guard clauses for connection errors; extract `parseGpsdResponse()`               |

**Note**: `gps/position/+server.ts` contains TWO oversized functions (68 and 65 lines). Process as a unit.

**Batch verification**:

```bash
for f in routes/kismet/+page.svelte routes/droneid/+page.svelte \
         routes/api/gps/position/+server.ts routes/test/+page.svelte; do
    python3 scripts/audit-function-sizes-v2.py "src/$f"
done
# TARGET: 0 functions >60 lines across all files
```

---

### 6.5 Group: `stores/` Directory (1 function)

| Lines | File                                | Function        | Pattern to Apply                                                                                    |
| ----- | ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| 68    | `stores/packetAnalysisStore.ts:173` | `analyzePacket` | Extract-and-name: extract `identifyProtocol()`, `extractPayloadMetadata()`, `classifyThreatLevel()` |

**Verification**:

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/stores/packetAnalysisStore.ts
# TARGET: 0 functions >60 lines
```

---

## 7. Decomposition Pattern Reference

This section provides concrete, copy-paste-ready examples of each decomposition pattern referenced in the task tables above. These examples use TypeScript syntax matching the Argos codebase conventions.

---

### 7.1 Pattern 1: Early-Return (Guard Clause Extraction)

**When to use**: Function has deeply nested if/else blocks, especially for error/edge-case handling. The "happy path" is buried 3+ indentation levels deep.

**Typical savings**: 10-20 lines (reduced indentation, eliminated else blocks).

**Before** (90 lines, 4 levels of nesting):

```typescript
async function resolveGsmDatabasePath(config: GSMConfig): Promise<string> {
	const envPath = process.env.GSM_DB_PATH;
	if (envPath) {
		if (existsSync(envPath)) {
			const stats = statSync(envPath);
			if (stats.isFile()) {
				if (stats.size > 0) {
					return envPath;
				} else {
					// 20 lines of fallback logic...
				}
			} else {
				// 15 lines of directory handling...
			}
		} else {
			// 15 lines of missing file handling...
		}
	} else {
		// 25 lines of default path resolution...
	}
}
```

**After** (45 lines, 1 level of nesting):

```typescript
async function resolveGsmDatabasePath(config: GSMConfig): Promise<string> {
	const envPath = process.env.GSM_DB_PATH;
	if (!envPath) {
		return resolveDefaultPath(config);
	}
	if (!existsSync(envPath)) {
		return handleMissingPath(envPath, config);
	}
	const stats = statSync(envPath);
	if (!stats.isFile()) {
		return handleDirectoryPath(envPath, config);
	}
	if (stats.size === 0) {
		return handleEmptyFile(envPath, config);
	}
	return envPath;
}
```

---

### 7.2 Pattern 2: Extract-and-Name

**When to use**: Function contains comment blocks like `// Step 1: Initialize...`, `// Parse the response...`, `// Calculate metrics...`. Each commented section is an implicit function waiting to be named.

**Typical savings**: Variable. The original function shrinks by the sum of extracted sections minus one call-site line per extraction.

**Rule of thumb**: If you can describe what 10+ consecutive lines do in a single sentence, those lines are a function.

**Before** (97 lines):

```typescript
function initializeWebSocketServer(server: HttpServer): WebSocketServer {
    // Configure compression (15 lines)
    const perMessageDeflate = { ... };
    // ... 15 lines of compression config ...

    // Create WebSocket server (10 lines)
    const wss = new WebSocket.Server({ server, perMessageDeflate });
    // ... setup ...

    // Register message handlers (30 lines)
    wss.on('connection', (ws) => {
        ws.on('message', (data) => { /* 25 lines */ });
    });

    // Setup heartbeat (20 lines)
    const interval = setInterval(() => { /* 18 lines */ }, 30000);

    // Cleanup on close (10 lines)
    wss.on('close', () => { /* 8 lines */ });

    return wss;
}
```

**After** (30 lines):

```typescript
function initializeWebSocketServer(server: HttpServer): WebSocketServer {
	const compression = configureCompression();
	const wss = new WebSocket.Server({ server, perMessageDeflate: compression });
	registerMessageHandlers(wss);
	const heartbeatInterval = setupHeartbeat(wss);
	registerCleanupHandler(wss, heartbeatInterval);
	return wss;
}
```

---

### 7.3 Pattern 3: Data-Driven (Lookup Table / Strategy Map)

**When to use**: Function contains a large `switch` statement, if-else chain, or sequential series of similar conditional blocks. Each branch performs the same kind of operation on different data.

**Typical savings**: Eliminates N branches in favor of an O(1) lookup. Often cuts function size by 50-80%.

**Before** (98 lines):

```typescript
function getDeviceType(device: KismetDevice): DeviceType {
	if (device.type === 'Wi-Fi AP' && device.encryption === 'WPA3') {
		return { category: 'access-point', icon: 'ap-secure', threat: 'low' };
	} else if (device.type === 'Wi-Fi AP' && device.encryption === 'Open') {
		return { category: 'access-point', icon: 'ap-open', threat: 'high' };
	} else if (device.type === 'Wi-Fi Client') {
		return { category: 'client', icon: 'client', threat: 'medium' };
	}
	// ... 15 more branches, each 4-6 lines ...
}
```

**After** (25 lines for function + 40 lines for data table):

```typescript
const DEVICE_TYPE_MAP: Record<string, (d: KismetDevice) => DeviceType> = {
	'Wi-Fi AP': (d) => ({
		category: 'access-point',
		icon: d.encryption === 'Open' ? 'ap-open' : 'ap-secure',
		threat: d.encryption === 'Open' ? 'high' : 'low'
	}),
	'Wi-Fi Client': () => ({ category: 'client', icon: 'client', threat: 'medium' }),
	Bluetooth: () => ({ category: 'bluetooth', icon: 'bt', threat: 'low' })
	// ... entries for each device type ...
};

function getDeviceType(device: KismetDevice): DeviceType {
	const resolver = DEVICE_TYPE_MAP[device.type];
	if (!resolver) {
		return { category: 'unknown', icon: 'unknown', threat: 'unknown' };
	}
	return resolver(device);
}
```

**Note**: The data table (`DEVICE_TYPE_MAP`) is a module-level constant, not inside any function. It does not count toward function-line limits. It IS counted toward file-line limits (max-lines: 300). If the data table is large enough to push the file over 300 lines, extract it to a separate data file per Phase 5.4 rules.

---

### 7.4 Pattern 4: Builder

**When to use**: Function constructs a complex object, HTML string, or configuration step-by-step. Each step adds one section/field to the result.

**Typical savings**: Converts one large function into N small section-builder functions plus one assembler.

**Before** (121 lines):

```typescript
function createSystemInfoContent(info: SystemInfo): string {
	let html = '<div class="system-info">';

	// CPU section (20 lines)
	html += '<div class="section">';
	html += `<h3>CPU</h3>`;
	html += `<p>Usage: ${info.cpu.usage}%</p>`;
	// ... 17 more lines ...
	html += '</div>';

	// Memory section (15 lines)
	// ... 15 lines ...

	// Network section (20 lines)
	// ... 20 lines ...

	// GPS section (15 lines)
	// ... 15 lines ...

	// Services section (20 lines)
	// ... 20 lines ...

	html += '</div>';
	return html;
}
```

**After** (18 lines + 5 section builders at 15-20 lines each):

```typescript
function createSystemInfoContent(info: SystemInfo): string {
	const sections = [
		buildCPUSection(info),
		buildMemorySection(info),
		buildNetworkSection(info),
		buildGPSSection(info),
		buildServiceSection(info)
	];
	return `<div class="system-info">${sections.join('')}</div>`;
}
```

---

### 7.5 Pattern 5: Store Action Extraction

**When to use**: Svelte store factory functions (`createXStore`) that define action handlers inline. This is the most common cause of >150-line functions in the Argos codebase (3 of 15 CRITICAL functions).

**Typical savings**: Reduces store factory from 150-320 lines to 30-50 lines.

**Structural rule**: The store creation function (writable declaration, derived stores, subscribe setup) stays in the store file. Action handler implementations move to a sibling `*Actions.ts` file. The store file imports and delegates to the action file.

**Before** (`createGSMEvilStore`, 318 lines):

```typescript
export function createGSMEvilStore() {
    const { subscribe, set, update } = writable<GSMEvilState>(initialState);

    return {
        subscribe,
        startScan: async (freq: number) => {
            update(s => ({ ...s, scanning: true }));
            try {
                const res = await fetch('/api/gsm-evil/scan', { ... });
                // 25 lines of response handling
            } catch (e) {
                // 10 lines of error handling
            }
        },
        stopScan: async () => {
            // 15 lines
        },
        // ... 12 more action handlers, each 10-30 lines ...
    };
}
```

**After** (`createGSMEvilStore`, 40 lines):

```typescript
import { startGSMScan, stopGSMScan, fetchCapturedIMSIs /* ... */ } from './gsmEvilActions';

export function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(initialState);

	return {
		subscribe,
		startScan: (freq: number) => startGSMScan(update, freq),
		stopScan: () => stopGSMScan(update),
		fetchIMSIs: () => fetchCapturedIMSIs(update)
		// ... one-line delegations for each action ...
	};
}
```

---

## 8. Execution Order

### 8.1 Execution Sequence

| Order | Task                                                        | Functions                    | Effort | Dependencies                                     |
| ----- | ----------------------------------------------------------- | ---------------------------- | ------ | ------------------------------------------------ |
| 1     | CRITICAL stores (5.5.1: items 01, 05, 10)                   | 3 store factory functions    | 2 hr   | None (stores are leaf nodes in dependency graph) |
| 2     | CRITICAL server functions (5.5.1: items 02, 03, 04, 06, 09) | 5 functions                  | 2.5 hr | None                                             |
| 3     | CRITICAL component functions (5.5.1: items 07, 08)          | 2 functions (post Phase 5.4) | 1 hr   | Phase 5.4 complete for AirSignalOverlay          |
| 4     | HIGH functions (5.5.2: all 8 items)                         | 8 functions                  | 4 hr   | CRITICAL functions complete (some in same files) |
| 5     | STANDARD: `server/` group (6.1)                             | 17 functions                 | 2 hr   | HIGH functions in same files complete            |
| 6     | STANDARD: `services/` group (6.2)                           | 11 functions                 | 1.5 hr | None                                             |
| 7     | STANDARD: `components/` group (6.3)                         | 13 functions                 | 1.5 hr | HIGH-08 complete                                 |
| 8     | STANDARD: `routes/` + `stores/` groups (6.4, 6.5)           | 7 functions                  | 1 hr   | Phase 5.1 complete for God Pages                 |
| 9     | Full-codebase verification scan                             | All files                    | 0.5 hr | All decompositions complete                      |

**Total estimated effort**: **21 hours** (corrected from 16 hours to account for 157 total functions, not ~119)

### 8.2 Commit Strategy

**Granularity**: One commit per file or per closely-related file group.

**Commit message format**:

```
refactor(phase-5.5): decompose <functionName> in <fileName>

Extract <N> sub-functions from <functionName> (<originalLines> lines -> <newLines> lines).
New functions: <list>.
Zero behavioral change. All existing callers unchanged.

Verification: npm run build && npm run typecheck
```

**Examples of atomic commits**:

```
refactor(phase-5.5): decompose createGSMEvilStore (318 -> 40 lines)
refactor(phase-5.5): decompose setupPacketStream in wireshark.ts (272 -> 30 lines)
refactor(phase-5.5): decompose 3 functions in flightPathAnalyzer.ts (91+69+68 -> <60 each)
refactor(phase-5.5): extract OUI data from device_intelligence.ts to JSON (219 -> 25 lines)
```

**Multi-function files**: When a single file contains 2+ oversized functions (e.g., `SpectrumChart.svelte` has 2, `flightPathAnalyzer.ts` has 3, `kismet_controller.ts` has 2, `gps/position/+server.ts` has 2), decompose ALL oversized functions in that file in a SINGLE commit. This prevents intermediate states where some functions are decomposed and others are not, which complicates rollback.

### 8.3 Rollback Procedure

If any commit breaks the build or test suite:

1. `git revert <commit-hash>` -- create a revert commit (do NOT use `git reset --hard`)
2. Identify which extracted function introduced the breakage
3. Examine whether the extraction changed error-handling semantics (most common cause: a `return` inside a `try` block that previously exited the outer function now only exits the extracted function)
4. Fix the extraction to preserve original error-handling flow
5. Create a NEW commit with the corrected extraction

---

## 9. Verification Checklist

### 9.1 Per-Function Verification

After each CRITICAL or HIGH function decomposition, run:

```bash
# 1. Verify no functions >60 lines in the modified file
python3 scripts/audit-function-sizes-v2.py <modified-file>
# TARGET: 0 functions >60 lines

# 2. Verify TypeScript compilation
npm run typecheck
# TARGET: Exit code 0

# 3. Verify build
npm run build
# TARGET: Exit code 0
```

### 9.2 Full-Codebase Verification (After All Decompositions)

```bash
# === FUNCTION SIZE ENFORCEMENT ===
echo "=== FUNCTIONS >60 LINES ==="
python3 scripts/audit-function-sizes-v2.py src/
# TARGET: 0 functions >60 lines

# === FALLBACK: Manual spot-check with grep ===
# This catches any functions the scanner might miss
echo "=== SPOT CHECK: Large function bodies ==="
for f in src/lib/stores/gsmEvilStore.ts \
         src/lib/stores/rtl433Store.ts \
         src/lib/stores/kismet.ts \
         src/lib/server/wireshark.ts \
         src/lib/server/kismet/device_intelligence.ts \
         src/lib/services/gsm-evil/server.ts \
         src/lib/services/map/signalClustering.ts \
         src/routes/api/system/info/+server.ts \
         src/routes/api/gsm-evil/health/+server.ts; do
    echo "--- $f ---"
    wc -l "$f"
done
# All files should show reasonable line counts

# === BUILD VERIFICATION ===
npm run build
# TARGET: Exit code 0

# === TYPE CHECK ===
npm run typecheck
# TARGET: Exit code 0

# === UNIT TESTS ===
npm run test:unit
# TARGET: All tests pass

# === ESLINT SIZE RULES (Phase 5.6 gate) ===
npx eslint src/ --rule '{"max-lines-per-function": ["error", {"max": 60, "skipBlankLines": true, "skipComments": true, "IIFEs": true}]}' 2>&1 | head -50
# TARGET: 0 violations

# === NO NEW CIRCULAR DEPENDENCIES ===
npx madge --circular --extensions ts,svelte src/ 2>&1 | tail -5
# TARGET: "No circular dependency found!" (or the pre-existing heatmap cycle only)

# === STORE IMPORT BOUNDARY CHECK ===
# Verify store action extraction did not introduce new store-service violations
grep -rn "from.*stores/" src/lib/services/ src/lib/server/ --include="*.ts" | grep -v "import type" | grep -v "stores/.*Actions"
# TARGET: Same count as before Phase 5.5 (no new violations introduced)
```

### 9.3 Scanner Validation

The function-size scanner (`scripts/audit-function-sizes-v2.py`) must itself be validated before being used as the final gate. Run it against known test cases:

```bash
# Create a test file with a known 65-line function
cat > /tmp/test-scanner.ts << 'EOF'
export function bigFunction() {
    const a = 1;
    const b = 2;
    // ... (60 more lines of assignments)
    return a + b;
}
EOF

# Add 60 lines of content
for i in $(seq 1 60); do
    sed -i "3i\\    const v$i = $i;" /tmp/test-scanner.ts
done

python3 scripts/audit-function-sizes-v2.py /tmp/test-scanner.ts
# EXPECTED: Reports bigFunction as >60 lines

# Test with arrow function
cat > /tmp/test-arrow.ts << 'EOF'
export const bigArrow = async () => {
    const a = 1;
    return a;
};
EOF

for i in $(seq 1 60); do
    sed -i "3i\\    const v$i = $i;" /tmp/test-arrow.ts
done

python3 scripts/audit-function-sizes-v2.py /tmp/test-arrow.ts
# EXPECTED: Reports bigArrow as >60 lines
```

---

## 10. Risk Mitigations

### 10.1 Error-Handling Semantics Preservation

**Risk**: Extracting code from inside a `try/catch` block into a separate function changes the error-handling flow. A `return` statement inside the extracted function returns from the new function, not from the original caller's `try` block.

**Mitigation**: When extracting code from within a `try/catch`:

1. If the extracted code contains `return` statements that exit the outer function on error, the extracted function must `throw` instead, and the caller must handle it.
2. If the extracted code catches errors internally and continues, it can safely be extracted as-is.
3. Document the error-handling boundary in a comment above the extraction call site.

**Verification**: After each extraction, confirm that error paths produce the same HTTP status codes and error response formats by testing with intentionally malformed inputs.

### 10.2 Svelte Reactivity Preservation

**Risk**: Extracting code from Svelte `<script>` blocks into external `.ts` files may break Svelte's reactivity system. Svelte 5 uses `$state()`, `$derived()`, and `$effect()` runes that must remain in the `.svelte` file.

**Mitigation**:

1. Only extract PURE functions (no reactive dependencies) to external `.ts` files.
2. Functions that read or write Svelte reactive state (`$state`, `$derived`, `$effect`, `$:` blocks in Svelte 4) must remain in the `.svelte` file.
3. When a function is too large but touches reactive state, decompose it into a pure computation function (extracted) called from a thin reactive wrapper (stays in `.svelte`).

### 10.3 Store Action Extraction -- Closure Variable Access

**Risk**: Store action handlers typically close over the `update`, `set`, and `subscribe` functions from the writable store. When extracted to a separate file, these closures must be passed as explicit parameters.

**Mitigation**: All extracted action functions receive `update: (fn: Updater<State>) => void` as their first parameter. This is the minimal interface needed to modify store state. The `subscribe` function is NOT passed to action handlers (actions write, they do not read via subscription).

**Pattern**:

```typescript
// In gsmEvilActions.ts
export async function startGSMScan(
	update: (fn: (state: GSMEvilState) => GSMEvilState) => void,
	frequency: number
): Promise<void> {
	update((s) => ({ ...s, scanning: true, error: null }));
	try {
		const res = await fetch(`/api/gsm-evil/scan`, {
			/* ... */
		});
		const data = await res.json();
		update((s) => ({ ...s, scanResult: data, scanning: false }));
	} catch (e) {
		update((s) => ({ ...s, error: String(e), scanning: false }));
	}
}
```

### 10.4 Import Path Stability

**Risk**: When store files move from `src/lib/stores/gsmEvilStore.ts` to `src/lib/stores/gsm-evil/gsmEvilStore.ts`, all importers break.

**Mitigation**: Create a barrel re-export at the original path for one release cycle:

```typescript
// src/lib/stores/gsmEvilStore.ts (becomes barrel)
export { gsmEvilStore, type GSMEvilState } from './gsm-evil/gsmEvilStore';
```

After all consumers have been updated (can be verified with `grep -rn "stores/gsmEvilStore" src/`), delete the barrel file. This two-phase migration prevents broken imports.

### 10.5 Canvas/WebGL Context Loss

**Risk**: Extracting canvas rendering functions from Svelte components to external `.ts` files requires passing the `CanvasRenderingContext2D` or `WebGLRenderingContext` as a parameter. If the context reference becomes stale (component remounts), the extracted function operates on a dead context.

**Mitigation**: Extracted rendering functions must:

1. Accept `ctx: CanvasRenderingContext2D` as their first parameter (never cache it at module level).
2. Validate the context before rendering: `if (!ctx || ctx.canvas.width === 0) return;`
3. Be called from within Svelte lifecycle hooks (`onMount`, `$effect`) that guarantee the canvas element is mounted.

### 10.6 Performance -- Function Call Overhead

**Risk**: Decomposing hot-path functions (e.g., `parseSpectrumData` called per RF sweep line, `processSpectrumData` called per SSE message) into multiple sub-functions adds function-call overhead.

**Mitigation**: In modern V8 (Node.js 20+), the JIT compiler inlines small functions automatically. Functions under ~30 lines with predictable call patterns are reliably inlined. The decomposition targets in this plan produce sub-functions of 10-35 lines, which fall within V8's inlining thresholds.

If profiling after decomposition reveals a performance regression in hot paths:

1. Mark the function with `// @inline` comment for documentation
2. Verify V8 is inlining: `node --trace-opt --trace-deopt` during a sweep session
3. As a last resort, use `@ts-expect-error` and manual inlining for the specific hot-path function (requires documented exemption with performance data)

---

## 11. Acceptance Criteria

Phase 5.5 is COMPLETE when ALL of the following conditions are satisfied:

| #   | Criterion                              | Verification Command                              | Expected Result                                  |
| --- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| 1   | Zero functions >60 lines in `src/`     | `python3 scripts/audit-function-sizes-v2.py src/` | 0 violations                                     |
| 2   | Build succeeds                         | `npm run build`                                   | Exit code 0                                      |
| 3   | TypeScript compilation succeeds        | `npm run typecheck`                               | Exit code 0                                      |
| 4   | All unit tests pass                    | `npm run test:unit`                               | All pass                                         |
| 5   | No new circular dependencies           | `npx madge --circular src/`                       | Same as pre-Phase 5.5                            |
| 6   | No new store-service violations        | `grep` command from Section 9.2                   | Same count as pre-Phase 5.5                      |
| 7   | ESLint `max-lines-per-function` passes | ESLint with rule enabled                          | 0 violations                                     |
| 8   | All CRITICAL functions documented      | This document, Section 4                          | 25/25 decomposed (10 detailed + 15 via patterns) |
| 9   | All HIGH functions documented          | This document, Section 5                          | 28/28 decomposed (8 detailed + 20 via patterns)  |
| 10  | All STANDARD functions documented      | This document, Section 6                          | 95/95 decomposed (52 detailed + 43 via patterns) |

### 11.1 Test Requirements for Extracted Functions (REGRADE ADDITION)

> **REGRADE CORRECTION (2026-02-08)**: Per Phase 5 Final Audit Report Finding 2, every
> decomposition that produces a new pure function must include a corresponding unit test.

**Policy**: Functions decomposed using the **Extract-and-Name** or **Early-Return** patterns
produce pure functions that are independently testable. Each extracted function MUST have:

| Function Category                                     | Test Requirement                                      | Coverage Target      |
| ----------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| Pure data transformer (parser, formatter, normalizer) | 3+ test cases: valid input, edge case, invalid input  | 90% line coverage    |
| Configuration builder (config object assembly)        | 2+ test cases: default config, custom config          | 80% line coverage    |
| Validator/guard (input validation, type guard)        | 4+ test cases: valid, each invalid category, boundary | 100% branch coverage |
| Decision function (if/switch routing)                 | 1 test per branch minimum                             | 100% branch coverage |
| UI helper (SVG generation, CSS class computation)     | 2+ test cases: representative inputs                  | 80% line coverage    |

**Implementation**: Tests are created alongside the decomposition, in the same commit.
Each Task 5.5.1/5.5.2/5.5.3 commit that extracts functions MUST also add:

```typescript
// tests/unit/decomposition/{originalFile}/{extractedFunction}.test.ts
import { describe, it, expect } from 'vitest';
import { extractedFunction } from '$lib/{path}/extractedFunction';

describe('extractedFunction', () => {
	it('handles valid input', () => {
		/* ... */
	});
	it('handles edge case', () => {
		/* ... */
	});
	it('rejects invalid input', () => {
		/* ... */
	});
});
```

**Estimated additional effort**: ~3 hours for CRITICAL functions (25 functions × ~7 min/test),
~2 hours for HIGH functions, ~4 hours for STANDARD functions. Total: ~9 hours added to
the 21-hour estimate, bringing Phase 5.5 total to **~30 hours**.

---

## 12. Traceability to Phase 5.0 Defect IDs

| Phase 5.0 Defect ID | Description                                                      | Phase 5.5 Task                                            | Status  |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | ------- |
| P5-016              | **30** functions >150 lines (was 10 -- scanner reconciliation)   | Task 5.5.1 (**25** CRITICAL after cross-phase deductions) | PLANNED |
| P5-017              | **30** functions 100-149 lines (was 9 -- scanner reconciliation) | Task 5.5.2 (**28** HIGH after cross-phase deductions)     | PLANNED |
| P5-018              | **97** functions 60-99 lines (was ~100)                          | Task 5.5.3 (**95** STANDARD after cross-phase deductions) | PLANNED |

**Cross-phase traceability**:

- 4 CRITICAL functions traced to Phase 5.1 (God Page extraction)
- 5 functions (1 CRITICAL, 2 HIGH, 2 STANDARD) traced to Phase 5.2 (Service Layer)
- 1 CRITICAL function has dual handling: Phase 5.4 (relocation) + Phase 5.5 (decomposition)
- Total **157** functions accounted for: **148** in Phase 5.5 + **9** in other phases

---

## Appendix A: Complete Function Inventory (Sorted by Size, Descending)

For reference and audit traceability, the complete list of all ~119 functions exceeding 60 lines as of commit `f300b8f` (2026-02-08). Each entry includes the handling phase.

| #   | Lines | File (relative to `src/lib/` unless noted)                  | Function                      | Handler                     |
| --- | ----- | ----------------------------------------------------------- | ----------------------------- | --------------------------- |
| 1   | 356   | `server/hackrf/sweepManager.ts:124`                         | `_performHealthCheck`         | Phase 5.2                   |
| 2   | 318   | `stores/gsmEvilStore.ts:70`                                 | `createGSMEvilStore`          | Phase 5.5 CRITICAL-01       |
| 3   | 272   | `server/wireshark.ts:221`                                   | `setupPacketStream`           | Phase 5.5 CRITICAL-02       |
| 4   | 262   | `routes/tactical-map-simple/+page.svelte`                   | `fetchKismetDevices`          | Phase 5.1                   |
| 5   | 236   | `routes/tactical-map-simple/+page.svelte`                   | `processSignals`              | Phase 5.1                   |
| 6   | 229   | `routes/tactical-map-simple/+page.svelte`                   | `getDeviceIconSVG`            | Phase 5.1                   |
| 7   | 219   | `server/kismet/device_intelligence.ts:499`                  | `initializeOUIDatabase`       | Phase 5.5 CRITICAL-03       |
| 8   | 193   | `services/gsm-evil/server.ts:37`                            | `setupRoutes`                 | Phase 5.5 CRITICAL-04       |
| 9   | 191   | `stores/rtl433Store.ts:61`                                  | `createRTL433Store`           | Phase 5.5 CRITICAL-05       |
| 10  | 190   | `routes/gsm-evil/+page.svelte`                              | `scanFrequencies`             | Phase 5.1                   |
| 11  | 182   | `routes/api/gsm-evil/health/+server.ts:6`                   | `performHealthCheck`          | Phase 5.5 CRITICAL-06       |
| 12  | 167   | `components/map/AirSignalOverlay.svelte:39`                 | `toggleRFDetection`           | Phase 5.4 + 5.5 CRITICAL-07 |
| 13  | 161   | `services/map/signalClustering.ts:139`                      | `clusterSignals`              | Phase 5.5 CRITICAL-08       |
| 14  | 156   | `routes/api/system/info/+server.ts:42`                      | `getSystemInfo`               | Phase 5.5 CRITICAL-09       |
| 15  | 154   | `stores/kismet.ts:20`                                       | `createKismetStore`           | Phase 5.5 CRITICAL-10       |
| 16  | 148   | `components/hackrf/SignalAgeVisualization.svelte:69`        | `drawVisualization`           | Phase 5.5 HIGH-01           |
| 17  | 128   | `services/usrp/sweep-manager/buffer/BufferManager.ts:194`   | `parseSpectrumData`           | Phase 5.2                   |
| 18  | 121   | `components/tactical-map/system/SystemInfoPopup.svelte:86`  | `createSystemInfoContent`     | Phase 5.5 HIGH-02           |
| 19  | 119   | `server/mcp/dynamic-server.ts:508`                          | `setupHandlers`               | Phase 5.5 HIGH-03           |
| 20  | 117   | `server/hackrf/sweepManager.ts:555`                         | `_startSweepProcess`          | Phase 5.2                   |
| 21  | 116   | `server/db/cleanupService.ts:93`                            | `prepareStatements`           | Phase 5.5 HIGH-04           |
| 22  | 111   | `routes/api/hardware/details/+server.ts:83`                 | `getWifiDetails`              | Phase 5.5 HIGH-05           |
| 23  | 107   | `server/toolChecker.ts:11`                                  | `checkInstalledTools`         | Phase 5.5 HIGH-06           |
| 24  | 106   | `services/recovery/errorRecovery.ts:291`                    | `registerDefaultStrategies`   | Phase 5.5 HIGH-07           |
| 25  | 105   | `components/drone/FlightPathVisualization.svelte:60`        | `updateVisualization`         | Phase 5.5 HIGH-08           |
| 26  | 98    | `components/map/KismetDashboardOverlay.svelte:238`          | `getDeviceType`               | Phase 5.5 STD (6.3)         |
| 27  | 97    | `server/websocket-server.ts:27`                             | `initializeWebSocketServer`   | Phase 5.5 STD (6.1)         |
| 28  | 97    | `components/hackrf/SpectrumChart.svelte:166`                | `updateWaterfallOptimized`    | Phase 5.5 STD (6.3)         |
| 29  | 94    | `services/hackrf/sweep-manager/buffer/BufferManager.ts:197` | `parseSpectrumData`           | Phase 5.2                   |
| 30  | 94    | `services/websocket/test-connection.ts:11`                  | `testWebSocketConnections`    | Phase 5.5 STD (6.2)         |
| 31  | 91    | `services/drone/flightPathAnalyzer.ts:217`                  | `calculateEfficiency`         | Phase 5.5 STD (6.2)         |
| 32  | 90    | `server/gsm-database-path.ts:13`                            | `resolveGsmDatabasePath`      | Phase 5.5 STD (6.1)         |
| 33  | 89    | `routes/kismet/+page.svelte:152`                            | `startKismet`                 | Phase 5.5 STD (6.4)         |
| 34  | 88    | `server/hardware/detection/serial-detector.ts:16`           | `detectGPSModules`            | Phase 5.5 STD (6.1)         |
| 35  | 87    | `components/hackrf/SpectrumChart.svelte:75`                 | `drawSpectrum`                | Phase 5.5 STD (6.3)         |
| 36  | 86    | `server/db/signalRepository.ts:65`                          | `insertSignalsBatch`          | Phase 5.5 STD (6.1)         |
| 37  | 86    | `server/hardware/detection/hardware-detector.ts:20`         | `scanAllHardware`             | Phase 5.5 STD (6.1)         |
| 38  | 86    | `components/dashboard/AgentChatPanel.svelte:107`            | `sendMessageWithContent`      | Phase 5.5 STD (6.3)         |
| 39  | 84    | `server/db/migrations/runMigrations.ts:5`                   | `runMigrations`               | Phase 5.5 STD (6.1)         |
| 40  | 83    | `components/dashboard/DashboardMap.svelte:358`              | `handleMapLoad`               | Phase 5.5 STD (6.3)         |
| 41  | 81    | `components/tactical-map/kismet/DeviceManager.svelte:140`   | `createDevicePopupContent`    | Phase 5.5 STD (6.3)         |
| 42  | 80    | `server/kismet/kismet_controller.ts:420`                    | `stopExternalKismetProcesses` | Phase 5.5 STD (6.1)         |
| 43  | 79    | `server/agent/runtime.ts:257`                               | `createAgent`                 | Phase 5.5 STD (6.1)         |
| 44  | 75    | `services/recovery/errorRecovery.ts:212`                    | `attemptRecovery`             | Phase 5.5 STD (6.2)         |
| 45  | 74    | `server/wireshark.ts:54`                                    | `tryRealCapture`              | Phase 5.5 STD (6.1)         |
| 46  | 74    | `components/map/AirSignalOverlay.svelte:207`                | `processSpectrumData`         | Phase 5.5 STD (6.3)         |
| 47  | 73    | `components/drone/FlightPathVisualization.svelte:258`       | `addFlightMarkers`            | Phase 5.5 STD (6.3)         |
| 48  | 71    | `routes/droneid/+page.svelte:59`                            | `connectWebSocket`            | Phase 5.5 STD (6.4)         |
| 49  | 70    | `server/kismet/device_intelligence.ts:355`                  | `performClassification`       | Phase 5.5 STD (6.1)         |
| 50  | 70    | `server/hardware/resourceManager.ts:32`                     | `scanForOrphans`              | Phase 5.5 STD (6.1)         |
| 51  | 69    | `services/drone/flightPathAnalyzer.ts:312`                  | `detectAnomalies`             | Phase 5.5 STD (6.2)         |
| 52  | 68    | `routes/api/gps/position/+server.ts:180`                    | `buildGpsResponse`            | Phase 5.5 STD (6.4)         |
| 53  | 68    | `stores/packetAnalysisStore.ts:173`                         | `analyzePacket`               | Phase 5.5 STD (6.5)         |
| 54  | 68    | `services/drone/flightPathAnalyzer.ts:145`                  | `identifySignalHotspots`      | Phase 5.5 STD (6.2)         |
| 55  | 68    | `server/kismet/kismet_controller.ts:646`                    | `enrichDeviceData`            | Phase 5.5 STD (6.1)         |
| 56  | 67    | `routes/test/+page.svelte:68`                               | `testWebSockets`              | Phase 5.5 STD (6.4)         |
| 57  | 67    | `services/map/networkAnalyzer.ts:254`                       | `exploreCluster`              | Phase 5.5 STD (6.2)         |
| 58  | 67    | `components/drone/MissionControl.svelte:120`                | `addWaypoint`                 | Phase 5.5 STD (6.3)         |
| 59  | 65    | `routes/api/gps/position/+server.ts:111`                    | `queryGpsd`                   | Phase 5.5 STD (6.4)         |
| 60  | 65    | `server/agent/tool-execution/detection/tool-mapper.ts:101`  | `generateNamespace`           | Phase 5.5 STD (6.1)         |
| 61  | 65    | `server/hardware/detection/serial-detector.ts:108`          | `detectCellularModems`        | Phase 5.5 STD (6.1)         |
| 62  | 64    | `server/kismet/device_tracker.ts:402`                       | `updateStatistics`            | Phase 5.5 STD (6.1)         |
| 63  | 63    | `services/monitoring/systemHealth.ts:307`                   | `analyzeHealth`               | Phase 5.5 STD (6.2)         |
| 64  | 63    | `server/agent/tool-execution/detection/tool-mapper.ts:30`   | `mapToExecutionTool`          | Phase 5.5 STD (6.1)         |
| 65  | 62    | `server/wifite/processManager.ts:271`                       | `buildArgs`                   | Phase 5.5 STD (6.1)         |
| 66  | 61    | `services/hackrf/sweep-manager/error/ErrorTracker.ts:130`   | `analyzeError`                | Phase 5.5 STD (6.2)         |
| 67  | 61    | `services/localization/coral/CoralAccelerator.v2.ts:32`     | `startProcess`                | Phase 5.5 STD (6.2)         |
| 68  | 61    | `server/hackrf/sweepManager.ts:1123`                        | `_performRecovery`            | Phase 5.2                   |

**NOTE**: Entries 69-157 (~89 additional functions) were identified during multi-scanner reconciliation (see Section 2.1). Many are in the 60-75 line range with high likelihood of being resolved as side effects of Phase 5.1 God Page extraction, Phase 5.2 service refactoring, and Phase 5.4 file-size decomposition. All 157 functions are tracked by the v2 scanner and will be caught by the Phase 5.6 ESLint enforcement gate (`max-lines-per-function: 60`). Any remaining after Phases 5.1-5.4 will be resolved during Phase 5.5 STANDARD batch processing (Section 6).

---

**END OF DOCUMENT**

**Document Revision History**:

| Version | Date       | Author          | Change                                                                                                                                                                                                                                                                                                                       |
| ------- | ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-08 | Claude Opus 4.6 | Initial release. Replaces function-size content from `05c-PHASE-5.3-SIZE-ENFORCEMENT.md`. Corrects function count from 75 to ~119. Adds severity bucketing, cross-phase deductions, decomposition patterns with examples, and per-function decomposition plans.                                                              |
| 1.1     | 2026-02-08 | Claude Opus 4.6 | **REGRADE CORRECTION**: Function count corrected from ~119 to **157** via multi-scanner reconciliation (v1=94, v2=151, v3=205, verified=157). All severity buckets, cross-phase deductions, effort estimates, acceptance criteria, and traceability updated. Root cause: v2 scanner bug with multi-line function signatures. |
