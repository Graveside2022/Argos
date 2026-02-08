# Phase 6.4.01: Shebang Standardization

**Document ID**: ARGOS-AUDIT-P6.4.01
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.1
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (structural, no behavioral change)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Replace all hardcoded `#!/bin/bash` shebangs with the portable `#!/usr/bin/env bash` form across the entire shell script corpus. Fix the one script with a missing shebang entirely. This is required because:

1. **POSIX portability**: `bash` may reside at `/usr/local/bin/bash` (macOS Homebrew, FreeBSD), `/opt/homebrew/bin/bash` (Apple Silicon), or other non-standard locations. The `/usr/bin/env` lookup uses `$PATH` to find the correct binary.
2. **Container compatibility**: Alpine Linux and minimal Docker images may install bash at non-standard paths.
3. **NASA/JPL Rule 1 (adapted)**: All source files SHALL have a deterministic, unambiguous execution entry point.

One broken shebang must also be corrected:

1. `scripts/development/start-usrp-service.sh`: Has NO shebang at all (ShellCheck SC2148)

**Note:** `scripts/setup-system-management.sh` was previously reported as having a malformed `#\!/bin/bash` shebang, but hex dump verification confirmed it has a valid `#!/bin/bash` shebang. It is NOT broken.

The script missing a shebang will produce `Exec format error` when invoked directly via `./script.sh`.

---

## 2. Prerequisites

| ID    | Prerequisite                                      | Verification Command                                                                 |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PRE-1 | Phase 6.2 (consolidation) is complete             | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md` |
| PRE-2 | All dead scripts removed per Phase 6.2            | `find scripts/ -name "*.sh" -type f \| wc -l` returns 75-80                          |
| PRE-3 | No scripts reference deleted scripts              | `grep -rl "source.*deleted_script" scripts/ --include="*.sh" \| wc -l` returns 0     |
| PRE-4 | shellcheck 0.10.0+ installed                      | `shellcheck --version \| grep -q "version: 0.1"`                                     |
| PRE-5 | Git working tree clean                            | `git diff --quiet HEAD -- scripts/`                                                  |
| PRE-6 | Phase 6.3 (hardcoded paths) complete or in-flight | Document references Phase 6.3 for 62 hardcoded-path scripts                          |

**Execution environment:** Kali Linux 2025.4, aarch64 (RPi 5), kernel 6.12.34+rpt-rpi-2712.

### Task-Specific Prerequisites

- None beyond general Phase 6.4 prerequisites. This is the second task in the execution chain (after 6.4.11).

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                            |
| ---------- | ---------- | ------ | ----------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | common.sh library must exist first; all other tasks depend on it  |
| BEFORE     | Downstream | 6.4.6  | Shebangs must be fixed before trap/error audit begins             |
| BEFORE     | Downstream | 6.4.2  | Shebang correctness is a prerequisite for strict mode enforcement |
| BEFORE     | Downstream | 6.4.4  | Shebang affects ShellCheck analysis (SC2148 for missing shebang)  |

---

## 4. Rollback Strategy

### Pre-Execution Snapshot

Before ANY modification in this phase:

```bash
# Create timestamped backup of the entire scripts directory
BACKUP_DIR="/home/kali/Documents/Argos/backups/phase-6.4-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
cp -a /home/kali/Documents/Argos/Argos/scripts/ "${BACKUP_DIR}/scripts/"
echo "Backup created at ${BACKUP_DIR}" | tee "${BACKUP_DIR}/MANIFEST.txt"
find "${BACKUP_DIR}/scripts/" -name "*.sh" -type f | wc -l >> "${BACKUP_DIR}/MANIFEST.txt"
sha256sum "${BACKUP_DIR}"/scripts/*.sh >> "${BACKUP_DIR}/MANIFEST.txt"
```

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.1 - shebang standardization
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any script that previously ran successfully now exits non-zero in its normal execution path

---

## 5. Baseline Metrics

All metrics captured on 2026-02-08 against commit `b682267` on the `dev_branch` branch.

| Metric                                   | Count | Percentage |
| ---------------------------------------- | ----- | ---------- |
| Shebang `#!/bin/bash` (hardcoded)        | 201   | 99.5%      |
| Shebang `#!/usr/bin/env bash` (portable) | 0     | 0%         |
| Malformed shebang (`#\!/bin/bash`)       | 0     | 0%         |
| Missing shebang entirely (SC2148)        | 1     | 0.5%       |

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Shebang distribution
find scripts/ -name "*.sh" -type f -exec head -1 {} \; | sort | uniq -c | sort -rn
# Result: 201 #!/bin/bash, 1 missing shebang entirely
# NOTE: setup-system-management.sh has a valid #!/bin/bash (confirmed via hex dump), not malformed
```

---

## 6. Task Details

### Scope

All `.sh` files under `scripts/` and all `.sh` files in project root directories (`hackrf_emitter/`, `tests/`).

### Detection

```bash
# Find all non-compliant shebangs
find scripts/ -name "*.sh" -type f -exec sh -c \
  'head -1 "$1" | grep -qv "^#!/usr/bin/env bash$" && echo "$1"' _ {} \;
```

### Transformation

```bash
# For each non-compliant script:
sed -i '1s|^#!.*/bash.*$|#!/usr/bin/env bash|' "$SCRIPT"
# Also fix the malformed escape:
sed -i '1s|^#\\!/bin/bash$|#!/usr/bin/env bash|' "$SCRIPT"
```

### Before/After

**Before:**

```bash
#!/bin/bash
# Script content...
```

**After:**

```bash
#!/usr/bin/env bash
# Script content...
```

**Malformed before:**

```bash
#\!/bin/bash
```

**After:**

```bash
#!/usr/bin/env bash
```

### Missing Shebang Fix

**File:** `scripts/development/start-usrp-service.sh`

This script has NO shebang at all. Add `#!/usr/bin/env bash` as line 1:

