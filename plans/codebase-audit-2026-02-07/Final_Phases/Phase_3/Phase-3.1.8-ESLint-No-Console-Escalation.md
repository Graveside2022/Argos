# Phase 3.1.8: ESLint `no-console` Escalation to Error

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.7 (no side effects in debug code), MISRA C 2012 Rule 2.4 (no dead code), NASA/JPL Rule 1 (simple control flow), CERT ERR00-C (consistent error handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.8
**Risk Level**: LOW -- ESLint config change; build will fail if any console.\* was missed
**Prerequisites**: ALL of [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) complete
**Blocks**: Phase 3.2 (Constants Centralization), Phase 3.3 (ESLint Enforcement)
**Estimated Files Touched**: 1 (`config/eslint.config.js`)
**Standards**: BARR-C Rule 8.7, MISRA C 2012 Rule 2.4, NASA/JPL Rule 1

---

## Objective

Escalate the ESLint `no-console` rule from `warn` to `error` with zero allowed methods, permanently preventing new `console.*` calls from entering the codebase. This is the final gating task that locks in all 7 batches of migration work.

## Current State Assessment

| Metric                                         | Current Value         | Target Value | Verification Command                        |
| ---------------------------------------------- | --------------------- | ------------ | ------------------------------------------- |
| ESLint `no-console` level                      | `warn`                | `error`      | `grep "no-console" config/eslint.config.js` |
| Allowed console methods                        | `['warn', 'error']`   | `[]` (none)  | Same                                        |
| Total console.\* in src/ (excluding logger.ts) | 0 (after all batches) | 0            | Comprehensive grep                          |

## Scope

This task modifies exactly 1 file: `config/eslint.config.js`. It changes the `no-console` rule severity and removes all allowed methods. Two exception cases are documented below.

---

## Execution Steps

### Step 1: Modify ESLint Configuration

**File**: `config/eslint.config.js`, line 77

```javascript
// BEFORE:
'no-console': ['warn', { allow: ['warn', 'error'] }]

// AFTER:
'no-console': ['error', { allow: [] }]
```

### Step 2: Verify `validate-env.js` Exception

**File**: `src/lib/server/validate-env.js`

This file is `.js` (not `.ts`) and is in Block 2 of the ESLint config which does NOT have the `no-console` rule. It is naturally excluded from the rule.

**Verification**:

```bash
npx eslint --no-eslintrc -c config/eslint.config.js src/lib/server/validate-env.js 2>&1 | grep "no-console"
# Expected: no output (rule doesn't apply to .js files in this config)
```

### Step 3: Verify `logger.ts` Exception

**File**: `src/lib/utils/logger.ts`

After Phase 3.1.0 Defect 2 fix, logger.ts uses `console.log`, `console.debug`, `console.error`, `console.warn`. Each call requires `// eslint-disable-next-line no-console` (4 inline disables total). These should already be in place from Phase 3.1.0.

**Verification**:

```bash
grep -c "eslint-disable-next-line no-console" src/lib/utils/logger.ts
# Expected: 4
```

### Step 4: Run Full Lint Check

```bash
npm run lint 2>&1 | grep "no-console" | wc -l
# Expected: 0
```

If this returns anything other than 0, there are missed `console.*` calls that escaped the batch migrations. Fix them before proceeding.

---

## Commit Message

```
build(eslint): escalate no-console from warn to error with zero exemptions

After completing 7-batch migration of ~690 console.* calls to the
structured logger, lock in the change by making any new console.* call
a build-breaking error. Only logger.ts has inline ESLint disables (4
calls, one per log level). validate-env.js is naturally excluded as a
.js file.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Phase 3.1 Verification Checklist (Complete -- All 16 Checks)

This checklist covers the ENTIRE Phase 3.1 sub-phase. All 16 checks must pass before Phase 3.1 is considered complete and Phase 3.2 can begin.

| #   | Check                                | Command                                                                                                                                      | Expected                                 |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Logger uses globalThis singleton     | `grep -n "globalThis" src/lib/utils/logger.ts \| wc -l`                                                                                      | 2+                                       |
| 2   | Logger routes INFO to console.log    | `grep -n "console\.log" src/lib/utils/logger.ts \| wc -l`                                                                                    | 1                                        |
| 3   | Logger routes DEBUG to console.debug | `grep -n "console\.debug" src/lib/utils/logger.ts \| wc -l`                                                                                  | 1                                        |
| 4   | No console.\* in server code         | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/server/ --include="*.ts" \| grep -v logger.ts \| wc -l`                | 0                                        |
| 5   | No console.\* in API routes          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/api/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 6   | No console.\* in services            | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/services/ --include="*.ts" \| wc -l`                                   | 0                                        |
| 7   | No console.\* in stores              | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" \| wc -l`                                     | 0                                        |
| 8   | No console.\* in components          | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" \| wc -l`            | 0                                        |
| 9   | No console.\* in pages               | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/routes/ --include="*.svelte" --include="*.ts" \| grep -v "/api/" \| wc -l` | 0                                        |
| 10  | ESLint no-console is error           | `grep "no-console" config/eslint.config.js`                                                                                                  | `'no-console': ['error', { allow: [] }]` |
| 11  | No commented-out console.\*          | `grep -rn --include="*.ts" --include="*.svelte" -E '^\s*//' src/ \| grep -E 'console\.(log\|warn\|error\|info\|debug\|trace)' \| wc -l`      | 0                                        |
| 12  | TypeScript compiles                  | `npm run typecheck`                                                                                                                          | Exit 0                                   |
| 13  | Build succeeds                       | `npm run build`                                                                                                                              | Exit 0                                   |
| 14  | Unit tests pass                      | `npm run test:unit`                                                                                                                          | Exit 0                                   |
| 15  | Lint passes                          | `npm run lint`                                                                                                                               | Exit 0, 0 errors                         |
| 16  | logging.ts deleted                   | `test -f src/lib/config/logging.ts && echo EXISTS \|\| echo DELETED`                                                                         | DELETED                                  |

---

## Complete Phase 3.1 Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                    |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------- |
| Logger globalThis change breaks tests              | LOW        | LOW    | All tests use the same global; singleton behavior unchanged   |
| console.log routing change alters browser output   | LOW        | LOW    | Output content identical; only console level changes          |
| Svelte SSR context lacks console.debug             | VERY LOW   | LOW    | All browsers and Node.js support console.debug                |
| Misleveled migration (logInfo for error condition) | MEDIUM     | MEDIUM | Semantic mapping rule + 9 known mislevels identified          |
| validate-env.js triggers lint errors               | LOW        | LOW    | .js files excluded from no-console rule in current config     |
| Phase 0 deletes files listed here                  | LOW        | LOW    | Only test-connection.ts is a candidate; batch 3 count adjusts |

---

## Phase 3.1 Dependencies Summary

| Dependency | Direction  | Detail                                                                                                                                              |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0    | UPSTREAM   | May delete `src/lib/services/websocket/test-connection.ts` (21 console.\* calls). If deleted before Phase 3.1, Batch 3 count drops from 124 to 103. |
| Phase 1    | UPSTREAM   | May remove dead code containing some console.\* calls, reducing batch counts slightly.                                                              |
| Phase 3.2  | DOWNSTREAM | Depends on logger migration being complete (constants referenced in log messages should use named constants).                                       |
| Phase 3.3  | DOWNSTREAM | Depends on ESLint no-console escalation being in place before adding additional rules.                                                              |

---

## Verification (This Task Only)

```bash
# 1. ESLint no-console is error with no allowed methods
grep "no-console" config/eslint.config.js
# Expected: 'no-console': ['error', { allow: [] }]

# 2. Full lint passes with zero no-console violations
npm run lint 2>&1 | grep "no-console" | wc -l
# Expected: 0

# 3. Build succeeds (ESLint errors would break build)
npm run build
# Expected: Exit 0

# 4. validate-env.js is not affected
npx eslint --no-eslintrc -c config/eslint.config.js src/lib/server/validate-env.js 2>&1 | grep "no-console"
# Expected: no output

# 5. logger.ts has exactly 4 inline disables
grep -c "eslint-disable-next-line no-console" src/lib/utils/logger.ts
# Expected: 4
```

## Risk Assessment (This Task Only)

| Risk                                    | Likelihood | Impact | Mitigation                                                      |
| --------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Missed console.\* call breaks build     | MEDIUM     | LOW    | Run comprehensive grep before changing rule; fix any stragglers |
| validate-env.js affected by rule change | LOW        | LOW    | Verified: .js files excluded from this ESLint config block      |
| logger.ts missing inline disables       | LOW        | LOW    | Phase 3.1.0 adds them; verify with grep before escalation       |

## Success Criteria

- `config/eslint.config.js` has `'no-console': ['error', { allow: [] }]`
- `npm run lint` exits 0 with zero `no-console` violations
- `npm run build` exits 0
- `validate-env.js` is not affected by the rule
- `logger.ts` has exactly 4 `eslint-disable-next-line no-console` directives
- All 16 Phase 3.1 verification checklist items pass

## Execution Tracking

| Step | Description                                 | Status  | Started | Completed | Verified By |
| ---- | ------------------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Modify ESLint config                        | PENDING | --      | --        | --          |
| 2    | Verify validate-env.js exception            | PENDING | --      | --        | --          |
| 3    | Verify logger.ts exception                  | PENDING | --      | --        | --          |
| 4    | Run full lint check                         | PENDING | --      | --        | --          |
| 5    | Run Phase 3.1 complete checklist (16 items) | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.6](Phase-3.1.6-Batch-Migration-Stores-Components.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md) -- ALL batches must be complete
- **Depends on**: [Phase 3.1.0](Phase-3.1.0-Logger-Infrastructure-Defect-Repair.md) -- Logger must have ESLint inline disables in place
- **Blocks**: Phase 3.2 (Constants Centralization) -- Cannot add constant-based log messages until logging is stable
- **Blocks**: Phase 3.3 (ESLint Enforcement) -- Cannot add additional ESLint rules until no-console is enforced
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.5 + Verification Checklist + Risk Assessment + Dependencies
