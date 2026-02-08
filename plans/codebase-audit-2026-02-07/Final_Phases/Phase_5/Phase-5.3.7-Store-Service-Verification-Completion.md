# Phase 5.3.7: Store-Service Boundary Verification and Completion

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7, CERT C STR00-C, NASA/JPL Rule 15, BARR-C Rule 8.7
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.7
**Risk Level**: LOW -- Verification only; zero code changes
**Prerequisites**: ALL prior Phase 5.3 tasks (5.3.0 through 5.3.6) complete
**Blocks**: Phase 5.4 (File Size Enforcement)
**Estimated Files Touched**: 0 (verification only)
**Standards**: All Phase 5.3 standards

---

## Objective

Execute the complete verification checklist for Phase 5.3. Every check must pass before Phase 5.3 can be marked complete and signed off. This task also documents the final state metrics and handles any edge-case violations discovered at execution time.

---

## Verification Checklist

Execute ALL verification commands after completing all Phase 5.3 tasks. Every check must pass.

### Check 1: Circular Dependency Verification

```bash
npx madge --circular --extensions ts src/
# EXPECTED: No circular dependency found
# NOTE: If madge reports the heatmapService <-> webglHeatmapRenderer cycle,
# this is the type-only cycle documented in Task 5.3.1 (REMOVED). It is
# a false positive. Verify with:
#   grep "import type" src/lib/services/map/webglHeatmapRenderer.ts | grep heatmapService
# If the import is type-only, the cycle is harmless and the check passes.
```

### Check 2: Type-Only Store Import Verification

```bash
# Type-only imports from stores in service/server files: must be 0
grep -rn "from.*stores.*import type" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: 0 results

# Alternate pattern check
grep -rn "import type.*from.*stores" src/lib/services/ src/lib/server/ --include="*.ts"
# EXPECTED: 0 results
```

### Check 3: Runtime Store Import Verification

```bash
# Runtime imports from stores in service files: must be exactly 4 (exempted hackrfsweep files)
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "\.d\.ts" \
  | grep -v "example-usage" \
  | grep -v "test-connection"
# EXPECTED: exactly 4 lines, all in services/hackrfsweep/
# Specifically:
#   services/hackrfsweep/controlService.ts
#   services/hackrfsweep/displayService.ts
#   services/hackrfsweep/frequencyService.ts
#   services/hackrfsweep/signalService.ts
```

### Check 4: Architectural Exemption Tags

```bash
# All 4 exempted files must have the @architectural-exemption tag
grep -rn "@architectural-exemption" src/lib/services/hackrfsweep/ --include="*.ts"
# EXPECTED: exactly 4 results
```

### Check 5: Type System Verification

```bash
npx tsc --noEmit
# EXPECTED: 0 errors
```

### Check 6: Build Verification

```bash
npm run build
# EXPECTED: build succeeds, no import resolution errors
```

### Check 7: Unit Test Verification

```bash
npm run test:unit
# EXPECTED: all tests pass
# NOTE: Services with new constructor signatures may require test fixture updates.
# If tests fail, check that test files pass the correct callbacks to service constructors.
```

### Check 8: Deleted File Verification

```bash
# Verify example/test files are gone
ls src/lib/services/websocket/example-usage.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS: deleted"
ls src/lib/services/websocket/test-connection.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS: deleted"
```

### Check 9: New Type File Verification

```bash
# Verify all 3 canonical type files exist
ls -la src/lib/types/signals.ts src/lib/types/drone.ts src/lib/types/map.ts
# EXPECTED: all 3 files exist

# Verify SignalMarker is exported from types/signals.ts
grep "export.*SignalMarker" src/lib/types/signals.ts
# EXPECTED: 1 result

# Verify FlightPoint, SignalCapture, AreaOfInterest are exported from types/drone.ts
grep "export.*FlightPoint\|export.*SignalCapture\|export.*AreaOfInterest" src/lib/types/drone.ts
# EXPECTED: 3 results

# Verify LeafletMap is exported from types/map.ts
grep "export.*LeafletMap" src/lib/types/map.ts
# EXPECTED: 1 result
```

