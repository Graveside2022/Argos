# Phase 7.3.04: ELRS Encoder Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.3)
**Risk Level**: HIGH -- LoRA chirp generation and FHSS hop sequence must match ExpressLRS specification
**Prerequisites**: Phase-7.3.01 (types.ts and directory structure), Phase 7.2 (DSP core library)
**Estimated Duration**: 4 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the ExpressLRS (ELRS) protocol encoder from Python to TypeScript. The ELRS encoder generates simulated RC (Remote Control) link signals using LoRA (Long Range) CSS (Chirp Spread Spectrum) modulation with FHSS (Frequency Hopping Spread Spectrum). ELRS is widely used in FPV drone control links operating in the 2.4 GHz and 868/915 MHz ISM bands.

This encoder produces CRSF (Crossfire) protocol packets modulated onto LoRA chirp waveforms with frequency hopping.

---

## Source and Target

| Property         | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/elrs_protocol.py` |
| **Source lines** | 330 lines                                              |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/elrs-encoder.ts`  |
| **Target lines** | ~250 lines (estimated)                                 |

---

## Methods to Migrate (11 methods)

| #   | Python Method                          | TypeScript Method                  | Notes                                              |
| --- | -------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| 1   | `__init__`                             | `constructor()`                    | Initialize hop table, band config, CRSF state      |
| 2   | `_generate_hop_sequence`               | `generateHopSequence()`            | FHSS channel hop sequence generation               |
| 3   | `_generate_lora_chirp`                 | `generateLoRAChirp()`              | CSS modulation chirp waveform                      |
| 4   | `_create_rc_packet`                    | `createRCPacket()`                 | CRSF RC channel data packet                        |
| 5   | `_generate_flight_control_pattern`     | `generateFlightControlPattern()`   | Simulated stick/switch patterns                    |
| 6   | `_modulate_elrs_packet`                | `modulateELRSPacket()`             | Apply LoRA modulation to packet data               |
| 7   | `generate_elrs_transmission`           | `generateTransmission()`           | Main entry point (public API)                      |
| 8   | `generate_signal` (nested)             | Inline in `generateTransmission()` | Remove nested function; inline into parent         |
| 9   | `_generate_elrs_transmission_internal` | `generateTransmissionInternal()`   | Core generation logic                              |
| 10  | `get_band_info`                        | `getBandInfo()`                    | Accessor returning supported bands and frequencies |
| 11  | `get_supported_packet_rates`           | `getSupportedPacketRates()`        | Accessor returning available packet rates          |

### Method Count Note

The parent document header says "12 methods" in the table but the actual enumerated table contains 11 rows. The count of 11 is correct -- there are 11 distinct method entries (including the nested `generate_signal` which is inlined, not removed).

---

## Key Numerical Operations

| Operation             | Specification                                                    | Precision Requirement    |
| --------------------- | ---------------------------------------------------------------- | ------------------------ |
| LoRA chirp generation | CSS (Chirp Spread Spectrum) modulation -- linear frequency sweep | Float64 intermediate     |
| FHSS hop sequence     | ExpressLRS-specific pseudo-random hop algorithm                  | Exact integer arithmetic |
| CRSF packet encoding  | Crossfire protocol packet format: header, type, payload, CRC     | Bit-exact (integer)      |
| Channel data encoding | 11-bit RC channel values (0-2047) packed into byte stream        | Bit-exact (integer)      |

### LoRA Chirp Generation Details

LoRA CSS modulation generates a chirp (linear frequency sweep) whose starting frequency encodes the data symbol. The chirp parameters:

- **Spreading Factor (SF)**: Typically SF6-SF12 for ELRS
- **Bandwidth (BW)**: 500 kHz (2.4 GHz band) or 250 kHz (868/915 MHz band)
- **Symbol duration**: `2^SF / BW` seconds
- **Chirp rate**: `BW / (2^SF)` Hz/s

The chirp waveform is a complex exponential with quadratically increasing phase:

```
phase(t) = 2 * pi * (f_start * t + 0.5 * chirp_rate * t^2)
I(t) = cos(phase(t))
Q(t) = sin(phase(t))
```

Use `Float64Array` for all intermediate computations. `Math.cos()` and `Math.sin()` are adequate for sample-rate chirp generation.

### FHSS Hop Sequence

The ELRS hop sequence is deterministic given a binding UID. It must produce the same channel sequence as the Python implementation for golden file comparison. The algorithm uses a seeded PRNG to generate a permutation of available channels.

---

## Error Handling

Per Phase-7.3.10 specification:

1. `generateTransmission()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateTransmission()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateTransmission()` with duration exceeding memory bounds -> throw `RangeError` with memory estimate
4. `createRCPacket()` with channel values outside 0-2047 range -> throw `RangeError`
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/elrs-encoder.test.ts

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/elrs-encoder.ts && echo "FAIL" || echo "PASS"

# File line count (should be ~250)
wc -l src/lib/server/hackrf/dsp/protocols/elrs-encoder.ts
```

---

## Verification Checklist

- [ ] `elrs-encoder.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `class ELRSEncoder` implements `ProtocolEncoder` from `types.ts`
- [ ] All 11 methods accounted for (10 TypeScript methods + 1 inlined nested function)
- [ ] `generateLoRAChirp()` implements CSS modulation with correct phase computation
- [ ] `generateHopSequence()` produces deterministic hop pattern given binding UID
- [ ] `createRCPacket()` generates valid CRSF protocol packets
- [ ] `modulateELRSPacket()` applies LoRA modulation to packet data
- [ ] `generate_signal` nested function inlined into `generateTransmission()`
- [ ] Supports 2.4 GHz and 868/915 MHz band configurations
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] File does not exceed 300 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 11 methods from `elrs_protocol.py` have documented TypeScript equivalents in `elrs-encoder.ts`
2. LoRA chirp generation produces correct CSS waveforms
3. FHSS hop sequence matches Python output for identical binding UIDs
4. Unit tests pass with golden file comparison where applicable
5. All error handling conditions throw the specified exception types
6. `npm run typecheck` passes
7. File line count is approximately 250 lines (maximum: 300)

---

## Cross-References

- **Previous**: Phase-7.3.03-GPS-Encoder-Migration.md
- **Next**: Phase-7.3.05-ELRS-Jamming-Migration.md
- **Jamming counterpart**: Phase-7.3.05 (ELRS jamming -- same protocol, different purpose)
- **Enhanced mode**: Phase-7.3.09 adds `generateEnhancedTransmission()` method (from `_run_enhanced_elrs`)
- **Modulation delegation**: Phase-7.3.08 (`modulation.ts` delegates `_generate_elrs_signal` to this encoder)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` calls `generateTransmission()`)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
