# Phase 2.1.3: Hardcoded Credential Removal

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A07:2021 (Identification and Authentication Failures), CWE-798 (Use of Hard-Coded Credentials), NIST SP 800-53 IA-5 (Authenticator Management), DISA STIG V-222642 (Application must not contain embedded authentication data)
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This task removes all 21 verified hardcoded credential locations across source code, configuration files, Docker Compose files, and shell scripts, replacing them with environment variable references that are required at startup. This eliminates the risk of credential leakage through version control history, source code distribution, or filesystem access.

## Execution Constraints

| Constraint       | Value                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| Risk Level       | MEDIUM -- services will fail if environment variables are not set before deployment   |
| Severity         | HIGH                                                                                  |
| Prerequisites    | Task 2.1.1 (auth middleware and `.env.example` must exist)                            |
| Files Touched    | 7 source files + 1 config file + 1 Docker Compose file + 8 shell scripts + 1 new file |
| Blocks           | None directly (but credential hygiene is foundational for all subsequent phases)      |
| Blocked By       | Task 2.1.1 (authentication provides the `.env` infrastructure)                        |
| Estimated Effort | 3 hours                                                                               |

## Threat Context

Argos is field-deployed on a Raspberry Pi 5 at Army EW training sites. The codebase is stored in a git repository, and its full history is accessible to anyone with repository access. Hardcoded credentials in committed files persist in git history indefinitely, even after the offending lines are removed in a subsequent commit.

**Current state**: 21 unique credential locations across 4 categories:

- **8** in TypeScript source code (Kismet passwords, OpenCellID API keys, OpenWebRX admin passwords)
- **1** in a client-side Svelte component (Stadia Maps API key visible in browser-delivered JavaScript)
- **1** in a git-tracked JSON configuration file (OpenCellID API key)
- **3** in Docker Compose files (Kismet, OpenWebRX, Bettercap passwords with insecure defaults)
- **8** in shell scripts (OpenWebRX passwords, OpenCellID API keys, WiFi AP passwords)

**Credential types exposed**:

- Service authentication passwords (Kismet: `password`, OpenWebRX: `admin`, `hackrf`, `argos123`, Bettercap: `argos`)
- Third-party API keys (OpenCellID: `pk.d6291c07a2907c915cd8994fb22bc189`, Stadia Maps key)
- WiFi access point credentials (hardcoded in AP setup scripts)

**Impact**: An attacker who obtains the source code (via git clone, filesystem access, or backup recovery) gains immediate access to all integrated services and third-party APIs without any additional reconnaissance.

## Root Cause Analysis

**REGRADE CORRECTION (B7)**: The original plan identified 14 credentials (9 source + 3 Docker + 2 scripts). The regrade audit found 21 total -- 7 additional locations were missed.

**Root cause of missed credentials**: The original search was scoped too narrowly:

1. Searched only `src/` for `'password'` string patterns -- missed `config/`, `scripts/`, and `.svelte` files
2. Did not search for API key patterns (`pk.`) in configuration files
3. Did not search for `admin:admin`, `admin:hackrf`, or `argos123` patterns in shell scripts
4. Did not consider client-side JavaScript as a credential exposure surface (Stadia Maps key in DashboardMap.svelte)

**Corrective action**: All searches in this task use expanded scope: `src/`, `config/`, `scripts/`, `docker/`, and include `*.ts`, `*.svelte`, `*.json`, `*.sh`, `*.yml` file types.

## Current State Assessment

| Metric                                   | Value | Verification Command                                                                                                 |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| Hardcoded passwords in TypeScript source | 8     | `grep -rn "'password'" src/ --include="*.ts" \| grep -v "node_modules\|\.d\.ts\|security_analyzer" \| wc -l`         |
| Client-side API keys in Svelte           | 1     | `grep -rn "stadia\|stadiamaps" src/ --include="*.svelte" \| wc -l`                                                   |
| API keys in config files                 | 1     | `grep -rn "pk\." config/ --include="*.json" \| wc -l`                                                                |
| Insecure defaults in Docker Compose      | 3     | `grep -c ':-\|=password\|=admin\|=hackrf\|=argos' docker/docker-compose.portainer-dev.yml`                           |
| Hardcoded credentials in shell scripts   | 8     | `grep -rn "password\|argos123\|admin:admin\|admin:hackrf" scripts/ --include="*.sh" \| grep -v ':-\|:?\|#' \| wc -l` |
| Total credential locations               | 21    | Sum of above categories                                                                                              |
| `docker/.env.example` exists             | NO    | `test -f docker/.env.example && echo YES \|\| echo NO`                                                               |

## Implementation Plan

### Subtask 2.1.3.1: Source Code Credentials (8 instances)

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

**Fix pattern for Kismet password fallbacks (#1, #2, #3, #5)**:

BEFORE (vulnerable):

```typescript
const password = process.env.KISMET_PASSWORD || 'password';
```

AFTER (secure):

```typescript
const password = process.env.KISMET_PASSWORD;
if (!password) {
	throw new Error('KISMET_PASSWORD environment variable is not set');
}
```

**Fix pattern for hardcoded API keys (#6, #7)**:

BEFORE (vulnerable):

```typescript
const OPENCELLID_API_KEY = 'pk.d6291c07a2907c915cd8994fb22bc189';
```

AFTER (secure):

```typescript
const OPENCELLID_API_KEY = process.env.OPENCELLID_API_KEY;
if (!OPENCELLID_API_KEY) {
	return json({ error: 'OPENCELLID_API_KEY not configured' }, { status: 503 });
}
```

**Fix pattern for Kismet curl command (#4)**:

BEFORE (vulnerable):

```typescript
await hostExec(`curl -k -u admin:password https://localhost:2501/...`);
```

AFTER (secure):

```typescript
const kismetUser = process.env.KISMET_USER || 'admin';
const kismetPass = process.env.KISMET_PASSWORD;
if (!kismetPass) {
	throw new Error('KISMET_PASSWORD environment variable is not set');
}
await hostExec(`curl -k -u ${kismetUser}:${kismetPass} https://localhost:2501/...`);
```

**Note**: The Kismet curl command at `control/+server.ts:134` still uses `hostExec` with interpolation. After Task 2.1.2 applies input validation to this file, the credential values will come from environment variables (not user input), which is acceptable for this specific case since the credentials do not cross a shell injection boundary from external input.

**Fix pattern for OpenWebRX docker run (#8)**:

BEFORE (vulnerable):

```typescript
`docker run ... -e OPENWEBRX_ADMIN_PASSWORD=admin ...`;
```

AFTER (secure):

```typescript
const owrxPass = process.env.OPENWEBRX_PASSWORD;
if (!owrxPass) {
	throw new Error('OPENWEBRX_PASSWORD environment variable is not set');
}
`docker run ... -e OPENWEBRX_ADMIN_PASSWORD=${owrxPass} ...`;
```

### Subtask 2.1.3.2: Client-Side Credential (1 instance -- Regrade B7 addition)

| #     | File:Line                                                  | Current Value                                        | Verified    | Fix                                                                                                                                                    |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **9** | **`src/lib/components/dashboard/DashboardMap.svelte:599`** | **Stadia Maps API key embedded in client-side code** | **REGRADE** | **Move to server-side proxy; API key must never be in browser-delivered JavaScript. This is a paid service key visible in page source to every user.** |

BEFORE (vulnerable):

```svelte
<!-- DashboardMap.svelte:599 -- API key shipped to every browser -->
<script>
	const tileUrl =
		'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=ACTUAL_KEY_HERE';
</script>
```

AFTER (secure):

```typescript
// New: src/routes/api/map-tiles/[...path]/+server.ts
// Server-side proxy that adds API key on the server, never exposing it to clients
import { json } from '@sveltejs/kit';

export async function GET({ params }) {
	const apiKey = process.env.STADIA_MAPS_API_KEY;
	if (!apiKey) {
		return json({ error: 'Map tile service not configured' }, { status: 503 });
	}
	const response = await fetch(
		`https://tiles.stadiamaps.com/tiles/${params.path}?api_key=${apiKey}`
	);
	return new Response(response.body, {
		headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/png' }
	});
}
```

```svelte
<!-- DashboardMap.svelte:599 -- Updated to use server proxy -->
<script>
	const tileUrl = '/api/map-tiles/alidade_smooth_dark/{z}/{x}/{y}.png';
</script>
```

### Subtask 2.1.3.3: Config File Credential (1 instance -- Regrade B7 addition)

| #      | File:Line                      | Current Value                                  | Verified    | Fix                                                                                |
| ------ | ------------------------------ | ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **10** | **`config/opencellid.json:2`** | **OpenCellID API key (git-tracked JSON file)** | **REGRADE** | **Move to .env; add config/opencellid.json to .gitignore; rotate the exposed key** |

BEFORE (vulnerable):

```json
{
	"apiKey": "pk.d6291c07a2907c915cd8994fb22bc189"
}
```

AFTER (secure):

```json
{
	"apiKey": "SET_VIA_ENVIRONMENT_VARIABLE"
}
```

**Additional actions**:

1. Add `config/opencellid.json` to `.gitignore`
2. All code that reads this file must fall through to `process.env.OPENCELLID_API_KEY`
3. **ROTATE THE KEY**: The key `pk.d6291c07a2907c915cd8994fb22bc189` is now in git history permanently. Generate a new key from the OpenCellID dashboard and deploy it via `.env`.

### Subtask 2.1.3.4: Docker Compose Credentials (3 instances)

**File**: `docker/docker-compose.portainer-dev.yml` (EXISTS, verified)

| #   | Line | Current                                                  | Fix                                                               |
| --- | ---- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 11  | 42   | `KISMET_PASSWORD=password`                               | `KISMET_PASSWORD=${KISMET_PASSWORD:?Set KISMET_PASSWORD in .env}` |
| 12  | 121  | `OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:-hackrf}` | `${OPENWEBRX_PASSWORD:?Set OPENWEBRX_PASSWORD in .env}`           |
| 13  | 156  | `BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:-argos}`    | `${BETTERCAP_PASSWORD:?Set BETTERCAP_PASSWORD in .env}`           |

BEFORE (vulnerable):

```yaml
# Line 42: Hardcoded password
- KISMET_PASSWORD=password

# Line 121: Insecure default fallback
- OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:-hackrf}

