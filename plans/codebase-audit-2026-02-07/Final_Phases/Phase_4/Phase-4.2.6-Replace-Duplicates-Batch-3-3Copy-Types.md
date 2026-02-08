# Phase 4.2.6: Replace Duplicates Batch 3 -- 3-Copy Types

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 8.2 (Type Compatibility)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                                                          |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                                                                |
| **Task ID**      | 4.2.6                                                                                                    |
| **Title**        | Replace Duplicates Batch 3 -- 3-Copy Types (ServiceStatus, KismetStatus, CoralPrediction, NetworkPacket) |
| **Status**       | PLANNED                                                                                                  |
| **Risk Level**   | MEDIUM (ServiceStatus shape difference requires rename, not merge)                                       |
| **Duration**     | 30 minutes                                                                                               |
| **Dependencies** | Phase-4.2.3 (Semantic conflicts resolved)                                                                |
| **Blocks**       | None (batches are independently compilable)                                                              |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                                                        |
| **Commit**       | `refactor: deduplicate 3-copy types (ServiceStatus, KismetStatus, CoralPrediction, NetworkPacket)`       |

---

## Objective

Consolidate 4 types that each have 3 copies in the codebase. For each: designate a canonical copy, delete or rename the non-canonical copies, and update all importers.

---

## Current State Assessment

| Type            | Copies | Canonical                                   | Action                   |
| --------------- | ------ | ------------------------------------------- | ------------------------ |
| ServiceStatus   | 3      | `src/types/system.d.ts:90`                  | Rename 1, delete 1       |
| KismetStatus    | 3      | `src/lib/server/kismet/types.ts:148`        | Delete 2, re-export 1    |
| CoralPrediction | 3      | `src/lib/services/localization/types.ts:39` | Delete 2 (1 dead in 4.1) |
| NetworkPacket   | 3      | `src/lib/server/wireshark.ts:4` (base)      | Delete 1, keep extension |

---

## Execution Steps

### Type 1: ServiceStatus (3 copies)

**Canonical**: `src/types/system.d.ts:90` (ambient declaration, superset with typed status union and error field)

#### Step 1a: Rename in `src/lib/stores/connection.ts`

**File**: `src/lib/stores/connection.ts:22`

```typescript
// BEFORE:
export interface ServiceStatus { running: boolean; ... }

// AFTER:
export interface ServiceConnectionState { running: boolean; ... }
```

The `stores/connection.ts:22` version uses `running: boolean` instead of the status union -- this is a genuinely different shape. Rename to `ServiceConnectionState` to distinguish.

**Importer analysis**: Internal to connection store only. Update all references within `connection.ts` from `ServiceStatus` to `ServiceConnectionState`.

#### Step 1b: Delete from `src/lib/services/api/system.ts`

**File**: `src/lib/services/api/system.ts:49`

Delete the `ServiceStatus` interface definition. Replace with the ambient type from `system.d.ts`.

**Note**: `system.d.ts` is an ambient declaration file -- types are globally available. No import needed; just delete the local definition.

**Importer analysis**: 0 importers of `ServiceStatus` from this file.

#### Step 1c: Verification

```bash
grep -rn "export.*interface ServiceStatus" --include="*.ts" src/
# Expected: 0 results (system.d.ts is ambient, not "export interface")
grep -rn "interface ServiceStatus" src/types/system.d.ts
# Expected: 1 result (the ambient declaration)
grep -rn "ServiceConnectionState" --include="*.ts" src/
# Expected: >= 1 (definition + usage in connection store)
```

---

### Type 2: KismetStatus (3 copies)

**Canonical**: `src/lib/server/kismet/types.ts:148` (superset with interface, channels, metrics, config)

#### Step 2a: Delete from `src/lib/types/kismet.ts` and re-export

**File**: `src/lib/types/kismet.ts:52`

Delete lines 52-55 (the `KismetStatus` interface definition).

Add import and re-export:

```typescript
import type { KismetStatus } from '$lib/server/kismet/types';
export type { KismetStatus };
```

**Rationale**: The barrel re-export maintains backward compatibility. Files that import `KismetStatus` from `$lib/types/kismet` continue to work without modification.

