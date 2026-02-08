# Phase 4.2: Type Deduplication Plan

**Status**: READY FOR EXECUTION
**Author**: Alex Thompson (Principal Quantum Software Architect)
**Date**: 2026-02-08
**TypeScript**: v5.8.3, strict: true
**Prerequisite**: None (standalone, no dependency on other phases)
**Estimated Duration**: 4-6 hours
**Risk Level**: MEDIUM (type-only changes, compile-time verification)

---

## 1. Current State Assessment

### 1.1 Inventory Summary

| Metric                                 | Value                        |
| -------------------------------------- | ---------------------------- |
| Duplicate type names (exported)        | 39                           |
| Non-exported duplicates                | 1 (KismetSystemStatus)       |
| Total duplicate definitions            | 89                           |
| Definitions to remove                  | 45                           |
| Semantic conflicts (cannot merge)      | 5                            |
| Files requiring import updates         | ~35                          |
| Barrel file (`src/lib/types/index.ts`) | DOES NOT EXIST (must create) |

### 1.2 Duplicate Classification

**Identical copies** (field-for-field match, safe merge):

- ProcessState, ProcessConfig, ParsedLine, BufferState, BufferConfig (HackRF/USRP sweep-manager)
- RSSIMeasurement, SourceEstimate, GeoBounds, GPRPrediction, CoralPrediction (localization)

**Superset/subset** (one copy has more fields, keep superset):

- KismetDevice (5 copies, all different field conventions)
- SpectrumData (4 copies, all different shapes)
- KismetStatus (3 copies, server/kismet/types.ts is superset)
- KismetConfig (2 copies, server/kismet/types.ts is superset)
- KismetScript (2 copies, server/kismet/types.ts is superset)
- DeviceFilter (2 copies, server/kismet/types.ts is superset)
- KismetAlert (2 copies, types/kismet.ts has typed unions)
- SweepStatus (2 copies, different field names)
- SignalMarker (2 copies, stores/map/signals.ts is superset)
- SignalCluster (2 copies, signalClustering.ts is superset)
- SystemInfo (3 copies, all different shapes)
- ServiceStatus (3 copies, system.d.ts is superset)
- NetworkInterface (3 copies, system.d.ts is superset)
- SystemHealth (2 copies, completely different)
- HackRFConfig (2 copies, different purpose: device config vs sweep config)
- SpatialQuery (2 copies, signalDatabase.ts is superset)
- NetworkPacket (3 copies, wireshark.ts is base, packetAnalysisStore extends)
- GPSPosition (2 copies, different field names: lat/lon vs latitude/longitude)
- SignalDetection (2 copies, different field names)

**Semantic conflicts** (same name, different entity -- cannot merge):

- ToolDefinition: UI navigation tool vs agent execution tool
- DeviceInfo: HackRF hardware info vs DB device summary
- ScanResult: GSM scan event envelope vs individual frequency measurement
- Device: App domain model vs DB row schema
- HardwareStatus: string union type vs interface with resource states

### 1.3 Complete Duplicate Location Registry

