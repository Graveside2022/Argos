# Phase 7.6: Verification Suite (Golden Files, Performance, Integration Tests)

**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 (all TypeScript implementation complete)
**Estimated Files Created**: 8 (test files)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

## Prerequisites (Independent Audit Addition)

Before Phase 7.6 verification can produce meaningful results, the following MUST be true:

1. **Existing test suite must be green** -- Currently 44 test failures at 45.7% pass rate.
   Adding new tests to a broken suite makes it impossible to distinguish pre-existing failures
   from Phase 7 regressions. Run `npm run test:unit` and confirm 0 failures before proceeding.
2. **`npm run build` succeeds** -- Required for the build gate check.
3. **`npm run typecheck` reports 0 errors** -- Required for the typecheck gate check.

These are hard blockers. Phase 7.6 gates are meaningless if the foundation is already broken.

---

## Purpose

This phase is the quality gate. No Python code is deleted until EVERY test in this phase passes.
The tests verify three critical properties:

1. **Correctness**: TypeScript output matches Python output (golden file comparison)
2. **Performance**: TypeScript meets or approaches Python performance (within 1.5x)
3. **Integration**: All API endpoints work correctly end-to-end

---

## Task 7.6.1: Golden File Comparison Tests

**File**: `tests/unit/hackrf/golden-file.test.ts`

### Subtask 7.6.1.1: Protocol Golden File Tests

For each protocol encoder, load the golden reference file generated in Phase 7.1.4 and compare
against the TypeScript encoder output.

| Test          | Golden File                                                      | Encoder                 | Tolerance                      |
| ------------- | ---------------------------------------------------------------- | ----------------------- | ------------------------------ |
| ADS-B         | `tests/golden-files/hackrf/protocols/adsb-reference.bin`         | `ADSBEncoder`           | `toBeCloseTo(ref, 10)` (5e-11) |
| GPS           | `tests/golden-files/hackrf/protocols/gps-reference.bin`          | `GPSEncoder`            | `toBeCloseTo(ref, 10)`         |
| ELRS          | `tests/golden-files/hackrf/protocols/elrs-reference.bin`         | `ELRSEncoder`           | `toBeCloseTo(ref, 10)`         |
| ELRS Jamming  | `tests/golden-files/hackrf/protocols/elrs-jamming-reference.bin` | `ELRSJamming`           | `toBeCloseTo(ref, 10)`         |
| Drone Video   | `tests/golden-files/hackrf/protocols/drone-video-reference.bin`  | `DroneVideoJamming`     | `toBeCloseTo(ref, 10)`         |
| Raw Energy    | `tests/golden-files/hackrf/protocols/raw-energy-reference.bin`   | `RawEnergy`             | `toBeCloseTo(ref, 10)`         |
| AM Modulation | `tests/golden-files/hackrf/modulation/am-reference.bin`          | `Modulation.generateAM` | `toBeCloseTo(ref, 10)`         |
| FM Modulation | `tests/golden-files/hackrf/modulation/fm-reference.bin`          | `Modulation.generateFM` | `toBeCloseTo(ref, 10)`         |

**NOTE on tolerance**:

- For Float64 intermediate calculations: `toBeCloseTo(value, 10)` allows ~5e-11 difference
- For final uint8/int8 I/Q output (hackrf_transfer format): strict equality (`toBe`)
- If a test fails at precision 10 but passes at precision 8 (5e-9), document the source of
  the numerical divergence and assess whether it affects RF output quality

### Test structure:

```typescript
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Golden File Comparison', () => {
	const goldenDir = join(__dirname, '../../../golden-files/hackrf');

	test('ADS-B encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/adsb-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/adsb-reference.bin')).buffer
		);

		const encoder = new ADSBEncoder();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	// ... repeat for all protocols
});
```

**Pass criteria**: ALL 8 tests must pass. Zero tolerance for golden file failures.

---

## Task 7.6.2: REMOVED -- Butterworth Filter Coefficient Tests

**REMOVED BY INDEPENDENT AUDIT (2026-02-08)**: `scipy.signal.butter` is not used anywhere in the
Python codebase. The Butterworth filter implementation (Task 7.2.5) was removed as phantom work.
Consequently, the tests for that implementation are also removed.

The golden file `tests/golden-files/hackrf/filters/butterworth-reference.json` should NOT be generated
(Task 7.1.4.3 was also removed).

---

## Task 7.6.3: CRC Tests

**File**: `tests/unit/hackrf/crc.test.ts`

### CRC-16 Tests

Load test vectors from `tests/golden-files/hackrf/crc/crc16-reference.json`:

```typescript
describe('CRC-16', () => {
	const vectors = JSON.parse(
		readFileSync('tests/golden-files/hackrf/crc/crc16-reference.json', 'utf-8')
	);

	for (const vec of vectors) {
		const input = Buffer.from(vec.input_hex, 'hex');

		test(`XMODEM: ${vec.input_hex.substring(0, 16)}...`, () => {
			expect(crc16Xmodem(new Uint8Array(input))).toBe(vec.crc16_xmodem);
		});

		test(`CCITT: ${vec.input_hex.substring(0, 16)}...`, () => {
			expect(crc16Ccitt(new Uint8Array(input))).toBe(vec.crc16_ccitt);
		});

		test(`MODBUS: ${vec.input_hex.substring(0, 16)}...`, () => {
			expect(crc16Modbus(new Uint8Array(input))).toBe(vec.crc16_modbus);
		});
	}
});
```

### CRC-24 Tests

Load test vectors from `tests/golden-files/hackrf/crc/crc24-reference.json`:

```typescript
describe('CRC-24', () => {
	const vectors = JSON.parse(
		readFileSync('tests/golden-files/hackrf/crc/crc24-reference.json', 'utf-8')
	);

	for (const vec of vectors) {
		test(`CRC-24: ${vec.input_hex}`, () => {
			const input = new Uint8Array(Buffer.from(vec.input_hex, 'hex'));
			expect(crc24(input)).toBe(vec.crc24);
		});
	}
});
```

**Pass criteria**: All CRC tests must produce exact integer matches. No tolerance.

---

## Task 7.6.4: Edge Case Tests

**File**: `tests/unit/hackrf/edge-cases.test.ts`

| #   | Test                    | Input                        | Expected Behavior                                |
| --- | ----------------------- | ---------------------------- | ------------------------------------------------ |
| 1   | Zero-length signal      | `duration=0`                 | Returns empty Float64Array, no error             |
| 2   | Maximum frequency       | `freq=6000 MHz`              | Accepted (within HackRF range)                   |
| 3   | Minimum sample rate     | `rate=2 Msps`                | Produces valid output                            |
| 4   | Maximum gain            | `gain=47 dB`                 | Accepted                                         |
| 5   | Negative frequency      | `freq=-100 MHz`              | Rejected by safety manager with error            |
| 6   | NaN input               | `lat=NaN`                    | Rejected by Zod validation with 400              |
| 7   | Infinity input          | `gain=Infinity`              | Rejected by Zod validation with 400              |
| 8   | Very long signal        | `duration=3600s`             | Memory bounded (streaming or error with message) |
| 9   | Very short signal       | `duration=0.001s`            | Produces at least 1 sample pair                  |
| 10  | All-zero modulation     | `mod_index=0`                | Produces unmodulated carrier                     |
| 11  | Frequency at boundary   | `freq=1 MHz` (exact minimum) | Accepted                                         |
| 12  | Frequency above maximum | `freq=6001 MHz`              | Rejected by safety manager                       |
| 13  | Gain above maximum      | `gain=48 dB`                 | Rejected by safety manager                       |
| 14  | Empty CRC input         | `data=new Uint8Array(0)`     | Returns initial value                            |

**Pass criteria**: All 14 edge case tests must pass.

---

## Task 7.6.5: Performance Benchmarks

**File**: `tests/performance/hackrf-benchmark.ts`

### Subtask 7.6.5.1: Latency Benchmarks

Compare TypeScript signal generation time against Python baseline from Phase 7.1.5:

| Operation               | Python Baseline Source | TypeScript Target      | Measurement         |
| ----------------------- | ---------------------- | ---------------------- | ------------------- |
| ADS-B 1s at 2 Msps      | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| GPS 1s at 2 Msps        | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| Raw energy 1s at 2 Msps | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| Cache lookup (hit)      | N/A                    | < 10ms                 | `performance.now()` |
| API response (status)   | N/A                    | < 20ms                 | `Date.now()` timing |

**NOTE**: TypeScript may be slower than numpy for numerical computation because numpy uses
BLAS/LAPACK compiled C/Fortran. The 1.5x target is realistic. If a protocol exceeds 1.5x,
document the specific bottleneck and assess whether WASM optimization is needed.

### Subtask 7.6.5.2: Memory Benchmarks

| Metric                              | Target                                 | Measurement                                                        |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Idle memory (no transmission)       | < 50 MB additional RSS                 | `process.memoryUsage().rss`                                        |
| Peak during 1s signal at 2 Msps     | <= Python peak                         | `process.memoryUsage().heapUsed`                                   |
| After 100 generations               | No growth > 10% over idle              | Heap comparison                                                    |
| Signal buffer 1s at 2 Msps Float64  | 32 MB (2M _ 2 _ 8 bytes)               | Calculated                                                         |
| Signal buffer 1s at 20 Msps Float64 | 320 MB -- REJECTED by transmit manager | Must return error `SIGNAL_TOO_LARGE` without attempting allocation |
| Signal buffer 16s at 2 Msps Float64 | 512 MB -- REJECTED by transmit manager | Must return error `SIGNAL_TOO_LARGE` without attempting allocation |

