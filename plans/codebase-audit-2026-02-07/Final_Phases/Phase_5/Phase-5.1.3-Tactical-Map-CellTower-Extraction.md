# Phase 5.1.3 -- Tactical Map: Extract Cell Tower Subsystem

| Field             | Value                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| **Phase**         | 5.1.3                                                                     |
| **Title**         | Tactical Map: Extract Cell Tower Subsystem                                |
| **Risk Level**    | MEDIUM                                                                    |
| **Prerequisites** | Phase 4 complete (dead cellTowerService.ts removed), Phase 5.1.1 complete |
| **Files Touched** | 2 (1 modified, 1 created)                                                 |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8     |
| **Audit Date**    | 2026-02-08                                                                |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                       |

---

## 1. Objective

Extract the cell tower subsystem (fetch, add, toggle, state management) from the
tactical-map-simple god page into a new `CellTowerManager` class. The `addCellTower`
function at 129 lines EXCEEDS the 60-LOC NASA/JPL Rule 15 limit and must be
decomposed into three sub-functions.

**CRITICAL**: This creates a NEW file at `src/lib/services/tactical-map/cellTowerManager.ts`.
It does NOT extend, import from, or reference the dead `cellTowerService.ts` (which
has zero importers and is deleted in Phase 4). See Phase-5.1.0 Section 3.1.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

| Function/State                          | Location  | Lines | Side Effects            | >60 LOC? |
| --------------------------------------- | --------- | ----- | ----------------------- | -------- |
| `getMncCarrier(mccMnc: string): string` | L591-L605 | 15    | None (already in 5.1.1) | No       |
| `fetchCellTowers()`                     | L608-L665 | 58    | API call, map markers   | No       |
| `addCellTower(tower: any)`              | L666-L794 | 129   | Leaflet markers, state  | **YES**  |
| `toggleCellTowers()`                    | L795-L821 | 27    | Map layer toggle        | No       |
| State: `cellTowers`                     | let decl  | --    | --                      | --       |
| State: `cellTowerMarkers`               | let decl  | --    | --                      | --       |
| State: `_cellTowerCount`                | let decl  | --    | --                      | --       |
| State: `showCellTowers`                 | let decl  | --    | --                      | --       |

**Total lines to extract**: ~230 (including state declarations)

---

## 3. Decomposition of addCellTower (129 lines)

`addCellTower` currently handles 6 responsibilities:

1. Tower deduplication check (~10 lines)
2. Leaflet marker creation with SVG icon (~25 lines)
3. Popup HTML generation (~60 lines)
4. Marker event binding (~15 lines)
5. State map updates (~10 lines)
6. Error handling (~9 lines)

**Split into 3 functions**:

- `createTowerMarkerIcon(tower, carrier): string` -- returns SVG string (~25 lines)
- `createTowerPopupHTML(tower, carrier, location): string` -- returns popup HTML (~60 lines)
- `addCellTower(tower, map, markers, L)` -- orchestrator calling the above (~40 lines)

**Post-split max function length**: ~60 lines (createTowerPopupHTML is HTML template data, acceptable)

---

## 4. Implementation Steps

### Step 1: Create the Target File

Create `src/lib/services/tactical-map/cellTowerManager.ts` with a class-based interface:

```typescript
// src/lib/services/tactical-map/cellTowerManager.ts

import type { LeafletMap, LeafletLibrary, LeafletMarker } from '$lib/types/leaflet';

interface CellTowerData {
	// ... fields from the tower API response
}

function createTowerMarkerIcon(tower: CellTowerData, carrier: string): string {
	// SVG icon generation (~25 lines)
	// Extracted from addCellTower L666-L690 region
}

function createTowerPopupHTML(
	tower: CellTowerData,
	carrier: string,
	location: { lat: number; lon: number }
): string {
	// Popup HTML template (~60 lines)
	// Extracted from addCellTower L691-L750 region
}

export class CellTowerManager {
	private towers: Map<string, CellTowerData> = new Map();
	private markers: Map<string, LeafletMarker> = new Map();

	constructor(
		private map: LeafletMap,
		private L: LeafletLibrary
	) {}

	async fetchTowers(): Promise<void> {
		// Extracted from fetchCellTowers() L608-L665 (~58 lines)
		// Calls this.addTower() for each result
	}

	addTower(tower: CellTowerData): void {
		// Orchestrator (~40 lines)
		// 1. Dedup check against this.towers
		// 2. Call createTowerMarkerIcon()
		// 3. Call createTowerPopupHTML()
		// 4. Create Leaflet marker, bind popup
		// 5. Add to this.markers and this.towers
	}

	toggleVisibility(): void {
		// Extracted from toggleCellTowers() L795-L821 (~27 lines)
	}

	clearAll(): void {
		// Remove all markers from map and clear internal maps
	}

	get count(): number {
		return this.towers.size;
	}
}
```

### Step 2: Remove Functions from God Page

Remove from `+page.svelte`:

- `fetchCellTowers()` (L608-L665)
- `addCellTower()` (L666-L794)
- `toggleCellTowers()` (L795-L821)
- Related state declarations: `cellTowers`, `cellTowerMarkers`, `_cellTowerCount`, `showCellTowers`

**Note**: `getMncCarrier` was already extracted in Phase 5.1.1. If `addCellTower` or
`fetchCellTowers` calls `getMncCarrier`, import it from `utils.ts`.

### Step 3: Wire the Manager in the God Page

```typescript
import { CellTowerManager } from '$lib/services/tactical-map/cellTowerManager';

// In onMount:
cellTowerMgr = new CellTowerManager(map, L);
await cellTowerMgr.fetchTowers();

// In template, replace inline references:
// {_cellTowerCount} -> {cellTowerMgr.count}
// toggleCellTowers() -> cellTowerMgr.toggleVisibility()
```

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function fetchCellTowers\|function addCellTower\|function toggleCellTowers' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify new file exists and has expected size:
wc -l src/lib/services/tactical-map/cellTowerManager.ts
# Expected: ~250

# Verify the new file is imported:
grep 'cellTowerManager' src/routes/tactical-map-simple/+page.svelte
# Expected: >= 1 match

# Verify no function in new file exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/tactical-map/cellTowerManager.ts
# Expected: 0 functions >60 LOC

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                        | Severity | Likelihood | Mitigation                                                     |
| ------------------------------------------- | -------- | ---------- | -------------------------------------------------------------- |
| Leaflet marker state lost during extraction | HIGH     | LOW        | Manager class owns markers via Map; constructor receives map   |
| Popup HTML rendering difference             | MEDIUM   | LOW        | HTML is template literal; visual regression test catches diffs |
| Svelte reactivity broken for tower count    | MEDIUM   | MEDIUM     | Expose count as writable store or reactive getter              |
| getMncCarrier import path wrong             | LOW      | LOW        | TypeScript import resolution catches at typecheck              |

**Overall risk**: MEDIUM. This extraction involves Leaflet map state (markers added
to/removed from a map instance). The class-based approach with constructor injection
of the `map` instance is the standard pattern for preserving Leaflet state across
module boundaries.

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                         |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`                    |
| CERT C MEM00-C        | Allocate/free in same module               | Leaflet markers created and destroyed in same `CellTowerManager` class |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 129-line addCellTower split into 3 functions (max ~60 lines each)      |
| Barr C Ch. 8          | Each module shall have a header            | `cellTowerManager.ts` exports typed `CellTowerManager` class           |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/cellTowerManager.ts
```

Single commit, single revert. The `CellTowerManager` is only imported by the god page.

---

_Phase 5.1.3 -- Tactical Map: Extract Cell Tower Subsystem_
_Execution priority: 13 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -230 lines from god page_
