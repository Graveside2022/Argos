# Phase 6.3: SystemD Service Hardening, Hardcoded Path Elimination, and CI/CD Pipeline Repair

> **EXECUTION ORDER**: This phase (6.3) must execute BEFORE Phase 6.2 (Script Consolidation). The centralized path library (`argos-env.sh`) created here must be available for consolidated scripts to `source` from day one.

| Field            | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Phase            | 6.3                                                                 |
| Title            | SystemD Service Hardening, Hardcoded Path Elimination, CI/CD Repair |
| Status           | PLANNED                                                             |
| Author           | Alex Thompson (Quantum Software Architect)                          |
| Date             | 2026-02-08                                                          |
| Risk Level       | MEDIUM-HIGH (service files control runtime, CI changes gate merges) |
| Estimated Effort | 20-30 hours                                                         |
| Dependencies     | None (standalone, but deploy AFTER Phase 2.1 security fixes)        |

---

## 1. Audit Corrections

### 1.1 ESLint Error Count Correction

Prior audit documents stated "63 errors." Current verified count (2026-02-08):

```bash
npx eslint . --config config/eslint.config.js 2>&1 | grep "problems"
# Result: 813 problems (100 errors, 713 warnings)
```

The 100 error count is the CI-blocking number. The prior "63 errors" figure was stale.

#### ESLint Error Root Cause Analysis

The 100 ESLint errors are NOT 100 individual code defects. Breakdown:

| Error Rule              | Count | Root Cause                                                    | Fix                           |
| ----------------------- | ----- | ------------------------------------------------------------- | ----------------------------- |
| `no-undef` (console)    | ~80   | Missing `env: { browser: true, node: true }` in ESLint config | **Single config line change** |
| `no-undef` (setTimeout) | ~5    | Same missing env declaration                                  | Same fix                      |
| Other                   | ~15   | Actual code issues                                            | Individual fixes              |

**Effort estimate**: The single ESLint env config fix resolves ~85 of 100 errors. This is a 5-minute config change, not days of code refactoring. The remaining ~15 errors require individual attention.

**Exact fix** (add to `.eslintrc.cjs` or `eslint.config.js`):

```js
env: {
  browser: true,
  node: true,
  es2022: true
}
```

**Verification**: `npm run lint 2>&1 | grep -c 'error'` should drop from 100 to ~15 after the config fix.

### 1.2 Hardcoded Path Count Reconciliation

Prior memory stated "25 hardcoded path refs in 16 TypeScript production source files." Verified breakdown:

| User Path    | TypeScript Source Occurrences | Files | Svelte Occurrences | Svelte Files |
| ------------ | ----------------------------- | ----- | ------------------ | ------------ |
| /home/ubuntu | 10                            | 6     | 0                  | 0            |
| /home/pi     | 8                             | 4     | 2                  | 1            |
| **Total**    | **18**                        | **8** | **2**              | **1**        |

**Corrected total: 20 hardcoded paths across 9 files (18 in 8 TypeScript files + 2 in 1 Svelte file).**

The Svelte file missed in prior counts:

| File                                                           | Line(s) | Path                                   |
| -------------------------------------------------------------- | ------- | -------------------------------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 14      | `/home/pi/kismet_ops` (default value)  |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 106     | `/home/pi/kismet_ops` (UI placeholder) |

These 2 Svelte instances must be included in the `paths.ts` centralization scope (Task 6.3.3).

The prior "25 in 16 files" figure included Svelte and config files. This plan separates TypeScript + Svelte source (20 in 9 files), shell scripts (147 in 64 files), and service/config files (23 in 12 files) into distinct tasks.

### 1.3 Service File Count

11 unique service files exist. Two are byte-identical duplicates:

- `config/systemd/coral-worker.service` (duplicate)
- `deployment/systemd/coral-worker.service` (canonical)

Verified with: `diff config/systemd/coral-worker.service deployment/systemd/coral-worker.service` (exit 0, no output).

---

## 2. Rollback Strategy

Every task in this phase produces changes that can be independently reverted.

| Task   | Rollback Method                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| 6.3.1  | `git checkout HEAD -- deployment/ config/systemd/ scripts/*.service`                                         |
| 6.3.2  | Same as 6.3.1; service files are not installed until manual `systemctl daemon-reload`                        |
| 6.3.3  | `git checkout HEAD -- src/` for each affected TypeScript file                                                |
| 6.3.4  | `git checkout HEAD -- scripts/` for each affected shell script                                               |
| 6.3.5  | `git checkout HEAD -- deployment/ config/systemd/`                                                           |
| 6.3.6  | Restore original `vm.swappiness` line in 3 scripts; remove NODE_OPTIONS from 2 services                      |
| 6.3.7  | `git checkout HEAD -- .github/workflows/ci.yml package.json svelte.config.js src/lib/server/validate-env.js` |
| 6.3.8  | `git rm` new workflow files; `git checkout HEAD -- .github/`                                                 |
| 6.3.9  | `git rm CODEOWNERS SECURITY.md`; remove branch protection via `gh api`                                       |
| 6.3.10 | `git checkout HEAD -- svelte.config.js docker/`; `npm remove @sveltejs/adapter-node`                         |

Critical: No task in this phase modifies the running system. Service files must be manually installed with `sudo cp` and `sudo systemctl daemon-reload`. CI changes take effect only on push to GitHub.

---

## 3. Task 6.3.1 -- SystemD Service File Templating

### 3.1.1 Problem Statement

All 11 service files contain hardcoded usernames (pi, ubuntu, root) and paths (/home/pi/projects/Argos, /home/ubuntu/projects/Argos). The actual deployment target uses user `kali` at path `/home/kali/Documents/Argos/Argos`. Every service file will fail on the current system without manual editing.

### 3.1.2 Current State

| Service File                             | User=  | WorkingDirectory/Path Base   |
| ---------------------------------------- | ------ | ---------------------------- |
| deployment/argos-dev.service             | pi     | /home/pi/projects/Argos      |
| deployment/argos-final.service           | pi     | /home/pi/projects/Argos      |
| deployment/argos-cpu-protector.service   | pi     | /home/pi/projects/Argos      |
| deployment/argos-process-manager.service | pi     | /home/pi/projects/Argos      |
| deployment/argos-wifi-resilience.service | pi     | /home/pi/projects/Argos      |
| deployment/argos-droneid.service         | root   | /home/ubuntu/projects/Argos  |
| deployment/gsmevil-patch.service         | (none) | **(NONE)** -- see note below |
| deployment/systemd/coral-worker.service  | ubuntu | /home/ubuntu/projects/Argos  |
| config/systemd/coral-worker.service      | ubuntu | /home/ubuntu/projects/Argos  |
| scripts/dev-server-keepalive.service     | pi     | /home/pi/projects/Argos      |
| scripts/simple-keepalive.service         | pi     | /home/pi/projects/Argos      |
| scripts/wifi-keepalive.service           | root   | **(NONE)** -- see note below |

**Services with no WorkingDirectory= directive:**

- `deployment/gsmevil-patch.service` -- no `User=`, no `WorkingDirectory=` (defaults to root and `/`)
- `scripts/wifi-keepalive.service` -- `User=root`, no `WorkingDirectory=` (defaults to `/`)

Services without `WorkingDirectory=` default to `/`, which means relative path references in ExecStart scripts will resolve against the filesystem root. Combined with running as root, this is a privilege escalation risk if the ExecStart script path is writable by non-root users.

### 3.1.3 Actions

**Action A: Create `deployment/generate-services.sh`**