**NOTE (Independent Audit Addition)**: Memory benchmarks MUST run with `--max-old-space-size=1024`
to match the production Node.js configuration (see MEMORY.md OOM Protection section). The default
V8 heap on aarch64 may differ from production, giving false results.

### Subtask 7.6.5.3: Throughput Benchmarks

| Metric                       | Target              | Measurement              |
| ---------------------------- | ------------------- | ------------------------ |
| Concurrent status requests   | >= 100 req/s        | `wrk` or equivalent      |
| Signal generation throughput | >= 2 Msps real-time | Wall time for 2M samples |
| I/Q file write speed         | >= 4 MB/s           | `fs.writeFile` benchmark |

### Benchmark Comparison Script

```bash
# Load both baseline and benchmark results, compare
node -e "
const fs = require('fs');
const py = JSON.parse(fs.readFileSync('tests/performance/baseline-python.json', 'utf-8'));
const ts = JSON.parse(fs.readFileSync('tests/performance/benchmark-typescript.json', 'utf-8'));

let allPass = true;
const results = [];
for (const proto of Object.keys(py).filter(k => !k.startsWith('_'))) {
  if (!ts[proto]) {
    console.log(proto + ': MISSING from TypeScript results');
    allPass = false;
    continue;
  }
  const ratio = ts[proto].mean_ms / py[proto].mean_ms;
  const status = ratio <= 1.5 ? 'PASS' : 'FAIL';
  if (status === 'FAIL') allPass = false;
  const line = proto.padEnd(20)
    + 'Python=' + py[proto].mean_ms.toFixed(1).padStart(8) + 'ms'
    + '  TS=' + ts[proto].mean_ms.toFixed(1).padStart(8) + 'ms'
    + '  ratio=' + ratio.toFixed(2).padStart(5) + 'x'
    + '  [' + status + ']';
  console.log(line);
  results.push({ proto, python_ms: py[proto].mean_ms, ts_ms: ts[proto].mean_ms, ratio, status });
}
console.log('');
console.log(allPass ? 'ALL BENCHMARKS PASSED' : 'BENCHMARK FAILURES DETECTED');
process.exit(allPass ? 0 : 1);
"
```

---

## Task 7.6.6: Integration Tests

**File**: `tests/integration/hackrf-transmit.test.ts`

| #   | Test                              | Method      | Endpoint                         | Assertion                                                   |
| --- | --------------------------------- | ----------- | -------------------------------- | ----------------------------------------------------------- |
| 1   | Status returns valid JSON         | GET         | `/api/hackrf/transmit/status`    | Has `status`, `active`, `deviceConnected`                   |
| 2   | Workflows lists all protocols     | GET         | `/api/hackrf/transmit/workflows` | Array length >= 8                                           |
| 3   | Start with valid params           | POST        | `/api/hackrf/transmit/start`     | 200 or 503 (no hardware), not 500                           |
| 4   | Start with invalid params         | POST        | `/api/hackrf/transmit/start`     | 400 with `error` field                                      |
| 5   | Start with out-of-range frequency | POST        | `/api/hackrf/transmit/start`     | 400, code = "FREQUENCY_OUT_OF_RANGE"                        |
| 6   | Stop transmission                 | POST        | `/api/hackrf/transmit/stop`      | 200                                                         |
| 7   | Health check                      | GET         | `/api/hackrf/transmit/health`    | Has `status` field                                          |
| 8   | Device info                       | GET         | `/api/hackrf/transmit/device`    | 200 with device info or unavailable                         |
| 9   | Cache status                      | GET         | `/api/hackrf/transmit/cache`     | Has `entries` field                                         |
| 10  | Cache clear                       | DELETE      | `/api/hackrf/transmit/cache`     | 200                                                         |
| 11  | Frequency bands                   | GET         | `/api/hackrf/transmit/bands`     | Array of band objects                                       |
| 12  | Safety limits                     | GET         | `/api/hackrf/transmit/safety`    | Has `maxFrequencyHz`, `maxGainDb`                           |
| 13  | Signal library                    | GET         | `/api/hackrf/transmit/library`   | Array of signal entries                                     |
| 14  | SSE events stream                 | GET         | `/api/hackrf/transmit/events`    | Content-Type: text/event-stream                             |
| 15  | Audit log creation                | POST+verify | `/api/hackrf/transmit/start`     | File at `data/audit/transmit-log-*.jsonl`                   |
| 16  | Concurrent requests               | GET x10     | `/api/hackrf/transmit/status`    | All return 200                                              |
| 17  | Feature flag proxy                | GET         | `/api/hackrf/transmit/status`    | With USE_PYTHON_HACKRF=true, response matches Python format |

---

## Task 7.6.7: Memory Leak Detection

**File**: `tests/performance/hackrf-memory-leak.test.ts`

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

---

## Task 7.6.8: Security Integration Tests

**Added by Independent Audit (2026-02-08)**: The original plan had no security-specific tests.
For a military deployment, the following security properties must be verified:

**File**: `tests/integration/hackrf-security.test.ts`

| #   | Test                                       | Method  | Endpoint                      | Assertion                                                           |
| --- | ------------------------------------------ | ------- | ----------------------------- | ------------------------------------------------------------------- |
| 1   | Unauthenticated POST rejected (production) | POST    | `/api/hackrf/transmit/start`  | 401 or 403 when no API key provided and NODE_ENV=production         |
| 2   | Valid API key accepted                     | POST    | `/api/hackrf/transmit/start`  | 200 or 503 (no hardware) when valid Bearer token provided           |
| 3   | Invalid API key rejected                   | POST    | `/api/hackrf/transmit/start`  | 401 when wrong Bearer token provided                                |
| 4   | No wildcard CORS                           | GET     | `/api/hackrf/transmit/status` | Response does NOT contain `Access-Control-Allow-Origin: *`          |
| 5   | Rate limit enforced                        | POST x5 | `/api/hackrf/transmit/start`  | 4th+ request returns 429 within 10s window                          |
| 6   | Zod rejects NaN frequency                  | POST    | `/api/hackrf/transmit/start`  | 400 when frequency is NaN                                           |
| 7   | Zod rejects negative gain                  | POST    | `/api/hackrf/transmit/start`  | 400 when gain is -1                                                 |
| 8   | Zod rejects string in numeric field        | POST    | `/api/hackrf/transmit/start`  | 400 when frequency is "abc"                                         |
| 9   | No stack trace in error response           | POST    | `/api/hackrf/transmit/start`  | Error response does NOT contain `.stack` or file paths              |
| 10  | Audit log written on start                 | POST    | `/api/hackrf/transmit/start`  | File at `data/audit/transmit-log-*.jsonl` exists and contains entry |

**Pass criteria**: All 10 security tests must pass. This is a non-negotiable gate for military deployment.

---

## GATE CHECK: All-or-Nothing Decision

This phase produces a binary PASS/FAIL result. ALL of the following must be true:

| Gate         | Criteria                               | Command                                                                 |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| Golden files | 8/8 tests pass                         | `npm run test:unit -- tests/unit/hackrf/golden-file.test.ts`            |
| Butterworth  | REMOVED (scipy.signal.butter not used) | N/A                                                                     |
| CRC          | All vectors pass                       | `npm run test:unit -- tests/unit/hackrf/crc.test.ts`                    |
| Edge cases   | 14/14 pass                             | `npm run test:unit -- tests/unit/hackrf/edge-cases.test.ts`             |
| Performance  | All protocols <= 1.5x                  | Benchmark comparison script                                             |
| Memory       | < 10% growth                           | `npm run test:unit -- tests/performance/hackrf-memory-leak.test.ts`     |
| Integration  | 17/17 pass                             | `npm run test:integration -- tests/integration/hackrf-transmit.test.ts` |
| Security     | 10/10 pass                             | `npm run test:integration -- tests/integration/hackrf-security.test.ts` |
| Type check   | 0 errors                               | `npm run typecheck`                                                     |
| Build        | 0 errors                               | `npm run build`                                                         |

If ANY gate fails, Phase 7.7 (deletion) is BLOCKED. Fix the failing tests first.

---

## Verification Checklist

- [ ] Golden file comparison: 8/8 protocol tests pass
- [ ] ~~Butterworth coefficients~~: REMOVED -- scipy.signal.butter not used in Python codebase
- [ ] CRC-16: All 7 test vectors x 3 variants = 21 assertions pass
- [ ] CRC-24: All test vectors pass with exact integer match
- [ ] Edge cases: 14/14 boundary condition tests pass
- [ ] Performance: All protocols within 1.5x of Python baseline
- [ ] Memory: No growth > 10% after 100 generations
- [ ] Integration: 17/17 API endpoint tests pass
- [ ] Manual smoke test: Navigate to /hackrf in browser, no console errors
- [ ] Security: 10/10 security integration tests pass (auth, CORS, rate limit, validation, audit log)
- [ ] Feature flag: USE_PYTHON_HACKRF=true correctly proxies to Python backend
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

---

## Definition of Done

This phase is complete when:

1. Every gate check passes
2. The benchmark comparison report is saved to `tests/performance/benchmark-typescript.json`
3. A manual smoke test has been performed (navigate to /hackrf, verify no errors)
4. The Phase 7.7 deletion is UNBLOCKED
