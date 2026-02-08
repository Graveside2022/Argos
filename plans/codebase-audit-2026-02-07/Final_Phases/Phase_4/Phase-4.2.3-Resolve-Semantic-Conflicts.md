# Phase 4.2.3: Resolve Semantic Type Conflicts via Renames

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 5.3 (Unique Identifiers)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                   |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                         |
| **Task ID**      | 4.2.3                                                             |
| **Title**        | Resolve Semantic Type Conflicts via Renames                       |
| **Status**       | PLANNED                                                           |
| **Risk Level**   | MEDIUM (renames affect import paths in multiple files)            |
| **Duration**     | 45 minutes                                                        |
| **Dependencies** | Phase-4.2.0 (Audit Divergent Fields), Phase-4.2.2 (Barrel exists) |
| **Blocks**       | Phase-4.2.4 through Phase-4.2.7 (duplicate replacement batches)   |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                 |
| **Commit**       | `refactor: resolve 9 semantic type conflicts via renames`         |

---

## Objective

Five type names in the Argos codebase refer to completely different entities. These cannot be merged -- they require renames. Additionally, 4 layer-specific types share names across layers and require disambiguation. This task resolves all 9 conflict cases.

---

## Current State Assessment

| Metric                  | Value                                         |
| ----------------------- | --------------------------------------------- |
| Semantic conflicts      | 5 (same name, completely different entity)    |
| Layer ambiguities       | 4 (same name, different layer representation) |
| Total renames           | 7 (2 conflicts resolved without rename)       |
| Files requiring updates | ~12                                           |

### Conflict Summary

| #   | Type Name          | Location A                                                       | Location B                                | Resolution          |
| --- | ------------------ | ---------------------------------------------------------------- | ----------------------------------------- | ------------------- |
| 1   | HardwareStatus     | `detection-types.ts:28` (string union)                           | `hardware/types.ts:28` (interface)        | Rename A            |
| 2   | DeviceInfo         | `stores/hackrf.ts:77` (HackRF hardware)                          | `dataAccessLayer.ts:32` (DB summary)      | Rename A            |
| 3   | ScanResult         | `types/gsm.ts:30` (event envelope)                               | `gsmEvilStore.ts:13` (frequency result)   | Rename A            |
| 4   | Device             | `types/shared.ts:18` (app model)                                 | `database/schema.ts:2` (DB row)           | No rename needed    |
| 5   | ToolDefinition     | `types/tools.ts:12` (UI navigation)                              | `agent/tool-execution/types.ts:38` (exec) | No rename needed    |
| 6   | SystemInfo         | `system.d.ts:62` / `systemStore.ts:3` / `api/system.ts:13`       | 3-way conflict                            | Rename store + API  |
| 7   | SystemHealth       | `connection.ts:14` (metrics)                                     | `api/system.ts:58` (status + checks)      | Rename A            |
| 8   | NetworkInterface   | `system.d.ts:35` / `api/system.ts:41` / `networkInterfaces.ts:4` | 3-way conflict                            | Rename server + API |
| 9   | KismetSystemStatus | `webSocketManager.ts:33` (non-exported)                          | `kismetProxy.ts:36` (non-exported)        | Export + import     |

---

## Execution Steps

### Conflict 1: HardwareStatus (string union vs interface)

**File**: `src/lib/server/hardware/detection-types.ts:28`

```typescript
// BEFORE:
export type HardwareStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

// AFTER:
export type HardwareConnectionState = 'connected' | 'disconnected' | 'error' | 'unknown';
```

**Impact analysis**:

```bash
grep -rn "HardwareStatus" --include="*.ts" src/lib/server/hardware/
```

Update all references in files that import `HardwareStatus` from `detection-types.ts` to use `HardwareConnectionState`.

The `src/lib/server/hardware/types.ts:28` `HardwareStatus` interface remains unchanged (it is the richer interface with resource state fields).

### Conflict 2: DeviceInfo (HackRF device vs DB summary)

**File**: `src/lib/stores/hackrf.ts:77`

```typescript
// BEFORE:
export interface DeviceInfo { serial: string; version: string; board_id: number; ... }

// AFTER:
export interface HackRFDeviceInfo { serial: string; version: string; board_id: number; ... }
```

**Impact analysis**:

```bash
grep -rn "DeviceInfo" --include="*.ts" --include="*.svelte" src/ | grep "stores/hackrf"
```

Update all importers of `DeviceInfo` from `stores/hackrf.ts` to `HackRFDeviceInfo`.

The `src/lib/services/db/dataAccessLayer.ts:32` `DeviceInfo` remains unchanged (DB context).

### Conflict 3: ScanResult (event envelope vs frequency measurement)

**File**: `src/lib/types/gsm.ts:30`

```typescript
// BEFORE:
export interface ScanResult { type: 'scan_complete' | 'frequency_result'; ... }

// AFTER:
export interface GSMScanEvent { type: 'scan_complete' | 'frequency_result'; ... }
```

**File**: `src/lib/stores/gsmEvilStore.ts:13` -- remains as `ScanResult` (it represents an individual frequency scan result, which is the intuitive meaning).