```
TYPE NAME              COPIES  LOCATIONS (file:line)
---------------------------------------------------------------------
KismetDevice           5       src/lib/types/kismet.ts:1
                               src/lib/types/signals.ts:84
                               src/lib/services/api/kismet.ts:25
                               src/lib/server/services/kismet.service.ts:7
                               src/lib/server/kismet/types.ts:536

SpectrumData           4       src/lib/stores/hackrf.ts:5
                               src/lib/services/api/hackrf.ts:48
                               src/lib/server/hackrf/types.ts:38
                               src/lib/server/gnuradio/spectrum_analyzer.ts:4

SystemInfo             3       src/types/system.d.ts:62
                               src/lib/stores/tactical-map/systemStore.ts:3
                               src/lib/services/api/system.ts:13

ServiceStatus          3       src/types/system.d.ts:90
                               src/lib/stores/connection.ts:22
                               src/lib/services/api/system.ts:49

NetworkPacket          3       src/lib/stores/packetAnalysisStore.ts:5 (extends BaseNetworkPacket)
                               src/lib/server/kismet/types.ts:222
                               src/lib/server/wireshark.ts:4

NetworkInterface       3       src/types/system.d.ts:35
                               src/lib/services/api/system.ts:41
                               src/lib/server/networkInterfaces.ts:4

KismetStatus           3       src/lib/types/kismet.ts:52
                               src/lib/services/api/kismet.ts:16
                               src/lib/server/kismet/types.ts:148

CoralPrediction        3       src/lib/services/localization/coral/CoralAccelerator.v2.ts:9
                               src/lib/services/localization/coral/CoralAccelerator.ts:12
                               src/lib/services/localization/types.ts:39

ToolDefinition         2       src/lib/types/tools.ts:12
                               src/lib/server/agent/tool-execution/types.ts:38

SystemHealth           2       src/lib/stores/connection.ts:14
                               src/lib/services/api/system.ts:58

SweepStatus            2       src/lib/stores/hackrf.ts:36
                               src/lib/server/hackrf/types.ts:22

SpatialQuery           2       src/lib/services/db/signalDatabase.ts:38
                               src/lib/server/db/types.ts:60

SourceEstimate         2       src/lib/services/localization/RSSILocalizer.ts:34
                               src/lib/services/localization/types.ts:33

SignalMarker           2       src/lib/types/signals.ts:27
                               src/lib/stores/map/signals.ts:6

SignalDetection        2       src/lib/services/api/hackrf.ts:40
                               src/lib/server/gnuradio/types.ts:11

SignalCluster          2       src/lib/types/signals.ts:52
                               src/lib/services/map/signalClustering.ts:31

ScanResult             2       src/lib/types/gsm.ts:30
                               src/lib/stores/gsmEvilStore.ts:13

RSSIMeasurement        2       src/lib/services/localization/RSSILocalizer.ts:6
                               src/lib/services/localization/types.ts:5

ProcessState           2       src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts:6
                               src/lib/services/usrp/sweep-manager/process/ProcessManager.ts:4

ProcessConfig          2       src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts:13
                               src/lib/services/usrp/sweep-manager/process/ProcessManager.ts:11

ParsedLine             2       src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:18
                               src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:18

KismetScript           2       src/lib/services/api/kismet.ts:58
                               src/lib/server/kismet/types.ts:592

KismetMessage          2       src/lib/types/signals.ts:137
                               src/lib/services/websocket/kismet.ts:16

KismetConfig           2       src/lib/services/api/kismet.ts:75
                               src/lib/server/kismet/types.ts:130

KismetAlert            2       src/lib/types/kismet.ts:37
                               src/lib/server/kismet/types.ts:345

HardwareStatus         2       src/lib/server/hardware/detection-types.ts:28 (type alias)
                               src/lib/server/hardware/types.ts:28 (interface)

HackRFMessage          2       src/lib/types/signals.ts:146
                               src/lib/services/websocket/hackrf.ts:20

HackRFConfig           2       src/lib/stores/hackrf.ts:85
                               src/lib/services/api/hackrf.ts:25

GPSPosition            2       src/lib/stores/tactical-map/gpsStore.ts:3
                               src/lib/server/services/kismet.service.ts:32

GPRPrediction          2       src/lib/services/localization/RSSILocalizer.ts:27
                               src/lib/services/localization/types.ts:26

GeoBounds              2       src/lib/services/localization/RSSILocalizer.ts:20
                               src/lib/services/localization/types.ts:19

DeviceRecord           2       src/lib/types/shared.ts:39 (type alias -> Device)
                               src/lib/services/db/signalDatabase.ts:26 (type alias -> SharedDeviceRecord)

DeviceInfo             2       src/lib/stores/hackrf.ts:77
                               src/lib/services/db/dataAccessLayer.ts:32

DeviceFilter           2       src/lib/services/api/kismet.ts:87
                               src/lib/server/kismet/types.ts:565

Device                 2       src/lib/types/shared.ts:18
                               src/lib/server/database/schema.ts:2

BufferState            2       src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:4
                               src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:4

BufferConfig           2       src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:12
                               src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:12

KismetSystemStatus     2       src/lib/server/kismet/webSocketManager.ts:33 (non-exported)
(non-exported)                 src/lib/server/kismet/kismetProxy.ts:36 (non-exported)

MarkerCluster          2       src/types/leaflet-extensions.d.ts (Leaflet plugin declaration)
                               src/lib/components/tactical-map/map/MarkerManager.svelte (component-local)

MarkerClusterGroupOptions 2    src/types/leaflet-extensions.d.ts (Leaflet plugin declaration)
                               src/lib/components/tactical-map/map/MarkerManager.svelte (component-local)
```

**NOTE (added by verification audit 2026-02-08)**: `CoralPrediction` has 3 definitions
(`CoralAccelerator.v2.ts:9`, `CoralAccelerator.ts:12`, `types.ts:39`) but one copy is in
`CoralAccelerator.v2.ts` which is deleted in Phase 4.1 (dead code). The remaining 2 copies
(canonical: `types.ts`, consumer: `CoralAccelerator.ts`) should be consolidated during
Task 4.2.5 Batch 4 (2-copy types).

---

## 2. Execution Order

```
Task 4.2.1  Audit divergent fields (read-only, no code changes)
    |
Task 4.2.2  Create sweep-manager shared types
    |
Task 4.2.3  Create canonical type barrel (src/lib/types/index.ts)
    |
Task 4.2.4  Resolve semantic conflicts (renames)
    |
Task 4.2.5  Replace duplicate definitions
    |           Batch 1: 5-copy (KismetDevice)
    |           Batch 2: 4-copy (SpectrumData)
    |           Batch 3: 3-copy types
    |           Batch 4: 2-copy types
    |
    v
    Verification: npx tsc --noEmit && npm run lint
```

Each batch is independently compilable. Run `npx tsc --noEmit` after each batch.

---

## 3. Task 4.2.1: Audit Divergent Fields

**Objective**: For each duplicate set, determine which copy is canonical and what fields differ.

This task is READ-ONLY. No code changes. The output is the field comparison table below, which was completed during plan preparation.

### 3.1 Field Divergence Matrix

#### KismetDevice (5 copies)