**Importer analysis**: Check `stores/kismet.ts:9` and other files that import `KismetStatus` from `types/kismet`.

```bash
grep -rn "from.*types/kismet.*KismetStatus\|KismetStatus.*from.*types/kismet" --include="*.ts" --include="*.svelte" src/
```

#### Step 2b: Delete from `src/lib/services/api/kismet.ts`

**File**: `src/lib/services/api/kismet.ts:16`

Delete lines 16-23 (the `KismetStatus` interface definition).

Add import:

```typescript
import type { KismetStatus } from '$lib/server/kismet/types';
```

**Importer analysis**: 0 importers of `KismetStatus` from this file.

#### Step 2c: Verification

```bash
grep -rn "export.*interface KismetStatus" --include="*.ts" src/
# Expected: 1 result in server/kismet/types.ts
npx tsc --noEmit 2>&1 | grep -i "kismetstatus" | head -5
# Expected: 0 errors
```

---

### Type 3: CoralPrediction (3 copies, 1 dead after Phase 4.1)

**Canonical**: `src/lib/services/localization/types.ts:39` (shared types file for localization domain)

**NOTE**: `CoralAccelerator.v2.ts:9` is deleted in Phase 4.1 (dead code). If Phase 4.1 has already executed, only 2 copies remain. If not, delete the definition from `CoralAccelerator.v2.ts` as well.

#### Step 3a: Delete from `src/lib/services/localization/coral/CoralAccelerator.ts`

**File**: `src/lib/services/localization/coral/CoralAccelerator.ts:12`

Delete lines 12-16 (the `CoralPrediction` interface definition).

Add import:

```typescript
import type { CoralPrediction } from '../types';
```

#### Step 3b: Delete from `src/lib/services/localization/coral/CoralAccelerator.v2.ts` (if still exists)

**File**: `src/lib/services/localization/coral/CoralAccelerator.v2.ts:9`

Delete lines 9-13 (the `CoralPrediction` interface definition).

Add import:

```typescript
import type { CoralPrediction } from '../types';
```

**Note**: Skip this step if `CoralAccelerator.v2.ts` was already deleted by Phase 4.1 dead code elimination.

#### Step 3c: Verification

```bash
grep -rn "export.*interface CoralPrediction" --include="*.ts" src/
# Expected: 1 result in services/localization/types.ts
```

---

### Type 4: NetworkPacket (3 copies -- extension chain)

**Canonical**: `src/lib/server/wireshark.ts:4` (base type)

The `packetAnalysisStore.ts:5` version already correctly extends `BaseNetworkPacket` from wireshark.ts:

```typescript
import type { NetworkPacket as BaseNetworkPacket } from '$lib/server/wireshark';
export interface NetworkPacket extends BaseNetworkPacket {
	data?: string;
}
```

This is correct as-is and should be KEPT.

#### Step 4a: Delete from `src/lib/server/kismet/types.ts`

**File**: `src/lib/server/kismet/types.ts:222`

Delete lines 222-232 (the `NetworkPacket` interface).

This copy uses `sourceIP/destIP` instead of `src_ip/dst_ip` and has `hostname/suspicious` fields not in the base.

**Pre-deletion check**: Verify no internal references within `kismet/types.ts`:

```bash
grep -n "NetworkPacket" src/lib/server/kismet/types.ts
```

If the type is referenced elsewhere in the same file (e.g., in another interface), rename to `KismetPacket` instead of deleting, and update those internal references.

If no internal references: delete entirely.

**Importer analysis**: 0 direct importers of `NetworkPacket` from `server/kismet/types.ts`.

#### Step 4b: Keep `src/lib/stores/packetAnalysisStore.ts`

**File**: `src/lib/stores/packetAnalysisStore.ts:5` -- NO CHANGE.

Already correctly extends `BaseNetworkPacket` from wireshark.ts. This is the extension pattern, not a duplicate.

#### Step 4c: Verification

```bash
grep -rn "export.*interface NetworkPacket" --include="*.ts" src/
# Expected: 2 results -- wireshark.ts (base) and packetAnalysisStore.ts (extension)
npx tsc --noEmit 2>&1 | grep -i "networkpacket" | head -5
# Expected: 0 errors
```

