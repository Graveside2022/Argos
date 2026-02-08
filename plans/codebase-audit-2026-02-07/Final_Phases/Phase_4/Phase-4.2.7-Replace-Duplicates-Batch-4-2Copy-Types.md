# Phase 4.2.7: Replace Duplicates Batch 4 -- 2-Copy Types (16 Types Consolidated)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 8.2 (Type Compatibility), MISRA Rule 5.3 (Unique Identifiers)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                    |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                          |
| **Task ID**      | 4.2.7                                                              |
| **Title**        | Replace Duplicates Batch 4 -- 2-Copy Types (16 Types Consolidated) |
| **Status**       | PLANNED                                                            |
| **Risk Level**   | MEDIUM (largest batch, 16 types across ~20 files)                  |
| **Duration**     | 60 minutes                                                         |
| **Dependencies** | Phase-4.2.3 (Semantic conflicts resolved)                          |
| **Blocks**       | None (final batch)                                                 |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                  |
| **Commit**       | `refactor: deduplicate 2-copy types (16 types consolidated)`       |

---

## Objective

Consolidate all remaining 2-copy type duplicates. For each: designate a canonical copy, delete or rename the non-canonical copy, and update all importers. This is the largest and final batch.

---

## Current State Assessment

| Metric                     | Value            |
| -------------------------- | ---------------- |
| Types to consolidate       | 16               |
| Total definitions removed  | ~16 (1 per type) |
| Files to modify            | ~20              |
| Renames (different shapes) | 6                |
| Deletions (identical)      | 10               |

### Type Summary Table

| #   | Type            | Canonical                                           | Non-Canonical                          | Action               |
| --- | --------------- | --------------------------------------------------- | -------------------------------------- | -------------------- |
| 1   | RSSIMeasurement | `localization/types.ts:5`                           | `RSSILocalizer.ts:6`                   | Delete               |
| 2   | GeoBounds       | `localization/types.ts:19`                          | `RSSILocalizer.ts:20`                  | Delete               |
| 3   | GPRPrediction   | `localization/types.ts:26`                          | `RSSILocalizer.ts:27`                  | Delete               |
| 4   | SourceEstimate  | `localization/types.ts:33`                          | `RSSILocalizer.ts:34`                  | Delete               |
| 5   | SignalMarker    | `stores/map/signals.ts:6` (19 importers)            | `types/signals.ts:27`                  | Delete               |
| 6   | SignalCluster   | `services/map/signalClustering.ts:31`               | `types/signals.ts:52`                  | Delete               |
| 7   | SweepStatus     | `stores/hackrf.ts:36` (frontend)                    | `server/hackrf/types.ts:22`            | Rename non-canonical |
| 8   | SpatialQuery    | `services/db/signalDatabase.ts:38` (superset)       | `server/db/types.ts:60`                | Delete               |
| 9   | SignalDetection | `services/api/hackrf.ts:40` (3 importers)           | `server/gnuradio/types.ts:11`          | Rename non-canonical |
| 10  | KismetScript    | `server/kismet/types.ts:592` (superset)             | `services/api/kismet.ts:58`            | Delete               |
| 11  | KismetConfig    | `server/kismet/types.ts:130` (superset)             | `services/api/kismet.ts:75`            | Delete               |
| 12  | KismetAlert     | `types/kismet.ts:37` (typed unions)                 | `server/kismet/types.ts:345`           | Delete               |
| 13  | DeviceFilter    | `server/kismet/types.ts:565` (superset)             | `services/api/kismet.ts:87`            | Delete               |
| 14  | KismetMessage   | `types/signals.ts:137` (typed, extends WSMessage)   | `services/websocket/kismet.ts:16`      | Rename non-canonical |
| 15  | HackRFMessage   | `types/signals.ts:146` (typed, extends WSMessage)   | `services/websocket/hackrf.ts:20`      | Rename non-canonical |
| 16  | HackRFConfig    | `stores/hackrf.ts:85` (device-level config)         | `services/api/hackrf.ts:25`            | Rename non-canonical |
| 17  | GPSPosition     | `stores/tactical-map/gpsStore.ts:3` (17+ importers) | `server/services/kismet.service.ts:32` | Delete               |
| 18  | DeviceRecord    | `types/shared.ts:39` (type alias -> Device)         | `services/db/signalDatabase.ts:26`     | Delete               |

**Note**: 18 entries but counted as 16 types because RSSIMeasurement/GeoBounds/GPRPrediction/SourceEstimate are grouped as the "localization group" (4 types handled in a single operation on 1 file).

---

## Execution Steps

### Group A: Localization Group (4 types, all identical copies)

**Canonical**: `src/lib/services/localization/types.ts` (dedicated types file)

**File to modify**: `src/lib/services/localization/RSSILocalizer.ts`

#### Step A1: Delete local definitions

Delete the following local interface definitions from `RSSILocalizer.ts` (lines 6-38):

- `RSSIMeasurement` (line 6)
- `GeoBounds` (line 20)
- `GPRPrediction` (line 27)
- `SourceEstimate` (line 34)

#### Step A2: Add import

Add at top of `RSSILocalizer.ts`:

```typescript
import type { RSSIMeasurement, GeoBounds, GPRPrediction, SourceEstimate } from './types';
```

**Importer analysis**: 0 importers of these types from `RSSILocalizer.ts` (only `integration-example.ts`, commented out).

#### Step A3: Verification

```bash
for type in RSSIMeasurement GeoBounds GPRPrediction SourceEstimate; do
  count=$(grep -rn "export.*interface ${type} " --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions (expected 1)"
done
```

---

### Type 5: SignalMarker

**Canonical**: `src/lib/stores/map/signals.ts:6` (19 importers -- by far the most used type in the codebase)

**File to modify**: `src/lib/types/signals.ts`

#### Step 5a: Delete from `src/lib/types/signals.ts`

Delete lines 27-38 (the `SignalMarker` interface).

The version in `types/signals.ts` has a `position: Position` field not present in the canonical. Check if `Position` is a referenced type:

```bash
grep -rn "position:" --include="*.ts" src/lib/types/signals.ts
```

The `SignalCluster` in the same file also uses `position: Position`. Both are deleted in this batch.

**Importer analysis**: 1 importer of `SignalMarker` from `types/signals.ts` -- `src/lib/components/map/SignalInfoCard.svelte:2`.

#### Step 5b: Update importer

**File**: `src/lib/components/map/SignalInfoCard.svelte:2`

```typescript
// BEFORE:
import type { SignalMarker } from '$lib/types/signals';

// AFTER:
import type { SignalMarker } from '$lib/stores/map/signals';
```

---

### Type 6: SignalCluster

**Canonical**: `src/lib/services/map/signalClustering.ts:31` (3 importers, contains implementation)

**File to modify**: `src/lib/types/signals.ts`

#### Step 6a: Delete from `src/lib/types/signals.ts`

Delete lines 52-57 (the `SignalCluster` interface).

This version uses `position: Position` (a type not defined in the file). The canonical uses explicit `lat: number; lon: number` and has `bounds` and richer `stats`.

**Importer analysis**: 0 importers of `SignalCluster` from `types/signals.ts`.

---

### Type 7: SweepStatus (rename, different shapes)

**Canonical**: `src/lib/stores/hackrf.ts:36` (used by frontend components)

The two versions have completely different field names (`active` vs `state`, `startFreq/endFreq` vs `currentFrequency`). These are genuinely different shapes.

**File to modify**: `src/lib/server/hackrf/types.ts:22`

#### Step 7a: Rename

```typescript
// BEFORE:
export interface SweepStatus { ... }

// AFTER:
export interface SweepManagerStatus { ... }
```

**Importer analysis**: 1 importer -- `src/routes/api/hackrf/cycle-status/+server.ts:3`.

#### Step 7b: Update importer

**File**: `src/routes/api/hackrf/cycle-status/+server.ts:3`

```typescript
// BEFORE:
import type { SweepStatus } from '$lib/server/hackrf/types';

// AFTER:
import type { SweepManagerStatus } from '$lib/server/hackrf/types';
```

Update all references within the file from `SweepStatus` to `SweepManagerStatus`.

---

### Type 8: SpatialQuery (delete subset)

**Canonical**: `src/lib/services/db/signalDatabase.ts:38` (superset with time and limit fields)

**File to modify**: `src/lib/server/db/types.ts`

#### Step 8a: Delete from `src/lib/server/db/types.ts`

Delete lines 60-65 (the `SpatialQuery` interface).

**Importer analysis**: 0 importers of `SpatialQuery` from `server/db/types.ts` (verified).

**Note**: The `server/db/types.ts` version is a subset (no `startTime`, `endTime`, `limit`). Those fields are in a separate `TimeQuery` interface. If any code combines `SpatialQuery & TimeQuery` from this file, it should use the unified `SpatialQuery` from `signalDatabase.ts` instead.

---

### Type 9: SignalDetection (rename, different field names)

**Canonical**: `src/lib/services/api/hackrf.ts:40` (3 importers)

**File to modify**: `src/lib/server/gnuradio/types.ts:11`

#### Step 9a: Rename

```typescript
// BEFORE:
export interface SignalDetection { centerFrequency: number; timestamp: Date; ... }

// AFTER:
export interface GNURadioSignalDetection { centerFrequency: number; timestamp: Date; ... }
```

Uses `centerFrequency` instead of `frequency`, `timestamp: Date` instead of `number`.

**Importer analysis**: 0 importers. Update all internal references within `types.ts` and `spectrum_analyzer.ts`.

---

### Type 10: KismetScript (delete subset)

**Canonical**: `src/lib/server/kismet/types.ts:592` (superset with arguments, timeout, enabled, executable)

**File to modify**: `src/lib/services/api/kismet.ts`

#### Step 10a: Delete from `src/lib/services/api/kismet.ts`

Delete lines 58-64 (the `KismetScript` interface).

Add import:

```typescript
import type { KismetScript } from '$lib/server/kismet/types';
```

**Importer analysis**: 0 importers of `KismetScript` from this file.

---

### Type 11: KismetConfig (delete subset)

**Canonical**: `src/lib/server/kismet/types.ts:130` (superset with auth, ports, toggles)

**File to modify**: `src/lib/services/api/kismet.ts`

#### Step 11a: Delete from `src/lib/services/api/kismet.ts`

Delete lines 75-85 (the `KismetConfig` interface).

Add import:

```typescript
import type { KismetConfig } from '$lib/server/kismet/types';
```

**Importer analysis**: 0 importers of `KismetConfig` from this file.

---

### Type 12: KismetAlert (delete less-typed copy)

**Canonical**: `src/lib/types/kismet.ts:37` (typed severity/type unions, richer details)

**File to modify**: `src/lib/server/kismet/types.ts`

#### Step 12a: Delete from `src/lib/server/kismet/types.ts`

Delete lines 345-353 (the `KismetAlert` interface).

Add import:

```typescript
import type { KismetAlert } from '$lib/types/kismet';
```

**Importer analysis**: 0 importers of `KismetAlert` from `server/kismet/types.ts`.

---

### Type 13: DeviceFilter (delete subset)

**Canonical**: `src/lib/server/kismet/types.ts:565` (superset with signalStrength range, lastSeen dates, location radius)

**File to modify**: `src/lib/services/api/kismet.ts`

#### Step 13a: Delete from `src/lib/services/api/kismet.ts`

Delete lines 87-95 (the `DeviceFilter` interface).

Add import:

```typescript
import type { DeviceFilter } from '$lib/server/kismet/types';
```

**Importer analysis**: 0 importers of `DeviceFilter` from this file.

---

### Type 14: KismetMessage (rename, different shapes)

Both versions are genuinely different:

- `types/signals.ts:137` extends `WSMessage` with typed `data` containing `devices[]` and `status`
- `websocket/kismet.ts:16` is a minimal `{ type: string; data?: unknown }`

**File to modify**: `src/lib/services/websocket/kismet.ts:16`

#### Step 14a: Rename

```typescript
// BEFORE:
interface KismetMessage {
	type: string;
	data?: unknown;
}

// AFTER:
interface KismetWSFrame {
	type: string;
	data?: unknown;
}
```

Used only within the `KismetWebSocketClient` class in the same file. Update all internal references.

---

### Type 15: HackRFMessage (rename, same pattern as KismetMessage)

- `types/signals.ts:146` extends `WSMessage` with typed `data: HackRFData | HackRFData[]`
- `websocket/hackrf.ts:20` is minimal `{ type: string; data?: unknown }`

**File to modify**: `src/lib/services/websocket/hackrf.ts:20`

#### Step 15a: Rename

```typescript
// BEFORE:
interface HackRFMessage {
	type: string;
	data?: unknown;
}

// AFTER:
interface HackRFWSFrame {
	type: string;
	data?: unknown;
}
```

Used only within the `HackRFWebSocketClient` class in the same file. Update all internal references.

---

### Type 16: HackRFConfig (rename, different purposes)

Different shapes representing different concepts:

- `stores/hackrf.ts:85` -- device-level config (gain, lnaGain, vgaGain, centerFreq)
- `api/hackrf.ts:25` -- sweep config (startFreq, endFreq, binSize, amplifierEnabled)

**File to modify**: `src/lib/services/api/hackrf.ts:25`

#### Step 16a: Rename

```typescript
// BEFORE:
export interface HackRFConfig { startFreq: number; endFreq: number; binSize: number; ... }

// AFTER:
export interface HackRFSweepConfig { startFreq: number; endFreq: number; binSize: number; ... }
```

**Importer analysis**: 0 importers of `HackRFConfig` from this file. Update all internal references within `api/hackrf.ts`.

---

### Type 17: GPSPosition (delete dead copy)

**Canonical**: `src/lib/stores/tactical-map/gpsStore.ts:3` -- `{ lat, lon }` (short form, 17+ importers via store)

**File to modify**: `src/lib/server/services/kismet.service.ts`

#### Step 17a: Delete from `src/lib/server/services/kismet.service.ts`

Delete lines 32-35 (the `GPSPosition` interface using `{ latitude, longitude }` full form).

This file has 0 importers.

If internal code within `kismet.service.ts` uses the type, replace with:

```typescript
import type { GPSPosition } from '$lib/stores/tactical-map/gpsStore';
```

---

### Type 18: DeviceRecord (delete duplicate alias)

Both are type aliases pointing to the same base `Device` from `shared.ts`:

- `shared.ts:39` -- `type DeviceRecord = Device`
- `signalDatabase.ts:26` -- `type DeviceRecord = SharedDeviceRecord` (which is `Device` from `shared.ts`)

**File to modify**: `src/lib/services/db/signalDatabase.ts`

#### Step 18a: Delete from `src/lib/services/db/signalDatabase.ts`

Delete line 26 (the `type DeviceRecord = SharedDeviceRecord` alias).

Already imports `SharedDeviceRecord` from `shared.ts`. Use `SharedDeviceRecord` directly throughout the file, OR rename the import:

```typescript
import type { DeviceRecord } from '$lib/types/shared';
```

---

## Final Verification

**Command 1 -- Full compilation**:

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Expected**: 0 errors.

**Command 2 -- All types reduced to 1 definition**:

```bash
for type in ProcessConfig ParsedLine BufferConfig RSSIMeasurement SourceEstimate GeoBounds GPRPrediction; do
  count=$(grep -rn "^export \(type\|interface\) ${type} " --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} (expected 1)"
done
```

**Expected**: Each returns 1.

**Command 3 -- Renamed types exist**:

```bash
grep -rn "SweepManagerStatus" --include="*.ts" src/ | wc -l
grep -rn "GNURadioSignalDetection" --include="*.ts" src/ | wc -l
grep -rn "KismetWSFrame" --include="*.ts" src/ | wc -l
grep -rn "HackRFWSFrame" --include="*.ts" src/ | wc -l
grep -rn "HackRFSweepConfig" --include="*.ts" src/ | wc -l
```

**Expected**: Each >= 1.

**Command 4 -- Lint passes**:

```bash
npm run lint 2>&1 | tail -5
```

**Expected**: 0 errors.

**Command 5 -- No remaining duplicates for consolidated types**:

```bash
for type in KismetScript KismetConfig KismetAlert DeviceFilter SpatialQuery; do
  count=$(grep -rn "export.*interface ${type} \|export.*interface ${type}{" --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions (expected 1)"
done
```

**Expected**: Each returns 1.

---

## Risk Assessment

| Risk                                                              | Likelihood | Impact | Mitigation                                                       |
| ----------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| Large batch size increases error probability                      | MEDIUM     | LOW    | Run `npx tsc --noEmit` after every 3-4 types                     |
| KismetAlert import creates circular ref                           | LOW        | MEDIUM | `types/kismet.ts` -> `server/kismet/types.ts` is one-directional |
| GPSPosition field name difference (lat/lon vs latitude/longitude) | NONE       | --     | Dead copy deleted; only canonical remains                        |
| DeviceRecord alias chain confusion                                | LOW        | LOW    | Both resolve to same base `Device`; simplified to single alias   |
| Batch 4 compilation depends on Batch 1-3                          | MEDIUM     | LOW    | Each batch is independently compilable; verify before starting   |

### Medium Risk: Largest batch

This is the largest batch (16 types). To mitigate:

1. Group related operations (e.g., all `api/kismet.ts` deletions in one pass)
2. Run `npx tsc --noEmit` every 3-4 types
3. Commit granularly if issues arise (split into sub-commits)

---

## Rollback Strategy

### Per-type rollback

For any single type that causes issues:

1. Restore the deleted definition in the non-canonical file
2. Remove the added import line
3. Run `npx tsc --noEmit` to verify

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "deduplicate 2-copy types" commit
```

### Partial rollback (emergency)

If mid-batch compilation fails:

```bash
git stash  # Stash current changes
npx tsc --noEmit  # Verify clean state
git stash pop  # Restore changes
# Fix the specific type causing the error, then continue
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                       |
| ---------------- | -------------------------- | --------------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | 16 types reduced from 2 definitions to 1 each       |
| NASA/JPL Rule 15 | Single Point of Definition | Each type has a designated canonical location       |
| BARR-C Rule 1.3  | No Duplicate Definitions   | ~16 duplicate definitions removed                   |
| MISRA Rule 8.2   | Type Compatibility         | Identical copies deleted; different shapes renamed  |
| MISRA Rule 5.3   | Unique Identifiers         | 6 renames ensure unique names for distinct concepts |

---

## Appendix A: Files Requiring Import Updates (~31 files total across all batches)

| File                                                              | Types Affected                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts` | ProcessState, ProcessConfig                                                                       |
| `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`   | ProcessState, ProcessConfig                                                                       |
| `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts`   | BufferState, BufferConfig, ParsedLine                                                             |
| `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts`     | BufferState, BufferConfig, ParsedLine                                                             |
| `src/lib/services/localization/RSSILocalizer.ts`                  | RSSIMeasurement, GeoBounds, GPRPrediction, SourceEstimate                                         |
| `src/lib/services/localization/coral/CoralAccelerator.ts`         | CoralPrediction                                                                                   |
| `src/lib/services/localization/coral/CoralAccelerator.v2.ts`      | CoralPrediction                                                                                   |
| `src/lib/server/hardware/detection-types.ts`                      | HardwareStatus -> HardwareConnectionState                                                         |
| `src/lib/stores/hackrf.ts`                                        | SpectrumData -> SpectrumSnapshot, DeviceInfo -> HackRFDeviceInfo                                  |
| `src/lib/services/api/hackrf.ts`                                  | SpectrumData -> SpectrumAPIResponse, HackRFConfig -> HackRFSweepConfig                            |
| `src/lib/services/api/kismet.ts`                                  | KismetDevice, KismetStatus, KismetScript, KismetConfig, DeviceFilter (delete)                     |
| `src/lib/server/services/kismet.service.ts`                       | KismetDevice, GPSPosition (delete)                                                                |
| `src/lib/server/kismet/types.ts`                                  | KismetDevice, KismetAlert, NetworkPacket, SweepStatus -> SweepManagerStatus (delete/rename)       |
| `src/lib/server/gnuradio/spectrum_analyzer.ts`                    | SpectrumData -> GNURadioSample                                                                    |
| `src/lib/server/gnuradio/types.ts`                                | SignalDetection -> GNURadioSignalDetection                                                        |
| `src/lib/services/websocket/kismet.ts`                            | KismetMessage -> KismetWSFrame                                                                    |
| `src/lib/services/websocket/hackrf.ts`                            | HackRFMessage -> HackRFWSFrame                                                                    |
| `src/lib/stores/connection.ts`                                    | SystemHealth -> SystemHealthMetrics, ServiceStatus -> ServiceConnectionState                      |
| `src/lib/stores/tactical-map/systemStore.ts`                      | SystemInfo -> SystemStoreState                                                                    |
| `src/lib/services/api/system.ts`                                  | SystemInfo -> SystemInfoResponse, ServiceStatus (delete), NetworkInterface -> NetworkInterfaceDTO |
| `src/lib/server/networkInterfaces.ts`                             | NetworkInterface -> MonitorableInterface                                                          |
| `src/lib/server/db/types.ts`                                      | SpatialQuery (delete)                                                                             |
| `src/lib/services/db/signalDatabase.ts`                           | DeviceRecord (delete duplicate alias)                                                             |
| `src/lib/types/signals.ts`                                        | KismetDevice, SignalMarker, SignalCluster (delete)                                                |
| `src/lib/types/gsm.ts`                                            | ScanResult -> GSMScanEvent                                                                        |
| `src/lib/server/kismet/webSocketManager.ts`                       | KismetSystemStatus (export)                                                                       |
| `src/lib/server/kismet/kismetProxy.ts`                            | KismetSystemStatus (import from webSocketManager)                                                 |
| `src/routes/tactical-map-simple/integration-example.svelte`       | KismetDevice import path                                                                          |
| `src/routes/api/hackrf/cycle-status/+server.ts`                   | SweepStatus -> SweepManagerStatus                                                                 |
| `src/lib/components/map/SignalInfoCard.svelte`                    | SignalMarker import path                                                                          |
| `src/lib/components/hackrf/StatusDisplay.svelte`                  | SpectrumData -> SpectrumAPIResponse                                                               |

**Total unique files**: ~31

---

## Cross-References

- **Depends on**: Phase-4.2.3 (Semantic Conflicts Resolved)
- **Related**: Phase-4.2.4 (Batch 1 -- KismetDevice), Phase-4.2.5 (Batch 2 -- SpectrumData), Phase-4.2.6 (Batch 3 -- 3-copy types)
- **Related**: Phase-4.2.1 (Sweep-Manager Shared Types -- localization group follows same pattern)

---

## Execution Tracking

| Subtask  | Description                                            | Status  | Started | Completed | Verified By |
| -------- | ------------------------------------------------------ | ------- | ------- | --------- | ----------- |
| 4.2.7.1  | Delete localization group (4 types) from RSSILocalizer | PENDING | --      | --        | --          |
| 4.2.7.2  | Delete SignalMarker from types/signals.ts              | PENDING | --      | --        | --          |
| 4.2.7.3  | Update SignalInfoCard.svelte import                    | PENDING | --      | --        | --          |
| 4.2.7.4  | Delete SignalCluster from types/signals.ts             | PENDING | --      | --        | --          |
| 4.2.7.5  | Rename SweepStatus -> SweepManagerStatus               | PENDING | --      | --        | --          |
| 4.2.7.6  | Update cycle-status/+server.ts import                  | PENDING | --      | --        | --          |
| 4.2.7.7  | Delete SpatialQuery from server/db/types.ts            | PENDING | --      | --        | --          |
| 4.2.7.8  | Rename SignalDetection -> GNURadioSignalDetection      | PENDING | --      | --        | --          |
| 4.2.7.9  | Delete KismetScript from api/kismet.ts                 | PENDING | --      | --        | --          |
| 4.2.7.10 | Delete KismetConfig from api/kismet.ts                 | PENDING | --      | --        | --          |
| 4.2.7.11 | Delete KismetAlert from server/kismet/types.ts         | PENDING | --      | --        | --          |
| 4.2.7.12 | Delete DeviceFilter from api/kismet.ts                 | PENDING | --      | --        | --          |
| 4.2.7.13 | Rename KismetMessage -> KismetWSFrame                  | PENDING | --      | --        | --          |
| 4.2.7.14 | Rename HackRFMessage -> HackRFWSFrame                  | PENDING | --      | --        | --          |
| 4.2.7.15 | Rename HackRFConfig -> HackRFSweepConfig               | PENDING | --      | --        | --          |
| 4.2.7.16 | Delete GPSPosition from kismet.service.ts              | PENDING | --      | --        | --          |
| 4.2.7.17 | Delete DeviceRecord alias from signalDatabase.ts       | PENDING | --      | --        | --          |
| 4.2.7.18 | TypeScript compilation verification                    | PENDING | --      | --        | --          |
| 4.2.7.19 | Lint verification                                      | PENDING | --      | --        | --          |
