# Phase 5.1.7 -- Tactical Map: Extract GPS Subsystem

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Phase**         | 5.1.7                                                                 |
| **Title**         | Tactical Map: Extract GPS Subsystem                                   |
| **Risk Level**    | MEDIUM                                                                |
| **Prerequisites** | Phase 5.1.1 complete                                                  |
| **Files Touched** | 3-4 (1 modified, 1 created, 2 existing components wired)              |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                   |

---

## 1. Objective

Extract the GPS position management subsystem from the tactical-map-simple god page
into a new `GPSManager` service. The `updateGPSPosition` function at 102 lines
EXCEEDS the 60-LOC NASA/JPL Rule 15 limit and must be decomposed into 3 sub-functions.
Additionally, wire the two pre-built GPS components (`GPSStatusBar.svelte`,
`GPSPositionManager.svelte`) to replace inline GPS UI logic.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

### 2.1 Functions and Types to Extract

| Function/Interface          | Location    | Lines | Side Effects           | >60 LOC? |
| --------------------------- | ----------- | ----- | ---------------------- | -------- |
| `GPSPositionData` interface | L18-L28     | 11    | None (type definition) | No       |
| `GPSApiResponse` interface  | L30-L36     | 7     | None (type definition) | No       |
| `updateGPSPosition()`       | L1337-L1438 | 102   | API, markers, map pan  | **YES**  |

### 2.2 Related State Variables

- `userPosition`, `gpsInterval`, `gpsConnected`
- `mgrsPosition`, `userMarker`, `accuracyCircle`

### 2.3 Pre-Built Components to Wire

| Component                 | Path                                 | Lines | Purpose                   |
| ------------------------- | ------------------------------------ | ----- | ------------------------- |
| GPSStatusBar.svelte       | src/lib/components/tactical-map/gps/ | 163   | GPS status display        |
| GPSPositionManager.svelte | src/lib/components/tactical-map/gps/ | 34    | GPS polling interval mgmt |

**Total lines to extract**: ~100

---

## 3. Decomposition of updateGPSPosition (102 lines)

This function currently handles 9 responsibilities:

1. Fetch from `/api/gps/position` (~5 lines)
2. Parse response and validate GPS fix (~10 lines)
3. Update `userPosition` state (~5 lines)
4. Compute MGRS from lat/lon (~3 lines)
5. Detect country from coordinates (~3 lines)
6. Create/update Leaflet user marker with custom icon (~30 lines)
7. Create/update accuracy circle overlay (~15 lines)
8. Pan map to new position (~5 lines)
9. Error handling and retry logic (~20 lines)

### 3.1 Split into 3 Functions

**Function 1**: `parseGPSResponse(response: GPSApiResponse): GPSPositionData | null`

- Pure function, validates and extracts position data (~15 lines)
- Returns null if no fix available

**Function 2**: `updateUserMarker(position, map, L, marker?): LeafletMarker`

- Creates or updates the user position marker with custom icon (~30 lines)
- Returns the marker instance for state tracking

**Function 3**: `updateAccuracyCircle(position, accuracy, map, L, circle?): LeafletCircle`

- Creates or updates the accuracy circle overlay (~15 lines)
- Returns the circle instance for state tracking

**Orchestrator**: `updateGPSPosition(map, L, state): Promise<GPSState>`

- Fetch, parse, delegate to marker/circle helpers, pan map (~35 lines)

**Post-split max function length**: ~35 lines

---

## 4. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/tactical-map/gpsManager.ts`:

```typescript
// src/lib/services/tactical-map/gpsManager.ts

import type { LeafletMap, LeafletLibrary, LeafletMarker, LeafletCircle } from '$lib/types/leaflet';

export interface GPSPositionData {
	// Extracted from L18-L28 (11 lines)
	lat: number;
	lon: number;
	altitude?: number;
	speed?: number;
	heading?: number;
	accuracy?: number;
	fix: boolean;
	// ... additional fields
}

export interface GPSApiResponse {
	// Extracted from L30-L36 (7 lines)
}

interface GPSState {
	position: GPSPositionData | null;
	marker: LeafletMarker | null;
	circle: LeafletCircle | null;
	connected: boolean;
	mgrs: string;
}

// --- Pure/helper functions (private) ---

function parseGPSResponse(response: GPSApiResponse): GPSPositionData | null {
	// Validate GPS fix and extract position (~15 lines)
}

function updateUserMarker(
	position: GPSPositionData,
	map: LeafletMap,
	L: LeafletLibrary,
	existingMarker?: LeafletMarker
): LeafletMarker {
	// Create or update user position marker (~30 lines)
}

function updateAccuracyCircle(
	position: GPSPositionData,
	accuracy: number,
	map: LeafletMap,
	L: LeafletLibrary,
	existingCircle?: LeafletCircle
): LeafletCircle {
	// Create or update accuracy circle (~15 lines)
}

// --- Exported service class ---

export class GPSManager {
	private state: GPSState = {
		position: null,
		marker: null,
		circle: null,
		connected: false,
		mgrs: ''
	};
	private interval: ReturnType<typeof setInterval> | null = null;

	constructor(
		private map: LeafletMap,
		private L: LeafletLibrary
	) {}

	async update(): Promise<GPSPositionData | null> {
		// Orchestrator: fetch, parse, delegate (~35 lines)
	}

	start(intervalMs: number = 3000): void {
		// Start polling interval
		this.interval = setInterval(() => this.update(), intervalMs);
	}

	stop(): void {
		// Clear polling interval
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	get position(): GPSPositionData | null {
		return this.state.position;
	}

	get isConnected(): boolean {
		return this.state.connected;
	}

	get mgrs(): string {
		return this.state.mgrs;
	}
}
```

### Step 2: Wire Pre-Built GPSStatusBar.svelte (163 lines)

Replace inline GPS status display in the template:

```svelte
<GPSStatusBar
	connected={gpsManager.isConnected}
	position={gpsManager.position}
	mgrs={gpsManager.mgrs}
/>
```

### Step 3: Wire Pre-Built GPSPositionManager.svelte (34 lines)

Replace inline GPS polling interval management:

```svelte
<GPSPositionManager on:positionUpdate={handleGPSUpdate} />
```

### Step 4: Remove Extracted Code from God Page

Remove:

- `GPSPositionData` interface (L18-L28)
- `GPSApiResponse` interface (L30-L36)
- `updateGPSPosition()` (L1337-L1438)
- Related state: `userPosition`, `gpsInterval`, `gpsConnected`, `mgrsPosition`, `userMarker`, `accuracyCircle`

### Step 5: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definition removed from god page:
grep -c 'function updateGPSPosition' src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify interfaces removed:
grep -c 'interface GPSPositionData\|interface GPSApiResponse' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify components are wired:
grep -c 'GPSStatusBar\|GPSPositionManager' src/routes/tactical-map-simple/+page.svelte
# Expected: >= 2

# Verify service file exists and has expected size:
wc -l src/lib/services/tactical-map/gpsManager.ts
# Expected: ~120

# Verify no function in service file exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/tactical-map/gpsManager.ts
# Expected: 0 functions >60 LOC

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                           | Severity | Likelihood | Mitigation                                             |
| ---------------------------------------------- | -------- | ---------- | ------------------------------------------------------ |
| GPS polling interval leak on component destroy | HIGH     | LOW        | GPSManager.stop() called in onDestroy; clears interval |
| Leaflet marker/circle state lost               | MEDIUM   | LOW        | Manager class owns state; constructor receives map     |
| GPSStatusBar.svelte prop interface mismatch    | LOW      | MEDIUM     | Compare interface before wiring; adapt if needed       |
| MGRS computation dependency missing            | MEDIUM   | LOW        | Verify MGRS library import available in gpsManager.ts  |
| Map auto-pan behavior changed                  | LOW      | LOW        | Preserve map.panTo() call in orchestrator              |

**Overall risk**: MEDIUM. The GPS subsystem is relatively self-contained. The main
risk is interval lifecycle management, mitigated by the class-based start/stop pattern.

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                    |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`               |
| CERT C MEM00-C        | Allocate/free in same module               | Leaflet markers and intervals managed in same `GPSManager` class  |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 102-line updateGPSPosition split into 4 functions (max ~35 lines) |
| Barr C Ch. 8          | Each module shall have a header            | `gpsManager.ts` exports typed `GPSManager` class and interfaces   |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/gpsManager.ts
```

Single commit, single revert. Pre-built components are not modified.

---

_Phase 5.1.7 -- Tactical Map: Extract GPS Subsystem_
_Execution priority: 15 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -100 lines from god page_
