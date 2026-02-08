# Phase 7.3.05: ELRS Jamming Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.4)
**Risk Level**: HIGH -- Architectural change (threading to stateless signal generation); jamming pattern correctness critical
**Prerequisites**: Phase-7.3.01 (types.ts), Phase-7.3.04 (ELRS encoder -- shared hop sequence logic), Phase 7.2 (DSP core)
**Estimated Duration**: 6 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the ELRS (ExpressLRS) jamming protocol from Python to TypeScript with a fundamental architectural change: the Python implementation uses `threading.Thread` for real-time concurrent jamming (frequency sweep, barrage, adaptive). The TypeScript implementation eliminates all threading in favor of stateless signal generation functions that return `Float64Array` sample buffers. The transmit-manager (Phase 7.4) handles the subprocess lifecycle and transmission scheduling.

This architectural change is the cleanest separation of concerns: protocol encoders ONLY generate samples; transmission is a separate concern.

---

## Source and Target

| Property         | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/elrs_jamming_protocol.py` |
| **Source lines** | 559 lines                                                      |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts`          |
| **Target lines** | ~400 lines (estimated)                                         |

---

## Methods to Migrate (17 methods)

| #   | Python Method                          | TypeScript Method                    | Notes                                                        |
| --- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| 1   | `__init__`                             | `constructor()`                      | Initialize jamming parameters, band config                   |
| 2   | `_generate_hop_sequences`              | `generateHopSequences()`             | Generate multiple FHSS hop sequences for jamming             |
| 3   | `generate_jamming_signal`              | `generateJammingSignal()`            | Main entry point: signal generation only                     |
| 4   | `generate_signal` (nested)             | Inline in `generateJammingSignal()`  | Remove nested function; inline into parent                   |
| 5   | `_generate_jamming_signal_internal`    | `generateJammingSignalInternal()`    | Core jamming signal generation                               |
| 6   | `start_frequency_sweeping_jammer`      | `generateFrequencySweepPattern()`    | **CHANGED**: No threading. Generate pattern, return samples  |
| 7   | `jammer_thread` (nested in #6)         | **REMOVED**                          | Threading eliminated -- see architectural change below       |
| 8   | `start_barrage_jammer`                 | `generateBarragePattern()`           | **CHANGED**: No threading. Generate pattern, return samples  |
| 9   | `barrage_thread` (nested in #8)        | **REMOVED**                          | Threading eliminated                                         |
| 10  | `start_adaptive_jammer`                | `generateAdaptivePattern()`          | **CHANGED**: No threading. Generate pattern, return samples  |
| 11  | `adaptive_thread` (nested in #10)      | **REMOVED**                          | Threading eliminated                                         |
| 12  | `_detect_elrs_traffic`                 | `detectELRSTraffic()`                | Traffic detection heuristic (input analysis, not generation) |
| 13  | `generate_complete_jamming_sequence`   | `generateCompleteSequence()`         | Full jamming sequence generation                             |
| 14  | `_transmit_frequency_hopping_sequence` | `generateFrequencyHoppingSequence()` | **CHANGED**: Generate, not transmit. Returns Float64Array    |
| 15  | `stop_all_jammers`                     | **REMOVED**                          | No threads to stop. Lifecycle managed by transmit-manager    |
| 16  | `get_band_info`                        | `getBandInfo()`                      | Accessor returning band configuration                        |
| 17  | `get_jamming_recommendations`          | `getJammingRecommendations()`        | Return recommended jamming parameters for detected traffic   |

### Method Count Reconciliation

- **17 total Python methods/functions** (15 class-level + 2 nested thread functions + `generate_signal` nested)
- Actually: 15 class-level methods + 3 nested functions (`jammer_thread`, `barrage_thread`, `adaptive_thread`) + 1 nested `generate_signal` = 19 code units
- But the parent document counts 17 rows in the table, which includes the 3 removed thread functions and the removed `stop_all_jammers`
- **TypeScript result**: 12 implemented methods (17 - 3 removed threads - 1 removed stop_all - 1 inlined generate_signal)

---

## ARCHITECTURAL CHANGE: Threading to Signal Generation

This is the most significant structural change in the Phase 7.3 migration. The Python implementation uses Python's `threading.Thread` with `threading.Event` for real-time jamming control.

### Python Pattern (concurrent, stateful)

```python
def start_barrage_jammer(self):
    self._stop_event.clear()
    thread = threading.Thread(target=barrage_thread, daemon=True)
    thread.start()
    self._active_threads.append(thread)

def barrage_thread():
    while not self._stop_event.is_set():
        samples = generate_noise(bandwidth=self._bandwidth)
        self._transmit(samples)  # Direct HackRF transmission
        time.sleep(0.001)  # 1ms between bursts

def stop_all_jammers(self):
    self._stop_event.set()
    for thread in self._active_threads:
        thread.join(timeout=5.0)
    self._active_threads.clear()
```

**Problems with the Python pattern**:

1. Threads hold mutable state (`_stop_event`, `_active_threads`)
2. Direct `_transmit()` calls couple signal generation to hardware
3. Thread lifecycle management is error-prone (join timeouts, daemon threads)
4. Cannot unit test signal generation without mocking the transmit path

### TypeScript Pattern (generate-then-transmit, stateless)

```typescript
generateBarragePattern(params: BarrageParams): Float64Array {
    // Validate inputs per Phase-7.3.10 error spec
    if (!Number.isFinite(params.frequency) || params.frequency <= 0) {
        throw new TypeError('Invalid frequency: must be a positive finite number');
    }

    // Generate complete jamming signal buffer
    const totalSamples = Math.ceil(params.duration * params.sampleRate);
    const samples = new Float64Array(totalSamples * 2); // I/Q interleaved

    // Fill with wideband noise across the target bandwidth
    for (let i = 0; i < totalSamples; i++) {
        // ... noise generation using DSP core random/filter functions
    }

    return samples;
    // Transmission is handled by transmit-manager (Phase 7.4).
}
```

**Benefits of the TypeScript pattern**:

1. Pure functions -- no mutable state, no thread lifecycle
2. Signal generation is completely decoupled from transmission
3. Unit testable: pass parameters, verify output samples
4. Composable: transmit-manager can schedule, buffer, or repeat patterns

### Methods Eliminated by Architectural Change

| Python Method/Function     | Reason for Elimination                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| `jammer_thread` (nested)   | Threading eliminated; logic absorbed into `generateFrequencySweepPattern()` |
| `barrage_thread` (nested)  | Threading eliminated; logic absorbed into `generateBarragePattern()`        |
| `adaptive_thread` (nested) | Threading eliminated; logic absorbed into `generateAdaptivePattern()`       |
| `stop_all_jammers`         | No threads to stop; transmission lifecycle managed by transmit-manager      |

### Methods Renamed by Architectural Change

| Python Method                          | TypeScript Method                    | Change Description                        |
| -------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `start_frequency_sweeping_jammer`      | `generateFrequencySweepPattern()`    | "start" -> "generate"; returns samples    |
| `start_barrage_jammer`                 | `generateBarragePattern()`           | "start" -> "generate"; returns samples    |
| `start_adaptive_jammer`                | `generateAdaptivePattern()`          | "start" -> "generate"; returns samples    |
| `_transmit_frequency_hopping_sequence` | `generateFrequencyHoppingSequence()` | "transmit" -> "generate"; returns samples |

---

## Key Numerical Operations

| Operation                  | Specification                                                         | Precision Requirement    |
| -------------------------- | --------------------------------------------------------------------- | ------------------------ |
| Frequency sweep generation | Linear sweep across ELRS hop frequencies                              | Float64 intermediate     |
| Barrage noise generation   | Wideband noise covering full ELRS bandwidth                           | Float64 intermediate     |
| Adaptive jamming pattern   | Targeted noise on detected active channels                            | Float64 intermediate     |
| Hop sequence prediction    | Uses same FHSS algorithm as `elrs-encoder.ts` to predict next channel | Exact integer arithmetic |
| ELRS traffic detection     | Signal analysis heuristic for identifying ELRS transmissions          | Float64 intermediate     |

---

## Error Handling

Per Phase-7.3.10 specification:

1. `generateJammingSignal()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateJammingSignal()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateJammingSignal()` with duration exceeding memory bounds -> throw `RangeError` with memory estimate
4. All `generate*Pattern()` methods with empty parameter object -> throw `TypeError` listing required params
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/elrs-jamming.test.ts

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts && echo "FAIL" || echo "PASS"

# Verify no threading references
grep -n 'thread\|Thread\|Worker\|setInterval' src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts && echo "FAIL: threading found" || echo "PASS"

# Verify no direct transmit calls
grep -n '_transmit\|hackrf_transfer\|subprocess' src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts && echo "FAIL: direct transmit found" || echo "PASS"

# File line count (should be ~400)
wc -l src/lib/server/hackrf/dsp/protocols/elrs-jamming.ts
```

---

## Verification Checklist

- [ ] `elrs-jamming.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `class ELRSJamming` implements `ProtocolEncoder` from `types.ts`
- [ ] All 17 Python methods/functions accounted for in migration table
- [ ] 12 TypeScript methods implemented (17 - 4 removed - 1 inlined)
- [ ] `jammer_thread` nested function **REMOVED** (logic absorbed into `generateFrequencySweepPattern()`)
- [ ] `barrage_thread` nested function **REMOVED** (logic absorbed into `generateBarragePattern()`)
- [ ] `adaptive_thread` nested function **REMOVED** (logic absorbed into `generateAdaptivePattern()`)
- [ ] `stop_all_jammers` **REMOVED** (lifecycle managed by transmit-manager)
- [ ] `start_*` methods renamed to `generate*Pattern()` -- return `Float64Array`, no side effects
- [ ] `_transmit_frequency_hopping_sequence` renamed to `generateFrequencyHoppingSequence()` -- returns samples
- [ ] No `threading`, `Thread`, `Worker`, or `setInterval` references in file
- [ ] No direct `_transmit()` or `hackrf_transfer` calls in file
- [ ] All signal generation methods are pure functions (no mutable class state beyond constructor init)
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 17 Python methods/functions have documented TypeScript equivalents or documented removal reasons
2. The threading-to-signal-generation architectural change is fully implemented
3. All `generate*Pattern()` methods return `Float64Array` without side effects
4. No threading, Worker, or direct transmit references exist in the file
5. Unit tests pass
6. `npm run typecheck` passes
7. File line count is approximately 400 lines (maximum tolerance: 450)

---

## Cross-References

- **Previous**: Phase-7.3.04-ELRS-Encoder-Migration.md
- **Next**: Phase-7.3.06-Drone-Video-Jamming-Migration.md
- **Same architectural change**: Phase-7.3.06 (drone video jamming uses identical threading elimination pattern)
- **Hop sequence shared with**: Phase-7.3.04 (ELRS encoder -- same FHSS algorithm)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` handles transmission scheduling)
- **Enhanced workflows**: Phase-7.3.09 (`_run_elrs_jammer` already covered by this encoder)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
