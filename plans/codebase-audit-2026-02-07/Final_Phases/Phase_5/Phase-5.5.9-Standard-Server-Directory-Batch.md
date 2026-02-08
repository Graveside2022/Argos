# Phase 5.5.9 -- Standard Server Directory Batch

| Field                | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.9                                                           |
| **Phase**            | 5.5.9                                                                        |
| **Title**            | Standard Functions in server/ Directory (18 functions, 60-99 lines)          |
| **Risk Level**       | LOW -- small overages requiring 1-2 extractions each                         |
| **Prerequisites**    | Phase 5.5.0 (Assessment), CRITICAL and HIGH functions in same files complete |
| **Estimated Effort** | 2 hours                                                                      |
| **Files Touched**    | 14 existing files modified                                                   |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7   |
| **Audit Date**       | 2026-02-08                                                                   |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                          |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                        |

---

## 1. Objective

Decompose all 18 STANDARD-priority functions (60-99 lines) residing in the `src/lib/server/` directory tree. These are small overages (1-39 lines over the 60-line limit) that typically require only 1-2 extractions each.

---

## 2. Function Inventory

| #   | Lines | File                                                       | Function                      | Pattern to Apply                                                                                    |
| --- | ----- | ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | 99    | `server/agent/runtime.ts:104`                              | `processWithAnthropic`        | Extract-and-Name: extract `buildAnthropicRequest()`, `parseAnthropicStream()`                       |
| 2   | 97    | `server/websocket-server.ts:27`                            | `initializeWebSocketServer`   | Extract-and-Name: extract `configureCompression()`, `registerMessageHandlers()`, `setupHeartbeat()` |
| 3   | 90    | `server/gsm-database-path.ts:13`                           | `resolveGsmDatabasePath`      | Early-Return: add guard clauses for env vars, reduce nesting by 3 levels                            |
| 4   | 88    | `server/hardware/detection/serial-detector.ts:16`          | `detectGPSModules`            | Data-Driven: define GPS device matchers as lookup table, loop over them                             |
| 5   | 86    | `server/db/signalRepository.ts:65`                         | `insertSignalsBatch`          | Extract-and-Name: extract `buildInsertSQL()` and `bindSignalValues()`                               |
| 6   | 86    | `server/hardware/detection/hardware-detector.ts:20`        | `scanAllHardware`             | Extract-and-Name: extract per-category scanners, reduce orchestrator                                |
| 7   | 84    | `server/db/migrations/runMigrations.ts:5`                  | `runMigrations`               | Extract-and-Name: extract `loadMigrationFiles()`, `checkMigrationStatus()`, `executeMigration()`    |
| 8   | 80    | `server/kismet/kismet_controller.ts:420`                   | `stopExternalKismetProcesses` | Early-Return: add guard clauses, extract `findKismetPIDs()` and `terminateProcesses()`              |
| 9   | 79    | `server/agent/runtime.ts:257`                              | `createAgent`                 | Extract-and-Name: extract `buildAgentConfig()`, `registerAgentTools()`                              |
| 10  | 74    | `server/wireshark.ts:54`                                   | `tryRealCapture`              | Early-Return: add interface validation guard, extract `buildTsharkArgs()`                           |
| 11  | 70    | `server/kismet/device_intelligence.ts:355`                 | `performClassification`       | Data-Driven: extract classification rules to lookup table                                           |
| 12  | 70    | `server/hardware/resourceManager.ts:32`                    | `scanForOrphans`              | Extract-and-Name: extract `identifyOrphanProcesses()`, `identifyOrphanPorts()`                      |
| 13  | 68    | `server/kismet/kismet_controller.ts:646`                   | `enrichDeviceData`            | Extract-and-Name: extract `enrichWithSignalData()`, `enrichWithLocationData()`                      |
| 14  | 65    | `server/agent/tool-execution/detection/tool-mapper.ts:101` | `generateNamespace`           | Early-Return: add guard clauses for invalid inputs, flatten conditional chain                       |
| 15  | 65    | `server/hardware/detection/serial-detector.ts:108`         | `detectCellularModems`        | Data-Driven: define modem matchers as lookup table (same pattern as GPS detector)                   |
| 16  | 64    | `server/kismet/device_tracker.ts:402`                      | `updateStatistics`            | Extract-and-Name: extract `calculateSignalStats()`, `calculateTimeStats()`                          |
| 17  | 63    | `server/agent/tool-execution/detection/tool-mapper.ts:30`  | `mapToExecutionTool`          | Data-Driven: replace if-else chain with strategy map                                                |
| 18  | 62    | `server/wifite/processManager.ts:271`                      | `buildArgs`                   | Data-Driven: define argument templates as data structure, iterate to build                          |

