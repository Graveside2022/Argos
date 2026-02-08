# Phase 2.1.6: WebSocket Authentication and Security

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 AC-3 (Access Enforcement), OWASP A01:2021 (Broken Access Control), CWE-306 (Missing Authentication for Critical Function), CWE-1385 (Missing Origin Validation in WebSockets), RFC 6455 Section 10.1 (WebSocket Security Considerations)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task adds authentication, origin validation, and payload size limits to all WebSocket endpoints in the Argos codebase. This was a COMPLETE GAP identified by the independent regrade audit (findings A5, A6) -- zero WebSocket authentication existed in the original plan or the codebase, meaning all real-time data streams were accessible to any device on the tactical network without credentials.

## Execution Constraints

| Constraint       | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Risk Level       | HIGH -- breaks all existing WebSocket clients; frontend must be updated simultaneously |
| Severity         | CRITICAL                                                                               |
| Prerequisites    | Task 2.1.1 (auth middleware must exist for `validateApiKey` import)                    |
| Files Touched    | 3 files modified: `websocket-server.ts`, `hooks.server.ts`, `webSocketManager.ts`      |
| Blocks           | None directly                                                                          |
| Blocked By       | Task 2.1.1 (authentication middleware provides `validateApiKey`)                       |
| Estimated Effort | 2 hours                                                                                |

## Threat Context

Argos uses WebSocket connections for real-time streaming of RF spectrum data, WiFi device tracking, IMSI captures, GPS positions, and system telemetry. These are the highest-value intelligence streams in the application -- more valuable than individual API calls because they provide continuous, live access to all sensor data.

**Current state**: ZERO WebSocket endpoints have any form of authentication, origin validation, or payload size limits.

**WebSocket endpoints in the codebase**:

| Endpoint                   | File                                                   | Data Streamed                                       | Current Auth |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------- | ------------ |
| Main WebSocket server      | `src/lib/server/websocket-server.ts`                   | RF spectrum, device tracking, GPS, system telemetry | NONE         |
| WebSocket upgrade in hooks | `src/hooks.server.ts` (WS upgrade at `/api/kismet/ws`) | Kismet WiFi scan results, device discoveries        | NONE         |
| Kismet WebSocket manager   | `src/lib/server/kismet/webSocketManager.ts`            | Kismet raw data, device alerts, signal strength     | NONE         |

**Attack scenario**: After Task 2.1.1 implements HTTP API authentication, an attacker on the tactical network who is blocked from REST API endpoints can still:

1. Connect to any WebSocket endpoint without credentials
2. Receive all real-time RF data, WiFi device tracking, and IMSI captures
3. Send unlimited-size messages to exhaust the RPi's 8GB RAM (no `maxPayload`)
4. Connect from any origin (no origin checking) -- a malicious page loaded in any browser on the network can establish a WebSocket connection

This makes the HTTP authentication from Task 2.1.1 largely ineffective, because the most valuable data flows through WebSockets.

**WebSocket authentication note**: Unlike HTTP headers, WebSocket connections cannot easily pass custom headers during the upgrade handshake from browser JavaScript. The standard practice (used by Socket.IO, Phoenix Channels, and others) is to pass an authentication token as a query string parameter during the WebSocket upgrade. This is acceptable for WebSocket because:

- The upgrade request URL is not logged in standard HTTP access logs (it is a protocol switch, not a standard HTTP request)
- There is no `Referer` header leak (WebSocket connections do not generate Referer headers)
- Browser history does not record WebSocket URLs

This is consistent with the header-only policy for HTTP API endpoints (Regrade A4) -- HTTP and WebSocket have different security characteristics.

## Current State Assessment

| Metric                                  | Value | Verification Command                                                      |
| --------------------------------------- | ----- | ------------------------------------------------------------------------- |
| WebSocket server files                  | 2     | `websocket-server.ts` and `webSocketManager.ts`                           |
| WebSocket upgrade handlers              | 1     | `hooks.server.ts` handles `/api/kismet/ws` upgrade                        |
| `verifyClient` callbacks                | 0     | `grep -rn "verifyClient" src/ --include="*.ts" \| wc -l` returns 0        |
| Origin checking on WebSocket            | 0     | `grep -rn "origin" src/lib/server/websocket-server.ts \| wc -l` returns 0 |
| `maxPayload` limits on WebSocket        | 0     | `grep -rn "maxPayload" src/ --include="*.ts" \| wc -l` returns 0          |
| `validateApiKey` usage in WS context    | 0     | Not imported in any WebSocket file                                        |
| Total unprotected WebSocket connections | 3     | Main WS server + hooks upgrade + Kismet WS manager                        |

