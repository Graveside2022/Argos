# Phase 6.4.04: ShellCheck Compliance

**Document ID**: ARGOS-AUDIT-P6.4.04
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.4
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM (behavioral change -- fixes may alter script logic where ShellCheck flags real bugs)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Bring all shell scripts to zero ShellCheck findings at `--severity=warning` level (error + warning). This eliminates 342 findings (6 errors + 336 warnings) across 84 files. An additional 425 findings at info and style severity (402 info + 23 style) are addressed where they overlap with security or correctness concerns, but are not required for the phase gate.

**Current state (baseline at commit `b682267`):**

| Severity  | Files Affected | Total Findings |
| --------- | -------------- | -------------- |
| error     | 5              | 6              |
| warning   | 84             | 336            |
| info      | --             | 402            |
| style     | --             | 23             |
| **TOTAL** | **--**         | **767**        |

**Top ShellCheck violations by frequency:**

| Rank  | Code       | Count   | Description                                                     | Security Impact                                     | Fix Pattern                                               |
| ----- | ---------- | ------- | --------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- | --------------------------------- | --------- | --- | ------- |
| **1** | **SC2086** | **220** | **Double-quote to prevent globbing/word splitting**             | **HIGH -- injection vector via unquoted variables** | Quote: `"${VAR}"`, `"$(cmd)"`                             |
| 2     | SC2155     | 149     | Declare and assign separately to avoid masking return values    | MEDIUM -- masked error codes                        | Split: `local var; var=$(cmd)`                            |
| 3     | SC2024     | 73      | `sudo` doesn't affect redirects; use `tee`                      | LOW -- incorrect privilege application              | `sudo bash -c 'cmd                                        | other'` or restructure            |
| 4     | SC2329     | 58      | Unused function (dead code)                                     | LOW -- code bloat                                   | Remove, or add `# shellcheck disable=SC2329` with comment |
| 5     | SC2164     | 38      | Use `cd ...                                                     |                                                     | exit`in case`cd` fails                                    | MEDIUM -- silent directory errors | `cd /path |     | exit 1` |
| 6     | SC2034     | 31      | Variable appears unused (verify intentional before suppressing) | LOW -- dead code                                    | Remove, or add `# shellcheck disable=SC2034` with comment |
| 7     | SC2046     | 22      | Quote this to prevent word splitting                            | MEDIUM -- injection risk                            | Quote: `"$(cmd)"`                                         |
| 8     | SC2206     | 14      | Quote to prevent word splitting/globbing in array assignment    | LOW -- data corruption                              | `mapfile -t arr < <(cmd)`                                 |

> **NOTE:** SC2086 (unquoted variables, 220 instances) is the MOST DANGEROUS shell scripting vulnerability -- it enables word splitting and glob injection. This must be the #1 remediation priority, not SC2155.

**Target state:** Zero findings at `--severity=warning`. All suppressions justified with inline comments.

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

- **Task 6.4.1 (Shebang Standardization) MUST be complete.** SC2148 (missing shebang) is an error-level finding that must be resolved first.
- **Task 6.4.6 (Trap and Cleanup Handlers) MUST be complete.** Trap audit guards false-positive error exits before strict mode.
- **Task 6.4.2 (Strict Mode Enforcement) MUST be complete.** Strict mode on line 2 affects how ShellCheck analyzes unset variable references and pipefail.
- **Task 6.4.3 (Header Block Standardization) MUST be complete.** Header comments are benign to ShellCheck but must be in place before this task runs to avoid re-scanning.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                                   |
| ---------- | ---------- | ------ | ------------------------------------------------------------------------ | ----------------------------------- |
| AFTER      | Upstream   | 6.4.11 | common.sh library must exist first                                       |
| AFTER      | Upstream   | 6.4.1  | Shebang correctness eliminates SC2148                                    |
| AFTER      | Upstream   | 6.4.6  | Trap/error audit guards false-positive exits before strict mode          |
| AFTER      | Upstream   | 6.4.2  | Strict mode affects ShellCheck analysis (SC2086 interacts with `set -u`) |
| AFTER      | Upstream   | 6.4.3  | Headers are in place before ShellCheck run to avoid rescan               |
| BEFORE     | Downstream | 6.4.5  | SC2086 quoting is part of both tasks; ShellCheck compliance comes first  |
| BEFORE     | Downstream | 6.4.13 | Security-critical patterns (eval, curl                                   | bash) overlap with ShellCheck scope |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.4 - ShellCheck compliance
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any service management script fails to start/stop its target service after modification
- Any script that previously ran successfully now exits non-zero in its normal execution path

---

## 5. Baseline Metrics

All metrics captured on 2026-02-08 against commit `b682267` on the `dev_branch` branch.

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Full ShellCheck audit at warning level
find scripts/ -name "*.sh" -type f -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null | wc -l
# Result: 342

# Breakdown by severity
find scripts/ -name "*.sh" -type f -exec shellcheck -f gcc {} \; 2>/dev/null | \
  grep -oP '(error|warning|info|style)' | sort | uniq -c | sort -rn
# Result: error=6, warning=336, info=402, style=23

# Files with error-severity findings
find scripts/ -name "*.sh" -type f -exec sh -c \
  'count=$(shellcheck --severity=error -f gcc "$1" 2>/dev/null | wc -l); \
   [ "$count" -gt 0 ] && echo "$count $1"' _ {} \; | wc -l
# Result: 5

# Top SC codes by frequency
find scripts/ -name "*.sh" -type f -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null | \
  grep -oP 'SC\d+' | sort | uniq -c | sort -rn | head -10
```

---

## 6. Task Details

### Scope

All `.sh` files under `scripts/` and `scripts/lib/`. After Phase 6.2 consolidation, this is approximately 75-80 scripts.

### Selective Suppression Policy

Directive `# shellcheck disable=SCNNNN` MAY be used ONLY when:

1. The finding is a verified false positive (document WHY in the suppression comment).
2. The finding is SC2034 (unused variable) where the variable is intentionally exported or sourced by another script.
3. The fix would require a fundamental architectural change outside the scope of this phase.

Every suppression MUST include a justifying comment on the preceding line:

```bash
# shellcheck disable=SC2034 -- ARGOS_VERSION exported for child processes
ARGOS_VERSION="3.0.0"
```

Suppressions without justifying comments are non-compliant.

**CRITICAL: No `# shellcheck disable=SC2086` (variable quoting) -- these MUST be fixed, not suppressed.**

### SC2155 Remediation Pattern (149 instances)

**Before:**

```bash
local SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
```

**After:**

```bash
local SCRIPT_DIR
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
```

**Rationale:** When `local` and assignment are combined, the exit code of the command substitution is masked by the exit code of `local` (always 0). Under `set -e`, a failing command substitution goes undetected.

### SC2164 Remediation Pattern (38 instances)

**Before:**

```bash
cd /usr/src/gsmevil2
```

**After:**

```bash
cd /usr/src/gsmevil2 || { echo "ERROR: Cannot cd to /usr/src/gsmevil2" >&2; exit 1; }
```

Or, using the `safe_cd` function from `common.sh`:

```bash
safe_cd /usr/src/gsmevil2
```

### SC2046 Remediation Pattern (22 instances)

**Before:**

```bash
docker rm $(docker ps -aq)
```

**After:**

```bash
docker rm "$(docker ps -aq)"
```

Or, when the expansion intentionally produces multiple arguments:

```bash
# shellcheck disable=SC2046 -- intentional word splitting for multiple container IDs
docker rm $(docker ps -aq)
```

### SC2024 Remediation Pattern (73 instances)

**Before:**

```bash
sudo echo "content" > /etc/file
```

**After:**

```bash
echo "content" | sudo tee /etc/file > /dev/null
```

### SC2206 Remediation Pattern (14 instances)

**Before:**

```bash
ARRAY=($(some_command))
```

**After:**

```bash
mapfile -t ARRAY < <(some_command)
```

### Security-Critical Patterns Not Covered by ShellCheck

ShellCheck's static analysis does not detect the following dangerous patterns that require manual audit:

| Pattern                         | Risk                          | Detection Command                                             | CERT/NASA Reference |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------- | ------------------- |
| `eval "$var"`                   | Arbitrary code execution      | `grep -rn 'eval ' scripts/*.sh`                               | CERT STR02-C        |
| Backtick with unvalidated input | Command injection             | `grep -rn '\`._\$' scripts/_.sh`                              | CERT STR02-C        |
| `rm -rf $UNQUOTED`              | Directory traversal deletion  | `grep -rn 'rm -rf \$' scripts/*.sh` (note: no quotes after $) | NASA/JPL Rule 1     |
| `curl \| sh` or `wget \| sh`    | Supply chain attack           | `grep -rn 'curl.*\|.*sh\|wget.*\|.*sh' scripts/*.sh`          | CERT MSC33-C        |
| `chmod 777`                     | World-writable files          | `grep -rn 'chmod 777' scripts/*.sh`                           | CERT FIO06-C        |
| `sudo` without full path        | PATH hijacking                | `grep -rn 'sudo [^/]' scripts/*.sh`                           | CERT ENV03-C        |
| `while true` without watchdog   | Infinite resource consumption | `grep -rn 'while true\|while :' scripts/*.sh`                 | NASA/JPL Rule 2     |

