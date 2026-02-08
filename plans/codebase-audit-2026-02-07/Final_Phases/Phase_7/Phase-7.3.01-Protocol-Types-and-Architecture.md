# Phase 7.3.01: Protocol Types and Architecture

**Decomposed from**: Phase-7.3-PROTOCOL-ENCODERS.md
**Risk Level**: MEDIUM -- Foundational types; errors here propagate to all 8 protocol encoders
**Prerequisites**: Phase 7.2 (DSP core library must exist and pass all tests)
**Estimated Duration**: 2 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Establish the shared type definitions, directory structure, and barrel export for all protocol encoders in Phase 7.3. This sub-task creates the foundational `types.ts` and `index.ts` files that every subsequent sub-task (7.3.02 through 7.3.09) depends on. No signal generation logic is implemented here -- only contracts.

---

## Directory Architecture

All protocol encoders reside under `src/lib/server/hackrf/dsp/protocols/`. The complete file listing with estimated line counts after all Phase 7.3 sub-tasks are complete:

```
src/lib/server/hackrf/dsp/protocols/
  index.ts                          # Barrel export                         (~40 lines)
  types.ts                          # Shared protocol interfaces            (~50 lines)
  adsb-encoder.ts                   # ADS-B Mode S (Task 7.3.02)           (~450 lines)
  gps-encoder.ts                    # GPS L1 C/A (Task 7.3.03)             (~350 lines)
  elrs-encoder.ts                   # ExpressLRS (Task 7.3.04)             (~250 lines)
  elrs-jamming.ts                   # ELRS jamming (Task 7.3.05)           (~400 lines)
  drone-video-jamming.ts            # Video downlink interference (7.3.06)  (~400 lines)
  raw-energy.ts                     # Broadband energy (Task 7.3.07)       (~250 lines)
  modulation.ts                     # AM/FM/PSK/QAM (Task 7.3.08)         (~500 lines)
  enhanced-workflows.ts             # Orchestrator only (Task 7.3.09)      (~150 lines)
  radar-simulation.ts               # Radar signal gen (Task 7.3.09)       (~120 lines)
  frequency-hopping.ts              # Freq hopping (Task 7.3.09)           (~100 lines)
```

**Total estimated TypeScript lines**: ~3,060 (down from ~4,885 Python lines across 8 source files)

**Constraint**: No single file may exceed 300 lines, except `adsb-encoder.ts` (~450), `gps-encoder.ts` (~350), `elrs-jamming.ts` (~400), `drone-video-jamming.ts` (~400), and `modulation.ts` (~500) which contain dense numerical implementations that cannot be further decomposed without breaking signal generation correctness. These exceptions are documented in Phase 7.3.10 gate check.

---

## Shared Types (`types.ts`)

Create `src/lib/server/hackrf/dsp/protocols/types.ts` with the following exact content:

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

### Type Design Rationale

| Type                     | Purpose                                                           | Used By                          |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------- |
| `ProtocolEncoder`        | Common interface for polymorphic dispatch in transmit-manager     | All encoder classes              |
| `SignalGenerationResult` | Structured return type with metadata for logging and golden files | All `generate*()` entry points   |
| `BaseProtocolParams`     | Parameter validation base; extended by each protocol's param type | All encoder constructors/methods |

### Constraints on Types

1. `Float64Array` is the canonical sample container -- never `number[]` or `Float32Array` for intermediate computation
2. `frequency` is always in Hz (not MHz or GHz) -- conversion happens at the API layer
3. `sampleRate` is always in samples/second (not Msps)
4. `duration` is always in seconds (not milliseconds)
5. All types are pure interfaces (no classes) -- they impose zero runtime overhead

---

## Barrel Export (`index.ts`)

Create `src/lib/server/hackrf/dsp/protocols/index.ts` with re-exports of all protocol encoders and types:

```typescript
// Types
export type { ProtocolEncoder, SignalGenerationResult, BaseProtocolParams } from './types';

// Protocol encoders
export { ADSBEncoder } from './adsb-encoder';
export { GPSEncoder } from './gps-encoder';
export { ELRSEncoder } from './elrs-encoder';
export { ELRSJamming } from './elrs-jamming';
export { DroneVideoJamming } from './drone-video-jamming';
export { RawEnergy } from './raw-energy';

// Modulation functions (exported as named functions, not a class)
export {
	generateSineWave,
	generateFMSignal,
	generateAMSignal,
	generateAISPacket,
	generateFrequencyHopping
} from './modulation';

// Enhanced workflows orchestrator
export { EnhancedWorkflows } from './enhanced-workflows';

// Decomposed from enhanced-workflows.py
export {
	generateRadarSimulation,
	generateRadarSignal,
	simpleRadarSimulation
} from './radar-simulation';
export { generateAdvancedHopping, generateSimpleHopping } from './frequency-hopping';
```

### Barrel Export Rules

1. Types are re-exported with `export type` to enable TypeScript isolatedModules compatibility
2. Classes are exported by name (not default) to prevent import aliasing confusion
3. Modulation functions are exported individually (the class is eliminated; only pure functions remain)
4. The barrel export is the ONLY public API for the protocols directory -- no direct file imports from outside

---

## Implementation Steps

1. Create directory `src/lib/server/hackrf/dsp/protocols/` if it does not exist
2. Create `types.ts` with the exact interface definitions above
3. Create `index.ts` as a placeholder barrel with only the `types.ts` re-exports initially
4. As each subsequent sub-task (7.3.02--7.3.09) completes, add its exports to `index.ts`
5. After all sub-tasks complete, verify the barrel matches the full listing above

---

## Verification Commands

```bash
# Directory exists
ls -la src/lib/server/hackrf/dsp/protocols/

# types.ts compiles without errors
npx tsc --noEmit src/lib/server/hackrf/dsp/protocols/types.ts

# index.ts compiles without errors (run after all sub-tasks)
npx tsc --noEmit src/lib/server/hackrf/dsp/protocols/index.ts

# No 'any' types in the protocols directory
grep -rn ': any' src/lib/server/hackrf/dsp/protocols/ | grep -v 'node_modules' && echo "FAIL: any types found" || echo "PASS"

# Typecheck passes
npm run typecheck
```

---

## Verification Checklist

- [ ] Directory `src/lib/server/hackrf/dsp/protocols/` created
- [ ] `types.ts` contains `ProtocolEncoder`, `SignalGenerationResult`, and `BaseProtocolParams` interfaces
- [ ] `types.ts` uses `Float64Array` (not `number[]` or `Float32Array`) for sample data
- [ ] `types.ts` frequency is in Hz, sampleRate in samples/second, duration in seconds
- [ ] `index.ts` created with placeholder type re-exports
- [ ] `index.ts` uses `export type` for interface re-exports
- [ ] `npm run typecheck` passes with both files present
- [ ] No `any` types in either file

---

## Definition of Done

This sub-task is complete when:

1. Both `types.ts` and `index.ts` exist in `src/lib/server/hackrf/dsp/protocols/`
2. `types.ts` contains the exact 3 interface definitions specified above
3. `index.ts` compiles as a valid barrel export (initially with types only)
4. `npm run typecheck` passes
5. No `any` types exist in the protocols directory

---

## Cross-References

- **Next**: Phase-7.3.02-ADS-B-Encoder-Migration.md (first encoder to implement)
- **Depends on**: Phase 7.2 (DSP core library -- provides CRC, FFT, filter primitives)
- **Consumed by**: Phase 7.4 (transmit-manager.ts imports from this barrel)
- **Parent**: Phase-7.3-PROTOCOL-ENCODERS.md
