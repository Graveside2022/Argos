# Phase 5.1.6 -- Tactical Map: Extract HackRF/Signal Subsystem

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Phase**         | 5.1.6                                                                 |
| **Title**         | Tactical Map: Extract HackRF/Signal Subsystem                         |
| **Risk Level**    | HIGH                                                                  |
| **Prerequisites** | Phase 5.1.1 complete, Phase 5.1.2 complete                            |
| **Files Touched** | 4 (1 modified, 1 created, 3 existing components wired)                |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                   |

---

## 1. Objective

Extract the HackRF signal processing subsystem from the tactical-map-simple god page
into a new `SignalManager` service. The `processSignals` function at 234 lines
EXCEEDS the 60-LOC NASA/JPL Rule 15 limit and must be decomposed into 4 sub-functions.
Additionally, wire the three pre-built HackRF components (`HackRFController.svelte`,
`FrequencySearch.svelte`, `SignalProcessor.svelte`) to replace inline UI logic.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

### 2.1 Functions to Extract

| Function                 | Location    | Lines | Side Effects       | >60 LOC? |
| ------------------------ | ----------- | ----- | ------------------ | -------- |
| `processSignals()`       | L1729-L1962 | 234   | Map markers, state | **YES**  |
| `connectToHackRF()`      | L1439-L1453 | 15    | API call           | No       |
| `disconnectFromHackRF()` | L1454-L1466 | 13    | API call           | No       |
| `openSpectrumAnalyzer()` | L528-L544   | 17    | Window navigation  | No       |
| `clearSignals()`         | L545-L588   | 44    | Map markers, state | No       |

### 2.2 Related State Variables

- `signals`, `signalMarkers`, `signalCount`, `currentSignal`
- `isSearching`, `targetFrequency`, `aggregator`

### 2.3 Pre-Built Components to Wire

| Component               | Path                                    | Lines | Purpose                   |
| ----------------------- | --------------------------------------- | ----- | ------------------------- |
| HackRFController.svelte | src/lib/components/tactical-map/hackrf/ | 331   | HackRF connection/control |
| FrequencySearch.svelte  | src/lib/components/tactical-map/hackrf/ | 324   | Frequency search UI       |
| SignalProcessor.svelte  | src/lib/components/tactical-map/hackrf/ | 221   | Signal processing logic   |

**Total lines to extract**: ~395

---

## 3. Decomposition of processSignals (234 lines)

This function currently handles:

1. Get aggregated signals from `SignalAggregator` (~5 lines)
2. Deduplicate by frequency, keep strongest per frequency (~12 lines)
3. For each signal: create new marker with popup OR update existing marker/popup (~160 lines)
4. Remove stale signals not in current set (~12 lines)
5. Update signal count and grace-period clearing (~25 lines)

**CRITICAL DUPLICATION**: Lines L1784-L1822 (new signal popup) and L1871-L1908
(update signal popup) contain near-identical popup HTML. Same pattern as
`fetchKismetDevices` in Phase 5.1.5.

### 3.1 Split into 4 Functions

**Function 1**: `createSignalPopupHTML(signal: SignalData, aggSignal: AggregatedSignal): string`

- Pure function, returns popup HTML (~30 lines)
- Eliminates the duplication between new/update paths

**Function 2**: `createSignalMarker(signal: SignalData, aggSignal: AggregatedSignal, L, map): LeafletCircleMarker`

- Creates a new circle marker with popup (~30 lines)

**Function 3**: `updateSignalMarker(marker: LeafletCircleMarker, signal: SignalData, aggSignal: AggregatedSignal): void`

- Updates style, radius, and popup content (~25 lines)

**Function 4**: `processSignals(map, L, signals, signalMarkers, aggregator, targetFrequency, userPosition): SignalData | null`

- Orchestrator: deduplicate, iterate, delegate, cleanup (~50 lines)

**Post-split max function length**: ~50 lines

---

## 4. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/tactical-map/signalManager.ts`:

```typescript
// src/lib/services/tactical-map/signalManager.ts

import type { LeafletMap, LeafletLibrary, LeafletCircleMarker } from '$lib/types/leaflet';
import { getSignalColor } from './utils'; // from Phase 5.1.1

interface SignalData {
	frequency: number;
	power: number;
	lat: number;
	lon: number;
	// ... additional fields
}

interface AggregatedSignal {
	avgPower: number;
	count: number;
	// ... additional fields
}

// --- Pure functions (private) ---

function createSignalPopupHTML(signal: SignalData, aggSignal: AggregatedSignal): string {
	// Single popup template (~30 lines)
	// Replaces duplicated popup HTML at L1784-L1822 and L1871-L1908
}

function createSignalMarker(
	signal: SignalData,
	aggSignal: AggregatedSignal,
	L: LeafletLibrary,
	map: LeafletMap
): LeafletCircleMarker {
	// New circle marker creation (~30 lines)
}

function updateSignalMarker(
	marker: LeafletCircleMarker,
	signal: SignalData,
	aggSignal: AggregatedSignal
): void {
	// Update existing marker (~25 lines)
}

// --- Exported service class ---

export class SignalManager {
	private signals: Map<string, SignalData> = new Map();
	private markers: Map<string, LeafletCircleMarker> = new Map();

	constructor(
		private map: LeafletMap,
		private L: LeafletLibrary
	) {}

	processSignals(
		aggregator: any,
		targetFrequency: number | null,
		userPosition: { lat: number; lon: number }
	): SignalData | null {
		// Orchestrator (~50 lines)
	}

	async connect(): Promise<void> {
		// Extracted from connectToHackRF() L1439-L1453 (~15 lines)
	}

	async disconnect(): Promise<void> {
		// Extracted from disconnectFromHackRF() L1454-L1466 (~13 lines)
	}

	openSpectrumAnalyzer(): void {
		// Extracted from openSpectrumAnalyzer() L528-L544 (~17 lines)
	}

	clearAll(): void {
		// Extracted from clearSignals() L545-L588 (~44 lines)
		// Remove all signal markers from map and clear internal state
	}

	get count(): number {
		return this.signals.size;
	}
}
```

### Step 2: Wire Pre-Built HackRFController.svelte (331 lines)

Replace inline `connectToHackRF`, `disconnectFromHackRF` with the component:

```svelte
<HackRFController on:connect={handleHackRFConnect} on:disconnect={handleHackRFDisconnect} />
```

**Before wiring**: Compare `HackRFController.svelte` prop interface to the data
shapes in the god page. Document any mismatches.

### Step 3: Wire Pre-Built FrequencySearch.svelte (324 lines)

Replace inline frequency input and search trigger:

```svelte
<FrequencySearch on:search={handleFrequencySearch} bind:targetFrequency />
```

### Step 4: Wire Pre-Built SignalProcessor.svelte (221 lines)

Replace inline `processSignals` reactive loop:

```svelte
<SignalProcessor {aggregator} {targetFrequency} on:signalUpdate={handleSignalUpdate} />
```

### Step 5: Remove All Extracted Code from God Page

Remove:

- All functions listed in Section 2.1
- All state variables listed in Section 2.2
- Add imports for `SignalManager`, `HackRFController`, `FrequencySearch`, `SignalProcessor`

### Step 6: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function processSignals\|function connectToHackRF\|function disconnectFromHackRF' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify components are wired:
grep -c 'HackRFController\|FrequencySearch\|SignalProcessor' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: >= 3 (import lines)

# Verify service file exists and has expected size:
wc -l src/lib/services/tactical-map/signalManager.ts
# Expected: ~200

# Verify no function in service file exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/tactical-map/signalManager.ts
# Expected: 0 functions >60 LOC

# Verify popup HTML duplication eliminated:
grep -c 'createSignalPopupHTML' src/lib/services/tactical-map/signalManager.ts
# Expected: >= 2 (definition + call sites in createSignalMarker and updateSignalMarker)

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                                | Severity | Likelihood | Mitigation                                                             |
| --------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------- |
| Leaflet circle marker lifecycle broken              | HIGH     | MEDIUM     | Manager class owns markers Map; constructor receives map via injection |
| HackRFController.svelte prop interface mismatch     | MEDIUM   | MEDIUM     | Compare interface before wiring; adapt page data if needed             |
| FrequencySearch.svelte prop interface mismatch      | MEDIUM   | MEDIUM     | Compare interface before wiring; adapt page data if needed             |
| SignalProcessor.svelte prop interface mismatch      | MEDIUM   | MEDIUM     | Compare interface before wiring; adapt page data if needed             |
| SignalAggregator reference broken during extraction | HIGH     | LOW        | Pass aggregator as parameter to processSignals, not as class field     |
| Popup HTML visual regression                        | MEDIUM   | LOW        | Unified popup template; visual test catches differences                |

**Overall risk**: HIGH. This extraction involves real-time signal processing tied
to Leaflet map visualization. The three pre-built components may have interface
mismatches. The `SignalAggregator` dependency adds complexity.

---

## 7. Standards Compliance

| Standard              | Requirement                                    | How This Sub-Task Satisfies It                                      |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | All extracted TypeScript passes `npm run typecheck`                 |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | Duplicated popup HTML consolidated into single template function    |
| CERT C MEM00-C        | Allocate/free in same module                   | Leaflet markers created and destroyed in same `SignalManager` class |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines     | 234-line processSignals split into 4 functions (max ~50 lines each) |
| NASA/JPL Rule 14      | Minimize function complexity                   | Pure functions separated from orchestrator; duplication eliminated  |
| Barr C Ch. 8          | Each module shall have a header                | `signalManager.ts` exports typed `SignalManager` class              |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/signalManager.ts
```

Single commit, single revert. The pre-built components are not modified.

---

_Phase 5.1.6 -- Tactical Map: Extract HackRF/Signal Subsystem_
_Execution priority: 18 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -395 lines from god page_
