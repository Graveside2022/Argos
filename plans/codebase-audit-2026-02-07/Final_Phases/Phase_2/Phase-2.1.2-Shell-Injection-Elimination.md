# Phase 2.1.2: Shell Command Injection Elimination

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A03:2021 (Injection), CERT STR02-C (Sanitize Data Passed to Complex Subsystems), CWE-78 (OS Command Injection), NIST SP 800-53 SI-10 (Information Input Validation)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task eliminates all verified shell command injection vectors in the Argos codebase by creating a centralized input sanitization library and applying it to every location where user-supplied or externally-sourced parameters are interpolated into shell commands. The task also replaces shell-invoking execution patterns (`hostExec`, `exec`) with non-shell alternatives (`execFile`, `spawn` with array args) wherever possible.

## Execution Constraints

| Constraint       | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Risk Level       | LOW -- validation may reject valid edge-case inputs                    |
| Severity         | CRITICAL                                                               |
| Prerequisites    | Task 2.1.1 (auth middleware must be in place before injection fixes)   |
| Files Touched    | 1 new library + 17 files patched + 1 sudoers script                    |
| Blocks           | Phase 2.2 (systematic hardening depends on input sanitization library) |
| Blocked By       | Task 2.1.1 (authentication)                                            |
| Estimated Effort | 4 hours                                                                |

## Threat Context

Argos controls a HackRF One SDR capable of RF transmission and executes system-level commands to manage external tools (Kismet, GSM Evil, OpenWebRX, Wifite, PagerMon, DroneID). The codebase contains 110 instances of `hostExec()` usage across 14 files and 121 exec-related calls across 32 API route files. Multiple locations interpolate user-supplied parameters directly into shell command strings via template literals.

**Verified injection severity breakdown** (Regrade A1, A2):

- **3 CRITICAL**: Direct code/command injection from unauthenticated HTTP requests
- **4 HIGH**: Injection vectors with indirect parameter sources (process listings, filesystem reads)
- **~15 MEDIUM**: Injection vectors with controlled-but-unvalidated internal sources

**Most exploitable vector**: `api/tactical-map/cell-towers/+server.ts` (lines 12-40) accepts URL query parameters via unauthenticated GET request, interpolates them into Python source code written to a temp file, and executes that file. This is the single highest-value exploitation target in the codebase -- unauthenticated GET + code injection + no input validation.

## Current State Assessment

| Metric                                  | Value                     | Verification Command                                                         |
| --------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `hostExec()` calls (codebase-wide)      | 110 across 14 files       | `grep -rln "hostExec" src/ --include="*.ts" \| wc -l`                        |
| exec/spawn calls in API routes          | 121 across 32 files       | `grep -rn "hostExec\|exec\|spawn" src/routes/api/ --include="*.ts" \| wc -l` |
| Unvalidated template literal injections | 17 verified vectors       | See injection vector table below                                             |
| Input sanitization library              | Does not exist            | `find src/ -path "*/security/input*" -name "*.ts" \| wc -l` returns 0        |
| `execFile` usage (shell-free execution) | 0 instances in API routes | `grep -rn "execFile" src/routes/ --include="*.ts" \| wc -l`                  |
| Template literal injection in hostExec  | Present                   | `grep -rn 'hostExec(\`._\${' src/ --include="_.ts"` returns matches          |

## Implementation Plan

### Subtask 2.1.2.1: Create Input Sanitization Library

**Create**: `src/lib/server/security/input-sanitizer.ts`

This library provides a set of pure validation functions that throw `InputValidationError` on invalid input. Every function follows the pattern: validate, throw if invalid, return the validated value with its correct type.

```typescript
import path from 'path';

/**
 * Input sanitization library for Argos SDR & Network Analysis Console.
 *
 * Design principles:
 * 1. Fail-closed: Invalid input throws, never returns a default
 * 2. Type-safe: Return types match validated constraints
 * 3. Minimal: Each function validates exactly one concern
 * 4. No shell awareness: These functions validate data, not commands
 *
 * Usage: Import individual validators at each injection point.
 * Do NOT import this module in client-side code.
 */

export class InputValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InputValidationError';
	}
}

/**
 * Validates that a value is a finite number within a specified range.
 * Use for: frequency, gain, duration, PID, latitude, longitude, radius
 */
export function validateNumericParam(
	value: unknown,
	name: string,
	min: number,
	max: number
): number {
	const num = Number(value);
	if (!Number.isFinite(num) || num < min || num > max) {
		throw new InputValidationError(
			`${name} must be a finite number between ${min} and ${max}, got: ${String(value)}`
		);
	}
	return num;
}

/**
 * Validates that a value is a member of an explicit allowlist.
 * Use for: action types, mode selections, enum-like parameters
 */
export function validateAllowlist<T extends string>(
	value: unknown,
	name: string,
	allowlist: readonly T[]
): T {
	if (typeof value !== 'string' || !allowlist.includes(value as T)) {
		throw new InputValidationError(
			`${name} must be one of: ${allowlist.join(', ')}, got: ${String(value)}`
		);
	}
	return value as T;
}

/**
 * Validates IEEE 802 MAC address format (colon-separated hex).
 * Use for: WiFi BSSID, Bluetooth MAC, network device addresses
 */
export function validateMacAddress(value: unknown): string {
	if (typeof value !== 'string' || !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value)) {
		throw new InputValidationError(`Invalid MAC address format: ${String(value)}`);
	}
	return value;
}

/**
 * Validates Linux network interface name format.
 * Use for: wlan0, eth0, mon0, etc. Max 15 chars per IFNAMSIZ.
 */
export function validateInterfaceName(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,15}$/.test(value)) {
		throw new InputValidationError(`Invalid interface name: ${String(value)}`);
	}
	return value;
}

/**
 * Validates that a path resolves within an allowed directory.
 * Prevents path traversal attacks (../../etc/passwd).
 * Use for: file paths from user input or external command output
 *
 * IMPORTANT: Uses path.resolve() to canonicalize, then verifies prefix.
 * This is resistant to ../ traversal unlike startsWith() on raw input.
 */
export function validatePathWithinDir(value: unknown, allowedDir: string): string {
	if (typeof value !== 'string') {
		throw new InputValidationError('Path must be a string');
	}
	const resolved = path.resolve(allowedDir, value);
	if (!resolved.startsWith(path.resolve(allowedDir))) {
		throw new InputValidationError('Path traversal detected');
	}
	if (value.includes('\0')) {
		throw new InputValidationError('Null byte in path');
	}
	return resolved;
}
```

### Subtask 2.1.2.2: Patch ALL Verified Injection Vectors

**REGRADE CORRECTIONS (A1, A2)**: Two CRITICAL injection vectors were missed by the original plan. One false positive (rtl-433) has been removed. The corrected severity breakdown is: **3 CRITICAL, 4 HIGH, ~15 MEDIUM** (original plan claimed 13 total with no severity breakdown).

#### Complete Injection Vector Table -- API Route Files (12 vectors)

| #     | File                                              | Line(s)       | Severity     | Interpolated Param                                                                                                                        | Source of Param                             | Fix                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------- | ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **`api/tactical-map/cell-towers/+server.ts`**     | **12-40**     | **CRITICAL** | **URL query params interpolated into Python source code, written to temp file, executed via `execAsync('python3 /tmp/fetch_towers.py')`** | **URL searchParams (GET request, no auth)** | **MUST replace with parameterized subprocess: `execFile('python3', [script, '--lat', lat, '--lon', lon])` or rewrite in TypeScript. This is the single most exploitable vector in the codebase -- unauthenticated GET + code injection.** |
| **2** | **`api/rf/usrp-power/+server.ts`**                | **10-27**     | **CRITICAL** | **`${frequency}`, `${gain}`, `${duration}` interpolated into `execAsync()` shell command**                                                | **POST request body**                       | **`validateNumericParam` for all three params + replace with `execFile` (no shell)**                                                                                                                                                      |
| 3     | `api/gsm-evil/control/+server.ts`                 | 91            | CRITICAL     | `${freq}`, `${gain}`                                                                                                                      | Request body `frequency` (line 77)          | `validateNumericParam(freq, 'frequency', 800, 1000)`, `validateNumericParam(gain, 'gain', 0, 50)`                                                                                                                                         |
| 4     | `api/gsm-evil/intelligent-scan-stream/+server.ts` | 232, 434, 440 | HIGH         | `${pid}`                                                                                                                                  | Process listing output                      | `validateNumericParam(pid, 'pid', 1, 4194304)`                                                                                                                                                                                            |
| 5     | `api/gsm-evil/intelligent-scan-stream/+server.ts` | 451           | MEDIUM       | `${stderrLog}`                                                                                                                            | Internal path construction                  | `validatePathWithinDir(stderrLog, '/tmp')`                                                                                                                                                                                                |
| 6     | `api/gsm-evil/intelligent-scan/+server.ts`        | 95            | HIGH         | `${pid}`                                                                                                                                  | Process listing output                      | `validateNumericParam(pid, 'pid', 1, 4194304)`                                                                                                                                                                                            |
| 7     | `api/gsm-evil/scan/+server.ts`                    | 51, 257, 260  | MEDIUM       | `${pid}`, `${baseCommand}`                                                                                                                | Hardcoded freq array + process output       | Validate PID; freq is from hardcoded list (low risk)                                                                                                                                                                                      |
| 8     | `api/gsm-evil/imsi/+server.ts`                    | 26, 39        | MEDIUM       | `${dbPath}` in Python script                                                                                                              | Shell command output (find)                 | `validatePathWithinDir(dbPath, '/var/lib/gsmevil')`                                                                                                                                                                                       |
| 9     | `api/gsm-evil/imsi-data/+server.ts`               | 25, 36        | MEDIUM       | `${dbPath}` in Python script                                                                                                              | Shell command output (find)                 | `validatePathWithinDir(dbPath, '/var/lib/gsmevil')`                                                                                                                                                                                       |
| 10    | `api/kismet/control/+server.ts`                   | 61, 85, 93    | HIGH         | `${iface}`, `${alfaInterface}`                                                                                                            | Filesystem directory listing                | `validateInterfaceName(alfaInterface)`                                                                                                                                                                                                    |
| 11    | `api/kismet/start-safe/+server.ts`                | 20, 22        | HIGH         | `${adapter}`                                                                                                                              | grep/cut pipeline output                    | `validateInterfaceName(adapter)`                                                                                                                                                                                                          |
| 12    | `api/openwebrx/control/+server.ts`                | 91, 145, 152  | LOW          | `${CONTAINER_NAME}`                                                                                                                       | Hardcoded constant                          | LOW RISK -- verify it stays hardcoded                                                                                                                                                                                                     |

#### Injection Vectors in Server-Side Process Managers (2 vectors)

| #   | File                                        | Line(s)      | Severity | Interpolated Param                                                                                  | Fix                                                                |
| --- | ------------------------------------------- | ------------ | -------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 13  | `src/lib/server/pagermon/processManager.ts` | 33-38        | HIGH     | `${freqHz}`, `${sampleRate}`, `${gain}` from user config, passed to `spawn('sh', ['-c', template])` | `validateNumericParam` for all; replace with `execFile` (no shell) |
| 14  | `src/lib/server/wifite/processManager.ts`   | 160, 327-328 | HIGH     | BSSID values from user input in `script -qec` (shell)                                               | `validateMacAddress` for each BSSID                                |

#### Additional Injection Vectors Found by Regrade (3 vectors)

| #   | File                                         | Line(s)            | Severity | Interpolated Param                                          | Fix                                                                                 |
| --- | -------------------------------------------- | ------------------ | -------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 15  | `src/routes/api/droneid/+server.ts`          | 23, 184-227        | HIGH     | PID from file read interpolated into kill command           | `validateNumericParam(pid, 'pid', 1, 4194304)`                                      |
| 16  | `src/lib/server/kismet/kismet_controller.ts` | 227-286            | HIGH     | Interface name from env var interpolated into sudo commands | `validateInterfaceName()` -- env vars can be manipulated                            |
| 17  | `src/lib/server/db/dbOptimizer.ts`           | 276, 279, 294, 305 | LOW      | SQL template literals (internal callers only)               | Parameterize SQL queries; even internal callers should not pass unsanitized strings |

#### REMOVED -- FALSE POSITIVE (Regrade A2)

| File                             | Original Classification | Actual Code Pattern                                                | Why Safe                                                                                                                                                        |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/rtl-433/control/+server.ts` | Injection vector        | `spawn('rtl_433', ['-f', freq, '-s', sampleRate])` with array args | Uses `spawn()` with array arguments -- no shell invocation. Each argument is a separate argv element with no shell interpretation. This is safe from injection. |

#### Files Verified as Safe (no user-param interpolation)

| File                                       | Reason Safe                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api/rtl-433/control/+server.ts`           | **REGRADE (A2)**: Uses `spawn('rtl_433', ['-f', freq])` with array args -- no shell invocation. Previously listed as injection vector; reclassified as safe. |
| `api/bettercap/control/+server.ts`         | Delegates to bettercapClient API wrapper, no direct exec                                                                                                     |
| `api/btle/control/+server.ts`              | Delegates to btleManager; spawn uses array args (safe)                                                                                                       |
| `api/wifite/control/+server.ts`            | Delegates to wifiteManager (vector is in processManager.ts #14)                                                                                              |
| `api/pagermon/control/+server.ts`          | Delegates to pagermonManager (vector is in processManager.ts #13)                                                                                            |
| `api/hackrf/start-sweep/+server.ts`        | Uses sweepManager, no direct exec                                                                                                                            |
| `api/hackrf/[...path]/+server.ts`          | HTTP proxy via fetch(), no command execution                                                                                                                 |
| `api/hackrf/cleanup/+server.ts`            | Hardcoded commands only, no user params                                                                                                                      |
| `api/kismet/start-with-adapter/+server.ts` | Static commands only, no user input                                                                                                                          |
| `api/gsm-evil/health/+server.ts`           | Static commands only, no user input                                                                                                                          |
| `api/gsm-evil/scan/+server.ts`             | Frequencies from hardcoded array, not user input                                                                                                             |

#### Detailed Fix Examples for CRITICAL Vectors

**Vector #1: `api/tactical-map/cell-towers/+server.ts` (lines 12-40) -- Python Code Injection**

BEFORE (vulnerable):

```typescript
// Lines 12-40: URL query params interpolated into Python source code
const lat = url.searchParams.get('lat');
const lon = url.searchParams.get('lon');
const radius = url.searchParams.get('radius');

// Python source code is CONSTRUCTED from user input and written to /tmp
const pythonScript = `
import requests
lat = ${lat}
lon = ${lon}
radius = ${radius}
# ... rest of Python script
`;
await writeFile('/tmp/fetch_towers.py', pythonScript);
await execAsync('python3 /tmp/fetch_towers.py');
```

AFTER (secure):

```typescript
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const lat = validateNumericParam(url.searchParams.get('lat'), 'latitude', -90, 90);
const lon = validateNumericParam(url.searchParams.get('lon'), 'longitude', -180, 180);
const radius = validateNumericParam(url.searchParams.get('radius'), 'radius', 0.1, 50);

// Pass parameters as command-line arguments, NOT interpolated into source code
const { stdout } = await execFileAsync('python3', [
	'/usr/local/lib/argos/fetch_towers.py', // Fixed path, not /tmp
	'--lat',
	String(lat),
	'--lon',
	String(lon),
	'--radius',
	String(radius)
]);
```

**Vector #2: `api/rf/usrp-power/+server.ts` (lines 10-27) -- Shell Injection**

BEFORE (vulnerable):

```typescript
// Lines 10-27: POST body params interpolated into execAsync shell command
const { frequency, gain, duration } = await request.json();
const result = await execAsync(
	`uhd_siggen --freq ${frequency} --gain ${gain} --duration ${duration}`
);
```

AFTER (secure):

```typescript
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const body = await request.json();
const frequency = validateNumericParam(body.frequency, 'frequency', 70e6, 6e9);
const gain = validateNumericParam(body.gain, 'gain', 0, 89);
const duration = validateNumericParam(body.duration, 'duration', 0.1, 300);

// execFile does NOT invoke a shell -- immune to injection
const { stdout } = await execFileAsync('uhd_siggen', [
	'--freq',
	String(frequency),
	'--gain',
	String(gain),
	'--duration',
	String(duration)
]);
```

**Vector #3: `api/gsm-evil/control/+server.ts` (line 91) -- Shell Injection**

BEFORE (vulnerable):

```typescript
// Line 91: frequency and gain from request body interpolated into hostExec
await hostExec(`grgsm_livemon_headless -f ${freq}M -g ${gain}`);
```

AFTER (secure):

```typescript
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const validatedFreq = validateNumericParam(freq, 'frequency', 800, 1000);
const validatedGain = validateNumericParam(gain, 'gain', 0, 50);

await execFileAsync('grgsm_livemon_headless', [
	'-f',
	`${validatedFreq}M`,
	'-g',
	String(validatedGain)
]);
```

### Subtask 2.1.2.3: Replace hostExec Template Literals with Parameterized Execution

**Pattern**: Where possible, replace `hostExec` (which invokes a shell) with `execFile` (which does not invoke a shell and is immune to shell injection).

**BEFORE (vulnerable pattern)**:

```typescript
// hostExec invokes sh -c, enabling shell metacharacter injection
await hostExec(`grgsm_livemon_headless -f ${freq}M -g ${gain}`);
```

**AFTER (secure pattern)**:

```typescript
// execFile does not invoke a shell and is immune to shell injection.
// Each argument is a separate argv element -- no shell interpretation occurs.
await execFile('grgsm_livemon_headless', ['-f', `${validatedFreq}M`, '-g', String(validatedGain)]);
```

**When to use `execFile`**: All cases where the command and arguments can be separated into distinct strings.

**When `hostExec`/`exec` is still required**: Cases requiring shell features (pipes `|`, redirects `>`, globbing `*`). In those cases, ALL interpolated values MUST pass through validation functions from the sanitization library before interpolation.

**Docker context note**: `hostExec()` adds an `nsenter` shell layer when running inside Docker containers. This creates a double shell escaping issue -- input passes through two shell interpreters. Replacing `hostExec` with `execFile` eliminates both shell layers simultaneously.

### Subtask 2.1.2.4: Fix Sudoers Wildcards

**File**: `scripts/setup-droneid-sudoers.sh` (EXISTS, verified)

| Line | Current                                                           | Problem                              | Fix                                              |
| ---- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| 22   | `ubuntu ALL=(ALL) NOPASSWD: /bin/kill *`                          | Can kill ANY process on the system   | Restrict to specific process names or use pkill  |
| 23   | `ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh` | Arbitrary script execution from /tmp | Move script to `/usr/local/bin/start-droneid.sh` |
| 32   | `node ALL=(ALL) NOPASSWD: /bin/kill *`                            | Same as line 22                      | Restrict to specific process names               |
| 33   | `node ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh`   | Same as line 23                      | Move script to `/usr/local/bin/start-droneid.sh` |

BEFORE (vulnerable):

```bash
# Lines 22-23 (and 32-33 with 'node' user)
ubuntu ALL=(ALL) NOPASSWD: /bin/kill *
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh
```

AFTER (secure):

```bash
# Restrict kill to DroneID-related processes only
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f droneid
# Script moved to fixed location (not world-writable /tmp)
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /usr/local/bin/start-droneid.sh
```

### Subtask 2.1.2.5: Verification

**Command 1 -- No unvalidated template literal injection remains in hostExec**:

```bash
grep -rn 'hostExec(`.*\${' src/ --include="*.ts" | wc -l
```

**Expected result**: `0` (all replaced with validated inputs or execFile)

**Command 2 -- No unvalidated template literal injection in execAsync**:

```bash
grep -rn 'execAsync(`.*\${' src/ --include="*.ts" | wc -l
```

**Expected result**: `0` (catches the CRITICAL vectors missed by the original plan)

**Command 3 -- Build passes and manual injection test rejected**:

```bash
npm run typecheck && npm run build
```

**Expected result**: Exit code 0

**Command 4 -- Manual test: invalid input rejected**:

```bash
curl -X POST http://localhost:5173/api/gsm-evil/control \
  -H "X-API-Key: $ARGOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "frequency": "$(rm -rf /)"}'
```

**Expected result**: HTTP 400 with body containing `InputValidationError` message: `frequency must be a finite number between 800 and 1000, got: $(rm -rf /)`. The shell command is NOT executed.

## Verification Checklist

1. `grep -rn 'hostExec(\`._\${' src/ --include="_.ts" | wc -l`returns`0`
2. `grep -rn 'execAsync(\`._\${' src/ --include="_.ts" | wc -l`returns`0`
3. `test -f src/lib/server/security/input-sanitizer.ts && echo EXISTS` returns `EXISTS`
4. `grep -c "validateNumericParam\|validateAllowlist\|validateMacAddress\|validateInterfaceName\|validatePathWithinDir" src/lib/server/security/input-sanitizer.ts` returns `5` (all 5 functions present)
5. `npm run typecheck` exits 0
6. `npm run build` exits 0
7. Manual injection test returns 400 (not 500 or command execution)
8. `grep -rn "spawn('sh'" src/lib/server/pagermon/processManager.ts | wc -l` returns `0` (replaced with execFile)

## Commit Strategy

```
security(phase2.1.2): eliminate all shell injection vectors with input validation

Phase 2.1 Task 2: Shell Command Injection Elimination
- Created src/lib/server/security/input-sanitizer.ts (5 validators + error class)
- Patched 17 injection vectors: 3 CRITICAL, 4 HIGH, ~10 MEDIUM
- Replaced hostExec template literals with execFile (no shell) where possible
- Removed rtl-433 false positive (spawn with array args is safe)
- Fixed 4 sudoers wildcard entries in setup-droneid-sudoers.sh
- Added by regrade: cell-towers Python injection (A1), usrp-power shell injection (A1)
Verified: grep for unvalidated hostExec/execAsync template literals returns 0

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

Note: After rollback, all 17 injection vectors return to their exploitable state. The input sanitization library is removed. This is acceptable only if the system is taken offline.

## Risk Assessment

| Risk                                                          | Likelihood | Impact | Mitigation                                                            |
| ------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| Validation rejects valid edge-case hardware params            | MEDIUM     | LOW    | Wide numeric bounds (e.g., freq 800-1000 MHz for GSM, 0-50 for gain)  |
| execFile replacement breaks command that needs shell features | LOW        | MEDIUM | Keep hostExec with validation for pipe/redirect cases; test each path |
| Missed injection vector not in table                          | LOW        | HIGH   | Comprehensive grep verification catches template literal patterns     |
| Path validation too restrictive                               | LOW        | LOW    | Use broad allowed directories; add paths to allowlist as discovered   |
| sudoers changes break DroneID functionality                   | MEDIUM     | LOW    | Test DroneID start/stop cycle after deployment                        |

## Standards Traceability

| Standard                 | Requirement                                                           | How This Task Satisfies It                                                                       |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| OWASP A03:2021           | Injection -- prevent untrusted data from being sent to an interpreter | All user-supplied params validated before interpolation; execFile eliminates shell interpreter   |
| CERT STR02-C             | Sanitize data passed to complex subsystems                            | Centralized sanitization library with type-safe validators                                       |
| CWE-78                   | OS Command Injection -- neutralize special elements in commands       | validateNumericParam prevents shell metacharacters; execFile bypasses shell entirely             |
| NIST SP 800-53 SI-10     | Information Input Validation                                          | Every external input boundary validated; allowlist approach for enums; range checks for numerics |
| NASA/JPL Power of Ten #1 | Restrict to simple control flow constructs                            | Each validator is a pure function with single responsibility; no complex branching               |

## Execution Tracking

| Subtask | Description                                   | Status  | Started | Completed | Verified By |
| ------- | --------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.1.2.1 | Create input sanitization library             | PENDING | --      | --        | --          |
| 2.1.2.2 | Patch all 17 verified injection vectors       | PENDING | --      | --        | --          |
| 2.1.2.3 | Replace hostExec with execFile where possible | PENDING | --      | --        | --          |
| 2.1.2.4 | Fix sudoers wildcards                         | PENDING | --      | --        | --          |
| 2.1.2.5 | Verification                                  | PENDING | --      | --        | --          |
