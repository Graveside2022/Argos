# Phase 7.3.07: Raw Energy Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.6)
**Risk Level**: MEDIUM -- Noise generation is simpler than protocol-specific encoding but spectral shaping must match Python output
**Prerequisites**: Phase-7.3.01 (types.ts), Phase 7.2 (DSP core: filters, FFT for shaped noise)
**Estimated Duration**: 4 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the raw energy (broadband noise/signal) protocol from Python to TypeScript. The raw energy encoder generates various types of noise and test signals: white noise, pink noise, spectrally shaped noise, linear chirp signals, and multi-tone synthesis. These are the fundamental building blocks used by other encoders for jamming and test signal generation.

---

## Source and Target

| Property         | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/raw_energy_protocol.py`   |
| **Source lines** | 340 lines                                                      |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/raw-energy.ts`            |
| **Target lines** | ~250 lines (estimated)                                         |
| **Golden file**  | `tests/golden-files/hackrf/protocols/raw-energy-reference.bin` |

---

## Methods to Migrate (15 methods)

| #   | Python Method                                        | TypeScript Method                                  | Notes                                          |
| --- | ---------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| 1   | `__init__`                                           | `constructor()`                                    | Initialize frequency tables, noise config      |
| 2   | `get_available_frequencies`                          | `getAvailableFrequencies()`                        | Return supported frequency bands               |
| 3   | `get_bandwidth_options`                              | `getBandwidthOptions()`                            | Return available bandwidth configurations      |
| 4   | `get_noise_types`                                    | `getNoiseTypes()`                                  | Return supported noise generation modes        |
| 5   | `generate_white_noise`                               | `generateWhiteNoise()`                             | Gaussian white noise generation                |
| 6   | `generate_pink_noise`                                | `generatePinkNoise()`                              | 1/f spectral rolloff noise                     |
| 7   | `generate_shaped_noise`                              | `generateShapedNoise()`                            | Arbitrary spectral shape via filtering         |
| 8   | `generate_chirp_signal`                              | `generateChirpSignal()`                            | Linear frequency sweep (chirp)                 |
| 9   | `generate_multitone_signal`                          | `generateMultitoneSignal()`                        | Sum of sinusoids at specified frequencies      |
| 10  | `_get_frequency_name`                                | `getFrequencyName()`                               | Lookup frequency band name from Hz value       |
| 11  | `generate_raw_energy_signal`                         | `generateSignal()`                                 | Main entry point (public API)                  |
| 12  | `generate_signal` (nested)                           | Inline in `generateSignal()`                       | Remove nested function; inline into parent     |
| 13  | `_generate_raw_energy_signal_internal`               | `generateSignalInternal()`                         | Core generation logic (dispatch by noise type) |
| 14  | `get_frequency_info`                                 | `getFrequencyInfo()`                               | Return detailed info for a specific frequency  |
| 15  | `_get_frequency_band` / `_get_frequency_description` | `getFrequencyBand()` / `getFrequencyDescription()` | Band classification and description accessors  |

### Method Count Note

Row 15 contains two Python methods (`_get_frequency_band` and `_get_frequency_description`) mapped to two TypeScript methods. The parent document counts this as a single row for 15 total, which is correct -- there are 15 enumerated entries with row 15 covering both band and description accessors.

---

## Key Numerical Operations

| Operation                   | Specification                                                        | Precision Requirement | DSP Core Dependency           |
| --------------------------- | -------------------------------------------------------------------- | --------------------- | ----------------------------- |
| White noise generation      | Gaussian distribution, unit variance, zero mean                      | Float64 intermediate  | RNG from DSP core (Phase 7.2) |
| Pink noise (1/f) generation | Spectral rolloff at -3 dB/octave                                     | Float64 intermediate  | FFT from Phase 7.2.05         |
| Shaped noise generation     | Arbitrary spectral envelope via Butterworth or FIR filtering         | Float64 intermediate  | Filters from Phase 7.2        |
| Linear chirp signal         | Frequency sweep: `f(t) = f_start + (f_end - f_start) * t / duration` | Float64 intermediate  | None (direct computation)     |
| Multi-tone synthesis        | `signal(t) = SUM(A_i * sin(2*pi*f_i*t + phi_i))` for each tone       | Float64 intermediate  | None (direct computation)     |

### FFT Dependency (Phase 7.2.05)

