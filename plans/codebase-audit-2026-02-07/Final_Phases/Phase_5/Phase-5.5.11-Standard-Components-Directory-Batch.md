# Phase 5.5.11 -- Standard Components Directory Batch

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.11                                                        |
| **Phase**            | 5.5.11                                                                     |
| **Title**            | Standard Functions in components/ Directory (14 functions, 60-99 lines)    |
| **Risk Level**       | LOW -- small overages requiring 1-2 extractions each                       |
| **Prerequisites**    | Phase 5.5.0 (Assessment), HIGH-08 (FlightPathVisualization) complete       |
| **Estimated Effort** | 1.5 hours                                                                  |
| **Files Touched**    | 8 existing Svelte component files modified                                 |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Objective

Decompose all 14 STANDARD-priority functions (60-99 lines) residing in the `src/lib/components/` directory tree. These are Svelte component functions that typically require extraction of pure logic to helper `.ts` files while keeping reactive wrappers in the `.svelte` files.

---

## 2. Function Inventory

| #   | Lines | File                                                      | Function                   | Pattern to Apply                                                                                    |
| --- | ----- | --------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | 98    | `components/map/KismetDashboardOverlay.svelte:238`        | `getDeviceType`            | Data-Driven: replace large if-else/switch chain with device-type lookup table                       |
| 2   | 97    | `components/hackrf/SpectrumChart.svelte:166`              | `updateWaterfallOptimized` | Extract-and-Name: extract `shiftWaterfallPixels()`, `renderNewRow()`, `applyColormap()`             |
| 3   | 87    | `components/hackrf/SpectrumChart.svelte:75`               | `drawSpectrum`             | Extract-and-Name: extract `drawSpectrumLine()`, `drawGridLines()`, `drawLabels()`                   |
| 4   | 86    | `components/dashboard/AgentChatPanel.svelte:107`          | `sendMessageWithContent`   | Extract-and-Name: extract `prepareMessagePayload()`, `submitToAgent()`, `handleAgentResponse()`     |
| 5   | 83    | `components/dashboard/DashboardMap.svelte:358`            | `handleMapLoad`            | Extract-and-Name: extract `configureMapLayers()`, `attachMapEventListeners()`                       |
| 6   | 81    | `components/tactical-map/kismet/DeviceManager.svelte:140` | `createDevicePopupContent` | Builder: extract section builders `buildDeviceHeader()`, `buildSignalInfo()`, `buildLocationInfo()` |
| 7   | 74    | `components/map/AirSignalOverlay.svelte:207`              | `processSpectrumData`      | Extract-and-Name: extract `parseSpectrumLine()`, `classifyFrequency()`                              |
| 8   | 73    | `components/drone/FlightPathVisualization.svelte:258`     | `addFlightMarkers`         | Extract-and-Name: extract `createWaypointMarker()`, `createPathLabel()`                             |
| 9   | 67    | `components/drone/MissionControl.svelte:120`              | `addWaypoint`              | Extract-and-Name: extract `validateWaypointPosition()`, `buildWaypointConfig()`                     |
| 10  | 105   | `components/drone/FlightPathVisualization.svelte:60`      | `updateVisualization`      | **HANDLED BY HIGH-08** (sub-task 5.5.7) -- NO ACTION                                                |

**Note**: Entries 11-14 are additional component functions identified by the v2 scanner in the 60-65 line range. They will be caught by the Phase 5.6 ESLint enforcement gate.

---

## 3. Multi-Function File Processing

### 3.1 `SpectrumChart.svelte` -- TWO Oversized Functions

`src/lib/components/hackrf/SpectrumChart.svelte` contains TWO oversized functions (97 and 87 lines). Process as a unit in one commit.

| Function                   | Lines | Extraction Plan                                                       |
| -------------------------- | ----- | --------------------------------------------------------------------- |
| `updateWaterfallOptimized` | 97    | Extract `shiftWaterfallPixels()`, `renderNewRow()`, `applyColormap()` |
| `drawSpectrum`             | 87    | Extract `drawSpectrumLine()`, `drawGridLines()`, `drawLabels()`       |