## Implementation Plan

### Subtask 2.1.6.1: Add Authentication to WebSocket Server

**File**: `src/lib/server/websocket-server.ts`

Add `verifyClient` callback to the main WebSocket server that validates the API key before accepting the connection. Add origin checking to prevent cross-origin WebSocket connections from malicious pages.

BEFORE (vulnerable):

```typescript
// websocket-server.ts -- current state
// No authentication, no origin checking, no payload limits
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({
	// ... existing config (port, path, etc.)
	// NO verifyClient
	// NO maxPayload
});

wss.on('connection', (ws, req) => {
	// Connection accepted unconditionally from any client
	// ...
});
```

AFTER (secure):

```typescript
// websocket-server.ts -- secured with auth, origin check, and payload limit
import { WebSocketServer } from 'ws';
import { validateApiKey } from '$lib/server/auth/auth-middleware';

// Allowed origins for WebSocket connections.
// In tactical deployment, this should be the RPi's own IP/hostname.
const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	`http://${process.env.HOSTNAME || 'localhost'}:5173`
];

const wss = new WebSocketServer({
	// ... existing config (port, path, etc.)
	maxPayload: 1048576, // 1MB -- RF data messages should not exceed this
	verifyClient: (info, callback) => {
		// Extract API key from query string or header
		const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
		const apiKey = url.searchParams.get('token') || (info.req.headers['x-api-key'] as string);

		// NOTE: For WebSocket, token in query string is acceptable because
		// the WS upgrade request is not logged like HTTP requests, and
		// there is no Referer header leak. This is standard practice
		// (Socket.IO, Phoenix Channels, Action Cable).

		// Construct a minimal Request-like object for validateApiKey
		const mockRequest = new Request('http://localhost', {
			headers: { 'X-API-Key': apiKey || '' }
		});

		if (!validateApiKey(mockRequest)) {
			callback(false, 401, 'Unauthorized');
			return;
		}

		// Origin checking -- prevent cross-origin WebSocket hijacking
		const origin = info.origin || info.req.headers.origin;
		if (origin && !ALLOWED_ORIGINS.includes(origin)) {
			callback(false, 403, 'Forbidden origin');
			return;
		}

		callback(true);
	}
});

wss.on('connection', (ws, req) => {
	// Connection is now authenticated -- proceed with data streaming
	// ...
});
```

**Key behaviors**:

1. **Authentication**: API key validated via `token` query parameter or `X-API-Key` header before connection is accepted
2. **Origin checking**: Only connections from allowed origins are accepted; prevents WebSocket hijacking from malicious pages
3. **Payload limit**: Messages larger than 1MB (1,048,576 bytes) are rejected and the connection is closed
4. **Fail-closed**: If `validateApiKey` throws (API key not configured), the connection is rejected with 401
5. **No timing leak**: The same `timingSafeEqual` from the auth middleware is used for key comparison

### Subtask 2.1.6.2: Add Authentication to Kismet WebSocket

**File 1**: `src/hooks.server.ts` (WebSocket upgrade at `/api/kismet/ws`)

The hooks server handles WebSocket upgrade requests for the Kismet data stream. This must validate the API key before completing the upgrade handshake.

BEFORE (vulnerable):

```typescript
// hooks.server.ts -- WebSocket upgrade handling (current state)
// No authentication on WebSocket upgrade
if (event.url.pathname === '/api/kismet/ws') {
	// Upgrade to WebSocket -- no auth check
	// ...
}
```

AFTER (secure):

```typescript
// hooks.server.ts -- WebSocket upgrade with auth
import { validateApiKey } from '$lib/server/auth/auth-middleware';

