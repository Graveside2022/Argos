# Phase 3.1.7: Batch Migration -- Pages and Remaining Files

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.7
**Risk Level**: LOW -- Mechanical replacements with semantic level review, no behavior changes
**Prerequisites**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) complete
**Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) (ESLint escalation)
**Estimated Files Touched**: 16 (15 pages + 1 remaining)
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7, NASA/JPL Rule 14

---

## Objective

Migrate all `console.*` statements in page routes (non-API) and any remaining files to the structured logger. This combines Batches 6 and 7 of the 7-batch migration plan: 16 files, 108 statements total.

## Current State Assessment

| Metric                                              | Verified Value      | Verification Command                                                                                                                         |
| --------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Total `console.*` in pages (.svelte + .ts, non-API) | 107 across 15 files | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/ --include="*.svelte" --include="*.ts" \| grep -v "/api/" \| wc -l` |
| Remaining files not in any other batch              | 1 file, 1 statement | See Batch 7 below                                                                                                                            |

## Scope

This task covers two batches combined into one task file:

- **Batch 6**: `src/routes/` pages (non-API, .svelte + .ts) -- 15 files, 107 statements
- **Batch 7**: Remaining files not covered by any other batch -- 1 file, 1 statement

---

## Per-Batch Procedure (Reference)

Refer to [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) for the complete per-batch procedure and Semantic Log Level Mapping Rule. The same 8-step process applies to both batches.

---

## Batch 6: `src/routes/` Pages (non-API) -- 15 files, 107 statements

| #   | File                                             | Count |
| --- | ------------------------------------------------ | ----- |
| 1   | `rfsweep/+page.svelte`                           | 21    |
| 2   | `tactical-map-simple/+page.svelte`               | 20    |
| 3   | `kismet/+page.svelte`                            | 17    |
| 4   | `gsm-evil/+page.svelte`                          | 17    |
| 5   | `droneid/+page.svelte`                           | 10    |
| 6   | `rtl-433/+page.svelte`                           | 7     |
| 7   | `redesign/+page.svelte`                          | 4     |
| 8   | `tactical-map-simple/rssi-integration.ts`        | 3     |
| 9   | `gsm-evil/LocalIMSIDisplay.svelte`               | 2     |
| 10  | `viewspectrum/+page.svelte`                      | 1     |
| 11  | `test-hackrf-stop/+page.svelte`                  | 1     |
| 12  | `test-db-client/+page.svelte`                    | 1     |
| 13  | `tactical-map-simple/integration-example.svelte` | 1     |
| 14  | `kismet-dashboard/+page.svelte`                  | 1     |
| 15  | `hackrfsweep/+page.svelte`                       | 1     |

### Special Considerations for Pages

1. **`rfsweep/+page.svelte` (21 statements)** and **`tactical-map-simple/+page.svelte` (20 statements)**: These are the two largest page files. Many of these console calls may be debug logging for map rendering or spectrum display. Review each for correct semantic level.

2. **`test-hackrf-stop/+page.svelte`** and **`test-db-client/+page.svelte`**: These appear to be test/debug pages. They may be Phase 0 deletion candidates. If they survive Phase 0, migrate their console statements.

3. **`tactical-map-simple/integration-example.svelte`**: This may be example/documentation code. If not imported by any production code, it is a Phase 0 deletion candidate. If it survives Phase 0, migrate its 1 statement.

4. **Svelte import pattern**: Same as Batch 5 -- use `$lib/utils/logger` import in `<script>` blocks.

### Commit for Batch 6

```
fix(logging): migrate console.* to structured logger -- batch 6 (pages, 15 files)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Batch 7: Remaining Files -- 1 file, 1 statement

| #   | File                                    | Count |
| --- | --------------------------------------- | ----- |
| 1   | `src/lib/hardware/usrp-verification.ts` | 1     |

**Note**: `src/lib/config/logging.ts` (1 statement) was deleted in [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md). `src/lib/utils/logger.ts` (4 statements) is excluded from migration (it is the logger itself).

### Commit for Batch 7

```
fix(logging): migrate console.* to structured logger -- batch 7 (remaining, 1 file)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Combined Verification (Both Batches)

```bash
# 1. Zero console.* in pages (non-API)
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/ --include="*.svelte" --include="*.ts" | grep -v "/api/" | wc -l
# Expected: 0

# 2. Zero console.* in remaining files (excluding logger.ts)
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/hardware/ --include="*.ts" | wc -l
# Expected: 0

# 3. COMPREHENSIVE CHECK: Zero console.* ANYWHERE in src/ (excluding logger.ts and validate-env.js)
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/ --include="*.ts" --include="*.svelte" | grep -v "logger.ts" | wc -l
# Expected: 0

# 4. TypeScript compiles
npm run typecheck
# Expected: Exit 0

# 5. Lint passes
npm run lint
# Expected: Exit 0

# 6. Unit tests pass
npm run test:unit
# Expected: Exit 0
```

## Risk Assessment

| Risk                                                                  | Likelihood | Impact | Mitigation                                            |
| --------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Test/debug pages deleted by Phase 0                                   | LOW        | NONE   | If deleted, batch count drops; no harm                |
| Page components use console for user-facing debugging                 | LOW        | LOW    | Logger provides equivalent browser console output     |
| Large page files (rfsweep: 21, tactical-map: 20) have complex logging | MEDIUM     | LOW    | Review each statement individually for semantic level |

## Success Criteria

- Zero `console.*` calls in `src/routes/` non-API pages
- Zero `console.*` calls in `src/lib/hardware/`
- **COMPREHENSIVE**: Zero `console.*` calls anywhere in `src/` excluding `logger.ts` and `validate-env.js`
- All log levels are semantically correct
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test:unit` exits 0

## Execution Tracking

### Batch 6 (Pages)

| #     | File                                    | Count | Status  | Started | Completed | Verified By |
| ----- | --------------------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1     | rfsweep/+page.svelte                    | 21    | PENDING | --      | --        | --          |
| 2     | tactical-map-simple/+page.svelte        | 20    | PENDING | --      | --        | --          |
| 3     | kismet/+page.svelte                     | 17    | PENDING | --      | --        | --          |
| 4     | gsm-evil/+page.svelte                   | 17    | PENDING | --      | --        | --          |
| 5     | droneid/+page.svelte                    | 10    | PENDING | --      | --        | --          |
| 6     | rtl-433/+page.svelte                    | 7     | PENDING | --      | --        | --          |
| 7     | redesign/+page.svelte                   | 4     | PENDING | --      | --        | --          |
| 8     | tactical-map-simple/rssi-integration.ts | 3     | PENDING | --      | --        | --          |
| 9     | gsm-evil/LocalIMSIDisplay.svelte        | 2     | PENDING | --      | --        | --          |
| 10-15 | (remaining 6 files)                     | 6     | PENDING | --      | --        | --          |

### Batch 7 (Remaining)

| #   | File                                  | Count | Status  | Started | Completed | Verified By |
| --- | ------------------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1   | src/lib/hardware/usrp-verification.ts | 1     | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Partially-migrated files must be clean first
- **Parallel with**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md)
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation requires all batches complete; this is the FINAL batch
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.4, Batches 6 and 7
- **Semantic mapping rule**: Defined in [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md)
- **Phase 0 candidates**: test-hackrf-stop, test-db-client, integration-example.svelte may be deleted before this task runs