**Note**: Function #1 (`processWithAnthropic`) is listed at 99 lines in this batch. It was originally identified as a multi-line-signature miss at 99 lines. If the CRITICAL-remaining batch (5.5.5) already handles it at >150 lines (when its full handler chain is counted), skip it here and note the deduction.

---

## 3. Multi-Function File Processing Order

Several files contain multiple oversized functions. These must be processed as a unit (single commit per file):

| File                                                   | Oversized Functions                               | Counts |
| ------------------------------------------------------ | ------------------------------------------------- | ------ |
| `server/agent/runtime.ts`                              | `processWithAnthropic`, `createAgent`             | 99, 79 |
| `server/kismet/kismet_controller.ts`                   | `stopExternalKismetProcesses`, `enrichDeviceData` | 80, 68 |
| `server/hardware/detection/serial-detector.ts`         | `detectGPSModules`, `detectCellularModems`        | 88, 65 |
| `server/agent/tool-execution/detection/tool-mapper.ts` | `generateNamespace`, `mapToExecutionTool`         | 65, 63 |

**Processing order**: Files with multiple functions first, then single-function files.

---

## 4. Detailed Decomposition Plans

### 4.1 `initializeWebSocketServer` (97 lines, websocket-server.ts)

**Current structure**: 5 inline blocks (compression config, server creation, message handlers, heartbeat, cleanup).

**Extraction plan**:
| New Function | Lines | Extracted From |
| --------------------------- | ----- | --------------------------- |
| `configureCompression()` | 12-18 | Lines 28-45 (compression) |
| `registerMessageHandlers()` | 25-30 | Lines 55-85 (ws.on blocks) |
| `setupHeartbeat()` | 15-20 | Lines 90-110 (setInterval) |

**Post-decomposition**: `initializeWebSocketServer` becomes 25-30 lines.

### 4.2 `resolveGsmDatabasePath` (90 lines, gsm-database-path.ts)

**Current structure**: 4 levels of nested if/else for env var resolution.

**Early-Return conversion**:

```typescript
// BEFORE: 4 levels nesting, 90 lines
if (envPath) { if (exists) { if (isFile) { if (size > 0) { ... } else { ... } } else { ... } } else { ... } } else { ... }

// AFTER: 1 level nesting, ~45 lines
if (!envPath) return resolveDefaultPath(config);
if (!exists) return handleMissingPath(envPath, config);
const stats = statSync(envPath);
if (!stats.isFile()) return handleDirectoryPath(envPath, config);
if (stats.size === 0) return handleEmptyFile(envPath, config);
return envPath;
```

**New helper functions**: `resolveDefaultPath()`, `handleMissingPath()`, `handleDirectoryPath()`, `handleEmptyFile()` -- each 10-15 lines.

### 4.3 `detectGPSModules` (88 lines, serial-detector.ts) + `detectCellularModems` (65 lines)

**Data-driven conversion** (same pattern for both):

```typescript
const GPS_DEVICE_MATCHERS: DeviceMatcher[] = [
	{ vendor: '1546', product: '01a7', name: 'u-blox 7', type: 'gps' },
	{ vendor: '067b', product: '2303', name: 'Prolific PL2303', type: 'serial-gps' }
	// ... more entries ...
];

async function detectGPSModules(): Promise<GPSDevice[]> {
	const devices = await listUSBDevices();
	return devices.map((d) => matchDevice(d, GPS_DEVICE_MATCHERS)).filter(Boolean);
}
```

### 4.4 `insertSignalsBatch` (86 lines, signalRepository.ts)

