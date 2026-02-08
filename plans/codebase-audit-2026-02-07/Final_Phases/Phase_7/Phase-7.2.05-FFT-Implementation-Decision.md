# Phase 7.2.05: FFT Implementation Decision

**Risk Level**: LOW -- Used in exactly ONE file for 3 noise-shaping functions; not on the critical signal path
**Prerequisites**: Phase 7.1 (golden files for FFT output verification)
**Estimated Duration**: 1 hour (install + wrapper + tests)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Task 7.2.10)

---

## Purpose

Make a definitive, auditable decision on the FFT (Fast Fourier Transform) implementation to use for the TypeScript migration. The original Phase 7.2 plan stated "Custom FFT or `fft.js` library" without committing to either option. This ambiguity is unacceptable for a military-grade plan. The decision is made here with full rationale.

---

## Scope Correction (Independent Audit 2026-02-08)

**`numpy.fft` is used in exactly ONE file**: `hackrf_emitter/backend/rf_workflows/raw_energy_protocol.py`

**It appears in exactly 3 functions**:

1. `generate_white_noise()` -- FFT for bandwidth limiting
2. `generate_pink_noise()` -- FFT for 1/f spectral shaping
3. `generate_shaped_noise()` -- FFT for arbitrary spectral envelope

**No other protocol encoder uses FFT.** This is NOT a core DSP library concern -- it is a specialized requirement for raw energy signal generation only.

### Evidence

```bash
grep -r "numpy.fft\|np.fft\|from numpy import fft" hackrf_emitter/
# Returns matches ONLY in raw_energy_protocol.py
```

```bash
grep -rn "fft" hackrf_emitter/backend/rf_workflows/ --include="*.py" | grep -v "__pycache__"
# All matches in raw_energy_protocol.py only
```

This scoping means the FFT implementation carries LOW risk -- if it has a bug, only raw energy noise generation is affected, not ADS-B, AIS, POCSAG, or any other protocol encoder.

---

## Decision: Option A -- `fft.js` npm Package (RECOMMENDED)

### Option A: `fft.js` npm package

| Property         | Value                                 |
| ---------------- | ------------------------------------- |
| Package          | `fft.js`                              |
| Version          | `4.0.4` (pin exact)                   |
| License          | MIT                                   |
| Repository       | https://github.com/nicola/fft.js      |
| Size             | ~4KB minified                         |
| Dependencies     | Zero (pure JavaScript)                |
| Algorithm        | Radix-2 Cooley-Tukey FFT              |
| Compatibility    | Float64Array input/output             |
| Node.js support  | Yes (no browser-specific APIs)        |
| TypeScript types | `@types/fft.js` or inline declaration |

**Advantages**:

- Well-tested across thousands of npm dependents
- Pure JavaScript -- no native bindings, no compilation, no platform issues on ARM64/RPi 5
- Radix-2 Cooley-Tukey is the standard FFT algorithm (same as numpy uses internally)
- 4KB is negligible impact on bundle size
- MIT license compatible with any deployment

**Risks**:

- External dependency (mitigated by exact version pinning and `package-lock.json`)
- No TypeScript types in main package (mitigated by inline declaration file)

### Option B: Custom FFT implementation (NOT RECOMMENDED)

| Property      | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Lines of code | ~100 lines for radix-2 FFT                                    |
| Maintenance   | Ongoing -- any bug is our responsibility                      |
| Testing       | Requires extensive golden file validation                     |
| Risk          | HIGH -- FFT implementation bugs are subtle and hard to detect |

**Disadvantages**:

- Custom numerical code in a safety-critical application is a liability
- FFT bugs manifest as spectral artifacts that may not be obvious in time-domain inspection
- 100 lines of code to maintain vs 0 lines (using a library)
- No upstream bug fixes or performance improvements

### Decision Rationale

For a military-grade codebase, minimizing custom numerical code reduces the attack surface for correctness bugs. The FFT is a commodity algorithm with no Argos-specific requirements. Using a well-tested external implementation is the safer, more defensible choice.

---

## Installation

### Exact install command (pin version):

```bash
npm install fft.js@4.0.4 --save-exact
```

### Verify installation:

```bash
# Confirm exact version in package.json
grep '"fft.js"' package.json
# Expected: "fft.js": "4.0.4"

# Confirm in lockfile
grep 'fft.js' package-lock.json | head -5
```

### TypeScript Declaration (if `@types/fft.js` does not exist)

Create `src/lib/server/hackrf/dsp/types/fft.d.ts`:

```typescript
declare module 'fft.js' {
	export default class FFT {
		constructor(size: number);
		readonly size: number;
		createComplexArray(): Float64Array;
		toComplexArray(input: Float64Array, storage?: Float64Array): Float64Array;
		fromComplexArray(complex: Float64Array, storage?: Float64Array): Float64Array;
		completeSpectrum(spectrum: Float64Array): void;
		transform(output: Float64Array, input: Float64Array): void;
		realTransform(output: Float64Array, input: Float64Array): void;
		inverseTransform(output: Float64Array, input: Float64Array): void;
	}
}
```

---

## Wrapper Module

To maintain the DSP library's consistent API style and isolate the external dependency, create a thin wrapper:

**Target file**: `src/lib/server/hackrf/dsp/math/fft.ts`
**Estimated total**: ~30 lines

