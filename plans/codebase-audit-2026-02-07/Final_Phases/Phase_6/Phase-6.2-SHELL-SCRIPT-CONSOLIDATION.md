# Phase 6.2: Shell Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2
**Version**: 2.0 (Final -- Security-Augmented)
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Header

| Field                    | Value                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Risk Level               | MEDIUM -- File moves and archives only; no behavioral changes to production code        |
| Prerequisites            | Phase 5 complete (architecture decomposition); Phase 6.1 (dead code removal) complete   |
| Estimated Files Affected | 202 active .sh files reduced to 114 active .sh scripts (plus 20 non-.sh files archived) |
| Lines Eliminated         | ~10,900 .sh lines archived (duplicates + superseded scripts)                            |
| Lines Remaining          | ~17,200 lines across 114 .sh scripts                                                    |
| Security Findings        | 331 instances across 6 categories (2 CRITICAL, 4 HIGH) -- see Task 6.2.8                |
| Estimated Effort         | 3 engineer-days (consolidation) + 2 engineer-days (security remediation)                |
| Audit Date               | 2026-02-08                                                                              |
| Codebase HEAD            | Commit b682267 on branch dev_branch                                                     |
| Verification Method      | Every task includes a verification command that returns a machine-parseable pass/fail   |

---

> **EXECUTION ORDER DEPENDENCY**: Phase 6.3 (centralized paths via `argos-env.sh`) must execute BEFORE this phase. Consolidated scripts should use `source /path/to/argos-env.sh` from day one rather than inheriting hardcoded paths that will need to be changed again later.

---

## 2. Audit Corrections

The following corrections are documented against prior audit claims.

| Prior Claim                                | Source                 | Actual Value                                             | Correction                                                            |
| ------------------------------------------ | ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| "224 shell scripts"                        | MEMORY.md              | 202 active .sh files (excluding \_archived)              | Prior count included \_archived directory or non-.sh files            |
| "30,200 lines"                             | Codebase Census        | 28,097 lines across 202 .sh files                        | Prior count included .py, .cjs, .conf, and .service files in scripts/ |
| "224->~40 scripts"                         | Consolidation Analysis | 202->78 scripts                                          | Prior target of 40 was aspirational without per-file analysis         |
| "massive duplication, needs consolidation" | Consolidation Analysis | 4,489 duplicated lines (16.0%) across 21 pairs           | Now quantified precisely                                              |
| "52 GSM files"                             | Phase 6.2 draft        | 61 GSM-related files (47 .sh + 11 .py + 3 extensionless) | Prior count missed extensionless grgsm wrappers and undercounted .sh  |
| "147 hardcoded paths in 64 scripts"        | Shell Script Audit     | 152 line occurrences across 67 unique files              | See Section 15 for corrected breakdown                                |

#### Non-Functional Scripts (Will Not Execute)

One script has a broken shebang and will produce `Exec format error`:

1. `scripts/development/start-usrp-service.sh` -- Contains `#\!/bin/bash` (escaped exclamation mark, ShellCheck SC2148). Fix: Replace with `#!/bin/bash`

**These must be fixed in the current codebase before any consolidation begins.**

---

## 3. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All consolidated, superseded, or duplicate scripts are moved to `scripts/_archived/phase-6.2/` with their original directory structure preserved.

### 3.1 Pre-Execution Snapshot

```bash
# Create timestamped archive directory
mkdir -p scripts/_archived/phase-6.2

# Create manifest of all scripts before consolidation
find scripts/ -name '*.sh' -not -path '*_archived*' | sort > scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt
wc -l scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt
# EXPECTED: 202

# Create integrity checksums
find scripts/ -name '*.sh' -not -path '*_archived*' -exec sha256sum {} + | sort > scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

### 3.2 Rollback Procedure

If any production functionality breaks after consolidation:

```bash
# Identify the missing script from the manifest
grep "scriptname" scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt

# Restore from archive (preserves original path)
cp scripts/_archived/phase-6.2/<original-subpath>/scriptname.sh scripts/<original-subpath>/scriptname.sh
chmod +x scripts/<original-subpath>/scriptname.sh

# Verify checksum matches pre-consolidation state
sha256sum scripts/<original-subpath>/scriptname.sh
grep "scriptname" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

### 3.3 Production-Critical Scripts (DO NOT ARCHIVE)

The following 11 scripts are referenced by production TypeScript source code or active systemd service files. They must NEVER be archived, only consolidated into. If a consolidated replacement is created, the production code path that references the original filename must be updated in the same commit.

| Script                               | Referenced By                                         | Line |
| ------------------------------------ | ----------------------------------------------------- | ---- |
| `scripts/tmux-zsh-wrapper.sh`        | `src/lib/stores/dashboard/terminalStore.ts`           | 72   |
| `scripts/kismet-no-auto-source.conf` | `src/routes/api/kismet/start-safe/+server.ts`         | 13   |
| `scripts/kismet-site-simple.conf`    | `src/routes/api/kismet/start-with-adapter/+server.ts` | 11   |
| `scripts/setup-kismet-adapter.sh`    | `src/routes/api/kismet/start-with-adapter/+server.ts` | 21   |
| `scripts/start-kismet-with-alfa.sh`  | `src/lib/server/wifite/processManager.ts`             | 353  |
| `scripts/usrp_power_measure_real.py` | `src/routes/api/rf/usrp-power/+server.ts`             | 27   |
| `scripts/usrp_spectrum_scan.py`      | `src/lib/server/usrp/sweepManager.ts`                 | 298  |
| `scripts/patch-gsmevil-socketio.sh`  | `deployment/gsmevil-patch.service`                    | 7    |
| `scripts/simple-keepalive.sh`        | `scripts/simple-keepalive.service`                    | 10   |
| `scripts/dev-server-keepalive.sh`    | `scripts/dev-server-keepalive.service`                | 11   |
| `scripts/wifi-keepalive-robust.sh`   | `scripts/wifi-keepalive.service`                      | 8    |

**Verification** (run before any consolidation begins):

```bash
grep -rn 'scripts/' --include='*.ts' --include='*.svelte' --include='*.service' \
  src/ deployment/ scripts/ docker/ 2>/dev/null | \
  grep -v node_modules | grep -v '\.d\.ts' | grep -v '//' | \
  grep -v 'api/kismet/scripts'
# Must match the 11 entries in the table above. Any new references added
# between plan writing and execution must be added to this table.
```

#### Missing Production-Critical Scripts **[MUST CREATE OR REMOVE]**

The independent audit (2026-02-08) identified 3 scripts commonly expected in a production deployment that DO NOT EXIST on disk:

| Expected Script                       | Status                    | Required Action                                                                           |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `scripts/deploy/deploy-production.sh` | **[MISSING - NOT FOUND]** | Either create as a wrapper around `deploy-master.sh` or formally document its absence     |
| `scripts/deploy/rollback.sh`          | **[MISSING - NOT FOUND]** | Either create a rollback script or document that rollback is manual (Section 3.2)         |
| `scripts/monitoring/health-check.sh`  | **[MISSING - NOT FOUND]** | Either create a health check or document that `deployment-status-api.sh` serves this role |

**Verification**:

```bash
test -f scripts/deploy/deploy-production.sh && echo "EXISTS" || echo "MISSING: deploy-production.sh"
test -f scripts/deploy/rollback.sh && echo "EXISTS" || echo "MISSING: rollback.sh"
test -f scripts/monitoring/health-check.sh && echo "EXISTS" || echo "MISSING: health-check.sh"
# All 3 are expected to return MISSING until remediated.
```

**Decision Required Before Execution**: For each missing script, the operator must decide:

1. **CREATE**: Write the script and add it to the production-critical list (Section 3.3 table above).
2. **FORMALLY REMOVE**: Document that the functionality is covered by an existing script and no new script is needed.

Do NOT proceed with Phase 6.2 consolidation until this decision is recorded.

---

## 4. Task 6.2.1: Eliminate Duplicate Directories

**Objective**: Remove 4 directories (`deploy/`, `development/`, `testing/`, `maintenance/`) that are fully or predominantly duplicates of other directories. This eliminates 25 files and 4,489 duplicate lines plus 2 unique files (40 lines) that must be relocated first.

### 4.1 Pre-Execution Verification

Confirm all claimed byte-identical duplicates are still identical at execution time.

```bash
# deploy/ vs install/ (7 pairs)
diff scripts/deploy/install_coral_support.sh scripts/install/install_coral_support.sh
diff scripts/deploy/install-from-git.sh scripts/install/install-from-git.sh
diff scripts/deploy/install-modified.sh scripts/install/install-modified.sh
diff scripts/deploy/install.sh scripts/install/install.sh
diff scripts/deploy/install_uhd.sh scripts/install/install_uhd.sh
diff scripts/deploy/quick-install.sh scripts/install/quick-install.sh
diff scripts/deploy/setup-opencellid.sh scripts/install/setup-opencellid.sh
# Each must produce empty output. If any differ, abort and investigate.

# deploy/ vs deployment/ (1 pair)
diff scripts/deploy/deploy-dragon-os.sh scripts/deployment/deploy-dragon-os.sh

# deploy/ vs maintenance/ (1 pair)
diff scripts/deploy/fix-hardcoded-paths.sh scripts/maintenance/fix-hardcoded-paths.sh

# deploy/ vs testing/ (1 pair)
diff scripts/deploy/verify-deployment.sh scripts/testing/verify-deployment.sh

# dev/ vs development/ (4 pairs)
diff scripts/dev/analyze-950-simple.sh scripts/development/analyze-950-simple.sh
diff scripts/dev/auto-start-hackrf.sh scripts/development/auto-start-hackrf.sh
diff scripts/dev/start-all-services.sh scripts/development/start-all-services.sh
diff scripts/dev/start-fusion-dev.sh scripts/development/start-fusion-dev.sh

# dev/ vs maintenance/ (3 pairs)
diff scripts/dev/emergency_rtl433.sh scripts/maintenance/emergency_rtl433.sh
diff scripts/dev/restart-kismet.sh scripts/maintenance/restart-kismet.sh
diff scripts/dev/run-gsmevil.sh scripts/maintenance/run-gsmevil.sh

# testing/ vs dev/ (1 pair)
diff scripts/testing/verify-celltower-integration.sh scripts/dev/verify-celltower-integration.sh

# testing/ vs tests/integration/ (1 identical, 2 near-identical)
diff scripts/testing/debug_gsm_detection.sh tests/integration/debug_gsm_detection.sh
# Must be empty (byte-identical)

diff scripts/testing/debug_gsm_evil.sh tests/integration/debug_gsm_evil.sh
# Must show ONLY emoji-vs-text label changes (4-6 lines differing)

diff scripts/testing/debug_scanner_disconnect.sh tests/integration/debug_scanner_disconnect.sh
# Must show ONLY emoji-vs-text label changes (4-6 lines differing)
```

**All 21 diff commands must complete. If any identical pair shows differences, STOP and re-verify before proceeding.**

#### Verified Byte-Identical Duplicate Pairs (18 pairs, 4,342 wasted lines)

| Canonical Copy (KEEP)               | Duplicate (ARCHIVE)                     |
| ----------------------------------- | --------------------------------------- |
| deploy/deploy-dragon-os.sh          | deployment/deploy-dragon-os.sh          |
| deploy/install.sh                   | install/install.sh                      |
| deploy/install-modified.sh          | install/install-modified.sh             |
| deploy/install-from-git.sh          | install/install-from-git.sh             |
| deploy/quick-install.sh             | install/quick-install.sh                |
| deploy/install_coral_support.sh     | install/install_coral_support.sh        |
| deploy/install_uhd.sh               | install/install_uhd.sh                  |
| deploy/setup-opencellid.sh          | install/setup-opencellid.sh             |
| deploy/fix-hardcoded-paths.sh       | maintenance/fix-hardcoded-paths.sh      |
| deploy/verify-deployment.sh         | testing/verify-deployment.sh            |
| dev/start-all-services.sh           | development/start-all-services.sh       |
| dev/auto-start-hackrf.sh            | development/auto-start-hackrf.sh        |
| dev/analyze-950-simple.sh           | development/analyze-950-simple.sh       |
| dev/start-fusion-dev.sh             | development/start-fusion-dev.sh         |
| dev/emergency_rtl433.sh             | maintenance/emergency_rtl433.sh         |
| dev/run-gsmevil.sh                  | maintenance/run-gsmevil.sh              |
| dev/restart-kismet.sh               | maintenance/restart-kismet.sh           |
| dev/verify-celltower-integration.sh | testing/verify-celltower-integration.sh |

**Pattern**: `deploy/` mirrors `install/` (7 pairs), `dev/` mirrors `development/` (4 pairs), cross-directory leaks (7 pairs).
**Action**: Archive the "Duplicate" column files. Keep the "Canonical" column files. Verify with `md5sum` before archiving.

#### Script Dependency Graph (Required Before Archiving)

Several scripts call other scripts via `source` or direct path execution. Before archiving ANY script across ALL tasks (6.2.1 through 6.2.7), verify it is not sourced by a surviving script:

```bash
# GLOBAL dependency scan -- run ONCE before any archiving begins:
grep -rn 'source \|^\. ' scripts/ --include='*.sh' | grep -v '_archived'
# This produces the full sourcing graph. For each script to be archived,
# verify its filename does NOT appear in this output.

# Per-script check (replace SCRIPT_NAME with actual filename):
grep -rn "source.*SCRIPT_NAME\|\\. .*SCRIPT_NAME\|bash.*SCRIPT_NAME" scripts/ --include='*.sh' | grep -v '_archived'
```

Archiving a script that is `source`d by a surviving script will silently break the survivor at runtime. This check is a **hard gate** -- if a dependency is found, the script must NOT be archived until the dependency is refactored.

### 4.2 Relocate Unique Files from development/

Two files in `development/` have no duplicate in `dev/` and must be moved before archiving.

```bash
# 4.2.1: Move auto-start-kismet.sh (29 lines) to dev/
cp scripts/development/auto-start-kismet.sh scripts/dev/auto-start-kismet.sh
chmod +x scripts/dev/auto-start-kismet.sh
diff scripts/development/auto-start-kismet.sh scripts/dev/auto-start-kismet.sh
# Must be empty

# 4.2.2: Move start-usrp-service.sh (11 lines) to dev/
cp scripts/development/start-usrp-service.sh scripts/dev/start-usrp-service.sh
chmod +x scripts/dev/start-usrp-service.sh
diff scripts/development/start-usrp-service.sh scripts/dev/start-usrp-service.sh
# Must be empty
```

### 4.3 Relocate Unique Files from deploy/

One unique file in `deploy/` not duplicated in `install/` or `deployment/`: none. All 10 files in deploy/ are duplicates. But `deploy/` also contains `deploy-dragon-os.sh` (dup of deployment/) and `fix-hardcoded-paths.sh` (dup of maintenance/) and `verify-deployment.sh` (dup of testing/). All accounted for.

### 4.4 Relocate Unique File from install/

