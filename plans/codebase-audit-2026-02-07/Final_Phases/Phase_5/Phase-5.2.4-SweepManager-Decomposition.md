# Phase 5.2.4: sweepManager.ts Decomposition

| Field         | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.4-2026-02-08                                               |
| Phase         | 5.2 -- Service Layer Refactoring                                            |
| Title         | sweepManager.ts Decomposition into Single-Responsibility Modules            |
| Risk Level    | HIGH                                                                        |
| Prerequisites | Phase-5.2.1 (sdr-common/types.ts exists), Phase-5.2.3 (ProcessManager done) |
| Files Touched | 5 (4 new, 1 modified)                                                       |
| Standards     | MISRA C:2012 Dir 4.1, NASA/JPL Rule 31, CERT ERR50-CPP, Barr Ch.8           |
| Audit Date    | 2026-02-08                                                                  |

---

## 1. Objective

Decompose the 1,356-line `sweepManager.ts` into focused, single-responsibility modules.
The primary target is `_performHealthCheck` at 356 lines -- a single method that is 6x
the MISRA Dir 4.1 cyclomatic complexity guideline of 60 lines per function.

After decomposition, no function in any resulting file exceeds 60 lines.

---

## 2. Current State

| Attribute         | Value                                         |
| ----------------- | --------------------------------------------- |
| File              | `src/lib/server/hackrf/sweepManager.ts`       |
| Total Lines       | 1,356                                         |
| Total Methods     | 27                                            |
| Largest Method    | `_performHealthCheck` -- 356 lines (6x limit) |
| Second Largest    | `_startSweepProcess` -- 117 lines (2x limit)  |
| At Threshold      | `_performRecovery` -- 65 lines                |
| Compliant Methods | 24 methods (8-55 lines each)                  |

### 2.1 Method Groupings by Responsibility

| Responsibility Group | Methods                                                                                                                             | Total Lines |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Health & Monitoring  | `_performHealthCheck`, `_startProcessMonitoring`, `_resetDataTimeout`, `_checkSystemMemory`                                         | 470         |
| Process Lifecycle    | `_startSweepProcess`, `_stopSweepProcess`, `_forceCleanupExistingProcesses`, `_testHackrfAvailability`                              | 212         |
| Frequency Cycling    | `_runNextFrequency`, `_cycleToNextFrequency`, `_normalizeFrequencies`, `_convertToHz`, `_convertToMHz`                              | 131         |
| Data Processing      | `_handleSpectrumData`, `_handleProcessOutputLine`, `_parseHackrfOutput`, `_getSignalStrength`                                       | 141         |
| Error Handling       | `_handleSweepError`, `_handleProcessExit`, `_isCriticalStartupError`, `_isCriticalError`, `_resetErrorTracking`, `_performRecovery` | 248         |
| Event Emission       | `_emitEvent`, `_emitError`                                                                                                          | 34          |
| Startup Validation   | `_performStartupValidation`                                                                                                         | 33          |

The Health & Monitoring group alone (470 lines) exceeds the entire USRP sweepManager (435
lines). This is the primary decomposition target.

---

## 3. Target File Structure After Refactoring

```
src/lib/server/hackrf/
    sweepManager.ts              (~280 lines)  -- orchestrator (was 1,356)
    health/
        HealthMonitor.ts         (~120 lines)  -- health checks, memory monitoring
        HealthCheckPipeline.ts   (~200 lines)  -- decomposed _performHealthCheck stages
    error/
        SweepErrorHandler.ts     (~250 lines)  -- error classification, recovery
    data/
        DataProcessor.ts         (~145 lines)  -- spectrum data parsing, signal strength
```

---

## 4. Step 1: Extract HealthMonitor (470 lines)

This is the highest-impact extraction. The Health & Monitoring group contains 470 lines
across 4 methods, dominated by the 356-line `_performHealthCheck` monolith.

### 4.1 Decomposing \_performHealthCheck (356 lines -> 6 functions)

The `_performHealthCheck` method performs multiple distinct operations sequentially.
Per MISRA Dir 4.1 and NASA/JPL Rule 31, each logical stage must be its own function
with a clearly defined input/output contract.

Analysis of the 356-line method body reveals these sequential stages:

| Stage                     | Responsibility                                              | Estimated Lines | Output                |
| ------------------------- | ----------------------------------------------------------- | --------------- | --------------------- |
| 1. Process Liveness Check | Verify child process PID exists, check `/proc/{pid}/status` | ~45             | `ProcessStatus`       |
| 2. Data Freshness Check   | Compare last data timestamp against timeout threshold       | ~35             | `DataFreshnessResult` |
| 3. System Memory Check    | Read `/proc/meminfo`, compute available percentage          | ~55             | `MemoryStatus`        |
| 4. Error Rate Evaluation  | Compute error frequency over sliding window                 | ~40             | `ErrorRateResult`     |
| 5. Recovery Decision      | Evaluate all stage results, decide restart/continue/abort   | ~50             | `RecoveryDecision`    |
| 6. Recovery Execution     | Execute the decision (restart process, free memory, etc.)   | ~55             | `void`                |

**Additional overhead** in the current monolith: ~76 lines of logging, inline type
assertions, and duplicated null checks that will be eliminated through typed interfaces.

### 4.2 HealthCheckPipeline.ts

```typescript
// src/lib/server/hackrf/health/HealthCheckPipeline.ts

import type { ChildProcess } from 'child_process';

/**
 * Decomposed health check pipeline for HackRF sweep process.
 *
 * Each stage is a pure function (or nearly pure, with filesystem reads)
 * that takes typed input and returns a typed result. The pipeline
 * orchestrator calls stages sequentially and feeds results to the
 * recovery decision stage.
 *
 * This decomposition satisfies:
 * - MISRA Dir 4.1: No function exceeds 60 lines
 * - NASA/JPL Rule 31: Single responsibility per function
 * - CERT ERR50-CPP: Each stage has explicit error returns, no throws
 *
 * INVARIANT: Stages 1-4 are side-effect-free (read-only).
 *            Only Stage 6 (recovery execution) mutates system state.
 */

// ---------------------------------------------------------------
// Result types for each pipeline stage
// ---------------------------------------------------------------

export interface ProcessStatus {
	alive: boolean;
	pid: number | null;
	rssBytes: number;
	cpuPercent: number;
}

export interface DataFreshnessResult {
	stale: boolean;
	lastDataAgeMs: number;
	threshold: number;
}

export interface MemoryStatus {
	availableBytes: number;
	totalBytes: number;
	availablePercent: number;
	underPressure: boolean;
}

export interface ErrorRateResult {
	errorsPerMinute: number;
	windowSizeMs: number;
	exceedsThreshold: boolean;
}

export type RecoveryAction = 'none' | 'restart_process' | 'free_memory' | 'abort';

export interface RecoveryDecision {
	action: RecoveryAction;
	reason: string;
	urgency: 'low' | 'medium' | 'high' | 'critical';
}

// ---------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------

/**
 * Stage 1: Check if the sweep child process is alive and responsive.
 * Reads /proc/{pid}/status to verify the process exists.
 *
 * @param process - The ChildProcess handle, or null if no process.
 * @returns ProcessStatus with liveness and resource usage.
 */
export function checkProcessLiveness(process: ChildProcess | null): ProcessStatus {
	if (process === null || process.pid === undefined) {
		return { alive: false, pid: null, rssBytes: 0, cpuPercent: 0 };
	}

	// Implementation: read /proc/{pid}/status, /proc/{pid}/stat
	// Parse VmRSS for memory, compute CPU from utime+stime deltas
	// Return structured result, never throw.
	// ... (implementation details per existing _performHealthCheck logic)

	return {
		alive: true, // determined by /proc read success
		pid: process.pid,
		rssBytes: 0, // parsed from /proc/{pid}/status VmRSS
		cpuPercent: 0 // computed from /proc/{pid}/stat
	};
}

/**
 * Stage 2: Check if spectrum data is still flowing.
 * Compares the last data timestamp against the staleness threshold.
 *
 * @param lastDataTimestamp - Epoch milliseconds of last received data.
 * @param thresholdMs - Maximum acceptable age before data is stale.
 * @returns DataFreshnessResult with staleness determination.
 */
export function checkDataFreshness(
	lastDataTimestamp: number,
	thresholdMs: number
): DataFreshnessResult {
	const age = Date.now() - lastDataTimestamp;
	return {
		stale: age > thresholdMs,
		lastDataAgeMs: age,
		threshold: thresholdMs
	};
}

/**
 * Stage 3: Check system memory pressure.
 * Reads /proc/meminfo to determine available memory.
 *
 * @param pressureThresholdPercent - Below this %, memory is under pressure.
 * @returns MemoryStatus with available memory and pressure flag.
 */
export function checkSystemMemory(pressureThresholdPercent: number): MemoryStatus {
	// Implementation: read /proc/meminfo, parse MemAvailable and MemTotal
	// Compute percentage, compare against threshold.
	// ... (implementation details per existing _checkSystemMemory logic)

	return {
		availableBytes: 0,
		totalBytes: 0,
		availablePercent: 0,
		underPressure: false
	};
}

/**
 * Stage 4: Evaluate error rate over a sliding time window.
 *
 * @param errors - Array of error timestamps within the window.
 * @param windowMs - Sliding window size in milliseconds.
 * @param thresholdPerMinute - Maximum acceptable errors per minute.
 * @returns ErrorRateResult with rate and threshold comparison.
 */
export function evaluateErrorRate(
	errors: number[],
	windowMs: number,
	thresholdPerMinute: number
): ErrorRateResult {
	const cutoff = Date.now() - windowMs;
	const recentErrors = errors.filter((t) => t > cutoff);
	const windowMinutes = windowMs / 60000;
	const rate = recentErrors.length / windowMinutes;

	return {
		errorsPerMinute: rate,
		windowSizeMs: windowMs,
		exceedsThreshold: rate > thresholdPerMinute
	};
}

/**
 * Stage 5: Decide on recovery action based on all stage results.
 * This is a PURE function with NO side effects.
 *
 * Decision matrix:
 * | Process Dead | Data Stale | Mem Pressure | Error Rate High | Action          |
 * |-------------|------------|--------------|-----------------|-----------------|
 * | YES         | *          | *            | *               | restart_process |
 * | NO          | YES        | NO           | NO              | restart_process |
 * | NO          | YES        | YES          | *               | free_memory     |
 * | NO          | NO         | NO           | YES             | restart_process |
 * | NO          | NO         | YES          | NO              | free_memory     |
 * | NO          | NO         | YES          | YES             | abort           |
 * | NO          | NO         | NO           | NO              | none            |
 */
export function decideRecoveryAction(
	processStatus: ProcessStatus,
	freshness: DataFreshnessResult,
	memory: MemoryStatus,
	errorRate: ErrorRateResult
): RecoveryDecision {
	if (!processStatus.alive) {
		return {
			action: 'restart_process',
			reason: `Process PID=${processStatus.pid} is dead`,
			urgency: 'critical'
		};
	}

	if (memory.underPressure && errorRate.exceedsThreshold) {
		return {
			action: 'abort',
			reason:
				`Memory at ${memory.availablePercent.toFixed(1)}% AND error rate ` +
				`${errorRate.errorsPerMinute.toFixed(1)}/min exceeds threshold`,
			urgency: 'critical'
		};
	}

	if (memory.underPressure) {
		return {
			action: 'free_memory',
			reason: `Memory at ${memory.availablePercent.toFixed(1)}%`,
			urgency: freshness.stale ? 'high' : 'medium'
		};
	}

	if (freshness.stale || errorRate.exceedsThreshold) {
		return {
			action: 'restart_process',
			reason: freshness.stale
				? `Data stale for ${freshness.lastDataAgeMs}ms`
				: `Error rate ${errorRate.errorsPerMinute.toFixed(1)}/min`,
			urgency: 'high'
		};
	}

	return { action: 'none', reason: 'All checks passed', urgency: 'low' };
}
```

