# Phase 2.2.8: Authentication Audit Logging

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 AU-2 (Audit Events), NIST SP 800-53 AU-3 (Content of Audit Records)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade B4

---

## Purpose

Implement structured audit logging for all authentication events in the Argos application. NIST SP 800-53 AU-2 mandates that information systems generate audit records for security-relevant events including authentication successes, failures, and access control decisions. Currently, the Argos codebase has zero authentication audit trail -- no authentication events are logged in any form.

## Execution Constraints

| Constraint    | Value                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Risk Level    | HIGH -- Missing audit trail is a compliance gap; implementation modifies authentication hot path |
| Severity      | HIGH                                                                                             |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place)   |
| Files Touched | 2 (auth middleware file from Phase 2.1, WebSocket auth handler)                                  |
| Blocks        | Phase 2.2.12 (Log Management Architecture depends on structured log format established here)     |
| Blocked By    | Phase 2.1 Task 2.1.1 (API Key Authentication), Phase 2.1 Task 2.1.6 (WebSocket Authentication)   |

## Threat Context

Argos is field-deployed for Army EW training at NTC/JMRC. In a contested electromagnetic environment, unauthorized access to the Argos console grants an adversary the ability to:

1. **Control RF hardware** -- Start/stop HackRF transmissions, alter frequency parameters, weaponize the SDR platform
2. **Exfiltrate SIGINT data** -- Access captured IMSI identifiers, WiFi device MAC addresses, GPS positions
3. **Disrupt operations** -- Stop spectrum monitoring, disable Kismet scanning, corrupt the signal database
4. **Conduct false-flag operations** -- Transmit unauthorized RF signals attributed to the unit operating Argos

Without authentication audit logging, a compromised system provides zero forensic evidence of when unauthorized access occurred, which endpoints were targeted, what actions were taken, or from which network address the attack originated. Incident response becomes guesswork rather than evidence-based analysis.

NIST SP 800-53 AU-2 requires logging of: (a) successful and unsuccessful logon attempts, (b) privileged operations, (c) changes to security-relevant objects. NIST AU-3 requires each audit record to contain: timestamp, event type, subject identity, outcome, and source address.

## Current State Assessment

| Metric                                     | Value       | Verification Command                                                                 |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------ |
| Authentication events logged               | **0**       | `grep -rn "AUTH_SUCCESS\|AUTH_FAILURE\|logAuthEvent" src/ --include="*.ts" \| wc -l` |
| Existing structured logging infrastructure | **Minimal** | `grep -rn "JSON.stringify.*timestamp" src/ --include="*.ts" \| wc -l`                |
| API endpoints requiring auth (Phase 2.1)   | **114**     | `find src/routes/api/ -name "+server.ts" \| wc -l`                                   |
| WebSocket endpoints requiring auth         | **3**       | `websocket-server.ts`, `hooks.server.ts` (ws upgrade), `webSocketManager.ts`         |
| Rate limiter events (Phase 2.2.5)          | **0**       | Rate limiter does not yet exist; will be created in Phase 2.2.5                      |
| Body size limit events (Phase 2.1.7)       | **0**       | Body size enforcement does not yet exist; will be created in Phase 2.1 Task 2.1.7    |

## Implementation Plan

### Subtask 2.2.8.1: Structured Audit Logging Function

**Create or add to**: `src/lib/server/security/auth-audit.ts`

This module provides the `logAuthEvent` function that emits structured JSON audit records for all authentication-relevant events. The function must be imported and called from the authentication middleware (created in Phase 2.1 Task 2.1.1) and the WebSocket authentication handler (created in Phase 2.1 Task 2.1.6).

#### Event Type Definitions

| Event Type            | Trigger                                                | Log Level | NIST AU-2 Mapping          |
| --------------------- | ------------------------------------------------------ | --------- | -------------------------- |
| `AUTH_SUCCESS`        | Valid API key presented in `X-API-Key` header          | INFO      | Successful logon attempt   |
| `AUTH_FAILURE`        | Missing or invalid API key                             | WARN      | Unsuccessful logon attempt |
| `AUTH_RATE_LIMITED`   | Request rejected by rate limiter (Phase 2.2.5)         | WARN      | Access control decision    |
| `AUTH_BODY_TOO_LARGE` | Request rejected for exceeding body size (Phase 2.1.7) | WARN      | Access control decision    |
| `WS_AUTH_SUCCESS`     | WebSocket connection authenticated                     | INFO      | Successful logon attempt   |
| `WS_AUTH_FAILURE`     | WebSocket connection rejected (no/bad auth)            | WARN      | Unsuccessful logon attempt |

#### Audit Record Schema (NIST AU-3 Compliant)

Each audit record MUST contain these fields per NIST SP 800-53 AU-3:

| Field       | Type     | AU-3 Requirement       | Description                                                            |
| ----------- | -------- | ---------------------- | ---------------------------------------------------------------------- |
| `timestamp` | `string` | Date and time          | ISO 8601 format with timezone (e.g., `2026-02-08T14:30:00.000Z`)       |
| `event`     | `string` | Type of event          | One of the 6 event types defined above                                 |
| `ip`        | `string` | Subject identity       | Client IP from `X-Forwarded-For` header or socket address              |
| `path`      | `string` | Object affected        | Request URL pathname (e.g., `/api/hackrf/start-sweep`)                 |
| `method`    | `string` | Type of event (detail) | HTTP method (`GET`, `POST`, `PUT`, `DELETE`)                           |
| `userAgent` | `string` | Subject identity       | First 200 characters of `User-Agent` header                            |
| `reason`    | `string` | Outcome                | Human-readable reason for the event (e.g., `missing X-API-Key header`) |

#### Code Implementation

```typescript
// src/lib/server/security/auth-audit.ts

/**
 * Authentication audit event types per NIST SP 800-53 AU-2.
 */
export type AuthEventType =
	| 'AUTH_SUCCESS'
	| 'AUTH_FAILURE'
	| 'AUTH_RATE_LIMITED'
	| 'AUTH_BODY_TOO_LARGE'
	| 'WS_AUTH_SUCCESS'
	| 'WS_AUTH_FAILURE';

/**
 * Structured audit record per NIST SP 800-53 AU-3.
 */
export interface AuthAuditRecord {
	timestamp: string;
	event: AuthEventType;
	ip: string;
	path: string;
	method: string;
	userAgent: string | undefined;
	reason: string | undefined;
}

/**
 * Emit a structured audit log entry for an authentication event.
 *
 * Output format: single-line JSON to stdout. This is consumed by:
 * - systemd journal (journalctl -u argos-dev)
 * - logrotate (Phase 2.2.12)
 * - Future SIEM integration
 *
 * The User-Agent is truncated to 200 characters to prevent log injection
 * via oversized header values.
 */
export function logAuthEvent(request: Request, event: AuthEventType, reason?: string): void {
	const url = new URL(request.url);
	const record: AuthAuditRecord = {
		timestamp: new Date().toISOString(),
		event,
		ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
		path: url.pathname,
		method: request.method,
		userAgent: request.headers.get('user-agent')?.substring(0, 200),
		reason: reason || undefined
	};

	// Emit as single-line JSON for machine parsing
	// Use console.warn for failures (visible in default log levels)
	// Use console.log for successes (filterable)
	if (event.includes('FAILURE') || event.includes('LIMITED') || event.includes('TOO_LARGE')) {
		console.warn(JSON.stringify(record));
	} else {
		console.log(JSON.stringify(record));
	}
}

/**
 * Emit a structured audit log entry for a WebSocket authentication event.
 *
 * WebSocket upgrade requests do not have a standard Request object in all
 * contexts. This overload accepts raw connection metadata.
 */
export function logWsAuthEvent(
	ip: string,
	path: string,
	event: 'WS_AUTH_SUCCESS' | 'WS_AUTH_FAILURE',
	reason?: string
): void {
	const record: AuthAuditRecord = {
		timestamp: new Date().toISOString(),
		event,
		ip,
		path,
		method: 'UPGRADE',
		userAgent: undefined,
		reason: reason || undefined
	};

	if (event === 'WS_AUTH_FAILURE') {
		console.warn(JSON.stringify(record));
	} else {
		console.log(JSON.stringify(record));
	}
}
```

#### Integration Points

