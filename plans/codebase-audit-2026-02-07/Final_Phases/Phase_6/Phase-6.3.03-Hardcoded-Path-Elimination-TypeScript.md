# Phase 6.3.03: Hardcoded Path Elimination -- TypeScript Source

**Document ID**: ARGOS-AUDIT-P6.3.03
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.3
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM-HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

20 hardcoded `/home/ubuntu` and `/home/pi` path references exist across 11 files (18 across 10 TypeScript files + 2 in 1 Svelte file). An additional 7 `/home/kali` references exist across 6 TypeScript files (see inventory below). These paths reference users (ubuntu, pi) that do not exist on the deployment target, or hardcode the current user (kali) preventing portability. Every file import or spawn that uses these paths will fail at runtime on a differently-configured system.

### Audit Corrections (from Section 1.2)

**Hardcoded Path Count Reconciliation:** Prior memory stated "25 hardcoded path refs in 16 TypeScript production source files." Verified breakdown:

| User Path    | TypeScript Source Occurrences | Files  | Svelte Occurrences | Svelte Files |
| ------------ | ----------------------------- | ------ | ------------------ | ------------ |
| /home/ubuntu | 10                            | 6      | 0                  | 0            |
| /home/pi     | 8                             | 4      | 2                  | 1            |
| **Total**    | **18**                        | **10** | **2**              | **1**        |

**Corrected total: 20 hardcoded paths across 11 files (18 across 10 TypeScript files + 2 in 1 Svelte file) for `/home/ubuntu` + `/home/pi` only.**

**ADDITIONAL FINDING (Independent Audit 2026-02-08):** 7 `/home/kali` hardcoded paths across 6 TypeScript files were not included in the original audit. These represent partially-migrated paths that will break on any non-kali deployment. True total: **27 hardcoded path occurrences across 15 unique files.**

The Svelte file missed in prior counts:

| File                                                           | Line(s) | Path                                   |
| -------------------------------------------------------------- | ------- | -------------------------------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 14      | `/home/pi/kismet_ops` (default value)  |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 106     | `/home/pi/kismet_ops` (UI placeholder) |

These 2 Svelte instances must be included in the `paths.ts` centralization scope.

The prior "25 in 16 files" figure included Svelte and config files. This plan separates TypeScript + Svelte source (20 in 11 files for /home/ubuntu + /home/pi; 27 in 15 files including /home/kali), shell scripts (147 in 64 files), and service/config files (23 in 12 files) into distinct tasks.

---

## 2. Prerequisites

- Task 6.3.01 Step 6.3.1a must be complete: `scripts/lib/argos-env.sh` must exist to establish the canonical variable name contract.

---

## 3. Dependencies

- **Upstream**: Task 6.3.01 Step 6.3.1a (argos-env.sh provides the variable name contract)
- **Downstream**: Task 6.3.01 Step 6.3.1b (templates reference same variable names)
- **Downstream**: Task 6.3.05 (verification of all path elimination)

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- src/
```

For each affected TypeScript file individually. The `src/lib/server/paths.ts` module is new and can simply be deleted.

---

## 5. Current State / Inventory

### 5.1 Files referencing /home/ubuntu (10 occurrences in 6 files)

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

### 5.2 Files referencing /home/pi (8 occurrences in 4 files)

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

### 5.3 Svelte files referencing /home/pi (2 occurrences in 1 file)

| File                                                           | Line(s) | Hardcoded Path        | Purpose                          |
| -------------------------------------------------------------- | ------- | --------------------- | -------------------------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 14      | `/home/pi/kismet_ops` | Default value for directory prop |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte` | 106     | `/home/pi/kismet_ops` | UI placeholder text              |

### 5.4 Files referencing /home/kali (7 occurrences in 6 files -- NOT in original plan)

These represent partially-migrated paths that will break on any non-kali deployment. They were missed by the original audit because the original scope only searched for `/home/ubuntu` and `/home/pi`.

| File                                                               | Line(s) | Hardcoded Path                                               | Purpose                         |
| ------------------------------------------------------------------ | ------- | ------------------------------------------------------------ | ------------------------------- |
| `src/lib/server/agent/tool-execution/detection/binary-detector.ts` | 44      | `/home/kali/.local/bin/${binaryName}`                        | Binary search path              |
| `src/routes/api/kismet/control/+server.ts`                         | 91, 93  | `/home/kali` (cd target for kismet startup)                  | Kismet working directory        |
| `src/routes/api/gsm-evil/imsi-data/+server.ts`                     | 9       | `/home/kali/gsmevil-user/database/imsi.db`                   | IMSI database fallback path     |
| `src/routes/api/gsm-evil/imsi/+server.ts`                          | 9       | `/home/kali/gsmevil-user/database/imsi.db`                   | IMSI database fallback path     |
| `src/routes/api/cell-towers/nearby/+server.ts`                     | 49      | `/home/kali/Documents/Argos/Argos/data/celltowers/towers.db` | Cell tower DB absolute path     |
| `src/routes/api/gsm-evil/control/+server.ts`                       | 79      | `/home/kali/gsmevil-user`                                    | GSM Evil installation directory |

**Verification of /home/kali paths (run 2026-02-08):**

```bash
grep -rn '/home/kali' --include='*.ts' --include='*.svelte' src/ | grep -v 'node_modules'
# Returns: 7 matches across 6 files (kismet/control has 2 lines: comment + code)
```

These 6 files must be updated in Action B to import from `PATHS.*` constants, bringing the total scope from 11 files to **17 files** (10 TS ubuntu/pi + 1 Svelte pi + 6 TS kali).

---

## 6. Actions / Changes

### Action A: Create `src/lib/server/paths.ts`

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
	wigleDirectory: env.WIGLE_DIR || join(USER_HOME, 'kismet_ops'),

	// Binary detection (for agent tool execution)
	localBinDir: env.LOCAL_BIN_DIR || join(USER_HOME, '.local/bin'),

	// GSM Evil installation
	gsmEvilDir: env.GSMEVIL_DIR || join(USER_HOME, 'gsmevil-user')
} as const;
```

### Action B: Replace hardcoded paths in each file

For each of the 11 files listed in Sections 5.1-5.3, plus the 6 files with `/home/kali` paths (Section 5.4), replace the hardcoded string literal with the corresponding `PATHS.*` constant or `VITE_*` env variable.

**Example for `src/routes/api/droneid/+server.ts`:**

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

### Action C: Special Case -- wigleStore.ts (Client-Side Store)

`src/lib/stores/wigletotak/wigleStore.ts` line 64 is a Svelte store (runs in browser context). It cannot import `$lib/server/paths` because that module uses `$env/dynamic/private` (server-only).

Fix: Replace the hardcoded default with a public environment variable:

```typescript
wigleDirectory: import.meta.env.VITE_WIGLE_DIR || '/home/kali/kismet_ops',
```

Add `VITE_WIGLE_DIR` to `.env`, `.env.example`, and `config/.env.example`.

### Action D: Special Case -- DirectoryCard.svelte (Client-Side Component)

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

---

## 7. Verification Commands

```bash
# 1. Verify zero hardcoded /home/ubuntu or /home/pi in TypeScript AND Svelte source
grep -rn '/home/ubuntu\|/home/pi' --include='*.ts' --include='*.svelte' src/
# Expected: no output

# 1b. Verify /home/kali paths also centralized (from Appendix findings)
grep -rn '/home/kali' --include='*.ts' --include='*.svelte' src/ | grep -v 'node_modules'
# Expected: no output (all replaced with PATHS.* constants)

# 2. Verify PATHS module exists and exports expected constants
grep -c 'export const PATHS' src/lib/server/paths.ts
# Expected: 1

# 3. Verify all 17 files updated (16 TS import PATHS, 1 Svelte uses VITE_WIGLE_DIR)
for f in \
  src/routes/api/droneid/+server.ts \
  src/routes/api/cell-towers/nearby/+server.ts \
  src/routes/api/tactical-map/cell-towers/+server.ts \
  src/lib/server/gsm-database-path.ts \
  src/lib/services/localization/coral/CoralAccelerator.ts \
  src/lib/services/localization/coral/CoralAccelerator.v2.ts \
  src/routes/api/kismet/scripts/execute/+server.ts \
  src/lib/server/kismet/serviceManager.ts \
  src/lib/server/kismet/scriptManager.ts \
  src/lib/server/agent/tool-execution/detection/binary-detector.ts \
  src/routes/api/kismet/control/+server.ts \
  src/routes/api/gsm-evil/imsi-data/+server.ts \
  src/routes/api/gsm-evil/imsi/+server.ts \
  src/routes/api/gsm-evil/control/+server.ts; do
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

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                          | Command                                                              | Expected  |
| --- | ---------------------------------------------- | -------------------------------------------------------------------- | --------- |
| 5   | No hardcoded /home/ubuntu in src/_.ts,_.svelte | `grep -rn '/home/ubuntu' --include='*.ts' --include='*.svelte' src/` | No output |
| 6   | No hardcoded /home/pi in src/_.ts,_.svelte     | `grep -rn '/home/pi' --include='*.ts' --include='*.svelte' src/`     | No output |
| 25  | Typecheck passes                               | `npm run typecheck`                                                  | Exit 0    |
| 26  | No hardcoded /home/kali in src/_.ts,_.svelte   | `grep -rn '/home/kali' --include='*.ts' --include='*.svelte' src/`   | No output |
| 33  | paths.ts exports PATHS constant                | `grep -c 'export const PATHS' src/lib/server/paths.ts`               | 1         |

---

## 9. Traceability

| Finding                                                | Task                                           | Status  |
| ------------------------------------------------------ | ---------------------------------------------- | ------- |
| 27 hardcoded paths in 15 files (20 ubuntu/pi + 7 kali) | 6.3.3                                          | PLANNED |
| 7 /home/kali hardcoded paths in 6 TS files             | 6.3.3 (Action B, expanded from 11 to 17 files) | PLANNED |

### Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                                                          |
| --------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| adapter-node build fails due to native dependencies | Medium     | High   | Test `npm run build` locally on RPi 5 before merging; better-sqlite3 requires matching architecture |

---

## 10. Execution Order Notes

This task is split into sub-steps to align with the circular dependency resolution in Task 6.3.01:

1. **Step 6.3.3a** (after 6.3.1a): Create `src/lib/server/paths.ts` using the SAME variable names as `argos-env.sh`:
    - `env.ARGOS_DIR` maps to shell `$ARGOS_DIR`
    - `env.HOME` maps to shell `$ARGOS_HOME`
    - All defaults must match between the two files

2. **Step 6.3.3b** (independent): Update all 17 TypeScript/Svelte files to import from `paths.ts`

**Critical path position**: 6.3.1a (argos-env.sh) -> **6.3.3a (paths.ts)** -> **6.3.3b (update 17 files)** -> 6.3.1b (templates) -> 6.3.2 (hardening) -> 6.3.5 (verification)

**Track assignment**: Track A (path definition -> path usage -> templates -> hardening -> verification)

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation).

---

_End of Phase 6.3.03_
