# Phase 2.2.15: Error Message Systematic Sweep

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A01:2021 (Broken Access Control -- information leakage), CWE-209 (Error Message Information Leak), CWE-497 (Exposure of Sensitive System Information), NIST SP 800-53 SI-11 (Error Handling)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: Follow-on from Phase 2.1.5 (Sensitive Data Exposure Fix)

---

## Purpose

This task systematically replaces all instances of `error.message` being returned directly in HTTP JSON responses with the standardized `safeErrorResponse()` and `logAndRespond()` helpers created in Phase 2.1.5. While Phase 2.1.5 eliminated stack trace exposure, approximately **60 API endpoints** still return raw `error.message` values that can leak internal file paths, database schema details, process names, and network topology information to authenticated clients.

## Execution Constraints

| Constraint       | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Risk Level       | LOW -- Only changes error response content; auth gate (2.1.1) already mitigates |
| Severity         | MEDIUM                                                                          |
| Prerequisites    | Task 2.1.1 (authentication), Task 2.1.5 (error-response.ts helper)              |
| Files Touched    | ~60 API route files                                                             |
| Blocks           | None                                                                            |
| Blocked By       | Task 2.1.5 (safeErrorResponse helper must exist)                                |
| Estimated Effort | 3-4 hours                                                                       |

## Threat Context

While authentication (Phase 2.1.1) prevents anonymous network clients from accessing these endpoints, authenticated users (including compromised accounts or malicious insiders) can still extract reconnaissance information from detailed error messages:

- **Internal file paths**: `ENOENT: no such file or directory, open '/app/data/rf_signals.db'` reveals storage locations
- **Database schema details**: `SQLITE_ERROR: no such table: signals` exposes table names and structure
- **Process names and arguments**: `spawn grgsm_livemon_headless ENOENT` reveals toolchain details
- **Network endpoint details**: `connect ECONNREFUSED 127.0.0.1:2501` exposes internal service ports
- **Dependency versions**: Error messages from SQLite, Node.js, or child processes reveal version information

In a tactical deployment where multiple operators share authenticated access, minimizing information leakage between authenticated sessions reduces lateral movement risk.

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

| Metric                                       | Value | Verification Command                                                                             |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| Endpoints returning `error.message` directly | 60    | `grep -rn "error\.message\|error: e\.message\|error: err\.message" src/routes/ --include="*.ts"` |
| `safeErrorResponse` helper exists            | ✅    | `test -f src/lib/server/security/error-response.ts && echo EXISTS`                               |
| Endpoints already using `safeErrorResponse`  | 0     | `grep -rn "safeErrorResponse\|logAndRespond" src/routes/ --include="*.ts" \| wc -l`              |
| Stack traces in JSON responses (from 2.1.5)  | 0     | `grep -rn "stack:" src/routes/ --include="*.ts" \| grep -v "console\." \| wc -l`                 |

### Common Error Exposure Patterns

| Pattern                                                             | Count (approx) | Example                      |
| ------------------------------------------------------------------- | -------------- | ---------------------------- |
| `return json({ error: (error as Error).message }, { status: 500 })` | ~25            | Most common pattern          |
| `return json({ error: err.message }, { status: 500 })`              | ~15            | Alternative naming           |
| `return json({ success: false, error: e.message })`                 | ~10            | With success flag            |
| `return error(500, (error as Error).message)`                       | ~10            | Using SvelteKit error helper |

## Implementation Plan

### Subtask 2.2.15.1: Discovery and Categorization

**Discovery command**:

```bash
grep -rn "error\.message\|error: e\.message\|error: err\.message" src/routes/ --include="*.ts" > /tmp/error-message-sweep.txt
```

**Categorization by error type**:

| Category            | Description                              | Log Level | Public Message               |
| ------------------- | ---------------------------------------- | --------- | ---------------------------- |
| Database operations | SQLite queries, insertions, connections  | ERROR     | "Database operation failed"  |
| Hardware operations | HackRF, USRP, GPS, SDR control           | ERROR     | "Hardware operation failed"  |
| Service management  | Kismet, GSM Evil, Bettercap API calls    | ERROR     | "Service operation failed"   |
| File operations     | Reading/writing config, logs, data files | ERROR     | "File operation failed"      |
| Network operations  | External API calls, fetch requests       | ERROR     | "Network operation failed"   |
| Input validation    | Parameter parsing, type conversion       | 400       | "Invalid request parameters" |

### Subtask 2.2.15.2: Replacement Template

**Import statement** (add to top of each modified file):

```typescript
import { logAndRespond } from '$lib/server/security/error-response';
```

**BEFORE (vulnerable)**:

```typescript
export const GET: RequestHandler = async ({ url }) => {
	try {
		const data = await getDatabaseRecords();
		return json({ data });
	} catch (error) {
		return json({ error: (error as Error).message }, { status: 500 });
	}
};
```

**AFTER (secure)**:

```typescript
import { logAndRespond } from '$lib/server/security/error-response';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const data = await getDatabaseRecords();
		return json({ data });
	} catch (error) {
		return logAndRespond('[endpoint-name]', error, 500, 'Database operation failed');
	}
};
```

**For SvelteKit's `error()` helper pattern**:

BEFORE:

```typescript
} catch (err: unknown) {
	return error(500, (err as Error).message);
}
```

AFTER:

```typescript
} catch (err: unknown) {
	console.error('[endpoint-name] Error:', err);
	return error(500, 'Operation failed');
}
```

### Subtask 2.2.15.3: Systematic Sweep Strategy

To avoid missing endpoints, process files in order by route category:

1. **HackRF routes** (`src/routes/api/hackrf/**/*.ts`)
    - Estimated: ~10 endpoints
    - Context tag: `[hackrf]`

2. **Kismet routes** (`src/routes/api/kismet/**/*.ts`)
    - Estimated: ~8 endpoints
    - Context tag: `[kismet]`

3. **GSM Evil routes** (`src/routes/api/gsm-evil/**/*.ts`)
    - Estimated: ~6 endpoints
    - Context tag: `[gsm-evil]`

4. **Tactical Map routes** (`src/routes/api/tactical-map/**/*.ts`)
    - Estimated: ~5 endpoints
    - Context tag: `[tactical-map]`

5. **RF/Spectrum routes** (`src/routes/api/rf/**/*.ts`)
    - Estimated: ~8 endpoints
    - Context tag: `[rf]`

6. **Signal routes** (`src/routes/api/signals/**/*.ts`)
    - Estimated: ~3 endpoints
    - Context tag: `[signals]`

7. **System/Health routes** (`src/routes/api/system/**/*.ts`, `src/routes/api/health/**/*.ts`)
    - Estimated: ~5 endpoints
    - Context tag: `[system]` or `[health]`

8. **Miscellaneous routes** (OpenWebRX, Bettercap, DroneID, Wifite, etc.)
    - Estimated: ~15 endpoints
    - Context tag: based on service name

### Subtask 2.2.15.4: Quality Assurance Checks

After each category sweep:

```bash
# Verify no raw error.message in modified files
grep -rn "error\.message\|error: e\.message\|error: err\.message" src/routes/api/[category]/ --include="*.ts" | wc -l
# Expected: 0

# Verify safeErrorResponse/logAndRespond is imported
grep -rn "from.*error-response" src/routes/api/[category]/ --include="*.ts" | wc -l
# Expected: >= number of modified files
```

### Subtask 2.2.15.5: Verification

**Command 1 -- No raw error.message in API routes**:

```bash
grep -rn "error\.message\|error: e\.message\|error: err\.message" src/routes/api/ --include="*.ts" | \
  grep -v "// \|/\*\|import\|type " | wc -l
```

**Expected result**: `0`

**Rationale**: After the sweep, no API endpoint returns raw error messages. The grep exclusions filter out: comments, imports, and type definitions.

**Command 2 -- safeErrorResponse adoption count**:

```bash
grep -rn "safeErrorResponse\|logAndRespond" src/routes/api/ --include="*.ts" | wc -l
```

**Expected result**: `>= 60` (one per endpoint, some may use both)

**Command 3 -- Build passes**:

```bash
npm run typecheck && npm run build
```

**Expected result**: Exit code 0

**Command 4 -- Manual spot check** (sample 5 random endpoints):

```bash
curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/[random-endpoint-that-should-error] | \
  jq '.error' | grep -c "Database\|Hardware\|Service\|File\|Network\|Invalid\|Operation failed"
```

**Expected result**: `>= 1` (generic error message present, no internal details)

## Verification Checklist

1. ✅ `grep -rn "error\.message" src/routes/api/ --include="*.ts" | grep -v "comment\|import" | wc -l` returns `0`
2. ✅ `grep -rn "safeErrorResponse\|logAndRespond" src/routes/api/ --include="*.ts" | wc -l` returns `>= 60`
3. ✅ `npm run typecheck` exits 0
4. ✅ `npm run build` exits 0
5. ✅ Manual testing: Error responses contain only generic messages (no file paths, table names, ports)
6. ✅ Server logs contain full error details for debugging

## Commit Strategy

This task produces one atomic commit per category (8 commits total), plus a final verification commit:

**Per-category commit template**:

```
security(phase2.2.15): replace error.message with safeErrorResponse in [category] routes

Phase 2.2 Task 15: Error Message Systematic Sweep - [Category Name]
- Replaced N error.message instances with logAndRespond()
- Added safeErrorResponse import to M files
- Generic messages: "Operation failed", "[Category] operation failed"
- Full errors logged server-side with [category] context tag
Verified: grep error.message in [category]/ = 0

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Final verification commit** (after all categories complete):

```
security(phase2.2.15): verify complete error message systematic sweep

Phase 2.2 Task 15: Error Message Systematic Sweep - COMPLETE
- All 60 endpoints across 8 categories updated
- Zero raw error.message exposures remaining in API routes
- safeErrorResponse helper adopted across entire API surface
- Auth gate (2.1.1) + safe errors (2.2.15) = defense in depth
Verified: grep error.message src/routes/api/ = 0

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Rollback single category (if needed)
git reset --soft HEAD~1

# Rollback entire sweep (all 8+ commits)
git reset --soft HEAD~9
```

To fully revert:

```bash
git reset --hard HEAD~9
```

Note: After rollback, the 60 endpoints return raw `error.message` values. This is a low-severity regression due to auth gate mitigation (2.1.1), but information leakage to authenticated users resumes.

## Risk Assessment

| Risk                                              | Likelihood | Impact | Mitigation                                                               |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Generic error messages make debugging harder      | HIGH       | LOW    | Full errors logged server-side; use `journalctl` or Docker logs          |
| Behavioral change in error response format        | MEDIUM     | LOW    | Response structure unchanged (still `{error: "..."}` format)             |
| Miss some endpoints during sweep                  | MEDIUM     | LOW    | Category-by-category approach + verification after each category         |
| New endpoints introduced after sweep              | HIGH       | LOW    | Phase 2.2.14 ESLint rules can enforce pattern (future enhancement)       |
| Auth gate (2.1.1) already mitigates this exposure | N/A        | N/A    | Defense in depth: auth prevents access, safe errors prevent info leakage |

## Standards Traceability

| Standard                 | Requirement                                         | How This Task Satisfies It                                                           |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| OWASP A01:2021           | Information leakage through error responses         | Raw error messages replaced with generic public messages across all API routes       |
| CWE-209                  | Error Message Information Leak                      | Internal error details (paths, schema, ports) no longer reach network clients        |
| CWE-497                  | Exposure of Sensitive System Information            | File paths, process names, and database details moved from HTTP response to logs     |
| NIST SP 800-53 SI-11     | Error Handling -- reveal only necessary information | Error responses contain only status code and generic message; details logged locally |
| NASA/JPL Power of Ten #6 | Restrict scope of data to smallest possible         | Error detail scope restricted from authenticated-network to server-local logs only   |

## Execution Tracking

| Subtask  | Description                     | Status  | Started | Completed | Verified By |
| -------- | ------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.15.1 | Discovery and categorization    | PENDING | --      | --        | --          |
| 2.2.15.2 | Replacement template defined    | PENDING | --      | --        | --          |
| 2.2.15.3 | Systematic sweep (8 categories) | PENDING | --      | --        | --          |
| 2.2.15.4 | Quality assurance per category  | PENDING | --      | --        | --          |
| 2.2.15.5 | Final verification              | PENDING | --      | --        | --          |

## Notes

- **Incremental commits**: Each category (HackRF, Kismet, GSM Evil, etc.) gets its own commit. This allows for progressive review and easier rollback if issues are found.
- **Context tags**: Each `logAndRespond()` call includes a context tag (e.g., `[hackrf]`, `[kismet]`) for log filtering and debugging.
- **Backward compatibility**: The response format remains `{error: "message"}` -- only the content of the message changes from internal details to generic descriptions.
- **Future enforcement**: After Phase 2.2.14 (ESLint rules) is complete, consider adding a custom ESLint rule to flag any new `error.message` usage in API routes.

## Dependencies

**Blocked by**:

- Phase 2.1.1 (API Authentication) -- already complete ✅
- Phase 2.1.5 (error-response.ts helper) -- already complete ✅

**Enables**:

- Phase 3.x (Logging improvements) -- provides consistent error handling base for structured logger migration
- Phase 2.2.14 (ESLint rules) -- can add enforcement rule once pattern is established

## Success Criteria

1. ✅ Zero occurrences of `error.message` in JSON responses across all API routes
2. ✅ All 60+ endpoints use `safeErrorResponse()` or `logAndRespond()` for error handling
3. ✅ Build and typecheck pass without errors
4. ✅ Manual testing confirms generic error messages in HTTP responses
5. ✅ Server logs contain full error details for operational debugging
6. ✅ No functional regressions (endpoints still return appropriate HTTP status codes)
