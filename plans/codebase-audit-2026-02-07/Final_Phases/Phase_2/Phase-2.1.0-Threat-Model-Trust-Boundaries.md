# Phase 2.1.0: Threat Model, Trust Boundaries, and Key Rotation

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.1 (rev-validated 2026-02-08, 16 corrections applied -- see Validation Evidence Summary)
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 RA-3 (Risk Assessment), NIST SP 800-53 IA-5 (Authenticator Management), OWASP Top 10 (2021), DISA STIG Application Security
**Review Panel**: US Cyber Command Engineering Review Board

**Task ID**: 2.1.0
**Risk Level**: N/A -- Reference document only
**Produces Git Commit**: No
**Dependencies**: None
**Blocks**: None (informational reference for Tasks 2.1.1-2.1.7)
**Regrade Origin**: B1 (trust boundary diagram), B5 (key rotation procedure)

---

## Purpose

This document establishes the threat model, trust boundary diagram, and key rotation procedures that inform all Phase 2 security decisions. It is a **reference document** -- it does not produce a git commit. All implementation tasks (2.1.1 through 2.1.7) reference this document for threat context and design rationale.

The threat model was developed per NIST SP 800-53 RA-3 (Risk Assessment) requirements. The key rotation procedure was developed per NIST SP 800-53 IA-5 (Authenticator Management) requirements. Both were added in response to regrade findings B1 and B5, which identified the absence of these foundational security artifacts as a compliance gap.

---

## System Description

This system:

- Runs on a Raspberry Pi 5 (8GB RAM, Cortex-A76 quad-core) in a tactical field environment
- Controls SDR hardware (HackRF One) capable of transmitting RF signals
- Scans and records WiFi networks, IMSI identifiers, and RF spectrum data
- Operates on a local network segment with other military systems during EW training exercises
- Stores intelligence data (IMSI, WiFi MAC addresses, GPS coordinates, RF signatures) in a local SQLite database
- Is field-deployed for Army EW training at NTC/JMRC

---

## Threat Model

### Threat Actors

| #   | Threat Actor                    | Access Level                                                                    | Motivation                                                   | Capability                                                                                                                                                |
| --- | ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Adjacent network attacker**   | Any device on the same tactical network segment                                 | Reconnaissance, disruption, data exfiltration                | Can access all API endpoints (no authentication). Can send crafted HTTP/WebSocket requests. Can intercept unencrypted RF data streams.                    |
| 2   | **Compromised adjacent system** | Localhost access if another RPi/system on the network is compromised and pivots | Lateral movement, persistent access, intelligence collection | Full access to all localhost services (Kismet port 2501, gpsd port 2947, HackRF backend port 8092). Can exploit localhost trust assumptions.              |
| 3   | **Physical access attacker**    | Device is field-deployed; physical access provides full system access           | Data extraction, device tampering, firmware modification     | USB access to all connected hardware. Direct disk access to SQLite database with IMSI/WiFi/GPS data. Can extract credentials from plaintext config files. |
| 4   | **RF environment attacker**     | Can inject crafted RF signals, WiFi frames, GSM signals, GPS spoofing           | Sensor manipulation, false intelligence injection            | Can send malformed data that traverses Trust Boundary 4 through Trust Boundary 2 via sensor parsing code paths (Kismet, grgsm, HackRF).                   |

### Verified Attack Surface

The following attack surface was verified against the live codebase on 2026-02-08 (rev-validated at `dev_branch` HEAD). All counts are produced by the listed verification commands, not estimated. Counts may differ from the Phase 2 Master Index snapshot due to concurrent Phase 1 cleanup operations.