| Field             |     types/kismet.ts     |             types/signals.ts             |          api/kismet.ts          |  kismet.service.ts   |            server/kismet/types.ts            |
| ----------------- | :---------------------: | :--------------------------------------: | :-----------------------------: | :------------------: | :------------------------------------------: |
| mac/macaddr       |      `mac: string`      |       `kismet.device.base.macaddr`       |          `mac: string`          |    `mac: string`     |      `mac: string` + `macaddr: string`       |
| signal            |       nested obj        |         nested obj (kismet keys)         |    `signalStrength?: number`    |      nested obj      | `signalStrength: number` + `signal?: number` |
| location          |      `{lat, lon}`       | `{avg_lat, avg_lon, last_lat, last_lon}` |       `lat?, lon?, gps?`        |     `{lat, lon}`     |      `{latitude, longitude, accuracy?}`      |
| time fields       | `last_seen, last_time?` |         `first_time, last_time`          | `firstSeen, lastSeen` (strings) | `last_seen` (number) |       `firstSeen, lastSeen` (numbers)        |
| naming convention |        camelCase        |           kismet dot-notation            |            camelCase            |    snake_case mix    |                  camelCase                   |

**Canonical choice**: `src/lib/types/kismet.ts:1`
**Rationale**: Most imported (13 files). Represents the app-layer normalized shape. The `types/signals.ts:84` copy uses raw Kismet API dot-notation and should be renamed to `RawKismetDevice`. The `server/kismet/types.ts:536` and `api/kismet.ts:25` copies are supersets with extra fields that should be merged into the canonical. The `kismet.service.ts:7` copy is dead code (0 importers).

#### SpectrumData (4 copies)

| Field        |                   stores/hackrf.ts                    |         api/hackrf.ts         | server/hackrf/types.ts  | gnuradio/spectrum_analyzer.ts |
| ------------ | :---------------------------------------------------: | :---------------------------: | :---------------------: | :---------------------------: |
| frequencies  |                      `number[]`                       | `number[]` (as `frequencies`) |     single `number`     |        single `number`        |
| power        |                      `number[]`                       |   `number[]` (as `powers`)    |     single `number`     |        single `number`        |
| timestamp    |                       `number`                        |           `number`            |         `Date`          |            `Date`             |
| extra fields | `centerFreq, sampleRate, binSize, sweepId, processed` | `centerFrequency, sampleRate` | `binData[], metadata{}` |             none              |

**Canonical choice**: `src/lib/server/hackrf/types.ts:38`
**Rationale**: Most complete (metadata, binData, validation fields). Used by server-side sweep pipeline and SSE streaming (7 importers). The `stores/hackrf.ts:5` and `api/hackrf.ts:48` versions represent client-side array-based spectrum snapshots -- a genuinely different shape. The `gnuradio/spectrum_analyzer.ts:4` copy is a single-point measurement.

**Resolution**: These are three distinct concepts:

1. `SpectrumData` -- server-side single-point with metadata (keep at server/hackrf/types.ts)
2. `SpectrumSnapshot` -- client-side array format (rename stores/hackrf.ts copy)
3. `GNURadioSample` -- minimal single-point (rename gnuradio copy)

#### SystemInfo (3 copies) -- SEMANTIC CONFLICT

| Aspect    |                      system.d.ts                       |                    systemStore.ts                    |               api/system.ts               |
| --------- | :----------------------------------------------------: | :--------------------------------------------------: | :---------------------------------------: |
| Shape     | Full OS info with CPUInfo/MemoryInfo/DiskInfo subtypes | Flat with wifi interfaces, cpu/memory/storage inline | Flat with loadAverage, network.interfaces |
| Importers |             0 (declaration file, ambient)              |               0 (used inline by store)               |       0 (used inline by API class)        |

**Resolution**: All three serve different layers. The `system.d.ts` version is the most complete ambient declaration. The store and API versions are response DTOs used only within their own files. Keep all three as-is but rename:

- `system.d.ts` -> keep as `SystemInfo` (ambient, canonical)
- `systemStore.ts` -> rename to `SystemInfoStoreState`
- `api/system.ts` -> rename to `SystemInfoResponse`

#### ServiceStatus (3 copies) -- SUPERSET

| Field        |                    system.d.ts                     | stores/connection.ts |              api/system.ts              |
| ------------ | :------------------------------------------------: | :------------------: | :-------------------------------------: |
| status field | `status: 'running'\|'stopped'\|'error'\|'unknown'` |  `running: boolean`  | `status: 'running'\|'stopped'\|'error'` |
| error field  |                  `error?: string`                  |        absent        |                 absent                  |

**Canonical choice**: `src/types/system.d.ts:90`
**Rationale**: Superset with typed status union and error field. The `stores/connection.ts:22` version uses `running: boolean` which loses information.

#### NetworkPacket (3 copies) -- EXTENSION CHAIN

The `packetAnalysisStore.ts:5` version already imports from wireshark.ts and extends it:

```typescript
import type { NetworkPacket as BaseNetworkPacket } from '$lib/server/wireshark';
export interface NetworkPacket extends BaseNetworkPacket {
	data?: string;
}
```

| Field       |      wireshark.ts       |         kismet/types.ts         |  packetAnalysisStore.ts  |
| ----------- | :---------------------: | :-----------------------------: | :----------------------: |
| id          | `id: string` (required) |    `id?: string` (optional)     | inherited from wireshark |
| source/dest |    `src_ip, dst_ip`     |       `sourceIP, destIP`        |        inherited         |
| extra       |     `info: string`      | `hostname?, suspicious?, data?` |     `data?: string`      |

**Canonical choice**: `src/lib/server/wireshark.ts:4` (base), `packetAnalysisStore.ts:5` (extension)
**Resolution**: Delete `kismet/types.ts:222` copy (different field names, 0 direct importers of the NetworkPacket from that file). Rename to `KismetNetworkPacket` if any code references it internally.

