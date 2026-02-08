# Phase 3.2.3: Hardcoded RF Frequency Replacement

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.3
**Risk Level**: LOW-MEDIUM
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension -- RF_BANDS, MHZ_TO_HZ, GHZ_TO_MHZ must be defined)
**Blocks**: Phase 3.3 (ESLint `no-magic-numbers` rule)
**Estimated Files Touched**: 21+
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Replace all 80+ hardcoded RF frequency literals across 21+ source files with named constants from the `RF_BANDS` object and conversion helpers (`MHZ_TO_HZ`, `GHZ_TO_MHZ`) defined in `src/lib/constants/limits.ts`. After completion, no raw RF frequency numbers (2400, 5150, 824, 433.92, etc.) will exist in application source code outside the constants file.

## Current State Assessment

| Metric                                    | Value                                                    |
| ----------------------------------------- | -------------------------------------------------------- |
| Total RF frequency occurrences            | 80+ (after excluding false positives from ~150 raw hits) |
| Unique files                              | 21+ (23 identified by audit)                             |
| Unique frequency values                   | 30+                                                      |
| Constants in limits.ts (before)           | 0 RF frequency constants defined                         |
| Constants in limits.ts (after Task 3.2.0) | 37 RF_BANDS constants defined                            |

**Note on false positives**: Raw grep for values like 2400, 2500, 880, 960 returns ~150 hits, many of which are false positives: MCC-MNC codes ("302-880"), pixel widths, USB IDs ("2500:0022"), protocol names ("RTL-433"), GSM frequency discussion in comments. After manual filtering, approximately 80-100 are genuine RF frequency hardcodes. The executor must filter false positives at execution time.

## Scope

### File Inventory (21 files)

| #   | File                                                                | Occurrences | Strategy                                                         |
| --- | ------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| 1   | `src/lib/server/db/geo.ts`                                          | 9           | Replace with `RF_BANDS.WIFI_2G_MIN/MAX`, `WIFI_5G_MIN/MAX`, etc. |
| 2   | `src/lib/services/map/signalFiltering.ts`                           | 12          | Replace with RF_BANDS constants                                  |
| 3   | `src/lib/services/map/droneDetection.ts`                            | 15          | Replace with `RF_BANDS.DRONE_*` constants                        |
| 4   | `src/lib/services/map/aiPatternDetector.ts`                         | 10          | Replace with RF_BANDS constants                                  |
| 5   | `src/lib/services/map/signalClustering.ts`                          | 6           | Replace with RF_BANDS / GHZ_TO_MHZ (uses GHz, not MHz)           |
| 6   | `src/lib/services/db/signalDatabase.ts`                             | 4           | Replace with RF_BANDS constants                                  |
| 7   | `src/lib/components/map/AirSignalOverlay.svelte`                    | 10          | Replace with RF_BANDS constants                                  |
| 8   | `src/lib/server/usrp/sweepManager.ts`                               | 14          | Replace with RF_BANDS preset objects                             |
| 9   | `src/lib/services/hackrfsweep/frequencyService.ts`                  | 12          | Replace with RF_BANDS constants                                  |
| 10  | `src/lib/services/hackrf/signalProcessor.ts`                        | 4           | Replace (note: uses Hz not MHz -- use MHZ_TO_HZ)                 |
| 11  | `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 1           | Replace `433.92e6` with `RF_BANDS.ISM_433 * MHZ_TO_HZ`           |
| 12  | `src/lib/server/websocket-server.ts`                                | 8           | Replace mock/demo data with RF_BANDS                             |
| 13  | `src/lib/components/hackrf/TimeFilterDemo.svelte`                   | 4           | Replace                                                          |
| 14  | `src/lib/components/hackrfsweep/frequency/FrequencyControls.svelte` | 3           | Replace                                                          |
| 15  | `src/lib/components/tactical-map/hackrf/FrequencySearch.svelte`     | 6           | Replace                                                          |
| 16  | `src/routes/hackrfsweep/+page.svelte`                               | 1           | Replace                                                          |
| 17  | `src/routes/rfsweep/+page.svelte`                                   | 1           | Replace                                                          |
| 18  | `src/lib/stores/hackrfsweep/frequencyStore.ts`                      | 1           | Replace                                                          |
| 19  | `src/lib/stores/rtl433Store.ts`                                     | 1           | Replace                                                          |
| 20  | `src/routes/rtl-433/+page.svelte`                                   | 4           | Replace                                                          |
| 21  | `src/lib/server/hackrf/sweepManager.ts`                             | 3           | Replace threshold values                                         |

### Unit Conversion Note -- CRITICAL

The codebase inconsistently uses MHz, GHz, and Hz for RF frequency values:

| Unit Convention   | Files Using It                                                                | Example Values                      |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| MHz (most common) | geo.ts, signalFiltering.ts, droneDetection.ts, etc.                           | 2400, 5150, 824, 433                |
| GHz               | signalClustering.ts                                                           | 0.824, 0.433, 2.4                   |
| Hz                | signalProcessor.ts, gnuradio/spectrum_analyzer.ts, pagermon/processManager.ts | 1710e6, 1805e6, 433.92e6, 152000000 |

**All RF_BANDS constants are defined in MHz.** The following conversion patterns must be used:

```typescript
// For files using Hz:
import { RF_BANDS, MHZ_TO_HZ } from '$lib/constants/limits';
const freq = RF_BANDS.ISM_433 * MHZ_TO_HZ; // 433.92 * 1e6 = 433920000

