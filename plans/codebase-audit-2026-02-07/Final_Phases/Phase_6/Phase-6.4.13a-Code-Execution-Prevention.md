# Phase 6.4.13a: Code Execution Prevention

**Document ID**: ARGOS-AUDIT-P6.4.13a
**Parent Document**: Phase-6.4.13-Security-Critical-Pattern-Remediation.md
**Original Task ID**: 6.4.13 (Subtasks 13.1, 13.2, 13.3)
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (addresses CWE-78, CWE-94 -- arbitrary code execution via injection)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Remediate all code injection and arbitrary code execution vectors in the shell script corpus. This sub-file addresses three subtasks from the parent document that share a common attack class: **unvalidated input flowing into shell interpretation**, enabling command injection or arbitrary code execution.

| Subtask | Pattern                       | Instances            | Risk Level | CWE Reference |
| ------- | ----------------------------- | -------------------- | ---------- | ------------- |
| 13.1    | SC2086 unquoted variables     | 220 across ~70 files | HIGH       | CWE-78        |
| 13.2    | `eval` usage                  | 13 across 7 files    | CRITICAL   | CWE-94        |
| 13.3    | Backtick command substitution | TBD                  | MEDIUM     | CWE-78        |

**This file is the #1 priority among the three decomposed files** because Subtask 13.2 (`eval`) is the highest-risk finding in the entire Phase 6.4.13 scope (CRITICAL -- arbitrary code execution), and Subtask 13.1 (SC2086) is the highest-volume finding (220 instances).

### Relationship to Sibling Files

- **Phase-6.4.13b-Permission-Credential-Hardening.md** -- Subtasks 13.4, 13.5, 13.6, 13.7
- **Phase-6.4.13c-Runtime-Safety-Privilege-Management.md** -- Subtasks 13.8, 13.9, 13.10

### IMPORTANT: Overlap with Task 6.4.5 (Variable Quoting and Input Validation)

Subtask 13.1 (SC2086 Unquoted Variables) has **direct overlap** with Task 6.4.5. Both tasks target the same ShellCheck finding (SC2086) but differ in scope:

- **Task 6.4.5** achieves zero ShellCheck SC2086 findings as a mechanical fix (quote all variables).
- **Subtask 13.1** documents the security impact from a CWE/CERT perspective and verifies remediation from a vulnerability standpoint.

**Execution rule:** If Task 6.4.5 is already complete when this file is executed, Subtask 13.1 becomes **VERIFICATION-ONLY** (confirm zero SC2086 findings remain; document CWE-78 closure). If Task 6.4.5 is NOT yet complete, execute Subtask 13.1 as the combined quoting + security remediation pass.

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

- **Task 6.4.5 (Variable Quoting and Input Validation) MUST be complete.** Many security fixes overlap with quoting fixes. Subtask 13.1 (SC2086) is also tracked as Task 6.4.5. Executing this file AFTER 6.4.5 avoids duplicate work; if 6.4.5 is complete, Subtask 13.1 becomes verification-only.
- **Task 6.4.10 (Exit Code Conventions) MUST be complete.** Security remediation uses `EXIT_ERROR`, `EXIT_CONFIG` constants.
- **Task 6.4.11 (Shared Library) MUST be complete.** Shared library functions (`log_error`, `require_cmd`) must be available.

---

## 3. Dependencies

| Dependency | Direction  | Task          | Reason                                                                      |
| ---------- | ---------- | ------------- | --------------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.5         | Quoting overlaps with 13.1 (SC2086); must not duplicate work                |
| AFTER      | Upstream   | 6.4.10        | Exit code constants must be available for error handlers                    |
| AFTER      | Upstream   | 6.4.11        | Shared library functions (`log_error`, `require_cmd`) must be available     |
| BEFORE     | Downstream | 6.4.12        | CI enforcement must validate security patterns; cannot enforce before fixed |
| BEFORE     | Sibling    | Phase-6.4.13b | 13b depends on quoting being resolved (rm -rf quoting in 13.4)              |
| BEFORE     | Sibling    | Phase-6.4.13c | 13c depends on injection vectors being closed before credential hardening   |

### Cross-Reference to Phase 6.2.08

This file has **no direct overlap** with Phase 6.2.08 subtasks. Phase 6.2.08 does not address SC2086, eval, or backtick patterns. No verification-only mode required.

---

## 4. Rollback Strategy

### Per-Subtask Commits

