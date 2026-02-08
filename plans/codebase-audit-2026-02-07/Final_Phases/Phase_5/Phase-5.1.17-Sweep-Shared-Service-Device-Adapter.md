# Phase 5.1.17 -- Sweep: Create Shared Sweep Service with Device Adapter

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Phase**         | 5.1.17                                                                                      |
| **Title**         | Sweep: Create Shared Sweep Service with Device Adapter                                      |
| **Risk Level**    | MEDIUM                                                                                      |
| **Prerequisites** | None (creates foundational types; blocks 5.1.16 and 5.1.18)                                 |
| **Files Touched** | 4 (2 modified, 2 created)                                                                   |
| **Standards**     | MISRA C:2023 Rule 1.1, MISRA C:2023 Dir 4.4, NASA/JPL Rule 14, CERT C ERR00-C, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                                                  |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                                         |

---

## 1. Objective

Create the shared sweep service layer and device adapter interface that eliminates
the 10 duplicated functions across `rfsweep/+page.svelte` and `hackrfsweep/+page.svelte`.
The adapter pattern parameterizes the service by device type (HackRF vs USRP),
capturing the known differences as interface properties rather than code duplication.

This step is the **foundation** for Phase 5.1.16 (shared components) and Phase 5.1.18
(USRP power measurement). It MUST complete before those steps begin.

---

## 2. Current State

### 2.1 Duplicated Functions (10 identical names, 2 pages)

| Function                | rfsweep Location | hackrfsweep Location | Lines Each | Purpose                   |
| ----------------------- | ---------------- | -------------------- | ---------- | ------------------------- |
| `addFrequency`          | varies           | varies               | ~15        | Add freq to list          |
| `removeFrequency`       | varies           | varies               | ~10        | Remove freq from list     |
| `startCycling`          | varies           | varies               | ~25        | Start sweep cycle         |
| `stopCycling`           | varies           | varies               | ~15        | Stop sweep cycle          |
| `startLocalTimer`       | varies           | varies               | ~20        | Start dwell timer         |
| `stopLocalTimer`        | varies           | varies               | ~10        | Stop dwell timer          |
| `resetDisplays`         | varies           | varies               | ~10        | Reset UI state            |
| `openSpectrumAnalyzer`  | L410-L419        | L254-L263            | ~10        | Navigate to spectrum view |
| `updateSignalStrength`  | varies           | varies               | ~15        | Update signal gauge       |
| `updateSignalIndicator` | varies           | varies               | ~15        | Update signal indicator   |

### 2.2 Device-Specific Differences

| Aspect              | HackRF          | USRP                          |
| ------------------- | --------------- | ----------------------------- |
| API prefix          | `/api/hackrf`   | `/api/usrp`                   |
| Frequency tolerance | 50 MHz          | 100 MHz                       |
| Spectrum path       | `/viewspectrum` | `/viewspectrum?device=usrp`   |
| Power measurement   | Not supported   | `measureUSRPPower` (67 lines) |
| API module          | `hackrfAPI`     | `usrpAPI`                     |

---

## 3. Implementation Steps

### Step 1: Create Types File

Create `src/lib/services/sweep/types.ts`:

```typescript
// src/lib/services/sweep/types.ts

export interface FrequencyEntry {
	id: number;
	frequency: string;
	label?: string;
}

export interface DeviceStatus {
	connected: boolean;
	sweeping: boolean;
	error?: string;
}

export interface PowerMeasurement {
	frequency: number;
	power: number;
	timestamp: number;
}

export interface SweepDisplayState {
	signalStrength: number;
	detectedFrequency: number | null;
	frequencyOffset: number | null;
	signalLevel: number | null;
}

export interface SignalStrengthState {
	db: number;
	percentage: number;
	label: string;
}

export interface SignalIndicatorState {
	color: string;
	label: string;
}

export interface TimerHandle {
	intervalId: ReturnType<typeof setInterval>;
	clear: () => void;
}

export interface SweepDeviceAdapter {
	readonly deviceName: string; // 'HackRF' | 'USRP'
	readonly apiPrefix: string; // '/api/hackrf' | '/api/usrp'
	readonly frequencyTolerance: number; // 50 (HackRF) | 100 (USRP)
	readonly spectrumPath: string; // '/viewspectrum' | '/viewspectrum?device=usrp'

	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getStatus(): Promise<DeviceStatus>;
	startSweep(frequencies: FrequencyEntry[]): Promise<void>;
	stopSweep(): Promise<void>;
	measurePower?(frequencyMHz: number): Promise<PowerMeasurement>; // USRP-only (optional)
}
```

### Step 2: Create Shared Service File

Create `src/lib/services/sweep/sweepService.ts`:

```typescript
// src/lib/services/sweep/sweepService.ts

import type {
	SweepDeviceAdapter,
	FrequencyEntry,
	SweepDisplayState,
	SignalStrengthState,
	SignalIndicatorState,
	TimerHandle
} from './types';

// --- Frequency list management ---

export function addFrequency(frequencies: FrequencyEntry[], freq: string): FrequencyEntry[] {
	// Shared implementation (~15 lines)
	// Previously duplicated in both pages
}

export function removeFrequency(frequencies: FrequencyEntry[], id: number): FrequencyEntry[] {
	// Shared implementation (~10 lines)
}

// --- Sweep lifecycle ---

export async function startCycling(
	adapter: SweepDeviceAdapter,
	frequencies: FrequencyEntry[]
): Promise<void> {
	// Shared implementation (~25 lines)
	// Uses adapter.apiPrefix for API calls
}

export async function stopCycling(adapter: SweepDeviceAdapter): Promise<void> {
	// Shared implementation (~15 lines)
}

// --- Timer management ---

export function startLocalTimer(
	dwellTime: number,
	onTick: (remaining: string, progress: number) => void
): TimerHandle {
	// Shared implementation (~20 lines)
}

export function stopLocalTimer(handle: TimerHandle): void {
	// Shared implementation (~10 lines)
	handle.clear();
}

// --- Display state ---

export function resetDisplays(): SweepDisplayState {
	// Shared implementation (~10 lines)
	// Returns zeroed display state
}

export function updateSignalStrength(db: number): SignalStrengthState {
	// Shared implementation (~15 lines)
	// Converts dB to percentage, label
}

export function updateSignalIndicator(db: number): SignalIndicatorState {
	// Shared implementation (~15 lines)
	// Returns color and label based on signal strength
}

// --- Navigation ---

export async function openSpectrumAnalyzer(
	adapter: SweepDeviceAdapter,
	isStarted: boolean
): Promise<void> {
	// Shared implementation (~10 lines)
	// Uses adapter.spectrumPath for navigation
	// rfsweep: /viewspectrum?device=usrp
	// hackrfsweep: /viewspectrum
}
```

### Step 3: Update Both Pages to Use Shared Service

Update `rfsweep/+page.svelte`:

```typescript
import {
  addFrequency, removeFrequency, startCycling, stopCycling,
  startLocalTimer, stopLocalTimer, resetDisplays,
  openSpectrumAnalyzer, updateSignalStrength, updateSignalIndicator
} from '$lib/services/sweep/sweepService';
import type { SweepDeviceAdapter } from '$lib/services/sweep/types';

// Create USRP adapter
const adapter: SweepDeviceAdapter = {
  deviceName: 'USRP',
  apiPrefix: '/api/usrp',
  frequencyTolerance: 100,
  spectrumPath: '/viewspectrum?device=usrp',
  connect: () => fetch('/api/usrp/connect', { method: 'POST' }).then(...),
  disconnect: () => fetch('/api/usrp/disconnect', { method: 'POST' }).then(...),
  getStatus: () => fetch('/api/usrp/status').then(r => r.json()),
  startSweep: (freqs) => ...,
  stopSweep: () => ...,
  measurePower: (freq) => measureUSRPPower(freq), // USRP-specific
};
```

Update `hackrfsweep/+page.svelte` similarly with HackRF adapter values.

### Step 4: Remove Duplicated Function Definitions

Remove all 10 duplicated function definitions from BOTH pages. Only the adapter
instantiation and import statements should remain.

### Step 5: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify service files exist:
wc -l src/lib/services/sweep/sweepService.ts src/lib/services/sweep/types.ts
# Expected: ~300 total

# Verify no duplicated function names remain in pages:
for fn in addFrequency startCycling stopCycling startLocalTimer stopLocalTimer \
  resetDisplays removeFrequency openSpectrumAnalyzer updateSignalStrength updateSignalIndicator; do
  count_rf=$(grep -c "function $fn" src/routes/rfsweep/+page.svelte)
  count_hk=$(grep -c "function $fn" src/routes/hackrfsweep/+page.svelte)
  echo "$fn: rfsweep=$count_rf hackrfsweep=$count_hk"
done
# Expected: all zeros

# Verify imports exist:
grep -c 'sweepService' src/routes/rfsweep/+page.svelte
# Expected: >= 1

grep -c 'sweepService' src/routes/hackrfsweep/+page.svelte
# Expected: >= 1

# Build verification:
npm run typecheck
npm run build
```

---

## 5. Risk Assessment

| Risk                                        | Severity | Likelihood | Mitigation                                                                    |
| ------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------- |
| Adapter interface too abstract              | MEDIUM   | LOW        | Interface has 1 optional method; all others are required                      |
| Adapter interface too concrete              | LOW      | LOW        | Only 2 known devices; interface designed from actual differences              |
| Behavioral difference hidden by shared code | HIGH     | LOW        | Device-specific differences captured as readonly properties (tolerance, path) |
| API call signatures differ between devices  | MEDIUM   | MEDIUM     | Adapter methods abstract the API calls; each device implements its own        |

**Overall risk**: MEDIUM. The adapter interface must accurately capture the differences
between HackRF and USRP APIs. The two known device-specific differences (frequency
tolerance: 50 vs 100 MHz; spectrum path: with vs without query param) are captured as
readonly properties, not method signatures. This keeps the interface minimal.

---

## 6. Standards Compliance

| Standard              | Requirement                                    | How This Sub-Task Satisfies It                                         |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | All TypeScript passes `npm run typecheck`                              |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | 10 duplicated functions consolidated into shared service               |
| NASA/JPL Rule 14      | Minimize function complexity                   | Each function has single responsibility; adapter abstracts differences |
| CERT C ERR00-C        | Adopt consistent error handling                | Shared functions use consistent try/catch patterns                     |
| Barr C Ch. 8          | Each module shall have a header                | `sweepService.ts` and `types.ts` export typed public interfaces        |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/rfsweep/+page.svelte
git checkout -- src/routes/hackrfsweep/+page.svelte
rm -rf src/lib/services/sweep/
```

**WARNING**: This step blocks Phase 5.1.16 and 5.1.18. Rolling back this step
requires also rolling back those dependent steps if they have been executed.

---

## 8. Dependency Diagram

```
Phase 5.1.17 (this step) -- Shared Service + Adapter Interface
    |
    +---> Phase 5.1.16 -- Shared Components (consumes adapter types)
    |
    +---> Phase 5.1.18 -- USRP Power Measurement (implements adapter.measurePower)
```

---

_Phase 5.1.17 -- Sweep: Create Shared Sweep Service with Device Adapter_
_Execution priority: 10 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -1,105 script lines replaced with ~300 shared service lines_
