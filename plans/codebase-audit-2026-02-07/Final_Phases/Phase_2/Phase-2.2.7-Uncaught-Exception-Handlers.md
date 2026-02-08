# Phase 2.2.7: Uncaught Exception and Unhandled Rejection Handlers

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR33-C (Detect and Handle Standard Library Errors), CERT ERR06-J (Do Not Throw Undeclared Checked Exceptions), NIST SP 800-53 SI-17 (Fail-Safe Procedures), OWASP A09:2021 (Security Logging and Monitoring Failures)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Register global `uncaughtException` and `unhandledRejection` handlers in the SvelteKit server hooks to ensure that any unhandled error is logged to persistent storage before the process terminates, providing forensic evidence and preventing silent failures on a field-deployed tactical device.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | HIGH -- Global error handlers affect process lifecycle                                         |
| Severity      | HIGH                                                                                           |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 1 file (`src/hooks.server.ts`)                                                                 |
| Blocks        | None                                                                                           |
| Blocked By    | Phase 2.2.3 (security headers should be in place; hooks.server.ts is the same file)            |

## Threat Context

The Argos system runs as a single Node.js process on a Raspberry Pi 5 deployed in a tactical environment (NTC/JMRC for Army EW training exercises). Without global error handlers:

1. **Silent process death**: A single unhandled exception or unhandled promise rejection terminates the Node.js process immediately. In Node.js 15+, unhandled rejections trigger `process.exit(1)` by default. The operator sees a blank screen with no error message and no log entry explaining what happened.
2. **Loss of SIGINT capability**: When the Argos process dies, the operator loses real-time spectrum analysis, WiFi network intelligence, GPS tracking, and IMSI detection. There is no automated recovery mechanism -- the operator must SSH into the device and manually restart the service.
3. **Forensic black hole**: Without logging the fatal error before exit, post-incident analysis cannot determine the root cause. Was it a hardware driver failure? A malformed network packet? A memory exhaustion event? The answer is permanently lost.
4. **RF hardware in undefined state**: If the process dies while controlling HackRF or USRP hardware, the SDR device may continue transmitting or remain in an active state without software supervision.
5. **SystemD restart gap**: While SystemD can restart the service, the restart takes 5-10 seconds. During this gap, there is zero SIGINT coverage. The fatal error log is needed to determine if the restart will succeed or if the process will crash in a loop.

**REGRADE FINDING (B2)**: The original Phase 2.2 plan did not address `process.on('uncaughtException')` or `process.on('unhandledRejection')`. This task was added based on the independent regrade's identification of this gap.

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

```bash
# Search for existing global error handlers
grep -rn "uncaughtException\|unhandledRejection" src/ --include="*.ts" | wc -l
# Result: 0

# Search for any process.on handlers
grep -rn "process\.on(" src/ --include="*.ts"
# Result: SIGINT and SIGTERM handlers exist (with globalThis guards per Phase 1 memory leak fixes)
#         but NO uncaughtException or unhandledRejection handlers
```

**Current state**: Zero global error handlers for uncaught exceptions or unhandled rejections exist anywhere in the Argos codebase. The existing `SIGINT`/`SIGTERM` handlers (added during the memory leak audit) handle graceful shutdown signals but do not catch runtime errors.

## Implementation Plan

### Subtask 2.2.7.1: Add Global Error Handlers to hooks.server.ts

**File**: `src/hooks.server.ts`

Add the following code at module level (outside the `handle` function), wrapped in a `globalThis` guard to prevent duplicate registration during Vite HMR (Hot Module Replacement).

**Why globalThis guard is required**: During development, Vite HMR re-executes the module-level code in `hooks.server.ts` on every file change. Without the guard, each HMR cycle registers an additional pair of handlers. After 10 file saves, there would be 10 `uncaughtException` handlers, each calling `process.exit(1)`, causing 10 exit calls. The `globalThis` pattern was established during the Phase 1 memory leak audit and must be applied consistently.

**BEFORE (current state -- no handlers)**:

```typescript
// src/hooks.server.ts
// ... existing SIGINT/SIGTERM handlers with globalThis guard ...

export const handle: Handle = async ({ event, resolve }) => {
	// ... existing handle logic ...
};
```

**AFTER (with global error handlers)**:

```typescript
// src/hooks.server.ts

// === Global Error Handlers ===
// Register exactly once (globalThis guard for Vite HMR persistence)
if (!(globalThis as Record<string, unknown>).__errorHandlersRegistered) {
	(globalThis as Record<string, unknown>).__errorHandlersRegistered = true;

	process.on('uncaughtException', (error: Error) => {
		console.error('[FATAL] Uncaught exception:', error.message);
		console.error('[FATAL] Stack:', error.stack);
		// Log to persistent storage before exit.
		// When Phase 3 Logger is available, this will write to /var/log/argos/fatal.log
		// Do NOT attempt to continue -- process state is undefined after uncaught exception.
		// Node.js documentation: "It is not safe to resume normal operation after 'uncaughtException'."
		process.exit(1);
	});

	process.on('unhandledRejection', (reason: unknown) => {
		console.error('[FATAL] Unhandled rejection:', reason);
		// In Node.js 15+, unhandled rejections trigger process exit by default.
		// Explicitly exit to ensure consistent behavior across Node.js versions
		// and to guarantee the error is logged before termination.
		process.exit(1);
	});
}

// ... existing SIGINT/SIGTERM handlers ...

export const handle: Handle = async ({ event, resolve }) => {
	// ... existing handle logic ...
};
```

**Design decisions**:

| Decision                                   | Rationale                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process.exit(1)` after uncaughtException  | Node.js docs: "The correct use of 'uncaughtException' is to perform synchronous cleanup of allocated resources and then exit." Continuing after uncaught exception leads to undefined behavior. |
| `process.exit(1)` after unhandledRejection | Consistent behavior across Node.js versions. In Node 22 (Argos target), this is already the default, but explicit exit ensures the log lines are flushed.                                       |
| `console.error` (not logger)               | At the time of an uncaught exception, the application state is undefined. The logger may be corrupted. `console.error` writes directly to stderr, which is captured by SystemD journald.        |
| globalThis guard pattern                   | Prevents duplicate handler registration during Vite HMR cycles. Established pattern in this codebase (see `database.ts`, `sweepManager.ts`, `webSocketManager.ts`).                             |
| Module-level placement                     | Global error handlers must be registered before any async code executes. Module-level registration in `hooks.server.ts` ensures they are active from the first request.                         |

**What NOT to do**:

```typescript
// WRONG -- Do not attempt to recover from uncaughtException
process.on('uncaughtException', (error: Error) => {
	console.error('Error occurred:', error.message);
	// DO NOT do this -- process state is undefined, continuing will cause data corruption
});

// WRONG -- Do not register handlers without globalThis guard
process.on('uncaughtException', ...); // Duplicated on every HMR cycle
```

### Subtask 2.2.7.2: Verification

After adding the handlers, execute the following verification command:

```bash
# Verify handlers are registered
grep -rn "uncaughtException\|unhandledRejection" src/ --include="*.ts" | wc -l
# Expected: >= 2 (one for each handler type)
```

**Extended verification** (confirm globalThis guard is present):

```bash
# Verify globalThis guard exists
grep -rn "__errorHandlersRegistered" src/ --include="*.ts" | wc -l
# Expected: >= 2 (guard check + guard set)
```

**Functional verification** (optional, development environment only):

```bash
# Test uncaughtException handler (DEVELOPMENT ONLY -- will crash the process)
# Add temporary code to a test endpoint:
#   throw new Error('Test uncaught exception');
# Then check journald for the FATAL log entry:
journalctl -u argos-dev --since "1 minute ago" | grep "FATAL"
# Expected: [FATAL] Uncaught exception: Test uncaught exception
```

**WARNING**: The functional verification intentionally crashes the process. Only execute in a development environment with SystemD restart configured. Do not execute on a live tactical deployment.

## Verification Checklist

| #   | Command                                                                           | Expected Result | Purpose                          |
| --- | --------------------------------------------------------------------------------- | --------------- | -------------------------------- |
| 1   | `grep -rn "uncaughtException\|unhandledRejection" src/ --include="*.ts" \| wc -l` | >= 2            | Both handlers registered         |
| 2   | `grep -rn "__errorHandlersRegistered" src/ --include="*.ts" \| wc -l`             | >= 2            | globalThis HMR guard present     |
| 3   | `grep -rn "process.exit(1)" src/hooks.server.ts \| wc -l`                         | >= 2            | Both handlers exit after logging |
| 4   | `npm run typecheck`                                                               | Exit 0          | No type regressions              |
| 5   | `npm run build`                                                                   | Exit 0          | Build integrity preserved        |

## Commit Strategy

```
security(phase2.2.7): add uncaughtException and unhandledRejection handlers

