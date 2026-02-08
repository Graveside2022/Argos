# Phase 7.4.02: Transmit Process (`transmit-process.ts`)

**Decomposed from**: Phase-7.4-SERVICE-LAYER.md (Task 7.4.2)
**Risk Level**: HIGH -- Direct hardware interaction, subprocess lifecycle, signal injection surface
**Prerequisites**: Phase 7.4.06 (shared types)
**Estimated Duration**: 3-4 hours
**Estimated Lines**: ~180
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Manage the `hackrf_transfer` binary subprocess that directly controls the HackRF One SDR hardware. This is the most hardware-critical component in the transmit pipeline. It handles subprocess spawning, argument construction, error classification, graceful shutdown, and architecture validation.

**Target file**: `src/lib/server/hackrf/transmit/transmit-process.ts`

**Replaces**: `hackrf_emitter/backend/rf_workflows/hackrf_controller.py` subprocess management (795 lines, methods at lines 363-530)

---

## Methods to Implement

| #   | Method                          | Source Method                           | Description                                        |
| --- | ------------------------------- | --------------------------------------- | -------------------------------------------------- |
| 1   | `constructor(filePath, params)` | N/A                                     | Configure subprocess arguments from WorkflowParams |
| 2   | `start(): Promise<void>`        | `_transmit_via_subprocess()` (line 363) | Spawn hackrf_transfer with constructed args        |
| 3   | `stop(): Promise<void>`         | `stop_transmission()`                   | SIGTERM, wait 5s, SIGKILL                          |
| 4   | `validateBinary(): BinaryInfo`  | N/A (new)                               | Check hackrf_transfer exists and is correct arch   |

### Method Details

**1. `constructor(filePath: string, params: WorkflowParams)`**
Store the file path and params. Construct the `hackrf_transfer` argument array (see below). Do NOT spawn the subprocess in the constructor -- defer to `start()`. Validate that `filePath` exists and is readable. The constructor is synchronous; file existence can be checked with `fs.existsSync()`.

**2. `start(): Promise<void>`**
Spawn `hackrf_transfer` using `child_process.spawn()` (NOT `exec` or `execSync`). Attach `stdout`, `stderr`, and `exit` event handlers. The promise resolves when the subprocess has been successfully spawned (not when it completes). Set up a 30-second watchdog timer that fires if no output is received from the subprocess. Emit `data` events for stdout lines (used by TransmitManager for progress). Emit `exit` and `error` events for lifecycle management.

**3. `stop(): Promise<void>`**
Send SIGTERM to the subprocess. Start a 5-second timer. If the subprocess has not exited after 5 seconds, send SIGKILL. The promise resolves when the subprocess has fully exited (either via SIGTERM or SIGKILL). Clean up the temp I/Q file after the subprocess exits. If no subprocess is running, resolve immediately (no-op).

**4. `validateBinary(): BinaryInfo`** (static method)
Check that `hackrf_transfer` exists on the system PATH, determine its architecture (aarch64/x86_64), and extract its version string. This is called once at startup and cached. Returns a `BinaryInfo` object.

---

## hackrf_transfer Command Construction

The `hackrf_transfer` binary accepts the following flags relevant to transmission:

```typescript
const args = [
	'-t',
	filePath, // Input file (int8 I/Q pairs)
	'-f',
	String(params.frequency), // Center frequency in Hz
	'-s',
	String(params.sampleRate), // Sample rate in Hz
	'-x',
	String(params.gain), // TX VGA gain (0-47 dB)
	'-a',
	'1' // Amp enable (always on for TX)
];
if (params.repeat) {
	args.push('-R'); // Repeat transmission (loop file)
}
```

### Argument Safety

All arguments are passed as array elements to `spawn()`, never as a concatenated string. This eliminates shell injection because `spawn()` with an args array bypasses the shell interpreter entirely. The `filePath` is the only user-influenced value that reaches the filesystem; it MUST be a path generated internally by the TransmitManager (never user-supplied).

### Flag Reference

| Flag | Purpose                 | Valid Range               | Source                    |
| ---- | ----------------------- | ------------------------- | ------------------------- |
| `-t` | TX file path (int8 I/Q) | Valid filesystem path     | Internal (temp file)      |
| `-f` | Center frequency (Hz)   | 1,000,000 - 6,000,000,000 | WorkflowParams.frequency  |
| `-s` | Sample rate (Hz)        | 2,000,000 - 20,000,000    | WorkflowParams.sampleRate |
| `-x` | TX VGA gain (dB)        | 0 - 47                    | WorkflowParams.gain       |
| `-a` | Amp enable              | 0 or 1                    | Always 1 for TX           |
| `-R` | Repeat mode             | Flag present or absent    | WorkflowParams.repeat     |

---

## Temp File Security

**Added by Independent Audit (2026-02-08)**: The I/Q data file written to disk before transmission contains the signal content. In a military deployment, this file represents the exact RF waveform being transmitted. File permissions must be restrictive.

