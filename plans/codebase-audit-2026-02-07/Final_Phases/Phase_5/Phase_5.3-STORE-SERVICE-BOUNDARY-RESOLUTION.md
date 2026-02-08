# Phase 5.3 -- Store-Service Boundary Resolution

| Field             | Value                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **Phase**         | 5.3 of 6                                                                                                 |
| **Risk Level**    | LOW-MEDIUM                                                                                               |
| **Prerequisites** | Phase 5.2 (HackRF/USRP Consolidation) complete                                                           |
| **Files Touched** | ~30 (15 type-import rewrites, 11 runtime fixes, 4 exemptions, 2 deletions; ~~circular dep fix removed~~) |
| **Estimated LOC** | ~280 changed, ~120 new (type files), ~60 deleted                                                         |
| **Standards**     | MISRA C:2012 Rule 8.7, CERT C STR00-C, NASA/JPL Rule 15                                                  |
| **Approver**      | Lead Software Architect                                                                                  |

---

## 1. Audit Corrections

The prior audit plan (Phase 5.3 draft, 2026-02-07) contained numerical errors subsequently
identified during grep-verified re-audit. This section documents every correction.

| Metric                      | Prior Plan (WRONG) | Verified Count (CORRECT) | Delta | Root Cause of Error                             |
| --------------------------- | -----------------: | -----------------------: | ----: | ----------------------------------------------- |
| Files importing from stores |                 32 |                       28 |    -4 | Counted deleted files and barrel re-exports     |
| Runtime violations          |                 17 |                       11 |    -6 | Miscounted type-only imports as runtime         |
| Type-only imports           |                 15 |                       15 |     0 | Correct                                         |
| Example/test files          |      (not counted) |                        2 |    +2 | Newly identified category                       |
| Architectural exemptions    |      (not counted) |                        4 |    +4 | hackrfsweep store-action pattern not recognized |

**Operational Impact**: The prior plan would have touched 6 files that require no modification
(type-only imports miscategorized as runtime violations) and missed 2 files requiring deletion.
Executing the prior plan verbatim would have introduced unnecessary code churn and left dead
example code in the repository.

---

## 2. Architectural Principle: Store-Service Boundary

### 2.1 The Invariant

In a well-architected SvelteKit application, the dependency graph flows in one direction:

```
  Component (Svelte) --> Store (reactive state) --> Service (business logic)
                 \                                      |
                  \------ reads store via $store --------/
```

Services MUST NOT import stores. This is the software equivalent of MISRA Rule 8.7
(functions shall have file scope where possible): a service that directly mutates a store
creates a hidden coupling path that defeats both static analysis and unit test isolation.

**Permitted pattern**: Service receives callbacks or returns values; the component (or a
thin adapter layer) is responsible for writing those values into stores.

**Sole exception**: "Store action services" where the service IS the store's write API,
co-located in the same feature module (see Section 6.4).

### 2.2 Why This Matters for Deployed Systems

On constrained embedded targets (RPi 5, 8GB RAM), store-service coupling prevents:

1. **Tree-shaking**: Bundler cannot eliminate unused store code when services hard-import it.
2. **Test isolation**: Unit testing a service requires mocking the entire Svelte store system.
3. **HMR stability**: Vite HMR cannot correctly invalidate modules when circular store-service
   paths exist (observed as stale state after hot reload during NTC field exercises).
4. **Memory profiling**: Heap snapshots show store closures retained by service references,
   preventing garbage collection of stale reactive subscriptions.

---

## 3. ~~Task 5.3.1 -- Resolve Circular Dependency~~ **REMOVED**

> **REGRADE CORRECTION (2026-02-08)**: This task has been **removed** from the execution plan.
>
> **Reason**: The only detected "circular dependency" between `heatmapService.ts` and
> `webglHeatmapRenderer.ts` is a **pure `import type` cycle**. TypeScript's `import type`
> is erased at compile time -- it generates zero JavaScript output and creates no runtime
> circular dependency. The `madge --circular` tool flags it because it operates on static
> import graph analysis without distinguishing type-only imports from runtime imports.
>
> **Verification**: `npx madge --circular --extensions ts src/` reports 1 cycle, but
> inspecting the cycle reveals line 5 of `webglHeatmapRenderer.ts` uses `import type`,
> which is compile-time only. There is **0 runtime circular dependency**.
>
> **Standards compliance**: While NASA/JPL Rule 15 prohibits circular `#include`
> dependencies, TypeScript `import type` is NOT analogous to C `#include` -- it is a
> compile-time type annotation with no runtime effect. The existing code is correct.
>
> **Impact**: Removing this task reduces Phase 5.3 effort by ~1 hour. The type extraction
> described in the original fix (moving `HeatmapLayer` to `types/map.ts`) will still occur
> as a natural side effect of Task 5.3.2 (type-only import migration), which already
> creates `types/map.ts` for other type consolidation work.
>
> The original task content is preserved below (struck through) for audit trail purposes.

<details>
<summary>Original Task 5.3.1 (REMOVED -- click to expand for audit trail)</summary>

### 3.1 Identified Cycle

Total circular dependency cycles detected: **1**

```
src/lib/services/map/heatmapService.ts
    line 8: import { WebGLHeatmapRenderer } from './webglHeatmapRenderer'   [RUNTIME]
        |
        v
src/lib/services/map/webglHeatmapRenderer.ts
    line 5: import type { HeatmapLayer } from './heatmapService'            [TYPE-ONLY]
        |
        +--- (cycle back to heatmapService.ts)
```

