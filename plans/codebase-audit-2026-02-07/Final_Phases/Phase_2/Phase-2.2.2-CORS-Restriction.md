# Phase 2.2.2: CORS Restriction

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A01:2021 (Broken Access Control), NIST SP 800-53 AC-4 (Information Flow Enforcement), DISA STIG V-222609
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Replace all 15 instances of `Access-Control-Allow-Origin: *` across 9 files with an origin allowlist that restricts cross-origin requests to the Argos web interface only. This eliminates the ability of arbitrary external origins to issue cross-origin requests to RF hardware control endpoints.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | HIGH -- Incorrect CORS configuration can break legitimate cross-origin requests                |
| Severity      | HIGH                                                                                           |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 10 files (9 with wildcards + 1 new `cors.ts` utility)                                          |
| Blocks        | Phase 2.2.3 (security headers build on the CORS infrastructure)                                |
| Blocked By    | Phase 2.1 (authentication must be in place before restricting origins)                         |

## Threat Context

The Argos system exposes REST API endpoints that directly control RF hardware -- HackRF spectrum analyzers, GSM Evil base stations, RTL-SDR receivers, and OpenWebRX receivers. With `Access-Control-Allow-Origin: *`, any web page visited by a user on the same network as the Argos device can silently issue cross-origin requests to these endpoints from the user's browser. In a tactical environment:

1. **RF hardware hijacking**: An adversary who can serve a web page (e.g., via a captive portal, DNS poisoning, or social engineering) can command the Argos device's HackRF to start unauthorized spectrum sweeps or change frequencies.
2. **Data exfiltration**: Cross-origin requests to data endpoints can extract SIGINT data (WiFi device lists, IMSI captures, GPS positions) without any user interaction beyond visiting a malicious page.
3. **Denial of service**: Rapid cross-origin requests to hardware control endpoints can overwhelm the single-instance tactical device.
4. **Express `cors()` implicit wildcard**: The GSM Evil Python-to-Node bridge server uses Express `cors()` middleware with no configuration, which defaults to `Access-Control-Allow-Origin: *` for all responses.

Per OWASP A01:2021: "Access control enforces policy such that users cannot act outside of their intended permissions." A wildcard CORS policy permits all origins to act on hardware control endpoints.

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

### Explicit Wildcard Count

```bash
grep -rn "Allow-Origin.*\*" src/ --include="*.ts" | wc -l
# Result: 14
```

### Implicit Wildcard Count (Express cors() default)

```bash
grep -rn "cors()" src/ --include="*.ts"
# Result: 1 (src/lib/services/gsm-evil/server.ts:38)
```

**Total**: 14 explicit + 1 implicit = **15 instances across 9 files**.

**REGRADE CORRECTION**: The original count was 14 across 8 files. The independent regrade identified the Express `cors()` middleware default in `src/lib/services/gsm-evil/server.ts:38` as an additional implicit wildcard, bringing the total to 15 across 9 files.

## Implementation Plan

### Subtask 2.2.2.1: Create CORS Configuration Utility

**Create file**: `src/lib/server/security/cors.ts`

This utility provides a centralized origin allowlist and a function that returns appropriate CORS headers based on the requesting origin. Unknown origins receive no CORS headers, which causes the browser to block the response.

```typescript
/**
 * CORS origin allowlist for Argos tactical deployment.
 *
 * Only the Argos web interface origins are permitted.
 * All other origins are denied by omitting CORS headers entirely.
 *
 * Standards: OWASP A01:2021, NIST SP 800-53 AC-4
 */

const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	`http://${process.env.ARGOS_HOSTNAME || 'localhost'}:5173`
];

/**
 * Returns CORS headers for a given request.
 * If the request Origin is in the allowlist, returns permissive CORS headers.
 * If the request Origin is NOT in the allowlist, returns an empty object
 * (no CORS headers = browser blocks the response).
 */
export function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		return {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
			'Access-Control-Max-Age': '86400'
		};
	}
	// No CORS headers for unknown origins
	return {};
}

/**
 * Exported for use in Express-based sub-servers (GSM Evil bridge).
 */
