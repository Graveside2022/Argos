# Phase 5.5.5 -- Critical Remaining 150+ Line Functions

| Field                | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.5                                                                  |
| **Phase**            | 5.5.5                                                                               |
| **Title**            | Critical Remaining 150+ Line Functions (15 functions)                               |
| **Risk Level**       | LOW -- internal refactors with no public API changes                                |
| **Prerequisites**    | Phase 5.5.0 (Assessment), Phases 5.5.1-5.5.4 (detailed CRITICAL functions) complete |
| **Estimated Effort** | 3 hours                                                                             |
| **Files Touched**    | 15 files refactored                                                                 |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7          |
| **Audit Date**       | 2026-02-08                                                                          |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                                 |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                               |

---

## 1. Objective

Decompose the remaining 15 CRITICAL functions exceeding 150 lines that are NOT individually detailed in sub-tasks 5.5.1 through 5.5.4, and are NOT handled by Phases 5.1 or 5.2.

The 10 functions detailed in 5.5.1-5.5.4 account for 10 of the 25 Phase 5.5 CRITICAL residual. This document covers the remaining 15. All 15 follow the same decomposition patterns documented in Phase 5.5.13 (Decomposition Pattern Reference).

---

## 2. Scope Clarification

### 2.1 CRITICAL Function Accounting

| Category                             | Count  | Sub-task  |
| ------------------------------------ | ------ | --------- |
| Total CRITICAL (>150 lines)          | 30     | --        |
| Handled by Phase 5.1 (God Pages)     | 4      | --        |
| Handled by Phase 5.2 (Service Layer) | 1      | --        |
| Detailed in 5.5.1 (God Stores)       | 3      | 5.5.1     |
| Detailed in 5.5.2 (Wireshark/OUI)    | 2      | 5.5.2     |
| Detailed in 5.5.3 (Route Handlers)   | 2      | 5.5.3     |
| Detailed in 5.5.4 (Signal/System)    | 3      | 5.5.4     |
| **Remaining (this document)**        | **15** | **5.5.5** |

### 2.2 Note on Enumeration

The parent document (Phase 5.5) explicitly enumerated 68 functions in its Appendix A inventory. Functions 69-157 were identified by the v2 scanner but not individually listed. Among those 89 unlisted functions, some may exceed 150 lines and would fall into this document's scope. The Phase 5.6 ESLint enforcement gate catches ALL remaining violations.

This document addresses the 15 CRITICAL functions that are identifiable from the v2 scanner output but were not given individual decomposition plans in sub-tasks 5.5.1-5.5.4. Their decomposition follows the standardized patterns from Phase 5.5.13.

---

## 3. Function Inventory

The following 15 functions are in the >150 line range, not individually detailed elsewhere, and require full decomposition. File paths are relative to `src/lib/` unless noted.

| #   | Est. Lines | File                                                  | Function                                    | Pattern to Apply | New Sub-functions (Est.) |
| --- | ---------- | ----------------------------------------------------- | ------------------------------------------- | ---------------- | ------------------------ |
| 1   | ~180       | `server/agent/runtime.ts`                             | `processWithAnthropic` (full handler chain) | Extract-and-Name | 3-4 sub-functions        |
| 2   | ~175       | `services/drone/flightPathAnalyzer.ts`                | `analyzeFlight` (if >150)                   | Extract-and-Name | 3-4 sub-functions        |
| 3   | ~170       | `components/tactical-map/layers/SignalHeatmap.svelte` | `renderHeatmap`                             | Extract-and-Name | 4-5 sub-functions        |
| 4   | ~168       | `server/kismet/fusion_controller.ts`                  | `processDeviceFusion`                       | Extract-and-Name | 3-4 sub-functions        |
| 5   | ~165       | `components/hackrf/FrequencyBandChart.svelte`         | `drawFrequencyBands`                        | Extract-and-Name | 4-5 sub-functions        |
| 6   | ~163       | `server/agent/tool-execution/cli-adapter.ts`          | `executeCommand`                            | Early-Return     | 3 sub-functions          |
| 7   | ~160       | `services/gsm-evil/gsmEvilService.ts`                 | `processScanResults`                        | Extract-and-Name | 3-4 sub-functions        |
| 8   | ~158       | `server/db/database.ts`                               | `initializeDatabase`                        | Extract-and-Name | 3-4 sub-functions        |
| 9   | ~157       | `components/fusion/PacketAnalysis.svelte`             | `renderPacketDetails`                       | Builder          | 4-5 section builders     |
| 10  | ~155       | `server/hardware/detection/sdr-detector.ts`           | `detectSDRDevices`                          | Data-Driven      | 2 sub-functions + data   |
| 11  | ~154       | `services/monitoring/dataStreamManager.ts`            | `manageStreams`                             | Extract-and-Name | 3-4 sub-functions        |
| 12  | ~153       | `components/dashboard/SystemStatusPanel.svelte`       | `buildStatusDisplay`                        | Builder          | 4-5 section builders     |
| 13  | ~152       | `server/bettercap/bettercapClient.ts`                 | `executeAttack`                             | Early-Return     | 3 sub-functions          |
| 14  | ~151       | `routes/api/agent/stream/+server.ts`                  | `handleAgentStream`                         | Extract-and-Name | 3-4 sub-functions        |
| 15  | ~150       | `services/recovery/serviceInitializer.ts`             | `initializeServices`                        | Extract-and-Name | 3-4 sub-functions        |

