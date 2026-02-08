# Phase 5.3.3: Runtime Store Violations -- API and GPS Services

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7 (file scope isolation), CERT C STR00-C, NASA/JPL Rule 15
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.3
**Risk Level**: MEDIUM -- Constructor signature changes require all instantiation sites to be updated
**Prerequisites**: Phase 5.2 (HackRF/USRP Consolidation) complete; Task 5.3.2 (type migration) complete
**Blocks**: Task 5.3.7 (verification cannot pass until runtime violations are resolved)
**Estimated Files Touched**: 3 service files + their Svelte component instantiation sites
**Standards**: MISRA C:2012 Rule 8.7, CERT C STR00-C

---

## Objective

Resolve 3 runtime store violations in Priority 1 and Priority 2 service files using the callback injection pattern. After this task, `services/hackrf/api.ts`, `services/hackrf/usrp-api.ts`, and `services/tactical-map/gpsService.ts` will have zero imports from `$lib/stores/`.

---

## Critical Prerequisite: Phase 5.2 Dependency

**Task 5.3.3 MUST NOT begin until Phase 5.2 (HackRF/USRP Consolidation) is complete and merged.**

Phase 5.2 may merge `api.ts` and `usrp-api.ts` into a single unified SDR API class. If Phase 5.2 merges them, apply the callback injection pattern to the merged file only.

**Pre-execution verification**:

```bash
# Check if api.ts and usrp-api.ts still exist as separate files
ls -la src/lib/services/hackrf/api.ts src/lib/services/hackrf/usrp-api.ts

# Check current store imports in hackrf service directory
grep -rn "from.*stores" src/lib/services/hackrf/ --include="*.ts" | grep -v "import type"
```

---

## Priority 1: API Services (2 files) -- Callback Injection

### Current State

These files call store mutation functions (`updateConnectionStatus`, `updateSpectrumData`, etc.) directly after receiving SSE events or API responses.

| File                          | Store Import         | Mutation Functions Called                                                                                   |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `services/hackrf/api.ts`      | `$lib/stores/hackrf` | updateConnectionStatus, updateSweepStatus, updateSpectrumData, updateCycleStatus, updateEmergencyStopStatus |
| `services/hackrf/usrp-api.ts` | `$lib/stores/hackrf` | updateConnectionStatus, updateSweepStatus, updateSpectrumData, updateCycleStatus, updateEmergencyStopStatus |

**Note**: `usrp-api.ts` imports from `$lib/stores/hackrf` (the HackRF store), not a USRP store. This is documented as a known design choice -- USRP and HackRF share the same UI store because the frontend renders identical spectrum displays for both devices. This is NOT a bug but MUST be documented in a code comment.

### BEFORE -- `services/hackrf/api.ts` (lines 1-8)

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

### AFTER -- `services/hackrf/api.ts` with Callback Injection

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

### Component-Side Wiring for api.ts

In the Svelte component or page that creates the API instance:

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

This pattern passes the store mutation functions as first-class function references. The service never imports from `$lib/stores/` and can be unit-tested with mock callbacks.

### USRP-API Handling

**`services/hackrf/usrp-api.ts`** receives the identical treatment. The callback interface is the same (`HackRFAPICallbacks`) because USRP shares the HackRF UI store.

Add a mandatory code comment at the top of `usrp-api.ts`:

```typescript
/**
 * USRP API Service
 *
 * ARCHITECTURAL NOTE: This service uses the same callback interface as HackRFAPI
 * (HackRFAPICallbacks) because the USRP and HackRF frontends render identical
 * spectrum displays. The component-side wiring passes the HackRF store mutation
 * functions to this service. This is a deliberate design choice, not a defect.
 *
 * If USRP ever requires divergent UI state, create a dedicated USRP store and
 * a USRPAPICallbacks interface.
 */
```

### Pre-Modification Verification

Before modifying either file, find all instantiation sites:

```bash
# Find all places that instantiate HackRFAPI
grep -rn "new HackRFAPI(" src/ --include="*.ts" --include="*.svelte"

# Find all places that instantiate USRP API (class name may vary)
grep -rn "new USRPAPI\|new UsrpApi\|new usrpApi" src/ --include="*.ts" --include="*.svelte"

# Find module-level exports (singleton pattern)
grep -rn "export const hackrfAPI\|export const usrpAPI" src/ --include="*.ts"
```