**Impact analysis**:

```bash
grep -rn "ScanResult" --include="*.ts" src/lib/types/gsm.ts
grep -rn "from.*types/gsm" --include="*.ts" src/
```

Update all importers of `ScanResult` from `types/gsm.ts` to `GSMScanEvent`.

### Conflict 4: Device (app model vs DB schema) -- NO RENAME

No rename needed. These correctly represent different layers:

- `src/lib/types/shared.ts:18` -- app domain model
- `src/lib/server/database/schema.ts:2` -- DB row shape (snake_case fields, `id: number`)

They live in separate import paths and are never confused. The `DeviceRecord` type alias in `shared.ts` (`type DeviceRecord = Device`) and `signalDatabase.ts` (`type DeviceRecord = SharedDeviceRecord`) both resolve to the same base `Device` from `shared.ts`. This is correct as-is.

**Verification only**:

```bash
grep -rn "from.*shared.*Device\|from.*schema.*Device" --include="*.ts" src/ | head -10
```

### Conflict 5: ToolDefinition (UI navigation vs agent execution) -- NO RENAME

No rename needed. Already handled by existing alias imports:

```typescript
// src/lib/server/agent/tool-execution/detection/detector.ts:13
import type { ToolDefinition as UIToolDef } from '$lib/types/tools';
```

Both definitions are consumed only within their own domains. The alias pattern prevents any confusion.

**Verification only**:

```bash
grep -rn "ToolDefinition" --include="*.ts" src/ | head -10
```

### Conflict 6: SystemInfo (3 copies, 3 layers)

**File**: `src/lib/stores/tactical-map/systemStore.ts:3`

```typescript
// BEFORE:
export interface SystemInfo { hostname: string; ip: string; wifiInterfaces: ... }

// AFTER:
export interface SystemStoreState { hostname: string; ip: string; wifiInterfaces: ... }
```

**File**: `src/lib/services/api/system.ts:13`

```typescript
// BEFORE:
export interface SystemInfo { hostname: string; platform: string; ... }

// AFTER:
export interface SystemInfoResponse { hostname: string; platform: string; ... }
```

`src/types/system.d.ts:62` remains as the canonical `SystemInfo`.

**Impact analysis**:

```bash
grep -rn "SystemInfo" --include="*.ts" --include="*.svelte" src/lib/stores/tactical-map/
grep -rn "SystemInfo" --include="*.ts" src/lib/services/api/system.ts
```

Update all internal references in `systemStore.ts` from `SystemInfo` to `SystemStoreState`.
Update all internal references in `api/system.ts` from `SystemInfo` to `SystemInfoResponse`.

### Conflict 7: SystemHealth (2 copies, different shapes)

**File**: `src/lib/stores/connection.ts:14`

```typescript
// BEFORE:
export interface SystemHealth { cpu: number; memory: number; disk: number; ... }

// AFTER:
export interface SystemHealthMetrics { cpu: number; memory: number; disk: number; ... }
```

`src/lib/services/api/system.ts:58` remains as `SystemHealth` (richer shape with status and checks).

**Impact analysis**:

```bash
grep -rn "SystemHealth" --include="*.ts" --include="*.svelte" src/lib/stores/connection.ts
grep -rn "from.*stores/connection.*SystemHealth" --include="*.ts" --include="*.svelte" src/
```

Update all importers of `SystemHealth` from `stores/connection.ts` to `SystemHealthMetrics`.

### Conflict 8: NetworkInterface (3 copies)

**File**: `src/lib/server/networkInterfaces.ts:4`

```typescript
// BEFORE:
export interface NetworkInterface { name: string; addresses: string[]; isUp: boolean; isWireless: boolean; ... }

// AFTER:
export interface MonitorableInterface { name: string; addresses: string[]; isUp: boolean; isWireless: boolean; ... }
```

**File**: `src/lib/services/api/system.ts:41`

```typescript
// BEFORE:
export interface NetworkInterface { ... }

// AFTER:
export interface NetworkInterfaceDTO { ... }
```

`src/types/system.d.ts:35` remains as canonical `NetworkInterface`.

**Impact analysis**:

```bash
grep -rn "NetworkInterface" --include="*.ts" src/lib/server/networkInterfaces.ts
grep -rn "from.*networkInterfaces" --include="*.ts" src/
grep -rn "NetworkInterface" --include="*.ts" src/lib/services/api/system.ts
```

Update all importers from `networkInterfaces.ts` to use `MonitorableInterface`.
Update all internal references in `api/system.ts` from `NetworkInterface` to `NetworkInterfaceDTO`.

### Conflict 9: KismetSystemStatus (non-exported, 2 copies)

**File**: `src/lib/server/kismet/webSocketManager.ts:33`

```typescript
// BEFORE:
interface KismetSystemStatus {
	// typed Kismet API fields
}

// AFTER:
export interface KismetSystemStatus {
	// typed Kismet API fields (unchanged)
}
```

Change `interface` to `export interface`.

**File**: `src/lib/server/kismet/kismetProxy.ts:36`

```typescript
// BEFORE:
interface KismetSystemStatus {
	[key: string]: unknown;
}

// AFTER (delete local definition, add import):
import type { KismetSystemStatus } from './webSocketManager';
```

