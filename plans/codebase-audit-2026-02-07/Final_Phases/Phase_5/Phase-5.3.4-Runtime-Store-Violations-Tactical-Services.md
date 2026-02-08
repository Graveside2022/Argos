# Phase 5.3.4: Runtime Store Violations -- Tactical and Map Services

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7 (file scope isolation), CERT C STR00-C, NASA/JPL Rule 15
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.4
**Risk Level**: MEDIUM -- Constructor signature changes require all instantiation sites to be updated; subscribe-then-unsubscribe antipattern replacement
**Prerequisites**: Task 5.3.2 (type migration) complete; Task 5.3.3 (API services) complete
**Blocks**: Task 5.3.7 (verification cannot pass until all runtime violations are resolved)
**Estimated Files Touched**: 4 service files + their Svelte component instantiation sites
**Standards**: MISRA C:2012 Rule 8.7, CERT C STR00-C

---

## Objective

Resolve 4 runtime store violations in Priority 3 and Priority 4 service files using the callback injection pattern. After this task, `services/tactical-map/hackrfService.ts`, `services/tactical-map/kismetService.ts`, `services/tactical-map/mapService.ts`, and `services/map/kismetRSSIService.ts` will have zero imports from `$lib/stores/`.

These services are more complex than the Priority 1-2 services because they use the subscribe-then-unsubscribe antipattern (reading store state synchronously) in addition to calling store mutation functions. Both patterns are replaced with constructor-injected callbacks and getters.

---

## Priority 3: Tactical Map Services (3 files) -- Mixed Patterns

### Current State

| File                                     | Store Imports                                  | Pattern            |
| ---------------------------------------- | ---------------------------------------------- | ------------------ |
| `services/tactical-map/hackrfService.ts` | hackrf (spectrumData), hackrfStore (mutations) | Subscribe + mutate |
| `services/tactical-map/kismetService.ts` | kismetStore (read + mutate)                    | Read-then-mutate   |
| `services/tactical-map/mapService.ts`    | mapStore (read + mutate), gpsStore (read)      | Read + mutate      |

---

### 5.3.4.A: hackrfService.ts

#### BEFORE (lines 1-10)

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

This service subscribes to `spectrumData` store (line 25) and reads `hackrfStore` via the subscribe-then-immediately-unsubscribe antipattern (lines 29-31):

```typescript
let currentState: any;
const unsubscribe = hackrfStore.subscribe((s) => (currentState = s));
unsubscribe();
```

#### AFTER -- Callback + Getter Injection

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

#### Component-Side Wiring for hackrfService.ts

```typescript
import { spectrumData } from '$lib/stores/hackrf';
import {
	hackrfStore,
	setConnectionStatus,
	setSearchingState,
	setTargetFrequency,
	clearAllSignals
} from '$lib/stores/tactical-map/hackrfStore';
import { get } from 'svelte/store';

const hackrfService = new HackRFService({
	subscribeSpectrumData: (handler) => spectrumData.subscribe(handler),
	callbacks: {
		onConnectionStatusChange: setConnectionStatus,
		onSearchingStateChange: setSearchingState,
		onTargetFrequencyChange: setTargetFrequency,
		onClearSignals: clearAllSignals,
		getIsSearching: () => get(hackrfStore).isSearching
	}
});
```

#### Pre-Modification Verification

```bash
# Find all instantiation sites
grep -rn "new HackRFService(" src/ --include="*.ts" --include="*.svelte"

# Find singleton exports
grep -rn "export.*hackrfService" src/lib/services/tactical-map/hackrfService.ts
```

---

### 5.3.4.B: kismetService.ts

#### BEFORE (lines 1-9)

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

#### AFTER -- Callback Injection

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

#### Component-Side Wiring for kismetService.ts

```typescript
import {
	kismetStore,
	setKismetStatus,
	clearAllKismetDevices,
	addKismetDevice,
	removeKismetDevice,
	updateDistributions
} from '$lib/stores/tactical-map/kismetStore';
import { get } from 'svelte/store';

const kismetService = new KismetService({
	onStatusChange: setKismetStatus,
	onDeviceAdded: addKismetDevice,
	onDeviceRemoved: removeKismetDevice,
	onDevicesCleared: clearAllKismetDevices,
	onDistributionsUpdated: updateDistributions,
	getCurrentStatus: () => get(kismetStore).status
});
```

#### Pre-Modification Verification

```bash
# Find all instantiation sites
grep -rn "new KismetService(" src/ --include="*.ts" --include="*.svelte"

# Find singleton exports
grep -rn "export.*kismetService" src/lib/services/tactical-map/kismetService.ts
```

---

### 5.3.4.C: mapService.ts

#### BEFORE (lines 1-3)

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

The service calls `get(mapStore)` and `get(gpsStore)` to synchronously read state, then calls `setMap()`, `setUserMarker()`, and `setAccuracyCircle()` to write back.

#### AFTER -- Callback + State Getter Injection

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

#### Component-Side Wiring for mapService.ts

```typescript
import {
	mapStore,
	setMap,
	setUserMarker,
	setAccuracyCircle
} from '$lib/stores/tactical-map/mapStore';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
import { get } from 'svelte/store';

const mapService = new MapService({
	onMapCreated: setMap,
	onUserMarkerCreated: setUserMarker,
	onAccuracyCircleCreated: setAccuracyCircle,
	getMapState: () => get(mapStore),
	getGPSState: () => get(gpsStore)
});
```

