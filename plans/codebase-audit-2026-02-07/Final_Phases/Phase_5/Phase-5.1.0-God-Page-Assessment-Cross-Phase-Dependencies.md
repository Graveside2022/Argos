# Phase 5.1.0 -- God Page Assessment and Cross-Phase Dependencies

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| **Phase**         | 5.1.0                                                                       |
| **Title**         | God Page Assessment and Cross-Phase Dependencies                            |
| **Risk Level**    | LOW (assessment only, no code changes)                                      |
| **Prerequisites** | Phase 3 (type consolidation) complete, Phase 4 (dead code removal) complete |
| **Files Touched** | 0 (assessment and planning document)                                        |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 15, Barr C Ch. 8                       |
| **Audit Date**    | 2026-02-08                                                                  |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                         |

---

## 1. Objective

Establish verified ground truth for the four god pages before any decomposition work
begins. Document all audit corrections from prior iterations, resolve cross-phase
dependencies with dead code identified in Phase 4, and inventory pre-built components
available for wiring. This document is the single source of truth for all subsequent
Phase 5.1.x sub-tasks.

---

## 2. Audit Corrections

Previous audit iterations contained factual errors. Every correction below was
verified by direct grep/wc against the live codebase on 2026-02-08.

| Prior Claim                                   | Actual Value (Verified)                                 | Verification Command                                                     |
| --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| tactical-map-simple has "28 state variables"  | 187 `let`/`const` declarations                          | `grep -c 'let \|const ' src/routes/tactical-map-simple/+page.svelte`     |
| "extend cellTowerService.ts"                  | `cellTowerService.ts` is DEAD CODE (zero importers)     | `grep -r 'cellTowerService' src/` returns empty                          |
| "extend systemService.ts"                     | `systemService.ts` is DEAD CODE (zero importers)        | `grep -r 'systemService' src/` returns empty                             |
| gsm-evil lookup tables "~600 lines"           | 786 lines (mncToCarrier L70-628, mccToCountry L631-855) | `grep -n 'mncToCarrier\|mccToCountry' src/routes/gsm-evil/+page.svelte`  |
| tactical-map-simple has "7 functions >60 LOC" | 7 confirmed (see Section 4 table)                       | Manual line-range calculation from `grep -n 'function '`                 |
| rfsweep template "904 lines"                  | 903 lines (L654-L1556)                                  | `grep -n '</script>\|<style' src/routes/rfsweep/+page.svelte`            |
| tactical-map-simple style "1,305 lines"       | 1,306 lines (L2673-L3978)                               | `grep -n '<style\|</style>' src/routes/tactical-map-simple/+page.svelte` |

All subsequent line numbers in Phase 5.1.x documents are verified against the codebase
at commit `f300b8f` (main branch, 2026-02-08).

---

## 3. Cross-Phase Dependency Resolution

Phase 4 (dead code removal) deletes files with zero importers. Two files
previously referenced by earlier audit drafts fall into this category.

### 3.1 cellTowerService.ts -- DEAD, Do Not Extend

```
$ grep -r 'cellTowerService' src/
(no output -- zero importers)
```

**Resolution**: Phase 5.1.3 (Phase-5.1.3-Tactical-Map-CellTower-Extraction.md) creates
a NEW file at `src/lib/services/tactical-map/cellTowerManager.ts`. This file is
purpose-built for the tactical-map-simple decomposition. It does NOT extend, import
from, or reference the dead `cellTowerService.ts`.

### 3.2 systemService.ts -- DEAD, Do Not Extend

```
$ grep -r 'systemService' src/
(no output -- zero importers)
```

**Resolution**: Phase 5.1.4 (Phase-5.1.4-Tactical-Map-SystemInfo-Extraction.md) creates
a NEW file at `src/lib/services/tactical-map/systemInfoManager.ts`. Same rationale
as above.

### 3.3 Execution Ordering Constraint

Phase 4 MUST complete before Phase 5.1 begins. Phase 4 removes dead files
including any existing `cellTowerService.ts` and `systemService.ts`. Phase 5.1
then creates new, clean replacements. This eliminates import confusion between
dead and live code.

---

## 4. Current State Assessment

### 4.1 The Four God Pages

| File                                          | Total Lines | Script (L1-end)  | Template          | Style               | Named Functions | Arrow Fns | Functions >60 LOC |
| --------------------------------------------- | ----------- | ---------------- | ----------------- | ------------------- | --------------- | --------- | ----------------- |
| `src/routes/tactical-map-simple/+page.svelte` | 3,978       | 2,166 (L1-L2166) | 506 (L2167-L2672) | 1,306 (L2673-L3978) | 34              | 11        | 7                 |
| `src/routes/gsm-evil/+page.svelte`            | 2,591       | 1,324 (L1-L1324) | 296 (L1325-L1620) | 971 (L1621-L2591)   | 8               | 2         | 2                 |
| `src/routes/rfsweep/+page.svelte`             | 2,245       | 653 (L1-L653)    | 903 (L654-L1556)  | 689 (L1557-L2245)   | 15              | 3         | 3                 |
| `src/routes/hackrfsweep/+page.svelte`         | 1,830       | 452 (L1-L452)    | 862 (L453-L1314)  | 516 (L1315-L1830)   | 12              | 2         | 2                 |
| **Totals**                                    | **10,644**  | **4,595**        | **2,567**         | **3,482**           | **69**          | **18**    | **14**            |

### 4.2 Structural Pathologies

**tactical-map-simple** (worst offender):

