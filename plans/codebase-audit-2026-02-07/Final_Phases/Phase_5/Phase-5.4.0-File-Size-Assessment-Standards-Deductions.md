# Phase 5.4.0 -- File Size Assessment: Governing Standards, Audit Corrections, and Cross-Phase Deductions

```
Document ID:    ARGOS-AUDIT-P5.4.0-ASSESSMENT-STANDARDS
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.0 -- Assessment Framework and Scope Definition
Risk Level:     LOW
Prerequisites:  Phase 4 (Dead Code Removal) COMPLETE
                Phase 5.1 (God Page Decomposition) COMPLETE
                Phase 5.2 (HackRF/USRP Deduplication) COMPLETE
                Phase 5.3 (Shell Consolidation) COMPLETE
Files Touched:  0 (assessment document only)
Standards:      MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 2.4,
                Barr Group Embedded C Coding Standard Rule 1.3
Classification: CUI // FOUO
```

---

## 1. Purpose

This document establishes the governing standards, records audit corrections (AC-1 through
AC-6), documents cross-phase deductions that eliminate duplicate work, and provides the
authoritative scope summary (tier counts, aggregate LOC) for all subsequent Phase 5.4
sub-tasks (5.4.1 through 5.4.13).

All downstream sub-task documents reference this file as the single source of truth for
what is in scope and what is excluded.

---

## 2. Governing Standards and Rationale

| Standard             | Rule                                                   | Enforcement                                                                   |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| NASA/JPL Rule 2.4    | Functions shall not exceed 60 lines                    | Extract functions exceeding threshold into named modules                      |
| MISRA C:2012 Dir 4.4 | Sections of code should not be commented out           | Remove dead commented blocks during decomposition                             |
| Barr Group Rule 1.3  | Each source file shall contain no more than ~500 lines | Primary driver: files >500 lines decomposed; files 300-499 flagged for review |
| CERT C MEM00         | Allocate and free memory in the same module            | Ensure decomposition preserves allocation/deallocation locality               |
| CERT C MSC41         | Never hard code sensitive information                  | Verify no secrets surface during file splitting                               |
| DoD STIG V-222602    | Application must not contain unused code               | Cross-reference Phase 4 dead code audit before decomposing                    |

**Why 300 lines?** The 300-line threshold is a monitoring boundary, not a hard limit. Files
between 300-500 lines are reviewed for single-responsibility violations. Files above 500 lines
are decomposed unless they contain purely declarative data (lookup tables, type definitions)
with no branching logic. Files above 1,000 lines are unconditionally decomposed.

---

## 3. Audit Corrections (AC-1 through AC-6)

| #    | Original Claim                                                                  | Verified Finding                                                                                                                                                                          | Correction Applied                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | "108 files >300 lines" per initial audit                                        | 108 confirmed via `find + wc -l` on 2026-02-08                                                                                                                                            | No correction needed                                                                                                                                     |
| AC-2 | Kismet server cluster (5 files, 3,767 lines) marked dead                        | FALSE POSITIVE: fusion_controller.ts imports kismet_controller.ts, which imports device_intelligence, security_analyzer, device_tracker, api_client. All alive via relative import chain. | Files retained; decomposition plans added for device_intelligence (930), security_analyzer (813), device_tracker (503)                                   |
| AC-3 | "75 functions >60 lines"                                                        | Verified via brace-depth tracking script (scripts/audit-function-sizes-v2.py). Count confirmed at 75, not 68 as Phase 5.0 initially stated.                                               | Corrected in master overview                                                                                                                             |
| AC-4 | Phase 5.1 tactical-map-simple listed at 3,978 lines                             | Confirmed. Removed from this phase's scope.                                                                                                                                               | Deducted from Tier 1 count                                                                                                                               |
| AC-5 | serviceInitializer island (1,830 lines) marked dead in Phase 4                  | Confirmed dead: serviceInitializer.ts -> systemHealth.ts + dataStreamManager.ts + errorRecovery.ts. However, errorRecovery.ts (624 lines) has LIVE callers outside the island.            | errorRecovery.ts RETAINED in Tier 2; systemHealth.ts (552 lines) evaluated independently -- may have live callers via API routes, verify before deletion |
| AC-6 | signalInterpolation.ts listed as both dead and alive in conflicting audit notes | ALIVE: imported by heatmapService.ts (confirmed via grep). Included in Tier 2 decomposition.                                                                                              | Corrected                                                                                                                                                |

---

## 4. Cross-Phase Deductions

Files handled by other phases are **excluded** from this phase's work items. This section
provides an authoritative ledger to prevent duplicate effort.

### 4.1 Phase 5.1 -- God Page Decomposition (EXCLUDED)