# Line 156: Insecure default fallback
- BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:-argos}
```

AFTER (secure):

```yaml
# Line 42: Required env var, no default
- KISMET_PASSWORD=${KISMET_PASSWORD:?Set KISMET_PASSWORD in .env}

# Line 121: Required env var, no default
- OPENWEBRX_ADMIN_PASSWORD=${OPENWEBRX_PASSWORD:?Set OPENWEBRX_PASSWORD in .env}

# Line 156: Required env var, no default
- BETTERCAP_API_PASSWORD=${BETTERCAP_PASSWORD:?Set BETTERCAP_PASSWORD in .env}
```

**Note**: The `:?` syntax in Docker Compose causes `docker compose up` to fail immediately with a descriptive error if the variable is unset. This is the Docker equivalent of fail-closed behavior, consistent with the auth middleware design in Task 2.1.1.

### Subtask 2.1.3.5: Shell Script Credentials (8 instances -- expanded from 2 by Regrade B7)

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

**Fix pattern for shell scripts**:

BEFORE (vulnerable):

```bash
# Hardcoded credential in script body
OWRX_ADMIN_PASSWORD='argos123'
API_KEY='pk.d6291c07a2907c915cd8994fb22bc189'
```

AFTER (secure):

```bash
# Read from environment, fail if not set
OWRX_ADMIN_PASSWORD="${OPENWEBRX_PASSWORD:?Error: OPENWEBRX_PASSWORD not set. Set in .env or export before running.}"
API_KEY="${OPENCELLID_API_KEY:?Error: OPENCELLID_API_KEY not set. Set in .env or export before running.}"
```

**Note on WiFi AP passwords (#20, #21)**: These scripts create WiFi access points for tactical field deployment. The AP password must be configurable via environment variable or a dedicated config file (e.g., `config/ap-settings.conf`), not hardcoded in the script. In a tactical environment, AP credentials should be changed per deployment.

### Subtask 2.1.3.6: Create `docker/.env.example`

**Create**: `docker/.env.example`

```env
# =============================================================================
# Argos Docker Service Credentials
# =============================================================================
# Copy this file to docker/.env and set ALL values before running docker compose.
# Docker Compose will REFUSE TO START if any required variable is unset.
# =============================================================================

