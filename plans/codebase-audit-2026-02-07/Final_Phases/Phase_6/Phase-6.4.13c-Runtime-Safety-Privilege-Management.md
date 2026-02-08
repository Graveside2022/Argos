# Phase 6.4.13c: Runtime Safety and Privilege Management

**Document ID**: ARGOS-AUDIT-P6.4.13c
**Parent Document**: Phase-6.4.13-Security-Critical-Pattern-Remediation.md
**Original Task ID**: 6.4.13 (Subtasks 13.8, 13.9, 13.10)
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (addresses CWE-798, CWE-269, CWE-377 -- credentials, privilege management, temp files)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Remediate all runtime security posture weaknesses in the shell script corpus. This sub-file addresses three subtasks from the parent document that share a common attack class: **runtime security state** -- hardcoded secrets that persist in source, overly permissive privilege grants, and predictable temporary file paths exploitable at runtime.

| Subtask | Pattern                | Instances             | Risk Level | CWE Reference |
| ------- | ---------------------- | --------------------- | ---------- | ------------- |
| 13.8    | Hardcoded credentials  | 5 across 4 files      | CRITICAL   | CWE-798       |
| 13.9    | NOPASSWD: /bin/kill \* | 2 in 1 file           | CRITICAL   | CWE-269       |
| 13.10   | Unsafe `/tmp` usage    | 185 lines vs 3 mktemp | HIGH       | CWE-377       |

Subtasks 13.8 and 13.9 are CRITICAL risk. Subtask 13.10 has the highest instance count (185 lines) and addresses symlink attacks against predictable temp file paths.

### Relationship to Sibling Files

- **Phase-6.4.13a-Code-Execution-Prevention.md** -- Subtasks 13.1, 13.2, 13.3 (MUST complete BEFORE this file)
- **Phase-6.4.13b-Permission-Credential-Hardening.md** -- Subtasks 13.4, 13.5, 13.6, 13.7 (SHOULD complete BEFORE this file)

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

- **Task 6.4.5 (Variable Quoting and Input Validation) MUST be complete.** Credential externalization patterns use `${VAR:?error}` which must follow quoting conventions.
- **Task 6.4.6 (Trap and Cleanup Handlers) MUST be complete.** Subtask 13.10 (unsafe /tmp) depends on trap-based cleanup being in place for mktemp-created files/directories.
- **Task 6.4.10 (Exit Code Conventions) MUST be complete.** Security remediation uses `EXIT_ERROR`, `EXIT_CONFIG` constants.
- **Task 6.4.11 (Shared Library) MUST be complete.** Shared library functions (`log_error`, `require_cmd`) must be available.
- **Phase-6.4.13a (Code Execution Prevention) MUST be complete.** Injection vectors must be closed before credential hardening.
- **Phase-6.4.13b (Permission Hardening) SHOULD be complete.** File system permissions should be hardened before runtime posture work.

---

## 3. Dependencies

| Dependency | Direction  | Task          | Reason                                                                      |
| ---------- | ---------- | ------------- | --------------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.5         | Quoting conventions must be in place for credential patterns                |
| AFTER      | Upstream   | 6.4.6         | Trap-based cleanup must be in place for 13.10 (unsafe /tmp)                 |
| AFTER      | Upstream   | 6.4.10        | Exit code constants must be available for error handlers                    |
| AFTER      | Upstream   | 6.4.11        | Shared library functions must be available                                  |
| AFTER      | Sibling    | Phase-6.4.13a | Injection vectors closed before credential hardening                        |
| AFTER      | Sibling    | Phase-6.4.13b | Permission hardening before runtime posture                                 |
| BEFORE     | Downstream | 6.4.12        | CI enforcement must validate security patterns; cannot enforce before fixed |

### Cross-Reference to Phase 6.2.08

