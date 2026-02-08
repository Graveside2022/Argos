# Phase 6.4.05: Variable Quoting and Input Validation

**Document ID**: ARGOS-AUDIT-P6.4.05
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.5
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH (security-critical -- addresses CWE-78 OS Command Injection and OWASP Cmd Injection)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Ensure all variable expansions are double-quoted and all script parameters originating from user input, command-line arguments, or environment variables are validated before use. This task addresses:

- **SC2086 (220 instances):** The #1 ShellCheck finding and the MOST DANGEROUS shell scripting vulnerability -- unquoted variables enable word splitting and glob injection.
- **CERT SH-05:** Validate all input.
- **OWASP OS Command Injection Prevention:** No unvalidated user input in command construction.

**Current state:** 81 scripts (40.1%) accept positional parameters (`$1`, `$@`). 220 instances of SC2086 exist across ~70 files. Zero scripts validate argument format (regex/allowlist). Zero scripts implement path traversal prevention.

**Target state:** Zero SC2086 findings. All 81 parameter-accepting scripts validate `$#` before accessing `$1`. All path-constructing scripts validate against path traversal. All frequency-accepting scripts validate numeric format.

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

- **Task 6.4.4 (ShellCheck Compliance) MUST be complete.** SC2086 is part of ShellCheck compliance; this task provides deeper security-focused validation beyond what ShellCheck detects.
- **Task 6.4.2 (Strict Mode Enforcement) MUST be complete.** The `-u` flag interacts with variable quoting (unset variable references).

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                             |
| ---------- | ---------- | ------ | ------------------------------------------------------------------ |
| AFTER      | Upstream   | 6.4.11 | common.sh library must exist first                                 |
| AFTER      | Upstream   | 6.4.4  | SC2086 is part of ShellCheck compliance; this task extends it      |
| AFTER      | Upstream   | 6.4.2  | Strict mode `-u` flag interacts with variable quoting              |
| BEFORE     | Downstream | 6.4.13 | Security-critical pattern remediation overlaps with quoting (13.1) |
| BEFORE     | Downstream | 6.4.7  | Help/dry-run argument parsing depends on validated input patterns  |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.5 - variable quoting and input validation
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- `bash -n` syntax check fails on any modified script
- Any script that previously accepted valid arguments now rejects them (over-restrictive validation)
- Any service management script fails to start/stop its target service after modification

---

## 5. Baseline Metrics

| Metric                                          | Count | Percentage |
| ----------------------------------------------- | ----- | ---------- |
| SC2086 findings (unquoted variables)            | 220   | --         |
| Scripts accepting positional parameters (`$1`)  | 81    | 40.1%      |
| Scripts with `$#` validation before `$1` access | 0     | 0%         |
| Scripts with path traversal prevention          | 0     | 0%         |
| Scripts with argument format validation (regex) | 0     | 0%         |

### Baseline Reproduction Commands

```bash
cd /home/kali/Documents/Argos/Argos

# SC2086 total count
find scripts/ -name "*.sh" -type f -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# Result: 220

# Scripts using $1 or ${1
grep -rl '\$1\|\${1' scripts/ --include="*.sh" | wc -l
# Result: 81

# Scripts with $# validation
grep -rl '\$1\|\${1' scripts/ --include="*.sh" | xargs grep -l '\$#\|"${1:-' 2>/dev/null | wc -l
```

---

## 6. Task Details

### 6.1: Universal Variable Quoting

Every `$VAR`, `${VAR}`, `$(cmd)`, and `` `cmd` `` MUST be enclosed in double quotes.

**Exceptions (must be individually commented):**

- Inside `[[ ]]` test brackets (where word splitting does not occur)
- Array subscript context `${array[*]}` where IFS-joined output is intended
- Arithmetic context `$(( ))` where quoting is syntactically invalid

**Before:**

```bash
FILE_PATH=$PROJECT_ROOT/config/$CONFIG_NAME
cp $SOURCE $DEST
echo $MESSAGE
```

**After:**

```bash
FILE_PATH="${PROJECT_ROOT}/config/${CONFIG_NAME}"
cp "${SOURCE}" "${DEST}"
echo "${MESSAGE}"
```

### 6.2: Command-Line Argument Validation

All scripts that accept positional parameters (81 scripts reference `$1`, `$@`, or `${1}`) MUST validate arguments before use.

**Required validation pattern:**

```bash
# Validate argument count
if [[ $# -lt 1 ]]; then
    echo "ERROR: Missing required argument: <description>" >&2
    echo "Usage: $(basename "$0") <arg1> [arg2]" >&2
    exit 2
fi

# Validate argument format (example: must be alphanumeric)
if [[ ! "${1}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid argument format: '${1}'" >&2
    echo "       Argument must contain only alphanumeric characters, hyphens, and underscores." >&2
    exit 2
fi
```

