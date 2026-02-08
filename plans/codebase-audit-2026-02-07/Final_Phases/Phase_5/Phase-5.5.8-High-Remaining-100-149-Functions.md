# Phase 5.5.8 -- High Remaining 100-149 Line Functions

| Field                | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.8                                                              |
| **Phase**            | 5.5.8                                                                           |
| **Title**            | High Remaining 100-149 Line Functions (20 functions)                            |
| **Risk Level**       | LOW -- internal refactors with no public API changes                            |
| **Prerequisites**    | Phase 5.5.0 (Assessment), Phases 5.5.6-5.5.7 (detailed HIGH functions) complete |
| **Estimated Effort** | 3 hours                                                                         |
| **Files Touched**    | ~20 files refactored                                                            |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7      |
| **Audit Date**       | 2026-02-08                                                                      |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                             |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                           |

---

## 1. Objective

Decompose the remaining 20 HIGH-priority functions (100-149 lines) that are NOT individually detailed in sub-tasks 5.5.6 and 5.5.7, and are NOT handled by Phases 5.1 or 5.2.

The 8 functions detailed in 5.5.6-5.5.7 account for 8 of the 28 Phase 5.5 HIGH residual. This document covers the remaining 20. All follow the decomposition patterns documented in Phase 5.5.13.

---

## 2. Scope Clarification

### 2.1 HIGH Function Accounting

| Category                                 | Count  | Sub-task  |
| ---------------------------------------- | ------ | --------- |
| Total HIGH (100-149 lines)               | 30     | --        |
| Handled by Phase 5.2 (Service Layer)     | 2      | --        |
| Detailed in 5.5.6 (Visualization/MCP)    | 3      | 5.5.6     |
| Detailed in 5.5.7 (DB/Recovery/Hardware) | 5      | 5.5.7     |
| **Remaining (this document)**            | **20** | **5.5.8** |

---

## 3. Function Inventory

The following 20 functions are in the 100-149 line range. File paths relative to `src/lib/` unless noted with `src/routes/`.

| #   | Est. Lines | File                                                       | Function                      | Pattern to Apply |
| --- | ---------- | ---------------------------------------------------------- | ----------------------------- | ---------------- |
| 1   | ~145       | `components/hackrf/WaterfallDisplay.svelte`                | `renderWaterfall`             | Extract-and-Name |
| 2   | ~140       | `server/agent/tool-execution/executor.ts`                  | `executeToolCall`             | Early-Return     |
| 3   | ~138       | `components/tactical-map/layers/DeviceClusterLayer.svelte` | `updateClusters`              | Extract-and-Name |
| 4   | ~135       | `server/kismet/security_analyzer.ts`                       | `analyzeSecurityPosture`      | Extract-and-Name |
| 5   | ~132       | `services/gsm-evil/gsmEvilService.ts`                      | `performFrequencyScan`        | Extract-and-Name |
| 6   | ~130       | `components/dashboard/NetworkTopology.svelte`              | `drawNetworkGraph`            | Extract-and-Name |
| 7   | ~128       | `server/hardware/detection/bluetooth-detector.ts`          | `detectBluetoothDevices`      | Data-Driven      |
| 8   | ~125       | `routes/api/kismet/devices/+server.ts`                     | `GET` (handler)               | Extract-and-Name |
| 9   | ~122       | `services/drone/missionPlanner.ts`                         | `calculateOptimalRoute`       | Extract-and-Name |
| 10  | ~120       | `components/fusion/TrafficAnalysis.svelte`                 | `processTrafficData`          | Extract-and-Name |
| 11  | ~118       | `server/agent/tool-execution/detection/tool-detector.ts`   | `detectAvailableTools`        | Data-Driven      |
| 12  | ~115       | `components/hackrf/SignalClassifier.svelte`                | `classifySignals`             | Data-Driven      |
| 13  | ~113       | `server/kismet/api_client.ts`                              | `fetchDeviceList`             | Extract-and-Name |
| 14  | ~110       | `routes/api/rf/data-stream/+server.ts`                     | `GET` (SSE handler)           | Extract-and-Name |
| 15  | ~108       | `services/map/geoFencing.ts`                               | `evaluateGeoFenceRules`       | Data-Driven      |
| 16  | ~106       | `components/tactical-map/controls/FilterPanel.svelte`      | `applyFilters`                | Extract-and-Name |
| 17  | ~105       | `server/wifite/wifiteController.ts`                        | `startWifiteSession`          | Early-Return     |
| 18  | ~103       | `services/localization/signalTriangulation.ts`             | `triangulatePosi`             | Extract-and-Name |
| 19  | ~102       | `routes/api/hardware/scan/+server.ts`                      | `GET` (hardware scan handler) | Extract-and-Name |
| 20  | ~100       | `components/dashboard/AlertPanel.svelte`                   | `renderAlertList`             | Builder          |

**IMPORTANT**: Exact line counts are estimated from scanner output. Verify each against the live codebase before decomposition. Some may have been reduced below 100 lines by prior phase work.

---

## 4. Decomposition Approach by Pattern