| This File Subtask                | Phase 6.2.08 Overlap                                                   | Overlap Detail                                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **13.8** (hardcoded credentials) | **6.2.8.1** (hardcoded API tokens) + **6.2.8.4** (hardcoded passwords) | **OVERLAPPING SCOPE.** 6.2.8.1 covers 2 API token instances; 6.2.8.4 covers 3+ password instances. Combined, they address the same 5 instances in 4 files that 13.8 targets. |
| **13.9** (NOPASSWD restriction)  | **6.2.8.3** (NOPASSWD /bin/kill \*)                                    | **IDENTICAL SCOPE.** Both target the same 2 NOPASSWD entries in setup-droneid-sudoers.sh.                                                                                    |
| **13.10** (unsafe /tmp)          | **6.2.8.6** (unsafe /tmp usage)                                        | **IDENTICAL SCOPE.** Both target the same 185 hardcoded /tmp paths vs 3-4 mktemp uses.                                                                                       |

---

## 4. Rollback Strategy

### Per-Subtask Commits

```
security(scripts): Phase 6.4.13.8 - hardcoded credential removal
security(scripts): Phase 6.4.13.9 - NOPASSWD sudoers restriction
security(scripts): Phase 6.4.13.10 - unsafe /tmp symlink attack prevention
```

This enables targeted rollback of any single subtask via `git revert <commit-sha>`.

### Rollback Decision Criteria

Immediate rollback if:

- Credential externalization breaks scripts in CI/Docker (no `secrets.env` available)
- NOPASSWD restriction breaks service management (script cannot start/stop/restart services)
- `mktemp` conversion causes temp file cleanup to run prematurely (trap fires before script completes)
- `visudo -c` validation fails on modified sudoers entries

---

## 5. Baseline Metrics

All metrics from independent security audit (2026-02-08) and parent document Section 17 (ShellCheck Blind Spots).

---

## 6. Subtask 13.8: Hardcoded Credentials Removal

**Priority:** 8
**Risk Level:** CRITICAL -- CWE-798 (Use of Hard-Coded Credentials), CWE-259
**Instance Count:** 5 across 4 files

### OVERLAP WITH PHASE 6.2.08 Sub-Tasks 6.2.8.1 + 6.2.8.4

> **Phase 6.2.08 Sub-Task 6.2.8.1 addresses 2 hardcoded API tokens and Sub-Task 6.2.8.4 addresses 3+ hardcoded passwords.** Together they cover the same 5 instances in 4 files that this subtask targets. Phase 6.2.08 executes BEFORE Phase 6.4.13 in the dependency graph.
>
> - **If 6.2.8.1 AND 6.2.8.4 are COMPLETE:** This subtask is **VERIFICATION-ONLY**. Run the detection command below and confirm zero findings. Document closure.
> - **If either is NOT COMPLETE:** Execute this subtask as the primary remediation pass for whichever findings remain. Mark the corresponding 6.2.08 subtask(s) as resolved by this work.

### Description

The independent security audit identified 5 hardcoded credentials across 4 shell scripts, including API tokens and admin passwords in plaintext source code.

### Detection

```bash
# Find potential hardcoded credentials
grep -rn 'password=\|PASSWORD=\|api_key=\|API_KEY=\|token=\|TOKEN=\|secret=' \
    scripts/ --include='*.sh' | grep -v '^\s*#' | grep -v 'PASSWORD="\$' | grep -v 'read -'
# Also check for specific known patterns from the security audit
grep -rn 'kismet\|admin:' scripts/ --include='*.sh' | grep -i 'pass'
```

### Remediation

1. Move all credentials to environment variables or a secrets file (`/etc/argos/secrets.env`) with `chmod 600` permissions
2. Source the secrets file at runtime: `source /etc/argos/secrets.env`
3. Validate that required credentials are set:

```bash
# Before (vulnerable):
KISMET_PASSWORD="kismet"
curl -u "admin:password" http://localhost:2501/...

# After (safe):
if [[ -f /etc/argos/secrets.env ]]; then
    source /etc/argos/secrets.env
fi
if [[ -z "${KISMET_PASSWORD:-}" ]]; then
    log_error "KISMET_PASSWORD not set. Configure in /etc/argos/secrets.env"
    exit "${EXIT_CONFIG}"
fi
curl -u "admin:${KISMET_PASSWORD}" http://localhost:2501/...
```

