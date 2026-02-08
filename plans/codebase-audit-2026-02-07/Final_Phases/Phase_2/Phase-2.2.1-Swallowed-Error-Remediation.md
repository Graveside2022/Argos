# Phase 2.2.1: Swallowed Error Remediation

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR33-C (Detect and Handle Standard Library Errors), OWASP A09:2021 (Security Logging and Monitoring Failures)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Eliminate all 39 instances of `.catch(() => {})` and approximately 83 additional broader error-suppression patterns across the Argos codebase. Every silently swallowed error is a diagnostic black hole -- when a failure occurs in a field-deployed tactical system, zero evidence of the root cause is preserved.

## Execution Constraints

| Constraint        | Value                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Risk Level        | MEDIUM -- Behavioral changes to error handling paths                                                |
| Severity          | MEDIUM                                                                                              |
| Prerequisites     | Phase 2.1 complete (authentication middleware and input sanitization library must be in place)      |
| Files Touched     | ~30 files across routes and server layers                                                           |
| Blocks            | Phase 2.2.4 (JSON.parse validation depends on error handling patterns being consistent)             |
| Blocked By        | Phase 2.1 (security middleware must exist before hardening error paths)                             |
| Logger Dependency | Phase 3 Task 3.1 (Logger). Use `console.error`/`console.warn` as interim until logger is available. |

## Threat Context

On a field-deployed Raspberry Pi 5 running RF signal intelligence operations during Army EW training exercises, silent error suppression creates the following tactical risks:

1. **Hardware failure blindness**: If `pkill` or `systemctl` operations fail silently, operators have no indication that RF hardware (HackRF, USRP) has entered an undefined state.
2. **Network intelligence gaps**: Fetch and API call failures to Kismet, Bettercap, or GSM Evil that are swallowed silently produce SIGINT coverage gaps with no alerting.
3. **Post-incident forensics failure**: When something goes wrong in the field, log files contain zero evidence of the failure chain because errors were discarded.
4. **Cascading state corruption**: Docker container management operations that fail silently leave containers in unexpected states, causing subsequent operations to fail in unpredictable ways.

Per CERT ERR33-C: "Library functions that indicate errors by means of a return value must have every return value checked for the presence of an error." The `.catch(() => {})` pattern is the JavaScript equivalent of ignoring return values.

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

### Exact-Match Count

```bash
grep -rn "\.catch.*=>.*{}" src/ --include="*.ts" | grep -v "logger\.\|console\." | wc -l
# Result: 39
```

### Broader Error Suppression Count

```bash
# Returns literal, discards error
grep -rn "\.catch.*=>.*(null\|false\|undefined\|0\|''\|\"\")" src/ --include="*.ts" | wc -l

# Bare catch blocks
grep -rn "catch\s*{" src/ --include="*.ts" | wc -l

# Catch with unused error variable
grep -rn "catch\s*(_\w*)" src/ --include="*.ts" | wc -l
```

**Total**: 39 exact-match + ~83 broader = ~122 error-suppression patterns.

**REGRADE CORRECTION (C4)**: The exact `.catch(() => {})` count is **39** (not 38 as previously reported; the instance at `tactical-map/cell-towers/+server.ts:92` was missed in earlier counts). The broader error-suppression scope (~122 total) was identified by the independent regrade and is addressed in Subtask 2.2.1.5.

## Implementation Plan

### Subtask 2.2.1.1: Categorize All 39 Instances by Severity

Each swallowed error falls into one of five operational categories. The category determines the appropriate log level in the replacement pattern.