**Severity**: LOW. The `import type` on line 5 of `webglHeatmapRenderer.ts` is erased at
compile time by TypeScript. There is no runtime circular dependency. However, this pattern
violates NASA/JPL Rule 15 ("no circular #include dependencies") and confuses static analysis
tools including `madge`, `dependency-cruiser`, and IDE refactoring operations.

### 3.2 Root Cause

The `HeatmapLayer` interface is defined in `heatmapService.ts` (a service file) but is
consumed as a type by `webglHeatmapRenderer.ts` (a peer service). The interface describes
a data structure, not service behavior, and therefore belongs in a shared types module.

### 3.3 Current Code (BEFORE)

**File: `src/lib/services/map/heatmapService.ts`** (lines 32-40):

```typescript
export interface HeatmapLayer {
	id: string;
	name: string;
	altitudeRange: [number, number]; // [min, max] in meters
	points: HeatmapPoint[];
	visible: boolean;
	opacity: number;
	config: HeatmapConfig;
}
```

**File: `src/lib/services/map/webglHeatmapRenderer.ts`** (line 5):

```typescript
import type { HeatmapLayer } from './heatmapService';
```

### 3.4 Fix (AFTER)

**Step A**: Create or extend `src/lib/types/map.ts`:

```typescript
// src/lib/types/map.ts
// Shared map-related type definitions extracted from service modules.
// Eliminates circular dependency: heatmapService <-> webglHeatmapRenderer.

import type { HeatmapConfig, HeatmapPoint } from '$lib/services/map/heatmapService';

export interface HeatmapLayer {
	id: string;
	name: string;
	altitudeRange: [number, number];
	points: HeatmapPoint[];
	visible: boolean;
	opacity: number;
	config: HeatmapConfig;
}
```

Note: If `HeatmapConfig` and `HeatmapPoint` are also consumed by other modules (they are --
`HeatmapPoint` is imported by `kismetRSSIService.ts`), move them to `types/map.ts` as well
to eliminate all cross-service type imports from this cluster.

**Step B**: Update `heatmapService.ts`:

```typescript
// REMOVE: export interface HeatmapLayer { ... }
// ADD:
export type { HeatmapLayer } from '$lib/types/map';
// This re-export preserves backward compatibility for all existing consumers.
```

**Step C**: Update `webglHeatmapRenderer.ts`:

```typescript
// BEFORE:
import type { HeatmapLayer } from './heatmapService';
// AFTER:
import type { HeatmapLayer } from '$lib/types/map';
```

### 3.5 Verification

```bash
# Verify zero circular dependencies
npx madge --circular --extensions ts src/

# Verify no remaining import of HeatmapLayer from heatmapService in peer services
grep -rn "from.*heatmapService.*import.*HeatmapLayer" src/lib/services/ \
  | grep -v "heatmapService.ts" \
  | grep -v "re-export"
# Expected: 0 results

# TypeScript compilation
npx tsc --noEmit
```

</details>

---

## 4. Task 5.3.2 -- Migrate Type-Only Store Imports

### 4.1 Inventory

15 service files import types from store modules. These imports are syntactically
`import type { ... }` and are erased at compile time. They produce no runtime coupling.
However, they violate the architectural boundary: types should be defined in `$lib/types/`,
not co-located with reactive store definitions.

| #   | File (relative to `src/lib/`)             | Imported Type(s)                           | Source Store                 |
| --- | ----------------------------------------- | ------------------------------------------ | ---------------------------- |
| 1   | server/db/database.ts                     | SignalMarker                               | stores/map/signals           |
| 2   | server/db/geo.ts                          | SignalMarker                               | stores/map/signals           |
| 3   | server/db/signalRepository.ts             | SignalMarker                               | stores/map/signals           |
| 4   | services/db/dataAccessLayer.ts            | SignalMarker                               | stores/map/signals           |
| 5   | services/db/signalDatabase.ts             | SignalMarker                               | stores/map/signals           |
| 6   | services/drone/flightPathAnalyzer.ts      | FlightPoint, SignalCapture, AreaOfInterest | stores/drone                 |
| 7   | services/map/aiPatternDetector.ts         | SignalMarker                               | stores/map/signals           |
| 8   | services/map/contourGenerator.ts          | SignalMarker                               | stores/map/signals           |
| 9   | services/map/droneDetection.ts            | SignalMarker                               | stores/map/signals           |
| 10  | services/map/heatmapService.ts            | SignalMarker                               | stores/map/signals           |
| 11  | services/map/mapUtils.ts                  | SignalMarker                               | stores/map/signals           |
| 12  | services/map/networkAnalyzer.ts           | SignalMarker                               | stores/map/signals           |
| 13  | services/map/signalClustering.ts          | SignalMarker                               | stores/map/signals           |
| 14  | services/map/signalFiltering.ts           | SignalMarker                               | stores/map/signals           |
| 15  | services/tactical-map/cellTowerService.ts | LeafletMap                                 | stores/tactical-map/mapStore |

### 4.2 Phase A -- Create Type Definition Files

Three new type files are required. Each extracts types from their current store location.

**File 1: `src/lib/types/signals.ts`**

Extract from `src/lib/stores/map/signals.ts` (lines 6-29):

