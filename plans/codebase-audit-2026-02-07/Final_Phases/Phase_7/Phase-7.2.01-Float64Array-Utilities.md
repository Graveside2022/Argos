# Phase 7.2.01: Float64Array Utilities (`math/typed-arrays.ts`)

**Risk Level**: MEDIUM -- Numerical correctness critical; every protocol encoder depends on these primitives
**Prerequisites**: Phase 7.1 (golden files and baseline must exist)
**Estimated Duration**: 3-4 hours implementation + 2 hours testing
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Task 7.2.1)

---

## Purpose

Implement the foundational typed-array math utilities that replace all numpy array creation and element-wise manipulation functions used throughout the hackrf_emitter Python codebase. This is the most-imported module in the DSP library -- every CRC, I/Q, and protocol encoder file depends on it. Correctness here propagates to the entire signal chain; errors here corrupt every downstream output.

**Target file**: `src/lib/server/hackrf/dsp/math/typed-arrays.ts`
**Estimated total**: ~160 lines

---

## Functions to Implement

All 17 functions are listed below with exact signatures, numpy equivalents, behavioral specifications, and maximum line budgets.

| #   | Function Signature                                                          | numpy Equivalent   | Description                                      | Max Lines |
| --- | --------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ | --------- |
| 1   | `zeros(n: number): Float64Array`                                            | `np.zeros(n)`      | Create zero-filled array of length `n`           | 3         |
| 2   | `ones(n: number): Float64Array`                                             | `np.ones(n)`       | Create array filled with 1.0 of length `n`       | 5         |
| 3   | `linspace(start: number, stop: number, num: number): Float64Array`          | `np.linspace()`    | Evenly spaced values inclusive of endpoints      | 10        |
| 4   | `arange(start: number, stop: number, step: number): Float64Array`           | `np.arange()`      | Values with step increment, exclusive of `stop`  | 10        |
| 5   | `concatenate(arrays: Float64Array[]): Float64Array`                         | `np.concatenate()` | Join multiple arrays into one contiguous array   | 10        |
| 6   | `clip(arr: Float64Array, min: number, max: number): Float64Array`           | `np.clip()`        | Clamp all values to `[min, max]` range           | 8         |
| 7   | `interp(x: Float64Array, xp: Float64Array, fp: Float64Array): Float64Array` | `np.interp()`      | 1-D linear interpolation                         | 20        |
| 8   | `convolve(a: Float64Array, b: Float64Array): Float64Array`                  | `np.convolve()`    | Discrete linear convolution (full mode)          | 15        |
| 9   | `sinArray(arr: Float64Array): Float64Array`                                 | `np.sin()`         | Element-wise sine                                | 8         |
| 10  | `cosArray(arr: Float64Array): Float64Array`                                 | `np.cos()`         | Element-wise cosine                              | 8         |
| 11  | `expArray(arr: Float64Array): Float64Array`                                 | `np.exp()`         | Element-wise exponential                         | 8         |
| 12  | `addArrays(a: Float64Array, b: Float64Array): Float64Array`                 | `a + b`            | Element-wise addition (lengths must match)       | 8         |
| 13  | `multiplyArrays(a: Float64Array, b: Float64Array): Float64Array`            | `a * b`            | Element-wise multiplication (lengths must match) | 8         |
| 14  | `scaleArray(arr: Float64Array, scalar: number): Float64Array`               | `a * scalar`       | Multiply every element by a scalar               | 8         |
| 15  | `sumArray(arr: Float64Array): number`                                       | `np.sum()`         | Sum all elements (Kahan summation for precision) | 5         |
| 16  | `maxArray(arr: Float64Array): number`                                       | `np.max()`         | Return maximum value (throw on empty array)      | 5         |
| 17  | `absArray(arr: Float64Array): Float64Array`                                 | `np.abs()`         | Element-wise absolute value                      | 8         |

---

## Implementation Standards

1. **No `any` types** -- every parameter and return type explicitly typed
2. **No `number[]`** for signal data -- all signal paths use `Float64Array`
3. **Every function under 60 lines** (enforced by linter)
4. **All magic numbers as named constants** with units in comments
5. **JSDoc on every exported function** with `@param` and `@returns` tags
6. **Pure functions only** -- no side effects, no state mutation
7. **Explicit error handling** -- throw typed errors for invalid inputs (e.g., `n < 0`, mismatched lengths, empty arrays)

---

## Critical Implementation Notes

### linspace

- Must include BOTH endpoints (`start` and `stop`)
- numpy behavior: `num=1` returns `[start]`; `num=0` returns empty array
- Step calculation: `(stop - start) / (num - 1)` when `num >= 2`

### arange

- Exclusive of `stop` (matches numpy behavior)
- `step` must be non-zero; positive `step` requires `start < stop`, negative requires `start > stop`
- Edge case: when `(stop - start) / step` is not an integer, last value is the largest `start + n*step < stop`

