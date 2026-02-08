# Phase 7.5: SvelteKit API Routes, WebSocket Events, and Frontend Integration

**Risk Level**: MEDIUM -- User-facing changes, feature flag for rollback
**Prerequisites**: Phase 7.4 (service layer must exist and pass tests)
**Estimated Files Created**: 12 (API routes) + 1 (store) + 1 (SSE endpoint)
**Estimated Files Modified**: 11
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

## Prerequisites (Independent Audit Addition)

Before Phase 7.5 can begin, the following MUST be true:

1. **`npm run build` succeeds** -- Currently fails with `ERR_MODULE_NOT_FOUND` for MCP SDK.
   New API routes cannot be verified without a working build.
2. **`npm run typecheck` reports 0 errors** -- Currently 111 errors. Adding new TypeScript
   files to a broken type system produces unmeasurable results.
3. **Phase 7.4 service layer passes all unit tests** -- API routes depend on the service layer.

These are hard blockers. If any prerequisite fails, do not proceed.

---

## Purpose

Create the SvelteKit API routes that replace the Flask backend's REST API, update the frontend
stores and components to use the new routes, and implement the feature flag for rollback safety.

---

## Task 7.5.1: Create SvelteKit API Routes

**Target**: `src/routes/api/hackrf/transmit/`

### Route Mapping (Flask to SvelteKit)

10 endpoints replacing Flask routes from `app.py` (lines 111-310):

| #   | SvelteKit Route        | Method     | Flask Route (app.py)   | Flask Line | Purpose                  |
| --- | ---------------------- | ---------- | ---------------------- | ---------- | ------------------------ |
| 1   | `status/+server.ts`    | GET        | `/api/status`          | 111        | Current transmit status  |
| 2   | `workflows/+server.ts` | GET        | `/api/workflows`       | 125        | List available workflows |
| 3   | `start/+server.ts`     | POST       | `/api/start_workflow`  | 135        | Start transmission       |
| 4   | `stop/+server.ts`      | POST       | `/api/stop_workflow`   | 220        | Stop transmission        |
| 5   | `bands/+server.ts`     | GET        | `/api/frequency_bands` | 252        | Frequency band info      |
| 6   | `safety/+server.ts`    | GET        | `/api/safety_limits`   | 262        | Safety limits            |
| 7   | `device/+server.ts`    | GET        | `/api/device_info`     | 272        | HackRF device info       |
| 8   | `cache/+server.ts`     | GET/DELETE | `/api/cache_status`    | 282        | Signal cache management  |
| 9   | `library/+server.ts`   | GET        | `/api/library`         | 294        | Signal library listing   |
| 10  | `health/+server.ts`    | GET        | `/api/health`          | 306        | Health check             |
| 11  | `events/+server.ts`    | GET (SSE)  | Flask-SocketIO events  | 332-338    | Real-time status stream  |

### Route 11: SSE Events Endpoint (NEW -- replaces Flask-SocketIO)

The Python backend uses Flask-SocketIO to push real-time status updates:

```python
# app.py lines 332-338
@socketio.on('connect')
def handle_connect():
    socketio.emit('status', get_status())

# During workflow execution:
socketio.emit('workflow_status', {'status': 'transmitting', ...})
socketio.emit('workflow_complete', {'workflow': name})
socketio.emit('error', {'message': str(e)})
```

The TypeScript replacement uses Server-Sent Events (SSE), consistent with the existing
`src/routes/api/hackrf/data-stream/+server.ts` pattern:

```typescript
// src/routes/api/hackrf/transmit/events/+server.ts
import { getTransmitManager } from '$lib/server/hackrf/transmit';

export function GET(): Response {
	const manager = getTransmitManager();
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown) {
				controller.enqueue(
					encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
				);
			}

			// Send current status immediately
			send('status', manager.getStatus());

			// Listen for status changes
			const onStatus = (status: TransmitStatus) => send('status', status);
			const onComplete = (result: unknown) => send('complete', result);
			const onError = (error: unknown) => send('error', error);

			manager.on('status', onStatus);
			manager.on('complete', onComplete);
			manager.on('error', onError);

			// Cleanup on disconnect
			return () => {
				manager.off('status', onStatus);
				manager.off('complete', onComplete);
				manager.off('error', onError);
			};
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}
```