```typescript
/**
 * FFT wrapper around fft.js library.
 * Used exclusively by raw_energy_protocol for noise bandwidth limiting.
 *
 * @module dsp/math/fft
 */
import FFTLib from 'fft.js';

/**
 * Compute the forward FFT of a real-valued signal.
 * Input length MUST be a power of 2.
 *
 * @param signal - Real-valued input signal (Float64Array, length must be power of 2)
 * @returns Complex output as Float64Array [re0, im0, re1, im1, ...]
 * @throws Error if signal length is not a power of 2
 */
export function fft(signal: Float64Array): Float64Array { ... }

/**
 * Compute the inverse FFT, returning a real-valued signal.
 *
 * @param spectrum - Complex spectrum as Float64Array [re0, im0, re1, im1, ...]
 * @returns Real-valued output signal (Float64Array)
 * @throws Error if spectrum length is not 2 * power-of-2
 */
export function ifft(spectrum: Float64Array): Float64Array { ... }
```

### Power-of-2 Validation

```typescript
function isPowerOf2(n: number): boolean {
	return n > 0 && (n & (n - 1)) === 0;
}
```

The wrapper throws a descriptive error if the input length is not a power of 2, rather than letting `fft.js` produce undefined behavior.

---

## Test File

**Test path**: `tests/unit/hackrf/dsp/fft.test.ts`

### Test Categories:

1. **Round-trip**: `ifft(fft(signal))` approximately equals original signal (within Float64 epsilon)
2. **Known transform**: FFT of a pure cosine at frequency k should have peak at bin k
3. **Golden file comparison**: Compare against numpy.fft.fft() output from Phase 7.1 golden files
4. **Power-of-2 enforcement**: Non-power-of-2 input throws descriptive error
5. **Edge cases**: Length 1 (trivial), length 2 (smallest nontrivial)

---

## Verification

### Primary verification command:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/fft.test.ts
```

### Expected output:

```
 PASS  tests/unit/hackrf/dsp/fft.test.ts
  fft
    forward transform
      pure cosine has peak at correct bin
      matches numpy.fft.fft golden output
      throws on non-power-of-2 input
    inverse transform
      round-trip fft -> ifft recovers signal
      throws on invalid spectrum length
    edge cases
      length 1 signal
      length 2 signal
```

### Secondary verification commands:

```bash
# Confirm fft.js installed at exact version
node -e "const F = require('fft.js'); console.log('fft.js loaded, size:', new F(256).size)"
# Expected: fft.js loaded, size: 256

# Type safety
npx tsc --noEmit src/lib/server/hackrf/dsp/math/fft.ts

# No 'any' types in wrapper
grep -c 'any' src/lib/server/hackrf/dsp/math/fft.ts
# Expected: 0

# Line count
wc -l src/lib/server/hackrf/dsp/math/fft.ts
# Expected: <= 50 (30 code + imports/comments/JSDoc)
```

---

## Verification Checklist

- [ ] `fft.js@4.0.4` installed with `--save-exact` (version pinned in package.json)
- [ ] TypeScript declaration exists (either `@types/fft.js` or custom `.d.ts`)
- [ ] Wrapper module `src/lib/server/hackrf/dsp/math/fft.ts` exports `fft()` and `ifft()`
- [ ] Power-of-2 validation with descriptive error message
- [ ] `fft()` accepts `Float64Array` and returns `Float64Array` (complex interleaved)
- [ ] `ifft()` accepts complex `Float64Array` and returns real `Float64Array`
- [ ] Round-trip `ifft(fft(x))` equals `x` within IEEE 754 tolerance
- [ ] Golden file comparison against numpy.fft.fft() output passes
- [ ] No `any` types in wrapper module
- [ ] JSDoc on both exported functions
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Definition of Done

This sub-task is complete when:

1. `fft.js@4.0.4` is installed and version-pinned in `package.json`
2. TypeScript type declaration exists for `fft.js`
3. `src/lib/server/hackrf/dsp/math/fft.ts` wrapper exports `fft()` and `ifft()`
4. All unit tests pass including golden file comparison against numpy.fft.fft()
5. `npx tsc --noEmit` produces zero errors
6. Zero instances of `any` in the wrapper
7. Wrapper is NOT added to the barrel export in `index.ts` unless raw_energy_protocol requires it (see note below)

### Note on Barrel Export

The FFT wrapper MAY be excluded from the main `dsp/index.ts` barrel export since it is used by exactly one protocol encoder. If excluded, `raw_energy_protocol.ts` imports directly:

```typescript
import { fft, ifft } from '../dsp/math/fft';
```

If the team prefers consistency, it CAN be added to the barrel. This is an architectural preference, not a correctness concern. Phase 7.2.06 documents whichever decision is made.

---

## Cross-References

- **Blocking**: Phase 7.1 (golden FFT output files for comparison)
- **Blocks**: Phase 7.3 (raw_energy_protocol encoder imports fft/ifft for noise bandwidth limiting)
- **Related**: Phase 7.2.02 (random.ts -- normalRandom produces the noise input that FFT then shapes)
- **Independent of**: Phase 7.2.01 (typed-arrays), Phase 7.2.03 (CRC), Phase 7.2.04 (I/Q)
