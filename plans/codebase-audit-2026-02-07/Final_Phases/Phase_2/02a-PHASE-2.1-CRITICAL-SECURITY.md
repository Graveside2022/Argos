# Phase 2.1: Critical Security -- Immediate Remediation (Corrected)

**Risk Level**: HIGH -- These are exploitable vulnerabilities in a system that controls RF hardware
**Prerequisites**: Phase 0 (file structure must be stable before security patches)
**Parallel-safe with**: Phase 1
**Blocks**: Phase 2.2 (systematic hardening depends on foundational security primitives)
**Standards**: OWASP Top 10 (2021), CERT C STR02-C (adapted for TypeScript), NIST SP 800-53 AC-3, DISA STIG Application Security

**Verification Date**: 2026-02-07
**Verification Method**: All file paths confirmed with `test -f`. All line numbers confirmed with `grep -n`. All counts confirmed with `wc -l`. No claims are estimated.

---

## Threat Model

This system:

- Runs on a Raspberry Pi 5 in a tactical environment
- Controls SDR hardware (HackRF One) capable of transmitting RF signals
- Scans and records WiFi networks, IMSI identifiers, and RF spectrum data
- Operates on a local network segment with other military systems

**Threat actors**:

1. **Adjacent network attacker**: Any device on the same network segment can access all API endpoints (no authentication)
2. **Compromised adjacent system**: If another system on the tactical network is compromised, Argos is fully exploitable
3. **Physical access attacker**: Device is field-deployed; physical access provides full system access

**Verified attack surface**:

- **114** API endpoint files with zero authentication (`find src/routes/api/ -name "+server.ts" | wc -l`)
- WebSocket connections with **zero** authentication or origin checking
- **110** `hostExec()` calls across 14 files, many with template literal interpolation
- **15** CORS wildcard endpoints allowing cross-origin requests from any domain (corrected from 14)
- **3 CRITICAL** command injection vectors (2 missed by original plan)
- **21** hardcoded credential locations (corrected from 14)
- **7** debug/test endpoints exposing internal system state

### Trust Boundary Diagram (REGRADE ADDITION -- B1)

**Required by**: NIST SP 800-53 RA-3 (Risk Assessment)

The following trust boundary diagram must be created as part of Phase 2.1 execution and maintained as a living document:

```
+--[ UNTRUSTED: Tactical Network ]------------------------------------------+
|                                                                            |
|  [Browser Client]  <-- CORS, CSP, API key in header                       |
|  [Adjacent Systems] <-- Network segment peers, potentially hostile         |
|  [Rogue Devices]    <-- WiFi/BT devices detected by sensors               |
|                                                                            |
+====[TRUST BOUNDARY 1: Network -> Application]=====+=======================+
|                                                    |
|  +--[ SvelteKit Application Layer ]-------------+  |
|  |  HTTP API (114 endpoints)    <-- Auth gate    |  |
|  |  WebSocket Server            <-- Auth gate    |  |
|  |  SSE Streaming endpoints     <-- Auth gate    |  |
|  +----------------------------------------------+  |
|                                                    |
+====[TRUST BOUNDARY 2: Application -> OS/HW]=======+
|                                                    |
|  +--[ System Services (localhost) ]-------------+  |
|  |  Kismet (port 2501)     <-- service creds    |  |
|  |  Bettercap              <-- service creds    |  |
|  |  GSM Evil               <-- no auth          |  |
|  |  gpsd (port 2947)       <-- no auth          |  |
|  |  HackRF backend (8092)  <-- no auth          |  |
|  |  OpenWebRX (8073)       <-- admin creds      |  |
|  +----------------------------------------------+  |
|                                                    |
+====[TRUST BOUNDARY 3: OS -> Hardware]==============+
|                                                    |
|  +--[ Hardware/Firmware ]------------------------+  |
|  |  HackRF One (USB)  <-- RF transmit capable   |  |
|  |  WiFi Adapter (USB) <-- monitor mode          |  |
|  |  GPS Module (serial) <-- position data        |  |
|  |  Bluetooth (HCI)    <-- BLE scanning          |  |
|  +----------------------------------------------+  |
|                                                    |
+====[TRUST BOUNDARY 4: Hardware -> RF Environment]==+
|                                                    |
|  RF spectrum, WiFi frames, GSM signals, GPS        |
|  All external RF input is UNTRUSTED                |
|                                                    |
+====================================================+
```

**Key architectural decisions**:

1. Trust Boundary 1 is the primary defense layer (API key auth, input validation, rate limiting)
2. Trust Boundary 2 requires service credentials -- localhost is NOT a trust boundary (regrade A3)
3. Trust Boundary 3 assumes firmware is trusted (hardware verification is out of scope for Phase 2)
4. All data crossing any boundary must be validated (input sanitization library, Zod schemas)

### Key Rotation Procedure (REGRADE ADDITION -- B5)

**Required by**: NIST SP 800-53 IA-5 (Authenticator Management)

The following key rotation procedure must be documented and tested as part of Phase 2.1:

1. **ARGOS_API_KEY rotation**:
    - Generate new key: `openssl rand -hex 32`
    - Update `.env` file on the RPi
    - Restart Argos service: `sudo systemctl restart argos-dev`
    - Update any client configurations (browser bookmarks, scripts)
    - Verify old key returns 401: `curl -H "X-API-Key: OLD_KEY" .../api/health`
    - Rotation frequency: Every 90 days or immediately upon suspected compromise

2. **Service credential rotation** (Kismet, Bettercap, OpenWebRX):
    - Update credentials in `.env` file
    - Restart affected services via Docker Compose
    - Verify services reconnect with new credentials

3. **API key compromise response**:
    - Immediately generate and deploy new key (step 1 above)
    - Review access logs for unauthorized access during compromise window
    - If RF transmission occurred, report to range safety officer
    - Document incident in security log

---

## Task 2.1.1: Implement API Authentication (CRITICAL)

**Current state**: Every API endpoint in `src/routes/api/` is completely unauthenticated. There are ZERO checks for authorization, session tokens, API keys, or any form of access control. Any device on the network can control all hardware.

### Subtask 2.1.1.1: Create Authentication Middleware

**Create**: `src/lib/server/auth/auth-middleware.ts`

```typescript
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
	return timingSafeEqual(apiKey, expectedKey);
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

**NOTE**: The `isLocalhostRequest()` function is removed. Localhost is NOT a trust boundary -- any service on the RPi (Kismet, Bettercap, gpsd, GSM Evil) could be compromised and abuse a localhost fallback to access all Argos endpoints. The API key is the sole authentication mechanism. (NASA/JPL Power of Ten Rule 1: simple, verifiable control flow.)

### Subtask 2.1.1.2: Apply Authentication to SvelteKit Hooks

**File**: `src/hooks.server.ts` (EXISTS, verified)

Add request validation in the `handle` function for all `/api/` routes:

```typescript
if (event.url.pathname.startsWith('/api/') && event.url.pathname !== '/api/health') {
	if (!validateApiKey(event.request)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
```

### Subtask 2.1.1.3: Categorize API Endpoints by Sensitivity

**Verified**: 114 endpoint files across 32 API directories:

| Category                        | Directories                                                                                                                             | Endpoint Count | Auth Level           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------- |
| **CRITICAL** (hardware control) | hackrf/ (16), kismet/ (20), gsm-evil/ (12), droneid/ (1), rf/ (6)                                                                       | 55             | API key required     |
| **HIGH** (system commands)      | system/ (1), hardware/ (1), openwebrx/ (1), bettercap/ (3), wifite/ (4), btle/ (3), pagermon/ (3), rtl-433/ (2)                         | 18             | API key required     |
| **MEDIUM** (data read)          | agent/ (5), weather/ (1), cell-towers/ (1), gps/ (1), signals/ (1), tactical-map/ (1), devices/ (1), relationships/ (1), wireshark/ (1) | 14             | API key required     |
| **LOW** (health/debug)          | debug/ (1), test/ (1), test-db/ (1), tools/ (1), companion/ (1), db/ (1)                                                                | 6              | API key required     |
| **EXEMPT**                      | /api/health (to be created)                                                                                                             | 1              | No auth (monitoring) |

### Subtask 2.1.1.4: Create `.env.example` with Auth Configuration

```env
# Authentication (REQUIRED -- system will not start without this)
ARGOS_API_KEY=                    # REQUIRED. Min 32 chars. Generate with: openssl rand -hex 32
# NOTE: There is no localhost-only mode. API key is always required. (Regrade A3: fail-closed)

# Service Credentials (CHANGE ALL DEFAULTS)
KISMET_USER=admin
KISMET_PASSWORD=                  # REQUIRED -- no default
BETTERCAP_PASSWORD=               # REQUIRED -- no default
OPENWEBRX_PASSWORD=               # REQUIRED -- no default
OPENCELLID_API_KEY=               # REQUIRED -- no default
```

### Subtask 2.1.1.5: Verification

```bash
# Must return 401:
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/system/info
# Must return 200:
curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info
# Health endpoint always returns 200:
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health
```

---

## Task 2.1.2: Eliminate ALL Shell Command Injection Vectors

**Current state**: 110 instances of `hostExec()` usage across 14 files codebase-wide. 121 exec-related calls across 32 API route files. User-supplied parameters are interpolated directly into shell command strings via template literals in multiple locations.

### Subtask 2.1.2.1: Create Input Sanitization Library

**Create**: `src/lib/server/security/input-sanitizer.ts`

```typescript
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

export function validateMacAddress(value: unknown): string {
	if (typeof value !== 'string' || !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value)) {
		throw new InputValidationError(`Invalid MAC address format: ${String(value)}`);
	}
	return value;
}

export function validateInterfaceName(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,15}$/.test(value)) {
		throw new InputValidationError(`Invalid interface name: ${String(value)}`);
	}
	return value;
}

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

