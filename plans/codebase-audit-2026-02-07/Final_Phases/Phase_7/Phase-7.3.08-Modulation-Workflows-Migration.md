# Phase 7.3.08: Modulation Workflows Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.7)
**Risk Level**: HIGH -- Critical split between signal generation and workflow orchestration; AM/FM/PSK golden files must match
**Prerequisites**: Phase-7.3.01 (types.ts), Phase-7.3.02 (ADS-B encoder), Phase-7.3.03 (GPS encoder), Phase-7.3.04 (ELRS encoder), Phase 7.2 (DSP core)
**Estimated Duration**: 6 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the modulation workflows from Python to TypeScript with a critical structural split: the Python `ModulationWorkflows` class (672 lines, 20 methods) serves dual roles as both a signal generator AND a workflow orchestrator. In the TypeScript migration, these concerns are separated:

1. **Signal generation functions** (9 methods) stay in `modulation.ts` as pure functions
2. **Workflow orchestration methods** (5 methods) move to `transmit-manager.ts` (Phase 7.4)

This split ensures that `modulation.ts` contains only pure signal generation logic with no side effects, process management, or state mutation.

---

## Source and Target

| Property         | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/modulation_workflows.py` |
| **Source lines** | 672 lines                                                     |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/modulation.ts`           |
| **Target lines** | ~500 lines (estimated -- signal generation methods only)      |

---

## The Critical Split

### Overview

The Python `ModulationWorkflows` class has 20 methods total. In TypeScript, these are split across two files:

| Responsibility                         | TypeScript Location                           | Method Count |
| -------------------------------------- | --------------------------------------------- | ------------ |
| Signal generation functions            | `modulation.ts` (this sub-task)               | 9            |
| Workflow state management (start/stop) | `transmit-manager.ts` (Phase 7.4)             | 5            |
| Nested `generate_signal` functions     | Inlined into parent signal generation methods | 6 (absorbed) |

### Why This Split is Necessary

The Python class mixes two concerns:

- **Pure computation**: `_run_sine_wave()` generates samples from parameters
- **Side effects**: `start_workflow()` spawns a subprocess, manages state, handles errors

Mixing these in a single class violates the Single Responsibility Principle and makes unit testing impossible without mocking the hardware layer. The TypeScript design separates them cleanly.

---

## Signal Generation Methods (Keep in `modulation.ts`) -- 9 Methods

These methods are pure functions: given input parameters, they return `Float64Array` samples. They have no side effects, no state mutation, and no process management.

| #   | Python Method            | TypeScript Function           | Notes                                                                |
| --- | ------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| 1   | `_run_sine_wave`         | `generateSineWave()`          | Pure function: single-frequency sinusoidal signal                    |
| 2   | `_run_fm_modulation`     | `generateFMSignal()`          | Pure function: frequency modulation with configurable deviation      |
| 3   | `_run_am_modulation`     | `generateAMSignal()`          | Pure function: amplitude modulation with configurable depth          |
| 4   | `_generate_elrs_signal`  | Delegate to `elrs-encoder.ts` | Cross-reference: call `ELRSEncoder.generateTransmission()`           |
| 5   | `_generate_gps_signal`   | Delegate to `gps-encoder.ts`  | Cross-reference: call `GPSEncoder.generateGPSSignal()`               |
| 6   | `_generate_gps_ca_code`  | Delegate to `gps-encoder.ts`  | Cross-reference: call `GPSEncoder.generateCACode()`                  |
| 7   | `_generate_ads_b_packet` | Delegate to `adsb-encoder.ts` | Cross-reference: call `ADSBEncoder.generateTransmission()`           |
| 8   | `_generate_ais_packet`   | `generateAISPacket()`         | AIS (Automatic Identification System) packet generation -- kept here |
| 9   | `_run_frequency_hopping` | `generateFrequencyHopping()`  | Pure function: frequency hopping pattern generation                  |

### Delegation Pattern for Cross-Referenced Methods

