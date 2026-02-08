# Phase 7.5.01: SvelteKit API Routes -- Route Mapping and Implementation

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.1, excluding items 6-7)
**Risk Level**: MEDIUM -- New endpoint creation, user-facing
**Prerequisites**: Phase 7.4 service layer passes all unit tests; `npm run build` succeeds; `npm run typecheck` reports 0 errors
**Estimated Duration**: 6-8 hours
**Estimated Files Created**: 12 (11 route +server.ts files + 1 shared response utilities file)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Create all 11 SvelteKit API route files under `src/routes/api/hackrf/transmit/` that replace the Flask backend's REST API (`hackrf_emitter/app.py` lines 111-338). This task defines the complete route mapping, the SSE events endpoint that replaces Flask-SocketIO, and the mandatory coding standards that every route file must implement.

---

## 1. Route Mapping (Flask to SvelteKit)

11 endpoints replacing Flask routes from `hackrf_emitter/app.py` (lines 111-338):

| #   | SvelteKit Route                                       | Method     | Flask Route (`app.py`) | Flask Line | Purpose                  |
| --- | ----------------------------------------------------- | ---------- | ---------------------- | ---------- | ------------------------ |
| 1   | `src/routes/api/hackrf/transmit/status/+server.ts`    | GET        | `/api/status`          | 111        | Current transmit status  |
| 2   | `src/routes/api/hackrf/transmit/workflows/+server.ts` | GET        | `/api/workflows`       | 125        | List available workflows |
| 3   | `src/routes/api/hackrf/transmit/start/+server.ts`     | POST       | `/api/start_workflow`  | 135        | Start transmission       |
| 4   | `src/routes/api/hackrf/transmit/stop/+server.ts`      | POST       | `/api/stop_workflow`   | 220        | Stop transmission        |
| 5   | `src/routes/api/hackrf/transmit/bands/+server.ts`     | GET        | `/api/frequency_bands` | 252        | Frequency band info      |
| 6   | `src/routes/api/hackrf/transmit/safety/+server.ts`    | GET        | `/api/safety_limits`   | 262        | Safety limits            |
| 7   | `src/routes/api/hackrf/transmit/device/+server.ts`    | GET        | `/api/device_info`     | 272        | HackRF device info       |
| 8   | `src/routes/api/hackrf/transmit/cache/+server.ts`     | GET/DELETE | `/api/cache_status`    | 282        | Signal cache management  |
| 9   | `src/routes/api/hackrf/transmit/library/+server.ts`   | GET        | `/api/library`         | 294        | Signal library listing   |
| 10  | `src/routes/api/hackrf/transmit/health/+server.ts`    | GET        | `/api/health`          | 306        | Health check             |
| 11  | `src/routes/api/hackrf/transmit/events/+server.ts`    | GET (SSE)  | Flask-SocketIO events  | 332-338    | Real-time status stream  |

**Directory structure** after creation:

```
src/routes/api/hackrf/transmit/
  status/+server.ts       (Route 1)
  workflows/+server.ts    (Route 2)
  start/+server.ts        (Route 3)
  stop/+server.ts         (Route 4)
  bands/+server.ts        (Route 5)
  safety/+server.ts       (Route 6)
  device/+server.ts       (Route 7)
  cache/+server.ts        (Route 8)
  library/+server.ts      (Route 9)
  health/+server.ts       (Route 10)
  events/+server.ts       (Route 11)
```

---

## 2. Route 11: SSE Events Endpoint (Replaces Flask-SocketIO)

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

**CRITICAL NOTE** (from memory -- Phase 2 audit finding F1): The `return () => { ... }` inside `start()` is DEAD CODE in the ReadableStream spec. Cleanup must be implemented in the `cancel()` callback instead:

```typescript
// CORRECT cleanup pattern:
const stream = new ReadableStream({
	start(controller) {
		// ... setup listeners ...
	},
	cancel() {
		manager.off('status', onStatus);
		manager.off('complete', onComplete);
		manager.off('error', onError);
	}
});
```

The code example from the source document preserves the original pattern for reference, but implementers MUST use the `cancel()` pattern. See `src/routes/api/rf/data-stream/+server.ts` and `src/routes/api/hackrf/data-stream/+server.ts` for the corrected pattern applied during Phase 2 memory leak fixes.

---

## 3. Standards for ALL API Routes

Every route file under `src/routes/api/hackrf/transmit/` MUST implement all of the following. No exceptions.

### 3.1 Zod Validation on All POST Bodies

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

