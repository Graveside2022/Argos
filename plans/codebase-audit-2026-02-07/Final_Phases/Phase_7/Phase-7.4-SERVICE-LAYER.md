# Phase 7.4: Service Layer (HackRF Controller, Transmit Manager, Config, Safety, Cache)

**Risk Level**: HIGH -- Hardware interaction, subprocess management, production service architecture
**Prerequisites**: Phase 7.3 (protocol encoders must exist and pass golden file tests)
**Estimated Files Created**: 9
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Build the service layer that bridges the DSP library (Phase 7.2-7.3) to the SvelteKit API routes
(Phase 7.5). This layer handles hardware interaction, subprocess lifecycle, signal caching,
configuration management, safety enforcement, and audit logging.

**Target directory**: `src/lib/server/hackrf/transmit/`

---

## Architecture

```
src/lib/server/hackrf/transmit/
  index.ts                    # Barrel export
  transmit-manager.ts         # Singleton orchestrator (EventEmitter)
  transmit-process.ts         # hackrf_transfer subprocess management
  config-manager.ts           # Frequency bands, device settings, workflow defaults
  safety-manager.ts           # Hardware bounds enforcement + audit logging
  signal-cache.ts             # Pre-computed .bin file cache with JSON metadata
  types.ts                    # Shared interfaces for transmit layer
```

---

## Files Missing from Original Plan

The original Phase 7 plan omitted the following files that MUST be migrated:

| Python File                | Lines | Original Plan Status                                                   | This Plan                                |
| -------------------------- | ----- | ---------------------------------------------------------------------- | ---------------------------------------- |
| `hackrf_controller.py`     | 795   | Mentioned in Context only, no migration map                            | Task 7.4.1 + 7.4.2                       |
| `config_manager.py`        | 254   | Not mentioned at all                                                   | Task 7.4.3                               |
| `wideband_signal_cache.py` | 371   | Not mentioned at all                                                   | Task 7.4.5 (merged into signal-cache.ts) |
| `app.py` (non-route logic) | 406   | Routes covered in Task 7.3, but thread management and SocketIO ignored | Task 7.4.1                               |

---

## Task 7.4.1: Transmit Manager (`transmit-manager.ts`)

**Replaces**:

- Workflow orchestration from `modulation_workflows.py` (start/stop/dispatch)
- Workflow orchestration from `enhanced_workflows.py` (start/stop/dispatch)
- Thread management from `app.py` (threading.Thread for background transmission)
- SocketIO event emission from `app.py` (workflow_status, workflow_complete, error)

### Singleton Pattern

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

### State Machine

```
IDLE -> GENERATING -> WRITING_FILE -> TRANSMITTING -> STOPPING -> IDLE
                                          |
                                          +-> ERROR -> IDLE
```

### Methods to implement:

| #   | Method                                                           | Source                                                                                      | Description                                            |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `constructor()`                                                  | `app.py` init + `ModulationWorkflows.__init__`                                              | Initialize state, load config                          |
| 2   | `getAvailableWorkflows(): WorkflowInfo[]`                        | `ModulationWorkflows.get_available_workflows` + `EnhancedWorkflows.get_available_workflows` | Merged workflow list                                   |
| 3   | `startWorkflow(params: WorkflowParams): Promise<WorkflowResult>` | `app.py start_workflow()` route handler logic                                               | Orchestrate: validate -> generate -> write -> transmit |
| 4   | `stopWorkflow(): Promise<void>`                                  | `app.py stop_workflow()` + `ModulationWorkflows.stop_workflow`                              | Signal subprocess to stop                              |
| 5   | `getStatus(): TransmitStatus`                                    | `app.py get_status()`                                                                       | Current state, active workflow, device info            |
| 6   | `getDeviceInfo(): Promise<DeviceInfo>`                           | `HackRFController.get_device_info`                                                          | Query hackrf_transfer for device info                  |

### ARCHITECTURAL CHANGE: Python Threading to Node.js Event Loop

**Python pattern** (background thread):

```python
# app.py line ~165
thread = threading.Thread(target=run_workflow, args=(workflow_name, params), daemon=True)
thread.start()
```

**TypeScript pattern** (async subprocess):

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

Node.js is single-threaded, so the signal generation step (`generateSamples`) will block the event
loop. For signals under ~1 second at 2 Msps, this is acceptable (~50ms computation). For longer signals:

**HARD LIMITS (Independent Audit Addition)**:

- At 2 Msps, 1 second = 32 MB Float64 (2M samples _ 2 channels _ 8 bytes)
- At 20 Msps, 1 second = 320 MB Float64 -- this EXCEEDS the Node.js heap limit (--max-old-space-size=1024)
- The transmit manager MUST reject requests where `sampleRate * duration * 16 > 512_000_000` (512 MB)
- For signals exceeding 64 MB, use streaming generation (write samples to file as they are generated)

**Implementation strategy by signal size**:

1. **< 64 MB** (e.g., 2 Msps \* 2s): Synchronous generation, hold in memory
2. **64-512 MB** (e.g., 2 Msps \* 16s): Chunked generation with `setImmediate()` between chunks
3. **> 512 MB**: Rejected with error `SIGNAL_TOO_LARGE: Requested signal requires {size}MB, maximum is 512MB`

This prevents OOM crashes on the RPi 5 with 8GB RAM and 1024MB Node.js heap limit.

### SocketIO to SSE Migration

The Python backend uses Flask-SocketIO to push status events to the React frontend:

```python
socketio.emit('workflow_status', {'status': 'transmitting', 'workflow': name})
```

In the TypeScript implementation, use Server-Sent Events (SSE) consistent with the existing
SvelteKit HackRF architecture (the sweep data-stream endpoint already uses SSE):

```typescript
// SSE endpoint at /api/hackrf/transmit/events
// Connects to TransmitManager.on('status', ...)
```

**Estimated total**: ~250 lines

---

## Task 7.4.2: Transmit Process (`transmit-process.ts`)

**Replaces**: `hackrf_controller.py` subprocess management (795 lines, methods at lines 363-530)

### hackrf_transfer Subprocess Lifecycle

This is the most hardware-critical component. It manages the `hackrf_transfer` binary that
directly controls the HackRF One SDR hardware.

### Methods to implement:

| #   | Method                          | Source Method                           | Description                                      |
| --- | ------------------------------- | --------------------------------------- | ------------------------------------------------ |
| 1   | `constructor(filePath, params)` | N/A                                     | Configure subprocess arguments                   |
| 2   | `start(): Promise<void>`        | `_transmit_via_subprocess()` (line 363) | Spawn hackrf_transfer                            |
| 3   | `stop(): Promise<void>`         | `stop_transmission()`                   | SIGTERM, wait 5s, SIGKILL                        |
| 4   | `validateBinary(): BinaryInfo`  | N/A (new)                               | Check hackrf_transfer exists and is correct arch |

### hackrf_transfer Command Construction

```typescript
const args = [
	'-t',
	filePath, // Input file (int8 I/Q)
	'-f',
	String(params.frequency), // Center frequency in Hz
	'-s',
	String(params.sampleRate), // Sample rate in Hz
	'-x',
	String(params.gain), // TX VGA gain (0-47 dB)
	'-a',
	'1' // Amp enable
];
if (params.repeat) {
	args.push('-R'); // Repeat transmission
}
```

### Temp File Security

**Added by Independent Audit (2026-02-08)**: The I/Q data file written to disk before transmission
contains the signal content. File permissions must be restrictive:

```typescript
import { writeFile, chmod } from 'fs/promises';

async function writeTempFile(samples: Uint8Array, params: WorkflowParams): Promise<string> {
	const filePath = join(tmpdir(), `argos-iq-${Date.now()}.bin`);
	await writeFile(filePath, samples, { mode: 0o600 }); // Owner read/write only
	return filePath;
}
```

The default `fs.writeFile` creates files with 0644 permissions (world-readable). For RF signal data
in a military deployment, files must be 0600 (owner read/write only). This follows CERT FIO06
(create files with appropriate access permissions).

### Error Taxonomy (from hackrf_controller.py lines 380-430):

| #   | Failure Mode              | Detection                               | Recovery                              | Max Retries |
| --- | ------------------------- | --------------------------------------- | ------------------------------------- | ----------- |
| 1   | Device busy (exit code 1) | stderr contains "hackrf_open" or "busy" | Wait 2s, retry                        | 3           |
| 2   | USB disconnect (SIGPIPE)  | Process exits with signal               | Emit 'device-disconnected' event      | 0           |
| 3   | File not found            | stderr contains "No such file"          | Return error immediately              | 0           |
| 4   | Permission denied         | stderr contains "Permission denied"     | Log error, suggest udev rules         | 0           |
| 5   | Timeout (>30s no output)  | Timer watchdog                          | SIGTERM, wait 5s, SIGKILL             | 0           |
| 6   | Invalid parameters        | Exit code != 0, no specific error       | Parse stderr, return structured error | 0           |
| 7   | Device not found          | stderr contains "not found"             | Return 503 to API caller              | 0           |