```bash
sed -i '1i#!/usr/bin/env bash' scripts/development/start-usrp-service.sh
```

---

## 7. Verification Commands

```bash
# MUST return 0 (no non-compliant files)
find scripts/ -name "*.sh" -type f -exec sh -c \
  'head -1 "$1" | grep -qv "^#!/usr/bin/env bash$" && echo "FAIL: $1"' _ {} \; | wc -l
# Expected: 0

# Syntax check all modified scripts
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0, no output
```

---

## 8. Acceptance Criteria

- [ ] Every `.sh` file in `scripts/` has `#!/usr/bin/env bash` as its first line
- [ ] Every `.sh` file in `hackrf_emitter/` and `tests/` has `#!/usr/bin/env bash` as its first line
- [ ] `bash -n` passes on all modified files
- [ ] The missing-shebang file (`scripts/development/start-usrp-service.sh`) has been given a proper shebang

---

## 9. Traceability

| Task  | Deficiency                                      | Standard                  | Files Affected     | Verification Command                                        |
| ----- | ----------------------------------------------- | ------------------------- | ------------------ | ----------------------------------------------------------- |
| 6.4.1 | 201 hardcoded `#!/bin/bash` + 1 missing shebang | NASA/JPL Rule 1 (adapted) | All ~75-80 scripts | `find scripts/ -name "*.sh" -exec head -1 {} \; \| sort -u` |

---

## 10. Execution Order Notes

**Position in critical path:** 2nd (after 6.4.11)

```
6.4.11 (common.sh library) --> 6.4.1 (shebangs) --> 6.4.6 (traps/error audit) --> ...
```

This task fixes the execution entry points first, which is a prerequisite for ShellCheck to produce clean runs (SC2148 for missing shebangs). All subsequent tasks assume correct shebangs are in place.

---

```
END OF TASK DOCUMENT
Task:     6.4.1 - Shebang Standardization
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
