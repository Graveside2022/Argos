# Phase 7.6.03: Performance Benchmarks

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Task 7.6.5, Subtasks 7.6.5.1-7.6.5.3)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete, Phase 7.1.5 Python baseline benchmarks generated (`tests/performance/baseline-python.json`), existing test suite green
**Estimated Duration**: 3-4 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Performance benchmarks verify that the TypeScript implementation does not regress beyond an acceptable threshold compared to the Python/numpy baseline. The 1.5x target accounts for the fundamental difference: numpy uses BLAS/LAPACK compiled C/Fortran for numerical computation, while TypeScript uses V8's JIT-compiled JavaScript. The benchmarks measure three dimensions: latency (how long a single operation takes), memory (how much RAM is consumed), and throughput (how many operations per second).

**File**: `tests/performance/hackrf-benchmark.ts`

---

## Subtask 7.6.5.1: Latency Benchmarks

Compare TypeScript signal generation time against Python baseline from Phase 7.1.5.

### Latency Benchmark Table

| Operation               | Python Baseline Source | TypeScript Target      | Measurement         |
| ----------------------- | ---------------------- | ---------------------- | ------------------- |
| ADS-B 1s at 2 Msps      | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| GPS 1s at 2 Msps        | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| Raw energy 1s at 2 Msps | `baseline-python.json` | <= 1.5x Python mean_ms | `performance.now()` |
| Cache lookup (hit)      | N/A                    | < 10ms                 | `performance.now()` |
| API response (status)   | N/A                    | < 20ms                 | `Date.now()` timing |

### Measurement Method

Each protocol benchmark runs 10 iterations after 2 warmup iterations. The mean is computed excluding outliers (min and max dropped). `performance.now()` provides microsecond-resolution timing. The Python baseline file (`tests/performance/baseline-python.json`) contains the same structure with `mean_ms`, `min_ms`, `max_ms`, and `std_ms` for each protocol.

### NOTE on numpy BLAS/LAPACK Advantage

TypeScript may be slower than numpy for numerical computation because numpy uses BLAS/LAPACK compiled C/Fortran libraries (OpenBLAS on ARM, typically). Operations like FFT, matrix multiplication, and vectorized trigonometric functions run at near-native speed in Python via numpy, while TypeScript relies on V8's JIT compiler which cannot match pre-compiled SIMD-optimized numerical routines.

The 1.5x target is realistic for this hardware (RPi 5, 4x Cortex-A76). If a protocol exceeds 1.5x, document the specific bottleneck (e.g., "FM modulation inner loop: 2.1x due to Math.sin per-sample vs numpy vectorized sin") and assess whether WASM optimization (e.g., AssemblyScript or Rust-compiled WASM for the hot DSP loop) is needed for production viability.

---

## Subtask 7.6.5.2: Memory Benchmarks

### Memory Benchmark Table

| Metric                              | Target                                 | Measurement                                                        |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Idle memory (no transmission)       | < 50 MB additional RSS                 | `process.memoryUsage().rss`                                        |
| Peak during 1s signal at 2 Msps     | <= Python peak                         | `process.memoryUsage().heapUsed`                                   |
| After 100 generations               | No growth > 10% over idle              | Heap comparison                                                    |
| Signal buffer 1s at 2 Msps Float64  | 32 MB (2M x 2 x 8 bytes)               | Calculated                                                         |
| Signal buffer 1s at 20 Msps Float64 | 320 MB -- REJECTED by transmit manager | Must return error `SIGNAL_TOO_LARGE` without attempting allocation |
| Signal buffer 16s at 2 Msps Float64 | 512 MB -- REJECTED by transmit manager | Must return error `SIGNAL_TOO_LARGE` without attempting allocation |

### Memory Calculation Breakdown

- **1s at 2 Msps**: 2,000,000 samples x 2 (I + Q) x 8 bytes (Float64) = 32,000,000 bytes = ~30.5 MB
- **1s at 20 Msps**: 20,000,000 x 2 x 8 = 320,000,000 bytes = ~305 MB -- exceeds safe limit
- **16s at 2 Msps**: 32,000,000 x 16 = 512,000,000 bytes = ~488 MB -- exceeds safe limit

The transmit manager MUST reject requests that would exceed the memory threshold BEFORE allocating the buffer. This is a pre-check, not a try/catch on an OOM.

### NOTE on --max-old-space-size=1024 Requirement

