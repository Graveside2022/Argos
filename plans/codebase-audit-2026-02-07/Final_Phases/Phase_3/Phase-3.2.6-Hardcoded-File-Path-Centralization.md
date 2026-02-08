# Phase 3.2.6: Hardcoded File Path Centralization

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants), NIST SP 800-53 CM-6 (Configuration Settings)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.6
**Risk Level**: MEDIUM
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension)
**Blocks**: Phase 6 (Infrastructure Modernization -- Docker/SystemD benefits from env-var-backed paths)
**Estimated Files Touched**: 17 files patched + 1 new file created
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C, NIST SP 800-53 CM-6

---

## Objective

Centralize all 25 hardcoded file path literals from 3 different home directories (`/home/pi/`, `/home/ubuntu/`, `/home/kali/`) into a single `src/lib/constants/paths.ts` module backed by environment variables. After completion, deploying Argos on a new host requires only setting environment variables -- no source code modifications.

## Current State Assessment (CORRECTED per Verification Audit 2026-02-08)

| Metric                        | Original Plan | Corrected Value | Delta               |
| ----------------------------- | ------------- | --------------- | ------------------- |
| Total /home/ path occurrences | 18            | **25**          | +7 (39% undercount) |
| Unique files                  | 12            | **15**          | +3 files missed     |
| Home directories              | 3             | **3**           | MATCH               |

**Root Cause**: The codebase was developed across 3 different hosts (`/home/pi/`, `/home/ubuntu/`, `/home/kali/`) without environment-variable parameterization. This is a deployment portability failure that makes the system undeployable on any host without source code modification.

### Home Directory Distribution

| Directory       | Occurrences | Context                                      |
| --------------- | ----------- | -------------------------------------------- |
| `/home/kali/`   | ~14         | Current development host (Kali Linux, RPi 5) |
| `/home/pi/`     | ~7          | Legacy Raspberry Pi host                     |
| `/home/ubuntu/` | ~4          | Ubuntu deployment host                       |

## Scope

### New File: `src/lib/constants/paths.ts`

```typescript
import { env } from '$env/dynamic/private';

// Base directories -- resolved from environment at runtime
export const PATHS = {
	// Primary project root
	PROJECT_ROOT: env.ARGOS_PROJECT_ROOT || '/home/kali/Documents/Argos/Argos',

	// Data directories
	DATA_DIR: env.ARGOS_DATA_DIR || '/home/kali/Documents/Argos/Argos/data',
	CELL_TOWER_DB:
		env.ARGOS_CELL_TOWER_DB || '/home/kali/Documents/Argos/Argos/data/celltowers/towers.db',

	// External tool directories
	GSM_EVIL_DIR: env.GSM_EVIL_DIR || '/home/kali/gsmevil-user',
	GSM_EVIL_DB: env.GSM_EVIL_DB || '/home/kali/gsmevil-user/database/imsi.db',
	DRONEID_DIR: env.DRONEID_DIR || '/home/kali/Documents/Argos/RemoteIDReceiver/Receiver',

	// Kismet directories
	KISMET_SCRIPTS_DIR: env.KISMET_SCRIPTS_DIR || '/home/kali/Scripts',
	KISMET_OPS_DIR: env.KISMET_OPS_DIR || '/home/kali/kismet_ops',
	KISMET_TMP_DIR: env.KISMET_TMP_DIR || '/tmp',

	// Local binary directory
	LOCAL_BIN_DIR: env.LOCAL_BIN_DIR || '/home/kali/.local/bin',

	// Temp/Log directories
	TMP_DIR: '/tmp'
} as const;
```

**CRITICAL CONSTRAINT**: This file uses `$env/dynamic/private` which is a **server-only** SvelteKit module. Client-side Svelte components CANNOT import this file. Any client-side component that currently references paths will need the path passed via:

- Props from a server-side `+page.server.ts` load function
- API response data
- A separate `paths-client.ts` with only non-sensitive defaults

### Files to Update (17 entries, CORRECTED to include 5 files missed by original plan)

