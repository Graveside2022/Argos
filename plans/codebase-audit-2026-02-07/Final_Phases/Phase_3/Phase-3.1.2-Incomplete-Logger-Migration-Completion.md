# Phase 3.1.2: Incomplete Logger Migration Completion

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.2
**Risk Level**: LOW -- Completing partial migrations in files that already import logger
**Prerequisites**: [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md) complete, [Phase 3.1.1](Phase-3.1.1-Commented-Console-Statement-Deletion.md) complete
**Blocks**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) through [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) (all batch migrations)
**Estimated Files Touched**: 5
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7

---

## Objective

Complete the logger migration in 5 files that already import the logger but still contain 22 raw `console.*` statements. These mixed-state files must be fixed before batch migration begins to establish a clean baseline and accurate remaining-work count.

## Current State Assessment

| Metric                                        | Verified Value         | Target                | Verification Command                 |
| --------------------------------------------- | ---------------------- | --------------------- | ------------------------------------ |
| Files with logger AND console.\* (incomplete) | 6 files, 23 statements | 0 files, 0 statements | See inventory below                  |
| After Subtask 3.1.0 eliminates logging.ts     | 5 files, 22 statements | 0                     | Subtract 1 file (logging.ts deleted) |

## Scope

Fix exactly 5 files that are in a mixed state -- they import the logger but still use raw `console.*` calls. One file (`src/lib/config/logging.ts`) was eliminated by Phase 3.1.0 Defect 4. The remaining 22 statements across 5 files must be replaced with proper logger calls.

---

## Complete File Inventory

| #   | File                                         | console.\* Count            | Breakdown              | Action                                                                                                |
| --- | -------------------------------------------- | --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/config/logging.ts`                  | 1 (`console.warn`)          | --                     | **Eliminated by Phase 3.1.0 Defect 4** (file deleted)                                                 |
| 2   | `src/lib/server/hackrf/sweepManager.ts`      | 1 (`console.error`)         | 1 error                | Replace with `logError`                                                                               |
| 3   | `src/lib/server/hardware/resourceManager.ts` | 7 (4 error, 2 warn, 1 log)  | 4 error, 2 warn, 1 log | Replace: 4x `logError`, 2x `logWarn`, 1x `logInfo`                                                    |
| 4   | `src/lib/services/hackrf/hackrfService.ts`   | 1 (`console.error`)         | 1 error                | Replace with `logError`                                                                               |
| 5   | `src/routes/api/gsm-evil/status/+server.ts`  | 1 (`console.error`)         | 1 error                | Replace with `logError`                                                                               |
| 6   | `src/routes/api/kismet/start/+server.ts`     | 12 (8 error, 3 log, 1 warn) | 8 error, 1 warn, 3 log | Replace: 8x `logError`, 1x `logWarn`, 3x `logInfo` (review: 3 `console.log` calls may be error-level) |
|     | **TOTAL (after logging.ts deletion)**        | **22**                      |                        |                                                                                                       |

## Execution Steps

For each of the 5 files:

1. **Open the file** and confirm it already has a logger import (e.g., `import { logInfo, logError, logWarn } from '$lib/utils/logger';`)
2. **Locate each `console.*` call** and apply the appropriate replacement:
    - `console.error('msg', err)` --> `logError('msg', { error: String(err) })`
    - `console.warn('msg')` --> `logWarn('msg')`
    - `console.log('msg', data)` --> `logInfo('msg', { data })` (or `logError` if the message indicates failure)
3. **Update the logger import** to include any newly-needed functions (e.g., add `logWarn` if not already imported)
4. **Review the 3 `console.log` calls in `kismet/start/+server.ts`**: These log messages likely describe error or failure conditions. If the message text contains "error", "failed", "could not", etc., use `logError` instead of `logInfo`.

After all 5 files are updated:

5. Run `npm run typecheck` -- must pass
6. Run `npm run lint` -- must pass
7. Run `npm run test:unit` -- must pass (if tests exist for affected files)
8. Commit

## Commit Message

```
fix(logging): complete logger migration in 5 partially-migrated files

Files already imported the logger but retained 22 raw console.* calls.
This mixed state is now resolved: all 5 files use the structured logger
exclusively.

- sweepManager.ts: 1 console.error -> logError
- resourceManager.ts: 7 calls (4 error, 2 warn, 1 log) -> logger
- hackrfService.ts: 1 console.error -> logError
- gsm-evil/status: 1 console.error -> logError
- kismet/start: 12 calls (8 error, 1 warn, 3 log) -> logger

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. No file imports logger AND uses console.*
for f in $(grep -rl "from.*logger" src/ --include="*.ts" --include="*.svelte"); do
    if grep -q "console\.\(log\|warn\|error\|info\|debug\|trace\)" "$f"; then
        echo "INCOMPLETE: $f"
    fi
done
# Expected: no output (zero incomplete files)

# 2. TypeScript compiles
npm run typecheck
# Expected: Exit 0

# 3. Lint passes
npm run lint
# Expected: Exit 0

# 4. Verify specific files are clean
grep -n "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/hackrf/sweepManager.ts | wc -l
# Expected: 0

grep -n "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/hardware/resourceManager.ts | wc -l
# Expected: 0

grep -n "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/hackrf/hackrfService.ts | wc -l
# Expected: 0

grep -n "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/gsm-evil/status/+server.ts | wc -l
# Expected: 0

grep -n "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/kismet/start/+server.ts | wc -l
# Expected: 0
```

## Risk Assessment

| Risk                                                 | Likelihood | Impact | Mitigation                                                               |
| ---------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Misleveled migration (logInfo for error condition)   | MEDIUM     | MEDIUM | Review each console.log message text for error indicators before mapping |
| kismet/start 3 console.log calls are actually errors | MEDIUM     | LOW    | Manual review of message text required; document decision                |
| Missing logger import function                       | LOW        | LOW    | TypeScript will catch missing imports at typecheck                       |

## Success Criteria

- All 5 files use ONLY the structured logger (zero `console.*` calls remaining)
- No file in the codebase both imports the logger AND uses raw console calls
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- All log levels are semantically correct (no `logInfo` for error conditions)

## Execution Tracking

| #   | File                       | Statements | Status  | Started | Completed | Verified By |
| --- | -------------------------- | ---------- | ------- | ------- | --------- | ----------- |
| 1   | sweepManager.ts            | 1          | PENDING | --      | --        | --          |
| 2   | resourceManager.ts         | 7          | PENDING | --      | --        | --          |
| 3   | hackrfService.ts           | 1          | PENDING | --      | --        | --          |
| 4   | gsm-evil/status/+server.ts | 1          | PENDING | --      | --        | --          |
| 5   | kismet/start/+server.ts    | 12         | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md) -- Logger must be defect-free before completing migrations
- **Depends on**: [Phase 3.1.1](Phase-3.1.1-Commented-Console-Statement-Deletion.md) -- Commented-out lines must be deleted first for accurate counting
- **Blocks**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) through [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) -- All batch migrations
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.3