```typescript
import { writeFile, chmod } from 'fs/promises';

async function writeTempFile(samples: Uint8Array, params: WorkflowParams): Promise<string> {
	const filePath = join(tmpdir(), `argos-iq-${Date.now()}.bin`);
	await writeFile(filePath, samples, { mode: 0o600 }); // Owner read/write only
	return filePath;
}
```

The default `fs.writeFile` creates files with 0644 permissions (world-readable). For RF signal data in a military deployment, files must be 0600 (owner read/write only). This follows **CERT FIO06** (create files with appropriate access permissions).

### Temp File Lifecycle

1. Created by `TransmitManager.writeTempFile()` with 0o600 permissions
2. Path passed to `TransmitProcess` constructor
3. Opened by `hackrf_transfer` (read-only)
4. Deleted by `TransmitProcess.stop()` after subprocess exits
5. Deletion also triggered on `error` event (defensive cleanup)
6. On process crash without cleanup, files in `tmpdir()` are cleaned by OS reboot

---

## Error Taxonomy

From `hackrf_controller.py` lines 380-430, the following failure modes are defined:

| #   | Failure Mode              | Detection                               | Recovery                              | Max Retries |
| --- | ------------------------- | --------------------------------------- | ------------------------------------- | ----------- |
| 1   | Device busy (exit code 1) | stderr contains "hackrf_open" or "busy" | Wait 2s, retry                        | 3           |
| 2   | USB disconnect (SIGPIPE)  | Process exits with signal               | Emit 'device-disconnected' event      | 0           |
| 3   | File not found            | stderr contains "No such file"          | Return error immediately              | 0           |
| 4   | Permission denied         | stderr contains "Permission denied"     | Log error, suggest udev rules         | 0           |
| 5   | Timeout (>30s no output)  | Timer watchdog                          | SIGTERM, wait 5s, SIGKILL             | 0           |
| 6   | Invalid parameters        | Exit code != 0, no specific error       | Parse stderr, return structured error | 0           |
| 7   | Device not found          | stderr contains "not found"             | Return 503 to API caller              | 0           |

### Error Classification Implementation

```typescript
function classifyError(
	exitCode: number | null,
	signal: string | null,
	stderr: string
): TransmitError {
	if (signal) {
		return { code: 'USB_DISCONNECT', message: 'HackRF device disconnected', retryable: false };
	}
	if (stderr.includes('hackrf_open') || stderr.includes('busy')) {
		return {
			code: 'DEVICE_BUSY',
			message: 'HackRF device is busy',
			retryable: true,
			maxRetries: 3
		};
	}
	if (stderr.includes('No such file')) {
		return { code: 'FILE_NOT_FOUND', message: 'I/Q data file not found', retryable: false };
	}
	if (stderr.includes('Permission denied')) {
		return {
			code: 'PERMISSION_DENIED',
			message: 'Permission denied. Check udev rules.',
			retryable: false
		};
	}
	if (stderr.includes('not found')) {
		return { code: 'DEVICE_NOT_FOUND', message: 'HackRF device not found', retryable: false };
	}
	return {
		code: 'UNKNOWN_ERROR',
		message: `hackrf_transfer failed: ${stderr.slice(0, 200)}`,
		retryable: false
	};
}
```

### Retry Logic

Only failure mode #1 (Device busy) supports retries. The retry loop:

1. Catch `DEVICE_BUSY` error from `start()`
2. Wait 2 seconds (`setTimeout`)
3. Retry `start()` up to 3 times
4. After 3 failures, emit permanent error

All other failure modes are terminal -- no retry.

---

## Architecture Compatibility Check

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
			const versionOutput = execFileSync('hackrf_transfer', ['-h'], {
				encoding: 'utf-8',
				timeout: 5000
			});
			const match = versionOutput.match(/hackrf_transfer.*?(\d+\.\d+)/);
			if (match) version = match[1];
		} catch (e: unknown) {
			// hackrf_transfer -h exits with non-zero; parse stderr
			if (e && typeof e === 'object' && 'stderr' in e) {
				const stderr = String((e as { stderr: unknown }).stderr);
				const match = stderr.match(/hackrf_transfer.*?(\d+\.\d+)/);
				if (match) version = match[1];
			}
			/* version detection is best-effort */
		}
		return { available: true, path: binaryPath, arch, version };
	} catch {
		return { available: false, path: '', arch: 'unknown', version: 'none' };
	}
}
```

### SECURITY NOTE (Independent Audit Correction)

The original plan used `execSync(`file ${path}`)` with template literal string interpolation. This passes the path through a shell interpreter, creating a command injection vector if the path contains shell metacharacters (e.g., `; rm -rf /`). The corrected version uses `execFileSync('file', [binaryPath])` which bypasses the shell entirely, passing arguments directly to the executable via `execve()`. This follows **CERT OS02** (sanitize arguments to OS commands).

Similarly, the version detection originally used `execSync('hackrf_transfer -h 2>&1 || true')` which requires shell interpretation for the `2>&1` redirect and `|| true` fallback. The corrected version uses `execFileSync('hackrf_transfer', ['-h'])` inside a try/catch, achieving the same result without shell involvement.

---

## CI/CD Graceful Degradation

On systems without HackRF hardware (CI/CD pipelines, x86_64 development machines):

1. `validateHackrfBinary()` returns `{ available: false, path: '', arch: 'unknown', version: 'none' }`
2. `TransmitProcess.start()` throws `HardwareUnavailableError`
3. API routes return HTTP 503 with body:

```json
{
	"error": "HackRF hardware not available",
	"code": "HARDWARE_UNAVAILABLE"
}
```

4. All non-hardware API endpoints continue to function normally:
    - `GET /api/hackrf/transmit/status` -- returns `{ state: 'idle', deviceConnected: false }`
    - `GET /api/hackrf/transmit/workflows` -- returns full workflow list
    - `GET /api/hackrf/transmit/cache/status` -- returns cache statistics
    - `GET /api/hackrf/transmit/health` -- returns `{ healthy: true, hardwareAvailable: false }`

This ensures that CI/CD tests, frontend development, and non-hardware features work without modification on any platform.

---

## Verification Commands

```bash
# File exists and compiles
test -f src/lib/server/hackrf/transmit/transmit-process.ts && echo "EXISTS" || echo "MISSING"
npx tsc --noEmit src/lib/server/hackrf/transmit/transmit-process.ts

