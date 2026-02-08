# Phase 5.4.2 -- Tier 1: KismetDashboardOverlay.svelte Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.2-KISMET-DASHBOARD-OVERLAY
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.2 -- Decompose KismetDashboardOverlay.svelte (1,280 lines)
Risk Level:     MEDIUM
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 6 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Path            | `src/lib/components/map/KismetDashboardOverlay.svelte` |
| Current Lines   | 1,280                                                  |
| Tier            | 1 (>1,000 lines, unconditional)                        |
| Execution Order | 2 of 7 (second Tier 1 decomposition)                   |

---

## 2. Content Analysis

Complex Svelte component rendering Kismet device markers on a Leaflet map. Contains:

- Inline SVG icon generation for device types
- Popup content builders for device detail display
- Overlay control logic (filter toggles, layer management)
- Marker clustering via L.markerClusterGroup
- Device filtering by type/signal strength
- Map layer management

**Why It Exceeds Threshold:**
God component pattern. Rendering, data transformation, event handling, and UI state
management are all co-located in a single `.svelte` file.

---

## 3. Decomposition Strategy

Extract four subcomponents and one utility module. The parent component becomes an
orchestrator importing and composing the extracted pieces.

**Architecture after decomposition:**

```
KismetDashboardOverlay.svelte (orchestrator, ~200 lines)
  +-- DeviceTypeIcon.svelte (SVG icons, ~120 lines)
  +-- DevicePopupContent.svelte (popup HTML, ~180 lines)
  +-- OverlayControls.svelte (filter/toggle UI, ~150 lines)
  +-- DeviceMarkerLayer.svelte (marker CRUD + clustering, ~250 lines)
  +-- kismetOverlayUtils.ts (pure functions, ~120 lines)
```

---

## 4. New File Manifest

| New File                                              | Content                                                                                     | Est. Lines |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| `components/map/kismet/KismetDashboardOverlay.svelte` | Orchestrator (replaces original)                                                            | ~200       |
| `components/map/kismet/DeviceTypeIcon.svelte`         | SVG icon generation per device type                                                         | ~120       |
| `components/map/kismet/DevicePopupContent.svelte`     | Popup HTML for device details                                                               | ~180       |
| `components/map/kismet/OverlayControls.svelte`        | Filter/toggle controls for overlay                                                          | ~150       |
| `components/map/kismet/DeviceMarkerLayer.svelte`      | Marker creation, clustering, placement                                                      | ~250       |
| `components/map/kismet/kismetOverlayUtils.ts`         | Pure functions: signal strength color mapping, device classification, coordinate validation | ~120       |

**Total target files:** 6
**Maximum file size:** ~250 lines (DeviceMarkerLayer.svelte)
**Original file disposition:** Replaced by orchestrator at new path

---

## 5. Migration Steps

1. Create `src/lib/components/map/kismet/` directory.
2. Extract `DeviceTypeIcon.svelte` -- all SVG path generation for device type icons. Accept `deviceType: string` and `signalStrength: number` as props.
3. Extract `DevicePopupContent.svelte` -- the L.popup content builder. Accept full device object as prop.
4. Extract `OverlayControls.svelte` -- filter checkboxes, signal threshold slider, layer toggles. Emit `change` events to parent.
5. Extract `DeviceMarkerLayer.svelte` -- L.markerClusterGroup setup, marker creation loop, click handlers. Accept filtered device array as prop.
6. Extract pure utility functions (color mapping, classification) into `kismetOverlayUtils.ts`.
7. Rewrite parent as composition of the four subcomponents.
8. Update all import paths. The original path (`components/map/KismetDashboardOverlay.svelte`) must redirect via barrel or the parent file retains the original name at the new path.

**Import path resolution:** Since Svelte components cannot use barrel `index.ts` for component imports in the same way TypeScript modules can, the orchestrator file retains the name `KismetDashboardOverlay.svelte` at the new subdirectory path. All importers must update:

```
OLD: import KismetDashboardOverlay from '$lib/components/map/KismetDashboardOverlay.svelte';
NEW: import KismetDashboardOverlay from '$lib/components/map/kismet/KismetDashboardOverlay.svelte';
```

---

## 6. Component Interface Contracts

### DeviceTypeIcon.svelte

```typescript
// Props
export let deviceType: string;
export let signalStrength: number;
export let size: number = 24;
// Renders: <svg> element with device-specific icon path
```

### DevicePopupContent.svelte

```typescript
// Props
export let device: KismetDevice;
// Renders: Popup HTML for L.popup().setContent()
```

### OverlayControls.svelte

```typescript
// Props
export let activeFilters: FilterState;
// Events: dispatch('filterChange', { filters: FilterState })
```

### DeviceMarkerLayer.svelte

```typescript
// Props
export let devices: KismetDevice[];
export let map: L.Map;
// Side effect: manages L.markerClusterGroup on the provided map instance
```

---

## 7. Svelte-Specific Decomposition Constraints

1. **Props down, events up.** Extracted child components receive data as props and emit changes via `createEventDispatcher()` or callback props.
2. **Shared reactive state stays in the parent.** Do NOT create new stores for component-internal state.
3. **Context API preservation.** If the original component uses `setContext`/`getContext`, all children requiring the same context key MUST remain in the same component tree.
4. **Leaflet instance sharing.** The `L.Map` instance is passed as a prop from parent to children. Only the parent holds the map reference. Children operate on it but do not create or destroy it.

---

## 8. Verification Commands

```bash
# 1. No component exceeds 300 lines
wc -l src/lib/components/map/kismet/*.svelte src/lib/components/map/kismet/*.ts

# 2. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"
# Expected: 0

# 3. Original import path updated everywhere
grep -r "KismetDashboardOverlay" src/ --include="*.svelte" --include="*.ts" -l
# Verify all paths point to new location

# 4. Build succeeds
npm run build 2>&1 | tail -5

# 5. No circular dependencies
npx madge --circular src/lib/components/map/kismet/
```

---

## 9. Key Constraints and Caveats

1. **Leaflet dependency.** DeviceMarkerLayer directly manipulates L.markerClusterGroup. This is a DOM-side-effect component; it must be carefully tested for marker lifecycle (add/remove on device list change).
2. **SVG inline generation.** DeviceTypeIcon contains inline SVG paths. These are static data, not dynamic templates. Extraction is safe.
3. **Popup content binding.** Leaflet popups use `setContent(htmlString)`. DevicePopupContent must render to a string or DOM node that Leaflet can consume. Consider using Svelte's `$$render` or mounting the component to a detached DOM node.
4. **Performance.** The original component likely uses `$:` reactive blocks for device filtering. Ensure the parent's reactive filter logic feeds pre-filtered arrays to DeviceMarkerLayer rather than having DeviceMarkerLayer re-filter.

---

## 10. Commit Message

```
refactor: extract KismetDashboardOverlay subcomponents

- Extract DeviceTypeIcon: SVG icon generation per device type
- Extract DevicePopupContent: popup HTML for device details
- Extract OverlayControls: filter/toggle controls
- Extract DeviceMarkerLayer: marker creation, clustering, placement
- Extract kismetOverlayUtils.ts: pure utility functions
- Original 1,280-line file reduced to ~200-line orchestrator
- No logic changes, structural only
```

---

## 11. Standards Compliance

| Standard             | Compliance                                        |
| -------------------- | ------------------------------------------------- |
| Barr Group Rule 1.3  | All files <300 lines post-split                   |
| NASA/JPL Rule 2.4    | Functions extracted if >60 lines (utility module) |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                |
| CERT C MSC41         | No secrets in UI components                       |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.2 -- Tier 1: KismetDashboardOverlay.svelte Decomposition
```