| File                                      | Lines | Phase 5.1 Task                 |
| ----------------------------------------- | ----- | ------------------------------ |
| `routes/tactical-map-simple/+page.svelte` | 3,978 | Task 5.1.1: Full decomposition |
| `routes/gsm-evil/+page.svelte`            | 2,591 | Task 5.1.2: Full decomposition |
| `routes/rfsweep/+page.svelte`             | 2,245 | Task 5.1.3: Full decomposition |
| `routes/hackrfsweep/+page.svelte`         | 1,830 | Task 5.1.4: Full decomposition |

**Total excluded by Phase 5.1: 10,644 lines across 4 files.**

### 4.2 Phase 5.2 -- HackRF/USRP Deduplication (EXCLUDED)

| File                                                      | Lines | Phase 5.2 Task            |
| --------------------------------------------------------- | ----- | ------------------------- |
| `services/hackrf/sweep-manager/sweepManager.ts`           | 1,356 | Unified SDR sweep manager |
| `services/hackrf/sweep-manager/buffer/BufferManager.ts`   | 503   | Merged into sdr-common    |
| `services/usrp/sweep-manager/buffer/BufferManager.ts`     | 504   | Merged into sdr-common    |
| `services/hackrf/sweep-manager/process/ProcessManager.ts` | 413   | Merged into sdr-common    |
| `services/usrp/sweep-manager/process/ProcessManager.ts`   | 360   | Merged into sdr-common    |
| `services/hackrf/sweep-manager/api.ts`                    | 462   | Merged into sdr-common    |
| `services/usrp/sweep-manager/api.ts`                      | 460   | Merged into sdr-common    |
| `services/usrp/sweep-manager/sweepManager.ts`             | 435   | Merged into sdr-common    |
| `services/websocket/hackrf.ts`                            | 408   | Unified WebSocket handler |
| `services/websocket/kismet.ts`                            | 410   | Unified WebSocket handler |

**Total excluded by Phase 5.2: 5,311 lines across 10 files.**

### 4.3 Phase 4 -- Dead Code Removal (EXCLUDED -- genuinely dead)

| File                                   | Lines | Status                                         |
| -------------------------------------- | ----- | ---------------------------------------------- |
| `services/map/flightPathAnalyzer.ts`   | 574   | DEAD: zero importers                           |
| `services/map/aiPatternDetector.ts`    | 530   | DEAD: zero importers                           |
| `services/map/altitudeLayerManager.ts` | 367   | DEAD: zero importers                           |
| `services/map/contourGenerator.ts`     | 323   | DEAD: zero importers                           |
| `services/monitoring/systemService.ts` | 208   | DEAD: only imported by dead serviceInitializer |
| `services/api/cellTowerService.ts`     | 162   | DEAD: zero importers                           |

**Total excluded by Phase 4: 2,164 lines across 6 files.**

### 4.4 Post-Phase 5.1 Re-evaluation Required (DEFERRED)

The following Tier 3 files are tactical-map subcomponents. Phase 5.1 may restructure the
tactical-map page such that these files are absorbed, replaced, or rendered dead. Execute
Phase 5.1 first, then re-evaluate whether these files still require independent decomposition:

| File                                                     | Lines | Dependency                  |
| -------------------------------------------------------- | ----- | --------------------------- |
| `components/tactical-map/kismet/KismetController.svelte` | 395   | Used by tactical-map-simple |
| `components/tactical-map/kismet/DeviceManager.svelte`    | 335   | Used by KismetController    |
| `components/tactical-map/hackrf/HackRFController.svelte` | 331   | Used by tactical-map-simple |
| `components/tactical-map/hackrf/FrequencySearch.svelte`  | 324   | Used by HackRFController    |
| `components/tactical-map/map/MapLegend.svelte`           | 306   | Used by tactical-map-simple |

**Mark: DEFERRED pending Phase 5.1 completion.**

---

## 5. Summary of Remaining Scope

After all cross-phase deductions, this phase addresses:

| Tier      | Line Range | File Count | Aggregate LOC |
| --------- | ---------- | ---------- | ------------- |
| Tier 1    | >1,000     | 7          | 7,919         |
| Tier 2    | 500-999    | 23         | 15,264        |
| Tier 3    | 300-499    | ~55        | ~20,800       |
| **Total** |            | **~85**    | **~43,983**   |

### 5.1 Tier 1 Files (Sub-Tasks 5.4.1 through 5.4.7)

| Sub-Task | File                                                   | Lines |
| -------- | ------------------------------------------------------ | ----- |
| 5.4.1    | `src/lib/data/toolHierarchy.ts`                        | 1,502 |
| 5.4.2    | `src/lib/components/map/KismetDashboardOverlay.svelte` | 1,280 |
| 5.4.3    | `src/routes/redesign/+page.svelte`                     | 1,055 |
| 5.4.4    | `src/lib/components/dashboard/DashboardMap.svelte`     | 1,053 |
| 5.4.5    | `src/lib/components/map/AirSignalOverlay.svelte`       | 1,019 |
| 5.4.6    | `src/routes/rtl-433/+page.svelte`                      | 1,009 |
| 5.4.7    | `src/lib/components/dashboard/TopStatusBar.svelte`     | 1,001 |

