# Phase 5.4.10 -- Tier 2: Types, Data, and Remaining Decomposition (Items 5.4.2-16 through 5.4.2-23)

```
Document ID:    ARGOS-AUDIT-P5.4.10-TIER2-TYPES-DATA-REMAINING
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.10 -- Decompose 8 Tier 2 type/data/remaining files (500-999 lines)
Risk Level:     LOW-MEDIUM
Prerequisites:  Phase 5.4.9 (Tier 2 components/services) COMPLETE
Files Touched:  8 source files -> ~33 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Scope

This sub-task covers Tier 2 items 5.4.2-16 through 5.4.2-23 -- type files, data services,
and remaining files completing the Tier 2 scope.

| Item     | File                                                         | Lines | Execution Order |
| -------- | ------------------------------------------------------------ | ----- | --------------- |
| 5.4.2-16 | `src/lib/server/kismet/types.ts`                             | 616   | 23              |
| 5.4.2-17 | `src/lib/services/kismet/deviceManager.ts`                   | 615   | 24              |
| 5.4.2-18 | `src/lib/services/map/signalFiltering.ts`                    | 586   | 25              |
| 5.4.2-19 | `src/lib/server/kismet/webSocketManager.ts`                  | 586   | 26              |
| 5.4.2-20 | `src/lib/services/kismet/kismetService.ts`                   | 584   | 27              |
| 5.4.2-21 | `src/lib/services/monitoring/systemHealth.ts`                | 552   | 28              |
| 5.4.2-22 | `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 546   | 29              |
| 5.4.2-23 | `src/lib/services/map/signalInterpolation.ts`                | 544   | 30              |

---

## 2. Item 5.4.2-16: kismet/types.ts (616 lines)

### Content Analysis

Monolithic type file. Contains Kismet device interfaces, network interfaces,
API response types, WebSocket message types, and internal service types. Multiple
`KismetDevice` variants (raw, normalized, enriched).

### Decomposition Strategy

Split into layered type files aligned with the data transformation pipeline.

### New File Manifest

| New File                           | Content                                      | Est. Lines |
| ---------------------------------- | -------------------------------------------- | ---------- |
| `server/kismet/types/index.ts`     | Barrel re-export of all types                | ~30        |
| `server/kismet/types/raw-api.ts`   | Kismet REST API response shapes (snake_case) | ~150       |
| `server/kismet/types/device.ts`    | Normalized KismetDevice (camelCase)          | ~120       |
| `server/kismet/types/network.ts`   | Network/SSID types                           | ~80        |
| `server/kismet/types/websocket.ts` | WebSocket message types                      | ~80        |
| `server/kismet/types/internal.ts`  | Service-internal types                       | ~80        |

### Key Constraints

- This decomposition directly addresses the KismetDevice type duplication flagged in the Type Duplicate Audit (5 definitions, 5 different shapes).
- `raw-api.ts` uses snake_case field names matching Kismet's REST API.
- `device.ts` uses camelCase field names for the normalized domain model.
- Import path: `from '$lib/server/kismet/types'` resolves via barrel.

### Verification

```bash
wc -l src/lib/server/kismet/types/*.ts
grep -r "from.*kismet/types" src/ --include="*.ts" -l  # all importers resolve
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

## 3. Item 5.4.2-17: deviceManager.ts (615 lines)

### Content Analysis

Device data management service. Normalization of raw Kismet device records,
LRU caching of device state, diffing engine for detecting device state changes, batch
update aggregation.

### Decomposition Strategy

Extract normalizer, cache, and diff engine into separate modules. Keep orchestration
in the main manager file.

### New File Manifest

| New File                                      | Content                                 | Est. Lines |
| --------------------------------------------- | --------------------------------------- | ---------- |
| `services/kismet/deviceManager/index.ts`      | Barrel re-export                        | ~30        |
| `services/kismet/deviceManager/normalizer.ts` | Raw-to-domain transformation            | ~180       |
| `services/kismet/deviceManager/cache.ts`      | LRU cache implementation                | ~150       |
| `services/kismet/deviceManager/diffEngine.ts` | State change detection                  | ~150       |
| `services/kismet/deviceManager/manager.ts`    | Orchestration, batch update aggregation | ~130       |

### Verification

```bash
wc -l src/lib/services/kismet/deviceManager/*.ts
npx tsc --noEmit
npx madge --circular src/lib/services/kismet/deviceManager/
```

---

## 4. Item 5.4.2-18: signalFiltering.ts (586 lines)

### Content Analysis

Signal filter predicate library. Contains filter functions for frequency range,
signal strength threshold, time window, device type, geographic bounds, and composite
filter builder.

### Decomposition Strategy

Extract individual filter predicates into logical groupings. Keep composite builder
as the public API.

### New File Manifest

| New File                                          | Content                              | Est. Lines |
| ------------------------------------------------- | ------------------------------------ | ---------- |
| `services/map/signalFiltering/index.ts`           | Barrel re-export                     | ~30        |
| `services/map/signalFiltering/frequency.ts`       | Frequency range filter predicates    | ~90        |
| `services/map/signalFiltering/strength.ts`        | Signal strength threshold predicates | ~80        |
| `services/map/signalFiltering/temporal.ts`        | Time window filter predicates        | ~90        |
| `services/map/signalFiltering/geographic.ts`      | Geographic bounds filter predicates  | ~90        |
| `services/map/signalFiltering/deviceType.ts`      | Device type filter predicates        | ~80        |
| `services/map/signalFiltering/compositeFilter.ts` | Composite filter builder             | ~100       |

### Key Constraints

- Each predicate file exports pure functions. Zero side effects, zero state.
- The composite builder imports from all predicate files and constructs a combined filter function.
- Dependency direction: `compositeFilter.ts` -> all predicates. No reverse dependencies.

### Verification

```bash
wc -l src/lib/services/map/signalFiltering/*.ts
npx tsc --noEmit
npx madge --circular src/lib/services/map/signalFiltering/
```

---

## 5. Item 5.4.2-19: webSocketManager.ts (586 lines)

### Content Analysis

WebSocket connection pool to Kismet. Connection lifecycle, message routing to
subscribers, automatic reconnection, health ping, message serialization/deserialization.

### Decomposition Strategy

Extract connection pool management and message routing into separate modules. Keep
lifecycle management in the main manager.

### New File Manifest

| New File                                           | Content                              | Est. Lines |
| -------------------------------------------------- | ------------------------------------ | ---------- |
| `server/kismet/webSocketManager/index.ts`          | Barrel re-export                     | ~30        |
| `server/kismet/webSocketManager/connectionPool.ts` | Pool management + reconnection logic | ~200       |
| `server/kismet/webSocketManager/messageRouter.ts`  | Subscription registry + dispatch     | ~180       |
| `server/kismet/webSocketManager/manager.ts`        | Lifecycle management, health ping    | ~180       |

### Key Constraints

- The `globalThis` singleton pattern (per memory leak fixes) must remain in the barrel `index.ts`, not in submodules.
- WebSocket close/cleanup must be in the same module as connection creation (CERT C MEM00).

### Verification

```bash
wc -l src/lib/server/kismet/webSocketManager/*.ts
npx tsc --noEmit
npx madge --circular src/lib/server/kismet/webSocketManager/
```

---

## 6. Item 5.4.2-20: kismetService.ts (584 lines)

### Content Analysis

High-level Kismet service. Polling orchestration for device lists, SSID lists,
and alerts. Response transformation from raw API to domain types. Cache invalidation logic.

### Decomposition Strategy

Extract polling timer management and response transformation into separate modules.
Keep service facade as the public API.

### New File Manifest

| New File                                       | Content                             | Est. Lines |
| ---------------------------------------------- | ----------------------------------- | ---------- |
| `services/kismet/kismetService/index.ts`       | Barrel re-export                    | ~30        |
| `services/kismet/kismetService/poller.ts`      | Polling timer management            | ~180       |
| `services/kismet/kismetService/transformer.ts` | API response to domain type mapping | ~200       |
| `services/kismet/kismetService/service.ts`     | Service facade, cache invalidation  | ~180       |

### Verification

```bash
wc -l src/lib/services/kismet/kismetService/*.ts
npx tsc --noEmit
```

---

## 7. Item 5.4.2-21: systemHealth.ts (552 lines)

### Content Analysis

System health metric collection. CPU usage reader, memory stats, disk usage,
service availability checks, temperature monitoring (RPi thermal zone), metric aggregation.

### Decomposition Strategy

Extract per-metric collectors into individual modules. Keep aggregation in the main file.

### New File Manifest

| New File                                                   | Content                     | Est. Lines |
| ---------------------------------------------------------- | --------------------------- | ---------- |
| `services/monitoring/systemHealth/index.ts`                | Barrel re-export            | ~30        |
| `services/monitoring/systemHealth/cpuCollector.ts`         | CPU usage reader            | ~90        |
| `services/monitoring/systemHealth/memoryCollector.ts`      | Memory stats reader         | ~80        |
| `services/monitoring/systemHealth/diskCollector.ts`        | Disk usage reader           | ~80        |
| `services/monitoring/systemHealth/temperatureCollector.ts` | RPi thermal zone reader     | ~60        |
| `services/monitoring/systemHealth/serviceChecker.ts`       | Service availability checks | ~100       |
| `services/monitoring/systemHealth/aggregator.ts`           | Metric aggregation          | ~100       |

### CAUTION (per AC-5)

Verify this file is NOT part of the dead serviceInitializer island before decomposing.
If imported only by serviceInitializer, defer to Phase 4. If imported by live API routes,
proceed with decomposition.

**Pre-decomposition verification:**

```bash
grep -r "systemHealth" src/ --include="*.ts" --include="*.svelte" -l | \
  grep -v "serviceInitializer"
# If results are non-empty -> file has live callers -> proceed
# If empty -> file is dead -> defer to Phase 4
```

### Verification

```bash
wc -l src/lib/services/monitoring/systemHealth/*.ts
npx tsc --noEmit
```

---

## 8. Item 5.4.2-22: intelligent-scan-stream/+server.ts (546 lines)

### Content Analysis

SSE streaming endpoint for GSM intelligent scanning. Contains stream parser
for GSM Evil output, frequency band scanning logic, IMSI capture processing, and SSE
event formatting.

### Decomposition Strategy

Extract stream parser and scan logic into co-located TypeScript modules. Keep SSE
endpoint handler in `+server.ts`.

### New File Manifest

| New File                                                      | Content                 | Est. Lines |
| ------------------------------------------------------------- | ----------------------- | ---------- |
| `routes/api/gsm-evil/intelligent-scan-stream/+server.ts`      | SSE endpoint handler    | ~180       |
| `routes/api/gsm-evil/intelligent-scan-stream/streamParser.ts` | GSM output parsing      | ~200       |
| `routes/api/gsm-evil/intelligent-scan-stream/scanLogic.ts`    | Band scanning algorithm | ~150       |

### Key Constraints

- SSE flow remains in `+server.ts` (per established pattern: SSE ReadableStream closures cannot be fully extracted to services).
- **SECURITY NOTE:** Per runtime validation audit, the sibling `gsm-evil/control/+server.ts` has a CRITICAL command injection at line 91. While decomposing this directory, add a TODO comment referencing the injection finding but do NOT fix it in this phase (that is Phase 6 scope -- runtime validation).

### Verification

```bash
wc -l src/routes/api/gsm-evil/intelligent-scan-stream/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
npm run build 2>&1 | tail -5
```

---

## 9. Item 5.4.2-23: signalInterpolation.ts (544 lines)

### Content Analysis

Spatial interpolation algorithms for signal heatmap generation. IDW (inverse
distance weighting), kriging approximation, natural neighbor interpolation, grid
discretization, boundary handling.

### Decomposition Strategy

Extract each interpolation algorithm into its own module. Keep grid management and
algorithm selection in the main interpolator.

### New File Manifest

| New File                                              | Content                              | Est. Lines |
| ----------------------------------------------------- | ------------------------------------ | ---------- |
| `services/map/signalInterpolation/index.ts`           | Barrel re-export                     | ~30        |
| `services/map/signalInterpolation/idw.ts`             | Inverse distance weighting           | ~120       |
| `services/map/signalInterpolation/kriging.ts`         | Kriging approximation                | ~150       |
| `services/map/signalInterpolation/naturalNeighbor.ts` | Natural neighbor interpolation       | ~120       |
| `services/map/signalInterpolation/interpolator.ts`    | Grid management, algorithm selection | ~150       |

### Key Constraints

- Per AC-6: this file is confirmed ALIVE (imported by heatmapService.ts). Proceed with decomposition.
- Each algorithm module exports a pure function taking sample points and grid parameters, returning interpolated values.
- The `interpolator.ts` module selects the algorithm based on configuration and delegates.

### Verification

```bash
wc -l src/lib/services/map/signalInterpolation/*.ts
npx tsc --noEmit
npx madge --circular src/lib/services/map/signalInterpolation/
```

---

## 10. Execution Order Within This Sub-Task

| Order | Item     | File                    | Commit Message                                                    |
| ----- | -------- | ----------------------- | ----------------------------------------------------------------- |
| 23    | 5.4.2-16 | kismet/types.ts         | `refactor(kismet): split types into layered type files`           |
| 24    | 5.4.2-17 | deviceManager.ts        | `refactor(kismet): decompose deviceManager into modules`          |
| 25    | 5.4.2-18 | signalFiltering.ts      | `refactor(map): decompose signalFiltering into predicate modules` |
| 26    | 5.4.2-19 | webSocketManager.ts     | `refactor(kismet): decompose webSocketManager into modules`       |
| 27    | 5.4.2-20 | kismetService.ts        | `refactor(kismet): decompose kismetService into modules`          |
| 28    | 5.4.2-21 | systemHealth.ts         | `refactor(monitoring): extract metric collectors`                 |
| 29    | 5.4.2-22 | intelligent-scan-stream | `refactor(gsm): extract stream parser and scan logic`             |
| 30    | 5.4.2-23 | signalInterpolation.ts  | `refactor(map): extract interpolation algorithm modules`          |

**One commit per file.** Each commit must pass `npx tsc --noEmit` and `npm run build`.

---

## 11. Standards Compliance

| Standard             | Compliance                                                     |
| -------------------- | -------------------------------------------------------------- |
| Barr Group Rule 1.3  | All files <250 lines post-split                                |
| NASA/JPL Rule 2.4    | Algorithm functions extracted into appropriately-sized modules |
| CERT C MEM00         | WebSocket open/close in same module (connectionPool.ts)        |
| CERT C MSC41         | No secrets; type files contain only interfaces                 |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                             |
| DoD STIG V-222602    | AC-5 and AC-6 verified before decomposition                    |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.10 -- Tier 2: Types, Data, and Remaining Decomposition
```
