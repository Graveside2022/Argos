# Phase 7.4.01: Transmit Manager (`transmit-manager.ts`)

**Decomposed from**: Phase-7.4-SERVICE-LAYER.md (Task 7.4.1)
**Risk Level**: HIGH -- Singleton lifecycle, state machine correctness, event loop blocking, memory safety
**Prerequisites**: Phase 7.3 (protocol encoders must exist and pass golden file tests), Phase 7.4.06 (shared types), Phase 7.4.02 (TransmitProcess class)
**Estimated Duration**: 4-6 hours
**Estimated Lines**: ~250
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Build the singleton orchestrator that bridges DSP signal generation (Phase 7.2-7.3) to hardware transmission (Phase 7.4.02). This is the central coordination point for the entire HackRF transmit pipeline: it manages workflow dispatch, state transitions, subprocess lifecycle, and SSE event emission.

**Target file**: `src/lib/server/hackrf/transmit/transmit-manager.ts`

---

## Files Missing from Original Plan

The original Phase 7 plan omitted or under-specified the following sources that feed into this task:

| Python File                | Lines | Original Plan Status                                                   | Coverage in This Task                                |
| -------------------------- | ----- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `hackrf_controller.py`     | 795   | Mentioned in Context only, no migration map                            | Device info query, init logic                        |
| `app.py` (non-route logic) | 406   | Routes covered in Task 7.3, but thread management and SocketIO ignored | Thread-to-async migration, SocketIO-to-SSE migration |

The workflow orchestration methods from `modulation_workflows.py` and `enhanced_workflows.py` (start/stop/dispatch) are also consolidated here.

---

## Replaces

- Workflow orchestration from `modulation_workflows.py` (start/stop/dispatch)
- Workflow orchestration from `enhanced_workflows.py` (start/stop/dispatch)
- Thread management from `app.py` (threading.Thread for background transmission)
- SocketIO event emission from `app.py` (workflow_status, workflow_complete, error)

---

## Singleton Pattern (HMR-Safe)

SvelteKit's Vite HMR re-executes module-level code on every hot reload. A module-level `let manager = new TransmitManager()` would create a NEW instance on every HMR cycle, orphaning the previous instance (and its subprocess references). The `globalThis` pattern survives HMR because `globalThis` is the V8 global object, not a module-scoped variable.

```typescript
// HMR-safe singleton using globalThis
const TRANSMIT_MANAGER_KEY = '__argos_transmit_manager__';

function getTransmitManager(): TransmitManager {
	if (!(globalThis as Record<string, unknown>)[TRANSMIT_MANAGER_KEY]) {
		(globalThis as Record<string, unknown>)[TRANSMIT_MANAGER_KEY] = new TransmitManager();
	}
	return (globalThis as Record<string, unknown>)[TRANSMIT_MANAGER_KEY] as TransmitManager;
}
```

Export `getTransmitManager` as the public API. Do NOT export the `TransmitManager` class constructor directly -- all consumers must go through the singleton accessor.

---

## State Machine

```
IDLE -> GENERATING -> WRITING_FILE -> TRANSMITTING -> STOPPING -> IDLE
                                          |
                                          +-> ERROR -> IDLE
```

### State Transition Rules

| From           | To             | Trigger                                            | Side Effects                           |
| -------------- | -------------- | -------------------------------------------------- | -------------------------------------- |
| `idle`         | `generating`   | `startWorkflow()` called                           | Emit `status` event                    |
| `generating`   | `writing_file` | Signal generation complete                         | Emit `status` event                    |
| `writing_file` | `transmitting` | Temp file written to disk                          | Emit `status` event, spawn subprocess  |
| `transmitting` | `stopping`     | `stopWorkflow()` called                            | Send SIGTERM to subprocess             |
| `transmitting` | `error`        | Subprocess exits non-zero, USB disconnect, timeout | Emit `error` event                     |
| `stopping`     | `idle`         | Subprocess exits after SIGTERM/SIGKILL             | Emit `status` event, cleanup temp file |
| `error`        | `idle`         | Error acknowledged or new workflow started         | Cleanup temp file                      |

### Invalid Transitions (Must Reject)

- `generating` -> `generating` (already generating, reject with 409 Conflict)
- `transmitting` -> `generating` (must stop first)
- `stopping` -> `generating` (must wait for stop to complete)

---

## Methods to Implement

| #   | Method                                                           | Source                                                                                      | Description                                            |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `constructor()`                                                  | `app.py` init + `ModulationWorkflows.__init__`                                              | Initialize state, load config                          |
| 2   | `getAvailableWorkflows(): WorkflowInfo[]`                        | `ModulationWorkflows.get_available_workflows` + `EnhancedWorkflows.get_available_workflows` | Merged workflow list                                   |
| 3   | `startWorkflow(params: WorkflowParams): Promise<WorkflowResult>` | `app.py start_workflow()` route handler logic                                               | Orchestrate: validate -> generate -> write -> transmit |
| 4   | `stopWorkflow(): Promise<void>`                                  | `app.py stop_workflow()` + `ModulationWorkflows.stop_workflow`                              | Signal subprocess to stop                              |
| 5   | `getStatus(): TransmitStatus`                                    | `app.py get_status()`                                                                       | Current state, active workflow, device info            |
| 6   | `getDeviceInfo(): Promise<DeviceInfo>`                           | `HackRFController.get_device_info`                                                          | Query hackrf_transfer for device info                  |

### Method Details

**1. `constructor()`** -- Initialize the `ConfigManager` (Task 7.4.03) and `SafetyManager` (Task 7.4.04) instances. Set initial state to `idle`. Register no-op event listeners. Do NOT validate hardware in constructor (defer to first `startWorkflow` or explicit `getDeviceInfo` call).

**2. `getAvailableWorkflows()`** -- Return a static array of `WorkflowInfo` objects. In Python, this was split across `ModulationWorkflows.get_available_workflows` and `EnhancedWorkflows.get_available_workflows`. In TypeScript, merge into a single list. Each entry includes `name`, `displayName`, `description`, `category`, and `defaultParams`.

**3. `startWorkflow(params)`** -- The core orchestration method. Sequence: validate params via SafetyManager -> check state is `idle` or `error` -> transition to `generating` -> generate I/Q samples via DSP library -> transition to `writing_file` -> write temp file -> transition to `transmitting` -> spawn TransmitProcess -> return result. This method MUST log an audit entry via SafetyManager on both success and failure.

**4. `stopWorkflow()`** -- If state is `transmitting`, delegate to `TransmitProcess.stop()`. If state is `generating` or `writing_file`, set an abort flag checked by the generation loop. If state is `idle`, no-op. Log audit entry with action `stop`.

**5. `getStatus()`** -- Return a `TransmitStatus` object reflecting current state. This is a synchronous snapshot -- no I/O.

**6. `getDeviceInfo()`** -- Delegate to `TransmitProcess.validateBinary()` for binary availability, then query `hackrf_info` for device details (serial, firmware, board ID). Cache the result for 60 seconds.

---

## ARCHITECTURAL CHANGE: Python Threading to Node.js Event Loop

### Python Pattern (Background Thread)

```python
# app.py line ~165
thread = threading.Thread(target=run_workflow, args=(workflow_name, params), daemon=True)
thread.start()
```

In Python, `threading.Thread` runs the workflow function in a separate OS thread. The Flask request handler returns immediately while the thread runs in the background. SocketIO events push status updates to the frontend.

### TypeScript Pattern (Async Subprocess)

```typescript
async startWorkflow(params: WorkflowParams): Promise<WorkflowResult> {
  this.state = 'generating';
  this.emit('status', { state: 'generating', workflow: params.workflow });

  // 1. Generate I/Q samples (CPU-bound, runs synchronously)
  const samples = this.generateSamples(params);

  // 2. Write to temp file
  this.state = 'writing_file';
  const filePath = await this.writeTempFile(samples, params);

  // 3. Start hackrf_transfer subprocess (non-blocking)
  this.state = 'transmitting';
  this.activeProcess = new TransmitProcess(filePath, params);
  this.activeProcess.on('exit', (code) => this.handleProcessExit(code));
  this.activeProcess.on('error', (err) => this.handleProcessError(err));
  await this.activeProcess.start();

  return { status: 'transmitting', processId: this.activeProcess.pid };
}
```

Node.js is single-threaded, so the signal generation step (`generateSamples`) will block the event loop. For signals under ~1 second at 2 Msps, this is acceptable (~50ms computation). For longer signals, the blocking time becomes unacceptable and requires mitigation.

---

## HARD LIMITS (Independent Audit Addition)

### Memory Calculations

| Sample Rate | Duration   | Samples    | Memory (Float64) | Decision           |
| ----------- | ---------- | ---------- | ---------------- | ------------------ |
| 2 Msps      | 1 second   | 2,000,000  | 32 MB            | Sync OK            |
| 2 Msps      | 2 seconds  | 4,000,000  | 64 MB            | Sync OK (boundary) |
| 2 Msps      | 16 seconds | 32,000,000 | 512 MB           | Chunked required   |
| 20 Msps     | 1 second   | 20,000,000 | 320 MB           | Chunked required   |
| 20 Msps     | 2 seconds  | 40,000,000 | 640 MB           | REJECTED           |

**Formula**: `memoryBytes = sampleRate * duration * 2 (I+Q channels) * 8 (Float64 bytes)`

Simplified: `memoryBytes = sampleRate * duration * 16`

The Node.js heap is configured at `--max-old-space-size=1024` (1024 MB). The transmit manager MUST reject requests where:

```
sampleRate * duration * 16 > 512_000_000  (512 MB threshold)
```

The 512 MB threshold (not 1024 MB) provides a 50% safety margin for the generation pipeline overhead (intermediate buffers, the int8 conversion output, metadata structures).

### Implementation Strategy by Signal Size

**1. Less than 64 MB** (e.g., 2 Msps \* 2s = 64 MB):

- Synchronous generation, hold entire Float64Array in memory
- Convert to Int8Array, write to temp file in one operation
- Event loop blocked for ~50-200ms (acceptable for RPi 5 Cortex-A76)

**2. 64 MB to 512 MB** (e.g., 2 Msps \* 16s = 512 MB):

- Chunked generation with `setImmediate()` between chunks
- Each chunk generates ~1 second of signal (~32 MB at 2 Msps)
- `setImmediate()` yields to the event loop between chunks, preventing request timeouts
- Write each chunk to the temp file incrementally (append mode)
- Emit progress events between chunks for SSE consumers

**3. Greater than 512 MB**:

- Rejected immediately with structured error:

```json
{
	"error": "SIGNAL_TOO_LARGE",
	"message": "Requested signal requires {size}MB, maximum is 512MB",
	"requestedMB": 640,
	"maxMB": 512
}
```

### Size Check Implementation

```typescript
function validateSignalSize(sampleRate: number, duration: number): void {
	const requiredBytes = sampleRate * duration * 16;
	const requiredMB = Math.ceil(requiredBytes / (1024 * 1024));
	if (requiredBytes > 512_000_000) {
		throw new SignalTooLargeError(requiredMB, 512);
	}
}
```

This check MUST be performed at the top of `startWorkflow()`, BEFORE any signal generation begins, to fail fast.

---

## SocketIO to SSE Migration

### Python Pattern (Flask-SocketIO)

```python
socketio.emit('workflow_status', {'status': 'transmitting', 'workflow': name})
```

The Python backend uses Flask-SocketIO to push bidirectional status events to the React frontend. SocketIO requires a persistent WebSocket connection and a SocketIO client library.

### TypeScript Pattern (Server-Sent Events)

In the SvelteKit implementation, use Server-Sent Events (SSE) consistent with the existing HackRF architecture. The sweep data-stream endpoint (`/api/rf/data-stream`) already uses SSE successfully.

```typescript
// SSE endpoint at /api/hackrf/transmit/events
// Connects to TransmitManager.on('status', ...)
```

The `TransmitManager` extends `EventEmitter` and emits the following events:

| Event Name | Payload                                  | Replaces SocketIO Event           |
| ---------- | ---------------------------------------- | --------------------------------- |
| `status`   | `TransmitStatus`                         | `workflow_status`                 |
| `complete` | `{ workflow: string, duration: number }` | `workflow_complete`               |
| `error`    | `{ code: string, message: string }`      | `error`                           |
| `progress` | `{ percent: number, phase: string }`     | N/A (new, for chunked generation) |

The SSE endpoint (implemented in Phase 7.5) subscribes to these EventEmitter events and serializes them as SSE `data:` frames. The transmit-manager itself does NOT know about HTTP or SSE -- it only emits typed events. This separation keeps the service layer transport-agnostic.