These patterns are addressed in Task 6.4.13 (Security-Critical Pattern Remediation). They are listed here for awareness during ShellCheck remediation.

### Detection

```bash
# Full ShellCheck audit at warning level
find scripts/ -name "*.sh" -type f -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null

# Per-file finding count (sorted by most violations)
find scripts/ -name "*.sh" -type f -exec sh -c \
  'count=$(shellcheck --severity=warning -f gcc "$1" 2>/dev/null | wc -l); \
   [ "$count" -gt 0 ] && echo "$count $1"' _ {} \; | sort -rn
```

### Transformation Strategy

Process files in order of violation count (highest first) to maximize impact per commit review cycle:

1. **SC2086 (220 instances):** Quote all variable expansions. This is the highest-priority fix. See Task 6.4.5 for full details.
2. **SC2155 (149 instances):** Split `local var=$(cmd)` into `local var; var=$(cmd)`.
3. **SC2024 (73 instances):** Replace `sudo cmd > file` with `cmd | sudo tee file`.
4. **SC2329 (58 instances):** Remove unused functions or add justified suppressions.
5. **SC2164 (38 instances):** Add `|| exit 1` to all bare `cd` commands, or use `safe_cd`.
6. **SC2034 (31 instances):** Remove unused variables or add justified suppressions.
7. **SC2046 (22 instances):** Quote command substitutions.
8. **SC2206 (14 instances):** Use `mapfile` for array assignments from command output.

---

## 7. Verification Commands

```bash
# MUST return 0 lines (zero findings at warning severity)
find scripts/ -name "*.sh" -type f \
  -exec shellcheck --severity=warning -f gcc {} \; 2>/dev/null | wc -l
# Expected: 0

# Count suppressions for audit trail
grep -r "shellcheck disable" scripts/ --include="*.sh" | wc -l
# Document this count in the completion report

# Verify no SC2086 suppressions (quoting MUST be fixed, not suppressed)
grep -r "shellcheck disable=SC2086" scripts/ --include="*.sh" | wc -l
# Expected: 0

# Syntax check all modified scripts
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0, no output
```

---

## 8. Acceptance Criteria

- [ ] `shellcheck --severity=warning` produces zero output across all scripts
- [ ] Every `# shellcheck disable` directive has a justifying comment on the preceding line
- [ ] SC2155 instances are resolved by splitting declaration and assignment (not suppressed)
- [ ] SC2164 instances are resolved by adding `|| exit 1` or using `safe_cd` (not suppressed)
- [ ] No `# shellcheck disable=SC2086` (variable quoting) -- these MUST be fixed, not suppressed
- [ ] Total suppression count is documented in the phase completion report
- [ ] `bash -n` passes on all modified files

---

## 9. Traceability

| Task  | Deficiency                                                                               | Standard      | Files Affected               | Verification Command                                              |
| ----- | ---------------------------------------------------------------------------------------- | ------------- | ---------------------------- | ----------------------------------------------------------------- |
| 6.4.4 | 767 total ShellCheck findings (6 error, 336 warning, 402 info, 23 style) across 84 files | CERT SH (all) | 84 files (pre-consolidation) | `shellcheck --severity=warning scripts/*.sh 2>/dev/null \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 6th (after 6.4.11, 6.4.1, 6.4.6, 6.4.2, 6.4.3)

```
... --> 6.4.3 (headers) --> 6.4.4 (ShellCheck) --> 6.4.5 (quoting/validation) --> ...
```

This task depends on Tasks 6.4.1, 6.4.2, and 6.4.3 being complete because shebang correctness (SC2148), strict mode (interactions with `set -u`), and header placement all affect ShellCheck's analysis. Running ShellCheck before these structural changes would produce findings that are already resolved by prior tasks.

After this task, Task 6.4.5 (Variable Quoting and Input Validation) provides the deeper security-focused quoting and validation that overlaps with but extends beyond SC2086.

---

```
END OF TASK DOCUMENT
Task:     6.4.4 - ShellCheck Compliance
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
