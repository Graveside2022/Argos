# Phase 5.4.11 -- Tier 3: Server and Services Directory Resolution (T3-01 through T3-30)

```
Document ID:    ARGOS-AUDIT-P5.4.11-TIER3-SERVER-SERVICES
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.11 -- Resolve all Tier 3 server and services files (300-499 lines)
Risk Level:     LOW
Prerequisites:  Phase 5.4.8-5.4.10 (all Tier 2) COMPLETE
Files Touched:  ~30 files evaluated; ~12 decomposed, ~16 accepted, 2 deferred
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Scope

This sub-task covers all Tier 3 items in the server (`src/lib/server/`) and services
(`src/lib/services/`) directories. Each file has a definitive action: DECOMPOSE, ACCEPT,
DEFER, or NOTE (duplicate of a Tier 2 item).

### Decision Matrix

| Condition                                    | Action                           |
| -------------------------------------------- | -------------------------------- |
| File is pure data/types (no logic branches)  | ACCEPT as-is, document exception |
| File has 1-2 extractable functions >60 lines | Extract those functions only     |
| File has 3+ concerns mixed                   | Full decomposition               |
| File is 300-350 lines with clean SRP         | ACCEPT as-is, document exception |

---

## 2. Server Directory (`src/lib/server/`) -- Items T3-01 through T3-13

### T3-01: `server/db/cleanupService.ts` (506 lines) -- DECOMPOSE

**Strategy:** Extract cleanup strategies (signal, spatial, device) into `cleanupService/` modules. Keep scheduler in main file.

**New File Manifest:**

| New File                                     | Content                             | Est. Lines |
| -------------------------------------------- | ----------------------------------- | ---------- |
| `server/db/cleanupService/index.ts`          | Barrel re-export                    | ~30        |
| `server/db/cleanupService/signalCleanup.ts`  | Signal record cleanup strategy      | ~150       |
| `server/db/cleanupService/spatialCleanup.ts` | Spatial/R-tree cleanup strategy     | ~120       |
| `server/db/cleanupService/deviceCleanup.ts`  | Device record cleanup strategy      | ~100       |
| `server/db/cleanupService/scheduler.ts`      | Cleanup scheduler and orchestration | ~120       |

**Verification:**

```bash
wc -l src/lib/server/db/cleanupService/*.ts
npx tsc --noEmit
```

---

### T3-02: `server/wireshark.ts` (494 lines) -- DECOMPOSE

**Strategy:** Extract packet parser, protocol decoder, and capture manager.

**New File Manifest:**

| New File                              | Content                              | Est. Lines |
| ------------------------------------- | ------------------------------------ | ---------- |
| `server/wireshark/index.ts`           | Barrel re-export                     | ~30        |
| `server/wireshark/packetParser.ts`    | Raw packet parsing                   | ~150       |
| `server/wireshark/protocolDecoder.ts` | Protocol identification and decoding | ~150       |
| `server/wireshark/captureManager.ts`  | Capture session lifecycle            | ~150       |

**Verification:**

```bash
wc -l src/lib/server/wireshark/*.ts
npx tsc --noEmit
```

---

### T3-03: `server/db/dbOptimizer.ts` (492 lines) -- DECOMPOSE

**Strategy:** Extract VACUUM logic, R-tree optimization, and index management.

**New File Manifest:**

| New File                                  | Content                           | Est. Lines |
| ----------------------------------------- | --------------------------------- | ---------- |
| `server/db/dbOptimizer/index.ts`          | Barrel re-export                  | ~30        |
| `server/db/dbOptimizer/vacuum.ts`         | VACUUM scheduling and execution   | ~150       |
| `server/db/dbOptimizer/rtreeOptimizer.ts` | R-tree spatial index optimization | ~150       |
| `server/db/dbOptimizer/indexManager.ts`   | Index creation/maintenance        | ~150       |

**Verification:**

```bash
wc -l src/lib/server/db/dbOptimizer/*.ts
npx tsc --noEmit
```

---

### T3-04: `server/kismet/kismetProxy.ts` (484 lines) -- DECOMPOSE

**Strategy:** Extract request rewriting, response transformation, and proxy middleware.

**New File Manifest:**

| New File                                         | Content                      | Est. Lines |
| ------------------------------------------------ | ---------------------------- | ---------- |
| `server/kismet/kismetProxy/index.ts`             | Barrel re-export             | ~30        |
| `server/kismet/kismetProxy/requestRewriter.ts`   | Request URL/header rewriting | ~150       |
| `server/kismet/kismetProxy/responseTransform.ts` | Response body transformation | ~150       |
| `server/kismet/kismetProxy/middleware.ts`        | Proxy middleware/routing     | ~150       |

**Verification:**

```bash
wc -l src/lib/server/kismet/kismetProxy/*.ts
npx tsc --noEmit
```

---

### T3-05: `server/kismet/api_client.ts` (472 lines) -- ACCEPT

**Rationale:** HTTP wrapper with clean method-per-endpoint pattern. No logic mixing.
Each method is a thin HTTP call with basic error handling. Single responsibility.

---

### T3-06: `server/wifite/processManager.ts` (453 lines) -- DECOMPOSE

**Strategy:** Extract process lifecycle, output parser, and result collector.

**New File Manifest:**

| New File                                          | Content                    | Est. Lines |
| ------------------------------------------------- | -------------------------- | ---------- |
| `server/wifite/processManager/index.ts`           | Barrel re-export           | ~30        |
| `server/wifite/processManager/lifecycle.ts`       | Process spawn/kill/restart | ~150       |
| `server/wifite/processManager/outputParser.ts`    | stdout/stderr parsing      | ~130       |
| `server/wifite/processManager/resultCollector.ts` | Attack result aggregation  | ~130       |

**Verification:**

```bash
wc -l src/lib/server/wifite/processManager/*.ts
npx tsc --noEmit
```

---

### T3-07: `server/hardware/detection/usb-detector.ts` (378 lines) -- ACCEPT

**Rationale:** USB enumeration is single-concern. Device classification is co-located
but logically part of detection. 378 lines is within acceptable range for a self-contained
hardware detection module.

---

### T3-08: `server/agent/frontend-tools.ts` (368 lines) -- DECOMPOSE

**Strategy:** Extract tool definitions into individual files under `agent/tools/`.

**New File Manifest:**

| New File                               | Content                      | Est. Lines |
| -------------------------------------- | ---------------------------- | ---------- |
| `server/agent/tools/index.ts`          | Barrel: tool registry array  | ~30        |
| `server/agent/tools/navigation.ts`     | Navigation tool handlers     | ~60        |
| `server/agent/tools/system-info.ts`    | System info tool handlers    | ~60        |
| `server/agent/tools/device-control.ts` | Device control tool handlers | ~60        |
| `server/agent/tools/data-query.ts`     | Data query tool handlers     | ~60        |
| `server/agent/tools/ui-interaction.ts` | UI interaction tool handlers | ~60        |

**Note:** This pattern matches item 5.4.2-13 (MCP dynamic-server tool extraction). Both
agent tool registration systems follow the same one-handler-per-file pattern.

**Verification:**

```bash
wc -l src/lib/server/agent/tools/*.ts
npx tsc --noEmit
```

---

### T3-09: `server/db/database.ts` (356 lines) -- ACCEPT

**Rationale:** Database facade after Phase 5.0 repository decomposition. Already decomposed
per memory notes (database.ts is now a thin facade over repository modules). 356 lines is
acceptable for a facade that aggregates multiple repositories. Stable.

---

### T3-10: `server/agent/runtime.ts` (335 lines) -- ACCEPT

**Rationale:** Single-concern agent execution runtime. 335 lines is acceptable for a
self-contained runtime that manages agent session lifecycle.

---

### T3-11: `server/services/kismet.service.ts` (331 lines) -- ACCEPT

**Rationale:** Verify not a duplicate of `services/kismet/` cluster first. If duplicate,
delete in Phase 4. If unique (server-side service adapter vs client-side service), ACCEPT
at 331 lines.

**Pre-decomposition check:**

```bash
# Verify this file provides different functionality from services/kismet/kismetService.ts
diff <(grep "export" src/lib/server/services/kismet.service.ts) \
     <(grep "export" src/lib/services/kismet/kismetService.ts)
```

---

### T3-12: `server/agent/tools.ts` (315 lines) -- DECOMPOSE

**Strategy:** Move each tool handler to individual files under `agent/tools/`. Pattern
matches T3-08 (frontend-tools.ts). If T3-08 is decomposed first, T3-12's tool handlers
merge into the same `agent/tools/` directory.

**Note:** Coordinate with T3-08 to avoid creating duplicate tool directories. Both
files' handlers go into the same `server/agent/tools/` barrel.

**Verification:**

```bash
wc -l src/lib/server/agent/tools/*.ts
npx tsc --noEmit
```

---

### T3-13: `server/websocket-server.ts` (304 lines) -- ACCEPT

**Rationale:** Core WebSocket server. Single responsibility. 304 lines is at threshold
but decomposition would scatter connection lifecycle across modules, increasing complexity.
Documented exception in Phase 5.4.0 Section 7.

---

## 3. Services Directory (`src/lib/services/`) -- Items T3-14 through T3-30

### T3-14: `services/db/signalDatabase.ts` (536 lines) -- DECOMPOSE

**Strategy:** Extract query builders, batch insert logic, and spatial queries.

**New File Manifest:**

| New File                                       | Content                       | Est. Lines |
| ---------------------------------------------- | ----------------------------- | ---------- |
| `services/db/signalDatabase/index.ts`          | Barrel re-export              | ~30        |
| `services/db/signalDatabase/queryBuilder.ts`   | Query construction helpers    | ~180       |
| `services/db/signalDatabase/batchInsert.ts`    | Batch insert with transaction | ~150       |
| `services/db/signalDatabase/spatialQueries.ts` | R-tree spatial query wrappers | ~180       |

**Verification:**

```bash
wc -l src/lib/services/db/signalDatabase/*.ts
npx tsc --noEmit
```

---

### T3-15: `services/streaming/dataStreamManager.ts` (529 lines) -- DECOMPOSE

**Strategy:** Extract stream lifecycle, backpressure management, and subscription registry.

**CAUTION:** Verify this is NOT part of the dead serviceInitializer island first.

**Pre-decomposition check:**

```bash
grep -r "dataStreamManager" src/ --include="*.ts" -l | grep -v "serviceInitializer"
# Non-empty = live callers -> proceed. Empty = dead -> defer to Phase 4.
```

**New File Manifest (if alive):**

| New File                                                | Content                          | Est. Lines |
| ------------------------------------------------------- | -------------------------------- | ---------- |
| `services/streaming/dataStreamManager/index.ts`         | Barrel re-export                 | ~30        |
| `services/streaming/dataStreamManager/lifecycle.ts`     | Stream creation/teardown         | ~180       |
| `services/streaming/dataStreamManager/backpressure.ts`  | Backpressure management          | ~150       |
| `services/streaming/dataStreamManager/subscriptions.ts` | Subscription registry + dispatch | ~150       |

**Verification:**

```bash
wc -l src/lib/services/streaming/dataStreamManager/*.ts
npx tsc --noEmit
```

---

### T3-16: `services/map/heatmapService.ts` (499 lines) -- DECOMPOSE

**Strategy:** Extract grid generation, color mapping, and canvas rendering.

**New File Manifest:**

| New File                                        | Content                         | Est. Lines |
| ----------------------------------------------- | ------------------------------- | ---------- |
| `services/map/heatmapService/index.ts`          | Barrel re-export                | ~30        |
| `services/map/heatmapService/gridGenerator.ts`  | Grid discretization             | ~150       |
| `services/map/heatmapService/colorMapping.ts`   | Value-to-color gradient mapping | ~120       |
| `services/map/heatmapService/canvasRenderer.ts` | Canvas/WebGL rendering          | ~180       |

**Verification:**

```bash
wc -l src/lib/services/map/heatmapService/*.ts
npx tsc --noEmit
```

---

### T3-17: `services/hackrf/timeWindowFilter.ts` (485 lines) -- DECOMPOSE

**Resolution (from Section 6.6 of source document):** 485 lines with mixed filter predicates
and buffer management. DECOMPOSE.

**New File Manifest:**

| New File                                         | Content                       | Est. Lines |
| ------------------------------------------------ | ----------------------------- | ---------- |
| `services/hackrf/timeWindowFilter/index.ts`      | Barrel re-export              | ~30        |
| `services/hackrf/timeWindowFilter/predicates.ts` | Time window filter predicates | ~200       |
| `services/hackrf/timeWindowFilter/bufferRing.ts` | Ring buffer data structure    | ~150       |
| `services/hackrf/timeWindowFilter/filter.ts`     | Orchestration + public API    | ~135       |

**Decomposition Template Applied:** Mixed Filter/Buffer Service template from Section 6.6.

**Verification:**

```bash
wc -l src/lib/services/hackrf/timeWindowFilter/*.ts
npx tsc --noEmit
```

---

### T3-18: `services/hackrf/hackrfService.ts` (481 lines) -- DECOMPOSE

**Strategy:** Extract device lifecycle, configuration management, and streaming setup.

**New File Manifest:**

| New File                                           | Content                         | Est. Lines |
| -------------------------------------------------- | ------------------------------- | ---------- |
| `services/hackrf/hackrfService/index.ts`           | Barrel re-export                | ~30        |
| `services/hackrf/hackrfService/deviceLifecycle.ts` | Device open/close/reset         | ~150       |
| `services/hackrf/hackrfService/configuration.ts`   | Device configuration management | ~150       |
| `services/hackrf/hackrfService/streaming.ts`       | Data streaming setup            | ~150       |

**Verification:**

```bash
wc -l src/lib/services/hackrf/hackrfService/*.ts
npx tsc --noEmit
```

---

### T3-19: `services/hackrf/sweep-manager/error/ErrorTracker.ts` (457 lines) -- DEFER

**Resolution:** Will be consolidated into `sdr-common/error/` by Phase 5.2 Task 5.2.1.
Do not decompose independently. Duplicate work would be wasted.

---

### T3-20: `services/map/networkAnalyzer.ts` (435 lines) -- DECOMPOSE

**Strategy:** Extract protocol analysis, topology mapping, and metrics calculation.

**New File Manifest:**

| New File                                           | Content                          | Est. Lines |
| -------------------------------------------------- | -------------------------------- | ---------- |
| `services/map/networkAnalyzer/index.ts`            | Barrel re-export                 | ~30        |
| `services/map/networkAnalyzer/protocolAnalysis.ts` | Protocol identification/analysis | ~140       |
| `services/map/networkAnalyzer/topologyMapping.ts`  | Network topology construction    | ~130       |
| `services/map/networkAnalyzer/metrics.ts`          | Network metrics calculation      | ~120       |

**Verification:**

```bash
wc -l src/lib/services/map/networkAnalyzer/*.ts
npx tsc --noEmit
```

---

### T3-21: `services/hackrf/signalProcessor.ts` (432 lines) -- DECOMPOSE

**Strategy:** Extract FFT processing, peak detection, and signal classification.

**New File Manifest:**

| New File                                          | Content                       | Est. Lines |
| ------------------------------------------------- | ----------------------------- | ---------- |
| `services/hackrf/signalProcessor/index.ts`        | Barrel re-export              | ~30        |
| `services/hackrf/signalProcessor/fftProcessor.ts` | FFT computation and windowing | ~140       |
| `services/hackrf/signalProcessor/peakDetector.ts` | Peak detection algorithm      | ~130       |
| `services/hackrf/signalProcessor/classifier.ts`   | Signal type classification    | ~130       |

**Verification:**

```bash
wc -l src/lib/services/hackrf/signalProcessor/*.ts
npx tsc --noEmit
```

---

### T3-22: `services/api/kismet.ts` (428 lines) -- ACCEPT

**Rationale:** API client wrapper with clean HTTP method pattern. Transformation is
per-endpoint, not extractable without breaking the method-per-endpoint cohesion.

---

### T3-23: `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` (423 lines) -- DEFER

**Resolution:** Will be consolidated into `sdr-common/frequency/` by Phase 5.2. Do not
decompose independently.

---

### T3-24: `services/map/webglHeatmapRenderer.ts` (411 lines) -- ACCEPT

**Rationale:** WebGL shader setup + rendering is inherently coupled. Extracting shaders
would create non-standard file types (.glsl) requiring custom bundler configuration.
411 lines is acceptable for a self-contained WebGL renderer.

---

### T3-25: `services/map/signalClustering.ts` (411 lines) -- DECOMPOSE

**Strategy:** Extract clustering algorithm, cluster metrics, and spatial indexing.

**New File Manifest:**

| New File                                        | Content                              | Est. Lines |
| ----------------------------------------------- | ------------------------------------ | ---------- |
| `services/map/signalClustering/index.ts`        | Barrel re-export                     | ~30        |
| `services/map/signalClustering/algorithm.ts`    | DBSCAN/k-means clustering            | ~140       |
| `services/map/signalClustering/metrics.ts`      | Cluster quality metrics              | ~120       |
| `services/map/signalClustering/spatialIndex.ts` | Spatial indexing for cluster queries | ~120       |

**Verification:**

```bash
wc -l src/lib/services/map/signalClustering/*.ts
npx tsc --noEmit
```

---

### T3-26: `services/db/dataAccessLayer.ts` (378 lines) -- ACCEPT

**Rationale:** Clean DAL pattern. All methods are thin query wrappers. Single responsibility.

---

### T3-27: `services/websocket/base.ts` (376 lines) -- ACCEPT

**Rationale:** Base WebSocket class. Single inheritance concern. Extracting methods would
require passing `this` context, adding complexity. Documented exception in Phase 5.4.0 Section 7.

---

### T3-28: `services/gsm-evil/server.ts` (356 lines) -- ACCEPT

**Rationale:** Process management for GSM Evil. Clean single-concern. 356 lines with
clean SRP.

---

### T3-29: `services/api/system.ts` (328 lines) -- ACCEPT

**Rationale:** System API client. Clean HTTP wrapper pattern. Documented exception in
Phase 5.4.0 Section 7.

---

### T3-30: `services/monitoring/systemHealth.ts` (552 lines) -- NOTE

**Already listed in Tier 2 (item 5.4.2-21).** Do not double-count. Decomposition plan
is in Phase-5.4.10.

---

## 4. Execution Summary

| Action    | Count | Items                                                                                                   |
| --------- | ----- | ------------------------------------------------------------------------------------------------------- |
| DECOMPOSE | 12    | T3-01, T3-02, T3-03, T3-04, T3-06, T3-08, T3-12, T3-14, T3-15, T3-16, T3-17, T3-18, T3-20, T3-21, T3-25 |
| ACCEPT    | 14    | T3-05, T3-07, T3-09, T3-10, T3-11, T3-13, T3-22, T3-24, T3-26, T3-27, T3-28, T3-29                      |
| DEFER     | 2     | T3-19 (Phase 5.2), T3-23 (Phase 5.2)                                                                    |
| NOTE      | 1     | T3-30 (duplicate of Tier 2)                                                                             |

**Note:** T3-12 (agent/tools.ts) and T3-08 (frontend-tools.ts) share the same target
directory (`server/agent/tools/`). Execute T3-08 first, then T3-12 merges into the
existing structure.

---

## 5. Commit Strategy for Tier 3

Tier 3 files may be batched by directory (up to 3 files per commit) when the changes
are trivial extractions:

| Commit | Files                                         | Message                                                               |
| ------ | --------------------------------------------- | --------------------------------------------------------------------- |
| 31     | T3-01 cleanupService                          | `refactor(db): decompose cleanupService into strategies`              |
| 32     | T3-02 wireshark                               | `refactor(server): decompose wireshark into modules`                  |
| 33     | T3-03 dbOptimizer + T3-04 kismetProxy         | `refactor(server): decompose dbOptimizer and kismetProxy`             |
| 34     | T3-06 wifite/processManager                   | `refactor(wifite): decompose processManager`                          |
| 35     | T3-08 frontend-tools + T3-12 tools            | `refactor(agent): extract tool handlers into per-tool files`          |
| 36     | T3-14 signalDatabase                          | `refactor(db): decompose signalDatabase into modules`                 |
| 37     | T3-15 dataStreamManager                       | `refactor(streaming): decompose dataStreamManager`                    |
| 38     | T3-16 heatmapService + T3-17 timeWindowFilter | `refactor: decompose heatmapService and timeWindowFilter`             |
| 39     | T3-18 hackrfService                           | `refactor(hackrf): decompose hackrfService`                           |
| 40     | T3-20 networkAnalyzer + T3-21 signalProcessor | `refactor(map/hackrf): decompose networkAnalyzer and signalProcessor` |
| 41     | T3-25 signalClustering                        | `refactor(map): decompose signalClustering`                           |

---

## 6. Standards Compliance

| Standard             | Compliance                                                     |
| -------------------- | -------------------------------------------------------------- |
| Barr Group Rule 1.3  | All decomposed files <200 lines; all accepted files <500 lines |
| NASA/JPL Rule 2.4    | Functions extracted into appropriately-sized modules           |
| CERT C MEM00         | Process spawn/cleanup in same module where applicable          |
| CERT C MSC41         | No secrets in any module                                       |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                             |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.11 -- Tier 3: Server and Services Directory Resolution
```
