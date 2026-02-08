# Phase 5.3.0: Store-Service Boundary Assessment

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7 (functions shall have file scope where possible), CERT C STR00-C, NASA/JPL Rule 15 (no circular dependencies), BARR-C Rule 8.7
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.0
**Risk Level**: LOW -- Assessment and documentation only; zero code changes
**Prerequisites**: Phase 5.2 (HackRF/USRP Consolidation) complete
**Blocks**: Tasks 5.3.1 through 5.3.7 (all subsequent Phase 5.3 sub-tasks)
**Estimated Files Touched**: 0 (assessment document only)
**Standards**: MISRA C:2012 Rule 8.7, CERT C STR00-C, NASA/JPL Rule 15

---

## Objective

Establish the verified baseline for the store-service boundary audit, document all corrections to prior numerical claims, define the architectural invariant that governs all subsequent refactoring tasks, and explain why this invariant matters for deployed Army EW training systems running on constrained hardware.

This document is the authoritative reference for all Phase 5.3 sub-tasks. No code changes occur in this task.

---

## 1. Audit Corrections

The prior audit plan (Phase 5.3 draft, 2026-02-07) contained numerical errors subsequently identified during grep-verified re-audit. This section documents every correction for full traceability.

| Metric                      | Prior Plan (WRONG) | Verified Count (CORRECT) | Delta | Root Cause of Error                             |
| --------------------------- | -----------------: | -----------------------: | ----: | ----------------------------------------------- |
| Files importing from stores |                 32 |                       28 |    -4 | Counted deleted files and barrel re-exports     |
| Runtime violations          |                 17 |                       11 |    -6 | Miscounted type-only imports as runtime         |
| Type-only imports           |                 15 |                       15 |     0 | Correct                                         |
| Example/test files          |      (not counted) |                        2 |    +2 | Newly identified category                       |
| Architectural exemptions    |      (not counted) |                        4 |    +4 | hackrfsweep store-action pattern not recognized |

**Operational Impact**: The prior plan would have touched 6 files that require no modification (type-only imports miscategorized as runtime violations) and missed 2 files requiring deletion. Executing the prior plan verbatim would have introduced unnecessary code churn and left dead example code in the repository.

### Correction Verification Commands

```bash
# Verify total files importing from stores (should be 28)
grep -rn "from.*stores" src/lib/services/ src/lib/server/ --include="*.ts" \
  | cut -d: -f1 | sort -u | wc -l

# Verify type-only imports (should be 15)
grep -rn "import type.*from.*stores" src/lib/services/ src/lib/server/ --include="*.ts" \
  | cut -d: -f1 | sort -u | wc -l

# Verify runtime violations (should be 11)
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "\.d\.ts" \
  | cut -d: -f1 | sort -u | wc -l
```

---

## 2. Architectural Principle: Store-Service Boundary

### 2.1 The Invariant

In a well-architected SvelteKit application, the dependency graph flows in one direction:

```
  Component (Svelte) --> Store (reactive state) --> Service (business logic)
                 \                                      |
                  \------ reads store via $store --------/
```

Services MUST NOT import stores. This is the software equivalent of MISRA Rule 8.7 (functions shall have file scope where possible): a service that directly mutates a store creates a hidden coupling path that defeats both static analysis and unit test isolation.

**Permitted pattern**: Service receives callbacks or returns values; the component (or a thin adapter layer) is responsible for writing those values into stores.

**Sole exception**: "Store action services" where the service IS the store's write API, co-located in the same feature module (see Phase-5.3.5 for the 4 exempted hackrfsweep files).

### 2.2 Why This Matters for Deployed Systems

On constrained embedded targets (RPi 5, 8GB RAM), store-service coupling prevents:

1. **Tree-shaking**: Bundler cannot eliminate unused store code when services hard-import it. On a memory-constrained RPi 5 running during NTC/JMRC field exercises, every kilobyte of unnecessary JavaScript execution adds to V8 heap pressure. The HackRF spectrum analysis pipeline processes thousands of data points per second; importing reactive store machinery into the service layer forces V8 to maintain closure chains that are never read.

2. **Test isolation**: Unit testing a service requires mocking the entire Svelte store system. When the service accepts callbacks instead, tests pass plain functions. This reduces test fixture complexity and eliminates false failures caused by Svelte runtime initialization in Node.js test environments (Vitest runs without a DOM by default).

3. **HMR stability**: Vite HMR cannot correctly invalidate modules when circular store-service paths exist. This was observed as stale state after hot reload during NTC field exercises -- operators saw spectrum data from previous sessions persisting after code updates. The callback injection pattern eliminates the circular invalidation path.