### Standards for ALL API Routes

Every route file must implement:

1. **Zod validation on all POST bodies**:

    ```typescript
    import { z } from 'zod';
    const StartWorkflowSchema = z.object({
    	workflow: z.string().min(1),
    	frequency: z.number().positive(),
    	sampleRate: z.number().positive(),
    	gain: z.number().min(0).max(47),
    	duration: z.number().positive(),
    	repeat: z.boolean().optional().default(false)
    });
    ```

2. **Structured logger** (no `console.log` or `console.error`):

    ```typescript
    import { logger } from '$lib/server/logger';
    logger.info('Transmit started', { workflow, frequency });
    ```

3. **No wildcard CORS** (`Access-Control-Allow-Origin: *` must NOT appear)

4. **Consistent error response format**:

    ```typescript
    function errorResponse(message: string, code: string, status: number) {
    	return new Response(
    		JSON.stringify({
    			success: false,
    			error: message,
    			code,
    			timestamp: new Date().toISOString()
    		}),
    		{ status, headers: { 'Content-Type': 'application/json' } }
    	);
    }
    ```

5. **Consistent success response format**:

    ```typescript
    function successResponse(data: unknown) {
    	return new Response(
    		JSON.stringify({
    			success: true,
    			data,
    			timestamp: new Date().toISOString()
    		}),
    		{ headers: { 'Content-Type': 'application/json' } }
    	);
    }
    ```

6. **API key authentication on all mutation endpoints** (Independent Audit Addition):

    All POST and DELETE endpoints under `/api/hackrf/transmit/` MUST verify an API key before
    processing the request. This is a hard requirement for military deployment -- RF transmission
    control endpoints cannot ship without authentication.

    **Minimum viable authentication** (until Phase 2 implements full auth):

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

    Apply to: Routes 3 (start), 4 (stop), 8 (cache DELETE), and any future mutation endpoints.
    GET endpoints (status, workflows, health, bands, safety, device, library, events) remain
    unauthenticated for monitoring purposes.

    **Environment variable**: Add `HACKRF_API_KEY` to `.env.example` and Docker compose.

    This follows CERT MSC00 (use strong authentication) and addresses the independent audit finding
    that 0/114 API endpoints currently have any authentication.

7. **Rate limiting on transmission control endpoints** (Independent Audit Addition):

    The `POST /api/hackrf/transmit/start` endpoint triggers CPU-intensive signal generation,
    disk I/O, and hardware subprocess spawning. Without rate limiting, an attacker can flood
    this endpoint to cause denial of service.

    **Implementation**: Simple in-memory rate limiter (no external dependency):

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

    Apply to: Routes 3 (start) and 4 (stop). Return HTTP 429 with `Retry-After` header when
    rate limited. This follows CERT DOS00 (guard against resource exhaustion).

---

## Task 7.5.2: Implement Feature Flag

**Purpose**: Allow instant rollback to Python backend if TypeScript implementation has issues.

### Feature Flag: `USE_PYTHON_HACKRF`

```typescript
// src/lib/server/hackrf/transmit/config.ts
const USE_PYTHON_BACKEND = process.env.USE_PYTHON_HACKRF === 'true';

export function getHackRFEndpoint(path: string): string {
	if (USE_PYTHON_BACKEND) {
		return `http://localhost:8092/api${path}`;
	}
	return `/api/hackrf/transmit${path}`;
}