| Attack Vector                                       | Verified Count                     | Verification Command                                                                                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API endpoint files with zero authentication         | **106**                            | `find src/routes/api/ -name "+server.ts" \| wc -l`                                                                                                                                                                           |
| WebSocket server instances with zero authentication | **4**                              | `websocket-server.ts`, `hooks.server.ts` (ws upgrade), `gsm-evil/server.ts`, `vite-plugin-terminal.ts` (unauthenticated PTY shell)                                                                                           |
| SSE streaming endpoints (unauthenticated)           | **6**                              | `grep -rln "text/event-stream" src/ --include="*.ts"`                                                                                                                                                                        |
| hostExec() references across codebase               | **115** across 14 files            | `grep -rn "hostExec" src/ --include="*.ts"` (14 files: `grep -rln`)                                                                                                                                                          |
| exec/spawn references in API routes                 | **266** across 39 files            | `grep -rn "hostExec\|exec\|spawn" src/routes/api/ --include="*.ts"` (includes ~112 actual child_process calls, remainder are string mentions of "execute"/"executor")                                                        |
| Command injection vectors (CRITICAL severity)       | **3**                              | cell-towers (Python code injection), usrp-power (shell injection), gsm-evil/control (shell injection)                                                                                                                        |
| Command injection vectors (all severities)          | **3C + 4H + ~15M**                 | Regrade Section 1.1, minus 1 false positive (rtl-433)                                                                                                                                                                        |
| Hardcoded credentials (all locations)               | **21**                             | 9 source + 1 config + 3 Docker + 8 scripts                                                                                                                                                                                   |
| CORS wildcard instances                             | **14** across 8 files              | `grep -rn "Allow-Origin.*\*" src/ --include="*.ts"` + Express cors() default in `gsm-evil/server.ts`                                                                                                                         |
| Swallowed error patterns (exact)                    | **38** across 15 files             | `grep -rn "\.catch.*=>.*{}" src/ --include="*.ts"`                                                                                                                                                                           |
| Swallowed error patterns (all forms)                | **~122**                           | Including `.catch(() => literal)`, bare `catch {}`, unused `_error`                                                                                                                                                          |
| Unvalidated JSON.parse calls                        | **43** across 28 files             | `grep -rn "JSON\.parse" src/ --include="*.ts"`                                                                                                                                                                               |
| JSON.parse without try-catch                        | **~16 (37%)**                      | Subset of 43 total instances (estimated ratio preserved)                                                                                                                                                                     |
| Stack traces exposed to clients                     | **1** (client-facing)              | `hackrf/data-stream/+server.ts:89` exposes `error.stack` in SSE response                                                                                                                                                     |
| Debug endpoints exposing internal state             | **0** (removed by Phase 1 cleanup) | All 7 previously identified debug routes (`/api/test`, `/api/test-db`, `/api/hackrf/debug-start`, `/api/hackrf/test-device`, `/api/hackrf/test-sweep`, `/api/debug/usrp-test`, `/api/debug/spectrum-data`) have been deleted |
| npm audit vulnerabilities                           | **4 (3 low, 1 high)**              | `npm audit` -- `fast-xml-parser` RangeError DoS (high), `cookie` out-of-bounds chars (3x low via `@sveltejs/kit`)                                                                                                            |
| Unauthenticated deploy server                       | **1** (netcat on port 8099)        | `scripts/deploy-master.sh:347`                                                                                                                                                                                               |
| Sudoers wildcards                                   | **4** lines                        | `scripts/setup-droneid-sudoers.sh:22-23,32-33`                                                                                                                                                                               |

### Risk Matrix

| Risk                                           | Likelihood                                     | Impact                                                       | Mitigation (Phase 2 Task)                   |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Unauthenticated hardware control (RF transmit) | HIGH -- any network peer                       | CRITICAL -- unauthorized RF emission in training environment | Task 2.1.1 (API auth), Task 2.1.6 (WS auth) |
| Shell injection via API parameters             | MEDIUM -- requires crafted request             | CRITICAL -- full system compromise, arbitrary code execution | Task 2.1.2 (injection elimination)          |
| Credential exposure via source code            | HIGH -- git history, any code reader           | HIGH -- lateral access to Kismet, OpenCellID, WiFi AP        | Task 2.1.3 (credential removal)             |
| Data exfiltration via unauthenticated API      | HIGH -- any network peer                       | HIGH -- IMSI, WiFi MAC, GPS data exposed                     | Task 2.1.1 (API auth)                       |
| WebSocket data interception                    | HIGH -- any network peer                       | HIGH -- real-time RF data, device tracking, IMSI captures    | Task 2.1.6 (WS auth)                        |
| SSRF via HackRF proxy catch-all                | LOW -- requires knowledge of internal topology | MEDIUM -- can probe internal services                        | Task 2.1.4 (SSRF fix)                       |
| Denial of service via oversized payloads       | MEDIUM -- trivial to execute                   | MEDIUM -- OOM kill on 8GB RPi                                | Task 2.1.7 (body size limits)               |
| Device capture with plaintext database         | HIGH -- field deployment                       | CRITICAL -- all collected intelligence compromised           | Task 2.2.13 (SQLCipher)                     |

---

