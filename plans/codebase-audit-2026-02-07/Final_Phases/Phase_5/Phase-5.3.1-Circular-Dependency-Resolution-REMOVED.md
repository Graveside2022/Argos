# Phase 5.3.1: Circular Dependency Resolution -- REMOVED

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 15 (no circular dependencies)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.1
**Status**: **REMOVED FROM EXECUTION PLAN**
**Risk Level**: N/A -- task will not be executed
**Prerequisites**: N/A
**Blocks**: Nothing (removed)
**Estimated Files Touched**: 0
**Standards**: NASA/JPL Rule 15

---

## Objective

This document preserves the full audit trail for Task 5.3.1, which was REMOVED from the execution plan during the regrade correction process on 2026-02-08. The task is not executed. This file exists solely for traceability and audit compliance.

---

## Removal Decision

> **REGRADE CORRECTION (2026-02-08)**: This task has been **removed** from the execution plan.
>
> **Reason**: The only detected "circular dependency" between `heatmapService.ts` and
> `webglHeatmapRenderer.ts` is a **pure `import type` cycle**. TypeScript's `import type`
> is erased at compile time -- it generates zero JavaScript output and creates no runtime
> circular dependency. The `madge --circular` tool flags it because it operates on static
> import graph analysis without distinguishing type-only imports from runtime imports.
>
> **Verification**: `npx madge --circular --extensions ts src/` reports 1 cycle, but
> inspecting the cycle reveals line 5 of `webglHeatmapRenderer.ts` uses `import type`,
> which is compile-time only. There is **0 runtime circular dependency**.
>
> **Standards compliance**: While NASA/JPL Rule 15 prohibits circular `#include`
> dependencies, TypeScript `import type` is NOT analogous to C `#include` -- it is a
> compile-time type annotation with no runtime effect. The existing code is correct.
>
> **Impact**: Removing this task reduces Phase 5.3 effort by ~1 hour. The type extraction
> described in the original fix (moving `HeatmapLayer` to `types/map.ts`) will still occur
> as a natural side effect of Task 5.3.2 (type-only import migration), which already
> creates `types/map.ts` for other type consolidation work.
>
> The original task content is preserved below for audit trail purposes.

---

## Original Task Content (Preserved for Audit Trail)

### Identified Cycle

Total circular dependency cycles detected: **1**

```
src/lib/services/map/heatmapService.ts
    line 8: import { WebGLHeatmapRenderer } from './webglHeatmapRenderer'   [RUNTIME]
        |
        v
src/lib/services/map/webglHeatmapRenderer.ts
    line 5: import type { HeatmapLayer } from './heatmapService'            [TYPE-ONLY]
        |
        +--- (cycle back to heatmapService.ts)
```

**Severity**: LOW. The `import type` on line 5 of `webglHeatmapRenderer.ts` is erased at
compile time by TypeScript. There is no runtime circular dependency. However, this pattern
violates NASA/JPL Rule 15 ("no circular #include dependencies") and confuses static analysis
tools including `madge`, `dependency-cruiser`, and IDE refactoring operations.

### Root Cause

The `HeatmapLayer` interface is defined in `heatmapService.ts` (a service file) but is
consumed as a type by `webglHeatmapRenderer.ts` (a peer service). The interface describes
a data structure, not service behavior, and therefore belongs in a shared types module.

### Original Proposed Code (BEFORE)

**File: `src/lib/services/map/heatmapService.ts`** (lines 32-40):

```typescript
export interface HeatmapLayer {
	id: string;
	name: string;
	altitudeRange: [number, number]; // [min, max] in meters
	points: HeatmapPoint[];
	visible: boolean;
	opacity: number;
	config: HeatmapConfig;
}
```

**File: `src/lib/services/map/webglHeatmapRenderer.ts`** (line 5):

```typescript
import type { HeatmapLayer } from './heatmapService';
```

### Original Proposed Fix (AFTER) -- NOT EXECUTED

**Step A**: Create or extend `src/lib/types/map.ts`:

```typescript
// src/lib/types/map.ts
// Shared map-related type definitions extracted from service modules.
// Eliminates circular dependency: heatmapService <-> webglHeatmapRenderer.

import type { HeatmapConfig, HeatmapPoint } from '$lib/services/map/heatmapService';

export interface HeatmapLayer {
	id: string;
	name: string;
	altitudeRange: [number, number];
	points: HeatmapPoint[];
	visible: boolean;
	opacity: number;
	config: HeatmapConfig;
}
```

Note: If `HeatmapConfig` and `HeatmapPoint` are also consumed by other modules (they are --
`HeatmapPoint` is imported by `kismetRSSIService.ts`), move them to `types/map.ts` as well
to eliminate all cross-service type imports from this cluster.

**Step B**: Update `heatmapService.ts`:

```typescript
// REMOVE: export interface HeatmapLayer { ... }
// ADD:
export type { HeatmapLayer } from '$lib/types/map';
// This re-export preserves backward compatibility for all existing consumers.
```

**Step C**: Update `webglHeatmapRenderer.ts`:

```typescript
// BEFORE:
import type { HeatmapLayer } from './heatmapService';
// AFTER:
import type { HeatmapLayer } from '$lib/types/map';
```

### Original Verification Commands -- NOT EXECUTED

```bash
# Verify zero circular dependencies
npx madge --circular --extensions ts src/

# Verify no remaining import of HeatmapLayer from heatmapService in peer services
grep -rn "from.*heatmapService.*import.*HeatmapLayer" src/lib/services/ \
  | grep -v "heatmapService.ts" \
  | grep -v "re-export"
# Expected: 0 results

# TypeScript compilation
npx tsc --noEmit
```

---

## Disposition

| Item                                           | Status                                 |
| ---------------------------------------------- | -------------------------------------- |
| Task execution                                 | CANCELLED                              |
| Type extraction (HeatmapLayer to types/map.ts) | Absorbed by Task 5.3.2                 |
| madge cycle warning                            | Accepted as false positive (type-only) |
| Audit trail                                    | Complete (this document)               |

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: NASA/JPL Rule 15_
_Classification: UNCLASSIFIED // FOUO_