Memory benchmarks MUST run with `--max-old-space-size=1024` to match the production Node.js configuration (see MEMORY.md OOM Protection section). The default V8 heap on aarch64 may differ from production (V8 default is approximately 1.5 GB on 64-bit systems), giving false results. Pass this flag via the `NODE_OPTIONS` environment variable:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run test:performance -- tests/performance/hackrf-benchmark.ts
```

---

## Subtask 7.6.5.3: Throughput Benchmarks

### Throughput Benchmark Table

| Metric                       | Target              | Measurement              |
| ---------------------------- | ------------------- | ------------------------ |
| Concurrent status requests   | >= 100 req/s        | `wrk` or equivalent      |
| Signal generation throughput | >= 2 Msps real-time | Wall time for 2M samples |
| I/Q file write speed         | >= 4 MB/s           | `fs.writeFile` benchmark |

### Throughput Notes

- **Concurrent status requests**: Use `wrk -t2 -c10 -d10s http://localhost:5173/api/hackrf/transmit/status` or equivalent HTTP benchmarking tool. 100 req/s is modest for a JSON endpoint.
- **Signal generation throughput**: The critical metric -- if TypeScript cannot generate 2M samples in 1 second, it cannot keep up with real-time HackRF transmission at 2 Msps.
- **I/Q file write speed**: HackRF uses raw I/Q binary files. At 2 Msps with int8 output, the data rate is 4 MB/s (2M x 2 bytes). The filesystem must keep up.

---

## Benchmark Comparison Script

Full Node.js script that loads both Python baseline and TypeScript results, compares them, and exits non-zero on any failure:

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

## Verification Commands

```bash
# Run performance benchmarks (must use production memory limits)
NODE_OPTIONS="--max-old-space-size=1024" npm run test:performance -- tests/performance/hackrf-benchmark.ts

# Run benchmark comparison script
node -e "$(cat tests/performance/compare-benchmarks.js)"

# Verify baseline file exists
ls -la tests/performance/baseline-python.json

# Verify TypeScript benchmark results were written
ls -la tests/performance/benchmark-typescript.json

# Quick throughput check with wrk (if installed)
wrk -t2 -c10 -d10s http://localhost:5173/api/hackrf/transmit/status
```

---

## Verification Checklist

- [ ] Python baseline file `tests/performance/baseline-python.json` exists (from Phase 7.1.5)
- [ ] Benchmark file `tests/performance/hackrf-benchmark.ts` exists and compiles
- [ ] **Latency**: ADS-B 1s at 2 Msps <= 1.5x Python mean_ms
- [ ] **Latency**: GPS 1s at 2 Msps <= 1.5x Python mean_ms
- [ ] **Latency**: Raw energy 1s at 2 Msps <= 1.5x Python mean_ms
- [ ] **Latency**: Cache lookup (hit) < 10ms
- [ ] **Latency**: API response (status) < 20ms
- [ ] **Memory**: Idle memory < 50 MB additional RSS
- [ ] **Memory**: Peak during 1s signal <= Python peak
- [ ] **Memory**: After 100 generations, no growth > 10% over idle
- [ ] **Memory**: 1s at 2 Msps buffer = ~32 MB (calculated verification)
- [ ] **Memory**: 1s at 20 Msps REJECTED with `SIGNAL_TOO_LARGE` (no allocation)
- [ ] **Memory**: 16s at 2 Msps REJECTED with `SIGNAL_TOO_LARGE` (no allocation)
- [ ] **Throughput**: Concurrent status requests >= 100 req/s
- [ ] **Throughput**: Signal generation >= 2 Msps real-time
- [ ] **Throughput**: I/Q file write >= 4 MB/s
- [ ] Benchmarks run with `--max-old-space-size=1024` (production config)
- [ ] Benchmark comparison script exits with code 0
- [ ] TypeScript results saved to `tests/performance/benchmark-typescript.json`
- [ ] Any protocols exceeding 1.5x documented with bottleneck analysis

---

## Pass Criteria

- All protocol latencies within 1.5x of Python baseline
- All memory metrics within targets
- All throughput metrics within targets
- Benchmark comparison script exits with code 0

---

## Definition of Done

1. Benchmark file `tests/performance/hackrf-benchmark.ts` is created and runs successfully
2. TypeScript results saved to `tests/performance/benchmark-typescript.json`
3. Benchmark comparison script confirms all protocols <= 1.5x
4. Memory benchmarks run with `--max-old-space-size=1024` and all targets met
5. Large signal requests (20 Msps, 16s) correctly rejected without allocation
6. Any performance outliers documented with specific bottleneck identification

---

## Cross-References

- **Phase 7.1.5**: Python baseline benchmarks (generates `baseline-python.json`)
- **Phase 7.4**: Service Layer (transmit manager with `SIGNAL_TOO_LARGE` pre-check)
- **Phase 7.6.06**: Memory Leak Detection (complements the "After 100 generations" metric here)
- **Phase 7.6.07**: Final Gate Check (performance is Gate 5 of 10)
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
