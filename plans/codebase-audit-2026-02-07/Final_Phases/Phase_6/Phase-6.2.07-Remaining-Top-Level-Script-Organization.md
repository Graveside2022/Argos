# Phase 6.2.07: Remaining Top-Level Script Organization

**Document ID**: ARGOS-AUDIT-P6.2.07
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.7
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Classify every remaining top-level script (after Tasks 6.2.1-6.2.6 complete) into KEEP, ARCHIVE, or RELOCATE. Archive 8 superseded/redundant .sh scripts and 8 non-.sh files (5 audit Python scripts, 2 USRP Python scripts, 1 SQL migration). Ensure no unclassified scripts remain. Net reduction: 16 files total (8 .sh + 8 non-.sh), ~2,896 .sh lines.

---

## 2. Prerequisites

1. **Tasks 6.2.1 through 6.2.6 MUST be complete** -- this task is the final classification pass and must know what is already archived to avoid double-archiving or missing files.
2. **Phase 6.3 (`argos-env.sh`) should execute BEFORE this phase** so surviving scripts use centralized paths.
3. **Script dependency graph check** must be run for all scripts being archived (see Section 6.1).
4. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist (MANIFEST-BEFORE.txt, CHECKSUMS-BEFORE.txt).

---

## 3. Dependencies

| Dependency        | Direction           | Description                                              |
| ----------------- | ------------------- | -------------------------------------------------------- |
| Tasks 6.2.1-6.2.6 | ALL BLOCK this task | Must know what is already archived to avoid conflicts    |
| Phase 6.3         | Recommended         | Centralized path variables for surviving scripts         |
| Task 6.2.8        | Cross-reference     | Security findings in surviving scripts must be addressed |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All archived scripts are moved to `scripts/_archived/phase-6.2/misc/`.

```bash
# If an archived script is needed, restore from archive:
cp scripts/_archived/phase-6.2/misc/<original-name> scripts/<original-name>
chmod +x scripts/<original-name>

# Verify checksum matches pre-consolidation state:
sha256sum scripts/<original-name>
grep "<original-name>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

No scripts being archived in this task are referenced by production TypeScript source code or active systemd service files. The following production-critical scripts in the same categories are NOT archived:

| Script                               | Referenced By                               | Line | Status              |
| ------------------------------------ | ------------------------------------------- | ---- | ------------------- |
| `scripts/tmux-zsh-wrapper.sh`        | `src/lib/stores/dashboard/terminalStore.ts` | 72   | NOT archived (KEEP) |
| `scripts/usrp_power_measure_real.py` | `src/routes/api/rf/usrp-power/+server.ts`   | 27   | NOT archived (KEEP) |
| `scripts/usrp_spectrum_scan.py`      | `src/lib/server/usrp/sweepManager.ts`       | 298  | NOT archived (KEEP) |

**Verification** (run before any archiving):

```bash
# Verify no production-referenced script is in the archive list:
for f in cpu-guardian.sh final-usrp-setup.sh find-working-usrp-config.sh \
  nuclear-usb-reset.sh setup-host.sh download-opencellid.sh \
  usrp_power_measure.sh usrp_simple_power.sh; do
  grep -rn "$f" --include='*.ts' --include='*.service' src/ deployment/ scripts/ 2>/dev/null | grep -v '_archived' | grep -v '#'
  # EXPECTED: no output for each script. If output found, do NOT archive.
done
```

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

Before archiving any script, verify it is not sourced by a surviving script:

```bash
for f in cpu-guardian.sh final-usrp-setup.sh find-working-usrp-config.sh \
  nuclear-usb-reset.sh setup-host.sh download-opencellid.sh \
  usrp_power_measure.sh usrp_simple_power.sh; do
  result=$(grep -rn "source.*$f\|\\. .*$f\|bash.*$f" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived')
  if [ -n "$result" ]; then
    echo "BLOCKED: $f is sourced by: $result"
  fi
done
# If any BLOCKED lines appear, do NOT archive that script until the dependency is resolved.
```

### 6.2 Complete Classification of All Remaining Scripts

The following sections classify EVERY top-level script and subdirectory script that remains after Tasks 6.2.1-6.2.6. Scripts listed as "KEEP" require no action. Scripts listed as "ARCHIVE" are moved in Section 6.10.

#### 6.2.1 CPU/System Protection Scripts

| File                     | Lines | Disposition | Reason                               |
| ------------------------ | ----- | ----------- | ------------------------------------ |
| `cpu-guardian.sh`        | 474   | ARCHIVE     | Superseded by argos-cpu-protector.sh |
| `argos-cpu-protector.sh` | 303   | KEEP        | Active CPU protection                |

**Verification** (before archiving):

```bash
# cpu-guardian.sh is not referenced by any production code
grep -rn 'cpu-guardian' --include='*.ts' --include='*.service' src/ deployment/ scripts/ 2>/dev/null
# EXPECTED: no output (if output found, do not archive)
```

#### 6.2.2 Database Scripts

| File                      | Lines | Disposition | Reason                               |
| ------------------------- | ----- | ----------- | ------------------------------------ |
| `db-backup.sh`            | 128   | KEEP        | Database backup                      |
| `db-cleanup.sh`           | 169   | KEEP        | Database cleanup                     |
| `setup-db-cron.sh`        | 38    | KEEP        | Cron job setup                       |
| `add-altitude-column.sql` | 63    | ARCHIVE     | One-time migration (already applied) |

#### 6.2.3 Docker/Deployment Scripts

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

#### 6.2.4 Developer Tooling Scripts

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

#### 6.2.5 SDR Hardware Scripts (non-GSM)

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

**Verification** (before archiving):

```bash
grep -rn 'final-usrp-setup\|find-working-usrp-config' --include='*.ts' --include='*.service' src/ deployment/ 2>/dev/null
# EXPECTED: no output
```

#### 6.2.6 USB Reset Scripts

| File                    | Lines | Disposition | Reason                           |
| ----------------------- | ----- | ----------- | -------------------------------- |
| `advanced-usb-reset.sh` | 194   | KEEP        | Advanced USB reset               |
| `nuclear-usb-reset.sh`  | 151   | ARCHIVE     | Covered by advanced-usb-reset.sh |

**Verification** (before archiving):

```bash
grep -rn 'nuclear-usb-reset' --include='*.ts' --include='*.service' src/ deployment/ 2>/dev/null
# EXPECTED: no output
```

#### 6.2.7 System Setup Scripts

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

**Verification** (before archiving):

```bash
grep -rn 'setup-host\.sh' --include='*.ts' --include='*.service' src/ deployment/ scripts/ 2>/dev/null | grep -v 'setup-host-complete'
# EXPECTED: no output (must exclude setup-host-complete.sh matches)
```

#### 6.2.8 DroneID Scripts

| File                       | Lines | Disposition | Reason                                                   |
| -------------------------- | ----- | ----------- | -------------------------------------------------------- |
| `droneid-channel-hop.sh`   | 41    | KEEP        | Channel hopping                                          |
| `start-droneid.sh`         | 49    | KEEP        | DroneID start                                            |
| `stop-droneid.sh`          | 28    | KEEP        | DroneID stop                                             |
| `setup-droneid-backend.sh` | 120   | KEEP        | Backend setup                                            |
| `setup-droneid-sudoers.sh` | 40    | KEEP        | Sudoers config (has security findings -- see Task 6.2.8) |

#### 6.2.9 Cell Tower / OpenCellID Scripts

| File                            | Lines | Disposition | Reason                                |
| ------------------------------- | ----- | ----------- | ------------------------------------- |
| `create-sample-celltower-db.sh` | 134   | KEEP        | Sample DB creation                    |
| `setup-celltower-db.sh`         | 31    | KEEP        | DB setup                              |
| `download-opencellid.sh`        | 21    | ARCHIVE     | Subset of download-opencellid-full.sh |
| `download-opencellid-full.sh`   | 154   | KEEP        | Full OpenCellID download              |
| `setup-opencellid-full.sh`      | 95    | KEEP        | Full OpenCellID setup                 |
| `import-opencellid.sh`          | 62    | KEEP        | OpenCellID import                     |

#### 6.2.10 OpenWebRX Integration

| File                           | Lines | Disposition | Reason               |
| ------------------------------ | ----- | ----------- | -------------------- |
| `integrate-openwebrx-argos.sh` | 168   | KEEP        | Integration script   |
| `setup-openwebrx-usrp.sh`      | 140   | KEEP        | USRP OpenWebRX setup |

#### 6.2.11 GPS Scripts

| File                    | Lines | Disposition | Reason             |
| ----------------------- | ----- | ----------- | ------------------ |
| `gps-diagnostics.sh`    | 98    | KEEP        | GPS diagnostics    |
| `gps-status-monitor.sh` | 28    | KEEP        | GPS status monitor |

#### 6.2.12 WiFi Resilience/AP Scripts (not covered by Task 6.2.4)

| File                        | Lines | Disposition | Reason                 |
| --------------------------- | ----- | ----------- | ---------------------- |
| `argos-wifi-resilience.sh`  | 414   | KEEP        | WiFi resilience daemon |
| `ensure-alfa-boot.sh`       | 260   | KEEP        | Boot-time ALFA         |
| `argos-ap-simple.sh`        | 180   | KEEP        | AP creation            |
| `create-virtual-monitor.sh` | 48    | KEEP        | Monitor mode           |

#### 6.2.13 Service Files and Configs at Top Level

| File                           | Lines | Disposition | Reason             |
| ------------------------------ | ----- | ----------- | ------------------ |
| `simple-keepalive.service`     | N/A   | KEEP        | Service definition |
| `dev-server-keepalive.service` | N/A   | KEEP        | Service definition |
| `wifi-keepalive.service`       | N/A   | KEEP        | Service definition |

#### 6.2.14 Non-Shell Files (Python, JS, TS, SQL) -- Classification

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

#### 6.2.15 Audit/Analysis Python Scripts (created during audit, non-production)

| File                         | Lines | Disposition | Reason                        |
| ---------------------------- | ----- | ----------- | ----------------------------- |
| `audit-function-sizes.py`    | 476   | ARCHIVE     | Audit tooling, not production |
| `audit-function-sizes-v2.py` | 373   | ARCHIVE     | Audit tooling, not production |
| `compare-audit-to-plan.py`   | 402   | ARCHIVE     | Audit tooling, not production |
| `compare-audit-v2.py`        | 376   | ARCHIVE     | Audit tooling, not production |
| `verify-function-length.py`  | 320   | ARCHIVE     | Audit tooling, not production |

#### 6.2.16 Subdirectory Scripts -- ALL KEEP

**monitoring/ (6 files, 488 lines) -- KEEP ALL**

| File                                  | Lines | Disposition | Reason                |
| ------------------------------------- | ----- | ----------- | --------------------- |
| `monitoring/check-hackrf-status.sh`   | 43    | KEEP        | HackRF status         |
| `monitoring/check-memory-leaks.sh`    | 244   | KEEP        | Memory leak detection |
| `monitoring/diagnose-hackrf-crash.sh` | 81    | KEEP        | Crash diagnostics     |
| `monitoring/monitor-hackrf.sh`        | 36    | KEEP        | HackRF monitoring     |
| `monitoring/monitor-memory.sh`        | 51    | KEEP        | Memory monitoring     |
| `monitoring/restart-hackrf.sh`        | 33    | KEEP        | HackRF restart        |

**infrastructure/ (3 files, 247 lines) -- KEEP ALL**

| File                               | Lines | Disposition | Reason        |
| ---------------------------------- | ----- | ----------- | ------------- |
| `infrastructure/backup.sh`         | 166   | KEEP        | Backup script |
| `infrastructure/download-fonts.sh` | 69    | KEEP        | Font download |
| `infrastructure/setup-cron.sh`     | 12    | KEEP        | Cron setup    |

**gps-integration/ (6 files, 880 lines) -- KEEP ALL**

| File                                        | Lines | Disposition | Reason            |
| ------------------------------------------- | ----- | ----------- | ----------------- |
| `gps-integration/configure-prolific-gps.sh` | 210   | KEEP        | GPS configuration |
| `gps-integration/implement-gps-workflow.sh` | 317   | KEEP        | GPS workflow      |
| `gps-integration/validate-gps-workflow.sh`  | 150   | KEEP        | GPS validation    |
| `gps-integration/make-permanent-alias.sh`   | 25    | KEEP        | Alias setup       |
| `gps-integration/setup-alfa-naming.sh`      | 149   | KEEP        | ALFA naming       |
| `gps-integration/alfa-alias-reference.sh`   | 29    | KEEP        | ALFA reference    |

**dev/ (10 files after Task 6.2.1 relocation, ~611 lines) -- KEEP ALL**

All files in dev/ are unique after Task 6.2.1 relocates 2 files from development/.

**install/ (8 files after Task 6.2.6 artifact removal, 2,186 lines) -- KEEP ALL**

All files in install/ are canonical copies after deploy/ duplicates are archived.

### 6.10 Execution Steps

```bash
# Step 1: Create archive subdirectory
mkdir -p scripts/_archived/phase-6.2/misc

# Step 2: Archive .sh scripts (8 files)
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

# USRP shell superseded
mv scripts/usrp_power_measure.sh scripts/_archived/phase-6.2/misc/
mv scripts/usrp_simple_power.sh scripts/_archived/phase-6.2/misc/

# Step 3: Archive non-.sh files (8 files)
# USRP Python superseded
mv scripts/usrp_simple_scanner.py scripts/_archived/phase-6.2/misc/
mv scripts/usrp_working_scanner.py scripts/_archived/phase-6.2/misc/

# One-time migration
mv scripts/add-altitude-column.sql scripts/_archived/phase-6.2/misc/

# Audit tooling (non-production Python scripts)
mv scripts/audit-function-sizes.py scripts/_archived/phase-6.2/misc/
mv scripts/audit-function-sizes-v2.py scripts/_archived/phase-6.2/misc/
mv scripts/compare-audit-to-plan.py scripts/_archived/phase-6.2/misc/
mv scripts/compare-audit-v2.py scripts/_archived/phase-6.2/misc/
mv scripts/verify-function-length.py scripts/_archived/phase-6.2/misc/
```

---

## 7. Post-Execution Verification

```bash
# Verify each archived .sh file is gone from scripts/
for f in cpu-guardian.sh final-usrp-setup.sh find-working-usrp-config.sh \
  nuclear-usb-reset.sh setup-host.sh download-opencellid.sh \
  usrp_power_measure.sh usrp_simple_power.sh; do
  test ! -f "scripts/$f" && echo "PASS: $f archived" || echo "FAIL: $f still present"
done

# Verify each archived non-.sh file is gone
for f in usrp_simple_scanner.py usrp_working_scanner.py add-altitude-column.sql \
  audit-function-sizes.py audit-function-sizes-v2.py compare-audit-to-plan.py \
  compare-audit-v2.py verify-function-length.py; do
  test ! -f "scripts/$f" && echo "PASS: $f archived" || echo "FAIL: $f still present"
done

# Verify production-referenced scripts are untouched
for f in tmux-zsh-wrapper.sh start-kismet-with-alfa.sh setup-kismet-adapter.sh \
  patch-gsmevil-socketio.sh simple-keepalive.sh dev-server-keepalive.sh \
  wifi-keepalive-robust.sh; do
  test -f "scripts/$f" && echo "PASS: $f present" || echo "FAIL: $f missing"
done

# Verify production-referenced Python scripts are untouched
test -f scripts/usrp_power_measure_real.py && echo "PASS" || echo "FAIL"
test -f scripts/usrp_spectrum_scan.py && echo "PASS" || echo "FAIL"

# Count archived in misc
ls scripts/_archived/phase-6.2/misc/ | wc -l
# EXPECTED: 16

# Verify argos-cpu-protector.sh survived (not archived with cpu-guardian.sh)
test -f scripts/argos-cpu-protector.sh && echo "PASS" || echo "FAIL"

# Verify setup-host-complete.sh survived (not archived with setup-host.sh)
test -f scripts/setup-host-complete.sh && echo "PASS" || echo "FAIL"

# Verify advanced-usb-reset.sh survived (not archived with nuclear-usb-reset.sh)
test -f scripts/advanced-usb-reset.sh && echo "PASS" || echo "FAIL"

# Verify download-opencellid-full.sh survived (not archived with download-opencellid.sh)
test -f scripts/download-opencellid-full.sh && echo "PASS" || echo "FAIL"
```

---

## 8. Metrics

| Metric                           | Value                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| .sh Files Archived               | 8                                                                                |
| Non-.sh Files Archived           | 8 (2 .py USRP + 5 .py audit + 1 .sql)                                            |
| Total Files Archived             | 16                                                                               |
| Files Created (new consolidated) | 0                                                                                |
| Net File Reduction               | 16 files                                                                         |
| .sh Lines Eliminated (archived)  | ~2,896 lines                                                                     |
| Non-.sh Lines Eliminated         | ~2,269 lines (audit .py) + 235 lines (USRP .py) + 63 lines (.sql) = ~2,567 lines |
| Lines Created                    | 0                                                                                |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. None of the 8 .sh scripts listed for archiving exist at their original locations.
2. None of the 8 non-.sh files listed for archiving exist at their original locations.
3. `scripts/_archived/phase-6.2/misc/` contains exactly 16 files.
4. All 11 production-referenced scripts from parent Section 3.3 exist and are executable.
5. All production-referenced Python scripts exist at their original paths.
6. Script dependency graph check (Section 6.1) confirmed no archived script is `source`d by a surviving script.
7. No production code reference was broken (parent Section 12.3 zero-broken-references check passes).
8. For every ARCHIVE file, the corresponding canonical/superseding file exists and is functional.

---

## 10. Traceability

### Task 6.2.7: Remaining Organization (8 .sh archived, 8 non-.sh archived)

#### .sh Scripts Archived

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

#### Non-.sh Files Archived

| Original Path                | Disposition | Reason                               |
| ---------------------------- | ----------- | ------------------------------------ |
| `usrp_simple_scanner.py`     | ARCHIVED    | Superseded by usrp_spectrum_scan.py  |
| `usrp_working_scanner.py`    | ARCHIVED    | "Working" naming indicates iteration |
| `add-altitude-column.sql`    | ARCHIVED    | One-time migration (already applied) |
| `audit-function-sizes.py`    | ARCHIVED    | Audit tooling, not production        |
| `audit-function-sizes-v2.py` | ARCHIVED    | Audit tooling, not production        |
| `compare-audit-to-plan.py`   | ARCHIVED    | Audit tooling, not production        |
| `compare-audit-v2.py`        | ARCHIVED    | Audit tooling, not production        |
| `verify-function-length.py`  | ARCHIVED    | Audit tooling, not production        |

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
Task 6.2.6 (Install)            -- Depends on 6.2.1 (deploy/ archived first)
    |
Task 6.2.7 (Remaining) <<< THIS TASK -- Depends on 6.2.1-6.2.6 (must know what is already archived)
    |
    v
Task 6.2.8 (Security)           -- See Section 11.7 of parent for internal execution order
```

**This task (6.2.7) depends on ALL of Tasks 6.2.1 through 6.2.6** because it is the final classification pass and must avoid double-archiving or missing files. It blocks Task 6.2.8 (security) only in the sense that security remediation of surviving scripts should happen after the final file set is determined.

**Minimum critical path**: 6.2.1 -> 6.2.2 || 6.2.3 || 6.2.4 || 6.2.5 -> 6.2.6 -> 6.2.7 (this task) -> 6.2.8 (remaining security) -> Verify

---

END OF DOCUMENT