export { ALLOWED_ORIGINS };
```

**Design decisions**:

- `ARGOS_HOSTNAME` environment variable allows field configuration for non-localhost deployments.
- `Access-Control-Max-Age: 86400` (24 hours) reduces preflight request volume in the field.
- `X-API-Key` is included in `Allow-Headers` to support the Phase 2.1 API key authentication mechanism.
- No credentials support (`Access-Control-Allow-Credentials`) is needed -- Argos uses API key authentication, not cookies.

### Subtask 2.2.2.2: Replace All 15 Wildcard Instances

The following table enumerates every instance. Each explicit header replacement follows the same mechanical pattern. The Express `cors()` instance (#9) requires a different fix.

| #     | File                                           | Line(s)                | Instances | Type                                              |
| ----- | ---------------------------------------------- | ---------------------- | --------- | ------------------------------------------------- |
| 1     | `src/routes/api/rf/data-stream/+server.ts`     | 10, 188                | 2         | Explicit header in Response constructor           |
| 2     | `src/routes/api/rf/start-sweep/+server.ts`     | 117                    | 1         | Explicit header in Response constructor           |
| 3     | `src/routes/api/rf/status/+server.ts`          | 153                    | 1         | Explicit header in Response constructor           |
| 4     | `src/routes/api/rf/emergency-stop/+server.ts`  | 47                     | 1         | Explicit header in Response constructor           |
| 5     | `src/routes/api/rf/stop-sweep/+server.ts`      | 33                     | 1         | Explicit header in Response constructor           |
| 6     | `src/routes/api/hackrf/start-sweep/+server.ts` | 108                    | 1         | Explicit header in Response constructor           |
| 7     | `src/routes/api/hackrf/[...path]/+server.ts`   | 26, 43, 52, 80, 89, 98 | 6         | Explicit header in Response constructor           |
| 8     | `src/routes/api/rtl-433/stream/+server.ts`     | 136                    | 1         | Explicit header in Response constructor           |
| **9** | **`src/lib/services/gsm-evil/server.ts`**      | **38**                 | **1**     | **Express `cors()` middleware default (REGRADE)** |

**Total**: 15 instances across 9 files.

#### Fix Pattern for Instances #1-#8 (SvelteKit API Routes)

**BEFORE (vulnerable)**:

```typescript
return new Response(JSON.stringify(data), {
	headers: {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
	}
});
```

**AFTER (secure)**:

```typescript
import { getCorsHeaders } from '$lib/server/security/cors';

// ... in handler function:
return new Response(JSON.stringify(data), {
	headers: {
		'Content-Type': 'application/json',
		...getCorsHeaders(request)
	}
});
```

**Important for SSE endpoints** (`rf/data-stream`, `rtl-433/stream`): Ensure the `request` parameter from the SvelteKit handler function is available in the scope where the Response headers are constructed. For ReadableStream-based SSE endpoints, the `request` object must be captured in the closure.

#### Fix Pattern for Instance #9 (Express cors() Middleware)

**BEFORE (vulnerable)**:

```typescript
import cors from 'cors';
app.use(cors());
```

**AFTER (secure)**:

```typescript
import cors from 'cors';

const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	`http://${process.env.ARGOS_HOSTNAME || 'localhost'}:5173`
];

app.use(
	cors({
		origin: ALLOWED_ORIGINS,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'X-API-Key']
	})
);
```

**Note**: The Express `cors` package accepts an `origin` array directly and handles origin checking internally. This is preferable to importing from `$lib/server/security/cors.ts` because the GSM Evil server runs as a standalone Express process that may not have access to SvelteKit path aliases.

### Subtask 2.2.2.3: Verification

After replacing all 15 instances, execute the following verification commands:

```bash
# Verification 1: Zero explicit CORS wildcards remain
grep -rn "Allow-Origin.*\*" src/ --include="*.ts" | wc -l
# Expected: 0

# Verification 2: Functional test -- known origin receives CORS headers
curl -sI -H "Origin: http://localhost:5173" http://localhost:5173/api/rf/status | grep "Allow-Origin"
# Expected: Access-Control-Allow-Origin: http://localhost:5173

