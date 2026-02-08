# Phase 7.6.06: Memory Leak Detection

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Task 7.6.7)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete (all TypeScript encoders implemented), Node.js built with `--expose-gc` available, existing test suite green
**Estimated Duration**: 1-2 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Memory leak detection verifies that the TypeScript signal generation pipeline does not retain references to generated signal buffers after they are no longer needed. On the RPi 5 with 8 GB RAM and `--max-old-space-size=1024`, a memory leak in the signal generation path would cause the Node.js process to OOM within minutes of continuous operation.

The test pattern is: create an encoder, generate a signal, discard it -- repeat 100 times. If heap usage grows by more than 10% between the start and end, there is a memory leak. The 10% threshold accounts for V8's generational garbage collector not immediately reclaiming all short-lived objects.

**File**: `tests/performance/hackrf-memory-leak.test.ts`

---

## Task 7.6.7: Memory Leak Detection Test

### Full Test Code

```typescript
import { describe, test, expect } from 'vitest';

describe('Memory Leak Detection', () => {
	test('no memory growth after 100 signal generations', async () => {
		// Force GC if available
		if (global.gc) global.gc();
		const before = process.memoryUsage().heapUsed;

		for (let i = 0; i < 100; i++) {
			const encoder = new ADSBEncoder();
			const samples = encoder.generateTransmission({
				icao_address: 'ABCDEF',
				callsign: 'TEST',
				latitude: 34.05,
				longitude: -118.25,
				altitude: 35000,
				frequency: 1090e6,
				sampleRate: 2e6,
				duration: 0.1 // Short duration for speed
			});
			// Ensure samples are not retained
		}

		if (global.gc) global.gc();
		const after = process.memoryUsage().heapUsed;
		const growthPercent = ((after - before) / before) * 100;

		expect(growthPercent).toBeLessThan(10);
	});
});
```

### Methodology Explanation

**Create-and-Discard Pattern**: Each iteration creates a new `ADSBEncoder` instance and generates a short (0.1s) signal. The `samples` variable goes out of scope at the end of each iteration, making it eligible for garbage collection. If the encoder or the generation pipeline retains a reference (e.g., in a module-level cache, a global Map, or an event listener), the heap will grow.

**Short Duration for Speed**: Using `duration: 0.1` instead of `duration: 1.0` reduces each signal from ~32 MB to ~3.2 MB. With 100 iterations, the total data generated is ~320 MB, but at any point only one ~3.2 MB buffer should be live. This keeps the test fast (should complete in under 30 seconds) while still exercising the allocation/deallocation cycle enough times to detect a leak.

**GC Forcing**: `global.gc()` is only available when Node.js is started with `--expose-gc`. The `if (global.gc)` guard ensures the test still runs without this flag (the GC will run on its own, but results may be noisier). For authoritative results, run with:

```bash
node --expose-gc node_modules/.bin/vitest run tests/performance/hackrf-memory-leak.test.ts
```

**10% Growth Threshold**: V8's generational garbage collector uses a nursery (young generation) and old space. After 100 iterations, some objects may have been promoted to old space but not yet collected by a major GC cycle. A 10% threshold (relative to the "before" measurement) accounts for this. Anything above 10% indicates a genuine leak.

### Common Leak Sources in Signal Generation

The following patterns, if present, would cause this test to fail:

1. **Module-level signal cache without eviction**: If a `Map<string, Float64Array>` grows without bound
2. **Event listener accumulation**: If each `ADSBEncoder` instance adds a listener (e.g., `process.on('exit', ...)`) without removing it
3. **Closure retention**: If a closure in the generation pipeline captures the `samples` array and prevents GC
4. **Buffer pool without release**: If a buffer pool allocates but never returns buffers to the free list

---

## Verification Commands

```bash
# Run memory leak test (basic -- GC timing non-deterministic)
npm run test:unit -- tests/performance/hackrf-memory-leak.test.ts

# Run with forced GC for authoritative results
node --expose-gc node_modules/.bin/vitest run tests/performance/hackrf-memory-leak.test.ts

# Run with production memory limits
NODE_OPTIONS="--max-old-space-size=1024 --expose-gc" npx vitest run tests/performance/hackrf-memory-leak.test.ts

# Manual heap snapshot for debugging if test fails
node --expose-gc -e "
  global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) {
    const buf = new Float64Array(400000); // ~3.2 MB (simulates 0.1s signal)
  }
  global.gc();
  const after = process.memoryUsage().heapUsed;
  console.log('Before:', (before/1e6).toFixed(1), 'MB');
  console.log('After:', (after/1e6).toFixed(1), 'MB');
  console.log('Growth:', (((after-before)/before)*100).toFixed(1), '%');
"
```

---

## Verification Checklist

- [ ] Test file `tests/performance/hackrf-memory-leak.test.ts` exists and compiles
- [ ] Test runs successfully with `node --expose-gc`
- [ ] Test runs successfully without `--expose-gc` (graceful fallback)
- [ ] Heap growth after 100 iterations is less than 10%
- [ ] No retained references to signal buffers detected
- [ ] Test completes in under 60 seconds (0.1s duration x 100 iterations + GC overhead)

---

## Pass Criteria

Heap growth after 100 signal generation cycles must be less than 10% of the initial heap measurement. This threshold is strict enough to catch a genuine leak (which would show 100%+ growth over 100 iterations) while allowing for normal V8 GC non-determinism.

---

## Definition of Done

1. Test file `tests/performance/hackrf-memory-leak.test.ts` is created and compiles without errors
2. Test passes with < 10% heap growth after 100 iterations
3. Test runs with `--expose-gc` for authoritative GC-forced measurement
4. `npm run test:unit -- tests/performance/hackrf-memory-leak.test.ts` exits with code 0

---

## Cross-References

- **Phase 7.6.03**: Performance Benchmarks (Subtask 7.6.5.2 memory metric "After 100 generations, no growth > 10%" is the same measurement)
- **Memory Leak Fixes (2026-02-06)**: Prior memory leak audit that capped stores and fixed SSE streams
- **Memory Leak Audit (2026-02-07)**: F1-F10 fixes including ReadableStream cancel(), globalThis guards, store caps
- **Phase 7.6.07**: Final Gate Check (memory is Gate 6 of 10)
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