### Check 10: Store Re-export Verification

```bash
# Verify store re-exports are in place (backward compatibility for components)
grep "export type.*from.*types/signals" src/lib/stores/map/signals.ts
# EXPECTED: 1 result (re-export of SignalMarker)

grep "export type.*from.*types/map" src/lib/stores/tactical-map/mapStore.ts
# EXPECTED: 1 result (re-export of LeafletMap)
```

### Check 11: HMR Stability Verification (Manual)

```bash
# Restart the dev server
npm run dev:clean

# After the server starts:
# 1. Open the application in a browser
# 2. Make a trivial code change to a component file
# 3. Verify HMR updates the browser without full page reload
# 4. Repeat for at least 3 change cycles
# 5. Verify no stale state from previous sessions appears
```

### Check 12: Svelte/Store Import in Server Files

```bash
# Verify no svelte/store imports remain in service files
# (these should have been removed along with get() calls)
grep -rn "from.*svelte/store" src/lib/services/ --include="*.ts"
# EXPECTED: 0 results
# NOTE: If results appear, they indicate a service still uses get() to read a store.
# This is a runtime violation that was missed and must be fixed using the getter
# injection pattern documented in Phase-5.3.4.
```

---

## Edge Case: Newly Discovered Violations

If the verification commands in Check 3 or Check 12 reveal violations not documented in the Phase 5.3 plan (e.g., `wigletotak/wigleService.ts`), resolve them using the same callback injection pattern:

1. Identify the store imports and mutation functions called.
2. Create a callback interface matching the mutation signatures.
3. Add a constructor parameter for the callbacks.
4. Replace store function calls with `this.callbacks.onXxx()` calls.
5. Update all instantiation sites in components.
6. Re-run the verification checklist.

```bash
# Discovery command for any missed violations
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "hackrfsweep"
# EXPECTED: 0 results after all fixes
```

---

## Completion Criteria

Phase 5.3 is complete when ALL of the following conditions are met:

| #   | Criterion                                                        | Verification Method |
| --- | ---------------------------------------------------------------- | ------------------- |
| 1   | Zero type-only imports from stores in service/server files       | Check 2             |
| 2   | Exactly 4 runtime store imports (all in hackrfsweep, all tagged) | Check 3 + Check 4   |
| 3   | Zero circular runtime dependencies                               | Check 1             |
| 4   | TypeScript compiles with 0 errors                                | Check 5             |
| 5   | Production build succeeds                                        | Check 6             |
| 6   | All unit tests pass                                              | Check 7             |
| 7   | Dead example/test files deleted                                  | Check 8             |
| 8   | Canonical type files exist with correct exports                  | Check 9             |
| 9   | Store re-exports preserve backward compatibility                 | Check 10            |
| 10  | HMR stability verified for 3+ cycles                             | Check 11            |
| 11  | No svelte/store imports remain in service files                  | Check 12            |

---

## Final State Metrics (To Be Filled at Completion)

| Metric                                  | Before Phase 5.3 | After Phase 5.3 | Delta  |
| --------------------------------------- | ---------------- | --------------- | ------ |
| Files importing stores (service/server) | 28               | \_\_\_          | \_\_\_ |
| Type-only store imports in services     | 15               | 0               | -15    |
| Runtime store violations (non-exempt)   | 7                | 0               | -7     |
| Store-action exemptions (documented)    | 0                | 4               | +4     |
| Dead example/test files                 | 2                | 0               | -2     |
| Canonical type definition files created | 0                | 3               | +3     |
| `import type` cycle false positives     | 1                | 1 (documented)  | 0      |

---

## Sign-Off

| Role                    | Name               | Date         | Signature    |
| ----------------------- | ------------------ | ------------ | ------------ |
| Implementing Engineer   | ******\_\_\_****** | **\_\_\_\_** | **\_\_\_\_** |
| Lead Software Architect | ******\_\_\_****** | **\_\_\_\_** | **\_\_\_\_** |
| QA/Verification         | ******\_\_\_****** | **\_\_\_\_** | **\_\_\_\_** |

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 15, BARR-C_
_Classification: UNCLASSIFIED // FOUO_