Phase 2.2 Task 7: Global Error Handlers (REGRADE B2)
- Registered process.on('uncaughtException') with FATAL logging
- Registered process.on('unhandledRejection') with FATAL logging
- globalThis guard prevents HMR duplicate registration
- Both handlers exit after logging (process state undefined after uncaught exception)
Verified: grep handlers = 2, grep globalThis guard = 2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Single-task rollback
git reset --soft HEAD~1

# Verify handlers are removed
grep -rn "uncaughtException\|unhandledRejection" src/ --include="*.ts" | wc -l
# Expected: 0

# Verify build integrity
npm run typecheck && npm run build
```

Rollback removes global error handlers. Unhandled exceptions will again terminate the process silently (no log entry, no forensic evidence). Node.js 22 will still exit on unhandled rejections by default, but without the custom log output that identifies the error source.

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                                                                                                 |
| -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Handler itself throws an exception                       | LOW        | HIGH   | Handler code is minimal: `console.error` + `process.exit`. Both are native operations that cannot throw.                                   |
| process.exit(1) prevents graceful cleanup                | MEDIUM     | MEDIUM | Uncaught exceptions mean process state is already undefined. Cleanup after undefined state risks data corruption. SystemD handles restart. |
| HMR guard prevents handler updates during development    | LOW        | LOW    | Full server restart (`npm run dev:clean`) resets globalThis                                                                                |
| `console.error` output not captured in some environments | LOW        | MEDIUM | SystemD `journalctl` captures stderr. Docker logs capture stderr. Both are configured in Argos deployment.                                 |
| Crash loop if error recurs on startup                    | MEDIUM     | HIGH   | SystemD `Restart=on-failure` with `RestartSec=5` prevents tight loops. earlyoom kills if OOM is the cause.                                 |

## Standards Traceability

| Standard             | Requirement                                                       | Satisfied By                                            |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| CERT ERR33-C         | Detect and Handle Standard Library Errors                         | All unhandled errors now detected and logged            |
| CERT ERR06-J         | Do Not Throw Undeclared Checked Exceptions                        | Global handler catches all undeclared exceptions        |
| NIST SP 800-53 SI-17 | Fail-Safe Procedures -- system fails to a known safe state        | process.exit(1) triggers SystemD restart to known state |
| NIST SP 800-53 AU-2  | Audit Events -- system must generate audit records for failures   | FATAL log entries generated before exit                 |
| OWASP A09:2021       | Security Logging and Monitoring Failures                          | Fatal errors now logged with stack traces               |
| DISA STIG V-222603   | Application must not be subject to error handling vulnerabilities | Unhandled errors no longer cause silent failures        |
| CWE-248              | Uncaught Exception                                                | Global handler catches all uncaught exceptions          |
| CWE-755              | Improper Handling of Exceptional Conditions                       | All exceptional conditions now logged and handled       |

## Execution Tracking

| Subtask | Description                                    | Status  | Started | Completed | Verified By |
| ------- | ---------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.7.1 | Add global error handlers to hooks.server.ts   | PENDING | --      | --        | --          |
| 2.2.7.2 | Verification (grep + optional functional test) | PENDING | --      | --        | --          |