#### NetworkInterface (3 copies) -- SEMANTIC CONFLICT

| Field     |               system.d.ts                |     api/system.ts      |     server/networkInterfaces.ts     |
| --------- | :--------------------------------------: | :--------------------: | :---------------------------------: |
| addresses |              `ip?: string`               | `addresses: string[]`  |        `addresses: string[]`        |
| type      | `'ethernet'\|'wifi'\|'virtual'\|'other'` |        `string`        | absent (uses `isWireless: boolean`) |
| status    |          `status: 'up'\|'down'`          | `status: 'up'\|'down'` |           `isUp: boolean`           |
| extra     |             `speed?, stats?`             |     `mac: string`      |     `supportsMonitor?: boolean`     |

**Resolution**: Three different representations. The `server/networkInterfaces.ts:4` version is used for monitor-mode detection (RF-specific). Keep it as `MonitorableInterface`. Make `system.d.ts` canonical for general system display.

#### Other types with identical copies (no field divergence):

- RSSIMeasurement: identical in both files
- SourceEstimate: identical in both files
- GeoBounds: identical in both files
- GPRPrediction: identical in both files
- CoralPrediction: identical in all 3 files
- ProcessState: identical in both files
- ProcessConfig: identical in both files
- ParsedLine: identical in both files
- BufferState: identical in both files
- BufferConfig: identical in both files

---

## 4. Task 4.2.2: Create Sweep-Manager Shared Types

**Objective**: Extract the 5 identical HackRF/USRP types into a single shared file.

### 4.2.2.1 Create `src/lib/services/sweep-manager/types.ts`

```typescript
// src/lib/services/sweep-manager/types.ts
// Shared types for HackRF and USRP sweep manager implementations.

import type { ChildProcess } from 'node:child_process';
import type { SpectrumData } from '$lib/server/hackrf/types';

export interface ProcessState {
	sweepProcess: ChildProcess | null;
	sweepProcessPgid: number | null;
	actualProcessPid: number | null;
	processStartTime: number | null;
}

export interface ProcessConfig {
	detached: boolean;
	stdio: ('pipe' | 'inherit' | 'ignore')[];
	timeout?: number;
	startupTimeoutMs?: number;
}

export interface BufferState {
	stdoutBuffer: string;
	maxBufferSize: number;
	bufferOverflowCount: number;
	lineCount: number;
	totalBytesProcessed: number;
}

export interface BufferConfig {
	maxBufferSize?: number;
	maxLineLength?: number;
	overflowThreshold?: number;
}

export interface ParsedLine {
	data: SpectrumData | null;
	isValid: boolean;
	rawLine: string;
	parseError?: string;
}
```

### 4.2.2.2 Update imports in HackRF ProcessManager

**File**: `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts`

Delete lines 6-18 (ProcessState and ProcessConfig interfaces).
Add import:

```typescript
import type { ProcessState, ProcessConfig } from '$lib/services/sweep-manager/types';
```

### 4.2.2.3 Update imports in USRP ProcessManager

**File**: `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`

Delete lines 4-18 (ProcessState and ProcessConfig interfaces).
Add import:

```typescript
import type { ProcessState, ProcessConfig } from '$lib/services/sweep-manager/types';
```

### 4.2.2.4 Update imports in HackRF BufferManager

**File**: `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts`

Delete lines 4-25 (BufferState, BufferConfig, ParsedLine interfaces).
Add import:

```typescript
import type { BufferState, BufferConfig, ParsedLine } from '$lib/services/sweep-manager/types';
```

### 4.2.2.5 Update imports in USRP BufferManager

**File**: `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts`

Delete lines 4-25 (BufferState, BufferConfig, ParsedLine interfaces).
Add import:

```typescript
import type { BufferState, BufferConfig, ParsedLine } from '$lib/services/sweep-manager/types';
```

**Verification**:

```bash
npx tsc --noEmit 2>&1 | head -20
# Expected: 0 errors from sweep-manager files
```

---

## 5. Task 4.2.3: Create Canonical Type Barrel

**Objective**: Create `src/lib/types/index.ts` as the single import point for shared types.

**IMPORTANT**: This barrel re-exports from canonical locations. It does NOT define new types. Consumers import via `$lib/types` or `$lib/types/kismet`, etc.

### 5.1 File Content

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

**Note**: Types that are layer-specific (server-only, store-only) are intentionally NOT re-exported through this barrel. The barrel is for types consumed across multiple layers.

**Verification**:

```bash
npx tsc --noEmit 2>&1 | head -20
# Must compile with 0 errors (barrel is re-export only, no logic)
```

---

## 6. Task 4.2.4: Resolve Semantic Conflicts

Five type names refer to completely different entities. These require renames, not merges.

### 6.1 HardwareStatus (string union vs interface)

**File**: `src/lib/server/hardware/detection-types.ts:28`

```typescript
// BEFORE:
export type HardwareStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

// AFTER:
export type HardwareConnectionState = 'connected' | 'disconnected' | 'error' | 'unknown';
```

**Impact**: Find all importers of `HardwareStatus` from `detection-types.ts` and update:

```bash
grep -rn "HardwareStatus" --include="*.ts" src/lib/server/hardware/
```

Update all references in those files from `HardwareStatus` to `HardwareConnectionState`.

The `src/lib/server/hardware/types.ts:28` `HardwareStatus` interface remains unchanged.

