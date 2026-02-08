# Phase 5.5.10 -- Standard Services Directory Batch

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.10                                                        |
| **Phase**            | 5.5.10                                                                     |
| **Title**            | Standard Functions in services/ Directory (13 functions, 60-99 lines)      |
| **Risk Level**       | LOW -- small overages requiring 1-2 extractions each                       |
| **Prerequisites**    | Phase 5.5.0 (Assessment), HIGH functions in same files complete            |
| **Estimated Effort** | 1.5 hours                                                                  |
| **Files Touched**    | 7 existing files modified                                                  |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Objective

Decompose all 13 STANDARD-priority functions (60-99 lines) residing in the `src/lib/services/` directory tree. These are small overages (1-39 lines over the 60-line limit) that typically require only 1-2 extractions each.

---

## 2. Function Inventory

| #   | Lines | File                                                        | Function                   | Pattern to Apply                                                                                                    |
| --- | ----- | ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | 94    | `services/websocket/test-connection.ts:11`                  | `testWebSocketConnections` | Data-Driven: define test cases as array, execute via `Promise.all(tests.map(runTest))`                              |
| 2   | 91    | `services/drone/flightPathAnalyzer.ts:217`                  | `calculateEfficiency`      | Extract-and-Name: extract `calculateDistanceEfficiency()`, `calculateTimeEfficiency()`, `calculateFuelEfficiency()` |
| 3   | 75    | `services/recovery/errorRecovery.ts:212`                    | `attemptRecovery`          | Early-Return: guard clause for unrecoverable errors; extract `selectStrategy()`, `executeWithRetry()`               |
| 4   | 69    | `services/drone/flightPathAnalyzer.ts:312`                  | `detectAnomalies`          | Extract-and-Name: extract `detectSpeedAnomalies()`, `detectAltitudeAnomalies()`, `detectPathDeviation()`            |
| 5   | 68    | `services/drone/flightPathAnalyzer.ts:145`                  | `identifySignalHotspots`   | Extract-and-Name: extract `calculateSignalDensity()`, `findPeakRegions()`                                           |
| 6   | 67    | `services/map/networkAnalyzer.ts:254`                       | `exploreCluster`           | Extract-and-Name: extract `getClusterEdges()`, `calculateClusterMetrics()`                                          |
| 7   | 63    | `services/monitoring/systemHealth.ts:307`                   | `analyzeHealth`            | Extract-and-Name: extract `evaluateMetricThresholds()`, `generateHealthSummary()`                                   |
| 8   | 61    | `services/hackrf/sweep-manager/error/ErrorTracker.ts:130`   | `analyzeError`             | Data-Driven: define error patterns as lookup table, match against patterns                                          |
| 9   | 61    | `services/localization/coral/CoralAccelerator.v2.ts:32`     | `startProcess`             | Early-Return: guard clauses for device not found, already running; extract `configureAccelerator()`                 |
| 10  | 94    | `services/hackrf/sweep-manager/buffer/BufferManager.ts:197` | `parseSpectrumData`        | **HANDLED BY PHASE 5.2** (HackRF BufferManager deduplication) -- NO ACTION                                          |

**Note**: Entries 11-13 are additional functions identified by the v2 scanner in the 60-65 line range within the `services/` directory. They will be caught by the Phase 5.6 ESLint enforcement gate. Process them alongside their sibling functions in the same files.

---

## 3. Multi-Function File Processing

### 3.1 `flightPathAnalyzer.ts` -- THREE Oversized Functions

`src/lib/services/drone/flightPathAnalyzer.ts` contains THREE oversized functions (91, 69, 68 lines). Process this file as a unit -- all three functions decomposed in one commit.

| Function                 | Lines | Extraction Plan                                                                                   |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| `calculateEfficiency`    | 91    | Extract `calculateDistanceEfficiency()`, `calculateTimeEfficiency()`, `calculateFuelEfficiency()` |
| `detectAnomalies`        | 69    | Extract `detectSpeedAnomalies()`, `detectAltitudeAnomalies()`, `detectPathDeviation()`            |
| `identifySignalHotspots` | 68    | Extract `calculateSignalDensity()`, `findPeakRegions()`                                           |

**Post-decomposition**: Each original function becomes 20-30 lines. New helper functions are 15-25 lines each. All stay within the same file (file total remains under 300 lines).

### 3.2 `errorRecovery.ts` -- TWO Oversized Functions

`src/lib/services/recovery/errorRecovery.ts` has `registerDefaultStrategies` (106 lines, HIGH-07 in sub-task 5.5.7) AND `attemptRecovery` (75 lines, STANDARD). Process BOTH in one commit per sub-task 5.5.7 instructions.

---

## 4. Detailed Decomposition Plans

### 4.1 `testWebSocketConnections` (94 lines)

**Data-driven conversion**:

```typescript
const WS_TEST_CASES: TestCase[] = [
	{ name: 'main-server', url: 'ws://localhost:5173/ws', timeout: 5000 },
	{ name: 'hackrf-stream', url: 'ws://localhost:8092/ws', timeout: 3000 }
	// ... more test cases ...
];

async function runSingleWSTest(test: TestCase): Promise<TestResult> {
	// 20-30 lines: connect, verify, disconnect
}

async function testWebSocketConnections(): Promise<TestResult[]> {
	return Promise.all(WS_TEST_CASES.map(runSingleWSTest));
}
```

### 4.2 `calculateEfficiency` (91 lines)

**Extract-and-Name**:
| New Function | Lines | Responsibility |
| ------------------------------- | ----- | ------------------------------------------- |
| `calculateDistanceEfficiency()` | 20-25 | Straight-line vs actual path distance ratio |
| `calculateTimeEfficiency()` | 15-20 | Planned vs actual mission time ratio |
| `calculateFuelEfficiency()` | 15-20 | Energy consumed vs optimal path energy |

### 4.3 `attemptRecovery` (75 lines)

**Early-Return + Extract**:

```typescript
async function attemptRecovery(error: AppError): Promise<RecoveryResult> {
	if (!isRecoverableError(error)) return RecoveryResult.unrecoverable(error);
	if (error.retryCount >= MAX_RETRIES) return RecoveryResult.exhausted(error);

	const strategy = selectStrategy(error);
	if (!strategy) return RecoveryResult.noStrategy(error);

	return executeWithRetry(strategy, error);
}
```

### 4.4 `exploreCluster` (67 lines)

**Extract-and-Name**:
| New Function | Lines | Responsibility |
| ---------------------------- | ----- | ---------------------------------- |
| `getClusterEdges(cluster)` | 20-25 | Find boundary devices of cluster |
| `calculateClusterMetrics(c)` | 15-20 | Compute density, spread, centroid |

### 4.5 `analyzeError` (61 lines)

**Data-driven conversion**:

```typescript
const ERROR_PATTERNS: ErrorPattern[] = [
	{ match: /ECONNREFUSED/, category: 'connection', severity: 'high', recovery: 'reconnect' },
	{ match: /ENOMEM/, category: 'resource', severity: 'critical', recovery: 'restart' }
	// ... more patterns ...
];

function analyzeError(error: unknown): ErrorAnalysis {
	const errorStr = String(error);
	const pattern = ERROR_PATTERNS.find((p) => p.match.test(errorStr));
	return pattern ? buildAnalysis(pattern, error) : defaultAnalysis(error);
}
```

---

## 5. Verification

### 5.1 Batch Verification

```bash
for f in services/websocket/test-connection.ts services/drone/flightPathAnalyzer.ts \
         services/recovery/errorRecovery.ts services/map/networkAnalyzer.ts \
         services/monitoring/systemHealth.ts services/hackrf/sweep-manager/error/ErrorTracker.ts \
         services/localization/coral/CoralAccelerator.v2.ts; do
    python3 scripts/audit-function-sizes-v2.py "src/lib/$f"
done
# TARGET: 0 functions >60 lines across all files

npm run build && npm run typecheck
```

---

## 6. Test Requirements

| Extracted Function            | Test Cases Required                                    | Coverage Target      |
| ----------------------------- | ------------------------------------------------------ | -------------------- |
| `calculateDistanceEfficiency` | Straight path (1.0), loop (low), single point          | 90% line coverage    |
| `detectSpeedAnomalies`        | No anomalies, single spike, sustained high speed       | 100% branch coverage |
| `calculateSignalDensity`      | Uniform density, hotspot cluster, sparse region        | 90% line coverage    |
| `selectStrategy`              | Known error type, unknown error type, multiple matches | 100% branch coverage |
| `runSingleWSTest`             | Connection success, connection refused, timeout        | 90% line coverage    |

Test files:

- `tests/unit/decomposition/drone/flightPathAnalyzer.test.ts`
- `tests/unit/decomposition/recovery/errorRecovery.test.ts`
- `tests/unit/decomposition/websocket/testConnection.test.ts`

**Estimated test effort**: 13 functions x ~7 min/function = ~1.5 hours

---

## 7. Commit Strategy

```
refactor(phase-5.5): decompose 3 functions in flightPathAnalyzer.ts (91+69+68 -> <60 each)
refactor(phase-5.5): convert testWebSocketConnections to data-driven (94 -> 10 lines)
refactor(phase-5.5): decompose attemptRecovery via early-return (75 -> <60 lines)
refactor(phase-5.5): decompose exploreCluster (67 -> <60 lines)
refactor(phase-5.5): decompose analyzeHealth (63 -> <60 lines)
refactor(phase-5.5): convert analyzeError to data-driven pattern (61 -> <60 lines)
refactor(phase-5.5): decompose startProcess via early-return (61 -> <60 lines)
```

---

## 8. Cross-Phase Notes

- **Phase 5.2**: `parseSpectrumData` in `services/hackrf/sweep-manager/buffer/BufferManager.ts:197` (94 lines) is HANDLED BY PHASE 5.2. It appears in the inventory for traceability but requires NO action in Phase 5.5.
- **Phase 5.5.7**: `registerDefaultStrategies` (106 lines) and `attemptRecovery` (75 lines) are in the same file (`errorRecovery.ts`). Process `attemptRecovery` in the same commit as the HIGH-07 decomposition from sub-task 5.5.7.

---

**END OF DOCUMENT**
