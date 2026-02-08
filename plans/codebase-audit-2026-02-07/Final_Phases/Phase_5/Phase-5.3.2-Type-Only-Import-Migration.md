# Phase 5.3.2: Type-Only Import Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7 (file scope isolation), CERT C STR00-C (type definitions in dedicated modules), NASA/JPL Rule 15
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.2
**Risk Level**: LOW -- Type-only refactoring with re-export backward compatibility
**Prerequisites**: Phase 5.2 (HackRF/USRP Consolidation) complete; Phase 5.3.0 (Assessment) reviewed
**Blocks**: Tasks 5.3.3 and 5.3.4 (runtime violation fixes depend on type files existing)
**Estimated Files Touched**: 18 (3 created, 15 modified for import path rewrite) + 2 store files updated with re-exports
**Standards**: MISRA C:2012 Rule 8.7, CERT C STR00-C, NASA/JPL Rule 15

---

## Objective

Migrate 15 type-only store imports from the service/server layer to canonical type definition files in `$lib/types/`. Create 3 new type files (`signals.ts`, `drone.ts`, `map.ts`), update store files with re-exports for backward compatibility, and rewrite all 15 service import paths.

This task also absorbs the `HeatmapLayer` type extraction originally planned for the removed Task 5.3.1.

---

## Current State

15 service files import types from store modules. These imports are syntactically `import type { ... }` and are erased at compile time. They produce no runtime coupling. However, they violate the architectural boundary: types should be defined in `$lib/types/`, not co-located with reactive store definitions.

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

### Verification of Current State

```bash
# List all type-only imports from stores in services/server
grep -rn "import type.*from.*stores" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: exactly 15 files
```

---

## Execution Steps

### Phase A -- Create Type Definition Files

Three new type files are required. Each extracts types from their current store location.

#### File 1: `src/lib/types/signals.ts`

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

**Pre-creation check**: Verify `SignalSource` exists in `$lib/types/enums`:

```bash
grep -n "SignalSource" src/lib/types/enums.ts
# EXPECTED: export enum/type SignalSource
```

#### File 2: `src/lib/types/drone.ts`

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

**Pre-creation check**: Verify the source type definitions in the drone store match these exactly:

```bash
grep -A 10 "export interface FlightPoint" src/lib/stores/drone.ts
grep -A 10 "export interface SignalCapture" src/lib/stores/drone.ts
grep -A 10 "export interface AreaOfInterest" src/lib/stores/drone.ts
```

#### File 3: `src/lib/types/map.ts` (extend if already exists)

```typescript
// Append to src/lib/types/map.ts (or create if not yet present)

// LeafletMap type alias -- previously in stores/tactical-map/mapStore.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafletMap = any;
```

**Note**: This file also absorbs the `HeatmapLayer` type extraction originally planned in the removed Task 5.3.1. If `HeatmapLayer`, `HeatmapConfig`, and `HeatmapPoint` are also being consolidated from `heatmapService.ts`, they should be added to this file during execution.

**Pre-creation check**:

```bash
# Check if types/map.ts already exists
ls -la src/lib/types/map.ts 2>/dev/null
# If it exists, append. If not, create.

# Check current LeafletMap definition
grep -n "LeafletMap" src/lib/stores/tactical-map/mapStore.ts
```

### Phase A Verification

```bash
# Verify all 3 type files exist
ls -la src/lib/types/signals.ts src/lib/types/drone.ts src/lib/types/map.ts

# Verify TypeScript compiles with new files
npx tsc --noEmit
```

---

### Phase B -- Update Store Re-exports

Each store file that previously defined these types must re-export from the new canonical location. This preserves backward compatibility for any Svelte components that import types from the store (components are permitted to import from stores).

#### `src/lib/stores/map/signals.ts`

```typescript
// BEFORE (lines 6-29):
// export interface SignalMarker { ... }

// AFTER:
export type { SignalMarker } from '$lib/types/signals';
// All SignalMarker usage within this file now imports from the canonical source.
```

**Implementation detail**: Remove the full `export interface SignalMarker { ... }` block (lines 6-29) and replace with the single re-export line. If the store file's own internal code references `SignalMarker`, add a local `import type { SignalMarker } from '$lib/types/signals'` at the top.

#### `src/lib/stores/tactical-map/mapStore.ts`

```typescript
// BEFORE:
// export type LeafletMap = any;

// AFTER:
export type { LeafletMap } from '$lib/types/map';
```

#### `src/lib/stores/drone.ts` (or `src/lib/stores/drone/index.ts`)

```typescript
// BEFORE:
// export interface FlightPoint { ... }
// export interface SignalCapture { ... }
// export interface AreaOfInterest { ... }

// AFTER:
export type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/types/drone';
```

