# Phase 6.2.05: Keepalive/Process Script Consolidation

**Document ID**: ARGOS-AUDIT-P6.2.05
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.5
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective

Archive 1 redundant keepalive script (`keepalive.sh`, 26 lines) that is a trivial subset of `simple-keepalive.sh`. The remaining 6 keepalive/process management scripts serve genuinely different purposes and are all KEPT. Net reduction: 1 file, 26 lines.

---

## 2. Prerequisites

1. **Task 6.2.1 recommended** (Duplicate Directory Elimination) -- ensures no duplicate keepalive scripts remain in archived directories.
2. **Phase 6.3 (`argos-env.sh`) should execute BEFORE this phase** so surviving keepalive scripts can be updated to use centralized paths.
3. **Script dependency graph check** must be run (see Section 6.1).
4. **Pre-execution snapshot** (Phase-6.2.01 Section 4.1) must already exist (MANIFEST-BEFORE.txt, CHECKSUMS-BEFORE.txt).

---

## 3. Dependencies

| Dependency                 | Direction                    | Description                                                                 |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Task 6.2.1                 | Recommended before this task | Avoids confusion with duplicate directories                                 |
| Phase 6.3                  | Recommended                  | Centralized path variables for surviving scripts                            |
| `simple-keepalive.sh`      | PRODUCTION-CRITICAL          | Referenced by `scripts/simple-keepalive.service` line 10 -- MUST remain     |
| `dev-server-keepalive.sh`  | PRODUCTION-CRITICAL          | Referenced by `scripts/dev-server-keepalive.service` line 11 -- MUST remain |
| `wifi-keepalive-robust.sh` | PRODUCTION-CRITICAL          | Referenced by `scripts/wifi-keepalive.service` line 8 -- MUST remain        |

---

## 4. Rollback Strategy

**CRITICAL**: No script file is ever deleted. The archived script is moved to `scripts/_archived/phase-6.2/keepalive/`.

```bash
# If keepalive.sh is needed after archiving, restore from archive:
cp scripts/_archived/phase-6.2/keepalive/keepalive.sh scripts/keepalive.sh
chmod +x scripts/keepalive.sh

# Verify checksum matches pre-consolidation state:
sha256sum scripts/keepalive.sh
grep "keepalive.sh" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
```

---

## 5. Production-Critical Script Protection

The following keepalive/process scripts are referenced by active systemd service files and must NEVER be archived:

| Script                             | Referenced By                          | Line |
| ---------------------------------- | -------------------------------------- | ---- |
| `scripts/simple-keepalive.sh`      | `scripts/simple-keepalive.service`     | 10   |
| `scripts/dev-server-keepalive.sh`  | `scripts/dev-server-keepalive.service` | 11   |
| `scripts/wifi-keepalive-robust.sh` | `scripts/wifi-keepalive.service`       | 8    |

**Verification** (run before any archiving):

```bash
test -f scripts/simple-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/dev-server-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/wifi-keepalive-robust.sh && echo "PASS" || echo "FAIL"
```

---

## 6. Task Details

### 6.1 Script Dependency Graph Check

Before archiving `keepalive.sh`, verify it is not sourced by a surviving script:

```bash
# Check if keepalive.sh is sourced by any other script:
grep -rn "source.*keepalive\.sh\|\\. .*keepalive\.sh\|bash.*keepalive\.sh" scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v 'simple-keepalive\|dev-server-keepalive\|wifi-keepalive\|argos-keepalive\|manage-keepalive'
# NOTE: Must exclude the other keepalive scripts that contain "keepalive" in their name.
# Only matches to the exact file "keepalive.sh" (not simple-keepalive.sh, etc.) indicate a dependency.
# EXPECTED: no output. If output found, do NOT archive keepalive.sh.
```

### 6.2 Keepalive Script Inventory (7 files, 1,365 total lines)

| File                       | Lines | Disposition               | Reason                                                 |
| -------------------------- | ----- | ------------------------- | ------------------------------------------------------ |
| `keepalive.sh`             | 26    | ARCHIVE                   | Trivial, subset of simple-keepalive.sh                 |
| `simple-keepalive.sh`      | 100   | KEEP (service-referenced) | Referenced by simple-keepalive.service                 |
| `dev-server-keepalive.sh`  | 254   | KEEP (service-referenced) | Referenced by dev-server-keepalive.service             |
| `manage-keepalive.sh`      | 185   | KEEP                      | Keepalive management (install/uninstall/status)        |
| `argos-keepalive.sh`       | 443   | KEEP                      | Comprehensive production-grade multi-service keepalive |
| `argos-process-manager.sh` | 226   | KEEP                      | Process lifecycle management (start/stop/restart)      |
| `wifi-keepalive-robust.sh` | 131   | KEEP (service-referenced) | Referenced by wifi-keepalive.service                   |

### 6.3 Rationale for Minimal Consolidation

Unlike GSM scripts (22 variants of "start"), the keepalive scripts serve genuinely different purposes:

- `simple-keepalive.sh` -- lightweight dev server monitor
- `dev-server-keepalive.sh` -- comprehensive dev server watchdog with port checks
- `argos-keepalive.sh` -- production-grade multi-service keepalive
- `wifi-keepalive-robust.sh` -- WiFi-specific connection keepalive
- `argos-process-manager.sh` -- process lifecycle management (start/stop/restart)
- `manage-keepalive.sh` -- keepalive service install/uninstall/status

Three of these are referenced by systemd service files and cannot be renamed without updating the service file path. Only `keepalive.sh` (26 lines) is purely redundant -- its entire functionality is a subset of `simple-keepalive.sh`.

### 6.4 Execution Steps

```bash
# Step 1: Create archive subdirectory
mkdir -p scripts/_archived/phase-6.2/keepalive

# Step 2: Archive the one redundant script
mv scripts/keepalive.sh scripts/_archived/phase-6.2/keepalive/
```

---

## 7. Post-Execution Verification

```bash
# Count remaining keepalive/process scripts
ls scripts/*keepalive* scripts/argos-process-manager.sh 2>/dev/null | wc -l
# EXPECTED: 6 (simple-keepalive.sh, dev-server-keepalive.sh, manage-keepalive.sh,
#              argos-keepalive.sh, argos-process-manager.sh, wifi-keepalive-robust.sh)

# Verify keepalive.sh is archived
test ! -f scripts/keepalive.sh && echo "PASS: keepalive.sh archived" || echo "FAIL: keepalive.sh still present"

# Verify service references still valid
test -f scripts/simple-keepalive.sh && echo "PASS: simple-keepalive.sh present" || echo "FAIL"
test -f scripts/dev-server-keepalive.sh && echo "PASS: dev-server-keepalive.sh present" || echo "FAIL"
test -f scripts/wifi-keepalive-robust.sh && echo "PASS: wifi-keepalive-robust.sh present" || echo "FAIL"

# Verify other kept scripts
test -f scripts/manage-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/argos-keepalive.sh && echo "PASS" || echo "FAIL"
test -f scripts/argos-process-manager.sh && echo "PASS" || echo "FAIL"

# Verify archived count
ls scripts/_archived/phase-6.2/keepalive/ | wc -l
# EXPECTED: 1

# Verify service files are untouched
test -f scripts/simple-keepalive.service && echo "PASS" || echo "FAIL"
test -f scripts/dev-server-keepalive.service && echo "PASS" || echo "FAIL"
test -f scripts/wifi-keepalive.service && echo "PASS" || echo "FAIL"
```

---

## 8. Metrics

| Metric                           | Value            |
| -------------------------------- | ---------------- |
| Files Archived                   | 1 (keepalive.sh) |
| Files Created (new consolidated) | 0                |
| Net File Reduction               | 1 file           |
| Lines Eliminated (archived)      | 26 lines         |
| Lines Created                    | 0                |
| Net Line Reduction               | 26 lines         |

---

## 9. Acceptance Criteria

From parent document Sections 12 and 18, specific to this task:

1. `scripts/keepalive.sh` does not exist (archived).
2. `scripts/_archived/phase-6.2/keepalive/keepalive.sh` exists.
3. All 3 service-referenced keepalive scripts exist and are executable.
4. All 3 `.service` files exist and are unchanged.
5. `ls scripts/*keepalive* scripts/argos-process-manager.sh 2>/dev/null | wc -l` returns 6.
6. Script dependency graph check (Section 6.1) confirmed `keepalive.sh` is not `source`d by a surviving script.

---

## 10. Traceability

### Task 6.2.5: Keepalive Consolidation (1 archived)

| Original Path  | Disposition | Merged Into                   |
| -------------- | ----------- | ----------------------------- |
| `keepalive.sh` | ARCHIVED    | Subset of simple-keepalive.sh |

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
Task 6.2.5 (Keepalive) <<< THIS TASK -- Independent
    |
Task 6.2.6 (Install)            -- Depends on 6.2.1 (deploy/ archived first)
    |
Task 6.2.7 (Remaining)          -- Depends on 6.2.1-6.2.6 (must know what is already archived)
    |
    v
Task 6.2.8 (Security)           -- See Section 11.7 of parent for internal execution order
```

**This task (6.2.5) is independent** of Tasks 6.2.2, 6.2.3, and 6.2.4 and can execute in parallel with them after Task 6.2.1 completes. It does not block any other task except 6.2.7 (remaining organization) which must run last.

---

END OF DOCUMENT