### 4.1 Extract-and-Name (#1, 3, 4, 5, 6, 8, 9, 10, 13, 14, 16, 18, 19)

For each function:

1. Identify 2-4 natural section boundaries
2. Name each section as a function using verb-noun format
3. Reduce the original to an orchestrator calling the named functions
4. Target: orchestrator 20-35 lines, sub-functions under 55 lines

### 4.2 Data-Driven (#7, 11, 12, 15)

For each function with a switch/if-else chain:

1. Define a lookup table or strategy map at module level
2. Replace the conditional chain with a table lookup or `Array.find()`
3. Target: function body 10-25 lines, data table at module scope

### 4.3 Early-Return (#2, 17)

For functions with deep nesting:

1. Convert nested if/else to flat guard clauses with early returns
2. Extract complex validation or setup blocks to helper functions
3. Target: reduce nesting from 4+ levels to 1-2 levels

### 4.4 Builder (#20)

For HTML/UI construction functions:

1. Extract each section/panel builder to a named function
2. Assemble sections in the original function
3. Target: assembler 10-20 lines, section builders 15-25 lines

---

## 5. Example Decomposition Plans

### 5.1 `renderWaterfall` (~145 lines)

**New functions**:
| Function Name | Est. Lines | Responsibility |
| ---------------------------------- | ---------- | --------------------------------------- |
| `shiftWaterfallCanvas(ctx)` | 15-20 | Shift existing pixel data down one row |
| `computeRowColors(spectrumData)` | 20-30 | Map frequency bins to RGBA colors |
| `drawWaterfallRow(ctx, colors, y)` | 15-20 | Draw single pixel row at position y |
| `updateWaterfallScale(ctx, range)` | 15-20 | Update frequency/time axis labels |
| `renderWaterfall(canvas, data)` | 15-25 | Orchestrator |

### 5.2 `detectBluetoothDevices` (~128 lines)

**Data-driven conversion**:
| Item | Est. Lines | Responsibility |
| --------------------------------- | ---------- | --------------------------------------- |
| `BT_DEVICE_MATCHERS[]` (data) | 40-50 | Device class-of-device lookup table |
| `probeBTDevice(spec, hciOutput)` | 20-30 | Match one device against HCI output |
| `detectBluetoothDevices()` | 10-15 | Orchestrator with data table |

### 5.3 `executeToolCall` (~140 lines)

**Early-return conversion**:
| Function Name | Est. Lines | Responsibility |
| ----------------------------------- | ---------- | ----------------------------------- |
| `validateToolCall(call)` | 15-20 | Validate tool name, args, permissions|
| `resolveToolExecutor(toolName)` | 15-20 | Look up executor for tool type |
| `executeWithTimeout(executor, args)`| 25-35 | Execute with timeout and error wrap |
| `executeToolCall(call)` | 20-30 | Guard clauses + delegation |

---

## 6. Verification

### 6.1 Per-Function Verification

After each function decomposition:

```bash
python3 scripts/audit-function-sizes-v2.py <modified-file>
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 6.2 Batch Verification (After All 20 Functions)

```bash
echo "=== HIGH FUNCTIONS REMAINING ==="
python3 scripts/audit-function-sizes-v2.py src/ 2>&1 | awk '$1 >= 100 && $1 < 150'
# TARGET: Only Phase 5.2 handled functions should appear (if those phases not yet complete)

npm run build && npm run typecheck
```

---

## 7. Test Requirements

Each decomposed function that produces a pure extracted function requires unit tests:

| Function Category                          | Test Requirement                                      |
| ------------------------------------------ | ----------------------------------------------------- |
| Pure data transformer (parser, normalizer) | 3+ test cases: valid input, edge case, invalid input  |
| Configuration builder                      | 2+ test cases: default config, custom config          |
| Validator/guard                            | 4+ test cases: valid, each invalid category, boundary |

**Estimated test effort**: 20 functions x ~9 min/function = ~3 hours

---

## 8. Commit Strategy

Group commits by directory to minimize context switching:

```
refactor(phase-5.5): decompose HIGH functions in components/ (batch 1: 6 functions)
refactor(phase-5.5): decompose HIGH functions in server/ (batch 2: 6 functions)
refactor(phase-5.5): decompose HIGH functions in services/ (batch 3: 4 functions)
refactor(phase-5.5): decompose HIGH functions in routes/ (batch 4: 4 functions)
```

**Multi-function files**: When a file contains 2+ oversized functions, decompose ALL in a SINGLE commit.

---

## 9. Cross-Phase Notes

- **Phase 5.1**: Any functions in God Page files are handled by Phase 5.1, not this document.
- **Phase 5.2**: 2 HIGH functions in `BufferManager.ts` and `sweepManager.ts` are handled by Phase 5.2.
- **Phase 4.1 (Dead Code)**: Cross-reference each function with the dead code audit. If the file is marked dead, skip the decomposition (the file will be deleted).
- **Phase 5.4 (File Size)**: Some decompositions may require creating new helper files. Verify new files stay under 300 lines.

---

**END OF DOCUMENT**