### Phase B Verification

```bash
# Verify store re-exports work -- must compile cleanly
npx tsc --noEmit

# Verify components that import from stores still resolve
grep -rn "from.*stores/map/signals.*import.*SignalMarker" src/routes/ src/lib/components/ --include="*.svelte"
# Any matches should still compile because the re-export is transparent
```

---

### Phase C -- Rewrite 15 Service Import Paths

Each of the 15 files changes exactly one import line.

#### SignalMarker consumers (12 files)

All 12 files (#1-5, #7-14 in the inventory) change the same import line:

```typescript
// BEFORE:
import type { SignalMarker } from '$lib/stores/map/signals';

// AFTER:
import type { SignalMarker } from '$lib/types/signals';
```

**Files to modify** (each has exactly one import line change):

1. `src/lib/server/db/database.ts`
2. `src/lib/server/db/geo.ts`
3. `src/lib/server/db/signalRepository.ts`
4. `src/lib/services/db/dataAccessLayer.ts`
5. `src/lib/services/db/signalDatabase.ts`
6. `src/lib/services/map/aiPatternDetector.ts`
7. `src/lib/services/map/contourGenerator.ts`
8. `src/lib/services/map/droneDetection.ts`
9. `src/lib/services/map/heatmapService.ts`
10. `src/lib/services/map/mapUtils.ts`
11. `src/lib/services/map/networkAnalyzer.ts`
12. `src/lib/services/map/signalClustering.ts`
13. `src/lib/services/map/signalFiltering.ts`

**Batch verification** (run after modifying all 13):

```bash
# Verify zero remaining type imports from stores/map/signals in services/server
grep -rn "from.*stores/map/signals" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: 0 results
```

#### FlightPoint/SignalCapture/AreaOfInterest consumer (1 file)

**File**: `src/lib/services/drone/flightPathAnalyzer.ts`

```typescript
// BEFORE:
import type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/stores/drone';

// AFTER:
import type { FlightPoint, SignalCapture, AreaOfInterest } from '$lib/types/drone';
```

#### LeafletMap consumer (1 file)

**File**: `src/lib/services/tactical-map/cellTowerService.ts`

```typescript
// BEFORE:
import type { LeafletMap } from '$lib/stores/tactical-map/mapStore';

// AFTER:
import type { LeafletMap } from '$lib/types/map';
```

---

## Final Verification

```bash
# 1. Verify zero type-only imports from stores in service/server files
grep -rn "from.*stores.*import type" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: 0 results

# 2. Verify zero type imports from stores in service/server files (alternate pattern)
grep -rn "import type.*from.*stores" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: 0 results

# 3. Verify store re-exports work (components still compile)
npx tsc --noEmit
# EXPECTED: 0 errors

# 4. Verify no runtime behavior change
npm run test:unit
# EXPECTED: all tests pass

# 5. Verify build succeeds
npm run build
# EXPECTED: build succeeds, no import resolution errors
```

---

## Risk Assessment

### Risk 1: Store Re-export Breaks Component Imports

**Probability**: LOW. The re-export pattern (`export type { X } from '$lib/types/y'`) is fully transparent to consumers. TypeScript resolves the re-export at compile time.

**Mitigation**: Run `npx tsc --noEmit` after Phase B before proceeding to Phase C.

### Risk 2: SignalSource Enum Not in types/enums.ts

**Probability**: LOW. If `SignalSource` is not yet defined in `$lib/types/enums`, the new `types/signals.ts` file will fail to compile.

**Mitigation**: Check at execution time. If `SignalSource` is defined elsewhere, adjust the import path in `types/signals.ts`.

### Risk 3: Drone Store Is Directory vs File

**Probability**: MEDIUM. The drone store may be `stores/drone.ts` or `stores/drone/index.ts`. The import path `$lib/stores/drone` resolves both.

**Mitigation**: Verify at execution time with `ls -la src/lib/stores/drone*` and adjust the re-export file accordingly.

### Rollback Strategy

All changes are import path rewrites with re-exports. To rollback:

1. Delete the 3 new type files (`types/signals.ts`, `types/drone.ts`, `types/map.ts`)
2. Restore the interface definitions in the store files (revert the re-export changes)
3. Revert the 15 import path changes in service/server files

```bash
git checkout HEAD -- src/lib/stores/map/signals.ts \
  src/lib/stores/tactical-map/mapStore.ts \
  src/lib/stores/drone* \
  src/lib/server/db/ \
  src/lib/services/
git rm src/lib/types/signals.ts src/lib/types/drone.ts
# Only remove types/map.ts if it was newly created, not if it was extended
```

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C STR00-C, NASA/JPL Rule 15_
_Classification: UNCLASSIFIED // FOUO_
