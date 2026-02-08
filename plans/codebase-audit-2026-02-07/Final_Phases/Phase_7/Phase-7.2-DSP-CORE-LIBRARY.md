# Phase 7.2: Core DSP Library (Math Utilities, Filters, CRC, IQ Generation)

**Risk Level**: MEDIUM -- New code, numerical correctness critical
**Prerequisites**: Phase 7.1 (golden files and baseline must exist)
**Estimated Files Created**: 8
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Build the foundational DSP (Digital Signal Processing) library that all protocol encoders depend on.
This is the most numerically sensitive layer of the migration. Every function must produce output
that matches the Python/numpy/scipy originals to within IEEE 754 double-precision tolerance.

**Target directory**: `src/lib/server/hackrf/dsp/`

---

## Architecture

```
src/lib/server/hackrf/dsp/
  index.ts                    # Barrel export
  math/
    typed-arrays.ts           # Float64Array utilities (replaces numpy array ops)
    random.ts                 # Box-Muller transform, uniform random (replaces numpy.random)
  filters/                        # RESERVED for future use if scipy.signal functions are ever needed
  crc/
    crc16.ts                  # CRC-16 XMODEM, CCITT, MODBUS (replaces crc16_python.py)
    crc24.ts                  # CRC-24 for ADS-B Mode S (extracted from adsb_protocol.py)
  iq/
    iq-generator.ts           # I/Q sample generation, interleaving, normalization
    iq-converter.ts           # Float64 to uint8 conversion for hackrf_transfer
```

---

## Task 7.2.1: Float64Array Utilities (`math/typed-arrays.ts`)

**Replaces**: numpy array creation and manipulation functions

### Functions to implement:

| Function                                                                    | numpy Equivalent   | Description                  | Max Lines |
| --------------------------------------------------------------------------- | ------------------ | ---------------------------- | --------- |
| `zeros(n: number): Float64Array`                                            | `np.zeros(n)`      | Create zero-filled array     | 3         |
| `ones(n: number): Float64Array`                                             | `np.ones(n)`       | Create array filled with 1.0 | 5         |
| `linspace(start: number, stop: number, num: number): Float64Array`          | `np.linspace()`    | Evenly spaced values         | 10        |
| `arange(start: number, stop: number, step: number): Float64Array`           | `np.arange()`      | Values with step increment   | 10        |
| `concatenate(arrays: Float64Array[]): Float64Array`                         | `np.concatenate()` | Join arrays                  | 10        |
| `clip(arr: Float64Array, min: number, max: number): Float64Array`           | `np.clip()`        | Clamp values                 | 8         |
| `interp(x: Float64Array, xp: Float64Array, fp: Float64Array): Float64Array` | `np.interp()`      | Linear interpolation         | 20        |
| `convolve(a: Float64Array, b: Float64Array): Float64Array`                  | `np.convolve()`    | Discrete convolution         | 15        |
| `sinArray(arr: Float64Array): Float64Array`                                 | `np.sin()`         | Element-wise sine            | 8         |
| `cosArray(arr: Float64Array): Float64Array`                                 | `np.cos()`         | Element-wise cosine          | 8         |
| `expArray(arr: Float64Array): Float64Array`                                 | `np.exp()`         | Element-wise exponential     | 8         |
| `addArrays(a: Float64Array, b: Float64Array): Float64Array`                 | `a + b`            | Element-wise addition        | 8         |
| `multiplyArrays(a: Float64Array, b: Float64Array): Float64Array`            | `a * b`            | Element-wise multiply        | 8         |
| `scaleArray(arr: Float64Array, scalar: number): Float64Array`               | `a * scalar`       | Scalar multiply              | 8         |
| `sumArray(arr: Float64Array): number`                                       | `np.sum()`         | Array sum                    | 5         |
| `maxArray(arr: Float64Array): number`                                       | `np.max()`         | Array maximum                | 5         |
| `absArray(arr: Float64Array): Float64Array`                                 | `np.abs()`         | Element-wise absolute        | 8         |

**Estimated total**: ~160 lines
**Standards**: No `any` types. All parameters and return types explicitly typed. No `number[]` for signal data.

**Verification**:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/typed-arrays.test.ts
```

---

## Task 7.2.2: Random Number Generation (`math/random.ts`)

**Replaces**: `numpy.random.normal()`, `numpy.random.uniform()`

### Functions to implement:

| Function                                                              | numpy Equivalent      | Description             | Max Lines |
| --------------------------------------------------------------------- | --------------------- | ----------------------- | --------- |
| `uniformRandom(n: number, low?: number, high?: number): Float64Array` | `np.random.uniform()` | Uniform distribution    | 10        |
| `normalRandom(n: number, mean?: number, std?: number): Float64Array`  | `np.random.normal()`  | Gaussian via Box-Muller | 25        |

**Box-Muller transform implementation notes**:

- Generates pairs of independent standard normal values from pairs of uniform values
- When `n` is odd, generate `n+1` values and discard the last one
- Use `Math.random()` as the uniform source (adequate for signal generation, not cryptographic)
- Formula: `z0 = sqrt(-2 * ln(u1)) * cos(2 * PI * u2)`, `z1 = sqrt(-2 * ln(u1)) * sin(2 * PI * u2)`

**Estimated total**: ~50 lines

**Verification**:

```bash
# Statistical validation: mean and std should be within expected bounds
npm run test:unit -- tests/unit/hackrf/dsp/random.test.ts
```

---

## Task 7.2.3: CRC-16 Implementation (`crc/crc16.ts`)

**Replaces**: `hackrf_emitter/backend/rf_workflows/crc16_python.py` (70 lines)

### Functions to implement:

| Function                                                       | Python Equivalent | Description                                   |
| -------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| `crc16Xmodem(data: Uint8Array, initialValue?: number): number` | `crc16xmodem()`   | CRC-16/XMODEM (poly=0x1021, init=0x0000)      |
| `crc16Ccitt(data: Uint8Array, initialValue?: number): number`  | `crc16ccitt()`    | CRC-16/CCITT-FALSE (poly=0x1021, init=0xFFFF) |
| `crc16Modbus(data: Uint8Array): number`                        | `crc16modbus()`   | Alias: crc16Xmodem with init=0xFFFF           |

**Implementation detail**: Both XMODEM and CCITT use polynomial 0x1021. They differ only in initial value.
The Python `crc16modbus()` calls `crc16xmodem(data, 0xFFFF)`, making it functionally identical to `crc16ccitt()`.
The TypeScript implementation should preserve this structure for traceability.

**Algorithm** (direct computation, no lookup table for 70 lines of code):

```
for each byte in data:
    crc ^= byte << 8
    for 8 bits:
        if crc & 0x8000:
            crc = (crc << 1) ^ 0x1021
        else:
            crc = crc << 1
    crc &= 0xFFFF
