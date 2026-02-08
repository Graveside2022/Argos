# Phase 7.5.04: Frontend API Client Updates

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.3, Subtasks 7.5.3.1-7.5.3.5)
**Risk Level**: MEDIUM -- Frontend behavioral changes, feature flag provides rollback
**Prerequisites**: Phase-7.5.01 routes created; Phase-7.5.03 feature flag implemented
**Estimated Duration**: 4-6 hours
**Estimated Files Modified**: 5
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Update all frontend API client files to call the new SvelteKit API routes (`/api/hackrf/transmit/*`) instead of the Python Flask backend (`localhost:8092`). This includes replacing SocketIO real-time connections with SSE EventSource, updating response type parsing to the new consistent format (`{ success, data, timestamp }`), and integrating the feature flag for rollback safety.

---

## Subtask 7.5.3.1: Update `src/lib/services/api/hackrf.ts` (278 lines)

**Current state**: References external ports for the Python backend (localhost:8092 or environment variable overrides).

**Changes required**:

1. **Replace base URL**: Remove all hardcoded `localhost:8092` references. Import and use `getHackRFEndpoint()` from `$lib/server/hackrf/transmit/config` (Phase-7.5.03).

2. **Add feature flag check**: All API calls must route through `getHackRFEndpoint()` which transparently resolves to either the Python proxy or the new TypeScript routes based on `USE_PYTHON_HACKRF`.

3. **Update response type interfaces**: The Python backend returns raw Flask JSON. The new TypeScript routes return the consistent format:

    ```typescript
    interface ApiResponse<T> {
    	success: boolean;
    	data: T;
    	timestamp: string;
    }

    interface ApiErrorResponse {
    	success: boolean;
    	error: string;
    	code: string;
    	timestamp: string;
    }
    ```

4. **Update response parsing**: All `fetch()` calls must unwrap the `data` field from successful responses:
    ```typescript
    const response = await fetch(getHackRFEndpoint('/status'));
    const json = await response.json();
    if (!json.success) throw new Error(json.error);
    return json.data; // Unwrap from consistent envelope
    ```

**NOTE**: Since this is a client-side file, it CANNOT directly import from `$lib/server/`. The `getHackRFEndpoint` function must be duplicated as a client-side version, or the endpoint base must be injected via SvelteKit's `$env/static/public` or a page data load. The recommended approach:

```typescript
// Client-side endpoint resolution
const TRANSMIT_BASE = '/api/hackrf/transmit';
// Feature flag is server-side only; client always calls SvelteKit routes
// The server-side proxy handles forwarding to Python if USE_PYTHON_HACKRF=true
```

---

## Subtask 7.5.3.2: Update `src/lib/services/hackrf/hackrf-service.ts` (481 lines)

**Actual filename**: `src/lib/services/hackrf/hackrf-service.ts` (hyphenated, not camelCase)

**Changes required**:

1. **Update service methods**: All methods that call the Python backend API must be updated to use the new TypeScript route paths under `/api/hackrf/transmit/`.

2. **Replace SocketIO with SSE EventSource**: The current file uses SocketIO (socket.io-client) for real-time status updates from the Python backend. Replace with SSE EventSource connecting to the new `events/+server.ts` route:

    ```typescript
    // BEFORE (SocketIO):
    import { io } from 'socket.io-client';
    const socket = io('http://localhost:8092');
    socket.on('workflow_status', (data) => { ... });
    socket.on('workflow_complete', (data) => { ... });
    socket.on('error', (data) => { ... });

    // AFTER (SSE):
    const eventSource = new EventSource('/api/hackrf/transmit/events');
    eventSource.addEventListener('status', (event) => {
    	const data = JSON.parse(event.data);
    	// Update transmit state store
    });
    eventSource.addEventListener('complete', (event) => { ... });
    eventSource.addEventListener('error', () => {
    	eventSource.close();
    	// Reconnect with backoff
    });
    ```

3. **Update method return types**: Service methods must handle the new `{ success, data, timestamp }` envelope, unwrapping `data` before returning to callers.

4. **Remove socket.io-client dependency**: After migration, verify that no other file imports from `socket.io-client`. If this was the last consumer, it can be removed from `package.json` in Phase 7.7.

---

## Subtask 7.5.3.3: Update `src/lib/services/hackrf/api.ts` (462 lines)

**Changes required**:

1. **Update all endpoint URLs**: Replace every occurrence of the Python backend URL pattern with the new path pattern:

    | Current Pattern                  | New Pattern                      |
    | -------------------------------- | -------------------------------- |
    | `${baseUrl}/api/status`          | `/api/hackrf/transmit/status`    |
    | `${baseUrl}/api/workflows`       | `/api/hackrf/transmit/workflows` |
    | `${baseUrl}/api/start_workflow`  | `/api/hackrf/transmit/start`     |
    | `${baseUrl}/api/stop_workflow`   | `/api/hackrf/transmit/stop`      |
    | `${baseUrl}/api/frequency_bands` | `/api/hackrf/transmit/bands`     |
    | `${baseUrl}/api/safety_limits`   | `/api/hackrf/transmit/safety`    |
    | `${baseUrl}/api/device_info`     | `/api/hackrf/transmit/device`    |
    | `${baseUrl}/api/cache_status`    | `/api/hackrf/transmit/cache`     |
    | `${baseUrl}/api/library`         | `/api/hackrf/transmit/library`   |
    | `${baseUrl}/api/health`          | `/api/hackrf/transmit/health`    |

