# Phase 5.1.5 -- Tactical Map: Extract Kismet Subsystem (Largest Extraction)

| Field             | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Phase**         | 5.1.5                                                                   |
| **Title**         | Tactical Map: Extract Kismet Subsystem                                  |
| **Risk Level**    | HIGH                                                                    |
| **Prerequisites** | Phase 5.1.1 complete, Phase 5.1.2 complete (getDeviceIconSVG available) |
| **Files Touched** | 3-4 (1 modified, 1 created, 2 existing components wired)                |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8   |
| **Audit Date**    | 2026-02-08                                                              |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                     |

---

## 1. Objective

Extract the Kismet device management subsystem from the tactical-map-simple god page.
This is the **largest single extraction** in Phase 5.1, removing ~700 lines. The
centerpiece is `fetchKismetDevices` at 260 lines -- the single most complex function
in the file -- which EXCEEDS the 60-LOC limit and must be decomposed into 5
sub-functions. Additionally, wire the two pre-built Kismet components
(`KismetController.svelte`, `DeviceManager.svelte`) to replace inline UI logic.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

### 2.1 Functions to Extract

| Function                                     | Location    | Lines | Side Effects             | >60 LOC? |
| -------------------------------------------- | ----------- | ----- | ------------------------ | -------- |
| `KismetDevicesResponse` interface            | L73-L76     | 4     | None (type definition)   | No       |
| `kismetStatus` state + `statusCheckInterval` | L78-L80     | 3     | --                       | --       |
| `fetchKismetDevices()`                       | L1467-L1726 | 260   | API call, markers, state | **YES**  |
| `checkKismetStatus()`                        | L1965-L1988 | 24    | API call                 | No       |
| `startKismet()`                              | L1989-L2021 | 33    | API call                 | No       |
| `stopKismet()`                               | L2022-L2051 | 30    | API call                 | No       |
| `_toggleKismet()`                            | L2052-L2063 | 12    | Delegates                | No       |
| `applySignalBandFilter()`                    | L355-L386   | 32    | Marker visibility        | No       |
| `toggleSignalBand(key)`                      | L312-L354   | 43    | State + filter           | No       |
| `handleSearch()`                             | L466-L486   | 21    | State                    | No       |
| `addToWhitelist()`                           | L487-L496   | 10    | State                    | No       |
| `handleSort(column)`                         | L497-L508   | 12    | State                    | No       |
| `handleDeviceRowClick(device)`               | L509-L527   | 19    | Map pan                  | No       |
| `updateDistributions()`                      | L832-L885   | 54    | State                    | No       |

### 2.2 Related State Variables

- `kismetMarkers`, `kismetDevices`, `kismetDeviceCount`
- `hiddenSignalBands`, `whitelistedMACs`, `whitelistedDeviceCount`
- `signalDistribution`, `deviceTypeDistribution`
- `searchQuery`, `sortColumn`, `sortDirection`, `selectedDevice`

### 2.3 Pre-Built Components to Wire

| Component               | Path                                    | Lines | Purpose                   |
| ----------------------- | --------------------------------------- | ----- | ------------------------- |
| KismetController.svelte | src/lib/components/tactical-map/kismet/ | 395   | Kismet start/stop/status  |
| DeviceManager.svelte    | src/lib/components/tactical-map/kismet/ | 335   | Device list, search, sort |

**Total lines to extract**: ~700

---

## 3. Decomposition of fetchKismetDevices (260 lines)

This is the single most complex function in the file. It currently handles:

1. API call to `/api/kismet/devices` (~8 lines)
2. Device iteration with marker creation (~120 lines, including popup HTML x2)
3. Device iteration with marker update (~80 lines, duplicated popup HTML)
4. Signal band filtering and age-based opacity (~20 lines)
5. Stale marker cleanup (~15 lines)
6. Counter and distribution updates (~10 lines)
7. Error handling (~7 lines)

**CRITICAL DUPLICATION**: Lines L1520-L1579 and L1617-L1675 contain near-identical
60-line Leaflet popup HTML templates. The only difference is that the first is for
new markers and the second is for updating existing markers. Both must use the same
template function.

