# Phase 2.1.5: Sensitive Data Exposure Fix

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A01:2021 (Broken Access Control -- information leakage), CWE-209 (Error Message Information Leak), CWE-497 (Exposure of Sensitive System Information), NIST SP 800-53 SI-11 (Error Handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task removes stack trace exposure from client-facing HTTP JSON responses and creates a standardized error response helper that prevents internal system information from leaking to network clients. Stack traces reveal internal file paths, function names, dependency versions, and system architecture details that aid attacker reconnaissance.

## Execution Constraints

| Constraint       | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Risk Level       | ZERO -- only removes information from client responses |
| Severity         | MEDIUM                                                 |
| Prerequisites    | Task 2.1.1 (authentication)                            |
| Files Touched    | 3 API route files modified + 1 new utility file        |
| Blocks           | None                                                   |
| Blocked By       | Task 2.1.1 (auth middleware)                           |
| Estimated Effort | 1 hour                                                 |

## Threat Context

In a tactical deployment, HTTP responses traverse the local network segment and may be captured by any device on the same broadcast domain. Stack traces in JSON error responses expose:

- **Internal file paths**: Reveal the application's directory structure (e.g., `/home/kali/Documents/Argos/Argos/src/routes/api/...`)
- **Function names**: Reveal the application's internal architecture and control flow
- **Dependency versions**: Identify specific library versions for known-vulnerability matching
- **Database schema details**: Error messages from SQLite can reveal table names and column structures
- **Network topology**: Error messages referencing `localhost:2501`, `localhost:3002`, etc. reveal internal service ports

An attacker intercepting these responses on the tactical network gains significant reconnaissance advantage without needing to perform active probing.

## Current State Assessment

**REGRADE CORRECTION**: Only **2 of 5 instances** are genuinely client-facing (returned in HTTP JSON response bodies). The other 3 are console-only (server-side logging). The original plan classified all 5 as client-facing, which was inaccurate.

| Metric                                       | Value          | Verification Command                                                                                        |
| -------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Stack traces in client-facing JSON responses | 2              | Manual inspection of `api/hackrf/debug-start/+server.ts` lines 41 and 52                                    |
| Stack traces in console-only logging         | 3              | `api/hackrf/debug-start/+server.ts:35`, `api/hackrf/data-stream/+server.ts:89`, `api/signals/+server.ts:36` |
| `safeErrorResponse` helper                   | Does not exist | `grep -rn "safeErrorResponse" src/ --include="*.ts" \| wc -l` returns 0                                     |
| Endpoints returning `error.message` directly | ~67            | `grep -rn "error\.message\|error: e\.message\|error: err\.message" src/routes/ --include="*.ts" \| wc -l`   |

### Stack Trace Exposure Inventory

**Client-facing exposures (MUST fix -- leaks internal paths to HTTP clients)**:

| #   | File:Line                              | Exposure Pattern                                                       | Severity | Fix                                   |
| --- | -------------------------------------- | ---------------------------------------------------------------------- | -------- | ------------------------------------- |
| 1   | `api/hackrf/debug-start/+server.ts:41` | `stack: (cycleError as { stack?: string }).stack` in **JSON response** | MEDIUM   | Return generic error, log server-side |
| 2   | `api/hackrf/debug-start/+server.ts:52` | `stack: (error as { stack?: string }).stack` in **JSON response**      | MEDIUM   | Return generic error, log server-side |

**Console-only exposures (SHOULD fix -- not a direct client risk, but remove in production)**:

| #   | File:Line                              | Exposure Pattern                                          | Severity | Fix                                                                    |
| --- | -------------------------------------- | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| 3   | `api/hackrf/debug-start/+server.ts:35` | `console.error('[debug-start] Error stack:', ... .stack)` | LOW      | Restrict to dev mode or use structured logger without stack            |
| 4   | `api/hackrf/data-stream/+server.ts:89` | `logDebug(... error.stack ...)`                           | LOW      | **CORRECTED**: This is `logDebug` (server log), NOT JSON response      |
| 5   | `api/signals/+server.ts:36`            | `console.error('Stack trace:', ... .stack)`               | LOW      | **CORRECTED**: This is `console.error` (server log), NOT JSON response |

**Note on exposure #4 and #5**: These were originally classified as client-facing in the initial plan. The regrade audit confirmed they are server-side logging calls (`logDebug` and `console.error`) that write to the server's stdout/stderr, not to HTTP response bodies. They are included for completeness and should be addressed in production hardening, but they do not leak information over the network.

### Additional Finding: error.message Exposure

**67 API endpoints** return `error.message` directly in JSON responses. While not stack traces, error messages from Node.js, SQLite, and child process execution can reveal:

- Internal file paths (e.g., `ENOENT: no such file or directory, open '/app/data/rf_signals.db'`)
- Database schema details (e.g., `SQLITE_ERROR: no such table: signals`)
- Process names and arguments (e.g., `spawn grgsm_livemon_headless ENOENT`)
- Network endpoint details (e.g., `connect ECONNREFUSED 127.0.0.1:2501`)

These should be replaced with the `safeErrorResponse` helper in a systematic sweep. This is a broader effort tracked as an enhancement beyond the immediate 2 client-facing stack trace fixes.

## Implementation Plan

### Subtask 2.1.5.1: Remove Stack Traces from Error Responses

**File**: `src/routes/api/hackrf/debug-start/+server.ts`

**Fix for line 41** (client-facing stack trace in cycle error response):

BEFORE (vulnerable):

```typescript
// Line 41: Stack trace sent to client in JSON response
return json(
	{
		error: 'Cycle frequency failed',
		details: (cycleError as Error).message,
		stack: (cycleError as { stack?: string }).stack // LEAKS internal paths
	},
	{ status: 500 }
);
```

AFTER (secure):

```typescript
// Line 41: Generic error to client; full details logged server-side
console.error('[debug-start] Cycle frequency error:', cycleError);
return json(
	{
		error: 'Cycle frequency operation failed',
		code: 'CYCLE_FREQ_ERROR'
	},
	{ status: 500 }
);
```

**Fix for line 52** (client-facing stack trace in general error response):

BEFORE (vulnerable):

```typescript
// Line 52: Stack trace sent to client in JSON response
return json(
	{
		error: 'Debug start failed',
		details: (error as Error).message,
		stack: (error as { stack?: string }).stack // LEAKS internal paths
	},
	{ status: 500 }
);
```

AFTER (secure):

```typescript
// Line 52: Generic error to client; full details logged server-side
console.error('[debug-start] Error:', error);
return json(
	{
		error: 'Debug start operation failed',
		code: 'DEBUG_START_ERROR'
	},
	{ status: 500 }
);
```

**Fix for line 35** (console-only stack trace -- lower priority):

BEFORE:

```typescript
// Line 35: Stack trace in console.error (server-side only)
console.error('[debug-start] Error stack:', (error as { stack?: string }).stack);
```

AFTER:

```typescript
// Line 35: Log error without explicit stack extraction
// Stack is included automatically when logging Error objects
console.error('[debug-start] Error:', error);
```

**Fixes for data-stream and signals** (console-only -- lower priority):

**File**: `src/routes/api/hackrf/data-stream/+server.ts` line 89:

BEFORE:

```typescript
logDebug(`Error details: ${error.stack}`);
```

AFTER:

```typescript
logDebug(`Error details: ${error instanceof Error ? error.message : String(error)}`);
```

**File**: `src/routes/api/signals/+server.ts` line 36:

BEFORE:

```typescript
console.error('Stack trace:', (error as { stack?: string }).stack);
```

AFTER:

```typescript
console.error('Signal query error:', error instanceof Error ? error.message : String(error));
```

### Subtask 2.1.5.2: Create Standard Error Response Helper

**Create**: `src/lib/server/security/error-response.ts`

This helper standardizes error responses across the codebase, ensuring no internal details leak to clients while preserving full error information in server-side logs.

```typescript
/**
 * Standard safe error response generator for Argos API endpoints.
 *
 * SECURITY: Never include error.message, error.stack, file paths,
 * database details, or process information in HTTP responses.
 * All detailed error information must be logged server-side only.
 *
 * Usage:
 *   return safeErrorResponse(500, 'Operation failed');
 *   return safeErrorResponse(400, 'Invalid parameters');
 *   return safeErrorResponse(503, 'Service unavailable');
 */
export function safeErrorResponse(status: number, publicMessage: string): Response {
	return new Response(JSON.stringify({ error: publicMessage }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * Log error details server-side before returning safe response.
 * Combines logging and response in a single call for convenience.
 *
 * Usage:
 *   return logAndRespond('[hackrf]', error, 500, 'HackRF operation failed');
 */
export function logAndRespond(
	context: string,
	error: unknown,
	status: number,
	publicMessage: string
): Response {
	console.error(`${context} Error:`, error);
	return safeErrorResponse(status, publicMessage);
}
```

**Usage pattern for the 67 endpoints returning `error.message`** (systematic sweep, not in immediate scope):

BEFORE (vulnerable):

```typescript
catch (error) {
    return json({ error: (error as Error).message }, { status: 500 });
}
```

AFTER (secure):

```typescript
import { logAndRespond } from '$lib/server/security/error-response';

catch (error) {
    return logAndRespond('[endpoint-name]', error, 500, 'Operation failed');
}
```

### Subtask 2.1.5.3: Verification

**Command 1 -- No stack traces in JSON responses**:

```bash
grep -rn "stack:" src/routes/ --include="*.ts" | grep -v "node_modules\|// \|import\|type \|console\." | wc -l
```

**Expected result**: `0`

**Rationale**: After the fixes, no `stack:` property appears in any JSON response construction. The `grep -v` exclusions filter out: comments (`//`), import statements, type definitions, and console-only logging (which is acceptable).

**Command 2 -- safeErrorResponse helper exists**:

```bash
test -f src/lib/server/security/error-response.ts && echo EXISTS
```

**Expected result**: `EXISTS`

**Command 3 -- Build passes**:

```bash
npm run typecheck && npm run build
```

**Expected result**: Exit code 0

## Verification Checklist

1. `grep -rn "stack:" src/routes/ --include="*.ts" | grep -v "node_modules\|// \|import\|type \|console\." | wc -l` returns `0`
2. `test -f src/lib/server/security/error-response.ts && echo EXISTS` returns `EXISTS`
3. `grep -c "safeErrorResponse\|logAndRespond" src/lib/server/security/error-response.ts` returns `2` (both functions defined)
4. `curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/hackrf/debug-start | grep -c "stack"` returns `0` (no stack in response even on error)
5. `npm run typecheck` exits 0
6. `npm run build` exits 0

## Commit Strategy

```
security(phase2.1.5): remove stack traces from client error responses

Phase 2.1 Task 5: Sensitive Data Exposure Fix
- Removed 2 client-facing stack trace exposures in hackrf/debug-start
- Cleaned 3 console-only stack trace patterns (debug-start, data-stream, signals)
- Created src/lib/server/security/error-response.ts (safeErrorResponse + logAndRespond)
- Note: 67 endpoints returning error.message tracked for systematic sweep in Phase 2.2
Verified: grep for stack: in route JSON responses returns 0

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
git reset --soft HEAD~1
```

To fully revert:

```bash
git reset --hard HEAD~1
```

Note: After rollback, the 2 client-facing stack trace exposures return. This is a low-severity regression -- no functional impact, but information leakage resumes.

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                          |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------- |
| Generic error messages make debugging harder       | MEDIUM     | LOW    | Full errors logged server-side; use `journalctl` or Docker logs     |
| 67 endpoints with error.message not fixed yet      | HIGH       | LOW    | Tracked for Phase 2.2 systematic sweep; auth gate (2.1.1) mitigates |
| Error response helper not adopted by all endpoints | HIGH       | LOW    | Gradual adoption; linting rule can enforce in Phase 2.2             |

## Standards Traceability

| Standard                 | Requirement                                         | How This Task Satisfies It                                                               |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| OWASP A01:2021           | Information leakage through error responses         | Stack traces removed from all client-facing JSON responses                               |
| CWE-209                  | Error Message Information Leak                      | Generic error messages replace detailed internal errors in HTTP responses                |
| CWE-497                  | Exposure of Sensitive System Information            | File paths, function names, and dependency details no longer reach network clients       |
| NIST SP 800-53 SI-11     | Error Handling -- reveal only necessary information | Error responses contain only status code and generic message; details logged server-side |
| NASA/JPL Power of Ten #6 | Restrict scope of data to smallest possible         | Error detail scope restricted from network-wide to server-local logs only                |

## Execution Tracking

| Subtask | Description                        | Status  | Started | Completed | Verified By |
| ------- | ---------------------------------- | ------- | ------- | --------- | ----------- |
| 2.1.5.1 | Remove stack traces from responses | PENDING | --      | --        | --          |
| 2.1.5.2 | Create error response helper       | PENDING | --      | --        | --          |
| 2.1.5.3 | Verification                       | PENDING | --      | --        | --          |
