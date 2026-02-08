# Phase 5.0.1 -- Pre-Execution Architecture Snapshot

```
Document ID:    ARGOS-AUDIT-P5.0.1-ARCHITECTURE-SNAPSHOT
Phase:          5 -- Architecture Decomposition and Structural Enforcement
Sub-Task:       5.0.1 -- Pre-Execution Baseline Capture
Risk Level:     LOW (assessment only, zero code changes)
Prerequisites:  Phase 4 (Type Safety & Dead Code Removal) COMPLETE
Files Touched:  0 (documentation only)
Standards:      MISRA C:2023 Rule 1.1, NASA/JPL Rule 2.4, Barr Group Rule 1.3
Classification: CUI // FOUO
Author:         Claude Opus 4.6 (Lead Audit Agent)
Date:           2026-02-08
```

---

## 1. Purpose

Capture the verified architectural baseline of the Argos codebase BEFORE any Phase 5 decomposition begins. This snapshot provides:

- Quantitative metrics for pre/post comparison
- Verified file counts and line counts at each threshold
- Function size distribution
- Known architectural violations requiring resolution
- Hardware and runtime environment constraints

This document is the single source of truth for measuring Phase 5 progress. All "before" metrics referenced by sub-task verification commands trace back to this snapshot.

---

## 2. Codebase Metrics Snapshot

### 2.1 File Size Distribution

Captured via `find src/ -name '*.ts' -o -name '*.svelte' -o -name '*.js' | xargs wc -l` on 2026-02-08.

| Threshold    | File Count | Aggregate LOC | Action Required                            |
| ------------ | ---------: | ------------: | ------------------------------------------ |
| >3,000 lines |          1 |         3,978 | Phase 5.1 (tactical-map-simple)            |
| 2,000--2,999 |          2 |         4,836 | Phase 5.1 (gsm-evil, rfsweep)              |
| 1,000--1,999 |          8 |       ~10,500 | Phase 5.1 (hackrfsweep) + Phase 5.4 Tier 1 |
| 500--999     |         23 |       ~15,264 | Phase 5.4 Tier 2                           |
| 300--499     |        ~55 |       ~20,800 | Phase 5.4 Tier 3                           |
| <300 lines   |  Remaining |            -- | Compliant (no action)                      |

**Total files >300 lines**: 108 (verified via `find + wc -l`, AC-1 in Phase 5.4.0)

### 2.2 God Pages

| File                             | Total Lines |    Script |  Template |     Style | Functions >60 LOC |
| -------------------------------- | ----------: | --------: | --------: | --------: | ----------------: |
| tactical-map-simple/+page.svelte |       3,978 |     2,166 |       506 |     1,306 |                 7 |
| gsm-evil/+page.svelte            |       2,591 |     1,324 |       296 |       971 |                 2 |
| rfsweep/+page.svelte             |       2,245 |       653 |       903 |       689 |                 3 |
| hackrfsweep/+page.svelte         |       1,830 |       452 |       862 |       516 |                 2 |
| **Totals**                       |  **10,644** | **4,595** | **2,567** | **3,482** |            **14** |

### 2.3 Function Size Distribution

Captured via multi-scanner reconciliation (AST parser + brace-depth tracker + ESLint diagnostics) on 2026-02-08. See Phase 5.5.0 for full methodology.

| Priority Tier | Line Range     |   Count | Treatment                                    |
| ------------- | -------------- | ------: | -------------------------------------------- |
| CRITICAL      | >150 lines     |     ~18 | Immediate decomposition (Phase 5.5.1--5.5.5) |
| HIGH          | 100--149 lines |     ~25 | Priority decomposition (Phase 5.5.6--5.5.8)  |
| STANDARD      | 61--99 lines   |    ~114 | Batch decomposition (Phase 5.5.9--5.5.12)    |
| **Total**     | **>60 lines**  | **157** |                                              |

### 2.4 Service Layer Duplication

| Component Pair  | HackRF File             | USRP File               | Similarity | Phase |
| --------------- | ----------------------- | ----------------------- | ---------- | ----- |
| API client      | api.ts (462 lines)      | usrp-api.ts (460 lines) | ~87%       | 5.2.1 |
| Buffer manager  | BufferManager.ts (503)  | BufferManager.ts (504)  | ~92%       | 5.2.2 |
| Process manager | ProcessManager.ts (413) | ProcessManager.ts (360) | ~85%       | 5.2.3 |
| Sweep manager   | sweepManager.ts (1,356) | sweepManager.ts (435)   | ~70%       | 5.2.4 |

### 2.5 Store-Service Boundary Violations

| Category                          | Count  | Treatment                | Phase        |
| --------------------------------- | ------ | ------------------------ | ------------ |
| Type-only imports (`import type`) | 15     | Migrate to `$lib/types/` | 5.3.2        |
| Runtime violations (fixable)      | 7      | Callback injection       | 5.3.3, 5.3.4 |
| Store-action exemptions (correct) | 4      | Document with JSDoc      | 5.3.5        |
| Dead example/test files           | 2      | Delete                   | 5.3.6        |
| **Total files importing stores**  | **28** |                          |              |

---

## 3. Runtime Environment

| Attribute      | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Hardware       | Raspberry Pi 5 Model B Rev 1.0                           |
| CPU            | 4x ARM Cortex-A76 @ 2.4 GHz                              |
| RAM            | 8 GB                                                     |
| Storage        | 500 GB NVMe SSD (Kingston SNV3S500G)                     |
| OS             | Kali Linux 2025.4 (aarch64), kernel 6.12.34+rpt-rpi-2712 |
| Node.js        | v22.x with --max-old-space-size=1024                     |
| Docker         | v27.5.1, argos-dev container (network_mode: host)        |
| SDR Hardware   | HackRF One (USB)                                         |
| OOM Protection | earlyoom (-m 10 -s 50), zram 4GB zstd                    |

