# Phase 6.4.02: Strict Mode Enforcement

**Document ID**: ARGOS-AUDIT-P6.4.02
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.2
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH (behavioral change -- can break scripts that rely on command failure)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Enforce `set -euo pipefail` on line 2 of every shell script. This compound setting provides three critical safety nets:

| Flag          | Effect                                                            | CERT Reference                       |
| ------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `-e`          | Exit immediately on any command failure (non-zero exit)           | CERT SH-01: Detect and handle errors |
| `-u`          | Treat unset variables as errors (prevents silent empty expansion) | CERT SH-02: Initialize all variables |
| `-o pipefail` | Pipeline return code is the rightmost non-zero exit               | CERT SH-03: Check return values      |

**Rationale for `set -euo pipefail` over `set -e` alone:** A script containing `curl http://... | grep pattern` with only `set -e` will silently succeed even if `curl` fails, because `grep` determines the pipeline exit code. With `pipefail`, the `curl` failure propagates.

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

- **Task 6.4.1 (Shebang Standardization) MUST be complete.** Shebangs must be correct before strict mode is added.
- **Task 6.4.6 (Trap and Cleanup Handlers) MUST be complete.** See critical ordering dependency below.

---

## 3. Dependencies

> **TASK ORDERING DEPENDENCY**: Task 6.4.6 (trap handlers and error auditing) MUST execute BEFORE Task 6.4.2 (strict mode enablement). Reason: Adding `set -euo pipefail` to a script that contains `grep` (returns exit 1 on no match), `diff` (returns exit 1 on differences), or `cd` to a possibly-missing directory will cause immediate script termination. The error audit must first identify and fix these false-positive error exits with explicit `|| true` or conditional logic before strict mode can be safely enabled.
>
> Correct execution order: 6.4.1 (shebangs) -> 6.4.6 (error audit) -> 6.4.2 (strict mode) -> 6.4.3 (headers) -> remaining tasks

| Dependency | Direction  | Task   | Reason                                                                 |
| ---------- | ---------- | ------ | ---------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | common.sh library must exist first                                     |
| AFTER      | Upstream   | 6.4.1  | Shebangs must be correct before strict mode is added                   |
| AFTER      | Upstream   | 6.4.6  | Error audit MUST complete first to guard false-positive error exits    |
| BEFORE     | Downstream | 6.4.3  | Headers are added after strict mode is in place                        |
| BEFORE     | Downstream | 6.4.4  | Strict mode affects ShellCheck findings (SC2086 interacts with set -u) |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.2 - strict mode enforcement
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- Any service management script fails to start/stop its target service after modification
- `bash -n` syntax check fails on any modified script
- Any script that previously ran successfully now exits non-zero in its normal execution path

> **WARNING**: This task has the HIGHEST risk of breakage in the entire Phase 6.4 series. The `-e` flag causes immediate exit on any command returning non-zero. The `-u` flag causes exit on any unset variable reference. Both conditions are common in scripts that were written without strict mode.

---

## 5. Baseline Metrics

| Metric                                 | Count | Percentage |
| -------------------------------------- | ----- | ---------- |
| `set -euo pipefail` (full strict mode) | 31    | 15.3%      |
| `set -e` only (partial, no pipefail)   | 34    | 16.8%      |
| `trap` only (no `set -e`)              | 6     | 3.0%       |
| No error handling whatsoever           | 131   | 64.9%      |

**Total:** 31 full strict mode + 34 partial + 6 trap-only + 131 none = 202 scripts

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# Strict mode
grep -rl "set -euo pipefail" scripts/ --include="*.sh" | wc -l
# Result: 31

# No error handling (zero set -e, zero trap, zero || exit)
grep -rL "set -e\|trap\||| exit\||| return" scripts/ --include="*.sh" | wc -l
# Result: 131
# NOTE: 31 full strict mode + 34 partial (set -e only) + 6 trap-only + 131 none = 202
```

---

## 6. Task Details

### Scope

All `.sh` files under `scripts/`. Files that already have `set -e` or `set -euo pipefail` will be normalized to the full form.

### Known Incompatibilities

The `-u` flag causes failures when scripts reference `$1` without checking `$#` first, or when testing `${VARIABLE:-}` without the default-value syntax. These cases MUST be fixed as part of this task.

