# Phase 4.2.0: Audit Divergent Fields -- Type Duplicate Inventory and Field Divergence Analysis

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA Rule 8.2 (Type Compatibility), CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                                  |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                                        |
| **Task ID**      | 4.2.0                                                                            |
| **Title**        | Audit Divergent Fields -- Type Duplicate Inventory and Field Divergence Analysis |
| **Status**       | PLANNED                                                                          |
| **Risk Level**   | LOW (read-only task, no code changes)                                            |
| **Duration**     | 30 minutes                                                                       |
| **Dependencies** | None (standalone, first task in Phase 4.2)                                       |
| **Blocks**       | ALL subsequent Phase 4.2 tasks (4.2.1 through 4.2.7)                             |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                                |
| **Commit**       | N/A (read-only reference document, no code changes)                              |

---

## Objective

For each duplicate type set in the Argos codebase, determine which copy is canonical and what fields diverge across copies. This task is READ-ONLY. No code changes are made. The output is the complete field comparison matrix below, which serves as the authoritative reference for all downstream deduplication tasks (4.2.1 through 4.2.7).

---

## Current State Assessment

### Inventory Summary

| Metric                                 | Value                        |
| -------------------------------------- | ---------------------------- |
| Duplicate type names (exported)        | 39                           |
| Non-exported duplicates                | 1 (KismetSystemStatus)       |
| Total duplicate definitions            | 89                           |
| Definitions to remove                  | 45                           |
| Semantic conflicts (cannot merge)      | 5                            |
| Files requiring import updates         | ~35                          |
| Barrel file (`src/lib/types/index.ts`) | DOES NOT EXIST (must create) |

### Duplicate Classification

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

---

## Complete Duplicate Location Registry

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
Task 4.2.7 Batch 4 (2-copy types).

---

## Field Divergence Matrix

### KismetDevice (5 copies)

| Field             |     types/kismet.ts     |             types/signals.ts             |          api/kismet.ts          |  kismet.service.ts   |            server/kismet/types.ts            |
| ----------------- | :---------------------: | :--------------------------------------: | :-----------------------------: | :------------------: | :------------------------------------------: |
| mac/macaddr       |      `mac: string`      |       `kismet.device.base.macaddr`       |          `mac: string`          |    `mac: string`     |      `mac: string` + `macaddr: string`       |
| signal            |       nested obj        |         nested obj (kismet keys)         |    `signalStrength?: number`    |      nested obj      | `signalStrength: number` + `signal?: number` |
| location          |      `{lat, lon}`       | `{avg_lat, avg_lon, last_lat, last_lon}` |       `lat?, lon?, gps?`        |     `{lat, lon}`     |      `{latitude, longitude, accuracy?}`      |
| time fields       | `last_seen, last_time?` |         `first_time, last_time`          | `firstSeen, lastSeen` (strings) | `last_seen` (number) |       `firstSeen, lastSeen` (numbers)        |
| naming convention |        camelCase        |           kismet dot-notation            |            camelCase            |    snake_case mix    |                  camelCase                   |

**Canonical choice**: `src/lib/types/kismet.ts:1`
**Rationale**: Most imported (13 files). Represents the app-layer normalized shape. The `types/signals.ts:84` copy uses raw Kismet API dot-notation and should be renamed to `RawKismetDevice`. The `server/kismet/types.ts:536` and `api/kismet.ts:25` copies are supersets with extra fields that should be merged into the canonical. The `kismet.service.ts:7` copy is dead code (0 importers).

### SpectrumData (4 copies)

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

### SystemInfo (3 copies) -- SEMANTIC CONFLICT

| Aspect    |                      system.d.ts                       |                    systemStore.ts                    |               api/system.ts               |
| --------- | :----------------------------------------------------: | :--------------------------------------------------: | :---------------------------------------: |
| Shape     | Full OS info with CPUInfo/MemoryInfo/DiskInfo subtypes | Flat with wifi interfaces, cpu/memory/storage inline | Flat with loadAverage, network.interfaces |
| Importers |             0 (declaration file, ambient)              |               0 (used inline by store)               |       0 (used inline by API class)        |

**Resolution**: All three serve different layers. The `system.d.ts` version is the most complete ambient declaration. The store and API versions are response DTOs used only within their own files. Keep all three as-is but rename:

- `system.d.ts` -> keep as `SystemInfo` (ambient, canonical)
- `systemStore.ts` -> rename to `SystemStoreState`
- `api/system.ts` -> rename to `SystemInfoResponse`

### ServiceStatus (3 copies) -- SUPERSET

| Field        |                    system.d.ts                     | stores/connection.ts |              api/system.ts              |
| ------------ | :------------------------------------------------: | :------------------: | :-------------------------------------: |
| status field | `status: 'running'\|'stopped'\|'error'\|'unknown'` |  `running: boolean`  | `status: 'running'\|'stopped'\|'error'` |
| error field  |                  `error?: string`                  |        absent        |                 absent                  |

**Canonical choice**: `src/types/system.d.ts:90`
**Rationale**: Superset with typed status union and error field. The `stores/connection.ts:22` version uses `running: boolean` which loses information.

### NetworkPacket (3 copies) -- EXTENSION CHAIN

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

### NetworkInterface (3 copies) -- SEMANTIC CONFLICT

