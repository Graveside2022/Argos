# Phase 5.1.8 -- Tactical Map: Extract UI State and Lifecycle

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Phase**         | 5.1.8                                                                 |
| **Title**         | Tactical Map: Extract UI State and Lifecycle                          |
| **Risk Level**    | LOW                                                                   |
| **Prerequisites** | Phase 5.1.3 through 5.1.6 complete (all managers created)             |
| **Files Touched** | 2-3 (1 modified, 1-2 created)                                         |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                   |

---

## 1. Objective

Refactor the UI state management (sidebar toggles), extract Leaflet interface types
to a shared module, and restructure the `onMount`/`onDestroy` lifecycle hooks to use
the manager classes created in Phase 5.1.3-5.1.6. This is the final structural
cleanup of the tactical-map-simple god page before style extraction.

**IMPORTANT**: This step MUST execute after all manager extractions (Phase 5.1.3
through 5.1.6) are complete, because the refactored `onMount`/`onDestroy` delegates
to all manager `.init()` / `.start()` / `.stop()` / `.destroy()` methods.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

### 2.1 Functions and State to Extract/Refactor

| Function/State                     | Location      | Lines | Action      |
| ---------------------------------- | ------------- | ----- | ----------- |
| `setDashboardState(isOpen)`        | L387-L394     | 8     | Keep inline |
| `setAirSignalOverlayState(isOpen)` | L395-L402     | 8     | Keep inline |
| `setBettercapOverlayState(isOpen)` | L403-L410     | 8     | Keep inline |
| `setBtleOverlayState(isOpen)`      | L411-L449     | 39    | Keep inline |
| Sidebar toggle state variables     | ~15 let decls | ~15   | Keep inline |
| Leaflet interface types            | L84-L115      | ~32   | Extract     |
| `onMount` block                    | L2064-L2134   | 71    | Refactor    |
| `onDestroy` block                  | L2135-L2165   | 31    | Refactor    |

### 2.2 Rationale for Keep/Extract Decisions

- **Sidebar toggle functions** (setDashboardState, setAirSignalOverlayState, etc.):
  These are thin orchestration functions (8-39 lines each) that toggle UI state.
  They belong in the orchestrator page, not in a service module. They are under
  60 LOC and have no logic worth extracting.

- **Leaflet interface types** (L84-L115): These define `LeafletMap`, `LeafletMarker`,
  `LeafletCircle`, `LeafletCircleMarker`, and `LeafletLibrary` types. They are
  shared across all tactical-map manager modules and should be in a central types file.

- **onMount/onDestroy**: Currently 71+31=102 lines of initialization and teardown
  code. After all manager extractions, these blocks should be thin orchestrators
  calling manager `.start()` and `.stop()` methods.

**Total lines extracted/refactored**: ~150

---

## 3. Implementation Steps

### Step 1: Extract Leaflet Types to Shared Module

Create `src/lib/types/leaflet.ts`:

```typescript
// src/lib/types/leaflet.ts
// Shared Leaflet type definitions used across map-related pages and services

export interface LeafletMap {
	// Extracted from L84-L115 of tactical-map-simple/+page.svelte
	// ... map instance type definitions
}

export interface LeafletMarker {
	// ... marker type definitions
}

export interface LeafletCircle {
	// ... circle type definitions
}

export interface LeafletCircleMarker {
	// ... circle marker type definitions
}

export interface LeafletLibrary {
	// ... L (leaflet module) type definitions
}
```

Update all manager files (created in Phase 5.1.3-5.1.6) to import from this
shared types module instead of defining types locally:

```typescript
import type { LeafletMap, LeafletLibrary, LeafletMarker } from '$lib/types/leaflet';
```

### Step 2: Refactor onMount

**Post-extraction onMount** should be a thin orchestrator:

```typescript
onMount(async () => {
	const L = await import('leaflet');
	map = initializeMap(mapContainer, L);
	cellTowerMgr = new CellTowerManager(map, L);
	systemInfoMgr = new SystemInfoManager(map, L);
	gpsManager.start(map, L);
	kismetManager.start(map, L);
	signalManager.start(map, L);
});
```

This replaces the current 71-line onMount block that manually initializes map tiles,
sets up GPS polling intervals, creates Kismet fetch intervals, and initializes
signal processing.

### Step 3: Refactor onDestroy

**Post-extraction onDestroy** should be a thin cleanup:

```typescript
onDestroy(() => {
	gpsManager.stop();
	kismetManager.stop();
	signalManager.stop();
	map?.remove();
});
```

This replaces the current 31-line onDestroy block that manually clears intervals,
removes map markers, and destroys the Leaflet map instance.

### Step 4: Remove Extracted Leaflet Types from God Page

Remove the Leaflet interface type definitions (L84-L115) from the god page.
Replace with import from `$lib/types/leaflet`.

### Step 5: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify Leaflet types extracted:
grep -c 'interface LeafletMap\|interface LeafletMarker' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify shared types file exists:
wc -l src/lib/types/leaflet.ts
# Expected: ~40

# Verify shared types imported by managers:
grep -r 'from.*types/leaflet' src/lib/services/tactical-map/
# Expected: matches in each manager file

# Verify onMount is now thin:
# Count lines between 'onMount' and closing ')' in god page
# Expected: <= 15 lines

# Verify onDestroy is now thin:
# Expected: <= 10 lines

# Build verification:
npm run typecheck
npm run build

# Verify no circular dependencies:
npx madge --circular --extensions ts,svelte src/lib/types/leaflet.ts
# Expected: no cycles
```

---

## 5. Risk Assessment

| Risk                                        | Severity | Likelihood | Mitigation                                                |
| ------------------------------------------- | -------- | ---------- | --------------------------------------------------------- |
| Leaflet type definitions incomplete         | MEDIUM   | LOW        | TypeScript typecheck catches missing interface members    |
| onMount initialization order matters        | MEDIUM   | MEDIUM     | Preserve original initialization order in refactored code |
| onDestroy cleanup order matters             | LOW      | LOW        | Cleanup is idempotent; order is less critical than init   |
| Manager .start()/.stop() interface mismatch | MEDIUM   | LOW        | Each manager was designed with this interface in mind     |

**Overall risk**: LOW. This step is a structural reorganization of already-extracted
code. The actual logic has already been moved to manager classes. This step simply
cleans up the wiring.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                                       |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | All TypeScript passes `npm run typecheck`                            |
| CERT C MEM00-C        | Allocate/free in same module          | onMount creates managers, onDestroy calls their stop/cleanup methods |
| NASA/JPL Rule 14      | Minimize function complexity          | onMount/onDestroy reduced to thin orchestrators                      |
| Barr C Ch. 8          | Each module shall have a header       | Shared `leaflet.ts` types module with clear exports                  |

---

## 7. Rollback Strategy

```bash
# Revert to pre-refactoring state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/types/leaflet.ts
# Also revert manager imports if they were updated:
git checkout -- src/lib/services/tactical-map/*.ts
```

This step depends on all prior manager extractions (5.1.3-5.1.6). Rolling back
this step alone leaves the manager files intact but reverts the wiring in the god page.

---

_Phase 5.1.8 -- Tactical Map: Extract UI State and Lifecycle_
_Execution priority: 19 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -150 lines from god page_