**Pattern 1: Positional parameter access**

Before:

```bash
TARGET=$1
```

After:

```bash
TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
    echo "ERROR: Missing required argument: target" >&2
    exit 2
fi
```

**Pattern 2: Optional environment variable**

Before:

```bash
if [ "$VERBOSE" = "true" ]; then
```

After:

```bash
if [[ "${VERBOSE:-false}" == "true" ]]; then
```

**Pattern 3: Array iteration over potentially empty arrays**

Before:

```bash
for item in "${MY_ARRAY[@]}"; do
```

After:

```bash
for item in "${MY_ARRAY[@]+"${MY_ARRAY[@]}"}"; do
```

Or, if bash 4.4+ is guaranteed (it is, on Kali 2025.4):

```bash
shopt -s nounset
for item in "${MY_ARRAY[@]}"; do  # bash 4.4+ handles empty arrays under nounset
```

### Detection

```bash
# Scripts missing strict mode entirely
grep -rL "set -euo pipefail" scripts/ --include="*.sh" | wc -l

# Scripts with partial strict mode (set -e but not set -euo pipefail)
grep -rl "set -e$\|set -e " scripts/ --include="*.sh" | \
  xargs grep -L "set -euo pipefail" 2>/dev/null
```

### Transformation

For scripts that have NO strict mode:

```bash
# Insert set -euo pipefail on line 2
sed -i '1a set -euo pipefail' "$SCRIPT"
```

For scripts that have `set -e` only:

```bash
sed -i 's/^set -e$/set -euo pipefail/' "$SCRIPT"
sed -i 's/^set -e /set -euo pipefail /' "$SCRIPT"
```

---

## 7. Verification Commands

```bash
# All scripts must have strict mode on line 2
find scripts/ -name "*.sh" -type f -exec sh -c \
  'LINE2=$(sed -n "2p" "$1"); \
   [ "$LINE2" != "set -euo pipefail" ] && echo "FAIL: $1 (line 2: $LINE2)"' _ {} \;
# Expected: no output

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] Every `.sh` file has `set -euo pipefail` as line 2
- [ ] No script contains `set -e` without `-uo pipefail`
- [ ] All `$1`/`$2`/`$@` references are guarded with `${N:-}` or `$#` checks
- [ ] All optional environment variables use `${VAR:-default}` syntax
- [ ] `bash -n` passes on all modified files

---

## 9. Traceability

| Task  | Deficiency                                                        | Standard                 | Files Affected     | Verification Command                                                              |
| ----- | ----------------------------------------------------------------- | ------------------------ | ------------------ | --------------------------------------------------------------------------------- |
| 6.4.2 | 131 scripts with no error handling (plus 34 partial, 6 trap-only) | CERT SH-01, SH-02, SH-03 | All ~75-80 scripts | `grep -c "set -euo pipefail" <(find scripts/ -name "*.sh" -exec sed -n 2p {} \;)` |

---

## 10. Execution Order Notes

**Position in critical path:** 4th (after 6.4.11, 6.4.1, 6.4.6)

```
6.4.11 (common.sh library) --> 6.4.1 (shebangs) --> 6.4.6 (traps/error audit) --> 6.4.2 (strict mode) --> 6.4.3 (headers) --> ...
```

> **WARNING**: The original ordering placed 6.4.2 (strict mode) and 6.4.6 (traps/error audit) as parallel. This is INCORRECT and will cause cascading breakage. `set -euo pipefail` added to scripts containing `grep` (exit 1 on no match), `diff` (exit 1 on differences), or `cd` to potentially-missing directories will cause immediate termination. Task 6.4.6 must audit and guard these patterns FIRST.

---

```
END OF TASK DOCUMENT
Task:     6.4.2 - Strict Mode Enforcement
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
