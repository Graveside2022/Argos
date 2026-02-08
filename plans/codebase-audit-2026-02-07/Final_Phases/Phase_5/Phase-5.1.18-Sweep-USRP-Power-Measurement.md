# Phase 5.1.18 -- Sweep: Extract USRP-Specific Power Measurement

| Field             | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Phase**         | 5.1.18                                                                  |
| **Title**         | Sweep: Extract USRP-Specific Power Measurement                          |
| **Risk Level**    | LOW                                                                     |
| **Prerequisites** | Phase 5.1.17 complete (adapter interface defines measurePower)          |
| **Files Touched** | 2 (1 modified, 1 created)                                               |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 15, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                              |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                     |

---

## 1. Objective

Extract the USRP-specific power measurement functions from `rfsweep/+page.svelte`
into a dedicated USRP adapter module. The `measureUSRPPower` function at 67 lines
EXCEEDS the 60-LOC NASA/JPL Rule 15 limit and must be split. These functions implement
the optional `measurePower` method on the `SweepDeviceAdapter` interface (defined in
Phase 5.1.17). The HackRF page does NOT have these functions.

---

## 2. Current State

**Source file**: `src/routes/rfsweep/+page.svelte` (2,245 lines) -- USRP device ONLY

| Function                                  | Location  | Lines | Side Effects  | >60 LOC? |
| ----------------------------------------- | --------- | ----- | ------------- | -------- |
| `measureUSRPPower(frequencyMHz: number)`  | L287-L353 | 67    | API call      | **YES**  |
| `_startPeriodicPowerMeasurement(freqMHz)` | L354-L385 | 32    | setInterval   | No       |
| `_stopPeriodicPowerMeasurement()`         | L386-L393 | 8     | clearInterval | No       |

**Total lines to extract**: 107 (from rfsweep only)

---

## 3. Decomposition of measureUSRPPower (67 lines)

**Split into 2 functions**:

**Function 1**: `parseUSRPPowerResponse(data: any): PowerMeasurement | null`

- Pure function, validates and extracts power reading from API response (~20 lines)
- Returns null for invalid responses

**Function 2**: `measureUSRPPower(frequencyMHz: number): Promise<PowerMeasurement>`

- Orchestrator: call API, parse, handle errors (~40 lines)

**Post-split max function length**: ~40 lines

---

## 4. Implementation Steps

### Step 1: Create the USRP Adapter Module

Create `src/lib/services/sweep/usrpAdapter.ts`:

```typescript
// src/lib/services/sweep/usrpAdapter.ts

import type { SweepDeviceAdapter, PowerMeasurement, FrequencyEntry, DeviceStatus } from './types';

// --- Power measurement (USRP-only) ---

function parseUSRPPowerResponse(data: unknown): PowerMeasurement | null {
	// Validate and extract power reading from API response (~20 lines)
	// Returns null for invalid/error responses
}

export async function measureUSRPPower(frequencyMHz: number): Promise<PowerMeasurement> {
	// Call /api/usrp/power?frequency=<freq>, parse response (~40 lines)
	const response = await fetch(`/api/usrp/power?frequency=${frequencyMHz}`);
	const data = await response.json();
	const result = parseUSRPPowerResponse(data);
	if (!result) throw new Error('Invalid power measurement response');
	return result;
}

// --- Periodic power measurement ---

let periodicInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicPowerMeasurement(
	frequencyMHz: number,
	onMeasurement: (measurement: PowerMeasurement) => void,
	intervalMs: number = 1000
): void {
	// Extracted from _startPeriodicPowerMeasurement (~32 lines)
	stopPeriodicPowerMeasurement();
	periodicInterval = setInterval(async () => {
		try {
			const measurement = await measureUSRPPower(frequencyMHz);
			onMeasurement(measurement);
		} catch (err) {
			// Handle measurement error
		}
	}, intervalMs);
}

export function stopPeriodicPowerMeasurement(): void {
	// Extracted from _stopPeriodicPowerMeasurement (~8 lines)
	if (periodicInterval) {
		clearInterval(periodicInterval);
		periodicInterval = null;
	}
}

// --- Full USRP adapter factory ---

export function createUSRPAdapter(): SweepDeviceAdapter {
	return {
		deviceName: 'USRP',
		apiPrefix: '/api/usrp',
		frequencyTolerance: 100,
		spectrumPath: '/viewspectrum?device=usrp',

		async connect() {
			/* /api/usrp/connect */
		},
		async disconnect() {
			/* /api/usrp/disconnect */
		},
		async getStatus() {
			/* /api/usrp/status */
		},
		async startSweep(frequencies) {
			/* /api/usrp/sweep/start */
		},
		async stopSweep() {
			/* /api/usrp/sweep/stop */
		},
		measurePower: measureUSRPPower // USRP-specific optional method
	};
}
```

### Step 2: Update rfsweep Page

1. Remove `measureUSRPPower()`, `_startPeriodicPowerMeasurement()`,
   `_stopPeriodicPowerMeasurement()` from `rfsweep/+page.svelte`
2. Add import:

```typescript
import {
	createUSRPAdapter,
	startPeriodicPowerMeasurement,
	stopPeriodicPowerMeasurement
} from '$lib/services/sweep/usrpAdapter';

const adapter = createUSRPAdapter();
```

3. Replace call sites with imported functions

### Step 3: Create HackRF Adapter (Optional, Low LOC)

Optionally create `src/lib/services/sweep/hackrfAdapter.ts` with a
`createHackRFAdapter()` factory for symmetry. This is small (~30 lines)
since HackRF has no optional methods.

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definitions removed from rfsweep page:
grep -c 'function measureUSRPPower\|function _startPeriodicPowerMeasurement\|function _stopPeriodicPowerMeasurement' \
  src/routes/rfsweep/+page.svelte
# Expected: 0

# Verify these functions do NOT exist in hackrfsweep (they never did):
grep -c 'measureUSRPPower\|_startPeriodicPowerMeasurement' \
  src/routes/hackrfsweep/+page.svelte
# Expected: 0

# Verify adapter file exists:
wc -l src/lib/services/sweep/usrpAdapter.ts
# Expected: ~100

# Verify no function exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/sweep/usrpAdapter.ts
# Expected: 0 functions >60 LOC

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                        | Severity | Likelihood | Mitigation                                             |
| ------------------------------------------- | -------- | ---------- | ------------------------------------------------------ |
| Power measurement API response shape change | MEDIUM   | LOW        | parseUSRPPowerResponse validates and returns typed obj |
| Periodic interval leak on page destroy      | MEDIUM   | LOW        | stopPeriodicPowerMeasurement called in onDestroy       |
| Adapter factory interface incomplete        | LOW      | LOW        | TypeScript enforces SweepDeviceAdapter contract        |

**Overall risk**: LOW. These are USRP-specific functions that only exist in one page.
The extraction is straightforward. The `measurePower` optional method on the adapter
interface was designed specifically for this use case.

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                      |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All TypeScript passes `npm run typecheck`                           |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 67-line measureUSRPPower split into 20-line parser + 40-line caller |
| NASA/JPL Rule 14      | Minimize function complexity               | Response parsing separated from API orchestration                   |
| Barr C Ch. 8          | Each module shall have a header            | `usrpAdapter.ts` exports typed adapter factory and functions        |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/rfsweep/+page.svelte
rm -f src/lib/services/sweep/usrpAdapter.ts
```

Single commit, single revert.

---

_Phase 5.1.18 -- Sweep: Extract USRP-Specific Power Measurement_
_Execution priority: 12 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -107 lines from rfsweep page_