---

## Final Verification

**Command 1 -- Full compilation**:

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Expected**: 0 errors.

**Command 2 -- Definition counts for all 4 types**:

```bash
for type in ServiceStatus KismetStatus CoralPrediction NetworkPacket; do
  count=$(grep -rn "export.*interface ${type} \|export.*interface ${type}{" --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions"
done
```

**Expected**: ServiceStatus=0 (ambient in .d.ts), KismetStatus=1, CoralPrediction=1, NetworkPacket=2 (base + extension).

**Command 3 -- Re-export chain intact**:

```bash
grep "KismetStatus" src/lib/types/kismet.ts
```

**Expected**: Shows `import type` and `export type` for KismetStatus (re-export from server/kismet/types.ts).

---

## Risk Assessment

| Risk                                                   | Likelihood | Impact | Mitigation                                                    |
| ------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------- |
| ServiceStatus shape difference breaks connection store | LOW        | LOW    | Renamed to `ServiceConnectionState`, not merged               |
| KismetStatus re-export breaks barrel chain             | LOW        | MEDIUM | Re-export in types/kismet.ts maintains backward compatibility |
| CoralAccelerator.v2.ts already deleted                 | MEDIUM     | NONE   | Step 3b is conditional; skip if file absent                   |
| NetworkPacket internal refs in kismet/types.ts         | LOW        | LOW    | Pre-deletion grep check; rename to KismetPacket if referenced |

### Medium Risk: ServiceStatus shape difference

The canonical (`system.d.ts`) uses `status: 'running'|'stopped'|'error'|'unknown'` while `stores/connection.ts` uses `running: boolean`. The rename to `ServiceConnectionState` avoids forcing a field change on the connection store. This is the correct resolution -- these are genuinely different shapes serving different purposes.

---

## Rollback Strategy

### Per-type rollback

For any single type that causes issues:

1. Restore the deleted definition in the non-canonical file
2. Remove the added import/re-export line
3. Run `npx tsc --noEmit` to verify

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "deduplicate 3-copy types" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                          |
| ---------------- | -------------------------- | ------------------------------------------------------ |
| CERT DCL60-CPP   | Obey One-Definition Rule   | Each type consolidated to 1 canonical definition       |
| NASA/JPL Rule 15 | Single Point of Definition | Canonical locations designated for all 4 types         |
| BARR-C Rule 1.3  | No Duplicate Definitions   | 6 duplicate definitions removed (2+2+2 across 4 types) |
| MISRA Rule 8.2   | Type Compatibility         | Shape differences handled via rename, not forced merge |

---

## Cross-References

- **Depends on**: Phase-4.2.3 (Semantic Conflicts Resolved)
- **Depends on**: Phase 4.1 (Dead Code Elimination -- CoralAccelerator.v2.ts may be deleted)
- **Blocks**: None (batches are independently compilable)
- **Related**: Phase-4.2.4 (Batch 1 -- KismetDevice), Phase-4.2.5 (Batch 2 -- SpectrumData), Phase-4.2.7 (Batch 4 -- 2-copy types)

---

## Execution Tracking

| Subtask | Description                                                     | Status  | Started | Completed | Verified By |
| ------- | --------------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.6.1 | Rename ServiceStatus -> ServiceConnectionState in connection.ts | PENDING | --      | --        | --          |
| 4.2.6.2 | Delete ServiceStatus from api/system.ts                         | PENDING | --      | --        | --          |
| 4.2.6.3 | Delete KismetStatus from types/kismet.ts + add re-export        | PENDING | --      | --        | --          |
| 4.2.6.4 | Delete KismetStatus from api/kismet.ts + add import             | PENDING | --      | --        | --          |
| 4.2.6.5 | Delete CoralPrediction from CoralAccelerator.ts + add import    | PENDING | --      | --        | --          |
| 4.2.6.6 | Delete CoralPrediction from CoralAccelerator.v2.ts (if exists)  | PENDING | --      | --        | --          |
| 4.2.6.7 | Delete NetworkPacket from server/kismet/types.ts                | PENDING | --      | --        | --          |
| 4.2.6.8 | TypeScript compilation verification                             | PENDING | --      | --        | --          |