export function isPythonBackendEnabled(): boolean {
	return USE_PYTHON_BACKEND;
}
```

When `USE_PYTHON_HACKRF=true`:

- The `[...path]/+server.ts` proxy remains active and forwards to the Python backend
- New transmit routes are bypassed
- Frontend API client uses proxy endpoints

When `USE_PYTHON_HACKRF` is unset or false (default):

- New transmit routes handle all requests
- The `[...path]/+server.ts` proxy is not needed (but kept until Phase 7.7 deletion)

---

## Task 7.5.3: Update Frontend API Client

### Subtask 7.5.3.1: Update `src/lib/services/api/hackrf.ts` (278 lines)

**Current state**: This file references external ports for the Python backend.
**Changes**:

- Replace base URL from external port references to `/api/hackrf/transmit`
- Add feature flag check
- Update response type interfaces to match new API format

### Subtask 7.5.3.2: Update `src/lib/services/hackrf/hackrfService.ts` (481 lines)

**Changes**:

- Update service methods to use new transmit-manager types
- Replace SocketIO connection with SSE EventSource for real-time status

### Subtask 7.5.3.3: Update `src/lib/services/hackrf/api.ts` (462 lines)

**Changes**:

- Update all endpoint URLs to `/api/hackrf/transmit/*`
- Update response parsing for new consistent format (`{ success, data, timestamp }`)

### Subtask 7.5.3.4: Update `src/lib/services/hackrf/index.ts` (15 lines)

**Changes**:

- Update barrel exports to include new transmit types

### Subtask 7.5.3.5: Update `src/lib/services/api/config.ts` (160 lines)

**Changes**:

- Remove `HACKRF_EMITTER_URL` or `PYTHON_BACKEND_URL` configuration
- Add `HACKRF_TRANSMIT_BASE` pointing to `/api/hackrf/transmit`

---

## Task 7.5.4: Create Transmit State Store

**File**: `src/lib/stores/hackrf-transmit.ts` (NEW)

```typescript
import { writable, derived } from 'svelte/store';

export interface TransmitState {
	active: boolean;
	workflow: string | null;
	frequencyMhz: number;
	gainDb: number;
	sampleRateMsps: number;
	durationS: number;
	elapsedS: number;
	status: 'idle' | 'generating' | 'writing_file' | 'transmitting' | 'stopping' | 'error';
	error: string | null;
	deviceConnected: boolean;
}

const initialState: TransmitState = {
	active: false,
	workflow: null,
	frequencyMhz: 0,
	gainDb: 0,
	sampleRateMsps: 0,
	durationS: 0,
	elapsedS: 0,
	status: 'idle',
	error: null,
	deviceConnected: false
};

export const transmitState = writable<TransmitState>(initialState);

// Derived stores for common queries
export const isTransmitting = derived(transmitState, ($s) => $s.status === 'transmitting');
export const transmitError = derived(transmitState, ($s) => $s.error);
```

### SSE Connection for Real-Time Updates

```typescript
let eventSource: EventSource | null = null;

export function connectTransmitSSE(): void {
	if (eventSource) return;

	eventSource = new EventSource('/api/hackrf/transmit/events');

	eventSource.addEventListener('status', (event) => {
		const data = JSON.parse(event.data);
		transmitState.set(data);
	});

	eventSource.addEventListener('error', () => {
		// Reconnect after 3 seconds
		eventSource?.close();
		eventSource = null;
		setTimeout(connectTransmitSSE, 3000);
	});
}

export function disconnectTransmitSSE(): void {
	eventSource?.close();
	eventSource = null;
}
```

**Estimated total**: ~80 lines

---

## Task 7.5.5: Update UI Components

### Files requiring verification or update:

| #   | Component                                           | Lines  | Change                                                       | Risk   |
| --- | --------------------------------------------------- | ------ | ------------------------------------------------------------ | ------ |
| 1   | `src/lib/components/hackrf/AnalysisTools.svelte`    | 170    | Remove `window.open('http://localhost:8092')` link (line 14) | Low    |
| 2   | `src/lib/components/hackrf/ConnectionStatus.svelte` | 144    | Point to new health endpoint                                 | Low    |
| 3   | `src/lib/components/hackrf/StatusDisplay.svelte`    | 182    | Update status field names to match new API                   | Low    |
| 4   | `src/lib/components/hackrf/SweepControl.svelte`     | 209    | **No change** -- sweep (receive) is unaffected               | None   |
| 5   | `src/lib/components/hackrf/TimeFilterDemo.svelte`   | 287    | **No change** -- demo component                              | None   |
| 6   | `src/routes/hackrf/+page.svelte`                    | Verify | Update page-level data fetching if needed                    | Medium |
| 7   | `src/routes/hackrfsweep/+page.svelte`               | Verify | **No change** -- sweep page is unaffected                    | None   |
| 8   | `src/routes/rfsweep/+page.svelte`                   | Verify | **No change** -- RF sweep page is unaffected                 | None   |

### Verify Unaffected Subsystems

The following MUST be verified as unaffected by the migration:

| Subsystem                       | Reason                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| HackRF sweep (receive mode)     | Uses `hackrf_sweep` binary, not `hackrf_transfer`. Separate service layer.                    |
| Tactical map HackRF integration | `src/lib/stores/tactical-map/hackrfStore.ts` (121 lines) reads sweep data, not transmit data. |
| USRP API                        | `src/lib/services/hackrf/usrp-api.ts` (460 lines) is a separate hardware path.                |
| WebSocket HackRF service        | `src/lib/services/websocket/hackrf.ts` (408 lines) handles sweep data streaming.              |

---

## Task 7.5.6: Update Network Detector

**File**: `src/lib/server/hardware/detection/network-detector.ts` (line 125)

Current:

```typescript
const hackrfUrl = process.env.PUBLIC_HACKRF_API_URL || 'http://localhost:8092';
```

After migration, the Python backend on 8092 will not exist. Update to check the new TypeScript
health endpoint:

```typescript
const hackrfUrl =
	process.env.PUBLIC_HACKRF_API_URL || 'http://localhost:5173/api/hackrf/transmit/health';
```

Or better: check for the `hackrf_transfer` binary directly instead of an HTTP health check:

```typescript
function checkHackrfAvailable(): boolean {
	try {
		execSync('which hackrf_transfer', { encoding: 'utf-8' });
		return true;
	} catch {
		return false;
	}
}
```

---

## Task 7.5.7: Docker Environment Variable Cleanup

**File**: `docker/docker-compose.portainer-dev.yml`

Remove or update the following environment variables that reference the Python backend:

| Variable                       | Current Value           | Action                            |
| ------------------------------ | ----------------------- | --------------------------------- |
| `PUBLIC_HACKRF_API_URL`        | `http://localhost:8092` | Remove (no longer needed)         |
| `PUBLIC_SPECTRUM_ANALYZER_URL` | `http://localhost:8092` | Remove or update to SvelteKit URL |
| `PUBLIC_HACKRF_WS_URL`         | `ws://localhost:8092`   | Remove (SocketIO replaced by SSE) |

**NOTE**: Do NOT remove these in this phase. Only update them. Deletion of the hackrf-backend
Docker service happens in Phase 7.7.

---

## Verification Checklist

- [ ] All 11 API route files created and respond to requests
- [ ] POST routes validate input with Zod schemas
- [ ] No `Access-Control-Allow-Origin: *` in any new route
- [ ] All routes use structured logger (no console.log/console.error)
- [ ] All routes return consistent `{ success, data, timestamp }` format
- [ ] SSE events endpoint streams status updates
- [ ] Feature flag `USE_PYTHON_HACKRF=true` reverts to Python proxy behavior
- [ ] Feature flag unset defaults to new TypeScript routes
- [ ] Frontend API client updated to use `/api/hackrf/transmit/*` endpoints
- [ ] hackrfService.ts uses SSE instead of SocketIO for real-time status
- [ ] Transmit state store created with proper Svelte 5 reactivity
- [ ] AnalysisTools.svelte: localhost:8092 reference removed
- [ ] ConnectionStatus.svelte: health endpoint updated
- [ ] Sweep (receive) functionality verified unaffected
- [ ] Tactical map HackRF integration verified unaffected
- [ ] USRP API verified unaffected
- [ ] Network detector updated to not depend on Python backend
- [ ] No references to localhost:8092 remain in src/ (except feature flag path)
- [ ] No references to localhost:3002 remain in src/ (except feature flag path)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

---

## Definition of Done

This phase is complete when:

1. All 11 API endpoints respond correctly (verified with curl)
2. Frontend HackRF transmit UI functions without the Python backend running
3. Feature flag correctly toggles between TypeScript and Python backends
4. No console errors in browser when navigating to /hackrf
5. Sweep (receive) pages verified unaffected
