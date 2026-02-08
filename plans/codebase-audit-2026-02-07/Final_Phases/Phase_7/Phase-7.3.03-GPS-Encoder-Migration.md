# Phase 7.3.03: GPS Encoder Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.2)
**Risk Level**: HIGH -- GPS Gold code generation and BPSK modulation must be bit-exact for signal fidelity
**Prerequisites**: Phase-7.3.01 (types.ts and directory structure), Phase 7.2 (DSP core library)
**Estimated Duration**: 6 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the GPS L1 C/A signal encoder from Python to TypeScript. The GPS encoder generates simulated GPS L1 civilian signals at 1575.42 MHz, including Gold code C/A spreading, BPSK modulation, navigation message encoding, and per-satellite Doppler shift simulation. This is one of the most numerically demanding encoders due to the Gold code LFSR (Linear Feedback Shift Register) computation and the precision requirements of carrier phase simulation.

---

## Source and Target

| Property         | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/gps_protocol.py`   |
| **Source lines** | 460 lines                                               |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/gps-encoder.ts`    |
| **Target lines** | ~350 lines (estimated)                                  |
| **Golden file**  | `tests/golden-files/hackrf/protocols/gps-reference.bin` |

---

## Classes to Migrate

| #   | Python Class                        | TypeScript Equivalent    | Estimated Lines |
| --- | ----------------------------------- | ------------------------ | --------------- |
| 1   | `GPSSatellite` (dataclass, line 16) | `interface GPSSatellite` | ~10             |
| 2   | `GPSEphemeris` (dataclass, line 29) | `interface GPSEphemeris` | ~15             |
| 3   | `GPSProtocol` (line 50)             | `class GPSEncoder`       | ~325            |

### Interface Definitions

`GPSSatellite` encapsulates per-satellite state: PRN number, elevation, azimuth, signal strength, Doppler offset, and C/A code phase. `GPSEphemeris` holds orbital parameters for navigation message generation: clock corrections, orbital elements, and health status.

`GPSProtocol` becomes `GPSEncoder` implementing `ProtocolEncoder` from `types.ts`.

---

## Methods to Migrate (16 methods)

| #   | Python Method                   | TypeScript Method               | Notes                                                      |
| --- | ------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| 1   | `__init__`                      | `constructor()`                 | Initialize satellite constellation                         |
| 2   | `_initialize_satellites`        | `initializeSatellites()`        | Set up 32 GPS satellites with PRN assignments              |
| 3   | `_generate_ephemeris_data`      | `generateEphemerisData()`       | Generate orbital parameters per satellite                  |
| 4   | `_generate_ca_code`             | `generateCACode()`              | **CRITICAL**: Gold code generation (1023 chips per period) |
| 5   | `_generate_navigation_data`     | `generateNavigationData()`      | NAV message frame encoding                                 |
| 6   | `_generate_nav_frame`           | `generateNavFrame()`            | Full navigation frame (5 subframes)                        |
| 7   | `_generate_subframe1`           | `generateSubframe1()`           | Clock correction data                                      |
| 8   | `_generate_subframe2`           | `generateSubframe2()`           | Ephemeris data I                                           |
| 9   | `_generate_subframe3`           | `generateSubframe3()`           | Ephemeris data II                                          |
| 10  | `_generate_almanac_subframe`    | `generateAlmanacSubframe()`     | Almanac page data                                          |
| 11  | `_apply_doppler_shift`          | `applyDopplerShift()`           | Frequency shift per satellite based on relative velocity   |
| 12  | `generate_gps_signal`           | `generateGPSSignal()`           | Main entry point (public API)                              |
| 13  | `generate_signal` (nested)      | Inline in `generateGPSSignal()` | Remove nested function; inline into parent                 |
| 14  | `_generate_gps_signal_internal` | `generateGPSSignalInternal()`   | Core generation logic                                      |
| 15  | `get_satellite_info`            | `getSatelliteInfo()`            | Accessor returning single satellite state                  |
| 16  | `get_constellation_info`        | `getConstellationInfo()`        | Accessor returning all satellite states                    |

---

## Key Numerical Operations