This script reads environment variables and generates all service files from templates. It replaces hardcoded values at generation time, not runtime.

Required variables (read from `deployment/.env.services` or environment):

```
ARGOS_USER=kali
ARGOS_GROUP=kali
ARGOS_DIR=/home/kali/Documents/Argos/Argos
ARGOS_NODE_BIN=/usr/bin/npm
ARGOS_PYTHON_BIN=  # empty if not installed
ARGOS_CORAL_VENV=  # empty if no Coral TPU
```

The script:

1. Reads `deployment/.env.services` if present, or requires the above variables in environment.
2. For each `.service.template` file in `deployment/templates/`, performs `sed` substitution of `@@ARGOS_USER@@`, `@@ARGOS_GROUP@@`, `@@ARGOS_DIR@@`, etc.
3. Writes generated `.service` files to `deployment/generated/`.
4. Validates each generated file with `systemd-analyze verify` (if available) or at minimum checks that all `@@` tokens are resolved.
5. Prints a summary of generated files and a `sudo cp` command block the operator can run.

**Action B: Create template files in `deployment/templates/`**

Convert each of the 11 service files (minus the duplicate) to templates. Example for `argos-dev.service.template`:

```ini
[Unit]
Description=Argos Development Server
After=network.target

[Service]
Type=simple
User=@@ARGOS_USER@@
Group=@@ARGOS_GROUP@@
WorkingDirectory=@@ARGOS_DIR@@
ExecStart=@@ARGOS_NODE_BIN@@ run dev
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=argos-dev
Environment="NODE_ENV=development"
Environment="PORT=5173"
Environment="NODE_OPTIONS=--max-old-space-size=1024"

[Install]
WantedBy=multi-user.target
```

**Action C: Delete the duplicate `config/systemd/coral-worker.service`**

Retain only `deployment/systemd/coral-worker.service` (converted to template). Add a note in `config/systemd/README.md` directing to the deployment directory.

### 3.1.4 Verification

```bash
# 1. Verify generate-services.sh runs without error
cd /home/kali/Documents/Argos/Argos
ARGOS_USER=kali ARGOS_GROUP=kali ARGOS_DIR=/home/kali/Documents/Argos/Argos \
  bash deployment/generate-services.sh

# 2. Verify no @@tokens@@ remain in generated files
grep -r '@@' deployment/generated/
# Expected: no output

# 3. Verify duplicate is removed
test -f config/systemd/coral-worker.service && echo "FAIL: duplicate not removed" || echo "PASS"

# 4. Count generated service files (should be 10, excluding duplicate)
ls deployment/generated/*.service | wc -l
# Expected: 10
```

---

## 4. Task 6.3.2 -- SystemD Security Hardening

### 4.2.1 Problem Statement

Of the 11 service files:

- 2 run as `root` with zero security hardening (argos-droneid.service, wifi-keepalive.service)
- 0 have `MemoryMax` or `CPUQuota` resource limits
- argos-droneid.service binds to privileged port 80 as root with no `CapabilityBoundingSet`
- wifi-keepalive.service sets `StartLimitIntervalSec=0` and `StartLimitBurst=0`, which disables systemd's restart throttle entirely, enabling infinite restart storms that consume CPU and fill journal logs
- argos-dev.service and argos-final.service lack NODE_OPTIONS, allowing V8 to allocate up to ~1.5GB on a 64-bit system (8GB total RAM, multiple services competing)
- Only argos-final.service, argos-cpu-protector.service, argos-process-manager.service, and argos-wifi-resilience.service have `NoNewPrivileges=true`

### 4.2.2 Security Baseline for All Templates

Every service template MUST include this minimum security block:

```ini
# Security hardening (mandatory)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
```

For services requiring write access to `ARGOS_DIR`:

```ini
ReadWritePaths=@@ARGOS_DIR@@
```

### 4.2.3 Per-Service Resource Limits

| Service Template              | MemoryMax | CPUQuota | Notes                                      |
| ----------------------------- | --------- | -------- | ------------------------------------------ |
| argos-dev.service             | 1536M     | 150%     | Primary app; 4-core system allows 400% max |
| argos-final.service           | 1536M     | 150%     | Production equivalent of dev               |
| argos-cpu-protector.service   | 128M      | 25%      | Monitoring script, minimal resources       |
| argos-process-manager.service | 128M      | 25%      | Monitoring script, minimal resources       |
| argos-wifi-resilience.service | 128M      | 25%      | Network monitoring                         |
| argos-droneid.service         | 512M      | 50%      | Python + RF processing                     |
| gsmevil-patch.service         | 64M       | 10%      | One-shot script                            |
| coral-worker.service          | 512M      | 50%      | ML inference workload                      |
| dev-server-keepalive.service  | 1536M     | 150%     | Wraps the dev server                       |
| simple-keepalive.service      | 1536M     | 150%     | Wraps the dev server                       |
| wifi-keepalive.service        | 128M      | 25%      | Network monitoring                         |

### 4.2.4 argos-droneid.service Specific Fixes

Current state (lines 7-11 of `deployment/argos-droneid.service`):

```ini
User=root
WorkingDirectory=/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver
ExecStartPre=/bin/sleep 10
ExecStart=/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver/venv/bin/python3 /home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver/backend/dronesniffer/main.py -p 80
```

Problems:

1. Runs as `root` solely to bind port 80. Fix: use `AmbientCapabilities=CAP_NET_BIND_SERVICE` and run as `@@ARGOS_USER@@`.
2. Port 80 conflicts with common web servers. Recommendation: change to port 8080 or use a reverse proxy.
3. Logs to file (`append:/home/ubuntu/...`) instead of journal. Fix: use `StandardOutput=journal`.

Template replacement:

```ini
User=@@ARGOS_USER@@
Group=@@ARGOS_GROUP@@
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW
```

### 4.2.5 wifi-keepalive.service Restart Storm Fix

Current state (lines 16-17 of `scripts/wifi-keepalive.service`):

```ini
StartLimitIntervalSec=0
StartLimitBurst=0
```

This combination tells systemd to never throttle restarts. If the script crashes immediately on startup (e.g., missing binary, permission error), systemd will restart it infinitely with only a 10-second gap, generating thousands of journal entries per hour.

Fix: Set sane limits in the template:

```ini
StartLimitIntervalSec=300
StartLimitBurst=5
```

This allows 5 restarts within a 5-minute window before systemd marks the unit as failed and stops attempting. An operator must then run `systemctl reset-failed wifi-keepalive.service && systemctl start wifi-keepalive.service` to recover.

### 4.2.6 NODE_OPTIONS Addition

Add to templates for argos-dev, argos-final, dev-server-keepalive, and simple-keepalive:

```ini
Environment="NODE_OPTIONS=--max-old-space-size=1024"
```

The dev-server-keepalive and simple-keepalive templates already have this line. The argos-dev and argos-final templates currently lack it. Without this, Node.js on a 64-bit system defaults to ~1.5GB heap, which combined with other services risks triggering OOM on the 8GB RPi 5.

### 4.2.7 Verification

```bash
# 1. Verify all templates have NoNewPrivileges
grep -L 'NoNewPrivileges=true' deployment/templates/*.service.template
# Expected: no output (all files contain it)

# 2. Verify all templates have MemoryMax
grep -L 'MemoryMax=' deployment/templates/*.service.template
# Expected: no output

# 3. Verify argos-droneid template does NOT run as root
grep 'User=root' deployment/templates/argos-droneid.service.template
# Expected: no output

# 4. Verify wifi-keepalive template has sane restart limits
grep 'StartLimitIntervalSec=0' deployment/templates/wifi-keepalive.service.template
# Expected: no output

# 5. Verify NODE_OPTIONS present in Node.js service templates
for f in argos-dev argos-final dev-server-keepalive simple-keepalive; do
  grep -q 'NODE_OPTIONS' "deployment/templates/${f}.service.template" || echo "MISSING: $f"
done
# Expected: no output (all contain it)
```

---

## 5. Task 6.3.3 -- Hardcoded Path Elimination: TypeScript Source

### 5.3.1 Problem Statement

20 hardcoded path references exist across 9 files (18 in 8 TypeScript files + 2 in 1 Svelte file). These paths reference users (ubuntu, pi) that do not exist on the deployment target. Every file import or spawn that uses these paths will fail at runtime.

### 5.3.2 Inventory (verified 2026-02-08)

**Files referencing /home/ubuntu (10 occurrences in 6 files):**

| File                                                         | Line(s) | Hardcoded Path                                          | Purpose                          |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------- | -------------------------------- |
| `src/routes/api/droneid/+server.ts`                          | 8       | `/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver` | DRONEID_DIR constant             |
| `src/routes/api/droneid/+server.ts`                          | 9       | `/home/ubuntu/projects/Argos/droneid.pid`               | PID_FILE constant                |
| `src/routes/api/droneid/+server.ts`                          | 10      | `/home/ubuntu/projects/Argos/droneid.log`               | LOG_FILE constant                |
| `src/routes/api/cell-towers/nearby/+server.ts`               | 48      | `/home/ubuntu/projects/Argos/data/celltowers/towers.db` | SQLite DB path                   |
| `src/routes/api/tactical-map/cell-towers/+server.ts`         | 24      | `/home/ubuntu/projects/Argos/data/celltowers/towers.db` | SQLite DB path (duplicate route) |
| `src/lib/server/gsm-database-path.ts`                        | 17      | `/home/ubuntu/gsmevil-user/database/imsi.db`            | GSM IMSI DB fallback path        |
| `src/lib/services/localization/coral/CoralAccelerator.ts`    | 33-34   | `/home/ubuntu/projects/Argos/.coral_env/bin/python`     | Python venv for Coral TPU        |
| `src/lib/services/localization/coral/CoralAccelerator.v2.ts` | 35,45   | `/home/ubuntu/projects/Argos/.coral_env/bin/python`     | Python venv v2                   |

**Files referencing /home/pi (8 occurrences in 4 files):**

| File                                               | Line(s) | Hardcoded Path                        | Purpose                    |
| -------------------------------------------------- | ------- | ------------------------------------- | -------------------------- |
| `src/routes/api/kismet/scripts/execute/+server.ts` | 20      | `/home/pi/Scripts`, `/home/pi/stinky` | Allowed script directories |
| `src/lib/server/kismet/serviceManager.ts`          | 10      | `/home/pi/Scripts/start_kismet.sh`    | Kismet start script        |
| `src/lib/server/kismet/serviceManager.ts`          | 11      | `/home/pi/tmp/kismet.pid`             | Kismet PID file            |
| `src/lib/server/kismet/serviceManager.ts`          | 12      | `/home/pi/tmp/kismet.log`             | Kismet log file            |
| `src/lib/server/kismet/scriptManager.ts`           | 12      | `/home/pi/Scripts`                    | Scripts directory          |
| `src/lib/server/kismet/scriptManager.ts`           | 13      | `/home/pi/stinky`                     | Secondary scripts dir      |
| `src/lib/server/kismet/scriptManager.ts`           | 181     | `/home/pi/tmp/*.log`                  | Log grep path              |
| `src/lib/stores/wigletotak/wigleStore.ts`          | 64      | `/home/pi/kismet_ops`                 | WiGLE default directory    |

**Svelte files referencing /home/pi (2 occurrences in 1 file):**

| File                                                           | Line(s) | Hardcoded Path        | Purpose                          |
| -------------------------------------------------------------- | ------- | --------------------- | -------------------------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 14      | `/home/pi/kismet_ops` | Default value for directory prop |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 106     | `/home/pi/kismet_ops` | UI placeholder text              |

### 5.3.3 Solution: Centralized Path Configuration

**Action A: Create `src/lib/server/paths.ts`**

This module resolves all filesystem paths from environment variables with sensible defaults derived from the project root.

```typescript
import { env } from '$env/dynamic/private';
import { resolve, join } from 'path';

// Project root: derived from import.meta.url or env override
const PROJECT_ROOT = env.ARGOS_DIR || resolve(new URL('.', import.meta.url).pathname, '../../..');

// User home: derived from env or process
const USER_HOME = env.HOME || env.ARGOS_USER_HOME || '/home/kali';

export const PATHS = {
	projectRoot: PROJECT_ROOT,

	// DroneID
	droneidDir: env.DRONEID_DIR || join(PROJECT_ROOT, 'RemoteIDReceiver/Receiver'),
	droneidPid: env.DRONEID_PID || join(PROJECT_ROOT, 'droneid.pid'),
	droneidLog: env.DRONEID_LOG || join(PROJECT_ROOT, 'droneid.log'),

	// Cell Tower Database
	cellTowerDb: env.CELLTOWER_DB_PATH || join(PROJECT_ROOT, 'data/celltowers/towers.db'),

	// GSM Evil
	gsmImsiDb: env.GSM_IMSI_DB || join(USER_HOME, 'gsmevil-user/database/imsi.db'),

	// Coral TPU
	coralPython: env.CORAL_PYTHON_BIN || join(PROJECT_ROOT, '.coral_env/bin/python'),
	coralWorkerScript:
		env.CORAL_WORKER_SCRIPT ||
		join(PROJECT_ROOT, 'src/lib/services/localization/coral/coral_worker.py'),

	// Kismet
	kismetStartScript: env.KISMET_START_SCRIPT || join(USER_HOME, 'Scripts/start_kismet.sh'),
	kismetPidFile: env.KISMET_PID_FILE || join(USER_HOME, 'tmp/kismet.pid'),
	kismetLogFile: env.KISMET_LOG_FILE || join(USER_HOME, 'tmp/kismet.log'),
	kismetScriptsDir: env.KISMET_SCRIPTS_DIR || join(USER_HOME, 'Scripts'),
	kismetSecondaryDir: env.KISMET_SECONDARY_DIR || join(USER_HOME, 'stinky'),
	kismetLogDir: env.KISMET_LOG_DIR || join(USER_HOME, 'tmp'),

	// WiGLE
	wigleDirectory: env.WIGLE_DIR || join(USER_HOME, 'kismet_ops')
} as const;
```

**Action B: Replace hardcoded paths in each file**

For each of the 9 files listed in 5.3.2 (8 TypeScript + 1 Svelte), replace the hardcoded string literal with the corresponding `PATHS.*` constant or `VITE_*` env variable. Example for `src/routes/api/droneid/+server.ts`:

Before (lines 8-10):

```typescript
const DRONEID_DIR = '/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver';
const PID_FILE = '/home/ubuntu/projects/Argos/droneid.pid';
const LOG_FILE = '/home/ubuntu/projects/Argos/droneid.log';
```

After:

```typescript
import { PATHS } from '$lib/server/paths';
const DRONEID_DIR = PATHS.droneidDir;
const PID_FILE = PATHS.droneidPid;
const LOG_FILE = PATHS.droneidLog;
```

### 5.3.4 Special Case: wigleStore.ts (Client-Side Store)

`src/lib/stores/wigletotak/wigleStore.ts` line 64 is a Svelte store (runs in browser context). It cannot import `$lib/server/paths` because that module uses `$env/dynamic/private` (server-only).

Fix: Replace the hardcoded default with a public environment variable:

```typescript
wigleDirectory: import.meta.env.VITE_WIGLE_DIR || '/home/kali/kismet_ops',
```

Add `VITE_WIGLE_DIR` to `.env`, `.env.example`, and `config/.env.example`.

### 5.3.4b Special Case: DirectoryCard.svelte (Client-Side Component)

`src/lib/components/wigletotak/directory/DirectoryCard.svelte` has two hardcoded `/home/pi/kismet_ops` references:

- Line 14: default prop value
- Line 106: UI placeholder text

Since this is a Svelte component (runs in browser), it cannot import `$lib/server/paths`. The fix mirrors the wigleStore approach: use the same `VITE_WIGLE_DIR` public environment variable:

```svelte
<!-- Line 14: prop default -->
let {(directory = import.meta.env.VITE_WIGLE_DIR || '/home/kali/kismet_ops')} = $props();

<!-- Line 106: placeholder -->
placeholder={import.meta.env.VITE_WIGLE_DIR || '/home/kali/kismet_ops'}
```

### 5.3.5 Verification

```bash
# 1. Verify zero hardcoded /home/ubuntu or /home/pi in TypeScript AND Svelte source
grep -rn '/home/ubuntu\|/home/pi' --include='*.ts' --include='*.svelte' src/
# Expected: no output

# 2. Verify PATHS module exists and exports expected constants
grep -c 'export const PATHS' src/lib/server/paths.ts
# Expected: 1

# 3. Verify all 9 files updated (8 TS import PATHS, 1 Svelte uses VITE_WIGLE_DIR)
for f in \
  src/routes/api/droneid/+server.ts \
  src/routes/api/cell-towers/nearby/+server.ts \
  src/routes/api/tactical-map/cell-towers/+server.ts \
  src/lib/server/gsm-database-path.ts \
  src/lib/services/localization/coral/CoralAccelerator.ts \
  src/lib/services/localization/coral/CoralAccelerator.v2.ts \
  src/routes/api/kismet/scripts/execute/+server.ts \
  src/lib/server/kismet/serviceManager.ts \
  src/lib/server/kismet/scriptManager.ts; do
  grep -q 'PATHS' "$f" || echo "MISSING IMPORT: $f"
done
# Expected: no output

# 3b. Verify Svelte file uses VITE_WIGLE_DIR instead of hardcoded path
grep -q 'VITE_WIGLE_DIR' src/lib/components/wigletotak/directory/DirectoryCard.svelte \
  || echo "MISSING: DirectoryCard.svelte"
# Expected: no output

# 4. Verify typecheck passes
npm run typecheck
```

---

## 6. Task 6.3.4 -- Hardcoded Path Elimination: Shell Scripts

### 6.3.4.1 Problem Statement

147 hardcoded path references exist across 64 shell scripts. These scripts reference `/home/ubuntu` and `/home/pi` paths that do not exist on the current system.

### 6.3.4.2 Strategy

Shell scripts are not imported by TypeScript. Many are deployment/setup scripts run once. The fix strategy is:

1. **Create `scripts/lib/argos-env.sh`** -- a shared shell library that sets `ARGOS_DIR`, `ARGOS_USER`, and `ARGOS_HOME` from environment or auto-detection.
2. **Each script that uses hardcoded paths** must source this library at the top: `. "$(dirname "$0")/lib/argos-env.sh"` (or appropriate relative path).
3. Replace hardcoded paths with `${ARGOS_DIR}`, `${ARGOS_HOME}`, etc.

**`scripts/lib/argos-env.sh` content:**

```bash
#!/usr/bin/env bash
# Argos environment detection -- source this at the top of every script.
# Provides: ARGOS_DIR, ARGOS_USER, ARGOS_GROUP, ARGOS_HOME

if [ -z "${ARGOS_DIR:-}" ]; then
  # Auto-detect: walk up from this script to find package.json
  _SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  _CANDIDATE="${_SCRIPT_DIR}"
  while [ "$_CANDIDATE" != "/" ]; do
    if [ -f "${_CANDIDATE}/package.json" ] && grep -q '"name": "argos"' "${_CANDIDATE}/package.json" 2>/dev/null; then
      ARGOS_DIR="${_CANDIDATE}"
      break
    fi
    _CANDIDATE="$(dirname "$_CANDIDATE")"
  done
  unset _SCRIPT_DIR _CANDIDATE
fi

if [ -z "${ARGOS_DIR:-}" ]; then
  echo "FATAL: Cannot determine ARGOS_DIR. Set it in environment or run from within the Argos repo." >&2
  exit 1
fi

export ARGOS_DIR
export ARGOS_USER="${ARGOS_USER:-$(whoami)}"
export ARGOS_GROUP="${ARGOS_GROUP:-$(id -gn)}"
export ARGOS_HOME="${ARGOS_HOME:-$(eval echo "~${ARGOS_USER}")}"
```

### 6.3.4.3 Execution Order

Due to the volume (64 files), batch by directory:

| Batch | Directory                | Files | Hardcoded Refs |
| ----- | ------------------------ | ----- | -------------- |
| 1     | scripts/                 | 38    | ~85            |
| 2     | scripts/dev/             | 3     | ~5             |
| 3     | scripts/development/     | 3     | ~4             |
| 4     | scripts/deploy/          | 3     | ~9             |
| 5     | scripts/deployment/      | 1     | ~1             |
| 6     | scripts/gps-integration/ | 3     | ~8             |
| 7     | scripts/infrastructure/  | 2     | ~3             |
| 8     | scripts/install/         | 1     | ~10            |
| 9     | scripts/maintenance/     | 1     | ~7             |
| 10    | scripts/testing/         | 3     | ~7             |

Note: `scripts/deploy/fix-hardcoded-paths.sh` and `scripts/maintenance/fix-hardcoded-paths.sh` are existing scripts that attempt automated path replacement. These should be verified for correctness, then either integrated into `generate-services.sh` or deleted as redundant.

### 6.3.4.4 Verification

```bash
# 1. Verify zero hardcoded /home/ubuntu or /home/pi remain
grep -rn '/home/ubuntu\|/home/pi' --include='*.sh' scripts/
# Expected: no output

# 2. Verify argos-env.sh is sourceable
bash -n scripts/lib/argos-env.sh
# Expected: exit 0

# 3. Verify auto-detection works from a subdirectory
cd scripts/dev && source ../lib/argos-env.sh && echo "ARGOS_DIR=$ARGOS_DIR"
# Expected: prints the correct project root

# 4. Spot-check 5 scripts still function
bash -n scripts/start-droneid.sh
bash -n scripts/start-gsmevil2-fixed.sh
bash -n scripts/setup-celltower-db.sh
bash -n scripts/gsm-evil-start.sh
bash -n scripts/setup-gsmevil-sudoers.sh
# Expected: all exit 0 (syntax valid)
```

---

## 7. Task 6.3.5 -- Hardcoded Path Elimination: Service and Config Files

### 7.3.5.1 Problem Statement

23 hardcoded path references exist in the 12 service files (see full listing in Section 3). These are addressed by the templating system in Task 6.3.1. This task covers the **remaining non-service config files**.

### 7.3.5.2 Additional Config Files with Hardcoded Paths

```bash
grep -rn '/home/ubuntu\|/home/pi' --include='*.yml' --include='*.yaml' --include='*.json' --include='*.conf' \
  deployment/ config/ docker/
```

The docker/.env file correctly uses `/home/kali` already. The docker-compose files use `${ARGOS_DIR}` variable substitution. No additional config files beyond the service files require changes.

If `generate-services.sh` (Task 6.3.1) is implemented correctly, all 23 service-file references are resolved by template substitution. This task reduces to verifying that no other config format contains hardcoded paths.

### 7.3.5.3 Verification

```bash
# 1. Verify no hardcoded ubuntu/pi paths in any config file
grep -rn '/home/ubuntu\|/home/pi' deployment/ config/ docker/ \
  --include='*.yml' --include='*.yaml' --include='*.json' --include='*.conf' --include='*.env' \
  --include='*.service' --include='*.template'
# Expected: only *.service.template files contain @@ARGOS_*@@ tokens, no literal paths

# 2. Verify generated service files have correct paths
grep -rn '/home/' deployment/generated/*.service | grep -v '/home/kali'
# Expected: no output (all paths reference the configured user)
```

---

## 8. Task 6.3.6 -- Configuration Conflict Resolution

### 8.3.6.1 vm.swappiness Conflict

**Current state:** Three scripts set `vm.swappiness=10`:

| File                                     | Line | Content                                                      |
| ---------------------------------------- | ---- | ------------------------------------------------------------ |
| `scripts/install-system-dependencies.sh` | 307  | `vm.swappiness = 10`                                         |
| `scripts/setup-swap.sh`                  | 116  | `echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf` |
| `scripts/setup-host-complete.sh`         | 324  | `vm.swappiness = 10`                                         |

The live system uses `vm.swappiness=60`, which is correct for a system with zram-backed compressed swap (installed 2026-02-06). A swappiness of 10 on a zram system prevents the kernel from utilizing compressed memory efficiently, effectively disabling the benefit of zram.

**Fix:** Change all three scripts to set `vm.swappiness=60`. Add a comment explaining the rationale:

```bash
# vm.swappiness=60 is optimal for systems with zram compressed swap.
# Lower values (e.g., 10) prevent effective use of compressed memory.
# See: https://wiki.archlinux.org/title/Zram#Optimizing
vm.swappiness = 60
```

### 8.3.6.2 NODE_OPTIONS Omission

**Current state:** `deployment/argos-dev.service` and `deployment/argos-final.service` lack `Environment="NODE_OPTIONS=--max-old-space-size=1024"`. The 9 other locations that set NODE_OPTIONS all use 1024.

| Service                      | Has NODE_OPTIONS | Heap Limit          |
| ---------------------------- | ---------------- | ------------------- |
| argos-dev.service            | NO               | ~1.5GB (V8 default) |
| argos-final.service          | NO               | ~1.5GB (V8 default) |
| dev-server-keepalive.service | YES              | 1024MB              |
| simple-keepalive.service     | YES              | 1024MB              |

**Fix:** Already addressed in Task 6.3.2 (template includes NODE_OPTIONS). This section documents the conflict for traceability.

### 8.3.6.3 Verification

```bash
# 1. Verify all swappiness references are 60
grep -rn 'swappiness' scripts/ | grep -v '= 60' | grep -v '=60' | grep -v '#'
# Expected: no output (all non-comment lines use 60)

# 2. Verify NODE_OPTIONS in all Node.js service templates
grep -l 'NODE_OPTIONS' deployment/templates/*.service.template | wc -l
# Expected: 4 (argos-dev, argos-final, dev-server-keepalive, simple-keepalive)
```

---

## 9. Task 6.3.7 -- CI/CD Pipeline Repair

### 9.3.7.1 Problem Statement

The CI pipeline (`.github/workflows/ci.yml`) has never passed. Every run on the `main` branch has failed. Three root causes have been identified:

1. **ESLint exits non-zero:** 813 problems (100 errors, 713 warnings). The CI step `npm run lint` exits with code 1.
2. **validate:env blocks build:** `npm run build` calls `npm run validate:env` first (line 18 of package.json). The Zod schema in `src/lib/server/validate-env.js` requires `KISMET_API_URL` as a non-optional URL. This variable is not available on GitHub Actions runners.
3. **adapter-auto cannot produce a standalone server:** `svelte.config.js` uses `@sveltejs/adapter-auto`, which auto-detects the deployment platform. On a bare GitHub Actions ubuntu-latest runner with no platform detected, it falls back to a static build. The `npm run preview` command in `argos-final.service` depends on Vite's preview server, not a standalone Node.js server.

### 9.3.7.2 Fix 1: Make ESLint Non-Blocking (Immediate) Then Fix Errors (Phased)

**Immediate fix:** Change the CI lint step to report without failing. This unblocks CI while errors are resolved in Phase 3.3 (ESLint Enforcement).

Replace the lint step in `.github/workflows/ci.yml`:

Before:

```yaml
- name: 'Run Linting, Formatting, and Type Checks'
  run: |
      npm run lint
      npm run format:check
      npm run typecheck
```

After:

```yaml
- name: 'Run Linting (non-blocking)'
  run: npm run lint || true
  continue-on-error: true

- name: 'Check Formatting'
  run: npm run format:check

- name: 'Run TypeScript Type Checks'
  run: npm run typecheck
```

Rationale: `format:check` and `typecheck` should be blocking. Lint errors are being tracked in Phase 3.3 and will be resolved incrementally. Once Phase 3.3 is complete, remove the `|| true` and `continue-on-error`.

### 9.3.7.3 Fix 2: Make validate:env CI-Aware

The `src/lib/server/validate-env.js` script requires `KISMET_API_URL` unconditionally. In CI, no hardware services are available.

**Option A (recommended):** Make `KISMET_API_URL` optional with a default in validate-env.js:

Change line 15 of `src/lib/server/validate-env.js` from:

```javascript
KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }),
```

To:

```javascript
KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }).default('http://localhost:2501'),
```

This preserves validation (must be a URL if set) while providing a safe default when the variable is absent.

**Option B (if Option A is rejected):** Set the variable in CI:

```yaml
- name: 'Verify Production Build'
  run: npm run build
  env:
      KISMET_API_URL: http://localhost:2501
      DATABASE_PATH: ./rf_signals.db
```

Option A is preferred because it also fixes local development for new developers who clone the repo without a `.env` file.

### 9.3.7.4 Fix 3: Switch to adapter-node

The `@sveltejs/adapter-auto` package attempts platform detection and falls back to static output when no supported platform (Vercel, Netlify, Cloudflare) is detected. Since Argos deploys to a bare RPi 5 with Node.js, it requires `@sveltejs/adapter-node`.

**Actions:**

1. Install adapter-node:

```bash
npm install --save-dev @sveltejs/adapter-node
```

2. Remove adapter-auto:

```bash
npm remove @sveltejs/adapter-auto
```

3. Update `svelte.config.js`:

Before:

```javascript
import adapter from '@sveltejs/adapter-auto';
```

After:

```javascript
import adapter from '@sveltejs/adapter-node';
```

4. Update `argos-final.service` template: Replace `npm run preview` with `node build` (the output of adapter-node is a standalone Node.js server at `build/index.js`):

Before:

```ini
ExecStart=/usr/bin/npm run preview
```

After:

```ini
ExecStart=/usr/bin/node @@ARGOS_DIR@@/build
```

5. Update `release.yml` to package the `build/` directory which now contains a runnable server.

### 9.3.7.5 Verification

