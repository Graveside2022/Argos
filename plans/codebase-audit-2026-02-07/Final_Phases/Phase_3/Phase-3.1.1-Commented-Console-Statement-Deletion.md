# Phase 3.1.1: Commented-Out Console Statement Deletion

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.7 (no side effects in debug code), MISRA C 2012 Rule 2.4 (no dead/commented code in production)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.1
**Risk Level**: LOW -- Deleting dead commented-out code has zero runtime impact
**Prerequisites**: [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md) complete (logger defects fixed)
**Blocks**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) (incomplete migration files)
**Estimated Files Touched**: 7
**Standards**: BARR-C Rule 8.7 (no side effects in debug code), MISRA C 2012 Rule 2.4 (no dead/commented code)

---

## Objective

Delete 35 commented-out `console.*` lines across 7 files. These are dead code, not documentation. They must be removed before migration counting begins to prevent confusion about remaining work.

## Current State Assessment

| Metric                          | Verified Value            | Target                     | Verification Command                                                                                                                    |
| ------------------------------- | ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Commented-out `console.*` lines | 35 (corrected 2026-02-08) | 0 (delete, do not migrate) | `grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ \| grep -E 'console\.(log\|warn\|error\|info\|debug\|trace)' \| wc -l` |

## Scope

Delete exactly 35 commented-out `console.*` lines across 7 files. One line in `sweepManager.ts` (line 599) is an EXPLANATORY comment about WHY there is no console.log -- it is NOT a commented-out call and MUST be kept.

---

## Complete File Inventory

### File 1: `src/lib/services/websocket/test-connection.ts` -- 21 lines

**Lines**: 12, 15, 24, 25, 33, 37, 44, 53, 54, 57, 60, 69, 73, 82, 83, 84, 88, 94, 100 (and 2 more)

All are `// console.info(...)` debug logging for WebSocket connection tests. The entire file is a test harness that appears unused (0 import references). **Candidate for Phase 0 deletion**. If Phase 0 deletes this file, skip these 21 lines.

**Action**: If file still exists, delete all 21 commented-out console lines.

### File 2: `src/lib/services/websocket/base.ts` -- 4 lines

**Lines**: 58, 176, 204, 277

`// console.info(...)` connection lifecycle logging.

**Action**: Delete all 4 commented-out lines.

### File 3: `src/lib/services/websocket/hackrf.ts` -- 2 lines

**Lines**: 158, 176

`// console.info(...)` connection/disconnection logging.

**Action**: Delete both commented-out lines.

### File 4: `src/lib/services/websocket/kismet.ts` -- 2 lines

**Lines**: 93, 110

`// console.info(...)` connection/disconnection logging.

**Action**: Delete both commented-out lines.

### File 5: `src/lib/services/kismet/kismetService.ts` -- 4 lines

**Lines**: 398, 412, 447, 538

`// console.info(...)` reconnection and restart logging.

**Action**: Delete all 4 commented-out lines.

### File 6: `src/lib/server/hackrf/sweepManager.ts` -- 0 lines to delete

**Line 599**: `// Handle stdout data -- NO console.log in this hot path`

This is an **explanatory comment**, NOT a commented-out call. It documents a deliberate performance decision. **KEEP this line.**

**Action**: No changes to this file.

### File 7: `src/lib/components/kismet/GPSStatusButton.svelte` -- 3 lines

**Lines**: 19, 20, 44

`// $: console.warn(...)` debug reactivity logging.

**Action**: Delete all 3 commented-out lines.

### File 8: `src/routes/gsm-evil/+page.svelte` -- 1 line

**Line 859**: `// console.log('scanResults updated:', ...)`

Debug logging for scan result updates.

**Action**: Delete the 1 commented-out line.

---

## Summary Table

| #   | File                                               | Lines to Delete                                     | Action                                   |
| --- | -------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| 1   | `src/lib/services/websocket/test-connection.ts`    | 21                                                  | Delete (or skip if Phase 0 deleted file) |
| 2   | `src/lib/services/websocket/base.ts`               | 4                                                   | Delete                                   |
| 3   | `src/lib/services/websocket/hackrf.ts`             | 2                                                   | Delete                                   |
| 4   | `src/lib/services/websocket/kismet.ts`             | 2                                                   | Delete                                   |
| 5   | `src/lib/services/kismet/kismetService.ts`         | 4                                                   | Delete                                   |
| 6   | `src/lib/server/hackrf/sweepManager.ts`            | 0                                                   | KEEP explanatory comment (line 599)      |
| 7   | `src/lib/components/kismet/GPSStatusButton.svelte` | 3                                                   | Delete                                   |
| 8   | `src/routes/gsm-evil/+page.svelte`                 | 1                                                   | Delete                                   |
|     | **TOTAL**                                          | **35** (excluding sweepManager explanatory comment) |                                          |

## Execution Steps

1. For each file in the inventory above:
   a. Open the file
   b. Locate each commented-out `console.*` line by line number
   c. Delete the entire line (do not replace with logger call -- these are dead code)
   d. Verify the surrounding code still makes syntactic sense
2. Run `npm run typecheck` -- must pass
3. Run `npm run lint` -- must pass
4. Commit

## Commit Message

```
refactor(logging): delete 35 commented-out console.* lines across 7 files

Dead code removal per MISRA C 2012 Rule 2.4 and BARR-C Rule 8.7.
Commented-out debug statements are not documentation -- they are dead
code that obscures the actual codebase state and confuses migration
counting.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. No commented-out console.* lines remain
grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ | grep -E 'console\.(log|warn|error|info|debug|trace)' | wc -l
# Expected: 0 (the sweepManager comment does not match this pattern because it's prose, not a commented call)

# 2. TypeScript compiles
npm run typecheck
# Expected: Exit 0

# 3. Lint passes
npm run lint
# Expected: Exit 0
```

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Accidentally delete the sweepManager explanatory comment | LOW        | LOW    | Explicitly documented as KEEP; regex pattern does not match prose comments |
| Phase 0 already deleted test-connection.ts               | LOW        | NONE   | If deleted, batch count drops by 21; no harm                               |
| Deleting commented code reveals missing functionality    | VERY LOW   | LOW    | These are debug logging lines, not functional code                         |

## Success Criteria

- 35 commented-out `console.*` lines deleted across 7 files
- sweepManager.ts line 599 explanatory comment preserved
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- Verification grep returns 0

## Execution Tracking

| File                    | Lines to Delete | Status  | Started | Completed | Verified By |
| ----------------------- | --------------- | ------- | ------- | --------- | ----------- |
| test-connection.ts      | 21              | PENDING | --      | --        | --          |
| base.ts                 | 4               | PENDING | --      | --        | --          |
| hackrf.ts               | 2               | PENDING | --      | --        | --          |
| kismet.ts               | 2               | PENDING | --      | --        | --          |
| kismetService.ts        | 4               | PENDING | --      | --        | --          |
| GPSStatusButton.svelte  | 3               | PENDING | --      | --        | --          |
| +page.svelte (gsm-evil) | 1               | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md) -- Logger defects must be fixed first
- **Blocks**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Incomplete migration files require clean baseline
- **Related**: Phase 0 (Code Organization) -- `test-connection.ts` is a Phase 0 deletion candidate
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.2
