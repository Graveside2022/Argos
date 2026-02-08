# Phase 5.5.6 -- High Priority Visualization and MCP Decomposition

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.6                                                         |
| **Phase**            | 5.5.6                                                                      |
| **Title**            | High Visualization and MCP Decomposition (HIGH-01, HIGH-02, HIGH-03)       |
| **Risk Level**       | LOW -- internal refactors with no public API changes                       |
| **Prerequisites**    | Phase 5.5.0 (Assessment) complete                                          |
| **Estimated Effort** | 1.5 hours                                                                  |
| **Files Touched**    | 3 existing files refactored, 1 new file created                            |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Objective

Decompose three HIGH-priority functions (100-149 lines) across visualization and MCP tool handler domains:

1. `drawVisualization` (148 lines) -- Canvas 2D rendering with 5 rendering phases
2. `createSystemInfoContent` (121 lines) -- HTML string builder with 5 sections
3. `setupHandlers` (119 lines) -- MCP tool handler registration with 12 inline handlers

---

## 2. Function Inventory

| ID      | Lines | File                                                            | Line Start | Function                  | Pattern to Apply |
| ------- | ----- | --------------------------------------------------------------- | ---------- | ------------------------- | ---------------- |
| HIGH-01 | 148   | `src/lib/components/hackrf/SignalAgeVisualization.svelte`       | 69         | `drawVisualization`       | Extract-and-Name |
| HIGH-02 | 121   | `src/lib/components/tactical-map/system/SystemInfoPopup.svelte` | 86         | `createSystemInfoContent` | Builder          |
| HIGH-03 | 119   | `src/lib/server/mcp/dynamic-server.ts`                          | 508        | `setupHandlers`           | Extract-and-Name |

---

## 3. HIGH-01: `drawVisualization` (148 lines)

**Location**: `src/lib/components/hackrf/SignalAgeVisualization.svelte:69`
**Current size**: 148 lines
**Root cause**: Canvas 2D rendering function that performs: canvas context initialization, coordinate system setup, bar width/height calculations, iterative bar rendering with gradient fills, axis label drawing, legend rendering, and tooltip region registration. These are 5 distinct rendering phases in one function.

### 3.1 Decomposition Strategy

Extract each rendering phase to a named function. Uses the **Extract-and-Name** pattern.

### 3.2 New Functions (in same file or `src/lib/components/hackrf/signalAgeRenderer.ts`)

| Function Name                                        | Estimated Lines | Responsibility                                                     |
| ---------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `initializeCanvas(ctx, width, height)`               | 10-15           | Clear canvas, set coordinate system, apply DPI scaling             |
| `calculateBarGeometry(data, width, height, padding)` | 15-20           | Compute bar widths, heights, positions from data                   |
| `renderBars(ctx, bars, colorGradient)`               | 25-35           | Draw each bar with gradient fill and stroke                        |
| `renderAxisLabels(ctx, xLabels, yLabels, padding)`   | 20-25           | Draw X and Y axis labels, tick marks                               |
| `renderLegend(ctx, categories, position)`            | 15-20           | Draw color legend box                                              |
| `drawVisualization(canvas, data)`                    | 20-30           | Orchestrator: init -> calculate -> render bars -> labels -> legend |

### 3.3 Before/After Structure

**Before** (148 lines):

```typescript
function drawVisualization(canvas: HTMLCanvasElement, data: SignalAgeData[]): void {
	const ctx = canvas.getContext('2d');
	// 12 lines: canvas init, DPI scaling
	// 18 lines: bar geometry calculations
	// 35 lines: bar rendering with gradients
	// 22 lines: axis label drawing
	// 18 lines: legend rendering
	// 15 lines: tooltip region registration
}
```

**After** (20-30 lines):

```typescript
function drawVisualization(canvas: HTMLCanvasElement, data: SignalAgeData[]): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	initializeCanvas(ctx, canvas.width, canvas.height);
	const bars = calculateBarGeometry(data, canvas.width, canvas.height, PADDING);
	renderBars(ctx, bars, COLOR_GRADIENT);
	renderAxisLabels(ctx, bars.xLabels, bars.yLabels, PADDING);
	renderLegend(ctx, data.categories, LEGEND_POSITION);
}
```

