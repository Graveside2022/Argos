# Phase 4.4.3: Batch 2 -- Service Layer Catch Block Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, MISRA C++ Rule 15-3-4
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Phase        | 4.4                                                             |
| Task         | 4.4.3                                                           |
| Title        | Batch 2 -- Service Layer Catch Block Migration                  |
| Status       | PLANNED                                                         |
| Risk Level   | LOW (mechanical transformation, no behavioral change)           |
| Duration     | 2 hours                                                         |
| Dependencies | Phase-4.4.1 (errors.ts extensions must be complete)             |
| Commit       | `fix: annotate service catch blocks with : unknown (batch 2/8)` |

---

## Objective

Migrate all 95 untyped catch blocks across 25 files in `src/lib/services/` to explicit `catch (error: unknown)` annotations, applying the appropriate transformation pattern (A through E, defined in Phase-4.4.2) based on error variable usage in each catch body.

## Current State Assessment

- **Untyped catches in scope**: 95
- **Files in scope**: 25
- **Priority**: P0 (service layer mediates between server and UI)

## Processing Order (descending by catch count)

| Order | File                                                            | Catches |
| ----- | --------------------------------------------------------------- | ------- |
| 1     | src/lib/services/kismet/kismetService.ts                        | 15      |
| 2     | src/lib/services/hackrf/hackrfService.ts                        | 11      |
| 3     | src/lib/services/wigletotak/wigleService.ts                     | 10      |
| 4     | src/lib/services/usrp/sweep-manager/process/ProcessManager.ts   | 6       |
| 5     | src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts | 6       |
| 6     | src/lib/services/websocket/base.ts                              | 5       |
| 7     | src/lib/services/monitoring/systemHealth.ts                     | 5       |
| 8     | src/lib/services/usrp/api.ts                                    | 4       |
| 9     | src/lib/services/api/example-usage.ts                           | 4       |
| 10    | src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts     | 3       |
| 11    | src/lib/services/map/kismetRSSIService.ts                       | 3       |
| 12    | src/lib/services/tactical-map/kismetService.ts                  | 2       |
| 13    | src/lib/services/streaming/dataStreamManager.ts                 | 2       |
| 14    | src/lib/services/serviceInitializer.ts                          | 2       |
| 15    | src/lib/services/recovery/errorRecovery.ts                      | 2       |
| 16    | src/lib/services/map/heatmapService.ts                          | 2       |
| 17    | src/lib/services/localization/coral/CoralAccelerator.v2.ts      | 2       |
| 18    | src/lib/services/localization/coral/CoralAccelerator.ts         | 2       |
| 19    | src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts   | 2       |
| 20    | src/lib/services/hackrfsweep/controlService.ts                  | 2       |
| 21    | src/lib/services/tactical-map/gpsService.ts                     | 1       |
| 22    | src/lib/services/map/gridProcessor.ts                           | 1       |
| 23    | src/lib/services/localization/HybridRSSILocalizer.ts            | 1       |
| 24    | src/lib/services/gsm-evil/server.ts                             | 1       |
| 25    | src/lib/services/api/config.ts                                  | 1       |

## Special Attention: Duplicate File Names

Two files are named `kismetService.ts`:

- `src/lib/services/kismet/kismetService.ts` (15 catches) -- primary Kismet service
- `src/lib/services/tactical-map/kismetService.ts` (2 catches) -- tactical map Kismet adapter

Both must be migrated. When running verification, use full paths, not just filenames.

```bash
# WRONG: ambiguous
grep -rn 'catch' kismetService.ts

# RIGHT: unambiguous
grep -n 'catch' src/lib/services/kismet/kismetService.ts
grep -n 'catch' src/lib/services/tactical-map/kismetService.ts
```

## Execution Steps

### Step 1: Verify Prerequisite

```bash
grep -c 'export function getErrorMessage' src/lib/types/errors.ts
# Expected: 1 (Phase-4.4.1 must be complete)
```

### Step 2: Process Each File

For each of the 25 files in processing order:

1. Open the file.
2. Locate each `catch (varName)` without `: unknown` or `: any`.
3. Determine the pattern (A through E, per Phase-4.4.2) based on how `varName` is used in the body.
4. Apply the matching transformation.
5. Add `import { getErrorMessage } from '$lib/types/errors';` if Pattern B, C, or D is applied and the import does not already exist.
6. Save and proceed to the next file.

### Step 3: Per-File Verification

After modifying each file, run:

```bash
# Verify no untyped catches remain in this file
grep -n 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' FILE | grep -v ': unknown'
# Expected: 0 results

# Type check the file
npx tsc --noEmit --pretty 2>&1 | grep FILE
# Expected: 0 errors referencing this file
```

## Verification

### Batch Completion Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/services/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

| #   | Check                          | Command                                                                                                                                   | Expected    |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Zero untyped in services/      | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/services/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l` | 0           |
| 2   | TypeScript compiles            | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                        | No errors   |
| 3   | Both kismetService.ts migrated | `grep -c ': unknown' src/lib/services/kismet/kismetService.ts && grep -c ': unknown' src/lib/services/tactical-map/kismetService.ts`      | >= 15, >= 2 |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates              |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen               |
| getErrorMessage() returns different string than .message | LOW        | LOW    | getErrorMessage() preserves .message for Error instances |

## Rollback Strategy

### Git-Based Rollback

```bash
# Revert the entire batch
git revert <batch-2-commit-sha>
```

Commit message: `fix: annotate service catch blocks with : unknown (batch 2/8)`

### Partial Rollback

If a specific file causes issues:

1. `git diff HEAD~1 -- path/to/file.ts` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.ts` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

## Out of Scope

The 35 parameterless `catch {}` blocks are intentionally error-swallowing and do NOT require migration. See Phase-4.4.6 Appendix for the full list.

## Cross-References

- **Depends on**: Phase-4.4.1 (errors.ts extensions)
- **Preceded by**: Phase-4.4.2 (Batch 1: Server-side)
- **Followed by**: Phase-4.4.4 (Batch 3: API routes)
- **Source**: Phase 4.4 monolithic plan, Section 6 (Task 4.4.4)
