# Phase 7.6.01: Golden File Comparison Tests

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Task 7.6.1)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete (all TypeScript implementation), Phase 7.1.4 golden files generated, existing test suite green (`npm run test:unit` 0 failures)
**Estimated Duration**: 2-3 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Golden file comparison is the primary correctness gate for the Python-to-TypeScript migration. Each protocol encoder in TypeScript must produce output that is bit-level identical (within floating-point tolerance) to the Python reference output generated in Phase 7.1.4.

If a golden file test fails, it means the TypeScript encoder produces different RF output than the Python encoder. This is a hard blocker -- no Python code is deleted until ALL 8 golden file tests pass.

---

## Task: Protocol Golden File Tests (7.6.1.1)

**File**: `tests/unit/hackrf/golden-file.test.ts`

For each protocol encoder, load the golden reference file generated in Phase 7.1.4 and compare against the TypeScript encoder output.

### Protocol Test Table

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

### Tolerance Notes

- **Float64 intermediate calculations**: `toBeCloseTo(value, 10)` allows approximately 5e-11 difference. This accounts for platform-specific floating-point rounding (IEEE 754 double precision) between Python/numpy and V8 JavaScript.
- **Final uint8/int8 I/Q output** (hackrf_transfer format): strict equality (`toBe`). Once samples are quantized to 8-bit integers, there is zero tolerance -- the bytes sent to the HackRF hardware must be identical.
- **Precision divergence documentation**: If a test fails at precision 10 but passes at precision 8 (5e-9), document the source of the numerical divergence (e.g., `Math.sin` vs `numpy.sin` implementation differences, trigonometric polynomial approximation order) and assess whether it affects RF output quality. The documentation path is: `tests/golden-files/hackrf/PRECISION-NOTES.md`.

### Full Test Structure

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

	test('GPS encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/gps-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/gps-reference.bin')).buffer
		);

		const encoder = new GPSEncoder();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('ELRS encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/elrs-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/elrs-reference.bin')).buffer
		);

		const encoder = new ELRSEncoder();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('ELRS Jamming encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/elrs-jamming-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/elrs-jamming-reference.bin')).buffer
		);

		const encoder = new ELRSJamming();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('Drone Video Jamming encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/drone-video-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/drone-video-reference.bin')).buffer
		);

		const encoder = new DroneVideoJamming();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('Raw Energy encoder matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'protocols/raw-energy-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'protocols/raw-energy-reference.bin')).buffer
		);

		const encoder = new RawEnergy();
		const result = encoder.generateTransmission(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('AM Modulation matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'modulation/am-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'modulation/am-reference.bin')).buffer
		);

		const result = Modulation.generateAM(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});

	test('FM Modulation matches Python reference', () => {
		const params = JSON.parse(
			readFileSync(join(goldenDir, 'modulation/fm-reference.json'), 'utf-8')
		);
		const reference = new Float64Array(
			readFileSync(join(goldenDir, 'modulation/fm-reference.bin')).buffer
		);

		const result = Modulation.generateFM(params);

		expect(result.length).toBe(reference.length);
		for (let i = 0; i < result.length; i++) {
			expect(result[i]).toBeCloseTo(reference[i], 10);
		}
	});
});
```

---

## Verification Commands

```bash
# Run golden file comparison tests
npm run test:unit -- tests/unit/hackrf/golden-file.test.ts

# Run with verbose output showing each test
npm run test:unit -- tests/unit/hackrf/golden-file.test.ts --reporter=verbose

# Verify golden files exist before running tests
ls -la tests/golden-files/hackrf/protocols/*.bin tests/golden-files/hackrf/modulation/*.bin
```

---

## Verification Checklist

- [ ] Golden file directory `tests/golden-files/hackrf/protocols/` exists and contains 6 `.bin` + 6 `.json` files
- [ ] Golden file directory `tests/golden-files/hackrf/modulation/` exists and contains 2 `.bin` + 2 `.json` files
- [ ] Test file `tests/unit/hackrf/golden-file.test.ts` exists and compiles
- [ ] ADS-B encoder matches Python reference (precision 10)
- [ ] GPS encoder matches Python reference (precision 10)
- [ ] ELRS encoder matches Python reference (precision 10)
- [ ] ELRS Jamming encoder matches Python reference (precision 10)
- [ ] Drone Video Jamming encoder matches Python reference (precision 10)
- [ ] Raw Energy encoder matches Python reference (precision 10)
- [ ] AM Modulation matches Python reference (precision 10)
- [ ] FM Modulation matches Python reference (precision 10)
- [ ] ALL 8/8 golden file tests pass
- [ ] Any precision divergences documented in `tests/golden-files/hackrf/PRECISION-NOTES.md`

---

## Pass Criteria

ALL 8 tests must pass. Zero tolerance for golden file failures. If any test fails, Phase 7.7 (Python deletion) is BLOCKED.

---

## Definition of Done

1. Test file `tests/unit/hackrf/golden-file.test.ts` is created and compiles without errors
2. All 8 golden file tests pass with `toBeCloseTo(ref, 10)` tolerance
3. No precision divergences remain undocumented
4. `npm run test:unit -- tests/unit/hackrf/golden-file.test.ts` exits with code 0

---

## Cross-References

- **Phase 7.1.4**: Golden file generation (produces the `.bin` and `.json` reference files)
- **Phase 7.2**: DSP Core Library (Float64Array utilities used by encoders)
- **Phase 7.3**: Protocol Encoders (ADSBEncoder, GPSEncoder, etc.)
- **Phase 7.6.07**: Final Gate Check (this test is Gate 1 of 10)
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
