# Phase 5.4.12 -- Tier 3: Components, Routes, and Stores Resolution (T3-31 through T3-61)

```
Document ID:    ARGOS-AUDIT-P5.4.12-TIER3-COMPONENTS-ROUTES-STORES
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.12 -- Resolve all Tier 3 component, route, and store files (300-499 lines)
Risk Level:     LOW
Prerequisites:  Phase 5.4.11 (Tier 3 server/services) COMPLETE
Files Touched:  ~31 files evaluated; ~7 decomposed, ~15 accepted, 5 deferred, 1 note
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Scope

This sub-task covers all Tier 3 items in the components (`src/lib/components/`), routes
(`src/routes/`), and stores (`src/lib/stores/`) directories. Each file has a definitive
action: DECOMPOSE, ACCEPT, DEFERRED, or NOTE.

---

## 2. Components Directory (`src/lib/components/`) -- Items T3-31 through T3-50

### T3-31: `components/hackrf/SpectrumAnalysis.svelte` (416 lines) -- DECOMPOSE

**Strategy:** Extract SpectrumControls, SpectrumChart (separate from T3-34), PeakAnnotations.

**New File Manifest:**

| New File                                             | Content                          | Est. Lines |
| ---------------------------------------------------- | -------------------------------- | ---------- |
| `components/hackrf/spectrum/SpectrumAnalysis.svelte` | Orchestrator                     | ~140       |
| `components/hackrf/spectrum/SpectrumControls.svelte` | Frequency/gain/span controls     | ~120       |
| `components/hackrf/spectrum/PeakAnnotations.svelte`  | Peak marker annotations on chart | ~100       |

**Note:** The SpectrumChart (T3-34) is a sibling component, not extracted from this file.
SpectrumAnalysis imports SpectrumChart as a child.

**Verification:**

```bash
wc -l src/lib/components/hackrf/spectrum/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### T3-32: `components/dashboard/panels/DevicesPanel.svelte` (415 lines) -- DECOMPOSE

**Strategy:** Extract DeviceCard, DeviceFilter, DeviceList.

**New File Manifest:**

| New File                                                  | Content                            | Est. Lines |
| --------------------------------------------------------- | ---------------------------------- | ---------- |
| `components/dashboard/panels/devices/DevicesPanel.svelte` | Orchestrator, data subscription    | ~100       |
| `components/dashboard/panels/devices/DeviceCard.svelte`   | Individual device card component   | ~120       |
| `components/dashboard/panels/devices/DeviceFilter.svelte` | Device type/status filter controls | ~100       |
| `components/dashboard/panels/devices/DeviceList.svelte`   | Device list container with layout  | ~100       |

**Verification:**

```bash
wc -l src/lib/components/dashboard/panels/devices/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### T3-33: `components/kismet/ServiceControl.svelte` (411 lines) -- DECOMPOSE

**Strategy:** Extract ServiceStatus, ControlButtons, ConfigEditor.

**New File Manifest:**

| New File                                                  | Content                         | Est. Lines |
| --------------------------------------------------------- | ------------------------------- | ---------- |
| `components/kismet/service-control/ServiceControl.svelte` | Orchestrator                    | ~100       |
| `components/kismet/service-control/ServiceStatus.svelte`  | Service health status display   | ~120       |
| `components/kismet/service-control/ControlButtons.svelte` | Start/stop/restart button group | ~100       |
| `components/kismet/service-control/ConfigEditor.svelte`   | Kismet configuration editor     | ~100       |

**Verification:**

```bash
wc -l src/lib/components/kismet/service-control/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### T3-34: `components/hackrf/SpectrumChart.svelte` (408 lines) -- DECOMPOSE

**Resolution (from Section 6.6 of source document):** Mixed: Chart.js config + data
transformation + user interaction. DECOMPOSE.

**New File Manifest:**

| New File                                     | Content                          | Est. Lines |
| -------------------------------------------- | -------------------------------- | ---------- |
| `components/hackrf/SpectrumChart.svelte`     | Orchestrator + user interaction  | ~210       |
| `components/hackrf/SpectrumChartConfig.ts`   | Chart.js configuration objects   | ~80        |
| `components/hackrf/SpectrumDataTransform.ts` | FFT data preparation for display | ~120       |

**Decomposition Template Applied:** Mixed Concern Component template from Section 6.6.

**Verification:**

```bash
wc -l src/lib/components/hackrf/SpectrumChart.svelte \
  src/lib/components/hackrf/SpectrumChartConfig.ts \
  src/lib/components/hackrf/SpectrumDataTransform.ts
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### T3-35: `components/tactical-map/kismet/KismetController.svelte` (395 lines) -- DEFERRED

**Rationale:** Pending Phase 5.1 re-evaluation. This component is used by
`tactical-map-simple/+page.svelte` which is being fully decomposed in Phase 5.1. After
Phase 5.1, this component may be absorbed, replaced, or rendered dead.

---

### T3-36: `components/drone/FlightPathVisualization.svelte` (393 lines) -- ACCEPT

**Rationale:** Primarily Leaflet polyline rendering. Path calculation is light (<30 lines).
393 lines with clean SRP for a visualization component.

---

### T3-37: `components/dashboard/ToolApprovalDialog.svelte` (391 lines) -- ACCEPT

**Rationale:** Single dialog component with sub-views. 391 lines is near threshold
and has clean SRP. No embedded sub-dialogs requiring extraction.

---

### T3-38: `components/kismet/AlertsPanel.svelte` (381 lines) -- ACCEPT

**Rationale:** Alert list + filter. Clean single-concern. 381 lines is acceptable for
a self-contained alert display component.

---

### T3-39: `components/kismet/StatisticsPanel.svelte` (376 lines) -- ACCEPT

**Rationale:** Statistics display. Primarily declarative chart configuration. Clean SRP.

---

### T3-40: `components/dashboard/frontendToolExecutor.ts` (371 lines) -- DECOMPOSE

**Strategy:** Extract tool execution logic per tool type. Pattern matches 5.4.2-13
(MCP tool handler extraction).

**New File Manifest:**

| New File                                                   | Content                        | Est. Lines |
| ---------------------------------------------------------- | ------------------------------ | ---------- |
| `components/dashboard/tool-executor/index.ts`              | Barrel: tool executor registry | ~30        |
| `components/dashboard/tool-executor/executor.ts`           | Main executor orchestration    | ~100       |
| `components/dashboard/tool-executor/navigationExecutor.ts` | Navigation tool execution      | ~60        |
| `components/dashboard/tool-executor/systemExecutor.ts`     | System tool execution          | ~60        |
| `components/dashboard/tool-executor/dataQueryExecutor.ts`  | Data query tool execution      | ~60        |
| `components/dashboard/tool-executor/deviceExecutor.ts`     | Device control tool execution  | ~60        |

**Verification:**

```bash
wc -l src/lib/components/dashboard/tool-executor/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### T3-41: `components/kismet/DeviceList.svelte` (359 lines) -- ACCEPT

**Rationale:** Device list with sorting. Clean table component. 359 lines with single
concern (sortable device list).

---

### T3-42: `components/dashboard/TerminalTabContent.svelte` (347 lines) -- ACCEPT

**Rationale:** Tab content renderer. Clean composition. 347 lines is within acceptable
range.

---

### T3-43: `components/tactical-map/kismet/DeviceManager.svelte` (335 lines) -- DEFERRED

**Rationale:** Pending Phase 5.1 re-evaluation. Used by KismetController which is
itself deferred.

---

### T3-44: `components/tactical-map/hackrf/HackRFController.svelte` (331 lines) -- DEFERRED

**Rationale:** Pending Phase 5.1 re-evaluation. Used by `tactical-map-simple/+page.svelte`.

---

### T3-45: `components/tactical-map/hackrf/FrequencySearch.svelte` (324 lines) -- DEFERRED

**Rationale:** Pending Phase 5.1 re-evaluation. Used by HackRFController.

---

### T3-46: `components/map/TimeFilterControls.svelte` (320 lines) -- ACCEPT

**Rationale:** Filter controls. Near threshold with clean SRP. Documented exception in
Phase 5.4.0 Section 7.

---

### T3-47: `components/hackrf/TimeWindowControl.svelte` (310 lines) -- ACCEPT

**Rationale:** Single-concern time window UI. 310 lines. Documented exception.

---

### T3-48: `components/dashboard/views/TerminalView.svelte` (310 lines) -- ACCEPT

**Rationale:** Terminal view wrapper. Clean layout concern. Documented exception.

---

### T3-49: `components/kismet/MapView.svelte` (309 lines) -- ACCEPT

