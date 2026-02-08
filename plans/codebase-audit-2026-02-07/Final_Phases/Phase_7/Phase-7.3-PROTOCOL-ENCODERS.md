# Phase 7.3: Protocol Encoders (All 7 Protocol Files + Enhanced Workflows)

**Risk Level**: HIGH -- Signal generation correctness directly affects RF transmission fidelity
**Prerequisites**: Phase 7.2 (DSP core library must exist and pass all tests)
**Estimated Files Created**: 10
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate all 7 protocol encoder files and the enhanced workflows orchestrator from Python to TypeScript.
Each encoder must produce byte-identical output to the Python original when given the same input parameters.
Golden file tests from Phase 7.1 are the acceptance criteria.

**Target directory**: `src/lib/server/hackrf/dsp/protocols/`

---

## Architecture

```
src/lib/server/hackrf/dsp/protocols/
  index.ts                          # Barrel export
  types.ts                          # Shared protocol interfaces
  adsb-encoder.ts                   # ADS-B Mode S (580 lines Python -> ~450 TS)
  gps-encoder.ts                    # GPS L1 C/A (460 lines Python -> ~350 TS)
  elrs-encoder.ts                   # ExpressLRS (330 lines Python -> ~250 TS)
  elrs-jamming.ts                   # ELRS jamming (559 lines Python -> ~400 TS)
  drone-video-jamming.ts            # Video downlink interference (579 lines Python -> ~400 TS)
  raw-energy.ts                     # Broadband energy (340 lines Python -> ~250 TS)
  modulation.ts                     # AM/FM/PSK/QAM (672 lines Python -> ~500 TS)
  enhanced-workflows.ts             # Combined workflows (1,385 lines Python -> DECOMPOSE)
```

---

## Shared Types (`types.ts`)

```typescript
/** Common interface for all protocol encoders */
export interface ProtocolEncoder {
	/** Generate I/Q samples for the given parameters */
	generateSignal(params: Record<string, unknown>): Float64Array;
}

/** Result of signal generation */
export interface SignalGenerationResult {
	samples: Float64Array;
	sampleRate: number;
	frequency: number;
	duration: number;
	metadata: Record<string, unknown>;
}

/** Common parameters across all protocols */
export interface BaseProtocolParams {
	frequency: number; // Center frequency in Hz
	sampleRate: number; // Sample rate in samples/second
	duration: number; // Duration in seconds
}
```

---

## Task 7.3.1: ADS-B Encoder (`adsb-encoder.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/adsb_protocol.py` (580 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/adsb-encoder.ts` (~450 lines)

### Classes to migrate:

| Python Class                      | TypeScript Equivalent  | Lines |
| --------------------------------- | ---------------------- | ----- |
| `Aircraft` (dataclass, line 17)   | `interface Aircraft`   | ~15   |
| `FlightPlan` (dataclass, line 34) | `interface FlightPlan` | ~10   |
| `ADSBProtocol` (line 42)          | `class ADSBEncoder`    | ~425  |

### Methods to migrate (20 methods):

| #   | Python Method                          | TypeScript Method                     | Notes                                        |
| --- | -------------------------------------- | ------------------------------------- | -------------------------------------------- |
| 1   | `__init__`                             | `constructor()`                       | Initialize aircraft list, constants          |
| 2   | `add_aircraft`                         | `addAircraft()`                       | Add aircraft to simulation                   |
| 3   | `_calculate_crc`                       | Use `crc24()` from `dsp/crc/crc24.ts` | **Do NOT re-implement** -- use shared CRC-24 |
| 4   | `_encode_aircraft_identification`      | `encodeAircraftIdentification()`      | 6-bit character encoding                     |
| 5   | `_encode_adsb_char`                    | `encodeADSBChar()`                    | Single character to 6-bit                    |
| 6   | `_encode_airborne_position`            | `encodeAirbornePosition()`            | CPR encoding                                 |
| 7   | `_encode_altitude`                     | `encodeAltitude()`                    | Barometric altitude encoding                 |
| 8   | `_encode_cpr_latitude`                 | `encodeCPRLatitude()`                 | Compact Position Reporting lat               |
| 9   | `_encode_cpr_longitude`                | `encodeCPRLongitude()`                | Compact Position Reporting lon               |
| 10  | `_encode_velocity`                     | `encodeVelocity()`                    | Ground speed + heading encoding              |
| 11  | `_generate_preamble`                   | `generatePreamble()`                  | 8us preamble pattern                         |
| 12  | `_modulate_message`                    | `modulateMessage()`                   | PPM modulation at 1090 MHz                   |
| 13  | `_simulate_aircraft_movement`          | `simulateAircraftMovement()`          | Position update per timestep                 |
| 14  | `generate_adsb_transmission`           | `generateTransmission()`              | Main entry point                             |
| 15  | `generate_signal` (nested)             | Inline in `generateTransmission()`    | Remove nested function                       |
| 16  | `_generate_adsb_transmission_internal` | `generateTransmissionInternal()`      | Core generation logic                        |
| 17  | `_create_default_aircraft`             | `createDefaultAircraft()`             | Factory method                               |
| 18  | `get_aircraft_list`                    | `getAircraftList()`                   | Accessor                                     |