One file in `install/` has no duplicate elsewhere and is not in deploy/: `setup-usrp-simple.sh` (45 lines). This file stays in `install/`. Additionally, `install-from-git.log` is a build artifact, not a script -- archive it.

```bash
# Archive the log file
mv scripts/install/install-from-git.log scripts/_archived/phase-6.2/install-from-git.log
```

### 4.5 Archive the 4 Duplicate Directories

```bash
# Archive entire directories preserving structure
mkdir -p scripts/_archived/phase-6.2/{deploy,development,testing,maintenance}

mv scripts/deploy/* scripts/_archived/phase-6.2/deploy/
rmdir scripts/deploy

mv scripts/development/* scripts/_archived/phase-6.2/development/
rmdir scripts/development

mv scripts/testing/* scripts/_archived/phase-6.2/testing/
rmdir scripts/testing

mv scripts/maintenance/* scripts/_archived/phase-6.2/maintenance/
rmdir scripts/maintenance
```

### 4.6 Post-Execution Verification

```bash
# Verify directories are gone
test ! -d scripts/deploy && echo "PASS: deploy/ removed" || echo "FAIL: deploy/ still exists"
test ! -d scripts/development && echo "PASS: development/ removed" || echo "FAIL: development/ still exists"
test ! -d scripts/testing && echo "PASS: testing/ removed" || echo "FAIL: testing/ still exists"
test ! -d scripts/maintenance && echo "PASS: maintenance/ removed" || echo "FAIL: maintenance/ still exists"

# Verify unique files were relocated
test -f scripts/dev/auto-start-kismet.sh && echo "PASS: auto-start-kismet.sh relocated" || echo "FAIL"
test -f scripts/dev/start-usrp-service.sh && echo "PASS: start-usrp-service.sh relocated" || echo "FAIL"

# Verify archived files exist
ls scripts/_archived/phase-6.2/deploy/ | wc -l
# EXPECTED: 10

ls scripts/_archived/phase-6.2/development/ | wc -l
# EXPECTED: 6

ls scripts/_archived/phase-6.2/testing/ | wc -l
# EXPECTED: 5

ls scripts/_archived/phase-6.2/maintenance/ | wc -l
# EXPECTED: 4

# Net file count reduction
find scripts/ -name '*.sh' -not -path '*_archived*' | wc -l
# EXPECTED: 179 (202 - 25 archived + 2 unique relocated = 179)
```

**Files Eliminated**: 25 (10 deploy/ + 6 development/ + 5 testing/ + 4 maintenance/)
**Lines Eliminated**: 5,605 (3,771 + 457 + 890 + 487)
**Files Relocated**: 2 (auto-start-kismet.sh, start-usrp-service.sh)
**Lines Relocated**: 40

---

## 5. Task 6.2.2: GSM Evil Script Consolidation

**Objective**: Reduce 61 GSM-related files (47 .sh + 11 .py + 3 extensionless) at the top level to 5 shell scripts, 2 Python files, and 1 extensionless wrapper. Archive the remaining files.

```
# Verification command (run from project root):
find scripts/ -iname "*gsm*" -o -iname "*gsmevil*" -o -iname "*grgsm*" -o -iname "*imsi*" | wc -l
# Expected output: 61
```

#### PREREQUISITE: Security Audit of GSM Scripts (Must Complete Before Consolidation)

Before any GSM script is consolidated, ALL 61 GSM-related files must be audited for the following dangerous patterns:

| Pattern                          | Risk                     | Grep Command                                                  |
| -------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `eval`                           | Arbitrary code execution | `grep -rn 'eval ' scripts/*gsm* scripts/*GSM*`                |
| `sudo` without path validation   | Privilege escalation     | `grep -rn 'sudo ' scripts/*gsm* scripts/*GSM*`                |
| Unquoted `rm -rf`                | Directory traversal      | `grep -rn 'rm -rf' scripts/*gsm* scripts/*GSM*`               |
| `curl \| sh` or `wget \| sh`     | Supply chain attack      | `grep -rn 'curl.*\|.*sh\|wget.*\|.*sh' scripts/*gsm*`         |
| `kill -9` without PID validation | Wrong process killed     | `grep -rn 'kill -9' scripts/*gsm* scripts/*GSM*`              |
| Hardcoded IPs/ports              | Configuration drift      | `grep -rn '[0-9]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+' scripts/*gsm*` |

**Every finding must be documented and remediated in the consolidated script.** Consolidation without security review means the reduced set of scripts will inherit the worst security practices of all 61 originals.

### 5.1 GSM Script Inventory (61 files, verified line counts)

#### START variants (22 .sh files, 1,463 total lines) -- ARCHIVE ALL, replace with 1 unified script

| File                            | Lines | Disposition            | Reason                               |
| ------------------------------- | ----- | ---------------------- | ------------------------------------ |
| `gsm-evil-start.sh`             | 61    | ARCHIVE                | Superseded by unified gsm-evil.sh    |
| `gsm-evil-start-no-sudo.sh`     | 72    | ARCHIVE                | Sudoers config eliminates need       |
| `gsm-evil-start-wrapper.sh`     | 10    | ARCHIVE                | Trivial wrapper                      |
| `gsmevil-simple-start.sh`       | 49    | ARCHIVE                | Subset of configurable-start         |
| `gsmevil-configurable-start.sh` | 82    | MERGE into gsm-evil.sh | Best parameterized start logic       |
| `gsmevil-readme-start.sh`       | 73    | ARCHIVE                | Documentation variant                |
| `gsmevil-video-start.sh`        | 65    | ARCHIVE                | Demo variant                         |
| `start-gsmevil2.sh`             | 124   | MERGE into gsm-evil.sh | GsmEvil2 Docker start logic          |
| `start-gsmevil2-fixed.sh`       | 148   | ARCHIVE                | Bug-fix variant of start-gsmevil2.sh |
| `start-gsmevil-dynamic.sh`      | 71    | ARCHIVE                | Dynamic freq variant                 |
| `start-gsm-evil-server.sh`      | 79    | MERGE into gsm-evil.sh | Server start logic                   |
| `start-gsmevil-with-imsi.sh`    | 68    | ARCHIVE                | IMSI flag variant                    |
| `gsm-evil-with-imsi.sh`         | 39    | ARCHIVE                | IMSI flag variant                    |
| `gsm-evil-with-auto-imsi.sh`    | 60    | ARCHIVE                | Auto-IMSI variant                    |
| `gsm-evil-production.sh`        | 74    | ARCHIVE                | Production variant                   |
| `gsm-evil-dragonos.sh`          | 42    | ARCHIVE                | DragonOS-specific                    |
| `gsm-evil-final.sh`             | 61    | ARCHIVE                | "Final" naming indicates iteration   |
| `gsm-evil-fixed.sh`             | 35    | ARCHIVE                | Bug-fix variant                      |
| `gsm-evil-fix-and-start.sh`     | 56    | ARCHIVE                | Fix-then-start variant               |
| `gsm-evil-working.sh`           | 40    | ARCHIVE                | "Working" naming indicates iteration |
| `gsm-evil-public.sh`            | 42    | ARCHIVE                | Public-facing variant                |
| `gsm-evil-simple.sh`            | 18    | ARCHIVE                | Minimal variant                      |

#### STOP variants (6 .sh files, 836 total lines) -- ARCHIVE ALL, replace with 1 unified script

| File                             | Lines | Disposition            | Reason                        |
| -------------------------------- | ----- | ---------------------- | ----------------------------- |
| `gsm-evil-stop.sh`               | 240   | MERGE into gsm-evil.sh | Most comprehensive stop logic |
| `gsmevil-simple-stop.sh`         | 24    | ARCHIVE                | Subset of stop.sh             |
| `stop-gsmevil2.sh`               | 98    | ARCHIVE                | Docker stop variant           |
| `stop-gsmevil2-fixed.sh`         | 154   | ARCHIVE                | Bug-fix variant               |
| `nuclear-stop-gsmevil.sh`        | 104   | MERGE into gsm-evil.sh | Force-stop logic              |
| `verify-gsm-stop-bulletproof.sh` | 216   | ARCHIVE                | Verification-only script      |

#### DIAGNOSTIC (6 .sh files, 699 total lines) -- ARCHIVE ALL, replace with 1 unified script

| File                       | Lines | Disposition                 | Reason                   |
| -------------------------- | ----- | --------------------------- | ------------------------ |
| `diagnose-gsm-evil.sh`     | 122   | MERGE into gsm-evil-diag.sh | Primary diagnostic logic |
| `diagnose-usrp-gsm.sh`     | 63    | MERGE into gsm-evil-diag.sh | USRP-specific GSM diag   |
| `debug-gsm-scan.sh`        | 70    | ARCHIVE                     | Debug variant            |
| `debug-usrp-gsm.sh`        | 75    | ARCHIVE                     | Debug variant            |
| `gsm-full-diagnostic.sh`   | 187   | MERGE into gsm-evil-diag.sh | Comprehensive diagnostic |
| `gsm-frequency-scanner.sh` | 182   | MERGE into gsm-evil-diag.sh | Frequency scan logic     |

#### SETUP (3 .sh files, 76 total lines) -- MERGE into gsm-evil-setup.sh

| File                        | Lines | Disposition                  | Reason                              |
| --------------------------- | ----- | ---------------------------- | ----------------------------------- |
| `setup-gsmevil-sudoers.sh`  | 26    | MERGE into gsm-evil-setup.sh | Sudoers config                      |
| `patch-gsmevil-socketio.sh` | 36    | KEEP (production-referenced) | Referenced by gsmevil-patch.service |
| `enable-imsi-curl.sh`       | 18    | MERGE into gsm-evil-setup.sh | IMSI enablement                     |

**NOTE**: `patch-gsmevil-socketio.sh` is referenced by `deployment/gsmevil-patch.service` (see Section 3.3). It MUST remain at its current path or the service file must be updated in the same commit.

#### SCAN/TEST (5 .sh files, 381 total lines) -- ARCHIVE ALL

| File                       | Lines | Disposition                 | Reason              |
| -------------------------- | ----- | --------------------------- | ------------------- |
| `auto-scan-gsm.sh`         | 71    | ARCHIVE                     | Ad-hoc scan         |
| `scan-german-gsm.sh`       | 89    | ARCHIVE                     | Region-specific     |
| `sweep-gsm-band.sh`        | 101   | MERGE into gsm-evil-diag.sh | Sweep functionality |
| `find-imsi-frequencies.sh` | 74    | ARCHIVE                     | Ad-hoc scan         |
| `usrp_sweep_gsm.sh`        | 46    | ARCHIVE                     | USRP-specific sweep |

#### Python files (8 files, 1,028 total lines) -- KEEP 2, ARCHIVE 6

| File                            | Lines | Disposition | Reason                              |
| ------------------------------- | ----- | ----------- | ----------------------------------- |
| `gsmevil2-patch.py`             | 54    | ARCHIVE     | One-time patch                      |
| `monitor-gsmtap.py`             | 111   | KEEP        | Active monitoring tool              |
| `simple-gsm-frequency-test.py`  | 180   | ARCHIVE     | Test script                         |
| `test-gsm-frequencies.py`       | 170   | ARCHIVE     | Test script                         |
| `test-usrp-gsm-simple.py`       | 85    | ARCHIVE     | Test script                         |
| `usrp_gsm_scanner.py`           | 175   | ARCHIVE     | Superseded by usrp_spectrum_scan.py |
| `grgsm_livemon_usrp_working.py` | 219   | KEEP        | Active grgsm launcher               |
| `grgsm_livemon_usrp_wrapper.py` | 34    | ARCHIVE     | Simple wrapper                      |

#### Extensionless wrappers (3 files, 516 total lines) -- KEEP 1, ARCHIVE 2

| File                                | Lines | Disposition | Reason                          |
| ----------------------------------- | ----- | ----------- | ------------------------------- |
| `grgsm_livemon_headless_usrp`       | 302   | ARCHIVE     | Original, superseded by \_fixed |
| `grgsm_livemon_headless_usrp_fixed` | 175   | KEEP        | Active fixed version            |
| `grgsm_livemon_wrapper`             | 39    | ARCHIVE     | Superseded by \_usrp_wrapper.py |

### 5.2 Consolidated GSM Scripts (Target: 8 files)

#### 5.2.1 gsm-evil.sh (~250 lines) -- Unified start/stop/status

Merge logic from: `gsmevil-configurable-start.sh` (parameterized start), `start-gsmevil2.sh` (Docker logic), `start-gsm-evil-server.sh` (server start), `gsm-evil-stop.sh` (comprehensive stop), `nuclear-stop-gsmevil.sh` (force stop).

```
Usage: gsm-evil.sh {start|stop|force-stop|status|restart} [OPTIONS]
  start     --freq <MHz> --gain <dB> --imsi --docker
  stop      Graceful shutdown of all GSM Evil processes
  force-stop  Kill all GSM Evil processes (nuclear option)
  status    Show running GSM Evil process state
  restart   Stop then start with same options
```

**Subtask 5.2.1a**: Extract common functions from the 6 merge sources into the unified script.

```bash
# Identify shared patterns across merge sources
grep -h 'docker.*gsmevil\|grgsm_livemon\|kill.*gsmevil\|pkill.*grgsm' \
  scripts/gsmevil-configurable-start.sh \
  scripts/start-gsmevil2.sh \
  scripts/start-gsm-evil-server.sh \
  scripts/gsm-evil-stop.sh \
  scripts/nuclear-stop-gsmevil.sh | sort -u
```

**Subtask 5.2.1b**: Write the unified script with subcommand dispatch.

**Subtask 5.2.1c**: Test each subcommand.

```bash
bash scripts/gsm-evil.sh status
# Must exit 0 and print process state (even if none running)

bash -n scripts/gsm-evil.sh
# Must exit 0 (syntax check)
```

#### 5.2.2 gsm-evil-diag.sh (~300 lines) -- Unified diagnostic/scan

Merge logic from: `diagnose-gsm-evil.sh`, `diagnose-usrp-gsm.sh`, `gsm-full-diagnostic.sh`, `gsm-frequency-scanner.sh`, `sweep-gsm-band.sh`.

```
Usage: gsm-evil-diag.sh {diagnose|scan|sweep} [OPTIONS]
  diagnose  --usrp   Full diagnostic of GSM Evil stack
  scan      --band <900|1800|850|1900>  Scan GSM frequencies
  sweep     --start <MHz> --stop <MHz>  Sweep frequency range
```

#### 5.2.3 gsm-evil-setup.sh (~50 lines) -- Unified setup

Merge: `setup-gsmevil-sudoers.sh` (26 lines) + `enable-imsi-curl.sh` (18 lines).

```
Usage: gsm-evil-setup.sh {sudoers|imsi|all}
```

#### 5.2.4 KEEP as-is (3 files)

- `patch-gsmevil-socketio.sh` (36 lines) -- production-referenced, do not rename
- `monitor-gsmtap.py` (111 lines) -- active monitoring
- `grgsm_livemon_usrp_working.py` (219 lines) -- active grgsm launcher

