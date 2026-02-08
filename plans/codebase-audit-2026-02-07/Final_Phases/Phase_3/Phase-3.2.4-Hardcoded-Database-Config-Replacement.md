# Phase 3.2.4: Hardcoded Database Configuration Replacement

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.4
**Risk Level**: LOW-MEDIUM
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension -- DB_CONFIG and RETENTION must be defined)
**Blocks**: Phase 3.3 (ESLint `no-magic-numbers` rule)
**Estimated Files Touched**: 3
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Replace all ~25 hardcoded database configuration values across 3 target files with named constants from the `DB_CONFIG` and `RETENTION` objects defined in `src/lib/constants/limits.ts`. Eliminate the duplicate retention configuration that exists independently in `database.ts` and `cleanupService.ts`.

## Current State Assessment

| Metric                                    | Value                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| Total DB config occurrences               | ~25 (audit estimates 18-23 depending on counting methodology) |
| Target files                              | 3 (`dbOptimizer.ts`, `database.ts`, `cleanupService.ts`)      |
| Duplicate retention configs               | **14** instances (7 unique values duplicated across 2 files)  |
| DB_CONFIG constants defined (after 3.2.0) | 17                                                            |
| RETENTION constants defined (after 3.2.0) | 8                                                             |

### Audit Note on Count Methodology

The verification audit rated this claim 3/5, noting the exact count depends on whether pragma reads (for reporting) vs pragma writes (for configuration) are included:

- `dbOptimizer.ts`: 8 pragma writes + 2 default config values + 1 row_count threshold = 11 (plan claimed 17, includes pragma reads used for diagnostic queries)
- `database.ts`: 3 pragma writes + batchSize + maxRuntime + grid multiplier = 5-6
- `cleanupService.ts`: batchSize + VACUUM threshold = 2

The plan's original claim of 25 is slightly overcounted for `dbOptimizer.ts` when only counting configuration-setting pragmas. The executor should replace ALL numeric literals in pragma statements regardless of whether they are reads or writes -- the values define expected database state either way.

## Scope

### File 1: `src/lib/server/db/dbOptimizer.ts` -- ~17 occurrences

| #     | Line(s) | Current Value             | Replacement Constant                | Context                     |
| ----- | ------- | ------------------------- | ----------------------------------- | --------------------------- |
| 1     | --      | `-2000`                   | `DB_CONFIG.STANDARD_CACHE_SIZE`     | Standard profile cache      |
| 2     | --      | `4096`                    | `DB_CONFIG.STANDARD_PAGE_SIZE`      | Standard profile page size  |
| 3     | --      | `30000000`                | `DB_CONFIG.STANDARD_MMAP_SIZE`      | Standard profile mmap       |
| 4     | --      | `52428800`                | `DB_CONFIG.STANDARD_MEMORY_LIMIT`   | Standard profile memory     |
| 5     | --      | `1000`                    | `DB_CONFIG.STANDARD_WAL_CHECKPOINT` | Standard WAL checkpoint     |
| 6     | --      | `-4000`                   | `DB_CONFIG.HIGH_PERF_CACHE_SIZE`    | High-perf profile cache     |
| 7     | --      | `268435456`               | `DB_CONFIG.HIGH_PERF_MMAP_SIZE`     | High-perf profile mmap      |
| 8     | --      | `8192`                    | `DB_CONFIG.HIGH_PERF_PAGE_SIZE`     | High-perf profile page      |
| 9     | --      | `-1000`                   | `DB_CONFIG.LOW_MEM_CACHE_SIZE`      | Low-memory profile cache    |
| 10    | --      | `100`                     | `DB_CONFIG.LOW_MEM_WAL_CHECKPOINT`  | Low-memory WAL checkpoint   |
| 11    | --      | `104857600`               | `DB_CONFIG.VACUUM_SIZE_THRESHOLD`   | VACUUM size threshold 100MB |
| 12    | --      | `100000`                  | `DB_CONFIG.VACUUM_ROW_THRESHOLD`    | VACUUM row threshold        |
| 13-17 | --      | Various diagnostic values | Corresponding DB_CONFIG constants   | Pragma read comparisons     |

### File 2: `src/lib/server/db/database.ts` -- ~6 occurrences