**Extraction plan**:
| New Function | Lines | Responsibility |
| --------------------------------- | ----- | --------------------------------------- |
| `buildBatchInsertSQL(count)` | 15-20 | Generate parameterized INSERT statement |
| `bindSignalValues(signal, index)` | 15-20 | Map signal object to parameter positions|

**Post-decomposition**: `insertSignalsBatch` becomes 30-40 lines (transaction wrapper + loop).

### 4.5 `performClassification` (70 lines, device_intelligence.ts)

**Data-driven conversion**:

```typescript
const CLASSIFICATION_RULES: ClassificationRule[] = [
	{ match: (d) => d.type === 'AP' && d.encryption === 'Open', result: 'rogue-ap' },
	{ match: (d) => d.type === 'AP' && d.channel > 14, result: '5ghz-ap' }
	// ... more rules ...
];

function performClassification(device: KismetDevice): Classification {
	const rule = CLASSIFICATION_RULES.find((r) => r.match(device));
	return rule ? rule.result : 'unknown';
}
```

---

## 5. Verification

### 5.1 Batch Verification

```bash
for f in server/websocket-server.ts server/gsm-database-path.ts server/hardware/detection/serial-detector.ts \
         server/db/signalRepository.ts server/hardware/detection/hardware-detector.ts \
         server/db/migrations/runMigrations.ts server/kismet/kismet_controller.ts \
         server/agent/runtime.ts server/wireshark.ts server/kismet/device_intelligence.ts \
         server/hardware/resourceManager.ts server/agent/tool-execution/detection/tool-mapper.ts \
         server/kismet/device_tracker.ts server/wifite/processManager.ts; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files

npm run build && npm run typecheck
```

---

## 6. Test Requirements

STANDARD functions typically produce 1-2 extracted helper functions each. Test requirements per Phase 5.5 Section 11.1:

- Pure data transformers: 3+ test cases each
- Guard/validator functions: 4+ test cases each
- Data-driven lookup tables: verify table completeness (all known cases have entries)

**Estimated test effort**: 18 functions x ~7 min/function = ~2 hours

---

## 7. Commit Strategy

```
refactor(phase-5.5): decompose 2 functions in runtime.ts (99+79 -> <60 each)
refactor(phase-5.5): decompose initializeWebSocketServer (97 -> 28 lines)
refactor(phase-5.5): decompose resolveGsmDatabasePath via early-return (90 -> 45 lines)
refactor(phase-5.5): decompose 2 functions in serial-detector.ts via data-driven (88+65 -> <60 each)
refactor(phase-5.5): decompose insertSignalsBatch (86 -> 35 lines)
refactor(phase-5.5): decompose scanAllHardware (86 -> <60 lines)
refactor(phase-5.5): decompose runMigrations (84 -> <60 lines)
refactor(phase-5.5): decompose 2 functions in kismet_controller.ts (80+68 -> <60 each)
refactor(phase-5.5): decompose tryRealCapture (74 -> <60 lines)
refactor(phase-5.5): convert performClassification to data-driven (70 -> <60 lines)
refactor(phase-5.5): decompose scanForOrphans (70 -> <60 lines)
refactor(phase-5.5): decompose 2 functions in tool-mapper.ts (65+63 -> <60 each)
refactor(phase-5.5): decompose updateStatistics (64 -> <60 lines)
refactor(phase-5.5): convert buildArgs to data-driven (62 -> <60 lines)
```

---

## 8. Cross-Phase Notes

- **Phase 5.5.2**: `wireshark.ts` has CRITICAL-02 (`setupPacketStream`, 272 lines) handled in sub-task 5.5.2. Process `tryRealCapture` (74 lines) in the same commit with CRITICAL-02 to avoid intermediate states.
- **Phase 5.5.2**: `device_intelligence.ts` has CRITICAL-03 (`initializeOUIDatabase`, 219 lines) handled in sub-task 5.5.2. Process `performClassification` (70 lines) in the same commit.
- **Phase 5.2**: `sweepManager.ts:1123` `_performRecovery` (61 lines) is marked as HANDLED BY PHASE 5.2. It appears in the inventory table but requires NO action in Phase 5.5.

---

**END OF DOCUMENT**