#### 5.2.5 KEEP as-is (1 extensionless)

- `grgsm_livemon_headless_usrp_fixed` (175 lines) -- active fixed version

### 5.3 Execution Steps

```bash
# Step 1: Create archive subdirectory
mkdir -p scripts/_archived/phase-6.2/gsm

# Step 2: Archive the 44 files being eliminated
# START variants (21 files -- all except gsm-evil-start.sh which is also archived)
for f in gsm-evil-start.sh gsm-evil-start-no-sudo.sh gsm-evil-start-wrapper.sh \
  gsmevil-simple-start.sh gsmevil-configurable-start.sh gsmevil-readme-start.sh \
  gsmevil-video-start.sh start-gsmevil2.sh start-gsmevil2-fixed.sh \
  start-gsmevil-dynamic.sh start-gsm-evil-server.sh start-gsmevil-with-imsi.sh \
  gsm-evil-with-imsi.sh gsm-evil-with-auto-imsi.sh gsm-evil-production.sh \
  gsm-evil-dragonos.sh gsm-evil-final.sh gsm-evil-fixed.sh gsm-evil-fix-and-start.sh \
  gsm-evil-working.sh gsm-evil-public.sh gsm-evil-simple.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# STOP variants (all 6)
for f in gsm-evil-stop.sh gsmevil-simple-stop.sh stop-gsmevil2.sh \
  stop-gsmevil2-fixed.sh nuclear-stop-gsmevil.sh verify-gsm-stop-bulletproof.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# DIAGNOSTIC (4 of 6 -- diagnose-gsm-evil.sh and gsm-full-diagnostic.sh merged first)
for f in diagnose-gsm-evil.sh diagnose-usrp-gsm.sh debug-gsm-scan.sh debug-usrp-gsm.sh \
  gsm-full-diagnostic.sh gsm-frequency-scanner.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# SETUP (2 of 3 -- patch-gsmevil-socketio.sh stays)
for f in setup-gsmevil-sudoers.sh enable-imsi-curl.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# SCAN/TEST (all 5)
for f in auto-scan-gsm.sh scan-german-gsm.sh sweep-gsm-band.sh \
  find-imsi-frequencies.sh usrp_sweep_gsm.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# Python (6 of 8)
for f in gsmevil2-patch.py simple-gsm-frequency-test.py test-gsm-frequencies.py \
  test-usrp-gsm-simple.py usrp_gsm_scanner.py grgsm_livemon_usrp_wrapper.py; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# Extensionless (2 of 3)
for f in grgsm_livemon_headless_usrp grgsm_livemon_wrapper; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/gsm/$f"
done

# Step 3: Create consolidated scripts (gsm-evil.sh, gsm-evil-diag.sh, gsm-evil-setup.sh)
# Implementation per subtasks 5.2.1-5.2.3 above

# Step 4: Also archive check-grgsm-antenna-support.sh (14 lines, functionality merged into gsm-evil-setup.sh)
mv scripts/check-grgsm-antenna-support.sh scripts/_archived/phase-6.2/gsm/

# Step 5: Also archive enable-imsi-sniffer.py (Python, 39 lines, one-time enablement)
mv scripts/enable-imsi-sniffer.py scripts/_archived/phase-6.2/gsm/
# And imsi-hunter.py (Python, 180 lines, standalone tool, not referenced by production code)
mv scripts/imsi-hunter.py scripts/_archived/phase-6.2/gsm/
# And monitor-imsi-live.py (Python, 125 lines, superseded by monitor-gsmtap.py)
mv scripts/monitor-imsi-live.py scripts/_archived/phase-6.2/gsm/
```

### 5.4 Post-Execution Verification

```bash
# Count remaining GSM-related files at top level
ls scripts/ | grep -iE 'gsm|gsmevil|grgsm|imsi' | wc -l
# EXPECTED: 7 files:
#   gsm-evil.sh (NEW -- unified start/stop/status)
#   gsm-evil-diag.sh (NEW -- unified diagnostic/scan)
#   gsm-evil-setup.sh (NEW -- unified setup)
#   patch-gsmevil-socketio.sh (KEPT -- production-referenced)
#   monitor-gsmtap.py (KEPT -- active monitoring)
#   grgsm_livemon_usrp_working.py (KEPT -- active grgsm launcher)
#   grgsm_livemon_headless_usrp_fixed (KEPT -- active fixed version)

# Verify production reference still works
test -f scripts/patch-gsmevil-socketio.sh && echo "PASS" || echo "FAIL"

# Syntax check new scripts
bash -n scripts/gsm-evil.sh && echo "PASS: gsm-evil.sh syntax" || echo "FAIL"
bash -n scripts/gsm-evil-diag.sh && echo "PASS: gsm-evil-diag.sh syntax" || echo "FAIL"
bash -n scripts/gsm-evil-setup.sh && echo "PASS: gsm-evil-setup.sh syntax" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/gsm/ | wc -l
# EXPECTED: 48 (44 original + check-grgsm-antenna-support.sh + enable-imsi-sniffer.py + imsi-hunter.py + monitor-imsi-live.py)
```

**Files Eliminated**: 48 archived, 3 new created. Net reduction: 45 files.
**Lines Eliminated**: ~4,500 lines archived (duplicates + superseded).
**Lines Created**: ~600 lines in 3 new consolidated scripts.
**Net Line Reduction**: ~3,900 lines.

---

## 6. Task 6.2.3: Kismet Script Consolidation

**Objective**: Reduce 13 Kismet-related files (10 .sh + 3 .conf) to 5 files total. Archive 8 files.

### 6.1 Kismet Script Inventory

| File                           | Lines | Disposition                  | Reason                               |
| ------------------------------ | ----- | ---------------------------- | ------------------------------------ |
| `start-kismet.sh`              | 58    | MERGE into kismet.sh         | Basic start                          |
| `start-kismet-safe.sh`         | 53    | MERGE into kismet.sh         | Safe-mode start                      |
| `start-kismet-skip-adapter.sh` | 55    | MERGE into kismet.sh         | No-adapter start                     |
| `start-kismet-with-alfa.sh`    | 100   | KEEP (production-referenced) | Referenced by processManager.ts      |
| `configure-kismet-gps.sh`      | 67    | KEEP                         | GPS configuration                    |
| `setup-kismet-adapter.sh`      | 62    | KEEP (production-referenced) | Referenced by start-with-adapter API |
| `kismet-graceful-stop.sh`      | 36    | MERGE into kismet.sh         | Graceful stop                        |
| `safe-stop-kismet.sh`          | 23    | ARCHIVE                      | Subset of graceful-stop              |
| `stop-kismet-safe.sh`          | 117   | MERGE into kismet.sh         | Comprehensive stop                   |
| `update-kismet-service.sh`     | 28    | ARCHIVE                      | One-time setup                       |
| `kismet-gps-only.conf`         | 23    | KEEP                         | Referenced context (GPS-only config) |
| `kismet-no-auto-source.conf`   | 23    | KEEP (production-referenced) | Referenced by start-safe API         |
| `kismet-site-simple.conf`      | 25    | KEEP (production-referenced) | Referenced by start-with-adapter API |

### 6.2 Consolidated Kismet Scripts (Target: 5 files + 3 configs = 8 total, but configs stay)

#### 6.2.1 kismet.sh (~180 lines) -- Unified start/stop/status

Merge logic from: `start-kismet.sh`, `start-kismet-safe.sh`, `start-kismet-skip-adapter.sh`, `kismet-graceful-stop.sh`, `stop-kismet-safe.sh`.

```
Usage: kismet.sh {start|start-safe|start-no-adapter|stop|force-stop|status} [OPTIONS]
  start           Standard Kismet start with adapter detection
  start-safe      Start with no-auto-source config
  start-no-adapter Start without WiFi adapter
  stop            Graceful shutdown
  force-stop      Kill all Kismet processes
  status          Show Kismet process state
```

**NOTE**: `start-kismet-with-alfa.sh` stays at its current path because it is referenced by `src/lib/server/wifite/processManager.ts` line 353. If this file is renamed, the TypeScript reference MUST be updated in the same commit.

#### 6.2.2 Files KEPT as-is

- `start-kismet-with-alfa.sh` (100 lines) -- production-referenced
- `setup-kismet-adapter.sh` (62 lines) -- production-referenced
- `configure-kismet-gps.sh` (67 lines) -- standalone GPS config
- `kismet-gps-only.conf` (23 lines) -- config file
- `kismet-no-auto-source.conf` (23 lines) -- production-referenced
- `kismet-site-simple.conf` (25 lines) -- production-referenced

### 6.3 Execution Steps

```bash
mkdir -p scripts/_archived/phase-6.2/kismet

# Archive 5 scripts being merged
for f in start-kismet.sh start-kismet-safe.sh start-kismet-skip-adapter.sh \
  kismet-graceful-stop.sh stop-kismet-safe.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/kismet/$f"
done

# Archive 2 scripts being eliminated
for f in safe-stop-kismet.sh update-kismet-service.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/kismet/$f"
done

# Create consolidated kismet.sh
# Implementation merges start/stop/status subcommands
```

### 6.4 Post-Execution Verification

```bash
# Count remaining Kismet scripts (excluding .conf files)
ls scripts/ | grep -i kismet | grep '\.sh$' | wc -l
# EXPECTED: 4 (kismet.sh NEW, start-kismet-with-alfa.sh, setup-kismet-adapter.sh, configure-kismet-gps.sh)

# Count remaining Kismet configs
ls scripts/ | grep -i kismet | grep '\.conf$' | wc -l
# EXPECTED: 3

# Verify production references
test -f scripts/start-kismet-with-alfa.sh && echo "PASS" || echo "FAIL"
test -f scripts/setup-kismet-adapter.sh && echo "PASS" || echo "FAIL"
test -f scripts/kismet-no-auto-source.conf && echo "PASS" || echo "FAIL"
test -f scripts/kismet-site-simple.conf && echo "PASS" || echo "FAIL"

# Syntax check new script
bash -n scripts/kismet.sh && echo "PASS: kismet.sh syntax" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/kismet/ | wc -l
# EXPECTED: 7
```

**Files Eliminated**: 7 archived, 1 new created. Net reduction: 6 files.
**Lines Eliminated**: ~360 lines archived.
**Lines Created**: ~180 lines in kismet.sh.
**Net Line Reduction**: ~180 lines.

---

## 7. Task 6.2.4: WiFi/Adapter Script Consolidation

**Objective**: Reduce 11 WiFi/adapter-related scripts (950 total lines) to 3 scripts. Archive 8 files.

### 7.1 WiFi/Adapter Script Inventory

| File                           | Lines | Disposition                    | Reason                          |
| ------------------------------ | ----- | ------------------------------ | ------------------------------- |
| `detect-alfa-adapter.sh`       | 125   | MERGE into wifi-adapter.sh     | ALFA detection                  |
| `detect-any-wifi-adapter.sh`   | 110   | MERGE into wifi-adapter.sh     | Generic detection               |
| `diagnose-wifi-adapter.sh`     | 110   | MERGE into wifi-adapter.sh     | Diagnostic                      |
| `fix-alfa-only.sh`             | 92    | MERGE into wifi-adapter-fix.sh | ALFA-specific fix               |
| `fix-argos-ap-mt7921.sh`       | 94    | MERGE into wifi-adapter-fix.sh | MT7921-specific fix             |
| `fix-mt76-adapter.sh`          | 155   | MERGE into wifi-adapter-fix.sh | MT76 driver fix                 |
| `fix-wifi-now.sh`              | 53    | MERGE into wifi-adapter-fix.sh | Quick fix                       |
| `reset-wifi-adapter.sh`        | 60    | MERGE into wifi-adapter-fix.sh | Reset logic                     |
| `safe-adapter-reset.sh`        | 83    | MERGE into wifi-adapter-fix.sh | Safe reset                      |
| `safe-fix-adapter.sh`          | 44    | ARCHIVE                        | Subset of safe-adapter-reset.sh |
| `configure-usb-persistence.sh` | 24    | KEEP                           | USB persistence config          |

**Additional WiFi-related scripts at top level** (not in the 11 above, handled separately):

| File                                      | Lines | Disposition | Reason                                            |
| ----------------------------------------- | ----- | ----------- | ------------------------------------------------- |
| `argos-wifi-resilience.sh`                | 414   | KEEP        | Comprehensive resilience daemon, distinct purpose |
| `ensure-alfa-boot.sh`                     | 260   | KEEP        | Boot-time ALFA config, distinct purpose           |
| `argos-ap-simple.sh`                      | 180   | KEEP        | AP creation, distinct purpose                     |
| `create-ap-simple.sh`                     | 54    | ARCHIVE     | Subset of argos-ap-simple.sh                      |
| `create-virtual-monitor.sh`               | 48    | KEEP        | Monitor mode setup                                |
| `setup-interface-names.sh`                | 29    | KEEP        | udev rule setup                                   |
| `update-configs-for-descriptive-names.sh` | 48    | KEEP        | Config updater                                    |

### 7.2 Consolidated WiFi Scripts (Target: 3 from the core 11)

#### 7.2.1 wifi-adapter.sh (~200 lines) -- Unified detect/diagnose

```
Usage: wifi-adapter.sh {detect|detect-alfa|diagnose} [OPTIONS]
  detect       Detect any WiFi adapter
  detect-alfa  Detect ALFA adapter specifically
  diagnose     Run WiFi adapter diagnostics
```

#### 7.2.2 wifi-adapter-fix.sh (~250 lines) -- Unified fix/reset

```
Usage: wifi-adapter-fix.sh {fix|fix-alfa|fix-mt76|fix-mt7921|reset|safe-reset} [OPTIONS]
  fix          Auto-detect and fix WiFi adapter issues
  fix-alfa     ALFA-specific fix
  fix-mt76     MT76 driver fix
  fix-mt7921   MT7921 AP fix
  reset        Reset WiFi adapter
  safe-reset   Safe reset with pre-checks
```

#### 7.2.3 configure-usb-persistence.sh (24 lines) -- KEEP as-is

### 7.3 Execution Steps

```bash
mkdir -p scripts/_archived/phase-6.2/wifi

# Archive 8 scripts being merged/eliminated
for f in detect-alfa-adapter.sh detect-any-wifi-adapter.sh diagnose-wifi-adapter.sh \
  fix-alfa-only.sh fix-argos-ap-mt7921.sh fix-mt76-adapter.sh fix-wifi-now.sh \
  reset-wifi-adapter.sh safe-adapter-reset.sh safe-fix-adapter.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/wifi/$f"
done

# Also archive create-ap-simple.sh (subset of argos-ap-simple.sh)
mv scripts/create-ap-simple.sh scripts/_archived/phase-6.2/wifi/

# Create consolidated scripts
# Implementation per subtasks 7.2.1-7.2.2 above
```

### 7.4 Post-Execution Verification