### 3.2 `FlightPathVisualization.svelte` -- TWO Oversized Functions

Contains `updateVisualization` (105 lines, HIGH-08 handled by sub-task 5.5.7) AND `addFlightMarkers` (73 lines, STANDARD). Process `addFlightMarkers` in the same commit as the HIGH-08 decomposition.

---

## 4. Detailed Decomposition Plans

### 4.1 `getDeviceType` (98 lines, KismetDashboardOverlay.svelte)

**Data-driven conversion** -- replaces a large if-else/switch chain:

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

**Post-decomposition**: `getDeviceType` becomes 8-12 lines. Data table is at module scope.

### 4.2 `updateWaterfallOptimized` (97 lines, SpectrumChart.svelte)

| New Function                | Lines | Responsibility                         |
| --------------------------- | ----- | -------------------------------------- |
| `shiftWaterfallPixels(ctx)` | 15-20 | Shift ImageData down by one row        |
| `renderNewRow(ctx, data)`   | 20-30 | Draw one row of spectrum data at top   |
| `applyColormap(value)`      | 10-15 | Map dBm value to RGBA color via lookup |

### 4.3 `drawSpectrum` (87 lines, SpectrumChart.svelte)

| New Function                    | Lines | Responsibility                    |
| ------------------------------- | ----- | --------------------------------- |
| `drawSpectrumLine(ctx, data)`   | 20-30 | Draw the main spectrum trace line |
| `drawGridLines(ctx, config)`    | 15-20 | Draw frequency/power grid lines   |
| `drawLabels(ctx, xAxis, yAxis)` | 15-20 | Draw axis labels and title        |

### 4.4 `sendMessageWithContent` (86 lines, AgentChatPanel.svelte)

| New Function                     | Lines | Responsibility                          |
| -------------------------------- | ----- | --------------------------------------- |
| `prepareMessagePayload(content)` | 15-20 | Format message content, add metadata    |
| `submitToAgent(payload)`         | 20-25 | POST to agent API, handle streaming     |
| `handleAgentResponse(response)`  | 15-20 | Parse agent response, update chat state |

### 4.5 `handleMapLoad` (83 lines, DashboardMap.svelte)

| New Function                   | Lines | Responsibility                           |
| ------------------------------ | ----- | ---------------------------------------- |
| `configureMapLayers(map)`      | 25-30 | Add tile layers, overlays, layer control |
| `attachMapEventListeners(map)` | 20-25 | Bind click, zoom, move event handlers    |

### 4.6 `createDevicePopupContent` (81 lines, DeviceManager.svelte)

**Builder pattern**:

| New Function                       | Lines | Responsibility                        |
| ---------------------------------- | ----- | ------------------------------------- |
| `buildDeviceHeader(device)`        | 15-20 | Device name, type icon, MAC address   |
| `buildSignalInfo(device)`          | 15-20 | Signal strength, channel, frequency   |
| `buildLocationInfo(device)`        | 10-15 | GPS coordinates, last seen, proximity |
| `createDevicePopupContent(device)` | 12-18 | Assemble header + signal + location   |

### 4.7 `processSpectrumData` (74 lines, AirSignalOverlay.svelte)

| New Function                     | Lines | Responsibility                          |
| -------------------------------- | ----- | --------------------------------------- |
| `parseSpectrumLine(line)`        | 15-20 | Parse raw spectrum line into data point |
| `classifyFrequency(freq, power)` | 15-20 | Classify frequency band and signal type |

### 4.8 `addFlightMarkers` (73 lines, FlightPathVisualization.svelte)

| New Function                      | Lines | Responsibility                            |
| --------------------------------- | ----- | ----------------------------------------- |
| `createWaypointMarker(wp, index)` | 20-25 | Create numbered Leaflet marker with popup |
| `createPathLabel(segment)`        | 15-20 | Create text label for path segment        |

### 4.9 `addWaypoint` (67 lines, MissionControl.svelte)

| New Function                          | Lines | Responsibility                             |
| ------------------------------------- | ----- | ------------------------------------------ |
| `validateWaypointPosition(lat, lng)`  | 10-15 | Validate coordinates within mission bounds |
| `buildWaypointConfig(position, opts)` | 15-20 | Build waypoint configuration object        |

