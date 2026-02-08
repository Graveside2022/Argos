# Phase 3.1.3: Batch Migration -- Server Core

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.3
**Risk Level**: LOW -- Mechanical replacements with semantic level review, no behavior changes
**Prerequisites**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) complete (incomplete migrations resolved)
**Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) (ESLint escalation)
**Estimated Files Touched**: 34
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7, NASA/JPL Rule 14

---

## Objective

Migrate all remaining `console.*` statements in `src/lib/server/` (excluding `logger.ts`) to the structured logger. This is Batch 1 of the 7-batch migration plan: 34 files, approximately 192 statements.

## Current State Assessment

After Subtask 3.1.2 fixes 2 files (sweepManager, resourceManager), 34 server files remain with 192 statements:

- Total `src/lib/server/` console.\* in .ts: ~200 statements across 36 files
- Minus sweepManager.ts (fixed in 3.1.2): -1
- Minus resourceManager.ts (fixed in 3.1.2): -7
- **Remaining**: 192 statements across 34 files

## Scope

Batch 1 covers `src/lib/server/` TypeScript files only, excluding `src/lib/utils/logger.ts` (4 permitted console calls) and the 2 files fixed in Phase 3.1.2.

---

## Semantic Log Level Mapping Rule

**CRITICAL**: Do NOT mechanically map `console.log` to `logInfo`. Review each statement and apply the correct semantic level:

| Pattern in Code                                              | Correct Logger Level | Rationale                               |
| ------------------------------------------------------------ | -------------------- | --------------------------------------- |
| `console.log('Error ...')` or `console.log('Failed ...')`    | `logError`           | Error condition reported at wrong level |
| `console.log('Warning: ...')` or `console.log('[WARN] ...')` | `logWarn`            | Warning reported at wrong level         |
| `console.log('Starting ...')` or informational               | `logInfo`            | Correct mapping                         |
| `console.error(...)`                                         | `logError`           | Direct mapping                          |
| `console.warn(...)`                                          | `logWarn`            | Direct mapping                          |
| `console.info(...)`                                          | `logInfo`            | Direct mapping                          |

### Verified Misleveled Calls Requiring Manual Correction (9 instances)

These calls use `console.log` but the message text indicates error or warning conditions. They MUST be mapped to the correct semantic level, not mechanically to `logInfo`:

| #   | File                                                   | Line | Current                                               | Correct Level |
| --- | ------------------------------------------------------ | ---- | ----------------------------------------------------- | ------------- |
| 1   | `src/routes/api/cell-towers/nearby/+server.ts`         | 89   | `console.log('Cell tower DB...failed:')`              | `logError`    |
| 2   | `src/routes/api/gsm-evil/scan/+server.ts`              | 156  | `console.log('Both log analysis and tcpdump failed')` | `logError`    |
| 3   | `src/routes/api/gsm-evil/scan/+server.ts`              | 249  | `console.log('Error testing...')`                     | `logError`    |
| 4   | `src/routes/api/gsm-evil/scan/+server.ts`              | 259  | `console.log('Warning: Failed to clean up')`          | `logWarn`     |
| 5   | `src/routes/api/gsm-evil/tower-location/+server.ts`    | 64   | `console.log('OpenCellID API error:')`                | `logError`    |
| 6   | `src/lib/server/wireshark.ts`                          | 212  | `console.log('Error checking...')`                    | `logError`    |
| 7   | `src/lib/server/wireshark.ts`                          | 270  | `console.log('[WARN] Array parse error:')`            | `logWarn`     |
| 8   | `src/lib/server/wireshark.ts`                          | 311  | `console.log('[WARN] JSON parse error:')`             | `logWarn`     |
| 9   | `src/lib/server/hardware/detection/serial-detector.ts` | 71   | `console.log('Could not read...')`                    | `logWarn`     |

**Note**: Items 1-5 are in Batch 2 (API routes, Phase 3.1.4), but the table is included here as a reference for all batches. Items 6-9 are in this batch.

---

## Per-Batch Procedure (Applies to ALL 7 Batches)

For each file in the batch:

1. Add `import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';` (import only the functions actually used)
2. Replace each `console.*` call per the Semantic Log Level Mapping Rule above
3. For `console.error('msg', err)` patterns, use `logError('msg', { error: String(err) })`
4. For `console.log('msg', data)` patterns, use `logInfo('msg', { data })` (or `logError` if the message indicates failure)
5. Run `npm run typecheck` -- must pass
6. Run `npm run lint` -- must pass
7. Run `npm run test:unit` -- must pass (if tests exist for affected files)
8. Commit the batch

---

## Complete File Inventory -- Batch 1: `src/lib/server/` (34 files, ~192 statements)