```bash
# Count WiFi-related scripts (detection + fix)
ls scripts/wifi-adapter*.sh scripts/configure-usb-persistence.sh 2>/dev/null | wc -l
# EXPECTED: 3 (wifi-adapter.sh, wifi-adapter-fix.sh, configure-usb-persistence.sh)

# Syntax check
bash -n scripts/wifi-adapter.sh && echo "PASS" || echo "FAIL"
bash -n scripts/wifi-adapter-fix.sh && echo "PASS" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/wifi/ | wc -l
# EXPECTED: 11 (10 from core + create-ap-simple.sh)
```

**Files Eliminated**: 11 archived, 2 new created. Net reduction: 9 files.
**Lines Eliminated**: ~1,004 lines archived.
**Lines Created**: ~450 lines in 2 new consolidated scripts.
**Net Line Reduction**: ~554 lines.

---

## 8. Task 6.2.5: Keepalive/Process Script Consolidation

**Objective**: Reduce 7 keepalive/process management scripts (1,365 total lines) to 4 scripts. Archive 3 files.

### 8.1 Keepalive Script Inventory

| File                       | Lines | Disposition               | Reason                                     |
| -------------------------- | ----- | ------------------------- | ------------------------------------------ |
| `keepalive.sh`             | 26    | ARCHIVE                   | Trivial, subset of simple-keepalive.sh     |
| `simple-keepalive.sh`      | 100   | KEEP (service-referenced) | Referenced by simple-keepalive.service     |
| `dev-server-keepalive.sh`  | 254   | KEEP (service-referenced) | Referenced by dev-server-keepalive.service |
| `manage-keepalive.sh`      | 185   | KEEP                      | Keepalive management                       |
| `argos-keepalive.sh`       | 443   | KEEP                      | Comprehensive keepalive                    |
| `argos-process-manager.sh` | 226   | KEEP                      | Process management                         |
| `wifi-keepalive-robust.sh` | 131   | KEEP (service-referenced) | Referenced by wifi-keepalive.service       |

### 8.2 Rationale for Minimal Consolidation

Unlike GSM scripts (22 variants of "start"), the keepalive scripts serve genuinely different purposes:

- `simple-keepalive.sh` -- lightweight dev server monitor
- `dev-server-keepalive.sh` -- comprehensive dev server watchdog with port checks
- `argos-keepalive.sh` -- production-grade multi-service keepalive
- `wifi-keepalive-robust.sh` -- WiFi-specific connection keepalive
- `argos-process-manager.sh` -- process lifecycle management (start/stop/restart)
- `manage-keepalive.sh` -- keepalive service install/uninstall/status

Three of these are referenced by systemd service files and cannot be renamed without updating the service file path. Only `keepalive.sh` (26 lines) is purely redundant.

### 8.3 Execution Steps

```bash
mkdir -p scripts/_archived/phase-6.2/keepalive

# Archive the one redundant script
mv scripts/keepalive.sh scripts/_archived/phase-6.2/keepalive/
```

### 8.4 Post-Execution Verification

```bash
ls scripts/*keepalive* scripts/argos-process-manager.sh 2>/dev/null | wc -l
# EXPECTED: 6 (simple-keepalive.sh, dev-server-keepalive.sh, manage-keepalive.sh,
#              argos-keepalive.sh, argos-process-manager.sh, wifi-keepalive-robust.sh)

# Verify service references still valid
test -f scripts/simple-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/dev-server-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/wifi-keepalive-robust.sh && echo "PASS" || echo "FAIL"
```

**Files Eliminated**: 1 archived. Net reduction: 1 file.
**Lines Eliminated**: 26 lines.

---

## 9. Task 6.2.6: Install Script Consolidation

**Objective**: Reduce 18 install-related scripts (including install/ directory) to 12 scripts. Archive 6 files.

### 9.1 Install Script Inventory

#### Top-level install scripts (8 files, 1,768 lines)

| File                             | Lines | Disposition | Reason                                       |
| -------------------------------- | ----- | ----------- | -------------------------------------------- |
| `install-argos.sh`               | 384   | KEEP        | Primary Argos installer                      |
| `install-framework.sh`           | 295   | KEEP        | Framework validation installer               |
| `install-management.sh`          | 481   | KEEP        | Management tools installer                   |
| `install-system-dependencies.sh` | 486   | KEEP        | System dependency installer                  |
| `install-openwebrx-hackrf.sh`    | 426   | KEEP        | OpenWebRX HackRF installer                   |
| `install-droneid-service.sh`     | 32    | KEEP        | DroneID service installer                    |
| `install-usrp-support.sh`        | 43    | ARCHIVE     | Redundant with install/\_uhd.sh + setup-usrp |
| `install_uhd.sh`                 | 47    | ARCHIVE     | Duplicate of install/install_uhd.sh          |

#### install/ directory (8 files + 1 log, 2,186 lines)

| File                               | Lines | Disposition | Reason               |
| ---------------------------------- | ----- | ----------- | -------------------- |
| `install/install_coral_support.sh` | 87    | KEEP        | Coral TPU installer  |
| `install/install-from-git.sh`      | 619   | KEEP        | Git-based installer  |
| `install/install-modified.sh`      | 502   | KEEP        | Modified installer   |
| `install/install.sh`               | 454   | KEEP        | Standard installer   |
| `install/install_uhd.sh`           | 32    | KEEP        | UHD driver installer |
| `install/quick-install.sh`         | 224   | KEEP        | Quick installer      |
| `install/setup-opencellid.sh`      | 223   | KEEP        | OpenCellID setup     |
| `install/setup-usrp-simple.sh`     | 45    | KEEP        | Simple USRP setup    |
| `install/install-from-git.log`     | N/A   | ARCHIVE     | Build artifact       |

### 9.2 Deduplication Details

The deploy/ directory duplicates of install/ were already eliminated in Task 6.2.1. The remaining duplicates at top level are:

1. `install_uhd.sh` (top-level, 47 lines) vs `install/install_uhd.sh` (32 lines) -- NOT byte-identical (top-level has 15 extra lines of logging). Archive the top-level version; install/ version is canonical.

2. `install-usrp-support.sh` (43 lines) -- functionality covered by `install/install_uhd.sh` + `install/setup-usrp-simple.sh`. Archive.

### 9.3 Execution Steps

```bash
mkdir -p scripts/_archived/phase-6.2/install

# Archive top-level duplicates
mv scripts/install_uhd.sh scripts/_archived/phase-6.2/install/
mv scripts/install-usrp-support.sh scripts/_archived/phase-6.2/install/

# Archive build artifact
mv scripts/install/install-from-git.log scripts/_archived/phase-6.2/install/
```

### 9.4 Post-Execution Verification

```bash
# Count top-level install scripts
ls scripts/install-*.sh scripts/install/*.sh 2>/dev/null | wc -l
# EXPECTED: 14 (6 top-level + 8 in install/)

# Verify no duplicate install_uhd.sh at top level
test ! -f scripts/install_uhd.sh && echo "PASS: top-level install_uhd.sh removed" || echo "FAIL"
test -f scripts/install/install_uhd.sh && echo "PASS: install/install_uhd.sh preserved" || echo "FAIL"

# Verify no build artifacts remain
test ! -f scripts/install/install-from-git.log && echo "PASS" || echo "FAIL"
```

**Files Eliminated**: 3 archived (2 .sh + 1 .log). Net reduction: 3 files.
**Lines Eliminated**: ~90 lines.

---

## 10. Task 6.2.7: Remaining Top-Level Script Organization

**Objective**: Classify every remaining top-level script into KEEP, ARCHIVE, or RELOCATE. Ensure no unclassified scripts remain.

### 10.1 CPU/System Protection Scripts

| File                     | Lines | Disposition | Reason                               |
| ------------------------ | ----- | ----------- | ------------------------------------ |
| `cpu-guardian.sh`        | 474   | ARCHIVE     | Superseded by argos-cpu-protector.sh |
| `argos-cpu-protector.sh` | 303   | KEEP        | Active CPU protection                |

**Verification**:

```bash
# cpu-guardian.sh is not referenced by any production code
grep -rn 'cpu-guardian' --include='*.ts' --include='*.service' src/ deployment/ scripts/ 2>/dev/null
# EXPECTED: no output (if output found, do not archive)
```

### 10.2 Database Scripts

| File                      | Lines | Disposition | Reason             |
| ------------------------- | ----- | ----------- | ------------------ |
| `db-backup.sh`            | 128   | KEEP        | Database backup    |
| `db-cleanup.sh`           | 169   | KEEP        | Database cleanup   |
| `setup-db-cron.sh`        | 38    | KEEP        | Cron job setup     |
| `add-altitude-column.sql` | N/A   | ARCHIVE     | One-time migration |

### 10.3 Docker/Deployment Scripts

| File                           | Lines | Disposition | Reason                         |
| ------------------------------ | ----- | ----------- | ------------------------------ |
| `docker-automation.sh`         | 307   | KEEP        | Docker lifecycle               |
| `docker-claude-terminal.sh`    | 28    | KEEP        | Terminal launcher              |
| `docker-image-manager.sh`      | 297   | KEEP        | Image management               |
| `deploy-containers.sh`         | 257   | KEEP        | Container deployment           |
| `deploy-master.sh`             | 420   | KEEP        | Master deployment orchestrator |
| `deploy-openwebrx.sh`          | 138   | KEEP        | OpenWebRX deployment           |
| `deployment-status-api.sh`     | 207   | KEEP        | Status API                     |
| `one-button-deploy.sh`         | 131   | KEEP        | Simplified deployment          |
| `validate-deployment-guide.sh` | 239   | KEEP        | Deployment validation          |

### 10.4 Developer Tooling Scripts

| File                     | Lines | Disposition                  | Reason                 |
| ------------------------ | ----- | ---------------------------- | ---------------------- |
| `agent-coordinator.sh`   | 307   | KEEP                         | AI agent orchestration |
| `parallel-agent-init.sh` | 193   | KEEP                         | Parallel agent init    |
| `pre-commit-hook.sh`     | 199   | KEEP                         | Git pre-commit hook    |
| `mcp-start.sh`           | 14    | KEEP                         | MCP server launcher    |
| `tmux-zsh-wrapper.sh`    | 20    | KEEP (production-referenced) | Terminal shell         |
| `direct-vite-start.sh`   | 25    | KEEP                         | Vite direct start      |
| `vite-manager.sh`        | 74    | KEEP                         | Vite process manager   |
| `dev-setup.sh`           | 59    | KEEP                         | Dev environment setup  |
| `startup-check.sh`       | 129   | KEEP                         | Startup validation     |
| `build-production.sh`    | 231   | KEEP                         | Production build       |

### 10.5 SDR Hardware Scripts (non-GSM)

| File                          | Lines | Disposition | Reason                                                  |
| ----------------------------- | ----- | ----------- | ------------------------------------------------------- |
| `check-hackrf-busy.sh`        | 61    | KEEP        | HackRF status check                                     |
| `check-usrp-busy.sh`          | 17    | KEEP        | USRP status check                                       |
| `disable-hackrf-logs.sh`      | 28    | KEEP        | Log management                                          |
| `configure-openwebrx-b205.sh` | 142   | KEEP        | B205 configuration                                      |
| `configure-usrp-immediate.sh` | 113   | KEEP        | USRP immediate config                                   |
| `final-usrp-setup.sh`         | 100   | ARCHIVE     | "Final" naming indicates iteration; covered by install/ |
| `find-working-usrp-config.sh` | 102   | ARCHIVE     | Discovery script, one-time use                          |
| `fix-usrp-drivers.sh`         | 67    | KEEP        | Driver fix                                              |
| `verify-usrp-working.sh`      | 64    | KEEP        | USRP verification                                       |

### 10.6 USB Reset Scripts

| File                    | Lines | Disposition | Reason                           |
| ----------------------- | ----- | ----------- | -------------------------------- |
| `advanced-usb-reset.sh` | 194   | KEEP        | Advanced USB reset               |
| `nuclear-usb-reset.sh`  | 151   | ARCHIVE     | Covered by advanced-usb-reset.sh |

**Verification**:

```bash
grep -rn 'nuclear-usb-reset' --include='*.ts' --include='*.service' src/ deployment/ 2>/dev/null
# EXPECTED: no output
```

### 10.7 System Setup Scripts

| File                                      | Lines | Disposition | Reason                           |
| ----------------------------------------- | ----- | ----------- | -------------------------------- |
| `setup-host.sh`                           | 112   | ARCHIVE     | Subset of setup-host-complete.sh |
| `setup-host-complete.sh`                  | 529   | KEEP        | Comprehensive host setup         |
| `setup-swap.sh`                           | 119   | KEEP        | Swap configuration               |
| `setup-system-management.sh`              | 283   | KEEP        | System management setup          |
| `setup-offline-maps.sh`                   | 202   | KEEP        | Offline map setup                |
| `setup-interface-names.sh`                | 29    | KEEP        | Interface naming                 |
| `update-configs-for-descriptive-names.sh` | 48    | KEEP        | Config updater                   |
| `log-rotation.sh`                         | 27    | KEEP        | Log rotation                     |

### 10.8 DroneID Scripts

| File                       | Lines | Disposition | Reason          |
| -------------------------- | ----- | ----------- | --------------- |
| `droneid-channel-hop.sh`   | 41    | KEEP        | Channel hopping |
| `start-droneid.sh`         | 49    | KEEP        | DroneID start   |
| `stop-droneid.sh`          | 28    | KEEP        | DroneID stop    |
| `setup-droneid-backend.sh` | 120   | KEEP        | Backend setup   |
| `setup-droneid-sudoers.sh` | 40    | KEEP        | Sudoers config  |

### 10.9 Cell Tower / OpenCellID Scripts

| File                            | Lines | Disposition | Reason                                |
| ------------------------------- | ----- | ----------- | ------------------------------------- |
| `create-sample-celltower-db.sh` | 134   | KEEP        | Sample DB creation                    |
| `setup-celltower-db.sh`         | 31    | KEEP        | DB setup                              |
| `download-opencellid.sh`        | 21    | ARCHIVE     | Subset of download-opencellid-full.sh |
| `download-opencellid-full.sh`   | 154   | KEEP        | Full OpenCellID download              |
| `setup-opencellid-full.sh`      | 95    | KEEP        | Full OpenCellID setup                 |
| `import-opencellid.sh`          | 62    | KEEP        | OpenCellID import                     |

### 10.10 OpenWebRX Integration

| File                           | Lines | Disposition | Reason               |
| ------------------------------ | ----- | ----------- | -------------------- |
| `integrate-openwebrx-argos.sh` | 168   | KEEP        | Integration script   |
| `setup-openwebrx-usrp.sh`      | 140   | KEEP        | USRP OpenWebRX setup |

### 10.11 GPS Scripts

| File                    | Lines | Disposition | Reason             |
| ----------------------- | ----- | ----------- | ------------------ |
| `gps-diagnostics.sh`    | 98    | KEEP        | GPS diagnostics    |
| `gps-status-monitor.sh` | 28    | KEEP        | GPS status monitor |