| #   | File                                                               | Lines | Current Path                          | Replacement                                        | Notes                                                    |
| --- | ------------------------------------------------------------------ | ----- | ------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| 1   | `src/lib/server/kismet/serviceManager.ts`                          | 10-12 | `/home/pi/Scripts/`, `/home/pi/tmp/`  | `PATHS.KISMET_SCRIPTS_DIR`, `PATHS.KISMET_TMP_DIR` | Legacy pi host                                           |
| 2   | `src/lib/server/kismet/scriptManager.ts`                           | 12-13 | `/home/pi/Scripts`, `/home/pi/stinky` | `PATHS.KISMET_SCRIPTS_DIR`                         | Legacy pi host                                           |
| 3   | `src/routes/api/kismet/scripts/execute/+server.ts`                 | 20    | `/home/pi/Scripts`, `/home/pi/stinky` | `PATHS.KISMET_SCRIPTS_DIR`                         | Legacy pi host                                           |
| 4   | `src/routes/api/kismet/control/+server.ts`                         | 91,93 | `/home/kali`                          | `PATHS.PROJECT_ROOT`                               | Current host                                             |
| 5   | `src/routes/api/droneid/+server.ts`                                | 8-10  | `/home/ubuntu/projects/Argos/`        | `PATHS.DRONEID_DIR`                                | Ubuntu host                                              |
| 6   | `src/routes/api/cell-towers/nearby/+server.ts`                     | 48-49 | Two paths with different home dirs    | `PATHS.CELL_TOWER_DB`                              | Mixed hosts                                              |
| 7   | `src/routes/api/tactical-map/cell-towers/+server.ts`               | 24    | `/home/ubuntu/projects/Argos/`        | `PATHS.CELL_TOWER_DB`                              | Ubuntu host                                              |
| 8   | `src/routes/api/gsm-evil/imsi-data/+server.ts`                     | 9     | `/home/kali/gsmevil-user/`            | `PATHS.GSM_EVIL_DB`                                | Current host                                             |
| 9   | `src/routes/api/gsm-evil/imsi/+server.ts`                          | 9     | `/home/kali/gsmevil-user/`            | `PATHS.GSM_EVIL_DB`                                | Current host                                             |
| 10  | `src/routes/api/gsm-evil/control/+server.ts`                       | 79    | `/home/kali/gsmevil-user`             | `PATHS.GSM_EVIL_DIR`                               | Current host                                             |
| 11  | `src/lib/services/localization/coral/CoralAccelerator.ts`          | 33-34 | `/home/ubuntu/projects/Argos/`        | `PATHS.PROJECT_ROOT`                               | Ubuntu host                                              |
| 12  | `src/lib/services/localization/coral/CoralAccelerator.v2.ts`       | 35,45 | `/home/ubuntu/projects/Argos/`        | `PATHS.PROJECT_ROOT`                               | Ubuntu host                                              |
| 13  | `src/lib/components/wigletotak/directory/DirectoryCard.svelte`     | --    | `/home/pi/kismet_ops` (x2)            | `PATHS.KISMET_OPS_DIR` (via props)                 | **AUDIT ADD**: Client-side -- needs prop passing         |
| 14  | `src/lib/server/agent/tool-execution/detection/binary-detector.ts` | --    | `/home/kali/.local/bin`               | `PATHS.LOCAL_BIN_DIR`                              | **AUDIT ADD**: Current host                              |
| 15  | `src/lib/server/gsm-database-path.ts`                              | --    | `/home/ubuntu/gsmevil-user`           | `PATHS.GSM_EVIL_DIR`                               | **AUDIT ADD**: Ubuntu host                               |
| 16  | `src/lib/stores/wigletotak/wigleStore.ts`                          | --    | `/home/pi/kismet_ops`                 | `PATHS.KISMET_OPS_DIR` (via API)                   | **AUDIT ADD**: Client-side -- needs API relay            |
| 17  | `src/lib/server/kismet/scriptManager.ts`                           | 181   | `/home/pi/tmp/*.log`                  | `PATHS.KISMET_TMP_DIR`                             | **AUDIT ADD**: Missed line 181 (plan covered only 12-13) |

### Client-Side Path Handling (Items 13, 16)

Items 13 (`DirectoryCard.svelte`) and 16 (`wigleStore.ts`) are client-side files that cannot import `paths.ts` (server-only). Solutions:

**Option A (Recommended)**: Create a `+page.server.ts` load function for the wigletotak page that exposes `PATHS.KISMET_OPS_DIR` as page data. The Svelte component receives it via `export let data`.

**Option B**: Create a minimal API endpoint that returns configuration paths:

```typescript
// src/routes/api/config/paths/+server.ts
import { PATHS } from '$lib/constants/paths';
export function GET() {
	return json({ kismetOpsDir: PATHS.KISMET_OPS_DIR });
}
```

**Option C**: Hardcode the default in the client but mark it with a `// TODO: Phase 6 -- expose via server config` comment.

### SECURITY NOTE -- Hardcoded API Keys (DEFERRED TO Phase 2)

The verification audit flagged that 2 files in this task's scope also contain hardcoded API keys:

```
src/routes/api/cell-towers/nearby/+server.ts:7:
  const OPENCELLID_API_KEY = 'pk.d6291c07a2907c915cd8994fb22bc189';

src/routes/api/gsm-evil/tower-location/+server.ts:52:
  const apiKey = 'pk.d6291c07a2907c915cd8994fb22bc189';
```

Same OpenCelliD API key hardcoded in 2 files. This task replaces the FILE PATHS in these files but does NOT address the API key exposure. The API key issue is tracked in:

- Phase 2.1.3 (Hardcoded Credential Removal)
- Independent Security Audit finding #3

**FLAG**: The executor MUST NOT commit the API key into any new configuration file. If paths.ts is created with defaults that include these files, ensure the API key stays in the original location and is addressed by Phase 2.

### Hardcoded Kismet Credentials (DEFERRED TO Phase 2)

The verification audit also flagged:

```
src/routes/api/kismet/control/+server.ts:134:
  'curl ... -d "username=admin&password=password" http://localhost:2501/session/set_password'

src/lib/server/kismet/kismet_controller.ts:52:
  restPassword: 'kismet'
```

Two different Kismet passwords in 2 different files. These are NOT path literals and are NOT in scope for this task. They are tracked in Phase 2.1.3 (Hardcoded Credential Removal).

## Execution Steps

1. **Create** `src/lib/constants/paths.ts` with all PATHS constants as specified above.
2. **Run** `npm run typecheck` -- must exit 0 (file compiles, `$env/dynamic/private` resolved).
3. **Replace server-side files** (items 1-12, 14, 15, 17) -- import PATHS from `$lib/constants/paths` and replace hardcoded strings.
4. **Run** `npm run typecheck` after each batch of 3 files.
5. **Handle client-side files** (items 13, 16) -- choose Option A, B, or C from above and implement.
6. **Run** `npm run typecheck` -- must exit 0.
7. **Run** `npm run build` -- must exit 0 (catches server-only import violations in client code).
8. **Run final verification** grep.

## Commit Message