# Line count within budget
wc -l src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: <= 250 lines

# All 4 methods present
grep -cE '(constructor|start\(\)|stop\(\)|validateBinary\b|validateHackrfBinary\b)' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: >= 4

# Uses execFileSync (NOT execSync) for security
grep -c 'execFileSync' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: >= 2

# Does NOT use execSync (shell injection risk)
grep -c 'execSync[^F]' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: 0

# Uses spawn (NOT exec) for subprocess
grep -c 'child_process.*spawn\|spawn(' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: >= 1

# Temp file permissions set to 0o600
grep -c '0o600' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: >= 1 (or in transmit-manager if writeTempFile lives there)

# Error taxonomy covers all 7 failure modes
grep -cE '(DEVICE_BUSY|USB_DISCONNECT|FILE_NOT_FOUND|PERMISSION_DENIED|TIMEOUT|INVALID_PARAMS|DEVICE_NOT_FOUND)' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: >= 7

# No console.log in production code
grep -c 'console\.log' src/lib/server/hackrf/transmit/transmit-process.ts
# Expected: 0

# Full typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] `transmit-process.ts` exists at `src/lib/server/hackrf/transmit/transmit-process.ts`
- [ ] All 4 methods implemented: `constructor`, `start`, `stop`, `validateBinary`
- [ ] `hackrf_transfer` argument array uses flags: `-t`, `-f`, `-s`, `-x`, `-a`, `-R`
- [ ] Arguments passed as array to `spawn()`, never concatenated into shell string
- [ ] Temp file created with 0o600 permissions (CERT FIO06)
- [ ] Temp file deleted after subprocess exits (both normal and error paths)
- [ ] All 7 error failure modes detected and classified
- [ ] Only failure mode #1 (Device busy) retries (max 3, 2s delay)
- [ ] 30-second watchdog timer kills unresponsive subprocess
- [ ] `stop()` sends SIGTERM, waits 5s, then SIGKILL
- [ ] `validateBinary()` uses `execFileSync` (NOT `execSync`) -- CERT OS02
- [ ] Architecture detection correctly identifies aarch64 vs x86_64
- [ ] CI/CD graceful degradation returns 503, not crash
- [ ] Non-hardware endpoints continue to function when hardware unavailable
- [ ] Class extends `EventEmitter` for `exit`, `error`, `data` events
- [ ] No `console.log` statements in production code
- [ ] File does not exceed 300 lines
- [ ] No function exceeds 60 lines
- [ ] `npm run typecheck` passes

---

## Definition of Done

This task is complete when:

1. `TransmitProcess` can validate the `hackrf_transfer` binary (or report unavailability gracefully)
2. On RPi 5 with HackRF connected: `start()` successfully spawns `hackrf_transfer`
3. On x86_64 without HackRF: `validateBinary()` returns `{ available: false }` without crash
4. `stop()` cleanly terminates a running subprocess within 5 seconds
5. All 7 error failure modes are detected and return structured error objects
6. All unit tests pass (mocked subprocess for CI)
7. `npm run typecheck` passes with zero errors

---

## Cross-References

- **Phase 7.4.01** (Transmit Manager): Creates and manages `TransmitProcess` instances
- **Phase 7.4.04** (Safety Manager): Validates params before they reach TransmitProcess
- **Phase 7.4.06** (Shared Types): `WorkflowParams`, `DeviceInfo`, `BinaryInfo` interfaces
- **Phase 7.5** (API Routes): API routes call TransmitManager, which delegates to TransmitProcess
- **Phase 7.6** (Verification Suite): Mock subprocess tests for CI/CD environments
