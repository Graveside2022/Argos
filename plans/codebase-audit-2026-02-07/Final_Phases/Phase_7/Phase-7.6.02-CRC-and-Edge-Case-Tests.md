# Phase 7.6.02: CRC and Edge Case Tests

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Tasks 7.6.3 + 7.6.4)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete (CRC implementations in TypeScript), Phase 7.1.4 CRC golden files generated, existing test suite green
**Estimated Duration**: 2-3 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

CRC (Cyclic Redundancy Check) functions are used in ADS-B (CRC-24) and other RF protocols for error detection. A single bit error in a CRC implementation means the transmitted signal fails integrity checks on the receiver side. Edge case tests verify that the TypeScript encoders handle boundary conditions correctly -- zero-length signals, NaN inputs, out-of-range frequencies, etc.

These tests are deterministic and exact. Unlike golden file tests which allow floating-point tolerance, CRC tests require exact integer matches. Edge case tests verify that the safety manager rejects invalid inputs rather than producing corrupt output.

---

## Task 7.6.3: CRC Tests

**File**: `tests/unit/hackrf/crc.test.ts`

### CRC-16 Tests

Load test vectors from `tests/golden-files/hackrf/crc/crc16-reference.json`. Each vector contains an input hex string and the expected CRC-16 output for three variants: XMODEM, CCITT, and MODBUS.

**Total assertions**: 7 test vectors x 3 CRC variants = **21 assertions**

```typescript
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';

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

**CRC-16 pass criteria**: All 21 assertions must produce exact integer matches. No tolerance. A CRC is either correct or wrong -- there is no "close enough" for integrity checksums.

### CRC-24 Tests

Load test vectors from `tests/golden-files/hackrf/crc/crc24-reference.json`. CRC-24 is specifically used in ADS-B Mode S transponder messages.

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

**CRC-24 pass criteria**: All test vectors must produce exact integer matches. The CRC-24 polynomial for ADS-B is 0xFFF409 and there is exactly one correct output per input.

---

## Task 7.6.4: Edge Case Tests

**File**: `tests/unit/hackrf/edge-cases.test.ts`

### Edge Case Test Table

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

### Edge Case Test Design Notes

- Tests 1-4, 9-11: **Acceptance tests** -- valid boundary inputs that must produce correct output.
- Tests 5, 12-13: **Safety manager rejection** -- out-of-range values that the safety manager must block before they reach the encoder. Expect a thrown error or an error response object, never a corrupt signal.
- Tests 6-7: **Zod validation rejection** -- non-numeric inputs caught by the schema layer. These return HTTP 400 if tested via API, or throw ZodError if tested at the function level.
- Test 8: **Resource bounding** -- a 3600-second signal at 2 Msps would require ~57 GB of Float64 memory. The transmit manager must either stream the signal in chunks or reject with a `SIGNAL_TOO_LARGE` error.
- Test 14: **Degenerate CRC** -- an empty input should return the CRC initial value (0x0000 for CRC-16 XMODEM, 0xFFFF for CCITT, etc.), not crash.

---

## Verification Commands

```bash
# Run CRC tests
npm run test:unit -- tests/unit/hackrf/crc.test.ts

# Run edge case tests
npm run test:unit -- tests/unit/hackrf/edge-cases.test.ts

# Run both with verbose output
npm run test:unit -- tests/unit/hackrf/crc.test.ts tests/unit/hackrf/edge-cases.test.ts --reporter=verbose

# Verify golden CRC files exist
ls -la tests/golden-files/hackrf/crc/crc16-reference.json tests/golden-files/hackrf/crc/crc24-reference.json
```

---

## Verification Checklist

- [ ] CRC golden file `tests/golden-files/hackrf/crc/crc16-reference.json` exists with 7 test vectors
- [ ] CRC golden file `tests/golden-files/hackrf/crc/crc24-reference.json` exists
- [ ] Test file `tests/unit/hackrf/crc.test.ts` exists and compiles
- [ ] Test file `tests/unit/hackrf/edge-cases.test.ts` exists and compiles
- [ ] CRC-16 XMODEM: 7/7 vectors pass with exact integer match
- [ ] CRC-16 CCITT: 7/7 vectors pass with exact integer match
- [ ] CRC-16 MODBUS: 7/7 vectors pass with exact integer match
- [ ] CRC-24: All vectors pass with exact integer match
- [ ] Edge case #1: Zero-length signal returns empty Float64Array
- [ ] Edge case #2: 6000 MHz accepted
- [ ] Edge case #3: 2 Msps produces valid output
- [ ] Edge case #4: 47 dB gain accepted
- [ ] Edge case #5: -100 MHz rejected by safety manager
- [ ] Edge case #6: NaN rejected by Zod (400)
- [ ] Edge case #7: Infinity rejected by Zod (400)
- [ ] Edge case #8: 3600s signal memory bounded
- [ ] Edge case #9: 0.001s produces at least 1 sample pair
- [ ] Edge case #10: mod_index=0 produces unmodulated carrier
- [ ] Edge case #11: 1 MHz accepted
- [ ] Edge case #12: 6001 MHz rejected by safety manager
- [ ] Edge case #13: 48 dB rejected by safety manager
- [ ] Edge case #14: Empty CRC input returns initial value
- [ ] ALL CRC tests pass (21 CRC-16 assertions + all CRC-24 assertions)
- [ ] ALL 14/14 edge case tests pass

---

## Pass Criteria

- **CRC**: All assertions produce exact integer matches. No tolerance. A wrong CRC means a broken protocol.
- **Edge cases**: 14/14 tests pass. Every boundary condition handled correctly.

---

## Definition of Done

1. Test file `tests/unit/hackrf/crc.test.ts` is created and compiles without errors
2. Test file `tests/unit/hackrf/edge-cases.test.ts` is created and compiles without errors
3. All 21 CRC-16 assertions pass (7 vectors x 3 variants)
4. All CRC-24 assertions pass with exact integer match
5. All 14 edge case tests pass
6. `npm run test:unit -- tests/unit/hackrf/crc.test.ts tests/unit/hackrf/edge-cases.test.ts` exits with code 0

---

## Cross-References

- **Phase 7.1.4**: Golden file generation (produces CRC reference JSON files)
- **Phase 7.2**: DSP Core Library (CRC implementations: `crc16Xmodem`, `crc16Ccitt`, `crc16Modbus`, `crc24`)
- **Phase 7.4**: Service Layer (safety manager that rejects out-of-range inputs)
- **Phase 7.6.01**: Golden File Comparison Tests (complementary correctness gate)
- **Phase 7.6.07**: Final Gate Check (CRC is Gate 3, edge cases is Gate 4 of 10)
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
