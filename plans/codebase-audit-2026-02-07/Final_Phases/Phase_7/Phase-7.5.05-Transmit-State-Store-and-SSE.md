# Phase 7.5.05: Transmit State Store and SSE Connection

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.4)
**Risk Level**: LOW -- New file, no modification of existing code
**Prerequisites**: Phase-7.5.01 SSE events endpoint (Route 11) created
**Estimated Duration**: 1-2 hours
**Estimated Files Created**: 1 (`src/lib/stores/hackrf-transmit.ts`)
**Estimated Size**: ~80 lines
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Create a Svelte writable store that holds the real-time HackRF transmit state, plus derived stores for common query patterns (isTransmitting, transmitError). Provide SSE connection management functions that connect to the `/api/hackrf/transmit/events` endpoint and automatically update the store as status events arrive.

---

## File: `src/lib/stores/hackrf-transmit.ts`

### TransmitState Interface and Store

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

### Field Descriptions

| Field             | Type             | Description                                                                               |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `active`          | `boolean`        | Whether any workflow is currently running                                                 |
| `workflow`        | `string \| null` | Name of the currently running workflow, or null if idle                                   |
| `frequencyMhz`    | `number`         | Current transmission frequency in MHz                                                     |
| `gainDb`          | `number`         | Current transmission gain in dB (0-47)                                                    |
| `sampleRateMsps`  | `number`         | Current sample rate in Msps                                                               |
| `durationS`       | `number`         | Total planned duration in seconds                                                         |
| `elapsedS`        | `number`         | Elapsed time since transmission started in seconds                                        |
| `status`          | union literal    | Current pipeline stage (idle -> generating -> writing_file -> transmitting -> idle/error) |
| `error`           | `string \| null` | Error message if status is 'error', null otherwise                                        |
| `deviceConnected` | `boolean`        | Whether HackRF hardware is detected and available                                         |

### Derived Stores

| Store            | Type                     | Derivation                     | Usage                                      |
| ---------------- | ------------------------ | ------------------------------ | ------------------------------------------ |
| `isTransmitting` | `Readable<boolean>`      | `$s.status === 'transmitting'` | Disable UI controls during active transmit |
| `transmitError`  | `Readable<string\|null>` | `$s.error`                     | Display error banner in UI components      |

---

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

### SSE Connection Behavior

1. **`connectTransmitSSE()`**:
    - Guard: If an EventSource already exists, return immediately (no double connections)
    - Creates new `EventSource` pointed at `/api/hackrf/transmit/events`
    - Listens for `status` events and sets the transmit store directly with parsed data
    - On `error` event: closes the connection, nulls the reference, and schedules reconnection after 3 seconds
    - Auto-reconnect is bounded by the guard check (prevents concurrent reconnection storms)

2. **`disconnectTransmitSSE()`**:
    - Closes the EventSource if it exists
    - Nulls the reference to prevent stale connection usage
    - Called from component `onDestroy` lifecycle or page navigation teardown

### SSE Event Types

The events endpoint (Phase-7.5.01, Route 11) emits these named events:

| SSE Event Name | Data Shape      | Store Action                    |
| -------------- | --------------- | ------------------------------- |
| `status`       | `TransmitState` | `transmitState.set(data)`       |
| `complete`     | `{ workflow }`  | Store updates via next `status` |
| `error`        | `{ message }`   | Store updates via next `status` |

**NOTE**: The `complete` and `error` events from the SSE endpoint are informational. The store is always updated by the `status` event, which carries the full `TransmitState`. Components should subscribe to the store, not to individual SSE events.

---

## Integration Pattern

### Component Usage (Svelte 5)