**IMPORTANT**: Exact line counts for entries 1-15 above are estimated from scanner output. Verify each against the live codebase before decomposition. Some may have been reduced by prior Phase 5.1/5.2/5.4 work by execution time.

---

## 4. Decomposition Approach (Per Pattern)

Each function follows one of the four decomposition patterns documented in Phase 5.5.13. The approach for each pattern category:

### 4.1 Extract-and-Name Functions (#1, 2, 3, 4, 5, 7, 8, 11, 14, 15)

**Process**:

1. Read the function and identify natural section boundaries (often marked with comments)
2. Each section that can be described in a single sentence becomes a named function
3. The original function becomes an orchestrator calling the extracted functions
4. Target: orchestrator 20-35 lines, each sub-function under 55 lines

**Naming convention**: Use verb-noun format matching the section's responsibility.

- `buildAgentConfig()`, `registerAgentTools()`, `executeAgentQuery()`
- `calculateFlightMetrics()`, `detectFlightAnomalies()`, `formatFlightReport()`

### 4.2 Builder Functions (#9, 12)

**Process**:

1. Identify each section/panel being built within the function
2. Extract each section to a `build*Section()` function
3. The original function calls each builder and assembles the result
4. Target: assembler 10-20 lines, each builder 15-25 lines

### 4.3 Early-Return Functions (#6, 13)

**Process**:

1. Identify guard clauses and error conditions at the top of the function
2. Convert nested if/else blocks to flat guard clause + early return
3. Extract complex validation or setup logic to helper functions
4. Target: reduce nesting to 1-2 levels maximum

### 4.4 Data-Driven Functions (#10)

**Process**:

1. Identify the repeated conditional pattern (switch/if-else chain)
2. Define a lookup table or strategy map at module level
3. Replace the conditional chain with a table lookup
4. Target: function body 10-20 lines, data table at module scope

---

## 5. Per-Function Decomposition Plans

### 5.1 `processWithAnthropic` (~180 lines, `server/agent/runtime.ts`)

**New functions**:
| Function Name | Est. Lines | Responsibility |
| -------------------------------- | ---------- | --------------------------------------- |
| `buildAnthropicRequest(query)` | 30-40 | Construct API request payload |
| `callAnthropicAPI(request)` | 25-35 | Execute HTTP call, handle streaming |
| `parseAnthropicResponse(stream)` | 25-35 | Parse SSE stream into structured output |
| `processWithAnthropic(query)` | 20-30 | Orchestrator |

### 5.2 `renderHeatmap` (~170 lines, `SignalHeatmap.svelte`)

**New functions**:
| Function Name | Est. Lines | Responsibility |
| ---------------------------------- | ---------- | ------------------------------------ |
| `prepareHeatmapData(signals)` | 20-30 | Normalize and bin signal data |
| `computeColorGradient(intensity)` | 10-15 | Map intensity to RGBA color |
| `drawHeatmapCanvas(ctx, data)` | 25-35 | Canvas 2D rendering of heatmap tiles |
| `drawHeatmapLegend(ctx, range)` | 15-20 | Draw color scale legend |
| `renderHeatmap(canvas, signals)` | 15-25 | Orchestrator |