// For files using GHz:
import { RF_BANDS, GHZ_TO_MHZ } from '$lib/constants/limits';
const freq = RF_BANDS.GSM_850_MIN / GHZ_TO_MHZ; // 824 / 1000 = 0.824
```

**Precision verification**: The executor must verify that `RF_BANDS.ISM_433 * MHZ_TO_HZ` produces exactly the same IEEE 754 double as the original literal `433.92e6`. Both evaluate to `433920000.0` -- verified safe.

### Example Replacements by Category

**WiFi band boundaries** (geo.ts, signalFiltering.ts, aiPatternDetector.ts):

```typescript
// BEFORE:
if (freq >= 2400 && freq <= 2500) type = 'wifi_2g';
if (freq >= 5150 && freq <= 5850) type = 'wifi_5g';

// AFTER:
if (freq >= RF_BANDS.WIFI_2G_MIN && freq <= RF_BANDS.WIFI_2G_MAX) type = 'wifi_2g';
if (freq >= RF_BANDS.WIFI_5G_MIN && freq <= RF_BANDS.WIFI_5G_MAX) type = 'wifi_5g';
```

**GSM band boundaries** (signalFiltering.ts, aiPatternDetector.ts):

```typescript
// BEFORE:
if (freq >= 824 && freq <= 894) type = 'gsm_850';
if (freq >= 880 && freq <= 960) type = 'gsm_900';

// AFTER:
if (freq >= RF_BANDS.GSM_850_MIN && freq <= RF_BANDS.GSM_850_MAX) type = 'gsm_850';
if (freq >= RF_BANDS.GSM_900_MIN && freq <= RF_BANDS.GSM_900_MAX) type = 'gsm_900';
```

**Drone detection** (droneDetection.ts):

```typescript
// BEFORE:
{ min: 2400, max: 2483, name: '2.4GHz' },
{ min: 5725, max: 5875, name: '5.8GHz' },

// AFTER:
{ min: RF_BANDS.DRONE_24G_MIN, max: RF_BANDS.DRONE_24G_MAX, name: '2.4GHz' },
{ min: RF_BANDS.DRONE_58G_MIN, max: RF_BANDS.DRONE_58G_MAX, name: '5.8GHz' },
```

**ISM band (Hz context)** (gnuradio/spectrum_analyzer.ts):

```typescript
// BEFORE:
const freq = 433.92e6;

// AFTER:
const freq = RF_BANDS.ISM_433 * MHZ_TO_HZ;
```

**Pager frequency (Hz context)** (pagermon/processManager.ts):

```typescript
// BEFORE:
const freq = 152000000;

// AFTER:
const freq = RF_BANDS.PAGER_DEFAULT; // Already in Hz in RF_BANDS
```

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.0 is complete -- `grep "RF_BANDS" src/lib/constants/limits.ts` returns matches.
2. **Generate execution inventory**: Run the false-positive-filtering grep to identify all genuine RF frequency literals:
    ```bash
    grep -Prn '\b(2400|2500|5150|5850|2485|1800|1900|824|894|880|960|1710|1785|1805|1880|1850|1990|433|435|868|915|902|928|1575|5725|5875|5800|1200)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v "\.md" | grep -v node_modules
    ```
3. **Filter false positives**: Exclude MCC-MNC codes, pixel widths, USB IDs, protocol names, line numbers in comments.
4. **Replace MHz-context files first** (files 1-9, 12-21) -- straightforward `RF_BANDS.X` replacement.
5. **Run** `npm run typecheck` after each batch of 5 files.
6. **Replace Hz-context files** (files 10, 11) -- use `RF_BANDS.X * MHZ_TO_HZ` pattern.
7. **Replace GHz-context file** (file 5, signalClustering.ts) -- use `RF_BANDS.X / GHZ_TO_MHZ` pattern.
8. **Run** `npm run typecheck` -- must exit 0.
9. **Run final verification** grep.

## Commit Message

```
refactor(constants): replace 80+ hardcoded RF frequency literals with RF_BANDS constants