### Key numerical operations:

- CRC-24 computation (delegate to `dsp/crc/crc24.ts`)
- PPM (Pulse Position Modulation) at 1 Mbps data rate
- Carrier modulation at 1090 MHz
- CPR encoding (requires exact integer arithmetic)

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/adsb-encoder.test.ts
# Golden file comparison: tests/golden-files/hackrf/protocols/adsb-reference.bin
```

---

## Task 7.3.2: GPS Encoder (`gps-encoder.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/gps_protocol.py` (460 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/gps-encoder.ts` (~350 lines)

### Classes to migrate:

| Python Class                        | TypeScript Equivalent    | Lines |
| ----------------------------------- | ------------------------ | ----- |
| `GPSSatellite` (dataclass, line 16) | `interface GPSSatellite` | ~10   |
| `GPSEphemeris` (dataclass, line 29) | `interface GPSEphemeris` | ~15   |
| `GPSProtocol` (line 50)             | `class GPSEncoder`       | ~325  |

### Methods to migrate (16 methods):

| #   | Python Method                   | TypeScript Method             | Notes                                           |
| --- | ------------------------------- | ----------------------------- | ----------------------------------------------- |
| 1   | `__init__`                      | `constructor()`               | Initialize satellite constellation              |
| 2   | `_initialize_satellites`        | `initializeSatellites()`      | Set up 32 GPS satellites                        |
| 3   | `_generate_ephemeris_data`      | `generateEphemerisData()`     | Orbital parameters                              |
| 4   | `_generate_ca_code`             | `generateCACode()`            | **CRITICAL**: Gold code generation (1023 chips) |
| 5   | `_generate_navigation_data`     | `generateNavigationData()`    | NAV message frame                               |
| 6   | `_generate_nav_frame`           | `generateNavFrame()`          | Full navigation frame                           |
| 7   | `_generate_subframe1`           | `generateSubframe1()`         | Clock correction data                           |
| 8   | `_generate_subframe2`           | `generateSubframe2()`         | Ephemeris data I                                |
| 9   | `_generate_subframe3`           | `generateSubframe3()`         | Ephemeris data II                               |
| 10  | `_generate_almanac_subframe`    | `generateAlmanacSubframe()`   | Almanac page                                    |
| 11  | `_apply_doppler_shift`          | `applyDopplerShift()`         | Frequency shift per satellite                   |
| 12  | `generate_gps_signal`           | `generateGPSSignal()`         | Main entry point                                |
| 13  | `generate_signal` (nested)      | Inline                        | Remove nested function                          |
| 14  | `_generate_gps_signal_internal` | `generateGPSSignalInternal()` | Core generation                                 |
| 15  | `get_satellite_info`            | `getSatelliteInfo()`          | Accessor                                        |
| 16  | `get_constellation_info`        | `getConstellationInfo()`      | Accessor                                        |

### Key numerical operations:

- Gold code generation (XOR of G1 and G2 LFSR sequences, 1023 chips per period)
- BPSK modulation at 1.023 Mchips/s on L1 carrier (1575.42 MHz)
- Doppler shift application per satellite
- Navigation message bit encoding (50 bps)

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/gps-encoder.test.ts
# Golden file comparison: tests/golden-files/hackrf/protocols/gps-reference.bin
```

---

## Task 7.3.3: ELRS Encoder (`elrs-encoder.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/elrs_protocol.py` (330 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/elrs-encoder.ts` (~250 lines)

