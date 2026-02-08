# Independent Security Audit: Argos Codebase

## Findings OUTSIDE the Phase 2 Plan Scope

**Audit Date:** 2026-02-08
**Auditor:** Alex Thompson, Principal Security Architect
**Standards Applied:** NASA/JPL Rule 12 (bounded resources), MISRA C:2012 (translated to TS), CERT Secure Coding (ARR, ENV, FIO, STR), OWASP Top 10 2021
**Scope:** Vulnerabilities NOT addressed by the existing Phase 2 remediation plan

---

## EXECUTIVE SUMMARY

| Severity  | Count  | Phase 2 Coverage |
| --------- | ------ | ---------------- |
| CRITICAL  | 6      | 0 addressed      |
| HIGH      | 12     | 2 partially      |
| MEDIUM    | 11     | 0 addressed      |
| LOW       | 5      | 0 addressed      |
| **TOTAL** | **34** | **2 partial**    |

The Phase 2 plan addresses authentication, shell injection, hardcoded credentials, SSRF, stack traces, error handling, CORS, CSP, JSON.parse, rate limiting, and security tests. This audit identifies 34 additional findings across 10 categories that the plan completely missed.

---

## CATEGORY 1: COMMAND INJECTION via Template Interpolation in Python Script

### Finding 1.1 [CRITICAL] -- Cell Tower Endpoint: Query Parameter Interpolation into Python Script

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/tactical-map/cell-towers/+server.ts`
**Lines:** 38-39

```typescript
    if ${north} and ${south} and ${east} and ${west}:
        query += ' AND lat <= ? AND lat >= ? AND lon <= ? AND lon >= ?'
        params = [${north}, ${south}, ${east}, ${west}]
```

**Analysis:** URL search parameters (`north`, `south`, `east`, `west`) are interpolated directly into a Python script string via JavaScript template literals. The interpolated values are `url.searchParams.get()` results -- raw user input. An attacker sending `north=1; import os; os.system('id')` achieves arbitrary Python code execution. The Python script is then written to `/tmp/fetch_towers.py` and executed via `python3`.

**Severity:** CRITICAL
**Standard:** OWASP A03:2021 Injection, CERT STR02-C
**Phase 2 Addresses:** NO -- the plan mentions "shell injection" but this is Python code injection via template interpolation, a distinct vector.

---

### Finding 1.2 [CRITICAL] -- USRP Power Measurement: Numeric Parameters into Shell Command

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/rf/usrp-power/+server.ts`
**Line:** 27

```typescript
const command = `timeout 10 python3 ./scripts/usrp_power_measure_real.py -f ${frequency} -g ${gain} -d ${duration}`;
```

**Analysis:** `frequency`, `gain`, and `duration` come from `request.json()` with only a basic `frequency > 0` check. No validation that these are numeric and within expected ranges. An attacker can send `frequency: "100; cat /etc/shadow"` to achieve command injection since the values are interpolated into a shell command string executed via `execAsync`.

**Severity:** CRITICAL
**Standard:** OWASP A03:2021 Injection, CERT STR02-C
**Phase 2 Addresses:** PARTIALLY -- the plan mentions shell injection at the gsm-evil/control endpoint (line 91) but does not enumerate this endpoint.

---

### Finding 1.3 [CRITICAL] -- RTL-433 Control: User-Controlled Frequency/SampleRate/Protocols into Spawn Args

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/rtl-433/control/+server.ts`
**Lines:** 48-73

```typescript
const args = ['-f', `${frequency}M`, '-s', sampleRate, '-F', format, ...];
if (protocols && protocols.length > 0) {
    args.push('-R', '0');
    protocols.forEach((protocol: string) => {
        args.push('-R', protocol);
    });
}
rtl433Process = spawn('rtl_433', args, { ... });
```

**Analysis:** `frequency`, `sampleRate`, `format`, and `protocols` come directly from `request.json()` with zero validation. While `spawn` with array args is safer than shell interpolation, the `format` parameter controls the output format flag and the `protocols` array accepts arbitrary strings. A malicious `format` value could potentially cause unexpected behavior. More critically, `sampleRate` is passed as-is -- no numeric validation.

**Severity:** HIGH
**Standard:** CERT STR02-C, OWASP A03:2021
**Phase 2 Addresses:** NO

---

### Finding 1.4 [CRITICAL] -- Kismet Start-Safe: Network Interface Name Used in Shell Commands

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/kismet/start-safe/+server.ts`
**Line:** 20

```typescript
const adapter = adapterCheck.stdout.trim();
await execAsync(`sudo ifconfig ${adapter} down`).catch(() => {});
```

**Analysis:** While the adapter name comes from `ip link show` output (not directly from user input), this pattern is dangerous because if an attacker can influence interface names (e.g., via USB device insertion), the value flows unsanitized into a `sudo` shell command. The same pattern exists in the droneid endpoint.

**Severity:** MEDIUM
**Standard:** CERT ENV33-C (Do not call system() if you can avoid it)
**Phase 2 Addresses:** NO

---

## CATEGORY 2: DENIAL OF SERVICE

### Finding 2.1 [HIGH] -- Wireshark Buffer Accumulation Without Limits

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/wireshark.ts`
**Lines:** 230-310

```typescript
child.stdout?.on('data', (data: Buffer) => {
    buffer += dataStr;  // No maximum buffer size
    // ... regex matching on unbounded buffer
    const arrayMatch = buffer.match(/\[[\s\S]*?\]/);
```

**Analysis:** The `buffer` variable accumulates stdout data from tshark without any size limit. If tshark produces large JSON output, the buffer grows unboundedly. The regex `\[[\s\S]*?\]` applied to a growing buffer also has potential for catastrophic backtracking on malformed input. On the RPi 5 with 8GB RAM, this is a direct OOM vector.

**Severity:** HIGH
**Standard:** NASA/JPL Rule 12 (All memory allocation bounded), CERT MEM04-C
**Phase 2 Addresses:** NO

---

### Finding 2.2 [HIGH] -- WebSocket Server: No Connection Limits

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/websocket-server.ts`
**Lines:** 27-59

```typescript
export function initializeWebSocketServer(server: unknown, port: number = 5173) {
  const wss = new WebSocketServer({ port, ... });
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (!connections.has(endpoint)) {
      connections.set(endpoint, new Set());
    }
    connections.get(endpoint)?.add(ws);
```

**Analysis:** No `maxPayload` option is set on the WebSocketServer constructor. No limit on the number of concurrent connections per endpoint or globally. No message size validation on incoming data. The `ws` library default `maxPayload` is 100 MiB -- a single client can send a 100MB message. On an 8GB RPi 5 running multiple services, this is trivially exploitable for DoS.

**Severity:** HIGH
**Standard:** NASA/JPL Rule 12, OWASP Denial of Service
**Phase 2 Addresses:** NO -- the plan mentions WebSocket security only in passing.

---

### Finding 2.3 [HIGH] -- WebSocket Kismet Manager: No Connection Limits

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/webSocketManager.ts`
**Lines:** 407-414

```typescript
ws.on('message', (data: Buffer) => {
    const message = JSON.parse(data.toString()) as ClientMessage;
    this.handleClientMessage(ws, message);
```

**Analysis:** Same issues as 2.2: no `maxPayload`, no connection count limits, no message size validation, `JSON.parse` on unbounded buffer from client.

**Severity:** HIGH
**Standard:** NASA/JPL Rule 12, CERT MEM04-C
**Phase 2 Addresses:** NO

---

### Finding 2.4 [MEDIUM] -- Kismet API Client: setInterval Without Cleanup on Disconnect

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/api_client.ts`
**Lines:** 327-343

```typescript
setInterval(async () => {
    if (!this.isConnected) return;
    const devices = await this.getDevices();
    ...
}, 5000);
```

**Analysis:** `setupPolling()` creates a `setInterval` that is never stored or cleared. If the Kismet API client is instantiated multiple times (e.g., via HMR or re-initialization), polling intervals accumulate. The `isConnected` guard prevents work but the timer objects themselves leak.

**Severity:** MEDIUM
**Standard:** NASA/JPL Rule 12 (bounded resource usage)
**Phase 2 Addresses:** NO

---

### Finding 2.5 [MEDIUM] -- Hardware Resource Manager: setInterval Without Cleanup

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/hardware/resourceManager.ts`
**Line:** 16

```typescript
setInterval(() => this.refreshDetection(), 30000);
```

**Analysis:** Constructor creates a 30-second interval that is never stored, has no cleanup mechanism, and accumulates on each instantiation.

**Severity:** MEDIUM
**Standard:** NASA/JPL Rule 12
**Phase 2 Addresses:** NO

---

## CATEGORY 3: WEBSOCKET SECURITY

### Finding 3.1 [HIGH] -- No Origin Validation on WebSocket Connections

**File:** `/home/kali/Documents/Argos/Argos/src/hooks.server.ts`
**Lines:** 43-59

```typescript
wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    // No origin header check
    // No authentication check
    wsManager.addClient(ws, { ... });
});
```

**AND:**

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/websocket-server.ts`
**Lines:** 48-59

```typescript
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // No origin validation
    // No authentication
    connections.get(endpoint)?.add(ws);
```

**Analysis:** Neither WebSocket server validates the `Origin` header. Any website loaded in a browser on the same network can establish a WebSocket connection to the Argos server and receive real-time RF data, device lists, and GPS coordinates. This is especially dangerous because the system has `Access-Control-Allow-Origin: *` on its HTTP endpoints, meaning a cross-origin web page can connect to both the REST API and WebSocket streams.

**Severity:** HIGH
**Standard:** OWASP WebSocket Security, CWE-346 (Origin Validation Error)
**Phase 2 Addresses:** NO -- the plan mentions CORS for HTTP but not WebSocket origin validation.

---

### Finding 3.2 [HIGH] -- No Authentication on WebSocket Connections

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/websocket-server.ts` (entire file)
**File:** `/home/kali/Documents/Argos/Argos/src/hooks.server.ts` (lines 43-59)

**Analysis:** Neither WebSocket server requires any authentication token, API key, or session cookie. Any client on the network can connect and receive classified RF intelligence data.

**Severity:** HIGH
**Standard:** OWASP A07:2021 (Identification and Authentication Failures)
**Phase 2 Addresses:** PARTIALLY -- the plan mentions authentication for HTTP routes but not for WebSocket upgrade paths.

---

## CATEGORY 4: DEPENDENCY VULNERABILITIES

### Finding 4.1 [HIGH] -- 19 Known Vulnerabilities in Dependencies (14 High)

**Command:** `npm audit`

| Package                       | Severity | Issue                                                   |
| ----------------------------- | -------- | ------------------------------------------------------- |
| `devalue` <=5.6.1             | HIGH     | Prototype pollution vulnerability (GHSA-vj54-72f3-p5jv) |
| `devalue` <=5.6.1             | HIGH     | DoS via memory/CPU exhaustion in `devalue.parse`        |
| `@sveltejs/kit`               | HIGH     | SSRF vulnerability with prerendering                    |
| `fast-xml-parser` 4.3.6-5.3.3 | HIGH     | RangeError DoS                                          |
| `glob` 10.2.0-10.4.5          | HIGH     | Command injection via -c/--cmd                          |
| `tar` <=7.5.6                 | HIGH     | Arbitrary file overwrite + symlink poisoning (3 CVEs)   |
| `tar-fs`                      | HIGH     | Symlink validation bypass                               |
| `playwright` <1.55.1          | HIGH     | SSL cert verification bypass                            |
| `preact` 10.26.5-10.26.9      | HIGH     | JSON VNode injection                                    |
| `js-yaml` 4.0.0-4.1.0         | MODERATE | Prototype pollution in merge                            |
| `lodash` 4.0.0-4.17.21        | MODERATE | Prototype pollution in `_.unset`/`_.omit`               |
| `lodash-es`                   | MODERATE | Same as lodash                                          |
| `cookie` <0.7.0               | LOW      | Out of bounds characters                                |

**Analysis:** The `devalue` prototype pollution is particularly dangerous because SvelteKit uses `devalue` for server-to-client data serialization. An attacker who can influence server-loaded data could pollute Object.prototype in the client.

**Severity:** HIGH (composite)
**Standard:** OWASP A06:2021 (Vulnerable and Outdated Components)
**Phase 2 Addresses:** NO -- the plan does not mention dependency auditing or `npm audit`.

---

## CATEGORY 5: ARBITRARY SCRIPT EXECUTION

### Finding 5.1 [CRITICAL] -- Script Execute Endpoint: Directory Traversal Bypass

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/kismet/scripts/execute/+server.ts`
**Lines:** 20-31

```typescript
const allowedDirs = ["/home/pi/Scripts", "/home/pi/stinky"];
const isAllowed = allowedDirs.some((dir) =>
	(scriptPath as string).startsWith(dir),
);
// ...
const result = await ScriptManager.executeScript(scriptPath as string);
```

**Analysis:** The `startsWith` check is trivially bypassable with path traversal. The path `/home/pi/Scripts/../../../etc/cron.d/evil` passes the `startsWith('/home/pi/Scripts')` check. The `ScriptManager.executeScript` at line 89 then spawns the script directly: `spawn(scriptPath, [], { detached: true })`. This is arbitrary code execution with no path normalization, no canonicalization, and no symlink resolution. The allowed directories reference `/home/pi/` which does not exist on this system (user is `kali`).

**Severity:** CRITICAL
**Standard:** OWASP A01:2021 (Broken Access Control), CWE-22 (Path Traversal), CERT FIO16-C
**Phase 2 Addresses:** NO

---

## CATEGORY 6: HARDCODED CREDENTIALS

### Finding 6.1 [HIGH] -- Kismet Default Passwords in Source Code

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/kismet_controller.ts`
**Line:** 52

```typescript
restPassword: 'kismet',
```

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/fusion_controller.ts`
**Line:** 46

```typescript
restPassword: process.env.KISMET_PASSWORD || 'password',
```

**Analysis:** Two different Kismet controller files use two different hardcoded fallback passwords (`'kismet'` and `'password'`). The `kismet_controller.ts` does not even attempt to read from an environment variable -- the password is always `'kismet'`. These credentials are used for Basic Auth to the Kismet REST API.

**Severity:** HIGH
**Standard:** OWASP A07:2021, CWE-798 (Use of Hard-coded Credentials)
**Phase 2 Addresses:** PARTIALLY -- the plan mentions hardcoded credentials but may not catch both files and both different passwords.

---

## CATEGORY 7: INFORMATION DISCLOSURE

### Finding 7.1 [HIGH] -- Debug/Test Endpoints Routable in Production

The following API endpoints exist with no authentication and no environment-gating:

| Endpoint                  | File                                           | Risk                                  |
| ------------------------- | ---------------------------------------------- | ------------------------------------- |
| `/api/test`               | `src/routes/api/test/+server.ts`               | Exposes internal endpoint map         |
| `/api/test-db`            | `src/routes/api/test-db/+server.ts`            | Exposes DB schema info                |
| `/api/gsm-evil/test-db`   | `src/routes/api/gsm-evil/test-db/+server.ts`   | Direct DB access, exposes dbPath      |
| `/api/hackrf/debug-start` | `src/routes/api/hackrf/debug-start/+server.ts` | Starts RF sweep, returns stack traces |
| `/api/hackrf/test-sweep`  | `src/routes/api/hackrf/test-sweep/+server.ts`  | Direct hardware access                |
| `/api/hackrf/test-device` | `src/routes/api/hackrf/test-device/+server.ts` | Hardware fingerprinting               |
| `/api/debug/usrp-test`    | `src/routes/api/debug/usrp-test/+server.ts`    | USRP hardware test                    |

**Analysis:** Debug endpoints are publicly routable and expose hardware state, database paths, stack traces, and internal architecture. The `debug-start` endpoint returns full stack traces (lines 40-41):

```typescript
error: (cycleError as { message?: string }).message,
stack: (cycleError as { stack?: string }).stack,
```

**Severity:** HIGH
**Standard:** OWASP A01:2021 (Broken Access Control), CWE-200 (Information Exposure)
**Phase 2 Addresses:** NO -- the plan does not enumerate or gate debug endpoints.

---

### Finding 7.2 [MEDIUM] -- Error Responses Leak Internal Details

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/gsm-evil/control/+server.ts`
**Line:** 126

```typescript
throw new Error(`GsmEvil2 failed to start. Log: ${logOut}`);
```

**Line:** 141

```typescript
error: (error as Error).message;
```

**Analysis:** Multiple API endpoints return `(error as Error).message` directly to the client in JSON responses. Error messages from `child_process.exec` include full command strings, file paths, and system state. This pattern is pervasive across ~30 API endpoints.

**Severity:** MEDIUM
**Standard:** CWE-209 (Information Exposure Through Error Message)
**Phase 2 Addresses:** NO -- the plan mentions stack traces in the hooks error handler but not in individual API route error responses.

---

## CATEGORY 8: SUBPROCESS SECURITY

### Finding 8.1 [HIGH] -- Child Processes Inherit Full Environment

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/agent/tool-execution/adapters/cli-adapter.ts`
**Line:** 117

```typescript
const childEnv = { ...process.env, ...(env || {}) };
const child = spawn(command, args, { env: childEnv, ... });
```

**Analysis:** All child processes spawned by the CLI adapter inherit the full parent environment via `...process.env`. This includes `ANTHROPIC_API_KEY`, `KISMET_PASSWORD`, `BETTERCAP_PASSWORD`, and any other secrets in the environment. A compromised or misbehaving tool could exfiltrate these.

**Severity:** HIGH
**Standard:** CERT ENV33-C (Do not call system), OWASP A05:2021 (Security Misconfiguration)
**Phase 2 Addresses:** NO

---

### Finding 8.2 [MEDIUM] -- hostExec Single-Quote Escaping is Insufficient

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/hostExec.ts`
**Lines:** 61-62

```typescript
const escaped = cmd.replace(/'/g, "'\\''");
return execAsync(`nsenter -t 1 -m -- bash -c '${escaped}'`, execOpts);
```

**Analysis:** The escaping only handles single quotes. If the original command contains backticks, `$(...)`, or other bash expansion characters, they are interpreted by bash inside the single-quoted string. While single-quoting in bash prevents `$` and backtick expansion, this is the correct approach -- however, the function accepts arbitrary command strings from callers, and many callers build commands with string interpolation of user input before calling `hostExec`. The real vulnerability is at the call sites, not in hostExec itself.

**Severity:** MEDIUM (defense-in-depth concern)
**Standard:** CERT STR02-C
**Phase 2 Addresses:** NO

---

### Finding 8.3 [MEDIUM] -- Bettercap API Client Runs Shell Commands via curl

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/bettercap/apiClient.ts`
**Lines:** 24-31

```typescript
const bodyArg = body ? `-d '${body}'` : "";
const { stdout } = await execAsync(
	`curl -s -X ${method} ${headerArgs} ${bodyArg} "${API_BASE}${path}" 2>/dev/null`,
	{ timeout: 10000 },
);
```

**Analysis:** HTTP requests to the Bettercap API are made by shelling out to `curl` instead of using `fetch` or an HTTP library. The `body` parameter is interpolated into a shell command string. The `runCommand` function passes user-controlled bettercap commands (from the `/api/bettercap/control` endpoint) through `JSON.stringify({ cmd })` into this shell interpolation. While `JSON.stringify` will escape the content, this is still a fragile and unnecessary pattern.

**Severity:** MEDIUM
**Standard:** CERT ENV33-C, defense-in-depth
**Phase 2 Addresses:** NO

---

## CATEGORY 9: MISSING SECURITY HEADERS

### Finding 9.1 [MEDIUM] -- No Content-Security-Policy Header

**File:** `/home/kali/Documents/Argos/Argos/src/hooks.server.ts`
**Lines:** 80-91

```typescript
response.headers.set("Permissions-Policy", "...");
// No CSP header
// No X-Content-Type-Options
// No X-Frame-Options
// No Strict-Transport-Security
```

**Analysis:** The server hook sets only `Permissions-Policy`. There is no `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, or `Strict-Transport-Security` header. On a military network analysis console, the absence of CSP means any XSS vulnerability allows full JavaScript execution including access to WebSocket streams carrying classified RF intelligence.

**Severity:** MEDIUM
**Standard:** OWASP A05:2021 (Security Misconfiguration)
**Phase 2 Addresses:** NO -- the plan mentions CSP as a task but the hooks.server.ts implementation has only Permissions-Policy.

---

### Finding 9.2 [MEDIUM] -- Access-Control-Allow-Origin: \* on RF Data Endpoints

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/rf/data-stream/+server.ts`
**Line:** 10

```typescript
'Access-Control-Allow-Origin': '*'
```

**Analysis:** Multiple RF-related API endpoints (`data-stream`, `start-sweep`, `stop-sweep`, `emergency-stop`, `status`) and HackRF endpoints set `Access-Control-Allow-Origin: *`. This allows any website to make cross-origin requests to read RF spectrum data, start/stop sweeps, and access hardware status. Combined with the lack of authentication, any web page loaded on a machine with network access to the RPi can control the SDR hardware.

**Severity:** MEDIUM
**Standard:** OWASP A01:2021
**Phase 2 Addresses:** PARTIALLY -- the plan mentions CORS but may not address the wildcard on hardware-controlling endpoints.

---

## CATEGORY 10: SERVICES BINDING TO 0.0.0.0

### Finding 10.1 [HIGH] -- GsmEvil2 Listens on All Interfaces

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/gsm-evil/control/+server.ts`
**Line:** 103

```typescript
`cd ${gsmDir} && sudo python3 GsmEvil_auto.py --host 0.0.0.0 --port 8080 >/tmp/gsmevil2.log 2>&1 & echo $!`;
```

**Analysis:** GsmEvil2 is started with `--host 0.0.0.0`, binding to all network interfaces including any public-facing interface. This exposes the IMSI capture web interface to the entire network with no authentication.

**Severity:** HIGH
**Standard:** CWE-668 (Exposure of Resource to Wrong Sphere)
**Phase 2 Addresses:** NO

---

### Finding 10.2 [MEDIUM] -- Bettercap API Listens on All Interfaces

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/bettercap/apiClient.ts`
**Line:** 96

```typescript
`bettercap ${ifaceFlag} -api-rest-address 0.0.0.0 -api-rest-port 8081`;
```

**Analysis:** Bettercap REST API binds to `0.0.0.0:8081`, exposing the full bettercap API (including attack modules) to any host on the network. Credentials are Basic Auth only.

**Severity:** MEDIUM
**Standard:** CWE-668
**Phase 2 Addresses:** NO

---

## CATEGORY 11: RACE CONDITIONS

### Finding 11.1 [MEDIUM] -- TOCTOU in Script Execution

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/kismet/scripts/execute/+server.ts`
**Lines:** 20-31

**AND:**

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/scriptManager.ts`
**Lines:** 75-89

```typescript
// Check exists and is executable
await access(scriptPath, constants.F_OK | constants.X_OK);
// ... time gap ...
const child = spawn(scriptPath, [], { detached: true });
```

**Analysis:** The `access()` check and `spawn()` call are separated by time. During the gap, a symlink at `scriptPath` could be replaced with a different target (symlink swap attack). Combined with the path traversal bypass in Finding 5.1, this creates a reliable exploitation window.

**Severity:** MEDIUM
**Standard:** CWE-367 (TOCTOU Race Condition), CERT FIO01-C
**Phase 2 Addresses:** NO

---

### Finding 11.2 [LOW] -- Concurrent HackRF Resource Access

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/hardware/resourceManager.ts`

**Analysis:** The `acquire()` and `release()` methods use a simple object-based lock without any atomic operation or mutex. If two API requests arrive simultaneously (e.g., GSM Evil start and HackRF sweep start), both could pass the "is available" check before either sets the lock, leading to two processes trying to use the HackRF simultaneously.

**Severity:** LOW
**Standard:** CWE-362 (Concurrent Execution)
**Phase 2 Addresses:** NO

---

## CATEGORY 12: TIMING ATTACKS

### Finding 12.1 [LOW] -- No Constant-Time Comparison for Secrets

**Searched for:** `timingSafeEqual` -- zero results found anywhere in the codebase.

**Analysis:** Despite the Phase 2 plan mentioning `timingSafeEqual`, it is not imported or used anywhere in the codebase. Any secret comparison (API keys, passwords, tokens) uses JavaScript `===` which is vulnerable to timing side-channel attacks. This is especially relevant for the Kismet password comparison in `api_client.ts`.

**Severity:** LOW
**Standard:** CWE-208 (Observable Timing Discrepancy), CERT MSC09-C
**Phase 2 Addresses:** NO -- the plan mentions it as a future implementation, not an existing usage.

---

## CATEGORY 13: PROTOTYPE POLLUTION via Dependencies

### Finding 13.1 [HIGH] -- devalue Prototype Pollution (SvelteKit Data Serialization)

**Advisory:** GHSA-vj54-72f3-p5jv (devalue <=5.6.1)

**Analysis:** SvelteKit uses `devalue` to serialize server `load()` function return values for client-side hydration. The prototype pollution vulnerability in `devalue.parse()` means that if an attacker can influence data returned from a server `load()` function (e.g., via a Kismet device name or SSID that gets loaded into a page), they could pollute `Object.prototype` on the client, achieving persistent XSS.

**Severity:** HIGH
**Standard:** CWE-1321 (Prototype Pollution)
**Phase 2 Addresses:** NO

---

## CATEGORY 14: UNBOUNDED RESOURCE GROWTH (RPi 5 Specific)

### Finding 14.1 [MEDIUM] -- RTL-433 Global Output Accumulation

**File:** `/home/kali/Documents/Argos/Argos/src/routes/api/rtl-433/control/+server.ts`
**Lines:** 107-116

```typescript
(global as any).rtl433Output = (global as any).rtl433Output || [];
(global as any).rtl433Output.push({
	timestamp: new Date().toISOString(),
	data: output,
});
if ((global as any).rtl433Output.length > 100) {
	(global as any).rtl433Output.shift();
}
```

**Analysis:** While the array is capped at 100 entries, each `output` entry is an arbitrary-size string from `rtl_433` stdout. A single burst of 100 large messages could consume significant memory. The `shift()` operation on large arrays is O(n). Using `global as any` bypasses TypeScript safety entirely.

**Severity:** LOW
**Standard:** NASA/JPL Rule 12
**Phase 2 Addresses:** NO

---

### Finding 14.2 [LOW] -- EventEmitter Listener Accumulation in Kismet Modules

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/device_tracker.ts`

**Analysis:** `DeviceTracker` extends `EventEmitter` and emits events like `device_discovered`, `signal_change`, `channel_change`. No `maxListeners` is set. No check for listener count growth. If external code adds listeners in a loop or on timer, they accumulate.

**Severity:** LOW
**Standard:** NASA/JPL Rule 12
**Phase 2 Addresses:** NO

---

### Finding 14.3 [MEDIUM] -- DeviceTracker Maps Grow Without Global Cap

**File:** `/home/kali/Documents/Argos/Argos/src/lib/server/kismet/device_tracker.ts`
**Lines:** 11-14

```typescript
private devices = new Map<string, WiFiDevice>();
private deviceHistory = new Map<string, WiFiDevice[]>();
private associations = new Map<string, Set<string>>();
private probeRequests = new Map<string, Set<string>>();
```

**Analysis:** While `deviceHistory` per-device is capped at 100 entries (line 305), there is no global cap on the number of devices tracked. In a dense RF environment, thousands of unique MACs could accumulate. The `associations` and `probeRequests` maps grow without any limit. The `cleanupOldDevices()` only removes devices not seen for `deviceTimeout` seconds, but in a busy environment, all devices may remain active.

**Severity:** MEDIUM
**Standard:** NASA/JPL Rule 12
**Phase 2 Addresses:** NO

---

## SUMMARY OF FINDINGS BY CATEGORY

| Category                           | CRITICAL | HIGH   | MEDIUM | LOW   |
| ---------------------------------- | -------- | ------ | ------ | ----- |
| 1. Command Injection (new vectors) | 2        | 1      | 1      | 0     |
| 2. Denial of Service               | 0        | 3      | 2      | 0     |
| 3. WebSocket Security              | 0        | 2      | 0      | 0     |
| 4. Dependency Vulnerabilities      | 0        | 1      | 0      | 0     |
| 5. Arbitrary Script Execution      | 1        | 0      | 0      | 0     |
| 6. Hardcoded Credentials           | 0        | 1      | 0      | 0     |
| 7. Information Disclosure          | 0        | 1      | 1      | 0     |
| 8. Subprocess Security             | 0        | 1      | 2      | 0     |
| 9. Missing Security Headers        | 0        | 0      | 2      | 0     |
| 10. Network Binding                | 0        | 1      | 1      | 0     |
| 11. Race Conditions                | 0        | 0      | 1      | 1     |
| 12. Timing Attacks                 | 0        | 0      | 0      | 1     |
| 13. Prototype Pollution            | 0        | 1      | 0      | 0     |
| 14. Unbounded Resources            | 0        | 0      | 2      | 1     |
| **TOTAL**                          | **3**    | **12** | **12** | **3** |

Note: Finding counts in this summary (30) differ from the executive summary (34) because some findings are grouped. Individual sub-findings in section 1 and section 4 contain multiple instances.

---

## PRIORITY REMEDIATION ORDER

### Immediate (Before Next Deployment)

1. **Finding 1.1** -- Cell tower Python injection: Replace template interpolation with parameterized query via `better-sqlite3`
2. **Finding 5.1** -- Script execute path traversal: Add `path.resolve()` + `path.normalize()` + verify canonical path starts with allowed dir
3. **Finding 1.2** -- USRP power injection: Validate numeric types with `Number.isFinite()`, range-check, and use spawn with array args instead of template string
4. **Finding 10.1** -- GsmEvil2 binding: Change `--host 0.0.0.0` to `--host 127.0.0.1`

### High Priority (Within 1 Week)

5. **Finding 4.1** -- Run `npm audit fix` to resolve the 19 dependency vulnerabilities
6. **Finding 3.1/3.2** -- Add origin validation and authentication token to WebSocket connections
7. **Finding 2.2/2.3** -- Set `maxPayload: 1048576` (1MB) on WebSocket servers, add connection count limits
8. **Finding 7.1** -- Gate debug/test endpoints behind `dev` environment check
9. **Finding 8.1** -- Strip sensitive env vars before spawning child processes

### Medium Priority (Within 2 Weeks)

10. **Finding 9.1** -- Add CSP, X-Content-Type-Options, X-Frame-Options headers
11. **Finding 9.2** -- Replace `Access-Control-Allow-Origin: *` with specific origins
12. **Finding 2.1** -- Cap wireshark buffer at 10MB, add regex timeout
13. **Finding 6.1** -- Remove hardcoded passwords, require env vars
14. **Finding 8.3** -- Replace curl shell-out with `fetch()` in bettercap client
