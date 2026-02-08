# Phase 6.2.02: GSM Evil Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2.02
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.2
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Reduce 61 GSM-related files (47 .sh + 11 .py + 3 extensionless) at the top level to 5 shell scripts, 2 Python files, and 1 extensionless wrapper. Archive the remaining files. Net reduction: 45 files from the GSM category.

---

## 2. Prerequisites

1. **Task 6.2.1 complete** (Duplicate Directory Elimination) -- `maintenance/run-gsmevil.sh` must already be archived to avoid double-archiving.
2. **Phase 6.3 (`argos-env.sh`) must execute BEFORE this phase** so consolidated scripts use centralized paths from day one.
3. **Script dependency graph check** must be run (see Section 6.1).
4. **Security audit of GSM scripts** must complete before consolidation (see Section 6.2).
5. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist (MANIFEST-BEFORE.txt, CHECKSUMS-BEFORE.txt).

---

## 3. Dependencies

| Dependency                  | Direction           | Description                                                                                               |
| --------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| Task 6.2.1                  | BLOCKS this task    | `maintenance/run-gsmevil.sh` must already be archived                                                     |
| Phase 6.3                   | BLOCKS this task    | Centralized path variables needed before creating new consolidated scripts                                |
| Task 6.2.8                  | Cross-reference     | Security findings in GSM scripts must be remediated in the new consolidated scripts, not in the originals |
| `patch-gsmevil-socketio.sh` | PRODUCTION-CRITICAL | Referenced by `deployment/gsmevil-patch.service` line 7 -- MUST remain at current path                    |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All superseded GSM scripts are moved to `scripts/_archived/phase-6.2/gsm/` preserving flat structure.

```bash
# If a consolidated script has issues, restore from archive:
cp scripts/_archived/phase-6.2/gsm/<original-name>.sh scripts/<original-name>.sh
chmod +x scripts/<original-name>.sh

# Verify checksum matches pre-consolidation state:
sha256sum scripts/<original-name>.sh
grep "<original-name>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

The following GSM-related script is referenced by production code and must NOT be archived:

| Script                              | Referenced By                      | Line |
| ----------------------------------- | ---------------------------------- | ---- |
| `scripts/patch-gsmevil-socketio.sh` | `deployment/gsmevil-patch.service` | 7    |

**NOTE**: `patch-gsmevil-socketio.sh` MUST remain at its current path or the service file must be updated in the same commit.

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

Before archiving any GSM script, verify it is not sourced by a surviving script:

```bash
# Per-script check for each GSM file to be archived:
for f in gsm-evil-start.sh gsm-evil-start-no-sudo.sh gsm-evil-start-wrapper.sh \
  gsmevil-simple-start.sh gsmevil-configurable-start.sh gsmevil-readme-start.sh \
  gsmevil-video-start.sh start-gsmevil2.sh start-gsmevil2-fixed.sh \
  start-gsmevil-dynamic.sh start-gsm-evil-server.sh start-gsmevil-with-imsi.sh \
  gsm-evil-with-imsi.sh gsm-evil-with-auto-imsi.sh gsm-evil-production.sh \
  gsm-evil-dragonos.sh gsm-evil-final.sh gsm-evil-fixed.sh gsm-evil-fix-and-start.sh \
  gsm-evil-working.sh gsm-evil-public.sh gsm-evil-simple.sh \
  gsm-evil-stop.sh gsmevil-simple-stop.sh stop-gsmevil2.sh \
  stop-gsmevil2-fixed.sh nuclear-stop-gsmevil.sh verify-gsm-stop-bulletproof.sh \
  diagnose-gsm-evil.sh diagnose-usrp-gsm.sh debug-gsm-scan.sh debug-usrp-gsm.sh \
  gsm-full-diagnostic.sh gsm-frequency-scanner.sh \
  setup-gsmevil-sudoers.sh enable-imsi-curl.sh \
  auto-scan-gsm.sh scan-german-gsm.sh sweep-gsm-band.sh \
  find-imsi-frequencies.sh usrp_sweep_gsm.sh check-grgsm-antenna-support.sh; do
  result=$(grep -rn "source.*$f\|\\. .*$f\|bash.*$f" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived')
  if [ -n "$result" ]; then
    echo "BLOCKED: $f is sourced by: $result"
  fi
done
# If any BLOCKED lines appear, do NOT archive that script until the dependency is resolved.
```

### 6.2 PREREQUISITE: Security Audit of GSM Scripts

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

### 6.3 GSM Script Inventory Verification

```bash
# Verification command (run from project root):
find scripts/ -iname "*gsm*" -o -iname "*gsmevil*" -o -iname "*grgsm*" -o -iname "*imsi*" | wc -l
# Expected output: 61
```

### 6.4 GSM Script Inventory (61 files, verified line counts)

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

**NOTE**: `patch-gsmevil-socketio.sh` is referenced by `deployment/gsmevil-patch.service` (see Section 5). It MUST remain at its current path or the service file must be updated in the same commit.

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

### 6.5 Consolidated GSM Scripts (Target: 8 files)

#### 6.5.1 gsm-evil.sh (~250 lines) -- Unified start/stop/status

Merge logic from: `gsmevil-configurable-start.sh` (parameterized start), `start-gsmevil2.sh` (Docker logic), `start-gsm-evil-server.sh` (server start), `gsm-evil-stop.sh` (comprehensive stop), `nuclear-stop-gsmevil.sh` (force stop).

```
Usage: gsm-evil.sh {start|stop|force-stop|status|restart} [OPTIONS]
  start     --freq <MHz> --gain <dB> --imsi --docker
  stop      Graceful shutdown of all GSM Evil processes
  force-stop  Kill all GSM Evil processes (nuclear option)
  status    Show running GSM Evil process state
  restart   Stop then start with same options
```

**Subtask 6.5.1a**: Extract common functions from the 6 merge sources into the unified script.

```bash
# Identify shared patterns across merge sources
grep -h 'docker.*gsmevil\|grgsm_livemon\|kill.*gsmevil\|pkill.*grgsm' \
  scripts/gsmevil-configurable-start.sh \
  scripts/start-gsmevil2.sh \
  scripts/start-gsm-evil-server.sh \
  scripts/gsm-evil-stop.sh \
  scripts/nuclear-stop-gsmevil.sh | sort -u
```

**Subtask 6.5.1b**: Write the unified script with subcommand dispatch.

**Subtask 6.5.1c**: Test each subcommand.

```bash
bash scripts/gsm-evil.sh status
# Must exit 0 and print process state (even if none running)

bash -n scripts/gsm-evil.sh
# Must exit 0 (syntax check)
```

#### 6.5.2 gsm-evil-diag.sh (~300 lines) -- Unified diagnostic/scan

Merge logic from: `diagnose-gsm-evil.sh`, `diagnose-usrp-gsm.sh`, `gsm-full-diagnostic.sh`, `gsm-frequency-scanner.sh`, `sweep-gsm-band.sh`.

```
Usage: gsm-evil-diag.sh {diagnose|scan|sweep} [OPTIONS]
  diagnose  --usrp   Full diagnostic of GSM Evil stack
  scan      --band <900|1800|850|1900>  Scan GSM frequencies
  sweep     --start <MHz> --stop <MHz>  Sweep frequency range
```

#### 6.5.3 gsm-evil-setup.sh (~50 lines) -- Unified setup

Merge: `setup-gsmevil-sudoers.sh` (26 lines) + `enable-imsi-curl.sh` (18 lines).

```
Usage: gsm-evil-setup.sh {sudoers|imsi|all}
```

#### 6.5.4 KEEP as-is (3 files)

- `patch-gsmevil-socketio.sh` (36 lines) -- production-referenced, do not rename
- `monitor-gsmtap.py` (111 lines) -- active monitoring
- `grgsm_livemon_usrp_working.py` (219 lines) -- active grgsm launcher

#### 6.5.5 KEEP as-is (1 extensionless)

- `grgsm_livemon_headless_usrp_fixed` (175 lines) -- active fixed version

### 6.6 Execution Steps

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
# Implementation per subtasks 6.5.1-6.5.3 above

# Step 4: Also archive check-grgsm-antenna-support.sh (14 lines, functionality merged into gsm-evil-setup.sh)
mv scripts/check-grgsm-antenna-support.sh scripts/_archived/phase-6.2/gsm/

# Step 5: Also archive enable-imsi-sniffer.py (Python, 39 lines, one-time enablement)
mv scripts/enable-imsi-sniffer.py scripts/_archived/phase-6.2/gsm/
# And imsi-hunter.py (Python, 180 lines, standalone tool, not referenced by production code)
mv scripts/imsi-hunter.py scripts/_archived/phase-6.2/gsm/
# And monitor-imsi-live.py (Python, 125 lines, superseded by monitor-gsmtap.py)
mv scripts/monitor-imsi-live.py scripts/_archived/phase-6.2/gsm/
```

---

## 7. Post-Execution Verification

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

---

## 8. Metrics

| Metric                           | Value                                                            |
| -------------------------------- | ---------------------------------------------------------------- |
| Files Archived                   | 48 (44 .sh + 3 .py + 1 extensionless + check-grgsm + 3 IMSI .py) |
| Files Created (new consolidated) | 3 (gsm-evil.sh, gsm-evil-diag.sh, gsm-evil-setup.sh)             |
| Net File Reduction               | 45 files                                                         |
| Lines Eliminated (archived)      | ~4,500 lines                                                     |
| Lines Created                    | ~600 lines in 3 new consolidated scripts                         |
| Net Line Reduction               | ~3,900 lines                                                     |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. `ls scripts/ | grep -iE 'gsm|gsmevil|grgsm|imsi' | wc -l` returns 7 or fewer (down from 61).
2. All 3 new consolidated scripts pass `bash -n` syntax check.
3. `scripts/patch-gsmevil-socketio.sh` exists at its original path (production reference intact).
4. `scripts/_archived/phase-6.2/gsm/` contains exactly 48 files.
5. Security audit findings from Section 6.2 are documented and remediated in the new consolidated scripts (cross-reference with Task 6.2.8).
6. Script dependency graph check confirmed no archived GSM script is `source`d by a surviving script.
7. `gsm-evil.sh status` exits 0 and prints process state.

---

## 10. Traceability

### Task 6.2.2: GSM Consolidation (42 .sh archived, 3 new)

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

---

## 11. Execution Order Notes

From parent document Section 16:

```
Task 6.2.1 (Duplicate Dirs)     -- No dependencies, execute first
    |
    v
Task 6.2.2 (GSM)  <<< THIS TASK  -- Depends on 6.2.1 (maintenance/run-gsmevil.sh archived)
    |
Task 6.2.3 (Kismet)             -- Independent of 6.2.2, can run in parallel
    |
Task 6.2.4 (WiFi)               -- Independent of 6.2.2-6.2.3, can run in parallel
```

**This task (6.2.2) depends on Task 6.2.1** because `maintenance/run-gsmevil.sh` is archived in 6.2.1 and must not be double-archived. Tasks 6.2.3, 6.2.4, and 6.2.5 are independent of this task and can execute in parallel.

**Security remediation note**: Task 6.2.8 subtasks 11.1 (API tokens) and 11.3 (NOPASSWD kill) should execute BEFORE this consolidation so security findings are not carried into new consolidated scripts.

---

END OF DOCUMENT