### 3.1 Split into 5 Functions

**Function 1**: `createDevicePopupHTML(device: KismetDevice, position: Position): string`

- Pure function, returns popup HTML (~40 lines)
- Eliminates the duplication between new/update paths

**Function 2**: `createDeviceMarker(device: KismetDevice, L: LeafletLibrary, map: LeafletMap, position: Position): LeafletMarker`

- Creates a new Leaflet marker with icon and popup (~40 lines)
- Uses `getDeviceIconSVG` (from Phase 5.1.2) for icon generation

**Function 3**: `updateDeviceMarker(marker: LeafletMarker, device: KismetDevice, L: LeafletLibrary): void`

- Updates icon and popup content of an existing marker (~30 lines)

**Function 4**: `applyMarkerVisibility(marker: LeafletMarker, device: KismetDevice, hiddenBands: Set<string>): void`

- Applies signal band filter and age-based opacity (~15 lines)

**Function 5**: `fetchKismetDevices(map, L, kismetMarkers, kismetDevices, userPosition, hiddenBands): Promise<number>`

- Orchestrator: fetch, iterate, delegate to above functions, cleanup stale markers (~50 lines)

**Post-split max function length**: ~50 lines

---

## 4. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/tactical-map/kismetManager.ts`:

```typescript
// src/lib/services/tactical-map/kismetManager.ts

import type { KismetDevice } from '$lib/types/kismet';
import type { LeafletMap, LeafletLibrary, LeafletMarker } from '$lib/types/leaflet';
import { getDeviceIconSVG } from './deviceIcons'; // from Phase 5.1.2
import { getSignalColor, getSignalBandKey } from './utils'; // from Phase 5.1.1

// --- Pure functions (private) ---

function createDevicePopupHTML(
	device: KismetDevice,
	position: { lat: number; lon: number }
): string {
	// Single popup template (~40 lines)
	// Replaces the duplicated popup HTML at L1520-L1579 and L1617-L1675
}

function createDeviceMarker(
	device: KismetDevice,
	L: LeafletLibrary,
	map: LeafletMap,
	position: { lat: number; lon: number }
): LeafletMarker {
	// New marker creation (~40 lines)
}

function updateDeviceMarker(marker: LeafletMarker, device: KismetDevice, L: LeafletLibrary): void {
	// Update existing marker (~30 lines)
}

function applyMarkerVisibility(
	marker: LeafletMarker,
	device: KismetDevice,
	hiddenBands: Set<string>
): void {
	// Signal band filter + age opacity (~15 lines)
}

// --- Exported service class ---

export class KismetManager {
	// State
	private markers: Map<string, LeafletMarker> = new Map();
	private devices: Map<string, KismetDevice> = new Map();

	constructor(
		private map: LeafletMap,
		private L: LeafletLibrary
	) {}

	async fetchDevices(
		userPosition: { lat: number; lon: number },
		hiddenBands: Set<string>
	): Promise<number> {
		// Orchestrator (~50 lines)
	}

	async checkStatus(): Promise<string> {
		// Extracted from checkKismetStatus() L1965-L1988 (~24 lines)
	}

	async start(): Promise<void> {
		// Extracted from startKismet() L1989-L2021 (~33 lines)
	}

	async stop(): Promise<void> {
		// Extracted from stopKismet() L2022-L2051 (~30 lines)
	}

	toggle(): void {
		// Extracted from _toggleKismet() L2052-L2063 (~12 lines)
	}

	updateDistributions(): { signal: Record<string, number>; deviceType: Record<string, number> } {
		// Extracted from updateDistributions() L832-L885 (~54 lines)
	}

	clearAll(): void {
		// Remove all markers from map
	}
}
```

### Step 2: Wire Pre-Built KismetController.svelte (395 lines)

Replace inline `checkKismetStatus`, `startKismet`, `stopKismet`, `_toggleKismet`
with the `KismetController.svelte` component:

```svelte
<KismetController
	on:statusChange={handleKismetStatusChange}
	on:start={handleKismetStart}
	on:stop={handleKismetStop}
/>
```

**Before wiring**: Compare `KismetController.svelte` prop interface to the data
shapes in the god page. Document any mismatches.

### Step 3: Wire Pre-Built DeviceManager.svelte (335 lines)

Replace inline `handleSearch`, `addToWhitelist`, `handleSort`,
`handleDeviceRowClick`, `toggleSignalBand`, `applySignalBandFilter` with the
`DeviceManager.svelte` component:

```svelte
<DeviceManager
	devices={$kismetDevices}
	on:search={handleSearch}
	on:sort={handleSort}
	on:deviceClick={handleDeviceRowClick}
	on:whitelist={addToWhitelist}
/>
```

**Before wiring**: Compare `DeviceManager.svelte` prop interface to the data
shapes in the god page. Document any mismatches.

### Step 4: Remove All Extracted Code from God Page

Remove:

- All functions listed in Section 2.1
- All state variables listed in Section 2.2
- Add imports for `KismetManager`, `KismetController`, `DeviceManager`

### Step 5: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function fetchKismetDevices\|function checkKismetStatus\|function startKismet\|function stopKismet' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify components are wired:
grep -c 'KismetController\|DeviceManager' src/routes/tactical-map-simple/+page.svelte
# Expected: >= 2 (import lines)

# Verify service file exists and has expected size:
wc -l src/lib/services/tactical-map/kismetManager.ts
# Expected: ~350

# Verify no function in service file exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/tactical-map/kismetManager.ts
# Expected: 0 functions >60 LOC

# Verify popup HTML duplication eliminated:
grep -c 'popupContent\|popup_content\|bindPopup' src/lib/services/tactical-map/kismetManager.ts
# createDevicePopupHTML should be called exactly once per code path

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                            | Severity | Likelihood | Mitigation                                                                   |
| ----------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------- |
| Leaflet marker lifecycle broken                 | HIGH     | MEDIUM     | Manager class owns markers Map; constructor receives map via injection       |
| KismetController.svelte prop interface mismatch | MEDIUM   | MEDIUM     | Compare interface before wiring; adapt page data if needed                   |
| DeviceManager.svelte prop interface mismatch    | MEDIUM   | MEDIUM     | Compare interface before wiring; adapt page data if needed                   |
| Popup HTML visual regression                    | MEDIUM   | LOW        | Unified popup template; single source of truth eliminates divergence         |
| Svelte reactivity broken for device count       | MEDIUM   | MEDIUM     | Use writable stores for state that drives reactive template updates          |
| fetchKismetDevices orchestrator missing a step  | HIGH     | LOW        | Diff the original 260-line function against the 5 sub-functions line by line |

**Overall risk**: HIGH. This is the largest extraction (~700 lines) and involves
complex interactions between Leaflet map state, Svelte reactivity, and async data
fetching. The pre-built components may have interface mismatches. Execute with
careful incremental verification.

---

## 7. Standards Compliance

| Standard              | Requirement                                    | How This Sub-Task Satisfies It                                          |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | All extracted TypeScript passes `npm run typecheck`                     |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | Duplicated popup HTML consolidated into single template function        |
| CERT C MEM00-C        | Allocate/free in same module                   | Leaflet markers created and destroyed in same `KismetManager` class     |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines     | 260-line fetchKismetDevices split into 5 functions (max ~50 lines each) |
| NASA/JPL Rule 14      | Minimize function complexity                   | Pure functions separated from orchestrator; duplication eliminated      |
| Barr C Ch. 8          | Each module shall have a header                | `kismetManager.ts` exports typed `KismetManager` class                  |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/kismetManager.ts
```

Single commit, single revert. The pre-built components (`KismetController.svelte`,
`DeviceManager.svelte`) are not modified -- only their imports are added to the god
page.

---

_Phase 5.1.5 -- Tactical Map: Extract Kismet Subsystem (Largest Extraction)_
_Execution priority: 17 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -700 lines from god page_