Phase 3.2 Task 3: Hardcoded RF Frequency Replacement
- Replaced WiFi band boundaries (2400/2500/5150/5850) with RF_BANDS.WIFI_*
- Replaced GSM band boundaries (824/894/880/960/1710/1805) with RF_BANDS.GSM_*
- Replaced ISM frequencies (433/868/915) with RF_BANDS.ISM_*
- Replaced drone detection frequencies with RF_BANDS.DRONE_*
- Used MHZ_TO_HZ conversion helper for Hz-context files
- Used GHZ_TO_MHZ conversion helper for GHz-context files
Verified: grep for raw RF frequency literals returns 0 outside limits.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No hardcoded RF frequency literals in server code**:

```bash
grep -Prn '\b(2400|2500|5150|5850|2485)\b' src/lib/server/ --include="*.ts" | grep -v limits.ts | grep -v "\.md" | wc -l
```

**Expected result**: `0`

**Command 2 -- Broader frequency check across full codebase**:

```bash
grep -Prn '\b(2400|2500|5150|5850|2485|1800|1900|824|894|880|960)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v "\.md" | wc -l
```

**Expected result**: `0` (after false positive filtering; some residual hits may be MCC-MNC codes or pixel widths requiring case-by-case assessment)

**Command 3 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 4 -- Build succeeds**:

```bash
npm run build
```

**Expected result**: Exit 0.

## Audit Corrections Applied

| Original Claim   | Corrected Value                              | Source                                                        |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| 80+ occurrences  | **~80-100** (confirmed valid as lower bound) | Verification Audit Claim 4, rated 4/5                         |
| 20+ unique files | **23**                                       | Audit identified 23 files with genuine RF frequency hardcodes |

The verification audit rated this claim 4/5. The "80+" phrasing is defensible as a lower bound. Raw grep returns ~150 hits, but after filtering false positives (MCC-MNC codes like "302-880", pixel widths, USB IDs like "2500:0022", protocol names like "RTL-433"), approximately 80-100 are genuine. No corrections needed to the scope, but the executor must perform false-positive filtering at execution time.

## Risk Assessment

| Risk                                         | Likelihood | Impact | Mitigation                                                                     |
| -------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------ |
| RF frequency constant precision loss         | LOW        | MEDIUM | Use exact same numeric values; verify IEEE 754 double equivalence              |
| False positive replacement (MCC-MNC code)    | MEDIUM     | LOW    | Manual review of each grep hit; MCC-MNC codes are 3-digit and context-distinct |
| Hz/MHz/GHz unit confusion during replacement | MEDIUM     | HIGH   | Conversion helpers enforce correct scaling; typecheck catches type mismatches  |
| signalClustering.ts GHz values off by 1000x  | LOW        | HIGH   | Explicit GHZ_TO_MHZ division documented; unit test recommended                 |
| Pager frequency already in Hz                | LOW        | LOW    | RF_BANDS.PAGER_DEFAULT is 152000000 (Hz); no conversion needed                 |

## Success Criteria

- `grep -Prn '\b(2400|2500|5150|5850|2485|1800|1900|824|894|880|960)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l` returns **0** (excluding verified false positives)
- `npm run typecheck` exits 0
- `npm run build` exits 0
- All 80+ genuine RF frequency occurrences replaced with RF_BANDS constants
- No unit conversion errors -- Hz, MHz, and GHz contexts all use correct conversion helpers
- No behavioral changes -- only identifiers changed, not numeric values

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension -- RF_BANDS, MHZ_TO_HZ, GHZ_TO_MHZ)
- **Independent of**: Phase-3.2.1 (Port Replacement), Phase-3.2.2 (Timeout Replacement) -- can execute in parallel after 3.2.0
- **Blocks**: Phase-3.3 (ESLint `no-magic-numbers` enforcement)
- **Related**: Phase-3.2.5 (Buffer/Retention Replacement -- some RF-related buffer sizes)

## Execution Tracking

| Subtask | Description                                  | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.3.1 | Generate execution inventory (grep + filter) | PENDING | --      | --        | --          |
| 3.2.3.2 | Replace MHz-context files (17 files)         | PENDING | --      | --        | --          |
| 3.2.3.3 | Replace Hz-context files (2 files)           | PENDING | --      | --        | --          |
| 3.2.3.4 | Replace GHz-context file (1 file)            | PENDING | --      | --        | --          |
| 3.2.3.5 | Replace demo/mock data in websocket-server   | PENDING | --      | --        | --          |
| 3.2.3.6 | Final verification grep                      | PENDING | --      | --        | --          |