**Rationale:** Map view wrapper for Kismet. Clean composition. Documented exception.

---

### T3-50: `components/tactical-map/map/MapLegend.svelte` (306 lines) -- DEFERRED

**Rationale:** Pending Phase 5.1 re-evaluation. Used by `tactical-map-simple/+page.svelte`.

---

## 3. Routes Directory (`src/routes/`) -- Items T3-51 through T3-56

### T3-51: `routes/api/agent/tools/+server.ts` (495 lines) -- DECOMPOSE

**Strategy:** Extract individual tool handlers into `routes/api/agent/tools/handlers/`.
Keep routing dispatch in `+server.ts`.

**New File Manifest:**

| New File                                            | Content                           | Est. Lines |
| --------------------------------------------------- | --------------------------------- | ---------- |
| `routes/api/agent/tools/+server.ts`                 | Routing dispatch, request parsing | ~120       |
| `routes/api/agent/tools/handlers/index.ts`          | Handler registry barrel           | ~30        |
| `routes/api/agent/tools/handlers/navigation.ts`     | Navigation tool handlers          | ~70        |
| `routes/api/agent/tools/handlers/system-info.ts`    | System info tool handlers         | ~70        |
| `routes/api/agent/tools/handlers/device-control.ts` | Device control tool handlers      | ~70        |
| `routes/api/agent/tools/handlers/data-query.ts`     | Data query tool handlers          | ~70        |
| `routes/api/agent/tools/handlers/ui-interaction.ts` | UI interaction tool handlers      | ~70        |

**Verification:**

```bash
wc -l src/routes/api/agent/tools/+server.ts src/routes/api/agent/tools/handlers/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
npm run build 2>&1 | tail -5
```

---

### T3-52: `routes/api/gsm-evil/intelligent-scan-stream/+server.ts` (546 lines) -- NOTE

**Already listed in Tier 2 (item 5.4.2-22).** Decomposition plan is in Phase-5.4.10.
Do not double-count.

---

### T3-53: `routes/dashboard/+page.svelte` (367 lines) -- ACCEPT

**Rationale:** Dashboard page is layout + component imports. Clean orchestrator pattern.
367 lines for a dashboard layout page is acceptable.

---

### T3-54: `routes/api/gps/position/+server.ts` (361 lines) -- ACCEPT

**Rationale:** GPS API endpoint. Request/response handling is single-concern. 361 lines
is acceptable for an API endpoint with validation and response formatting.

---

### T3-55: `routes/gsm-evil/LocalIMSIDisplay.svelte` (358 lines) -- ACCEPT

**Rationale:** IMSI display table + formatting. Primarily tabular data rendering with
column formatting logic. Clean SRP.

---

### T3-56: `routes/api/hardware/details/+server.ts` (325 lines) -- ACCEPT

**Rationale:** Hardware details API endpoint. Near threshold. Clean request/response
pattern. Documented exception in Phase 5.4.0 Section 7.

---

## 4. Stores Directory (`src/lib/stores/`) -- Items T3-57 through T3-61

### T3-57: `stores/drone.ts` (401 lines) -- DECOMPOSE

**Strategy:** Extract flight state management, mission store, and telemetry store into
separate files.

**New File Manifest:**

| New File                         | Content                           | Est. Lines |
| -------------------------------- | --------------------------------- | ---------- |
| `stores/drone/index.ts`          | Barrel re-export                  | ~30        |
| `stores/drone/flightState.ts`    | Flight state (position, velocity) | ~120       |
| `stores/drone/missionStore.ts`   | Mission waypoints, progress       | ~130       |
| `stores/drone/telemetryStore.ts` | Telemetry data (battery, signal)  | ~120       |

### Key Constraints

- Per memory leak fixes: `flightPoints` capped at 10,000, `missionHistory` at 50.
  These caps must remain in the respective extracted stores.
- Svelte store pattern: each file exports `writable`/`derived` stores, not classes.

**Verification:**

```bash
wc -l src/lib/stores/drone/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
# Verify memory caps preserved
grep -n "slice\|splice" src/lib/stores/drone/*.ts
```

---

### T3-58: `stores/gsmEvilStore.ts` (389 lines) -- ACCEPT

**Rationale:** Clean store with bounded arrays (per memory leak fixes commit f300b8f).
`scanProgress .slice(-500)`, `capturedIMSIs .slice(-1000)` caps verified. 389 lines
with clean reactive pattern.

---

### T3-59: `stores/packetAnalysisStore.ts` (370 lines) -- ACCEPT

**Rationale:** Clean store pattern. 370 lines. Single-concern packet analysis state.

---

### T3-60: `stores/dashboard/terminalStore.ts` (336 lines) -- ACCEPT

**Rationale:** Terminal state management. Single store concern. Clean reactive pattern.
Documented exception in Phase 5.4.0 Section 7.

---

### T3-61: `stores/hackrf.ts` (318 lines) -- ACCEPT

**Rationale:** HackRF state store. Near threshold with clean SRP. Documented exception
in Phase 5.4.0 Section 7.

---

## 5. Resolved REVIEW Actions Summary

The following table preserves the full resolution of all REVIEW items from Section 6.6
of the source Phase 5.4 document with their definitive actions and rationales:

| #     | File                                                         | Lines | Resolution    | Rationale                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------ | ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3-05 | `server/kismet/api_client.ts`                                | 472   | **ACCEPT**    | HTTP wrapper with clean method-per-endpoint pattern. No logic mixing.                                                                                                                         |
| T3-07 | `server/hardware/detection/usb-detector.ts`                  | 378   | **ACCEPT**    | USB enumeration is single-concern. Device classification is co-located but logically part of detection.                                                                                       |
| T3-10 | `server/agent/runtime.ts`                                    | 335   | **ACCEPT**    | Single-concern agent execution runtime. 335 lines is acceptable.                                                                                                                              |
| T3-11 | `server/services/kismet.service.ts`                          | 331   | **ACCEPT**    | Verify not a duplicate of services/kismet/ first. If duplicate, delete in Phase 4. If unique, ACCEPT at 331 lines.                                                                            |
| T3-17 | `services/hackrf/timeWindowFilter.ts`                        | 485   | **DECOMPOSE** | 485 lines with mixed filter predicates and buffer management. Extract: `timeWindowFilter/predicates.ts` (~200), `timeWindowFilter/bufferRing.ts` (~150), `timeWindowFilter/filter.ts` (~135). |
| T3-19 | `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | 457   | **DEFER**     | Will be consolidated into `sdr-common/error/` by Phase 5.2 Task 5.2.1. Do not decompose independently.                                                                                        |
| T3-22 | `services/api/kismet.ts`                                     | 428   | **ACCEPT**    | API client wrapper with clean HTTP method pattern. Transformation is per-endpoint, not extractable.                                                                                           |
| T3-23 | `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | 423   | **DEFER**     | Will be consolidated into `sdr-common/frequency/` by Phase 5.2.                                                                                                                               |
| T3-24 | `services/map/webglHeatmapRenderer.ts`                       | 411   | **ACCEPT**    | WebGL shader setup + rendering is inherently coupled. Extracting shaders would create non-standard file types.                                                                                |
| T3-26 | `services/db/dataAccessLayer.ts`                             | 378   | **ACCEPT**    | Clean DAL pattern. All methods are thin query wrappers.                                                                                                                                       |
| T3-28 | `services/gsm-evil/server.ts`                                | 356   | **ACCEPT**    | Process management for GSM Evil. Clean single-concern.                                                                                                                                        |
| T3-34 | `components/hackrf/SpectrumChart.svelte`                     | 408   | **DECOMPOSE** | Mixed: Chart.js config + data transformation + user interaction. Extract: `SpectrumChartConfig.ts` (chart options, ~80), `SpectrumDataTransform.ts` (FFT display prep, ~120). Parent: ~210.   |
| T3-36 | `components/drone/FlightPathVisualization.svelte`            | 393   | **ACCEPT**    | Primarily Leaflet polyline rendering. Path calculation is light (<30 lines).                                                                                                                  |
| T3-37 | `components/dashboard/ToolApprovalDialog.svelte`             | 391   | **ACCEPT**    | Single dialog with sub-views. 391 lines is near threshold and has clean SRP.                                                                                                                  |
| T3-38 | `components/kismet/AlertsPanel.svelte`                       | 381   | **ACCEPT**    | Alert list + filter. Clean single-concern.                                                                                                                                                    |
| T3-39 | `components/kismet/StatisticsPanel.svelte`                   | 376   | **ACCEPT**    | Statistics display. Primarily declarative chart config.                                                                                                                                       |
| T3-41 | `components/kismet/DeviceList.svelte`                        | 359   | **ACCEPT**    | Device list with sorting. Clean table component.                                                                                                                                              |
| T3-42 | `components/dashboard/TerminalTabContent.svelte`             | 347   | **ACCEPT**    | Tab content renderer. Clean composition.                                                                                                                                                      |
| T3-53 | `routes/dashboard/+page.svelte`                              | 367   | **ACCEPT**    | Dashboard page is layout + component imports. Clean orchestrator.                                                                                                                             |
| T3-54 | `routes/api/gps/position/+server.ts`                         | 361   | **ACCEPT**    | GPS API endpoint. Request/response handling is single-concern.                                                                                                                                |
| T3-55 | `routes/gsm-evil/LocalIMSIDisplay.svelte`                    | 358   | **ACCEPT**    | IMSI display table + formatting. Clean SRP.                                                                                                                                                   |
| T3-58 | `stores/gsmEvilStore.ts`                                     | 389   | **ACCEPT**    | Clean store with bounded arrays (per memory leak fixes f300b8f).                                                                                                                              |
| T3-59 | `stores/packetAnalysisStore.ts`                              | 370   | **ACCEPT**    | Clean store pattern.                                                                                                                                                                          |

