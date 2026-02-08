# Phase 2.2.5: Rate Limiting for Hardware Control Endpoints

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A04:2021 (Insecure Design), NIST SP 800-53 SC-5 (Denial of Service Protection), DISA STIG V-222611, CWE-770 (Allocation of Resources Without Limits)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

Implement in-memory token-bucket rate limiting for all hardware control API endpoints, preventing rapid-fire requests from overwhelming the single-instance Raspberry Pi 5 or causing undefined hardware states on HackRF, Kismet, GSM Evil, USRP, DroneID, and OpenWebRX devices.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | MEDIUM -- Legitimate rapid operations may be blocked if limits are too aggressive              |
| Severity      | MEDIUM                                                                                         |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 2 files (1 new `rate-limiter.ts` + 1 modified `hooks.server.ts`)                               |
| Blocks        | Phase 2.2.6 (security testing includes rate limit verification)                                |
| Blocked By    | Phase 2.2.3 (security headers should be in place before adding rate limiting)                  |

## Threat Context

The Argos device runs on a Raspberry Pi 5 with 8 GB RAM and a quad-core Cortex-A76 processor. It is a single-instance deployment with no load balancer or horizontal scaling. Without rate limiting:

1. **Hardware state corruption**: Rapid successive start/stop commands to HackRF, USRP, or GSM Evil can leave SDR hardware in undefined states. For example, issuing 15 `hackrf_sweep` start commands in 1 second while the previous sweep has not terminated causes process accumulation and eventually OOM.
2. **Resource exhaustion**: Each API request to hardware control endpoints spawns subprocesses (`hostExec`, `child_process`). Without limits, a single client can exhaust the RPi's process table (default max ~32768 PIDs).
3. **Denial of service**: An adversary on the same tactical network (or a compromised operator workstation) can flood hardware control endpoints and render the device non-operational during a training exercise.
4. **No existing protection**: Zero rate limiting exists anywhere in the Argos codebase. Every API endpoint accepts unlimited requests at any rate.

Per OWASP A04:2021: "Insecure Design -- lack of business logic controls to prevent abuse."

## Current State Assessment

**Verified 2026-02-08** against the live codebase.

```bash
# Search for any existing rate limiting implementation
grep -rn "rate.limit\|rateLimit\|RateLimiter\|throttle\|429" src/ --include="*.ts" | wc -l
# Result: 0

# Count hardware control endpoints that need protection
find src/routes/api/hackrf src/routes/api/kismet/control \
     src/routes/api/gsm-evil src/routes/api/droneid \
     src/routes/api/rf src/routes/api/openwebrx/control \
     -name "+server.ts" 2>/dev/null | wc -l
# Result: ~25 endpoint files
```

**Current state**: Zero rate limiting exists. All 25+ hardware control endpoint files accept unlimited requests at any rate from any authenticated client.

## Implementation Plan

### Subtask 2.2.5.1: Create Rate Limiter

**Create file**: `src/lib/server/security/rate-limiter.ts`

A token-bucket rate limiter appropriate for single-instance tactical deployment. No external dependencies required (no Redis, no distributed state).

```typescript
/**
 * In-memory token bucket rate limiter.
 *
 * Designed for single-instance tactical deployment on RPi 5.
 * No external dependencies (Redis, etc.) required.
 *
 * Policies:
 *   - Hardware control endpoints: 10 requests/minute
 *   - Data query endpoints: 60 requests/minute
 *   - Streaming endpoints: excluded (long-lived connections)
 *   - Health/status endpoints: unlimited
 *
 * Standards: OWASP A04:2021, NIST SP 800-53 SC-5, CWE-770
 */
export class RateLimiter {
	private buckets = new Map<string, { tokens: number; lastRefill: number }>();

	/**
	 * Check if a request is allowed under the rate limit.
	 *
	 * @param key - Unique identifier for the client (e.g., IP address or API key)
	 * @param maxTokens - Maximum tokens in the bucket (burst capacity)
	 * @param refillRate - Tokens added per second
	 * @returns true if request is allowed, false if rate-limited
	 */
	check(key: string, maxTokens: number, refillRate: number): boolean {
		const now = Date.now();
		const bucket = this.buckets.get(key) ?? { tokens: maxTokens, lastRefill: now };

		// Refill tokens based on elapsed time
		const elapsed = (now - bucket.lastRefill) / 1000;
		bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
		bucket.lastRefill = now;

		if (bucket.tokens >= 1) {
			bucket.tokens -= 1;
			this.buckets.set(key, bucket);
			return true; // Allowed
		}
		this.buckets.set(key, bucket);
		return false; // Rate limited
	}

	/**
	 * Cleanup stale bucket entries to prevent memory growth.
	 * Call periodically (e.g., every 5 minutes via setInterval).
	 */
	cleanup(): void {
		const cutoff = Date.now() - 300_000; // 5 minutes
		for (const [key, bucket] of this.buckets) {
			if (bucket.lastRefill < cutoff) {
				this.buckets.delete(key);
			}
		}
	}
}
```