### Architecture Compatibility Check

```typescript
import { execFileSync } from 'child_process';

interface BinaryInfo {
	available: boolean;
	path: string;
	arch: 'aarch64' | 'x86_64' | 'unknown';
	version: string;
}

function validateHackrfBinary(): BinaryInfo {
	try {
		const binaryPath = execFileSync('which', ['hackrf_transfer'], { encoding: 'utf-8' }).trim();
		const fileInfo = execFileSync('file', [binaryPath], { encoding: 'utf-8' });
		const arch = fileInfo.includes('aarch64')
			? 'aarch64'
			: fileInfo.includes('x86-64')
				? 'x86_64'
				: 'unknown';
		// Get version
		let version = 'unknown';
		try {
			const versionOutput = execSync('hackrf_transfer -h 2>&1 || true', {
				encoding: 'utf-8'
			});
			const match = versionOutput.match(/hackrf_transfer.*?(\d+\.\d+)/);
			if (match) version = match[1];
		} catch {
			/* version detection is best-effort */
		}
		return { available: true, path, arch, version };
	} catch {
		return { available: false, path: '', arch: 'unknown', version: 'none' };
	}
}
```

**SECURITY NOTE (Independent Audit Correction)**: The original plan used `execSync(`file ${path}`)` with
template literal string interpolation. This passes the path through a shell interpreter, creating a
command injection vector if the path contains shell metacharacters. The corrected version uses
`execFileSync('file', [binaryPath])` which bypasses the shell entirely, passing arguments directly
to the executable. This follows CERT OS02 (sanitize arguments to OS commands).

### CI/CD Graceful Degradation

On systems without HackRF hardware (CI/CD, x86_64 dev machines):

1. `validateHackrfBinary()` returns `{ available: false }`
2. `TransmitProcess.start()` throws `HardwareUnavailableError`
3. API routes return HTTP 503 with body `{ error: "HackRF hardware not available", code: "HARDWARE_UNAVAILABLE" }`
4. All non-hardware API endpoints (status, workflows, cache, health) continue to work

**Estimated total**: ~180 lines

---

## Task 7.4.3: Config Manager (`config-manager.ts`)

**Replaces**: `hackrf_emitter/backend/utils/config_manager.py` (254 lines)

### OMITTED FROM ORIGINAL PLAN -- This is a new addition.

The Python `ConfigManager` handles:

- Loading/saving JSON configuration from `config/settings.json`
- Frequency band definitions (ISM, GPS, ADS-B, amateur, cellular, etc.)
- Device settings (default gain, sample rate)
- Workflow default parameters
- Restricted frequency lists

### Methods to migrate (14 methods):

| #   | Python Method                | TypeScript Method            | Description                        |
| --- | ---------------------------- | ---------------------------- | ---------------------------------- |
| 1   | `__init__`                   | `constructor()`              | Load config from JSON              |
| 2   | `_load_config`               | `loadConfig()`               | Read settings.json                 |
| 3   | `_merge_configs`             | `mergeConfigs()`             | Deep merge defaults with overrides |
| 4   | `_save_config`               | `saveConfig()`               | Write settings.json                |
| 5   | `get_frequency_bands`        | `getFrequencyBands()`        | All defined frequency bands        |
| 6   | `get_device_settings`        | `getDeviceSettings()`        | HackRF device defaults             |
| 7   | `get_safety_settings`        | `getSafetySettings()`        | Safety configuration               |
| 8   | `get_workflow_defaults`      | `getWorkflowDefaults()`      | Per-workflow default params        |
| 9   | `get_restricted_frequencies` | `getRestrictedFrequencies()` | Restricted frequency list          |
| 10  | `is_frequency_allowed`       | `isFrequencyAllowed()`       | Check against restricted list      |
| 11  | `get_band_for_frequency`     | `getBandForFrequency()`      | Find band containing frequency     |
| 12  | `get_elrs_bands`             | `getELRSBands()`             | ELRS-specific bands                |
| 13  | `get_gps_bands`              | `getGPSBands()`              | GPS-specific bands                 |
| 14  | `update_config`              | `updateConfig()`             | Modify and save config             |

### Config File Migration

