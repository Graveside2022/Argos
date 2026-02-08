# Phase 7.3.02: ADS-B Encoder Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.1)
**Risk Level**: HIGH -- ADS-B signal generation correctness directly affects RF transmission fidelity; CRC-24 must be bit-exact
**Prerequisites**: Phase-7.3.01 (types.ts and directory structure), Phase 7.2 (DSP core: `dsp/crc/crc24.ts` must exist)
**Estimated Duration**: 6 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the ADS-B Mode S protocol encoder from Python to TypeScript. The ADS-B encoder generates simulated Mode S transponder signals at 1090 MHz, encoding aircraft identification, position (CPR encoding), velocity, and altitude into I/Q samples suitable for HackRF transmission.

This is the first protocol encoder migration. Its patterns (class structure, error handling, golden file testing) establish the template for all subsequent encoders.

---

## Source and Target

| Property         | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/adsb_protocol.py`   |
| **Source lines** | 580 lines                                                |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/adsb-encoder.ts`    |
| **Target lines** | ~450 lines (estimated)                                   |
| **Golden file**  | `tests/golden-files/hackrf/protocols/adsb-reference.bin` |

---

## Classes to Migrate

| #   | Python Class                      | TypeScript Equivalent  | Estimated Lines |
| --- | --------------------------------- | ---------------------- | --------------- |
| 1   | `Aircraft` (dataclass, line 17)   | `interface Aircraft`   | ~15             |
| 2   | `FlightPlan` (dataclass, line 34) | `interface FlightPlan` | ~10             |
| 3   | `ADSBProtocol` (line 42)          | `class ADSBEncoder`    | ~425            |

### Interface Definitions

The Python `Aircraft` dataclass becomes a TypeScript interface with all fields typed explicitly. The Python `FlightPlan` dataclass similarly becomes a readonly interface. Neither requires runtime validation beyond the error handling specification (Phase-7.3.10).

The `ADSBProtocol` class becomes `ADSBEncoder` (renamed for clarity -- it encodes, not decodes). The class must implement `ProtocolEncoder` from `types.ts`.

---

## Methods to Migrate (18 methods)

| #   | Python Method                          | TypeScript Method                     | Notes                                                  |
| --- | -------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| 1   | `__init__`                             | `constructor()`                       | Initialize aircraft list, constants                    |
| 2   | `add_aircraft`                         | `addAircraft()`                       | Add aircraft to simulation                             |
| 3   | `_calculate_crc`                       | Use `crc24()` from `dsp/crc/crc24.ts` | **CRITICAL: Do NOT re-implement** -- use shared CRC-24 |
| 4   | `_encode_aircraft_identification`      | `encodeAircraftIdentification()`      | 6-bit character encoding                               |
| 5   | `_encode_adsb_char`                    | `encodeADSBChar()`                    | Single character to 6-bit                              |
| 6   | `_encode_airborne_position`            | `encodeAirbornePosition()`            | CPR encoding                                           |
| 7   | `_encode_altitude`                     | `encodeAltitude()`                    | Barometric altitude encoding                           |
| 8   | `_encode_cpr_latitude`                 | `encodeCPRLatitude()`                 | Compact Position Reporting latitude                    |
| 9   | `_encode_cpr_longitude`                | `encodeCPRLongitude()`                | Compact Position Reporting longitude                   |
| 10  | `_encode_velocity`                     | `encodeVelocity()`                    | Ground speed + heading encoding                        |
| 11  | `_generate_preamble`                   | `generatePreamble()`                  | 8 microsecond preamble pattern                         |
| 12  | `_modulate_message`                    | `modulateMessage()`                   | PPM modulation at 1090 MHz                             |
| 13  | `_simulate_aircraft_movement`          | `simulateAircraftMovement()`          | Position update per timestep                           |
| 14  | `generate_adsb_transmission`           | `generateTransmission()`              | Main entry point (public API)                          |
| 15  | `generate_signal` (nested)             | Inline in `generateTransmission()`    | Remove nested function; inline into parent             |
| 16  | `_generate_adsb_transmission_internal` | `generateTransmissionInternal()`      | Core generation logic                                  |
| 17  | `_create_default_aircraft`             | `createDefaultAircraft()`             | Factory method for test/demo aircraft                  |
| 18  | `get_aircraft_list`                    | `getAircraftList()`                   | Accessor (returns readonly copy)                       |

### Method Count Reconciliation

The parent document lists 18 methods but the table has 18 rows. The original Python `_calculate_crc` method (row 3) is NOT migrated as a method -- it is replaced by a call to the shared `crc24()` function from `dsp/crc/crc24.ts`. The method count of "18 methods" therefore means 17 new TypeScript methods + 1 delegation to the existing CRC module.

---

## CRC-24 Delegation (CRITICAL)

The Python `_calculate_crc` method must NOT be re-implemented in `adsb-encoder.ts`. Instead:

```typescript
import { crc24 } from '../crc/crc24';

// Inside ADSBEncoder class:
private calculateCRC(data: Uint8Array): number {
    return crc24(data);
}
```

**Rationale**: CRC-24 is used by multiple protocols. A single, tested implementation in `dsp/crc/crc24.ts` (Phase 7.2) is the authoritative source. Duplicating CRC logic is a defect.

---

## Key Numerical Operations

| Operation                | Specification                                                  | Precision Requirement    |
| ------------------------ | -------------------------------------------------------------- | ------------------------ |
| CRC-24 computation       | Generator polynomial 0xFFF409, delegated to `dsp/crc/crc24.ts` | Bit-exact (integer)      |
| PPM (Pulse Position Mod) | 1 Mbps data rate, 1 microsecond bit periods                    | Float64 intermediate     |
| Carrier modulation       | 1090 MHz center frequency                                      | Float64 intermediate     |
| CPR encoding             | Compact Position Reporting, ICAO Annex 10                      | Exact integer arithmetic |
| Altitude encoding        | 25-foot increments, Gillham code                               | Exact integer arithmetic |
| 6-bit character encoding | ICAO character set (A-Z, 0-9, space)                           | Exact (lookup table)     |

### CPR Encoding Warning

CPR (Compact Position Reporting) latitude and longitude encoding requires exact integer arithmetic. The Python implementation uses `int()` truncation. In TypeScript, use `Math.trunc()` (NOT `Math.floor()`, which rounds toward negative infinity for negative numbers). This distinction is critical for negative latitudes/longitudes.

---

## Error Handling

Per Phase-7.3.10 specification, the following error conditions must be handled:

1. `generateTransmission()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateTransmission()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateTransmission()` with duration exceeding 10s at 2 Msps -> throw `RangeError` with memory estimate
4. `addAircraft()` with missing required fields -> throw `TypeError` listing required fields
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/adsb-encoder.test.ts

# Golden file comparison
# tests/golden-files/hackrf/protocols/adsb-reference.bin

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/adsb-encoder.ts && echo "FAIL" || echo "PASS"

# CRC-24 is imported, not re-implemented
grep -n 'crc24' src/lib/server/hackrf/dsp/protocols/adsb-encoder.ts | head -5

# File line count
wc -l src/lib/server/hackrf/dsp/protocols/adsb-encoder.ts
```

---

## Verification Checklist

- [ ] `adsb-encoder.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `interface Aircraft` defined with all fields from Python `Aircraft` dataclass
- [ ] `interface FlightPlan` defined with all fields from Python `FlightPlan` dataclass
- [ ] `class ADSBEncoder` implements `ProtocolEncoder` from `types.ts`
- [ ] All 18 methods accounted for (17 TypeScript methods + 1 CRC delegation)
- [ ] `_calculate_crc` replaced with import of `crc24()` from `dsp/crc/crc24.ts` -- NOT re-implemented
- [ ] `generate_signal` nested function inlined into `generateTransmission()`
- [ ] CPR encoding uses `Math.trunc()` (not `Math.floor()`) for integer truncation
- [ ] PPM modulation at 1 Mbps data rate implemented
- [ ] Carrier modulation at 1090 MHz implemented
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] Golden file test passes: `tests/golden-files/hackrf/protocols/adsb-reference.bin`
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 18 methods from `adsb_protocol.py` have documented TypeScript equivalents in `adsb-encoder.ts`
2. CRC-24 is delegated to `dsp/crc/crc24.ts` (no local reimplementation)
3. Golden file comparison test passes with `toBeCloseTo(value, 10)` for Float64 and strict equality for uint8
4. All 5 error handling conditions throw the specified exception types
5. `npm run typecheck` passes
6. File line count is approximately 450 lines (maximum tolerance: 500)

---

## Cross-References

- **Previous**: Phase-7.3.01-Protocol-Types-and-Architecture.md
- **Next**: Phase-7.3.03-GPS-Encoder-Migration.md
- **CRC dependency**: Phase 7.2 (`dsp/crc/crc24.ts`)
- **Enhanced mode**: Phase-7.3.09 adds `generateEnhancedTransmission()` method (from `_run_enhanced_adsb`)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` calls `generateTransmission()`)
- **Modulation delegation**: Phase-7.3.08 (`modulation.ts` delegates `_generate_ads_b_packet` to this encoder)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