# Argos Application API Key (REQUIRED)
ARGOS_API_KEY=                    # Min 32 chars. Generate: openssl rand -hex 32

# Kismet WiFi Scanner (REQUIRED)
KISMET_USER=admin
KISMET_PASSWORD=                  # REQUIRED -- generate a strong password

# Bettercap Network Analysis (REQUIRED)
BETTERCAP_PASSWORD=               # REQUIRED -- generate a strong password

# OpenWebRX SDR Web Interface (REQUIRED)
OPENWEBRX_PASSWORD=               # REQUIRED -- generate a strong password

# OpenCellID Cell Tower Database (REQUIRED for cell tower features)
OPENCELLID_API_KEY=               # Register at opencellid.org for API key

# Stadia Maps Tile Service (REQUIRED for map display)
STADIA_MAPS_API_KEY=              # Register at stadiamaps.com for API key
```

### Subtask 2.1.3.7: Remove Unauthenticated Deploy Server

**File**: `scripts/deploy-master.sh` (EXISTS, verified)

Lines 347-368 implement a netcat HTTP server on port 8099 with:

- No authentication of any kind
- Wildcard CORS (`Access-Control-Allow-Origin: *`)
- Serves deployment status to any network requester
- Listens on all interfaces (0.0.0.0)

BEFORE (vulnerable):

```bash
# Lines 347-368: Unauthenticated netcat HTTP server
start_status_server() {
    while true; do
        echo -e "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n$(get_deploy_status)" | nc -l -p 8099 -q 1
    done
}
```

AFTER (secure):

```bash
# DELETE the entire start_status_server function and its invocation.
# Deployment status should be accessible only via:
# 1. Authenticated API endpoint (/api/system/info with API key)
# 2. System logs (journalctl -u argos-dev)
# 3. Docker logs (docker logs argos-dev)
```

**Action**: Delete lines 347-368 entirely. Remove any call to `start_status_server` in the script. Verify the script still functions without this function.

### Subtask 2.1.3.8: Verification

**Command 1 -- No hardcoded passwords in source**:

```bash
grep -rn "'password'" src/ --include="*.ts" | grep -v "node_modules\|\.d\.ts\|security_analyzer" | wc -l
```

**Expected result**: `0`

**Command 2 -- No hardcoded API keys**:

```bash
grep -rn "pk\." src/ config/ --include="*.ts" --include="*.json" --include="*.svelte" | grep -v "node_modules\|process\.env" | wc -l
```

**Expected result**: `0`

**Command 3 -- Docker Compose uses required env vars (no insecure defaults)**:

```bash
grep -c ':-\|=password\|=admin\|=hackrf\|=argos' docker/docker-compose.portainer-dev.yml
```

**Expected result**: `0`

**Command 4 -- No hardcoded credentials in scripts (expanded search)**:

```bash
grep -rn "password\|admin:admin\|argos123\|hackrf" scripts/ --include="*.sh" | grep -v ':-\|:?\|process\.env\|#' | wc -l
```

**Expected result**: `0`

## Verification Checklist

1. `grep -rn "'password'" src/ --include="*.ts" | grep -v "node_modules\|\.d\.ts\|security_analyzer" | wc -l` returns `0`
2. `grep -rn "pk\." src/ config/ --include="*.ts" --include="*.json" --include="*.svelte" | grep -v "node_modules\|process\.env" | wc -l` returns `0`
3. `grep -c ':-\|=password\|=admin\|=hackrf\|=argos' docker/docker-compose.portainer-dev.yml` returns `0`
4. `grep -rn "password\|admin:admin\|argos123\|hackrf" scripts/ --include="*.sh" | grep -v ':-\|:?\|process\.env\|#' | wc -l` returns `0`
5. `test -f docker/.env.example && echo EXISTS` returns `EXISTS`
6. `grep -c "stadiamaps\|stadia" src/lib/components/dashboard/DashboardMap.svelte` returns `0` (API key removed from client-side)
7. `grep -c "start_status_server\|nc -l" scripts/deploy-master.sh` returns `0` (netcat server removed)
8. `npm run typecheck` exits 0
9. `npm run build` exits 0
10. `docker compose -f docker/docker-compose.portainer-dev.yml config --quiet` exits 0 (YAML valid)

## Commit Strategy

```
security(phase2.1.3): remove all 21 hardcoded credentials, require env vars