```svelte
<script>
	import {
		transmitState,
		isTransmitting,
		transmitError,
		connectTransmitSSE,
		disconnectTransmitSSE
	} from '$lib/stores/hackrf-transmit';
	import { onMount, onDestroy } from 'svelte';

	onMount(() => connectTransmitSSE());
	onDestroy(() => disconnectTransmitSSE());
</script>

{#if $transmitError}
	<div class="error-banner">{$transmitError}</div>
{/if}

<button disabled={$isTransmitting}>Start Transmission</button>
<p>Status: {$transmitState.status}</p>
```

### Memory Safety

- The `eventSource` variable is module-scoped (not globalThis), which is correct for client-side stores
- The `connectTransmitSSE` guard prevents double connections
- The `disconnectTransmitSSE` function ensures cleanup on component unmount
- The 3-second reconnect delay prevents reconnection storms
- **No unbounded arrays**: The store holds a single `TransmitState` object, not an accumulating list

---

## Verification Commands

```bash
# Verify file exists
ls src/lib/stores/hackrf-transmit.ts

# Verify all exports present
grep -n "export interface TransmitState" src/lib/stores/hackrf-transmit.ts
grep -n "export const transmitState" src/lib/stores/hackrf-transmit.ts
grep -n "export const isTransmitting" src/lib/stores/hackrf-transmit.ts
grep -n "export const transmitError" src/lib/stores/hackrf-transmit.ts
grep -n "export function connectTransmitSSE" src/lib/stores/hackrf-transmit.ts
grep -n "export function disconnectTransmitSSE" src/lib/stores/hackrf-transmit.ts

# Verify SSE endpoint URL is correct
grep -n "/api/hackrf/transmit/events" src/lib/stores/hackrf-transmit.ts

# Verify no console statements
grep -n 'console\.\(log\|error\|warn\)' src/lib/stores/hackrf-transmit.ts && echo "FAIL" || echo "PASS"

# Verify reconnection logic exists
grep -n "setTimeout.*connectTransmitSSE" src/lib/stores/hackrf-transmit.ts

# Verify approximate line count (~80 lines)
wc -l src/lib/stores/hackrf-transmit.ts

# Typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] File created at `src/lib/stores/hackrf-transmit.ts`
- [ ] `TransmitState` interface exported with all 10 fields
- [ ] `initialState` has correct defaults (active: false, status: 'idle', error: null, etc.)
- [ ] `transmitState` writable store exported
- [ ] `isTransmitting` derived store exported (checks `status === 'transmitting'`)
- [ ] `transmitError` derived store exported (extracts `error` field)
- [ ] `connectTransmitSSE()` exported, creates EventSource to `/api/hackrf/transmit/events`
- [ ] Guard against double connections (if eventSource exists, return)
- [ ] Auto-reconnect on error with 3-second delay
- [ ] `disconnectTransmitSSE()` exported, closes and nulls the EventSource
- [ ] No `console.log`, `console.error`, or `console.warn` statements
- [ ] File is approximately 80 lines (no unnecessary bloat)
- [ ] `npm run typecheck` passes

---

## Definition of Done

1. `src/lib/stores/hackrf-transmit.ts` exists with all 6 exports
2. SSE connection to `/api/hackrf/transmit/events` works end-to-end
3. Store updates in real-time when the events endpoint emits `status` events
4. `disconnectTransmitSSE()` cleanly tears down the EventSource
5. Auto-reconnect fires after 3 seconds on connection loss
6. `npm run typecheck` passes

---

## Cross-References

- **Phase-7.5.01**: Route 11 (events/+server.ts) is the SSE endpoint this store connects to
- **Phase-7.5.04**: Frontend services (`hackrf-service.ts`, `index.ts`) re-export from this store
- **Phase-7.5.06**: UI components (`StatusDisplay.svelte`, `ConnectionStatus.svelte`) subscribe to this store
- **Phase 2 F1**: ReadableStream cancel() pattern on the server side (server-side SSE cleanup)
- **Memory Leak Audit**: Svelte `subscribe(fn)()` pattern is correct (immediate subscribe+unsubscribe)