### 6.2 DeviceInfo (HackRF device vs DB summary)

**File**: `src/lib/stores/hackrf.ts:77`

```typescript
// BEFORE:
export interface DeviceInfo { serial: string; version: string; board_id: number; ... }

// AFTER:
export interface HackRFDeviceInfo { serial: string; version: string; board_id: number; ... }
```

**Impact**: Update all importers of `DeviceInfo` from `stores/hackrf.ts`:

```bash
grep -rn "DeviceInfo" --include="*.ts" --include="*.svelte" src/ | grep "stores/hackrf"
```

The `src/lib/services/db/dataAccessLayer.ts:32` `DeviceInfo` remains unchanged (DB context).

### 6.3 ScanResult (event envelope vs frequency measurement)

**File**: `src/lib/types/gsm.ts:30`

```typescript
// BEFORE:
export interface ScanResult { type: 'scan_complete' | 'frequency_result'; ... }

// AFTER:
export interface GSMScanEvent { type: 'scan_complete' | 'frequency_result'; ... }
```

**File**: `src/lib/stores/gsmEvilStore.ts:13` -- remains as `ScanResult` (it represents an individual frequency scan result, which is the intuitive meaning).

**Impact**: Update importers of `ScanResult` from `types/gsm.ts`:

```bash
grep -rn "ScanResult" --include="*.ts" src/lib/types/gsm.ts
grep -rn "from.*types/gsm" --include="*.ts" src/
```

### 6.4 Device (app model vs DB schema)

No rename needed. These correctly represent different layers:

- `src/lib/types/shared.ts:18` -- app domain model
- `src/lib/server/database/schema.ts:2` -- DB row shape (snake_case fields, `id: number`)

They live in separate import paths and are never confused. The `DeviceRecord` type alias in `shared.ts` (`type DeviceRecord = Device`) and `signalDatabase.ts` (`type DeviceRecord = SharedDeviceRecord`) both resolve to the same base `Device` from `shared.ts`. This is correct as-is.

### 6.5 ToolDefinition (UI navigation vs agent execution)

No rename needed. Already handled by existing alias imports:

```typescript
// src/lib/server/agent/tool-execution/detection/detector.ts:13
import type { ToolDefinition as UIToolDef } from '$lib/types/tools';
```

Both definitions are consumed only within their own domains. The alias pattern prevents any confusion.

### 6.6 SystemInfo (3 copies, 3 layers)

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

### 6.7 SystemHealth (2 copies, different shapes)

**File**: `src/lib/stores/connection.ts:14`

```typescript
// BEFORE:
export interface SystemHealth { cpu: number; memory: number; disk: number; ... }

// AFTER:
export interface SystemHealthMetrics { cpu: number; memory: number; disk: number; ... }
```

`src/lib/services/api/system.ts:58` remains as `SystemHealth` (richer shape with status and checks).

### 6.8 NetworkInterface (3 copies)

**File**: `src/lib/server/networkInterfaces.ts:4`

```typescript
// BEFORE:
export interface NetworkInterface { name: string; addresses: string[]; isUp: boolean; isWireless: boolean; ... }

// AFTER:
export interface MonitorableInterface { name: string; addresses: string[]; isUp: boolean; isWireless: boolean; ... }
```

`src/types/system.d.ts:35` remains as canonical `NetworkInterface`.
`src/lib/services/api/system.ts:41` -> rename to `NetworkInterfaceDTO`.

### 6.9 KismetSystemStatus (non-exported, 2 copies)

**File**: `src/lib/server/kismet/kismetProxy.ts:36`

```typescript
// BEFORE:
interface KismetSystemStatus {
	[key: string]: unknown;
}
```

This is an overly broad type (`Record<string, unknown>`). Replace with an import of the typed version.

**File**: `src/lib/server/kismet/webSocketManager.ts:33` -- keep as canonical (has typed Kismet API fields). Export it.

**Change**: In `webSocketManager.ts:33`, change `interface` to `export interface`.
In `kismetProxy.ts:36`, delete the local definition and add:

```typescript
import type { KismetSystemStatus } from './webSocketManager';
```

**Verification**:

```bash
npx tsc --noEmit 2>&1 | head -20
grep -rn "HardwareStatus\|HackRFDeviceInfo\|GSMScanEvent\|SystemStoreState\|SystemInfoResponse\|SystemHealthMetrics\|MonitorableInterface\|NetworkInterfaceDTO" --include="*.ts" src/ | wc -l
# Expected: all references updated, 0 compilation errors
```

---

## 7. Task 4.2.5: Replace Duplicate Definitions

For each batch: delete the duplicate definition from the non-canonical file, add an `import type` from the canonical location.

### Batch 1: 5-copy types

#### KismetDevice

**Canonical**: `src/lib/types/kismet.ts:1` (13 importers, most widely used)

Merge fields from `server/kismet/types.ts:536` into canonical (add `firstSeen`, `clients`, `probeRequests`, `macaddr` as optional fields).

**Deletions** (4 files):

1. `src/lib/types/signals.ts:84` -- Delete lines 84-108. Rename to `RawKismetDevice` if any code references the dot-notation shape, otherwise delete entirely.
    - Importers: 0 (no file imports `KismetDevice` from `types/signals.ts`)

2. `src/lib/services/api/kismet.ts:25` -- Delete lines 25-57.
    - Importers of `KismetDevice` from this file: 0 (only `KismetStatus` imported from here)
    - Add: `import type { KismetDevice } from '$lib/types/kismet';` at top if any internal usage