---

## 5. Svelte Reactivity Preservation Rules

All component function decompositions must follow these rules:

1. **PURE functions only** are extracted to external `.ts` files. Functions that read or write Svelte reactive state (`$state`, `$derived`, `$effect`, `$:` blocks) MUST remain in the `.svelte` file.

2. **Canvas rendering functions** (`drawSpectrum`, `updateWaterfallOptimized`, `renderNewRow`) can be safely extracted because they operate on a `CanvasRenderingContext2D` parameter, not reactive state.

3. **Leaflet map functions** (`handleMapLoad`, `addFlightMarkers`, `createWaypointMarker`) can be safely extracted because they operate on an `L.Map` parameter.

4. **HTML builder functions** (`createDevicePopupContent`, `buildDeviceHeader`) are pure string builders and can be extracted.

5. **Functions that call `update()` on Svelte stores** (e.g., `sendMessageWithContent` calling store update) keep the store interaction in the `.svelte` file wrapper; only the pure preparation logic is extracted.

---

## 6. Verification

### 6.1 Batch Verification

```bash
for f in components/map/KismetDashboardOverlay.svelte components/hackrf/SpectrumChart.svelte \
         components/dashboard/AgentChatPanel.svelte components/dashboard/DashboardMap.svelte \
         components/tactical-map/kismet/DeviceManager.svelte components/map/AirSignalOverlay.svelte \
         components/drone/FlightPathVisualization.svelte components/drone/MissionControl.svelte; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files

npm run build && npm run typecheck
```

---

## 7. Test Requirements

| Extracted Function           | Test Cases Required                                   | Coverage Target      |
| ---------------------------- | ----------------------------------------------------- | -------------------- |
| `getDeviceType` (data table) | All known device types, unknown type, edge cases      | 100% branch coverage |
| `applyColormap`              | Min dBm, max dBm, mid-range, out-of-range             | 100% branch coverage |
| `parseSpectrumLine`          | Valid line, malformed line, empty line                | 90% line coverage    |
| `classifyFrequency`          | WiFi 2.4GHz, WiFi 5GHz, cellular, unknown band        | 100% branch coverage |
| `validateWaypointPosition`   | Valid coords, out-of-bounds, null values              | 100% branch coverage |
| `prepareMessagePayload`      | Text message, message with attachments, empty content | 80% line coverage    |
| `buildDeviceHeader`          | Known device, unknown device, missing MAC             | 80% line coverage    |

**Estimated test effort**: 14 functions x ~7 min/function = ~1.5 hours

---

## 8. Commit Strategy

```
refactor(phase-5.5): convert getDeviceType to data-driven pattern (98 -> 10 lines)
refactor(phase-5.5): decompose 2 functions in SpectrumChart.svelte (97+87 -> <60 each)
refactor(phase-5.5): decompose sendMessageWithContent (86 -> <60 lines)
refactor(phase-5.5): decompose handleMapLoad (83 -> <60 lines)
refactor(phase-5.5): decompose createDevicePopupContent using builder (81 -> 15 lines)
refactor(phase-5.5): decompose processSpectrumData (74 -> <60 lines)
refactor(phase-5.5): decompose addFlightMarkers + addWaypoint (73+67 -> <60 each)
```

---

## 9. Cross-Phase Notes

- **Phase 5.5.7 (HIGH-08)**: `updateVisualization` (105 lines) in `FlightPathVisualization.svelte` is handled by sub-task 5.5.7. Process `addFlightMarkers` (73 lines) in the same commit.
- **Phase 5.5.4 (CRITICAL-07)**: `AirSignalOverlay.svelte` has `toggleRFDetection` (167 lines) handled by sub-task 5.5.4 after Phase 5.4 relocation. Process `processSpectrumData` (74 lines) after Phase 5.4 completes.
- **Phase 5.4**: Some component files may be split by Phase 5.4 (file size enforcement). Verify file paths before decomposition.

---

**END OF DOCUMENT**