| #   | File                                                                | Count | Methods                 |
| --- | ------------------------------------------------------------------- | ----- | ----------------------- |
| 1   | `src/lib/server/wireshark.ts`                                       | 30    | 18 log, 9 error, 3 warn |
| 2   | `src/lib/server/wifite/processManager.ts`                           | 21    | 7 log, 11 error, 3 warn |
| 3   | `src/lib/server/agent/tool-execution/init.ts`                       | 18    | 11 log, 5 error, 2 warn |
| 4   | `src/lib/server/hardware/detection/hardware-detector.ts`            | 15    | 10 log, 3 error, 2 warn |
| 5   | `src/lib/server/mcp/registry-integration.ts`                        | 14    | 5 log, 6 error, 3 warn  |
| 6   | `src/lib/server/agent/tool-execution/router.ts`                     | 10    | 4 log, 4 error, 2 warn  |
| 7   | `src/lib/server/agent/tool-execution/detection/detector.ts`         | 9     | 5 log, 3 error, 1 warn  |
| 8   | `src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts`       | 9     | 3 log, 4 error, 2 warn  |
| 9   | `src/lib/server/websockets.ts`                                      | 7     | 3 log, 3 error, 1 warn  |
| 10  | `src/lib/server/hardware/detection/serial-detector.ts`              | 7     | 4 log, 2 error, 1 warn  |
| 11  | `src/lib/server/agent/tool-execution/executor.ts`                   | 7     | 2 log, 3 error, 2 warn  |
| 12  | `src/lib/server/kismet/serviceManager.ts`                           | 6     | 3 log, 2 error, 1 warn  |
| 13  | `src/lib/server/db/migrations/runMigrations.ts`                     | 6     | 4 log, 2 error          |
| 14  | `src/lib/server/websocket-server.ts`                                | 5     | 2 log, 2 error, 1 warn  |
| 15  | `src/lib/server/gsm-database-path.ts`                               | 5     | 3 log, 2 error          |
| 16  | `src/lib/server/mcp/dynamic-server.ts`                              | 4     | 2 log, 1 error, 1 warn  |
| 17  | `src/lib/server/agent/tool-execution/adapters/internal-adapter.ts`  | 4     | 1 log, 2 error, 1 warn  |
| 18  | `src/lib/server/mcp/config-generator.ts`                            | 3     | 2 log, 1 error          |
| 19  | `src/lib/server/hardware/hardware-registry.ts`                      | 3     | 2 log, 1 error          |
| 20  | `src/lib/server/agent/tool-execution/registry.ts`                   | 3     | 2 log, 1 error          |
| 21  | `src/lib/server/agent/tool-execution/detection/docker-detector.ts`  | 3     | 2 log, 1 error          |
| 22  | `src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts` | 3     | 1 log, 1 error, 1 warn  |
| 23  | `src/lib/server/agent/tool-execution/adapters/http-adapter.ts`      | 3     | 1 log, 1 error, 1 warn  |
| 24  | `src/lib/server/agent/tool-execution/adapters/cli-adapter.ts`       | 3     | 1 log, 1 error, 1 warn  |
| 25  | `src/lib/server/mcp/server.ts`                                      | 2     | 1 log, 1 error          |
| 26  | `src/lib/server/kismet/scriptManager.ts`                            | 2     | 1 log, 1 error          |
| 27  | `src/lib/server/kismet/kismetProxy.ts`                              | 2     | 1 error, 1 warn         |
| 28  | `src/lib/server/hardware/detection/usb-detector.ts`                 | 2     | 1 log, 1 error          |
| 29  | `src/lib/server/hardware/detection/network-detector.ts`             | 2     | 1 error, 1 warn         |
| 30  | `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 2     | 1 log, 1 error          |
| 31  | `src/lib/server/agent/tool-execution/detection/service-detector.ts` | 2     | 1 log, 1 error          |
| 32  | `src/lib/server/agent/tool-execution/detection/tool-mapper.ts`      | 1     | 1 error                 |
| 33  | `src/lib/server/agent/tool-execution/detection/binary-detector.ts`  | 1     | 1 log                   |
| 34  | `src/lib/server/agent/runtime.ts`                                   | 1     | 1 error                 |

**Total**: 192 statements across 34 files.

---

## Commit Message

```
fix(logging): migrate console.* to structured logger -- batch 1 (server core, 34 files)

Mechanical replacement of 192 console.* calls with structured logger in
src/lib/server/. Applied semantic log level mapping: console.log calls
with error/warning message text corrected to logError/logWarn.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

```bash
# 1. Zero console.* in server code (excluding logger.ts)
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/ --include="*.ts" | grep -v logger.ts | wc -l
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

# 5. Verify wireshark.ts misleveled calls were corrected
grep -n "logWarn.*parse error" src/lib/server/wireshark.ts | wc -l
# Expected: 2 (lines 270, 311 corrected from console.log to logWarn)

grep -n "logError.*Error checking" src/lib/server/wireshark.ts | wc -l
# Expected: 1 (line 212 corrected from console.log to logError)
```

## Risk Assessment

| Risk                                                    | Likelihood | Impact | Mitigation                                                             |
| ------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Misleveled migration (logInfo for error condition)      | MEDIUM     | MEDIUM | Semantic mapping rule + 4 known mislevels in this batch identified     |
| Import path wrong in deeply nested agent files          | LOW        | LOW    | TypeScript will catch at typecheck; all use `$lib/utils/logger`        |
| Performance impact from structured logging in hot paths | VERY LOW   | LOW    | Logger has rate limiting; hot path files already identified in Phase 1 |

## Success Criteria

- Zero `console.*` calls in `src/lib/server/` (excluding `logger.ts`)
- All 4 misleveled calls in this batch (wireshark.ts lines 212, 270, 311; serial-detector.ts line 71) corrected to proper levels
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test:unit` exits 0

## Execution Tracking

| #    | File                                    | Count | Status  | Started | Completed | Verified By |
| ---- | --------------------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1    | wireshark.ts                            | 30    | PENDING | --      | --        | --          |
| 2    | wifite/processManager.ts                | 21    | PENDING | --      | --        | --          |
| 3    | agent/tool-execution/init.ts            | 18    | PENDING | --      | --        | --          |
| 4    | hardware/detection/hardware-detector.ts | 15    | PENDING | --      | --        | --          |
| 5    | mcp/registry-integration.ts             | 14    | PENDING | --      | --        | --          |
| 6-34 | (remaining 29 files)                    | 94    | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Partially-migrated files must be clean first
- **Parallel with**: [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) -- Batches 2-7 can run in parallel after 3.1.2
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation requires all batches complete
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.4, Batch 1
- **Misleveled calls reference**: Items 6-9 in the misleveled calls table are in this batch; items 1-5 are in [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md)