4. Add `/etc/argos/secrets.env` to `.gitignore`
5. Provide a template file: `/etc/argos/secrets.env.example` with placeholder values

### Verification

```bash
# Zero hardcoded passwords (excluding variable references and comments)
grep -rn 'password=.*[a-zA-Z]' scripts/ --include='*.sh' | \
  grep -vi '\${\|read \|prompt\|^\s*#\|example\|template' | wc -l
# MUST return: 0

# secrets.env.example exists
test -f /etc/argos/secrets.env.example || echo "MISSING: secrets.env.example"
```

---

## 7. Subtask 13.9: NOPASSWD Sudoers Restriction

**Priority:** 9
**Risk Level:** CRITICAL -- CWE-269 (Improper Privilege Management), CWE-250
**Instance Count:** 2 in 1 file

### OVERLAP WITH PHASE 6.2.08 Sub-Task 6.2.8.3

> **Phase 6.2.08 Sub-Task 6.2.8.3 addresses the IDENTICAL vulnerability -- the same 2 NOPASSWD entries in setup-droneid-sudoers.sh.** Phase 6.2.08 executes BEFORE Phase 6.4.13 in the dependency graph.
>
> - **If 6.2.8.3 is COMPLETE:** This subtask is **VERIFICATION-ONLY**. Run the detection command below and confirm zero findings. Document closure.
> - **If 6.2.8.3 is NOT COMPLETE:** Execute this subtask as the primary remediation pass. Mark 6.2.8.3 as resolved by this work.

### Description

The corpus contains 2 instances in 1 file that configure `NOPASSWD: /bin/kill *` in sudoers, allowing unrestricted process termination without authentication. A compromised web service could kill any process on the system.

### Detection

```bash
grep -rn 'NOPASSWD' scripts/ --include='*.sh' | grep -v '^\s*#'
```

### Remediation

Restrict NOPASSWD entries to specific commands with specific arguments (no wildcards):

```bash
# Before (dangerous):
echo "argos ALL=(ALL) NOPASSWD: /bin/kill *" | sudo tee /etc/sudoers.d/argos

# After (safe):
cat > /tmp/argos-sudoers <<'SUDOERS'
# Argos platform: restricted sudo access
# Only allow specific service management commands
argos ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop kismet
argos ALL=(ALL) NOPASSWD: /usr/bin/systemctl start kismet
argos ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart kismet
argos ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-dev
argos ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-dev
SUDOERS
# Validate sudoers syntax before installing
if visudo -c -f /tmp/argos-sudoers; then
    sudo cp /tmp/argos-sudoers /etc/sudoers.d/argos
    sudo chmod 440 /etc/sudoers.d/argos
else
    log_error "Invalid sudoers syntax"
    exit "${EXIT_ERROR}"
fi
rm -f /tmp/argos-sudoers
```

### Verification

```bash
# Zero wildcard NOPASSWD entries
grep -rn 'NOPASSWD.*\*' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# All NOPASSWD entries specify full command paths
grep -rn 'NOPASSWD' scripts/ --include='*.sh' | grep -v '^\s*#' | grep -v 'NOPASSWD: /usr/' | wc -l
# MUST return: 0
```

---

## 8. Subtask 13.10: Unsafe /tmp Usage -- Symlink Attack Prevention

**Priority:** 10
**Risk Level:** HIGH -- CWE-377 (Insecure Temporary File), CWE-367 (TOCTOU), CERT FIO21-C
**Instance Count:** ~185 hardcoded /tmp paths vs 3 proper mktemp uses

### OVERLAP WITH PHASE 6.2.08 Sub-Task 6.2.8.6

> **Phase 6.2.08 Sub-Task 6.2.8.6 addresses the IDENTICAL vulnerability -- the same 185 hardcoded /tmp paths.** Phase 6.2.08 executes BEFORE Phase 6.4.13 in the dependency graph.
>
> - **If 6.2.8.6 is COMPLETE:** This subtask is **VERIFICATION-ONLY**. Run the detection command below and confirm zero findings. Document closure.
> - **If 6.2.8.6 is NOT COMPLETE:** Execute this subtask as the primary remediation pass. Mark 6.2.8.6 as resolved by this work.

