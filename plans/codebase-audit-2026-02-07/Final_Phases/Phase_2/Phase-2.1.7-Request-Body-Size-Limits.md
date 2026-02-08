# Phase 2.1.7: Request Body Size Limits

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A05:2021 (Security Misconfiguration), CWE-400 (Uncontrolled Resource Consumption), CWE-770 (Allocation of Resources Without Limits), NIST SP 800-53 SC-5 (Denial of Service Protection), DISA STIG V-222602 (Application must limit resources)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task adds request body size limits to the SvelteKit hooks middleware to prevent Denial of Service attacks via oversized HTTP request bodies. On an 8GB Raspberry Pi 5 running multiple services (Node.js, Kismet, HackRF backend, Docker containers) with earlyoom active, a single POST request with a multi-gigabyte body can exhaust available memory and trigger OOM killing of critical processes. This task was a COMPLETE GAP identified by the independent regrade audit (finding A7).

## Execution Constraints

| Constraint       | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Risk Level       | LOW -- legitimate requests to hardware endpoints are small (<64KB) |
| Severity         | HIGH                                                               |
| Prerequisites    | Task 2.1.1 (hooks.server.ts must have the auth gate in place)      |
| Files Touched    | 1 file modified: `src/hooks.server.ts`                             |
| Blocks           | None                                                               |
| Blocked By       | Task 2.1.1 (body size check should execute after auth check)       |
| Estimated Effort | 30 minutes                                                         |

## Threat Context

Argos runs on a Raspberry Pi 5 with 8GB of physical RAM, plus 4GB of zram-compressed swap. The system runs the following concurrent processes:

| Process                 | Typical Memory Usage | OOM Score |
| ----------------------- | -------------------- | --------- |
| Node.js (Argos)         | 500-800 MB           | Default   |
| Docker (argos-dev)      | 1536 MB limit        | Default   |
| Kismet                  | 200-400 MB           | Default   |
| HackRF backend (Python) | 100-200 MB           | Default   |
| Ollama (on-demand)      | 2048 MB limit        | Default   |
| earlyoom                | <10 MB               | -800      |

**Total committed memory under load**: ~4.5-5.0 GB of 8 GB physical.

**Attack scenario**: An attacker sends a single HTTP POST request with `Content-Length: 4294967296` (4GB) to any API endpoint. SvelteKit begins buffering the request body into Node.js heap memory. With `--max-old-space-size=1024`, Node.js will attempt to allocate beyond its V8 heap limit, but the kernel allocates physical pages for the incoming TCP stream before V8 can react. This triggers:

1. Physical memory exhaustion (8GB RAM + 4GB zram consumed)
2. earlyoom activates and kills the largest non-protected process (likely Node.js itself)
3. Docker container restarts, but the attacker can repeat the attack immediately
4. Continuous OOM kill loop disrupts all sensor data collection during tactical operations

**Current state**: No request body size limits exist anywhere in the codebase. The SvelteKit framework does not impose default body size limits. The rate limiter planned in Phase 2.2 limits request frequency but NOT request size.

## Current State Assessment

| Metric                                    | Value   | Verification Command                                                                                       |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Body size limit in hooks.server.ts        | NONE    | `grep -c "content-length\|Content-Length\|MAX_BODY\|BODY_LIMIT" src/hooks.server.ts` returns 0             |
| Body size limit in any middleware         | NONE    | `grep -rn "content-length\|MAX_BODY\|BODY_LIMIT" src/lib/server/ --include="*.ts" \| wc -l` returns 0      |
| SvelteKit default body limit              | NONE    | SvelteKit does not impose a default body size limit                                                        |
| POST/PUT endpoints in API routes          | ~38     | `grep -rln "request.json()\|request.text()\|request.formData()" src/routes/api/ --include="*.ts" \| wc -l` |
| Hardware control endpoints accepting POST | ~15     | Endpoints under hackrf/, kismet/, gsm-evil/, rf/, droneid/, openwebrx/                                     |
| RPi physical RAM                          | 8 GB    | `free -h \| grep Mem`                                                                                      |
| zram swap configured                      | 4 GB    | `swapon --show`                                                                                            |
| earlyoom active                           | YES     | `systemctl is-active earlyoom`                                                                             |
| Node.js max-old-space-size                | 1024 MB | `grep "max-old-space-size" .env` or NODE_OPTIONS                                                           |

