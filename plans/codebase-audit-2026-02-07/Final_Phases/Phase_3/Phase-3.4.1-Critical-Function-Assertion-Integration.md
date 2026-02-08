# Phase 3.4.1: Critical Function Assertion Integration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: NASA/JPL Rule 5 (minimum of two runtime assertions per function), CERT ERR00-C (consistent error handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.1
**Risk Level**: LOW-MEDIUM -- Adding validation to existing functions; may expose latent bugs
**Prerequisites**: Phase 3.4.0 (assert.ts must exist), Phase 3.2.0 (RF_BANDS constants for assertion bounds)
**Blocks**: Phase 4 (Type Safety), Phase 5 (Architecture)
**Estimated Files Touched**: ~8
**Standards**: NASA/JPL Rule 5 (runtime assertions), CERT ERR00-C (consistent error handling), MISRA Rule 21.8 (no undefined behavior from invalid input)

---

## Objective

Add runtime assertions to the most critical data processing functions in the codebase: geospatial calculations, sweep manager state machines, and signal processing functions. These are the functions where garbage input produces silently corrupt intelligence output.

## Current State Assessment

| Metric                         | Verified Value | Target |
| ------------------------------ | -------------- | ------ |
| `assert(` calls in src/\*.ts   | 0              | 50+    |
| Geospatial functions validated | 0 of 3         | 3 of 3 |
| Sweep manager state guards     | 0              | 6+     |
| Signal processing validated    | 0 of 3         | 3 of 3 |

## Scope

### Priority 1: Geospatial Functions (`src/lib/server/db/geo.ts`)

These functions calculate distances and grid coordinates from GPS positions. Invalid coordinates produce silently wrong results -- a lat of 999 would compute a nonsensical distance, not throw an error.

| Function                                    | Assertions to Add                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calculateDistance(lat1, lon1, lat2, lon2)` | `assertRange(lat1, -90, 90, 'lat1')`, `assertRange(lat2, -90, 90, 'lat2')`, `assertRange(lon1, -180, 180, 'lon1')`, `assertRange(lon2, -180, 180, 'lon2')` |
| `convertRadiusToGrid(lat, lon, radius)`     | `assertRange(lat, -90, 90, 'lat')`, `assertRange(lon, -180, 180, 'lon')`, `assert(radius > 0, 'radius must be positive', { radius })`                      |
| `detectDeviceType(frequency)`               | `assertFiniteNumber(frequency, 'frequency')`                                                                                                               |

**Example integration**:

```typescript
import { assertRange, assertFiniteNumber, assert } from '$lib/utils/assert';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	assertRange(lat1, -90, 90, 'lat1');
	assertRange(lon1, -180, 180, 'lon1');
	assertRange(lat2, -90, 90, 'lat2');
	assertRange(lon2, -180, 180, 'lon2');
	// ... existing Haversine formula
}
```

### Priority 2: Sweep Manager State Transitions

The HackRF and USRP sweep managers use state machines (Idle, Running, Stopping). Invalid state transitions indicate logic bugs that can leave hardware in undefined states.

| File                                    | Assertion                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/hackrf/sweepManager.ts` | Assert state machine transitions: only Idle->Running, Running->Stopping, Stopping->Idle. Log and reject invalid transitions. |
| `src/lib/server/usrp/sweepManager.ts`   | Same assertions as HackRF sweep manager.                                                                                     |

**Example integration**:

```typescript
import { assert } from '$lib/utils/assert';

const VALID_TRANSITIONS: Record<SweepState, SweepState[]> = {
    idle: ['running'],
    running: ['stopping'],
    stopping: ['idle'],
};

private transitionTo(newState: SweepState): void {
    const validTargets = VALID_TRANSITIONS[this.state];
    assert(
        validTargets.includes(newState),
        `Invalid state transition: ${this.state} -> ${newState}`,
        { currentState: this.state, requestedState: newState }
    );
    this.state = newState;
}
```

### Priority 3: Signal Processing Functions

These functions filter and process RF signal data. Invalid frequency or power values produce corrupted intelligence products.