### Description

185 lines reference `/tmp/` directly (hardcoded temp paths) versus only 3 using `mktemp`. Hardcoded temp paths are vulnerable to symlink attacks: an attacker creates a symlink at the expected path pointing to a sensitive file, and the script overwrites the target.

### Detection

```bash
# Find hardcoded /tmp/ paths (not mktemp)
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v 'mktemp' | grep -v '^\s*#' | wc -l
# Baseline: ~185

# Find proper mktemp usage
grep -rn 'mktemp' scripts/ --include='*.sh' | wc -l
```

### Remediation

Replace all hardcoded `/tmp/filename` patterns with `mktemp`:

```bash
# Before (vulnerable):
LOG_FILE="/tmp/argos-install.log"
echo "Starting..." > "${LOG_FILE}"

# After (safe):
LOG_FILE=$(mktemp /tmp/argos-install-XXXXXX.log)
echo "Starting..." > "${LOG_FILE}"
```

For directories:

```bash
# Before:
WORK_DIR="/tmp/argos-build"
mkdir -p "${WORK_DIR}"

# After:
WORK_DIR=$(mktemp -d /tmp/argos-build-XXXXXX)
# Cleanup registered via trap (Task 6.4.6)
```

### Verification

```bash
# Hardcoded /tmp/ write paths reduced to zero
WRITE_TO_TMP=$(grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v 'mktemp' | \
  grep -v '^\s*#' | grep -E '>\s*/tmp/|echo.*>/tmp/|cat.*>/tmp/|cp.*\s/tmp/' | wc -l)
echo "Write-to-hardcoded-tmp: ${WRITE_TO_TMP}"
# MUST return: 0
```

---

## 9. Aggregate Verification Commands (This File Only)

```bash
# 13.8: Zero hardcoded passwords
grep -rn 'password=.*[a-zA-Z]' scripts/ --include='*.sh' | \
  grep -vi '\${\|read \|prompt\|^\s*#\|example\|template' | wc -l
# MUST return: 0

# 13.9: Zero wildcard NOPASSWD
grep -rn 'NOPASSWD.*\*' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# 13.10: Zero writes to hardcoded /tmp paths
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v 'mktemp' | grep -v '^\s*#' | \
  grep -E '>\s*/tmp/|echo.*>/tmp/|cat.*>/tmp/|cp.*\s/tmp/' | wc -l
# MUST return: 0
```

---

## 10. Acceptance Criteria

- [ ] Zero hardcoded credentials in script source
- [ ] Zero wildcard NOPASSWD sudoers entries
- [ ] All NOPASSWD entries specify full command paths (no wildcards)
- [ ] All temp file creation uses `mktemp` (zero writes to hardcoded `/tmp/` paths)
- [ ] `gitleaks` or `trufflehog` scan produces zero findings against scripts/
- [ ] `/etc/argos/secrets.env.example` template file exists with placeholder values
- [ ] All modified scripts pass `bash -n` syntax check
- [ ] CWE-798, CWE-269, CWE-377 closure documented for audit trail

---

## 11. Overlap with Phase 6.2.08

Phase 6.2.08 (Supply Chain and Credential Security Remediation) executes BEFORE Phase 6.4.13 in the dependency graph. The following overlap exists for this file:

| This Subtask                              | Phase 6.2.08 Subtask                               | Overlap                                                                                                                    | This File Action If 6.2.08 Complete                                        |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **13.8** (hardcoded credentials, CWE-798) | **6.2.8.1** (API tokens) + **6.2.8.4** (passwords) | OVERLAPPING -- 6.2.8.1 covers 2 API tokens, 6.2.8.4 covers 3+ passwords. Together they address all 5 instances in 4 files. | **VERIFICATION-ONLY**: Run detection, confirm 0 findings, document closure |
| **13.9** (NOPASSWD restriction, CWE-269)  | **6.2.8.3** (NOPASSWD /bin/kill \*)                | IDENTICAL -- same 2 entries in setup-droneid-sudoers.sh                                                                    | **VERIFICATION-ONLY**: Run detection, confirm 0 findings, document closure |
| **13.10** (unsafe /tmp, CWE-377)          | **6.2.8.6** (unsafe /tmp usage)                    | IDENTICAL -- same 185 instances vs 3-4 mktemp uses                                                                         | **VERIFICATION-ONLY**: Run detection, confirm 0 findings, document closure |

**Operational procedure:** Before beginning each subtask, check the Phase 6.2.08 completion status:

```bash
# Check if 6.2.08 subtasks were completed:
test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md && echo "6.2 COMPLETE"

# For 13.8 (credentials) -- verify 6.2.8.1 + 6.2.8.4 completion:
grep -rn 'password=.*[a-zA-Z]' scripts/ --include='*.sh' | \
  grep -vi '\${\|read \|prompt\|^\s*#\|example\|template' | wc -l
# If returns 0: Mark 13.8 as VERIFICATION-ONLY.

# For 13.9 (NOPASSWD) -- verify 6.2.8.3 completion:
grep -rn 'NOPASSWD.*\*' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# If returns 0: Mark 13.9 as VERIFICATION-ONLY.

# For 13.10 (unsafe /tmp) -- verify 6.2.8.6 completion:
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v 'mktemp' | grep -v '^\s*#' | \
  grep -E '>\s*/tmp/|echo.*>/tmp/|cat.*>/tmp/|cp.*\s/tmp/' | wc -l
# If returns 0: Mark 13.10 as VERIFICATION-ONLY.
```

**NOTE:** Even in VERIFICATION-ONLY mode, this file adds value by:

1. Documenting CWE/CERT closure from a standards compliance perspective (6.2.08 does not track CWE closure)
2. Running the `gitleaks`/`trufflehog` scan acceptance criteria (not part of 6.2.08)
3. Verifying `secrets.env.example` template existence
4. Cross-referencing with the ShellCheck Blind Spots manual audit (Section 13 below)

---

## 12. Traceability

| Subtask | Deficiency                                                 | Standard                       | Files Affected            | Verification Command                                                                      |
| ------- | ---------------------------------------------------------- | ------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| 13.8    | Hardcoded credentials in source enable unauthorized access | CWE-798, CWE-259               | 4 files (5 instances)     | `grep -rn 'password=.*[a-zA-Z]' scripts/ --include='*.sh' \| grep -vi '...' \| wc -l` = 0 |
| 13.9    | Unrestricted NOPASSWD enables privilege abuse              | CWE-269, CWE-250               | 1 file (2 instances)      | `grep -rn 'NOPASSWD.*\*' scripts/ --include='*.sh' \| grep -v '^\s*#' \| wc -l` = 0       |
| 13.10   | Hardcoded /tmp paths enable symlink attacks                | CWE-377, CWE-367, CERT FIO21-C | ~50 files (185 instances) | Write-to-hardcoded-tmp grep returns 0                                                     |

---

## 13. ShellCheck Blind Spots: Manual Audit Requirements

ShellCheck's static analysis does not detect the following patterns. This section documents what ShellCheck **cannot detect** and the corresponding manual audit procedures required as part of Phase 6.4.13. This section is placed in this file (13c) because it covers the manual audit requirements that complement automated ShellCheck analysis, and the majority of these blind spots relate to runtime security posture.

