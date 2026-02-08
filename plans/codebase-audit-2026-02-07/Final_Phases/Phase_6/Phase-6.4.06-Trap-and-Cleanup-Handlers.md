# Phase 6.4.06: Trap and Cleanup Handlers

**Document ID**: ARGOS-AUDIT-P6.4.06
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.6
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH (behavioral change -- trap handlers alter exit behavior; audit of false-positive error exits is critical prerequisite for strict mode)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Ensure all scripts that allocate resources (temporary files, background processes, lock files, mount points, or modified system state) register cleanup handlers via `trap` to guarantee resource release on both normal exit and signal-induced termination. Additionally, audit all scripts for commands that return non-zero exit codes under normal operation (e.g., `grep` returning 1 on no match, `diff` returning 1 on differences), and guard them with `|| true` or conditional logic BEFORE strict mode is enabled in Task 6.4.2.

**Current state:**

- 31 of 202 scripts (15.3%) have trap handlers
- 60 scripts use `mktemp` or `/tmp/`, but only 3 register cleanup traps for their temporary files
- 57 mktemp/tmp users lack cleanup traps entirely
- Unknown count of `grep`, `diff`, `cd` commands that will fail under `set -e` (must be audited)

**Target state:** Every resource-allocating script has a `trap cleanup EXIT` handler. Every command that legitimately returns non-zero under normal operation is guarded.

> **CRITICAL ORDERING NOTE:** This task MUST execute BEFORE Task 6.4.2 (Strict Mode Enforcement). Adding `set -euo pipefail` to scripts containing `grep` (returns exit 1 on no match), `diff` (returns exit 1 on differences), or `cd` to possibly-missing directories will cause immediate script termination. The error audit in this task must first identify and fix these false-positive error exits.

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

- **Task 6.4.11 (Shared Library Creation) MUST be complete.** The `make_temp_dir` and `setup_cleanup_trap` functions from `scripts/lib/cleanup.sh` must be available.
- **Task 6.4.1 (Shebang Standardization) MUST be complete.** Shebangs must be correct before trap analysis begins.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                                                   |
| ---------- | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | common.sh library (including cleanup.sh) must exist first                                |
| AFTER      | Upstream   | 6.4.1  | Shebangs must be correct before trap audit begins                                        |
| BEFORE     | Downstream | 6.4.2  | **CRITICAL:** Error audit MUST complete BEFORE strict mode to guard false-positive exits |
| BEFORE     | Downstream | 6.4.4  | Trap handlers affect ShellCheck analysis                                                 |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.6 - trap and cleanup handlers
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any service management script fails to start/stop its target service after modification
- Trap handlers prevent scripts from exiting normally (infinite loop in cleanup function)

---

## 5. Baseline Metrics

| Metric                                       | Count | Percentage |
| -------------------------------------------- | ----- | ---------- |
| Scripts with trap handlers                   | 31    | 15.3%      |
| Scripts using `mktemp` or `/tmp/`            | 60    | 29.7%      |
| `mktemp`/`/tmp/` users WITH cleanup traps    | 3     | 5.0%       |
| `mktemp`/`/tmp/` users WITHOUT cleanup traps | 57    | 95.0%      |

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Scripts with trap handlers
grep -rl "trap " scripts/ --include="*.sh" | wc -l
# Result: 31

# Scripts using mktemp or /tmp/
find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|/tmp/" {} \; | wc -l
# Result: 60

# mktemp users without trap
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|TMPDIR" {} \;); do
    grep -q "trap " "$f" || echo "$f"
done | wc -l
# Result: 57
```

---

## 6. Task Details

### Part A: False-Positive Error Exit Audit

This audit MUST complete before Task 6.4.2 (strict mode) adds `set -e` to scripts.

**Commands that legitimately return non-zero under normal operation:**

| Command | Non-Zero Return | Guard Pattern                                  |
| ------- | --------------- | ---------------------------------------------- |
| `grep`  | 1 = no match    | `grep pattern file \|\| true`                  |
| `diff`  | 1 = differences | `diff file1 file2 \|\| true`                   |
| `cd`    | 1 = no such dir | `cd /path \|\| { log_error "..."; exit 1; }`   |
| `kill`  | 1 = no process  | `kill "$PID" 2>/dev/null \|\| true`            |
| `rm`    | 1 = no file     | `rm -f "$file"` (already silent on missing)    |
| `test`  | 1 = false       | Used in `if` or `[[ ]]` context (already safe) |

**Detection:**

```bash
# grep used outside of if/while/|| context (vulnerable to set -e)
grep -rn 'grep ' scripts/ --include="*.sh" | grep -v '^\s*#' | \
  grep -v 'if \|while \||| \|&& \|grep -q\|grep -c\|grep -l' | head -20