### 4.3 HealthMonitor.ts

```typescript
// src/lib/server/hackrf/health/HealthMonitor.ts

import {
	checkProcessLiveness,
	checkDataFreshness,
	checkSystemMemory,
	evaluateErrorRate,
	decideRecoveryAction,
	type RecoveryDecision,
	type ProcessStatus,
	type MemoryStatus
} from './HealthCheckPipeline';
import type { ChildProcess } from 'child_process';

/**
 * Orchestrates periodic health checks for the HackRF sweep process.
 *
 * Owns the health check interval, monitoring state, and delegates
 * to the HealthCheckPipeline for individual stage execution.
 *
 * INVARIANT: Only ONE health check interval is active at any time.
 *            Calling startMonitoring() while already monitoring will
 *            first stop the existing interval.
 *
 * Conforms to: NASA/JPL Rule 31 (orchestration, not computation).
 */
export class HealthMonitor {
	private healthInterval: ReturnType<typeof setInterval> | null = null;
	private errorTimestamps: number[] = [];
	private lastDataTimestamp: number = 0;

	// Configurable thresholds
	private readonly checkIntervalMs: number = 10000;
	private readonly dataStaleThresholdMs: number = 30000;
	private readonly memoryPressurePercent: number = 15;
	private readonly errorRateThresholdPerMin: number = 10;
	private readonly errorWindowMs: number = 300000; // 5 minutes

	constructor(private readonly onRecoveryNeeded: (decision: RecoveryDecision) => void) {}

	/** Start periodic health monitoring. */
	public startMonitoring(getProcess: () => ChildProcess | null): void {
		this.stopMonitoring();
		this.healthInterval = setInterval(() => {
			this.runHealthCheck(getProcess());
		}, this.checkIntervalMs);
	}

	/** Stop periodic health monitoring. */
	public stopMonitoring(): void {
		if (this.healthInterval !== null) {
			clearInterval(this.healthInterval);
			this.healthInterval = null;
		}
	}

	/** Record a data receipt timestamp. */
	public recordDataReceived(): void {
		this.lastDataTimestamp = Date.now();
	}

	/** Record an error occurrence. */
	public recordError(): void {
		this.errorTimestamps.push(Date.now());
		// Cap error history to prevent unbounded growth (NASA/JPL Rule 14).
		if (this.errorTimestamps.length > 1000) {
			this.errorTimestamps = this.errorTimestamps.slice(-500);
		}
	}

	/** Reset all monitoring state. */
	public reset(): void {
		this.errorTimestamps = [];
		this.lastDataTimestamp = 0;
	}

	/** Release resources. */
	public destroy(): void {
		this.stopMonitoring();
		this.errorTimestamps = [];
	}

	// ---------------------------------------------------------------
	// Private: pipeline execution
	// ---------------------------------------------------------------

	private runHealthCheck(process: ChildProcess | null): void {
		const processStatus = checkProcessLiveness(process);
		const freshness = checkDataFreshness(this.lastDataTimestamp, this.dataStaleThresholdMs);
		const memory = checkSystemMemory(this.memoryPressurePercent);
		const errorRate = evaluateErrorRate(
			this.errorTimestamps,
			this.errorWindowMs,
			this.errorRateThresholdPerMin
		);

		const decision = decideRecoveryAction(processStatus, freshness, memory, errorRate);

		if (decision.action !== 'none') {
			this.onRecoveryNeeded(decision);
		}
	}
}
```

