# Phase 7.2.04: I/Q Sample Generation and Conversion

**Risk Level**: CRITICAL -- Incorrect I/Q conversion produces corrupted RF output from hackrf_transfer hardware
**Prerequisites**: Phase 7.1 (golden files), Phase 7.2.01 (Float64Array utilities -- sinArray, cosArray, scaleArray used by carrier generation)
**Estimated Duration**: 3-4 hours implementation + 2 hours testing
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Tasks 7.2.8 and 7.2.9 combined)

---

## Purpose

Implement the I/Q (In-phase/Quadrature) sample generation and format conversion functions that form the final stage of the signal processing pipeline. Every protocol encoder produces I/Q samples that must be converted to a binary format compatible with the HackRF One hardware. There are TWO distinct output pipelines:

- **Pipeline A**: Unsigned 8-bit interleaved I/Q for `hackrf_transfer` CLI tool
- **Pipeline B**: Complex64 (float32 interleaved pairs) for `python_hackrf` API

Incorrect conversion in Pipeline A produces corrupted RF transmissions. The +127 DC offset bias is the most common source of errors -- omitting it shifts the entire signal spectrum and produces garbage output.

**Replaces**:

- Common I/Q patterns found across all protocol files (carrier generation, interleaving, normalization)
- `_samples_to_uint8_file()` in `hackrf_controller.py` (lines 330-341) -- Pipeline A
- `_samples_to_complex64_file()` in `hackrf_controller.py` (lines 318-328) -- Pipeline B

---

## Part A: I/Q Sample Generation (`iq/iq-generator.ts`)

**Target file**: `src/lib/server/hackrf/dsp/iq/iq-generator.ts`
**Estimated total**: ~60 lines

### Functions to Implement

| #   | Function Signature                                                                                               | Purpose                                                  | Max Lines |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------- |
| 1   | `generateCarrier(frequency: number, sampleRate: number, duration: number): { i: Float64Array; q: Float64Array }` | Generate I/Q carrier at given frequency                  | 15        |
| 2   | `interleaveIQ(i: Float64Array, q: Float64Array): Float64Array`                                                   | Interleave I and Q samples `[I0, Q0, I1, Q1, ...]`       | 10        |
| 3   | `normalizeAmplitude(samples: Float64Array, maxAmplitude?: number): Float64Array`                                 | Normalize peak amplitude to `[-1, 1]` or specified range | 10        |
| 4   | `applyGain(samples: Float64Array, gainDb: number): Float64Array`                                                 | Apply gain in decibels                                   | 8         |

### Implementation Details

#### generateCarrier

Generates a complex carrier signal at the specified frequency:

```
numSamples = floor(sampleRate * duration)
t = linspace(0, duration, numSamples)         // time vector (uses typed-arrays.ts)
phase = 2 * PI * frequency * t[k]             // for each sample k
i[k] = cos(phase)                             // in-phase component
q[k] = sin(phase)                             // quadrature component
```

**Dependencies**: Uses `linspace()` from Phase 7.2.01 (typed-arrays.ts) for time vector generation.

**Validation**:

- `frequency` must be non-negative
- `sampleRate` must be positive
- `duration` must be positive
- Throw typed errors for invalid inputs

#### interleaveIQ

Produces the standard interleaved format used by SDR hardware:

```
output = [I[0], Q[0], I[1], Q[1], I[2], Q[2], ...]
output.length = 2 * i.length
```

**Validation**: `i.length` must equal `q.length`; throw on mismatch.

#### normalizeAmplitude

Scales all samples so the peak absolute value equals `maxAmplitude` (default 1.0):

```
peak = max(abs(samples))
if peak === 0: return samples (avoid division by zero)
scale = maxAmplitude / peak
output[k] = samples[k] * scale
```

#### applyGain

Converts dB gain to linear multiplier and scales:

```
linearGain = 10^(gainDb / 20)     // voltage gain, not power gain
output[k] = samples[k] * linearGain
```

**Named constant**: `DB_TO_LINEAR_DIVISOR = 20` with comment explaining voltage vs power.

---

## Part B: I/Q Format Converter (`iq/iq-converter.ts`)

**Target file**: `src/lib/server/hackrf/dsp/iq/iq-converter.ts`
**Estimated total**: ~60 lines

### CRITICAL: hackrf_transfer Binary Format Documentation

`hackrf_transfer -t <file>` expects input in **unsigned 8-bit interleaved I/Q format with DC offset bias**:

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Sample format      | Unsigned 8-bit integer (`Uint8Array`)                    |
| Byte order         | Interleaved: `[I_uint8, Q_uint8, I_uint8, Q_uint8, ...]` |
| Value range        | 0 to 255                                                 |
| DC center          | 127 (unsigned bias point)                                |
| Float -1.0 maps to | uint8 value 0                                            |
| Float 0.0 maps to  | uint8 value 127                                          |
| Float +1.0 maps to | uint8 value 254                                          |

### Conversion Formula (Pipeline A -- uint8 for hackrf_transfer CLI)

**Verified against `hackrf_controller.py` lines 330-336**:

```python
# Original Python (hackrf_controller.py:330-336)
samples_uint8 = np.zeros(num_samples * 2, dtype=np.uint8)
samples_uint8[0::2] = np.clip(np.real(iq_samples) * 127 + 127, 0, 255).astype(np.uint8)
samples_uint8[1::2] = np.clip(np.imag(iq_samples) * 127 + 127, 0, 255).astype(np.uint8)
```

**TypeScript equivalent**:

```typescript
uint8_value = Math.round(Math.max(0, Math.min(255, float64_value * 127 + 127)));
```

**CRITICAL NOTES**:

1. The `* 127` scale factor (not `* 128`) is intentional -- it maps `[-1, +1]` to `[0, 254]`, leaving headroom at 255
2. The `+ 127` DC offset bias is MANDATORY -- without it, the signal is centered at 0 instead of 127
3. `Math.round()` is used for the final integer conversion (Python's `astype(np.uint8)` truncates, but rounding produces lower quantization error)
4. `clip(0, 255)` prevents unsigned overflow from floating-point values slightly outside `[-1, +1]`

### Conversion Formula (Pipeline B -- complex64 for python_hackrf API)

**Verified against `hackrf_controller.py` lines 318-328**:

```python
# Original Python (hackrf_controller.py:318-328)
complex_samples = iq_samples.astype(np.complex64)
```

The complex64 format stores interleaved float32 pairs `[real32, imag32, real32, imag32, ...]`. In TypeScript, this is a `Float32Array` with the same interleaving as the input `Float64Array` but downcast to 32-bit precision.

### Functions to Implement

| #   | Function Signature                                                                                    | Purpose                                                                           | Max Lines |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------- |
| 1   | `float64ToUint8IQ(samples: Float64Array): Uint8Array`                                                 | Convert Float64 I/Q to uint8 with +127 bias for hackrf_transfer CLI (Pipeline A)  | 15        |
| 2   | `float64ToComplex64(samples: Float64Array): Float32Array`                                             | Convert Float64 I/Q to complex64 float32 pairs for python_hackrf API (Pipeline B) | 15        |
| 3   | `writeIQFile(samples: Float64Array, filePath: string, format: 'uint8' \| 'complex64'): Promise<void>` | Write I/Q samples to binary file in specified format                              | 20        |

### Named Constants

```typescript
/** DC offset bias for unsigned 8-bit I/Q (hackrf_transfer format) */
const HACKRF_DC_OFFSET = 127;

/** Scale factor for float64-to-uint8 conversion */
const HACKRF_SCALE_FACTOR = 127;

/** Minimum unsigned 8-bit value */
const UINT8_MIN = 0;

/** Maximum unsigned 8-bit value */
const UINT8_MAX = 255;
```

### writeIQFile Implementation Notes

- Uses `node:fs/promises` for async file I/O
- Calls `float64ToUint8IQ()` or `float64ToComplex64()` based on `format` parameter
- Writes raw binary buffer (no headers, no metadata)
- File path validation: reject paths containing `..` or null bytes
- Must handle the case where the target directory does not exist (throw, do not create)

---

## Test Files

**Generator test path**: `tests/unit/hackrf/dsp/iq-generator.test.ts`
**Converter test path**: `tests/unit/hackrf/dsp/iq-converter.test.ts`

### Generator Test Categories:

1. **Carrier frequency**: Generate carrier at known frequency, verify via zero-crossing count
2. **Interleaving**: Verify `[I0, Q0, I1, Q1]` ordering and output length = 2 \* input length
3. **Normalization**: Verify peak amplitude equals target; handle all-zero input
4. **Gain**: Verify 0 dB = no change, +6 dB ~= 2x amplitude, -6 dB ~= 0.5x amplitude
5. **Error handling**: Negative frequency, zero sample rate, mismatched I/Q lengths

### Converter Test Categories:

1. **Pipeline A boundary values**:
    - Float `-1.0` -> uint8 `0`
    - Float `0.0` -> uint8 `127`
    - Float `+1.0` -> uint8 `254`
    - Float values > +1.0 clamped to 255
    - Float values < -1.0 clamped to 0
2. **Pipeline A round-trip**: Generate known signal, convert to uint8, verify values
3. **Pipeline B precision**: Float64 to Float32 conversion within `Float32` epsilon
4. **Pipeline B length**: Output Float32Array length equals input Float64Array length
5. **writeIQFile**: Write to temp file, read back, verify binary content
6. **Error handling**: Invalid format string, path traversal attempt

### CRITICAL: Pipeline A Verification Against Python

The definitive test is to generate the same signal in both Python (numpy) and TypeScript, convert both through Pipeline A, and verify byte-for-byte identity. This test should load golden I/Q files from Phase 7.1.

---

## Verification

### Primary verification commands:

```bash
# Generator tests
npm run test:unit -- tests/unit/hackrf/dsp/iq-generator.test.ts

# Converter tests
npm run test:unit -- tests/unit/hackrf/dsp/iq-converter.test.ts
```

### Expected output:

```
 PASS  tests/unit/hackrf/dsp/iq-generator.test.ts
  iq-generator
    generateCarrier
      produces correct number of samples
      I/Q are 90 degrees out of phase
      frequency matches zero-crossing analysis
      throws on negative frequency
      throws on zero sample rate
    interleaveIQ
      correct [I0,Q0,I1,Q1] ordering
      output length is 2x input
      throws on length mismatch
    normalizeAmplitude
      peak equals target amplitude
      handles all-zero input
      default maxAmplitude is 1.0
    applyGain
      0 dB produces identical output
      +6 dB approximately doubles amplitude
      -6 dB approximately halves amplitude

 PASS  tests/unit/hackrf/dsp/iq-converter.test.ts
  iq-converter
    float64ToUint8IQ (Pipeline A)
      -1.0 maps to 0
      0.0 maps to 127
      +1.0 maps to 254
      clamps values > +1.0 to 255
      clamps values < -1.0 to 0
      matches Python golden file output
    float64ToComplex64 (Pipeline B)
      output length matches input
      values within Float32 epsilon
    writeIQFile
      writes uint8 format correctly
      writes complex64 format correctly
      rejects invalid format
      rejects path traversal
```

### Secondary verification commands:

```bash
# Type safety
npx tsc --noEmit src/lib/server/hackrf/dsp/iq/iq-generator.ts src/lib/server/hackrf/dsp/iq/iq-converter.ts

# No 'any' types
grep -c 'any' src/lib/server/hackrf/dsp/iq/iq-generator.ts src/lib/server/hackrf/dsp/iq/iq-converter.ts
# Expected: 0 for both files

# Line counts within budget
wc -l src/lib/server/hackrf/dsp/iq/iq-generator.ts
# Expected: <= 80 (60 code + imports/comments)
wc -l src/lib/server/hackrf/dsp/iq/iq-converter.ts
# Expected: <= 80 (60 code + imports/comments)
```

---

## Verification Checklist

### I/Q Generator

- [ ] `generateCarrier()` returns `{ i: Float64Array; q: Float64Array }` with correct lengths
- [ ] `generateCarrier()` I and Q components are 90 degrees out of phase (cos/sin)
- [ ] `interleaveIQ()` produces `[I0, Q0, I1, Q1, ...]` ordering (NOT `[I0, I1, ..., Q0, Q1, ...]`)
- [ ] `interleaveIQ()` output length = `2 * i.length`
- [ ] `interleaveIQ()` throws on `i.length !== q.length`
- [ ] `normalizeAmplitude()` peak equals `maxAmplitude` (default 1.0)
- [ ] `normalizeAmplitude()` handles all-zero input without division-by-zero
- [ ] `applyGain()` uses `10^(gainDb/20)` (voltage gain, NOT power gain `10^(gainDb/10)`)
- [ ] All input validation: throw on negative frequency, zero/negative sampleRate, zero/negative duration

### I/Q Converter

- [ ] `float64ToUint8IQ()` uses formula: `round(clamp(value * 127 + 127, 0, 255))`
- [ ] DC offset bias of +127 is applied (CRITICAL -- without this, output is corrupted)
- [ ] Scale factor is 127 (NOT 128)
- [ ] Float `-1.0` maps to uint8 `0`
- [ ] Float `0.0` maps to uint8 `127`
- [ ] Float `+1.0` maps to uint8 `254`
- [ ] Values outside `[-1, +1]` are clamped (not wrapped or truncated)
- [ ] `float64ToComplex64()` produces Float32Array of same length
- [ ] `writeIQFile()` writes raw binary (no headers)
- [ ] `writeIQFile()` rejects paths containing `..` or null bytes
- [ ] Pipeline A output matches Python golden file byte-for-byte

### Both Files

- [ ] No `any` types
- [ ] JSDoc on all exported functions with `@param` and `@returns`
- [ ] All magic numbers as named constants with comments
- [ ] No function exceeds 60 lines
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Definition of Done

This sub-task is complete when:

1. `src/lib/server/hackrf/dsp/iq/iq-generator.ts` exists with all 4 exported functions
2. `src/lib/server/hackrf/dsp/iq/iq-converter.ts` exists with all 3 exported functions
3. Pipeline A (uint8) conversion matches Python golden file output byte-for-byte
4. Pipeline B (complex64) conversion matches Python output within Float32 epsilon
5. `npx tsc --noEmit` produces zero errors for both files
6. Zero instances of `any` in either file
7. No function exceeds 60 lines
8. Both files are re-exported via barrel in `src/lib/server/hackrf/dsp/index.ts` (Phase 7.2.06)

---

## Cross-References

- **Blocking**: Phase 7.1 (golden I/Q files for byte-for-byte comparison)
- **Blocking**: Phase 7.2.01 (typed-arrays.ts -- `linspace`, `sinArray`, `cosArray`, `scaleArray`, `clip` used by generator)
- **Blocks**: Phase 7.2.06 (barrel export includes both iq-generator and iq-converter)
- **Blocks**: Phase 7.3 (every protocol encoder calls `interleaveIQ` + `float64ToUint8IQ` as final output stage)
- **Blocks**: Phase 7.4 (service layer uses `writeIQFile` to produce files for `hackrf_transfer`)
- **Independent of**: Phase 7.2.02 (random), Phase 7.2.03 (CRC), Phase 7.2.05 (FFT)