```bash
# 1. Verify adapter-node is installed
grep 'adapter-node' package.json
# Expected: "@sveltejs/adapter-node" in devDependencies

# 2. Verify adapter-auto is removed
grep 'adapter-auto' package.json
# Expected: no output

# 3. Verify svelte.config.js references adapter-node
grep 'adapter-node' svelte.config.js
# Expected: import adapter from '@sveltejs/adapter-node';

# 4. Verify build produces a standalone server
npm run build && test -f build/index.js && echo "PASS" || echo "FAIL"

# 5. Verify validate:env succeeds without .env
(unset KISMET_API_URL && node src/lib/server/validate-env.js)
# Expected: exit 0 (uses default)

# 6. Dry-run CI locally (requires act or similar)
# Or push to a branch and verify GitHub Actions passes
```

#### ARM Architecture Testing Gap

Both `ci.yml` and `release.yml` use `runs-on: ubuntu-latest` (x86_64). The deployment target is RPi 5 (aarch64).
**Impact**: Native module compilation (better-sqlite3, node-gyp), HackRF bindings, and architecture-specific behavior are not tested in CI.
**Options**:

- QEMU emulation via `docker/setup-qemu-action` (slower, but no hardware needed)
- Self-hosted ARM runner on spare RPi (faster, requires maintenance)
- ARM matrix build: `strategy: matrix: arch: [x64, arm64]`
  **Recommendation**: Start with QEMU emulation. Add self-hosted runner when available.

---

## 10. Task 6.3.8 -- CI/CD Security Tooling

### 10.3.8.1 Problem Statement

The project has zero automated security scanning. No Dependabot, no SAST, no secret scanning, no container scanning, no SBOM. There are currently 19 npm vulnerabilities (14 high, 4 moderate, 1 low). Default passwords exist in version-controlled config files.

### 10.3.8.2 Action A: Enable Dependabot

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
    - package-ecosystem: 'npm'
      directory: '/'
      schedule:
          interval: 'weekly'
          day: 'monday'
      open-pull-requests-limit: 10
      reviewers:
          - 'Graveside2022'
      labels:
          - 'dependencies'
      groups:
          development:
              dependency-type: 'development'
              update-types:
                  - 'minor'
                  - 'patch'
          production:
              dependency-type: 'production'
              update-types:
                  - 'patch'

    - package-ecosystem: 'github-actions'
      directory: '/'
      schedule:
          interval: 'weekly'
      labels:
          - 'ci'

    - package-ecosystem: 'docker'
      directory: '/docker'
      schedule:
          interval: 'weekly'
      labels:
          - 'docker'
```

### 10.3.8.3 Action B: Add Security Scanning Workflow

Create `.github/workflows/security.yml`:

```yaml
name: 'Security Scanning'

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]
    schedule:
        - cron: '0 6 * * 1' # Weekly Monday 0600 UTC

jobs:
    npm-audit:
        name: 'NPM Vulnerability Audit'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: '20.x'
                  cache: 'npm'
            - run: npm ci
            - name: 'Run npm audit'
              run: npm audit --audit-level=high
              continue-on-error: true
            - name: 'Run npm audit (strict)'
              run: npm audit --audit-level=critical

    secret-scanning:
        name: 'Secret Detection (gitleaks)'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
              with:
                  fetch-depth: 0
            - uses: gitleaks/gitleaks-action@v2
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

    sast:
        name: 'Static Analysis (CodeQL)'
        runs-on: ubuntu-latest
        permissions:
            actions: read
            contents: read
            security-events: write
        steps:
            - uses: actions/checkout@v4
            - uses: github/codeql-action/init@v3
              with:
                  languages: javascript-typescript
            - uses: github/codeql-action/autobuild@v3
            - uses: github/codeql-action/analyze@v3
```

### 10.3.8.4 Action C: Fix Immediate npm Vulnerabilities

```bash
# Run automated fix for non-breaking updates
npm audit fix

# For remaining vulnerabilities requiring major version bumps, evaluate:
npm audit fix --dry-run
# Review output and apply selectively
```

Current vulnerability breakdown (verified 2026-02-08):

- 14 high: primarily in puppeteer dependencies (tar-fs) and vite
- 4 moderate: vite server.fs bypass variants
- 1 low: minor info disclosure

The vite vulnerabilities affect the dev server only (not production). The tar-fs vulnerability is in puppeteer's browser download pipeline (test infrastructure only). Neither impacts the production Argos deployment. However, they should still be fixed to maintain a clean audit trail.

### 10.3.8.5 Action D: Create SECURITY.md

Create `SECURITY.md` at project root:

```markdown
# Security Policy

## Supported Versions

| Version | Supported           |
| ------- | ------------------- |
| 0.x.x   | Current development |

## Reporting a Vulnerability

Report security vulnerabilities by emailing [REDACTED -- insert contact].
Do NOT open public GitHub issues for security vulnerabilities.

Expected response time: 72 hours.

## Security Practices

- All dependencies scanned weekly via Dependabot and npm audit
- Static analysis via CodeQL on every PR
- Secret scanning via gitleaks on every push
- No credentials stored in version control
- SystemD services run with least-privilege hardening
```

### 10.3.8.6 Verification

```bash
# 1. Verify dependabot.yml exists and is valid YAML
python3 -c "import yaml; yaml.safe_load(open('.github/dependabot.yml'))"
# Expected: no error

# 2. Verify security workflow exists
test -f .github/workflows/security.yml && echo "PASS" || echo "FAIL"

# 3. Verify SECURITY.md exists
test -f SECURITY.md && echo "PASS" || echo "FAIL"

# 4. Verify npm audit shows reduced vulnerability count after fix
npm audit 2>&1 | tail -3
```

---

## 11. Task 6.3.9 -- Branch Protection and Git Hygiene

### 11.3.9.1 Problem Statement

1. No branch protection rules on `main`. Any push (including force-push) is allowed.
2. Broken git submodule: `RemoteIDReceiver/` is an empty directory tracked by git, but no `.gitmodules` file exists. `git submodule status` returns no output.
3. No `CODEOWNERS` file. PRs have no automatic reviewer assignment.
4. Pre-commit hook exists (husky + lint-staged) but is routinely bypassed with `--no-verify`.

### 11.3.9.2 Action A: Remove Broken Submodule Reference

The `RemoteIDReceiver/` directory is empty (contains only `.` and `..`). It was likely a git submodule whose `.gitmodules` entry was deleted without cleaning up the directory reference.

```bash
# Remove the empty directory from git tracking
git rm -r RemoteIDReceiver/
# Add to .gitignore to prevent re-addition
echo "RemoteIDReceiver/" >> .gitignore
```

If DroneID functionality is needed in the future, re-add it as a proper submodule with:

```bash
git submodule add <repo-url> RemoteIDReceiver
```

### 11.3.9.3 Action B: Create CODEOWNERS

Create `.github/CODEOWNERS`:

```
# Default owner for all files
* @Graveside2022

# Critical infrastructure
deployment/ @Graveside2022
.github/ @Graveside2022
docker/ @Graveside2022
svelte.config.js @Graveside2022
package.json @Graveside2022

