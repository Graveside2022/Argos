# Phase 3.3.2: Promise Chain Silent Swallowing Fix

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (Consistent Error Handling), OWASP A09:2021 (Security Logging and Monitoring Failures)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.3 -- ESLint Enforcement, TODO Resolution, and Error Hygiene
**Task ID**: 3.3.2
**Risk Level**: MEDIUM -- Behavioral changes to error handling paths
**Prerequisites**: Phase 3.1 (Logger infrastructure required for WARN/ERROR logging)
**Blocks**: Phase 3.4 (Defensive Coding depends on consistent error handling)
**Estimated Files Touched**: 23
**Standards**: CERT ERR00-C (consistent error handling), OWASP A09:2021 (security logging failures)

---

## Objective

Replace all 68 `.catch(() => {})` instances (promise-chain error swallowing) with explicit error handling that either logs the failure or documents why logging is unnecessary.

## Correction History

| Date       | Correction ID | Description                                                                                                                                                                                                                                                                                    |
| ---------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-08 | CA-02         | **ADDED**: This entire task was added on 2026-02-08. Phase 3.3.2's original scope only targeted `catch(variable)` blocks. The syntactically distinct pattern `.catch(() => {})` (promise-chain error swallowing) was invisible to the regex and was completely omitted from the original plan. |

## Current State Assessment

| Metric                                       | Value                          |
| -------------------------------------------- | ------------------------------ |
| Promise `.catch(() => {})` silent swallowing | 68 instances across 23 files   |
| Promise `.catch()` chains (total)            | 104                            |
| Catch blocks with unused error variables     | 478 (addressed in Phase 3.3.1) |

**Root Cause**: These 68 instances represent **fire-and-forget error suppression** -- the most dangerous form of error swallowing because there is no variable to even inspect. The error is discarded at the promise chain level before any catch block can examine it.

## Scope

### Most Dangerous Instances Requiring Explicit Handling

These instances control hardware, manage system processes, or interact with Docker containers. Silent failure in these paths leads to hardware state corruption, process leaks, or container leaks.

| #    | File                                          | Count | Risk                                                                           | Required Action                                                              |
| ---- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1    | `src/routes/api/openwebrx/control/+server.ts` | 8     | Docker operations silently fail -- container leaks invisible to UI             | Replace with `logWarn('Docker operation failed', { error: String(_e) })`     |
| 2    | `src/lib/server/wifite/processManager.ts`     | 7     | airmon-ng cleanup failures leave WiFi adapter in monitor mode                  | Replace with `logWarn('WiFi adapter cleanup failed', { error: String(_e) })` |
| 3    | `src/routes/api/gsm-evil/control/+server.ts`  | 4     | `sudo pkill` failures leave old process running, new process fights for HackRF | Replace with `logWarn('Process cleanup failed', { error: String(_e) })`      |
| 4    | `src/lib/server/bettercap/apiClient.ts`       | 3     | Docker stop/rm swallowed -- container leak                                     | Replace with `logWarn`                                                       |
| 5    | `src/routes/api/droneid/+server.ts`           | 2     | PID file and process cleanup failures                                          | Replace with `logWarn`                                                       |
| 6-23 | (18 additional files)                         | 44    | Various cleanup operations                                                     | Triage per standard rules below                                              |

### Triage Rules for All `.catch(() => {})` Instances

**Rule 1 -- Failure changes system state** (process still running, adapter still in monitor mode, container still alive): Replace with explicit error handling that at minimum logs at WARN level.

```typescript
// BEFORE (dangerous):
await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch(() => {});

// AFTER (compliant):
await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch((error: unknown) => {
	logWarn('[gsm-evil] Cleanup: pkill GsmEvil failed', { error: String(error) });
});
```

**Rule 2 -- Failure is truly inconsequential** (optional telemetry, non-critical UI update): Replace with documented silence.

```typescript
// BEFORE (ambiguous):
telemetryPing().catch(() => {});

// AFTER (documented):
telemetryPing().catch((_e) => {
	/* intentional: telemetry failure is non-critical and must not block UI */
});
```