3. `src/lib/server/services/kismet.service.ts:7` -- Delete lines 7-28.
    - Importers: 0 (file itself has 0 importers)
    - Add: `import type { KismetDevice } from '$lib/types/kismet';`

4. `src/lib/server/kismet/types.ts:536` -- Delete lines 536-560.
    - Importers of `KismetDevice` from this file: 1 (`integration-example.svelte`)
    - Update `integration-example.svelte:9`: change import path to `$lib/types/kismet`

**Verification**:

```bash
grep -rn "export.*interface KismetDevice" --include="*.ts" src/
# Expected: exactly 1 result in src/lib/types/kismet.ts
npx tsc --noEmit 2>&1 | grep -i "kismetdevice" | head -10
```

### Batch 2: 4-copy types

#### SpectrumData

**Canonical**: `src/lib/server/hackrf/types.ts:38` (7 importers, server-side pipeline)

**Renames** (not deletions -- different shapes):

1. `src/lib/stores/hackrf.ts:5` -- Rename `SpectrumData` to `SpectrumSnapshot`
    - This is an array-based client representation (frequencies[], power[])
    - Importers: check for `type { SpectrumData }` from `stores/hackrf` -- none found (store exports the writable, not the type by name in imports)
    - The `spectrumData` store variable name stays the same (it is a `Writable<SpectrumSnapshot | null>`)

2. `src/lib/services/api/hackrf.ts:48` -- Rename `SpectrumData` to `SpectrumAPIResponse`
    - Importers of `SpectrumData` from this file: 1 (`StatusDisplay.svelte:4`)
    - Update that import

3. `src/lib/server/gnuradio/spectrum_analyzer.ts:4` -- Rename `SpectrumData` to `GNURadioSample`
    - Importers: 0

**Verification**:

```bash
grep -rn "export.*interface SpectrumData\|export.*type SpectrumData" --include="*.ts" src/
# Expected: exactly 1 result in server/hackrf/types.ts
npx tsc --noEmit 2>&1 | grep -i "spectrumdata\|spectrumsnapshot\|gnuradiosample" | head -10
```

### Batch 3: 3-copy types

#### ServiceStatus

**Canonical**: `src/types/system.d.ts:90` (ambient declaration, superset)

1. `src/lib/stores/connection.ts:22` -- Rename to `ServiceConnectionState` (uses `running: boolean` instead of status union)
    - Importers: internal to connection store only

2. `src/lib/services/api/system.ts:49` -- Delete. Replace with import from system.d.ts.
    - Note: system.d.ts is an ambient declaration file, types are globally available. No import needed; just delete the local definition.
    - Importers: 0

#### KismetStatus

**Canonical**: `src/lib/server/kismet/types.ts:148` (superset with interface, channels, metrics, config)

1. `src/lib/types/kismet.ts:52` -- Delete lines 52-55. Add `import type { KismetStatus } from '$lib/server/kismet/types'` and re-export.
    - Importers: files that import `KismetStatus` from `types/kismet` -- check `stores/kismet.ts:9`
    - The barrel re-export maintains backward compatibility

2. `src/lib/services/api/kismet.ts:16` -- Delete lines 16-23. Add import from `$lib/server/kismet/types`.
    - Importers: 0

#### CoralPrediction

**Canonical**: `src/lib/services/localization/types.ts:39` (shared types file for localization domain)

1. `src/lib/services/localization/coral/CoralAccelerator.ts:12` -- Delete lines 12-16. Add:

    ```typescript
    import type { CoralPrediction } from '../types';
    ```

2. `src/lib/services/localization/coral/CoralAccelerator.v2.ts:9` -- Delete lines 9-13. Add:
    ```typescript
    import type { CoralPrediction } from '../types';
    ```

#### NetworkPacket

**Canonical**: `src/lib/server/wireshark.ts:4` (base type)

1. `src/lib/server/kismet/types.ts:222` -- Delete lines 222-232. The `NetworkPacket` there uses `sourceIP/destIP` instead of `src_ip/dst_ip` and has `hostname/suspicious` fields not in the base. Rename to `KismetPacket` if referenced internally, otherwise delete.
    - Check internal references:

    ```bash
    grep -n "NetworkPacket" src/lib/server/kismet/types.ts
    ```

2. `src/lib/stores/packetAnalysisStore.ts:5` -- KEEP. Already correctly extends `BaseNetworkPacket` from wireshark.ts. No change needed.

### Batch 4: 2-copy types

#### Localization group (4 types, all identical copies)

**Canonical**: `src/lib/services/localization/types.ts` (dedicated types file)

For each of `RSSIMeasurement`, `GeoBounds`, `GPRPrediction`, `SourceEstimate`:

**File**: `src/lib/services/localization/RSSILocalizer.ts`

- Delete the local interface definitions (lines 6-38)
- Add: `import type { RSSIMeasurement, GeoBounds, GPRPrediction, SourceEstimate } from './types';`
- Importers of these types from RSSILocalizer.ts: 0 (only integration-example.ts, commented out)

#### SignalMarker

**Canonical**: `src/lib/stores/map/signals.ts:6` (19 importers -- by far the most used type in the codebase)

