# Phase 5.5.4 -- Critical Signal System Decomposition

| Field                | Value                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.4                                                                    |
| **Phase**            | 5.5.4                                                                                 |
| **Title**            | Critical Signal System Decomposition (CRITICAL-07, CRITICAL-08, CRITICAL-09)          |
| **Risk Level**       | LOW -- internal refactors with no public API changes                                  |
| **Prerequisites**    | Phase 5.4 (File Size Enforcement) complete for AirSignalOverlay, Phase 5.5.0 complete |
| **Estimated Effort** | 2 hours                                                                               |
| **Files Touched**    | 3 existing files refactored, 1 new file created                                       |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7            |
| **Audit Date**       | 2026-02-08                                                                            |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                                   |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                                 |

---

## 1. Objective

Decompose three CRITICAL functions in the RF detection, signal clustering, and system information domains:

1. `toggleRFDetection` (167 lines) -- SSE connection + Leaflet marker management + signal classification
2. `clusterSignals` (161 lines) -- DBSCAN spatial clustering algorithm with inline phases
3. `getSystemInfo` (156 lines) -- system metrics collection from 5-6 independent sources

---

## 2. Function Inventory

| ID          | Lines | File                                             | Line Start | Function            | Pattern to Apply |
| ----------- | ----- | ------------------------------------------------ | ---------- | ------------------- | ---------------- |
| CRITICAL-07 | 167   | `src/lib/components/map/AirSignalOverlay.svelte` | 39         | `toggleRFDetection` | Extract-and-Name |
| CRITICAL-08 | 161   | `src/lib/services/map/signalClustering.ts`       | 139        | `clusterSignals`    | Extract-and-Name |
| CRITICAL-09 | 156   | `src/routes/api/system/info/+server.ts`          | 42         | `getSystemInfo`     | Extract-and-Name |

---

## 3. CRITICAL-07: `toggleRFDetection` (167 lines)

**Location**: `src/lib/components/map/AirSignalOverlay.svelte:39`
**Current size**: 167 lines
**Cross-phase note**: Phase 5.4 relocates this function to `RFDetectionService.ts` as part of the `AirSignalOverlay.svelte` file decomposition (1,019 lines -> 3 files). Phase 5.5 decomposes the function itself AFTER Phase 5.4 relocation.

**Root cause**: Single function handles SSE connection setup, EventSource lifecycle management, Leaflet marker creation and placement, signal classification, error handling with retry logic, and cleanup/teardown. Six distinct concerns in one function.

### 3.1 Decomposition Strategy

Split into connection, processing, and rendering sub-functions.

### 3.2 New Functions (in `src/lib/services/map/RFDetectionService.ts`, post-Phase 5.4)

| Function Name                                                     | Estimated Lines | Responsibility                                                               |
| ----------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `createSSEConnection(url: string, onMessage: Callback)`           | 20-30           | Create EventSource, attach handlers, return cleanup function                 |
| `classifySignal(data: RawSignal)`                                 | 15-25           | Determine signal type, threat level, icon                                    |
| `createSignalMarker(signal: ClassifiedSignal, map: L.Map)`        | 20-30           | Create Leaflet marker with popup content                                     |
| `cleanupDetection(markers: L.Marker[], eventSource: EventSource)` | 10-15           | Remove markers, close EventSource                                            |
| `toggleRFDetection(map: L.Map, enabled: boolean)`                 | 20-30           | Orchestrator: toggle on = create SSE + marker pipeline; toggle off = cleanup |

### 3.3 Before/After Structure

**Before** (167 lines):

```typescript
function toggleRFDetection(map: L.Map, enabled: boolean): void {
	if (!enabled) {
		// 15 lines cleanup
	}
	// 25 lines SSE connection setup
	const eventSource = new EventSource('/api/rf/data-stream');
	eventSource.onmessage = (event) => {
		// 30 lines signal classification
		// 25 lines marker creation with popup
		// 15 lines error handling with retry
	};
	// 20 lines additional event handlers
	// 15 lines lifecycle management
}
```