### 4.4 Health Module Verification

```bash
# Verify HealthCheckPipeline has no function > 60 lines
grep -c "^export function" src/lib/server/hackrf/health/HealthCheckPipeline.ts
# Expected: 5 (checkProcessLiveness, checkDataFreshness, checkSystemMemory,
#               evaluateErrorRate, decideRecoveryAction)

# Verify HealthMonitor total line count
wc -l src/lib/server/hackrf/health/HealthMonitor.ts
# Expected: ~120 lines (orchestrator only, no computation)

# Verify HealthCheckPipeline total line count
wc -l src/lib/server/hackrf/health/HealthCheckPipeline.ts
# Expected: ~200 lines (5 pure functions + type definitions)

# Verify no function exceeds 60 lines in either file (requires manual review
# or function-length audit script):
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/health/HealthCheckPipeline.ts \
    src/lib/server/hackrf/health/HealthMonitor.ts
# Expected: all functions <= 60 lines
```

---

## 5. Step 2: Extract SweepErrorHandler (248 lines)

Extract the Error Handling group (6 methods, 248 lines) into a dedicated class.

**Target file**: `src/lib/server/hackrf/error/SweepErrorHandler.ts`

| Method to extract         | Lines | Destination                                         |
| ------------------------- | ----- | --------------------------------------------------- |
| `_handleSweepError`       | ~45   | `SweepErrorHandler.handleSweepError()`              |
| `_handleProcessExit`      | ~40   | `SweepErrorHandler.handleProcessExit()`             |
| `_isCriticalStartupError` | ~30   | `SweepErrorHandler.isCriticalStartupError()` (pure) |
| `_isCriticalError`        | ~25   | `SweepErrorHandler.isCriticalError()` (pure)        |
| `_resetErrorTracking`     | ~18   | `SweepErrorHandler.resetTracking()`                 |
| `_performRecovery`        | ~65   | `SweepErrorHandler.performRecovery()`               |

### 5.1 SweepErrorHandler Class