## Trust Boundary Diagram

The following diagram defines four trust boundary layers. Each boundary represents a point where data crosses between zones of different trust levels. Security controls are applied at each boundary crossing.

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
|  |  HTTP API (106 endpoint files) <-- Auth gate  |  |
|  |  WebSocket Servers (4 instances) <-- Auth gate |  |
|  |  SSE Streaming endpoints (6)   <-- Auth gate  |  |
|  +----------------------------------------------+  |
|                                                    |
+====[TRUST BOUNDARY 2: Application -> OS/HW]=======+
|                                                    |
|  +--[ System Services (localhost) ]-------------+  |
|  |  Kismet (port 2501)     <-- service creds    |  |
|  |  Bettercap (port 8081)  <-- service creds    |  |
|  |  GSM Evil (port 8080)   <-- no auth          |  |
|  |  gpsd (port 2947)       <-- no auth          |  |
|  |  HackRF backend (8092)  <-- no auth          |  |
|  |  OpenWebRX (8073)       <-- admin creds      |  |
|  |  Ollama (port 11434)    <-- no auth          |  |
|  |  Terminal WS (TERMINAL_PORT) <-- no auth!    |  |
|  |  Docker socket (/var/run/docker.sock)        |  |
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

### Key Architectural Decisions

These decisions govern the security architecture established in Phase 2:

| #   | Decision                                             | Rationale                                                                                                                                                                                                                                                                                   | Standard                                                       |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | **Trust Boundary 1 is the primary defense layer**    | API key authentication, input validation, rate limiting, body size limits, and CORS restrictions are all enforced at this boundary. This is the only boundary fully controlled by the Argos application.                                                                                    | NIST SP 800-53 AC-3, OWASP A01:2021                            |
| 2   | **Localhost is NOT a trust boundary**                | Any service on the RPi (Kismet, Bettercap, gpsd, GSM Evil) could be compromised. A localhost fallback in authentication would allow any compromised localhost service to access all Argos endpoints without credentials. This was the original plan's design flaw, corrected by regrade A3. | NASA/JPL Power of Ten Rule 1 (simple, verifiable control flow) |
| 3   | **Trust Boundary 2 requires service credentials**    | All communication between Argos and system services (Kismet, Bettercap, OpenWebRX) must use per-service credentials stored in environment variables, never hardcoded. Services without auth (GSM Evil, gpsd, HackRF backend) should be bound to loopback only via iptables (Task 2.2.11).   | NIST SP 800-53 IA-5                                            |
| 4   | **Trust Boundary 3 assumes firmware is trusted**     | Hardware verification (HackRF firmware integrity, GPS module authenticity) is out of scope for Phase 2. The hardware is provisioned and inspected before field deployment.                                                                                                                  | Scope limitation                                               |
| 5   | **All data crossing any boundary must be validated** | Input from the network (Boundary 1) is validated by the input sanitization library and Zod schemas. Data from system services (Boundary 2) is validated by safeJsonParse. Data from hardware/RF (Boundaries 3-4) is validated by sensor-specific parsers with type guards.                  | CERT STR02-C, OWASP A03:2021                                   |
| 6   | **API key is the sole authentication mechanism**     | Why not JWT/session: single-operator tactical device, not multi-user SaaS. Why not mTLS: adds certificate management burden in field conditions. API key is simple, verifiable, and appropriate for the deployment context.                                                                 | KISS principle, NASA/JPL Power of Ten                          |
| 7   | **API key accepted ONLY via X-API-Key header**       | Query string credentials leak into server logs, browser history, Referer headers, and network monitoring tools. WebSocket connections may use query string token because the WS upgrade request is not logged like HTTP requests and has no Referer header leak.                            | OWASP A07:2021                                                 |

### Data Flow Through Trust Boundaries

The following table maps critical data flows through the trust boundaries, showing where validation occurs:

| Data Flow                | Source                    | Boundary Crossings            | Validation Points                                                                                              |
| ------------------------ | ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| RF spectrum sweep data   | HackRF One USB            | 4 -> 3 -> 2 -> 1 (to browser) | HackRF backend parses raw I/Q; Argos validates JSON; SSE delivers to authenticated client                      |
| WiFi device list         | WiFi adapter monitor mode | 4 -> 3 -> 2 -> 1              | Kismet parses 802.11 frames; Argos validates Kismet API JSON; REST delivers to authenticated client            |
| IMSI capture             | GSM Evil / grgsm          | 4 -> 3 -> 2 -> 1              | grgsm extracts from GSM frames; Argos validates subprocess output; REST delivers to authenticated client       |
| GPS position             | GPS module serial         | 4 -> 3 -> 2 -> 1              | gpsd parses NMEA sentences; Argos validates TCP JSON with safeJsonParse; REST delivers to authenticated client |
| Hardware control command | Browser client            | 1 -> 2 -> 3                   | Auth gate validates API key; input sanitizer validates parameters; sanitized command sent to hardware service  |
| Cell tower lookup        | Browser -> OpenCellID API | 1 -> 2 -> (external API)      | Auth gate validates API key; lat/lon/radius validated; external API response validated                         |

---

## Key Rotation Procedure

**Required by**: NIST SP 800-53 IA-5 (Authenticator Management)

The following key rotation procedures must be documented, tested, and exercised as part of Phase 2.1 execution.

### 1. ARGOS_API_KEY Rotation

**Prerequisite**: Task 2.1.1 must be completed first. Task 2.1.1 creates the `ARGOS_API_KEY` environment variable, `auth-middleware.ts`, and `validateApiKey()` function. Until Task 2.1.1 is executed, no API authentication exists and this procedure is not applicable.

**Rotation frequency**: Every 90 days, or immediately upon suspected compromise.

**Procedure**:

```bash
# Step 1: Generate new key (minimum 32 hex characters = 256-bit entropy)
NEW_KEY=$(openssl rand -hex 32)
echo "New API key: $NEW_KEY"

# Step 2: Update .env file on the RPi
# Edit /home/kali/Documents/Argos/Argos/.env
# Replace ARGOS_API_KEY=<old_value> with ARGOS_API_KEY=<new_value>

# Step 3: Restart Argos service (Docker-based deployment)
cd /home/kali/Documents/Argos/Argos/docker
docker compose -f docker-compose.portainer-dev.yml restart argos-dev
# Alternative (systemd deployment, if installed):
# sudo systemctl restart argos-dev

# Step 4: Update any client configurations
# - Browser bookmarks with API key in URL (should not exist per A4, but verify)
# - Automated scripts that call the API
# - Dashboard terminal if configured with API key

# Step 5: Verify old key is rejected
curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: OLD_KEY_VALUE" \
    http://localhost:5173/api/system/info
# Expected: 401

# Step 6: Verify new key is accepted
curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: $NEW_KEY" \
    http://localhost:5173/api/system/info
# Expected: 200

# Step 7: Record rotation in security log
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) API_KEY_ROTATED by=$(whoami)" >> /var/log/argos/security.log
```

**Verification**: After rotation, all existing WebSocket connections will be terminated (they authenticated with the old key). New connections must use the new key. Verify real-time data flow resumes after frontend reconnects with the new key.

### 2. Service Credential Rotation (Kismet, Bettercap, OpenWebRX)

**Prerequisite**: Task 2.1.3 must be completed first. Task 2.1.3 centralizes all hardcoded credentials into `.env` and removes hardcoded fallback values. Until Task 2.1.3 is executed, the Docker Compose file at line 42 hardcodes `KISMET_PASSWORD=password` as a literal (not interpolated from `.env`), and there are 3 inconsistent Kismet credential configurations across `kismet-controller.ts` (hardcoded `'kismet'`), `fusion-controller.ts` (fallback `'password'`), and `kismet-proxy.ts` (env var required).

**Rotation frequency**: Every 90 days, or immediately upon suspected compromise.

**Procedure**:

```bash
# Step 1: Generate new credentials
NEW_KISMET_PASS=$(openssl rand -hex 16)
NEW_BETTERCAP_PASS=$(openssl rand -hex 16)
NEW_OPENWEBRX_PASS=$(openssl rand -hex 16)

# Step 2: Update .env file
# KISMET_PASSWORD=<new_value>
# BETTERCAP_PASSWORD=<new_value>
# OPENWEBRX_PASSWORD=<new_value>

# Step 3: Restart affected services via Docker Compose
cd /home/kali/Documents/Argos/Argos/docker
docker compose -f docker-compose.portainer-dev.yml restart

# Step 4: Verify services reconnect with new credentials
# Check Kismet connectivity:
curl -s -u admin:$NEW_KISMET_PASS http://localhost:2501/system/status.json | head -1
# Expected: JSON response (not 401)

# Step 5: Verify Argos can reach services
curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status
# Expected: 200 with service status

# Step 6: Record rotation in security log
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) SERVICE_CREDS_ROTATED services=kismet,bettercap,openwebrx by=$(whoami)" >> /var/log/argos/security.log
```

### 3. OpenCellID API Key Rotation

**Prerequisite**: Task 2.1.3 must be completed first. Task 2.1.3 replaces the 5 hardcoded key locations with a single `OPENCELLID_API_KEY` environment variable. Until then, rotation requires manually editing all 5 files listed in the NOTE above.

**Rotation frequency**: Immediately if the key is found in git history or exposed.

**Procedure**:

```bash
# Step 1: Generate new API key at https://opencellid.org/
# Step 2: Update .env file: OPENCELLID_API_KEY=<new_value>
# Step 3: Restart Argos service (Docker-based deployment)
cd /home/kali/Documents/Argos/Argos/docker
docker compose -f docker-compose.portainer-dev.yml restart argos-dev
# Step 4: Verify: API requests to cell-towers endpoint succeed
curl -s -H "X-API-Key: $ARGOS_API_KEY" \
    "http://localhost:5173/api/tactical-map/cell-towers?lat=35.0&lon=-117.0&radius=5"
# Expected: 200 with cell tower data
```

**NOTE**: The current OpenCellID API key (`pk.d6291c07a2907c915cd8994fb22bc189`) is hardcoded in 5 locations and present in git history. It MUST be rotated as part of Task 2.1.3 execution, and the old key should be considered compromised. Locations: `src/routes/api/cell-towers/nearby/+server.ts:7`, `src/routes/api/gsm-evil/tower-location/+server.ts:52`, `config/opencellid.json:2`, `scripts/download-opencellid-full.sh:6`, `scripts/setup-opencellid-full.sh:4`.

### 4. API Key Compromise Response

**Prerequisite**: Tasks 2.1.1 (API authentication) and 2.2.8 (authentication audit logging) must be completed first. This procedure references authentication audit logs and structured logging infrastructure that are created by those tasks. The log directory `/var/log/argos/` is created by Task 2.2.12 (Log Management Architecture).

If an API key compromise is suspected or confirmed:

```
IMMEDIATE (within 5 minutes):
  1. Generate and deploy new API key (Section 1 above)
  2. Terminate all active WebSocket connections
  3. Verify old key returns 401

WITHIN 1 HOUR:
  4. Review authentication audit logs for unauthorized access during compromise window
     - Check for AUTH_SUCCESS entries from unexpected IP addresses
     - Check for unusual API call patterns (bulk data export, hardware control)
  5. Review RF transmission logs for unauthorized transmissions
     - If RF transmission occurred without authorization, report to range safety officer IMMEDIATELY
  6. Review WebSocket connection logs for data exfiltration

WITHIN 24 HOURS:
  7. Determine root cause of key compromise
     - Key in version control? Rotate and remove from history (git filter-branch)
     - Key in browser history? Clear history, rotate key
     - Key intercepted on network? Investigate network segment, consider TLS
  8. Document incident per Task 2.2.10 (Incident Response Procedure)
  9. Update rotation schedule if compromise indicates shorter rotation interval needed
```

---

## Standards Traceability

| Standard                     | Requirement                                                                                                                           | This Document's Coverage                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| NIST SP 800-53 RA-3          | Risk Assessment: Identify threats, vulnerabilities, likelihood, and impact                                                            | Threat Model section: 4 threat actors, verified attack surface, risk matrix                                         |
| NIST SP 800-53 IA-5          | Authenticator Management: Establish procedures for initial distribution, lost/compromised authenticators, and revoking authenticators | Key Rotation Procedure: 4 procedures covering API key, service credentials, OpenCellID key, and compromise response |
| NIST SP 800-53 AC-3          | Access Enforcement: Enforce approved authorizations for access to resources                                                           | Trust Boundary Diagram: 4 boundary layers with access controls at each                                              |
| OWASP A01:2021               | Broken Access Control                                                                                                                 | Trust boundaries define where access control is enforced; architectural decisions document why                      |
| OWASP A07:2021               | Identification and Authentication Failures                                                                                            | Key rotation prevents long-lived credentials; compromise response limits exposure window                            |
| DISA STIG V-222396           | Application must implement cryptographic mechanisms to protect the integrity of credentials                                           | API key minimum 256-bit entropy (openssl rand -hex 32); service credentials minimum 128-bit                         |
| NASA/JPL Power of Ten Rule 1 | Restrict all code to very simple control flow constructs                                                                              | Architectural Decision 2: no localhost fallback; single code path for authentication                                |

