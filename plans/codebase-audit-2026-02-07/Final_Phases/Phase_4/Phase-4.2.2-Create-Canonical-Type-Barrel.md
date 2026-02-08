# Phase 4.2.2: Create Canonical Type Barrel at src/lib/types/index.ts

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.7 (Organized Exports), MISRA Rule 8.2 (Type Compatibility)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                         |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                               |
| **Task ID**      | 4.2.2                                                                   |
| **Title**        | Create Canonical Type Barrel at `src/lib/types/index.ts`                |
| **Status**       | PLANNED                                                                 |
| **Risk Level**   | LOW (re-export only barrel, no logic)                                   |
| **Duration**     | 10 minutes                                                              |
| **Dependencies** | Phase-4.2.1 (Sweep-Manager Shared Types must exist)                     |
| **Blocks**       | None (downstream tasks import from canonical locations, not the barrel) |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                       |
| **Commit**       | `refactor: create canonical type barrel at src/lib/types/index.ts`      |

---

## Objective

Create `src/lib/types/index.ts` as the single import point for shared types consumed across multiple application layers. This barrel re-exports from canonical locations only -- it does NOT define new types.

---

## Current State Assessment

| Metric                                 | Value                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| Barrel file (`src/lib/types/index.ts`) | DOES NOT EXIST                                               |
| Files in `src/lib/types/`              | kismet.ts, signals.ts, gsm.ts, shared.ts, tools.ts, enums.ts |
| Current import pattern                 | Direct imports from individual type files                    |

---

## Scope

### What IS Re-exported

Types consumed by 2+ application layers (frontend + server, or store + component + API):

- Kismet domain types (KismetDevice, KismetAlert, KismetNetwork, KismetGPS, KismetStatus, KismetStore)
- Signal/RF types (SignalMarker, SignalStats, SignalCluster)
- GSM types (FrequencyTestResult)
- Hardware/SDR types (SweepManagerState, Device, DeviceRecord)
- Enums (SignalSource)
- Localization types (RSSIMeasurement, GeoBounds, GPRPrediction, SourceEstimate, CoralPrediction)
- Sweep-manager types (ProcessState, ProcessConfig, BufferState, BufferConfig, ParsedLine)
- Tool types (ToolDefinition, ToolStatus, ToolCategory, ToolHierarchy)

### What is NOT Re-exported

Types that are layer-specific and consumed only within their own domain:

- Server-only types (server/hackrf/types.ts, server/kismet/types.ts, server/db/types.ts)
- Store-internal types (store state interfaces used only within the store file)
- API service types (response DTOs used only within the API service class)
- Component-local types (props interfaces defined in .svelte files)
- Database schema types (server/database/schema.ts)
- Agent execution types (server/agent/tool-execution/types.ts)

---

## Execution Steps

### Step 1: Create `src/lib/types/index.ts`

Create the file with the following exact content:

```typescript
// src/lib/types/index.ts
// Canonical type barrel. All shared types re-exported from their authoritative sources.
// Domain-specific types that live in a single service should NOT be re-exported here.

// --- Kismet / WiFi ---
export type {
	KismetDevice,
	KismetAlert,
	KismetNetwork,
	KismetGPS,
	KismetStatus,
	KismetStore
} from './kismet';

// --- Signals / RF ---
export type { SignalMarker, SignalStats } from '../stores/map/signals';

export type { SignalCluster } from '../services/map/signalClustering';

// --- GSM ---
export type { FrequencyTestResult } from './gsm';

// --- Hardware / SDR ---
export type { SweepManagerState, Device, DeviceRecord } from './shared';

// --- Enums ---
export { SignalSource } from './enums';

// --- Localization ---
export type {
	RSSIMeasurement,
	GeoBounds,
	GPRPrediction,
	SourceEstimate,
	CoralPrediction
} from '../services/localization/types';

// --- Sweep Manager ---
export type {
	ProcessState,
	ProcessConfig,
	BufferState,
	BufferConfig,
	ParsedLine
} from '../services/sweep-manager/types';

// --- Tools ---
export type { ToolDefinition, ToolStatus, ToolCategory, ToolHierarchy } from './tools';
```

**IMPORTANT NOTES**:

1. `KismetStatus` is re-exported from `./kismet` which will (after Task 4.2.6) re-export from `$lib/server/kismet/types`. The barrel re-export chain is: `index.ts` -> `kismet.ts` -> `server/kismet/types.ts`.
2. `SignalSource` uses a value export (not `export type`) because enums are runtime values.
3. The `../stores/map/signals` and `../services/map/signalClustering` paths use relative traversal because `$lib/types/index.ts` is inside `src/lib/types/`.

---

## Verification

**Command 1 -- File exists**:

```bash
test -f src/lib/types/index.ts && echo "EXISTS" || echo "MISSING"
```

**Expected**: `EXISTS`

**Command 2 -- TypeScript compiles**:

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected**: 0 errors. The barrel is re-export only with no logic, so compilation validates all referenced source types exist.

**Command 3 -- All re-exports resolve**:

```bash
npx tsc --noEmit --listFiles 2>&1 | grep "types/index" | head -5
```

**Expected**: The file appears in the compiled file list without errors.

**Command 4 -- Barrel does not define new types**:

```bash
grep -c "^export interface\|^export type [A-Z].*=" src/lib/types/index.ts
```

**Expected**: 0 (the barrel only re-exports, never defines).

**Command 5 -- Correct export count**:

```bash
grep -c "export" src/lib/types/index.ts
```

**Expected**: ~10 (one `export type` or `export` statement per group, some with multiple names).

---

## Risk Assessment

| Risk                                | Likelihood | Impact | Mitigation                                                   |
| ----------------------------------- | ---------- | ------ | ------------------------------------------------------------ |
| Circular import via re-export chain | LOW        | MEDIUM | Barrel only re-exports; no circular dependency possible      |
| Missing source type (compile error) | LOW        | LOW    | `npx tsc --noEmit` immediately catches any missing reference |
| Import resolution failure           | LOW        | LOW    | Relative paths verified against directory structure          |

---

## Rollback Strategy

```bash
rm -f src/lib/types/index.ts
```

No other files are modified by this task. The barrel is additive only.

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "create canonical type barrel" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                   |
| ---------------- | -------------------------- | ----------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | Barrel provides single canonical import path    |
| NASA/JPL Rule 15 | Single Point of Definition | `$lib/types` becomes the standard import target |
| BARR-C Rule 1.7  | Organized Exports          | Types grouped by domain with section comments   |
| MISRA Rule 8.2   | Type Compatibility         | Re-exports enforce type identity across layers  |

---

## Cross-References

- **Depends on**: Phase-4.2.1 (Sweep-Manager Shared Types -- `sweep-manager/types.ts` must exist)
- **Blocks**: None directly (downstream tasks import from canonical locations, barrel is convenience)
- **Related**: Phase-4.2.3 through Phase-4.2.7 (may update barrel as types are renamed/consolidated)

---

## Execution Tracking

| Subtask | Description                            | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.2.1 | Create src/lib/types/index.ts          | PENDING | --      | --        | --          |
| 4.2.2.2 | TypeScript compilation verification    | PENDING | --      | --        | --          |
| 4.2.2.3 | Verify no new type definitions in file | PENDING | --      | --        | --          |