The `logAuthEvent` function must be called at the following locations (these files are created by Phase 2.1):

| Call Site                                          | Event Type            | Trigger Condition                            |
| -------------------------------------------------- | --------------------- | -------------------------------------------- |
| Auth middleware -- after successful key validation | `AUTH_SUCCESS`        | `X-API-Key` matches `ARGOS_API_KEY` env var  |
| Auth middleware -- missing or invalid key          | `AUTH_FAILURE`        | `X-API-Key` header absent or does not match  |
| Rate limiter middleware (Phase 2.2.5)              | `AUTH_RATE_LIMITED`   | Token bucket exhausted for client IP         |
| Body size middleware (Phase 2.1.7)                 | `AUTH_BODY_TOO_LARGE` | `Content-Length` exceeds configured maximum  |
| WebSocket auth handler -- successful auth          | `WS_AUTH_SUCCESS`     | WebSocket upgrade includes valid API key     |
| WebSocket auth handler -- failed auth              | `WS_AUTH_FAILURE`     | WebSocket upgrade missing or invalid API key |

**BEFORE** (no audit logging -- current state):

```typescript
// In auth middleware (Phase 2.1 creates this)
if (!apiKey || apiKey !== process.env.ARGOS_API_KEY) {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```

**AFTER** (with audit logging):

```typescript
import { logAuthEvent } from '$lib/server/security/auth-audit';

// In auth middleware
if (!apiKey || apiKey !== process.env.ARGOS_API_KEY) {
	logAuthEvent(request, 'AUTH_FAILURE', 'Invalid or missing X-API-Key');
	return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
logAuthEvent(request, 'AUTH_SUCCESS');
```

### Subtask 2.2.8.2: Verification

#### Test 1: Trigger AUTH_FAILURE and verify structured log output

```bash
# 1. Start the dev server (Phase 2.1 auth must be active)
# 2. Send request without API key
curl -s http://localhost:5173/api/system/info 2>&1

# 3. Check server stderr/stdout for structured JSON log entry
# Expected output in server logs (single line, formatted here for readability):
# {
#   "timestamp": "2026-02-08T14:30:00.000Z",
#   "event": "AUTH_FAILURE",
#   "ip": "127.0.0.1",
#   "path": "/api/system/info",
#   "method": "GET",
#   "userAgent": "curl/8.x.x",
#   "reason": "Invalid or missing X-API-Key"
# }
```

#### Test 2: Trigger AUTH_SUCCESS and verify log output

```bash
# Send authenticated request
curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info 2>&1

# Expected output in server logs:
# {"timestamp":"2026-02-08T...","event":"AUTH_SUCCESS","ip":"127.0.0.1","path":"/api/system/info","method":"GET","userAgent":"curl/8.x.x"}
```

#### Test 3: Verify all event types are defined in source

```bash
# Verify all 6 event types are present in the type definition
grep -c "AUTH_SUCCESS\|AUTH_FAILURE\|AUTH_RATE_LIMITED\|AUTH_BODY_TOO_LARGE\|WS_AUTH_SUCCESS\|WS_AUTH_FAILURE" \
    src/lib/server/security/auth-audit.ts
# Expected: >= 6 (each type appears in the type union + at least one usage)
```

#### Test 4: Verify log output is valid JSON

```bash
# Capture server output during auth failure, parse with jq
curl -s http://localhost:5173/api/system/info 2>&1
# In a separate terminal, capture last log line and validate:
# journalctl -u argos-dev -n 1 --output=cat | jq .
# Expected: jq parses successfully (exit code 0), output includes "event": "AUTH_FAILURE"
```

#### Test 5: Verify logAuthEvent function exists and is exported

```bash
grep -rn "export function logAuthEvent" src/lib/server/security/ --include="*.ts" | wc -l
# Expected: 1

grep -rn "export function logWsAuthEvent" src/lib/server/security/ --include="*.ts" | wc -l
# Expected: 1
```

## Verification Checklist

1. **Trigger AUTH_FAILURE and verify structured JSON log output**

    ```bash
    curl -s http://localhost:5173/api/system/info 2>&1
    # Check server logs for AUTH_FAILURE JSON entry
    # Expected: {"timestamp":"...","event":"AUTH_FAILURE","ip":"127.0.0.1","path":"/api/system/info",...}
    ```