# diff used outside of if/|| context
grep -rn 'diff ' scripts/ --include="*.sh" | grep -v '^\s*#' | \
  grep -v 'if \||| \|&& ' | head -10

# cd without error handling
grep -rn 'cd ' scripts/ --include="*.sh" | grep -v '^\s*#' | \
  grep -v '|| \|if \|safe_cd\|cd "\$(' | head -20
```

**Remediation pattern for grep:**

```bash
# Before (will fail under set -e when no match):
RESULT=$(grep "pattern" file)
grep -q "pattern" file
COUNT=$(grep -c "pattern" file)

# After (safe under set -e):
RESULT=$(grep "pattern" file || true)
grep -q "pattern" file || true
COUNT=$(grep -c "pattern" file || echo "0")

# Or use conditional:
if grep -q "pattern" file; then
    RESULT=$(grep "pattern" file)
fi
```

### Part B: Trap and Cleanup Handlers

#### Required Trap Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

# Temporary file management
TMPDIR_WORK=""
cleanup() {
    local exit_code=$?
    # Remove temporary files
    if [[ -n "${TMPDIR_WORK}" && -d "${TMPDIR_WORK}" ]]; then
        rm -rf "${TMPDIR_WORK}"
    fi
    # Kill background processes started by this script
    # (only if this script starts background processes)
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
    exit "${exit_code}"
}
trap cleanup EXIT

# Create temp directory AFTER trap registration
TMPDIR_WORK=$(mktemp -d "${TMPDIR:-/tmp}/argos-XXXXXX")
```

#### Signal Handling Requirements

| Signal       | Trap Action          | Rationale                                             |
| ------------ | -------------------- | ----------------------------------------------------- |
| EXIT         | Run cleanup function | Covers normal exit and all caught signals             |
| INT (Ctrl-C) | (Caught by EXIT)     | User interrupt                                        |
| TERM         | (Caught by EXIT)     | systemd stop signal                                   |
| HUP          | (Caught by EXIT)     | Terminal hangup                                       |
| PIPE         | Ignore or handle     | Prevent broken pipe from killing long-running scripts |

**Implementation note:** Trapping EXIT is sufficient because bash executes EXIT traps when the shell receives INT, TERM, or HUP (after executing any specific trap for those signals). Therefore, a single `trap cleanup EXIT` handles all cases. Separate INT/TERM traps are only needed if the script must perform signal-specific actions (e.g., printing a different message).

#### Categories of Scripts Requiring Traps

**Category A: Temporary file creators (60 scripts)**

```bash
# Detection
find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|/tmp/" {} \;
# Required: cleanup() removes temp files
```

**Category B: Background process starters (service management scripts)**

```bash
# Detection
grep -rl "& *$\|nohup\|disown" scripts/ --include="*.sh"
# Required: cleanup() kills child processes
```

**Category C: Lock file users**

```bash
# Detection
grep -rl "\.lock\|\.pid\|flock" scripts/ --include="*.sh"
# Required: cleanup() removes lock/pid files
```

**Category D: System state modifiers (install/setup scripts)**

```bash
# Detection
grep -rl "sysctl\|modprobe\|ip link\|iptables" scripts/ --include="*.sh"
# Required: cleanup() logs that partial modification may have occurred
# (full rollback is not always safe; logging enables manual recovery)
```

### Before/After Example

**Before (`scripts/argos-cpu-protector.sh`, 303 lines, uses mktemp):**

```bash
#!/bin/bash

LOG_FILE=$(mktemp /tmp/cpu-protector-XXXXXX.log)
# ... 300 lines of logic ...
rm -f "$LOG_FILE"  # Only reached on success path
```

**After:**

```bash
#!/usr/bin/env bash
set -euo pipefail
# -------------------------------------------------------------------
# Script:        argos-cpu-protector.sh
# Purpose:       Monitor and limit CPU-intensive processes to prevent thermal throttle
# Usage:         sudo ./argos-cpu-protector.sh [--threshold <percent>]
# Prerequisites: root privileges, /proc/stat access
# Exit Codes:    0=success, 1=error, 2=usage, 3=missing dependency
# -------------------------------------------------------------------

LOG_FILE=""
cleanup() {
    local exit_code=$?
    if [[ -n "${LOG_FILE}" && -f "${LOG_FILE}" ]]; then
        rm -f "${LOG_FILE}"
    fi
    exit "${exit_code}"
}
trap cleanup EXIT

LOG_FILE=$(mktemp /tmp/cpu-protector-XXXXXX.log)
# ... 300 lines of logic ...
# No explicit rm needed; cleanup() handles it
```

---

## 7. Verification Commands

```bash
# All scripts that use mktemp or /tmp/ must have a trap
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "mktemp\|TMPDIR" {} \;); do
    grep -q "trap " "$f" || echo "MISSING TRAP: $f"
done
# Expected: no output

# All trap handlers must reference EXIT
grep -r "^trap " scripts/ --include="*.sh" | grep -v "EXIT" | grep -v "cleanup EXIT"
# Expected: no output (all traps must include EXIT)

# All cleanup functions preserve exit code
for f in $(grep -rl "cleanup()" scripts/ --include="*.sh"); do
    grep -A1 "cleanup()" "$f" | grep -q 'exit_code=\$?' || echo "NO EXIT_CODE PRESERVE: $f"
done
# Expected: no output

# All mktemp calls occur AFTER trap registration
for f in $(find scripts/ -name "*.sh" -type f -exec grep -l "mktemp" {} \;); do
    TRAP_LINE=$(grep -n "trap " "$f" | head -1 | cut -d: -f1)
    MKTEMP_LINE=$(grep -n "mktemp" "$f" | head -1 | cut -d: -f1)
    if [[ -n "${TRAP_LINE}" && -n "${MKTEMP_LINE}" ]] && [[ "${MKTEMP_LINE}" -lt "${TRAP_LINE}" ]]; then
        echo "MKTEMP BEFORE TRAP: $f (mktemp:${MKTEMP_LINE} trap:${TRAP_LINE})"
    fi
done
# Expected: no output

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] Every script that creates temporary files has a `trap cleanup EXIT` handler
- [ ] Every script that starts background processes has a trap that kills child processes
- [ ] Every `mktemp` call occurs AFTER the trap registration (not before)
- [ ] Cleanup functions preserve the original exit code (`local exit_code=$?` on first line)
- [ ] No script relies on end-of-file `rm` commands for cleanup (dead code if script exits early)
- [ ] All `grep` commands used outside `if`/`while`/`||` context are guarded with `|| true`
- [ ] All `diff` commands used outside conditional context are guarded with `|| true`
- [ ] All bare `cd` commands are guarded with `|| exit 1` or replaced with `safe_cd`
- [ ] `bash -n` passes on all modified files

---

## 9. Traceability

| Task  | Deficiency                            | Standard              | Files Affected       | Verification Command        |
| ----- | ------------------------------------- | --------------------- | -------------------- | --------------------------- |
| 6.4.6 | 57 mktemp users without cleanup traps | CERT MEM-01 (adapted) | 60 temp-file scripts | See Task 6.4.6 verification |

---

## 10. Execution Order Notes

**Position in critical path:** 3rd (after 6.4.11, 6.4.1)

```
6.4.11 (common.sh library) --> 6.4.1 (shebangs) --> 6.4.6 (traps/error audit) --> 6.4.2 (strict mode) --> ...
```

> **WARNING**: The original ordering placed 6.4.2 (strict mode) and 6.4.6 (traps/error audit) as parallel. This is INCORRECT and will cause cascading breakage. `set -euo pipefail` added to scripts containing `grep` (exit 1 on no match), `diff` (exit 1 on differences), or `cd` to potentially-missing directories will cause immediate termination. Task 6.4.6 must audit and guard these patterns FIRST.

This task has two distinct parts:

1. **Part A (Error Audit):** Must complete BEFORE 6.4.2. Finds and guards all false-positive error exits.
2. **Part B (Trap Handlers):** Can technically run in parallel with 6.4.2, but is cleaner to complete first.

Both parts are combined in a single commit for atomicity.

---

```
END OF TASK DOCUMENT
Task:     6.4.6 - Trap and Cleanup Handlers
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