**Summary of resolutions: 23 REVIEW files -> 2 DECOMPOSE + 2 DEFER + 19 ACCEPT.**

---

## 6. Decomposition Templates

### Template: Mixed Concern Component (applied to T3-34 SpectrumChart)

```
Original:  ComponentName.svelte (>350 lines, mixed config + data + interaction)
Extract 1: ComponentNameConfig.ts       -- chart/canvas configuration objects
Extract 2: ComponentNameDataTransform.ts -- data preparation for display
Remaining: ComponentName.svelte          -- orchestrator + user interaction
Target: each file <250 lines
```

### Template: Mixed Filter/Buffer Service (applied to T3-17 timeWindowFilter)

```
Original:  serviceName.ts (>400 lines, mixed predicates + buffer management)
Extract 1: serviceName/predicates.ts  -- pure filter functions
Extract 2: serviceName/bufferRing.ts  -- data structure management
Remaining: serviceName/filter.ts      -- orchestration + public API
Barrel:    serviceName/index.ts       -- re-exports public API
Target: each file <200 lines
```

---

## 7. Execution Summary for This Sub-Task

| Action    | Count | Items                                                                                                                 |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| DECOMPOSE | 7     | T3-31, T3-32, T3-33, T3-34, T3-40, T3-51, T3-57                                                                       |
| ACCEPT    | 15    | T3-36, T3-37, T3-38, T3-39, T3-41, T3-42, T3-46, T3-47, T3-48, T3-49, T3-53, T3-54, T3-55, T3-58, T3-59, T3-60, T3-61 |
| DEFERRED  | 5     | T3-35, T3-43, T3-44, T3-45, T3-50 (all pending Phase 5.1)                                                             |
| NOTE      | 1     | T3-52 (duplicate of Tier 2 item 5.4.2-22)                                                                             |

---

## 8. Commit Strategy

| Commit | Files                                     | Message                                                                 |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| 42     | T3-31 SpectrumAnalysis                    | `refactor(hackrf): decompose SpectrumAnalysis into subcomponents`       |
| 43     | T3-32 DevicesPanel + T3-33 ServiceControl | `refactor(dashboard/kismet): decompose panel components`                |
| 44     | T3-34 SpectrumChart                       | `refactor(hackrf): extract chart config and data transform`             |
| 45     | T3-40 frontendToolExecutor                | `refactor(dashboard): extract tool executor per-type handlers`          |
| 46     | T3-51 api/agent/tools                     | `refactor(api): extract agent tool handlers into individual files`      |
| 47     | T3-57 drone store                         | `refactor(stores): decompose drone store into flight/mission/telemetry` |

---

## 9. Standards Compliance

| Standard             | Compliance                                                     |
| -------------------- | -------------------------------------------------------------- |
| Barr Group Rule 1.3  | All decomposed files <250 lines; all accepted files <500 lines |
| NASA/JPL Rule 2.4    | No functions >60 lines in extracted modules                    |
| CERT C MEM00         | Store slice caps preserved in extracted store modules          |
| CERT C MSC41         | No secrets in any module                                       |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                             |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.12 -- Tier 3: Components, Routes, and Stores Resolution
```