## Implementation Plan

### Subtask 2.1.7.1: Add Body Size Limits to hooks.server.ts

**File**: `src/hooks.server.ts` (EXISTS, verified -- already modified by Tasks 2.1.1 and 2.1.6)

Add body size limit checking in the `handle` function, after authentication but before route processing. Two tiers of limits are applied:

| Limit Tier         | Value | Applies To                                                                    | Rationale                                                                      |
| ------------------ | ----- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Hardware endpoints | 64 KB | `/api/(hackrf\|kismet\|gsm-evil\|rf\|droneid\|openwebrx\|bettercap\|wifite)/` | Hardware control commands are small JSON objects; 64KB is 100x typical payload |
| General endpoints  | 10 MB | All other `/api/` endpoints                                                   | Agent queries, signal data uploads, configuration; 10MB covers all use cases   |

BEFORE (vulnerable):

```typescript
// hooks.server.ts -- current state (after Task 2.1.1 adds auth)
// No body size checking. Any size POST body is accepted.
export const handle: Handle = async ({ event, resolve }) => {
	// ... auth check from Task 2.1.1 ...

	// Request body is consumed by route handler with no size limit.
	// A 4GB POST body will exhaust memory before the route handler executes.
	return resolve(event);
};
```

AFTER (secure):

```typescript
// hooks.server.ts -- with body size limits (after auth check)
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB general limit
const HARDWARE_BODY_LIMIT = 64 * 1024; // 64KB for hardware control endpoints

// Hardware endpoint path pattern -- these control physical RF hardware
const HARDWARE_PATH_PATTERN =
	/^\/api\/(hackrf|kismet|gsm-evil|rf|droneid|openwebrx|bettercap|wifite)\//;

export const handle: Handle = async ({ event, resolve }) => {
	// ... auth check from Task 2.1.1 (runs first) ...

	// Body size limit check -- runs after auth, before route processing
	if (event.request.method === 'POST' || event.request.method === 'PUT') {
		const contentLength = parseInt(event.request.headers.get('content-length') || '0');
		const isHardwareEndpoint = HARDWARE_PATH_PATTERN.test(event.url.pathname);
		const limit = isHardwareEndpoint ? HARDWARE_BODY_LIMIT : MAX_BODY_SIZE;

		if (contentLength > limit) {
			return new Response(JSON.stringify({ error: 'Payload too large' }), {
				status: 413,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	return resolve(event);
};
```

**Key behaviors**:

1. **Two-tier limits**: Hardware control endpoints (which should only receive small JSON command objects) get a 64KB limit. General endpoints get 10MB.
2. **Content-Length based**: The check uses the `Content-Length` header, which is evaluated before any body buffering occurs. This prevents memory allocation for oversized requests.
3. **POST and PUT only**: GET, DELETE, and other methods typically have no request body. Limiting only POST and PUT avoids false positives.
4. **After auth**: The body size check runs after authentication. This means unauthenticated requests are rejected with 401 before the body size check, which is the correct order -- an unauthenticated attacker cannot probe body size limits to discover endpoint categories.
5. **413 status code**: The standard HTTP status code for "Payload Too Large" is 413 (RFC 7231 Section 6.5.11).

**Limitation**: A malicious client can lie about `Content-Length` (send a small header value but a large body). SvelteKit will buffer the actual body up to Node.js limits. To defend against this, a streaming body size check would be needed (reading the body in chunks and aborting if cumulative size exceeds the limit). This is a future enhancement. The `Content-Length` check still defends against:

- Honest clients sending accidentally large payloads
- Automated tools that set `Content-Length` correctly
- `curl` and similar tools that auto-compute `Content-Length`

**Defense in depth**: earlyoom (configured with `-m 10 -s 50`) provides a backstop. If a malicious client bypasses the `Content-Length` check with a misleading header and streams a massive body, earlyoom will kill the Node.js process before the system becomes completely unresponsive.

### Subtask 2.1.7.2: Verification

**Command 1 -- Large payload to hardware endpoint rejected**:

```bash
dd if=/dev/zero bs=65537 count=1 2>/dev/null | \
    curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "X-API-Key: $ARGOS_API_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @- http://localhost:5173/api/hackrf/start-sweep
```

**Expected result**: `413`