| Category                       | Pattern                                          | Count | Log Level | Fix Strategy                                                               |
| ------------------------------ | ------------------------------------------------ | ----- | --------- | -------------------------------------------------------------------------- |
| Process cleanup (pkill, kill)  | `.catch(() => {})` after `hostExec('pkill ...')` | 14    | WARN      | Log at WARN level -- cleanup failures are non-fatal but diagnostic         |
| Docker operations              | `.catch(() => {})` after `docker stop/rm/start`  | 6     | WARN      | Log at WARN level -- container state may be unexpected                     |
| Service management (systemctl) | `.catch(() => {})` after `systemctl stop`        | 4     | WARN      | Log at WARN level -- service may already be stopped                        |
| Network/API operations         | `.catch(() => {})` after fetch/curl/API calls    | 6     | ERROR     | Log at ERROR level -- network failures need immediate investigation        |
| File/resource cleanup          | `.catch(() => {})` after rm/unlink operations    | 8     | DEBUG     | Log at DEBUG level -- resource may already be removed (idempotent cleanup) |

**Total**: 14 + 6 + 4 + 6 + 8 = **38** (plus 1 tactical-map instance = **39**). The tactical-map instance (#39) falls under Network/API operations (Python subprocess call).

### Subtask 2.2.1.2: Replacement Template

Every `.catch(() => {})` instance is replaced with a catch handler that logs the error with contextual information. The replacement pattern is identical in structure; only the log level, component name, and operation description vary.

**BEFORE (vulnerable)**:

```typescript
await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch(() => {});
```

**AFTER (secure)**:

```typescript
await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch((error: unknown) => {
	console.warn('[gsm-evil] Cleanup: pkill GsmEvil failed', { error: String(error) });
});
```

**Note on `logger.logWarn`**: The replacement examples use `console.warn` and `console.error` as interim logging. When Phase 3 Task 3.1 (Logger Service) is complete, a follow-on commit will convert all `console.warn`/`console.error` calls in catch handlers to the structured logger. The structured replacements will follow this pattern:

```typescript
// Phase 3 follow-on replacement:
await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch((error: unknown) => {
	logger.logWarn('[gsm-evil] Cleanup: pkill GsmEvil failed', { error: String(error) });
});
```

**Template by log level**:

| Log Level | Pattern                                                                                              | Used For                           |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| WARN      | `console.warn('[component] Operation: description failed', { error: String(error) });`               | Process cleanup, Docker, systemctl |
| ERROR     | `console.error('[component] Operation: description failed', { error: String(error) });`              | Network/API operations             |
| DEBUG     | `console.debug('[component] Cleanup: description failed (non-critical)', { error: String(error) });` | File/resource cleanup              |

### Subtask 2.2.1.3: Complete File List (All 39 Locations)

Every instance is enumerated below with exact file path and line number. No "run grep at execution time" placeholders exist.

#### gsm-evil routes (9 instances)

| #   | File                                                         | Line | Category        | Log Level |
| --- | ------------------------------------------------------------ | ---- | --------------- | --------- |
| 1   | `src/routes/api/gsm-evil/control/+server.ts`                 | 86   | Process cleanup | WARN      |
| 2   | `src/routes/api/gsm-evil/control/+server.ts`                 | 156  | Process cleanup | WARN      |
| 3   | `src/routes/api/gsm-evil/control/+server.ts`                 | 157  | Process cleanup | WARN      |
| 4   | `src/routes/api/gsm-evil/control/+server.ts`                 | 169  | Process cleanup | WARN      |
| 5   | `src/routes/api/gsm-evil/control/+server.ts`                 | 170  | Process cleanup | WARN      |
| 6   | `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 448  | Process cleanup | WARN      |
| 7   | `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 451  | Process cleanup | WARN      |
| 8   | `src/routes/api/gsm-evil/intelligent-scan/+server.ts`        | 95   | Process cleanup | WARN      |
| 9   | `src/routes/api/gsm-evil/scan/+server.ts`                    | 260  | Process cleanup | WARN      |

#### openwebrx routes (8 instances)

| #   | File                                          | Line | Category          | Log Level |
| --- | --------------------------------------------- | ---- | ----------------- | --------- |
| 10  | `src/routes/api/openwebrx/control/+server.ts` | 82   | Docker operations | WARN      |
| 11  | `src/routes/api/openwebrx/control/+server.ts` | 91   | Docker operations | WARN      |
| 12  | `src/routes/api/openwebrx/control/+server.ts` | 113  | Docker operations | WARN      |
| 13  | `src/routes/api/openwebrx/control/+server.ts` | 135  | Docker operations | WARN      |
| 14  | `src/routes/api/openwebrx/control/+server.ts` | 145  | File cleanup      | DEBUG     |
| 15  | `src/routes/api/openwebrx/control/+server.ts` | 146  | File cleanup      | DEBUG     |
| 16  | `src/routes/api/openwebrx/control/+server.ts` | 152  | Docker operations | WARN      |
| 17  | `src/routes/api/openwebrx/control/+server.ts` | 157  | Docker operations | WARN      |

#### kismet routes (5 instances)

| #   | File                                          | Line | Category           | Log Level |
| --- | --------------------------------------------- | ---- | ------------------ | --------- |
| 18  | `src/routes/api/kismet/control/+server.ts`    | 174  | Service management | WARN      |
| 19  | `src/routes/api/kismet/control/+server.ts`    | 180  | Service management | WARN      |
| 20  | `src/routes/api/kismet/start-safe/+server.ts` | 10   | Process cleanup    | WARN      |
| 21  | `src/routes/api/kismet/start-safe/+server.ts` | 20   | Service management | WARN      |
| 22  | `src/routes/api/kismet/start-safe/+server.ts` | 22   | Service management | WARN      |

#### droneid routes (1 instance)

| #   | File                                | Line | Category        | Log Level |
| --- | ----------------------------------- | ---- | --------------- | --------- |
| 23  | `src/routes/api/droneid/+server.ts` | 192  | Process cleanup | WARN      |

#### tactical-map routes (1 instance)

**REGRADE ADDITION**: This instance was missed in the original count (was 38, corrected to 39).

| #      | File                                                     | Line   | Category        | Log Level |
| ------ | -------------------------------------------------------- | ------ | --------------- | --------- |
| **24** | **`src/routes/api/tactical-map/cell-towers/+server.ts`** | **92** | **Network/API** | **ERROR** |

#### wifite server layer (7 instances)

| #   | File                                      | Line | Category        | Log Level |
| --- | ----------------------------------------- | ---- | --------------- | --------- |
| 25  | `src/lib/server/wifite/processManager.ts` | 94   | Process cleanup | WARN      |
| 26  | `src/lib/server/wifite/processManager.ts` | 102  | Process cleanup | WARN      |
| 27  | `src/lib/server/wifite/processManager.ts` | 124  | File cleanup    | DEBUG     |
| 28  | `src/lib/server/wifite/processManager.ts` | 127  | File cleanup    | DEBUG     |
| 29  | `src/lib/server/wifite/processManager.ts` | 342  | Process cleanup | WARN      |
| 30  | `src/lib/server/wifite/processManager.ts` | 365  | File cleanup    | DEBUG     |
| 31  | `src/lib/server/wifite/processManager.ts` | 367  | File cleanup    | DEBUG     |

#### bettercap server layer (3 instances)

| #   | File                                    | Line | Category    | Log Level |
| --- | --------------------------------------- | ---- | ----------- | --------- |
| 32  | `src/lib/server/bettercap/apiClient.ts` | 78   | Network/API | ERROR     |
| 33  | `src/lib/server/bettercap/apiClient.ts` | 79   | Network/API | ERROR     |
| 34  | `src/lib/server/bettercap/apiClient.ts` | 103  | Network/API | ERROR     |

#### kismet server layer (2 instances)

| #   | File                                      | Line | Category        | Log Level |
| --- | ----------------------------------------- | ---- | --------------- | --------- |
| 35  | `src/lib/server/kismet/serviceManager.ts` | 92   | Process cleanup | WARN      |
| 36  | `src/lib/server/kismet/serviceManager.ts` | 95   | Process cleanup | WARN      |

#### btle server layer (1 instance)

| #   | File                                    | Line | Category        | Log Level |
| --- | --------------------------------------- | ---- | --------------- | --------- |
| 37  | `src/lib/server/btle/processManager.ts` | 71   | Process cleanup | WARN      |

#### pagermon server layer (1 instance)

| #   | File                                        | Line | Category        | Log Level |
| --- | ------------------------------------------- | ---- | --------------- | --------- |
| 38  | `src/lib/server/pagermon/processManager.ts` | 79   | Process cleanup | WARN      |

#### Summary by Module

| Module              | Instances | Files  |
| ------------------- | --------- | ------ |
| gsm-evil routes     | 9         | 4      |
| openwebrx routes    | 8         | 1      |
| wifite server       | 7         | 1      |
| kismet routes       | 5         | 2      |
| bettercap server    | 3         | 1      |
| kismet server       | 2         | 1      |
| droneid routes      | 1         | 1      |
| tactical-map routes | 1         | 1      |
| btle server         | 1         | 1      |
| pagermon server     | 1         | 1      |
| **TOTAL**           | **39**    | **14** |

### Subtask 2.2.1.4: Verification (Exact-Match Scope)

After fixing all 39 instances, execute the following verification commands:

```bash
# Verification 1: Count empty catch patterns remaining (exact match)
grep -rn "\.catch(\s*(\s*)\s*=>" src/ --include="*.ts" | wc -l
# Expected: 0

# Verification 2: Count catches without logging
grep -rn "\.catch(\s*(\s*_?\s*)\s*=>\s*{" src/ --include="*.ts" | grep -v "logger\.\|console\." | wc -l
# Expected: 0
```

If either command returns a non-zero value, the task is incomplete. Re-run the grep without `wc -l` to identify the remaining instances and remediate.

### Subtask 2.2.1.5: Fix Broader Error Suppression Patterns (REGRADE C4)

**Scope**: After fixing the 39 exact-match `.catch(() => {})` patterns, this subtask addresses the remaining ~83 broader error-suppression patterns identified by the independent regrade.

**Broader pattern categories**:

| Pattern                                       | Example                                   | Risk                                       |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `.catch(() => null)` / `.catch(() => false)`  | `.catch(() => null)` after fetch          | Returns a literal, discards all error info |
| `.catch(() => undefined)` / `.catch(() => 0)` | `.catch(() => undefined)` after API call  | Returns a literal, discards all error info |
| `.catch(() => '')` / `.catch(() => "")`       | `.catch(() => '')` after string operation | Returns a literal, discards all error info |
| `catch (e) { /* empty */ }` / `catch {}`      | `try { ... } catch {}`                    | Bare catch block, zero diagnostic output   |
| `catch (_error) { ... }` (unused variable)    | `catch (_error) { return defaults; }`     | Captures error but never references it     |
| `catch (e) { return defaultValue; }` (no log) | `catch (e) { return []; }`                | Returns fallback, discards error silently  |

**Discovery commands** (execute at task start to enumerate the full list):

```bash
# Find .catch returning literals
grep -rn "\.catch.*=>.*\(null\|false\|undefined\|0\|''\|\"\")" src/ --include="*.ts" | wc -l

# Find bare catch blocks
grep -rn "catch\s*{" src/ --include="*.ts" | wc -l

# Find catch with unused error variable
grep -rn "catch\s*(_\w*)" src/ --include="*.ts" | wc -l
```

**Fix strategy**: Same replacement template as Subtask 2.2.1.2. For each instance:

1. Identify the operation category (process cleanup, Docker, systemctl, network/API, file cleanup).
2. Determine the appropriate log level from the Subtask 2.2.1.1 category table.
3. Replace with the corresponding logging catch handler.
4. For catch blocks returning fallback values (e.g., `catch (e) { return []; }`), add a log line before the return statement -- do not remove the return.

**BEFORE (broader pattern)**:

```typescript
const result = await fetchKismetDevices().catch(() => null);
```

**AFTER (secure)**:

```typescript
const result = await fetchKismetDevices().catch((error: unknown) => {
	console.error('[kismet] fetchKismetDevices failed', { error: String(error) });
	return null;
});
```

**Verification (broader scope)**:

```bash
# No error-suppressing catch patterns remain
grep -Prn "\.catch\(\s*\(\)\s*=>\s*(null|false|undefined|0|''|\"\")\)" src/ --include="*.ts" | wc -l
# Expected: 0
```

## Verification Checklist

| #   | Command                                                                                                      | Expected Result | Purpose                           |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------- | --------------------------------- |
| 1   | `grep -rn "\.catch(\s*(\s*)\s*=>" src/ --include="*.ts" \| wc -l`                                            | 0               | Zero exact-match swallowed errors |
| 2   | `grep -rn "\.catch(\s*(\s*_?\s*)\s*=>\s*{" src/ --include="*.ts" \| grep -v "logger\.\|console\." \| wc -l`  | 0               | Zero catches without logging      |
| 3   | `grep -Prn "\.catch\(\s*\(\)\s*=>\s*(null\|false\|undefined\|0\|''\|\"\")\)" src/ --include="*.ts" \| wc -l` | 0               | Zero broader suppression patterns |
| 4   | `npm run typecheck`                                                                                          | Exit 0          | No type regressions introduced    |
| 5   | `npm run build`                                                                                              | Exit 0          | Build integrity preserved         |

## Commit Strategy

This task produces one atomic commit:

```
security(phase2.2.1): replace 39 swallowed error patterns with diagnostic logging

Phase 2.2 Task 1: Fix ALL swallowed error patterns
- 39 .catch(() => {}) instances replaced with category-appropriate logging
- ~83 broader error suppression patterns addressed
- Log levels: WARN (cleanup/docker/systemctl), ERROR (network/API), DEBUG (file cleanup)
Verified: grep empty-catch = 0, grep no-logging-catch = 0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Single-task rollback (preserves staging area)
git reset --soft HEAD~1

# Full verification after rollback
npm run typecheck && npm run build
```

No runtime data is at risk. All changes are to error handler code paths. Rollback restores the previous silent error behavior.

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                              |
| --------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Excessive log volume from formerly silent errors    | MEDIUM     | LOW    | Log levels are categorized (DEBUG for cleanup = filtered in production) |
| Catch handler introduces new exception              | LOW        | LOW    | `String(error)` is safe for all input types                             |
| Performance impact from logging in hot paths        | LOW        | LOW    | None of the 39 instances are in hot paths (all are cleanup/init)        |
| Behavioral change in error-returns-literal patterns | MEDIUM     | MEDIUM | Return value is preserved; only logging is added                        |

## Standards Traceability

| Standard            | Requirement                                                            | Satisfied By                                    |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| CERT ERR33-C        | Detect and handle standard library errors                              | All 39+83 catch handlers now log                |
| OWASP A09:2021      | Security Logging and Monitoring Failures                               | Error events now produce log entries            |
| NIST SP 800-53 AU-2 | Audit Events -- system must generate audit records for security events | Error conditions now logged for forensic review |
| DISA STIG V-222602  | Application must not suppress error messages                           | Zero silent error suppression after remediation |

## Execution Tracking

| Subtask | Description                       | Status  | Started | Completed | Verified By |
| ------- | --------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.1.1 | Categorize by severity            | PENDING | --      | --        | --          |
| 2.2.1.2 | Replacement template defined      | PENDING | --      | --        | --          |
| 2.2.1.3 | Fix all 39 exact-match locations  | PENDING | --      | --        | --          |
| 2.2.1.4 | Verification (exact-match scope)  | PENDING | --      | --        | --          |
| 2.2.1.5 | Fix ~83 broader error suppression | PENDING | --      | --        | --          |