return crc
```

**Estimated total**: ~45 lines

**Verification**:

```bash
# Compare against golden reference vectors from Phase 7.1.4.4
npm run test:unit -- tests/unit/hackrf/dsp/crc16.test.ts
```

---

## Task 7.2.4: CRC-24 Implementation (`crc/crc24.ts`)

**Replaces**: `_calculate_crc()` method in `adsb_protocol.py`

### Functions to implement:

| Function                          | Python Equivalent               | Description                                        |
| --------------------------------- | ------------------------------- | -------------------------------------------------- |
| `crc24(data: Uint8Array): number` | `ADSBProtocol._calculate_crc()` | CRC-24/Q for Mode S (poly=0xFFF409, init=0x000000) |

**Implementation notes**:

- ADS-B Mode S uses CRC-24 polynomial generator: 0x1FFF409
- Input: 11-byte downlink format message (88 bits)
- Output: 24-bit CRC value
- The CRC is XORed with the last 3 bytes of the 14-byte extended squitter

**Estimated total**: ~25 lines

**Verification**:

```bash
# Compare against golden reference vectors from Phase 7.1.4.4
npm run test:unit -- tests/unit/hackrf/dsp/crc24.test.ts
```

---

## Task 7.2.5: REMOVED -- Butterworth Filter Design

**REMOVED BY INDEPENDENT AUDIT (2026-02-08)**: A comprehensive grep of the entire hackrf_emitter/ directory confirms that `scipy.signal.butter` is never called anywhere in the Python codebase. This task was phantom work -- it proposed replacing a function that does not exist. The ~120 lines of implementation effort and 8 golden file test configurations are unnecessary.

**Evidence**: `grep -r "scipy\.signal" hackrf_emitter/` returns zero results.

---

## Task 7.2.6: REMOVED -- IIR Filter Application

**REMOVED BY INDEPENDENT AUDIT (2026-02-08)**: `scipy.signal.lfilter` is never called anywhere in the Python codebase. No IIR filter application is needed.

---

## Task 7.2.7: REMOVED -- FIR Filter Design

**REMOVED BY INDEPENDENT AUDIT (2026-02-08)**: `scipy.signal.firwin` is never called anywhere in the Python codebase. No FIR filter design is needed.

---

## Task 7.2.8: I/Q Sample Generation (`iq/iq-generator.ts`)

**Replaces**: Common I/Q patterns found across all protocol files

### Functions to implement:

| Function                                                                                                         | Purpose                                          | Max Lines |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------- |
| `generateCarrier(frequency: number, sampleRate: number, duration: number): { i: Float64Array; q: Float64Array }` | Generate I/Q carrier at given frequency          | 15        |
| `interleaveIQ(i: Float64Array, q: Float64Array): Float64Array`                                                   | Interleave I and Q samples [I0, Q0, I1, Q1, ...] | 10        |
| `normalizeAmplitude(samples: Float64Array, maxAmplitude?: number): Float64Array`                                 | Normalize to [-1, 1] or specified range          | 10        |
| `applyGain(samples: Float64Array, gainDb: number): Float64Array`                                                 | Apply gain in dB                                 | 8         |

**Estimated total**: ~60 lines

---

## Task 7.2.9: I/Q Format Converter (`iq/iq-converter.ts`)

**Replaces**: `_samples_to_uint8_file()` and `_samples_to_complex64_file()` in hackrf_controller.py

### CRITICAL: hackrf_transfer Binary Format

`hackrf_transfer -t <file>` expects input in **unsigned 8-bit interleaved I/Q format with DC offset bias**:

- Each sample is 2 bytes: `[I_uint8, Q_uint8]`
- Range: 0 to 255 (unsigned byte)
- The Float64Array signal data (range -1.0 to +1.0) must be scaled with a +127 DC offset
- Float value -1.0 maps to uint8 value 0
- Float value 0.0 maps to uint8 value 127 (DC center)
- Float value +1.0 maps to uint8 value 254

The original plan did NOT document this conversion pipeline. This is a critical gap because
incorrect scaling or clipping produces corrupted RF output.

### Functions to implement:

| Function                                                              | Purpose                                                                | Max Lines                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | --- |
| `float64ToUint8IQ(samples: Float64Array): Uint8Array`                 | Convert Float64 I/Q to uint8 with +127 bias for hackrf_transfer CLI    | 15                                                   |
| `float64ToComplex64(samples: Float64Array): Float32Array`             | Convert Float64 I/Q to complex64 (float32 pairs) for python_hackrf API | 15                                                   |
| `writeIQFile(samples: Float64Array, filePath: string, format: 'uint8' | 'complex64'): Promise<void>`                                           | Write I/Q samples to binary file in specified format | 20  |

**NOTE**: The Python codebase has TWO conversion pipelines (hackrf_controller.py):

1. **Pipeline A -- uint8 for hackrf_transfer CLI** (lines 330-341): `np.clip(np.real(samples) * 127 + 127, 0, 255).astype(np.uint8)`
2. **Pipeline B -- complex64 for python_hackrf API** (lines 318-328): `samples.astype(np.complex64)`

Both pipelines must be faithfully replicated.

**Conversion formula (verified against hackrf_controller.py lines 330-336)**:

```
uint8_value = clamp(float64_value * 127 + 127, 0, 255)
```

**Estimated total**: ~60 lines

---

## Task 7.2.10: FFT Implementation Decision

**SCOPE CORRECTION (Independent Audit 2026-02-08)**: numpy.fft is used in exactly ONE file -- `raw_energy_protocol.py` -- in 3 functions (`generate_white_noise`, `generate_pink_noise`, `generate_shaped_noise`) for bandwidth limiting. No other protocol encoder uses FFT. This task should be scoped accordingly -- the FFT implementation is needed only for raw energy signal generation, not as a core DSP library concern.

**Replaces**: `numpy.fft.fft()`

### Decision Required

The original plan stated "Custom FFT or `fft.js` library" without specifying which. This is unacceptable
for a military-grade plan. The decision MUST be made here:

**Option A: `fft.js` npm package** (RECOMMENDED)

- Well-tested, pure JavaScript FFT
- Supports radix-2 Cooley-Tukey algorithm
- Compatible with Float64Array
- ~4KB minified, no native dependencies
- GitHub: https://github.com/nicola/fft.js (MIT license)

**Option B: Custom FFT implementation**

- Full control over numerical behavior
- Higher maintenance burden
- ~100 lines for a basic radix-2 FFT
- Risk of implementation bugs in a safety-critical context

**Recommendation**: Option A (`fft.js`). A well-tested external implementation is safer than a custom
one for a safety-critical application. Add it as a production dependency and pin the exact version.

**If Option A is chosen**, add to `package.json`:

```bash
npm install fft.js@4.0.4 --save-exact
```

**If Option B is chosen**, implement in `math/fft.ts` (~100 lines) with golden file tests
against numpy.fft.fft() output.

---

## Standards for All DSP Code

1. **No `any` types** anywhere in the `dsp/` directory
2. **No `number[]`** for signal data -- use `Float64Array`, `Float32Array`, `Int8Array`, or `Uint8Array`
3. **All functions under 60 lines** (enforced by linter)
4. **All magic numbers as named constants** with units in comments:
    ```typescript
    const CRC16_POLYNOMIAL = 0x1021; // CRC-CCITT polynomial
    const HACKRF_FREQ_MIN_MHZ = 1; // HackRF One minimum frequency
    ```
5. **All public functions have JSDoc** with parameter descriptions and return type
6. **No side effects** -- every DSP function is pure (input -> output, no state mutation)
7. **Explicit error handling** -- throw typed errors for invalid inputs, never return NaN silently

---

## Barrel Export (`index.ts`)

```typescript
// src/lib/server/hackrf/dsp/index.ts
export * from './math/typed-arrays';
export * from './math/random';
export * from './crc/crc16';
export * from './crc/crc24';
export * from './iq/iq-generator';
export * from './iq/iq-converter';
```

---

## Verification Checklist

- [ ] `math/typed-arrays.ts`: All 17 functions implemented, tests pass against numpy equivalents
- [ ] `math/random.ts`: Box-Muller transform produces statistically valid normal distribution
- [ ] `crc/crc16.ts`: All 3 CRC-16 variants match golden reference vectors (7 test inputs each)
- [ ] `crc/crc24.ts`: CRC-24 matches golden reference vectors for Mode S messages
- [ ] `iq/iq-generator.ts`: Carrier generation produces correct frequency content
- [ ] `iq/iq-converter.ts`: Float64 to int8/uint8 conversion preserves signal within quantization error
- [ ] FFT decision made and implemented (fft.js installed OR custom implementation tested)
- [ ] All files pass `npm run typecheck`
- [ ] No `any` types in `src/lib/server/hackrf/dsp/**/*.ts`
- [ ] All functions under 60 lines
- [ ] All magic numbers as named constants
- [ ] Barrel export in `index.ts` covers all public APIs

---

## Definition of Done

This phase is complete when:

1. All unit tests in `tests/unit/hackrf/dsp/` pass
2. Every CRC, filter, and utility function matches its numpy/scipy equivalent within documented tolerance
3. `npm run typecheck` passes with zero errors for the `dsp/` directory
4. No protocol encoder work has begun (that is Phase 7.3)
