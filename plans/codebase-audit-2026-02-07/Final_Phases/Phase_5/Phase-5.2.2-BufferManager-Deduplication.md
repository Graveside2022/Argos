# Phase 5.2.2: BufferManager Deduplication

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.2-2026-02-08                                        |
| Phase         | 5.2 -- Service Layer Refactoring                                     |
| Title         | BufferManager Deduplication via Abstract Base Class                  |
| Risk Level    | MEDIUM                                                               |
| Prerequisites | Phase-5.2.1 (API Deduplication) complete; sdr-common/types.ts exists |
| Files Touched | 3 (1 new, 2 modified)                                                |
| Standards     | MISRA Dir 4.12, NASA/JPL Rule 14, NASA/JPL Rule 31, Barr Ch.8        |
| Audit Date    | 2026-02-08                                                           |

---

## 1. Objective

Extract shared buffering logic from both BufferManager implementations (~69% identical)
into a common abstract base class. Retain device-specific line parsing in subclasses.

---

## 2. Current State

| File                  | Absolute Path                                                   | Lines |
| --------------------- | --------------------------------------------------------------- | ----- |
| HackRF BufferManager  | `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts` | 503   |
| USRP BufferManager    | `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts`   | 504   |
| sdiff differing lines | --                                                              | 312   |
| Similarity            | --                                                              | ~69%  |

---

## 3. Target File Structure After Refactoring

```
src/lib/services/sdr-common/
    BaseBufferManager.ts    (~250 lines)  -- abstract base class
src/lib/services/hackrf/sweep-manager/buffer/
    BufferManager.ts        (~120 lines)  -- HackRF subclass (was 503)
src/lib/services/usrp/sweep-manager/buffer/
    BufferManager.ts        (~120 lines)  -- USRP subclass (was 504)
```

---

## 4. Shared vs. Device-Specific Logic

### 4.1 Shared (extracted to BaseBufferManager)

- Ring buffer allocation and management (fixed-size circular buffer)
- Buffer overflow detection and recovery
- Timestamp tracking for data freshness
- Flush scheduling and debounce logic
- Memory pressure monitoring (integration with system memory checks)
- Statistics collection (bytes processed, flush count, overflow count)
- Event emission for buffer state changes

### 4.2 Device-Specific (remains in subclasses)

- `isNonDataLine(line: string): boolean` -- HackRF and USRP produce different
  non-data output markers (HackRF: lines starting with `#`, USRP: lines starting
  with `-- ` or containing `UHD` log prefixes).
- `parseSpectrumData(line: string): SpectrumDataPoint | null` -- HackRF outputs
  CSV-style `freq_low, freq_high, bin_width, num_samples, ...powers` while USRP
  outputs JSON-per-line `{"freq": ..., "power": ...}`.
- `deviceLabel: string` -- Used in log messages and error reports.
- Buffer size constants (HackRF: 8192 entries, USRP: 4096 entries due to higher
  per-sample memory footprint).

---

## 5. Abstract Base Class Definition

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

---

## 6. Implementation Steps

| Step | Action                                                           | Verification                                                  |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Write `sdr-common/BaseBufferManager.ts` (Section 5)              | `npx tsc --noEmit` on the file                                |
| 2    | Refactor HackRF `BufferManager.ts` to extend `BaseBufferManager` | `wc -l` target: ~120 lines                                    |
| 3    | Refactor USRP `BufferManager.ts` to extend `BaseBufferManager`   | `wc -l` target: ~120 lines                                    |
| 4    | Verify all internal imports resolve                              | `grep -rn "from.*buffer/BufferManager" src/ --include="*.ts"` |
| 5    | Run type check and lint                                          | `npm run typecheck && npm run lint`                           |

### Step 2 Detail: HackRF Subclass Skeleton

The HackRF `BufferManager.ts` subclass retains only:

- `isNonDataLine()`: returns true for lines starting with `#` (comment markers)
- `parseSpectrumData()`: CSV parsing of `freq_low, freq_high, bin_width, num_samples, ...powers`
- `deviceLabel = 'HackRF'`
- `bufferCapacity = 8192`
- Any HackRF-specific buffer tuning (e.g., adaptive flush thresholds based on sweep speed)

### Step 3 Detail: USRP Subclass Skeleton

The USRP `BufferManager.ts` subclass retains only:

- `isNonDataLine()`: returns true for lines starting with `-- ` or containing `UHD` log prefixes
- `parseSpectrumData()`: JSON-per-line parsing of `{"freq": ..., "power": ...}`
- `deviceLabel = 'USRP'`
- `bufferCapacity = 4096` (smaller due to higher per-sample memory footprint)
- Any USRP-specific buffer tuning

---

## 7. Line Count Targets

| File                              | Before    | After    | Reduction |
| --------------------------------- | --------- | -------- | --------- |
| HackRF `BufferManager.ts`         | 503       | ~120     | -76%      |
| USRP `BufferManager.ts`           | 504       | ~120     | -76%      |
| `sdr-common/BaseBufferManager.ts` | 0 (new)   | ~250     | N/A       |
| **Net change**                    | **1,007** | **~490** | **-51%**  |

---

## 8. Verification Commands

```bash
# V1: Confirm new base class exists
ls -la src/lib/services/sdr-common/BaseBufferManager.ts
# Expected: file exists

# V2: Confirm base class line count
wc -l src/lib/services/sdr-common/BaseBufferManager.ts
# Expected: ~250 lines

# V3: Confirm HackRF subclass reduced
wc -l src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts
# Expected: ~120 lines

# V4: Confirm USRP subclass reduced
wc -l src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts
# Expected: ~120 lines

# V5: Verify imports resolve
grep -rn "from.*buffer/BufferManager" src/ --include="*.ts"
# All listed imports must resolve to existing files

# V6: Verify base class has abstract members
grep -c "abstract" src/lib/services/sdr-common/BaseBufferManager.ts
# Expected: 4 (isNonDataLine, parseSpectrumData, deviceLabel, bufferCapacity)

# V7: Verify no circular dependencies
npx madge --circular src/lib/services/sdr-common/BaseBufferManager.ts
# Expected: no circular dependencies

# V8: Full type check
npm run typecheck
# Expected: exit 0

# V9: Full lint
npm run lint
# Expected: exit 0
```

---

## 9. Test Specifications

| Module              | Test File                                                  | Test Type | Minimum Tests |
| ------------------- | ---------------------------------------------------------- | --------- | ------------- |
| `BaseBufferManager` | `tests/unit/services/sdr-common/BaseBufferManager.test.ts` | Unit      | 6             |

**Required test cases:**

1. Ring buffer respects capacity limit (write beyond capacity triggers overflow counter)
2. `parseSpectrumData` delegation to subclass (valid input returns data point)
3. `normalizeSignalStrength` clamps to [-150, +20] bounds
4. Overflow handling drops oldest entries (ring semantics verified)
5. `destroy()` releases interval and resets buffer
6. `flush()` returns correct ordering (oldest to newest)

**Minimum coverage threshold**: 80% line coverage for ring buffer logic.

---

## 10. Risk Assessment

| Risk                                           | Severity | Mitigation                                                                   |
| ---------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Ring buffer semantics change during extraction | MEDIUM   | Unit test flush ordering before and after refactoring                        |
| Buffer capacity constants accidentally shared  | LOW      | Abstract `bufferCapacity` ensures each subclass declares its own value       |
| Import path breaks in ErrorTracker/FreqCycler  | LOW      | BufferManager file paths are unchanged; only internal implementation changes |
| Auto-flush interval leak                       | LOW      | `destroy()` method calls `stopAutoFlush()` unconditionally                   |

---

## 11. Standards Compliance

| Standard         | Requirement                  | How This Task Complies                                      |
| ---------------- | ---------------------------- | ----------------------------------------------------------- |
| NASA/JPL Rule 14 | Bounded memory allocation    | Ring buffer is fixed-capacity; no dynamic growth after init |
| MISRA Dir 4.12   | No dynamic memory after init | `initialize()` pre-allocates; no further allocations        |
| NASA/JPL Rule 31 | Single responsibility        | Base: ring buffer. Subclass: device-specific parsing        |
| Barr Ch.8        | Resource management          | `destroy()` releases all timers and arrays                  |

---

## 12. Rollback Strategy

This task produces one atomic Git commit. Rollback:

```bash
git revert <commit-hash>
```

The revert restores both `BufferManager.ts` files to their pre-refactoring state and
removes `BaseBufferManager.ts`. No database or schema changes are involved. The
`sdr-common/types.ts` file from Task 5.2.1 is NOT affected by the revert.

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