### interp

- `xp` must be monotonically increasing (validate or document precondition)
- Values of `x` outside `[xp[0], xp[-1]]` are clamped to `fp[0]` or `fp[-1]` (matches numpy default)
- Use binary search for efficient lookup in `xp`

### convolve

- Implements "full" mode: output length = `a.length + b.length - 1`
- Direct computation (no FFT-based convolution -- that would add an FFT dependency)

### sumArray

- Consider Kahan (compensated) summation for large arrays to match numpy precision
- For arrays under ~10,000 elements, naive summation is acceptable

### maxArray

- Must throw on empty array (numpy raises ValueError)
- Return `-Infinity` is NOT acceptable; explicit error required

### addArrays / multiplyArrays

- Must validate that `a.length === b.length`; throw on mismatch
- numpy broadcasts mismatched shapes; we do NOT support broadcasting (explicit error instead)

---

## Test File

**Test path**: `tests/unit/hackrf/dsp/typed-arrays.test.ts`

### Test categories:

1. **Correctness tests**: Compare output against numpy-generated golden values from Phase 7.1
2. **Edge case tests**: Empty arrays, single-element arrays, n=0, n=1
3. **Error tests**: Negative lengths, mismatched array lengths, empty input to maxArray
4. **Precision tests**: Verify IEEE 754 double-precision tolerance (epsilon = 2.220446049250313e-16)

---

## Verification

### Primary verification command:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/typed-arrays.test.ts
```

### Expected output:

```
 PASS  tests/unit/hackrf/dsp/typed-arrays.test.ts
  typed-arrays
    zeros ..................... (17 tests)
    ones ...................... (5 tests)
    linspace .................. (8 tests)
    arange .................... (8 tests)
    concatenate ............... (6 tests)
    clip ...................... (5 tests)
    interp .................... (7 tests)
    convolve .................. (5 tests)
    sinArray .................. (4 tests)
    cosArray .................. (4 tests)
    expArray .................. (4 tests)
    addArrays ................. (5 tests)
    multiplyArrays ............ (5 tests)
    scaleArray ................ (4 tests)
    sumArray .................. (5 tests)
    maxArray .................. (5 tests)
    absArray .................. (4 tests)
```

### Secondary verification commands:

```bash
# Type safety -- zero errors expected
npx tsc --noEmit src/lib/server/hackrf/dsp/math/typed-arrays.ts

# No 'any' types in file
grep -c 'any' src/lib/server/hackrf/dsp/math/typed-arrays.ts
# Expected: 0

# No number[] usage for signal data
grep -c 'number\[\]' src/lib/server/hackrf/dsp/math/typed-arrays.ts
# Expected: 0

# Line count within budget
wc -l src/lib/server/hackrf/dsp/math/typed-arrays.ts
# Expected: <= 200 (160 code + imports/comments/whitespace)

# No function exceeds 60 lines
# (Manual review or linter enforcement)
```

---

## Verification Checklist

- [ ] All 17 functions implemented with exact signatures from the table above
- [ ] Every function has JSDoc with `@param` and `@returns`
- [ ] No `any` types anywhere in the file
- [ ] No `number[]` for signal data paths
- [ ] No function exceeds 60 lines
- [ ] All magic numbers extracted to named constants
- [ ] `zeros()` returns a new Float64Array (not shared reference)
- [ ] `linspace()` includes both endpoints; handles `num=0` and `num=1`
- [ ] `arange()` excludes `stop`; handles negative step
- [ ] `interp()` clamps out-of-range values; handles single-point xp
- [ ] `convolve()` produces output of length `a.length + b.length - 1`
- [ ] `addArrays()` and `multiplyArrays()` throw on length mismatch
- [ ] `maxArray()` throws on empty array
- [ ] All tests pass: `npm run test:unit -- tests/unit/hackrf/dsp/typed-arrays.test.ts`
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Definition of Done

This sub-task is complete when:

1. `src/lib/server/hackrf/dsp/math/typed-arrays.ts` exists with all 17 exported functions
2. All unit tests pass against numpy-equivalent golden values from Phase 7.1
3. `npx tsc --noEmit` produces zero errors for the file
4. Zero instances of `any` or `number[]` in the file
5. No function exceeds 60 lines
6. File is re-exported via barrel in `src/lib/server/hackrf/dsp/index.ts` (Phase 7.2.06)

---

## Cross-References

- **Blocking**: Phase 7.1 (golden files must exist before tests can validate)
- **Blocks**: Phase 7.2.04 (I/Q generation depends on sinArray, cosArray, scaleArray, addArrays)
- **Blocks**: Phase 7.2.06 (barrel export includes this module)
- **Blocks**: Phase 7.3 (all protocol encoders import from this module)
- **Related**: Phase 7.2.02 (random.ts -- same `math/` directory, independent implementation)