2. **Update response parsing**: All fetch calls must handle the new consistent envelope:

    ```typescript
    async function fetchTransmitAPI<T>(path: string, options?: RequestInit): Promise<T> {
    	const response = await fetch(`/api/hackrf/transmit${path}`, options);
    	const json = await response.json();
    	if (!json.success) {
    		throw new Error(json.error || 'Unknown error');
    	}
    	return json.data as T;
    }
    ```

3. **Add Authorization header to mutation requests**: POST and DELETE calls must include the `Authorization: Bearer` header from the user's session or environment config. This aligns with Phase-7.5.02 security requirements.

---

## Subtask 7.5.3.4: Update `src/lib/services/hackrf/index.ts` (58 lines)

**NOTE**: Source document states 15 lines; actual file is **58 lines** (verified 2026-02-08).

**Changes required**:

1. **Update barrel exports**: Add exports for new transmit-related types:

    ```typescript
    export type { TransmitState } from '$lib/stores/hackrf-transmit';
    export { connectTransmitSSE, disconnectTransmitSSE } from '$lib/stores/hackrf-transmit';
    ```

2. **Verify existing exports**: Ensure all current exports still resolve correctly after the api.ts and hackrf-service.ts changes.

3. **Remove any SocketIO-related re-exports**: If the barrel currently exports SocketIO types or connection functions, remove them.

---

## Subtask 7.5.3.5: Update `src/lib/services/api/config.ts` (160 lines)

**Changes required**:

1. **Remove Python backend URL configuration**: Remove or deprecate any of these variables:
    - `HACKRF_EMITTER_URL`
    - `PYTHON_BACKEND_URL`
    - Any reference to `localhost:8092` as a configurable endpoint

2. **Add new transmit base configuration**:

    ```typescript
    export const HACKRF_TRANSMIT_BASE = '/api/hackrf/transmit';
    ```

3. **Do NOT delete the old variables yet**: Mark them as deprecated with a comment referencing Phase 7.7 for deletion. The feature flag (Phase-7.5.03) may still need them when `USE_PYTHON_HACKRF=true`.

---

## Verification Commands

```bash
# Verify no direct localhost:8092 references remain in frontend services
# (except inside feature-flag conditional paths)
grep -rn "localhost:8092" \
  src/lib/services/api/hackrf.ts \
  src/lib/services/hackrf/hackrf-service.ts \
  src/lib/services/hackrf/api.ts \
  src/lib/services/hackrf/index.ts \
  src/lib/services/api/config.ts

# Verify new endpoint paths used
grep -rn "/api/hackrf/transmit" \
  src/lib/services/api/hackrf.ts \
  src/lib/services/hackrf/hackrf-service.ts \
  src/lib/services/hackrf/api.ts

# Verify response envelope parsing (json.data unwrap)
grep -n "json\.data" \
  src/lib/services/api/hackrf.ts \
  src/lib/services/hackrf/api.ts

# Verify no bare socket.io imports remain
grep -rn "socket\.io-client\|import.*io.*from.*socket" \
  src/lib/services/hackrf/

# Verify barrel exports updated
grep -n "transmit\|TransmitState\|connectTransmitSSE" \
  src/lib/services/hackrf/index.ts

# Verify HACKRF_TRANSMIT_BASE in config
grep -n "HACKRF_TRANSMIT_BASE" src/lib/services/api/config.ts

# Typecheck
npm run typecheck

# Build
npm run build
```

---

## Verification Checklist

- [ ] **Subtask 7.5.3.1**: `hackrf.ts` uses `/api/hackrf/transmit` base URL instead of external ports
- [ ] **Subtask 7.5.3.1**: Response types updated to handle `{ success, data, timestamp }` envelope
- [ ] **Subtask 7.5.3.2**: `hackrf-service.ts` (481 lines) uses SSE EventSource instead of SocketIO
- [ ] **Subtask 7.5.3.2**: Socket.io-client import removed from file
- [ ] **Subtask 7.5.3.2**: SSE reconnection logic implemented with backoff
- [ ] **Subtask 7.5.3.3**: `api.ts` (462 lines) all 10 endpoint URLs updated per mapping table
- [ ] **Subtask 7.5.3.3**: Response parsing unwraps `json.data` from envelope
- [ ] **Subtask 7.5.3.3**: Mutation requests include Authorization header
- [ ] **Subtask 7.5.3.4**: `index.ts` (58 lines) barrel exports include transmit types
- [ ] **Subtask 7.5.3.4**: No SocketIO re-exports remain
- [ ] **Subtask 7.5.3.5**: `config.ts` (160 lines) defines `HACKRF_TRANSMIT_BASE`
- [ ] **Subtask 7.5.3.5**: Old Python URL variables marked deprecated (not deleted)
- [ ] Zero references to `localhost:8092` in modified files (outside feature flag conditionals)
- [ ] Zero `socket.io-client` imports in hackrf services
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Definition of Done

1. All 5 frontend API client files updated per subtask specifications
2. `grep -rn "localhost:8092" src/lib/services/` returns zero matches (outside feature flag paths)
3. `grep -rn "socket.io-client" src/lib/services/hackrf/` returns zero matches
4. Frontend API calls resolve to `/api/hackrf/transmit/*` endpoints
5. Response parsing correctly handles the `{ success, data, timestamp }` envelope
6. `npm run typecheck` and `npm run build` both pass

---

## Cross-References

- **Phase-7.5.01**: API routes these clients call
- **Phase-7.5.02**: Authentication headers required on mutation requests
- **Phase-7.5.03**: Feature flag consumed by `getHackRFEndpoint()` / client-side resolution
- **Phase-7.5.05**: Transmit state store that receives SSE data from the events endpoint
- **Phase-7.5.06**: UI components that depend on these service methods
- **Phase 7.7**: Final deletion of Python backend URL references and socket.io-client dependency