| Field     |               system.d.ts                |     api/system.ts      |     server/networkInterfaces.ts     |
| --------- | :--------------------------------------: | :--------------------: | :---------------------------------: |
| addresses |              `ip?: string`               | `addresses: string[]`  |        `addresses: string[]`        |
| type      | `'ethernet'\|'wifi'\|'virtual'\|'other'` |        `string`        | absent (uses `isWireless: boolean`) |
| status    |          `status: 'up'\|'down'`          | `status: 'up'\|'down'` |           `isUp: boolean`           |
| extra     |             `speed?, stats?`             |     `mac: string`      |     `supportsMonitor?: boolean`     |

**Resolution**: Three different representations. The `server/networkInterfaces.ts:4` version is used for monitor-mode detection (RF-specific). Keep it as `MonitorableInterface`. Make `system.d.ts` canonical for general system display.

### Other Types with Identical Copies (no field divergence)

- RSSIMeasurement: identical in both files
- SourceEstimate: identical in both files
- GeoBounds: identical in both files
- GPRPrediction: identical in both files
- CoralPrediction: identical in all 3 files (1 deleted in Phase 4.1)
- ProcessState: identical in both files
- ProcessConfig: identical in both files
- ParsedLine: identical in both files
- BufferState: identical in both files
- BufferConfig: identical in both files

---

## Execution Steps

1. **Review** the complete duplicate location registry above.
2. **Verify** each canonical choice by running importer counts:
    ```bash
    grep -rn "from.*types/kismet" --include="*.ts" --include="*.svelte" src/ | wc -l
    grep -rn "from.*server/hackrf/types" --include="*.ts" src/ | wc -l
    grep -rn "from.*stores/map/signals" --include="*.ts" --include="*.svelte" src/ | wc -l
    ```
3. **Confirm** each divergent field set against the live codebase:
    ```bash
    grep -A 20 "export interface KismetDevice" src/lib/types/kismet.ts
    grep -A 20 "export interface KismetDevice" src/lib/server/kismet/types.ts
    ```
4. **Record** any newly discovered divergences not captured in this document.
5. **Sign off** this document as the authoritative reference for Tasks 4.2.1-4.2.7.

---

## Verification

**Command 1 -- Validate duplicate count**:

```bash
for type in KismetDevice SpectrumData SystemInfo ServiceStatus NetworkPacket NetworkInterface KismetStatus CoralPrediction; do
  count=$(grep -rn "export.*interface ${type} \|export.*interface ${type}{" --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions"
done
```

**Expected**: KismetDevice=5, SpectrumData=4, SystemInfo=3, ServiceStatus=3, NetworkPacket=3, NetworkInterface=3, KismetStatus=3, CoralPrediction=3 (or 2 if Phase 4.1 already executed).

**Command 2 -- Validate 2-copy types exist**:

```bash
for type in ProcessState ProcessConfig ParsedLine BufferState BufferConfig RSSIMeasurement SourceEstimate GeoBounds GPRPrediction; do
  count=$(grep -rn "export.*interface ${type} \|export.*interface ${type}{" --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions"
done
```

**Expected**: Each returns 2.

---

## Risk Assessment

| Risk                        | Likelihood | Impact | Mitigation                                        |
| --------------------------- | ---------- | ------ | ------------------------------------------------- |
| Missed duplicate definition | LOW        | LOW    | Audit is read-only; downstream tasks catch misses |
| Wrong canonical choice      | LOW        | MEDIUM | Canonical choices based on importer count + scope |
| Field divergence missed     | LOW        | LOW    | TypeScript compiler catches mismatches at compile |

---

## Rollback Strategy

This task produces no code changes. If the audit findings are later found incorrect, update this reference document and adjust downstream task plans accordingly.

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                                      |
| ---------------- | -------------------------- | ------------------------------------------------------------------ |
| CERT DCL60-CPP   | Obey One-Definition Rule   | Each type must have exactly one canonical definition               |
| NASA/JPL Rule 15 | Single Point of Definition | All type duplicates identified for consolidation                   |
| MISRA Rule 8.2   | Type Compatibility         | Field divergence matrix ensures merge safety                       |
| BARR-C Rule 1.3  | No Duplicate Definitions   | Complete inventory of all 89 duplicate definitions across 39 names |

---

## Cross-References

- **Depends on**: None
- **Blocks**: Phase-4.2.1 (Sweep-Manager Shared Types), Phase-4.2.2 (Canonical Type Barrel), Phase-4.2.3 (Semantic Conflict Resolution), Phase-4.2.4 through Phase-4.2.7 (Duplicate Replacement Batches)
- **Related**: TYPE_DUPLICATE_AUDIT.md (source audit data)
- **Related**: Phase 4.1 (Dead Code Elimination -- removes CoralAccelerator.v2.ts)

---

## Execution Tracking

| Subtask | Description                                  | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.0.1 | Verify duplicate location registry           | PENDING | --      | --        | --          |
| 4.2.0.2 | Verify field divergence for 5+ copy types    | PENDING | --      | --        | --          |
| 4.2.0.3 | Verify field divergence for 3-4 copy types   | PENDING | --      | --        | --          |
| 4.2.0.4 | Verify canonical choices via importer counts | PENDING | --      | --        | --          |
| 4.2.0.5 | Sign off reference document                  | PENDING | --      | --        | --          |
