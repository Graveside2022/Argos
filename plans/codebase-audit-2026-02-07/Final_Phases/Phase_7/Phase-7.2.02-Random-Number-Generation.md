# Phase 7.2.02: Random Number Generation (`math/random.ts`)

**Risk Level**: MEDIUM -- Statistical correctness required; noise generation depends on distribution validity
**Prerequisites**: Phase 7.1 (golden files and baseline must exist)
**Estimated Duration**: 1-2 hours implementation + 1 hour testing
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Task 7.2.2)

---

## Purpose

Implement random number generation functions that replace `numpy.random.uniform()` and `numpy.random.normal()` for RF signal generation. These functions are used in noise injection, signal dithering, and test signal generation throughout the protocol encoders. The normal distribution generator uses the Box-Muller transform, a well-understood algorithm that produces pairs of independent standard normal values from pairs of uniform random values.

**Replaces**: `numpy.random.normal()`, `numpy.random.uniform()`
**Target file**: `src/lib/server/hackrf/dsp/math/random.ts`
**Estimated total**: ~50 lines

---

## Functions to Implement

| #   | Function Signature                                                    | numpy Equivalent      | Description                                    | Max Lines |
| --- | --------------------------------------------------------------------- | --------------------- | ---------------------------------------------- | --------- |
| 1   | `uniformRandom(n: number, low?: number, high?: number): Float64Array` | `np.random.uniform()` | Uniform distribution over `[low, high)`        | 10        |
| 2   | `normalRandom(n: number, mean?: number, std?: number): Float64Array`  | `np.random.normal()`  | Gaussian distribution via Box-Muller transform | 25        |

### Default parameter values:

- `uniformRandom`: `low = 0.0`, `high = 1.0`
- `normalRandom`: `mean = 0.0`, `std = 1.0`

---

## Box-Muller Transform Implementation

The Box-Muller transform converts pairs of independent uniform random values `(u1, u2)` in `(0, 1)` into pairs of independent standard normal random values `(z0, z1)`.

### Formulas

```
z0 = sqrt(-2 * ln(u1)) * cos(2 * PI * u2)
z1 = sqrt(-2 * ln(u1)) * sin(2 * PI * u2)
```

### Implementation Requirements

1. **Pair generation**: The transform produces values in pairs. Process `ceil(n/2)` pairs of uniform values.
2. **Odd-n handling**: When `n` is odd, generate `n + 1` values and discard the last one. This is simpler and more correct than special-casing the final iteration.
3. **Uniform source**: Use `Math.random()` as the uniform source. This is adequate for signal generation and noise injection. It is NOT cryptographically secure and MUST NOT be used for key generation or security-sensitive randomness.
4. **Domain guard**: `Math.random()` can return exactly 0.0, which would cause `ln(0) = -Infinity`. Guard against this: if `u1 === 0`, replace with `Number.EPSILON` (2.220446049250313e-16).
5. **Scaling**: After generating standard normal values (mean=0, std=1), apply affine transform: `value = z * std + mean`.
6. **No seeding**: Unlike numpy, `Math.random()` cannot be seeded. Tests must use statistical validation (mean/std within tolerance), not exact value comparison.

### Pseudocode

```
function normalRandom(n, mean = 0.0, std = 1.0):
    result = new Float64Array(n)
    pairs = ceil(n / 2)
    for i = 0 to pairs - 1:
        u1 = Math.random()
        if u1 === 0: u1 = Number.EPSILON
        u2 = Math.random()
        mag = sqrt(-2 * ln(u1))
        z0 = mag * cos(2 * PI * u2)
        z1 = mag * sin(2 * PI * u2)
        result[2*i] = z0 * std + mean
        if 2*i + 1 < n:
            result[2*i + 1] = z1 * std + mean
    return result
```

---

## Implementation Standards

1. **No `any` types** -- every parameter and return type explicitly typed
2. **No `number[]`** for output -- return `Float64Array`
3. **Functions under 60 lines** each
4. **Named constants**: `TWO_PI = 2 * Math.PI` with comment
5. **JSDoc on every exported function** with `@param` and `@returns`
6. **Pure functions** -- no shared state, no mutation of inputs
7. **Explicit error handling** -- throw on `n < 0`, `std < 0`, `low >= high`

---

## Statistical Validation Approach

Since `Math.random()` is non-deterministic and non-seedable, tests CANNOT compare exact values against golden files. Instead, use statistical validation:

### For `uniformRandom(n, low, high)`:

- Generate `n = 100,000` samples
- Verify: `Math.abs(mean - (low + high) / 2) < tolerance` (tolerance = 0.01 for n=100k)
- Verify: all values in `[low, high)` (no out-of-range values)
- Verify: standard deviation approximately `(high - low) / sqrt(12)` (uniform std formula)

### For `normalRandom(n, mean, std)`:

- Generate `n = 100,000` samples
- Verify: `Math.abs(sampleMean - mean) < tolerance` (tolerance = 0.05 for n=100k)
- Verify: `Math.abs(sampleStd - std) < tolerance` (tolerance = 0.05 for n=100k)
- Verify: approximately 68% of values within `[mean - std, mean + std]` (1-sigma rule, tolerance +/- 2%)
- Verify: approximately 95% within `[mean - 2*std, mean + 2*std]` (2-sigma rule, tolerance +/- 1%)

### Edge case tests (deterministic):

- `uniformRandom(0)` returns empty Float64Array
- `uniformRandom(1)` returns array of length 1
- `normalRandom(0)` returns empty Float64Array
- `normalRandom(1)` returns array of length 1
- Negative `n` throws error
- Negative `std` throws error
- `low >= high` throws error

---

## Test File

**Test path**: `tests/unit/hackrf/dsp/random.test.ts`

### Test categories:

1. **Statistical tests**: Mean, standard deviation, range validation with large sample sizes
2. **Distribution shape tests**: 1-sigma and 2-sigma percentage checks for normalRandom
3. **Edge case tests**: n=0, n=1, odd n, even n
4. **Error tests**: Negative n, negative std, invalid range
5. **Type tests**: Return type is Float64Array, not number[]

---

## Verification

### Primary verification command:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/random.test.ts
```

### Expected output:

```
 PASS  tests/unit/hackrf/dsp/random.test.ts
  random
    uniformRandom
      returns Float64Array of correct length
      values within [low, high) range
      statistical mean matches expected (n=100000)
      statistical std matches expected (n=100000)
      handles n=0 (empty array)
      handles n=1
      throws on negative n
      throws on low >= high
    normalRandom
      returns Float64Array of correct length
      statistical mean matches expected (n=100000)
      statistical std matches expected (n=100000)
      68% within 1 sigma (n=100000)
      95% within 2 sigma (n=100000)
      handles n=0 (empty array)
      handles odd n
      handles even n
      throws on negative n
      throws on negative std
```

### Secondary verification commands:

```bash
# Type safety
npx tsc --noEmit src/lib/server/hackrf/dsp/math/random.ts

# No 'any' types
grep -c 'any' src/lib/server/hackrf/dsp/math/random.ts
# Expected: 0

# Line count within budget
wc -l src/lib/server/hackrf/dsp/math/random.ts
# Expected: <= 70 (50 code + imports/comments/whitespace)
```

---

## Verification Checklist

- [ ] `uniformRandom()` implemented with correct signature and default parameters
- [ ] `normalRandom()` implemented using Box-Muller transform with correct signature
- [ ] Box-Muller domain guard: `u1 === 0` replaced with `Number.EPSILON`
- [ ] Odd-n handling: generates `n+1` values and discards last when `n` is odd
- [ ] Both functions return `Float64Array`, not `number[]`
- [ ] Default parameters: `low=0, high=1` for uniform; `mean=0, std=1` for normal
- [ ] Error handling: throws on `n < 0`, `std < 0`, `low >= high`
- [ ] JSDoc on both exported functions
- [ ] No `any` types in file
- [ ] No function exceeds 60 lines
- [ ] Statistical tests pass with n=100,000 samples
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Definition of Done

This sub-task is complete when:

1. `src/lib/server/hackrf/dsp/math/random.ts` exists with both exported functions
2. All statistical validation tests pass (mean, std, range, sigma percentages)
3. `npx tsc --noEmit` produces zero errors for the file
4. Zero instances of `any` or `number[]` in the file
5. No function exceeds 60 lines
6. File is re-exported via barrel in `src/lib/server/hackrf/dsp/index.ts` (Phase 7.2.06)

---

## Cross-References

- **Blocking**: Phase 7.1 (baseline must exist, though golden file comparison is not used for random -- statistical validation only)
- **Blocks**: Phase 7.2.06 (barrel export includes this module)
- **Blocks**: Phase 7.3 (protocol encoders that inject noise use normalRandom)
- **Related**: Phase 7.2.01 (typed-arrays.ts -- same `math/` directory, independent implementation)
- **Related**: Phase 7.2.05 (FFT -- raw_energy_protocol.py uses normalRandom for noise generation before FFT-based bandwidth limiting)