| Operation            | Specification                                                        | Precision Requirement |
| -------------------- | -------------------------------------------------------------------- | --------------------- |
| Gold code generation | XOR of G1 and G2 LFSR sequences, 1023 chips per period               | Bit-exact (integer)   |
| G1 LFSR              | Polynomial x^10 + x^3 + 1, taps at bits 3 and 10                     | Bit-exact (integer)   |
| G2 LFSR              | Polynomial x^10 + x^9 + x^8 + x^6 + x^3 + x^2 + 1, PRN-specific taps | Bit-exact (integer)   |
| BPSK modulation      | 1.023 Mchips/s chipping rate on L1 carrier (1575.42 MHz)             | Float64 intermediate  |
| Doppler shift        | Per-satellite frequency offset based on satellite-receiver geometry  | Float64 intermediate  |
| NAV message encoding | 50 bps data rate, 300-bit subframes, TLM/HOW preambles               | Bit-exact (integer)   |
| Parity computation   | GPS NAV message parity algorithm (IS-GPS-200)                        | Bit-exact (integer)   |

### Gold Code Implementation Warning

The Gold code generation uses two 10-bit LFSRs (G1 and G2). The G2 output is delayed (phase-shifted) by a PRN-specific tap configuration. In TypeScript:

1. Use `Uint8Array` or bitwise operations on `number` for the LFSR state (10 bits fits in a 32-bit integer)
2. The XOR feedback must use JavaScript bitwise operators (`^`, `&`, `>>>`)
3. The chip sequence length is exactly 1023 -- verify this in tests
4. Do NOT use floating-point for any LFSR computation

### Doppler Shift Application

The Doppler shift for each satellite modifies the carrier frequency:

```
f_received = f_carrier * (1 + v_relative / c)
```

Where `c = 299792458` m/s (speed of light, exact). Use `Float64` throughout; this operation is NOT integer-safe.

---

## Error Handling

Per Phase-7.3.10 specification:

1. `generateGPSSignal()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateGPSSignal()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateGPSSignal()` with duration exceeding memory bounds -> throw `RangeError` with memory estimate
4. `initializeSatellites()` with invalid PRN range (< 1 or > 32) -> throw `RangeError`
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/gps-encoder.test.ts

# Golden file comparison
# tests/golden-files/hackrf/protocols/gps-reference.bin

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/gps-encoder.ts && echo "FAIL" || echo "PASS"

# Gold code length verification (should find assertion for 1023 chips)
grep -n '1023' src/lib/server/hackrf/dsp/protocols/gps-encoder.ts

# File line count
wc -l src/lib/server/hackrf/dsp/protocols/gps-encoder.ts
```

---

## Verification Checklist

- [ ] `gps-encoder.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `interface GPSSatellite` defined with all fields from Python `GPSSatellite` dataclass
- [ ] `interface GPSEphemeris` defined with all fields from Python `GPSEphemeris` dataclass
- [ ] `class GPSEncoder` implements `ProtocolEncoder` from `types.ts`
- [ ] All 16 methods accounted for (15 TypeScript methods + 1 inlined nested function)
- [ ] `generateCACode()` uses integer-only LFSR computation (no floating-point in LFSR)
- [ ] Gold code sequence length is exactly 1023 chips per period
- [ ] G1 polynomial: x^10 + x^3 + 1
- [ ] G2 polynomial: x^10 + x^9 + x^8 + x^6 + x^3 + x^2 + 1
- [ ] BPSK modulation at 1.023 Mchips/s chipping rate
- [ ] L1 carrier frequency: 1575.42 MHz (1575420000 Hz)
- [ ] Doppler shift uses `Float64` arithmetic with speed of light = 299792458 m/s
- [ ] NAV message at 50 bps data rate
- [ ] `generate_signal` nested function inlined into `generateGPSSignal()`
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] Golden file test passes: `tests/golden-files/hackrf/protocols/gps-reference.bin`
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 16 methods from `gps_protocol.py` have documented TypeScript equivalents in `gps-encoder.ts`
2. Gold code generation produces bit-identical output to Python for all 32 PRN codes
3. Golden file comparison test passes with `toBeCloseTo(value, 10)` for Float64 and strict equality for uint8
4. All error handling conditions throw the specified exception types
5. `npm run typecheck` passes
6. File line count is approximately 350 lines (maximum tolerance: 400)

---

## Cross-References

- **Previous**: Phase-7.3.02-ADS-B-Encoder-Migration.md
- **Next**: Phase-7.3.04-ELRS-Encoder-Migration.md
- **Enhanced mode**: Phase-7.3.09 adds `generateEnhancedGPSSignal()` method (from `_run_enhanced_gps`)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` calls `generateGPSSignal()`)
- **Modulation delegation**: Phase-7.3.08 (`modulation.ts` delegates `_generate_gps_signal` and `_generate_gps_ca_code` to this encoder)
- **DSP dependency**: Phase 7.2 (filters, windowing functions used in signal shaping)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