The current config file is at `hackrf_emitter/backend/config/settings.json` (62 lines).
After migration, move to `config/hackrf-settings.json` (project root config directory).

**Estimated total**: ~180 lines

---

## Task 7.4.4: Safety Manager (`safety-manager.ts`)

**Replaces**: `hackrf_emitter/backend/utils/safety_manager.py` (95 lines)

### CRITICAL FINDING: Current Python Implementation is Deliberately All-Permissive

The actual `safety_manager.py` has **every safety check returning True unconditionally**.
All restrictions are explicitly disabled with inline comments: "DISABLED FOR UNRESTRICTED OPERATION".

The `get_limits()` method returns:

- `max_power_dbm: 100` (well above any consumer SDR capability)
- `max_gain: 100` (HackRF max is 47)
- `max_duration: 999999` (essentially unlimited)
- `frequency_range: 0 to 999 GHz` (far beyond HackRF's 1 MHz - 6 GHz)
- `restricted_frequencies: []` (empty)

### Design Decision

The original Phase 7 plan introduced safety profiles ("unrestricted", "training", "locked_down")
in `config/safety-profiles.json`. **This is feature creep.** The current Python implementation
has no profiles -- it is a single, all-permissive configuration.

**Decision**: Faithfully replicate the current behavior (all-permissive) but implement it with
proper architecture so that safety checks CAN be enabled in the future without code changes.

### Implementation:

```typescript
interface SafetyLimits {
	maxFrequencyHz: number;
	minFrequencyHz: number;
	maxGainDb: number;
	maxSampleRateMsps: number;
	maxDurationS: number;
	restrictedFrequencies: number[];
}

const HARDWARE_LIMITS: SafetyLimits = {
	minFrequencyHz: 1_000_000, // 1 MHz (HackRF One hardware minimum)
	maxFrequencyHz: 6_000_000_000, // 6 GHz (HackRF One hardware maximum)
	maxGainDb: 47, // HackRF One TX VGA maximum
	maxSampleRateMsps: 20, // HackRF One maximum sample rate
	maxDurationS: Infinity, // No software limit
	restrictedFrequencies: [] // No restrictions (matching current Python behavior)
};
```

### Audit Logging (MANDATORY for military deployment)

Every transmission event MUST be logged. This is NOT optional. The original plan correctly
identified this requirement. Implementation:

```typescript
interface AuditEntry {
	ts: string; // ISO 8601 timestamp
	action: 'start' | 'stop' | 'rejected' | 'error';
	workflow: string;
	frequency_mhz: number;
	gain_db: number;
	sample_rate_msps: number;
	duration_s: number;
	user: string; // Effective user identity (see note below)
	reason?: string; // For rejected/error/stop
}
```

**AUDIT NOTE (Independent Audit Correction)**: `process.env.USER` in a Docker container is always
`root`, making this field useless for attribution. The implementation should use one of:

1. A session identifier from the authentication middleware (preferred, requires Phase 2)
2. The remote IP address from the SvelteKit request object (`event.getClientAddress()`)
3. A combination of timestamp + request ID as a correlation identifier

Until Phase 2 authentication is implemented, use `event.getClientAddress()` as the user field
to provide at least network-level attribution.

Log file: `data/audit/transmit-log-YYYY-MM-DD.jsonl` (one line per event, append-only).

### Methods to implement:

| #   | Method                           | Description                                         |
| --- | -------------------------------- | --------------------------------------------------- |
| 1   | `validateTransmitParams(params)` | Check against hardware limits, return error or null |
| 2   | `logTransmitEvent(entry)`        | Append to JSONL audit log                           |
| 3   | `getHardwareLimits()`            | Return current limits                               |
| 4   | `isFrequencyAllowed(freq)`       | Check restricted list (currently always true)       |

**Estimated total**: ~120 lines

---

## Task 7.4.5: Signal Cache (`signal-cache.ts`)

**Replaces**:

- `hackrf_emitter/backend/rf_workflows/universal_signal_cache.py` (625 lines)
- `hackrf_emitter/backend/rf_workflows/wideband_signal_cache.py` (371 lines)

### OMISSION FROM ORIGINAL PLAN: wideband_signal_cache.py (371 lines) was completely absent.

The two Python cache implementations share 80%+ of their logic. In TypeScript, merge into a
single unified cache:

### Methods to implement:

| #   | Method                                | Source                          | Description                    |
| --- | ------------------------------------- | ------------------------------- | ------------------------------ |
| 1   | `constructor(cacheDir)`               | `UniversalSignalCache.__init__` | Initialize cache directory     |
| 2   | `getCacheKey(params)`                 | `get_cache_key`                 | Deterministic key from params  |
| 3   | `getCachedSignal(key)`                | `get_cached_signal`             | Load from disk if exists       |
| 4   | `cacheSignal(key, samples, metadata)` | `cache_signal`                  | Write to disk                  |
| 5   | `getOrGenerate(params, generator)`    | `get_or_generate_signal`        | Cache-through pattern          |
| 6   | `pregenerateAll()`                    | `pregenerate_all_signals`       | Pre-compute all common signals |
| 7   | `getCacheStatus()`                    | `get_cache_status`              | Size, entry count, disk usage  |
| 8   | `clearCache()`                        | `clear_cache`                   | Delete all cached files        |
| 9   | `loadMetadata()`                      | `load_cache_metadata`           | Load index from JSON           |
| 10  | `saveMetadata()`                      | `save_cache_metadata`           | Persist index to JSON          |

### Cache directory: `data/hackrf-cache/`

Each cached signal is stored as:

- `<hash>.bin` -- raw I/Q samples (int8 format for hackrf_transfer)
- `<hash>.json` -- metadata (params, size, creation time, sample rate, frequency)

**Estimated total**: ~200 lines (merged from 625 + 371 = 996 lines of Python)

---

## Task 7.4.6: Shared Types (`types.ts`)

Define all interfaces used across the transmit service layer:

```typescript
export interface WorkflowParams {
	workflow: string;
	frequency: number;
	sampleRate: number;
	gain: number;
	duration: number;
	repeat: boolean;
	// Protocol-specific params passed through
	[key: string]: unknown;
}

export interface WorkflowInfo {
	name: string;
	displayName: string;
	description: string;
	category: string;
	defaultParams: Partial<WorkflowParams>;
}

export interface TransmitStatus {
	state: 'idle' | 'generating' | 'writing_file' | 'transmitting' | 'stopping' | 'error';
	activeWorkflow: string | null;
	frequency: number;
	gain: number;
	sampleRate: number;
	duration: number;
	elapsed: number;
	deviceConnected: boolean;
	error: string | null;
}

export interface DeviceInfo {
	available: boolean;
	serialNumber: string;
	firmwareVersion: string;
	boardId: string;
	architecture: string;
	binaryPath: string;
}
```

**Estimated total**: ~80 lines

---

## Verification Checklist

- [ ] `transmit-manager.ts`: Singleton pattern verified (globalThis), all 6 methods implemented
- [ ] `transmit-manager.ts`: State machine transitions tested (IDLE -> GENERATING -> TRANSMITTING -> IDLE)
- [ ] `transmit-manager.ts`: SocketIO events replaced with EventEmitter events for SSE
- [ ] `transmit-process.ts`: hackrf_transfer subprocess management handles all 7 failure modes
- [ ] `transmit-process.ts`: Binary validation detects aarch64 architecture
- [ ] `transmit-process.ts`: Graceful degradation on x86_64 (503, not crash)
- [ ] `config-manager.ts`: All 14 methods migrated from Python config_manager.py
- [ ] `config-manager.ts`: Settings.json loaded from correct path
- [ ] `safety-manager.ts`: Hardware bounds enforce HackRF One specs (1 MHz - 6 GHz, 0-47 dB)
- [ ] `safety-manager.ts`: Audit log writes every event to JSONL file
- [ ] `safety-manager.ts`: All-permissive behavior matches current Python implementation
- [ ] `safety-manager.ts`: No unauthorized feature creep (no safety profiles unless explicitly requested)
- [ ] `signal-cache.ts`: Unified cache handles both universal and wideband patterns
- [ ] `signal-cache.ts`: Cache-through pattern (getOrGenerate) works correctly
- [ ] `types.ts`: All shared interfaces defined
- [ ] All files pass `npm run typecheck`
- [ ] No file exceeds 300 lines
- [ ] No function exceeds 60 lines

---

## Definition of Done

This phase is complete when:

1. The transmit-manager can be instantiated and returns valid status
2. The transmit-process can validate the hackrf_transfer binary (or report unavailability)
3. The config-manager loads settings.json and returns frequency band definitions
4. The safety-manager validates parameters and writes audit log entries
5. The signal-cache can store and retrieve cached signals
6. All unit tests pass
7. `npm run typecheck` passes