#### Pre-Modification Verification

```bash
# Find all instantiation sites
grep -rn "new MapService(" src/ --include="*.ts" --include="*.svelte"

# Find singleton exports
grep -rn "export.*mapService" src/lib/services/tactical-map/mapService.ts

# Find all get(mapStore) and get(gpsStore) calls in the service
grep -n "get(mapStore)\|get(gpsStore)" src/lib/services/tactical-map/mapService.ts
```

#### Type File Dependency

The `LeafletMarker` and `LeafletCircle` types must also exist in `$lib/types/map.ts`. If Task 5.3.2 only added `LeafletMap`, extend `types/map.ts`:

```typescript
// src/lib/types/map.ts (append)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafletMarker = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafletCircle = any;
```

Verify at execution time:

```bash
grep -n "LeafletMarker\|LeafletCircle" src/lib/stores/tactical-map/mapStore.ts
```

---

## Priority 4: RSSI Service (1 file) -- Getter Injection

### Current State

| File                                | Store Import                     | Usage                                   |
| ----------------------------------- | -------------------------------- | --------------------------------------- |
| `services/map/kismetRSSIService.ts` | gpsStore (read only via `get()`) | Read GPS position for RSSI calculations |

### BEFORE -- `services/map/kismetRSSIService.ts` (lines 9-10)

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

### AFTER -- Constructor-Injected Getter

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

### Component-Side Wiring for kismetRSSIService.ts

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

### Pre-Modification Verification

```bash
# Find all instantiation sites
grep -rn "new KismetRSSIService(" src/ --include="*.ts" --include="*.svelte"

# Find all get(gpsStore) calls in the service
grep -n "get(gpsStore)" src/lib/services/map/kismetRSSIService.ts

# Find singleton exports
grep -rn "export.*rssiService\|export.*kismetRSSI" src/lib/services/map/kismetRSSIService.ts
```

---

## Post-Task Verification

```bash
# Verify zero store imports in all Priority 3-4 files
grep -rn "from.*stores" src/lib/services/tactical-map/hackrfService.ts
# EXPECTED: 0 results

grep -rn "from.*stores" src/lib/services/tactical-map/kismetService.ts
# EXPECTED: 0 results

grep -rn "from.*stores" src/lib/services/tactical-map/mapService.ts
# EXPECTED: 0 results

grep -rn "from.*stores" src/lib/services/map/kismetRSSIService.ts
# EXPECTED: 0 results

# Verify svelte/store import is also removed (no get() calls remain)
grep -rn "from.*svelte/store" src/lib/services/tactical-map/mapService.ts
# EXPECTED: 0 results

grep -rn "from.*svelte/store" src/lib/services/map/kismetRSSIService.ts
# EXPECTED: 0 results

# Combined: runtime imports from stores in service files should be exactly 4 (exempted hackrfsweep)
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "\.d\.ts" \
  | grep -v "example-usage" \
  | grep -v "test-connection"
# EXPECTED: exactly 4 lines, all in services/hackrfsweep/

# TypeScript compilation
npx tsc --noEmit
# EXPECTED: 0 errors

# Unit tests
npm run test:unit
# EXPECTED: all tests pass
```

---

## Risk Assessment

### Risk 1: Constructor Signature Change Breaks Consumers

**Probability**: MEDIUM. All 4 services gain constructor parameters.

**Mitigation**: Search all instantiation sites with the pre-modification verification commands above. Update every call site.

### Risk 2: Subscribe-Then-Unsubscribe Antipattern Has Side Effects

**Probability**: LOW. The antipattern calls `subscribe()` then immediately `unsubscribe()`. If the store's `subscribe()` implementation has side effects beyond calling the callback (e.g., incrementing a subscriber count that triggers data fetching), removing the subscribe call changes behavior.

**Mitigation**: Inspect each store's `subscribe()` implementation. Svelte writable stores have no side effects on subscribe beyond calling the callback. Custom stores built with `readable()` or custom `subscribe` may differ.

```bash
# Check if any of the affected stores have custom subscribe implementations
grep -A 5 "subscribe" src/lib/stores/tactical-map/hackrfStore.ts
grep -A 5 "subscribe" src/lib/stores/tactical-map/kismetStore.ts
grep -A 5 "subscribe" src/lib/stores/tactical-map/mapStore.ts
grep -A 5 "subscribe" src/lib/stores/tactical-map/gpsStore.ts
```

### Risk 3: HMR Invalidation After Refactor

**Probability**: LOW. Changing import paths causes Vite to invalidate more modules than expected on the first HMR cycle.

**Mitigation**: After completing all changes, restart the dev server (`npm run dev:clean`) and verify HMR works for at least 3 code change cycles.

### Rollback Strategy

```bash
# Revert all changes to the 4 service files
git checkout HEAD -- \
  src/lib/services/tactical-map/hackrfService.ts \
  src/lib/services/tactical-map/kismetService.ts \
  src/lib/services/tactical-map/mapService.ts \
  src/lib/services/map/kismetRSSIService.ts

# Revert any component-side wiring changes
git checkout HEAD -- src/routes/
```

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C STR00-C, NASA/JPL Rule 15_
_Classification: UNCLASSIFIED // FOUO_
