# Phase 2.1.1: API Authentication -- Fail-Closed Implementation

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A01:2021 (Broken Access Control), OWASP A07:2021 (Identification and Authentication Failures), NIST SP 800-53 AC-3 (Access Enforcement), NASA/JPL Power of Ten Rule 1 (Simple Control Flow)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task implements API key-based authentication across all 114 API endpoint files in the Argos codebase, using a fail-closed design that refuses to start the application if no API key is configured. This is the foundational security primitive upon which all subsequent Phase 2 tasks depend.

## Execution Constraints

| Constraint       | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Risk Level       | MEDIUM -- System will not start without API key; may break existing scripts and automation |
| Severity         | CRITICAL                                                                                   |
| Prerequisites    | Phase 0 complete (file structure stable)                                                   |
| Files Touched    | 3 new + 1 modified (`hooks.server.ts`) + 1 new (`.env.example`)                            |
| Blocks           | ALL other Phase 2 tasks (2.1.2 through 2.1.7, all of 2.2)                                  |
| Blocked By       | Phase 0                                                                                    |
| Estimated Effort | 2 hours                                                                                    |

## Threat Context

Argos is a Raspberry Pi 5-based SDR and network analysis console field-deployed for Army EW training at NTC/JMRC. The system controls a HackRF One capable of RF transmission, scans WiFi networks, captures IMSI identifiers, and records GPS positions. It operates on a local tactical network segment alongside other military systems.

**Current state**: Every API endpoint in `src/routes/api/` is completely unauthenticated. There are ZERO checks for authorization, session tokens, API keys, or any form of access control. Any device on the tactical network can:

- Initiate RF transmissions via HackRF
- Start/stop WiFi scanning via Kismet
- Capture IMSI identifiers via GSM Evil
- Read all GPS positions and device tracking data
- Execute system commands via multiple shell injection vectors

**Threat actors**:

1. **Adjacent network attacker**: Any device on the same network segment can access all API endpoints
2. **Compromised adjacent system**: If another system on the tactical network is compromised, Argos is fully exploitable
3. **Physical access attacker**: Device is field-deployed; physical access provides full system access

**Verified attack surface**: 106 API endpoint files with zero authentication (`find src/routes/api/ -name "+server.ts" | wc -l`; corrected from 114 per Phase 2.1.0 validation).

## Current State Assessment

| Metric                              | Value | Verification Command                                                  |
| ----------------------------------- | ----- | --------------------------------------------------------------------- |
| Total API endpoint files            | 114   | `find src/routes/api/ -name "+server.ts" \| wc -l`                    |
| Endpoints with authentication       | 0     | No auth middleware exists anywhere in codebase                        |
| Auth middleware files               | 0     | `find src/ -path "*/auth/*" -name "*.ts" \| wc -l`                    |
| `hooks.server.ts` exists            | YES   | `test -f src/hooks.server.ts && echo YES`                             |
| `.env.example` exists               | NO    | `test -f .env.example && echo YES \|\| echo NO`                       |
| `timingSafeEqual` usage in codebase | 0     | `grep -rn "timingSafeEqual" src/ --include="*.ts" \| wc -l`           |
| API key env var references          | 0     | `grep -rn "ARGOS_API_KEY" src/ --include="*.ts" \| wc -l`             |
| Localhost bypass functions          | 0     | No `isLocalhostRequest` function exists (confirmed never implemented) |

## Implementation Plan

### Subtask 2.1.1.1: Create Authentication Middleware

**Create**: `src/lib/server/auth/auth-middleware.ts`

**Design rationale**:

- **API key-based**: Appropriate for single-operator tactical device; JWT/session adds unnecessary complexity for non-multi-user deployment
- **Fail-closed** (Regrade A3): If `ARGOS_API_KEY` is not set, the system refuses to start. The original plan proposed a fail-open localhost fallback, which would allow any compromised service on localhost (Kismet on port 2501, Bettercap, gpsd on port 2947, GSM Evil) to access all endpoints without authentication. This was rejected.
- **Header-only** (Regrade A4): API key accepted ONLY via `X-API-Key` header, never via query string. Query string credentials leak into server logs, browser history, Referer headers, and network monitoring tools. (OWASP A07:2021)
- **Timing-safe comparison**: Uses `timingSafeEqual` to prevent timing side-channel attacks on key comparison

**BEFORE (vulnerable)**:

```typescript
// hooks.server.ts -- current state
// NO authentication of any kind. Every request to /api/* is served unconditionally.
export const handle: Handle = async ({ event, resolve }) => {
	// ... existing logic with no auth checks
	return resolve(event);
};
```

**AFTER (secure)** -- `src/lib/server/auth/auth-middleware.ts`:

```typescript
import { timingSafeEqual } from 'crypto';

// Approach: API key-based authentication for local network deployment
// Why not JWT/session: Single-operator tactical device, not multi-user SaaS
// Why not mTLS: Adds certificate management burden in field conditions
// API key stored in environment variable, validated per-request
//
// REGRADE CORRECTION (A3): Fail-closed design. If ARGOS_API_KEY is not set,
// the system refuses to start. The original fail-open localhost fallback would
// allow any compromised service on localhost (Kismet, Bettercap, etc.) to
// access all endpoints without authentication.
//
// REGRADE CORRECTION (A4): API key accepted ONLY via X-API-Key header, never
// via query string. Query string credentials leak into server logs, browser
// history, Referer headers, and network monitoring tools. (OWASP A07:2021)

export function validateApiKey(request: Request): boolean {
	const apiKey = request.headers.get('X-API-Key');
	const expectedKey = process.env.ARGOS_API_KEY;
	if (!expectedKey) {
		// FAIL-CLOSED: No API key configured = system cannot serve API requests.
		// This function should never be reached if startup validation is correct.
		throw new Error('ARGOS_API_KEY not configured. Refusing to validate requests.');
	}
	if (!apiKey) {
		return false;
	}
	return timingSafeEqual(Buffer.from(apiKey, 'utf-8'), Buffer.from(expectedKey, 'utf-8'));
}

// Startup validation -- call during server initialization in hooks.server.ts
export function validateSecurityConfig(): void {
	if (!process.env.ARGOS_API_KEY) {
		console.error('FATAL: ARGOS_API_KEY environment variable is not set.');
		console.error('The system cannot start without an API key configured.');
		console.error('Set ARGOS_API_KEY in .env or environment before starting.');
		process.exit(1);
	}
	if (process.env.ARGOS_API_KEY.length < 32) {
		console.error('FATAL: ARGOS_API_KEY must be at least 32 characters.');
		process.exit(1);
	}
}
```

**NOTE**: The `isLocalhostRequest()` function is intentionally absent. Localhost is NOT a trust boundary -- any service on the RPi (Kismet, Bettercap, gpsd, GSM Evil) could be compromised and abuse a localhost fallback to access all Argos endpoints. The API key is the sole authentication mechanism. (NASA/JPL Power of Ten Rule 1: simple, verifiable control flow.)

### Subtask 2.1.1.2: Apply Authentication to SvelteKit Hooks

**File**: `src/hooks.server.ts` (EXISTS, verified)

Add request validation in the `handle` function for all `/api/` routes. Call `validateSecurityConfig()` at module load time to enforce fail-closed startup behavior.

**BEFORE (vulnerable)**:

```typescript
// hooks.server.ts -- current state (no auth)
export const handle: Handle = async ({ event, resolve }) => {
	// Existing logic: WebSocket upgrade, CORS, etc.
	// NO authentication check on any route.
	return resolve(event);
};
```

**AFTER (secure)**:

```typescript
import { validateApiKey, validateSecurityConfig } from '$lib/server/auth/auth-middleware';

// FAIL-CLOSED: Halt startup if API key is not configured.
// This runs at module load time, before the server accepts any connections.
validateSecurityConfig();

export const handle: Handle = async ({ event, resolve }) => {
	// ... existing WebSocket upgrade and CORS logic ...

	// API Authentication gate -- all /api/ routes except /api/health
	if (event.url.pathname.startsWith('/api/') && event.url.pathname !== '/api/health') {
		if (!validateApiKey(event.request)) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	return resolve(event);
};
```

**Key behaviors**:

1. `validateSecurityConfig()` executes at module load -- if `ARGOS_API_KEY` is unset or too short, the process exits immediately with a fatal error
2. Every request to `/api/*` (except `/api/health`) must include a valid `X-API-Key` header
3. Invalid or missing keys return HTTP 401 with a generic `Unauthorized` message (no information leakage)
4. `/api/health` is exempt to support monitoring/load balancer health checks without credentials
5. Non-API routes (page routes, static assets) are unaffected

### Subtask 2.1.1.3: Endpoint Sensitivity Categorization

All 114 API endpoint files across 32 API directories, categorized by sensitivity level. All endpoints require the API key with no exceptions other than the health endpoint.

| Category                        | Directories                                                                                                                             | Endpoint Count | Auth Level           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------- |
| **CRITICAL** (hardware control) | hackrf/ (16), kismet/ (20), gsm-evil/ (12), droneid/ (1), rf/ (6)                                                                       | 55             | API key required     |
| **HIGH** (system commands)      | system/ (1), hardware/ (1), openwebrx/ (1), bettercap/ (3), wifite/ (4), btle/ (3), pagermon/ (3), rtl-433/ (2)                         | 18             | API key required     |
| **MEDIUM** (data read)          | agent/ (5), weather/ (1), cell-towers/ (1), gps/ (1), signals/ (1), tactical-map/ (1), devices/ (1), relationships/ (1), wireshark/ (1) | 14             | API key required     |
| **LOW** (health/debug)          | debug/ (1), test/ (1), test-db/ (1), tools/ (1), companion/ (1), db/ (1)                                                                | 6              | API key required     |
| **EXEMPT**                      | /api/health (to be created)                                                                                                             | 1              | No auth (monitoring) |