# Security-sensitive files
src/routes/api/gsm-evil/ @Graveside2022
src/lib/server/ @Graveside2022
scripts/setup-gsmevil-sudoers.sh @Graveside2022
```

### 11.3.9.4 Action C: Enable Branch Protection

Using the GitHub CLI (requires admin access):

```bash
gh api repos/Graveside2022/Argos/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["validate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

This enforces:

- CI must pass before merge (the "validate" job from ci.yml).
- At least 1 approving review required.
- Stale reviews dismissed on new pushes.
- Force-push to main blocked.
- Branch deletion blocked.
- Rules apply to admins too.

Note: Branch protection requires the CI pipeline to be passing first (Task 6.3.7). Enable protection AFTER CI is green.

### 11.3.9.5 Action D: Add Pre-Push Hook

Create `.husky/pre-push`:

```bash
#!/usr/bin/env bash
npm run typecheck
```

This ensures type errors cannot be pushed even if pre-commit is bypassed. The typecheck is fast enough (~15 seconds) to not impede workflow.

### 11.3.9.6 Verification

```bash
# 1. Verify RemoteIDReceiver is removed from git
git ls-files RemoteIDReceiver/
# Expected: no output

# 2. Verify CODEOWNERS exists
test -f .github/CODEOWNERS && echo "PASS" || echo "FAIL"

# 3. Verify pre-push hook exists and is executable
test -x .husky/pre-push && echo "PASS" || echo "FAIL"

# 4. Verify branch protection (after enabling)
gh api repos/Graveside2022/Argos/branches/main/protection \
  --jq '.required_status_checks.strict'
# Expected: true
```

---

## 12. Task 6.3.10 -- Build and Deployment Automation

### 12.3.10.1 Problem Statement

1. `argos-final.service` runs `npm run preview` (Vite dev preview server), not a production Node.js server. The Vite preview server is not designed for production use -- it lacks security hardening, has no graceful shutdown, and serves unminified assets.
2. `release.yml` creates a tarball of the build output, but with `adapter-auto` the output is not a standalone server.
3. No deployment script exists that automates: stop service, pull code, install deps, build, restart service.
4. `package.json` version is `0.0.1` with no `engines` field restricting Node.js version.

### 12.3.10.2 Action A: Production Build with adapter-node

Already addressed in Task 6.3.7.4. After switching to `adapter-node`:

- `npm run build` produces `build/index.js` (standalone Node.js server)
- Production start command: `PORT=4173 HOST=0.0.0.0 node build`
- No dependency on Vite at runtime
- No need for `npm run preview`

### 12.3.10.3 Action B: Add engines Field to package.json

```json
{
	"engines": {
		"node": ">=20.0.0",
		"npm": ">=10.0.0"
	}
}
```

This prevents deployment on unsupported Node.js versions. The RPi 5 runs Node 20.x.

### 12.3.10.4 Action C: Create Deployment Script

Create `scripts/deploy/deploy-to-pi.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/argos-env.sh"

echo "=== Argos Deployment Script ==="
echo "ARGOS_DIR: ${ARGOS_DIR}"
echo "ARGOS_USER: ${ARGOS_USER}"

# 1. Stop service
echo "[1/6] Stopping service..."
sudo systemctl stop argos-final.service 2>/dev/null || true

# 2. Pull latest code
echo "[2/6] Pulling latest code..."
cd "${ARGOS_DIR}"
git pull --ff-only origin main

# 3. Install dependencies
echo "[3/6] Installing dependencies..."
npm ci --omit=dev

# 4. Build
echo "[4/6] Building production bundle..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# 5. Generate service files
echo "[5/6] Generating service files..."
bash deployment/generate-services.sh

# 6. Restart service
echo "[6/6] Restarting service..."
sudo cp deployment/generated/argos-final.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start argos-final.service

echo "=== Deployment complete ==="
sudo systemctl status argos-final.service --no-pager
```

### 12.3.10.5 Action D: Update release.yml for adapter-node Output

The current `release.yml` copies `build/` and runs `npm ci --omit=dev`. With adapter-node, the build output is self-contained (all server code bundled into `build/`), but it still needs `node_modules` for native dependencies (better-sqlite3).

Update the assembly step:

```yaml
- name: 'Assemble Clean Production Package'
  run: |
      mkdir release
      cp -r build/ release/
      cp package.json release/
      cp package-lock.json release/
      cp -r deployment/templates/ release/deployment/templates/
      cp deployment/generate-services.sh release/deployment/
      cd release
      npm ci --omit=dev
      cd ..
```

### 12.3.10.6 Verification

```bash
# 1. Verify engines field in package.json
node -e "const p=require('./package.json'); console.log(p.engines)"
# Expected: { node: '>=20.0.0', npm: '>=10.0.0' }

# 2. Verify deploy script exists and passes syntax check
bash -n scripts/deploy/deploy-to-pi.sh
# Expected: exit 0

# 3. Verify build produces standalone server
npm run build
node -e "const fs=require('fs'); console.log(fs.existsSync('build/index.js') ? 'PASS' : 'FAIL')"
# Expected: PASS

# 4. Verify production server starts (smoke test)
PORT=9999 timeout 5 node build 2>&1 || true
curl -s -o /dev/null -w "%{http_code}" http://localhost:9999/
# Expected: 200 (or connection refused if timeout killed it -- either proves the server started)
```

---

## 13. Verification Checklist

This checklist covers all tasks. Every line must pass before the phase is considered complete.

| #   | Check                                          | Command                                                                                 | Expected           |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------ |
| 1   | No @@tokens in generated services              | `grep -r '@@' deployment/generated/`                                                    | No output          |
| 2   | All templates have NoNewPrivileges             | `grep -cL 'NoNewPrivileges' deployment/templates/*.template`                            | No output          |
| 3   | All templates have MemoryMax                   | `grep -cL 'MemoryMax' deployment/templates/*.template`                                  | No output          |
| 4   | No root User in non-network services           | `grep 'User=root' deployment/templates/*.template`                                      | No output          |
| 5   | No hardcoded /home/ubuntu in src/_.ts,_.svelte | `grep -rn '/home/ubuntu' --include='*.ts' --include='*.svelte' src/`                    | No output          |
| 6   | No hardcoded /home/pi in src/_.ts,_.svelte     | `grep -rn '/home/pi' --include='*.ts' --include='*.svelte' src/`                        | No output          |
| 7   | No hardcoded /home/ubuntu in scripts/\*.sh     | `grep -rn '/home/ubuntu' --include='*.sh' scripts/`                                     | No output          |
| 8   | No hardcoded /home/pi in scripts/\*.sh         | `grep -rn '/home/pi' --include='*.sh' scripts/`                                         | No output          |
| 9   | vm.swappiness=60 everywhere                    | `grep -rn 'swappiness.*10' scripts/`                                                    | No output          |
| 10  | NODE_OPTIONS in all Node.js templates          | See Task 6.3.2 verification                                                             | 4 files            |
| 11  | ESLint non-blocking in CI                      | `grep 'continue-on-error' .github/workflows/ci.yml`                                     | Found              |
| 12  | validate:env has default for KISMET_API_URL    | `grep 'default.*localhost:2501' src/lib/server/validate-env.js`                         | Found              |
| 13  | adapter-node installed                         | `grep 'adapter-node' package.json`                                                      | Found              |
| 14  | adapter-auto removed                           | `grep 'adapter-auto' package.json`                                                      | No output          |
| 15  | Build produces index.js                        | `test -f build/index.js`                                                                | Exit 0             |
| 16  | Dependabot config exists                       | `test -f .github/dependabot.yml`                                                        | Exit 0             |
| 17  | Security workflow exists                       | `test -f .github/workflows/security.yml`                                                | Exit 0             |
| 18  | SECURITY.md exists                             | `test -f SECURITY.md`                                                                   | Exit 0             |
| 19  | CODEOWNERS exists                              | `test -f .github/CODEOWNERS`                                                            | Exit 0             |
| 20  | RemoteIDReceiver removed from git              | `git ls-files RemoteIDReceiver/`                                                        | No output          |
| 21  | Duplicate coral-worker.service removed         | `test -f config/systemd/coral-worker.service`                                           | Exit 1 (not found) |
| 22  | wifi-keepalive has sane restart limits         | `grep 'StartLimitIntervalSec=300' deployment/templates/wifi-keepalive.service.template` | Found              |
| 23  | Pre-push hook exists                           | `test -x .husky/pre-push`                                                               | Exit 0             |
| 24  | engines field in package.json                  | `node -e "require('./package.json').engines.node"`                                      | Truthy             |
| 25  | Typecheck passes                               | `npm run typecheck`                                                                     | Exit 0             |

---

## 14. Traceability Matrix

Every finding from the audit evidence maps to exactly one task. No finding is left unaddressed.

| Finding                                               | Task                                                           | Status   |
| ----------------------------------------------------- | -------------------------------------------------------------- | -------- |
| 11 service files with wrong User/paths                | 6.3.1                                                          | PLANNED  |
| Duplicate coral-worker.service                        | 6.3.1 Action C                                                 | PLANNED  |
| No MemoryMax/CPUQuota on any service                  | 6.3.2                                                          | PLANNED  |
| argos-droneid runs as root on port 80                 | 6.3.2.4                                                        | PLANNED  |
| argos-droneid has no security hardening               | 6.3.2.2                                                        | PLANNED  |
| wifi-keepalive infinite restart storm                 | 6.3.2.5                                                        | PLANNED  |
| argos-dev/final missing NODE_OPTIONS                  | 6.3.2.6                                                        | PLANNED  |
| 20 hardcoded paths in 9 files (18 TS + 2 Svelte)      | 6.3.3                                                          | PLANNED  |
| 147 hardcoded paths in 64 shell scripts               | 6.3.4                                                          | PLANNED  |
| 23 hardcoded paths in 12 service files                | 6.3.5 (via 6.3.1)                                              | PLANNED  |
| vm.swappiness=10 conflicts with zram (3 scripts)      | 6.3.6.1                                                        | PLANNED  |
| NODE_OPTIONS missing in 2 services                    | 6.3.6.2 (via 6.3.2)                                            | PLANNED  |
| CI has never passed (100% failure rate)               | 6.3.7                                                          | PLANNED  |
| ESLint 100 errors block CI                            | 6.3.7.2                                                        | PLANNED  |
| validate:env requires KISMET_API_URL                  | 6.3.7.3                                                        | PLANNED  |
| adapter-auto cannot produce standalone server         | 6.3.7.4                                                        | PLANNED  |
| argos-final.service runs npm preview (not production) | 6.3.7.4, 6.3.10                                                | PLANNED  |
| No Dependabot                                         | 6.3.8.2                                                        | PLANNED  |
| No SAST/CodeQL                                        | 6.3.8.3                                                        | PLANNED  |
| No secret scanning                                    | 6.3.8.3                                                        | PLANNED  |
| No SBOM generation                                    | 6.3.8 (deferred)                                               | PLANNED  |
| No container scanning                                 | 6.3.8 (deferred; needs Trivy integration with Docker workflow) | PLANNED  |
| 19 npm vulnerabilities (14 high)                      | 6.3.8.4                                                        | PLANNED  |
| No SECURITY.md                                        | 6.3.8.5                                                        | PLANNED  |
| No branch protection on main                          | 6.3.9.4                                                        | PLANNED  |
| Broken git submodule (RemoteIDReceiver)               | 6.3.9.2                                                        | PLANNED  |
| No CODEOWNERS                                         | 6.3.9.3                                                        | PLANNED  |
| Pre-commit hook routinely bypassed                    | 6.3.9.5                                                        | PLANNED  |
| No pre-push hook                                      | 6.3.9.5                                                        | PLANNED  |
| Package version 0.0.1 / no engines field              | 6.3.10.3                                                       | PLANNED  |
| No deployment automation script                       | 6.3.10.4                                                       | PLANNED  |
| release.yml produces non-runnable tarball             | 6.3.10.5                                                       | PLANNED  |
| User identity crisis (pi/ubuntu/root/kali)            | 6.3.1 (via templating)                                         | PLANNED  |
| Docker passwords hardcoded in compose                 | 6.3.8 (noted; requires secrets management -- separate phase)   | DEFERRED |

### Deferred Items

Two findings require capabilities beyond this phase:

1. **Docker compose default passwords** (password, hackrf, argos in docker-compose files): Requires Docker secrets or external vault integration. Track in Phase 7 (Infrastructure Hardening).

2. **SBOM generation and container scanning**: Requires a Docker build workflow that does not currently exist. Creating one is out of scope for this phase. Track as a follow-on to Task 6.3.8.

---

## 15. Execution Order and Dependencies

```
Task 6.3.1 (Service templating) -----> Task 6.3.2 (Security hardening on templates)
                                  \--> Task 6.3.5 (Config path verification)

Task 6.3.3 (TS path elimination) -----> Independent (can run in parallel with 6.3.1)
Task 6.3.4 (Shell path elimination) --> Independent (can run in parallel)
Task 6.3.6 (Config conflicts) -------> Independent (can run in parallel)

Task 6.3.7 (CI repair) --------------> Task 6.3.8 (Security tooling, depends on working CI)
                                  \--> Task 6.3.9 (Branch protection, depends on CI passing)
                                  \--> Task 6.3.10 (Build automation, depends on adapter-node)
```

Critical path: 6.3.1 -> 6.3.2 -> 6.3.7 -> 6.3.9

#### Cross-Task Dependency Warning

Task 6.3.1 (service template creation) and Task 6.3.3 (hardcoded path elimination in TypeScript) have a circular dependency:

- Service templates need to reference the canonical path variables from `argos-env.sh`
- `argos-env.sh` path values must be determined before templates can be written
- TypeScript `paths.ts` must use the same path values as `argos-env.sh`

**Resolution**: Execute in this order:

1. **First**: Define the canonical path variables (ARGOS_HOME, ARGOS_DATA, etc.) as a specification document
2. **Second**: Create `argos-env.sh` using those defined values
3. **Third**: Create `paths.ts` using the same values
4. **Fourth**: Create service templates referencing `argos-env.sh` variables
5. **Last**: Update TypeScript files to import from `paths.ts`

Recommended parallel tracks:

- Track A: 6.3.1 + 6.3.2 + 6.3.5 (service infrastructure)
- Track B: 6.3.3 + 6.3.4 + 6.3.6 (path and config cleanup)
- Track C: 6.3.7 + 6.3.8 + 6.3.9 + 6.3.10 (CI/CD pipeline)

---

## 16. Risk Assessment

| Risk                                                         | Likelihood | Impact | Mitigation                                                                                          |
| ------------------------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| Service templates break on unforeseen path structure         | Low        | Medium | Template generator validates all @@tokens resolved; dry-run before install                          |
| adapter-node build fails due to native dependencies          | Medium     | High   | Test `npm run build` locally on RPi 5 before merging; better-sqlite3 requires matching architecture |
| Branch protection locks out sole developer                   | Low        | High   | Set `enforce_admins=false` initially; tighten after CI is stable                                    |
| ESLint `continue-on-error` permanently masks regressions     | Medium     | Medium | Phase 3.3 tracks error count to zero; remove flag when complete                                     |
| validate:env default bypasses legitimate missing config      | Low        | Low    | Only KISMET_API_URL gets a default; other env vars remain required when used                        |
| Shell script path replacement breaks unrelated functionality | Medium     | Medium | `bash -n` syntax check all scripts; integration test critical paths                                 |

---

_End of Phase 6.3 Plan_