# Verification 3: Functional test -- unknown origin receives NO CORS headers
curl -sI -H "Origin: http://evil.com" http://localhost:5173/api/rf/status | grep "Allow-Origin"
# Expected: no output (empty -- header not present)
```

**CRITICAL**: Verification 3 must return empty output. If `Access-Control-Allow-Origin` appears in the response for an unknown origin, the CORS restriction is not functioning correctly. Investigate immediately.

## Verification Checklist

| #   | Command                                                                                                  | Expected Result                                      | Purpose                          |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| 1   | `grep -rn "Allow-Origin.*\*" src/ --include="*.ts" \| wc -l`                                             | 0                                                    | Zero explicit CORS wildcards     |
| 2   | `grep -rn "cors()" src/ --include="*.ts" \| grep -v "// \|ALLOWED" \| wc -l`                             | 0                                                    | Zero unconfigured Express cors() |
| 3   | `curl -sI -H "Origin: http://localhost:5173" http://localhost:5173/api/rf/status \| grep "Allow-Origin"` | `Access-Control-Allow-Origin: http://localhost:5173` | Known origin accepted            |
| 4   | `curl -sI -H "Origin: http://evil.com" http://localhost:5173/api/rf/status \| grep "Allow-Origin"`       | (empty)                                              | Unknown origin rejected          |
| 5   | `npm run typecheck`                                                                                      | Exit 0                                               | No type regressions              |
| 6   | `npm run build`                                                                                          | Exit 0                                               | Build integrity preserved        |

## Commit Strategy

```
security(phase2.2.2): restrict CORS to origin allowlist across 9 files

Phase 2.2 Task 2: CORS Restriction
- Created src/lib/server/security/cors.ts with origin allowlist
- Replaced 14 explicit Access-Control-Allow-Origin: * headers
- Configured Express cors() middleware with explicit origin list
- 15 total wildcard instances across 9 files remediated
Verified: grep wildcard = 0, known origin = accepted, unknown origin = blocked

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Single-task rollback
git reset --soft HEAD~1

# Verify CORS headers revert to wildcard (confirming rollback)
grep -rn "Allow-Origin.*\*" src/ --include="*.ts" | wc -l
# Expected: 14 (pre-fix count)

# Verify build integrity
npm run typecheck && npm run build
```

**Warning**: Rollback re-enables wildcard CORS on all RF hardware control endpoints. This should be treated as an emergency action only, with re-remediation scheduled immediately.

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                      |
| -------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Legitimate cross-origin requests blocked           | LOW        | HIGH   | Allowlist includes all known Argos interface origins            |
| Field hostname not in allowlist                    | MEDIUM     | HIGH   | `ARGOS_HOSTNAME` env var allows field configuration             |
| SSE streaming endpoints lose CORS headers          | LOW        | HIGH   | Each SSE endpoint verified individually with curl               |
| Express cors() origin checking behaves differently | LOW        | MEDIUM | Express `cors` package is well-tested; functional test confirms |
| Browser caching stale wildcard preflight responses | MEDIUM     | LOW    | Preflight cache clears after previous `max-age`; hard refresh   |

## Standards Traceability

| Standard            | Requirement                                                        | Satisfied By                                      |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| OWASP A01:2021      | Broken Access Control -- CORS misconfiguration                     | Origin allowlist replaces wildcard                |
| NIST SP 800-53 AC-4 | Information Flow Enforcement -- restrict data flow between domains | Only Argos interface origin can issue requests    |
| NIST SP 800-53 AC-3 | Access Enforcement -- enforce approved access control policy       | getCorsHeaders enforces origin policy per-request |
| DISA STIG V-222609  | Application must restrict web-based services to approved origins   | 15 wildcard instances replaced with allowlist     |
| CWE-942             | Overly Permissive Cross-domain Whitelist                           | Eliminated by explicit 3-origin allowlist         |

## Execution Tracking

| Subtask | Description                            | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.2.1 | Create CORS configuration utility      | PENDING | --      | --        | --          |
| 2.2.2.2 | Replace all 15 wildcard instances      | PENDING | --      | --        | --          |
| 2.2.2.3 | Verification (grep + functional tests) | PENDING | --      | --        | --          |