### 3.4 Post-Decomposition

Target: 20-30 lines for orchestrator. No sub-function exceeds 35 lines.

### 3.5 Svelte Reactivity Note

`drawVisualization` is a pure rendering function that takes a canvas element and data as input. It does NOT use Svelte reactive primitives. It is safe to extract to an external `.ts` file. The Svelte component retains a thin `$effect` or reactive statement that calls the extracted function when data changes.

### 3.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/hackrf/SignalAgeVisualization.svelte
# TARGET: 0 functions >60 lines
```

### 3.7 Test Requirements

| Extracted Function     | Test Cases Required                                 | Coverage Target      |
| ---------------------- | --------------------------------------------------- | -------------------- |
| `calculateBarGeometry` | Empty data, single bar, many bars, zero-height data | 100% branch coverage |
| `initializeCanvas`     | Valid context, zero-dimension canvas                | 80% line coverage    |

Test file: `tests/unit/decomposition/hackrf/signalAgeRenderer.test.ts`

### 3.8 Canvas Context Risk

Extracted rendering functions must accept `ctx: CanvasRenderingContext2D` as their first parameter (never cache it at module level). Validate the context before rendering: `if (!ctx || ctx.canvas.width === 0) return;`

---

## 4. HIGH-02: `createSystemInfoContent` (121 lines)

**Location**: `src/lib/components/tactical-map/system/SystemInfoPopup.svelte:86`
**Current size**: 121 lines
**Root cause**: HTML string builder function that constructs a multi-section popup. Each section (CPU, memory, network, GPS, services) is 15-25 lines of template literal construction. Classic builder-pattern candidate.

### 4.1 Decomposition Strategy

Extract each section builder to a named function. Uses the **Builder** pattern.

### 4.2 New Functions (in same file)

| Function Name                               | Estimated Lines | Section                                          |
| ------------------------------------------- | --------------- | ------------------------------------------------ |
| `buildCPUSection(info: SystemInfo)`         | 15-20           | CPU usage, load average, temperature             |
| `buildMemorySection(info: SystemInfo)`      | 10-15           | RAM usage, swap, available                       |
| `buildNetworkSection(info: SystemInfo)`     | 15-20           | Interface status, IP addresses, throughput       |
| `buildGPSSection(info: SystemInfo)`         | 10-15           | Fix status, coordinates, satellite count         |
| `buildServiceSection(info: SystemInfo)`     | 15-20           | Service status indicators (Kismet, HackRF, etc.) |
| `createSystemInfoContent(info: SystemInfo)` | 15-20           | Assemble sections into complete HTML string      |

### 4.3 Before/After Structure

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
	// ... Network section (20 lines) ...
	// ... GPS section (15 lines) ...
	// ... Services section (20 lines) ...

	html += '</div>';
	return html;
}
```

**After** (15-20 lines):

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

### 4.4 Post-Decomposition

Target: 15-20 lines for assembler.

