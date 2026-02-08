# Phase 6.4.11: Shared Library Creation

**Document ID**: ARGOS-AUDIT-P6.4.11
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.11
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM (foundational -- all subsequent tasks depend on this; incorrect implementation blocks the entire Phase 6.4 chain)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Create `scripts/lib/common.sh` as the single shared library sourced by all scripts. This eliminates the 49 separate color definitions, 5+ separate logging function sets, and duplicated utility patterns across the script corpus.

The library is decomposed into four focused modules following the Single Responsibility Principle, plus a convenience wrapper that sources all four:

| Module                   | Responsibility                                    | Exported Functions                                                                                               | Approx. Lines |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| `scripts/lib/log.sh`     | Logging, color detection, log-level filtering     | `_log`, `log_debug`, `log_info`, `log_warn`, `log_error`, `log_fatal`                                            | ~80           |
| `scripts/lib/args.sh`    | Argument parsing, `--help`/`--dry-run` generation | `parse_common_args`, `show_usage`, `require_arg`, `run_cmd`                                                      | ~70           |
| `scripts/lib/cleanup.sh` | Trap handlers, temp dir management, lock files    | `setup_cleanup_trap`, `make_temp_dir`, `acquire_lock`                                                            | ~60           |
| `scripts/lib/paths.sh`   | Path resolution, dependency/file/dir checks       | `detect_project_root`, `detect_lib_dir`, `require_cmd`, `require_root`, `require_file`, `require_dir`, `safe_cd` | ~80           |

**Current state:** 49 scripts define their own color variables. 5+ scripts define their own logging functions. Zero scripts use a shared library.

**Target state:** All scripts source `common.sh`. Zero per-script color definitions. Zero per-script logging functions. Zero per-script exit code constants.

> **CRITICAL:** This is the FIRST task in the Phase 6.4 execution chain. All other tasks depend on the shared library being available.

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

- None beyond general Phase 6.4 prerequisites. **This is the FIRST task in the execution chain.**

---

## 3. Dependencies

| Dependency | Direction  | Task       | Reason                                                                   |
| ---------- | ---------- | ---------- | ------------------------------------------------------------------------ |
| BEFORE     | Downstream | ALL others | Every task in Phase 6.4 depends on the shared library being available    |
| BEFORE     | Downstream | 6.4.1      | Shebangs are standardized after library is created                       |
| BEFORE     | Downstream | 6.4.9      | Logging standardization uses `log_info`, `log_error` from this library   |
| BEFORE     | Downstream | 6.4.10     | Exit code conventions use `EXIT_SUCCESS`, `EXIT_ERROR` from this library |
| BEFORE     | Downstream | 6.4.7      | Help/dry-run uses `run_cmd` from this library                            |

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
refactor(scripts): Phase 6.4.11 - create shared library (common.sh)
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any library module
- `shellcheck --severity=warning` fails on any library module
- Double-sourcing causes errors (guard variable failure)
- Sourcing `common.sh` in Docker container fails due to path resolution

---

## 5. Baseline Metrics

| Metric                               | Count |
| ------------------------------------ | ----- |
| Per-script color definitions         | 49    |
| Per-script logging function defs     | ~5    |
| Scripts sourcing a shared library    | 0     |
| Shared library files in scripts/lib/ | 0     |

---

## 6. Task Details

### 6.1: Convenience Wrapper -- `scripts/lib/common.sh`

```bash
#!/usr/bin/env bash
# -------------------------------------------------------------------
# Script:        lib/common.sh
# Purpose:       Convenience wrapper that sources all Argos shared library modules
# Usage:         source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# Prerequisites: bash 4.4+
# Exit Codes:    N/A (library, not standalone)
# -------------------------------------------------------------------

# Guard against double-sourcing
if [[ -n "${_ARGOS_COMMON_LOADED:-}" ]]; then
    return 0
fi
readonly _ARGOS_COMMON_LOADED=1

# Resolve lib directory
_ARGOS_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Exit code constants (available to all modules)
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_USAGE=2
readonly EXIT_MISSING_DEP=3
readonly EXIT_CONFIG=4
readonly EXIT_PARTIAL=5

# Source all modules in dependency order
source "${_ARGOS_LIB_DIR}/log.sh"
source "${_ARGOS_LIB_DIR}/paths.sh"
source "${_ARGOS_LIB_DIR}/cleanup.sh"
source "${_ARGOS_LIB_DIR}/args.sh"
```

**Each module MUST have its own double-source guard** (e.g., `_ARGOS_LOG_LOADED`), so that a script can safely do both `source lib/log.sh` and `source lib/common.sh` without conflict.

### 6.2: Logging Module -- `scripts/lib/log.sh`

Provides: `_log`, `log_debug`, `log_info`, `log_warn`, `log_error`, `log_fatal`

Key features:

- Terminal-aware color detection (`[[ -t 2 ]]`)
- ISO 8601 UTC timestamps
- Log level filtering via `ARGOS_LOG_LEVEL` environment variable
- All output to stderr (stdout reserved for machine-readable data)

### 6.3: Paths Module -- `scripts/lib/paths.sh`

Provides: `detect_project_root`, `detect_lib_dir`, `require_cmd`, `require_root`, `require_file`, `require_dir`, `safe_cd`

Key features:

- Project root detection via `package.json` + `src/` directory traversal
- Dependency checking with helpful error messages
- `safe_cd` replaces bare `cd` with error handling