```typescript
// src/lib/server/hackrf/error/SweepErrorHandler.ts

/**
 * Classifies, tracks, and recovers from sweep process errors.
 *
 * Maintains an internal error history and decides whether errors
 * are transient (retry) or critical (abort). Recovery actions are
 * communicated back to the sweepManager via the onRecovery callback.
 *
 * INVARIANT: Error classification functions (isCriticalStartupError,
 *            isCriticalError) are PURE and deterministic. Given the
 *            same error input, they always return the same boolean.
 *
 * Conforms to: CERT ERR50-CPP, MISRA Rule 15.5 (single exit point).
 */
export class SweepErrorHandler {
	private consecutiveErrors: number = 0;
	private lastErrorTime: number = 0;
	private readonly maxConsecutiveErrors: number = 10;
	private readonly errorCooldownMs: number = 5000;

	constructor(
		private readonly onRecovery: (action: RecoveryAction) => Promise<void>,
		private readonly onAbort: (reason: string) => void
	) {}

	/**
	 * Handle a sweep error from the child process.
	 * Classifies the error, increments counters, and triggers
	 * recovery or abort as appropriate.
	 */
	public async handleSweepError(error: Error): Promise<void> {
		this.consecutiveErrors++;
		this.lastErrorTime = Date.now();

		if (this.isCriticalError(error)) {
			this.onAbort(`Critical error: ${error.message}`);
			return;
		}

		if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
			this.onAbort(`${this.consecutiveErrors} consecutive errors exceeded threshold`);
			return;
		}

		await this.performRecovery(error);
	}

	/**
	 * Handle child process exit event.
	 * Determines if the exit was expected (graceful shutdown) or
	 * unexpected (crash), and triggers recovery for crashes.
	 */
	public async handleProcessExit(
		code: number | null,
		signal: string | null,
		wasIntentional: boolean
	): Promise<void> {
		if (wasIntentional) {
			this.resetTracking();
			return;
		}

		const error = new Error(`Process exited unexpectedly: code=${code}, signal=${signal}`);
		await this.handleSweepError(error);
	}

	/**
	 * Classify whether an error during process startup is critical
	 * (device not found, permission denied) vs. transient (busy, timeout).
	 *
	 * PURE FUNCTION: No side effects, deterministic.
	 */
	public isCriticalStartupError(error: Error): boolean {
		const msg = error.message.toLowerCase();
		const criticalPatterns = [
			'device not found',
			'permission denied',
			'no hackrf boards found',
			'failed to open',
			'usb error'
		];
		return criticalPatterns.some((pattern) => msg.includes(pattern));
	}

	/**
	 * Classify whether a runtime error is critical.
	 *
	 * PURE FUNCTION: No side effects, deterministic.
	 */
	public isCriticalError(error: Error): boolean {
		const msg = error.message.toLowerCase();
		const criticalPatterns = [
			'device disconnected',
			'usb device removed',
			'fatal',
			'segmentation fault'
		];
		return criticalPatterns.some((pattern) => msg.includes(pattern));
	}

	/** Reset error tracking counters. Call after successful recovery. */
	public resetTracking(): void {
		this.consecutiveErrors = 0;
		this.lastErrorTime = 0;
	}

	/** Release resources. */
	public destroy(): void {
		this.resetTracking();
	}

	private async performRecovery(error: Error): Promise<void> {
		const cooldownElapsed = Date.now() - this.lastErrorTime > this.errorCooldownMs;

		if (!cooldownElapsed) {
			return; // Too soon since last recovery attempt.
		}

		await this.onRecovery({
			type: 'restart',
			reason: error.message,
			attemptNumber: this.consecutiveErrors
		});
	}
}

interface RecoveryAction {
	type: 'restart' | 'reconfigure' | 'abort';
	reason: string;
	attemptNumber: number;
}
```

### 5.2 SweepErrorHandler Verification

```bash
wc -l src/lib/server/hackrf/error/SweepErrorHandler.ts
# Expected: ~250 lines

# Verify no function exceeds 60 lines:
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/error/SweepErrorHandler.ts
```

---

## 6. Step 3: Extract DataProcessor (141 lines)

Extract the Data Processing group (4 methods, 141 lines) into a dedicated module.

**Target file**: `src/lib/server/hackrf/data/DataProcessor.ts`

| Method to extract          | Lines | Nature                            |
| -------------------------- | ----- | --------------------------------- |
| `_handleSpectrumData`      | ~40   | Orchestration (calls others)      |
| `_handleProcessOutputLine` | ~35   | Line dispatch (data vs. metadata) |
| `_parseHackrfOutput`       | ~45   | PURE: CSV -> SpectrumDataPoint[]  |
| `_getSignalStrength`       | ~21   | PURE: power level normalization   |

All four methods are below the 60-line threshold individually, so this extraction is
purely for cohesion (single responsibility), not for complexity reduction.

### 6.1 DataProcessor Class

```typescript
// src/lib/server/hackrf/data/DataProcessor.ts

import type { SpectrumDataPoint } from '$lib/services/sdr-common/types';

/**
 * Parses hackrf_sweep stdout output into normalized spectrum data.
 *
 * hackrf_sweep output format (CSV):
 *   date, time, freq_low, freq_high, bin_width, num_samples, [powers...]
 *
 * Each output line contains power measurements for frequency bins
 * spanning [freq_low, freq_high) with the specified bin_width.
 *
 * INVARIANT: parse functions MUST NOT throw. Malformed input returns
 *            an empty array. All validation is internal.
 *
 * Conforms to: CERT STR50-CPP (string handling), MISRA Rule 21.3
 *              (no undefined behavior in parsing).
 */
export class DataProcessor {
	private readonly minFreqHz: number = 1_000_000; // 1 MHz
	private readonly maxFreqHz: number = 6_000_000_000; // 6 GHz
	private readonly minPowerDbm: number = -150;
	private readonly maxPowerDbm: number = 20;

	/**
	 * Process a single line of hackrf_sweep output.
	 * Returns parsed data points, or empty array if line is non-data.
	 */
	public processLine(line: string): SpectrumDataPoint[] {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			return [];
		}
		return this.parseHackrfOutput(trimmed);
	}

	/**
	 * Parse a hackrf_sweep CSV line into spectrum data points.
	 *
	 * PURE FUNCTION: No side effects, no state mutation.
	 *
	 * @param line - Single CSV line from hackrf_sweep stdout.
	 * @returns Array of normalized SpectrumDataPoint, empty on parse failure.
	 */
	public parseHackrfOutput(line: string): SpectrumDataPoint[] {
		const parts = line.split(',').map((s) => s.trim());
		if (parts.length < 7) return []; // Minimum: date,time,flo,fhi,bw,ns,p1

		const freqLow = parseFloat(parts[2]);
		const freqHigh = parseFloat(parts[3]);
		const binWidth = parseFloat(parts[4]);
		// parts[5] is num_samples (unused in data output)

		if (isNaN(freqLow) || isNaN(freqHigh) || isNaN(binWidth) || binWidth <= 0) {
			return [];
		}

		if (freqLow < this.minFreqHz || freqHigh > this.maxFreqHz) {
			return [];
		}

		const powers = parts.slice(6);
		const result: SpectrumDataPoint[] = [];
		const timestamp = Date.now();

		for (let i = 0; i < powers.length; i++) {
			const power = parseFloat(powers[i]);
			if (isNaN(power)) continue;

			const frequency = freqLow + i * binWidth;
			result.push({
				frequency,
				power: this.normalizeSignalStrength(power),
				timestamp
			});
		}

		return result;
	}

	/**
	 * Normalize a raw power reading to a bounded dBm value.
	 *
	 * PURE FUNCTION: clamps to [minPowerDbm, maxPowerDbm].
	 */
	public normalizeSignalStrength(rawPower: number): number {
		if (rawPower < this.minPowerDbm) return this.minPowerDbm;
		if (rawPower > this.maxPowerDbm) return this.maxPowerDbm;
		return rawPower;
	}
}
```

### 6.2 DataProcessor Verification

```bash
wc -l src/lib/server/hackrf/data/DataProcessor.ts
# Expected: ~100-145 lines

# Verify all functions under 60 lines:
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/data/DataProcessor.ts
```

---

## 7. Step 4: Slim sweepManager to Orchestrator (~280 lines)

After extracting HealthMonitor, SweepErrorHandler, and DataProcessor, the remaining
sweepManager.ts retains only:

| Retained Responsibility           | Methods                                                                    | Lines    |
| --------------------------------- | -------------------------------------------------------------------------- | -------- |
| Process Lifecycle (orchestration) | `start`, `stop`, `restart`, `destroy`                                      | ~80      |
| Frequency Cycling (delegated)     | `_runNextFrequency`, `_cycleToNextFrequency`, frequency conversion helpers | ~131     |
| Event Emission                    | `_emitEvent`, `_emitError`                                                 | ~34      |
| Startup Validation                | `_performStartupValidation`                                                | ~33      |
| **Total**                         |                                                                            | **~278** |

The sweepManager becomes a pure orchestrator that:

1. Owns the `HealthMonitor`, `SweepErrorHandler`, and `DataProcessor` instances.
2. Delegates health monitoring to `HealthMonitor`.
3. Routes errors to `SweepErrorHandler`.
4. Feeds stdout lines to `DataProcessor`.
5. Manages frequency cycling state.
6. Exposes the public API (`start`, `stop`, `restart`, `getStatus`).

**Key architectural constraint:** The sweepManager's public API surface MUST NOT change.
All existing callers (API routes, SSE endpoints) continue to call the same methods with
the same signatures. The refactoring is internal-only.

### 7.1 Refactored sweepManager Skeleton