```
refactor(paths): centralize 25 hardcoded file paths into env-var-backed PATHS constants

Phase 3.2 Task 6: Hardcoded File Path Centralization
- Created src/lib/constants/paths.ts with env-var-backed PATHS constants
- Replaced 25 hardcoded /home/ paths across 15 files (corrected from 18/12)
- Eliminated portability failure across 3 host directories (pi, ubuntu, kali)
- Added LOCAL_BIN_DIR for binary-detector.ts (audit addition)
- Handled client-side path references via server load functions
- NOTE: Hardcoded API keys in cell-towers/tower-location deferred to Phase 2.1.3
Verified: grep for /home/(pi|ubuntu|kali)/ returns 0 in source files

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No hardcoded /home/pi or /home/ubuntu paths**:

```bash
grep -Prn '/home/(pi|ubuntu)/' src/ --include="*.ts" --include="*.svelte" | wc -l
```

**Expected result**: `0`

**Command 2 -- No hardcoded /home/kali paths (except paths.ts defaults)**:

```bash
grep -Prn '/home/kali/' src/ --include="*.ts" --include="*.svelte" | grep -v "paths.ts" | wc -l
```

**Expected result**: `0`

**Command 3 -- All three host directories eliminated**:

```bash
grep -Prn '/home/(pi|ubuntu|kali)/' src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "\.md" | grep -v "paths.ts" | wc -l
```

**Expected result**: `0`

**Command 4 -- paths.ts exists and uses env vars**:

```bash
grep -c "env\." src/lib/constants/paths.ts
```

**Expected result**: `10+` (one env var reference per PATHS member that has a fallback)

**Command 5 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 6 -- Build succeeds (catches server-only import violations)**:

```bash
npm run build
```

**Expected result**: Exit 0. This is critical because it catches any client-side file that incorrectly imports paths.ts (which uses `$env/dynamic/private`).

## Audit Corrections Applied

| Original Claim            | Corrected Value | Delta               | Source                                      |
| ------------------------- | --------------- | ------------------- | ------------------------------------------- |
| 18 hardcoded /home/ paths | **25**          | +7 (39% undercount) | Verification Audit Claim 5, rated 2/5       |
| 12 unique files           | **15**          | +3 files missed     | Audit identified 5 completely omitted files |

**Files the original plan missed entirely**:

1. `src/lib/components/wigletotak/directory/DirectoryCard.svelte` -- 2 occurrences (`/home/pi/kismet_ops`)
2. `src/lib/server/agent/tool-execution/detection/binary-detector.ts` -- 1 occurrence (`/home/kali/.local/bin`)
3. `src/lib/server/gsm-database-path.ts` -- 1 occurrence (`/home/ubuntu/gsmevil-user`)
4. `src/lib/stores/wigletotak/wigleStore.ts` -- 1 occurrence (`/home/pi/kismet_ops`)
5. `src/lib/server/kismet/scriptManager.ts:181` -- plan covered lines 12-13 but missed line 181 (`/home/pi/tmp/*.log`)

**Impact**: Without these corrections, 7 hardcoded paths would survive execution. The verification grep command would catch them, but at re-work cost.

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                                   |
| ------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------- |
| Client-side import of server-only paths.ts | MEDIUM     | LOW    | `$env/dynamic/private` causes Vite build error; `npm run build` catches this |
| Env var not set, fallback to wrong host    | MEDIUM     | LOW    | Defaults are current host (/home/kali); only wrong on different deployment   |
| Path traversal via env var injection       | LOW        | HIGH   | Env vars set at deployment, not runtime; Phase 2 input validation applies    |
| API key exposure in paths.ts               | NONE       | --     | API keys explicitly excluded from paths.ts scope; deferred to Phase 2.1.3    |
| Missing occurrences despite audit          | LOW        | LOW    | Final grep verification catches any remaining /home/ literals                |

## Success Criteria

- `grep -Prn '/home/(pi|ubuntu|kali)/' src/ --include="*.ts" --include="*.svelte" | grep -v paths.ts | wc -l` returns **0**
- `src/lib/constants/paths.ts` exists with `env.` references
- `npm run typecheck` exits 0
- `npm run build` exits 0 (proves no client-side server-only import violations)
- All 25 path occurrences replaced
- Client-side files (DirectoryCard.svelte, wigleStore.ts) use server-relayed path data
- No API keys introduced into paths.ts

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension -- though paths.ts is a separate file, the task flow is gated on 3.2.0 completion)
- **Blocks**: Phase 6 (Infrastructure Modernization -- Docker/SystemD env-var integration)
- **Related**: Phase-2.1.3 (Hardcoded Credential Removal -- API keys in cell-towers files)
- **Related**: Phase-2.1.5 (Sensitive Data Exposure -- overlapping credential concerns)
- **Related**: Phase-3.2.7 (IP Address Centralization -- some IP addresses co-locate with paths)

## Execution Tracking

| Subtask | Description                                        | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.6.1 | Create src/lib/constants/paths.ts                  | PENDING | --      | --        | --          |
| 3.2.6.2 | Replace /home/pi/ paths (items 1-3, 13, 16, 17)    | PENDING | --      | --        | --          |
| 3.2.6.3 | Replace /home/kali/ paths (items 4, 8-10, 14)      | PENDING | --      | --        | --          |
| 3.2.6.4 | Replace /home/ubuntu/ paths (items 5-7, 11-12, 15) | PENDING | --      | --        | --          |
| 3.2.6.5 | Handle client-side path references (items 13, 16)  | PENDING | --      | --        | --          |
| 3.2.6.6 | Final verification grep                            | PENDING | --      | --        | --          |