### 4.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/components/tactical-map/system/SystemInfoPopup.svelte
# TARGET: 0 functions >60 lines
```

### 4.6 Test Requirements

| Extracted Function    | Test Cases Required                                      | Coverage Target   |
| --------------------- | -------------------------------------------------------- | ----------------- |
| `buildCPUSection`     | Valid CPU data, missing temperature, zero usage          | 80% line coverage |
| `buildNetworkSection` | Multiple interfaces, no interfaces, interface with no IP | 80% line coverage |
| `buildGPSSection`     | Valid fix, no fix, missing satellite data                | 80% line coverage |

Test file: `tests/unit/decomposition/tactical-map/systemInfoBuilders.test.ts`

---

## 5. HIGH-03: `setupHandlers` (119 lines)

**Location**: `src/lib/server/mcp/dynamic-server.ts:508`
**Current size**: 119 lines
**Root cause**: MCP server handler registration function defines 12 tool handlers inline. Each handler is 5-15 lines, but when placed sequentially inside a single function, the aggregate exceeds the limit.

### 5.1 Decomposition Strategy

Extract each tool handler to an individual named function. The `setupHandlers` function retains only the handler registration calls.

### 5.2 New File: `src/lib/server/mcp/toolHandlers.ts`

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

### 5.3 Before/After Structure

**Before** (119 lines):

```typescript
function setupHandlers(server: MCPServer): void {
	server.setRequestHandler('get_active_devices', async (args) => {
		// 10 lines
	});
	server.setRequestHandler('get_device_details', async (args) => {
		// 12 lines
	});
	// ... 10 more handlers ...
}
```

**After** (20-30 lines):

```typescript
import {
	handleGetActiveDevices,
	handleGetDeviceDetails,
	handleGetNearbySignals,
	handleAnalyzeNetworkSecurity,
	handleGetSpectrumData,
	handleGetCellTowers,
	handleQuerySignalHistory,
	handleGetSystemStats,
	handleGetKismetStatus,
	handleGetGSMStatus,
	handleScanInstalledTools,
	handleScanHardware
} from './toolHandlers';

function setupHandlers(server: MCPServer): void {
	server.setRequestHandler('get_active_devices', handleGetActiveDevices);
	server.setRequestHandler('get_device_details', handleGetDeviceDetails);
	server.setRequestHandler('get_nearby_signals', handleGetNearbySignals);
	server.setRequestHandler('analyze_network_security', handleAnalyzeNetworkSecurity);
	server.setRequestHandler('get_spectrum_data', handleGetSpectrumData);
	server.setRequestHandler('get_cell_towers', handleGetCellTowers);
	server.setRequestHandler('query_signal_history', handleQuerySignalHistory);
	server.setRequestHandler('get_system_stats', handleGetSystemStats);
	server.setRequestHandler('get_kismet_status', handleGetKismetStatus);
	server.setRequestHandler('get_gsm_status', handleGetGSMStatus);
	server.setRequestHandler('scan_installed_tools', handleScanInstalledTools);
	server.setRequestHandler('scan_hardware', handleScanHardware);
}
```

### 5.4 Post-Decomposition

**`setupHandlers` target size**: 20-30 lines (12 registration calls + error wrapper).

### 5.5 Cross-Phase Notes

- **Phase 4.3 (MCP Dynamic Server)**: `dynamic-server.ts` is already flagged for `as any` fixes in Phase 4.3.2. Coordinate the handler extraction with type fixes to avoid double work.
- **MCP Integration**: The extracted handlers call the Argos HTTP API at `localhost:5173`. They do NOT import SvelteKit internals. This is correct per the MCP architecture constraint documented in MEMORY.md.

### 5.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/mcp/dynamic-server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/mcp/toolHandlers.ts
# TARGET: 0 functions >60 lines in both files
```

### 5.7 Test Requirements

| Extracted Function       | Test Cases Required                                  | Coverage Target   |
| ------------------------ | ---------------------------------------------------- | ----------------- |
| `handleGetActiveDevices` | Valid response, API error, timeout                   | 80% line coverage |
| `handleGetSpectrumData`  | Valid frequency range, invalid range, empty response | 80% line coverage |
| `handleScanHardware`     | Devices found, no devices, API unreachable           | 80% line coverage |

Test file: `tests/unit/decomposition/mcp/toolHandlers.test.ts`

---

## 6. Execution Order

1. Decompose `drawVisualization` (HIGH-01) -- independent
2. Decompose `createSystemInfoContent` (HIGH-02) -- independent
3. Decompose `setupHandlers` (HIGH-03) -- independent
4. Run full verification suite

All three functions are in different files with no mutual dependencies. They can be processed in any order.

**Commit strategy**: One commit per function (3 commits total).

```
refactor(phase-5.5): decompose drawVisualization into 5 rendering phases (148 -> 25 lines)
refactor(phase-5.5): decompose createSystemInfoContent using builder pattern (121 -> 18 lines)
refactor(phase-5.5): extract MCP tool handlers to toolHandlers.ts (119 -> 25 lines)
```

---

**END OF DOCUMENT**