| Category                                      | ShellCheck Detection     | Why ShellCheck Misses It                                                                              | Manual Audit Procedure                                                                                    | Risk Level |
| --------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| **Hardcoded credentials**                     | Never detected           | ShellCheck analyzes syntax, not semantics; cannot distinguish `PASSWORD="hunter2"` from `COLOR="red"` | `grep -rn 'password\|secret\|token\|api.key' scripts/ --include='*.sh' -i \| grep -v '^\s*#' \| grep '='` | CRITICAL   |
| **Logic errors in privilege management**      | Never detected           | ShellCheck does not model sudo privilege scope                                                        | Manual review of all `sudo` invocations; verify least-privilege principle                                 | HIGH       |
| **Race conditions (TOCTOU)**                  | Never detected           | ShellCheck does not model filesystem state between operations                                         | Identify `test -f` / `[ -f ]` followed by operations on the tested path; replace with atomic operations   | MEDIUM     |
| **Hardcoded IP addresses**                    | Never detected           | ShellCheck does not analyze string values for network semantics                                       | `grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh'`             | MEDIUM     |
| **Symlink following in file operations**      | Never detected           | ShellCheck does not model filesystem state                                                            | Review all `cp`, `mv`, `ln`, `rm` on user-controlled paths; use `-P` where appropriate                    | MEDIUM     |
| **Correct use of cryptographic operations**   | Never detected           | ShellCheck does not validate cryptographic correctness                                                | Review all `openssl`, `gpg`, `sha256sum` invocations                                                      | HIGH       |
| **Environment variable injection**            | Partially (SC2086)       | ShellCheck flags unquoted vars but does not trace data flow                                           | Map all `${ENV_VAR}` uses that flow into `sudo`, `exec`, `eval`, or `bash -c`                             | HIGH       |
| **Denial-of-service via resource exhaustion** | Partially (SC2071)       | ShellCheck flags some infinite loops but not resource-bound issues                                    | Review all `while true` loops for exit conditions, sleep intervals, and resource limits                   | MEDIUM     |
| **File descriptor leaks**                     | Never detected           | ShellCheck does not track file descriptor lifecycle                                                   | Review all explicit `exec N>file` redirections for corresponding close operations                         | LOW        |
| **Signal handler correctness**                | Never detected           | ShellCheck validates trap syntax but not handler semantics                                            | Verify trap handlers preserve `$?`, clean up all resources, no race conditions                            | MEDIUM     |
| **Correct sudo tee patterns**                 | Flagged as SC2024 (info) | ShellCheck suggests `tee` but does not verify the replacement is correct                              | Review all `sudo cmd > file` patterns for correct `tee` usage                                             | LOW        |
| **Secrets in command-line arguments**         | Never detected           | ShellCheck does not analyze argument values for sensitivity                                           | `grep -rn 'curl.*-u\|curl.*--user\|wget.*--password' scripts/ --include='*.sh'`                           | HIGH       |

### Complementary Static Analysis Tools

| Tool         | Coverage Gap Filled                 | Installation             | Usage                              |
| ------------ | ----------------------------------- | ------------------------ | ---------------------------------- |
| `trufflehog` | Hardcoded secrets detection         | `pip install trufflehog` | `trufflehog filesystem scripts/`   |
| `gitleaks`   | Git history secret scanning         | `apt install gitleaks`   | `gitleaks detect --source .`       |
| `semgrep`    | Semantic analysis of shell patterns | `pip install semgrep`    | `semgrep --config=r/bash scripts/` |

**Recommendation:** Run `gitleaks` as part of CI (Task 6.4.12) to prevent future credential commits. Run `trufflehog` as a one-time sweep before Phase 6.4 completion.

---

## 14. Execution Order Notes

**Position in critical path:** 12th (after 6.4.13b, before 6.4.12)

```
... --> 6.4.13a (code execution) --> 6.4.13b (permissions) --> 6.4.13c (this file) --> 6.4.12 (CI)
```

**Full critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> 6.4.13a -> 6.4.13b -> **6.4.13c** -> 6.4.12

This file executes after Phase-6.4.13b because permission hardening should precede runtime security posture work. This file has an additional upstream dependency on Task 6.4.6 (Trap and Cleanup Handlers) for Subtask 13.10.

This file is the LAST of the three 6.4.13 sub-files, and MUST execute BEFORE 6.4.12 (CI) because CI enforces security patterns. CI cannot be enabled until all security patterns are remediated, or the CI job will fail and block all PRs.

**Estimated effort:** 2-4 engineer-hours (may be reduced to 1-2 hours if Phase 6.2.08 subtasks are complete, converting all three subtasks to verification-only mode).

**Total estimated effort for all three 6.4.13 files:** 8-12 engineer-hours (the largest single task in Phase 6.4).

---

```
END OF TASK DOCUMENT
Task:     6.4.13c - Runtime Safety and Privilege Management (Subtasks 13.8 + 13.9 + 13.10)
Parent:   6.4.13 - Security-Critical Pattern Remediation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