### 10.12 WiFi Resilience/AP Scripts (not covered by Task 6.2.4)

| File                        | Lines | Disposition | Reason                 |
| --------------------------- | ----- | ----------- | ---------------------- |
| `argos-wifi-resilience.sh`  | 414   | KEEP        | WiFi resilience daemon |
| `ensure-alfa-boot.sh`       | 260   | KEEP        | Boot-time ALFA         |
| `argos-ap-simple.sh`        | 180   | KEEP        | AP creation            |
| `create-virtual-monitor.sh` | 48    | KEEP        | Monitor mode           |

### 10.13 Service Files and Configs at Top Level

| File                           | Lines | Disposition | Reason             |
| ------------------------------ | ----- | ----------- | ------------------ |
| `simple-keepalive.service`     | N/A   | KEEP        | Service definition |
| `dev-server-keepalive.service` | N/A   | KEEP        | Service definition |
| `wifi-keepalive.service`       | N/A   | KEEP        | Service definition |

### 10.14 Non-Shell Files (Python, JS, TS, SQL) -- Classification

| File                           | Lines | Disposition                  | Reason                                   |
| ------------------------------ | ----- | ---------------------------- | ---------------------------------------- |
| `download_opencellid.py`       | 28    | KEEP                         | OpenCellID downloader                    |
| `import_celltowers.py`         | 180   | KEEP                         | Cell tower importer                      |
| `usrp_power_measure_real.py`   | 109   | KEEP (production-referenced) | Referenced by API                        |
| `usrp_power_scan.py`           | 140   | KEEP                         | USRP power scan                          |
| `usrp_simple_scanner.py`       | 63    | ARCHIVE                      | Superseded by usrp_spectrum_scan.py      |
| `usrp_spectrum_scan.py`        | 259   | KEEP (production-referenced) | Referenced by sweepManager.ts            |
| `usrp_working_scanner.py`      | 172   | ARCHIVE                      | "Working" naming indicates iteration     |
| `usrp_power_measure.sh`        | 27    | ARCHIVE                      | Superseded by usrp_power_measure_real.py |
| `usrp_simple_power.sh`         | 39    | ARCHIVE                      | Superseded by usrp_power_measure_real.py |
| `css-integrity-check.cjs`      | 297   | KEEP                         | Framework validation                     |
| `html-structure-validator.cjs` | 418   | KEEP                         | Framework validation                     |
| `visual-regression-check.cjs`  | 314   | KEEP                         | Framework validation                     |
| `logger.cjs`                   | 42    | KEEP                         | Logger utility                           |
| `mcp-config.ts`                | 38    | KEEP                         | MCP configuration                        |
| `mcp-install.ts`               | 56    | KEEP                         | MCP installer                            |
| `add-altitude-column.sql`      | 63    | ARCHIVE                      | One-time migration                       |
| `CLAUDE.md`                    | 42    | KEEP                         | Agent context file                       |

### 10.15 Audit/Analysis Python Scripts (created during audit, non-production)

| File                         | Lines | Disposition | Reason                        |
| ---------------------------- | ----- | ----------- | ----------------------------- |
| `audit-function-sizes.py`    | 476   | ARCHIVE     | Audit tooling, not production |
| `audit-function-sizes-v2.py` | 373   | ARCHIVE     | Audit tooling, not production |
| `compare-audit-to-plan.py`   | 402   | ARCHIVE     | Audit tooling, not production |
| `compare-audit-v2.py`        | 376   | ARCHIVE     | Audit tooling, not production |
| `verify-function-length.py`  | 320   | ARCHIVE     | Audit tooling, not production |

### 10.16 Subdirectory Scripts

#### monitoring/ (6 files, 488 lines) -- KEEP ALL

| File                                  | Lines | Disposition | Reason                |
| ------------------------------------- | ----- | ----------- | --------------------- |
| `monitoring/check-hackrf-status.sh`   | 43    | KEEP        | HackRF status         |
| `monitoring/check-memory-leaks.sh`    | 244   | KEEP        | Memory leak detection |
| `monitoring/diagnose-hackrf-crash.sh` | 81    | KEEP        | Crash diagnostics     |
| `monitoring/monitor-hackrf.sh`        | 36    | KEEP        | HackRF monitoring     |
| `monitoring/monitor-memory.sh`        | 51    | KEEP        | Memory monitoring     |
| `monitoring/restart-hackrf.sh`        | 33    | KEEP        | HackRF restart        |

#### infrastructure/ (3 files, 247 lines) -- KEEP ALL

| File                               | Lines | Disposition | Reason        |
| ---------------------------------- | ----- | ----------- | ------------- |
| `infrastructure/backup.sh`         | 166   | KEEP        | Backup script |
| `infrastructure/download-fonts.sh` | 69    | KEEP        | Font download |
| `infrastructure/setup-cron.sh`     | 12    | KEEP        | Cron setup    |

#### gps-integration/ (6 files, 880 lines) -- KEEP ALL

| File                                        | Lines | Disposition | Reason            |
| ------------------------------------------- | ----- | ----------- | ----------------- |
| `gps-integration/configure-prolific-gps.sh` | 210   | KEEP        | GPS configuration |
| `gps-integration/implement-gps-workflow.sh` | 317   | KEEP        | GPS workflow      |
| `gps-integration/validate-gps-workflow.sh`  | 150   | KEEP        | GPS validation    |
| `gps-integration/make-permanent-alias.sh`   | 25    | KEEP        | Alias setup       |
| `gps-integration/setup-alfa-naming.sh`      | 149   | KEEP        | ALFA naming       |
| `gps-integration/alfa-alias-reference.sh`   | 29    | KEEP        | ALFA reference    |

#### dev/ (10 files after relocation, ~611 lines) -- KEEP ALL

All files in dev/ are unique after Task 6.2.1 relocates 2 files from development/.

#### install/ (8 files after artifact removal, 2,186 lines) -- KEEP ALL

All files in install/ are canonical copies after deploy/ duplicates are archived.

### 10.17 Execution Steps for Task 6.2.7

```bash
mkdir -p scripts/_archived/phase-6.2/misc

# CPU
mv scripts/cpu-guardian.sh scripts/_archived/phase-6.2/misc/

# SDR hardware
mv scripts/final-usrp-setup.sh scripts/_archived/phase-6.2/misc/
mv scripts/find-working-usrp-config.sh scripts/_archived/phase-6.2/misc/

# USB
mv scripts/nuclear-usb-reset.sh scripts/_archived/phase-6.2/misc/

# System setup
mv scripts/setup-host.sh scripts/_archived/phase-6.2/misc/

# OpenCellID
mv scripts/download-opencellid.sh scripts/_archived/phase-6.2/misc/

# USRP Python/shell superseded
mv scripts/usrp_simple_scanner.py scripts/_archived/phase-6.2/misc/
mv scripts/usrp_working_scanner.py scripts/_archived/phase-6.2/misc/
mv scripts/usrp_power_measure.sh scripts/_archived/phase-6.2/misc/
mv scripts/usrp_simple_power.sh scripts/_archived/phase-6.2/misc/

# One-time migration
mv scripts/add-altitude-column.sql scripts/_archived/phase-6.2/misc/

# Audit tooling (non-production Python scripts)
mv scripts/audit-function-sizes.py scripts/_archived/phase-6.2/misc/
mv scripts/audit-function-sizes-v2.py scripts/_archived/phase-6.2/misc/
mv scripts/compare-audit-to-plan.py scripts/_archived/phase-6.2/misc/
mv scripts/compare-audit-v2.py scripts/_archived/phase-6.2/misc/
mv scripts/verify-function-length.py scripts/_archived/phase-6.2/misc/
```

### 10.18 Post-Execution Verification

```bash
# Verify each archived file is gone from scripts/
for f in cpu-guardian.sh final-usrp-setup.sh find-working-usrp-config.sh \
  nuclear-usb-reset.sh setup-host.sh download-opencellid.sh; do
  test ! -f "scripts/$f" && echo "PASS: $f archived" || echo "FAIL: $f still present"
done

# Verify production-referenced scripts are untouched
for f in tmux-zsh-wrapper.sh start-kismet-with-alfa.sh setup-kismet-adapter.sh \
  patch-gsmevil-socketio.sh simple-keepalive.sh dev-server-keepalive.sh \
  wifi-keepalive-robust.sh; do
  test -f "scripts/$f" && echo "PASS: $f present" || echo "FAIL: $f missing"
done

# Count archived in misc
ls scripts/_archived/phase-6.2/misc/ | wc -l
# EXPECTED: 16
```

**Files Eliminated**: 16 archived. Net reduction: 16 files.
**Lines Eliminated**: ~2,896 lines.

---

## 11. Task 6.2.8: Supply Chain and Credential Security Remediation

**Objective**: Remediate 331 security finding instances across 6 categories (2 CRITICAL, 4 HIGH) identified by the independent audit (2026-02-08). These findings affect both scripts being archived AND scripts being KEPT, so they must be addressed in the surviving 114 scripts. Consolidation without security remediation means the reduced script set inherits the worst security posture of all 202 originals.

**Priority**: CRITICAL -- These must be remediated either before or concurrent with consolidation tasks 6.2.1-6.2.7. Do NOT mark Phase 6.2 as complete until all subtasks in this section pass verification.

**Standards**: CWE-798 (Hardcoded Credentials), CWE-377 (Insecure Temporary File), CWE-829 (Inclusion of Functionality from Untrusted Control Sphere), NIST SP 800-218 PW.4.1, DISA STIG V-230380, CIS Benchmark 5.3.

### 11.1 CRITICAL: Hardcoded API Tokens (2 instances)

**Description**: Two shell scripts contain a hardcoded OpenCellID API token in plain text. This token is committed to version control and must be considered compromised.

**Detection Command**:

```bash
grep -rn 'API_KEY=.*"pk\.' scripts/ --include='*.sh' | grep -v '_archived'
# Verified output (2026-02-08):
#   scripts/download-opencellid-full.sh:6:API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
#   scripts/setup-opencellid-full.sh:4:API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
```

**Count**: 2 instances in 2 files.

**Remediation**:

1. Replace hardcoded token with environment variable lookup:

    ```bash
    # BEFORE (vulnerable):
    API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"

    # AFTER (remediated):
    API_KEY="${OPENCELLID_API_KEY:?ERROR: OPENCELLID_API_KEY not set. Export it or add to .env}"
    ```

2. Add `OPENCELLID_API_KEY` to the project `.env.example` with a placeholder value.
3. **Rotate the exposed token immediately** at https://opencellid.org -- the current token must be considered compromised since it exists in git history.
4. Add `**/scripts/**/*.key` and `**/scripts/**/*.token` patterns to `.gitignore` as a defense-in-depth measure.

**Verification Command**:

```bash
grep -rn 'pk\.d6291c07a2907c915cd8994fb22bc189' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0
grep -rn 'OPENCELLID_API_KEY' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return >= 2 (both files now use env var)
```

**Acceptance Criteria**: Zero hardcoded API tokens in any non-archived script. Token rotated. `.env.example` updated.

### 11.2 CRITICAL: curl|bash Remote Code Execution Vectors (22+ instances)

**Description**: Multiple scripts download remote content and pipe it directly to a shell interpreter (`curl ... | bash`, `curl ... | sh`, `wget ... | bash`). This is a supply chain attack vector -- a compromised or MITM'd upstream server can execute arbitrary code as root (many use `sudo`).

**Detection Command**:

```bash
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | grep -v '_archived' | grep -v '#'
# Count:
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | grep -v '_archived' | grep -v '#' | wc -l
# Verified count (2026-02-08): 22+ instances across 14+ files
```

**Count**: 22+ instances across 14+ files (exact count varies as some are in duplicate directories being archived).

**Remediation**:

For each `curl|bash` pattern, replace with the download-then-verify pattern:

```bash
# BEFORE (vulnerable):
curl -fsSL https://get.docker.com | sh

# AFTER (remediated):
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
curl -fsSL -o "$TMPFILE" https://get.docker.com
# Verify checksum if available (Docker publishes GPG signatures):
# gpg --verify "$TMPFILE.asc" "$TMPFILE" || { echo "GPG verification failed"; exit 1; }
chmod +x "$TMPFILE"
sh "$TMPFILE"
```

For scripts where upstream checksums/signatures are not available, at minimum:

1. Download to a temp file (not pipe to shell).
2. Log the SHA256 of the downloaded file before execution.
3. Set `set -euo pipefail` so failures are caught.

**Priority by file**:

- Scripts in `deploy/`, `development/`, `testing/`, `maintenance/` are being ARCHIVED (Task 6.2.1) -- remediate ONLY in the canonical copies that survive.
- Focus on the ~8-10 surviving scripts that contain this pattern (install-argos.sh, setup-host-complete.sh, install-system-dependencies.sh, etc.).

**Verification Command**:

```bash
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: Zero `curl|bash` or `wget|bash` patterns in any non-archived script.

### 11.3 CRITICAL: NOPASSWD Sudoers for /bin/kill \* (1 file, 2 rules)

**Description**: `scripts/setup-droneid-sudoers.sh` lines 22 and 32 grant `NOPASSWD: /bin/kill *` to the `ubuntu` and `node` users respectively. The wildcard `*` allows sending any signal to ANY process on the system without authentication. `kill -9 1` would crash the entire system. `kill -STOP` on sshd would lock out remote access.

**Detection Command**:

```bash
grep -rn 'NOPASSWD.*\/bin\/kill \*' scripts/ --include='*.sh' | grep -v '_archived'
# Verified output (2026-02-08):
#   scripts/setup-droneid-sudoers.sh:22:ubuntu ALL=(ALL) NOPASSWD: /bin/kill *
#   scripts/setup-droneid-sudoers.sh:32:node ALL=(ALL) NOPASSWD: /bin/kill *
```

**Count**: 2 rules in 1 file.

**Remediation**:

Replace the unrestricted `/bin/kill *` with specific, scoped alternatives:

```bash
# BEFORE (vulnerable):
ubuntu ALL=(ALL) NOPASSWD: /bin/kill *

# OPTION A -- Restrict to specific signal and process pattern:
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f dronesniffer/main.py

# OPTION B -- Use systemctl for service management (preferred):
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop droneid.service
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart droneid.service
```

Additionally, the same file (line 23, 33) grants `NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh` which is a secondary risk (arbitrary code execution via temp file replacement). Replace with a fixed path:

```bash
# BEFORE:
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh
# AFTER:
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /opt/argos/scripts/start-droneid.sh
```

**Verification Command**:

```bash
grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0
grep -rn 'NOPASSWD.*/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: No unrestricted `/bin/kill *` NOPASSWD rules. No NOPASSWD rules referencing `/tmp/` paths.

### 11.4 HIGH: Hardcoded Admin Passwords (3+ instances)

**Description**: Shell scripts contain plaintext admin passwords for service configuration. These are committed to version control and are visible to anyone with repository access.

