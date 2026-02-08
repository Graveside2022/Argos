# Phase 3.1.5: Batch Migration -- Services

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.5
**Risk Level**: LOW -- Mechanical replacements with semantic level review, no behavior changes
**Prerequisites**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) complete
**Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) (ESLint escalation)
**Estimated Files Touched**: 23
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7, NASA/JPL Rule 14

---

## Objective

Migrate all `console.*` statements in `src/lib/services/` to the structured logger. This is Batch 3 of the 7-batch migration plan: 23 files, approximately 124 statements.

## Current State Assessment

| Metric                                         | Verified Value      | Verification Command                                                                                       |
| ---------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Total `console.*` in `src/lib/services/` (.ts) | 124 across 23 files | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/ --include="*.ts" \| wc -l` |

## Scope

Batch 3 covers all `src/lib/services/` TypeScript files. Note that `test-connection.ts` (21 statements) may be deleted in Phase 0 -- if so, the batch count drops to 103 statements across 22 files.

---

## Per-Batch Procedure (Reference)

Refer to [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) for the complete per-batch procedure and Semantic Log Level Mapping Rule. The same 8-step process applies to this batch.

---

## Complete File Inventory -- Batch 3: `src/lib/services/` (23 files, ~124 statements)

| #   | File                                        | Count |
| --- | ------------------------------------------- | ----- |
| 1   | `websocket/test-connection.ts`              | 21    |
| 2   | `usrp/api.ts`                               | 16    |
| 3   | `localization/coral/CoralAccelerator.v2.ts` | 13    |
| 4   | `kismet/kismetService.ts`                   | 13    |
| 5   | `websocket/base.ts`                         | 12    |
| 6   | `websocket/hackrf.ts`                       | 10    |
| 7   | `localization/coral/CoralAccelerator.ts`    | 5     |
| 8   | `websocket/kismet.ts`                       | 4     |
| 9   | `tactical-map/kismetService.ts`             | 4     |
| 10  | `map/kismetRSSIService.ts`                  | 4     |
| 11  | `map/gridProcessor.ts`                      | 3     |
| 12  | `localization/HybridRSSILocalizer.ts`       | 3     |
| 13  | `tactical-map/systemService.ts`             | 2     |
| 14  | `streaming/dataStreamManager.ts`            | 2     |
| 15  | `monitoring/systemHealth.ts`                | 2     |
| 16  | `map/heatmapService.ts`                     | 2     |
| 17  | `localization/coral/integration-example.ts` | 2     |
| 18  | `tactical-map/hackrfService.ts`             | 1     |
| 19  | `tactical-map/gpsService.ts`                | 1     |
| 20  | `map/webglHeatmapRenderer.ts`               | 1     |
| 21  | `map/signalInterpolation.ts`                | 1     |
| 22  | `hackrf/hackrfService.ts`                   | 1     |
| 23  | `gsm-evil/server.ts`                        | 1     |

---

## Special Considerations

### `websocket/test-connection.ts` (21 statements)

This file has 21 `console.*` statements but may be deleted in Phase 0 (orphaned file with 0 import references). The following logic applies:

- **If Phase 0 deletes this file**: Skip it. Batch count drops to **103 statements across 22 files**.
- **If Phase 0 does NOT delete this file**: Migrate all 21 statements. Consider whether the file should be moved to `tests/` if it is a test harness.

### `localization/coral/` files

Two CoralAccelerator versions (`.ts` and `.v2.ts`) with 18 combined statements. These are hardware abstraction layers for Coral TPU accelerators. Verify both files are actively used before migrating.

### `localization/coral/integration-example.ts` (2 statements)

This file may be example/documentation code. If it is not imported by any production code, it is a Phase 0 deletion candidate. If it survives Phase 0, migrate its 2 statements.

---

## Commit Message

```
fix(logging): migrate console.* to structured logger -- batch 3 (services, 23 files)

Mechanical replacement of 124 console.* calls with structured logger in
src/lib/services/. Applied semantic log level mapping per the Semantic
Log Level Mapping Rule.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. Zero console.* in services
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/ --include="*.ts" | wc -l
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
```

## Risk Assessment

| Risk                                                   | Likelihood | Impact | Mitigation                                                   |
| ------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------ |
| test-connection.ts already deleted by Phase 0          | LOW        | NONE   | If deleted, batch count drops by 21; no harm                 |
| CoralAccelerator files are dead code                   | LOW        | LOW    | Migration is harmless to dead code; Phase 0 handles deletion |
| WebSocket service files have tight timing requirements | VERY LOW   | LOW    | Logger is synchronous; no latency impact                     |

## Success Criteria

- Zero `console.*` calls in `src/lib/services/`
- All log levels are semantically correct
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test:unit` exits 0

## Execution Tracking

| #    | File                                      | Count | Status  | Started | Completed | Verified By |
| ---- | ----------------------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1    | websocket/test-connection.ts              | 21    | PENDING | --      | --        | --          |
| 2    | usrp/api.ts                               | 16    | PENDING | --      | --        | --          |
| 3    | localization/coral/CoralAccelerator.v2.ts | 13    | PENDING | --      | --        | --          |
| 4    | kismet/kismetService.ts                   | 13    | PENDING | --      | --        | --          |
| 5    | websocket/base.ts                         | 12    | PENDING | --      | --        | --          |
| 6    | websocket/hackrf.ts                       | 10    | PENDING | --      | --        | --          |
| 7-23 | (remaining 17 files)                      | 39    | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Partially-migrated files must be clean first
- **Parallel with**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md)
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation requires all batches complete
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.4, Batch 3
- **Phase 0 dependency**: `test-connection.ts` is a Phase 0 deletion candidate; `integration-example.ts` may also be
- **Semantic mapping rule**: Defined in [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md)