Delete the local definition (overly broad `Record<string, unknown>` type). Replace with import of the typed version from `webSocketManager.ts`.

---

## Verification

**Command 1 -- TypeScript compiles**:

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected**: 0 compilation errors.

**Command 2 -- All renames applied**:

```bash
grep -rn "HardwareConnectionState" --include="*.ts" src/ | wc -l
grep -rn "HackRFDeviceInfo" --include="*.ts" --include="*.svelte" src/ | wc -l
grep -rn "GSMScanEvent" --include="*.ts" src/ | wc -l
grep -rn "SystemStoreState" --include="*.ts" src/ | wc -l
grep -rn "SystemInfoResponse" --include="*.ts" src/ | wc -l
grep -rn "SystemHealthMetrics" --include="*.ts" --include="*.svelte" src/ | wc -l
grep -rn "MonitorableInterface" --include="*.ts" src/ | wc -l
grep -rn "NetworkInterfaceDTO" --include="*.ts" src/ | wc -l
```

**Expected**: Each returns >= 1 (definition + usage sites).

**Command 3 -- No remaining duplicates at original locations**:

```bash
grep -n "^interface KismetSystemStatus" src/lib/server/kismet/kismetProxy.ts
```

**Expected**: 0 results (local definition deleted, replaced with import).

**Command 4 -- Export added to webSocketManager**:

```bash
grep -n "export interface KismetSystemStatus" src/lib/server/kismet/webSocketManager.ts
```

**Expected**: 1 result.

---

## Risk Assessment

| Risk                                      | Likelihood | Impact | Mitigation                                                         |
| ----------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| Rename misses a consumer file             | MEDIUM     | LOW    | `npx tsc --noEmit` catches any broken imports at compile time      |
| Svelte component references broken        | LOW        | LOW    | Grep includes `--include="*.svelte"` in impact analysis            |
| KismetSystemStatus export creates new API | LOW        | LOW    | Only exported within `server/kismet/` directory; internal use only |
| SystemInfo ambient type shadowed          | LOW        | MEDIUM | Store/API copies renamed; ambient `system.d.ts` remains canonical  |

### Medium Risk Areas

1. **SystemInfo renames**: The store and API versions are used only within their own files (0 external importers each), so renaming is safe. However, verify no template references use the type name.

2. **NetworkInterface renames**: The `MonitorableInterface` rename in `networkInterfaces.ts` affects all files that import from that module. Run the impact grep before executing.

3. **KismetSystemStatus export**: Exporting a previously non-exported interface from `webSocketManager.ts` creates a new public API surface. This is intentional and limited to the `server/kismet/` internal module boundary.

---

## Rollback Strategy

### Per-conflict rollback

For any single rename that causes issues:

1. Restore the original type name in the definition file
2. Revert all importer updates for that specific type
3. Run `npx tsc --noEmit` to verify

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "resolve 9 semantic type conflicts" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                         |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | Each type name now refers to exactly one entity       |
| MISRA Rule 5.3   | Unique Identifiers         | Semantic conflicts eliminated via descriptive renames |
| NASA/JPL Rule 15 | Single Point of Definition | Non-exported duplicate consolidated via export+import |
| BARR-C Rule 1.3  | No Duplicate Definitions   | 9 conflict cases resolved                             |

---

## Cross-References

- **Depends on**: Phase-4.2.0 (Audit Divergent Fields), Phase-4.2.2 (Barrel exists)
- **Blocks**: Phase-4.2.4 through Phase-4.2.7 (duplicate replacement requires conflict-free names)
- **Related**: Phase-4.2.5 (SpectrumData renames in Batch 2), Phase-4.2.7 (SweepStatus rename in Batch 4)

---

## Execution Tracking

| Subtask  | Description                                                                  | Status  | Started | Completed | Verified By |
| -------- | ---------------------------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.3.1  | Rename HardwareStatus -> HardwareConnectionState                             | PENDING | --      | --        | --          |
| 4.2.3.2  | Rename DeviceInfo -> HackRFDeviceInfo                                        | PENDING | --      | --        | --          |
| 4.2.3.3  | Rename ScanResult -> GSMScanEvent                                            | PENDING | --      | --        | --          |
| 4.2.3.4  | Verify Device (no rename needed)                                             | PENDING | --      | --        | --          |
| 4.2.3.5  | Verify ToolDefinition (no rename needed)                                     | PENDING | --      | --        | --          |
| 4.2.3.6  | Rename SystemInfo copies -> SystemStoreState / SystemInfoResponse            | PENDING | --      | --        | --          |
| 4.2.3.7  | Rename SystemHealth -> SystemHealthMetrics                                   | PENDING | --      | --        | --          |
| 4.2.3.8  | Rename NetworkInterface copies -> MonitorableInterface / NetworkInterfaceDTO | PENDING | --      | --        | --          |
| 4.2.3.9  | Export+import KismetSystemStatus                                             | PENDING | --      | --        | --          |
| 4.2.3.10 | TypeScript compilation verification                                          | PENDING | --      | --        | --          |