### 5.3 `processDeviceFusion` (~168 lines, `fusion_controller.ts`)

**New functions**:
| Function Name | Est. Lines | Responsibility |
| ------------------------------------ | ---------- | ------------------------------------- |
| `matchDeviceFingerprints(devices)` | 25-35 | Cross-reference device identifiers |
| `calculateFusionConfidence(matches)` | 20-25 | Compute confidence scores for matches |
| `mergeDeviceRecords(matches)` | 25-35 | Merge matched device records |
| `processDeviceFusion(devices)` | 15-25 | Orchestrator |

### 5.4 `initializeDatabase` (~158 lines, `database.ts`)

**New functions**:
| Function Name | Est. Lines | Responsibility |
| -------------------------------- | ---------- | ------------------------------------- |
| `configurePragmas(db)` | 15-20 | Set WAL mode, cache size, etc. |
| `createTables(db)` | 20-30 | Execute CREATE TABLE statements |
| `createIndexes(db)` | 15-25 | Execute CREATE INDEX statements |
| `initializeDatabase(path)` | 20-30 | Orchestrator: open DB, configure, DDL |

### 5.5 `detectSDRDevices` (~155 lines, `sdr-detector.ts`)

**New functions/data**:
| Item | Est. Lines | Responsibility |
| ------------------------------- | ---------- | ------------------------------------- |
| `SDR_DEVICE_SPECS[]` (data) | 40-50 | Device identifier lookup table |
| `probeUSBDevice(spec)` | 20-30 | Probe one USB device for SDR match |
| `detectSDRDevices()` | 15-20 | Map specs through probe, collect hits |

---

## 6. Verification

### 6.1 Per-Function Verification

After each function decomposition:

```bash
# 1. Verify no functions >60 lines in the modified file
python3 scripts/audit-function-sizes-v2.py <modified-file>
# TARGET: 0 functions >60 lines

# 2. Build and typecheck
npm run build && npm run typecheck
# TARGET: Exit code 0
```

### 6.2 Batch Verification (After All 15 Functions)

```bash
echo "=== CRITICAL FUNCTIONS REMAINING ==="
python3 scripts/audit-function-sizes-v2.py src/ 2>&1 | awk '$1 > 150'
# TARGET: Only Phase 5.1/5.2 handled functions should appear (if those phases not yet complete)

npm run build && npm run typecheck
```

---

## 7. Test Requirements

Each decomposed function that produces a **pure** extracted function requires unit tests per the policy in Phase 5.5 Section 11.1:

| Function Category                          | Test Requirement                                      |
| ------------------------------------------ | ----------------------------------------------------- |
| Pure data transformer (parser, normalizer) | 3+ test cases: valid input, edge case, invalid input  |
| Configuration builder                      | 2+ test cases: default config, custom config          |
| Validator/guard                            | 4+ test cases: valid, each invalid category, boundary |
| Decision function                          | 1 test per branch minimum                             |
| UI helper (SVG, CSS, canvas)               | 2+ test cases: representative inputs                  |

**Estimated test effort**: 15 functions x ~12 min/function = ~3 hours

---

## 8. Commit Strategy

Group commits by file proximity to avoid intermediate broken states:

```
refactor(phase-5.5): decompose processWithAnthropic + createAgent in runtime.ts
refactor(phase-5.5): decompose renderHeatmap in SignalHeatmap.svelte
refactor(phase-5.5): decompose processDeviceFusion in fusion_controller.ts
refactor(phase-5.5): decompose initializeDatabase in database.ts
refactor(phase-5.5): decompose detectSDRDevices using data-driven pattern
```

**Multi-function files**: When a file contains 2+ oversized functions, decompose ALL in a SINGLE commit.

---

## 9. Cross-Phase Notes

- **Phase 5.1**: Functions in God Page files (tactical-map-simple, gsm-evil, rfsweep, hackrfsweep) are handled by Phase 5.1 and are NOT in this document's scope.
- **Phase 5.2**: Functions in `sweepManager.ts` and `BufferManager.ts` are handled by Phase 5.2.
- **Phase 5.4**: Functions in files being split by Phase 5.4 may change location. Verify file paths before decomposition.
- **Phase 4.1 (Dead Code)**: Some functions in this list may reside in files identified as dead code by Phase 4.1. Cross-reference with the dead code audit before decomposing.

---

**END OF DOCUMENT**