### Methods to migrate (12 methods):

| #   | Python Method                          | TypeScript Method                |
| --- | -------------------------------------- | -------------------------------- |
| 1   | `__init__`                             | `constructor()`                  |
| 2   | `_generate_hop_sequence`               | `generateHopSequence()`          |
| 3   | `_generate_lora_chirp`                 | `generateLoRAChirp()`            |
| 4   | `_create_rc_packet`                    | `createRCPacket()`               |
| 5   | `_generate_flight_control_pattern`     | `generateFlightControlPattern()` |
| 6   | `_modulate_elrs_packet`                | `modulateELRSPacket()`           |
| 7   | `generate_elrs_transmission`           | `generateTransmission()`         |
| 8   | `generate_signal` (nested)             | Inline                           |
| 9   | `_generate_elrs_transmission_internal` | `generateTransmissionInternal()` |
| 10  | `get_band_info`                        | `getBandInfo()`                  |
| 11  | `get_supported_packet_rates`           | `getSupportedPacketRates()`      |

### Key numerical operations:

- LoRA chirp generation (CSS modulation)
- FHSS hop sequence (ExpressLRS specific algorithm)
- CRSF packet encoding

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/elrs-encoder.test.ts
```

---

## Task 7.3.4: ELRS Jamming (`elrs-jamming.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/elrs_jamming_protocol.py` (559 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts` (~400 lines)

### Methods to migrate (15 methods):

| #   | Python Method                          | TypeScript Method                    | Notes                                                        |
| --- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| 1   | `__init__`                             | `constructor()`                      |                                                              |
| 2   | `_generate_hop_sequences`              | `generateHopSequences()`             |                                                              |
| 3   | `generate_jamming_signal`              | `generateJammingSignal()`            | Signal generation only                                       |
| 4   | `generate_signal` (nested)             | Inline                               |                                                              |
| 5   | `_generate_jamming_signal_internal`    | `generateJammingSignalInternal()`    |                                                              |
| 6   | `start_frequency_sweeping_jammer`      | `generateFrequencySweepPattern()`    | **Changed**: No threading. Generate pattern, return samples. |
| 7   | `jammer_thread` (nested)               | Removed                              | **Changed**: Threading eliminated.                           |
| 8   | `start_barrage_jammer`                 | `generateBarragePattern()`           | **Changed**: No threading.                                   |
| 9   | `barrage_thread` (nested)              | Removed                              |                                                              |
| 10  | `start_adaptive_jammer`                | `generateAdaptivePattern()`          | **Changed**: No threading.                                   |
| 11  | `adaptive_thread` (nested)             | Removed                              |                                                              |
| 12  | `_detect_elrs_traffic`                 | `detectELRSTraffic()`                |                                                              |
| 13  | `generate_complete_jamming_sequence`   | `generateCompleteSequence()`         |                                                              |
| 14  | `_transmit_frequency_hopping_sequence` | `generateFrequencyHoppingSequence()` | **Changed**: Generate, not transmit.                         |
| 15  | `stop_all_jammers`                     | Removed                              | No threads to stop.                                          |
| 16  | `get_band_info`                        | `getBandInfo()`                      |                                                              |
| 17  | `get_jamming_recommendations`          | `getJammingRecommendations()`        |                                                              |

### ARCHITECTURAL CHANGE: Threading to Signal Generation

The Python implementation uses `threading.Thread` for real-time jamming (frequency sweep, barrage, adaptive).
In the TypeScript implementation, these methods must be restructured:

**Python pattern** (concurrent, stateful):

```python
def start_barrage_jammer(self):
    thread = threading.Thread(target=barrage_thread, daemon=True)
    thread.start()

def barrage_thread():
    while not self._stop_event.is_set():
        samples = generate_noise()
        self._transmit(samples)
```

**TypeScript pattern** (generate-then-transmit, stateless):

```typescript
generateBarragePattern(params: BarrageParams): Float64Array {
    // Generate complete jamming signal buffer
    // Return samples. Transmission is handled by transmit-manager (Phase 7.4).
}
```

The transmit-manager (Phase 7.4) handles the subprocess lifecycle. Protocol encoders
ONLY generate samples. This separation of concerns is cleaner than the Python design.

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/elrs-jamming.test.ts
```

---

## Task 7.3.5: Drone Video Jamming (`drone-video-jamming.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/drone_video_jamming_protocol.py` (579 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts` (~400 lines)