export class InputValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InputValidationError';
	}
}
```

### Subtask 2.1.2.2: Patch ALL Verified Injection Vectors

**CORRECTED**: The original plan listed 21 files, 7 of which used phantom `[action]` dynamic routes that do not exist. The actual route structure uses named subdirectories (e.g., `control/`, `scan/`, `status/`). Several route files delegate command execution to `processManager.ts` files in `src/lib/server/`.

**Verified injection vectors (files with user-supplied params in shell commands):**

**REGRADE CORRECTIONS (A1, A2)**: Two CRITICAL injection vectors were missed by the original plan. One false positive (rtl-433) has been removed. The corrected severity breakdown is: **3 CRITICAL, 4 HIGH, ~15 MEDIUM** (original plan claimed 13 total with no severity breakdown).

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

**REMOVED -- FALSE POSITIVE (A2):**
| ~~11~~ | ~~`api/rtl-433/control/+server.ts`~~ | ~~50, 52~~ | ~~`${frequency}`, `${sampleRate}`~~ | ~~Request body~~ | ~~REMOVED: Uses `spawn('rtl_433', ['-f', freq])` with array args -- no shell invocation. Each argument is a separate argv element with no shell interpretation. This is safe.~~ |

**Injection vectors in server-side process managers (NOT in route files):**

| #   | File                                        | Line(s)      | Severity | Interpolated Param                                                                                  | Fix                                                                |
| --- | ------------------------------------------- | ------------ | -------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 13  | `src/lib/server/pagermon/processManager.ts` | 33-38        | HIGH     | `${freqHz}`, `${sampleRate}`, `${gain}` from user config, passed to `spawn('sh', ['-c', template])` | `validateNumericParam` for all; replace with `execFile` (no shell) |
| 14  | `src/lib/server/wifite/processManager.ts`   | 160, 327-328 | HIGH     | BSSID values from user input in `script -qec` (shell)                                               | `validateMacAddress` for each BSSID                                |

**Additional injection vectors found by regrade (Section 1.1):**

| #   | File                                         | Line(s)            | Severity | Interpolated Param                                          | Fix                                                                                 |
| --- | -------------------------------------------- | ------------------ | -------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 15  | `src/routes/api/droneid/+server.ts`          | 23, 184-227        | HIGH     | PID from file read interpolated into kill command           | `validateNumericParam(pid, 'pid', 1, 4194304)`                                      |
| 16  | `src/lib/server/kismet/kismet_controller.ts` | 227-286            | HIGH     | Interface name from env var interpolated into sudo commands | `validateInterfaceName()` -- env vars can be manipulated                            |
| 17  | `src/lib/server/db/dbOptimizer.ts`           | 276, 279, 294, 305 | LOW      | SQL template literals (internal callers only)               | Parameterize SQL queries; even internal callers should not pass unsanitized strings |

**Files verified as safe (no user-param interpolation):**

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

### Subtask 2.1.2.3: Replace hostExec Template Literals with Parameterized Execution

Where possible, replace:

```typescript
// BEFORE (vulnerable):
await hostExec(`grgsm_livemon_headless -f ${freq}M -g ${gain}`);

// AFTER (safe):
await execFile('grgsm_livemon_headless', ['-f', `${validatedFreq}M`, '-g', String(validatedGain)]);
```

`execFile` does not invoke a shell and is immune to shell injection. Use it for all cases where the command and arguments can be separated. Reserve `hostExec`/`exec` only for cases requiring shell features (pipes, redirects), and in those cases, ensure ALL interpolated values pass validation.

### Subtask 2.1.2.4: Fix Sudoers Wildcards

**File**: `scripts/setup-droneid-sudoers.sh` (EXISTS, verified)

| Line | Current                                                           | Problem              | Fix                                |
| ---- | ----------------------------------------------------------------- | -------------------- | ---------------------------------- |
| 22   | `ubuntu ALL=(ALL) NOPASSWD: /bin/kill *`                          | Can kill ANY process | Restrict to specific process names |
| 23   | `ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh` | Execution from /tmp  | Move script to /usr/local/bin/     |
| 32   | `node ALL=(ALL) NOPASSWD: /bin/kill *`                            | Same as line 22      | Restrict to specific process names |
| 33   | `node ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh`   | Same as line 23      | Move script to /usr/local/bin/     |

### Subtask 2.1.2.5: Verification

```bash
# 1. No unvalidated template literal injection remains
grep -rn 'hostExec(`.*\${' src/ --include="*.ts" | wc -l
# Expected: 0 (all replaced with validated inputs or execFile)

# 2. Build passes
npm run typecheck && npm run build

# 3. Manual test: invalid input rejected
curl -X POST http://localhost:5173/api/gsm-evil/control \
  -H "X-API-Key: $ARGOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "frequency": "$(rm -rf /)"}'