```
security(scripts): Phase 6.4.13.1 - SC2086 unquoted variable injection remediation
security(scripts): Phase 6.4.13.2 - eval arbitrary code execution remediation
security(scripts): Phase 6.4.13.3 - backtick command substitution modernization
```

This enables targeted rollback of any single subtask via `git revert <commit-sha>`.

### Rollback Decision Criteria

Immediate rollback if:

- Any service management script fails to start/stop its target service after quoting changes
- Array-based command replacement (13.2 eval remediation) breaks multi-word argument handling
- Backtick-to-`$()` conversion changes behavior in edge cases (nested substitutions)
- `bash -n` syntax check fails on any modified script

---

## 5. Baseline Metrics

All metrics from independent security audit (2026-02-08) and parent document Section 17 (ShellCheck Blind Spots).

---

## 6. Subtask 13.1: SC2086 Unquoted Variables -- Injection Vector Remediation

**Priority:** 1 (HIGHEST)
**Risk Level:** HIGH -- CWE-78 (OS Command Injection), CERT STR02-C
**Instance Count:** 220 across ~70 files

### Description

SC2086 flags unquoted variable expansions that enable word splitting and glob injection. In scripts running as root (122 of 202 scripts invoke `sudo`), an unquoted variable containing spaces or glob characters can cause arbitrary file operations, directory traversal, or command injection.

### Detection

```bash
# Count total SC2086 instances
find scripts/ -name "*.sh" -type f -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# Baseline: 220

# List affected files with counts
find scripts/ -name "*.sh" -type f -exec sh -c \
  'count=$(shellcheck --include=SC2086 -f gcc "$1" 2>/dev/null | wc -l); \
   [ "$count" -gt 0 ] && echo "$count $1"' _ {} \; | sort -rn
```

### Remediation

Every `$VAR`, `${VAR}`, and `$(cmd)` MUST be double-quoted unless:

1. It appears inside `[[ ]]` (no word splitting in bash conditional)
2. It appears inside `$(( ))` (arithmetic context)
3. Intentional word splitting is required and documented with `# shellcheck disable=SC2086 -- <reason>`

```bash
# Before (vulnerable):
cp $SOURCE_FILE $DEST_DIR/
rm -rf $CLEANUP_PATH
docker exec $CONTAINER_ID cmd

# After (safe):
cp "${SOURCE_FILE}" "${DEST_DIR}/"
rm -rf "${CLEANUP_PATH}"
docker exec "${CONTAINER_ID}" cmd
```

### Verification

```bash
find scripts/ -name "*.sh" -type f -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# MUST return: 0
```

---

## 7. Subtask 13.2: eval Usage -- Arbitrary Code Execution

**Priority:** 2
**Risk Level:** CRITICAL -- CWE-94 (Code Injection), CWE-78 (OS Command Injection), CERT STR02-C
**Instance Count:** 13 across 7 files (3 CRITICAL, 10 LOW)

### Description

`eval` interprets its arguments as shell commands, enabling arbitrary code execution if any argument contains unsanitized input.

### Detection

```bash
# Find all eval usage (excluding comments)
grep -rn '\beval\b' scripts/ --include='*.sh' | grep -v '^\s*#'
# Baseline: 13 instances across 7 files
```

### Remediation

| Pattern                   | Risk     | Replacement                                                                                  |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `eval "$user_input"`      | CRITICAL | Remove entirely; use `case` dispatch or allowlist                                            |
| `eval "$(build_cmd)"`     | CRITICAL | Replace with array-based command construction: `cmd=("prog" "--flag" "${val}"); "${cmd[@]}"` |
| `eval "export VAR=value"` | LOW      | Replace with `export VAR="value"` (no eval needed)                                           |
| `eval "$(ssh-agent)"`     | LOW      | Safe -- output is controlled by ssh-agent binary; add comment documenting safety             |

**Before (vulnerable):**

```bash
# Constructs command string and evaluates it
CMD="docker exec ${CONTAINER} ${USER_COMMAND}"
eval "${CMD}"
```

**After (safe):**

```bash
# Use array-based command execution (no shell interpretation)
docker exec "${CONTAINER}" "${USER_COMMAND}"
# Or, if USER_COMMAND must contain flags:
IFS=' ' read -ra CMD_PARTS <<< "${USER_COMMAND}"
docker exec "${CONTAINER}" "${CMD_PARTS[@]}"
```

### Verification

```bash
# Zero eval instances with variable expansion (static eval is tolerable with comment)
grep -rn '\beval\b.*\$' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# All remaining eval instances have shellcheck disable + justification
grep -B1 '\beval\b' scripts/ --include='*.sh' | grep -c 'shellcheck disable'
# MUST match the count of remaining eval instances
```