### Methods to migrate (19 methods):

Same threading-to-signal-generation architectural change as Task 7.3.4.
All `start_*_jammer` methods become `generate*Pattern` methods that return Float64Array.
All `*_thread` nested functions are eliminated.
`stop_jamming` is eliminated (handled by transmit-manager).

### Key numerical operations:

- Wideband noise generation at 5.8 GHz band
- Frequency hopping across video channels
- Video downlink interference pattern synthesis

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/drone-video-jamming.test.ts
```

---

## Task 7.3.6: Raw Energy (`raw-energy.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/raw_energy_protocol.py` (340 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/raw-energy.ts` (~250 lines)

### Methods to migrate (15 methods):

| #   | Python Method                                        | TypeScript Method                                  |
| --- | ---------------------------------------------------- | -------------------------------------------------- |
| 1   | `__init__`                                           | `constructor()`                                    |
| 2   | `get_available_frequencies`                          | `getAvailableFrequencies()`                        |
| 3   | `get_bandwidth_options`                              | `getBandwidthOptions()`                            |
| 4   | `get_noise_types`                                    | `getNoiseTypes()`                                  |
| 5   | `generate_white_noise`                               | `generateWhiteNoise()`                             |
| 6   | `generate_pink_noise`                                | `generatePinkNoise()`                              |
| 7   | `generate_shaped_noise`                              | `generateShapedNoise()`                            |
| 8   | `generate_chirp_signal`                              | `generateChirpSignal()`                            |
| 9   | `generate_multitone_signal`                          | `generateMultitoneSignal()`                        |
| 10  | `_get_frequency_name`                                | `getFrequencyName()`                               |
| 11  | `generate_raw_energy_signal`                         | `generateSignal()`                                 |
| 12  | `generate_signal` (nested)                           | Inline                                             |
| 13  | `_generate_raw_energy_signal_internal`               | `generateSignalInternal()`                         |
| 14  | `get_frequency_info`                                 | `getFrequencyInfo()`                               |
| 15  | `_get_frequency_band` / `_get_frequency_description` | `getFrequencyBand()` / `getFrequencyDescription()` |

### Key numerical operations:

- White/pink/shaped noise generation using random number generators from DSP core
- Linear chirp signal generation
- Multi-tone signal synthesis (sum of sinusoids)
- Butterworth filtering for shaped noise (uses filters from Phase 7.2)

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/raw-energy.test.ts
```

---

## Task 7.3.7: Modulation Workflows (`modulation.ts`)

**Source**: `hackrf_emitter/backend/rf_workflows/modulation_workflows.py` (672 lines)
**Target**: `src/lib/server/hackrf/dsp/protocols/modulation.ts` (~500 lines)

### Class: `ModulationWorkflows` (20 methods)

This class is both an orchestrator and a signal generator. In TypeScript, split the concerns:

| Responsibility                         | TypeScript Location                       |
| -------------------------------------- | ----------------------------------------- |
| Workflow state management (start/stop) | Move to `transmit-manager.ts` (Phase 7.4) |
| Signal generation functions            | Keep in `modulation.ts`                   |

### Signal generation methods to migrate:

| #   | Python Method            | TypeScript Function           | Notes           |
| --- | ------------------------ | ----------------------------- | --------------- |
| 1   | `_run_sine_wave`         | `generateSineWave()`          | Pure function   |
| 2   | `_run_fm_modulation`     | `generateFMSignal()`          | Pure function   |
| 3   | `_run_am_modulation`     | `generateAMSignal()`          | Pure function   |
| 4   | `_generate_elrs_signal`  | Delegate to `elrs-encoder.ts` | Cross-reference |
| 5   | `_generate_gps_signal`   | Delegate to `gps-encoder.ts`  | Cross-reference |
| 6   | `_generate_gps_ca_code`  | Delegate to `gps-encoder.ts`  | Cross-reference |
| 7   | `_generate_ads_b_packet` | Delegate to `adsb-encoder.ts` | Cross-reference |
| 8   | `_generate_ais_packet`   | `generateAISPacket()`         | AIS-specific    |
| 9   | `_run_frequency_hopping` | `generateFrequencyHopping()`  | Pure function   |

### Workflow orchestration methods (move to Phase 7.4):

| #   | Python Method             | Destination                          |
| --- | ------------------------- | ------------------------------------ |
| 1   | `__init__`                | `transmit-manager.ts` constructor    |
| 2   | `get_available_workflows` | `transmit-manager.ts`                |
| 3   | `start_workflow`          | `transmit-manager.ts`                |
| 4   | `stop_workflow`           | `transmit-manager.ts`                |
| 5   | `_run_workflow`           | `transmit-manager.ts` dispatch logic |

### Verification:

```bash
npm run test:unit -- tests/unit/hackrf/dsp/protocols/modulation.test.ts
# Golden file comparison for AM and FM modulation
```

---

## Task 7.3.8: Enhanced Workflows Decomposition

**Source**: `hackrf_emitter/backend/rf_workflows/enhanced_workflows.py` (1,385 lines -- LARGEST FILE)
**Target**: DECOMPOSE into multiple files

### CRITICAL: This file MUST be decomposed, not migrated as-is.

The Python `EnhancedWorkflows` class (1,385 lines, 21 class-level methods (plus 3 nested `generate_signal` functions)) violates every size constraint
in the audit standards. It must be decomposed into:

| Target File                                 | Methods                                                                                                                       | Estimated Lines |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `enhanced-workflows.ts` (orchestrator only) | `getAvailableWorkflows()`, `startWorkflow()`, `stopWorkflow()`, dispatch logic                                                | ~150            |
| Move to existing protocol encoders          | `_run_enhanced_elrs` -> `elrs-encoder.ts`, `_run_enhanced_gps` -> `gps-encoder.ts`, `_run_enhanced_adsb` -> `adsb-encoder.ts` | Absorbed        |
| `radar-simulation.ts` (new)                 | `_run_radar_simulation`, `_generate_radar_signal`, `_simple_radar_simulation`                                                 | ~120            |
| `frequency-hopping.ts` (new)                | `_run_advanced_frequency_hopping`, `_simple_frequency_hopping`                                                                | ~100            |
| Move to existing `raw-energy.ts`            | `_create_raw_energy_workflows`, `_run_raw_energy_workflow`                                                                    | Absorbed        |

### Methods mapping:

| #   | Python Method                     | Destination File              | TypeScript Function                |
| --- | --------------------------------- | ----------------------------- | ---------------------------------- |
| 1   | `__init__`                        | `enhanced-workflows.ts`       | `constructor()`                    |
| 2   | `_ensure_cache_initialized`       | `enhanced-workflows.ts`       | `ensureCacheInitialized()`         |
| 3   | `get_available_workflows`         | `enhanced-workflows.ts`       | `getAvailableWorkflows()`          |
| 4   | `start_workflow`                  | Move to `transmit-manager.ts` | --                                 |
| 5   | `stop_workflow`                   | Move to `transmit-manager.ts` | --                                 |
| 6   | `_run_enhanced_workflow`          | `enhanced-workflows.ts`       | `runEnhancedWorkflow()` (dispatch) |
| 7   | `_run_enhanced_elrs`              | `elrs-encoder.ts`             | `generateEnhancedTransmission()`   |
| 8   | `_run_elrs_jammer`                | `elrs-jamming.ts`             | Already covered                    |
| 9   | `_run_drone_video_jammer`         | `drone-video-jamming.ts`      | Already covered                    |
| 10  | `_run_enhanced_gps`               | `gps-encoder.ts`              | `generateEnhancedGPSSignal()`      |
| 11  | `_run_enhanced_adsb`              | `adsb-encoder.ts`             | `generateEnhancedTransmission()`   |
| 12  | `_run_advanced_frequency_hopping` | `frequency-hopping.ts`        | `generateAdvancedHopping()`        |
| 13  | `_run_radar_simulation`           | `radar-simulation.ts`         | `generateRadarSimulation()`        |
| 14  | `_create_raw_energy_workflows`    | `raw-energy.ts`               | Absorbed into existing             |
| 15  | `_simple_frequency_hopping`       | `frequency-hopping.ts`        | `generateSimpleHopping()`          |
| 16  | `_run_raw_energy_workflow`        | `raw-energy.ts`               | Absorbed into existing             |
| 17  | `_generate_radar_signal`          | `radar-simulation.ts`         | `generateRadarSignal()`            |
| 18  | `_simple_radar_simulation`        | `radar-simulation.ts`         | `simpleRadarSimulation()`          |

**Note**: The class has 21 methods total at the class level. 3 additional nested `generate_signal` functions exist inside `_run_enhanced_gps` (line 1055), `_run_enhanced_adsb` (line 1120), and `_run_radar_simulation` (line 1197). These nested functions are inlined into their parent method's TypeScript equivalent and do not require separate migration entries.

### Result: No single file exceeds 300 lines. enhanced_workflows.py's 1,385 lines become distributed across 6 files.

### Verification:

```bash
# All enhanced workflow protocols generate valid output
npm run test:unit -- tests/unit/hackrf/dsp/protocols/enhanced-workflows.test.ts
npm run test:unit -- tests/unit/hackrf/dsp/protocols/radar-simulation.test.ts
npm run test:unit -- tests/unit/hackrf/dsp/protocols/frequency-hopping.test.ts