### 6.3: Path Traversal Prevention

Scripts that construct file paths from user input MUST validate against path traversal:

```bash
# Reject path traversal attempts
if [[ "${USER_INPUT}" == *".."* ]]; then
    echo "ERROR: Path traversal detected in argument: '${USER_INPUT}'" >&2
    exit 2
fi

# Resolve to canonical path and verify it is within expected directory
RESOLVED_PATH=$(realpath -m "${BASE_DIR}/${USER_INPUT}")
if [[ "${RESOLVED_PATH}" != "${BASE_DIR}"/* ]]; then
    echo "ERROR: Resolved path escapes base directory: '${RESOLVED_PATH}'" >&2
    exit 2
fi
```

### 6.4: Command Injection Prevention

No script SHALL pass unvalidated user input to `eval`, `bash -c`, `sudo bash -c`, or any construct that interprets strings as commands.

**Known violation (from runtime validation audit):** `src/routes/api/gsm-evil/control/+server.ts` line 91 passes a frequency parameter directly to a shell command. While this is a TypeScript file (not shell), any shell scripts that accept frequency values must validate them numerically:

```bash
# Validate frequency is a positive number
if [[ ! "${FREQ}" =~ ^[0-9]+(\.[0-9]+)?[MmGgKk]?$ ]]; then
    echo "ERROR: Invalid frequency format: '${FREQ}'" >&2
    exit 2
fi
```

### Detection

```bash
# Find unquoted variable expansions (heuristic -- ShellCheck SC2086 is authoritative)
grep -rn '\$[A-Z_][A-Z_0-9]*[^}"'"'"']' scripts/ --include="*.sh" | \
  grep -v '#' | grep -v '^\s*#' | head -30

# Find eval or bash -c with variable interpolation
grep -rn 'eval\|bash -c.*\$' scripts/ --include="*.sh"

# Find scripts using $1 without $# check
for f in $(grep -rl '\$1\|\${1' scripts/ --include="*.sh"); do
    grep -q '$#\|"${1:-' "$f" || echo "UNGUARDED: $f"
done
```

---

## 7. Verification Commands

```bash
# ShellCheck SC2086 must produce zero findings
find scripts/ -name "*.sh" -type f \
  -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# Expected: 0

# No unquoted eval or bash -c with variable interpolation
grep -rn 'eval \$\|bash -c.*\$[^(]' scripts/ --include="*.sh" | wc -l
# Expected: 0

# All scripts with $1 have $# or ${1:- guard
UNGUARDED=0
for f in $(grep -rl '\$1\|\${1' scripts/ --include="*.sh"); do
    grep -q '\$#\|"${1:-\|${1:-' "$f" || { echo "FAIL: $f"; UNGUARDED=$((UNGUARDED+1)); }
done
echo "Unguarded: ${UNGUARDED}"
# Expected: 0

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] Zero SC2086 findings from ShellCheck
- [ ] Zero instances of `eval $VAR` or `bash -c` with unquoted variable interpolation
- [ ] All 81 parameter-accepting scripts validate `$#` before accessing `$1`
- [ ] All path-constructing scripts validate against path traversal
- [ ] All frequency-accepting scripts validate numeric format
- [ ] `bash -n` passes on all modified files

---

## 9. Traceability

| Task  | Deficiency                              | Standard                        | Files Affected                 | Verification Command                                |
| ----- | --------------------------------------- | ------------------------------- | ------------------------------ | --------------------------------------------------- |
| 6.4.5 | Unquoted variables, no input validation | CERT SH-05, OWASP Cmd Injection | 81 parameter-accepting scripts | `shellcheck --include=SC2086 scripts/*.sh \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 7th (after 6.4.11, 6.4.1, 6.4.6, 6.4.2, 6.4.3, 6.4.4)

```
... --> 6.4.4 (ShellCheck) --> 6.4.5 (quoting/validation) --> 6.4.13 (security) --> ...
```

This task overlaps significantly with Task 6.4.4 (SC2086 is a ShellCheck finding) and Task 6.4.13 (subtask 13.1 addresses the security implications of unquoted variables). The distinction is:

- **6.4.4:** Achieve zero ShellCheck findings (mechanical fix -- quote all variables)
- **6.4.5:** Go beyond ShellCheck to validate argument count, format, path traversal, and injection prevention
- **6.4.13.1:** Document the security impact and verify the fix from a CWE/CERT perspective

If SC2086 quoting was fully resolved in 6.4.4, this task focuses on the argument validation and injection prevention components that ShellCheck does NOT detect.

---

```
END OF TASK DOCUMENT
Task:     6.4.5 - Variable Quoting and Input Validation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