Methods 4-7 are thin wrappers in the Python code that call other protocol implementations. In TypeScript, these are replaced by direct imports:

```typescript
// modulation.ts
import { ELRSEncoder } from './elrs-encoder';
import { GPSEncoder } from './gps-encoder';
import { ADSBEncoder } from './adsb-encoder';

// Instead of _generate_elrs_signal(), callers import ELRSEncoder directly.
// The delegation methods in modulation.ts are eliminated -- the caller
// uses the specific encoder. This is documented in the barrel export (index.ts).
```

**Important**: If the Python `_generate_elrs_signal` adds wrapper logic (parameter transformation, error handling, etc.) beyond simply calling the ELRS encoder, that wrapper logic must be preserved as a thin function in `modulation.ts`. Check the Python source for any non-trivial wrapper behavior.

### AIS Packet Generation

`generateAISPacket()` is the only protocol-specific signal generation method that stays in `modulation.ts` rather than getting its own encoder file. This is because AIS encoding is small enough (estimated ~50 lines) to not warrant a separate file, and it is only called from the modulation workflow context.

---

## Workflow Orchestration Methods (Move to Phase 7.4) -- 5 Methods

These methods manage workflow lifecycle (start, stop, dispatch) and have side effects. They are NOT implemented in `modulation.ts` -- they move to `transmit-manager.ts` in Phase 7.4.

| #   | Python Method             | Destination                          | Notes                                                 |
| --- | ------------------------- | ------------------------------------ | ----------------------------------------------------- |
| 1   | `__init__`                | `transmit-manager.ts` constructor    | Workflow registry, active workflow state              |
| 2   | `get_available_workflows` | `transmit-manager.ts`                | Return list of available workflow names               |
| 3   | `start_workflow`          | `transmit-manager.ts`                | Start a named workflow (spawns generation + transmit) |
| 4   | `stop_workflow`           | `transmit-manager.ts`                | Stop an active workflow (kills subprocess)            |
| 5   | `_run_workflow`           | `transmit-manager.ts` dispatch logic | Dispatch by workflow name to signal generation        |

### Phase 7.4 Handoff

The 5 orchestration methods are documented here for completeness but are NOT implemented in this sub-task. Phase 7.4 must reference this table when implementing `transmit-manager.ts`. The contract between `modulation.ts` and `transmit-manager.ts` is:

```
transmit-manager calls: generateSineWave(params) -> Float64Array
transmit-manager calls: generateFMSignal(params) -> Float64Array
transmit-manager calls: generateAMSignal(params) -> Float64Array
...etc for all signal generation functions
```

The transmit-manager then sends the returned samples to `hackrf_transfer` via subprocess.

---

## Key Numerical Operations

| Operation            | Specification                                                          | Precision Requirement |
| -------------------- | ---------------------------------------------------------------------- | --------------------- |
| Sine wave generation | `signal(t) = A * sin(2*pi*f*t + phi)`                                  | Float64 intermediate  |
| FM modulation        | `phase(t) = 2*pi*fc*t + (fd/fm) * sin(2*pi*fm*t)`, fd = freq deviation | Float64 intermediate  |
| AM modulation        | `signal(t) = (1 + m*cos(2*pi*fm*t)) * cos(2*pi*fc*t)`, m = mod depth   | Float64 intermediate  |
| AIS packet encoding  | GMSK modulation at 9600 bps, NRZI encoding                             | Bit-exact + Float64   |
| Frequency hopping    | Pseudo-random channel sequence, dwell time per hop                     | Float64 intermediate  |

### FM Modulation Details

FM modulation uses the instantaneous frequency deviation model:

- Carrier frequency `fc`: center frequency in Hz
- Modulating frequency `fm`: baseband signal frequency
- Frequency deviation `fd`: peak frequency excursion
- Modulation index `beta = fd / fm`

The I/Q samples are computed as:

```
I(t) = cos(2*pi*fc*t + beta * sin(2*pi*fm*t))
Q(t) = sin(2*pi*fc*t + beta * sin(2*pi*fm*t))
```