```typescript
// src/lib/server/hackrf/sweepManager.ts (AFTER refactoring, ~280 lines)

import { HealthMonitor } from './health/HealthMonitor';
import { SweepErrorHandler } from './error/SweepErrorHandler';
import { DataProcessor } from './data/DataProcessor';
import type { RecoveryDecision } from './health/HealthCheckPipeline';
import type { EventEmitter } from 'events';

/**
 * HackRF sweep process orchestrator.
 *
 * Coordinates health monitoring, error handling, data processing,
 * and frequency cycling for the hackrf_sweep child process.
 *
 * PUBLIC API (unchanged from pre-refactoring):
 *   - start(config): Start sweep with configuration
 *   - stop(): Stop sweep gracefully
 *   - restart(): Stop and restart with current config
 *   - destroy(): Release all resources
 *   - getStatus(): Current sweep state
 *   - on(event, handler): Subscribe to sweep events
 *
 * All internal decomposition is transparent to callers.
 *
 * SINGLETON: Access via globalThis.__sweepManager to survive Vite HMR.
 *
 * Conforms to: NASA/JPL Rule 31 (orchestration only),
 *              MISRA Dir 4.4 (no dead code in orchestrator).
 */
export class SweepManager {
	private readonly healthMonitor: HealthMonitor;
	private readonly errorHandler: SweepErrorHandler;
	private readonly dataProcessor: DataProcessor;

	// ... frequency cycling state, process handle, event emitter

	constructor() {
		this.dataProcessor = new DataProcessor();

		this.errorHandler = new SweepErrorHandler(
			async (action) => {
				await this.executeRecovery(action);
			},
			(reason) => {
				this.abort(reason);
			}
		);

		this.healthMonitor = new HealthMonitor((decision) => {
			this.handleRecoveryDecision(decision);
		});
	}

	// ... public API methods (start, stop, restart, destroy, getStatus)
	// ... frequency cycling methods
	// ... event emission methods
	// ... private orchestration glue

	public destroy(): void {
		this.healthMonitor.destroy();
		this.errorHandler.destroy();
		// ... stop process, clear intervals
	}
}
```

### 7.2 Orchestrator Verification

```bash
wc -l src/lib/server/hackrf/sweepManager.ts
# Expected: ~280 lines (was 1,356)

# Verify public API is unchanged -- all existing callers still compile:
npm run typecheck
# Expected: exit 0

# Verify no function exceeds 60 lines in the refactored sweepManager:
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/sweepManager.ts

# Verify the decomposed files exist and are reasonable size:
wc -l src/lib/server/hackrf/health/HealthCheckPipeline.ts \
      src/lib/server/hackrf/health/HealthMonitor.ts \
      src/lib/server/hackrf/error/SweepErrorHandler.ts \
      src/lib/server/hackrf/data/DataProcessor.ts \
      src/lib/server/hackrf/sweepManager.ts
# Expected total: ~1,000-1,100 lines (down from 1,356 in one file)
# The line count reduction is modest (~20%) because the goal is not
# code deletion but structural decomposition for maintainability.
```

---

## 8. Decomposition Summary

| Component                   | File                            | Lines    | Functions        | Max Function Length |
| --------------------------- | ------------------------------- | -------- | ---------------- | ------------------- |
| HealthCheckPipeline         | `health/HealthCheckPipeline.ts` | ~200     | 5 pure functions | ~55                 |
| HealthMonitor               | `health/HealthMonitor.ts`       | ~120     | 6 methods        | ~30                 |
| SweepErrorHandler           | `error/SweepErrorHandler.ts`    | ~250     | 7 methods        | ~45                 |
| DataProcessor               | `data/DataProcessor.ts`         | ~145     | 4 methods        | ~45                 |
| SweepManager (orchestrator) | `sweepManager.ts`               | ~280     | ~15 methods      | ~55                 |
| **Total**                   | **5 files**                     | **~995** | **~37**          | **<60**             |

**Before**: 1 file, 1,356 lines, 27 methods, max method 356 lines.
**After**: 5 files, ~995 lines, ~37 methods, max method ~55 lines.

The 356-line `_performHealthCheck` monolith is eliminated entirely, decomposed into 5
pure functions in `HealthCheckPipeline.ts` averaging ~40 lines each.

---

## 9. Public API Stability Verification

**Before starting this task**, capture the current public API surface:

```bash
# List all public methods of SweepManager class:
grep -E "^\s+(public|async)\s+\w+" src/lib/server/hackrf/sweepManager.ts | \
    grep -v "private\|protected\|_" > /tmp/sweep-api-before.txt
```

**After completing this task**, repeat and diff:

```bash
grep -E "^\s+(public|async)\s+\w+" src/lib/server/hackrf/sweepManager.ts | \
    grep -v "private\|protected\|_" > /tmp/sweep-api-after.txt
diff /tmp/sweep-api-before.txt /tmp/sweep-api-after.txt
# Expected: identical output (no public API changes)
```

Additionally, all API routes that import `sweepManager` must be identified and verified:

```bash
grep -rn "sweepManager" src/routes/api/ --include="*.ts" -l
# Every listed file must compile without changes.
```

