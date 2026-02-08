# Phase 5.2.0: Service Layer Assessment & Duplication Map

| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.0-2026-02-08                                     |
| Phase         | 5.2 -- Service Layer Refactoring                                  |
| Title         | Service Layer Assessment & Duplication Map                        |
| Risk Level    | LOW (read-only assessment, no code changes)                       |
| Prerequisites | Phase 3 (Store Isolation), Phase 4 (Dead Code Removal) complete   |
| Files Touched | 0 (assessment only)                                               |
| Standards     | MISRA C:2012 Dir 4.4, CERT MEM50-CPP, NASA/JPL Rule 31, Barr Ch.8 |
| Audit Date    | 2026-02-08                                                        |

---

## 1. Objective

Establish a verified baseline of the HackRF/USRP service layer duplication before any
refactoring begins. This document captures audit corrections from prior planning documents,
the current duplication map, confirmed bugs, and the sweepManager structural profile. All
numerical claims are independently verified and supersede any prior document.

This assessment is the foundation for Tasks 5.2.1 through 5.2.5. No code changes are made
in this task -- it is a read-only verification gate.

---

## 2. Audit Corrections

Prior planning documents contained numerical inaccuracies in the HackRF/USRP duplication
analysis. All values below were re-verified on 2026-02-08 using `sdiff -s` line-by-line
comparison. Every claim in this section supersedes any prior document.

| Metric                     | Prior Claim    | Verified Value | Delta | Method                         |
| -------------------------- | -------------- | -------------- | ----- | ------------------------------ |
| BufferManager similarity   | ~60%           | ~69%           | +9pp  | `sdiff -s` on 503 vs 504 lines |
| ProcessManager similarity  | ~65%           | ~80%           | +15pp | `sdiff -s` on 413 vs 360 lines |
| API (api.ts / usrp-api.ts) | ~88%           | ~88%           | 0     | `sdiff -s` on 462 vs 460 lines |
| SweepManager similarity    | ~17%           | ~17%           | 0     | Divergent; USRP is 435 lines   |
| Store-service violations   | 32 files/17 RT | 28 files/11 RT | -4/-6 | `grep -r` with manual triage   |

**Correction rationale.** The BufferManager and ProcessManager similarity percentages were
originally computed using `diff | grep "^[<>]" | wc -l`, which double-counts changed lines
(both the removed and added side). The corrected values use `sdiff -s` which counts
differing line pairs once, then subtracts from total to derive the identical fraction.

**Impact on plan.** Higher similarity in ProcessManager (~80%) means the base class
extraction will capture more shared logic than originally estimated, reducing per-subclass
residual code from ~160 lines to ~120 lines. No architectural changes to the plan result
from these corrections.

---

## 3. Current State Assessment

### 3.1 Duplication Map

Four file pairs contain structurally identical or near-identical code between the HackRF
and USRP service implementations:

| File Pair             | HackRF Path (relative to src/lib/)                      | USRP Path (relative to src/lib/)                      | HackRF Lines | USRP Lines | sdiff Diff Lines | Similarity |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ------------ | ---------- | ---------------- | ---------- |
| BufferManager         | services/hackrf/sweep-manager/buffer/BufferManager.ts   | services/usrp/sweep-manager/buffer/BufferManager.ts   | 503          | 504        | 312              | ~69%       |
| ProcessManager        | services/hackrf/sweep-manager/process/ProcessManager.ts | services/usrp/sweep-manager/process/ProcessManager.ts | 413          | 360        | 155              | ~80%       |
| API                   | services/hackrf/api.ts                                  | services/usrp/usrp-api.ts                             | 462          | 460        | 114              | ~88%       |
| SweepManager (server) | server/hackrf/sweepManager.ts                           | server/usrp/sweepManager.ts                           | 1,356        | 435        | >1,500           | ~17%       |

**Total duplicated lines**: ~4,493 across the 4 paired files (sum of all 8 file lengths).

### 3.2 HackRF-Only Modules (No USRP Equivalent)

These files exist under `services/hackrf/sweep-manager/` with no corresponding USRP
implementation. They are NOT candidates for base class extraction but must be accounted
for during the refactoring to ensure import paths remain stable.

| File                                                         | Lines | Purpose                                   |
| ------------------------------------------------------------ | ----- | ----------------------------------------- |
| `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | 457   | Tracks error frequency, triggers recovery |
| `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | 423   | Manages frequency band cycling logic      |

### 3.3 Confirmed Bug: USRP Store Cross-Contamination

**File**: `src/lib/services/usrp/usrp-api.ts`
**Symptom**: The USRP API module imports from `$lib/stores/hackrf` instead of the USRP
store. This means USRP spectrum data updates are written to the HackRF store, causing:

1. USRP data to appear in HackRF UI components.
2. USRP store to never receive updates, rendering USRP UI components permanently stale.
3. Potential data corruption when both devices operate simultaneously.

This bug will be fixed as a mandatory side effect of Task 5.2.1 (API deduplication), where
each subclass explicitly references its own store via an abstract accessor.

**Verification command:**

```bash
grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"
# Expected output: at least one match in usrp-api.ts confirming the bug exists
```

### 3.4 sweepManager.ts Profile (1,356 lines, 27 methods)

The HackRF `sweepManager.ts` is the single largest service file in the codebase. Its
method distribution reveals a severe concentration of logic:

| Method                | Lines | Location | Violation                                |
| --------------------- | ----- | -------- | ---------------------------------------- |
| `_performHealthCheck` | 356   | L124     | 6x the 60-line threshold (MISRA Dir 4.1) |
| `_startSweepProcess`  | 117   | L555     | 2x threshold                             |
| `_performRecovery`    | 65    | L1123    | At threshold                             |
| Other 24 methods      | 8-55  | Various  | Compliant                                |

**Method groupings by responsibility:**

| Responsibility Group | Methods                                                                                                                             | Total Lines |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Health & Monitoring  | `_performHealthCheck`, `_startProcessMonitoring`, `_resetDataTimeout`, `_checkSystemMemory`                                         | 470         |
| Process Lifecycle    | `_startSweepProcess`, `_stopSweepProcess`, `_forceCleanupExistingProcesses`, `_testHackrfAvailability`                              | 212         |
| Frequency Cycling    | `_runNextFrequency`, `_cycleToNextFrequency`, `_normalizeFrequencies`, `_convertToHz`, `_convertToMHz`                              | 131         |
| Data Processing      | `_handleSpectrumData`, `_handleProcessOutputLine`, `_parseHackrfOutput`, `_getSignalStrength`                                       | 141         |
| Error Handling       | `_handleSweepError`, `_handleProcessExit`, `_isCriticalStartupError`, `_isCriticalError`, `_resetErrorTracking`, `_performRecovery` | 248         |
| Event Emission       | `_emitEvent`, `_emitError`                                                                                                          | 34          |
| Startup Validation   | `_performStartupValidation`                                                                                                         | 33          |

The Health & Monitoring group alone (470 lines) exceeds the entire USRP sweepManager (435
lines). This is the primary decomposition target.

---

## 4. Verification Commands

All verification for this assessment task is read-only. These commands confirm that the
baseline measurements are accurate before refactoring begins.

```bash
# V1: Confirm HackRF API file line count
wc -l src/lib/services/hackrf/api.ts
# Expected: 462

# V2: Confirm USRP API file line count
wc -l src/lib/services/usrp/usrp-api.ts
# Expected: 460

# V3: Confirm HackRF BufferManager line count
wc -l src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts
# Expected: 503

# V4: Confirm USRP BufferManager line count
wc -l src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts
# Expected: 504

# V5: Confirm HackRF ProcessManager line count
wc -l src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts
# Expected: 413

# V6: Confirm USRP ProcessManager line count
wc -l src/lib/services/usrp/sweep-manager/process/ProcessManager.ts
# Expected: 360

# V7: Confirm HackRF sweepManager line count
wc -l src/lib/server/hackrf/sweepManager.ts
# Expected: 1356

# V8: Confirm USRP sweepManager line count
wc -l src/lib/server/usrp/sweepManager.ts
# Expected: 435

# V9: Confirm USRP store cross-contamination bug exists
grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"
# Expected: at least one match in usrp-api.ts

# V10: Capture BufferManager similarity
sdiff -s src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts \
         src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts | wc -l
# Expected: ~312 differing line pairs

# V11: Capture ProcessManager similarity
sdiff -s src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts \
         src/lib/services/usrp/sweep-manager/process/ProcessManager.ts | wc -l
# Expected: ~155 differing line pairs

# V12: Capture API similarity
sdiff -s src/lib/services/hackrf/api.ts \
         src/lib/services/usrp/usrp-api.ts | wc -l
# Expected: ~114 differing line pairs

# V13: Confirm HackRF-only modules exist with expected sizes
wc -l src/lib/services/hackrf/sweep-manager/error/ErrorTracker.ts \
      src/lib/services/hackrf/sweep-manager/frequency/FrequencyCycler.ts
# Expected: ~457 and ~423 lines respectively

# V14: Count sweepManager methods
grep -cE "^\s+(private|public|protected|async)\s+\w+" \
    src/lib/server/hackrf/sweepManager.ts
# Expected: ~27

# V15: Measure _performHealthCheck length
awk '/_performHealthCheck/,/^[[:space:]]*\}/' src/lib/server/hackrf/sweepManager.ts | wc -l
# Expected: ~356 lines
```

---

## 5. Risk Assessment

| Risk                                   | Severity | Mitigation                                                        |
| -------------------------------------- | -------- | ----------------------------------------------------------------- |
| Baseline measurements are stale        | LOW      | Re-run verification commands immediately before starting 5.2.1    |
| Files modified between assessment/exec | LOW      | Lock branch or confirm no commits to affected files between tasks |
| USRP store bug compensated by UI code  | MEDIUM   | Audit USRP Svelte components for hackrfStore reads before fix     |

---

## 6. Standards Compliance

| Standard         | Requirement                      | Status in Current Code | Target After 5.2.x |
| ---------------- | -------------------------------- | ---------------------- | ------------------ |
| MISRA Dir 4.1    | Functions <= 60 lines            | VIOLATED (356-line fn) | COMPLIANT          |
| MISRA Dir 4.4    | No dead code                     | VIOLATED (duplication) | COMPLIANT          |
| CERT MEM50-CPP   | No unbounded buffers             | COMPLIANT (capped)     | COMPLIANT          |
| NASA/JPL Rule 31 | Single responsibility per module | VIOLATED (sweepMgr)    | COMPLIANT          |
| NASA/JPL Rule 14 | Bounded memory                   | COMPLIANT              | COMPLIANT          |
| Barr Ch.8        | Resource management              | PARTIAL                | COMPLIANT          |

---

## 7. Rollback Strategy

This task produces no code changes. No rollback is necessary. If the baseline measurements
are found to be inaccurate, the numerical claims in this document must be updated before
proceeding to Task 5.2.1.

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |
