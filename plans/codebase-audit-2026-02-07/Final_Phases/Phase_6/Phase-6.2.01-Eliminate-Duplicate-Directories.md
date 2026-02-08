# Phase 6.2.01: Eliminate Duplicate Directories

**Document ID**: ARGOS-AUDIT-P6.2.01
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.1
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Remove 4 directories (`deploy/`, `development/`, `testing/`, `maintenance/`) that are fully or predominantly duplicates of other directories. This eliminates 25 files and 4,489 duplicate lines plus 2 unique files (40 lines) that must be relocated first.

---

## 2. Prerequisites

1. **Phase 5 complete** (architecture decomposition).
2. **Phase 6.1 complete** (dead code removal).
3. **Phase 6.3 (`argos-env.sh`) must execute BEFORE this phase** so consolidated scripts use `source /path/to/argos-env.sh` from day one rather than inheriting hardcoded paths.
4. **Non-functional script fix**: `scripts/development/start-usrp-service.sh` contains `#\!/bin/bash` (escaped exclamation mark, ShellCheck SC2148). Fix by replacing with `#!/bin/bash` BEFORE consolidation begins.
5. **Pre-execution snapshot** (Section 4 below) must be completed and verified before any file moves.
6. **Script dependency graph check** (Section 6.1 below) must be run to verify no archived script is `source`d by a surviving script.
7. **Missing production-critical scripts decision** must be recorded: `scripts/deploy/deploy-production.sh`, `scripts/deploy/rollback.sh`, `scripts/monitoring/health-check.sh` -- each must be marked CREATE or FORMALLY REMOVE before proceeding.

---

## 3. Dependencies

| Dependency | Direction            | Description                                                                   |
| ---------- | -------------------- | ----------------------------------------------------------------------------- |
| Phase 6.3  | BLOCKS this task     | `argos-env.sh` centralized paths must be available before consolidation       |
| Task 6.2.6 | BLOCKED BY this task | Install script consolidation depends on deploy/ being archived first          |
| Task 6.2.7 | BLOCKED BY this task | Remaining organization must know what is already archived                     |
| Task 6.2.2 | BLOCKED BY this task | GSM consolidation depends on `maintenance/run-gsmevil.sh` being archived here |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All consolidated, superseded, or duplicate scripts are moved to `scripts/_archived/phase-6.2/` with their original directory structure preserved.

### 4.1 Pre-Execution Snapshot

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

### 4.2 Rollback Procedure

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

---

## 5. Production-Critical Script Protection

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

### Missing Production-Critical Scripts [MUST CREATE OR REMOVE]

The independent audit (2026-02-08) identified 3 scripts commonly expected in a production deployment that DO NOT EXIST on disk:

| Expected Script                       | Status                    | Required Action                                                                           |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `scripts/deploy/deploy-production.sh` | **[MISSING - NOT FOUND]** | Either create as a wrapper around `deploy-master.sh` or formally document its absence     |
| `scripts/deploy/rollback.sh`          | **[MISSING - NOT FOUND]** | Either create a rollback script or document that rollback is manual (Section 4.2)         |
| `scripts/monitoring/health-check.sh`  | **[MISSING - NOT FOUND]** | Either create a health check or document that `deployment-status-api.sh` serves this role |

**Verification**:

```bash
test -f scripts/deploy/deploy-production.sh && echo "EXISTS" || echo "MISSING: deploy-production.sh"
test -f scripts/deploy/rollback.sh && echo "EXISTS" || echo "MISSING: rollback.sh"
test -f scripts/monitoring/health-check.sh && echo "EXISTS" || echo "MISSING: health-check.sh"
# All 3 are expected to return MISSING until remediated.
```

**Decision Required Before Execution**: For each missing script, the operator must decide:

1. **CREATE**: Write the script and add it to the production-critical list.
2. **FORMALLY REMOVE**: Document that the functionality is covered by an existing script and no new script is needed.

Do NOT proceed with Phase 6.2 consolidation until this decision is recorded.

---

## 6. Task Details

### 6.1 Pre-Execution Verification

Confirm all claimed byte-identical duplicates are still identical at execution time.

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

#### Byte-Identity Verification (21 diff commands)

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

### 6.2 Relocate Unique Files from development/

Two files in `development/` have no duplicate in `dev/` and must be moved before archiving.

```bash
# 6.2.1: Move auto-start-kismet.sh (29 lines) to dev/
cp scripts/development/auto-start-kismet.sh scripts/dev/auto-start-kismet.sh
chmod +x scripts/dev/auto-start-kismet.sh
diff scripts/development/auto-start-kismet.sh scripts/dev/auto-start-kismet.sh
# Must be empty

# 6.2.2: Move start-usrp-service.sh (11 lines) to dev/
cp scripts/development/start-usrp-service.sh scripts/dev/start-usrp-service.sh
chmod +x scripts/dev/start-usrp-service.sh
diff scripts/development/start-usrp-service.sh scripts/dev/start-usrp-service.sh
# Must be empty
```

### 6.3 Relocate Unique Files from deploy/

All 10 files in deploy/ are duplicates of files in other directories. No unique files require relocation from deploy/.

### 6.4 Relocate Unique File from install/

One file in `install/` has no duplicate elsewhere and is not in deploy/: `setup-usrp-simple.sh` (45 lines). This file stays in `install/`. Additionally, `install-from-git.log` is a build artifact, not a script -- archive it.

```bash
# Archive the log file
mv scripts/install/install-from-git.log scripts/_archived/phase-6.2/install-from-git.log
```

### 6.5 Archive the 4 Duplicate Directories

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

### 6.6 Post-Execution Verification (Task-Level)

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

---

## 7. Post-Execution Verification

All verification commands from Section 6.6 above, plus:

```bash
# Verify no production-referenced scripts were accidentally archived
for f in tmux-zsh-wrapper.sh start-kismet-with-alfa.sh setup-kismet-adapter.sh \
  patch-gsmevil-socketio.sh simple-keepalive.sh dev-server-keepalive.sh \
  wifi-keepalive-robust.sh; do
  test -f "scripts/$f" && echo "PASS: $f present" || echo "FAIL: $f missing"
done

# Verify MANIFEST and CHECKSUMS exist
test -f scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt && echo "PASS" || echo "FAIL"
test -f scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt && echo "PASS" || echo "FAIL"

# Verify relocated files are executable
test -x scripts/dev/auto-start-kismet.sh && echo "PASS" || echo "FAIL"
test -x scripts/dev/start-usrp-service.sh && echo "PASS" || echo "FAIL"
```

---

## 8. Metrics

| Metric                      | Value                                                          |
| --------------------------- | -------------------------------------------------------------- |
| Files Eliminated (archived) | 25 (10 deploy/ + 6 development/ + 5 testing/ + 4 maintenance/) |
| Lines Eliminated            | 5,605 (3,771 + 457 + 890 + 487)                                |
| Files Relocated             | 2 (auto-start-kismet.sh, start-usrp-service.sh)                |
| Lines Relocated             | 40                                                             |
| Files Created               | 0                                                              |
| Net File Reduction          | 25 files                                                       |
| Resulting .sh File Count    | 179 (from 202)                                                 |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. Directories `scripts/deploy/`, `scripts/development/`, `scripts/testing/`, `scripts/maintenance/` do not exist.
2. `scripts/_archived/phase-6.2/MANIFEST-BEFORE.txt` exists with 202 entries.
3. `scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt` exists with 202 entries.
4. All 11 production-referenced scripts from Section 5 exist and are executable.
5. Relocated files `scripts/dev/auto-start-kismet.sh` and `scripts/dev/start-usrp-service.sh` exist and are executable.
6. `find scripts/ -name '*.sh' -not -path '*_archived*' | wc -l` returns 179 or fewer.
7. All 21 diff commands in Section 6.1 returned expected results before archiving.
8. Script dependency graph check (Section 6.1) confirmed no archived script is `source`d by a surviving script.

---

## 10. Traceability

### Task 6.2.1: Duplicate Directory Elimination (25 .sh archived)

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

---

## 11. Execution Order Notes

From parent document Section 16:

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
Task 6.2.8 (Security)           -- See Section 11.7 of parent for internal execution order
```

**This task (6.2.1) has no predecessor dependencies and should execute first.** It blocks Tasks 6.2.2, 6.2.6, and 6.2.7.

**Minimum critical path**: 6.2.8 (API tokens + NOPASSWD) -> 6.2.1 -> 6.2.2 || 6.2.3 || 6.2.4 || 6.2.5 -> 6.2.6 -> 6.2.7 -> 6.2.8 (remaining) -> Verify

---

END OF DOCUMENT