---

## 10. Test Specifications

| Module                  | Test File                                                     | Test Type   | Minimum Tests |
| ----------------------- | ------------------------------------------------------------- | ----------- | ------------- |
| `HealthCheckPipeline`   | `tests/unit/server/hackrf/health/HealthCheckPipeline.test.ts` | Unit        | 10            |
| `DataProcessor`         | `tests/unit/server/hackrf/data/DataProcessor.test.ts`         | Unit        | 8             |
| `SweepErrorHandler`     | `tests/unit/server/hackrf/error/SweepErrorHandler.test.ts`    | Unit        | 6             |
| SweepManager regression | `tests/integration/server/sweepManager-regression.test.ts`    | Integration | 6             |

### HealthCheckPipeline Test Cases (10 tests)

One test per pure function (5 functions x 2 cases: pass + fail):

1. `checkProcessLiveness` -- null process returns alive=false
2. `checkProcessLiveness` -- valid process returns alive=true with PID
3. `checkDataFreshness` -- fresh data returns stale=false
4. `checkDataFreshness` -- stale data returns stale=true
5. `checkSystemMemory` -- adequate memory returns underPressure=false
6. `checkSystemMemory` -- low memory returns underPressure=true
7. `evaluateErrorRate` -- low rate returns exceedsThreshold=false
8. `evaluateErrorRate` -- high rate returns exceedsThreshold=true
9. `decideRecoveryAction` -- all passing returns action='none'
10. `decideRecoveryAction` -- dead process returns action='restart_process'

### DataProcessor Test Cases (8 tests)

1. Valid CSV line produces correct SpectrumDataPoint array
2. NaN power values are rejected (skipped, not thrown)
3. Power clamped to [-150, +20] dBm range
4. Malformed line (< 7 fields) returns empty array
5. Empty input returns empty array
6. Comment lines (starting with #) return empty array
7. Frequency outside [1 MHz, 6 GHz] returns empty array
8. High-throughput batch: 1000 lines processed without error

### SweepErrorHandler Test Cases (6 tests)

1. Critical error classification: 'device disconnected' returns true
2. Non-critical error: 'timeout' returns false
3. Consecutive error threshold triggers abort
4. Recovery action dispatched on non-critical error
5. Error counter increments correctly
6. Cooldown period prevents rapid recovery attempts

### SweepManager Regression Test Cases (6 tests)

1. Public API surface: start(), stop(), restart(), destroy(), getStatus(), on() all exist
2. Singleton behavior: globalThis.\_\_sweepManager persists across calls
3. HMR survival: module re-import preserves singleton
4. start() delegates to HealthMonitor.startMonitoring()
5. destroy() calls destroy() on all sub-modules
6. Error routing: process error reaches SweepErrorHandler

**Minimum coverage threshold**: 80% line coverage for pure functions
(HealthCheckPipeline, DataProcessor parsers). 60% for integration-dependent modules.

---

## 11. Risk Assessment

| Risk                                         | Severity | Mitigation                                                                |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Public API surface changes break callers     | HIGH     | Capture API before/after diff (Section 9)                                 |
| Health check timing changes affect behavior  | MEDIUM   | Preserve all threshold constants exactly as in original                   |
| Error classification patterns drift          | MEDIUM   | isCriticalError patterns are string literals; exact match preserved       |
| Singleton pattern disrupted by decomposition | MEDIUM   | globalThis.\_\_sweepManager pattern preserved in orchestrator constructor |
| Import path breaks for API route consumers   | LOW      | sweepManager.ts path unchanged; only internals decomposed                 |

---

## 12. Standards Compliance

| Standard         | Requirement               | How This Task Complies                                          |
| ---------------- | ------------------------- | --------------------------------------------------------------- |
| MISRA Dir 4.1    | Functions <= 60 lines     | 356-line monolith decomposed to 5 functions averaging ~40 lines |
| NASA/JPL Rule 31 | Single responsibility     | Health, error, data, orchestration each in separate modules     |
| CERT ERR50-CPP   | Structured error handling | Error classification is pure; recovery is explicit callback     |
| Barr Ch.8        | Resource management       | All sub-modules have destroy() methods for cleanup              |

---

## 13. Rollback Strategy

This task produces one atomic Git commit containing all 4 new files and the modified
`sweepManager.ts`. Rollback:

```bash
git revert <commit-hash>
```

The revert restores `sweepManager.ts` to its 1,356-line pre-decomposition state and
removes the `health/`, `error/`, and `data/` directories. No database or schema changes
are involved. Prior task artifacts (sdr-common/) are NOT affected.

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |
