# Phase 7.2.06: DSP Standards Enforcement and Barrel Export

**Risk Level**: LOW -- Configuration and structural task; no numerical logic
**Prerequisites**: Phase 7.2.01 through Phase 7.2.05 (all DSP modules must exist before barrel export and standards verification)
**Estimated Duration**: 1-2 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Standards section, Barrel Export section, Verification Checklist, Definition of Done)

---

## Purpose

This sub-task is the final gate for Phase 7.2. It defines the 7 mandatory coding standards for all DSP code, creates the barrel export file, provides the architecture diagram, and contains the comprehensive verification checklist that covers the ENTIRE Phase 7.2 (all 6 sub-tasks). No protocol encoder work (Phase 7.3) may begin until every item in this checklist passes.

---

## DSP Code Standards (Mandatory for All Files in `src/lib/server/hackrf/dsp/`)

### Standard 1: No `any` Types

Every parameter, return type, local variable, and generic must have an explicit type annotation. The `any` type is FORBIDDEN in the entire `dsp/` directory tree.

**Enforcement**:

```bash
grep -rn '\bany\b' src/lib/server/hackrf/dsp/ --include="*.ts" | grep -v '\.d\.ts' | grep -v '// eslint-disable'
# Expected: 0 results
```

**Rationale**: `any` defeats TypeScript's type system. In numerical code, type errors manifest as silent data corruption (e.g., `string + number` concatenation instead of addition).

### Standard 2: No `number[]` for Signal Data

All signal data paths MUST use typed arrays: `Float64Array`, `Float32Array`, `Int8Array`, or `Uint8Array`. The generic `number[]` type is forbidden for any variable that carries signal samples.

**Enforcement**:

```bash
grep -rn 'number\[\]' src/lib/server/hackrf/dsp/ --include="*.ts"
# Expected: 0 results (or only in non-signal contexts like indices)
```

**Rationale**: `Float64Array` provides IEEE 754 guarantees, contiguous memory layout, and prevents accidental insertion of `undefined` or `NaN` values. `number[]` is a JavaScript array with object overhead and no memory layout guarantees.

**Exception**: `number[]` is acceptable ONLY for non-signal data such as array indices or configuration parameters. If used, a comment must explain why.

### Standard 3: 60-Line Function Limit

No function in `dsp/` may exceed 60 lines (measured from opening brace to closing brace, excluding blank lines and comments). Functions approaching the limit should be decomposed.

**Enforcement**: ESLint rule or manual review. The max-lines-per-function counts from Phase 7.2.01-7.2.05 guarantee compliance:

| Module          | Longest Function  | Max Lines |
| --------------- | ----------------- | --------- |
| typed-arrays.ts | interp()          | 20        |
| random.ts       | normalRandom()    | 25        |
| crc16.ts        | crc16Xmodem()     | ~20       |
| crc24.ts        | crc24()           | ~15       |
| iq-generator.ts | generateCarrier() | 15        |
| iq-converter.ts | writeIQFile()     | 20        |
| fft.ts          | fft()             | ~15       |

All functions are well within the 60-line limit.

### Standard 4: Named Constants for All Magic Numbers

Every numeric literal that represents a domain concept MUST be extracted to a `const` with a descriptive name and a comment including units where applicable.

**Examples of compliant code**:

```typescript
/** CRC-CCITT polynomial (x^16 + x^12 + x^5 + 1) */
const CRC16_POLYNOMIAL = 0x1021;

/** HackRF One minimum transmit frequency in MHz */
const HACKRF_FREQ_MIN_MHZ = 1;

/** DC offset bias for unsigned 8-bit I/Q format */
const HACKRF_DC_OFFSET = 127;

/** Scale factor for float64-to-uint8 I/Q conversion */
const HACKRF_SCALE_FACTOR = 127;

/** Voltage gain conversion divisor (20 for voltage, 10 for power) */
const DB_TO_LINEAR_DIVISOR = 20;
```

**Exceptions**: `0`, `1`, `2`, `-1` are permitted without naming when their meaning is self-evident from context (e.g., array indexing, parity checks).

### Standard 5: JSDoc on All Public Functions

Every exported function MUST have a JSDoc comment block with:

- One-sentence description
- `@param` tag for every parameter (with description)
- `@returns` tag (with description)
- `@throws` tag if the function can throw (with condition)

**Example**:

```typescript
/**
 * Compute CRC-16/XMODEM checksum over a byte array.
 *
 * @param data - Input bytes to compute checksum over
 * @param initialValue - Initial CRC value (default: 0x0000 for XMODEM)
 * @returns 16-bit CRC value as a number in range [0, 0xFFFF]
 * @throws Error if data is not a Uint8Array
 */
export function crc16Xmodem(data: Uint8Array, initialValue: number = 0x0000): number {
```

### Standard 6: No Side Effects (Pure Functions)

Every function in `dsp/` must be a pure function: given the same inputs, it always returns the same output. No function may:

- Modify its input arguments
- Read or write global state
- Perform I/O (except `writeIQFile`, which is the sole exemption)
- Log to console
- Depend on `Date.now()` or other non-deterministic sources (except `Math.random()` in `random.ts`, which is documented)

**Rationale**: Pure functions are trivially testable, parallelizable, and cacheable. Side effects in numerical code create hidden state that causes intermittent, hard-to-reproduce bugs.

**Documented exemptions**:

1. `random.ts` uses `Math.random()` (non-deterministic by design)
2. `iq-converter.ts` `writeIQFile()` performs file I/O (its explicit purpose)

### Standard 7: Explicit Error Handling

Functions MUST throw typed errors for invalid inputs. They MUST NOT:

- Return `NaN` silently
- Return `undefined`
- Return an empty array when the caller expects data
- Allow `Infinity` to propagate

**Error handling patterns**:

```typescript
// CORRECT: Throw on invalid input
if (n < 0) {
	throw new RangeError(`zeros: n must be non-negative, got ${n}`);
}

// CORRECT: Throw on empty input to maxArray
if (arr.length === 0) {
	throw new RangeError('maxArray: cannot compute maximum of empty array');
}

// WRONG: Return NaN silently
if (arr.length === 0) return NaN; // FORBIDDEN

// WRONG: Return empty array without documentation
if (n === 0) return new Float64Array(0); // Only OK if documented in JSDoc
```

---

## Barrel Export File

**Target file**: `src/lib/server/hackrf/dsp/index.ts`

### Complete Content

```typescript
/**
 * Core DSP (Digital Signal Processing) library for HackRF signal generation.
 *
 * This barrel export provides all public DSP functions used by protocol encoders.
 * Every function is pure (no side effects), strongly typed (no `any`), and uses
 * typed arrays (Float64Array/Uint8Array) for all signal data paths.
 *
 * @module dsp
 */

// Math utilities -- Float64Array creation and manipulation (replaces numpy)
export {
	zeros,
	ones,
	linspace,
	arange,
	concatenate,
	clip,
	interp,
	convolve,
	sinArray,
	cosArray,
	expArray,
	addArrays,
	multiplyArrays,
	scaleArray,
	sumArray,
	maxArray,
	absArray
} from './math/typed-arrays';

// Random number generation (replaces numpy.random)
export { uniformRandom, normalRandom } from './math/random';

// CRC checksums (replaces crc16_python.py and adsb_protocol._calculate_crc)
export { crc16Xmodem, crc16Ccitt, crc16Modbus } from './crc/crc16';
export { crc24 } from './crc/crc24';

// I/Q sample generation and interleaving
export { generateCarrier, interleaveIQ, normalizeAmplitude, applyGain } from './iq/iq-generator';

// I/Q format conversion for hackrf_transfer and python_hackrf
export { float64ToUint8IQ, float64ToComplex64, writeIQFile } from './iq/iq-converter';

// NOTE: FFT (math/fft.ts) is intentionally NOT exported from this barrel.
// It is used by exactly one file (raw_energy_protocol.ts) and imported directly:
//   import { fft, ifft } from '../dsp/math/fft';
// This prevents unused FFT code from being pulled into protocol encoders
// that do not need it.
```

**Estimated total**: ~45 lines (including comments)

### Export Count

| Module               | Exported Functions |
| -------------------- | ------------------ |
| math/typed-arrays.ts | 17                 |
| math/random.ts       | 2                  |
| crc/crc16.ts         | 3                  |
| crc/crc24.ts         | 1                  |
| iq/iq-generator.ts   | 4                  |
| iq/iq-converter.ts   | 3                  |
| **Total**            | **30 functions**   |

Plus `fft()` and `ifft()` available via direct import (not barrel-exported).

---

## Architecture Diagram

```
src/lib/server/hackrf/dsp/
|
|-- index.ts                          # Barrel export (30 public functions)
|
|-- math/
|   |-- typed-arrays.ts               # 17 functions, ~160 lines
|   |   |   zeros, ones, linspace, arange, concatenate, clip,
|   |   |   interp, convolve, sinArray, cosArray, expArray,
|   |   |   addArrays, multiplyArrays, scaleArray, sumArray,
|   |   |   maxArray, absArray
|   |
|   |-- random.ts                     # 2 functions, ~50 lines
|   |   |   uniformRandom, normalRandom (Box-Muller)
|   |
|   |-- fft.ts                        # 2 functions, ~30 lines (NOT in barrel)
|       |   fft, ifft (wrapper around fft.js@4.0.4)
|
|-- crc/
|   |-- crc16.ts                      # 3 functions, ~45 lines
|   |   |   crc16Xmodem, crc16Ccitt, crc16Modbus
|   |
|   |-- crc24.ts                      # 1 function, ~25 lines
|       |   crc24 (ADS-B Mode S)
|
|-- iq/
|   |-- iq-generator.ts               # 4 functions, ~60 lines
|   |   |   generateCarrier, interleaveIQ, normalizeAmplitude, applyGain
|   |
|   |-- iq-converter.ts               # 3 functions, ~60 lines
|       |   float64ToUint8IQ, float64ToComplex64, writeIQFile
|
|-- types/                            # (if needed)
    |-- fft.d.ts                      # TypeScript declaration for fft.js
```

**Total estimated code**: ~430 lines across 7 implementation files + 1 barrel + 1 type declaration

---

## Complete Phase 7.2 Verification Checklist

This checklist covers ALL sub-tasks (7.2.01 through 7.2.06). Every box must be checked before Phase 7.3 begins.

### Module Implementation

- [ ] `math/typed-arrays.ts`: All 17 functions implemented, tests pass against numpy equivalents (Phase 7.2.01)
- [ ] `math/random.ts`: Box-Muller transform produces statistically valid normal distribution (Phase 7.2.02)
- [ ] `crc/crc16.ts`: All 3 CRC-16 variants match golden reference vectors; canonical "123456789" = 0x31C3/0x29B1 (Phase 7.2.03)
- [ ] `crc/crc24.ts`: CRC-24 matches golden reference vectors for Mode S messages (Phase 7.2.03)
- [ ] `iq/iq-generator.ts`: Carrier generation produces correct frequency content (Phase 7.2.04)
- [ ] `iq/iq-converter.ts`: Float64 to uint8 conversion uses `value * 127 + 127` with clamp; matches Python golden file byte-for-byte (Phase 7.2.04)
- [ ] `math/fft.ts`: FFT wrapper installed (fft.js@4.0.4) and round-trip test passes (Phase 7.2.05)

### Standards Enforcement

- [ ] `npm run typecheck` passes with zero errors for `src/lib/server/hackrf/dsp/**/*.ts`
- [ ] No `any` types in `src/lib/server/hackrf/dsp/**/*.ts` (Standard 1)
- [ ] No `number[]` for signal data in `src/lib/server/hackrf/dsp/**/*.ts` (Standard 2)
- [ ] All functions under 60 lines (Standard 3)
- [ ] All magic numbers as named constants with comments (Standard 4)
- [ ] All exported functions have JSDoc with `@param` and `@returns` (Standard 5)
- [ ] All functions are pure (no side effects except documented exemptions) (Standard 6)
- [ ] All invalid inputs produce typed errors, not NaN or undefined (Standard 7)

### Barrel Export

- [ ] `index.ts` exports all 30 functions from 6 modules
- [ ] FFT intentionally excluded from barrel with explanatory comment
- [ ] No circular dependencies
- [ ] `import { zeros, crc16Xmodem, generateCarrier } from '../dsp'` compiles and resolves

### Test Suite

- [ ] `tests/unit/hackrf/dsp/typed-arrays.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/random.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/crc16.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/crc24.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/iq-generator.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/iq-converter.test.ts` passes
- [ ] `tests/unit/hackrf/dsp/fft.test.ts` passes

### Aggregate Verification Commands

```bash
# Run ALL DSP unit tests
npm run test:unit -- tests/unit/hackrf/dsp/

# Type check entire DSP directory
npx tsc --noEmit src/lib/server/hackrf/dsp/**/*.ts

# Verify no 'any' types (Standard 1)
grep -rn '\bany\b' src/lib/server/hackrf/dsp/ --include="*.ts" | grep -v '\.d\.ts'
# Expected: 0 results

# Verify no number[] for signal data (Standard 2)
grep -rn 'number\[\]' src/lib/server/hackrf/dsp/ --include="*.ts"
# Expected: 0 results

# Verify total line count within budget
find src/lib/server/hackrf/dsp/ -name "*.ts" -not -name "*.d.ts" | xargs wc -l
# Expected: ~430 lines total (implementation only)

# Verify barrel export resolves
node -e "
const path = require('path');
const ts = require('typescript');
console.log('Barrel export check: manual verification required');
"

# Count exported functions
grep -c 'export' src/lib/server/hackrf/dsp/index.ts
# Expected: shows export statements for 30 functions across 6 modules
```

---

## Definition of Done (Phase 7.2 Complete)

This entire Phase 7.2 is complete when ALL of the following are true:

1. **All 7 implementation files exist** in `src/lib/server/hackrf/dsp/` with correct directory structure
2. **All unit tests pass**: `npm run test:unit -- tests/unit/hackrf/dsp/` exits with 0 failures
3. **Every CRC, I/Q, and utility function matches its Python/numpy equivalent** within documented tolerance (IEEE 754 double-precision for floats; bit-exact for CRC and uint8 conversion)
4. **`npm run typecheck` passes** with zero errors for the `dsp/` directory
5. **Zero instances of `any`** in any `.ts` file under `dsp/`
6. **Zero instances of `number[]`** for signal data in any `.ts` file under `dsp/`
7. **All 7 DSP standards verified** (no violations)
8. **Barrel export** re-exports all 30 public functions
9. **fft.js@4.0.4** installed and version-pinned
10. **No protocol encoder work has begun** (that is Phase 7.3)

---

## Cross-References

- **Blocking**: Phase 7.2.01 through Phase 7.2.05 (all modules must pass before this gate)
- **Blocks**: Phase 7.3 (protocol encoders MAY NOT begin until Phase 7.2 Definition of Done is met)
- **Parent**: Phase-7.2-DSP-CORE-LIBRARY.md
