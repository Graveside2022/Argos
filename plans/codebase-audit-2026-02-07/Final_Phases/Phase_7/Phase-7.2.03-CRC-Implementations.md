# Phase 7.2.03: CRC Implementations (CRC-16 and CRC-24)

**Risk Level**: HIGH -- Bit-exact correctness mandatory; incorrect CRC = corrupted protocol frames rejected by receivers
**Prerequisites**: Phase 7.1 (golden reference vectors from Phase 7.1.4.4 must exist)
**Estimated Duration**: 2-3 hours implementation + 2 hours golden file testing
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)
**Decomposed from**: Phase-7.2-DSP-CORE-LIBRARY.md (Tasks 7.2.3 and 7.2.4 combined)

---

## Purpose

Implement the CRC (Cyclic Redundancy Check) functions required by the protocol encoders. CRC errors in transmitted frames cause receivers to silently discard messages, making these functions the most binary-exact-critical code in the entire DSP library. Unlike floating-point math where IEEE 754 tolerance is acceptable, CRC output must be BIT-EXACT -- a single incorrect bit produces a completely different checksum.

Two CRC families are needed:

1. **CRC-16** (3 variants): Used by AIS, POCSAG, and other narrowband protocols
2. **CRC-24**: Used exclusively by ADS-B Mode S (112-bit extended squitter)

**Replaces**:

- `hackrf_emitter/backend/rf_workflows/crc16_python.py` (70 lines) -- CRC-16 variants
- `ADSBProtocol._calculate_crc()` method in `adsb_protocol.py` -- CRC-24

---

## Part A: CRC-16 Implementation

**Target file**: `src/lib/server/hackrf/dsp/crc/crc16.ts`
**Estimated total**: ~45 lines

### Functions to Implement

| #   | Function Signature                                             | Python Equivalent | Polynomial | Initial Value |
| --- | -------------------------------------------------------------- | ----------------- | ---------- | ------------- |
| 1   | `crc16Xmodem(data: Uint8Array, initialValue?: number): number` | `crc16xmodem()`   | 0x1021     | 0x0000        |
| 2   | `crc16Ccitt(data: Uint8Array, initialValue?: number): number`  | `crc16ccitt()`    | 0x1021     | 0xFFFF        |
| 3   | `crc16Modbus(data: Uint8Array): number`                        | `crc16modbus()`   | 0x1021     | 0xFFFF        |

### Key Insight: Structural Relationship

All three variants use the SAME polynomial (0x1021). They differ ONLY in initial value:

- **XMODEM**: `init = 0x0000`
- **CCITT-FALSE**: `init = 0xFFFF`
- **MODBUS**: Functionally identical to CCITT-FALSE. The Python `crc16modbus()` is implemented as `crc16xmodem(data, 0xFFFF)`.

The TypeScript implementation MUST preserve this structure for traceability back to the Python source:

```typescript
export function crc16Modbus(data: Uint8Array): number {
	return crc16Xmodem(data, 0xffff);
}
```

### Algorithm: Direct Computation (No Lookup Table)

The Python source uses direct bit-by-bit computation (not a 256-entry lookup table). The TypeScript port preserves this approach. For 70 lines of Python code, a lookup table optimization is unnecessary complexity.

**Pseudocode**:

```
function crc16Xmodem(data: Uint8Array, initialValue: number = 0x0000): number
    const CRC16_POLYNOMIAL = 0x1021   // CRC-CCITT polynomial
    let crc = initialValue & 0xFFFF

    for each byte in data:
        crc ^= (byte << 8)
        for bit = 0 to 7:
            if (crc & 0x8000) !== 0:
                crc = (crc << 1) ^ CRC16_POLYNOMIAL
            else:
                crc = crc << 1
            crc &= 0xFFFF          // Mask to 16 bits after every shift

    return crc
```

### Named Constants

```typescript
/** CRC-CCITT polynomial (x^16 + x^12 + x^5 + 1) */
const CRC16_POLYNOMIAL = 0x1021;

/** CRC-16/XMODEM default initial value */
const CRC16_INIT_XMODEM = 0x0000;

/** CRC-16/CCITT-FALSE and MODBUS initial value */
const CRC16_INIT_CCITT = 0xffff;

/** Mask to constrain CRC to 16 bits */
const CRC16_MASK = 0xffff;

/** High bit position for 16-bit CRC */
const CRC16_HIGH_BIT = 0x8000;
```

---

## Part B: CRC-24 Implementation

**Target file**: `src/lib/server/hackrf/dsp/crc/crc24.ts`
**Estimated total**: ~25 lines

### Function to Implement

