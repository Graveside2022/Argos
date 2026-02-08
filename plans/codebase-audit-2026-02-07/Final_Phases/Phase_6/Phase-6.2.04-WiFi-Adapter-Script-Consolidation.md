# Phase 6.2.04: WiFi/Adapter Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2.04
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.4
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Reduce 11 WiFi/adapter-related scripts (950 total lines in the core set) plus 1 additional WiFi script (`create-ap-simple.sh`, 54 lines) to 3 consolidated scripts. Archive 11 files total. Create 2 new unified scripts (`wifi-adapter.sh`, `wifi-adapter-fix.sh`). Keep 1 existing script (`configure-usb-persistence.sh`). Net reduction: 9 files.

Additionally, 7 WiFi-related scripts at the top level serve distinct purposes and are explicitly KEPT without modification (see Section 6.3).

---

## 2. Prerequisites

1. **Task 6.2.1 complete** (Duplicate Directory Elimination) -- ensures no duplicate WiFi scripts remain in archived directories.
2. **Phase 6.3 (`argos-env.sh`) must execute BEFORE this phase** so the new consolidated scripts use centralized paths from day one.
3. **Script dependency graph check** must be run (see Section 6.1).
4. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist (MANIFEST-BEFORE.txt, CHECKSUMS-BEFORE.txt).
5. **Task 6.2.8 security remediation** for API tokens and NOPASSWD should be completed or in progress before consolidation creates new scripts.

---

## 3. Dependencies

| Dependency                 | Direction                    | Description                                                                                                |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Task 6.2.1                 | Recommended before this task | Avoids confusion with duplicate directories                                                                |
| Phase 6.3                  | BLOCKS this task             | Centralized path variables needed before creating new consolidated scripts                                 |
| Task 6.2.8                 | Cross-reference              | Security findings in WiFi scripts must be remediated in the new consolidated scripts, not in the originals |
| `wifi-keepalive-robust.sh` | NOT in scope                 | Referenced by `scripts/wifi-keepalive.service` -- handled by Task 6.2.5 (Keepalive), not this task         |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. All superseded WiFi/adapter scripts are moved to `scripts/_archived/phase-6.2/wifi/` preserving flat structure.

```bash
# If a consolidated script has issues, restore from archive:
cp scripts/_archived/phase-6.2/wifi/<original-name>.sh scripts/<original-name>.sh
chmod +x scripts/<original-name>.sh

# Verify checksum matches pre-consolidation state:
sha256sum scripts/<original-name>.sh
grep "<original-name>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

No WiFi/adapter scripts in this task's scope are referenced by production TypeScript source code or active systemd service files. The following WiFi-related scripts are production-critical but are NOT in this task's scope:

| Script                             | Referenced By                    | Line | Handled By        |
| ---------------------------------- | -------------------------------- | ---- | ----------------- |
| `scripts/wifi-keepalive-robust.sh` | `scripts/wifi-keepalive.service` | 8    | Task 6.2.5 (KEEP) |

**All 11 scripts being archived in this task are safe to archive without production code changes.**

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

Before archiving any WiFi/adapter script, verify it is not sourced by a surviving script:

```bash
# Per-script check for each WiFi file to be archived:
for f in detect-alfa-adapter.sh detect-any-wifi-adapter.sh diagnose-wifi-adapter.sh \
  fix-alfa-only.sh fix-argos-ap-mt7921.sh fix-mt76-adapter.sh fix-wifi-now.sh \
  reset-wifi-adapter.sh safe-adapter-reset.sh safe-fix-adapter.sh create-ap-simple.sh; do
  result=$(grep -rn "source.*$f\|\\. .*$f\|bash.*$f" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived')
  if [ -n "$result" ]; then
    echo "BLOCKED: $f is sourced by: $result"
  fi
done
# If any BLOCKED lines appear, do NOT archive that script until the dependency is resolved.
```

### 6.2 WiFi/Adapter Script Inventory (Core 11 scripts, 950 lines)

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

### 6.3 Additional WiFi-Related Scripts (NOT in scope -- KEEP ALL)

These top-level WiFi-related scripts serve genuinely distinct purposes and are NOT part of this consolidation:

| File                                      | Lines | Disposition | Reason                                            |
| ----------------------------------------- | ----- | ----------- | ------------------------------------------------- |
| `argos-wifi-resilience.sh`                | 414   | KEEP        | Comprehensive resilience daemon, distinct purpose |
| `ensure-alfa-boot.sh`                     | 260   | KEEP        | Boot-time ALFA config, distinct purpose           |
| `argos-ap-simple.sh`                      | 180   | KEEP        | AP creation, distinct purpose                     |
| `create-ap-simple.sh`                     | 54    | ARCHIVE     | Subset of argos-ap-simple.sh                      |
| `create-virtual-monitor.sh`               | 48    | KEEP        | Monitor mode setup                                |
| `setup-interface-names.sh`                | 29    | KEEP        | udev rule setup                                   |
| `update-configs-for-descriptive-names.sh` | 48    | KEEP        | Config updater                                    |

**NOTE**: `create-ap-simple.sh` is a subset of `argos-ap-simple.sh` and is archived alongside the core WiFi scripts (total: 11 files archived).

### 6.4 Consolidated WiFi Scripts (Target: 3 from the core set)

#### 6.4.1 wifi-adapter.sh (~200 lines) -- Unified detect/diagnose

Merge logic from: `detect-alfa-adapter.sh` (ALFA detection), `detect-any-wifi-adapter.sh` (generic detection), `diagnose-wifi-adapter.sh` (diagnostics).

```
Usage: wifi-adapter.sh {detect|detect-alfa|diagnose} [OPTIONS]
  detect       Detect any WiFi adapter
  detect-alfa  Detect ALFA adapter specifically
  diagnose     Run WiFi adapter diagnostics
```

**Subtask 6.4.1a**: Extract common detection patterns from the 3 merge sources.

```bash
# Identify shared patterns across merge sources
grep -h 'iw dev\|iwconfig\|lsusb\|airmon-ng\|ALFA\|RTL8812' \
  scripts/detect-alfa-adapter.sh \
  scripts/detect-any-wifi-adapter.sh \
  scripts/diagnose-wifi-adapter.sh | sort -u
```

**Subtask 6.4.1b**: Write the unified script with subcommand dispatch.

**Subtask 6.4.1c**: Test each subcommand.

```bash
bash scripts/wifi-adapter.sh detect
# Must exit 0 and print adapter state (even if none found)

bash -n scripts/wifi-adapter.sh
# Must exit 0 (syntax check)
```

#### 6.4.2 wifi-adapter-fix.sh (~250 lines) -- Unified fix/reset

Merge logic from: `fix-alfa-only.sh`, `fix-argos-ap-mt7921.sh`, `fix-mt76-adapter.sh`, `fix-wifi-now.sh`, `reset-wifi-adapter.sh`, `safe-adapter-reset.sh`.

```
Usage: wifi-adapter-fix.sh {fix|fix-alfa|fix-mt76|fix-mt7921|reset|safe-reset} [OPTIONS]
  fix          Auto-detect and fix WiFi adapter issues
  fix-alfa     ALFA-specific fix
  fix-mt76     MT76 driver fix
  fix-mt7921   MT7921 AP fix
  reset        Reset WiFi adapter
  safe-reset   Safe reset with pre-checks
```

**Subtask 6.4.2a**: Extract common fix/reset patterns from the 6 merge sources.

```bash
# Identify shared patterns across merge sources
grep -h 'modprobe\|rmmod\|ip link\|ifconfig\|iwconfig\|rfkill\|usbreset' \
  scripts/fix-alfa-only.sh \
  scripts/fix-argos-ap-mt7921.sh \
  scripts/fix-mt76-adapter.sh \
  scripts/fix-wifi-now.sh \
  scripts/reset-wifi-adapter.sh \
  scripts/safe-adapter-reset.sh | sort -u
```

**Subtask 6.4.2b**: Write the unified script with subcommand dispatch.

**Subtask 6.4.2c**: Test each subcommand.

```bash
bash -n scripts/wifi-adapter-fix.sh
# Must exit 0 (syntax check)
```

#### 6.4.3 configure-usb-persistence.sh (24 lines) -- KEEP as-is

No changes. This script has a distinct purpose (USB persistence configuration) and is small enough to remain standalone.

### 6.5 Execution Steps

```bash
# Step 1: Create archive subdirectory
mkdir -p scripts/_archived/phase-6.2/wifi

# Step 2: Archive 10 scripts being merged/eliminated from core set
for f in detect-alfa-adapter.sh detect-any-wifi-adapter.sh diagnose-wifi-adapter.sh \
  fix-alfa-only.sh fix-argos-ap-mt7921.sh fix-mt76-adapter.sh fix-wifi-now.sh \
  reset-wifi-adapter.sh safe-adapter-reset.sh safe-fix-adapter.sh; do
  mv "scripts/$f" "scripts/_archived/phase-6.2/wifi/$f"
done

# Step 3: Also archive create-ap-simple.sh (subset of argos-ap-simple.sh)
mv scripts/create-ap-simple.sh scripts/_archived/phase-6.2/wifi/

# Step 4: Create consolidated scripts (wifi-adapter.sh, wifi-adapter-fix.sh)
# Implementation per subtasks 6.4.1-6.4.2 above
```

---

## 7. Post-Execution Verification

```bash
# Count WiFi-related scripts (detection + fix + USB persistence)
ls scripts/wifi-adapter*.sh scripts/configure-usb-persistence.sh 2>/dev/null | wc -l
# EXPECTED: 3 (wifi-adapter.sh, wifi-adapter-fix.sh, configure-usb-persistence.sh)

# Verify create-ap-simple.sh is archived (argos-ap-simple.sh stays)
test ! -f scripts/create-ap-simple.sh && echo "PASS: create-ap-simple.sh archived" || echo "FAIL"
test -f scripts/argos-ap-simple.sh && echo "PASS: argos-ap-simple.sh preserved" || echo "FAIL"

# Syntax check new scripts
bash -n scripts/wifi-adapter.sh && echo "PASS: wifi-adapter.sh syntax" || echo "FAIL"
bash -n scripts/wifi-adapter-fix.sh && echo "PASS: wifi-adapter-fix.sh syntax" || echo "FAIL"

# Verify all 10 original core scripts are gone from top level
for f in detect-alfa-adapter.sh detect-any-wifi-adapter.sh diagnose-wifi-adapter.sh \
  fix-alfa-only.sh fix-argos-ap-mt7921.sh fix-mt76-adapter.sh fix-wifi-now.sh \
  reset-wifi-adapter.sh safe-adapter-reset.sh safe-fix-adapter.sh; do
  test ! -f "scripts/$f" && echo "PASS: $f archived" || echo "FAIL: $f still present"
done

# Verify archived count
ls scripts/_archived/phase-6.2/wifi/ | wc -l
# EXPECTED: 11 (10 from core + create-ap-simple.sh)

# Verify KEPT WiFi scripts are untouched
for f in argos-wifi-resilience.sh ensure-alfa-boot.sh argos-ap-simple.sh \
  create-virtual-monitor.sh setup-interface-names.sh update-configs-for-descriptive-names.sh \
  configure-usb-persistence.sh; do
  test -f "scripts/$f" && echo "PASS: $f present" || echo "FAIL: $f missing"
done
```

---

## 8. Metrics

| Metric                           | Value                                            |
| -------------------------------- | ------------------------------------------------ |
| Files Archived                   | 11 (10 core WiFi scripts + create-ap-simple.sh)  |
| Files Created (new consolidated) | 2 (wifi-adapter.sh, wifi-adapter-fix.sh)         |
| Net File Reduction               | 9 files                                          |
| Lines Eliminated (archived)      | ~1,004 lines (950 core + 54 create-ap-simple.sh) |
| Lines Created                    | ~450 lines in 2 new consolidated scripts         |
| Net Line Reduction               | ~554 lines                                       |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. `ls scripts/wifi-adapter*.sh scripts/configure-usb-persistence.sh 2>/dev/null | wc -l` returns 3.
2. Both new consolidated scripts pass `bash -n` syntax check.
3. `scripts/_archived/phase-6.2/wifi/` contains exactly 11 files.
4. No archived script remains at its original location in `scripts/`.
5. All 7 KEPT WiFi-related scripts (Section 6.3) exist at their original paths.
6. Script dependency graph check (Section 6.1) confirmed no archived WiFi script is `source`d by a surviving script.
7. `wifi-adapter.sh detect` exits 0 and prints adapter state (even if none found).
8. Security findings from Task 6.2.8 are remediated in the new consolidated scripts (cross-reference with Section 11 of parent).

---

## 10. Traceability

### Task 6.2.4: WiFi Adapter Consolidation (11 files archived, 2 new)

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
Task 6.2.4 (WiFi) <<< THIS TASK -- Independent of 6.2.2-6.2.3, can run in parallel
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

**This task (6.2.4) is independent of Tasks 6.2.2 and 6.2.3** and can execute in parallel with them after Task 6.2.1 completes. It does not block any other task except 6.2.7 (remaining organization) which must run last.

**Security remediation note**: Task 6.2.8 subtasks 11.1 (API tokens) and 11.3 (NOPASSWD kill) should execute BEFORE this consolidation so security findings are not carried into new consolidated scripts.

---

END OF DOCUMENT