Pink noise generation typically uses the FFT approach:

1. Generate white noise in time domain
2. FFT to frequency domain
3. Apply 1/f spectral shaping (multiply by `1/sqrt(f)` for each frequency bin)
4. IFFT back to time domain

This requires the FFT implementation from Phase 7.2.05. If the Python implementation uses a different method (e.g., Voss-McCartney algorithm), match that method exactly for golden file compatibility.

### Shaped Noise and Filter Dependency

Shaped noise uses Butterworth filtering from Phase 7.2. The filter coefficients must match the Python `scipy.signal.butter` output. Note from Phase 7.3 parent: "scipy.signal.butter is not used in the Python codebase" per the independent audit correction. Verify the actual filtering method used in `raw_energy_protocol.py` before implementation.

---

## Additional Methods from Enhanced Workflows (Phase-7.3.09)

Phase-7.3.09 specifies that 2 methods from `enhanced_workflows.py` are absorbed into `raw-energy.ts`:

| Python Method (from enhanced_workflows.py) | Absorbed Into                | Notes                                          |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------- |
| `_create_raw_energy_workflows`             | `raw-energy.ts` (new method) | Factory for raw energy workflow configurations |
| `_run_raw_energy_workflow`                 | `raw-energy.ts` (new method) | Execute raw energy workflow by name            |

These 2 methods are documented in Phase-7.3.09 but implemented in this file. After absorption, verify the total line count stays within bounds.

---

## Error Handling

Per Phase-7.3.10 specification:

1. `generateSignal()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateSignal()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateSignal()` with duration exceeding memory bounds (>10s at 2 Msps = 320 MB Float64) -> throw `RangeError` with memory estimate
4. `generateMultitoneSignal()` with empty tone list -> throw `TypeError`
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/raw-energy.test.ts

# Golden file comparison
# tests/golden-files/hackrf/protocols/raw-energy-reference.bin

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/raw-energy.ts && echo "FAIL" || echo "PASS"

# File line count (should be ~250, may grow with absorbed enhanced_workflows methods)
wc -l src/lib/server/hackrf/dsp/protocols/raw-energy.ts
```

---

## Verification Checklist

- [ ] `raw-energy.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `class RawEnergy` implements `ProtocolEncoder` from `types.ts`
- [ ] All 15 methods from `raw_energy_protocol.py` accounted for
- [ ] `generateWhiteNoise()` produces Gaussian distribution with zero mean, unit variance
- [ ] `generatePinkNoise()` produces correct 1/f spectral rolloff (-3 dB/octave)
- [ ] `generateShapedNoise()` applies spectral shaping via DSP core filters
- [ ] `generateChirpSignal()` produces linear frequency sweep
- [ ] `generateMultitoneSignal()` produces sum of sinusoids
- [ ] `generate_signal` nested function inlined into `generateSignal()`
- [ ] `getFrequencyBand()` and `getFrequencyDescription()` both implemented (row 15 dual mapping)
- [ ] FFT dependency from Phase 7.2.05 correctly imported for pink noise
- [ ] Absorbed methods from Phase-7.3.09 integrated (`_create_raw_energy_workflows`, `_run_raw_energy_workflow`)
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] Golden file test passes: `tests/golden-files/hackrf/protocols/raw-energy-reference.bin`
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 15 methods from `raw_energy_protocol.py` have documented TypeScript equivalents in `raw-energy.ts`
2. Absorbed methods from `enhanced_workflows.py` are integrated
3. Noise generation (white, pink, shaped) matches Python output in golden file comparison
4. Chirp and multi-tone synthesis produce correct waveforms
5. All error handling conditions throw the specified exception types
6. `npm run typecheck` passes
7. File line count is approximately 250 lines (maximum: 300, accounting for absorbed methods)

---

## Cross-References

- **Previous**: Phase-7.3.06-Drone-Video-Jamming-Migration.md
- **Next**: Phase-7.3.08-Modulation-Workflows-Migration.md
- **FFT dependency**: Phase 7.2.05 (FFT implementation for pink noise spectral shaping)
- **Filter dependency**: Phase 7.2 (Butterworth/FIR filters for shaped noise)
- **Absorbed from**: Phase-7.3.09 (`_create_raw_energy_workflows`, `_run_raw_energy_workflow`)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` calls `generateSignal()`)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