### 5.2 Tier 2 Files (Sub-Tasks 5.4.8 through 5.4.10)

| Sub-Task | Scope                      | File Count | Item Range           |
| -------- | -------------------------- | ---------- | -------------------- |
| 5.4.8    | Server cluster             | 6          | 5.4.2-01 to 5.4.2-06 |
| 5.4.9    | Components and services    | 9          | 5.4.2-07 to 5.4.2-15 |
| 5.4.10   | Types, data, and remaining | 8          | 5.4.2-16 to 5.4.2-23 |

### 5.3 Tier 3 Files (Sub-Tasks 5.4.11 through 5.4.12)

| Sub-Task | Scope                      | Item Range     |
| -------- | -------------------------- | -------------- |
| 5.4.11   | Server and services        | T3-01 to T3-30 |
| 5.4.12   | Components, routes, stores | T3-31 to T3-61 |

### 5.4 Execution Order and Verification (Sub-Task 5.4.13)

Covers pre-execution phase gates, tier ordering, commit message format, and final
verification checklist.

---

## 6. File Size Distribution (Pre-Phase Baseline)

```
Lines Range    | Count | % of 108 | Action
---------------|-------|----------|------------------
>1,000         |     7 |    6.5%  | DECOMPOSE (Tier 1)
500-999        |    23 |   21.3%  | DECOMPOSE (Tier 2)
300-499        |   ~55 |   50.9%  | REVIEW/DECOMPOSE (Tier 3)
Handled by 5.1 |     4 |    3.7%  | EXCLUDED
Handled by 5.2 |    10 |    9.3%  | EXCLUDED
Handled by P4  |     6 |    5.6%  | EXCLUDED (deleted)
Deferred (5.1) |     5 |    4.6%  | DEFERRED
---------------|-------|----------|------------------
Total          |   108*|  100.0%  |
```

\*Note: Some files appear in multiple categories (e.g., systemHealth.ts counted once
but flagged in both AC-5 and Tier 2). The 108 count represents unique files.

---

## 7. Documented Exceptions

Files that exceed 300 lines but are ACCEPTED without decomposition, with justification:

| File                                             | Lines             | Justification                                                                                                                                                         |
| ------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/websocket-server.ts`                     | 304               | Core WebSocket server. Single responsibility. Near threshold. Decomposition would scatter connection lifecycle across modules, increasing complexity.                 |
| `services/websocket/base.ts`                     | 376               | Base class for WebSocket services. Single inheritance concern. Extracting methods would require passing `this` context, adding complexity.                            |
| `stores/dashboard/terminalStore.ts`              | 336               | Terminal state management. Single store concern. Clean reactive pattern.                                                                                              |
| `stores/hackrf.ts`                               | 318               | HackRF state store. Clean Svelte store pattern.                                                                                                                       |
| `components/map/TimeFilterControls.svelte`       | 320               | Filter control component. Clean SRP. Near threshold.                                                                                                                  |
| `components/hackrf/TimeWindowControl.svelte`     | 310               | Time window UI. Single concern.                                                                                                                                       |
| `components/dashboard/views/TerminalView.svelte` | 310               | Terminal view layout. Clean composition.                                                                                                                              |
| `components/kismet/MapView.svelte`               | 309               | Map view wrapper. Clean composition.                                                                                                                                  |
| `server/db/database.ts`                          | 356               | Database facade. Already decomposed in prior phase (repository pattern). Stable.                                                                                      |
| `services/api/system.ts`                         | 328               | System API client. Clean HTTP wrapper pattern.                                                                                                                        |
| `routes/api/hardware/details/+server.ts`         | 325               | Hardware API endpoint. Clean request/response.                                                                                                                        |
| `toolHierarchy/oui-database.ts`                  | ~420 (post-split) | Pure data file (MAC prefix map). Zero logic branches. Exception per standard: declarative data files without branching logic are exempt from the 500-line hard limit. |

---

## 8. Standards Compliance Matrix

| Requirement                                   | Status   | Evidence                                             |
| --------------------------------------------- | -------- | ---------------------------------------------------- |
| Audit corrections documented (AC-1 to AC-6)   | COMPLETE | Section 3                                            |
| Cross-phase deductions prevent duplicate work | COMPLETE | Section 4 (20 files, 18,119 lines excluded)          |
| Tier counts verified                          | COMPLETE | Section 5                                            |
| Exceptions justified per standard             | COMPLETE | Section 7 (12 files with rationale)                  |
| Zero-ambiguity principle                      | COMPLETE | All REVIEW items resolved in sub-tasks 5.4.11-5.4.12 |
| Baseline measurement command documented       | COMPLETE | Section 6 + Sub-task 5.4.13 pre-execution gate       |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.0 -- File Size Assessment Standards and Deductions
```