### 3.1 Deployment Context

- Field-deployed for US Army EW training at NTC/JMRC
- Constrained 8GB RAM environment with OOM protection at 10% threshold
- Real-time RF data processing (HackRF spectrum sweeps, Kismet WiFi scanning)
- Memory pressure from V8 heap, WebSocket connections, SQLite operations
- Every kilobyte of unnecessary JavaScript affects field reliability

---

## 4. Phase 5 Scope Summary

| Sub-Phase         | Sub-Tasks | Primary Target          | Expected Outcome                           |
| ----------------- | --------: | ----------------------- | ------------------------------------------ |
| 5.1 God Pages     |        21 | 4 files, 10,644 lines   | Each page <350 lines via component wiring  |
| 5.2 Service Layer |         7 | 10 files, 5,311 lines   | Abstract base classes, zero duplication    |
| 5.3 Store-Service |         8 | 28 import violations    | Clean dependency graph, callback injection |
| 5.4 File Size     |        14 | 85 files >300 lines     | All files <500 lines (300 target)          |
| 5.5 Function Size |        15 | 157 functions >60 lines | All functions <60 lines                    |
| 5.6 ESLint Gates  |         9 | 3 config files          | Automated enforcement, zero regression     |
| **Total**         |    **74** |                         |                                            |

---

## 5. Cross-Phase Deductions (Pre-Verified)

Files excluded from Phase 5.4/5.5 scope because they are handled by earlier sub-phases:

| Excluded By               |  Files |      Lines | Reason                          |
| ------------------------- | -----: | ---------: | ------------------------------- |
| Phase 5.1 (God Pages)     |      4 |     10,644 | Full decomposition in 5.1       |
| Phase 5.2 (Service Layer) |     10 |      5,311 | Merged/deduplicated in 5.2      |
| Phase 4 (Dead Code)       |      6 |      2,164 | Deleted (zero importers)        |
| Phase 5.4.4 Deferred      |      5 |      1,691 | Pending Phase 5.1 re-evaluation |
| **Total excluded**        | **25** | **19,810** |                                 |

---

## 6. Success Criteria

Phase 5 is COMPLETE when ALL of the following conditions are met:

| #   | Criterion                                              | Verification Command                                                                                         |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | All 4 god pages <350 lines each                        | `wc -l src/routes/{tactical-map-simple,gsm-evil,rfsweep,hackrfsweep}/+page.svelte`                           |
| 2   | Zero duplicate service class definitions               | `grep -r "class.*Manager" src/lib/services/hackrf/ src/lib/services/usrp/`                                   |
| 3   | Store imports in services limited to 4 exemptions      | `grep -rn "from.*stores" src/lib/services/ --include="*.ts" \| grep -v "import type" \| grep -v hackrfsweep` |
| 4   | Zero files >500 lines (excl. documented exceptions)    | `find src/ -name '*.ts' -o -name '*.svelte' \| xargs wc -l \| awk '$1>500'`                                  |
| 5   | Zero functions >60 lines (excl. documented exceptions) | AST scanner or `npm run lint` with max-lines-per-function                                                    |
| 6   | ESLint size rules configured and passing               | `npm run lint` exits 0                                                                                       |
| 7   | Pre-commit hook blocks oversized files                 | Attempt to commit a 501-line file; verify rejection                                                          |
| 8   | TypeScript compilation clean                           | `npx tsc --noEmit` exits 0                                                                                   |
| 9   | Production build succeeds                              | `npm run build` exits 0                                                                                      |

---

## 7. Baseline Verification Commands

Run these commands at the start of Phase 5 execution to confirm the snapshot values:

```bash
# God page line counts
wc -l src/routes/tactical-map-simple/+page.svelte \
      src/routes/gsm-evil/+page.svelte \
      src/routes/rfsweep/+page.svelte \
      src/routes/hackrfsweep/+page.svelte

# Files >300 lines count
find src/ \( -name '*.ts' -o -name '*.svelte' -o -name '*.js' \) \
  -exec wc -l {} + | awk '$1 >= 300 && !/total/' | wc -l

# Store-service boundary violations
grep -rn "from.*stores" src/lib/services/ src/lib/server/ --include="*.ts" \
  | cut -d: -f1 | sort -u | wc -l

# TypeScript compilation baseline
npx tsc --noEmit 2>&1 | tail -5

# ESLint baseline (expect no size rules)
npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 | grep -c "max-lines"
# Expected: 0
```

---

## 8. Standards Compliance

| Standard             | Rule                     | Baseline Status                                     |
| -------------------- | ------------------------ | --------------------------------------------------- |
| NASA/JPL Rule 2.4    | Functions <60 lines      | 157 VIOLATIONS (to be resolved in Phase 5.5)        |
| Barr Group Rule 1.3  | Files <500 lines         | ~30 VIOLATIONS (to be resolved in Phase 5.4)        |
| MISRA C:2023 Dir 4.4 | No commented-out code    | Addressed in Phase 3; verified clean                |
| NASA/JPL Rule 15     | No circular dependencies | 0 runtime circular deps; type-only cycles exempt    |
| NASA/JPL Rule 31     | Static analysis enforced | NO size rules configured (to be added in Phase 5.6) |

---

## 9. Rollback Strategy

This document is assessment-only. No code changes are made. If baseline values are found to be inaccurate at execution time, update the relevant sections and re-verify before proceeding with any Phase 5 code modifications.

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.0.1 -- Pre-Execution Architecture Snapshot
Verified against codebase at commit f300b8f (main, 2026-02-08)
```