**Rule 3 -- ABSOLUTE**: Never leave `.catch(() => {})` as-is. Every instance must either log or document why logging is unnecessary.

## Execution Steps

### Step 1: Enumerate All 68 Instances

```bash
grep -rn '\.catch\s*(\s*(\(\s*\)|\(\s*_\w*\s*\))\s*=>\s*{\s*})' src/ --include="*.ts" --include="*.svelte"
```

### Step 2: Categorize Each Instance

For each of the 68 instances, determine which triage rule applies:

- Rule 1 (system state risk): Process control, Docker, systemctl, hardware commands
- Rule 2 (inconsequential): Telemetry, optional UI updates, non-critical fetch

### Step 3: Apply Fixes

For Rule 1 instances: Add `logWarn` or `logError` with component name and operation description.
For Rule 2 instances: Add `(_e)` parameter and descriptive comment.

### Step 4: Verify Zero Remaining Instances

```bash
grep -rn '\.catch\s*(\s*(\(\s*\)|\(\s*_\w*\s*\))\s*=>\s*{\s*})' src/ --include="*.ts" --include="*.svelte" | wc -l
# Target: 0
```

## Commit Message

```
refactor(error-handling): replace 68 silent .catch(() => {}) with explicit handling or documented silence
```

## Verification

| #   | Check                                  | Command                                                                                                                              | Expected |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | No silent `.catch(() => {})` remaining | `grep -rn '\.catch\s*(\s*(\(\s*\)\|\(\s*_\w*\s*\))\s*=>\s*{\s*})' src/ --include="*.ts" --include="*.svelte" \| wc -l`               | 0        |
| 2   | All catch handlers log or document     | `grep -rn '\.catch' src/ --include="*.ts" \| grep -v "logger\.\|console\.\|logWarn\|logError\|logDebug\|intentional\|\/\*" \| wc -l` | 0        |
| 3   | TypeScript compiles                    | `npm run typecheck`                                                                                                                  | Exit 0   |
| 4   | Build succeeds                         | `npm run build`                                                                                                                      | Exit 0   |
| 5   | Unit tests pass                        | `npm run test:unit`                                                                                                                  | Exit 0   |

## Risk Assessment

| Risk                                              | Likelihood | Impact | Mitigation                                                                   |
| ------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------- |
| Excessive log volume from formerly silent errors  | MEDIUM     | LOW    | Log levels are categorized: DEBUG for cleanup = filtered in production       |
| Catch handler introduces new exception            | LOW        | LOW    | `String(error)` is safe for all input types                                  |
| Performance impact from logging in hot paths      | LOW        | LOW    | None of the 68 instances are in hot computation paths (all are cleanup/init) |
| Behavioral change breaks expected failure silence | LOW        | LOW    | Return values are preserved; only logging is added                           |

## Success Criteria

- [ ] All 68 `.catch(() => {})` instances replaced with either logging or documented silence
- [ ] Zero instances of `.catch(() => {})` pattern remaining in codebase
- [ ] Every catch handler either calls a logger function or contains a `/* intentional: ... */` comment
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.1 (Logger infrastructure for logWarn/logError calls)
- **Depended on by**: Phase 3.4 (Defensive Coding Foundations)
- **Related**: Phase 3.3.1 (Error Variable Catch Block Hygiene) -- addresses `catch(variable)` pattern
- **Related**: Phase 2.2.1 (Swallowed Error Remediation) -- Phase 2 addresses 39 exact-match instances independently; this task covers the full 68 from the Phase 3.3 scope
- **Overlap note**: Phase 2.2.1 and Phase 3.3.2 both target `.catch(() => {})` patterns. If Phase 2 executes first, the executing agent for this task must re-run the enumeration grep and address only remaining instances.

## Execution Tracking

| Step | Description                       | Status  | Started | Completed | Verified By |
| ---- | --------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Enumerate all 68 instances        | PENDING | --      | --        | --          |
| 2    | Categorize by triage rule         | PENDING | --      | --        | --          |
| 3    | Apply fixes (logging or document) | PENDING | --      | --        | --          |
| 4    | Verify zero remaining             | PENDING | --      | --        | --          |