- 187 `let`/`const` declarations in a single `<script>` block
- 166 inline `style=` attributes in the template section
- 11 pre-built components exist at `src/lib/components/tactical-map/` (2,630 lines total) but ZERO are imported
- 7 functions exceed 60 LOC; the largest (`fetchKismetDevices`) is 260 lines
- `getDeviceIconSVG` is 227 lines of pure SVG string generation (zero side effects)
- Duplicated Leaflet popup HTML: two near-identical 60-line popup templates inside `fetchKismetDevices`

**gsm-evil**:

- 786 lines (30.3% of file) are static lookup tables (`mncToCarrier` L70-L628, `mccToCountry` L631-L855)
- `scanFrequencies` is 189 lines (L1073-L1261): mixed SSE parsing, store updates, DOM manipulation, error handling

**rfsweep + hackrfsweep** (structural duplicates):

- 10 identically-named functions across both files: `addFrequency`, `startCycling`, `stopCycling`, `startLocalTimer`, `stopLocalTimer`, `resetDisplays`, `removeFrequency`, `openSpectrumAnalyzer`, `updateSignalStrength`, `updateSignalIndicator`
- Near-identical reactive `$:` blocks for `$spectrumData`, `$sweepStatus`, `$cycleStatus`, `$connectionStatus`
- Device-specific differences: HackRF uses `hackrfAPI`, rfsweep uses `usrpAPI`; rfsweep has `measureUSRPPower` (67 lines); HackRF tolerance is 50 MHz, USRP tolerance is 100 MHz

### 4.3 Pre-Built Components (Unused)

These 11 components exist at `src/lib/components/tactical-map/` and total 2,630 lines.
None are imported by `tactical-map-simple/+page.svelte`.

| Component                 | Path    | Lines | Purpose                    |
| ------------------------- | ------- | ----- | -------------------------- |
| GPSPositionManager.svelte | gps/    | 34    | GPS position state         |
| GPSStatusBar.svelte       | gps/    | 163   | GPS status display         |
| FrequencySearch.svelte    | hackrf/ | 324   | HackRF frequency search UI |
| HackRFController.svelte   | hackrf/ | 331   | HackRF connection/control  |
| SignalProcessor.svelte    | hackrf/ | 221   | Signal processing logic    |
| DeviceManager.svelte      | kismet/ | 335   | Kismet device management   |
| KismetController.svelte   | kismet/ | 395   | Kismet start/stop/status   |
| MapContainer.svelte       | map/    | 160   | Leaflet map initialization |
| MapLegend.svelte          | map/    | 306   | Map legend overlay         |
| MarkerManager.svelte      | map/    | 91    | Map marker CRUD            |
| SystemInfoPopup.svelte    | system/ | 270   | Pi system info popup       |

**Wiring these components is the primary decomposition strategy for Phase 5.1.1 through 5.1.8.**
Each component already encapsulates logic that is currently inlined in the god page.
The task is to identify the corresponding inline code, verify interface compatibility,
and replace inline code with component imports.

---

## 5. Decomposition Target Summary

| Task          | Source File                      | Current Lines | Target Lines | Reduction | Sub-Task Files         |
| ------------- | -------------------------------- | ------------- | ------------ | --------- | ---------------------- |
| 5.1.1-5.1.9   | tactical-map-simple/+page.svelte | 3,978         | ~350         | -91.2%    | Phase-5.1.1 to 5.1.9   |
| 5.1.10-5.1.15 | gsm-evil/+page.svelte            | 2,591         | ~300         | -88.4%    | Phase-5.1.10 to 5.1.15 |
| 5.1.16-5.1.19 | rfsweep + hackrfsweep            | 4,075         | ~500         | -87.7%    | Phase-5.1.16 to 5.1.19 |

---

## 6. Verification Commands (Assessment Phase)

```bash
# Verify all four god pages exist and check current line counts:
wc -l src/routes/tactical-map-simple/+page.svelte \
      src/routes/gsm-evil/+page.svelte \
      src/routes/rfsweep/+page.svelte \
      src/routes/hackrfsweep/+page.svelte

# Verify dead code status of cellTowerService and systemService:
grep -r 'cellTowerService' src/
grep -r 'systemService' src/
# Expected: both return empty

# Verify pre-built component inventory:
ls -la src/lib/components/tactical-map/gps/*.svelte \
       src/lib/components/tactical-map/hackrf/*.svelte \
       src/lib/components/tactical-map/kismet/*.svelte \
       src/lib/components/tactical-map/map/*.svelte \
       src/lib/components/tactical-map/system/*.svelte

# Verify none are imported by the god page:
grep -c 'components/tactical-map' src/routes/tactical-map-simple/+page.svelte
# Expected: 0
```

---

## 7. Risk Assessment

| Risk                                    | Severity | Likelihood | Mitigation                                             |
| --------------------------------------- | -------- | ---------- | ------------------------------------------------------ |
| Dead code files confused with new files | HIGH     | LOW        | Phase 4 completes first, removing dead files           |
| Pre-built component interface mismatch  | MEDIUM   | MEDIUM     | Each sub-task includes interface comparison step       |
| Line number drift during decomposition  | LOW      | HIGH       | Each sub-task verifies line numbers at execution time  |
| Assessment data stale by execution time | LOW      | MEDIUM     | Re-run verification commands at start of each sub-task |

---

## 8. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                              |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | Assessment only -- no code changes                          |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | Identifies all 14 functions >60 LOC requiring decomposition |
| Barr C Ch. 8          | Each module shall have a header            | Establishes module structure for all subsequent extractions |

---

## 9. Rollback Strategy

This sub-task is assessment-only. No code is modified. No rollback is required.
If audit corrections are found to be inaccurate at execution time, update Section 2
of this document with corrected values before proceeding with any code changes.

---

_Phase 5.1.0 -- God Page Assessment and Cross-Phase Dependencies_
_Document version: 1.0.0_
_Verified against codebase at commit f300b8f (main, 2026-02-08)_
