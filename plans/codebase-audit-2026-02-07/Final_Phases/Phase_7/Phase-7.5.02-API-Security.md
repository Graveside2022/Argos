# Phase 7.5.02: API Security -- Authentication and Rate Limiting

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.1, items 6-7)
**Risk Level**: HIGH -- Security controls on RF transmission endpoints
**Prerequisites**: Phase-7.5.01 route files created; Phase 2.1.1 auth gate operational
**Estimated Duration**: 3-4 hours
**Estimated Files Modified**: 3 (start, stop, cache route files) + 1 (.env.example) + 1 (docker-compose)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Apply API key authentication and rate limiting to all mutation endpoints (POST and DELETE) under `/api/hackrf/transmit/`. RF transmission control endpoints CANNOT ship without authentication in a military deployment. This is a hard requirement.

**Compliance**: CERT MSC00 (use strong authentication), CERT DOS00 (guard against resource exhaustion).

**Context**: Phase 2.1.1 (installed 2026-02-08) added a global ARGOS_API_KEY auth gate in `src/hooks.server.ts` for ALL `/api/` routes. The HACKRF_API_KEY described here provides a SECONDARY, endpoint-specific authentication layer for the highest-risk mutation endpoints (RF transmission start/stop). This defense-in-depth approach ensures that even if the global gate is misconfigured, transmission control remains protected.

---

## 1. API Key Authentication on Mutation Endpoints

### Scope

Apply to these routes (from Phase-7.5.01 route mapping):

| Route # | Endpoint                                          | Method | Reason                         |
| ------- | ------------------------------------------------- | ------ | ------------------------------ |
| 3       | `src/routes/api/hackrf/transmit/start/+server.ts` | POST   | Starts RF transmission         |
| 4       | `src/routes/api/hackrf/transmit/stop/+server.ts`  | POST   | Stops RF transmission          |
| 8       | `src/routes/api/hackrf/transmit/cache/+server.ts` | DELETE | Destroys generated signal data |

GET endpoints (status, workflows, health, bands, safety, device, library, events) remain accessible for monitoring purposes. They are still protected by the global ARGOS_API_KEY auth gate in hooks.server.ts.

### Implementation

```typescript
const HACKRF_API_KEY = process.env.HACKRF_API_KEY;

function authenticateRequest(request: Request): boolean {
	if (!HACKRF_API_KEY) {
		// If no API key is configured, deny all mutation requests in production
		if (process.env.NODE_ENV === 'production') return false;
		// Allow in development for testing
		return true;
	}
	const authHeader = request.headers.get('Authorization');
	return authHeader === `Bearer ${HACKRF_API_KEY}`;
}
```

**Fail-closed behavior in production**: If `HACKRF_API_KEY` is not set and `NODE_ENV=production`, ALL mutation requests are denied. This prevents accidental deployment without authentication.

**Development behavior**: If `HACKRF_API_KEY` is not set and `NODE_ENV` is not `production`, mutation requests are allowed without authentication for developer convenience.

### Usage in Route Handlers

```typescript
// src/routes/api/hackrf/transmit/start/+server.ts
export async function POST({ request }: RequestEvent): Promise<Response> {
	if (!authenticateRequest(request)) {
		return errorResponse('Unauthorized', 'AUTH_REQUIRED', 401);
	}
	// ... process start workflow
}
```

### Environment Variable Configuration

**Add `HACKRF_API_KEY` to `.env.example`**:

```bash
# HackRF Transmit API Key (required in production, optional in development)
# Minimum 32 characters. Generate with: openssl rand -hex 32
HACKRF_API_KEY=
```

**Add to `docker/docker-compose.portainer-dev.yml`** in the argos-dev service environment section:

```yaml
- HACKRF_API_KEY=${HACKRF_API_KEY:-}
```

### Security Notes

- The `authenticateRequest` function uses a simple string comparison. For timing-attack resistance, use `crypto.timingSafeEqual()` (noted in independent security audit: 0 instances of `timingSafeEqual` in codebase). However, this is acceptable for the minimum viable authentication scope; Phase 2 will implement full constant-time comparison.
- The Bearer token scheme follows RFC 6750.
- The HACKRF_API_KEY is separate from ARGOS_API_KEY to allow independent key rotation for RF-specific operations.

---

## 2. Rate Limiting on Transmission Control Endpoints

### Threat Model

The `POST /api/hackrf/transmit/start` endpoint triggers:

1. CPU-intensive signal generation (numpy I/Q math in Python, or equivalent TypeScript DSP)
2. Disk I/O writing generated signal files
3. Hardware subprocess spawning (`hackrf_transfer`)

Without rate limiting, an attacker (or a malfunctioning frontend retry loop) can flood this endpoint to cause denial of service on the RPi 5.

### Scope

Apply to these routes:

| Route # | Endpoint                                          | Method | Reason                                |
| ------- | ------------------------------------------------- | ------ | ------------------------------------- |
| 3       | `src/routes/api/hackrf/transmit/start/+server.ts` | POST   | CPU-intensive, spawns subprocess      |
| 4       | `src/routes/api/hackrf/transmit/stop/+server.ts`  | POST   | Subprocess management, state mutation |

### Implementation

Simple in-memory rate limiter (no external dependency):