Phase 2.1 Task 3: Hardcoded Credential Removal
- Removed 8 source code credential fallbacks (Kismet, OpenCellID, OpenWebRX)
- Moved Stadia Maps API key from client-side to server-side proxy
- Added config/opencellid.json to .gitignore (key in git history -- must rotate)
- Fixed 3 Docker Compose insecure defaults (Kismet, OpenWebRX, Bettercap)
- Fixed 8 shell script credentials (expanded from 2 by regrade B7)
- Created docker/.env.example with all required variables documented
- Removed unauthenticated netcat deploy server (deploy-master.sh:347-368)
Verified: grep for hardcoded passwords/API keys returns 0 across all scopes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
git reset --soft HEAD~1
```

To fully revert:

```bash
git reset --hard HEAD~1
```

Note: After rollback, all 21 credential locations return to their hardcoded state. The netcat deploy server is restored. Services will function with hardcoded defaults, but credential security is eliminated.

**IMPORTANT**: Even after this task is completed and the hardcoded values are removed from the codebase, they remain in git history. The following keys MUST be rotated:

- OpenCellID API key: `pk.d6291c07a2907c915cd8994fb22bc189` (generate new at opencellid.org)
- Stadia Maps API key (regenerate at stadiamaps.com dashboard)
- All service passwords (Kismet: `password`, OpenWebRX: `admin`/`hackrf`/`argos123`, Bettercap: `argos`)

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                                    |
| ------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------- |
| Services fail because env vars not set           | HIGH       | MEDIUM | `.env.example` and `docker/.env.example` document all required vars           |
| Operators revert to hardcoded defaults for speed | MEDIUM     | HIGH   | `:?` syntax in Docker Compose prevents startup; no fallback in source         |
| Git history still contains old credentials       | CERTAIN    | MEDIUM | Rotation procedure documented; key rotation is mandatory post-deployment      |
| Map tile proxy adds latency                      | MEDIUM     | LOW    | Proxy is simple passthrough; cache headers preserved from upstream            |
| Shell scripts fail in existing deployments       | MEDIUM     | LOW    | Scripts are run manually, not automatically; operators will see error message |

## Standards Traceability

| Standard            | Requirement                                               | How This Task Satisfies It                                                 |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| OWASP A07:2021      | Identification and Authentication Failures                | All 21 hardcoded credentials removed; env vars required                    |
| CWE-798             | Use of Hard-Coded Credentials                             | Zero hardcoded credentials in source, config, Docker, or scripts after fix |
| NIST SP 800-53 IA-5 | Authenticator Management                                  | Key rotation procedure documented; minimum key length enforced             |
| DISA STIG V-222642  | Application must not contain embedded authentication data | All authentication data externalized to environment variables              |
| OWASP A05:2021      | Security Misconfiguration (client-side key exposure)      | Stadia Maps key moved from client-side Svelte to server-side proxy         |

## Execution Tracking

| Subtask | Description                              | Status  | Started | Completed | Verified By |
| ------- | ---------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.1.3.1 | Source code credentials (8 instances)    | PENDING | --      | --        | --          |
| 2.1.3.2 | Client-side credential (DashboardMap)    | PENDING | --      | --        | --          |
| 2.1.3.3 | Config file credential (opencellid.json) | PENDING | --      | --        | --          |
| 2.1.3.4 | Docker Compose credentials (3 instances) | PENDING | --      | --        | --          |
| 2.1.3.5 | Shell script credentials (8 instances)   | PENDING | --      | --        | --          |
| 2.1.3.6 | Create docker/.env.example               | PENDING | --      | --        | --          |
| 2.1.3.7 | Remove deploy server (netcat)            | PENDING | --      | --        | --          |
| 2.1.3.8 | Verification                             | PENDING | --      | --        | --          |
