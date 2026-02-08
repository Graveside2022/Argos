# Phase 5.4.4 -- Tier 1: DashboardMap.svelte Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.4-DASHBOARD-MAP
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.4 -- Decompose DashboardMap.svelte (1,053 lines)
Risk Level:     MEDIUM
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 5 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Path            | `src/lib/components/dashboard/DashboardMap.svelte` |
| Current Lines   | 1,053                                              |
| Tier            | 1 (>1,000 lines, unconditional)                    |
| Execution Order | 4 of 7 (fourth Tier 1 decomposition)               |

---

## 2. Content Analysis

Primary dashboard map component. Responsibilities include:

- Leaflet map initialization (tile layer setup, default view, zoom controls)
- Signal marker management with real-time updates from WebSocket data
- Map event handling (click, zoom, pan, resize)
- Multiple tile layer management (OpenStreetMap, satellite, terrain)
- Layer control UI (tile source switcher, overlay toggles)

**Why It Exceeds Threshold:**
Map lifecycle management, data visualization, event handling, and UI controls are all
co-located. The Leaflet initialization alone is substantial, and real-time marker CRUD
on WebSocket updates adds significant complexity.

---

## 3. Decomposition Strategy

Separate map lifecycle management from data visualization. Extract marker management,
event handling, and layer controls into dedicated modules.

**Architecture after decomposition:**

```
DashboardMap.svelte (orchestrator, ~200 lines)
  +-- MapInitializer.ts (Leaflet creation, ~120 lines)
  +-- SignalMarkerManager.ts (marker CRUD, ~250 lines)
  +-- MapEventHandlers.ts (event bindings, ~150 lines)
  +-- MapLayerControls.svelte (layer toggle UI, ~150 lines)
```

---

## 4. New File Manifest

| New File                                           | Content                                              | Est. Lines |
| -------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `components/dashboard/map/DashboardMap.svelte`     | Orchestrator, Leaflet init, layout                   | ~200       |
| `components/dashboard/map/MapInitializer.ts`       | Leaflet map creation, tile layer setup, default view | ~120       |
| `components/dashboard/map/SignalMarkerManager.ts`  | Marker CRUD, clustering, popup binding               | ~250       |
| `components/dashboard/map/MapEventHandlers.ts`     | Click, zoom, pan, resize handlers                    | ~150       |
| `components/dashboard/map/MapLayerControls.svelte` | Layer toggle UI, tile source switcher                | ~150       |

**Total target files:** 5
**Maximum file size:** ~250 lines (SignalMarkerManager.ts)
**Original file disposition:** Replaced by orchestrator at new subdirectory path

---

## 5. Key Constraint: Leaflet Map Instance Ownership

`MapInitializer.ts` must return the `L.Map` instance. All other modules receive this
instance as a parameter. This prevents multiple map instantiation and ensures a single
source of truth for the map reference.

```typescript
// MapInitializer.ts
export function initializeMap(container: HTMLElement, options?: MapOptions): L.Map {
	const map = L.map(container, {
		/* defaults */
	});
	L.tileLayer(/* ... */).addTo(map);
	return map;
}

// SignalMarkerManager.ts
export class SignalMarkerManager {
	constructor(private map: L.Map) {
		/* ... */
	}
	addMarker(signal: SignalRecord): void {
		/* ... */
	}
	removeMarker(id: string): void {
		/* ... */
	}
	updateMarkers(signals: SignalRecord[]): void {
		/* ... */
	}
}

// MapEventHandlers.ts
export function bindMapEvents(map: L.Map, handlers: MapEventCallbacks): void {
	/* ... */
}
```

---

## 6. Migration Steps

1. Create `src/lib/components/dashboard/map/` directory.
2. Extract `MapInitializer.ts` -- Leaflet map creation, tile layer setup, default view configuration. Returns `L.Map`.
3. Extract `SignalMarkerManager.ts` -- marker CRUD operations, L.markerClusterGroup management, popup content binding. Constructor takes `L.Map` parameter.
4. Extract `MapEventHandlers.ts` -- click, zoom, pan, resize event handlers. Takes `L.Map` and callback configuration.
5. Extract `MapLayerControls.svelte` -- layer toggle UI, tile source switcher dropdown/buttons. Receives available layers as props, emits layer change events.
6. Rewrite `DashboardMap.svelte` as orchestrator:
    - `onMount`: call `initializeMap`, create `SignalMarkerManager`, call `bindMapEvents`
    - `onDestroy`: clean up map instance, remove event listeners
    - Template: `<div>` container + `<MapLayerControls>` component
7. Update all importers of original path.
8. Verify compilation and build.
9. Commit.

---

## 7. Verification Commands

```bash
# 1. All files within size limits
wc -l src/lib/components/dashboard/map/*.svelte src/lib/components/dashboard/map/*.ts

# 2. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"

# 3. Build succeeds
npm run build 2>&1 | tail -5

# 4. Original import path updated everywhere
grep -r "DashboardMap" src/ --include="*.svelte" --include="*.ts" -l

# 5. No circular dependencies
npx madge --circular src/lib/components/dashboard/map/
```

---

## 8. Key Constraints and Caveats

1. **Leaflet lifecycle.** The map container `<div>` must be mounted in the DOM before `initializeMap()` is called. Use `onMount` in the orchestrator, never `$:` reactive blocks for map creation.
2. **Marker memory management.** `SignalMarkerManager` must clean up markers on component destroy. The orchestrator's `onDestroy` must call a cleanup method on the manager.
3. **WebSocket integration.** Store subscriptions for real-time signal data remain in the orchestrator. The orchestrator feeds updated signal arrays into `SignalMarkerManager.updateMarkers()`.
4. **Resize handling.** Leaflet's `invalidateSize()` must be called on container resize. The `MapEventHandlers` module binds a resize observer and calls `map.invalidateSize()`.
5. **Import path change.** The component moves from `components/dashboard/DashboardMap.svelte` to `components/dashboard/map/DashboardMap.svelte`. All parent components must update.

---

## 9. Commit Message

```
refactor: extract DashboardMap services and controls

- Extract MapInitializer.ts: Leaflet map creation and tile layer setup
- Extract SignalMarkerManager.ts: marker CRUD, clustering, popup binding
- Extract MapEventHandlers.ts: click, zoom, pan, resize handlers
- Extract MapLayerControls.svelte: layer toggle UI
- Original 1,053-line component reduced to ~200-line orchestrator
- Map instance owned by orchestrator, passed to all modules
- No logic changes, structural only
```

---

## 10. Standards Compliance

| Standard             | Compliance                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| Barr Group Rule 1.3  | All files <300 lines post-split                                             |
| NASA/JPL Rule 2.4    | Functions extracted into separate modules                                   |
| CERT C MEM00         | Map allocation (initializeMap) and cleanup (onDestroy) in same orchestrator |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                                          |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.4 -- Tier 1: DashboardMap.svelte Decomposition
```