---

## Verification Commands

```bash
# File exists and compiles
test -f src/lib/server/hackrf/transmit/transmit-manager.ts && echo "EXISTS" || echo "MISSING"
npx tsc --noEmit src/lib/server/hackrf/transmit/transmit-manager.ts

# Line count within budget
wc -l src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: <= 300 lines

# Singleton pattern present
grep -c 'globalThis' src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: >= 2 (key definition + accessor)

# State machine states defined
grep -c "'idle'\|'generating'\|'writing_file'\|'transmitting'\|'stopping'\|'error'" src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: >= 6

# Memory limit enforced
grep -c '512_000_000\|512000000\|SIGNAL_TOO_LARGE' src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: >= 1

# All 6 methods present
grep -cE '(constructor|getAvailableWorkflows|startWorkflow|stopWorkflow|getStatus|getDeviceInfo)' src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: >= 6

# EventEmitter usage
grep -c 'EventEmitter\|extends.*EventEmitter\|this.emit' src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: >= 3

# No console.log in production code
grep -c 'console\.log' src/lib/server/hackrf/transmit/transmit-manager.ts
# Expected: 0

# Full typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] `transmit-manager.ts` exists at `src/lib/server/hackrf/transmit/transmit-manager.ts`
- [ ] Singleton pattern uses `globalThis` with `TRANSMIT_MANAGER_KEY`
- [ ] `getTransmitManager()` is the only public accessor (constructor not exported)
- [ ] State machine implements all 6 states: `idle`, `generating`, `writing_file`, `transmitting`, `stopping`, `error`
- [ ] Invalid state transitions are rejected (e.g., `generating` -> `generating` returns 409)
- [ ] All 6 methods implemented: `constructor`, `getAvailableWorkflows`, `startWorkflow`, `stopWorkflow`, `getStatus`, `getDeviceInfo`
- [ ] `startWorkflow` validates signal size BEFORE generation (512 MB hard limit)
- [ ] Signals < 64 MB use synchronous generation
- [ ] Signals 64-512 MB use chunked generation with `setImmediate()` yield
- [ ] Signals > 512 MB rejected with `SIGNAL_TOO_LARGE` error
- [ ] Class extends `EventEmitter` and emits `status`, `complete`, `error`, `progress` events
- [ ] SocketIO events (`workflow_status`, `workflow_complete`, `error`) replaced with EventEmitter
- [ ] Audit logging called on every `startWorkflow` and `stopWorkflow` invocation
- [ ] No `console.log` statements in production code
- [ ] File does not exceed 300 lines
- [ ] No function exceeds 60 lines
- [ ] `npm run typecheck` passes

---

## Definition of Done

This task is complete when:

1. The `TransmitManager` singleton can be instantiated via `getTransmitManager()` and survives simulated HMR
2. `getStatus()` returns a valid `TransmitStatus` with state `idle` on fresh initialization
3. `getAvailableWorkflows()` returns a non-empty array of `WorkflowInfo` objects
4. `startWorkflow()` transitions through `generating` -> `writing_file` -> `transmitting` states
5. `stopWorkflow()` transitions from `transmitting` -> `stopping` -> `idle`
6. Signal size validation rejects requests exceeding 512 MB
7. EventEmitter events are emitted on every state transition
8. All unit tests pass
9. `npm run typecheck` passes with zero errors

---

## Cross-References

- **Phase 7.4.02** (Transmit Process): `TransmitProcess` class used by `startWorkflow()`
- **Phase 7.4.03** (Config Manager): `ConfigManager` used by `constructor()` and `getAvailableWorkflows()`
- **Phase 7.4.04** (Safety Manager): `SafetyManager.validateTransmitParams()` called in `startWorkflow()`
- **Phase 7.4.05** (Signal Cache): `SignalCache.getOrGenerate()` may be called by `startWorkflow()` for cached signals
- **Phase 7.4.06** (Shared Types): `WorkflowParams`, `WorkflowInfo`, `TransmitStatus`, `DeviceInfo` interfaces
- **Phase 7.5** (API Routes): SSE endpoint at `/api/hackrf/transmit/events` subscribes to TransmitManager events
- **Phase 7.2-7.3** (DSP Library): Signal generation functions called by `generateSamples()`