```typescript
// src/lib/types/signals.ts
// Canonical definition of signal-related domain types.
// Previously co-located with Svelte store in stores/map/signals.ts.

import { SignalSource } from '$lib/types/enums';

export interface SignalMarker {
	id: string;
	lat: number;
	lon: number;
	frequency: number;
	power: number;
	timestamp: number;
	altitude?: number;
	source: SignalSource;
	metadata: {
		ssid?: string;
		mac?: string;
		channel?: number;
		encryption?: string;
		vendor?: string;
		signalType?: string;
		bandwidth?: number;
		modulation?: string;
		velocity?: { speed: number; heading: number };
		flightPath?: { lat: number; lon: number; alt: number }[];
		type?: string;
		deviceId?: string;
	};
}
```

**File 2: `src/lib/types/drone.ts`**

Extract from `src/lib/stores/drone` (type locations to be verified at execution):

```typescript
// src/lib/types/drone.ts
// Drone flight and signal capture domain types.

export interface FlightPoint {
	lat: number;
	lon: number;
	altitude: number;
	heading: number;
	speed: number;
	timestamp: number;
}

export interface SignalCapture {
	frequency: number;
	power: number;
	position: FlightPoint;
	timestamp: number;
}

export interface AreaOfInterest {
	center: { lat: number; lon: number };
	radius: number;
	label: string;
	signalCount: number;
}
```

**File 3: `src/lib/types/map.ts`** (extend if created in Task 5.3.1)

```typescript
// Append to src/lib/types/map.ts (or create if not yet present)

// LeafletMap type alias -- previously in stores/tactical-map/mapStore.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafletMap = any;
```

### 4.3 Phase B -- Update Store Re-exports

Each store file that previously defined these types must re-export from the new canonical
location. This preserves backward compatibility for any Svelte components that import types
from the store (components are permitted to import from stores).

**`src/lib/stores/map/signals.ts`**:

```typescript
// BEFORE (lines 6-29):
// export interface SignalMarker { ... }

// AFTER:
export type { SignalMarker } from '$lib/types/signals';
// All SignalMarker usage within this file now imports from the canonical source.
```

**`src/lib/stores/tactical-map/mapStore.ts`**:

```typescript
// BEFORE:
// export type LeafletMap = any;

// AFTER:
export type { LeafletMap } from '$lib/types/map';
```

### 4.4 Phase C -- Rewrite 15 Service Import Paths

Each of the 15 files changes exactly one import line. Example for all SignalMarker consumers:

```typescript
// BEFORE:
import type { SignalMarker } from '$lib/stores/map/signals';

// AFTER:
import type { SignalMarker } from '$lib/types/signals';
```

For `flightPathAnalyzer.ts`:

```typescript
// BEFORE:
import type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/stores/drone';

// AFTER:
import type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/types/drone';
```

For `cellTowerService.ts`:

```typescript
// BEFORE:
import type { LeafletMap } from '$lib/stores/tactical-map/mapStore';

// AFTER:
import type { LeafletMap } from '$lib/types/map';
```

### 4.5 Verification

```bash
# Verify zero type-only imports from stores in service/server files
grep -rn "from.*stores.*import type" src/lib/services/ src/lib/server/
# Expected: 0 results

# Verify store re-exports work (components still compile)
npx tsc --noEmit

# Verify no runtime behavior change
npm run test:unit
```

---

## 5. Task 5.3.3 -- Resolve Runtime Store Violations

### 5.1 Violation Classification

11 service files import store modules at runtime (non-type imports). These create hard
coupling between the service layer and Svelte's reactive system. The refactoring pattern
applied depends on the nature of the violation.

#### Priority 1: API Services (2 files) -- Callback Injection

These files call store mutation functions (`updateConnectionStatus`, `updateSpectrumData`,
etc.) directly after receiving SSE events or API responses.

| File                          | Store Import         | Mutation Functions Called                                                                                   |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `services/hackrf/api.ts`      | `$lib/stores/hackrf` | updateConnectionStatus, updateSweepStatus, updateSpectrumData, updateCycleStatus, updateEmergencyStopStatus |
| `services/hackrf/usrp-api.ts` | `$lib/stores/hackrf` | updateConnectionStatus, updateSweepStatus, updateSpectrumData, updateCycleStatus, updateEmergencyStopStatus |

**Note**: `usrp-api.ts` imports from `$lib/stores/hackrf` (the HackRF store), not a USRP
store. This is documented as a known design choice -- USRP and HackRF share the same UI
store because the frontend renders identical spectrum displays for both devices. This is
NOT a bug but MUST be documented in a code comment.

**BEFORE** (`services/hackrf/api.ts`, lines 1-8):

```typescript
import {
	updateConnectionStatus,
	updateSweepStatus,
	updateSpectrumData,
	updateCycleStatus,
	updateEmergencyStopStatus,
	type SpectrumData
} from '$lib/stores/hackrf';
```

The service directly calls these store mutation functions throughout its methods:

```typescript
// Line 108 (inside SSE 'connected' handler):
updateConnectionStatus({ connected: true, connecting: false, error: null });

// Line 167 (inside SSE 'sweep_data' handler):
updateSpectrumData(spectrumData);

// Line 79 (inside emergencyStop method):
updateEmergencyStopStatus({ active: true, timestamp: Date.now() });
```

**AFTER** -- Callback injection pattern:

```typescript
// src/lib/services/hackrf/api.ts

// REMOVED: all imports from '$lib/stores/hackrf' except type SpectrumData
import type { SpectrumData } from '$lib/types/hackrf';
import type { HackRFData } from '$lib/types/signals';
import type { HackRFStatus } from '$lib/services/api/hackrf';
import { logError, logInfo, logDebug, logWarn } from '$lib/utils/logger';
import { SystemStatus } from '$lib/types/enums';

/**
 * Callback interface for store mutations.
 * The component that instantiates HackRFAPI provides these callbacks,
 * keeping the service layer decoupled from Svelte stores.
 */
export interface HackRFAPICallbacks {
	onConnectionStatusChange: (updates: Partial<ConnectionStatus>) => void;
	onSweepStatusChange: (updates: Partial<SweepStatus>) => void;
	onSpectrumData: (data: SpectrumData) => void;
	onCycleStatusChange: (updates: Partial<CycleStatus>) => void;
	onEmergencyStop: (updates: Partial<EmergencyStopStatus>) => void;
}

// Type imports for the callback parameter types
export interface ConnectionStatus {
	connected: boolean;
	connecting: boolean;
	error: string | null;
}

export interface SweepStatus {
	active: boolean;
	startFreq: number;
	endFreq: number;
	currentFreq: number;
	progress: number;
}

export interface CycleStatus {
	active: boolean;
	currentCycle: number;
	totalCycles: number;
	progress: number;
}

export interface EmergencyStopStatus {
	active: boolean;
	timestamp: number;
}

export class HackRFAPI {
	private callbacks: HackRFAPICallbacks;
	eventSource: EventSource | null = null;
	// ... (other fields unchanged)

	constructor(callbacks: HackRFAPICallbacks) {
		this.callbacks = callbacks;
	}

	// Usage inside SSE handler changes from:
	//   updateConnectionStatus({ connected: true, connecting: false, error: null });
	// to:
	//   this.callbacks.onConnectionStatusChange({ connected: true, connecting: false, error: null });

	// Usage inside sweep_data handler changes from:
	//   updateSpectrumData(spectrumData);
	// to:
	//   this.callbacks.onSpectrumData(spectrumData);

	// Usage inside emergencyStop changes from:
	//   updateEmergencyStopStatus({ active: true, timestamp: Date.now() });
	// to:
	//   this.callbacks.onEmergencyStop({ active: true, timestamp: Date.now() });
}
```

**Component-side wiring** (in the Svelte component or page that creates the API):

```typescript
// In +page.svelte <script> block:
import {
	updateConnectionStatus,
	updateSweepStatus,
	updateSpectrumData,
	updateCycleStatus,
	updateEmergencyStopStatus
} from '$lib/stores/hackrf';

const hackrfAPI = new HackRFAPI({
	onConnectionStatusChange: updateConnectionStatus,
	onSweepStatusChange: updateSweepStatus,
	onSpectrumData: updateSpectrumData,
	onCycleStatusChange: updateCycleStatus,
	onEmergencyStop: updateEmergencyStopStatus
});
```

This pattern passes the store mutation functions as first-class function references.
The service never imports from `$lib/stores/` and can be unit-tested with mock callbacks.

#### Priority 2: Tactical Map GPS Service (1 file) -- Callback Injection

| File                                  | Store Import                        | Mutation Functions Called                           |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `services/tactical-map/gpsService.ts` | `$lib/stores/tactical-map/gpsStore` | updateGPSPosition, updateGPSStatus, gpsStore (read) |

**BEFORE** (`services/tactical-map/gpsService.ts`, lines 1-3):

```typescript
import { gpsStore, updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gpsStore';
```

The service calls `updateGPSPosition()` and `updateGPSStatus()` after each GPS poll (line
54 and 55-66), and returns the raw store reference from `getCurrentPosition()` (line 96).

**AFTER** -- Callback injection:

```typescript
// src/lib/services/tactical-map/gpsService.ts

import { detectCountry, formatCoordinates } from '$lib/utils/countryDetector';
import { latLonToMGRS } from '$lib/utils/mgrsConverter';

export interface GPSServiceCallbacks {
	onPositionUpdate: (position: { lat: number; lon: number }) => void;
	onStatusUpdate: (status: Partial<GPSStatusUpdate>) => void;
}

export interface GPSStatusUpdate {
	hasGPSFix: boolean;
	gpsStatus: string;
	accuracy: number;
	satellites: number;
	fixType: string;
	heading: number | null;
	speed: number | null;
	currentCountry: { name: string; flag: string };
	formattedCoords: { lat: string; lon: string };
	mgrsCoord: string;
}

export class GPSService {
	private callbacks: GPSServiceCallbacks;
	private positionInterval: NodeJS.Timeout | null = null;
	private readonly UPDATE_INTERVAL = 2000;

	constructor(callbacks: GPSServiceCallbacks) {
		this.callbacks = callbacks;
	}

	async updateGPSPosition(): Promise<void> {
		try {
			const response = await fetch('/api/gps/position');
			const result = (await response.json()) as GPSApiResponse;

			if (result.success && result.data) {
				const position = {
					lat: result.data.latitude,
					lon: result.data.longitude
				};
				// ... (coordinate formatting unchanged)

				// BEFORE: updateGPSPosition(position);
				// AFTER:
				this.callbacks.onPositionUpdate(position);

				// BEFORE: updateGPSStatus({ hasGPSFix: fix >= 2, ... });
				// AFTER:
				this.callbacks.onStatusUpdate({
					hasGPSFix: fix >= 2,
					gpsStatus,
					accuracy,
					satellites,
					fixType,
					heading,
					speed,
					currentCountry,
					formattedCoords,
					mgrsCoord
				});
			} else {
				this.callbacks.onStatusUpdate({ gpsStatus: 'GPS: No Fix' });
			}
		} catch (error) {
			console.error('GPS fetch error:', error);
			this.callbacks.onStatusUpdate({ gpsStatus: 'GPS: Error' });
		}
	}

	// REMOVED: getCurrentPosition() that returned raw store reference
	// Components read gpsStore directly via $gpsStore
}
```

**Component-side wiring**:

```typescript
import { updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gpsStore';

const gpsService = new GPSService({
	onPositionUpdate: updateGPSPosition,
	onStatusUpdate: updateGPSStatus
});
```

#### Priority 3: Tactical Map Services (3 files) -- Mixed Patterns

| File                                     | Store Imports                                  | Pattern            |
| ---------------------------------------- | ---------------------------------------------- | ------------------ |
| `services/tactical-map/hackrfService.ts` | hackrf (spectrumData), hackrfStore (mutations) | Subscribe + mutate |
| `services/tactical-map/kismetService.ts` | kismetStore (read + mutate)                    | Read-then-mutate   |
| `services/tactical-map/mapService.ts`    | mapStore (read + mutate), gpsStore (read)      | Read + mutate      |

**5.3.3.A: hackrfService.ts**

**BEFORE** (lines 1-10):

```typescript
import { hackrfAPI } from '$lib/services/hackrf/api';
import { spectrumData } from '$lib/stores/hackrf';
import {
	hackrfStore,
	setConnectionStatus,
	setSearchingState,
	setTargetFrequency,
	clearAllSignals,
	type SimplifiedSignal
} from '$lib/stores/tactical-map/hackrfStore';
```

This service subscribes to `spectrumData` store (line 25) and reads `hackrfStore` via
the subscribe-then-immediately-unsubscribe antipattern (lines 29-31):

```typescript
let currentState: any;
const unsubscribe = hackrfStore.subscribe((s) => (currentState = s));
unsubscribe();
```

**AFTER** -- Callback + getter injection:

```typescript
import { hackrfAPI } from '$lib/services/hackrf/api';
import { SignalAggregator } from '../../../routes/tactical-map-simple/SignalAggregator';

export interface HackRFServiceCallbacks {
	onConnectionStatusChange: (status: string) => void;
	onSearchingStateChange: (searching: boolean) => void;
	onTargetFrequencyChange: (freq: number) => void;
	onClearSignals: () => void;
	getIsSearching: () => boolean;
}

export interface HackRFServiceDeps {
	subscribeSpectrumData: (handler: (data: any) => void) => () => void;
	callbacks: HackRFServiceCallbacks;
}

export class HackRFService {
	private spectrumUnsubscribe: (() => void) | null = null;
	private aggregator: SignalAggregator;
	private deps: HackRFServiceDeps;

	constructor(deps: HackRFServiceDeps) {
		this.deps = deps;
		this.aggregator = new SignalAggregator();
	}

	connectToHackRF(): void {
		hackrfAPI.connectToDataStream();

		this.spectrumUnsubscribe = this.deps.subscribeSpectrumData((data) => {
			if (data && this.deps.callbacks.getIsSearching()) {
				this.aggregator.addSpectrumData(data);
			}
		});

		this.deps.callbacks.onConnectionStatusChange('Connected');
	}

	startSearch(frequency: number): void {
		this.deps.callbacks.onTargetFrequencyChange(frequency);
		this.deps.callbacks.onSearchingStateChange(true);
		this.deps.callbacks.onClearSignals();
	}
}
```

**5.3.3.B: kismetService.ts**

**BEFORE** (lines 1-9):

```typescript
import type { KismetDevice } from '$lib/types/kismet';
import {
	kismetStore,
	setKismetStatus,
	clearAllKismetDevices,
	addKismetDevice,
	removeKismetDevice,
	updateDistributions
} from '$lib/stores/tactical-map/kismetStore';
```

The service uses the subscribe-then-unsubscribe antipattern to read current status:

```typescript
let currentStatus: string = 'stopped';
const unsubscribe = kismetStore.subscribe((state) => (currentStatus = state.status));
unsubscribe();
```

**AFTER** -- Callback injection:

```typescript
import type { KismetDevice } from '$lib/types/kismet';

export interface KismetServiceCallbacks {
	onStatusChange: (status: 'stopped' | 'starting' | 'running' | 'stopping') => void;
	onDeviceAdded: (device: KismetDevice) => void;
	onDeviceRemoved: (mac: string) => void;
	onDevicesCleared: () => void;
	onDistributionsUpdated: (devices: Map<string, KismetDevice>) => void;
	getCurrentStatus: () => string;
}

export class KismetService {
	private callbacks: KismetServiceCallbacks;

	constructor(callbacks: KismetServiceCallbacks) {
		this.callbacks = callbacks;
	}

	async checkKismetStatus(): Promise<void> {
		try {
			const response = await fetch('/api/kismet/control', {
				/* ... */
			});
			if (response.ok) {
				const data = (await response.json()) as KismetControlResponse;
				// BEFORE: subscribe-unsubscribe antipattern to read current status
				// AFTER: clean getter call
				const currentStatus = this.callbacks.getCurrentStatus();

				if (data.running && currentStatus === 'stopped') {
					this.callbacks.onStatusChange('running');
				} else if (!data.running && currentStatus === 'running') {
					this.callbacks.onStatusChange('stopped');
				}
			}
		} catch (error) {
			console.error('Error checking Kismet status:', error);
		}
	}
}
```

