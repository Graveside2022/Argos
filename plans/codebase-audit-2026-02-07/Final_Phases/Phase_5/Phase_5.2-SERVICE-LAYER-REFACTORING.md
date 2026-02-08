# Phase 5.2: Service Layer Refactoring -- HackRF/USRP Deduplication & sweepManager Decomposition

| Field             | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Document ID       | ARGOS-AUDIT-P5.2-2026-02-08                                         |
| Risk Level        | MEDIUM                                                              |
| Prerequisites     | Phase 3 (Store Isolation), Phase 4 (Dead Code Removal)              |
| Files Touched     | ~40                                                                 |
| Duplicated Code   | ~4,493 lines across 4 paired file sets + ~1,541 lines in API routes |
| Estimated Effort  | 3-4 engineering days                                                |
| Rollback Strategy | Git revert per task commit; no database or schema changes           |
| Standards         | MISRA C:2012 Dir 4.4, CERT MEM50-CPP, NASA/JPL Rule 31, Barr Ch.8   |

---

## Table of Contents

1. [Audit Corrections](#1-audit-corrections)
2. [Current State Assessment](#2-current-state-assessment)
3. [Task 5.2.1: HackRF/USRP API Deduplication](#3-task-521-hackrfusrp-api-deduplication)
4. [Task 5.2.2: BufferManager Deduplication](#4-task-522-buffermanager-deduplication)
5. [Task 5.2.3: ProcessManager Deduplication](#5-task-523-processmanager-deduplication)
6. [Task 5.2.4: sweepManager.ts Decomposition](#6-task-524-sweepmanagerts-decomposition)
7. [Task 5.2.5: API Route Unification](#7-task-525-api-route-unification)
8. [Execution Order and Dependencies](#8-execution-order-and-dependencies)
9. [Verification Checklist](#9-verification-checklist)
10. [Risk Mitigations](#10-risk-mitigations)
11. [Appendix: Type Contracts](#11-appendix-type-contracts)

---

## 1. Audit Corrections

Prior planning documents contained numerical inaccuracies in the HackRF/USRP duplication
analysis. All values below were re-verified on 2026-02-08 using `sdiff -s` line-by-line
comparison. Every claim in this section supersedes any prior document.

| Metric                     | Prior Claim    | Verified Value | Delta | Method                         |
| -------------------------- | -------------- | -------------- | ----- | ------------------------------ |
| BufferManager similarity   | ~60%           | ~69%           | +9pp  | `sdiff -s` on 503 vs 504 lines |
| ProcessManager similarity  | ~65%           | ~80%           | +15pp | `sdiff -s` on 413 vs 360 lines |
| API (api.ts / usrp-api.ts) | ~88%           | ~88%           | 0     | `sdiff -s` on 462 vs 460 lines |
| SweepManager similarity    | ~17%           | ~17%           | 0     | Divergent; USRP is 435 lines   |
| Store-service violations   | 32 files/17 RT | 28 files/11 RT | -4/-6 | `grep -r` with manual triage   |

**Correction rationale.** The BufferManager and ProcessManager similarity percentages were
originally computed using `diff | grep "^[<>]" | wc -l`, which double-counts changed lines
(both the removed and added side). The corrected values use `sdiff -s` which counts
differing line pairs once, then subtracts from total to derive the identical fraction.

**Impact on plan.** Higher similarity in ProcessManager (~80%) means the base class
extraction will capture more shared logic than originally estimated, reducing per-subclass
residual code from ~160 lines to ~120 lines. No architectural changes to the plan result
from these corrections.

---

## 2. Current State Assessment

### 2.1 Duplication Map

Four file pairs contain structurally identical or near-identical code between the HackRF
and USRP service implementations:

| File Pair             | HackRF Path (relative to src/lib/)                      | USRP Path (relative to src/lib/)                      | HackRF Lines | USRP Lines | sdiff Diff Lines | Similarity |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ------------ | ---------- | ---------------- | ---------- |
| BufferManager         | services/hackrf/sweep-manager/buffer/BufferManager.ts   | services/usrp/sweep-manager/buffer/BufferManager.ts   | 503          | 504        | 312              | ~69%       |
| ProcessManager        | services/hackrf/sweep-manager/process/ProcessManager.ts | services/usrp/sweep-manager/process/ProcessManager.ts | 413          | 360        | 155              | ~80%       |
| API                   | services/hackrf/api.ts                                  | services/usrp/usrp-api.ts                             | 462          | 460        | 114              | ~88%       |
| SweepManager (server) | server/hackrf/sweepManager.ts                           | server/usrp/sweepManager.ts                           | 1,356        | 435        | >1,500           | ~17%       |

**Total duplicated lines**: ~4,493 across the 4 paired files (sum of all 8 file lengths).

### 2.2 HackRF-Only Modules (No USRP Equivalent)

These files exist under `services/hackrf/sweep-manager/` with no corresponding USRP
implementation. They are NOT candidates for base class extraction but must be accounted
for during the refactoring to ensure import paths remain stable.

| File                                                         | Lines | Purpose                                   |
| ------------------------------------------------------------ | ----- | ----------------------------------------- |
| `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | 457   | Tracks error frequency, triggers recovery |
| `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | 423   | Manages frequency band cycling logic      |

### 2.3 Confirmed Bug: USRP Store Cross-Contamination

**File**: `src/lib/services/usrp/usrp-api.ts`
**Symptom**: The USRP API module imports from `$lib/stores/hackrf` instead of the USRP
store. This means USRP spectrum data updates are written to the HackRF store, causing:

1. USRP data to appear in HackRF UI components.
2. USRP store to never receive updates, rendering USRP UI components permanently stale.
3. Potential data corruption when both devices operate simultaneously.

This bug will be fixed as a mandatory side effect of Task 5.2.1 (API deduplication), where
each subclass explicitly references its own store via an abstract accessor.

### 2.4 sweepManager.ts Profile (1,356 lines, 27 methods)

The HackRF `sweepManager.ts` is the single largest service file in the codebase. Its
method distribution reveals a severe concentration of logic:

| Method                | Lines | Location | Violation                                |
| --------------------- | ----- | -------- | ---------------------------------------- |
| `_performHealthCheck` | 356   | L124     | 6x the 60-line threshold (MISRA Dir 4.1) |
| `_startSweepProcess`  | 117   | L555     | 2x threshold                             |
| `_performRecovery`    | 65    | L1123    | At threshold                             |
| Other 24 methods      | 8-55  | Various  | Compliant                                |

**Method groupings by responsibility:**

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

## 3. Task 5.2.1: HackRF/USRP API Deduplication

### 3.1 Objective

Eliminate ~88% structural duplication between `api.ts` (462 lines) and `usrp-api.ts` (460
lines) by extracting a shared abstract base class. Fix the USRP store import bug.

**Target file structure after refactoring:**

```
src/lib/services/sdr-common/
    BaseSdrApi.ts          (~250 lines)  -- abstract base class
    types.ts               (~40 lines)   -- shared type definitions
src/lib/services/hackrf/
    api.ts                 (~80 lines)   -- HackRF subclass (was 462)
src/lib/services/usrp/
    usrp-api.ts            (~80 lines)   -- USRP subclass (was 460)
```

### 3.2 Abstract Base Class Definition

```typescript
// src/lib/services/sdr-common/BaseSdrApi.ts

import type { SdrDeviceType, SweepConfig, SpectrumDataPoint } from './types';

/**
 * Abstract base class for SDR device API interactions.
 *
 * Encapsulates all shared HTTP fetch logic, error handling,
 * retry policies, and response parsing. Device-specific behavior
 * is delegated to abstract methods implemented by subclasses.
 *
 * INVARIANT: Each subclass MUST update its own store exclusively.
 *            Cross-store writes are a correctness violation.
 *
 * Conforms to: CERT ERR50-CPP (structured error handling),
 *              NASA/JPL Rule 31 (single responsibility).
 */
export abstract class BaseSdrApi {
	// ---------------------------------------------------------------
	// Abstract contract -- subclasses MUST implement
	// ---------------------------------------------------------------

	/** Device identifier for logging and error messages. */
	protected abstract readonly deviceType: SdrDeviceType;

	/** Base URL for the device's HTTP API (e.g., 'http://localhost:8092'). */
	protected abstract readonly baseUrl: string;

	/** Map of logical endpoint names to device-specific URL paths. */
	protected abstract readonly endpoints: Record<string, string>;

	/**
	 * Write spectrum data to the device's OWN Svelte store.
	 *
	 * CRITICAL: This method MUST NOT write to any store other than
	 * the one belonging to this device type. The USRP store bug
	 * (usrp-api.ts importing from $lib/stores/hackrf) was caused
	 * by violating this invariant.
	 *
	 * @param data - Parsed spectrum data points to commit to store.
	 */
	protected abstract updateStore(data: SpectrumDataPoint[]): void;

	/**
	 * Parse device-specific response format into normalized data points.
	 *
	 * HackRF and USRP return slightly different JSON schemas from their
	 * respective backends. This method normalizes the response into the
	 * common SpectrumDataPoint format.
	 *
	 * @param raw - Raw JSON response body from the device API.
	 * @returns Normalized spectrum data array.
	 */
	protected abstract parseResponse(raw: unknown): SpectrumDataPoint[];

	// ---------------------------------------------------------------
	// Shared implementation -- identical across all SDR devices
	// ---------------------------------------------------------------

	private readonly maxRetries: number = 3;
	private readonly timeoutMs: number = 5000;
	private abortController: AbortController | null = null;

	/**
	 * Execute a sweep with the given configuration.
	 * Handles retry logic, timeout, abort, error classification.
	 */
	public async startSweep(config: SweepConfig): Promise<void> {
		const url = this.buildUrl('startSweep');
		const body = this.serializeConfig(config);

		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				this.abortController = new AbortController();
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
					signal: this.abortController.signal
				});

				if (!response.ok) {
					throw new SdrApiError(
						`${this.deviceType} startSweep failed: HTTP ${response.status}`,
						response.status,
						this.deviceType
					);
				}

				return;
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					return; // Intentional cancellation; not an error.
				}
				if (attempt === this.maxRetries) {
					throw this.classifyError(err);
				}
				await this.backoff(attempt);
			}
		}
	}

	/** Stop the active sweep. */
	public async stopSweep(): Promise<void> {
		this.abortController?.abort();
		this.abortController = null;

		const url = this.buildUrl('stopSweep');
		await fetch(url, { method: 'POST' });
	}

	/** Fetch latest spectrum data and commit to device store. */
	public async fetchSpectrumData(): Promise<SpectrumDataPoint[]> {
		const url = this.buildUrl('spectrumData');
		const response = await fetch(url);

		if (!response.ok) {
			throw new SdrApiError(
				`${this.deviceType} fetchSpectrumData: HTTP ${response.status}`,
				response.status,
				this.deviceType
			);
		}

		const raw: unknown = await response.json();
		const data = this.parseResponse(raw);
		this.updateStore(data);
		return data;
	}

	/** Retrieve device status. */
	public async getStatus(): Promise<Record<string, unknown>> {
		const url = this.buildUrl('status');
		const response = await fetch(url);
		return (await response.json()) as Record<string, unknown>;
	}

	// ---------------------------------------------------------------
	// Protected utilities available to subclasses
	// ---------------------------------------------------------------

	protected buildUrl(endpointKey: string): string {
		const path = this.endpoints[endpointKey];
		if (!path) {
			throw new Error(`${this.deviceType}: unknown endpoint key '${endpointKey}'`);
		}
		return `${this.baseUrl}${path}`;
	}

	protected serializeConfig(config: SweepConfig): string {
		return JSON.stringify({
			freq_start: config.freqStartHz,
			freq_end: config.freqEndHz,
			bin_width: config.binWidthHz,
			gain: config.gainDb,
			lna_gain: config.lnaGainDb,
			vga_gain: config.vgaGainDb
		});
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	private async backoff(attempt: number): Promise<void> {
		const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	private classifyError(err: unknown): SdrApiError {
		if (err instanceof SdrApiError) return err;
		const message = err instanceof Error ? err.message : String(err);
		return new SdrApiError(`${this.deviceType} API error: ${message}`, 0, this.deviceType);
	}
}

/**
 * Typed error class for SDR API failures.
 * Carries device type and HTTP status for upstream error routing.
 */
export class SdrApiError extends Error {
	constructor(
		message: string,
		public readonly httpStatus: number,
		public readonly device: SdrDeviceType
	) {
		super(message);
		this.name = 'SdrApiError';
	}
}
```

### 3.3 HackRF Subclass

```typescript
// src/lib/services/hackrf/api.ts

import { BaseSdrApi } from '$lib/services/sdr-common/BaseSdrApi';
import type { SpectrumDataPoint } from '$lib/services/sdr-common/types';
import { hackrfStore } from '$lib/stores/hackrf';

export class HackRFApi extends BaseSdrApi {
	protected readonly deviceType = 'hackrf' as const;
	protected readonly baseUrl = 'http://localhost:8092';

	protected readonly endpoints = {
		startSweep: '/api/sweep/start',
		stopSweep: '/api/sweep/stop',
		spectrumData: '/api/sweep/data',
		status: '/api/status'
	};

	protected updateStore(data: SpectrumDataPoint[]): void {
		hackrfStore.setSpectrumData(data);
	}

	protected parseResponse(raw: unknown): SpectrumDataPoint[] {
		// HackRF-specific JSON schema normalization.
		// Device returns { frequencies: number[], powers: number[] }
		const typed = raw as { frequencies: number[]; powers: number[] };
		return typed.frequencies.map((freq, i) => ({
			frequency: freq,
			power: typed.powers[i] ?? -120,
			timestamp: Date.now()
		}));
	}
}

export const hackrfApi = new HackRFApi();
```

### 3.4 USRP Subclass (With Store Bug Fix)

```typescript
// src/lib/services/usrp/usrp-api.ts

import { BaseSdrApi } from '$lib/services/sdr-common/BaseSdrApi';
import type { SpectrumDataPoint } from '$lib/services/sdr-common/types';
// BUG FIX: Previously imported from '$lib/stores/hackrf'.
// USRP MUST update its OWN store exclusively.
import { usrpStore } from '$lib/stores/usrp';

export class USRPApi extends BaseSdrApi {
	protected readonly deviceType = 'usrp' as const;
	protected readonly baseUrl = 'http://localhost:8093';

	protected readonly endpoints = {
		startSweep: '/api/sweep/start',
		stopSweep: '/api/sweep/stop',
		spectrumData: '/api/sweep/data',
		status: '/api/status'
	};

	protected updateStore(data: SpectrumDataPoint[]): void {
		// FIX: Write to USRP store, not HackRF store.
		usrpStore.setSpectrumData(data);
	}

	protected parseResponse(raw: unknown): SpectrumDataPoint[] {
		// USRP-specific JSON schema normalization.
		// USRP returns { data: Array<{ freq: number, amplitude: number }> }
		const typed = raw as { data: Array<{ freq: number; amplitude: number }> };
		return typed.data.map((point) => ({
			frequency: point.freq,
			power: point.amplitude,
			timestamp: Date.now()
		}));
	}
}

export const usrpApi = new USRPApi();
```

### 3.5 Implementation Steps

| Step | Action                                                        | Verification                                                                                                                    |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create directory `src/lib/services/sdr-common/`               | `ls -la src/lib/services/sdr-common/`                                                                                           |
| 2    | Write `sdr-common/types.ts` with shared type definitions      | `npx tsc --noEmit src/lib/services/sdr-common/types.ts`                                                                         |
| 3    | Write `sdr-common/BaseSdrApi.ts` as shown in Section 3.2      | `npx tsc --noEmit src/lib/services/sdr-common/BaseSdrApi.ts`                                                                    |
| 4    | Rewrite `services/hackrf/api.ts` as subclass (Section 3.3)    | `npx tsc --noEmit src/lib/services/hackrf/api.ts`                                                                               |
| 5    | Rewrite `services/usrp/usrp-api.ts` as subclass (Section 3.4) | `npx tsc --noEmit src/lib/services/usrp/usrp-api.ts`                                                                            |
| 6    | Update all files that import from `services/hackrf/api.ts`    | `grep -r "from.*services/hackrf/api" src/ --include="*.ts" --include="*.svelte"` must return only the new subclass consumers    |
| 7    | Update all files that import from `services/usrp/usrp-api.ts` | `grep -r "from.*services/usrp/usrp-api" src/ --include="*.ts" --include="*.svelte"` must return only the new subclass consumers |
| 8    | Verify USRP store bug is resolved                             | `grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"` must return zero results                                     |
| 9    | Run full type check                                           | `npm run typecheck` exits 0                                                                                                     |
| 10   | Run lint                                                      | `npm run lint` exits 0                                                                                                          |

### 3.6 Line Count Targets

| File                        | Before  | After    | Reduction |
| --------------------------- | ------- | -------- | --------- |
| `services/hackrf/api.ts`    | 462     | ~80      | -83%      |
| `services/usrp/usrp-api.ts` | 460     | ~80      | -83%      |
| `sdr-common/BaseSdrApi.ts`  | 0 (new) | ~250     | N/A       |
| `sdr-common/types.ts`       | 0 (new) | ~40      | N/A       |
| **Net change**              | **922** | **~450** | **-51%**  |

The net reduction is ~51% because the base class consolidates the shared logic once instead
of twice. The critical gain is not raw line reduction but the elimination of the
maintenance burden: future API changes are made in one file instead of two.

---

## 4. Task 5.2.2: BufferManager Deduplication

### 4.1 Objective

Extract shared buffering logic from both BufferManager implementations (~69% identical)
into a common base class. Retain device-specific parsing in subclasses.

**Target file structure after refactoring:**

```
src/lib/services/sdr-common/
    BaseBufferManager.ts    (~250 lines)  -- abstract base class
src/lib/services/hackrf/sweep-manager/buffer/
    BufferManager.ts        (~120 lines)  -- HackRF subclass (was 503)
src/lib/services/usrp/sweep-manager/buffer/
    BufferManager.ts        (~120 lines)  -- USRP subclass (was 504)
```

### 4.2 Shared vs. Device-Specific Logic

The ~69% shared code falls into these categories:

**Shared (extracted to BaseBufferManager):**

- Ring buffer allocation and management (fixed-size circular buffer)
- Buffer overflow detection and recovery
- Timestamp tracking for data freshness
- Flush scheduling and debounce logic
- Memory pressure monitoring (integration with system memory checks)
- Statistics collection (bytes processed, flush count, overflow count)
- Event emission for buffer state changes

**Device-specific (remains in subclasses):**

- `isNonDataLine(line: string): boolean` -- HackRF and USRP produce different
  non-data output markers (HackRF: lines starting with `#`, USRP: lines starting
  with `-- ` or containing `UHD` log prefixes).
- `parseSpectrumData(line: string): SpectrumDataPoint | null` -- HackRF outputs
  CSV-style `freq_low, freq_high, bin_width, num_samples, ...powers` while USRP
  outputs JSON-per-line `{"freq": ..., "power": ...}`.
- `deviceLabel: string` -- Used in log messages and error reports.
- Buffer size constants (HackRF: 8192 entries, USRP: 4096 entries due to higher
  per-sample memory footprint).

### 4.3 Abstract Base Class Definition

```typescript
// src/lib/services/sdr-common/BaseBufferManager.ts

import type { SpectrumDataPoint } from './types';

/**
 * Abstract ring buffer manager for SDR spectrum data.
 *
 * Manages a fixed-capacity circular buffer that accumulates parsed
 * spectrum data points from a child process stdout stream. Subclasses
 * provide device-specific line parsing and non-data line filtering.
 *
 * INVARIANT: Buffer capacity is fixed at construction time and MUST NOT
 *            be dynamically resized. Overflow is handled by dropping the
 *            oldest entries (ring buffer semantics).
 *
 * INVARIANT: flush() MUST be called from a single scheduling context
 *            (setInterval or requestAnimationFrame). Concurrent flushes
 *            from multiple callers will corrupt the read pointer.
 *
 * Memory model: O(capacity) steady-state. No unbounded growth paths.
 *
 * Conforms to: NASA/JPL Rule 14 (bounded memory), MISRA Dir 4.12
 *              (no dynamic memory after init), Barr Ch.8 (resource mgmt).
 */
export abstract class BaseBufferManager {
	// ---------------------------------------------------------------
	// Abstract contract
	// ---------------------------------------------------------------

	/**
	 * Returns true if the line is a non-data output line from the SDR
	 * process (e.g., diagnostic messages, UHD logs, comment lines).
	 * Non-data lines are silently dropped and not buffered.
	 */
	protected abstract isNonDataLine(line: string): boolean;

	/**
	 * Parse a single line of SDR process stdout into a normalized
	 * spectrum data point. Returns null if the line is malformed.
	 *
	 * Implementations MUST NOT throw. Malformed lines return null
	 * and increment the parseErrorCount statistic.
	 */
	protected abstract parseSpectrumData(line: string): SpectrumDataPoint | null;

	/** Human-readable device label for log messages. */
	protected abstract readonly deviceLabel: string;

	/** Maximum number of entries the ring buffer can hold. */
	protected abstract readonly bufferCapacity: number;

	// ---------------------------------------------------------------
	// Shared state
	// ---------------------------------------------------------------

	private buffer: SpectrumDataPoint[];
	private writeIndex: number = 0;
	private count: number = 0;
	private flushInterval: ReturnType<typeof setInterval> | null = null;

	// Statistics
	private _totalLinesProcessed: number = 0;
	private _parseErrorCount: number = 0;
	private _overflowCount: number = 0;
	private _flushCount: number = 0;
	private _lastDataTimestamp: number = 0;

	constructor() {
		this.buffer = [];
	}

	// ---------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------

	/**
	 * Initialize the buffer with pre-allocated capacity.
	 * MUST be called before processLine() or flush().
	 */
	public initialize(): void {
		this.buffer = new Array<SpectrumDataPoint>(this.bufferCapacity);
		this.writeIndex = 0;
		this.count = 0;
		this.resetStatistics();
	}

	/**
	 * Process a single line of stdout from the SDR child process.
	 * Filters non-data lines, parses data lines, and writes to the
	 * ring buffer. Returns true if a valid data point was buffered.
	 */
	public processLine(line: string): boolean {
		this._totalLinesProcessed++;

		if (this.isNonDataLine(line)) {
			return false;
		}

		const point = this.parseSpectrumData(line);
		if (point === null) {
			this._parseErrorCount++;
			return false;
		}

		this.writeToBuffer(point);
		this._lastDataTimestamp = Date.now();
		return true;
	}

	/**
	 * Flush all buffered data points and return them.
	 * Resets the buffer to empty. Thread-safe only if called from
	 * a single scheduling context (see class-level INVARIANT).
	 */
	public flush(): SpectrumDataPoint[] {
		if (this.count === 0) return [];

		const result: SpectrumDataPoint[] = [];
		const readStart =
			(this.writeIndex - this.count + this.bufferCapacity) % this.bufferCapacity;

		for (let i = 0; i < this.count; i++) {
			const idx = (readStart + i) % this.bufferCapacity;
			const entry = this.buffer[idx];
			if (entry !== undefined) {
				result.push(entry);
			}
		}

		this.count = 0;
		this._flushCount++;
		return result;
	}

	/**
	 * Start automatic periodic flushing.
	 * @param intervalMs - Flush interval in milliseconds.
	 * @param callback - Invoked with flushed data on each interval.
	 */
	public startAutoFlush(intervalMs: number, callback: (data: SpectrumDataPoint[]) => void): void {
		this.stopAutoFlush();
		this.flushInterval = setInterval(() => {
			const data = this.flush();
			if (data.length > 0) {
				callback(data);
			}
		}, intervalMs);
	}

	/** Stop automatic periodic flushing. */
	public stopAutoFlush(): void {
		if (this.flushInterval !== null) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}
	}

	/** Release all resources. Buffer is no longer usable after this call. */
	public destroy(): void {
		this.stopAutoFlush();
		this.buffer = [];
		this.count = 0;
		this.writeIndex = 0;
	}

	/** Current number of buffered (unflushed) entries. */
	public get pendingCount(): number {
		return this.count;
	}

	/** Statistics snapshot for monitoring dashboards. */
	public getStatistics(): BufferStatistics {
		return {
			totalLinesProcessed: this._totalLinesProcessed,
			parseErrorCount: this._parseErrorCount,
			overflowCount: this._overflowCount,
			flushCount: this._flushCount,
			pendingCount: this.count,
			lastDataTimestamp: this._lastDataTimestamp,
			capacity: this.bufferCapacity,
			deviceLabel: this.deviceLabel
		};
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	private writeToBuffer(point: SpectrumDataPoint): void {
		this.buffer[this.writeIndex] = point;
		this.writeIndex = (this.writeIndex + 1) % this.bufferCapacity;

		if (this.count < this.bufferCapacity) {
			this.count++;
		} else {
			this._overflowCount++;
			// Ring buffer semantics: oldest entry is silently overwritten.
		}
	}

	private resetStatistics(): void {
		this._totalLinesProcessed = 0;
		this._parseErrorCount = 0;
		this._overflowCount = 0;
		this._flushCount = 0;
		this._lastDataTimestamp = 0;
	}
}

export interface BufferStatistics {
	totalLinesProcessed: number;
	parseErrorCount: number;
	overflowCount: number;
	flushCount: number;
	pendingCount: number;
	lastDataTimestamp: number;
	capacity: number;
	deviceLabel: string;
}
```

### 4.4 Implementation Steps

| Step | Action                                                           | Verification                                                  |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Write `sdr-common/BaseBufferManager.ts` (Section 4.3)            | `npx tsc --noEmit` on the file                                |
| 2    | Refactor HackRF `BufferManager.ts` to extend `BaseBufferManager` | `wc -l` target: ~120 lines                                    |
| 3    | Refactor USRP `BufferManager.ts` to extend `BaseBufferManager`   | `wc -l` target: ~120 lines                                    |
| 4    | Verify all internal imports resolve                              | `grep -rn "from.*buffer/BufferManager" src/ --include="*.ts"` |
| 5    | Run type check and lint                                          | `npm run typecheck && npm run lint`                           |

### 4.5 Line Count Targets

| File                              | Before    | After    | Reduction |
| --------------------------------- | --------- | -------- | --------- |
| HackRF `BufferManager.ts`         | 503       | ~120     | -76%      |
| USRP `BufferManager.ts`           | 504       | ~120     | -76%      |
| `sdr-common/BaseBufferManager.ts` | 0 (new)   | ~250     | N/A       |
| **Net change**                    | **1,007** | **~490** | **-51%**  |

---

## 5. Task 5.2.3: ProcessManager Deduplication

### 5.1 Objective

Extract shared process lifecycle management from both ProcessManager implementations
(~80% identical) into a common base class. This is the highest-similarity pair and
yields the greatest per-subclass reduction.

**Target file structure after refactoring:**

```
src/lib/services/sdr-common/
    BaseProcessManager.ts   (~200 lines)  -- abstract base class
src/lib/services/hackrf/sweep-manager/process/
    ProcessManager.ts       (~120 lines)  -- HackRF subclass (was 413)
src/lib/services/usrp/sweep-manager/process/
    ProcessManager.ts       (~120 lines)  -- USRP subclass (was 360)
```

### 5.2 Shared vs. Device-Specific Logic

The ~80% shared code includes:

**Shared (extracted to BaseProcessManager):**

- Child process spawn, monitoring, and cleanup lifecycle
- stdout/stderr stream handling and line splitting
- Process exit code interpretation and error classification
- Graceful shutdown with SIGTERM -> timeout -> SIGKILL escalation
- PID tracking and orphan process detection
- Respawn logic with backoff
- Resource cleanup on destroy

**Device-specific (remains in subclasses):**

- `buildSpawnCommand(): SpawnCommand` -- HackRF spawns `hackrf_sweep` with
  frequency range, bin width, and gain arguments. USRP spawns `uhd_rx_cfile`
  or a custom Python wrapper with different argument syntax.
- `processName: string` -- `'hackrf_sweep'` vs `'uhd_rx_cfile'` for process
  identification in `ps` listings during orphan cleanup.
- `testDeviceAvailability(): Promise<boolean>` -- HackRF uses `hackrf_info`,
  USRP uses `uhd_find_devices`. Different binaries, different output parsing.
- `forceCleanupAll(): Promise<void>` -- HackRF kills `hackrf_sweep` and
  `hackrf_transfer` processes. USRP kills `uhd_rx_cfile` and related UHD
  processes. Different process names require different `pkill` patterns.

### 5.3 Abstract Base Class Definition

```typescript
// src/lib/services/sdr-common/BaseProcessManager.ts

import { spawn, type ChildProcess } from 'child_process';

/**
 * Abstract process lifecycle manager for SDR sweep child processes.
 *
 * Manages the full lifecycle of a child process: spawn, monitor,
 * restart, and cleanup. Subclasses provide device-specific spawn
 * commands, availability checks, and cleanup procedures.
 *
 * INVARIANT: At most ONE child process is active at any time.
 *            Calling spawn() while a process is running will first
 *            terminate the existing process via graceful shutdown.
 *
 * INVARIANT: destroy() MUST be called before the parent process
 *            exits. Failure to call destroy() will leak orphan
 *            SDR processes that hold exclusive hardware locks.
 *
 * Conforms to: CERT POS54-C (signal handling), NASA/JPL Rule 25
 *              (resource deallocation), Barr Ch.9 (process safety).
 */
export abstract class BaseProcessManager {
	// ---------------------------------------------------------------
	// Abstract contract
	// ---------------------------------------------------------------

	/**
	 * Build the spawn command for this device's sweep process.
	 * Returns the binary path and argument array.
	 */
	protected abstract buildSpawnCommand(config: SpawnConfig): SpawnCommand;

	/** Process name as it appears in `ps` output, for orphan detection. */
	protected abstract readonly processName: string;

	/**
	 * Test whether the SDR hardware is physically connected and
	 * available. Returns false if the device is absent or in use
	 * by another process.
	 */
	protected abstract testDeviceAvailability(): Promise<boolean>;

	/**
	 * Force-kill ALL processes associated with this device type.
	 * Used during emergency cleanup when graceful shutdown fails.
	 * Must handle the case where no processes exist (no-op).
	 */
	protected abstract forceCleanupAll(): Promise<void>;

	// ---------------------------------------------------------------
	// Shared state
	// ---------------------------------------------------------------

	private childProcess: ChildProcess | null = null;
	private isShuttingDown: boolean = false;
	private respawnCount: number = 0;
	private readonly maxRespawns: number = 5;
	private readonly gracefulTimeoutMs: number = 5000;
	private readonly killTimeoutMs: number = 2000;

	// Callbacks
	private onDataLine: ((line: string) => void) | null = null;
	private onExit: ((code: number | null, signal: string | null) => void) | null = null;
	private onError: ((err: Error) => void) | null = null;

	// ---------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------

	/**
	 * Spawn the SDR sweep process with the given configuration.
	 * If a process is already running, it is terminated first.
	 */
	public async start(config: SpawnConfig, callbacks: ProcessCallbacks): Promise<void> {
		if (this.childProcess !== null) {
			await this.stop();
		}

		this.onDataLine = callbacks.onDataLine;
		this.onExit = callbacks.onExit ?? null;
		this.onError = callbacks.onError ?? null;

		const available = await this.testDeviceAvailability();
		if (!available) {
			throw new Error(
				`${this.processName}: device not available. ` +
					`Check USB connection and ensure no other process holds the device.`
			);
		}

		const cmd = this.buildSpawnCommand(config);
		this.childProcess = spawn(cmd.binary, cmd.args, {
			stdio: ['ignore', 'pipe', 'pipe']
		});

		this.attachStreamHandlers();
		this.attachExitHandler();
	}

	/**
	 * Gracefully stop the running process.
	 * Sends SIGTERM, waits gracefulTimeoutMs, then SIGKILL.
	 */
	public async stop(): Promise<void> {
		if (this.childProcess === null || this.isShuttingDown) return;

		this.isShuttingDown = true;

		try {
			await this.gracefulShutdown();
		} finally {
			this.childProcess = null;
			this.isShuttingDown = false;
		}
	}

	/** Release all resources and kill any running process. */
	public async destroy(): Promise<void> {
		await this.stop();
		await this.forceCleanupAll();
		this.onDataLine = null;
		this.onExit = null;
		this.onError = null;
	}

	/** Returns true if a child process is currently running. */
	public get isRunning(): boolean {
		return this.childProcess !== null && !this.isShuttingDown;
	}

	/** Current PID of the child process, or null if not running. */
	public get pid(): number | null {
		return this.childProcess?.pid ?? null;
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	private attachStreamHandlers(): void {
		const proc = this.childProcess;
		if (!proc || !proc.stdout) return;

		let partial = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			partial += chunk.toString();
			const lines = partial.split('\n');
			partial = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.length > 0 && this.onDataLine) {
					this.onDataLine(trimmed);
				}
			}
		});

		proc.stderr?.on('data', (chunk: Buffer) => {
			// stderr is logged but not treated as data.
			const msg = chunk.toString().trim();
			if (msg.length > 0 && this.onError) {
				this.onError(new Error(`${this.processName} stderr: ${msg}`));
			}
		});
	}

	private attachExitHandler(): void {
		this.childProcess?.on('exit', (code, signal) => {
			this.childProcess = null;

			if (!this.isShuttingDown && this.onExit) {
				this.onExit(code, signal);
			}
		});
	}

	private async gracefulShutdown(): Promise<void> {
		const proc = this.childProcess;
		if (!proc) return;

		return new Promise<void>((resolve) => {
			const killTimer = setTimeout(() => {
				try {
					proc.kill('SIGKILL');
				} catch {
					/* already dead */
				}
				resolve();
			}, this.gracefulTimeoutMs);

			proc.once('exit', () => {
				clearTimeout(killTimer);
				resolve();
			});

			try {
				proc.kill('SIGTERM');
			} catch {
				/* already dead */
			}
		});
	}
}

export interface SpawnCommand {
	binary: string;
	args: string[];
}

export interface SpawnConfig {
	freqStartHz: number;
	freqEndHz: number;
	binWidthHz?: number;
	gainDb?: number;
	lnaGainDb?: number;
	vgaGainDb?: number;
	sampleRate?: number;
}

export interface ProcessCallbacks {
	onDataLine: (line: string) => void;
	onExit?: (code: number | null, signal: string | null) => void;
	onError?: (err: Error) => void;
}
```

### 5.4 Implementation Steps

| Step | Action                                                    | Verification                                                                           |
| ---- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1    | Write `sdr-common/BaseProcessManager.ts` (Section 5.3)    | `npx tsc --noEmit` on the file                                                         |
| 2    | Refactor HackRF `ProcessManager.ts` to extend base        | `wc -l` target: ~120 lines                                                             |
| 3    | Refactor USRP `ProcessManager.ts` to extend base          | `wc -l` target: ~120 lines                                                             |
| 4    | Verify HackRF-specific spawn args match existing behavior | Manual review of `buildSpawnCommand`                                                   |
| 5    | Verify USRP-specific spawn args match existing behavior   | Manual review of `buildSpawnCommand`                                                   |
| 6    | Verify orphan cleanup covers all device process names     | `grep -rn "pkill\|killall" src/lib/services/*/sweep-manager/process/ --include="*.ts"` |
| 7    | Run type check and lint                                   | `npm run typecheck && npm run lint`                                                    |

### 5.5 Line Count Targets

| File                               | Before  | After    | Reduction |
| ---------------------------------- | ------- | -------- | --------- |
| HackRF `ProcessManager.ts`         | 413     | ~120     | -71%      |
| USRP `ProcessManager.ts`           | 360     | ~120     | -67%      |
| `sdr-common/BaseProcessManager.ts` | 0 (new) | ~200     | N/A       |
| **Net change**                     | **773** | **~440** | **-43%**  |

---

## 6. Task 5.2.4: sweepManager.ts Decomposition

### 6.1 Objective

Decompose the 1,356-line `sweepManager.ts` into focused, single-responsibility modules.
The primary target is `_performHealthCheck` at 356 lines -- a single method that is 6x
the MISRA Dir 4.1 cyclomatic complexity guideline of 60 lines per function.

**Target file structure after refactoring:**

```
src/lib/server/hackrf/
    sweepManager.ts              (~280 lines)  -- orchestrator (was 1,356)
    health/
        HealthMonitor.ts         (~260 lines)  -- health checks, memory monitoring
        HealthCheckPipeline.ts   (~120 lines)  -- decomposed _performHealthCheck stages
    error/
        SweepErrorHandler.ts     (~250 lines)  -- error classification, recovery
    data/
        DataProcessor.ts         (~145 lines)  -- spectrum data parsing, signal strength
```

### 6.2 Step 1: Extract HealthMonitor (470 lines)

This is the highest-impact extraction. The Health & Monitoring group contains 470 lines
across 4 methods, dominated by the 356-line `_performHealthCheck` monolith.

#### 6.2.1 Decomposing \_performHealthCheck (356 lines -> 6 functions)

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

#### 6.2.2 HealthMonitor Class

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

#### 6.2.3 Verification

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

### 6.3 Step 2: Extract SweepErrorHandler (248 lines)

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

**Interface contract with sweepManager:**

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

**Verification:**

```bash
wc -l src/lib/server/hackrf/error/SweepErrorHandler.ts
# Expected: ~250 lines

# Verify no function exceeds 60 lines:
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/error/SweepErrorHandler.ts
```

### 6.4 Step 3: Extract DataProcessor (141 lines)

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

**Verification:**

```bash
wc -l src/lib/server/hackrf/data/DataProcessor.ts
# Expected: ~100-145 lines

# Verify all functions under 60 lines:
python3 scripts/audit-function-sizes-v2.py \
    src/lib/server/hackrf/data/DataProcessor.ts
```

### 6.5 Step 4: Slim sweepManager to Orchestrator (~280 lines)

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

**Verification:**

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

### 6.6 sweepManager Decomposition Summary

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

## 7. Task 5.2.5: API Route Unification (`api/rf/` + `api/hackrf/` → `api/sdr/`)

> **REGRADE CORRECTION (2026-02-08)**: This task was added based on the Phase 5 Final Audit
> Report finding that the service layer deduplication (Tasks 5.2.1-5.2.4) leaves the API
> route duplication layer unaddressed. After Phase 5.2.1-5.2.4, the service layer will be
> unified but the route layer will still have device-switching logic scattered across 6+
> endpoints.

### 7.1 Current State

Two parallel API route trees serve overlapping functionality:

| Route Tree    | Files    | Endpoints    | Lines | Purpose                                                                             |
| ------------- | -------- | ------------ | ----- | ----------------------------------------------------------------------------------- |
| `api/hackrf/` | 16 files | 15 endpoints | ~918  | HackRF-only operations                                                              |
| `api/rf/`     | 6 files  | 6 endpoints  | ~623  | Device-agnostic operations (imports BOTH sweepManagers, switches on `device` param) |

**Overlap analysis:**

| Endpoint          | `api/hackrf/`               | `api/rf/`                   | Shared Logic                                     |
| ----------------- | --------------------------- | --------------------------- | ------------------------------------------------ |
| Start sweep       | `start-sweep/+server.ts`    | `start-sweep/+server.ts`    | ~90% -- identical config parsing, validation     |
| Stop sweep        | `stop-sweep/+server.ts`     | `stop-sweep/+server.ts`     | ~95% -- identical stop flow                      |
| Data stream (SSE) | `data-stream/+server.ts`    | `data-stream/+server.ts`    | ~80% -- SSE setup identical, data format differs |
| Status            | `status/+server.ts`         | `status/+server.ts`         | ~85% -- identical shape, device-specific fields  |
| Emergency stop    | `emergency-stop/+server.ts` | `emergency-stop/+server.ts` | ~95% -- identical flow                           |

**Problem:** After Task 5.2.1 creates `BaseSdrApi`, the route handlers will still contain
device-switching logic (`if (device === 'hackrf') { ... } else if (device === 'usrp') { ... }`)
in the `api/rf/` routes, and the `api/hackrf/` routes will bypass the unified API entirely.

### 7.2 Unified Route Structure

Replace both route trees with a single `api/sdr/` tree that accepts a `device` route
parameter:

```
api/sdr/[device]/start-sweep/+server.ts     POST   Start sweep for device
api/sdr/[device]/stop-sweep/+server.ts      POST   Stop sweep for device
api/sdr/[device]/data-stream/+server.ts     GET    SSE data stream for device
api/sdr/[device]/status/+server.ts          GET    Device status
api/sdr/[device]/emergency-stop/+server.ts  POST   Emergency stop for device
api/sdr/[device]/health/+server.ts          GET    Health check
api/sdr/[device]/cycle-status/+server.ts    GET    Frequency cycle status
api/sdr/[device]/test-device/+server.ts     POST   Device connectivity test
api/sdr/[device]/reset-state/+server.ts     POST   Reset device state
api/sdr/[device]/cleanup/+server.ts         POST   Force cleanup
```

**Device parameter validation** (at `api/sdr/[device]/` layout level):

```typescript
// src/routes/api/sdr/[device]/+server.ts (or layout.server.ts)
const VALID_DEVICES = ['hackrf', 'usrp'] as const;
type SdrDevice = (typeof VALID_DEVICES)[number];

export function validateDevice(params: { device: string }): SdrDevice {
	if (!VALID_DEVICES.includes(params.device as SdrDevice)) {
		throw error(400, `Invalid device: ${params.device}. Valid: ${VALID_DEVICES.join(', ')}`);
	}
	return params.device as SdrDevice;
}
```

### 7.3 Route Handler Pattern

Each unified route handler delegates to the `BaseSdrApi` subclass resolved by device type:

```typescript
// src/routes/api/sdr/[device]/start-sweep/+server.ts
import { json, error } from '@sveltejs/kit';
import { validateDevice } from '../deviceValidator';
import { getSdrApi } from '$lib/services/sdr-common/registry';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const device = validateDevice(params);
	const api = getSdrApi(device); // Returns HackRFApi or UsrpApi instance
	const config = await request.json();

	// Input validation (shared across devices)
	if (!config.freqStartHz || !config.freqEndHz) {
		throw error(400, 'Missing required fields: freqStartHz, freqEndHz');
	}

	const result = await api.startSweep(config);
	return json(result);
};
```

### 7.4 Device Registry

```typescript
// src/lib/services/sdr-common/registry.ts
import type { BaseSdrApi } from './BaseSdrApi';
import { HackRFApi } from '../hackrf/api';
import { UsrpApi } from '../usrp/usrp-api';

const registry = new Map<string, BaseSdrApi>([
	['hackrf', new HackRFApi()],
	['usrp', new UsrpApi()]
]);

export function getSdrApi(device: string): BaseSdrApi {
	const api = registry.get(device);
	if (!api) throw new Error(`No SDR API registered for device: ${device}`);
	return api;
}
```

### 7.5 Migration Strategy

1. Create `api/sdr/[device]/` route tree with unified handlers.
2. Add redirect stubs in `api/hackrf/` and `api/rf/` that forward to `api/sdr/hackrf/` and
   `api/sdr/{device}/` respectively. This preserves backward compatibility during migration.
3. Update all frontend callers (`hackrfService.ts`, `usrp-api.ts`, store fetch calls) to use
   `api/sdr/{device}/` endpoints.
4. After verifying zero traffic to old routes (via server logs), delete `api/hackrf/` and
   `api/rf/` route trees.

### 7.6 Verification

```bash
# 1. Unified routes exist
ls src/routes/api/sdr/\[device\]/

# 2. No route exceeds 300 lines
wc -l src/routes/api/sdr/\[device\]/**/+server.ts

# 3. Device parameter validated in all handlers
grep -rn "validateDevice" src/routes/api/sdr/ --include="*.ts" | wc -l
# Expected: matches number of route handlers

# 4. Old routes have redirects (temporary)
grep -rn "redirect\|forward" src/routes/api/hackrf/ src/routes/api/rf/ --include="*.ts"

# 5. TypeScript compilation
npm run typecheck
```

### 7.7 Effort Estimate

| Step                                         | Effort        |
| -------------------------------------------- | ------------- |
| Create unified route handlers (10 endpoints) | 3 hours       |
| Create device registry + validator           | 1 hour        |
| Add backward-compatible redirects            | 1 hour        |
| Update frontend callers                      | 2 hours       |
| Delete old routes (after verification)       | 0.5 hours     |
| **Total**                                    | **7.5 hours** |

---

## 8. Execution Order and Dependencies

Tasks MUST be executed in the order specified below. Each task depends on the successful
completion of its predecessors due to shared type definitions and import graph changes.

```
Phase 3 (Store Isolation) ----+
                               |
Phase 4 (Dead Code Removal) --+--> Task 5.2.1 (API Dedup)
                                        |
                                        +--> Task 5.2.2 (BufferManager Dedup)
                                        |         |
                                        |         +--> Task 5.2.3 (ProcessManager Dedup)
                                        |
                                        +--> Task 5.2.4 (sweepManager Decomposition)
                                        |         |
                                        |         +--> Step 1: HealthMonitor
                                        |         +--> Step 2: ErrorHandler
                                        |         +--> Step 3: DataProcessor
                                        |         +--> Step 4: Slim orchestrator
                                        |
                                        +--> Task 5.2.5 (API Route Unification)
                                                  |
                                                  +--> Unified api/sdr/[device]/ tree
                                                  +--> Backward-compat redirects
                                                  +--> Frontend caller updates
                                                  +--> Old route deletion
```

**Dependency rationale:**

| Dependency             | Reason                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 3 before 5.2.1   | Store isolation ensures clean store import boundaries before API dedup changes store references.   |
| Phase 4 before 5.2.1   | Dead code removal eliminates unused API methods that would pollute the base class.                 |
| 5.2.1 before 5.2.2     | The `sdr-common/types.ts` created in 5.2.1 is consumed by `BaseBufferManager` in 5.2.2.            |
| 5.2.2 before 5.2.3     | ProcessManager subclasses may reference BufferManager; the refactored import paths must be stable. |
| 5.2.1 before 5.2.4     | sweepManager decomposition uses shared types from `sdr-common/types.ts`.                           |
| 5.2.4 Steps sequential | Each step modifies sweepManager.ts; concurrent edits would cause merge conflicts.                  |
| 5.2.1 before 5.2.5     | API route unification requires the `BaseSdrApi` subclasses and device registry from 5.2.1.         |
| 5.2.4 before 5.2.5     | sweepManager decomposition must be complete so route handlers delegate to stable APIs.             |

**Commit strategy:** One atomic commit per task (5 total). Each commit must pass
`npm run typecheck && npm run lint` before proceeding to the next task. If a commit
fails type checking, the failure is resolved within that task's scope before advancing.

---

## 9. Verification Checklist

Every item in this checklist MUST pass before the phase is considered complete. Partial
completion is not acceptable. Each item includes the exact command to run and the
expected output.

### 9.1 Structural Verification

| #   | Check                                 | Command                                                               | Expected                                                                              |
| --- | ------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| S1  | sdr-common directory exists           | `ls -la src/lib/services/sdr-common/`                                 | Contains `BaseSdrApi.ts`, `BaseBufferManager.ts`, `BaseProcessManager.ts`, `types.ts` |
| S2  | No direct HackRF/USRP API duplication | `diff <(grep -c "fetch(" src/lib/services/hackrf/api.ts) <(echo "2")` | Files match (HackRF subclass has minimal fetch calls, base handles the rest)          |
| S3  | USRP store bug resolved               | `grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"`    | 0 matches                                                                             |
| S4  | sweepManager line count               | `wc -l < src/lib/server/hackrf/sweepManager.ts`                       | Less than 300                                                                         |
| S5  | No function > 60 lines                | `python3 scripts/audit-function-sizes-v2.py src/lib/server/hackrf/`   | All functions <= 60 lines                                                             |
| S6  | Health check decomposition            | `ls src/lib/server/hackrf/health/`                                    | Contains `HealthMonitor.ts`, `HealthCheckPipeline.ts`                                 |
| S7  | Error handler extraction              | `ls src/lib/server/hackrf/error/`                                     | Contains `SweepErrorHandler.ts`                                                       |
| S8  | Data processor extraction             | `ls src/lib/server/hackrf/data/`                                      | Contains `DataProcessor.ts`                                                           |

### 9.2 Correctness Verification

| #   | Check                                   | Command                                                                                               | Expected                                                                                                |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C1  | TypeScript compilation                  | `npm run typecheck`                                                                                   | Exit 0, no errors                                                                                       |
| C2  | ESLint                                  | `npm run lint`                                                                                        | Exit 0, no errors                                                                                       |
| C3  | No orphaned imports                     | `grep -rn "from.*sweep-manager/buffer/BufferManager" src/ --include="*.ts" \| grep -v "node_modules"` | All imports resolve to refactored subclasses                                                            |
| C4  | No circular dependencies                | `npx madge --circular src/lib/services/sdr-common/`                                                   | No circular dependencies                                                                                |
| C5  | Base class abstract methods implemented | `grep -c "abstract" src/lib/services/sdr-common/BaseSdrApi.ts`                                        | Count matches number of abstract members (4: deviceType, baseUrl/endpoints, updateStore, parseResponse) |
| C6  | Unit tests pass                         | `npm run test:unit`                                                                                   | Exit 0                                                                                                  |
| C7  | Integration tests pass                  | `npm run test:integration`                                                                            | Exit 0                                                                                                  |

### 9.3 Regression Verification

| #   | Check                         | Command                                                                                                                           | Expected                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| R1  | HackRF sweep start API        | `curl -s http://localhost:8092/api/status \| jq .`                                                                                | Valid JSON response              |
| R2  | sweepManager singleton stable | `grep -n "globalThis.*sweepManager" src/lib/server/hackrf/sweepManager.ts`                                                        | globalThis pattern present       |
| R3  | SSE endpoints unchanged       | `grep -rn "new ReadableStream" src/routes/api/hackrf/ --include="*.ts" -l`                                                        | Same files as before refactoring |
| R4  | No console.log in hot paths   | `grep -n "console\\.log" src/lib/server/hackrf/sweepManager.ts src/lib/server/hackrf/health/*.ts src/lib/server/hackrf/data/*.ts` | 0 matches in production code     |

### 9.4 Test Specifications (REGRADE ADDITION)

> **REGRADE CORRECTION (2026-02-08)**: The Phase 5 Final Audit Report Finding 2 identified
> that zero decomposition tasks include test creation. Every new module produced by Phase 5.2
> MUST have corresponding tests. This section specifies the minimum test coverage.

**Policy**: Every extracted module (base class, subclass, utility) must have:

- **Unit tests** for all public methods (≥80% line coverage for pure functions)
- **Integration tests** for the abstract base class with both device subclasses
- **Regression tests** verifying the public API surface is unchanged

| Module                  | Test File                                                     | Test Type   | Minimum Tests                                                                                                                            |
| ----------------------- | ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseSdrApi`            | `tests/unit/services/sdr-common/BaseSdrApi.test.ts`           | Unit        | 8: constructor, abstract enforcement, startSweep, stopSweep, getStatus, parseResponse delegation, error handling, type guards            |
| `HackRFApi` (subclass)  | `tests/unit/services/hackrf/HackRFApi.test.ts`                | Unit        | 5: device-specific config, HackRF store update, parseResponse format, LNA/VGA gain handling, error propagation                           |
| `UsrpApi` (subclass)    | `tests/unit/services/usrp/UsrpApi.test.ts`                    | Unit        | 5: device-specific config, USRP store update (NOT hackrf store), parseResponse format, sample rate handling, error propagation           |
| `BaseBufferManager`     | `tests/unit/services/sdr-common/BaseBufferManager.test.ts`    | Unit        | 6: ring buffer capacity, parseSpectrumData, normalizeSignalStrength bounds, overflow handling, memory cleanup, concurrency safety        |
| `BaseProcessManager`    | `tests/unit/services/sdr-common/BaseProcessManager.test.ts`   | Unit        | 6: spawn lifecycle, SIGTERM→SIGKILL escalation, orphan detection, destroy() cleanup, error emission, restart behavior                    |
| `HealthCheckPipeline`   | `tests/unit/server/hackrf/health/HealthCheckPipeline.test.ts` | Unit        | 10: one test per pure function (5 functions × 2 cases: pass + fail)                                                                      |
| `DataProcessor`         | `tests/unit/server/hackrf/data/DataProcessor.test.ts`         | Unit        | 8: parseSpectrumLine valid input, NaN rejection, range clamping [-150, +20], malformed line handling, empty input, high-throughput batch |
| `SweepErrorHandler`     | `tests/unit/server/hackrf/error/SweepErrorHandler.test.ts`    | Unit        | 6: error classification, retry decision, abort threshold, recovery action dispatch, error counting, cooldown                             |
| SDR API Integration     | `tests/integration/services/sdr-api-integration.test.ts`      | Integration | 4: HackRF start/stop cycle (mocked process), USRP start/stop cycle (mocked process), device registry lookup, invalid device rejection    |
| SweepManager regression | `tests/integration/server/sweepManager-regression.test.ts`    | Integration | 6: public API surface unchanged (start, stop, restart, destroy, getStatus, on), singleton behavior, HMR survival                         |
| API Route Unification   | `tests/integration/routes/sdr-routes.test.ts`                 | Integration | 5: device param validation, start-sweep via unified route, backward-compat redirect, invalid device 400 response, SSE stream initiation  |

**Test pattern for mocked hardware:**

```typescript
// tests/unit/services/sdr-common/BaseSdrApi.test.ts
import { describe, it, expect, vi } from 'vitest';

// Create a concrete test subclass since BaseSdrApi is abstract
class TestSdrApi extends BaseSdrApi {
	readonly deviceType = 'test' as const;
	protected getBaseUrl() {
		return 'http://localhost:9999';
	}
	protected updateStore(data: SpectrumDataPoint[]) {
		/* mock */
	}
	protected parseResponse(raw: unknown) {
		return [];
	}
}

describe('BaseSdrApi', () => {
	it('enforces abstract method implementation', () => {
		const api = new TestSdrApi();
		expect(api.deviceType).toBe('test');
	});
	// ... remaining tests
});
```

**Minimum coverage threshold**: 80% line coverage for extracted pure functions
(HealthCheckPipeline, DataProcessor parsers). 60% for integration-dependent modules.

**Existing broken tests**: The 15 failing test files (especially `hackrfService.test.ts`
which makes real HTTP calls) should be fixed BEFORE Phase 5.2 execution to establish a
clean regression baseline. Mislabeled unit tests that make network calls must be moved
to `tests/integration/` or mocked.

---

## 10. Risk Mitigations

### 10.1 Base Class Extraction Order Risk

**Risk**: Extracting base classes in the wrong order creates cascading type errors that
are difficult to diagnose.

**Mitigation**: The execution order in Section 7 is designed so that each base class
is complete and compiling before any dependent class is modified. The `sdr-common/types.ts`
file is created first (in 5.2.1) and serves as the shared type foundation for all
subsequent extractions. Each task ends with `npm run typecheck` to confirm clean
compilation before proceeding.

**Rollback**: Each task produces one Git commit. If a task introduces type errors that
cannot be resolved, `git revert <commit>` cleanly undoes that task without affecting
prior tasks.

### 10.2 Store Callback Migration Risk

**Risk**: The USRP store bug fix (5.2.1) changes which store receives spectrum data
updates. If any UI component reads from the HackRF store expecting USRP data (a
compensating workaround for the bug), the fix will break that component.

**Mitigation**: Before applying the fix, audit all USRP-related Svelte components to
determine if any read from `hackrfStore`:

```bash
# Find all files that import hackrfStore AND reference USRP:
grep -rl "hackrfStore" src/lib/components/ src/routes/ --include="*.svelte" | \
    xargs grep -l -i "usrp" 2>/dev/null
```

If any files are found, they must be updated to read from `usrpStore` as part of the
same commit that fixes `usrp-api.ts`. This ensures atomicity: the store write and store
read are corrected together.

### 10.3 sweepManager Public API Stability Risk

**Risk**: The sweepManager decomposition (5.2.4) could inadvertently change the public
API surface, breaking API route handlers and SSE endpoints.

**Mitigation**: Before starting 5.2.4, capture the current public API surface:

```bash
# List all public methods of SweepManager class:
grep -E "^\s+(public|async)\s+\w+" src/lib/server/hackrf/sweepManager.ts | \
    grep -v "private\|protected\|_" > /tmp/sweep-api-before.txt
```

After completing 5.2.4, repeat and diff:

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

### 10.4 USRP Bug Fix Side Effects

**Risk**: Fixing the USRP store import may expose latent bugs in USRP-specific
functionality that was previously untestable (because data was going to the wrong store).

**Mitigation**: The USRP store fix is a correctness improvement. Any bugs exposed by
the fix are pre-existing bugs that were hidden by the store cross-contamination. These
should be tracked as separate issues, not blockers for this phase.

After applying the fix, verify USRP store receives data:

```bash
# Start a USRP sweep (if hardware available) and check store:
# This is a manual verification step requiring USRP hardware.
# If hardware is unavailable, verify via unit test mock.
```

### 10.5 Backward Compatibility for Existing Imports

**Risk**: Files that directly import from `services/hackrf/api.ts` using named exports
may break if the export names change during the subclass refactoring.

**Mitigation**: The subclass files (`api.ts` and `usrp-api.ts`) MUST export the same
names as the originals. Specifically:

- `services/hackrf/api.ts` currently exports `hackrfApi` (or similar singleton).
  The refactored file MUST export the same name: `export const hackrfApi = new HackRFApi();`
- `services/usrp/usrp-api.ts` currently exports `usrpApi` (or similar singleton).
  The refactored file MUST export the same name: `export const usrpApi = new USRPApi();`

Verification:

```bash
# Before refactoring, capture exports:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-before.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-before.txt

# After refactoring, verify same exports exist:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-after.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-after.txt

# Diff must show no removed exports (additions are acceptable):
diff /tmp/hackrf-exports-before.txt /tmp/hackrf-exports-after.txt
diff /tmp/usrp-exports-before.txt /tmp/usrp-exports-after.txt
```

### 10.6 HackRF-Only Module Import Stability

**Risk**: The HackRF-only modules (`ErrorTracker.ts`, `FrequencyCycler.ts`) import from
sibling paths within `services/hackrf/sweep-manager/`. The base class extraction changes
the directory structure, potentially breaking these imports.

**Mitigation**: The base class extraction DOES NOT move HackRF-specific files. The
`services/hackrf/sweep-manager/` directory structure is preserved. Only the
`buffer/BufferManager.ts` and `process/ProcessManager.ts` files within that directory
are modified (to extend base classes). Their file paths remain identical.

The `ErrorTracker.ts` and `FrequencyCycler.ts` files import from their siblings via
relative paths (e.g., `../buffer/BufferManager`). These relative imports continue to
resolve correctly because the files are not moved.

Verification:

```bash
# Check ErrorTracker and FrequencyCycler imports resolve:
grep -n "from.*\.\./" src/lib/services/hackrf/sweep-manager/error/ErrorTracker.ts
grep -n "from.*\.\./" src/lib/services/hackrf/sweep-manager/frequency/FrequencyCycler.ts
# All listed imports must correspond to files that exist post-refactoring.
```

---

## 11. Appendix: Type Contracts

### 11.1 Shared Types (sdr-common/types.ts)

This file is created in Task 5.2.1 and consumed by all subsequent tasks. It defines the
canonical type vocabulary for SDR operations across both HackRF and USRP.

```typescript
// src/lib/services/sdr-common/types.ts

/**
 * Canonical SDR type definitions.
 *
 * These types define the shared vocabulary between HackRF and USRP
 * implementations. All device-specific variations are normalized
 * to these types at the boundary (API response parsing, store writes).
 *
 * NAMING CONVENTION (per Type Duplicate Audit):
 * - Raw* prefix: types matching external API response schemas
 * - *Row suffix: types matching database row schemas
 * - No prefix/suffix: domain types used within application logic
 */

/** Device type discriminator. Used in logging, error messages, and type guards. */
export type SdrDeviceType = 'hackrf' | 'usrp';

/**
 * Normalized spectrum data point.
 *
 * Represents a single frequency/power measurement from any SDR device.
 * Device-specific response formats are normalized to this type by
 * the parseResponse() method of each BaseSdrApi subclass.
 */
export interface SpectrumDataPoint {
	/** Center frequency of the measurement bin, in Hz. */
	frequency: number;

	/** Measured power level in dBm. Clamped to [-150, +20]. */
	power: number;

	/** Unix epoch milliseconds when this measurement was recorded. */
	timestamp: number;
}

/**
 * Sweep configuration parameters.
 *
 * Shared between HackRF and USRP sweep initiation.
 * Device-specific parameters (e.g., HackRF LNA gain, USRP subdevice spec)
 * are defined in device-specific extension interfaces.
 */
export interface SweepConfig {
	/** Start frequency in Hz. Must be >= 1 MHz. */
	freqStartHz: number;

	/** End frequency in Hz. Must be <= 6 GHz for HackRF, <= 6 GHz for USRP B200. */
	freqEndHz: number;

	/** FFT bin width in Hz. Determines spectral resolution. */
	binWidthHz?: number;

	/** Overall gain in dB. Interpretation is device-specific. */
	gainDb?: number;

	/** HackRF-specific: LNA gain in dB [0, 40]. Ignored by USRP. */
	lnaGainDb?: number;

	/** HackRF-specific: VGA gain in dB [0, 62]. Ignored by USRP. */
	vgaGainDb?: number;

	/** USRP-specific: Sample rate in Hz. Ignored by HackRF. */
	sampleRate?: number;
}

/**
 * Device status snapshot.
 *
 * Returned by the getStatus() API call. Fields are device-specific
 * but the top-level structure is shared.
 */
export interface DeviceStatus {
	/** Whether the device is currently performing a sweep. */
	sweeping: boolean;

	/** Device type identifier. */
	device: SdrDeviceType;

	/** Human-readable status message. */
	message: string;

	/** Uptime in milliseconds since last sweep start. */
	uptimeMs: number;

	/** Number of spectrum data points collected in current sweep. */
	dataPointCount: number;
}
```

### 11.2 Type Migration Checklist

When migrating existing code to use the shared types, follow this checklist for each file:

1. Replace any local `SpectrumDataPoint` type alias with the import from `sdr-common/types`.
2. Replace any local `SweepConfig` or equivalent configuration type with the shared type.
3. If the local type has additional fields not in the shared type, extend the shared type
   in a device-specific interface (e.g., `interface HackRFSweepConfig extends SweepConfig`).
4. Run `npm run typecheck` after each file migration.
5. Do NOT remove the old type definition until all importers have been migrated. Migration
   is file-by-file, not all-at-once, to minimize blast radius.

---

## End of Document

| Field          | Value                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6)                                                                                                                                                       |
| Reviewed By    | Pending human review                                                                                                                                                                         |
| Classification | UNCLASSIFIED // FOUO                                                                                                                                                                         |
| Distribution   | Limited to Argos development team                                                                                                                                                            |
| Version        | 1.1                                                                                                                                                                                          |
| Date           | 2026-02-08                                                                                                                                                                                   |
| Revision       | **1.1 REGRADE CORRECTION**: Added Task 5.2.5 (API Route Unification) per audit finding. Renumbered sections 7-10 → 8-11. Updated execution order, dependency rationale, and commit strategy. |