1. `src/lib/types/signals.ts:27` -- Delete lines 27-38. The version here has a `position: Position` field not present in the canonical. Check if `Position` is referenced:
    ```bash
    grep -rn "position:" --include="*.ts" src/lib/types/signals.ts
    ```
    The `SignalCluster` in the same file also uses `position: Position`. Both should reference the canonical SignalMarker.
    - Importers of `SignalMarker` from `types/signals.ts`: 1 (`components/map/SignalInfoCard.svelte:2`)
    - Update that import to `$lib/stores/map/signals`

#### SignalCluster

**Canonical**: `src/lib/services/map/signalClustering.ts:31` (3 importers, contains implementation)

1. `src/lib/types/signals.ts:52` -- Delete lines 52-57. This version uses `position: Position` (a type not defined in the file). The canonical uses explicit `lat: number; lon: number` and has `bounds` and richer `stats`.
    - Importers from `types/signals.ts` for `SignalCluster`: 0

#### SweepStatus

**Canonical**: `src/lib/stores/hackrf.ts:36` (used by frontend components)

Note: The two versions have completely different field names (`active` vs `state`, `startFreq/endFreq` vs `currentFrequency`). These are genuinely different shapes.

1. `src/lib/server/hackrf/types.ts:22` -- Rename to `SweepManagerStatus`
    - Importers: 1 (`routes/api/hackrf/cycle-status/+server.ts:3`)
    - Update that import

#### SpatialQuery

**Canonical**: `src/lib/services/db/signalDatabase.ts:38` (superset with time and limit fields)

1. `src/lib/server/db/types.ts:60` -- Delete lines 60-65.
    - Importers of `SpatialQuery` from `server/db/types.ts`: 0 (checked)
    - Note: The `server/db/types.ts` version is a subset (no `startTime`, `endTime`, `limit`). Those fields are in a separate `TimeQuery` interface. If any code combines `SpatialQuery & TimeQuery` from this file, it should use the unified `SpatialQuery` from signalDatabase.ts instead.

#### SignalDetection

**Canonical**: `src/lib/services/api/hackrf.ts:40` (3 importers)

1. `src/lib/server/gnuradio/types.ts:11` -- Rename to `GNURadioSignalDetection`
    - Uses `centerFrequency` instead of `frequency`, `timestamp: Date` instead of `number`
    - Importers: 0

#### KismetScript

**Canonical**: `src/lib/server/kismet/types.ts:592` (superset with arguments, timeout, enabled, executable)

1. `src/lib/services/api/kismet.ts:58` -- Delete lines 58-64. Add import from `$lib/server/kismet/types`.
    - Importers: 0

#### KismetConfig

**Canonical**: `src/lib/server/kismet/types.ts:130` (superset with auth, ports, toggles)

1. `src/lib/services/api/kismet.ts:75` -- Delete lines 75-85. Add import from `$lib/server/kismet/types`.
    - Importers: 0

#### KismetAlert

**Canonical**: `src/lib/types/kismet.ts:37` (typed severity/type unions, richer details)

1. `src/lib/server/kismet/types.ts:345` -- Delete lines 345-353. Add:
    ```typescript
    import type { KismetAlert } from '$lib/types/kismet';
    ```

    - Importers of `KismetAlert` from `server/kismet/types.ts`: 0

#### DeviceFilter

**Canonical**: `src/lib/server/kismet/types.ts:565` (superset with signalStrength range, lastSeen dates, location radius)

1. `src/lib/services/api/kismet.ts:87` -- Delete lines 87-95. Add import from `$lib/server/kismet/types`.
    - Importers: 0

#### KismetMessage

Both versions are genuinely different:

- `types/signals.ts:137` extends `WSMessage` with typed `data` containing `devices[]` and `status`
- `websocket/kismet.ts:16` is a minimal `{ type: string; data?: unknown }`

1. `src/lib/services/websocket/kismet.ts:16` -- Rename to `KismetWSFrame` (raw WebSocket frame before parsing)
    - Used only within the KismetWebSocketClient class in the same file

#### HackRFMessage

Same pattern as KismetMessage:

- `types/signals.ts:146` extends `WSMessage` with typed `data: HackRFData | HackRFData[]`
- `websocket/hackrf.ts:20` is minimal `{ type: string; data?: unknown }`

1. `src/lib/services/websocket/hackrf.ts:20` -- Rename to `HackRFWSFrame`
    - Used only within the HackRFWebSocketClient class in the same file

#### HackRFConfig

Different shapes representing different concepts:

- `stores/hackrf.ts:85` -- device-level config (gain, lnaGain, vgaGain, centerFreq)
- `api/hackrf.ts:25` -- sweep config (startFreq, endFreq, binSize, amplifierEnabled)

1. `src/lib/services/api/hackrf.ts:25` -- Rename to `HackRFSweepConfig`
    - Importers: 0 (no external import of `HackRFConfig` from this file)

#### GPSPosition

Different field names:

- `gpsStore.ts:3` -- `{ lat, lon }` (short form, 17+ importers via store)
- `kismet.service.ts:32` -- `{ latitude, longitude }` (full form, 0 importers)

1. `src/lib/server/services/kismet.service.ts:32` -- Delete lines 32-35. This file has 0 importers.
    - If internal code uses it, replace with `import type { GPSPosition } from '$lib/stores/tactical-map/gpsStore'`

#### DeviceRecord

Both are type aliases pointing to the same base `Device` from `shared.ts`:

- `shared.ts:39` -- `type DeviceRecord = Device`
- `signalDatabase.ts:26` -- `type DeviceRecord = SharedDeviceRecord` (which is `Device` from shared.ts)

1. `src/lib/services/db/signalDatabase.ts:26` -- Delete line 26. Already imports `SharedDeviceRecord` from shared.ts. Use `SharedDeviceRecord` directly throughout the file, or rename import: `import type { DeviceRecord } from '$lib/types/shared'`.

**Final Batch 4 Verification**:

```bash
npx tsc --noEmit 2>&1 | head -30
# Expected: 0 errors
```

---

## 8. Risk Assessment

### Low Risk (type-only changes, compile-time verified)

- All changes are `import type` / `export type` modifications
- TypeScript strict mode catches any field mismatches at compile time
- No runtime behavior changes

### Medium Risk Areas

1. **KismetDevice canonical merge**: Merging 5 different field sets into one interface may cause some fields to become optional that were previously required. This is safe because all existing code already handles optional fields via `?.` access.

2. **SpectrumData renames**: Renaming `SpectrumData` in `stores/hackrf.ts` to `SpectrumSnapshot` affects the type annotation of the `spectrumData` writable store. All subscribers access the store value, not the type name, so this is safe.

3. **ServiceStatus shape difference**: The canonical (system.d.ts) uses `status: 'running'|'stopped'|'error'|'unknown'` while `stores/connection.ts` uses `running: boolean`. The rename to `ServiceConnectionState` avoids forcing a field change.

### Mitigations

- Run `npx tsc --noEmit` after EVERY batch (not just at the end)
- Run `npm run lint` after all batches complete
- If a batch fails compilation, revert that batch only (`git checkout -- <files>`)
- Commit after each successful batch for granular rollback

---

## 9. Verification Checklist

Run these commands after ALL tasks are complete:

```bash
# 1. Zero duplicate type names (excluding semantic conflicts that were renamed)
grep -rn "^export \(type\|interface\) KismetDevice " --include="*.ts" src/ | wc -l
# Expected: 1

grep -rn "^export \(type\|interface\) SpectrumData " --include="*.ts" src/ | wc -l
# Expected: 1

grep -rn "^export \(type\|interface\) CoralPrediction " --include="*.ts" src/ | wc -l
# Expected: 1

grep -rn "^export \(type\|interface\) ProcessState " --include="*.ts" src/ | wc -l
# Expected: 1

grep -rn "^export \(type\|interface\) BufferState " --include="*.ts" src/ | wc -l
# Expected: 1

# 2. Barrel file exists and compiles
test -f src/lib/types/index.ts && echo "EXISTS" || echo "MISSING"

# 3. Shared sweep-manager types exist
test -f src/lib/services/sweep-manager/types.ts && echo "EXISTS" || echo "MISSING"

# 4. Full compilation passes
npx tsc --noEmit 2>&1 | tail -5
# Expected: no errors

# 5. Lint passes
npm run lint 2>&1 | tail -5

# 6. Semantic conflict renames applied
grep -rn "HardwareConnectionState" --include="*.ts" src/ | wc -l
# Expected: >= 1

grep -rn "SpectrumSnapshot" --include="*.ts" src/ | wc -l
# Expected: >= 1

grep -rn "SweepManagerStatus" --include="*.ts" src/ | wc -l
# Expected: >= 1

# 7. No remaining non-exported KismetSystemStatus duplicates
grep -rn "^interface KismetSystemStatus" --include="*.ts" src/ | wc -l
# Expected: 0 (now exported from webSocketManager.ts)

# 8. Total exported duplicate count (should be 0 for merged types)
for type in ProcessConfig ParsedLine BufferConfig RSSIMeasurement SourceEstimate GeoBounds GPRPrediction; do
  count=$(grep -rn "^export \(type\|interface\) ${type} " --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} (expected 1)"
done
```

---

## 10. Rollback Strategy

### Per-Batch Rollback

Each batch is committed separately. To rollback batch N:

```bash
git revert <batch-N-commit-hash>
```

### Full Rollback

```bash
git log --oneline -10  # Find the commit before Phase 4.2 started
git revert --no-commit HEAD~N..HEAD  # Revert all Phase 4.2 commits
git commit -m "revert: rollback Phase 4.2 type deduplication"
```

### Partial Rollback (single type)

If a single type rename causes issues downstream:

1. Restore the deleted duplicate definition in the non-canonical file
2. Remove the added import line
3. `npx tsc --noEmit` to verify

---

## 11. Commit Plan

```
commit 1: "refactor: extract shared sweep-manager types for HackRF/USRP"
           (Task 4.2.2)

commit 2: "refactor: create canonical type barrel at src/lib/types/index.ts"
           (Task 4.2.3)

commit 3: "refactor: resolve 9 semantic type conflicts via renames"
           (Task 4.2.4)

commit 4: "refactor: deduplicate KismetDevice from 5 copies to 1"
           (Batch 1)

commit 5: "refactor: deduplicate SpectrumData from 4 copies to 1"
           (Batch 2)

commit 6: "refactor: deduplicate 3-copy types (ServiceStatus, KismetStatus, CoralPrediction, NetworkPacket)"
           (Batch 3)

commit 7: "refactor: deduplicate 2-copy types (16 types consolidated)"
           (Batch 4)
```

Each commit must pass `npx tsc --noEmit` independently.

---

## Appendix A: Files Requiring Import Updates (Estimated)

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