### 6.4: Cleanup Module -- `scripts/lib/cleanup.sh`

Provides: `setup_cleanup_trap`, `make_temp_dir`, `acquire_lock`

Key features:

- `make_temp_dir` creates temp directories and auto-registers cleanup on EXIT
- Cleanup functions preserve original exit code (`local exit_code=$?`)
- Lock file acquisition with stale lock detection

### 6.5: Args Module -- `scripts/lib/args.sh`

Provides: `parse_common_args`, `show_usage`, `require_arg`, `run_cmd`

Key features:

- `run_cmd` respects `DRY_RUN` environment variable
- Common argument parsing for `--help`, `--dry-run`, `--verbose`
- Idempotent system config helpers (`write_sysctl_conf`, `write_limits_conf`)

### Source Pattern for Scripts in `scripts/`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
```

### Source Pattern for Scripts in `scripts/subdirectory/`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"
```

### Full common.sh Implementation Reference

The complete implementation of `common.sh` and its modules is specified in the parent document (Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md), Section "Task 6.4.11: Shared Library Creation". The code spans approximately 250 lines and includes:

- Exit code constants (6 values: 0-5)
- Color support with terminal detection
- Log level filtering with 5 levels
- Path detection (project root, lib directory)
- Dependency checking (`require_cmd`, `require_root`, `require_file`, `require_dir`)
- Dry-run support (`run_cmd`)
- Idempotent config writers (`write_sysctl_conf`, `write_limits_conf`)
- Safe operations (`safe_cd`, `make_temp_dir`)

---

## 7. Verification Commands

```bash
# All 4 modules + common.sh exist
for f in log.sh args.sh cleanup.sh paths.sh common.sh; do
    test -f "scripts/lib/${f}" || echo "MISSING: scripts/lib/${f}"
done
# Expected: no output

# Each module passes bash -n independently
for f in scripts/lib/*.sh; do
    bash -n "${f}" || echo "SYNTAX ERROR: ${f}"
done
# Expected: no output

# Each module passes shellcheck independently
for f in scripts/lib/*.sh; do
    shellcheck --severity=warning "${f}" || echo "SC FAIL: ${f}"
done
# Expected: no output

# common.sh loads all modules (functional test)
bash -c 'source scripts/lib/common.sh; log_info "test"; require_cmd bash; echo OK' 2>/dev/null
# Expected: OK

# common.sh passes shellcheck
shellcheck --severity=warning scripts/lib/common.sh
# Expected: no output

# All scripts source common.sh (post-migration)
MISSING=$(find scripts/ -name "*.sh" -type f -not -path "*/lib/*" -exec sh -c \
  'grep -q "common.sh" "$1" || echo "$1"' _ {} \;)
echo "${MISSING}" | grep -c "."
# Expected: 0

# Double-source guard works
bash -c 'source scripts/lib/common.sh; source scripts/lib/common.sh; echo OK'
# Expected: OK (no errors)

# Logging functions are available after sourcing
bash -c 'source scripts/lib/common.sh; log_info "test message"' 2>&1 | grep -q "INFO"
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] `scripts/lib/common.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] `scripts/lib/log.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] `scripts/lib/args.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] `scripts/lib/cleanup.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] `scripts/lib/paths.sh` exists and passes `bash -n` and `shellcheck --severity=warning`
- [ ] All scripts (except library modules) source `common.sh`
- [ ] Double-sourcing is safe (guard variable prevents re-execution)
- [ ] `log_info`, `log_warn`, `log_error`, `log_fatal` functions are available in all scripts
- [ ] `require_cmd`, `require_root`, `require_file` functions are available
- [ ] `run_cmd` respects `DRY_RUN` environment variable
- [ ] `safe_cd` replaces bare `cd` in all scripts
- [ ] `make_temp_dir` auto-registers cleanup traps
- [ ] Exit code constants are available in all scripts
- [ ] No script defines its own color variables, logging functions, or exit code constants

---

## 9. Traceability

| Task   | Deficiency                                           | Standard      | Files Affected               | Verification Command                                                |
| ------ | ---------------------------------------------------- | ------------- | ---------------------------- | ------------------------------------------------------------------- |
| 6.4.11 | 49 duplicate color definitions, 5+ log function sets | DRY principle | New: `scripts/lib/common.sh` | `bash -n scripts/lib/common.sh && shellcheck scripts/lib/common.sh` |

---

## 10. Execution Order Notes

**Position in critical path:** 1st (MUST be first)

```
6.4.11 (common.sh library) --> 6.4.1 (shebangs) --> 6.4.6 (traps/error audit) --> 6.4.2 (strict mode) --> ...
```

This is the foundational task. Every other task in Phase 6.4 depends on the shared library. The library must be created and validated before any other task begins.

**Risk mitigation:** Because this creates new files (does not modify existing scripts), rollback is trivial: delete `scripts/lib/`. The higher risk is in subsequent tasks that modify existing scripts to source this library. The library creation itself is low-risk; the migration (updating all scripts to source it) is tracked as part of each subsequent task.

**Docker compatibility note:** The source pattern uses `${BASH_SOURCE[0]}` relative path detection, not hardcoded paths. This ensures the library works both on the host (`/home/kali/Documents/Argos/Argos/scripts/lib/common.sh`) and inside the Docker container (`/app/scripts/lib/common.sh`).

---

```
END OF TASK DOCUMENT
Task:     6.4.11 - Shared Library Creation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
