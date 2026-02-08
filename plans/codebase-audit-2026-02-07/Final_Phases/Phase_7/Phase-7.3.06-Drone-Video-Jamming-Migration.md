# Phase 7.3.06: Drone Video Jamming Migration

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md (Task 7.3.5)
**Risk Level**: HIGH -- Same threading-to-signal-generation architectural change as Phase-7.3.05; 5.8 GHz video downlink interference pattern must be spectrally correct
**Prerequisites**: Phase-7.3.01 (types.ts), Phase-7.3.05 (ELRS jamming -- establishes the threading elimination pattern), Phase 7.2 (DSP core)
**Estimated Duration**: 5 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the drone video jamming protocol from Python to TypeScript. This encoder generates interference signals targeting drone video downlinks, primarily in the 5.8 GHz ISM band used by analog FPV systems and some digital video links. Like Phase-7.3.05 (ELRS jamming), this migration requires the same fundamental architectural change: all Python `threading.Thread`-based real-time jamming loops are converted to stateless signal generation functions that return `Float64Array` sample buffers.

---

## Source and Target

| Property         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Source file**  | `hackrf_emitter/backend/rf_workflows/drone_video_jamming_protocol.py` |
| **Source lines** | 579 lines                                                             |
| **Target file**  | `src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts`          |
| **Target lines** | ~400 lines (estimated)                                                |

---

## Methods to Migrate (19 methods)

The parent document states "19 methods" and specifies the same threading-to-signal-generation architectural change as Task 7.3.4. The complete method mapping:

| #   | Python Method                             | TypeScript Method                        | Notes                                                     |
| --- | ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| 1   | `__init__`                                | `constructor()`                          | Initialize video channel table, band config               |
| 2   | `_get_video_channels`                     | `getVideoChannels()`                     | Return supported 5.8 GHz video channel frequencies        |
| 3   | `_generate_wideband_noise`                | `generateWidebandNoise()`                | Wideband noise covering video bandwidth                   |
| 4   | `_generate_channel_hopping_pattern`       | `generateChannelHoppingPattern()`        | Hop across video channels                                 |
| 5   | `_generate_video_interference`            | `generateVideoInterference()`            | Synthesize video-specific interference                    |
| 6   | `generate_video_jamming_signal`           | `generateVideoJammingSignal()`           | Main entry point (public API)                             |
| 7   | `generate_signal` (nested)                | Inline in `generateVideoJammingSignal()` | Remove nested function; inline into parent                |
| 8   | `_generate_video_jamming_signal_internal` | `generateVideoJammingSignalInternal()`   | Core generation logic                                     |
| 9   | `start_wideband_jammer`                   | `generateWidebandPattern()`              | **CHANGED**: No threading. Return samples                 |
| 10  | `wideband_thread` (nested in #9)          | **REMOVED**                              | Threading eliminated                                      |
| 11  | `start_channel_hopping_jammer`            | `generateChannelHoppingJamPattern()`     | **CHANGED**: No threading. Return samples                 |
| 12  | `hopping_thread` (nested in #11)          | **REMOVED**                              | Threading eliminated                                      |
| 13  | `start_targeted_jammer`                   | `generateTargetedPattern()`              | **CHANGED**: No threading. Return samples                 |
| 14  | `targeted_thread` (nested in #13)         | **REMOVED**                              | Threading eliminated                                      |
| 15  | `_detect_video_downlink`                  | `detectVideoDownlink()`                  | Video signal detection heuristic                          |
| 16  | `_estimate_video_protocol`                | `estimateVideoProtocol()`                | Identify analog vs digital video link                     |
| 17  | `stop_jamming`                            | **REMOVED**                              | No threads to stop; lifecycle managed by transmit-manager |
| 18  | `get_channel_info`                        | `getChannelInfo()`                       | Accessor returning channel configuration                  |
| 19  | `get_jamming_effectiveness`               | `getJammingEffectiveness()`              | Return effectiveness estimate for given parameters        |

### Method Count Reconciliation

- **19 total Python code units** (15 class-level methods + 3 nested thread functions + 1 nested `generate_signal`)
- **TypeScript result**: 13 implemented methods (19 - 3 removed threads - 1 removed stop_jamming - 1 inlined generate_signal - 1 inlined generate_signal = 13)
- Actually: 14 implemented methods (15 class-level - 1 removed `stop_jamming` + 0 since nested functions are absorbed)

### Architectural Change: Threading to Signal Generation

This uses the identical pattern established in Phase-7.3.05 (ELRS Jamming). All `start_*_jammer` methods become `generate*Pattern` methods that return `Float64Array`. All `*_thread` nested functions are eliminated. `stop_jamming` is eliminated (handled by transmit-manager in Phase 7.4).

**Python pattern** (concurrent, stateful):

```python
def start_wideband_jammer(self):
    self._stop_event.clear()
    thread = threading.Thread(target=wideband_thread, daemon=True)
    thread.start()

def wideband_thread():
    while not self._stop_event.is_set():
        samples = self._generate_wideband_noise(bandwidth=20e6)
        self._transmit(samples)
```

**TypeScript pattern** (generate-then-transmit, stateless):

```typescript
generateWidebandPattern(params: WidebandParams): Float64Array {
    // Generate complete wideband jamming signal buffer
    // Return samples. Transmission is handled by transmit-manager (Phase 7.4).
    const totalSamples = Math.ceil(params.duration * params.sampleRate);
    const samples = new Float64Array(totalSamples * 2); // I/Q interleaved
    // ... fill with wideband noise at 5.8 GHz
    return samples;
}
```

### Methods Eliminated by Architectural Change

| Python Method/Function     | Reason for Elimination                                                         |
| -------------------------- | ------------------------------------------------------------------------------ |
| `wideband_thread` (nested) | Threading eliminated; logic absorbed into `generateWidebandPattern()`          |
| `hopping_thread` (nested)  | Threading eliminated; logic absorbed into `generateChannelHoppingJamPattern()` |
| `targeted_thread` (nested) | Threading eliminated; logic absorbed into `generateTargetedPattern()`          |
| `stop_jamming`             | No threads to stop; transmission lifecycle managed by transmit-manager         |

---

## Key Numerical Operations

| Operation                   | Specification                                                             | Precision Requirement     |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| Wideband noise at 5.8 GHz   | Gaussian white noise filtered to video channel bandwidth (20 MHz typical) | Float64 intermediate      |
| Frequency hopping           | Sequential/random hop across 5.8 GHz video channels (Race Band, etc.)     | Exact integer (channel #) |
| Video downlink interference | Pattern designed to disrupt NTSC/PAL analog or OSD digital video          | Float64 intermediate      |
| Channel frequency lookup    | 5.8 GHz ISM band channel table (5645-5945 MHz typical)                    | Exact integer (MHz)       |
| Video protocol estimation   | Signal analysis for analog (FM) vs digital (OFDM) video identification    | Float64 intermediate      |

### 5.8 GHz Video Channel Bands

The encoder must support standard FPV video channel bands:

| Band      | Channels | Frequency Range |
| --------- | -------- | --------------- |
| Band A    | A1-A8    | 5865-5725 MHz   |
| Band B    | B1-B8    | 5733-5866 MHz   |
| Band E    | E1-E8    | 5705-5839 MHz   |
| Race Band | R1-R8    | 5658-5917 MHz   |
| Low Band  | L1-L8    | 5362-5880 MHz   |

Channel frequencies must be exact integers in MHz, converted to Hz for signal generation.

---

## Error Handling

Per Phase-7.3.10 specification:

1. `generateVideoJammingSignal()` with invalid frequency (NaN, Infinity, negative) -> throw `TypeError`
2. `generateVideoJammingSignal()` with invalid sample rate (0, negative) -> throw `RangeError`
3. `generateVideoJammingSignal()` with duration exceeding memory bounds -> throw `RangeError` with memory estimate
4. All `generate*Pattern()` methods with empty parameter object -> throw `TypeError` listing required params
5. Internal arithmetic producing NaN/Infinity -> check with `Number.isFinite()` on critical outputs

---

## Verification Commands

```bash
# Unit tests pass
npm run test:unit -- tests/unit/hackrf/dsp/protocols/drone-video-jamming.test.ts

# Typecheck passes
npm run typecheck

# No 'any' types
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts && echo "FAIL" || echo "PASS"

# Verify no threading references
grep -n 'thread\|Thread\|Worker\|setInterval' src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts && echo "FAIL: threading found" || echo "PASS"

# Verify no direct transmit calls
grep -n '_transmit\|hackrf_transfer\|subprocess' src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts && echo "FAIL: direct transmit found" || echo "PASS"

# File line count (should be ~400)
wc -l src/lib/server/hackrf/dsp/protocols/drone-video-jamming.ts
```

---

## Verification Checklist

- [ ] `drone-video-jamming.ts` created in `src/lib/server/hackrf/dsp/protocols/`
- [ ] `class DroneVideoJamming` implements `ProtocolEncoder` from `types.ts`
- [ ] All 19 Python methods/functions accounted for in migration table
- [ ] `wideband_thread` nested function **REMOVED** (logic absorbed into `generateWidebandPattern()`)
- [ ] `hopping_thread` nested function **REMOVED** (logic absorbed into `generateChannelHoppingJamPattern()`)
- [ ] `targeted_thread` nested function **REMOVED** (logic absorbed into `generateTargetedPattern()`)
- [ ] `stop_jamming` **REMOVED** (lifecycle managed by transmit-manager)
- [ ] `start_*` methods renamed to `generate*Pattern()` -- return `Float64Array`, no side effects
- [ ] No `threading`, `Thread`, `Worker`, or `setInterval` references in file
- [ ] No direct `_transmit()` or `hackrf_transfer` calls in file
- [ ] 5.8 GHz video channel table implemented with correct frequencies
- [ ] Supports wideband noise, channel hopping, and targeted jamming modes
- [ ] Error handling for all 5 failure modes implemented per Phase-7.3.10 spec
- [ ] No `any` types in file
- [ ] All functions under 60 lines
- [ ] `npm run typecheck` passes
- [ ] Export added to `index.ts` barrel

---

## Definition of Done

This sub-task is complete when:

1. All 19 Python methods/functions have documented TypeScript equivalents or documented removal reasons
2. The threading-to-signal-generation architectural change is fully implemented (identical pattern to Phase-7.3.05)
3. All `generate*Pattern()` methods return `Float64Array` without side effects
4. No threading, Worker, or direct transmit references exist in the file
5. Unit tests pass
6. `npm run typecheck` passes
7. File line count is approximately 400 lines (maximum tolerance: 450)

---

## Cross-References

- **Previous**: Phase-7.3.05-ELRS-Jamming-Migration.md
- **Next**: Phase-7.3.07-Raw-Energy-Migration.md
- **Same architectural change**: Phase-7.3.05 (ELRS jamming -- identical threading elimination pattern)
- **Enhanced workflows**: Phase-7.3.09 (`_run_drone_video_jammer` already covered by this encoder)
- **Transmit lifecycle**: Phase 7.4 (`transmit-manager.ts` handles transmission scheduling)
- **Error spec**: Phase-7.3.10-Golden-File-Gate-Check.md
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