| #   | Line(s) | Current Value        | Replacement Constant        | Context                       |
| --- | ------- | -------------------- | --------------------------- | ----------------------------- |
| 1   | --      | `-64000`             | `DB_CONFIG.INIT_CACHE_SIZE` | Initial pragma cache_size     |
| 2   | --      | `134217728`          | `DB_CONFIG.INIT_MMAP_SIZE`  | Initial pragma mmap_size      |
| 3   | --      | `4096`               | `DB_CONFIG.INIT_PAGE_SIZE`  | Initial pragma page_size      |
| 4   | --      | `10000`              | `DB_CONFIG.GRID_MULTIPLIER` | Grid resolution multiplier    |
| 5   | 262-270 | Retention periods    | `RETENTION.*` constants     | See Duplicate Retention below |
| 6   | --      | batchSize/maxRuntime | `BUFFER_LIMITS.*` or inline | Cleanup config                |

### File 3: `src/lib/server/db/cleanupService.ts` -- 2 occurrences

| #   | Line(s) | Current Value | Replacement Constant               | Context                  |
| --- | ------- | ------------- | ---------------------------------- | ------------------------ |
| 1   | 54      | `1000`        | `BUFFER_LIMITS.CLEANUP_BATCH_SIZE` | Batch size for cleanup   |
| 2   | 317     | `10000`       | `BUFFER_LIMITS.VACUUM_THRESHOLD`   | VACUUM trigger threshold |

### Duplicate Retention Configs -- CRITICAL DEDUPLICATION

`db/database.ts` lines 262-270 and `db/cleanupService.ts` lines 43-59 define identical retention periods independently. This is a maintenance hazard: changing one without the other creates silent data inconsistency.