| #   | Function Signature                | Python Equivalent               | Polynomial | Initial Value |
| --- | --------------------------------- | ------------------------------- | ---------- | ------------- |
| 1   | `crc24(data: Uint8Array): number` | `ADSBProtocol._calculate_crc()` | 0xFFF409   | 0x000000      |

### ADS-B Mode S CRC-24 Specification

- **Full polynomial generator**: `0x1FFF409` (x^24 + x^23 + x^22 + ... + x^10 + x^3 + 1)
- **Working polynomial** (without implicit x^24 bit): `0xFFF409`
- **Input**: 11-byte downlink format message (88 bits) -- the first 11 bytes of a 14-byte extended squitter
- **Output**: 24-bit CRC value (3 bytes)
- **Usage**: The CRC is XORed with the last 3 bytes (parity/interrogator identifier) of the 14-byte extended squitter frame

### Algorithm

```
function crc24(data: Uint8Array): number
    const CRC24_POLYNOMIAL = 0xFFF409   // ADS-B Mode S CRC-24 generator
    let crc = 0x000000                  // Initial value

    for each byte in data:
        crc ^= (byte << 16)
        for bit = 0 to 7:
            if (crc & 0x800000) !== 0:
                crc = (crc << 1) ^ CRC24_POLYNOMIAL
            else:
                crc = crc << 1
            crc &= 0xFFFFFF           // Mask to 24 bits

    return crc
```

### Named Constants

```typescript
/** ADS-B Mode S CRC-24 polynomial (without implicit x^24 bit) */
const CRC24_POLYNOMIAL = 0xfff409;

/** CRC-24 initial value */
const CRC24_INIT = 0x000000;

/** Mask to constrain CRC to 24 bits */
const CRC24_MASK = 0xffffff;

/** High bit position for 24-bit CRC */
const CRC24_HIGH_BIT = 0x800000;

/** ADS-B downlink format message length in bytes */
const ADSB_DF_MESSAGE_BYTES = 11;
```

### IMPORTANT: JavaScript Bitwise Operator Constraint

JavaScript bitwise operators work on 32-bit signed integers. For CRC-24, the maximum intermediate value is `0xFFFFFF << 1 = 0x1FFFFFE` (25 bits), which is safely within the 32-bit range. No special handling needed.

For CRC-16, the maximum intermediate value is `0xFFFF << 1 = 0x1FFFE` (17 bits), also safe.

Neither CRC variant approaches the 31-bit sign boundary (0x7FFFFFFF), so standard `|`, `&`, `^`, `<<` operators are correct.

---

## Verification Against Golden Reference Vectors

CRC functions MUST be tested against golden reference vectors generated in Phase 7.1.4.4. These are NOT statistical tests -- they are BIT-EXACT comparisons.

### Standard Test Vectors (Industry Standard)

The canonical CRC test string is `"123456789"` (ASCII bytes `0x31 0x32 0x33 0x34 0x35 0x36 0x37 0x38 0x39`):

| Algorithm               | Input (ASCII) | Expected CRC | Hex    |
| ----------------------- | ------------- | ------------ | ------ |
| CRC-16/XMODEM           | "123456789"   | 12739        | 0x31C3 |
| CRC-16/CCITT-FALSE      | "123456789"   | 10673        | 0x29B1 |
| CRC-16/MODBUS (= CCITT) | "123456789"   | 10673        | 0x29B1 |

### ADS-B Test Vectors

CRC-24 test vectors must come from known ADS-B extended squitter messages captured in Phase 7.1 golden files. Example:

| Input (11 bytes, hex) | Expected CRC-24 (hex) | Source        |
| --------------------- | --------------------- | ------------- |
| From golden file      | From golden file      | Phase 7.1.4.4 |

**NOTE**: The exact ADS-B test vectors depend on the golden files generated in Phase 7.1. The test file must load these vectors at runtime, not hardcode them.

---

## Test Files

**CRC-16 test path**: `tests/unit/hackrf/dsp/crc16.test.ts`
**CRC-24 test path**: `tests/unit/hackrf/dsp/crc24.test.ts`

### CRC-16 Test Categories:

1. **Canonical vector**: `"123456789"` against known CRC values
2. **Golden file vectors**: At least 7 test inputs per variant from Phase 7.1.4.4
3. **Empty input**: `crc16Xmodem(new Uint8Array(0))` should return initial value
4. **Single byte**: Known single-byte CRC values
5. **MODBUS === CCITT verification**: For every test input, `crc16Modbus(data) === crc16Ccitt(data)`
6. **Structural test**: `crc16Modbus(data) === crc16Xmodem(data, 0xFFFF)` for all inputs

### CRC-24 Test Categories:

1. **Golden file vectors**: ADS-B extended squitter messages from Phase 7.1.4.4
2. **Empty input**: `crc24(new Uint8Array(0))` should return 0x000000
3. **Single byte**: Known CRC-24 values for single bytes
4. **11-byte message**: Verify against known ADS-B frames

---

## Verification

### Primary verification commands:

```bash
# CRC-16 tests
npm run test:unit -- tests/unit/hackrf/dsp/crc16.test.ts

# CRC-24 tests
npm run test:unit -- tests/unit/hackrf/dsp/crc24.test.ts
```

### Expected output:

```
 PASS  tests/unit/hackrf/dsp/crc16.test.ts
  crc16
    crc16Xmodem
      canonical vector "123456789" = 0x31C3
      golden file vectors (7 inputs)
      empty input returns 0x0000
      single byte
      custom initial value
    crc16Ccitt
      canonical vector "123456789" = 0x29B1
      golden file vectors (7 inputs)
      empty input returns 0xFFFF
    crc16Modbus
      equals crc16Ccitt for all inputs
      equals crc16Xmodem with init=0xFFFF

 PASS  tests/unit/hackrf/dsp/crc24.test.ts
  crc24
    golden file ADS-B vectors
    empty input returns 0x000000
    single byte
    11-byte message
```

### Secondary verification commands:

```bash
# Type safety
npx tsc --noEmit src/lib/server/hackrf/dsp/crc/crc16.ts src/lib/server/hackrf/dsp/crc/crc24.ts

# No 'any' types
grep -c 'any' src/lib/server/hackrf/dsp/crc/crc16.ts src/lib/server/hackrf/dsp/crc/crc24.ts
# Expected: 0 for both files

# Line counts within budget
wc -l src/lib/server/hackrf/dsp/crc/crc16.ts
# Expected: <= 60 (45 code + imports/comments)
wc -l src/lib/server/hackrf/dsp/crc/crc24.ts
# Expected: <= 40 (25 code + imports/comments)
```

---

## Verification Checklist

### CRC-16

- [ ] `crc16Xmodem()` implemented with signature `(data: Uint8Array, initialValue?: number): number`
- [ ] `crc16Ccitt()` implemented with signature `(data: Uint8Array, initialValue?: number): number`
- [ ] `crc16Modbus()` implemented as `return crc16Xmodem(data, 0xFFFF)` (NOT duplicated logic)
- [ ] Polynomial 0x1021 extracted to named constant `CRC16_POLYNOMIAL`
- [ ] `crc &= 0xFFFF` applied after every shift (not just at end)
- [ ] Canonical vector "123456789" produces 0x31C3 (XMODEM) and 0x29B1 (CCITT)
- [ ] Golden file vectors from Phase 7.1.4.4 all pass (7+ inputs per variant)
- [ ] Empty input returns initial value (0x0000 for XMODEM, 0xFFFF for CCITT)

### CRC-24

- [ ] `crc24()` implemented with signature `(data: Uint8Array): number`
- [ ] Polynomial 0xFFF409 extracted to named constant `CRC24_POLYNOMIAL`
- [ ] `crc &= 0xFFFFFF` applied after every shift
- [ ] Shift uses `byte << 16` (not `byte << 8`)
- [ ] High bit check uses `0x800000` (not `0x8000`)
- [ ] Golden file ADS-B vectors from Phase 7.1.4.4 all pass
- [ ] Empty input returns 0x000000

### Both Files

- [ ] No `any` types
- [ ] JSDoc on all exported functions
- [ ] All magic numbers as named constants with comments
- [ ] No function exceeds 60 lines
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Definition of Done

This sub-task is complete when:

1. `src/lib/server/hackrf/dsp/crc/crc16.ts` exists with all 3 exported CRC-16 functions
2. `src/lib/server/hackrf/dsp/crc/crc24.ts` exists with the exported `crc24` function
3. All CRC values are BIT-EXACT against golden reference vectors from Phase 7.1.4.4
4. Canonical CRC-16 vector "123456789" produces documented values (0x31C3, 0x29B1)
5. `npx tsc --noEmit` produces zero errors for both files
6. Zero instances of `any` in either file
7. Both files are re-exported via barrel in `src/lib/server/hackrf/dsp/index.ts` (Phase 7.2.06)

---

## Cross-References

- **Blocking**: Phase 7.1.4.4 (golden reference vectors must be generated before CRC tests can validate)
- **Blocks**: Phase 7.2.06 (barrel export includes both crc16 and crc24 modules)
- **Blocks**: Phase 7.3 (ADS-B encoder imports crc24; AIS/POCSAG encoders import crc16)
- **Independent of**: Phase 7.2.01 (typed-arrays), Phase 7.2.02 (random), Phase 7.2.04 (I/Q) -- CRC has no dependency on float math