2. **Trigger AUTH_SUCCESS and verify log output**

    ```bash
    curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info 2>&1
    # Check server logs for AUTH_SUCCESS JSON entry
    # Expected: {"timestamp":"...","event":"AUTH_SUCCESS",...}
    ```

3. **Verify all 6 event types are defined in source**

    ```bash
    grep -c "AUTH_SUCCESS\|AUTH_FAILURE\|AUTH_RATE_LIMITED\|AUTH_BODY_TOO_LARGE\|WS_AUTH_SUCCESS\|WS_AUTH_FAILURE" \
        src/lib/server/security/auth-audit.ts
    # Expected: >= 6
    ```

4. **Verify log output is valid JSON**

    ```bash
    journalctl -u argos-dev -n 1 --output=cat | jq .
    # Expected: jq parses successfully (exit code 0)
    ```

5. **Verify logAuthEvent and logWsAuthEvent functions are exported**
    ```bash
    grep -rn "export function logAuthEvent" src/lib/server/security/ --include="*.ts" | wc -l
    # Expected: 1
    grep -rn "export function logWsAuthEvent" src/lib/server/security/ --include="*.ts" | wc -l
    # Expected: 1
    ```

## Commit Strategy

```
security(phase2.2.8): add structured authentication audit logging

Phase 2.2 Task 8: Authentication Audit Logging (NIST AU-2/AU-3)
- logAuthEvent() emits structured JSON for 6 auth event types
- logWsAuthEvent() handles WebSocket upgrade events
- AU-3 compliant: timestamp, event type, IP, path, method, user-agent, reason
Verified: curl without API key produces AUTH_FAILURE JSON in server logs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Revert this single commit (preserves staging area)
git reset --soft HEAD~1

# If auth-audit.ts was the only new file, remove it
rm -f src/lib/server/security/auth-audit.ts

# Remove import lines from auth middleware (if already integrated)
# Manual: remove `import { logAuthEvent }` and `logAuthEvent(...)` calls
```

## Risk Assessment

| Risk                                     | Level  | Mitigation                                                                                   |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Log injection via crafted User-Agent     | LOW    | User-Agent truncated to 200 chars; JSON.stringify escapes control characters                 |
| Log volume under brute-force attack      | MEDIUM | Rate limiter (Phase 2.2.5) limits to 10 req/min; log rotation (Phase 2.2.12) manages disk    |
| Performance overhead on auth hot path    | LOW    | console.log/warn are synchronous but lightweight; no I/O beyond stdout                       |
| Sensitive data in logs (API key values)  | HIGH   | logAuthEvent NEVER logs the API key value -- only logs the event outcome                     |
| Log tampering by compromised application | MEDIUM | Logs to stdout -> systemd journal (append-only); Phase 2.2.11 AppArmor restricts file access |

## Standards Traceability

| Standard       | Control    | Requirement                                   | How This Task Satisfies It                                           |
| -------------- | ---------- | --------------------------------------------- | -------------------------------------------------------------------- |
| NIST SP 800-53 | AU-2       | Audit events: logon success/failure           | All 6 event types cover logon success, failure, and access denial    |
| NIST SP 800-53 | AU-3       | Content: date, type, subject, outcome, source | Record schema: timestamp, event, ip, path, method, userAgent, reason |
| NIST SP 800-53 | AU-3(1)    | Additional audit information                  | User-Agent field provides client fingerprint                         |
| NIST SP 800-53 | AU-8       | Time stamps with UTC                          | ISO 8601 with `Z` suffix (UTC)                                       |
| OWASP Top 10   | A09:2021   | Security Logging and Monitoring Failures      | Structured logging for all auth events                               |
| DISA STIG      | APP-SEC-05 | Application must log authentication events    | Direct implementation                                                |

## Execution Tracking

| Subtask | Description                                         | Status  | Started | Completed | Verified By |
| ------- | --------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.8.1 | Structured audit logging function (logAuthEvent)    | PENDING | --      | --        | --          |
| 2.2.8.2 | Verification (trigger auth failure, check JSON log) | PENDING | --      | --        | --          |