**5.3.3.C: mapService.ts**

**BEFORE** (lines 1-3):

```typescript
import {
	mapStore,
	setMap,
	setUserMarker,
	setAccuracyCircle,
	type LeafletMap,
	type LeafletMarker,
	type LeafletCircle
} from '$lib/stores/tactical-map/mapStore';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
import { get } from 'svelte/store';
```

The service calls `get(mapStore)` and `get(gpsStore)` to synchronously read state, then
calls `setMap()`, `setUserMarker()`, and `setAccuracyCircle()` to write back.

**AFTER** -- Callback + state getter injection:

```typescript
import type { LeafletMap, LeafletMarker, LeafletCircle } from '$lib/types/map';

export interface MapState {
	map: LeafletMap | null;
}

export interface GPSState {
	position: { lat: number; lon: number };
	status: { hasGPSFix: boolean; accuracy: number };
}

export interface MapServiceCallbacks {
	onMapCreated: (map: LeafletMap) => void;
	onUserMarkerCreated: (marker: LeafletMarker) => void;
	onAccuracyCircleCreated: (circle: LeafletCircle) => void;
	getMapState: () => MapState;
	getGPSState: () => GPSState;
}

export class MapService {
	private L: any = null;
	private callbacks: MapServiceCallbacks;

	constructor(callbacks: MapServiceCallbacks) {
		this.callbacks = callbacks;
	}

	async initializeMap(mapContainer: HTMLDivElement): Promise<LeafletMap | null> {
		await this.initializeLeaflet();

		// BEFORE: const mapState = get(mapStore);
		// AFTER:
		const mapState = this.callbacks.getMapState();

		// BEFORE: const gpsState = get(gpsStore);
		// AFTER:
		const gpsState = this.callbacks.getGPSState();

		if (!mapContainer || mapState.map || !gpsState.status.hasGPSFix || !this.L) {
			return null;
		}

		const map = this.L.map(mapContainer).setView(
			[gpsState.position.lat, gpsState.position.lon],
			15
		);
		// ... tile layer setup ...

		// BEFORE: setMap(map);
		// AFTER:
		this.callbacks.onMapCreated(map);
		return map;
	}
}
```

#### Priority 4: RSSI Service (1 file) -- Getter Injection

| File                                | Store Import                     | Usage                                   |
| ----------------------------------- | -------------------------------- | --------------------------------------- |
| `services/map/kismetRSSIService.ts` | gpsStore (read only via `get()`) | Read GPS position for RSSI calculations |

**BEFORE** (`services/map/kismetRSSIService.ts`, lines 9-10):

```typescript
import { get } from 'svelte/store';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
```

Usage at line 58:

```typescript
const gps = get(gpsStore);
if (!gps.position || gps.status.accuracy > 20) {
	return;
}
```

**AFTER** -- Constructor-injected getter:

```typescript
export interface KismetRSSIServiceDeps {
	getGPSPosition: () => { lat: number; lon: number } | null;
	getGPSAccuracy: () => number;
}

export class KismetRSSIService {
	private deps: KismetRSSIServiceDeps;

	constructor(deps: KismetRSSIServiceDeps) {
		this.deps = deps;
	}

	processKismetDevices(devices: KismetDevice[]): void {
		if (!this.config.enabled || !this.localizer) return;

		// BEFORE: const gps = get(gpsStore);
		// AFTER:
		const position = this.deps.getGPSPosition();
		const accuracy = this.deps.getGPSAccuracy();
		if (!position || accuracy > 20) {
			return;
		}
		// ... rest uses position.lat, position.lon
	}
}
```

**Component-side wiring** (for kismetRSSIService):

```typescript
import { get } from 'svelte/store';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

const rssiService = new KismetRSSIService({
	getGPSPosition: () => {
		const state = get(gpsStore);
		return state.position.lat !== 0 ? state.position : null;
	},
	getGPSAccuracy: () => get(gpsStore).status.accuracy
});
```

### 5.2 Architectural Exemptions: hackrfsweep Store-Action Services (4 files)

The following 4 files implement the "store action service" pattern, where the service IS the
authorized write API for its co-located store. This is a deliberate architectural choice, not
a violation.

| File                                       | Store(s) Imported                 | Rationale                                                           |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------- |
| `services/hackrfsweep/controlService.ts`   | controlStore, frequencyStore      | Service wraps controlActions/frequencyStore for sweep orchestration |
| `services/hackrfsweep/displayService.ts`   | displayStore                      | Service wraps displayActions for timer/progress display             |
| `services/hackrfsweep/frequencyService.ts` | frequencyStore                    | Service wraps frequencyActions for frequency CRUD                   |
| `services/hackrfsweep/signalService.ts`    | signalStore, displayStore, hackrf | Service orchestrates signal processing pipeline across stores       |

**Documentation requirement**: Add the following JSDoc comment to each of these 4 files:

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: [controlStore | displayStore | frequencyStore | signalStore]
 */
```

---

## 6. Task 5.3.4 -- Delete Example/Test Files

### 6.1 Inventory

| File                                    | Reason for Deletion                                            | Store Imports              |
| --------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| `services/websocket/example-usage.ts`   | Example code, not imported by any production module            | Multi-store imports        |
| `services/websocket/test-connection.ts` | Test helper, not imported; contains commented-out store import | Commented-out store import |

### 6.2 Pre-Deletion Verification

```bash
# Verify zero imports of example-usage.ts
grep -rn "example-usage" src/ --include="*.ts" --include="*.svelte"
# Expected: 0 results (only the file itself)

