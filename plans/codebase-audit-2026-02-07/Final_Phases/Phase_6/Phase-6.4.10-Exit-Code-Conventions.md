# Phase 6.4.10: Exit Code Conventions

**Document ID**: ARGOS-AUDIT-P6.4.10
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.10
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (behavioral change limited to exit codes -- callers that check specific codes may need updates)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Establish and enforce a consistent exit code scheme across all shell scripts. This enables calling scripts (including systemd, cron, CI pipelines, and parent shell scripts) to programmatically determine the outcome of script execution.

**Current state:**

- 114 scripts (56.4%) use explicit exit codes
- 2 scripts use non-standard exit codes (codes >= 6)
- Unknown count of bare `exit` statements (no explicit code -- inherits last command's exit code, which is unreliable)

**Target state:** All scripts use exit codes 0-5 exclusively (or variable references to named constants). Zero bare `exit` statements. All dependency checks use code 3. All usage errors use code 2. All `--help` exits with code 0.

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

- **Task 6.4.11 (Shared Library Creation) MUST be complete.** Exit code constants (`EXIT_SUCCESS`, `EXIT_ERROR`, etc.) must be defined in `common.sh`.
- **Task 6.4.9 (Logging Standardization) MUST be complete.** Exit code changes reference `log_error` for error messages before exit.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                         |
| ---------- | ---------- | ------ | -------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | Exit code constants must be defined in common.sh               |
| AFTER      | Upstream   | 6.4.9  | Logging functions must be available for error messages         |
| BEFORE     | Downstream | 6.4.13 | Security remediation depends on consistent exit code semantics |
| BEFORE     | Downstream | 6.4.12 | CI validates exit codes                                        |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.10 - exit code conventions
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- systemd service files that check specific exit codes break (e.g., `SuccessExitStatus=`)
- Parent scripts that check `$?` for specific values break
- Any script exits with a code outside the 0-5 range

---

## 5. Baseline Metrics

| Metric                                     | Count | Percentage |
| ------------------------------------------ | ----- | ---------- |
| Scripts with explicit exit codes           | 114   | 56.4%      |
| Scripts with non-standard exit codes (>=6) | 2     | 1.0%       |
| Bare `exit` statements (no explicit code)  | TBD   | TBD        |

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Exit code distribution
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  awk -F'exit ' '{print $2}' | sort | uniq -c | sort -rn

# Bare exit statements
grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh" | wc -l
```

---

## 6. Task Details

### Exit Code Table

| Code | Constant         | Meaning             | When to Use                                                                        |
| ---- | ---------------- | ------------------- | ---------------------------------------------------------------------------------- |
| 0    | EXIT_SUCCESS     | Success             | Script completed all operations successfully                                       |
| 1    | EXIT_ERROR       | General error       | Unrecoverable runtime error (hardware failure, network timeout, permission denied) |
| 2    | EXIT_USAGE       | Usage error         | Invalid arguments, missing required flags, malformed input                         |
| 3    | EXIT_MISSING_DEP | Missing dependency  | Required tool, package, service, or hardware not available                         |
| 4    | EXIT_CONFIG      | Configuration error | Invalid config file, conflicting settings, missing env var                         |
| 5    | EXIT_PARTIAL     | Partial success     | Some operations succeeded, others failed (batch scripts only)                      |

**Reserved ranges (do not use):**

- 64-78: BSD sysexits.h (EX_USAGE=64, EX_NOHOST=68, etc.) -- conflict risk
- 126: Command not executable
- 127: Command not found
- 128+N: Killed by signal N (e.g., 130 = SIGINT, 137 = SIGKILL, 143 = SIGTERM)

### Implementation Pattern

```bash
# Exit code constants are defined in scripts/lib/common.sh:
# readonly EXIT_SUCCESS=0
# readonly EXIT_ERROR=1
# readonly EXIT_USAGE=2
# readonly EXIT_MISSING_DEP=3
# readonly EXIT_CONFIG=4
# readonly EXIT_PARTIAL=5

# Dependency check example:
require_cmd() {
    local cmd
    for cmd in "$@"; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            log_error "Required command not found: ${cmd}"
            exit "${EXIT_MISSING_DEP}"
        fi
    done
}

# Usage:
require_cmd docker shellcheck jq
```

### Before/After Example

**Before:**

```bash
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running"
    exit 1  # Is this a usage error? Missing dependency? General error?
fi
```

**After:**

```bash
if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker is not installed"
    exit "${EXIT_MISSING_DEP}"  # Code 3: clearly a missing dependency
fi

if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    exit "${EXIT_ERROR}"  # Code 1: Docker exists but service is down
fi
```

### Transformation Rules

| Current Pattern                           | New Pattern                                 | Rationale                             |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------- |
| `exit 1` after "not found" message        | `exit "${EXIT_MISSING_DEP}"`                | Dependency missing, not general error |
| `exit 1` after "invalid argument" message | `exit "${EXIT_USAGE}"`                      | Usage error, not general error        |
| `exit 1` after "config file missing"      | `exit "${EXIT_CONFIG}"`                     | Configuration error                   |
| Bare `exit` (no code)                     | `exit "${EXIT_ERROR}"` or `exit 0`          | Must be explicit                      |
| `exit 0` in `--help` handler              | `exit "${EXIT_SUCCESS}"` (or keep `exit 0`) | Already correct                       |
| `exit 127` or `exit 255`                  | `exit "${EXIT_ERROR}"`                      | Non-standard codes not allowed        |

### Detection

```bash
# Find all exit statements and their codes
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  awk -F'exit ' '{print $2}' | sort | uniq -c | sort -rn

# Find bare 'exit' without code (inherits last command's exit code -- unreliable)
grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh"

# Find non-standard exit codes (outside 0-5)
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  grep -vP "exit [0-5]$|exit \"\$|exit \$"
```

---

## 7. Verification Commands

```bash
# No bare 'exit' without explicit code
grep -rn "^[[:space:]]*exit$" scripts/ --include="*.sh" | wc -l
# Expected: 0

# No exit codes outside the defined range (0-5)
grep -rn "exit [0-9]" scripts/ --include="*.sh" | \
  grep -vP "exit [0-5]$|exit \"\$|exit \$" | wc -l
# Expected: 0 (all explicit exit codes are 0-5 or variable references)

# All scripts use named constants (not numeric literals) -- recommended but not required
grep -rn 'exit [1-5]$' scripts/ --include="*.sh" | wc -l
# Note: numeric literals are acceptable; named constants are preferred

# All --help handlers exit with 0
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "\-\-help" {} \;); do
    bash "$f" --help >/dev/null 2>&1
    RC=$?
    [ "$RC" -ne 0 ] && echo "FAIL: $f --help returned $RC (expected 0)"