### AM Modulation Details

AM modulation uses the standard double-sideband full-carrier model:

- Carrier frequency `fc`
- Modulating frequency `fm`
- Modulation depth `m` (0 to 1 for standard AM; >1 for overmodulation)

The I/Q samples are:

```
envelope(t) = 1 + m * cos(2*pi*fm*t)
I(t) = envelope(t) * cos(2*pi*fc*t)
Q(t) = envelope(t) * sin(2*pi*fc*t)
```

---

## Error Handling

Per Phase-7.3.10 specification:

1. All `generate*()` functions with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. All `generate*()` functions with invalid sample rate (0, negative) -> throw `RangeError`
3. All `generate*()` functions with duration exceeding memory bounds -> throw `RangeError` with memory estimate
4. `generateAMSignal()` with modulation depth < 0 -> throw `RangeError`
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/modulation.test.ts

# Golden file comparison for AM and FM modulation
# tests/golden-files/hackrf/protocols/am-reference.bin
# tests/golden-files/hackrf/protocols/fm-reference.bin

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/modulation.ts && echo "FAIL" || echo "PASS"

# Verify no workflow orchestration (start/stop/run) in modulation.ts
grep -n 'startWorkflow\|stopWorkflow\|_runWorkflow\|subprocess\|exec' src/lib/server/hackrf/dsp/protocols/modulation.ts && echo "FAIL: orchestration found" || echo "PASS"

# File line count (should be ~500)
wc -l src/lib/server/hackrf/dsp/protocols/modulation.ts
```

---

## Verification Checklist

- [ ] `modulation.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] Signal generation functions exported as named functions (NOT a class)
- [ ] `generateSineWave()` implemented as pure function returning `Float64Array`
- [ ] `generateFMSignal()` implements correct FM modulation with frequency deviation
- [ ] `generateAMSignal()` implements correct AM modulation with modulation depth
- [ ] `generateAISPacket()` implements AIS GMSK packet generation
- [ ] `generateFrequencyHopping()` implements pseudo-random hop sequence generation
- [ ] Cross-reference delegations documented: `_generate_elrs_signal` -> `elrs-encoder.ts`
- [ ] Cross-reference delegations documented: `_generate_gps_signal` -> `gps-encoder.ts`
- [ ] Cross-reference delegations documented: `_generate_gps_ca_code` -> `gps-encoder.ts`
- [ ] Cross-reference delegations documented: `_generate_ads_b_packet` -> `adsb-encoder.ts`
- [ ] Workflow orchestration methods (`__init__`, `get_available_workflows`, `start_workflow`, `stop_workflow`, `_run_workflow`) NOT in `modulation.ts`
- [ ] No `subprocess`, `exec`, `startWorkflow`, or `stopWorkflow` references in file
- [ ] Golden file tests pass for AM modulation
- [ ] Golden file tests pass for FM modulation
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] All signal generation functions exported in `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 9 signal generation methods have documented TypeScript equivalents in `modulation.ts`
2. All 5 workflow orchestration methods are documented as moved to Phase 7.4 (`transmit-manager.ts`)
3. Cross-reference delegations to ELRS, GPS, and ADS-B encoders are documented and eliminated (or preserved as thin wrappers if non-trivial)
4. Golden file comparison tests pass for AM and FM modulation
5. No workflow orchestration logic exists in `modulation.ts`
6. `npm run typecheck` passes
7. File line count is approximately 500 lines (maximum tolerance: 550)

---

## Cross-References

- **Previous**: Phase-7.3.07-Raw-Energy-Migration.md
- **Next**: Phase-7.3.09-Enhanced-Workflows-Decomposition.md
- **Orchestration destination**: Phase 7.4 (`transmit-manager.ts` receives 5 workflow methods)
- **ELRS delegation**: Phase-7.3.04 (`elrs-encoder.ts`)
- **GPS delegation**: Phase-7.3.03 (`gps-encoder.ts`)
- **ADS-B delegation**: Phase-7.3.02 (`adsb-encoder.ts`)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