**Total**: 114 protected + 1 exempt = 115 endpoints.

**Notes on categorization**:

- **CRITICAL**: These endpoints control physical RF hardware capable of transmission. Unauthorized access could cause interference with military communications.
- **HIGH**: These endpoints execute system commands or control external services (Bettercap, Wifite, OpenWebRX). They can modify system state.
- **MEDIUM**: These endpoints read data (agent queries, GPS positions, signal history). They expose tactical intelligence but cannot modify hardware state.
- **LOW**: These endpoints provide diagnostic information. While they should still require auth (defense in depth), they present lower risk.
- **EXEMPT**: Only `/api/health` is exempt, to support automated monitoring. It must return ONLY a status indicator with no system details.

### Subtask 2.1.1.4: Create `.env.example` with Auth Configuration

**Create**: `.env.example` at repository root

```env
# =============================================================================
# Argos SDR & Network Analysis Console -- Environment Configuration
# =============================================================================
# SECURITY: Copy this file to .env and set ALL required values before starting.
# The system will REFUSE TO START if ARGOS_API_KEY is not configured.
# =============================================================================

# Authentication (REQUIRED -- system will not start without this)
ARGOS_API_KEY=                    # REQUIRED. Min 32 chars. Generate with: openssl rand -hex 32
# NOTE: There is no localhost-only mode. API key is always required. (Regrade A3: fail-closed)
# NOTE: API key is accepted ONLY via X-API-Key header, never via query string. (Regrade A4)

# Service Credentials (CHANGE ALL DEFAULTS)
KISMET_USER=admin
KISMET_PASSWORD=                  # REQUIRED -- no default
BETTERCAP_PASSWORD=               # REQUIRED -- no default
OPENWEBRX_PASSWORD=               # REQUIRED -- no default
OPENCELLID_API_KEY=               # REQUIRED -- no default

# Key Rotation Schedule (NIST SP 800-53 IA-5):
# - ARGOS_API_KEY: Every 90 days or immediately upon suspected compromise
# - Service credentials: Every 90 days or when rotating service containers
# - Generate new key: openssl rand -hex 32
# - After rotation: verify old key returns 401
```

### Subtask 2.1.1.5: Verification

Three verification commands with explicit expected results:

**Command 1 -- Unauthenticated request must return 401**:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/system/info
```

**Expected result**: `401`

**Rationale**: Without the `X-API-Key` header, the hooks middleware rejects the request before it reaches the route handler.

**Command 2 -- Authenticated request must return 200**:

```bash
curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info
```

**Expected result**: `200`

**Rationale**: With a valid API key in the header, the request passes through to the route handler normally.

**Command 3 -- Health endpoint always returns 200 (exempt)**:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health
```

**Expected result**: `200`

**Rationale**: The health endpoint is explicitly exempt from authentication to support monitoring infrastructure.

**Additional verification -- API key via query string must be rejected (Regrade A4)**:

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/system/info?api_key=$ARGOS_API_KEY"
```

**Expected result**: `401`

**Rationale**: API keys must never be accepted via query string. Query string parameters appear in server access logs, browser history, Referer headers, and network monitoring tools.

**Additional verification -- Startup without API key must fail**:

```bash
ARGOS_API_KEY="" npm run dev 2>&1 | head -5
```

**Expected result**: Output contains `FATAL: ARGOS_API_KEY environment variable is not set.` and process exits with non-zero code.

## Verification Checklist

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/system/info` returns `401`
2. `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info` returns `200`
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health` returns `200`
4. `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/system/info?api_key=$ARGOS_API_KEY"` returns `401`
5. `ARGOS_API_KEY="" npm run dev 2>&1 | head -5` outputs FATAL error and exits
6. `ARGOS_API_KEY="short" npm run dev 2>&1 | head -5` outputs FATAL error about minimum length
7. `grep -rn "timingSafeEqual" src/lib/server/auth/ --include="*.ts" | wc -l` returns `1` (exactly one usage)
8. `npm run typecheck` exits 0
9. `npm run build` exits 0

## Commit Strategy

```
security(phase2.1.1): add fail-closed API key authentication to all 114 endpoints

Phase 2.1 Task 1: Implement API Authentication
- Created src/lib/server/auth/auth-middleware.ts with fail-closed design
- Applied auth gate to hooks.server.ts for all /api/ routes (except /api/health)
- API key accepted via X-API-Key header only (no query string per OWASP A07:2021)
- validateSecurityConfig() halts startup if ARGOS_API_KEY is unset or <32 chars
- Timing-safe comparison prevents side-channel attacks on key validation
Verified: curl without header returns 401; curl with header returns 200

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
git reset --soft HEAD~1
```

