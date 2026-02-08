# Phase 5.4.5 -- Tier 1: AirSignalOverlay.svelte Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.5-AIR-SIGNAL-OVERLAY
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.5 -- Decompose AirSignalOverlay.svelte (1,019 lines)
Risk Level:     MEDIUM
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 5 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                                            |
| --------------- | ------------------------------------------------ |
| Path            | `src/lib/components/map/AirSignalOverlay.svelte` |
| Current Lines   | 1,019                                            |
| Tier            | 1 (>1,000 lines, unconditional)                  |
| Execution Order | 5 of 7 (fifth Tier 1 decomposition)              |

---

## 2. Content Analysis

Renders RF signal detections as overlay markers on the tactical map. Contains:

- Signal processing logic (frequency binning, power level normalization)
- Detection classification (radar, comms, jamming threat types)
- Leaflet rendering with custom icons (color-coded by threat level)
- Popup content builders for signal detail display
- Overlay lifecycle management (add/remove markers on data change)

**Why It Exceeds Threshold:**
Domain logic (RF detection, classification) and presentation (Leaflet overlay) are
tightly coupled. Signal processing math (frequency binning, power normalization) is
interleaved with UI rendering code.

---

## 3. Decomposition Strategy

Separate domain logic (RF detection, classification) from presentation (Leaflet overlay).
The processing pipeline becomes a standalone TypeScript service; the renderer becomes a
thin Svelte component.

**Architecture after decomposition:**

```
AirSignalOverlay.svelte (orchestrator, ~180 lines)
  +-- RFDetectionService.ts (classification + threat, ~200 lines)
  +-- SpectrumProcessor.ts (frequency math, ~200 lines)
  +-- SignalOverlayRenderer.ts (Leaflet markers, ~220 lines)
  +-- airSignalTypes.ts (type definitions, ~60 lines)
```

---

## 4. New File Manifest

| New File                                             | Content                                                  | Est. Lines |
| ---------------------------------------------------- | -------------------------------------------------------- | ---------- |
| `components/map/air-signal/AirSignalOverlay.svelte`  | Orchestrator, binds service to map                       | ~180       |
| `components/map/air-signal/RFDetectionService.ts`    | Detection classification, threat assessment              | ~200       |
| `components/map/air-signal/SpectrumProcessor.ts`     | Frequency binning, power normalization, averaging        | ~200       |
| `components/map/air-signal/SignalOverlayRenderer.ts` | Leaflet marker creation, icon factories, popup builders  | ~220       |
| `components/map/air-signal/airSignalTypes.ts`        | DetectionResult, SignalClassification, ThreatLevel types | ~60        |

**Total target files:** 5
**Maximum file size:** ~220 lines (SignalOverlayRenderer.ts)
**Original file disposition:** Replaced by orchestrator at new subdirectory path

---

## 5. Module Interfaces

### airSignalTypes.ts (dependency root, imports nothing from siblings)

```typescript
export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SignalClassification {
	type: 'radar' | 'comms' | 'jamming' | 'beacon' | 'unknown';
	confidence: number; // 0-1
	threatLevel: ThreatLevel;
}

export interface DetectionResult {
	id: string;
	frequency: number;
	power: number;
	classification: SignalClassification;
	latitude: number;
	longitude: number;
	timestamp: number;
}
```

### SpectrumProcessor.ts

```typescript
import type { DetectionResult } from './airSignalTypes';

export function binFrequencies(signals: RawSignal[], binWidthHz: number): FrequencyBin[];
export function normalizePower(samples: number[]): number[];
export function averageOverWindow(bins: FrequencyBin[], windowMs: number): FrequencyBin[];
```

### RFDetectionService.ts

```typescript
import type { DetectionResult, SignalClassification } from './airSignalTypes';

export function classifySignal(
	frequency: number,
	power: number,
	bandwidth: number
): SignalClassification;
export function assessThreat(classification: SignalClassification, proximity: number): ThreatLevel;
export function processDetections(rawSignals: RawSignal[]): DetectionResult[];
```

### SignalOverlayRenderer.ts

```typescript
import type { DetectionResult } from './airSignalTypes';

export class SignalOverlayRenderer {
	constructor(map: L.Map);
	render(detections: DetectionResult[]): void;
	clear(): void;
	destroy(): void;
}
```

---

## 6. Migration Steps

1. Create `src/lib/components/map/air-signal/` directory.
2. Create `airSignalTypes.ts` with all type/interface definitions extracted from the original file. This file imports NOTHING from siblings (dependency DAG root).
3. Extract `SpectrumProcessor.ts` -- all frequency binning, power normalization, and averaging math. Pure functions, no Leaflet dependency.
4. Extract `RFDetectionService.ts` -- signal classification heuristics, threat level assessment. Pure functions, no Leaflet dependency.
5. Extract `SignalOverlayRenderer.ts` -- Leaflet marker creation, custom icon factories, popup content builders. Receives `L.Map` instance and `DetectionResult[]`.
6. Rewrite `AirSignalOverlay.svelte` as orchestrator:
    - Subscribes to signal data stores
    - Pipes raw signals through `SpectrumProcessor` -> `RFDetectionService`
    - Feeds `DetectionResult[]` into `SignalOverlayRenderer`
    - Manages renderer lifecycle (create on mount, destroy on unmount)
7. Update all importers.
8. Verify compilation and build.
9. Commit.

---

## 7. Verification Commands

```bash
# 1. All files within size limits
wc -l src/lib/components/map/air-signal/*.svelte src/lib/components/map/air-signal/*.ts

# 2. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"

# 3. Build succeeds
npm run build 2>&1 | tail -5

# 4. Original import path updated everywhere
grep -r "AirSignalOverlay" src/ --include="*.svelte" --include="*.ts" -l

# 5. No circular dependencies
npx madge --circular src/lib/components/map/air-signal/
```

---

## 8. Key Constraints and Caveats

1. **Pure function extraction.** `SpectrumProcessor` and `RFDetectionService` contain zero Leaflet or DOM dependencies. They are pure computational modules, making them independently testable.
2. **Military classification logic.** The signal classification heuristics in `RFDetectionService` may contain EW-specific frequency band definitions. These are static lookup data, not secrets, but should be reviewed for sensitivity before committing.
3. **Leaflet instance ownership.** The orchestrator owns the `L.Map` reference and passes it to `SignalOverlayRenderer`. The renderer does NOT call `map.remove()` or modify the map's base layers.
4. **Performance.** Frequency binning and normalization may run on every WebSocket update. Ensure the orchestrator debounces or throttles updates to prevent excessive reprocessing.

---

## 9. Commit Message

```
refactor: extract RF detection and rendering services

- Extract RFDetectionService.ts: signal classification and threat assessment
- Extract SpectrumProcessor.ts: frequency binning and power normalization
- Extract SignalOverlayRenderer.ts: Leaflet marker creation and popup builders
- Extract airSignalTypes.ts: shared type definitions
- Original 1,019-line component reduced to ~180-line orchestrator
- Pure functions separated from rendering for independent testability
- No logic changes, structural only
```

---

## 10. Standards Compliance

| Standard             | Compliance                                                 |
| -------------------- | ---------------------------------------------------------- |
| Barr Group Rule 1.3  | All files <250 lines post-split                            |
| NASA/JPL Rule 2.4    | Processing functions extracted as pure, testable modules   |
| CERT C MEM00         | Renderer allocation/cleanup in same orchestrator lifecycle |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                         |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.5 -- Tier 1: AirSignalOverlay.svelte Decomposition
```