# Expected: 400 with validation error, NOT command execution
```

---

## Task 2.1.3: Remove ALL Hardcoded Credentials

**Current state**: **21 unique credential locations** across source, config, Docker, and scripts.

**REGRADE CORRECTION (B7)**: The original plan identified 14 credentials (9 source + 3 Docker + 2 scripts). The regrade audit found **21 total** -- 7 additional locations were missed. All 21 are listed below.

### Subtask 2.1.3.1: Source Code Credentials (8 instances -- unchanged)

| #   | File:Line                                              | Current Value                                                | Verified | Fix                                                |
| --- | ------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------- |
| 1   | `src/routes/api/agent/tools/+server.ts:18`             | `KISMET_PASSWORD \|\| 'password'`                            | YES      | Remove `\|\| 'password'` fallback                  |
| 2   | `src/routes/api/agent/tools/+server.ts:138`            | `KISMET_PASSWORD \|\| 'password'`                            | YES      | Remove fallback                                    |
| 3   | `src/routes/api/agent/tools/+server.ts:240`            | `KISMET_PASSWORD \|\| 'password'`                            | YES      | Remove fallback                                    |
| 4   | `src/routes/api/kismet/control/+server.ts:134`         | `username=admin&password=password` in curl                   | YES      | Use env vars `$KISMET_USER` and `$KISMET_PASSWORD` |
| 5   | `src/lib/server/kismet/fusion_controller.ts:46`        | `restPassword: process.env.KISMET_PASSWORD \|\| 'password'`  | YES      | Remove `\|\| 'password'` fallback                  |
| 6   | `src/routes/api/gsm-evil/tower-location/+server.ts:52` | `apiKey = 'pk.d6291c07a2907c915cd8994fb22bc189'`             | YES      | Move to `process.env.OPENCELLID_API_KEY`           |
| 7   | `src/routes/api/cell-towers/nearby/+server.ts:7`       | `OPENCELLID_API_KEY = 'pk.d6291c07a2907c915cd8994fb22bc189'` | YES      | Move to `process.env.OPENCELLID_API_KEY`           |
| 8   | `src/routes/api/openwebrx/control/+server.ts:98`       | `OPENWEBRX_ADMIN_PASSWORD=admin` in docker run               | YES      | Use `process.env.OPENWEBRX_PASSWORD`               |

### Subtask 2.1.3.2: Client-Side Credentials (REGRADE -- 1 NEW instance)

| #     | File:Line                                                  | Current Value                                        | Verified    | Fix                                                                                                                                                    |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **9** | **`src/lib/components/dashboard/DashboardMap.svelte:599`** | **Stadia Maps API key embedded in client-side code** | **REGRADE** | **Move to server-side proxy; API key must never be in browser-delivered JavaScript. This is a paid service key visible in page source to every user.** |

### Subtask 2.1.3.3: Config File Credentials (REGRADE -- 1 NEW instance)

| #      | File:Line                      | Current Value                                  | Verified    | Fix                                                                                |
| ------ | ------------------------------ | ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **10** | **`config/opencellid.json:2`** | **OpenCellID API key (git-tracked JSON file)** | **REGRADE** | **Move to .env; add config/opencellid.json to .gitignore; rotate the exposed key** |

### Subtask 2.1.3.4: Docker Compose Credentials (3 instances -- unchanged)

**File**: `docker/docker-compose.portainer-dev.yml` (EXISTS, verified)

| #   | Line | Current                                                  | Fix                                                               |
| --- | ---- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 11  | 42   | `KISMET_PASSWORD=password`                               | `KISMET_PASSWORD=${KISMET_PASSWORD:?Set KISMET_PASSWORD in .env}` |
| 12  | 121  | `OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:-hackrf}` | `${OPENWEBRX_PASSWORD:?Set OPENWEBRX_PASSWORD in .env}`           |
| 13  | 156  | `BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:-argos}`    | `${BETTERCAP_PASSWORD:?Set BETTERCAP_PASSWORD in .env}`           |

### Subtask 2.1.3.5: Shell Script Credentials (REGRADE EXPANDED -- 8 instances, was 2)

| #      | File:Line                                         | Current Value                      | Verified    | Fix                                         |
| ------ | ------------------------------------------------- | ---------------------------------- | ----------- | ------------------------------------------- |
| 14     | `scripts/configure-openwebrx-b205.sh:21-135`      | `OWRX_ADMIN_PASSWORD = 'argos123'` | YES         | Read from env var or prompt                 |
| 15     | `scripts/final-usrp-setup.sh:45,95`               | `"password": "admin"`              | YES         | Read from env var or config file            |
| **16** | **`scripts/download-opencellid-full.sh:6`**       | **OpenCellID API key hardcoded**   | **REGRADE** | **Read from env var `$OPENCELLID_API_KEY`** |
| **17** | **`scripts/setup-opencellid-full.sh:4`**          | **OpenCellID API key hardcoded**   | **REGRADE** | **Read from env var `$OPENCELLID_API_KEY`** |
| **18** | **`scripts/configure-usrp-immediate.sh:26-111`**  | **OpenWebRX admin:admin**          | **REGRADE** | **Read from env var**                       |
| **19** | **`scripts/install-openwebrx-hackrf.sh:209-210`** | **OpenWebRX admin:hackrf**         | **REGRADE** | **Read from env var**                       |
| **20** | **`scripts/create-ap-simple.sh:42,50`**           | **WiFi AP password hardcoded**     | **REGRADE** | **Read from env var or config file**        |
| **21** | **`scripts/fix-argos-ap-mt7921.sh:86`**           | **WiFi AP password hardcoded**     | **REGRADE** | **Read from env var or config file**        |

**Root cause of missed credentials**: The original plan searched `src/` for `'password'` patterns. It did not search `config/`, `scripts/`, or `.svelte` files for API keys, nor did it search for `admin:` patterns in shell scripts.

### Subtask 2.1.3.6: Create `docker/.env.example`

```env
# Argos Service Credentials
# CHANGE ALL VALUES before deployment
KISMET_USER=admin
KISMET_PASSWORD=
BETTERCAP_PASSWORD=
OPENWEBRX_PASSWORD=
OPENCELLID_API_KEY=
ARGOS_API_KEY=
```

### Subtask 2.1.3.7: Remove Unauthenticated Deploy Server

**File**: `scripts/deploy-master.sh` (EXISTS, verified)

Lines 347-368 implement a netcat HTTP server on port 8099 with:

- No authentication
- Wildcard CORS (`Access-Control-Allow-Origin: *`)
- Serves deployment status to any requester

**Action**: Delete the netcat server function entirely. Deployment status should be accessible only via authenticated API or system logs.

### Subtask 2.1.3.8: Verification

```bash
# 1. No hardcoded passwords in source
grep -rn "'password'" src/ --include="*.ts" | grep -v "node_modules\|\.d\.ts\|security_analyzer" | wc -l
# Expected: 0