**Design decisions**:

- **Token bucket algorithm**: Chosen over fixed-window or sliding-window because it allows short bursts (up to `maxTokens`) while enforcing a sustained rate (`refillRate`). This matches the operational pattern of hardware control: an operator may issue 3-4 commands in quick succession, but sustained rapid-fire is always abusive.
- **In-memory storage**: Appropriate for single-instance deployment. No Redis or external state store needed.
- **Cleanup method**: Prevents unbounded `Map` growth. Called on a 5-minute `setInterval` in `hooks.server.ts`.
- **Key parameter**: Allows rate limiting by IP, API key, or other identifier. In the hooks integration, the key is the client IP address concatenated with the endpoint path category.

**Integration in `hooks.server.ts`**:

```typescript
import { RateLimiter } from '$lib/server/security/rate-limiter';

// Singleton rate limiter (globalThis for HMR persistence)
const rateLimiter =
	((globalThis as Record<string, unknown>).__rateLimiter as RateLimiter) ?? new RateLimiter();
(globalThis as Record<string, unknown>).__rateLimiter = rateLimiter;

// Cleanup interval (globalThis guard for HMR)
if (!(globalThis as Record<string, unknown>).__rateLimiterCleanup) {
	(globalThis as Record<string, unknown>).__rateLimiterCleanup = setInterval(
		() => rateLimiter.cleanup(),
		300_000
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const clientIp = event.getClientAddress();

	// Skip rate limiting for streaming/SSE endpoints
	if (path.includes('data-stream') || path.includes('/stream') || path.endsWith('/sse')) {
		// Long-lived connections, do not rate limit
	} else if (isHardwareControlPath(path)) {
		// Hardware control: 10 requests/minute (0.167 tokens/second)
		if (!rateLimiter.check(`hw:${clientIp}`, 10, 10 / 60)) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': '60'
				}
			});
		}
	} else if (path.startsWith('/api/')) {
		// Data queries: 60 requests/minute (1 token/second)
		if (!rateLimiter.check(`api:${clientIp}`, 60, 1)) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': '10'
				}
			});
		}
	}

	const response = await resolve(event);
	return response;
};

function isHardwareControlPath(path: string): boolean {
	const hwPatterns = [
		'/api/hackrf/',
		'/api/kismet/control/',
		'/api/gsm-evil/',
		'/api/droneid/',
		'/api/rf/',
		'/api/openwebrx/control/'
	];
	return hwPatterns.some((p) => path.startsWith(p));
}
```

### Subtask 2.2.5.2: Rate Limit Policy Table

The following table defines the rate limit policy for all Argos API endpoint categories.

| Endpoint Pattern                                   | Rate Limit   | Burst Capacity | Refill Rate      | Rationale                                |
| -------------------------------------------------- | ------------ | -------------- | ---------------- | ---------------------------------------- |
| `/api/hackrf/*` (except `data-stream`)             | 10 req/min   | 10             | 0.167 tokens/sec | Hardware state changes                   |
| `/api/kismet/control/*`                            | 10 req/min   | 10             | 0.167 tokens/sec | Service start/stop                       |
| `/api/gsm-evil/*` (except `imsi-data`, `imsi`)     | 10 req/min   | 10             | 0.167 tokens/sec | GSM hardware control                     |
| `/api/droneid/*`                                   | 10 req/min   | 10             | 0.167 tokens/sec | DroneID hardware                         |
| `/api/rf/*` (except `data-stream`)                 | 10 req/min   | 10             | 0.167 tokens/sec | RF hardware control                      |
| `/api/openwebrx/control/*`                         | 10 req/min   | 10             | 0.167 tokens/sec | OpenWebRX receiver control               |
| All other `/api/*`                                 | 60 req/min   | 60             | 1.0 tokens/sec   | Data queries and status checks           |
| Streaming endpoints (`data-stream`, `stream`, SSE) | **Excluded** | N/A            | N/A              | Long-lived connections, not rate limited |
| Non-API routes (`/`, `/hackrf`, `/kismet`, etc.)   | **Excluded** | N/A            | N/A              | Static pages and SvelteKit routes        |

**Exclusion rationale for streaming endpoints**: SSE and data-stream endpoints are long-lived HTTP connections that remain open for minutes or hours. Rate limiting them would prevent operators from establishing new monitoring sessions. These endpoints are protected by authentication (Phase 2.1) instead.

### Subtask 2.2.5.3: Verification

After implementing rate limiting, execute the following burst test:

```bash
# Burst test against hardware endpoint
for i in $(seq 1 15); do
    curl -s -o /dev/null -w "%{http_code}\n" -H "X-API-Key: $ARGOS_API_KEY" \
        http://localhost:5173/api/hackrf/status
done
# Expected: First 10 return 200, last 5 return 429
```

**Interpretation**:

- Status codes 1-10: `200` (requests allowed, tokens available)
- Status codes 11-15: `429` (rate limited, tokens exhausted)
- If all 15 return `200`: Rate limiting is not active. Check that the `hooks.server.ts` integration is correct and that the `isHardwareControlPath` function matches the test URL.
- If fewer than 10 return `200`: Rate limit is too aggressive. Check the `maxTokens` and `refillRate` parameters.

**Additional verification**:

```bash
# Verify data query endpoints have higher limits
for i in $(seq 1 65); do
    curl -s -o /dev/null -w "%{http_code}\n" -H "X-API-Key: $ARGOS_API_KEY" \
        http://localhost:5173/api/system/info
done
# Expected: First 60 return 200, last 5 return 429

# Verify streaming endpoints are not rate limited
curl -s -o /dev/null -w "%{http_code}\n" -H "X-API-Key: $ARGOS_API_KEY" \
    http://localhost:5173/api/rf/data-stream
# Expected: 200 (regardless of previous rate limit state)
```

## Verification Checklist

| #   | Command                                                 | Expected Result | Purpose                            |
| --- | ------------------------------------------------------- | --------------- | ---------------------------------- |
| 1   | Burst test (15 requests to `/api/hackrf/status`)        | 10x 200, 5x 429 | Hardware control rate limit active |
| 2   | Burst test (65 requests to `/api/system/info`)          | 60x 200, 5x 429 | Data query rate limit active       |
| 3   | Single request to `/api/rf/data-stream`                 | 200             | Streaming endpoints excluded       |
| 4   | `grep -rn "RateLimiter" src/ --include="*.ts" \| wc -l` | >= 2            | Rate limiter imported and used     |
| 5   | `npm run typecheck`                                     | Exit 0          | No type regressions                |
| 6   | `npm run build`                                         | Exit 0          | Build integrity preserved          |

## Commit Strategy

```
security(phase2.2.5): add token-bucket rate limiting for hardware control endpoints

Phase 2.2 Task 5: Rate Limiting
- Created src/lib/server/security/rate-limiter.ts (token bucket algorithm)
- Hardware control endpoints: 10 req/min (hackrf, kismet, gsm-evil, droneid, rf, openwebrx)
- Data query endpoints: 60 req/min
- Streaming/SSE endpoints: excluded (long-lived connections)
- Automatic stale bucket cleanup every 5 minutes
Verified: burst test 15 requests = 10x 200 + 5x 429

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Single-task rollback
git reset --soft HEAD~1

# Verify rate limiting is removed
grep -rn "RateLimiter\|429" src/ --include="*.ts" | wc -l
# Expected: 0

# Verify build integrity
npm run typecheck && npm run build
```

Rollback removes all rate limiting. API endpoints will again accept unlimited requests. This may be acceptable temporarily if rate limits are blocking legitimate operations, but should be re-applied with adjusted thresholds as soon as possible.

## Risk Assessment

| Risk                                                      | Likelihood | Impact | Mitigation                                                                  |
| --------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Legitimate rapid hardware operations blocked              | MEDIUM     | MEDIUM | 10 req/min allows ~6-second spacing; normal operations are slower           |
| Rate limiter memory growth from many unique IPs           | LOW        | LOW    | Cleanup runs every 5 minutes; stale entries (5+ min old) are removed        |
| globalThis singleton lost on full server restart          | LOW        | LOW    | Rate limits reset on restart; this is acceptable behavior                   |
| Client IP spoofing bypasses rate limit                    | LOW        | MEDIUM | In tactical deployment, network is not Internet-exposed; IP trust is higher |
| HMR during development creates multiple cleanup intervals | MEDIUM     | LOW    | globalThis guard prevents duplicate intervals                               |

## Standards Traceability

| Standard             | Requirement                                          | Satisfied By                                       |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| OWASP A04:2021       | Insecure Design -- lack of rate limiting             | Token bucket rate limiter on all control endpoints |
| NIST SP 800-53 SC-5  | Denial of Service Protection                         | Rate limiting prevents resource exhaustion         |
| NIST SP 800-53 SI-11 | Error Handling -- generate meaningful error messages | 429 response includes `Retry-After` header         |
| DISA STIG V-222611   | Application must limit resource usage                | Per-IP rate limiting with configurable thresholds  |
| CWE-770              | Allocation of Resources Without Limits or Throttling | All API endpoints now have defined resource limits |
| CWE-799              | Improper Control of Interaction Frequency            | Token bucket algorithm enforces request frequency  |

## Execution Tracking

| Subtask | Description                          | Status  | Started | Completed | Verified By |
| ------- | ------------------------------------ | ------- | ------- | --------- | ----------- |
| 2.2.5.1 | Create rate limiter class            | PENDING | --      | --        | --          |
| 2.2.5.2 | Apply rate limits in hooks.server.ts | PENDING | --      | --        | --          |
| 2.2.5.3 | Verification (burst tests)           | PENDING | --      | --        | --          |