if (event.url.pathname === '/api/kismet/ws') {
	// Validate API key before WebSocket upgrade
	const apiKey = event.url.searchParams.get('token') || event.request.headers.get('X-API-Key');
	const mockRequest = new Request('http://localhost', {
		headers: { 'X-API-Key': apiKey || '' }
	});
	if (!validateApiKey(mockRequest)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	// Proceed with WebSocket upgrade for authenticated client
	// ...
}
```

**File 2**: `src/lib/server/kismet/webSocketManager.ts`

The WebSocket manager creates its own WebSocket server for Kismet data distribution. It must apply the same authentication and payload limits.

BEFORE (vulnerable):

```typescript
// webSocketManager.ts -- current state
// Accepts all connections without any validation
const wss = new WebSocketServer({
	// ... existing config
	// NO verifyClient
	// NO maxPayload
});
```

AFTER (secure):

```typescript
// webSocketManager.ts -- secured
import { validateApiKey } from '$lib/server/auth/auth-middleware';

const wss = new WebSocketServer({
	// ... existing config
	maxPayload: 262144, // 256KB -- Kismet JSON messages should be small
	verifyClient: (info, callback) => {
		const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
		const apiKey = url.searchParams.get('token') || (info.req.headers['x-api-key'] as string);
		const mockRequest = new Request('http://localhost', {
			headers: { 'X-API-Key': apiKey || '' }
		});
		if (!validateApiKey(mockRequest)) {
			callback(false, 401, 'Unauthorized');
			return;
		}
		callback(true);
	}
});
```

### Subtask 2.1.6.3: Add maxPayload Limits

All WebSocket servers must have `maxPayload` limits to prevent memory exhaustion attacks. On an 8GB RPi running earlyoom with multiple services, a single client sending unlimited-size messages can trigger OOM killing.

| File                  | Current maxPayload | Required maxPayload | Rationale                                                      |
| --------------------- | ------------------ | ------------------- | -------------------------------------------------------------- |
| `websocket-server.ts` | None (unlimited)   | **1MB** (1,048,576) | RF data messages are arrays of signal samples; 1MB is generous |
| `webSocketManager.ts` | None (unlimited)   | **256KB** (262,144) | Kismet messages are JSON objects; well under 256KB             |

**Behavior when limit is exceeded**: The `ws` library automatically closes the connection with a `1009` status code (Message Too Big) when a message exceeds `maxPayload`. No additional handling is needed.

BEFORE (vulnerable):

```typescript
// Both files -- no maxPayload
const wss = new WebSocketServer({
	// ... config WITHOUT maxPayload
	// Default: unlimited -- single client can send GB-sized messages
});
```

AFTER (secure):

```typescript
// websocket-server.ts
const wss = new WebSocketServer({
	// ... existing config
	maxPayload: 1048576 // 1MB -- messages exceeding this cause connection close
});

// webSocketManager.ts
const wss = new WebSocketServer({
	// ... existing config
	maxPayload: 262144 // 256KB -- Kismet JSON messages should be small
});
```

### Frontend Update Requirement

After implementing WebSocket authentication, all frontend WebSocket connections must pass the API key. The frontend code that establishes WebSocket connections must be updated to include the token.

BEFORE:

```typescript
// Frontend WebSocket connection (current)
const ws = new WebSocket('ws://localhost:5173/ws');
```

AFTER:

```typescript
// Frontend WebSocket connection (authenticated)
const ws = new WebSocket(`ws://localhost:5173/ws?token=${apiKey}`);
```

The API key for frontend use should be provided through the SvelteKit page data load (server-side) or environment configuration, never hardcoded in client-side code.

### Subtask 2.1.6.4: Verification

**Command 1 -- WebSocket without auth rejected**:

```bash
wscat -c ws://localhost:5173/ws 2>&1 | head -1
```

**Expected result**: `error: Unexpected server response: 401`

**Rationale**: Without a `token` query parameter or `X-API-Key` header, the `verifyClient` callback returns `false` with status 401 before the WebSocket handshake completes.

**Command 2 -- WebSocket with auth accepted**:

```bash
wscat -c "ws://localhost:5173/ws?token=$ARGOS_API_KEY" 2>&1 | head -1
```

**Expected result**: `Connected` (or equivalent connection success message)

**Rationale**: With a valid API key in the `token` query parameter, the `verifyClient` callback returns `true` and the WebSocket handshake completes successfully.

**Command 3 -- Oversized message rejected**:

```bash
python3 -c "
import websocket
ws = websocket.create_connection('ws://localhost:5173/ws?token=$ARGOS_API_KEY')
ws.send('x' * 2000000)  # 2MB, exceeds 1MB limit
" 2>&1
```

**Expected result**: Connection closed by server (status 1009: Message Too Big)

**Rationale**: The `maxPayload: 1048576` setting causes the `ws` library to automatically close connections that send messages exceeding 1MB.

## Verification Checklist

1. `wscat -c ws://localhost:5173/ws 2>&1 | head -1` shows 401 rejection
2. `wscat -c "ws://localhost:5173/ws?token=$ARGOS_API_KEY" 2>&1 | head -1` shows connection success
3. `grep -c "verifyClient" src/lib/server/websocket-server.ts` returns `1`
4. `grep -c "verifyClient" src/lib/server/kismet/webSocketManager.ts` returns `1`
5. `grep -c "maxPayload" src/lib/server/websocket-server.ts` returns `1`
6. `grep -c "maxPayload" src/lib/server/kismet/webSocketManager.ts` returns `1`
7. `grep -c "validateApiKey" src/lib/server/websocket-server.ts` returns at least `1`
8. Frontend real-time data streams still function with authenticated WebSocket connection
9. `npm run typecheck` exits 0
10. `npm run build` exits 0

## Commit Strategy

```
security(phase2.1.6): add authentication and payload limits to all WebSocket endpoints

Phase 2.1 Task 6: WebSocket Authentication and Security (NEW -- regrade A5, A6)
- Added verifyClient callback to websocket-server.ts (API key + origin checking)
- Added verifyClient callback to webSocketManager.ts (Kismet WebSocket)
- Added auth check to hooks.server.ts WebSocket upgrade at /api/kismet/ws
- Added maxPayload limits: 1MB (main WS), 256KB (Kismet WS)
- WebSocket token via query string (standard practice for WS; no log/Referer leak)
FINDING: This was a COMPLETE GAP -- zero WebSocket auth existed prior to this task
Verified: wscat without auth returns 401; wscat with auth connects successfully

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

Note: After rollback, all WebSocket endpoints return to their completely unauthenticated state. Any device on the tactical network can receive all real-time RF data, WiFi tracking, IMSI captures, and GPS positions without credentials.

**WARNING**: This is the highest-impact rollback in Phase 2.1. The WebSocket streams carry the most operationally sensitive data in the system.

## Risk Assessment

| Risk                                                 | Likelihood | Impact | Mitigation                                                               |
| ---------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| All existing WebSocket clients break                 | CERTAIN    | HIGH   | Frontend must be updated simultaneously; coordinate deployment           |
| Token in query string logged by reverse proxy        | LOW        | MEDIUM | Standard WS practice; no reverse proxy in tactical RPi deployment        |
| Origin check too restrictive for multi-device access | MEDIUM     | LOW    | `ALLOWED_ORIGINS` configurable via environment; add tactical device IPs  |
| maxPayload too small for legitimate RF data bursts   | LOW        | LOW    | 1MB is generous for RF sample arrays; increase if monitoring shows drops |
| Race condition: WS connects during API key rotation  | LOW        | LOW    | Existing connections continue; new connections require new key           |

## Standards Traceability

| Standard              | Requirement                                  | How This Task Satisfies It                                                            |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| NIST SP 800-53 AC-3   | Access Enforcement -- restrict system access | WebSocket connections require valid API key before handshake completes                |
| OWASP A01:2021        | Broken Access Control                        | WebSocket authentication closes the gap left by HTTP-only auth                        |
| CWE-306               | Missing Authentication for Critical Function | All 3 WebSocket endpoints now require authentication                                  |
| CWE-1385              | Missing Origin Validation in WebSockets      | Origin checking prevents cross-origin WebSocket hijacking                             |
| RFC 6455 Section 10.1 | WebSocket Security Considerations            | Origin checking, authentication, and payload limits per specification recommendations |
| NIST SP 800-53 SC-5   | Denial of Service Protection                 | maxPayload limits prevent memory exhaustion via oversized messages                    |

## Execution Tracking

| Subtask | Description                       | Status  | Started | Completed | Verified By |
| ------- | --------------------------------- | ------- | ------- | --------- | ----------- |
| 2.1.6.1 | Add auth to main WebSocket server | PENDING | --      | --        | --          |
| 2.1.6.2 | Add auth to Kismet WebSocket      | PENDING | --      | --        | --          |
| 2.1.6.3 | Add maxPayload limits             | PENDING | --      | --        | --          |
| 2.1.6.4 | Verification                      | PENDING | --      | --        | --          |