**Detection Command**:

```bash
# Specific known instances:
grep -rn "argos123\|'hackrf'\|\"admin\"" scripts/ --include='*.sh' | grep -vi 'echo\|print\|#' | grep -v '_archived'
# Broader search for password assignments:
grep -rn 'PASSWORD=\|password.*=' scripts/ --include='*.sh' | grep -v '#' | grep -v '_archived' | \
  grep -v '""' | grep -v "=''" | grep -v '\${'
# Verified instances (2026-02-08):
#   scripts/configure-openwebrx-b205.sh:21  -- OWRX_ADMIN_PASSWORD = 'argos123'
#   scripts/configure-openwebrx-b205.sh:26  -- userlist.addUser('admin', 'argos123')
#   scripts/install-openwebrx-hackrf.sh:210 -- admin_password = hackrf
#   scripts/final-usrp-setup.sh:45          -- "password": "admin"
#   scripts/argos-wifi-resilience.sh:295    -- WIFI_PASSWORD="YourNetworkPassword" (placeholder but dangerous pattern)
```

**Count**: 3 confirmed hardcoded passwords + 1 placeholder password pattern in 4 files. Note: `final-usrp-setup.sh` is being archived in Task 6.2.7, but the other 3 files SURVIVE consolidation.

**Remediation**:

```bash
# BEFORE (vulnerable):
os.environ['OWRX_ADMIN_PASSWORD'] = 'argos123'

# AFTER (remediated):
os.environ['OWRX_ADMIN_PASSWORD'] = os.environ.get('OWRX_ADMIN_PASSWORD', '')
if not os.environ['OWRX_ADMIN_PASSWORD']:
    print("ERROR: OWRX_ADMIN_PASSWORD not set")
    sys.exit(1)
```

For each surviving file:

1. Replace hardcoded password with `${VARNAME:?ERROR: VARNAME not set}` pattern.
2. Add the variable to `.env.example` with a placeholder.
3. Document the required environment variables in the script header comment.

**Verification Command**:

```bash
grep -rn "argos123\|password.*=.*hackrf\|password.*=.*admin" scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: Zero plaintext passwords in any non-archived script. All password values sourced from environment variables or secure credential store.

### 11.5 HIGH: Hardcoded Tailscale/Internal IP Addresses (55 instances)

**Description**: 55 instances of hardcoded IP addresses (excluding 127.0.0.1, 0.0.0.0, and broadcast addresses) exist across shell scripts. These include Tailscale VPN IPs (100.x.x.x range), internal LAN IPs, and other infrastructure addresses. For a military EW training platform, hardcoded IPs are an OPSEC violation -- they leak network topology and are non-portable across deployment environments.

**Detection Command**:

```bash
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l
# Verified count (2026-02-08): 55
# To see the actual IPs:
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | \
  grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}' | sort -u
```

**Count**: 55 instances across multiple files.

**Remediation**:

1. Create a centralized network configuration file (aligns with Phase 6.3 `argos-env.sh`):
    ```bash
    # In argos-env.sh (Phase 6.3):
    export ARGOS_TAILSCALE_IP="${ARGOS_TAILSCALE_IP:-}"
    export ARGOS_LAN_IP="${ARGOS_LAN_IP:-}"
    export ARGOS_REMOTE_HOST="${ARGOS_REMOTE_HOST:-}"
    ```
2. Replace each hardcoded IP with the corresponding environment variable.
3. For scripts being archived, no action needed (they are eliminated).
4. Focus on surviving scripts -- after Task 6.2.1-6.2.7 archiving, re-count to get the surviving instance count.

**Verification Command**:

```bash
# Post-archival count (run after all consolidation tasks):
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l
# ACCEPTANCE: must return 0 (all IPs externalized to env vars or argos-env.sh)
```

**Acceptance Criteria**: Zero hardcoded non-loopback IP addresses in any non-archived script. All IPs sourced from environment variables or `argos-env.sh` configuration.

**NOTE**: This task has significant overlap with Phase 6.3 (Hardcoded Path Remediation). Coordinate execution to avoid double-work. IP externalization can be done in the same pass as path variable externalization.

### 11.6 HIGH: Unsafe /tmp Usage (185 instances vs. 3 mktemp uses)

**Description**: 185 references to `/tmp/` with predictable, hardcoded filenames. Only 3 scripts in the entire codebase use `mktemp` for safe temporary file creation. On multi-user systems, hardcoded `/tmp/` paths are vulnerable to symlink attacks (CWE-377) -- an attacker can create a symlink at the expected path pointing to a sensitive file, causing the script to overwrite or read the wrong file.

**Detection Command**:

```bash
# Count all /tmp/ references:
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# Verified count (2026-02-08): 185

# Count safe mktemp usage:
grep -rn 'mktemp' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# Verified count (2026-02-08): 4

# Identify the most dangerous patterns (write to /tmp with predictable names):
grep -rn '>/tmp/\|>>/tmp/\|mv.*\/tmp\/\|cp.*\/tmp\/' scripts/ --include='*.sh' | grep -v '_archived'
```

**Count**: 185 `/tmp/` instances; only 4 `mktemp` uses. Ratio: 46:1 unsafe-to-safe.

**Remediation**:

For each script that writes to `/tmp/`:

```bash
# BEFORE (vulnerable):
echo "$data" > /tmp/hackrf-status.txt
LOGFILE=/tmp/gsm-evil.log

# AFTER (remediated):
TMPDIR=$(mktemp -d "${TMPDIR:-/tmp}/argos-XXXXXX")
trap 'rm -rf "$TMPDIR"' EXIT
echo "$data" > "$TMPDIR/hackrf-status.txt"
LOGFILE="$TMPDIR/gsm-evil.log"
```

**Priority tiers** (remediate in this order):

1. **Tier 1 -- Scripts that write as root** (`sudo` + `/tmp/`): Highest symlink attack risk.
2. **Tier 2 -- Scripts that write sensitive data** (logs, credentials, configs) to `/tmp/`.
3. **Tier 3 -- Scripts that only read from `/tmp/`**: Lower risk but still non-portable.

**NOTE**: Many of the 185 instances are in scripts being archived (Tasks 6.2.1-6.2.2). After archiving, re-count to determine the surviving instance count. Estimate: ~80-100 instances will survive in the 114 retained scripts.

**Verification Command**:

```bash
# Post-remediation check (run after all tasks complete):
# Count remaining hardcoded /tmp/ paths (should be replaced with mktemp or $TMPDIR):
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | grep -v 'mktemp\|TMPDIR\|#' | wc -l
# ACCEPTANCE: must return 0

# Count mktemp usage (should be >= 1 per script that needs temp files):
grep -rn 'mktemp' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must be >= 20 (replacing the ~80-100 surviving hardcoded patterns)
```

**Acceptance Criteria**: Zero hardcoded `/tmp/filename` patterns in any non-archived script. All temporary file creation uses `mktemp` or `mktemp -d` with trap-based cleanup.

### 11.7 Execution Order for Security Remediation

```
Task 11.1 (API Tokens)      -- Execute FIRST (token rotation has external dependency)
    |
Task 11.3 (NOPASSWD kill)   -- Execute SECOND (immediate privilege escalation risk)
    |
Task 11.4 (Passwords)       -- Can parallel with 11.3
    |
Tasks 6.2.1-6.2.7           -- Consolidation tasks (archives reduce the scope of 11.2, 11.5, 11.6)
    |
Task 11.2 (curl|bash)       -- Execute AFTER archiving (only remediate surviving scripts)
    |
Task 11.5 (Hardcoded IPs)   -- Execute AFTER archiving, coordinate with Phase 6.3
    |
Task 11.6 (Unsafe /tmp)     -- Execute AFTER archiving (only remediate surviving scripts)
    |
    v
Verification Checklist (Section 12)
```

### 11.8 Security Remediation Summary

| Sub-Task  | Category               | Severity | Instance Count | Files Affected | Estimated Effort |
| --------- | ---------------------- | -------- | -------------- | -------------- | ---------------- |
| 11.1      | Hardcoded API Tokens   | CRITICAL | 2              | 2              | 0.5 hours        |
| 11.2      | curl\|bash RCE Vectors | CRITICAL | 22+            | 14+            | 4 hours          |
| 11.3      | NOPASSWD /bin/kill \*  | CRITICAL | 2              | 1              | 0.5 hours        |
| 11.4      | Hardcoded Passwords    | HIGH     | 3+             | 3+             | 1 hour           |
| 11.5      | Hardcoded IP Addresses | HIGH     | 55             | ~20            | 3 hours          |
| 11.6      | Unsafe /tmp Usage      | HIGH     | 185            | ~50            | 6 hours          |
| **TOTAL** |                        |          | **269+**       |                | **15 hours**     |

**NOTE**: Instance counts above reflect the pre-archival state (202 scripts). After Tasks 6.2.1-6.2.7 archive ~88 scripts, the surviving instance counts for 11.2, 11.5, and 11.6 will be lower. The total of 331 cited in the header includes duplicate-directory instances that will be eliminated by archiving.

---

## 12. Verification Checklist

Run all verification commands sequentially after all 8 tasks (6.2.1-6.2.8) are complete.

### 12.1 Total File Count

```bash
# Total active .sh files (excluding _archived)
find scripts/ -name '*.sh' -not -path '*_archived*' | wc -l
# EXPECTED: 114
```

**Arithmetic Reconciliation** (.sh files only):

| Task                 | Archived                                                                                                                                                      | New Created                                          | Net Change  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| 6.2.1 Duplicate Dirs | 23 (10 deploy + 4 development dupes + 5 testing + 4 maintenance) + 2 relocated                                                                                | 0                                                    | -23         |
| 6.2.2 GSM            | 42 (22 start + 6 stop + 6 diag + 2 setup + 5 scan + 1 check-grgsm)                                                                                            | 3 (gsm-evil.sh, gsm-evil-diag.sh, gsm-evil-setup.sh) | -39         |
| 6.2.3 Kismet         | 7 (5 merged + 2 eliminated)                                                                                                                                   | 1 (kismet.sh)                                        | -6          |
| 6.2.4 WiFi           | 11 (10 core + create-ap-simple.sh)                                                                                                                            | 2 (wifi-adapter.sh, wifi-adapter-fix.sh)             | -9          |
| 6.2.5 Keepalive      | 1 (keepalive.sh)                                                                                                                                              | 0                                                    | -1          |
| 6.2.6 Install        | 2 (install_uhd.sh, install-usrp-support.sh)                                                                                                                   | 0                                                    | -2          |
| 6.2.7 Remaining      | 8 (cpu-guardian, final-usrp-setup, find-working-usrp-config, nuclear-usb-reset, setup-host, download-opencellid, usrp_power_measure.sh, usrp_simple_power.sh) | 0                                                    | -8          |
| **TOTAL**            | **94 archived**                                                                                                                                               | **6 created**                                        | **-88 net** |

**Final .sh count: 202 - 88 = 114**

Non-.sh files also archived across all tasks:

| Task            | Files  | Details                                                                                  |
| --------------- | ------ | ---------------------------------------------------------------------------------------- |
| 6.2.2 GSM       | 11     | 6 .py + 2 extensionless + enable-imsi-sniffer.py + imsi-hunter.py + monitor-imsi-live.py |
| 6.2.6 Install   | 1      | install-from-git.log                                                                     |
| 6.2.7 Remaining | 8      | 5 audit .py + usrp_simple_scanner.py + usrp_working_scanner.py + add-altitude-column.sql |
| **TOTAL**       | **20** |                                                                                          |

**Grand total files archived: 94 .sh + 20 non-.sh = 114 files**
**Grand total files created: 6 .sh**
**Net file reduction: 108 files**

### 12.2 Final File Count Verification

```bash
# Count .sh files only
find scripts/ -name '*.sh' -not -path '*_archived*' | wc -l
# EXPECTED: 114

# Count ALL files (excluding _archived, __pycache__)
find scripts/ -type f -not -path '*_archived*' -not -path '*__pycache__*' | wc -l
# EXPECTED: approximately 130 (114 .sh + ~16 non-.sh remaining)

# Count total .sh lines
find scripts/ -name '*.sh' -not -path '*_archived*' -exec wc -l {} + | tail -1
# EXPECTED: approximately 17,200 lines (28,097 - ~10,900 archived)
```

**Summary Metrics**:

| Metric                                    | Before | After   | Reduction       |
| ----------------------------------------- | ------ | ------- | --------------- |
| Active .sh files                          | 202    | 114     | 88 (43.6%)      |
| Total files (all types, excl. \_archived) | ~230   | ~130    | ~100 (43.5%)    |
| Total .sh lines                           | 28,097 | ~17,200 | ~10,900 (38.8%) |
| Duplicate .sh lines                       | 4,489  | 0       | 4,489 (100%)    |
| GSM-related files                         | 61     | 7       | 54 (88.5%)      |
| Kismet scripts                            | 10     | 4       | 6 (60.0%)       |
| Subdirectories                            | 10     | 6       | 4 (40.0%)       |

### 12.3 Zero Broken References Check

```bash
# Verify every production-referenced script still exists
grep -rn 'scripts/' --include='*.ts' --include='*.svelte' --include='*.service' \
  src/ deployment/ scripts/ docker/ 2>/dev/null | \
  grep -v node_modules | grep -v '\.d\.ts' | \
  grep -v 'api/kismet/scripts' | \
  while IFS=: read -r file line content; do
    # Extract script path from content
    script=$(echo "$content" | grep -oP 'scripts/[a-zA-Z0-9_./-]+\.(sh|py|conf)')
    if [ -n "$script" ]; then
      if [ ! -f "$script" ]; then
        echo "FAIL: $file:$line references $script which does not exist"
      fi
    fi
  done
# EXPECTED: no FAIL lines
```

### 12.4 Syntax Check All New Scripts

```bash
for f in scripts/gsm-evil.sh scripts/gsm-evil-diag.sh scripts/gsm-evil-setup.sh \
  scripts/kismet.sh scripts/wifi-adapter.sh scripts/wifi-adapter-fix.sh; do
  bash -n "$f" && echo "PASS: $f" || echo "FAIL: $f"
done
# EXPECTED: all PASS
```

### 12.5 No Duplicate Content Check

```bash
# Verify no byte-identical .sh file pairs remain
find scripts/ -name '*.sh' -not -path '*_archived*' -exec md5sum {} + | \
  sort | awk '{print $1}' | uniq -d | while read hash; do
  echo "DUPLICATE HASH: $hash"
  find scripts/ -name '*.sh' -not -path '*_archived*' -exec md5sum {} + | grep "^$hash"
done
# EXPECTED: no output (zero duplicate pairs)
```

### 12.6 Security Remediation Verification (Task 6.2.8)

```bash
# 12.6.1: Zero hardcoded API tokens
grep -rn 'pk\.d6291c07a2907c915cd8994fb22bc189' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0

# 12.6.2: Zero curl|bash patterns
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0

# 12.6.3: Zero unrestricted /bin/kill * NOPASSWD
grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0

# 12.6.4: Zero hardcoded passwords
grep -rn "argos123\|password.*=.*hackrf\|password.*=.*admin" scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0

# 12.6.5: Zero hardcoded non-loopback IPs
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l
# ACCEPTANCE: must return 0

# 12.6.6: Zero hardcoded /tmp/ paths (excluding mktemp/TMPDIR patterns)
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | grep -v 'mktemp\|TMPDIR\|#' | wc -l
# ACCEPTANCE: must return 0
```

**All 6 security checks must pass for Phase 6.2 to be marked COMPLETE.**

---

## 13. Post-Consolidation Directory Structure (Target Layout)

```
scripts/
  CLAUDE.md                           # Agent context
  _archived/
    phase-6.2/
      MANIFEST-BEFORE.txt             # Pre-consolidation file list
      CHECKSUMS-BEFORE.txt            # Pre-consolidation SHA256 checksums
      deploy/                          # 10 files (exact dupes of install/)
      development/                     # 6 files (4 dupes of dev/ + 2 relocated)
      testing/                         # 5 files (dupes of dev/ + tests/integration/)
      maintenance/                     # 4 files (dupes of dev/ + deploy/)
      gsm/                             # 48 files (41 .sh + 5 .py + 2 extensionless)
      kismet/                          # 7 files
      wifi/                            # 11 files
      keepalive/                       # 1 file
      install/                         # 3 files (2 .sh + 1 .log)
      misc/                            # 16 files
  dev/                                 # 10 files (8 original + 2 from development/)
    analyze-950-simple.sh
    auto-start-hackrf.sh
    auto-start-kismet.sh              # Relocated from development/
    emergency_rtl433.sh
    restart-kismet.sh
    run-gsmevil.sh
    start-all-services.sh
    start-fusion-dev.sh
    start-usrp-service.sh             # Relocated from development/
    verify-celltower-integration.sh
  deployment/                          # 1 file
    deploy-dragon-os.sh
  gps-integration/                     # 6 files (unchanged)
    alfa-alias-reference.sh
    configure-prolific-gps.sh
    implement-gps-workflow.sh
    make-permanent-alias.sh
    setup-alfa-naming.sh
    validate-gps-workflow.sh
  infrastructure/                      # 3 files (unchanged)
    backup.sh
    download-fonts.sh
    setup-cron.sh
  install/                             # 8 files (unchanged, log removed)
    install_coral_support.sh
    install-from-git.sh
    install-modified.sh
    install.sh
    install_uhd.sh
    quick-install.sh
    setup-opencellid.sh
    setup-usrp-simple.sh
  monitoring/                          # 6 files (unchanged)
    check-hackrf-status.sh
    check-memory-leaks.sh
    diagnose-hackrf-crash.sh
    monitor-hackrf.sh
    monitor-memory.sh
    restart-hackrf.sh
  # === TOP-LEVEL SCRIPTS (alphabetical, by category) ===
  # -- AP / WiFi Resilience (4) --
  argos-ap-simple.sh
  argos-wifi-resilience.sh
  create-virtual-monitor.sh
  ensure-alfa-boot.sh
  # -- Build / Dev (10) --
  agent-coordinator.sh
  build-production.sh
  dev-setup.sh
  direct-vite-start.sh
  mcp-start.sh
  parallel-agent-init.sh
  pre-commit-hook.sh
  startup-check.sh
  tmux-zsh-wrapper.sh                 # PRODUCTION-REFERENCED
  vite-manager.sh
  # -- CPU / System (4) --
  advanced-usb-reset.sh
  argos-cpu-protector.sh
  log-rotation.sh
  setup-swap.sh
  # -- Cell Tower / OpenCellID (5) --
  create-sample-celltower-db.sh
  download-opencellid-full.sh
  import-opencellid.sh
  setup-celltower-db.sh
  setup-opencellid-full.sh
  # -- Database (3) --
  db-backup.sh
  db-cleanup.sh
  setup-db-cron.sh
  # -- Docker / Deployment (9) --
  deploy-containers.sh
  deploy-master.sh
  deploy-openwebrx.sh
  deployment-status-api.sh
  docker-automation.sh
  docker-claude-terminal.sh
  docker-image-manager.sh
  one-button-deploy.sh
  validate-deployment-guide.sh
  # -- DroneID (6) --
  droneid-channel-hop.sh
  install-droneid-service.sh
  setup-droneid-backend.sh
  setup-droneid-sudoers.sh
  start-droneid.sh
  stop-droneid.sh
  # -- GPS (2) --
  gps-diagnostics.sh
  gps-status-monitor.sh
  # -- GSM Evil (3 new + 1 kept = 4 .sh) --
  gsm-evil.sh                          # NEW: unified start/stop/status
  gsm-evil-diag.sh                     # NEW: unified diagnostic/scan
  gsm-evil-setup.sh                    # NEW: unified setup
  patch-gsmevil-socketio.sh            # PRODUCTION-REFERENCED
  # -- Install (5 top-level, excludes install-droneid-service.sh listed under DroneID) --
  install-argos.sh
  install-framework.sh
  install-management.sh
  install-openwebrx-hackrf.sh
  install-system-dependencies.sh
  # -- Keepalive / Process (6) --
  argos-keepalive.sh
  argos-process-manager.sh
  dev-server-keepalive.sh              # PRODUCTION-REFERENCED (service)
  manage-keepalive.sh
  simple-keepalive.sh                  # PRODUCTION-REFERENCED (service)
  wifi-keepalive-robust.sh             # PRODUCTION-REFERENCED (service)
  # -- Kismet (4 .sh + 3 .conf = 7) --
  configure-kismet-gps.sh
  kismet.sh                            # NEW: unified start/stop/status
  kismet-gps-only.conf
  kismet-no-auto-source.conf           # PRODUCTION-REFERENCED
  kismet-site-simple.conf              # PRODUCTION-REFERENCED
  setup-kismet-adapter.sh              # PRODUCTION-REFERENCED
  start-kismet-with-alfa.sh            # PRODUCTION-REFERENCED
  # -- OpenWebRX (2) --
  integrate-openwebrx-argos.sh
  setup-openwebrx-usrp.sh
  # -- SDR Hardware (8 .sh) --
  check-hackrf-busy.sh
  check-usrp-busy.sh
  configure-openwebrx-b205.sh
  configure-usb-persistence.sh
  configure-usrp-immediate.sh
  disable-hackrf-logs.sh
  fix-usrp-drivers.sh
  verify-usrp-working.sh
  # -- Setup / System (5) --
  setup-host-complete.sh
  setup-interface-names.sh
  setup-offline-maps.sh
  setup-system-management.sh
  update-configs-for-descriptive-names.sh
  # -- WiFi Adapter (2 new; configure-usb-persistence.sh listed under SDR Hardware) --
  wifi-adapter.sh                      # NEW: unified detect/diagnose
  wifi-adapter-fix.sh                  # NEW: unified fix/reset
  # -- Service Files (3) --
  dev-server-keepalive.service
  simple-keepalive.service
  wifi-keepalive.service
  # -- Python (production-referenced, 2) --
  usrp_power_measure_real.py           # PRODUCTION-REFERENCED
  usrp_spectrum_scan.py                # PRODUCTION-REFERENCED
  # -- Python (kept, 5) --
  download_opencellid.py
  import_celltowers.py
  monitor-gsmtap.py
  grgsm_livemon_usrp_working.py
  usrp_power_scan.py
  # -- Extensionless (1) --
  grgsm_livemon_headless_usrp_fixed
  # -- JS/TS utilities (6) --
  css-integrity-check.cjs
  html-structure-validator.cjs
  logger.cjs
  mcp-config.ts
  mcp-install.ts
  visual-regression-check.cjs
```

---

## 14. Traceability Matrix

This matrix maps every one of the original 202 .sh files to its final disposition. The matrix is organized by the task that handles the file. Files not listed here are non-.sh files and are classified in Sections 10.14-10.15.

### 14.1 Task 6.2.1: Duplicate Directory Elimination (25 .sh archived)

| Original Path                             | Disposition         | Canonical Copy Location                                                          |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `deploy/install_coral_support.sh`         | ARCHIVED            | `install/install_coral_support.sh`                                               |
| `deploy/install-from-git.sh`              | ARCHIVED            | `install/install-from-git.sh`                                                    |
| `deploy/install-modified.sh`              | ARCHIVED            | `install/install-modified.sh`                                                    |
| `deploy/install.sh`                       | ARCHIVED            | `install/install.sh`                                                             |
| `deploy/install_uhd.sh`                   | ARCHIVED            | `install/install_uhd.sh`                                                         |
| `deploy/quick-install.sh`                 | ARCHIVED            | `install/quick-install.sh`                                                       |
| `deploy/setup-opencellid.sh`              | ARCHIVED            | `install/setup-opencellid.sh`                                                    |
| `deploy/deploy-dragon-os.sh`              | ARCHIVED            | `deployment/deploy-dragon-os.sh`                                                 |
| `deploy/fix-hardcoded-paths.sh`           | ARCHIVED            | Functionality obsolete (hardcoded paths are Phase 6.3 scope)                     |
| `deploy/verify-deployment.sh`             | ARCHIVED            | `testing/verify-deployment.sh` also archived; use `validate-deployment-guide.sh` |
| `development/analyze-950-simple.sh`       | ARCHIVED            | `dev/analyze-950-simple.sh`                                                      |
| `development/auto-start-hackrf.sh`        | ARCHIVED            | `dev/auto-start-hackrf.sh`                                                       |
| `development/start-all-services.sh`       | ARCHIVED            | `dev/start-all-services.sh`                                                      |
| `development/start-fusion-dev.sh`         | ARCHIVED            | `dev/start-fusion-dev.sh`                                                        |
| `development/auto-start-kismet.sh`        | RELOCATED to `dev/` | `dev/auto-start-kismet.sh`                                                       |
| `development/start-usrp-service.sh`       | RELOCATED to `dev/` | `dev/start-usrp-service.sh`                                                      |
| `testing/debug_gsm_detection.sh`          | ARCHIVED            | `tests/integration/debug_gsm_detection.sh`                                       |
| `testing/debug_gsm_evil.sh`               | ARCHIVED            | `tests/integration/debug_gsm_evil.sh` (canonical, text labels)                   |
| `testing/debug_scanner_disconnect.sh`     | ARCHIVED            | `tests/integration/debug_scanner_disconnect.sh` (canonical)                      |
| `testing/verify-celltower-integration.sh` | ARCHIVED            | `dev/verify-celltower-integration.sh`                                            |
| `testing/verify-deployment.sh`            | ARCHIVED            | Use `validate-deployment-guide.sh` instead                                       |
| `maintenance/emergency_rtl433.sh`         | ARCHIVED            | `dev/emergency_rtl433.sh`                                                        |
| `maintenance/restart-kismet.sh`           | ARCHIVED            | `dev/restart-kismet.sh`                                                          |
| `maintenance/run-gsmevil.sh`              | ARCHIVED            | `dev/run-gsmevil.sh`                                                             |
| `maintenance/fix-hardcoded-paths.sh`      | ARCHIVED            | Functionality obsolete                                                           |

### 14.2 Task 6.2.2: GSM Consolidation (42 .sh archived, 3 new)

| Original Path                    | Disposition | Merged Into                                             |
| -------------------------------- | ----------- | ------------------------------------------------------- |
| `gsm-evil-start.sh`              | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-start-no-sudo.sh`      | ARCHIVED    | `gsm-evil.sh` (sudoers eliminates need)                 |
| `gsm-evil-start-wrapper.sh`      | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsmevil-simple-start.sh`        | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsmevil-configurable-start.sh`  | ARCHIVED    | `gsm-evil.sh` start subcommand (primary merge source)   |
| `gsmevil-readme-start.sh`        | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsmevil-video-start.sh`         | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `start-gsmevil2.sh`              | ARCHIVED    | `gsm-evil.sh` start --docker subcommand                 |
| `start-gsmevil2-fixed.sh`        | ARCHIVED    | `gsm-evil.sh` start --docker subcommand                 |
| `start-gsmevil-dynamic.sh`       | ARCHIVED    | `gsm-evil.sh` start --freq subcommand                   |
| `start-gsm-evil-server.sh`       | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `start-gsmevil-with-imsi.sh`     | ARCHIVED    | `gsm-evil.sh` start --imsi subcommand                   |
| `gsm-evil-with-imsi.sh`          | ARCHIVED    | `gsm-evil.sh` start --imsi subcommand                   |
| `gsm-evil-with-auto-imsi.sh`     | ARCHIVED    | `gsm-evil.sh` start --imsi subcommand                   |
| `gsm-evil-production.sh`         | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-dragonos.sh`           | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-final.sh`              | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-fixed.sh`              | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-fix-and-start.sh`      | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-working.sh`            | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-public.sh`             | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-simple.sh`             | ARCHIVED    | `gsm-evil.sh` start subcommand                          |
| `gsm-evil-stop.sh`               | ARCHIVED    | `gsm-evil.sh` stop subcommand (primary merge source)    |
| `gsmevil-simple-stop.sh`         | ARCHIVED    | `gsm-evil.sh` stop subcommand                           |
| `stop-gsmevil2.sh`               | ARCHIVED    | `gsm-evil.sh` stop subcommand                           |
| `stop-gsmevil2-fixed.sh`         | ARCHIVED    | `gsm-evil.sh` stop subcommand                           |
| `nuclear-stop-gsmevil.sh`        | ARCHIVED    | `gsm-evil.sh` force-stop subcommand                     |
| `verify-gsm-stop-bulletproof.sh` | ARCHIVED    | Manual verification, not production                     |
| `diagnose-gsm-evil.sh`           | ARCHIVED    | `gsm-evil-diag.sh` diagnose subcommand                  |
| `diagnose-usrp-gsm.sh`           | ARCHIVED    | `gsm-evil-diag.sh` diagnose --usrp subcommand           |
| `debug-gsm-scan.sh`              | ARCHIVED    | `gsm-evil-diag.sh` scan subcommand                      |
| `debug-usrp-gsm.sh`              | ARCHIVED    | `gsm-evil-diag.sh` diagnose --usrp subcommand           |
| `gsm-full-diagnostic.sh`         | ARCHIVED    | `gsm-evil-diag.sh` diagnose subcommand (primary source) |
| `gsm-frequency-scanner.sh`       | ARCHIVED    | `gsm-evil-diag.sh` scan subcommand                      |
| `setup-gsmevil-sudoers.sh`       | ARCHIVED    | `gsm-evil-setup.sh` sudoers subcommand                  |
| `enable-imsi-curl.sh`            | ARCHIVED    | `gsm-evil-setup.sh` imsi subcommand                     |
| `check-grgsm-antenna-support.sh` | ARCHIVED    | `gsm-evil-setup.sh` (antenna check)                     |
| `auto-scan-gsm.sh`               | ARCHIVED    | `gsm-evil-diag.sh` scan subcommand                      |
| `scan-german-gsm.sh`             | ARCHIVED    | `gsm-evil-diag.sh` scan --band subcommand               |
| `sweep-gsm-band.sh`              | ARCHIVED    | `gsm-evil-diag.sh` sweep subcommand                     |
| `find-imsi-frequencies.sh`       | ARCHIVED    | `gsm-evil-diag.sh` scan --imsi subcommand               |
| `usrp_sweep_gsm.sh`              | ARCHIVED    | `gsm-evil-diag.sh` sweep --usrp subcommand              |

### 14.3 Task 6.2.3: Kismet Consolidation (7 .sh archived, 1 new)

| Original Path                  | Disposition | Merged Into                                  |
| ------------------------------ | ----------- | -------------------------------------------- |
| `start-kismet.sh`              | ARCHIVED    | `kismet.sh` start subcommand                 |
| `start-kismet-safe.sh`         | ARCHIVED    | `kismet.sh` start-safe subcommand            |
| `start-kismet-skip-adapter.sh` | ARCHIVED    | `kismet.sh` start-no-adapter subcommand      |
| `kismet-graceful-stop.sh`      | ARCHIVED    | `kismet.sh` stop subcommand                  |
| `stop-kismet-safe.sh`          | ARCHIVED    | `kismet.sh` stop subcommand (primary source) |
| `safe-stop-kismet.sh`          | ARCHIVED    | Subset of stop-kismet-safe.sh                |
| `update-kismet-service.sh`     | ARCHIVED    | One-time setup, not needed ongoing           |

### 14.4 Task 6.2.4: WiFi Adapter Consolidation (11 files archived, 2 new)

| Original Path                | Disposition | Merged Into                                 |
| ---------------------------- | ----------- | ------------------------------------------- |
| `detect-alfa-adapter.sh`     | ARCHIVED    | `wifi-adapter.sh` detect-alfa subcommand    |
| `detect-any-wifi-adapter.sh` | ARCHIVED    | `wifi-adapter.sh` detect subcommand         |
| `diagnose-wifi-adapter.sh`   | ARCHIVED    | `wifi-adapter.sh` diagnose subcommand       |
| `fix-alfa-only.sh`           | ARCHIVED    | `wifi-adapter-fix.sh` fix-alfa subcommand   |
| `fix-argos-ap-mt7921.sh`     | ARCHIVED    | `wifi-adapter-fix.sh` fix-mt7921 subcommand |
| `fix-mt76-adapter.sh`        | ARCHIVED    | `wifi-adapter-fix.sh` fix-mt76 subcommand   |
| `fix-wifi-now.sh`            | ARCHIVED    | `wifi-adapter-fix.sh` fix subcommand        |
| `reset-wifi-adapter.sh`      | ARCHIVED    | `wifi-adapter-fix.sh` reset subcommand      |
| `safe-adapter-reset.sh`      | ARCHIVED    | `wifi-adapter-fix.sh` safe-reset subcommand |
| `safe-fix-adapter.sh`        | ARCHIVED    | Subset of safe-adapter-reset.sh             |
| `create-ap-simple.sh`        | ARCHIVED    | Subset of argos-ap-simple.sh                |

### 14.5 Task 6.2.5: Keepalive Consolidation (1 archived)

| Original Path  | Disposition | Merged Into                   |
| -------------- | ----------- | ----------------------------- |
| `keepalive.sh` | ARCHIVED    | Subset of simple-keepalive.sh |

### 14.6 Task 6.2.6: Install Consolidation (2 .sh archived)

| Original Path                | Disposition | Merged Into                                               |
| ---------------------------- | ----------- | --------------------------------------------------------- |
| `install_uhd.sh` (top-level) | ARCHIVED    | `install/install_uhd.sh` (canonical)                      |
| `install-usrp-support.sh`    | ARCHIVED    | `install/install_uhd.sh` + `install/setup-usrp-simple.sh` |

### 14.7 Task 6.2.7: Remaining Organization (8 .sh archived)

| Original Path                 | Disposition | Reason                                        |
| ----------------------------- | ----------- | --------------------------------------------- |
| `cpu-guardian.sh`             | ARCHIVED    | Superseded by argos-cpu-protector.sh          |
| `final-usrp-setup.sh`         | ARCHIVED    | "Final" iteration naming; covered by install/ |
| `find-working-usrp-config.sh` | ARCHIVED    | One-time discovery, not production            |
| `nuclear-usb-reset.sh`        | ARCHIVED    | Covered by advanced-usb-reset.sh              |
| `setup-host.sh`               | ARCHIVED    | Subset of setup-host-complete.sh              |
| `download-opencellid.sh`      | ARCHIVED    | Subset of download-opencellid-full.sh         |
| `usrp_power_measure.sh`       | ARCHIVED    | Superseded by usrp_power_measure_real.py      |
| `usrp_simple_power.sh`        | ARCHIVED    | Superseded by usrp_power_measure_real.py      |

### 14.8 KEPT Scripts (114 .sh files -- no action required)

All scripts not listed in Sections 13.1-13.7 are KEPT in their current location without modification. This includes 108 original .sh files that are untouched, plus 6 newly created consolidated scripts. The full list of 114 retained .sh scripts can be verified with:

```bash
find scripts/ -name '*.sh' -not -path '*_archived*' | sort
```

---

## 15. Hardcoded Path Remediation (Cross-Reference)

**Corrected count**: 152 hardcoded path occurrences across 67 unique files (not "147 in 64 scripts" as previously claimed). This remediation is out of scope for Phase 6.2 (file consolidation) and is handled by **Phase 6.3 (Hardcoded Path Remediation)**. However, the consolidation in Phase 6.2 reduces the number of files requiring path fixes.

```
# Verified path distribution:
# /home/ubuntu: 103 occurrences in 41 files
# /home/pi: 44 occurrences in 23 files
# /home/kali: 5 occurrences in 3 files
# Total: 152 occurrences in 67 unique files
# Verification: grep -rn '/home/ubuntu\|/home/pi\|/home/kali' scripts/*.sh scripts/**/*.sh | wc -l
```

- 25+ of the 67 affected files will be archived in Phase 6.2
- The remaining files needing path fixes are tracked in Phase 6.3
- **NOTE**: Phase 6.3 (`argos-env.sh`) must execute BEFORE this phase so consolidated scripts use the centralized path variable from day one

After Phase 6.2 completes, Phase 6.3 should re-run the path audit:

```bash
find scripts/ -name '*.sh' -not -path '*_archived*' | xargs grep -l '/home/ubuntu\|/home/pi\|/home/kali' 2>/dev/null | wc -l
# Must be < 55 (reduced by archived files)
```

---

## 16. Execution Order and Dependencies

```
Task 6.2.1 (Duplicate Dirs)     -- No dependencies, execute first
    |
    v
Task 6.2.2 (GSM)                -- Depends on 6.2.1 (maintenance/run-gsmevil.sh archived)
    |
Task 6.2.3 (Kismet)             -- Independent of 6.2.2, can run in parallel
    |
Task 6.2.4 (WiFi)               -- Independent of 6.2.2-6.2.3, can run in parallel
    |
Task 6.2.5 (Keepalive)          -- Independent
    |
Task 6.2.6 (Install)            -- Depends on 6.2.1 (deploy/ archived first)
    |
Task 6.2.7 (Remaining)          -- Depends on 6.2.1-6.2.6 (must know what is already archived)
    |
    v
Task 6.2.8 (Security)           -- See Section 11.7 for internal execution order
    |
    v
Verification Checklist (Section 12)
```

**Minimum critical path**: 6.2.8 (API tokens + NOPASSWD) -> 6.2.1 -> 6.2.2 || 6.2.3 || 6.2.4 || 6.2.5 -> 6.2.6 -> 6.2.7 -> 6.2.8 (remaining) -> Verify

---

## 17. Risk Register

| Risk                                                                                           | Likelihood | Impact   | Mitigation                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------- |
| Production script reference breaks                                                             | LOW        | HIGH     | Section 3.3 tracks all 11 production-referenced scripts; none are archived                    |
| Consolidated script introduces bug                                                             | MEDIUM     | MEDIUM   | bash -n syntax check; subcommand testing; archived originals available for rollback           |
| Future developer cannot find archived script                                                   | LOW        | LOW      | MANIFEST-BEFORE.txt + traceability matrix (Section 14) provide full lineage                   |
| Hardcoded paths in remaining scripts cause failures on Kali host (152 occurrences in 67 files) | HIGH       | MEDIUM   | Out of scope (Phase 6.3); documented in Section 15. Phase 6.3 must execute BEFORE this phase. |
| Service file references break                                                                  | LOW        | HIGH     | 3 service files tracked in Section 3.3; paths verified in Section 12.3                        |
| Hardcoded API tokens leak credentials via git history                                          | HIGH       | HIGH     | Task 6.2.8 (Section 11.1); token rotation required even after code remediation                |
| curl\|bash supply chain attack during script execution                                         | MEDIUM     | CRITICAL | Task 6.2.8 (Section 11.2); download-then-verify pattern eliminates runtime risk               |
| Unsafe /tmp usage enables symlink attacks on multi-user systems                                | MEDIUM     | MEDIUM   | Task 6.2.8 (Section 11.6); mktemp pattern eliminates predictable paths                        |

---

## 18. Acceptance Criteria

Phase 6.2 is COMPLETE when ALL of the following are true:

**Consolidation Criteria (Tasks 6.2.1-6.2.7)**:

1. `find scripts/ -name '*.sh' -not -path '*_archived*' | wc -l` returns 114 or fewer
2. `find scripts/ -name '*.sh' -not -path '*_archived*' -exec md5sum {} + | sort | awk '{print $1}' | uniq -d | wc -l` returns 0 (zero duplicate file pairs)
3. All 11 production-referenced scripts from Section 3.3 exist and are executable
4. All 6 new consolidated scripts pass `bash -n` syntax check
5. `scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt` exists with 202 entries
6. `scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt` exists with 202 entries
7. Directories `scripts/deploy/`, `scripts/development/`, `scripts/testing/`, `scripts/maintenance/` do not exist
8. `ls scripts/ | grep -iE 'gsm|gsmevil|grgsm|imsi' | wc -l` returns 7 or fewer (down from 61)

**Security Criteria (Task 6.2.8)**:

9. Zero hardcoded API tokens in non-archived scripts (Section 12.6.1)
10. Zero `curl|bash` or `wget|bash` patterns in non-archived scripts (Section 12.6.2)
11. Zero unrestricted `/bin/kill *` NOPASSWD rules in non-archived scripts (Section 12.6.3)
12. Zero hardcoded plaintext passwords in non-archived scripts (Section 12.6.4)
13. Zero hardcoded non-loopback IP addresses in non-archived scripts (Section 12.6.5)
14. Zero hardcoded `/tmp/filename` patterns in non-archived scripts (Section 12.6.6)
15. OpenCellID API token rotated and old token invalidated
16. Missing production-critical scripts (Section 3.3 addendum) decision recorded: each marked CREATE or FORMALLY REMOVE

---

## APPENDIX A: Independent Audit Security Findings -- Raw Data (2026-02-08)

> **NOTE**: This appendix preserves the original independent audit findings for traceability. The actionable remediation plan is in **Section 11 (Task 6.2.8)**, which supersedes this appendix with full detection commands, remediation steps, and verification criteria.

The following CRITICAL and HIGH security findings were identified by the independent verification audit across the 202 shell scripts.

### CRITICAL-S1: Hardcoded OpenCellID API Tokens (2 instances)

| File                                  | Line | Content                                         |
| ------------------------------------- | ---- | ----------------------------------------------- |
| `scripts/download-opencellid-full.sh` | 6    | `API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"` |
| `scripts/setup-opencellid-full.sh`    | 4    | `API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"` |

**Standard Violated**: CERT C MSC41-C, CWE-798. Secrets must never be hardcoded in version-controlled files.
**Required Action**: Externalize to environment variable or `.env` file. Rotate the exposed token immediately.

### CRITICAL-S2: curl|bash Remote Code Execution Vectors (22 instances across 14 files)

Twenty-two shell scripts download and pipe remote content directly to a shell interpreter. This is a supply chain attack vector.

**Examples**:

- `scripts/install-argos.sh:113` -- `curl ... | sudo -E bash -`
- `scripts/setup-host-complete.sh:99` -- `curl -fsSL https://get.docker.com | sh`
- `scripts/deploy/quick-install.sh:102` -- `curl ... | bash`

**Standard Violated**: NASA/JPL Rule 1 (simple control flow), NIST SP 800-218 PW.4.1.
**Required Action**: Replace with download-then-verify pattern: download to temp file, verify checksum/GPG signature, then execute.

### CRITICAL-S3: NOPASSWD Sudoers for /bin/kill \*

**File**: `scripts/setup-droneid-sudoers.sh:22,32`
**Finding**: Grants `ubuntu ALL=(ALL) NOPASSWD: /bin/kill *` and `node ALL=(ALL) NOPASSWD: /bin/kill *`. Allows any signal to any process without authentication. `kill -9 1` would crash the system.
**Standard Violated**: CIS Benchmark 5.3, DISA STIG V-230380.
**Required Action**: Restrict to specific PIDs or use `systemctl` for service management instead.

### HIGH-S4: Hardcoded Admin Passwords (3 instances)

| File                                  | Password   |
| ------------------------------------- | ---------- |
| `scripts/configure-openwebrx-b205.sh` | `argos123` |
| `scripts/install-openwebrx-hackrf.sh` | `hackrf`   |
| `scripts/final-usrp-setup.sh`         | `admin`    |

**Required Action**: Externalize to environment variables. Never commit passwords to version control.

### HIGH-S5: Hardcoded Tailscale/Internal IP Addresses (55 instances)

Multiple Tailscale VPN IPs (100.79.154.94, 100.68.185.86, etc.) and internal LAN IPs hardcoded across scripts. These leak network topology and are an OPSEC violation for military deployment.
**Required Action**: Externalize all IP addresses to configuration file or environment variables.

### HIGH-S6: Unsafe /tmp Usage (185 instances vs. 3 mktemp uses)

185 references to `/tmp/` with predictable filenames. Only 3 scripts use `mktemp` for safe temporary file creation. Symlink attack vector on multi-user systems.
**Standard Violated**: CWE-377, CERT C FIO43-C.
**Required Action**: Replace all hardcoded `/tmp/` paths with `mktemp -d` patterns.

---

## Document Revision History

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                   |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-08 | Initial release: consolidation plan for 202 shell scripts across Tasks 6.2.1-6.2.7                                                                                                                                                                                                                                        |
| 2.0     | 2026-02-08 | Added supply chain security section (Task 6.2.8: 331 finding instances across 6 categories), fixed production-critical scripts list (3 missing scripts identified), added dependency graph requirement, renumbered Sections 11-17 to 12-18 to accommodate new Section 11, added security acceptance criteria (items 9-16) |

---

END OF DOCUMENT