**Verification audit found**: 7 unique retention values are duplicated across 2 files = **14 individual occurrences** (CORRECTED from plan's 12). The "12" in the original plan does not match any counting methodology.

Both must be replaced with `RETENTION.*` constants from limits.ts:

| Retention Period | database.ts Line | cleanupService.ts Line | Replacement Constant           |
| ---------------- | ---------------- | ---------------------- | ------------------------------ |
| HackRF (1 hour)  | ~262             | ~44                    | `RETENTION.HACKRF_MS`          |
| WiFi (7 days)    | ~263             | ~45                    | `RETENTION.WIFI_MS`            |
| Default (1 hour) | ~264             | ~46                    | `RETENTION.DEFAULT_MS`         |
| Device (7 days)  | ~265             | ~47                    | `RETENTION.DEVICE_MS`          |
| Pattern (24 hrs) | ~266             | ~48                    | `RETENTION.PATTERN_MS`         |
| Spatial default  | ~267             | ~49                    | `RETENTION.SPATIAL_DEFAULT_MS` |
| Spatial window   | ~268             | ~50                    | `RETENTION.SPATIAL_WINDOW_MS`  |

After replacement, the canonical definition of each retention period is in `limits.ts` and both consumers import from there. Changing a retention period requires editing exactly one location.

### Grid Multiplier 10000

The value `10000` appears approximately 10 times across 3 files (database.ts, signalRepository.ts, networkRepository.ts) as a grid resolution multiplier. All must be replaced with `DB_CONFIG.GRID_MULTIPLIER`. This is a single logical constant used in spatial coordinate rounding.

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.0 is complete -- `grep "DB_CONFIG" src/lib/constants/limits.ts` returns matches.
2. **Replace dbOptimizer.ts** (~17 occurrences):
    - Replace all pragma write values with `DB_CONFIG.*` constants.
    - Replace diagnostic comparison values with corresponding constants.
    - Run `npm run typecheck`.
3. **Replace database.ts** (~6 occurrences):
    - Replace init pragma values with `DB_CONFIG.INIT_*` constants.
    - Replace grid multiplier with `DB_CONFIG.GRID_MULTIPLIER`.
    - **Replace retention config block** (lines 262-270) with `RETENTION.*` imports.
    - Run `npm run typecheck`.
4. **Replace cleanupService.ts** (2 occurrences):
    - Replace batchSize with `BUFFER_LIMITS.CLEANUP_BATCH_SIZE`.
    - Replace VACUUM threshold with `BUFFER_LIMITS.VACUUM_THRESHOLD`.
    - **Replace retention config block** (lines 43-59) with `RETENTION.*` imports.
    - Run `npm run typecheck`.
5. **Replace grid multiplier** in signalRepository.ts and networkRepository.ts with `DB_CONFIG.GRID_MULTIPLIER`.
6. **Run final verification** -- ensure no duplicate retention values remain.

## Commit Message

```
refactor(constants): replace 25 hardcoded database config values with DB_CONFIG/RETENTION constants

Phase 3.2 Task 4: Hardcoded Database Configuration Replacement
- Replaced 17 pragma values in dbOptimizer.ts with DB_CONFIG.* constants
- Replaced 6 init pragma/config values in database.ts with DB_CONFIG.* constants
- Replaced 2 cleanup thresholds in cleanupService.ts with BUFFER_LIMITS.* constants
- Eliminated duplicate retention configs between database.ts and cleanupService.ts
  (14 occurrences of 7 unique values consolidated to single RETENTION.* source)
- Replaced grid multiplier 10000 with DB_CONFIG.GRID_MULTIPLIER across 3 files
Verified: duplicate retention check shows 1 occurrence per value (limits.ts only)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No duplicate retention configs**:

```bash
grep -c "604800000" src/ -r --include="*.ts"
```

**Expected result**: `1` (only in limits.ts)

**Command 2 -- No duplicate 3600000 (1-hour retention)**:

```bash
grep -c "3600000" src/ -r --include="*.ts"
```

**Expected result**: `1` (only in limits.ts -- this value appears in both RETENTION.HACKRF_MS and RETENTION.DEFAULT_MS in limits.ts, but grep counts lines, not occurrences)

**Command 3 -- Grid multiplier centralized**:

```bash
grep -Prn '\b10000\b' src/lib/server/db/ --include="*.ts" | grep -v limits.ts | wc -l
```

**Expected result**: `0`

**Command 4 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

## Audit Corrections Applied

| Original Claim                       | Corrected Value                                    | Source                                   |
| ------------------------------------ | -------------------------------------------------- | ---------------------------------------- |
| 12 duplicate retention period values | **14** (7 unique x 2 files)                        | Verification Audit Claim 8, rated 2/5    |
| 25 total DB config occurrences       | **~18-23** (depending on counting methodology)     | Verification Audit Claim 7, rated 3/5    |
| dbOptimizer.ts: 17 occurrences       | **~11-15** (pragma writes + defaults + thresholds) | Audit notes overcounting of pragma reads |

The verification audit rated the DB config claim 3/5, noting the plan slightly overcounts `dbOptimizer.ts` by including pragma reads used for diagnostic queries. The recommended approach is to replace ALL numeric literals in pragma statements regardless -- this eliminates the counting ambiguity entirely.

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                                  |
| -------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Pragma value change alters DB behavior             | NONE       | --     | Literal-for-literal replacement; no values changed                          |
| Grid multiplier precision loss                     | NONE       | --     | Integer value 10000; no floating point involved                             |
| Retention deduplication inconsistency              | LOW        | MEDIUM | Both files import from same source; single source of truth eliminates drift |
| VACUUM threshold change triggers unexpected vacuum | NONE       | --     | Same value (10000) preserved in BUFFER_LIMITS.VACUUM_THRESHOLD              |

## Success Criteria

- `grep -c "604800000" src/ -r --include="*.ts"` returns **1** (limits.ts only)
- `grep -Prn '\b10000\b' src/lib/server/db/ --include="*.ts" | grep -v limits.ts | wc -l` returns **0**
- No duplicate retention configuration blocks remain in database.ts or cleanupService.ts
- `npm run typecheck` exits 0
- `npm run build` exits 0
- All pragma configuration values replaced with DB_CONFIG.\* constants

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension -- DB_CONFIG, RETENTION)
- **Related**: Phase-3.2.5 (Buffer/Retention Replacement -- BUFFER_LIMITS.CLEANUP_BATCH_SIZE and VACUUM_THRESHOLD overlap; ensure no double-replacement)
- **Independent of**: Phase-3.2.1 (Port Replacement), Phase-3.2.2 (Timeout Replacement), Phase-3.2.3 (RF Frequency Replacement)
- **Blocks**: Phase-3.3 (ESLint `no-magic-numbers` enforcement)

## Execution Tracking

| Subtask | Description                                  | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.4.1 | Replace dbOptimizer.ts (~17 values)          | PENDING | --      | --        | --          |
| 3.2.4.2 | Replace database.ts (~6 values)              | PENDING | --      | --        | --          |
| 3.2.4.3 | Replace cleanupService.ts (2 values)         | PENDING | --      | --        | --          |
| 3.2.4.4 | Deduplicate retention configs (14 instances) | PENDING | --      | --        | --          |
| 3.2.4.5 | Replace grid multiplier across 3 files       | PENDING | --      | --        | --          |
| 3.2.4.6 | Final verification                           | PENDING | --      | --        | --          |