# Verify zero imports of test-connection.ts
grep -rn "test-connection" src/ --include="*.ts" --include="*.svelte"
# Expected: 0 results (only the file itself)
```

### 6.3 Deletion Commands

```bash
git rm src/lib/services/websocket/example-usage.ts
git rm src/lib/services/websocket/test-connection.ts
```

### 6.4 Post-Deletion Verification

```bash
npx tsc --noEmit
npm run build
```

---

## 7. Execution Order

Tasks MUST be executed in the following sequence. Each task's verification gate must pass
before proceeding to the next.

```
~~Task 5.3.1~~  REMOVED (type-only cycle is harmless; see Section 3)
   |
   |  [No gate -- task removed, proceed directly to 5.3.2]
   |
Task 5.3.2  Migrate type-only store imports (15 files)
   |          NOTE: Also handles HeatmapLayer type extraction (originally in 5.3.1)
   |
   v  [GATE: grep "from.*stores.*import type" in services/server returns 0]
   |
Task 5.3.3  Resolve runtime store violations (11 files)
   |         Priority 1: hackrf/api.ts, hackrf/usrp-api.ts
   |         Priority 2: tactical-map/gpsService.ts
   |         Priority 3: tactical-map/hackrfService.ts, kismetService.ts, mapService.ts
   |         Priority 4: map/kismetRSSIService.ts
   |
   v  [GATE: grep "from.*stores" in services/ returns only 4 exempted files]
   |
Task 5.3.4  Delete example/test files (2 files)
   |
   v  [GATE: npx tsc --noEmit && npm run build]
   |
   DONE
```

**Critical constraint**: Task 5.3.3 Priority 1 (api.ts, usrp-api.ts) MUST execute after
Phase 5.2 HackRF/USRP consolidation, because Phase 5.2 may merge these two files into a
single unified SDR API class. If Phase 5.2 merges them, apply the callback injection pattern
to the merged file only.

---

## 8. Verification Checklist

Execute all verification commands after completing all four tasks. Every check must pass.

### 8.1 Circular Dependency Verification

```bash
npx madge --circular --extensions ts src/
# EXPECTED: No circular dependency found
```

### 8.2 Store-Service Boundary Verification

```bash
# Type-only imports from stores in service/server files: must be 0
grep -rn "from.*stores.*import type" src/lib/services/ src/lib/server/
# EXPECTED: 0 results

# Runtime imports from stores in service files: must be exactly 4 (exempted)
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "\.d\.ts" \
  | grep -v "example-usage" \
  | grep -v "test-connection"
# EXPECTED: exactly 4 lines, all in services/hackrfsweep/
```

### 8.3 Type System Verification

```bash
npx tsc --noEmit
# EXPECTED: 0 errors
```

### 8.4 Build Verification

```bash
npm run build
# EXPECTED: build succeeds, no import resolution errors
```

### 8.5 Unit Test Verification

```bash
npm run test:unit
# EXPECTED: all tests pass (services with new constructors may need test updates)
```

### 8.6 Deleted File Verification

```bash
# Verify example/test files are gone
ls src/lib/services/websocket/example-usage.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS"
ls src/lib/services/websocket/test-connection.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS"
```

---

## 9. Risk Mitigations

### 9.1 Risk: Constructor Signature Change Breaks Consumers

**Probability**: MEDIUM. Services that gain a `callbacks` constructor parameter will break
any code that calls `new ServiceName()` without arguments.

**Mitigation**: Search for all instantiation sites before modifying each service:

```bash
grep -rn "new HackRFAPI(" src/ --include="*.ts" --include="*.svelte"
grep -rn "new GPSService(" src/ --include="*.ts" --include="*.svelte"
grep -rn "new KismetService(" src/ --include="*.ts" --include="*.svelte"
grep -rn "new MapService(" src/ --include="*.ts" --include="*.svelte"
grep -rn "new KismetRSSIService(" src/ --include="*.ts" --include="*.svelte"
grep -rn "new HackRFService(" src/ --include="*.ts" --include="*.svelte"
```

Update every call site to pass the required callbacks. If more than 3 call sites exist for
a single service, consider a default callback set exported alongside the service to minimize
churn.

### 9.2 Risk: Store Re-export Breaks Component Imports

**Probability**: LOW. The re-export pattern (`export type { X } from '$lib/types/y'`) is
fully transparent to consumers. TypeScript resolves the re-export at compile time.

**Mitigation**: Run `npx tsc --noEmit` after Phase B of Task 5.3.2 before proceeding.

### 9.3 Risk: HMR Invalidation After Refactor

**Probability**: LOW. Changing import paths may cause Vite to invalidate more modules than
expected on the first HMR cycle after the change.

**Mitigation**: After completing all tasks, restart the dev server (`npm run dev:clean`)
and verify that HMR works correctly for at least 3 code change cycles.

### 9.4 Risk: wigletotak/wigleService.ts Discovered at Execution Time

**Probability**: LOW. This file may contain runtime store imports not captured in the
current audit.

**Mitigation**: At execution time, run the store boundary verification (Section 8.2)
and resolve any additional violations using the same callback injection pattern.

### 9.5 Risk: Phase 5.2 Changes Invalidate Priority 1 Targets

**Probability**: HIGH. Phase 5.2 may merge `api.ts` and `usrp-api.ts` or significantly
restructure the HackRF service layer.

**Mitigation**: Task 5.3.3 Priority 1 MUST NOT begin until Phase 5.2 is complete and
merged. Re-verify the target file list after Phase 5.2 completes:

```bash
grep -rn "from.*stores" src/lib/services/hackrf/ --include="*.ts" | grep -v "import type"
```

---

## Appendix A: Subscribe-Then-Unsubscribe Antipattern

Multiple files in this codebase use the following pattern to synchronously read Svelte
store state from within a service:

```typescript
let currentState: any;
const unsubscribe = someStore.subscribe((s) => (currentState = s));
unsubscribe();
// currentState now holds the snapshot
```

This is functionally equivalent to `get(someStore)` from `svelte/store` but more verbose
and error-prone. It works because Svelte's `subscribe()` calls the callback synchronously
with the current value before returning.

**Problems with this pattern**:

1. The `any` type annotation destroys type safety.
2. If `subscribe()` ever becomes asynchronous (unlikely but possible in future Svelte
   versions), this pattern silently breaks.
3. It obscures intent -- a reader must understand Svelte subscription semantics to
   recognize this as a synchronous read.

**Recommendation**: During Task 5.3.3, replace all subscribe-then-unsubscribe patterns
with getter callbacks injected via the constructor, eliminating both the antipattern and
the store import.

---

## Appendix B: File Manifest

Complete list of files modified or deleted by this phase.

| Action     | File Path (relative to `src/lib/`)        | Task                                                      |
| ---------- | ----------------------------------------- | --------------------------------------------------------- |
| CREATE     | types/signals.ts                          | 5.3.2                                                     |
| CREATE     | types/drone.ts                            | 5.3.2                                                     |
| CREATE     | types/map.ts (or extend)                  | 5.3.2 (absorbs type extraction originally in ~~5.3.1~~)   |
| ~~MODIFY~~ | ~~services/map/heatmapService.ts~~        | ~~5.3.1~~ **REMOVED** -- type extraction handled by 5.3.2 |
| ~~MODIFY~~ | ~~services/map/webglHeatmapRenderer.ts~~  | ~~5.3.1~~ **REMOVED** -- type extraction handled by 5.3.2 |
| MODIFY     | stores/map/signals.ts                     | 5.3.2                                                     |
| MODIFY     | stores/tactical-map/mapStore.ts           | 5.3.2                                                     |
| MODIFY     | server/db/database.ts                     | 5.3.2                                                     |
| MODIFY     | server/db/geo.ts                          | 5.3.2                                                     |
| MODIFY     | server/db/signalRepository.ts             | 5.3.2                                                     |
| MODIFY     | services/db/dataAccessLayer.ts            | 5.3.2                                                     |
| MODIFY     | services/db/signalDatabase.ts             | 5.3.2                                                     |
| MODIFY     | services/drone/flightPathAnalyzer.ts      | 5.3.2                                                     |
| MODIFY     | services/map/aiPatternDetector.ts         | 5.3.2                                                     |
| MODIFY     | services/map/contourGenerator.ts          | 5.3.2                                                     |
| MODIFY     | services/map/droneDetection.ts            | 5.3.2                                                     |
| MODIFY     | services/map/mapUtils.ts                  | 5.3.2                                                     |
| MODIFY     | services/map/networkAnalyzer.ts           | 5.3.2                                                     |
| MODIFY     | services/map/signalClustering.ts          | 5.3.2                                                     |
| MODIFY     | services/map/signalFiltering.ts           | 5.3.2                                                     |
| MODIFY     | services/tactical-map/cellTowerService.ts | 5.3.2                                                     |
| MODIFY     | services/hackrf/api.ts                    | 5.3.3                                                     |
| MODIFY     | services/hackrf/usrp-api.ts               | 5.3.3                                                     |
| MODIFY     | services/tactical-map/gpsService.ts       | 5.3.3                                                     |
| MODIFY     | services/tactical-map/hackrfService.ts    | 5.3.3                                                     |
| MODIFY     | services/tactical-map/kismetService.ts    | 5.3.3                                                     |
| MODIFY     | services/tactical-map/mapService.ts       | 5.3.3                                                     |
| MODIFY     | services/map/kismetRSSIService.ts         | 5.3.3                                                     |
| ANNOTATE   | services/hackrfsweep/controlService.ts    | 5.3.3                                                     |
| ANNOTATE   | services/hackrfsweep/displayService.ts    | 5.3.3                                                     |
| ANNOTATE   | services/hackrfsweep/frequencyService.ts  | 5.3.3                                                     |
| ANNOTATE   | services/hackrfsweep/signalService.ts     | 5.3.3                                                     |
| DELETE     | services/websocket/example-usage.ts       | 5.3.4                                                     |
| DELETE     | services/websocket/test-connection.ts     | 5.3.4                                                     |

**Total**: 3 created, 22 modified (2 removed with Task 5.3.1), 4 annotated, 2 deleted = **31 files touched**

---

_Document version: 1.1_
_Audit date: 2026-02-08_
_Auditor: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 15, Barr C_
_Classification: UNCLASSIFIED // FOUO_

**Revision History**:
| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-02-08 | Initial release |
| 1.1 | 2026-02-08 | **REGRADE CORRECTION**: Task 5.3.1 (circular dependency resolution) REMOVED. The only detected cycle is a pure `import type` cycle with zero runtime impact. Execution order, file manifest, and file counts updated accordingly. |
