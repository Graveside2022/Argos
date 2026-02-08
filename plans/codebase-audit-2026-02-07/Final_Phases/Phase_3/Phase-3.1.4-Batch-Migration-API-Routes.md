# Phase 3.1.4: Batch Migration -- API Routes

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.4
**Risk Level**: LOW -- Mechanical replacements with semantic level review, no behavior changes
**Prerequisites**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) complete (or can run in parallel with [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) after 3.1.2)
**Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) (ESLint escalation)
**Estimated Files Touched**: 75
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7, NASA/JPL Rule 14

---

## Objective

Migrate all `console.*` statements in `src/routes/api/` to the structured logger. This is Batch 2 of the 7-batch migration plan: 75 files, approximately 225 statements.

## Current State Assessment

| Metric                                       | Verified Value      | Verification Command                                                                                     |
| -------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Total `console.*` in `src/routes/api/` (.ts) | 225 across 75 files | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" \| wc -l` |
| Files with 1 statement each                  | 41 files            | See inventory                                                                                            |

## Scope

Batch 2 covers all `src/routes/api/` TypeScript files. This is the largest batch by file count (75 files) though not by statement count. 41 files have only 1 console statement each, making them quick to process.

---

## Semantic Log Level Mapping Rule (Reference)

Refer to the complete Semantic Log Level Mapping Rule table in [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md). The rule applies identically to this batch.

### Misleveled Calls in This Batch (5 instances)

These are items 1-5 from the master misleveled calls table. They MUST be mapped to the correct semantic level:

| #   | File                                                | Line | Current                                               | Correct Level |
| --- | --------------------------------------------------- | ---- | ----------------------------------------------------- | ------------- |
| 1   | `src/routes/api/cell-towers/nearby/+server.ts`      | 89   | `console.log('Cell tower DB...failed:')`              | `logError`    |
| 2   | `src/routes/api/gsm-evil/scan/+server.ts`           | 156  | `console.log('Both log analysis and tcpdump failed')` | `logError`    |
| 3   | `src/routes/api/gsm-evil/scan/+server.ts`           | 249  | `console.log('Error testing...')`                     | `logError`    |
| 4   | `src/routes/api/gsm-evil/scan/+server.ts`           | 259  | `console.log('Warning: Failed to clean up')`          | `logWarn`     |
| 5   | `src/routes/api/gsm-evil/tower-location/+server.ts` | 64   | `console.log('OpenCellID API error:')`                | `logError`    |

---

## Per-Batch Procedure

Refer to [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) for the complete per-batch procedure. The same 8-step process applies to this batch.

---

## Complete File Inventory -- Batch 2: `src/routes/api/` (75 files, ~225 statements)

### Files with 2+ Statements (30 files, 184 statements)

| #   | File                                   | Count |
| --- | -------------------------------------- | ----- |
| 1   | `gsm-evil/scan/+server.ts`             | 17    |
| 2   | `gsm-evil/control/+server.ts`          | 14    |
| 3   | `kismet/start/+server.ts`              | 12    |
| 4   | `rf/start-sweep/+server.ts`            | 10    |
| 5   | `kismet/control/+server.ts`            | 10    |
| 6   | `hackrf/start-sweep/+server.ts`        | 10    |
| 7   | `kismet/stop/+server.ts`               | 9     |
| 8   | `hackrf/debug-start/+server.ts`        | 9     |
| 9   | `gsm-evil/tower-location/+server.ts`   | 8     |
| 10  | `signals/+server.ts`                   | 7     |
| 11  | `hackrf/test-sweep/+server.ts`         | 7     |
| 12  | `rf/usrp-power/+server.ts`             | 6     |
| 13  | `droneid/+server.ts`                   | 5     |
| 14  | `agent/stream/+server.ts`              | 5     |
| 15  | `system/info/+server.ts`               | 4     |
| 16  | `rtl-433/control/+server.ts`           | 4     |
| 17  | `kismet/proxy/[...path]/+server.ts`    | 4     |
| 18  | `hackrf/test-device/+server.ts`        | 4     |
| 19  | `gsm-evil/intelligent-scan/+server.ts` | 4     |
| 20  | `agent/tools/+server.ts`               | 4     |
| 21  | `tools/execute/+server.ts`             | 3     |
| 22  | `signals/batch/+server.ts`             | 3     |
| 23  | `gsm-evil/health/+server.ts`           | 3     |
| 24  | `tools/scan/+server.ts`                | 2     |
| 25  | `rf/data-stream/+server.ts`            | 2     |
| 26  | `hardware/scan/+server.ts`             | 2     |
| 27  | `hackrf/[...path]/+server.ts`          | 2     |
| 28  | `hackrf/cleanup/+server.ts`            | 2     |
| 29  | `db/cleanup/+server.ts`                | 2     |
| 30  | `cell-towers/nearby/+server.ts`        | 2     |

### Files with 1 Statement Each (41 files, 41 statements)

41 API route files each contain exactly 1 `console.*` statement. All paths are relative to `src/routes/api/`:

These files are quick to process: add the logger import, replace the single `console.*` call, verify. Each typically has a single `console.error` in a catch block.

### Summary

| Category                 | File Count | Statement Count |
| ------------------------ | ---------- | --------------- |
| Files with 2+ statements | 30         | 184             |
| Files with 1 statement   | 41         | 41              |
| **TOTAL**                | **75**     | **225**         |

---

## Commit Message

```
fix(logging): migrate console.* to structured logger -- batch 2 (API routes, 75 files)

Mechanical replacement of 225 console.* calls with structured logger in
src/routes/api/. Applied semantic log level mapping: 5 misleveled
console.log calls corrected to logError/logWarn per message content.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. Zero console.* in API routes
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" | wc -l
# Expected: 0

# 2. TypeScript compiles
npm run typecheck
# Expected: Exit 0

# 3. Lint passes
npm run lint
# Expected: Exit 0

# 4. Unit tests pass
npm run test:unit
# Expected: Exit 0

# 5. Verify misleveled calls were corrected
grep -n "logError.*Cell tower" src/routes/api/cell-towers/nearby/+server.ts | wc -l
# Expected: 1 (line 89 corrected from console.log to logError)

grep -n "logError.*tcpdump failed" src/routes/api/gsm-evil/scan/+server.ts | wc -l
# Expected: 1 (line 156 corrected)

grep -n "logWarn.*Failed to clean up" src/routes/api/gsm-evil/scan/+server.ts | wc -l
# Expected: 1 (line 259 corrected from console.log to logWarn)

grep -n "logError.*OpenCellID" src/routes/api/gsm-evil/tower-location/+server.ts | wc -l
# Expected: 1 (line 64 corrected)
```

## Risk Assessment

| Risk                                                   | Likelihood | Impact | Mitigation                                                                 |
| ------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------- |
| Misleveled migration (logInfo for error condition)     | MEDIUM     | MEDIUM | 5 known mislevels in this batch explicitly identified with correct levels  |
| Large batch (75 files) introduces typo in import       | LOW        | LOW    | TypeScript catches import errors at typecheck                              |
| API route catch blocks need error object serialization | MEDIUM     | LOW    | Pattern: `logError('msg', { error: String(err) })` handles all error types |

## Success Criteria

- Zero `console.*` calls in `src/routes/api/`
- All 5 misleveled calls in this batch corrected to proper semantic levels
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test:unit` exits 0

## Execution Tracking

| #     | File                           | Count | Status  | Started | Completed | Verified By |
| ----- | ------------------------------ | ----- | ------- | ------- | --------- | ----------- |
| 1     | gsm-evil/scan/+server.ts       | 17    | PENDING | --      | --        | --          |
| 2     | gsm-evil/control/+server.ts    | 14    | PENDING | --      | --        | --          |
| 3     | kismet/start/+server.ts        | 12    | PENDING | --      | --        | --          |
| 4-30  | (remaining 2+ statement files) | 141   | PENDING | --      | --        | --          |
| 31-75 | (1 statement files)            | 41    | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Partially-migrated files must be clean first
- **Parallel with**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md)
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation requires all batches complete
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.4, Batch 2
- **Semantic mapping rule**: Defined in [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md); referenced here
- **Related security**: Several API routes in this batch have command injection vulnerabilities identified in Phase 2 (gsm-evil/control, rf/usrp-power, etc.) -- migration does not fix these, only standardizes logging