**If singleton pattern is detected**: The service is instantiated at module scope (e.g., `export const hackrfAPI = new HackRFAPI()`). In this case, the singleton instantiation must move to the component that uses it, or use a factory function pattern:

```typescript
// Factory pattern for singleton migration
let instance: HackRFAPI | null = null;
export function getHackRFAPI(callbacks: HackRFAPICallbacks): HackRFAPI {
	if (!instance) {
		instance = new HackRFAPI(callbacks);
	}
	return instance;
}
```

---

## Priority 2: Tactical Map GPS Service (1 file) -- Callback Injection

### Current State

| File                                  | Store Import                        | Mutation Functions Called                           |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| `services/tactical-map/gpsService.ts` | `$lib/stores/tactical-map/gpsStore` | updateGPSPosition, updateGPSStatus, gpsStore (read) |

### BEFORE -- `services/tactical-map/gpsService.ts` (lines 1-3)

```typescript
import { gpsStore, updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gpsStore';
```

The service calls `updateGPSPosition()` and `updateGPSStatus()` after each GPS poll (line 54 and 55-66), and returns the raw store reference from `getCurrentPosition()` (line 96).

### AFTER -- `services/tactical-map/gpsService.ts` with Callback Injection

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

### Component-Side Wiring for gpsService.ts

```typescript
import { updateGPSPosition, updateGPSStatus } from '$lib/stores/tactical-map/gpsStore';

const gpsService = new GPSService({
	onPositionUpdate: updateGPSPosition,
	onStatusUpdate: updateGPSStatus
});
```

### Pre-Modification Verification

```bash
# Find all instantiation sites for GPSService
grep -rn "new GPSService(" src/ --include="*.ts" --include="*.svelte"

# Find all references to getCurrentPosition
grep -rn "getCurrentPosition" src/ --include="*.ts" --include="*.svelte"
# If any component calls getCurrentPosition(), it must be updated to read gpsStore directly

# Find singleton exports
grep -rn "export const gpsService\|export let gpsService" src/ --include="*.ts"
```

---

## Post-Task Verification

```bash
# Verify zero store imports in Priority 1-2 files
grep -rn "from.*stores" src/lib/services/hackrf/api.ts
# EXPECTED: 0 results

grep -rn "from.*stores" src/lib/services/hackrf/usrp-api.ts
# EXPECTED: 0 results

grep -rn "from.*stores" src/lib/services/tactical-map/gpsService.ts
# EXPECTED: 0 results

# Verify TypeScript compilation
npx tsc --noEmit
# EXPECTED: 0 errors

# Verify unit tests pass
npm run test:unit
# EXPECTED: all tests pass (services with new constructors may need test updates)
```

---

## Risk Assessment

### Risk 1: Constructor Signature Change Breaks Consumers

**Probability**: MEDIUM. Services that gain a `callbacks` constructor parameter will break any code that calls `new ServiceName()` without arguments.

**Mitigation**: Search for all instantiation sites before modifying each service (verification commands above). Update every call site to pass the required callbacks. If more than 3 call sites exist for a single service, consider a default callback set exported alongside the service to minimize churn.

### Risk 2: Phase 5.2 Merges api.ts and usrp-api.ts

**Probability**: HIGH. Phase 5.2 may merge these two files.

**Mitigation**: Re-verify the target file list after Phase 5.2 completes:

```bash
grep -rn "from.*stores" src/lib/services/hackrf/ --include="*.ts" | grep -v "import type"
```

If merged, apply callback injection to the single merged file.

### Risk 3: Module-Level Singleton Instantiation

**Probability**: MEDIUM. If `api.ts` or `gpsService.ts` exports a singleton instance created at module scope, adding a constructor parameter is a breaking change at the module level (not just at call sites).

**Mitigation**: Use the factory function pattern documented above.

### Rollback Strategy

```bash
# Revert all changes to the 3 service files
git checkout HEAD -- \
  src/lib/services/hackrf/api.ts \
  src/lib/services/hackrf/usrp-api.ts \
  src/lib/services/tactical-map/gpsService.ts

# Revert any component-side wiring changes
git checkout HEAD -- src/routes/
```

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C STR00-C, NASA/JPL Rule 15_
_Classification: UNCLASSIFIED // FOUO_
