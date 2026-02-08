# Phase 6.2.06: Install Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2.06
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.6
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Remove 2 duplicate/superseded install shell scripts from the top level and 1 build artifact log file. Archive `install_uhd.sh` (top-level, 47 lines -- a near-duplicate of `install/install_uhd.sh`), `install-usrp-support.sh` (43 lines -- functionality covered by `install/install_uhd.sh` + `install/setup-usrp-simple.sh`), and `install-from-git.log` (build artifact). Net reduction: 3 files, ~90 lines.

---

## 2. Prerequisites

1. **Task 6.2.1 complete** (Duplicate Directory Elimination) -- `deploy/` directory duplicates of `install/` must already be archived. This is a hard dependency because Task 6.2.1 archives the `deploy/` copies (7 install scripts), establishing `install/` as the canonical location.
2. **Phase 6.3 (`argos-env.sh`) should execute BEFORE this phase** so surviving install scripts can use centralized paths.
3. **Script dependency graph check** must be run (see Section 6.1).
4. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist (MANIFEST-BEFORE.txt, CHECKSUMS-BEFORE.txt).

---

## 3. Dependencies

| Dependency                   | Direction                          | Description                                                                                  |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Task 6.2.1                   | BLOCKS this task                   | `deploy/` duplicates must be archived first to establish `install/` as canonical             |
| Phase 6.3                    | Recommended                        | Centralized path variables for surviving scripts                                             |
| `usrp_power_measure_real.py` | PRODUCTION-CRITICAL (not in scope) | Referenced by `src/routes/api/rf/usrp-power/+server.ts` line 27 -- NOT archived by this task |
| `usrp_spectrum_scan.py`      | PRODUCTION-CRITICAL (not in scope) | Referenced by `src/lib/server/usrp/sweepManager.ts` line 298 -- NOT archived by this task    |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. Archived scripts are moved to `scripts/_archived/phase-6.2/install/`.

```bash
# If an archived install script is needed, restore from archive:
cp scripts/_archived/phase-6.2/install/<original-name> scripts/<original-name>
chmod +x scripts/<original-name>

# Verify checksum matches pre-consolidation state:
sha256sum scripts/<original-name>
grep "<original-name>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

No install scripts being archived in this task are referenced by production TypeScript source code or active systemd service files. The following production-critical USRP Python scripts are NOT affected by this task (they remain at their current locations):

| Script                               | Referenced By                             | Line | Status                 |
| ------------------------------------ | ----------------------------------------- | ---- | ---------------------- |
| `scripts/usrp_power_measure_real.py` | `src/routes/api/rf/usrp-power/+server.ts` | 27   | NOT archived (remains) |
| `scripts/usrp_spectrum_scan.py`      | `src/lib/server/usrp/sweepManager.ts`     | 298  | NOT archived (remains) |

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

Before archiving any install script, verify it is not sourced by a surviving script:

```bash
# Check if the two scripts being archived are sourced by any other script:
for f in install_uhd.sh install-usrp-support.sh; do
  result=$(grep -rn "source.*$f\|\\. .*$f\|bash.*$f" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived')
  if [ -n "$result" ]; then
    echo "BLOCKED: $f is sourced by: $result"
  fi
done
# If any BLOCKED lines appear, do NOT archive that script until the dependency is resolved.
```

### 6.2 Install Script Inventory

#### Top-level install scripts (8 files, 1,768 lines)

| File                             | Lines | Disposition | Reason                                                                     |
| -------------------------------- | ----- | ----------- | -------------------------------------------------------------------------- |
| `install-argos.sh`               | 384   | KEEP        | Primary Argos installer                                                    |
| `install-framework.sh`           | 295   | KEEP        | Framework validation installer                                             |
| `install-management.sh`          | 481   | KEEP        | Management tools installer                                                 |
| `install-system-dependencies.sh` | 486   | KEEP        | System dependency installer                                                |
| `install-openwebrx-hackrf.sh`    | 426   | KEEP        | OpenWebRX HackRF installer                                                 |
| `install-droneid-service.sh`     | 32    | KEEP        | DroneID service installer                                                  |
| `install-usrp-support.sh`        | 43    | ARCHIVE     | Redundant with install/install_uhd.sh + install/setup-usrp-simple.sh       |
| `install_uhd.sh`                 | 47    | ARCHIVE     | Duplicate of install/install_uhd.sh (top-level has 15 extra logging lines) |

#### install/ directory (8 files + 1 log, 2,186 lines)

| File                               | Lines | Disposition | Reason                           |
| ---------------------------------- | ----- | ----------- | -------------------------------- |
| `install/install_coral_support.sh` | 87    | KEEP        | Coral TPU installer              |
| `install/install-from-git.sh`      | 619   | KEEP        | Git-based installer              |
| `install/install-modified.sh`      | 502   | KEEP        | Modified installer               |
| `install/install.sh`               | 454   | KEEP        | Standard installer               |
| `install/install_uhd.sh`           | 32    | KEEP        | UHD driver installer (canonical) |
| `install/quick-install.sh`         | 224   | KEEP        | Quick installer                  |
| `install/setup-opencellid.sh`      | 223   | KEEP        | OpenCellID setup                 |
| `install/setup-usrp-simple.sh`     | 45    | KEEP        | Simple USRP setup                |
| `install/install-from-git.log`     | N/A   | ARCHIVE     | Build artifact, not a script     |

### 6.3 Deduplication Details

The `deploy/` directory duplicates of `install/` were already eliminated in Task 6.2.1. The remaining duplicates at top level are:

1. **`install_uhd.sh` (top-level, 47 lines)** vs **`install/install_uhd.sh` (32 lines)** -- NOT byte-identical. The top-level version has 15 extra lines of logging and comments. The `install/` version is the canonical copy (simpler, cleaner). Archive the top-level version.

2. **`install-usrp-support.sh` (43 lines)** -- functionality is fully covered by the combination of `install/install_uhd.sh` (UHD driver install) + `install/setup-usrp-simple.sh` (USRP device setup). Archive.

### 6.4 Execution Steps

```bash
# Step 1: Create archive subdirectory
mkdir -p scripts/_archived/phase-6.2/install

# Step 2: Archive top-level duplicates
mv scripts/install_uhd.sh scripts/_archived/phase-6.2/install/
mv scripts/install-usrp-support.sh scripts/_archived/phase-6.2/install/

# Step 3: Archive build artifact
mv scripts/install/install-from-git.log scripts/_archived/phase-6.2/install/
```

---

## 7. Post-Execution Verification

```bash
# Count top-level install scripts (should be 6 remaining)
ls scripts/install-*.sh scripts/install_*.sh 2>/dev/null | wc -l
# EXPECTED: 6 (install-argos.sh, install-framework.sh, install-management.sh,
#              install-system-dependencies.sh, install-openwebrx-hackrf.sh,
#              install-droneid-service.sh)

# Count install/ directory scripts (should be 8 remaining)
ls scripts/install/*.sh 2>/dev/null | wc -l
# EXPECTED: 8

# Verify no duplicate install_uhd.sh at top level
test ! -f scripts/install_uhd.sh && echo "PASS: top-level install_uhd.sh removed" || echo "FAIL"
test -f scripts/install/install_uhd.sh && echo "PASS: install/install_uhd.sh preserved" || echo "FAIL"

# Verify no install-usrp-support.sh at top level
test ! -f scripts/install-usrp-support.sh && echo "PASS: install-usrp-support.sh removed" || echo "FAIL"

# Verify no build artifacts remain
test ! -f scripts/install/install-from-git.log && echo "PASS: log file removed" || echo "FAIL"

# Verify production-referenced Python scripts are untouched
test -f scripts/usrp_power_measure_real.py && echo "PASS" || echo "FAIL"
test -f scripts/usrp_spectrum_scan.py && echo "PASS" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/install/ | wc -l
# EXPECTED: 3 (install_uhd.sh, install-usrp-support.sh, install-from-git.log)
```

---

## 8. Metrics

| Metric                           | Value                             |
| -------------------------------- | --------------------------------- |
| Files Archived                   | 3 (2 .sh + 1 .log build artifact) |
| Files Created (new consolidated) | 0                                 |
| Net File Reduction               | 3 files                           |
| Lines Eliminated (archived .sh)  | ~90 lines (47 + 43)               |
| Lines Created                    | 0                                 |
| Net Line Reduction               | ~90 lines                         |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. `scripts/install_uhd.sh` (top-level) does not exist (archived).
2. `scripts/install/install_uhd.sh` exists and is unchanged (canonical copy).
3. `scripts/install-usrp-support.sh` does not exist (archived).
4. `scripts/install/install-from-git.log` does not exist (archived).
5. `scripts/_archived/phase-6.2/install/` contains exactly 3 files.
6. All production-referenced Python scripts (`usrp_power_measure_real.py`, `usrp_spectrum_scan.py`) exist at their original paths.
7. Script dependency graph check (Section 6.1) confirmed no archived install script is `source`d by a surviving script.
8. Total top-level install scripts: 6. Total `install/` directory scripts: 8.

---

## 10. Traceability

### Task 6.2.6: Install Consolidation (2 .sh archived, 1 artifact archived)

| Original Path                  | Disposition | Canonical Copy Location                                                       |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| `install_uhd.sh` (top-level)   | ARCHIVED    | `install/install_uhd.sh` (canonical, 32 lines)                                |
| `install-usrp-support.sh`      | ARCHIVED    | `install/install_uhd.sh` + `install/setup-usrp-simple.sh` (combined coverage) |
| `install/install-from-git.log` | ARCHIVED    | Build artifact, not a script -- no canonical equivalent                       |

---

## 11. Execution Order Notes

From parent document Section 16:

```
Task 6.2.1 (Duplicate Dirs)     -- No dependencies, execute first
    |
    v
Task 6.2.2 (GSM)                -- Depends on 6.2.1
    |
Task 6.2.3 (Kismet)             -- Independent of 6.2.2, can run in parallel
    |
Task 6.2.4 (WiFi)               -- Independent of 6.2.2-6.2.3, can run in parallel
    |
Task 6.2.5 (Keepalive)          -- Independent
    |
Task 6.2.6 (Install) <<< THIS TASK -- Depends on 6.2.1 (deploy/ archived first)
    |
Task 6.2.7 (Remaining)          -- Depends on 6.2.1-6.2.6 (must know what is already archived)
    |
    v
Task 6.2.8 (Security)           -- See Section 11.7 of parent for internal execution order
```

**This task (6.2.6) depends on Task 6.2.1** because the `deploy/` directory duplicates of `install/` must be archived first to establish `install/` as the canonical location. Tasks 6.2.2-6.2.5 are independent of this task. Task 6.2.7 depends on this task being complete.

---

END OF DOCUMENT