---

## 8. Subtask 13.3: Backtick Command Substitution with Unvalidated Input

**Priority:** 3
**Risk Level:** MEDIUM -- CWE-78, CERT STR02-C

### Description

Backtick command substitution (`` `cmd` ``) is harder to nest, harder to read, and cannot be escaped correctly in all contexts. When combined with unvalidated input, it creates injection vectors harder to spot than `$(cmd)` equivalents.

### Detection

```bash
# Find backtick usage (excluding comments)
grep -rn '`[^`]*\$' scripts/ --include='*.sh' | grep -v '^\s*#'
# Also find ALL backtick usage for modernization
grep -rn '`' scripts/ --include='*.sh' | grep -v '^\s*#' | grep -v 'shellcheck'
```

### Remediation

Replace ALL backtick substitutions with `$(...)` syntax:

```bash
# Before:
RESULT=`docker ps -q`
PID=`cat /var/run/service.pid`

# After:
RESULT=$(docker ps -q)
PID=$(cat /var/run/service.pid)
```

### Verification

```bash
# Zero backtick command substitutions (excluding comments and strings)
grep -rn '`[^`]*`' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0
```

---

## 9. Aggregate Verification Commands (This File Only)

```bash
# 13.1: Zero SC2086
find scripts/ -name "*.sh" -type f -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null | wc -l
# MUST return: 0

# 13.2: Zero eval with variable expansion
grep -rn '\beval\b.*\$' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# 13.3: Zero backtick substitutions
grep -rn '`[^`]*`' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0
```

---

## 10. Acceptance Criteria

- [ ] Zero SC2086 (unquoted variable) instances from ShellCheck
- [ ] Zero `eval` with variable expansion (static eval requires documented justification with `# shellcheck disable` comment)
- [ ] Zero backtick command substitutions
- [ ] All modified scripts pass `bash -n` syntax check
- [ ] CWE-78 and CWE-94 closure documented for audit trail

---

## 11. Traceability

| Subtask | Deficiency                                          | Standard                     | Files Affected            | Verification Command                                                                                 |
| ------- | --------------------------------------------------- | ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| 13.1    | SC2086 unquoted variables enable command injection  | CWE-78, CERT STR02-C         | ~70 files (220 instances) | `find scripts/ -name "*.sh" -exec shellcheck --include=SC2086 -f gcc {} \; 2>/dev/null \| wc -l` = 0 |
| 13.2    | `eval` enables arbitrary code execution             | CWE-94, CWE-78, CERT STR02-C | 7 files (13 instances)    | `grep -rn '\beval\b.*\$' scripts/ --include='*.sh' \| grep -v '^\s*#' \| wc -l` = 0                  |
| 13.3    | Backtick substitution harder to audit for injection | CWE-78, CERT STR02-C         | TBD files                 | `grep -rn '\`[^\`]_\`' scripts/ --include='_.sh' \| grep -v '^\s\*#' \| wc -l` = 0                   |

---

## 12. Execution Order Notes

**Position in critical path:** 12th (after 6.4.10, before 6.4.12)

```
... --> 6.4.5 (quoting) --> 6.4.10 (exit codes) --> 6.4.13a (this file) --> 6.4.13b --> 6.4.13c --> 6.4.12 (CI)
```

**Full critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> **6.4.13a** -> 6.4.13b -> 6.4.13c -> 6.4.12

**Execution dependency:** This file executes AFTER Task 6.4.5 (variable quoting) because many security fixes overlap with quoting fixes. Subtask 13.1 (SC2086 unquoted variables) is also tracked as Task 6.4.5 -- the two tasks share verification but differ in scope:

- **6.4.5:** Achieve zero ShellCheck findings (mechanical fix)
- **6.4.13.1:** Document the security impact and verify from a CWE/CERT perspective

This file MUST execute BEFORE 6.4.13b and 6.4.13c because those files depend on injection vectors being closed. This file MUST execute BEFORE 6.4.12 (CI) because CI enforces security patterns. CI cannot be enabled until all security patterns are remediated, or the CI job will fail and block all PRs.

**Estimated effort:** 3-4 engineer-hours (13.1 is largest if 6.4.5 is not complete; 13.2 and 13.3 are moderate).

---

```
END OF TASK DOCUMENT
Task:     6.4.13a - Code Execution Prevention (Subtasks 13.1 + 13.2 + 13.3)
Parent:   6.4.13 - Security-Critical Pattern Remediation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