# 2. No hardcoded API keys
grep -rn "pk\." src/ --include="*.ts" | grep -v "node_modules\|process\.env" | wc -l
# Expected: 0

# 3. Docker compose uses required env vars
grep -c ':-\|=password\|=admin\|=hackrf\|=argos' docker/docker-compose.portainer-dev.yml
# Expected: 0
```

---

## Task 2.1.4: Eliminate SSRF Vulnerabilities

### Subtask 2.1.4.1: Fix HackRF Proxy Catch-All

**File**: `src/routes/api/hackrf/[...path]/+server.ts` (EXISTS, verified)

This file acts as an open HTTP proxy to localhost:3002. Any path is accepted and forwarded. While the proxy only reaches localhost, the path parameter is unvalidated.

**Fix**: Replace open proxy with explicit endpoint allowlist:

```typescript
const ALLOWED_PATHS = [
	'status',
	'start-sweep',
	'stop-sweep',
	'device-info',
	'data-stream',
	'cycle-frequency',
	'emergency-stop'
] as const;

if (!ALLOWED_PATHS.includes(path as any)) {
	return json({ error: 'Endpoint not allowed' }, { status: 404 });
}
```

### Subtask 2.1.4.2: Validate External API Parameters

For `api/gsm-evil/tower-location/+server.ts` and `api/cell-towers/nearby/+server.ts`:

- Validate latitude: `validateNumericParam(lat, 'latitude', -90, 90)`
- Validate longitude: `validateNumericParam(lon, 'longitude', -180, 180)`
- Validate radius: `validateNumericParam(radius, 'radius', 0.1, 50)`

---

## Task 2.1.5: Fix Sensitive Data Exposure

### Subtask 2.1.5.1: Remove Stack Traces from Error Responses

**REGRADE CORRECTION**: Only **2 of 5 instances** are genuinely client-facing (returned in HTTP JSON response bodies). The other 3 are console-only (server-side logging). The plan originally classified all 5 as client-facing.

**Client-facing exposures (MUST fix -- leaks internal paths to HTTP clients):**

| #   | File:Line                              | Exposure Pattern                                                       | Fix                                   |
| --- | -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| 1   | `api/hackrf/debug-start/+server.ts:41` | `stack: (cycleError as { stack?: string }).stack` in **JSON response** | Return generic error, log server-side |
| 2   | `api/hackrf/debug-start/+server.ts:52` | `stack: (error as { stack?: string }).stack` in **JSON response**      | Return generic error, log server-side |

**Console-only exposures (SHOULD fix -- not a direct client risk, but remove in production):**

| #   | File:Line                              | Exposure Pattern                                          | Fix                                                                       |
| --- | -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| 3   | `api/hackrf/debug-start/+server.ts:35` | `console.error('[debug-start] Error stack:', ... .stack)` | Server-side only; restrict to dev mode or remove                          |
| 4   | `api/hackrf/data-stream/+server.ts:89` | `logDebug(... error.stack ...)`                           | **CORRECTED**: This is `logDebug` (server log), NOT in JSON response      |
| 5   | `api/signals/+server.ts:36`            | `console.error('Stack trace:', ... .stack)`               | **CORRECTED**: This is `console.error` (server log), NOT in JSON response |

**Additional finding from regrade**: 67 API endpoints return `error.message` directly in JSON responses. While not stack traces, error messages can reveal internal file paths, database schema details, process names, and network topology. These should be replaced with generic error messages, with the original error logged server-side.

### Subtask 2.1.5.2: Create Standard Error Response Helper

```typescript
// src/lib/server/security/error-response.ts
export function safeErrorResponse(status: number, publicMessage: string): Response {
	return new Response(JSON.stringify({ error: publicMessage }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}
```

### Subtask 2.1.5.3: Verification

```bash
# No stack traces in JSON responses
grep -rn "stack:" src/routes/ --include="*.ts" | grep -v "node_modules\|// \|import\|type " | wc -l
# Expected: 0
```

---

## Task 2.1.6: WebSocket Authentication and Security (REGRADE ADDITION -- A5, A6)

**REGRADE FINDING**: The plan adds API key authentication to HTTP endpoints but **completely ignores WebSocket connections**. This is a CRITICAL gap: an attacker on the tactical network can receive all real-time RF data, WiFi device tracking, IMSI captures, and GPS positions via WebSocket without any authentication, even after the plan's HTTP auth is implemented.

**Standard violated**: NIST SP 800-53 AC-3 (Access Enforcement), OWASP A01:2021 (Broken Access Control)

### Subtask 2.1.6.1: Add Authentication to WebSocket Server

**File**: `src/lib/server/websocket-server.ts`

Add `verifyClient` callback to the WebSocket server that validates the API key before accepting the connection:

```typescript
const wss = new WebSocketServer({
	// ... existing config
	verifyClient: (info, callback) => {
		const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
		const apiKey = url.searchParams.get('token') || (info.req.headers['x-api-key'] as string);
		// NOTE: For WebSocket, token in query string is acceptable because
		// the WS upgrade request is not logged like HTTP requests, and
		// there is no Referer header leak. This is standard practice (e.g., Socket.IO).
		if (!validateApiKey(apiKey)) {
			callback(false, 401, 'Unauthorized');
			return;
		}
		// Origin checking
		const origin = info.origin || info.req.headers.origin;
		if (origin && !ALLOWED_ORIGINS.includes(origin)) {
			callback(false, 403, 'Forbidden origin');
			return;
		}
		callback(true);
	}
});
```

### Subtask 2.1.6.2: Add Authentication to Kismet WebSocket

**File**: `src/hooks.server.ts` (WebSocket upgrade at `/api/kismet/ws`)
**File**: `src/lib/server/kismet/webSocketManager.ts`

Both must validate the API key before accepting WebSocket upgrade requests. The `webSocketManager.ts` currently accepts all connections without any validation.

### Subtask 2.1.6.3: Add maxPayload Limits (A6)

Add `maxPayload` limits to all WebSocket servers to prevent memory exhaustion attacks:

| File                  | Current maxPayload | Required maxPayload | Rationale                                 |
| --------------------- | ------------------ | ------------------- | ----------------------------------------- |
| `websocket-server.ts` | None (unlimited)   | **1MB** (1048576)   | RF data messages should not exceed 1MB    |
| `webSocketManager.ts` | None (unlimited)   | **256KB** (262144)  | Kismet messages are JSON, should be small |

```typescript
const wss = new WebSocketServer({
	maxPayload: 1048576 // 1MB -- messages exceeding this are rejected
	// ... other config
});
```

### Subtask 2.1.6.4: Verification

```bash
# 1. WebSocket without auth rejected
wscat -c ws://localhost:5173/ws 2>&1 | head -1
# Expected: error: Unexpected server response: 401

# 2. WebSocket with auth accepted
wscat -c "ws://localhost:5173/ws?token=$ARGOS_API_KEY" 2>&1 | head -1
# Expected: Connected

# 3. Oversized message rejected
python3 -c "
import websocket
ws = websocket.create_connection('ws://localhost:5173/ws?token=KEY')
ws.send('x' * 2000000)  # 2MB, exceeds 1MB limit
" 2>&1
# Expected: connection closed by server
```

---

## Task 2.1.7: Request Body Size Limits (REGRADE ADDITION -- A7)

**REGRADE FINDING**: No request body size limits exist anywhere. On an 8GB RPi running earlyoom, a single POST with a multi-GB body can trigger OOM killing. The plan's rate limiter limits request frequency but not request size.

### Subtask 2.1.7.1: Add Body Size Limits to hooks.server.ts

```typescript
// In the handle function, before any route processing:
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB general limit
const HARDWARE_BODY_LIMIT = 64 * 1024; // 64KB for hardware control endpoints

if (event.request.method === 'POST' || event.request.method === 'PUT') {
	const contentLength = parseInt(event.request.headers.get('content-length') || '0');
	const isHardwareEndpoint = event.url.pathname.match(
		/^\/api\/(hackrf|kismet|gsm-evil|rf|droneid|openwebrx|bettercap|wifite)\//
	);
	const limit = isHardwareEndpoint ? HARDWARE_BODY_LIMIT : MAX_BODY_SIZE;

	if (contentLength > limit) {
		return new Response(JSON.stringify({ error: 'Payload too large' }), {
			status: 413,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
```

### Subtask 2.1.7.2: Verification

```bash
# Large payload to hardware endpoint rejected
dd if=/dev/zero bs=65537 count=1 2>/dev/null | \
    curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "X-API-Key: $ARGOS_API_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @- http://localhost:5173/api/hackrf/start-sweep
# Expected: 413
```

---

## Execution Order

```
Step 1: Task 2.1.1 -- API Authentication (UPDATED per regrade A3, A4)
  2.1.1.1: Create auth middleware (fail-closed, header-only API key)
  2.1.1.2: Apply to hooks.server.ts (with startup validation)
  2.1.1.3: Categorize endpoints by sensitivity
  2.1.1.4: Create .env.example (API key REQUIRED, no localhost fallback)
  2.1.1.5: Verify
  COMMIT: security(phase2.1.1): add fail-closed API key authentication to all 114 endpoints

Step 2: Task 2.1.6 -- WebSocket Authentication (NEW per regrade A5, A6)
  2.1.6.1: Add verifyClient + origin checking to websocket-server.ts
  2.1.6.2: Add auth to Kismet WebSocket (hooks.server.ts, webSocketManager.ts)
  2.1.6.3: Add maxPayload limits to all WebSocket servers
  2.1.6.4: Verify
  COMMIT: security(phase2.1.6): add authentication and payload limits to all WebSocket endpoints

Step 3: Task 2.1.7 -- Request Body Size Limits (NEW per regrade A7)
  2.1.7.1: Add body size limits to hooks.server.ts
  2.1.7.2: Verify
  COMMIT: security(phase2.1.7): add request body size limits to prevent DoS

Step 4: Task 2.1.2 -- Shell Injection Elimination (UPDATED per regrade A1, A2)
  2.1.2.1: Create input sanitization library
  2.1.2.2: Patch 17 injection vectors (was 13; +2 CRITICAL, +2 additional, -1 false positive)
  2.1.2.3: Replace hostExec template literals where possible
  2.1.2.4: Fix sudoers wildcards
  2.1.2.5: Verify
  COMMIT: security(phase2.1.2): eliminate all shell injection vectors with input validation

Step 5: Task 2.1.3 -- Credential Removal (UPDATED per regrade B7)
  2.1.3.1: Remove 8 source code credentials
  2.1.3.2: Remove 1 client-side API key (DashboardMap.svelte)
  2.1.3.3: Remove 1 config file credential (opencellid.json)
  2.1.3.4: Fix 3 Docker compose credentials
  2.1.3.5: Fix 8 shell script credentials (was 2)
  2.1.3.6: Create .env.example
  2.1.3.7: Remove deploy server
  2.1.3.8: Verify
  COMMIT: security(phase2.1.3): remove all 21 hardcoded credentials, require env vars

Step 6: Task 2.1.4 -- SSRF Fixes
  2.1.4.1: Fix HackRF proxy
  2.1.4.2: Validate external API params
  COMMIT: security(phase2.1.4): eliminate SSRF vectors with path allowlist and param validation

Step 7: Task 2.1.5 -- Data Exposure Fixes (UPDATED with corrected counts)
  2.1.5.1: Remove 2 client-facing stack trace exposures (was 5; 3 reclassified as console-only)
  2.1.5.2: Create error response helper
  2.1.5.3: Verify
  COMMIT: security(phase2.1.5): remove stack traces from client error responses
```

---

## Verification Checklist (Phase 2.1 Complete)

```bash
# 1. Authentication works (fail-closed)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/system/info
# Expected: 401

# 2. No API key accepted via query string
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/system/info?api_key=$ARGOS_API_KEY"
# Expected: 401 (query string NOT accepted per regrade A4)

# 3. API key accepted only via header
curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info
# Expected: 200

# 4. System refuses to start without API key
ARGOS_API_KEY="" npm run dev 2>&1 | head -5
# Expected: FATAL error about missing API key, process exits

# 5. WebSocket without auth rejected (NEW -- regrade A5)
wscat -c ws://localhost:5173/ws 2>&1 | head -1
# Expected: error: Unexpected server response: 401

# 6. WebSocket with auth accepted (NEW -- regrade A5)
wscat -c "ws://localhost:5173/ws?token=$ARGOS_API_KEY" 2>&1 | head -1
# Expected: Connected

# 7. No hardcoded passwords remain (expanded search per regrade B7)
grep -rn "'password'" src/ --include="*.ts" --include="*.svelte" | grep -v "node_modules\|\.d\.ts\|security_analyzer" | wc -l
# Expected: 0

# 8. No hardcoded API keys remain (expanded search per regrade B7)
grep -rn "pk\." src/ config/ --include="*.ts" --include="*.json" --include="*.svelte" | grep -v "node_modules\|process\.env" | wc -l
# Expected: 0

# 9. No hardcoded credentials in scripts (NEW -- regrade B7)
grep -rn "password\|admin:admin\|argos123\|hackrf" scripts/ --include="*.sh" | grep -v ':-\|:?\|process\.env\|#' | wc -l
# Expected: 0

# 10. No template literal injection in shell commands
grep -rn 'hostExec(`.*\${' src/ --include="*.ts" | wc -l
# Expected: 0

# 11. No execAsync with template interpolation (NEW -- catches missed CRITICAL vectors)
grep -rn 'execAsync(`.*\${' src/ --include="*.ts" | wc -l
# Expected: 0

# 12. No stack traces in JSON responses
grep -rn "stack:" src/routes/ --include="*.ts" | grep -v "node_modules\|// \|import\|type \|console\." | wc -l
# Expected: 0

# 13. Large payload rejected (NEW -- regrade A7)
dd if=/dev/zero bs=65537 count=1 2>/dev/null | \
    curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/octet-stream" \
    --data-binary @- http://localhost:5173/api/hackrf/start-sweep
# Expected: 413

# 14. Build and tests pass
npm run typecheck && npm run build && npm run test:unit

# 15. Manual test: invalid input rejected
curl -X POST http://localhost:5173/api/gsm-evil/control \
  -H "X-API-Key: $ARGOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "frequency": "$(rm -rf /)"}'
# Expected: 400 with validation error
```

---

## Risk Assessment

| Task                                    | Risk                                                                          | Mitigation                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 2.1.1 Auth middleware (fail-closed)     | MEDIUM -- system will not start without API key; could break existing scripts | .env.example with key generation command; update all deployment scripts; test startup validation |
| 2.1.2 Injection fixes                   | LOW -- validation may reject valid edge-case inputs                           | Test with real hardware parameters; wide numeric bounds                                          |
| 2.1.3 Credential removal (21 instances) | MEDIUM -- services will fail if env vars not set                              | .env.example documents all required vars; startup validation                                     |
| 2.1.4 SSRF fixes                        | LOW -- may break valid proxy paths not in allowlist                           | Add paths to allowlist as discovered                                                             |
| 2.1.5 Error sanitization                | ZERO -- only removes info from client responses                               | Full errors still logged server-side                                                             |
| 2.1.6 WebSocket auth (NEW)              | HIGH -- breaks all existing WebSocket clients                                 | Frontend WebSocket connections must pass token; test real-time data flow end-to-end              |
| 2.1.7 Body size limits (NEW)            | LOW -- legitimate requests are small                                          | Hardware endpoints: 64KB limit; general: 10MB limit; monitor for false positives                 |

---

## Corrections Applied (2026-02-07)

| Finding                      | Original                           | Corrected                                                     |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Phantom [action] route files | 7 files listed that don't exist    | Replaced with actual route file paths                         |
| hostExec count               | 96                                 | 110 across 14 files                                           |
| API route files with exec    | 21                                 | 32 (but only 13 have user-param interpolation)                |
| Total API endpoints          | "50+"                              | 114                                                           |
| Stack trace exposure         | 1 instance                         | 5 instances in 3 files                                        |
| Missing credential           | --                                 | Added cell-towers/nearby/+server.ts:7                         |
| Injection table              | Mixed route and non-existent files | Separated into verified route vectors and server-side vectors |
| Process manager delegation   | Not acknowledged                   | Documented which routes delegate to processManager.ts         |

---

## Regrade Adjustments Applied (2026-02-08)

**Source**: `FINAL-AUDIT-REPORT-PHASE-2-REGRADE.md` (Independent regrade by 5 parallel verification sub-agents)

### Priority 1 Changes (Immediate -- applied to this file)

| Regrade ID | Change                                                                                                                                                                                                     | Section Affected                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **A1**     | Added 2 CRITICAL injection vectors: `cell-towers/+server.ts` (Python code injection via GET params) and `usrp-power/+server.ts` (shell injection via POST body)                                            | Task 2.1.2, injection vector table            |
| **A2**     | Removed `rtl-433/control/+server.ts` false positive -- uses `spawn()` with array args, not shell                                                                                                           | Task 2.1.2, moved to "Files verified as safe" |
| **A3**     | Changed auth middleware from fail-open (localhost fallback) to **fail-closed** (refuse to start without API key). Removed `isLocalhostRequest()` function. Added `validateSecurityConfig()` startup check. | Task 2.1.1                                    |
| **A4**     | Removed API key acceptance from query string. `X-API-Key` header only.                                                                                                                                     | Task 2.1.1                                    |
| **A5**     | Added **Task 2.1.6**: WebSocket authentication for `websocket-server.ts`, `hooks.server.ts`, `webSocketManager.ts`                                                                                         | New task                                      |
| **A6**     | Added maxPayload limits to WebSocket servers (1MB main, 256KB Kismet)                                                                                                                                      | Task 2.1.6 subtask                            |
| **A7**     | Added **Task 2.1.7**: Request body size limits in `hooks.server.ts` (64KB hardware, 10MB general)                                                                                                          | New task                                      |

### Priority 2 Changes (Required for compliance -- applied to this file)

| Regrade ID | Change                                                                                                                                                      | Section Affected                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **B1**     | Added trust boundary diagram with 4 boundary layers                                                                                                         | Threat Model section                 |
| **B5**     | Added key rotation procedure for API key and service credentials                                                                                            | Threat Model section                 |
| **B7**     | Expanded credential removal from 14 to **21 instances** -- added client-side Stadia Maps key, config/opencellid.json, 6 additional shell script credentials | Task 2.1.3 (all subtasks renumbered) |

### Data Accuracy Corrections

| Metric                                | Previous Plan Value | Regrade-Corrected Value                                        |
| ------------------------------------- | ------------------- | -------------------------------------------------------------- |
| Injection vectors (CRITICAL)          | 1                   | **3** (+2 missed)                                              |
| Injection vectors (total w/ severity) | 13 (no severity)    | **3 CRITICAL + 4 HIGH + ~15 MEDIUM**, 1 false positive removed |
| Hardcoded credentials                 | 14                  | **21** (+7 missed)                                             |
| Stack traces (client-facing)          | 5                   | **2** (3 reclassified as console-only)                         |
| CORS wildcards                        | 14                  | **15** (+1 Express cors() in gsm-evil/server.ts)               |
| WebSocket endpoints with auth         | Not assessed        | **0** (CRITICAL gap)                                           |
| Phase 2.1 tasks                       | 5                   | **7** (+2 new tasks: 2.1.6 WebSocket, 2.1.7 Body limits)       |