Every POST endpoint MUST define a Zod schema and parse the request body through it before processing. Validation errors return HTTP 400 with the Zod error details in the consistent error format.

### 3.2 Structured Logger (No console.log or console.error)

```typescript
import { logger } from '$lib/server/logger';
logger.info('Transmit started', { workflow, frequency });
```

Zero `console.log`, `console.error`, or `console.warn` calls in any route file. All logging goes through the structured logger.

### 3.3 No Wildcard CORS

`Access-Control-Allow-Origin: *` MUST NOT appear in any route response header. The existing hooks.server.ts auth gate handles CORS at the middleware level.

### 3.4 Consistent Error Response Format

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

All error responses MUST use this exact structure: `{ success: false, error: string, code: string, timestamp: string }`.

### 3.5 Consistent Success Response Format

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

All success responses MUST use this exact structure: `{ success: true, data: unknown, timestamp: string }`.

**Recommendation**: Extract `errorResponse` and `successResponse` into a shared utility file `src/routes/api/hackrf/transmit/_response.ts` (SvelteKit convention: underscore prefix for non-route files) to avoid duplication across 10 route files.

---

## Verification Commands

```bash
# Verify all 11 route directories exist
for route in status workflows start stop bands safety device cache library health events; do
  ls src/routes/api/hackrf/transmit/$route/+server.ts
done

# Verify no console.log/console.error in new routes
grep -rn 'console\.\(log\|error\|warn\)' src/routes/api/hackrf/transmit/ && echo "FAIL: console statements found" || echo "PASS"

# Verify no wildcard CORS
grep -rn 'Access-Control-Allow-Origin.*\*' src/routes/api/hackrf/transmit/ && echo "FAIL: wildcard CORS found" || echo "PASS"

# Verify Zod imports in POST routes
grep -l 'import.*zod' src/routes/api/hackrf/transmit/start/+server.ts src/routes/api/hackrf/transmit/stop/+server.ts src/routes/api/hackrf/transmit/cache/+server.ts

# Verify logger imports (no console)
for route in status workflows start stop bands safety device cache library health events; do
  grep -l "import.*logger" src/routes/api/hackrf/transmit/$route/+server.ts || echo "MISSING logger in $route"
done

# Verify SSE endpoint returns correct content type
grep -n 'text/event-stream' src/routes/api/hackrf/transmit/events/+server.ts

# Typecheck
npm run typecheck

# Build
npm run build
```

---

## Verification Checklist

- [ ] All 11 route files created at exact paths listed in route mapping table
- [ ] Each route exports the correct HTTP method handler (GET, POST, or both for cache)
- [ ] POST routes (start, stop, cache DELETE) parse body through Zod schemas
- [ ] GET routes (status, workflows, bands, safety, device, cache GET, library, health) return data in success format
- [ ] SSE events endpoint (`events/+server.ts`) streams `status`, `complete`, and `error` events
- [ ] SSE cleanup uses `cancel()` callback, NOT `return () => {}` inside `start()`
- [ ] Zero `console.log`, `console.error`, or `console.warn` in any route file
- [ ] All route files import and use `logger` from `$lib/server/logger`
- [ ] No `Access-Control-Allow-Origin: *` header in any route response
- [ ] All error responses match format: `{ success: false, error, code, timestamp }`
- [ ] All success responses match format: `{ success: true, data, timestamp }`
- [ ] Shared response utility extracted to avoid duplication (recommended)
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds

---

## Definition of Done

1. All 11 route files exist and export correct HTTP method handlers
2. `curl http://localhost:5173/api/hackrf/transmit/health` returns `{ success: true, data: {...}, timestamp: "..." }`
3. `curl http://localhost:5173/api/hackrf/transmit/status` returns current transmit status
4. `curl http://localhost:5173/api/hackrf/transmit/events` streams SSE events with `Content-Type: text/event-stream`
5. Zero console statements in any new route file
6. Zod validation rejects malformed POST bodies with HTTP 400
7. `npm run typecheck` and `npm run build` both pass

---

## Cross-References

- **Phase 7.4**: Service layer consumed by these routes (`src/lib/server/hackrf/transmit/`)
- **Phase-7.5.02**: API security (authentication, rate limiting) applied to mutation routes
- **Phase-7.5.03**: Feature flag controls whether these routes or the Python proxy handles requests
- **Phase-7.5.05**: Transmit state store subscribes to Route 11 SSE events
- **Phase-7.5.06**: UI components updated to call these routes
- **Phase 7.6**: Verification suite tests these routes end-to-end
- **Memory Leak Fix F1**: ReadableStream cancel() pattern (applied 2026-02-07)