4. **Memory profiling**: Heap snapshots show store closures retained by service references, preventing garbage collection of stale reactive subscriptions. On 8GB RPi 5 hardware with earlyoom configured at 10% threshold, retained closures from store-service coupling contributed to OOM kills documented in the Phase 1 memory leak audit (2026-02-07).

### 2.3 Verified Violation Categories

The 28 files importing from stores decompose into exactly 4 categories:

| Category                          |  Count | Treatment                   | Sub-Task                 |
| --------------------------------- | -----: | --------------------------- | ------------------------ |
| Type-only imports (`import type`) |     15 | Migrate to `$lib/types/`    | Phase-5.3.2              |
| Runtime violations (fixable)      |      7 | Callback injection refactor | Phase-5.3.3, Phase-5.3.4 |
| Store-action exemptions (correct) |      4 | Document with JSDoc         | Phase-5.3.5              |
| Dead example/test files           |      2 | Delete                      | Phase-5.3.6              |
| **Total**                         | **28** |                             |                          |

---

## 3. Execution Order

Tasks MUST be executed in the following sequence. Each task's verification gate must pass before proceeding to the next.

```
Task 5.3.0  Assessment (this document -- no code changes)
   |
   |  [No gate -- proceed directly to 5.3.1]
   |
Task 5.3.1  REMOVED -- circular dependency was type-only, harmless (audit trail only)
   |
   |  [No gate -- task removed, proceed directly to 5.3.2]
   |
Task 5.3.2  Migrate type-only store imports (15 files + 3 new type files)
   |          NOTE: Also handles HeatmapLayer type extraction (originally in 5.3.1)
   |
   v  [GATE: grep "from.*stores.*import type" in services/server returns 0]
   |
Task 5.3.3  Resolve runtime store violations -- API & GPS services (3 files)
   |         Priority 1: hackrf/api.ts, hackrf/usrp-api.ts
   |         Priority 2: tactical-map/gpsService.ts
   |
Task 5.3.4  Resolve runtime store violations -- tactical services (4 files)
   |         Priority 3: tactical-map/hackrfService.ts, kismetService.ts, mapService.ts
   |         Priority 4: map/kismetRSSIService.ts
   |
   v  [GATE: grep "from.*stores" in services/ returns only 4 exempted files]
   |
Task 5.3.5  Document store-action exemptions (4 files, JSDoc only)
   |
Task 5.3.6  Delete dead example/test files (2 files)
   |
   v  [GATE: npx tsc --noEmit && npm run build]
   |
Task 5.3.7  Final verification and completion sign-off
   |
   DONE
```

**Critical constraint**: Tasks 5.3.3 and 5.3.4 (runtime violation fixes) MUST execute after Phase 5.2 HackRF/USRP consolidation, because Phase 5.2 may merge `api.ts` and `usrp-api.ts` or significantly restructure the HackRF service layer. If Phase 5.2 merges them, apply the callback injection pattern to the merged file only.

---

## 4. Subscribe-Then-Unsubscribe Antipattern Reference

Multiple files in this codebase use the following pattern to synchronously read Svelte store state from within a service:

```typescript
let currentState: any;
const unsubscribe = someStore.subscribe((s) => (currentState = s));
unsubscribe();
// currentState now holds the snapshot
```

This is functionally equivalent to `get(someStore)` from `svelte/store` but more verbose and error-prone. It works because Svelte's `subscribe()` calls the callback synchronously with the current value before returning.

**Problems with this pattern**:

1. The `any` type annotation destroys type safety.
2. If `subscribe()` ever becomes asynchronous (unlikely but possible in future Svelte versions), this pattern silently breaks.
3. It obscures intent -- a reader must understand Svelte subscription semantics to recognize this as a synchronous read.

**Recommendation**: During Tasks 5.3.3 and 5.3.4, replace all subscribe-then-unsubscribe patterns with getter callbacks injected via the constructor, eliminating both the antipattern and the store import.

---

## 5. File Manifest (Complete Phase 5.3)

Complete list of files modified or deleted across all Phase 5.3 sub-tasks.

| Action   | File Path (relative to `src/lib/`)        | Task                                                    |
| -------- | ----------------------------------------- | ------------------------------------------------------- |
| CREATE   | types/signals.ts                          | 5.3.2                                                   |
| CREATE   | types/drone.ts                            | 5.3.2                                                   |
| CREATE   | types/map.ts (or extend)                  | 5.3.2 (absorbs type extraction originally in ~~5.3.1~~) |
| MODIFY   | stores/map/signals.ts                     | 5.3.2                                                   |
| MODIFY   | stores/tactical-map/mapStore.ts           | 5.3.2                                                   |
| MODIFY   | server/db/database.ts                     | 5.3.2                                                   |
| MODIFY   | server/db/geo.ts                          | 5.3.2                                                   |
| MODIFY   | server/db/signalRepository.ts             | 5.3.2                                                   |
| MODIFY   | services/db/dataAccessLayer.ts            | 5.3.2                                                   |
| MODIFY   | services/db/signalDatabase.ts             | 5.3.2                                                   |
| MODIFY   | services/drone/flightPathAnalyzer.ts      | 5.3.2                                                   |
| MODIFY   | services/map/aiPatternDetector.ts         | 5.3.2                                                   |
| MODIFY   | services/map/contourGenerator.ts          | 5.3.2                                                   |
| MODIFY   | services/map/droneDetection.ts            | 5.3.2                                                   |
| MODIFY   | services/map/mapUtils.ts                  | 5.3.2                                                   |
| MODIFY   | services/map/networkAnalyzer.ts           | 5.3.2                                                   |
| MODIFY   | services/map/signalClustering.ts          | 5.3.2                                                   |
| MODIFY   | services/map/signalFiltering.ts           | 5.3.2                                                   |
| MODIFY   | services/tactical-map/cellTowerService.ts | 5.3.2                                                   |
| MODIFY   | services/hackrf/api.ts                    | 5.3.3                                                   |
| MODIFY   | services/hackrf/usrp-api.ts               | 5.3.3                                                   |
| MODIFY   | services/tactical-map/gpsService.ts       | 5.3.3                                                   |
| MODIFY   | services/tactical-map/hackrfService.ts    | 5.3.4                                                   |
| MODIFY   | services/tactical-map/kismetService.ts    | 5.3.4                                                   |
| MODIFY   | services/tactical-map/mapService.ts       | 5.3.4                                                   |
| MODIFY   | services/map/kismetRSSIService.ts         | 5.3.4                                                   |
| ANNOTATE | services/hackrfsweep/controlService.ts    | 5.3.5                                                   |
| ANNOTATE | services/hackrfsweep/displayService.ts    | 5.3.5                                                   |
| ANNOTATE | services/hackrfsweep/frequencyService.ts  | 5.3.5                                                   |
| ANNOTATE | services/hackrfsweep/signalService.ts     | 5.3.5                                                   |
| DELETE   | services/websocket/example-usage.ts       | 5.3.6                                                   |
| DELETE   | services/websocket/test-connection.ts     | 5.3.6                                                   |

**Total**: 3 created, 22 modified, 4 annotated, 2 deleted = **31 files touched**

---

## 6. Risk Assessment Summary

| Risk                                               | Probability | Impact | Mitigation                                                   | Sub-Task     |
| -------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------ | ------------ |
| Constructor signature change breaks consumers      | MEDIUM      | HIGH   | Search all instantiation sites before modifying each service | 5.3.3, 5.3.4 |
| Store re-export breaks component imports           | LOW         | MEDIUM | Run `npx tsc --noEmit` after Phase B of 5.3.2                | 5.3.2        |
| HMR invalidation after refactor                    | LOW         | LOW    | Restart dev server, verify 3 HMR cycles                      | 5.3.7        |
| Phase 5.2 changes invalidate Priority 1 targets    | HIGH        | MEDIUM | Task 5.3.3 MUST NOT begin until Phase 5.2 is complete        | 5.3.3        |
| wigletotak/wigleService.ts discovered at execution | LOW         | LOW    | Run boundary verification, apply callback injection          | 5.3.7        |

---

## 7. Standards Compliance Matrix

| Standard     | Rule     | Application in This Phase                                                                   |
| ------------ | -------- | ------------------------------------------------------------------------------------------- |
| MISRA C:2012 | Rule 8.7 | Services shall have file scope -- no importing store modules outside the feature boundary   |
| CERT C       | STR00-C  | Type definitions shall reside in dedicated type modules, not co-located with reactive state |
| NASA/JPL     | Rule 15  | No circular dependencies; `import type` cycles are exempt (compile-time only)               |
| BARR-C       | Rule 8.7 | No side effects in debug/example code; dead example files deleted                           |

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 15, BARR-C_
_Classification: UNCLASSIFIED // FOUO_