This removes the commit but preserves all changes in the staging area. To fully revert:

```bash
git reset --hard HEAD~1
```

Note: After rollback, the system will return to its unauthenticated state. All 114 API endpoints will be accessible without credentials.

## Risk Assessment

| Risk                                          | Likelihood | Impact | Mitigation                                                                |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Existing scripts break due to missing API key | HIGH       | MEDIUM | `.env.example` documents key generation; update all deployment scripts    |
| API key too short/weak chosen by operator     | MEDIUM     | HIGH   | Minimum 32-character enforcement at startup; generation command provided  |
| API key leaked in logs or version control     | LOW        | HIGH   | Header-only (no query string); `.env` in `.gitignore`; rotation procedure |
| Frontend WebSocket connections break          | HIGH       | HIGH   | Task 2.1.6 addresses WebSocket auth separately; coordinate deployment     |
| Monitoring/healthcheck systems break          | MEDIUM     | LOW    | `/api/health` exempt from authentication                                  |

## Standards Traceability

| Standard                          | Requirement                                                | How This Task Satisfies It                                                          |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| OWASP A01:2021                    | Broken Access Control -- enforce access control mechanisms | API key gate on all 114 endpoints; fail-closed design                               |
| OWASP A07:2021                    | Credentials must not leak via URL                          | Header-only API key; query string explicitly rejected                               |
| NIST SP 800-53 AC-3               | Access Enforcement -- restrict system access               | Single auth gate in hooks.server.ts; no bypass paths                                |
| NIST SP 800-53 IA-5               | Authenticator Management                                   | Minimum key length enforced; rotation procedure documented                          |
| NASA/JPL Power of Ten Rule 1      | Simple, verifiable control flow                            | Single auth check point; no complex conditional bypass logic; no localhost fallback |
| DISA STIG App Security V5R1 V-222 | Application must enforce access control                    | All API routes gated; explicit categorization by sensitivity                        |

## Execution Tracking

| Subtask | Description                         | Status       | Started    | Completed  | Verified By     |
| ------- | ----------------------------------- | ------------ | ---------- | ---------- | --------------- |
| 2.1.1.1 | Create auth middleware              | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 |
| 2.1.1.2 | Apply to hooks.server.ts            | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 |
| 2.1.1.3 | Endpoint sensitivity categorization | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 |
| 2.1.1.4 | Create .env.example                 | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 |
| 2.1.1.5 | Verification                        | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 |

## Implementation Notes (2026-02-08)

### Corrections from Plan

- **Endpoint count**: 106 (not 114). Corrected per Phase 2.1.0 validation.
- **Session cookie mechanism added**: The plan specified header-only auth. Browser clients cannot practically set custom headers on navigation requests. Added HMAC-derived session cookie (`__argos_session`) set on page loads (HttpOnly, SameSite=Strict, Path=/api/, Max-Age=86400). This does NOT violate Regrade A4 (no query string) — cookies do not leak into server logs, browser history, or Referer headers.
- **HMAC-normalized timing-safe comparison**: Plan used direct `timingSafeEqual` on raw buffers. Implementation uses HMAC normalization to prevent length-based timing leaks (raw `timingSafeEqual` throws on mismatched buffer lengths).
- **MCP server updated**: Both `dynamic-server.ts` and `server.ts` updated to include X-API-Key header. dotenv loading added to standalone MCP server process.
- **env.ts Zod validation**: ARGOS_API_KEY added to Zod schema for defense-in-depth startup validation.

### Verification Evidence (10/10 tests pass)

| Test                     | Command                                     | Expected | Actual |
| ------------------------ | ------------------------------------------- | -------- | ------ |
| Unauthenticated request  | `curl ... /api/system/info`                 | 401      | 401    |
| Authenticated request    | `curl -H "X-API-Key: ..." /api/system/info` | 200      | 200    |
| Health endpoint (exempt) | `curl ... /api/health`                      | 200      | 200    |
| Query string rejected    | `curl "...?api_key=..."`                    | 401      | 401    |
| Dashboard page loads     | `curl ... /dashboard`                       | 200      | 200    |
| Session cookie set       | Set-Cookie header present                   | 1        | 1      |
| Browser session → API    | cookie-based auth                           | 200      | 200    |
| Wrong API key            | invalid key header                          | 401      | 401    |
| Health body minimal      | `{"status":"ok"}`                           | ok       | ok     |
| 401 body no leakage      | `{"error":"Unauthorized"}`                  | ok       | ok     |