done
# Expected: no output

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] Exit code constants defined in `scripts/lib/common.sh`
- [ ] No bare `exit` statements (all have explicit codes)
- [ ] No exit codes outside the 0-5 range (excluding signal-derived codes and variable references)
- [ ] All dependency checks use `exit 3` (`EXIT_MISSING_DEP`)
- [ ] All usage/argument errors use `exit 2` (`EXIT_USAGE`)
- [ ] All configuration errors use `exit 4` (`EXIT_CONFIG`)
- [ ] `--help` always exits with code 0

---

## 9. Traceability

| Task   | Deficiency                            | Standard                   | Files Affected     | Verification Command                                                        |
| ------ | ------------------------------------- | -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| 6.4.10 | 2 scripts use non-standard exit codes | POSIX exit code convention | All ~75-80 scripts | `grep -rn "exit [6-9]\|exit [1-9][0-9]" scripts/ --include="*.sh" \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 11th (after 6.4.9, before 6.4.13)

```
... --> 6.4.9 (logging) --> 6.4.10 (exit codes) --> 6.4.13 (security) --> 6.4.12 (CI)
```

This task depends on Task 6.4.11 (which defines the exit code constants) and Task 6.4.9 (which provides the logging functions used in error messages before exit). It must complete before Task 6.4.13 (security remediation) which depends on consistent exit code semantics, and before Task 6.4.12 (CI) which validates exit codes.

This is a low-risk task. The primary concern is parent scripts or systemd service files that check for specific exit codes. Audit all `SuccessExitStatus=`, `RestartPreventExitStatus=`, and `$?` checks in calling scripts before changing exit codes.

---

```
END OF TASK DOCUMENT
Task:     6.4.10 - Exit Code Conventions
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