```typescript
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 3; // Max 3 start requests per 10 seconds

const requestLog: number[] = [];

function checkRateLimit(): boolean {
	const now = Date.now();
	// Remove entries older than window
	while (requestLog.length > 0 && requestLog[0] < now - RATE_LIMIT_WINDOW_MS) {
		requestLog.shift();
	}
	if (requestLog.length >= RATE_LIMIT_MAX_REQUESTS) {
		return false; // Rate limited
	}
	requestLog.push(now);
	return true;
}
```

### Rate Limited Response

When rate limited, return HTTP 429 with `Retry-After` header:

```typescript
if (!checkRateLimit()) {
	return new Response(
		JSON.stringify({
			success: false,
			error: 'Too many requests. Please wait before retrying.',
			code: 'RATE_LIMITED',
			timestamp: new Date().toISOString()
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
			}
		}
	);
}
```

### Combined Usage in Route Handler

```typescript
// src/routes/api/hackrf/transmit/start/+server.ts
export async function POST({ request }: RequestEvent): Promise<Response> {
	// 1. Authentication first
	if (!authenticateRequest(request)) {
		return errorResponse('Unauthorized', 'AUTH_REQUIRED', 401);
	}

	// 2. Rate limiting second
	if (!checkRateLimit()) {
		return new Response(
			JSON.stringify({
				success: false,
				error: 'Too many requests. Please wait before retrying.',
				code: 'RATE_LIMITED',
				timestamp: new Date().toISOString()
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
				}
			}
		);
	}

	// 3. Zod validation third
	// ... validate request body ...

	// 4. Process request
	// ... call service layer ...
}
```

Order of middleware: Authentication -> Rate Limiting -> Validation -> Processing.

### Scalability Note

The in-memory rate limiter is appropriate for a single-instance RPi 5 deployment. If Argos is ever deployed with multiple instances behind a load balancer, this must be replaced with a shared store (Redis, SQLite). For the current field deployment model, in-memory is correct.

---

## Verification Commands

```bash
# Verify HACKRF_API_KEY in .env.example
grep "HACKRF_API_KEY" .env.example

# Verify HACKRF_API_KEY in docker compose
grep "HACKRF_API_KEY" docker/docker-compose.portainer-dev.yml

# Verify authenticateRequest in mutation routes
grep -l "authenticateRequest" \
  src/routes/api/hackrf/transmit/start/+server.ts \
  src/routes/api/hackrf/transmit/stop/+server.ts \
  src/routes/api/hackrf/transmit/cache/+server.ts

# Verify rate limiting in start and stop routes
grep -l "checkRateLimit" \
  src/routes/api/hackrf/transmit/start/+server.ts \
  src/routes/api/hackrf/transmit/stop/+server.ts

# Test unauthenticated POST is rejected (production mode)
NODE_ENV=production curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:5173/api/hackrf/transmit/start \
  -H "Content-Type: application/json" \
  -d '{"workflow":"test"}'
# Expected: 401

# Test authenticated POST is accepted
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:5173/api/hackrf/transmit/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HACKRF_API_KEY" \
  -d '{"workflow":"test","frequency":433,"sampleRate":2,"gain":20,"duration":5}'
# Expected: 200 (or 400 if workflow not found)

# Test rate limiting (send 4 rapid requests, 4th should be 429)
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:5173/api/hackrf/transmit/start \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $HACKRF_API_KEY" \
    -d '{"workflow":"test","frequency":433,"sampleRate":2,"gain":20,"duration":5}'
done
# Expected: 200/200/200/429 (or 400s if workflow invalid, but NOT 429 until 4th)

# Verify Retry-After header on 429
curl -s -D- -X POST http://localhost:5173/api/hackrf/transmit/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HACKRF_API_KEY" \
  -d '{"workflow":"test"}' | grep "Retry-After"
# Expected: Retry-After: 10
```

---

## Verification Checklist

- [ ] `HACKRF_API_KEY` added to `.env.example` with generation instructions
- [ ] `HACKRF_API_KEY` added to Docker compose environment section
- [ ] `authenticateRequest()` implemented in all 3 mutation routes (start, stop, cache DELETE)
- [ ] Unauthenticated POST returns HTTP 401 with `AUTH_REQUIRED` code
- [ ] Missing API key in production returns HTTP 401 (fail-closed)
- [ ] Missing API key in development allows requests (fail-open for dev convenience)
- [ ] `checkRateLimit()` implemented in start and stop routes
- [ ] 4th request within 10 seconds returns HTTP 429
- [ ] HTTP 429 response includes `Retry-After` header
- [ ] Rate limit response uses consistent error format (`{ success, error, code, timestamp }`)
- [ ] Middleware order is: auth -> rate limit -> validation -> processing
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Definition of Done

1. All POST/DELETE endpoints require `Authorization: Bearer <HACKRF_API_KEY>` header
2. Production mode rejects ALL mutations when HACKRF_API_KEY is unset
3. Rate limiter correctly enforces 3 requests per 10 seconds on start/stop
4. HTTP 429 with Retry-After header returned when rate limited
5. CERT MSC00 (strong authentication) and DOS00 (resource exhaustion guard) requirements met

---

## Cross-References

- **Phase-7.5.01**: Route files where auth and rate limiting are applied
- **Phase 2.1.1**: Global ARGOS_API_KEY auth gate in `src/hooks.server.ts`
- **Independent Security Audit (2026-02-08)**: Finding that 0 instances of `timingSafeEqual` exist in codebase
- **Phase 7.6**: Verification suite must include auth and rate limit tests