**After** (20-30 lines):

```typescript
function toggleRFDetection(map: L.Map, enabled: boolean): void {
	if (!enabled) {
		cleanupDetection(activeMarkers, activeEventSource);
		return;
	}
	activeEventSource = createSSEConnection('/api/rf/data-stream', (data) => {
		const classified = classifySignal(data);
		const marker = createSignalMarker(classified, map);
		activeMarkers.push(marker);
	});
}
```

### 3.4 Post-Decomposition

**`toggleRFDetection` target size**: 20-30 lines.

### 3.5 Cross-Phase Dependencies

- **BLOCKING**: Phase 5.4 must complete the relocation of `toggleRFDetection` to `RFDetectionService.ts` before Phase 5.5 decomposes it.
- **Phase 5.5.11**: `processSpectrumData` (74 lines) in the same original file (`AirSignalOverlay.svelte`) is a STANDARD-priority function. After Phase 5.4 relocation, determine if it moves to the same or a different file, and process accordingly.

### 3.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/map/RFDetectionService.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 3.7 Test Requirements

| Extracted Function | Test Cases Required                                          | Coverage Target      |
| ------------------ | ------------------------------------------------------------ | -------------------- |
| `classifySignal`   | WiFi signal, cellular signal, unknown signal, missing fields | 100% branch coverage |
| `cleanupDetection` | Non-empty markers, empty markers, null EventSource           | 100% branch coverage |

Test file: `tests/unit/decomposition/map/rfDetection.test.ts`

### 3.8 Svelte Reactivity Preservation

`toggleRFDetection` touches Leaflet map state but does NOT directly use Svelte reactive primitives (`$state`, `$derived`, `$effect`). It is safe to extract to a `.ts` file. The Svelte component retains a thin wrapper that calls the extracted function from within `onMount`/`onDestroy` lifecycle hooks.

---

## 4. CRITICAL-08: `clusterSignals` (161 lines)

**Location**: `src/lib/services/map/signalClustering.ts:139`
**Current size**: 161 lines
**Scanner note**: This function was missed by the v2 scanner due to a multi-line signature. Verified manually via `scripts/verify-function-length.py`.

**Root cause**: Implements DBSCAN-like spatial clustering algorithm with inline distance calculation, neighbor search, cluster merging, and result formatting. The algorithm has clear phases that are not separated into functions.

### 4.1 Decomposition Strategy

Extract each algorithmic phase into a named function.

### 4.2 New Functions (in same file)

| Function Name                                                                     | Estimated Lines | Responsibility                                                           |
| --------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `calculateHaversineDistance(a: LatLng, b: LatLng)`                                | 10-15           | Haversine distance between two GPS coordinates                           |
| `findNeighbors(point: Signal, signals: Signal[], eps: number)`                    | 15-20           | Return all signals within epsilon radius of point                        |
| `expandCluster(core: Signal, neighbors: Signal[], cluster: Cluster, eps, minPts)` | 25-35           | DBSCAN cluster expansion from core point                                 |
| `mergeOverlappingClusters(clusters: Cluster[])`                                   | 20-30           | Post-processing: merge clusters with overlapping boundaries              |
| `formatClusterResults(clusters: Cluster[])`                                       | 15-20           | Convert internal cluster representation to output format                 |
| `clusterSignals(signals: Signal[], params: ClusterParams)`                        | 25-35           | Orchestrator: validate inputs -> find cores -> expand -> merge -> format |

### 4.3 Before/After Structure

**Before** (161 lines):

```typescript
export function clusterSignals(signals: Signal[], params: ClusterParams): ClusterResult[] {
	// 15 lines input validation
	// 12 lines Haversine distance inline
	// 20 lines neighbor finding loop
	// 35 lines cluster expansion loop
	// 25 lines cluster merging
	// 20 lines result formatting
	// 15 lines noise point handling
}
```

**After** (25-35 lines):

```typescript
export function clusterSignals(signals: Signal[], params: ClusterParams): ClusterResult[] {
	if (signals.length === 0) return [];
	const { eps, minPts } = params;
	const visited = new Set<number>();
	const clusters: Cluster[] = [];

	for (let i = 0; i < signals.length; i++) {
		if (visited.has(i)) continue;
		const neighbors = findNeighbors(signals[i], signals, eps);
		if (neighbors.length >= minPts) {
			const cluster = new Cluster();
			expandCluster(signals[i], neighbors, cluster, eps, minPts);
			clusters.push(cluster);
		}
		visited.add(i);
	}

	const merged = mergeOverlappingClusters(clusters);
	return formatClusterResults(merged);
}
```

### 4.4 Cross-Phase Notes

- **Phase 5.5.10**: `exploreCluster` (67 lines) in `networkAnalyzer.ts` (same `services/map/` directory) is a related STANDARD-priority function. Both deal with clustering but in different files.
- **Performance**: `calculateHaversineDistance` is called O(n^2) times during neighbor search. V8 will inline this small function. See risk mitigation in Phase 5.5.14, Section 10.6.

### 4.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/services/map/signalClustering.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 4.6 Test Requirements

| Extracted Function           | Test Cases Required                                            | Coverage Target      |
| ---------------------------- | -------------------------------------------------------------- | -------------------- |
| `calculateHaversineDistance` | Same point (0 distance), known distance pair, antipodal points | 100% branch coverage |
| `findNeighbors`              | All within radius, none within radius, edge-case at boundary   | 90% line coverage    |
| `expandCluster`              | Single-point cluster, multi-point expansion, no expansion      | 90% line coverage    |
| `mergeOverlappingClusters`   | No overlap, partial overlap, complete overlap, single cluster  | 100% branch coverage |
| `formatClusterResults`       | Valid clusters, empty list                                     | 80% line coverage    |

Test file: `tests/unit/decomposition/map/signalClustering.test.ts`

---

## 5. CRITICAL-09: `getSystemInfo` (156 lines)

**Location**: `src/routes/api/system/info/+server.ts:42`
**Current size**: 156 lines
**Root cause**: Single function collects system metrics from 5-6 independent sources (CPU via `/proc/stat`, memory via `/proc/meminfo`, disk via `df`, network interfaces via `ip`, temperature via `vcgencmd`, uptime via `/proc/uptime`). Each collection is independent and sequential, producing a merged result object.

### 5.1 Decomposition Strategy

Extract each collector to a named async function. Use `Promise.all()` for parallel execution.

### 5.2 New Functions (extract to `src/lib/server/system/collectors.ts`)

| Function Name                 | Estimated Lines | Source                                 |
| ----------------------------- | --------------- | -------------------------------------- |
| `collectCPUMetrics()`         | 15-25           | `/proc/stat`, `/proc/loadavg`          |
| `collectMemoryMetrics()`      | 15-20           | `/proc/meminfo`                        |
| `collectDiskMetrics()`        | 15-20           | `df` command or `statvfs`              |
| `collectNetworkMetrics()`     | 15-25           | `/proc/net/dev` or `ip` command        |
| `collectTemperatureMetrics()` | 10-15           | `vcgencmd measure_temp` (RPi-specific) |
| `collectUptimeMetrics()`      | 5-10            | `/proc/uptime`                         |

### 5.3 Before/After Structure

**Before** (156 lines):

```typescript
export async function GET({ request }): Promise<Response> {
	const systemInfo: SystemInfo = {};

	// CPU metrics (25 lines)
	const statContent = await readFile('/proc/stat', 'utf8');
	// ... parsing ...

	// Memory metrics (20 lines)
	const meminfoContent = await readFile('/proc/meminfo', 'utf8');
	// ... parsing ...

	// Disk metrics (18 lines)
	// ... df command ...

	// Network (22 lines)
	// ... interface enumeration ...

	// Temperature (12 lines)
	// ... vcgencmd ...

	// Uptime (8 lines)
	// ... /proc/uptime ...

	return json(systemInfo);
}
```

**After** (20-30 lines):

```typescript
import {
	collectCPUMetrics,
	collectMemoryMetrics,
	collectDiskMetrics,
	collectNetworkMetrics,
	collectTemperatureMetrics,
	collectUptimeMetrics
} from '$lib/server/system/collectors';

export async function GET({ request }): Promise<Response> {
	const [cpu, memory, disk, network, temperature, uptime] = await Promise.all([
		collectCPUMetrics(),
		collectMemoryMetrics(),
		collectDiskMetrics(),
		collectNetworkMetrics(),
		collectTemperatureMetrics(),
		collectUptimeMetrics()
	]);

	return json({ cpu, memory, disk, network, temperature, uptime });
}
```

### 5.4 Post-Decomposition

The `GET` handler in `+server.ts` calls each collector via `Promise.all()` for parallelism, then merges results. Handler target size: 20-30 lines.

**Performance improvement**: The original sequential collection takes ~200-400ms (each `/proc` read + shell command). Parallel collection via `Promise.all()` reduces this to ~100-200ms (limited by the slowest collector).

### 5.5 Cross-Phase Notes

- **Phase 5.5.3 (CRITICAL-06)**: The decomposition pattern here (independent collectors + aggregation) is identical to the `performHealthCheck` decomposition. Share the pattern knowledge.
- **Phase 2.1.2 (Shell Injection)**: `collectDiskMetrics` and `collectTemperatureMetrics` may spawn shell commands. Ensure hardcoded command strings, not user-supplied input.

### 5.6 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/routes/api/system/info/+server.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/system/collectors.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

### 5.7 Test Requirements

| Extracted Function          | Test Cases Required                                             | Coverage Target      |
| --------------------------- | --------------------------------------------------------------- | -------------------- |
| `collectCPUMetrics`         | Valid /proc/stat content, missing file, malformed content       | 90% line coverage    |
| `collectMemoryMetrics`      | Valid /proc/meminfo, zero values, missing fields                | 90% line coverage    |
| `collectDiskMetrics`        | Normal disk, full disk, df command failure                      | 100% branch coverage |
| `collectTemperatureMetrics` | Valid vcgencmd output, command not found (non-RPi), parse error | 100% branch coverage |

Test file: `tests/unit/decomposition/system/collectors.test.ts`

---

## 6. Execution Order

1. Decompose `clusterSignals` (CRITICAL-08) -- no phase dependency
2. Decompose `getSystemInfo` (CRITICAL-09) -- no phase dependency
3. Decompose `toggleRFDetection` (CRITICAL-07) -- **BLOCKED by Phase 5.4** completion
4. Run full verification suite

**Commit strategy**: One commit per function (3 commits total).

```
refactor(phase-5.5): decompose clusterSignals into 5 sub-functions (161 -> 30 lines)
refactor(phase-5.5): decompose getSystemInfo, extract collectors.ts (156 -> 25 lines)
refactor(phase-5.5): decompose toggleRFDetection into 4 sub-functions (167 -> 25 lines)
```

---

## 7. Risk Mitigations

### 7.1 Canvas/WebGL Context Loss (CRITICAL-07)

`toggleRFDetection` operates on a Leaflet map instance. The `L.Map` object must be passed as a parameter, never cached at module level. If the map is destroyed and recreated (component remounts), stale references will throw.

**Mitigation**: All extracted functions accept `map: L.Map` as a parameter. None cache the map at module level.

### 7.2 Performance -- Function Call Overhead (CRITICAL-08)

`calculateHaversineDistance` is called O(n^2) times during neighbor search. In modern V8 (Node.js 22), the JIT compiler inlines small functions (under ~30 lines) automatically. At 10-15 lines, `calculateHaversineDistance` will be reliably inlined.

### 7.3 Error-Handling Semantics (CRITICAL-09)

Each collector should catch its own errors and return a default/error state rather than throwing. This prevents one failing collector (e.g., `vcgencmd` not available on non-RPi) from taking down the entire system info endpoint.

---

**END OF DOCUMENT**