| File                                      | Function                 | Assertions                                                                                                 |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/services/map/signalFiltering.ts` | `filterByFrequencyRange` | `assertRange` on min frequency, `assertRange` on max frequency, `assert(min <= max, 'min must be <= max')` |
| `src/lib/services/map/droneDetection.ts`  | `detectDrone`            | `assertFiniteNumber` on frequency                                                                          |
| `src/lib/server/db/signalRepository.ts`   | `insertSignal`           | `assertRange` on lat (-90..90), `assertRange` on lon (-180..180), `assertFiniteNumber` on power            |

## Execution Steps

### Step 1: Verify assert.ts Exists

```bash
test -f src/lib/utils/assert.ts && echo "EXISTS" || echo "MISSING -- Phase 3.4.0 prerequisite not met"
```

### Step 2: Add Assertions to geo.ts (Priority 1)

Import assertion functions and add range checks to `calculateDistance`, `convertRadiusToGrid`, and `detectDeviceType`.

### Step 3: Add State Transition Guards to Sweep Managers (Priority 2)

Create a `VALID_TRANSITIONS` map and add `assert()` calls at every state transition point in both HackRF and USRP sweep managers.

### Step 4: Add Assertions to Signal Processing Functions (Priority 3)

Import and add assertions to `filterByFrequencyRange`, `detectDrone`, and `insertSignal`.

### Step 5: Verify Assertion Counts

```bash
grep -rn "assert" src/lib/server/db/geo.ts | wc -l
# Expected: 6+ (at least 2 per function per NASA/JPL Rule 5)

grep -rn "assert" src/lib/server/hackrf/sweepManager.ts | wc -l
# Expected: 3+ (state transition guards)

grep -rn "assert" src/lib/server/usrp/sweepManager.ts | wc -l
# Expected: 3+ (state transition guards)
```

### Step 6: Run Full Verification

```bash
npm run typecheck  # Must pass
npm run test:unit  # Must pass
npm run build      # Must pass
```

## Commit Message

```
feat(assert): add runtime assertions to geospatial, sweep, and signal processing functions
```

## Verification

| #   | Check                             | Command                                                    | Expected |
| --- | --------------------------------- | ---------------------------------------------------------- | -------- |
| 1   | Assertions in geo.ts              | `grep -c "assert" src/lib/server/db/geo.ts`                | 6+       |
| 2   | Assertions in HackRF sweepManager | `grep -c "assert" src/lib/server/hackrf/sweepManager.ts`   | 3+       |
| 3   | Assertions in USRP sweepManager   | `grep -c "assert" src/lib/server/usrp/sweepManager.ts`     | 3+       |
| 4   | Assertions in signalFiltering.ts  | `grep -c "assert" src/lib/services/map/signalFiltering.ts` | 2+       |
| 5   | Assertions in signalRepository.ts | `grep -c "assert" src/lib/server/db/signalRepository.ts`   | 3+       |
| 6   | Total assertions in codebase      | `grep -rn "assert(" src/ --include="*.ts" \| wc -l`        | 20+      |
| 7   | TypeScript compiles               | `npm run typecheck`                                        | Exit 0   |
| 8   | Build succeeds                    | `npm run build`                                            | Exit 0   |
| 9   | Unit tests pass                   | `npm run test:unit`                                        | Exit 0   |

## Risk Assessment

| Risk                                              | Likelihood | Impact   | Mitigation                                                                                       |
| ------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------ |
| Assertion throws in production for edge case      | MEDIUM     | MEDIUM   | Assertions are for "should never happen" conditions. Catching real bugs is the intended outcome. |
| State transition assertion blocks valid operation | LOW        | HIGH     | Carefully verify all valid state transitions before defining the VALID_TRANSITIONS map.          |
| Latent bug exposed by new assertions              | MEDIUM     | LOW      | This is the intended behavior -- assertions revealing latent bugs is a feature, not a risk.      |
| Performance overhead from assertion checks        | VERY LOW   | VERY LOW | Assertions are simple numeric comparisons; negligible overhead even in hot paths.                |

## Success Criteria

- [ ] All 3 geospatial functions have range assertions on lat/lon parameters
- [ ] Both HackRF and USRP sweep managers have state transition guards
- [ ] Signal filtering and insertion functions validate frequency/power/coordinates
- [ ] Total assertion count in codebase reaches 20+ (from 0)
- [ ] NASA/JPL Rule 5 compliance: critical functions have 2+ assertions each
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.4.0 (assert.ts must be created first)
- **Depends on**: Phase 3.2.0 (RF_BANDS constants provide named bounds for frequency assertions, e.g., `RF_BANDS.WIFI_2G_MIN`)
- **Depended on by**: Phase 4 (Type Safety benefits from runtime validation)
- **Depended on by**: Phase 5 (Architecture decomposition benefits from validated function contracts)
- **Related**: Phase 3.4.3 (Zod Schema Validation) -- Zod validates API input; assertions validate function contracts

## Execution Tracking

| Step | Description                        | Status  | Started | Completed | Verified By |
| ---- | ---------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Verify assert.ts exists            | PENDING | --      | --        | --          |
| 2    | Add assertions to geo.ts           | PENDING | --      | --        | --          |
| 3    | Add state guards to sweep managers | PENDING | --      | --        | --          |
| 4    | Add assertions to signal functions | PENDING | --      | --        | --          |
| 5    | Verify assertion counts            | PENDING | --      | --        | --          |
| 6    | Run full verification              | PENDING | --      | --        | --          |