# No file exceeds 300 lines
find src/lib/server/hackrf/dsp/protocols/ -name '*.ts' -exec wc -l {} + | sort -n
```

---

## GATE CHECK: Golden File Comparison

After ALL protocol encoders are implemented, run the complete golden file test suite:

```bash
npm run test:unit -- tests/unit/hackrf/golden-file.test.ts --reporter=verbose
```

**Pass criteria**: 100% of golden file tests must pass. Any failure blocks Phase 7.4.

**NOTE (Independent Audit Correction)**: The original plan included Butterworth filter coefficient tests in this gate check. Those tests have been removed because scipy.signal.butter is not used in the Python codebase. The gate check covers protocol golden files only.

**Tolerance**: `toBeCloseTo(value, 10)` for Float64 comparisons (~5e-11 tolerance).
For uint8 I/Q output (hackrf_transfer format): strict equality.

---

## Error Handling Specification

**Added by Independent Audit (2026-02-08)**: The original plan did not specify error handling behavior for signal generation functions. Each protocol encoder must handle the following failure modes:

| Failure Mode                                                       | Required Behavior                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Invalid frequency (NaN, Infinity, negative)                        | Throw `TypeError` with descriptive message. Never return NaN samples.                      |
| Invalid sample rate (0, negative)                                  | Throw `RangeError`.                                                                        |
| Duration exceeding memory bounds (>10s at 2 Msps = 320 MB Float64) | Throw `RangeError` with message stating the memory requirement. Do NOT attempt allocation. |
| Internal arithmetic overflow                                       | All intermediate results must be checked. Use `Number.isFinite()` on critical outputs.     |
| Empty parameter object                                             | Throw `TypeError` listing required parameters.                                             |

These error conditions map to NASA/JPL Rule 5 (check return values) and CERT ERR00-TS (handle all errors). No signal generation function may silently produce corrupt output.

---

## Verification Checklist

- [ ] `adsb-encoder.ts`: All 18 methods migrated, golden file test passes
- [ ] `gps-encoder.ts`: All 16 methods migrated, golden file test passes
- [ ] `elrs-encoder.ts`: All 11 methods migrated, golden file test passes
- [ ] `elrs-jamming.ts`: 15 methods migrated, threading eliminated, test passes
- [ ] `drone-video-jamming.ts`: 19 methods migrated, threading eliminated, test passes
- [ ] `raw-energy.ts`: All 15 methods migrated, golden file test passes
- [ ] `modulation.ts`: Signal generation functions migrated, workflow logic moved to Phase 7.4
- [ ] `enhanced-workflows.ts`: Decomposed into orchestrator + 2 new files + absorbed into existing encoders
- [ ] `radar-simulation.ts`: Radar signal generation extracted and tested
- [ ] `frequency-hopping.ts`: Frequency hopping extracted and tested
- [ ] No file exceeds 300 lines
- [ ] All functions under 60 lines
- [ ] No `any` types in protocols directory
- [ ] All golden file tests pass (100%)
- [ ] `npm run typecheck` passes

---

## Definition of Done

This phase is complete when:

1. All 8 golden file comparison tests pass (ADS-B, GPS, ELRS, ELRS jamming, drone video, raw energy, AM, FM)
2. Every Python protocol method has a documented TypeScript equivalent
3. No TypeScript protocol file exceeds 300 lines
4. The enhanced_workflows.py decomposition is verified complete (no orphaned methods)