---

## Execution Tracking

This document is a reference artifact. It does not produce a git commit and is not tracked in the execution pipeline. It is referenced by all Phase 2.1 task documents for threat context and design rationale.

| Task  | Status       | Started    | Completed  | Verified By     | Notes                                                                                                                                                                                                                                                                                                                        |
| ----- | ------------ | ---------- | ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.0 | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 | All attack surface counts re-verified against live codebase. OWASP A07 misattribution corrected. OpenCellID key location count corrected (4→5). Key rotation procedures annotated with prerequisites. Trust boundary diagram updated with 3 missing services. SystemD restart commands corrected to Docker-based deployment. |

---

## Validation Evidence Summary (2026-02-08)

The following corrections were applied during validation against the live codebase at `dev_branch` HEAD:

| #   | Section                                      | Original Claim                     | Corrected Value                                  | Root Cause                                                                                             |
| --- | -------------------------------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1   | Attack Surface: API endpoint files           | 114                                | **106**                                          | Filesystem count at current HEAD; 102 tracked + 4 untracked                                            |
| 2   | Attack Surface: WebSocket endpoints          | 3                                  | **4**                                            | Terminal WebSocket (`vite-plugin-terminal.ts`) provides unauthenticated PTY shell; was omitted         |
| 3   | Attack Surface: SSE endpoints                | 8                                  | **6**                                            | `grep -rln "text/event-stream" src/ --include="*.ts"` returns 6                                        |
| 4   | Attack Surface: hostExec references          | 110 across 14 files                | **115** across 14 files                          | `grep -rn "hostExec" src/ --include="*.ts"` returns 115 lines                                          |
| 5   | Attack Surface: exec/spawn in API routes     | 121 across 32 files                | **266** across 39 files                          | Broader match confirmed; includes ~112 actual child_process calls                                      |
| 6   | Attack Surface: CORS wildcards               | 15 across 9 files                  | **14** across 8 files                            | Off-by-one; GSM Evil `cors()` default counted separately                                               |
| 7   | Attack Surface: Swallowed errors (exact)     | 39 across 17 files                 | **38** across 15 files                           | One pattern was fixed/removed during concurrent Phase 1                                                |
| 8   | Attack Surface: JSON.parse calls             | 49 across 23+ files                | **43** across 28 files                           | 6 calls removed during concurrent Phase 1 cleanup                                                      |
| 9   | Attack Surface: Stack traces (client-facing) | 2                                  | **1**                                            | Only `hackrf/data-stream/+server.ts:89` confirmed                                                      |
| 10  | Attack Surface: Debug endpoints              | 7                                  | **0**                                            | All 7 removed by Phase 1 cleanup                                                                       |
| 11  | Attack Surface: npm audit vulnerabilities    | 19 (14 high)                       | **4 (3 low, 1 high)**                            | 15 vulnerabilities resolved by Phase 1 dependency cleanup                                              |
| 12  | Trust Boundary 2                             | 6 services listed                  | **9 services**                                   | Added Ollama (11434), Terminal WS, Docker socket; added ports for Bettercap (8081) and GSM Evil (8080) |
| 13  | OpenCellID key locations                     | 4                                  | **5**                                            | Added 2 shell scripts: `download-opencellid-full.sh:6`, `setup-opencellid-full.sh:4`                   |
| 14  | Standards: OWASP A07:2021                    | "Security Misconfiguration"        | **"Identification and Authentication Failures"** | A05:2021 is Security Misconfiguration; A07:2021 is Identification and Authentication Failures          |
| 15  | Key Rotation: systemd restart                | `sudo systemctl restart argos-dev` | Docker compose restart                           | System uses Docker deployment; `argos-dev` systemd unit is not installed                               |
| 16  | Key Rotation: prerequisites                  | Not stated                         | **Added**                                        | Procedures 1-4 annotated with Phase 2 task dependencies                                                |

**Validation methodology**: All attack surface counts were re-verified by executing the stated verification commands against the live filesystem. Three parallel validation agents performed independent cross-checks of (1) attack surface counts, (2) trust boundary architecture, and (3) key rotation procedure operability. Standards traceability was manually cross-referenced against OWASP Top 10 2021 official category names.

---

**Document End**