**Rationale**: `dd` generates 65,537 bytes (64KB + 1 byte), which exceeds the 64KB hardware endpoint limit. `curl` sets `Content-Length: 65537` automatically. The hooks middleware rejects the request with 413 before any route processing occurs.

**Command 2 -- Payload within limit accepted**:

```bash
echo '{"action":"start"}' | \
    curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "X-API-Key: $ARGOS_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @- http://localhost:5173/api/hackrf/start-sweep
```

**Expected result**: `200` (or appropriate response from the endpoint -- not 413)

**Rationale**: A small JSON payload (~20 bytes) is well within the 64KB limit and should pass through to normal route processing.

**Command 3 -- General endpoint accepts larger payload**:

```bash
dd if=/dev/zero bs=65537 count=1 2>/dev/null | \
    curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "X-API-Key: $ARGOS_API_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @- http://localhost:5173/api/agent/chat
```

**Expected result**: NOT `413` (general endpoint has 10MB limit, 65KB is within it)

**Rationale**: Non-hardware endpoints have the higher 10MB limit, so 65KB payloads are accepted.

## Verification Checklist

1. `grep -c "MAX_BODY_SIZE\|HARDWARE_BODY_LIMIT" src/hooks.server.ts` returns `2` (both constants defined)
2. `grep -c "413" src/hooks.server.ts` returns at least `1` (status code used)
3. Large payload to hardware endpoint returns `413` (dd + curl test above)
4. Small payload to hardware endpoint does NOT return `413`
5. 65KB payload to general endpoint does NOT return `413`
6. `npm run typecheck` exits 0
7. `npm run build` exits 0

## Commit Strategy

```
security(phase2.1.7): add request body size limits to prevent DoS

Phase 2.1 Task 7: Request Body Size Limits (NEW -- regrade A7)
- Added two-tier body size limits in hooks.server.ts
- Hardware endpoints (hackrf, kismet, gsm-evil, rf, etc.): 64KB limit
- General endpoints: 10MB limit
- Content-Length checked before body buffering (prevents memory allocation)
- 413 Payload Too Large returned for oversized requests
FINDING: No body size limits existed anywhere -- single POST could OOM the RPi
Verified: 65KB+1 payload to hardware endpoint returns 413

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

Note: After rollback, all API endpoints accept unlimited-size request bodies. The RPi becomes vulnerable to memory exhaustion via oversized POST requests. earlyoom provides a partial backstop but will kill the Node.js process.

## Risk Assessment

| Risk                                            | Likelihood | Impact | Mitigation                                                             |
| ----------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Legitimate large payload rejected               | LOW        | LOW    | Hardware commands are <1KB; general payloads rarely exceed 1MB         |
| Content-Length header spoofing bypasses check   | MEDIUM     | MEDIUM | earlyoom provides backstop; streaming body check is future enhancement |
| Pattern match misses a hardware endpoint prefix | LOW        | LOW    | Regex covers all 8 hardware service prefixes from the endpoint catalog |
| 10MB general limit too generous for RPi         | LOW        | LOW    | 10MB is <1% of available memory; unlikely to cause OOM in isolation    |
| False positive: file upload endpoint blocked    | LOW        | MEDIUM | No current file upload endpoints; add exceptions if needed             |

## Standards Traceability

| Standard                 | Requirement                                                       | How This Task Satisfies It                                               |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| OWASP A05:2021           | Security Misconfiguration -- default settings must be secure      | Body size limits added where framework default is unlimited              |
| CWE-400                  | Uncontrolled Resource Consumption                                 | Bounded memory allocation via Content-Length check before body buffering |
| CWE-770                  | Allocation of Resources Without Limits                            | Two-tier limits bound maximum allocation: 64KB hardware, 10MB general    |
| NIST SP 800-53 SC-5      | Denial of Service Protection                                      | Request body size limits prevent single-request memory exhaustion        |
| DISA STIG V-222602       | Application must limit resources allocated to processing requests | Body size limits enforce resource bounds per request                     |
| NASA/JPL Power of Ten #2 | All loops/resource allocations must have fixed upper bounds       | Request body processing bounded by explicit size limits                  |

## Execution Tracking

| Subtask | Description                   | Status  | Started | Completed | Verified By |
| ------- | ----------------------------- | ------- | ------- | --------- | ----------- |
| 2.1.7.1 | Add body size limits to hooks | PENDING | --      | --        | --          |
| 2.1.7.2 | Verification                  | PENDING | --      | --        | --          |
