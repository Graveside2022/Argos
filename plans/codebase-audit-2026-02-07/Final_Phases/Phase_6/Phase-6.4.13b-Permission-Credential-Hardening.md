# Phase 6.4.13b: Permission and Credential Hardening

**Document ID**: ARGOS-AUDIT-P6.4.13b
**Parent Document**: Phase-6.4.13-Security-Critical-Pattern-Remediation.md
**Original Task ID**: 6.4.13 (Subtasks 13.4, 13.5, 13.6, 13.7)
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (addresses CWE-22, CWE-494, CWE-732, CWE-426 -- path traversal, supply chain, permissions, search path)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Remediate all file system permission abuse, supply chain attack vectors, and privilege escalation paths in the shell script corpus. This sub-file addresses four subtasks from the parent document that share a common attack class: **file system operations and privilege boundaries**.

| Subtask | Pattern                          | Instances               | Risk Level | CWE Reference |
| ------- | -------------------------------- | ----------------------- | ---------- | ------------- |
| 13.4    | `rm -rf` with unquoted variables | TBD                     | CRITICAL   | CWE-22        |
| 13.5    | `curl\|bash` / `wget\|sh`        | 22 across 14 files      | CRITICAL   | CWE-494       |
| 13.6    | `chmod 777` / `chmod 666`        | 3+ in 2+ files          | HIGH       | CWE-732       |
| 13.7    | `sudo` without full path         | ~1,017 across 122 files | MEDIUM     | CWE-426       |

Subtasks 13.4 and 13.5 are CRITICAL risk. Subtask 13.7 has the highest instance count (~1,017) but lowest individual risk per instance.

### Relationship to Sibling Files

- **Phase-6.4.13a-Code-Execution-Prevention.md** -- Subtasks 13.1, 13.2, 13.3 (MUST complete BEFORE this file)
- **Phase-6.4.13c-Runtime-Safety-Privilege-Management.md** -- Subtasks 13.8, 13.9, 13.10

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

- **Task 6.4.5 (Variable Quoting and Input Validation) MUST be complete.** Subtask 13.4 (rm -rf with unquoted variables) depends on quoting being resolved.
- **Task 6.4.10 (Exit Code Conventions) MUST be complete.** Security remediation uses `EXIT_ERROR`, `EXIT_CONFIG` constants.
- **Task 6.4.11 (Shared Library) MUST be complete.** Shared library functions (`log_error`, `require_cmd`) must be available.
- **Phase-6.4.13a (Code Execution Prevention) SHOULD be complete.** Injection vectors from 13a should be closed before this file addresses file-system-level exploitation.

---

## 3. Dependencies

| Dependency | Direction  | Task          | Reason                                                                      |
| ---------- | ---------- | ------------- | --------------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.5         | Quoting must be complete for rm -rf remediation (13.4)                      |
| AFTER      | Upstream   | 6.4.10        | Exit code constants must be available for error handlers                    |
| AFTER      | Upstream   | 6.4.11        | Shared library functions must be available                                  |
| AFTER      | Sibling    | Phase-6.4.13a | Injection vectors closed before file-system exploitation                    |
| BEFORE     | Sibling    | Phase-6.4.13c | Permission hardening before runtime security posture                        |
| BEFORE     | Downstream | 6.4.12        | CI enforcement must validate security patterns; cannot enforce before fixed |

### Cross-Reference to Phase 6.2.08

| This File Subtask     | Phase 6.2.08 Overlap         | Overlap Detail                                                                       |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| **13.5** (curl\|bash) | **6.2.8.2** (curl\|bash RCE) | **IDENTICAL SCOPE.** Both target the same 22 `curl\|bash` instances across 14 files. |

**Execution rule for Subtask 13.5:** Phase 6.2.08 (Sub-Task 6.2.8.2) executes BEFORE Phase 6.4.13 in the dependency graph (Phase 6.2 precedes Phase 6.4). Therefore:

- **If 6.2.8.2 is COMPLETE:** Subtask 13.5 becomes **VERIFICATION-ONLY**. Run the detection command to confirm zero `curl|bash` patterns remain. Document closure.
- **If 6.2.8.2 is NOT COMPLETE:** Execute Subtask 13.5 as the primary remediation pass.

---

## 4. Rollback Strategy

### Per-Subtask Commits

```
security(scripts): Phase 6.4.13.4 - rm -rf path traversal prevention
security(scripts): Phase 6.4.13.5 - curl|bash supply chain attack remediation
security(scripts): Phase 6.4.13.6 - chmod 777 world-writable permission fix
security(scripts): Phase 6.4.13.7 - sudo full path validation
```

This enables targeted rollback of any single subtask via `git revert <commit-sha>`.

### Rollback Decision Criteria

Immediate rollback if:

- Any service management script fails to start/stop its target service
- Installation scripts fail to install required packages after curl|bash remediation
- `rm -rf` guard checks cause false positives blocking legitimate cleanup operations
- `sudo` full-path conversion breaks on the target platform (binary not at expected path)
- `chmod` permission changes break inter-process file access (e.g., Docker volume mounts)

---

## 5. Baseline Metrics

All metrics from independent security audit (2026-02-08) and parent document Section 17 (ShellCheck Blind Spots).

---

## 6. Subtask 13.4: rm -rf with Unquoted or Unvalidated Variables

**Priority:** 4
**Risk Level:** CRITICAL -- CWE-22 (Path Traversal), CWE-73, NASA/JPL Rule 1

### Description

`rm -rf $VAR` where `$VAR` is unquoted, empty, or attacker-controlled can result in catastrophic file deletion. If `$VAR` expands to empty, `rm -rf` operates on the current directory.

### Detection

```bash
# Find rm -rf with variable expansion (quoted or unquoted)
grep -rn 'rm -rf.*\$' scripts/ --include='*.sh' | grep -v '^\s*#'
# Also check for rm -rf with potentially empty variables
grep -rn 'rm -rf' scripts/ --include='*.sh' | grep -v '^\s*#'
```

### Remediation

Every `rm -rf` that references a variable MUST:

1. Quote the variable: `rm -rf "${VAR}"`
2. Guard against empty expansion: `[[ -n "${VAR}" ]] && rm -rf "${VAR}"`
3. Validate the path is within an expected directory:

```bash
# Before (dangerous):
rm -rf $CLEANUP_DIR

# After (safe):
if [[ -z "${CLEANUP_DIR:-}" ]]; then
    log_error "CLEANUP_DIR is empty; refusing to rm -rf"
    exit "${EXIT_ERROR}"
fi
if [[ "${CLEANUP_DIR}" != /tmp/* && "${CLEANUP_DIR}" != /home/kali/* ]]; then
    log_error "CLEANUP_DIR '${CLEANUP_DIR}' is outside allowed paths; refusing to rm -rf"
    exit "${EXIT_ERROR}"
fi
rm -rf "${CLEANUP_DIR}"
```

### Verification

```bash
# Zero unquoted rm -rf with variables
grep -rn 'rm -rf \$' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# All rm -rf with variables have a preceding guard check
for f in $(grep -rl 'rm -rf.*\$' scripts/ --include='*.sh'); do
    grep -B5 'rm -rf' "${f}" | grep -q '\-z\|\-n\|if \[' || echo "UNGUARDED rm -rf: ${f}"
done
# Expected: no output
```

---

## 7. Subtask 13.5: curl|bash / wget|sh Patterns -- Supply Chain Attack Vector

**Priority:** 5
**Risk Level:** CRITICAL -- CWE-494 (Download of Code Without Integrity Check), CERT MSC33-C
**Instance Count:** 22 across 14 files

### OVERLAP WITH PHASE 6.2.08 Sub-Task 6.2.8.2

> **Phase 6.2.08 Sub-Task 6.2.8.2 addresses the IDENTICAL vulnerability class with the IDENTICAL instance set (22 curl|bash patterns across 14 files).** Phase 6.2.08 executes BEFORE Phase 6.4.13 in the dependency graph.
>
> - **If 6.2.8.2 is COMPLETE:** This subtask is **VERIFICATION-ONLY**. Run the detection command below and confirm zero findings. Skip the remediation section.
> - **If 6.2.8.2 is NOT COMPLETE:** Execute this subtask as the primary remediation pass. Mark 6.2.8.2 as resolved by this work.

### Description

Piping downloaded content directly to a shell interpreter (`curl URL | bash`) executes arbitrary remote code without verification. A MITM attack, DNS poisoning, or compromised server delivers malicious payloads with the privileges of the running script (often root).

### Detection

```bash
# Find curl-pipe-shell patterns
grep -rn 'curl.*|.*\(bash\|sh\)\|wget.*|.*\(bash\|sh\)' scripts/ --include='*.sh' | grep -v '^\s*#'
# Baseline: 22 instances across 14 files
```

### Remediation

Replace every `curl|bash` with a download-verify-execute pattern:

```bash
# Before (vulnerable):
curl -fsSL https://get.docker.com | sh

# After (safe):
INSTALLER=$(mktemp /tmp/docker-install-XXXXXX.sh)
curl -fsSL -o "${INSTALLER}" https://get.docker.com

# Verify download succeeded and is non-empty
if [[ ! -s "${INSTALLER}" ]]; then
    log_error "Download failed or empty: https://get.docker.com"
    rm -f "${INSTALLER}"
    exit "${EXIT_ERROR}"
fi

# Optional: verify checksum if published by vendor
# EXPECTED_SHA256="abc123..."
# ACTUAL_SHA256=$(sha256sum "${INSTALLER}" | awk '{print $1}')
# if [[ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]]; then
#     log_error "Checksum mismatch for docker installer"
#     rm -f "${INSTALLER}"
#     exit "${EXIT_ERROR}"
# fi

log_info "Executing downloaded installer: ${INSTALLER}"
bash "${INSTALLER}"
rm -f "${INSTALLER}"
```

Where checksum verification is not possible (vendor does not publish checksums), the download-to-file pattern still provides:

1. Ability to inspect the file before execution
2. Atomic failure detection (empty/truncated download caught)
3. Audit trail (the file existed on disk)
4. Prevention of partial execution (a truncated pipe can execute partial content)

### Verification

```bash
# Zero curl-pipe-shell patterns
grep -rn 'curl.*|.*\(bash\|sh\)\|wget.*|.*\(bash\|sh\)' scripts/ --include='*.sh' | \
  grep -v '^\s*#' | wc -l
# MUST return: 0
```

---

## 8. Subtask 13.6: chmod 777 / World-Writable File Permissions

**Priority:** 6
**Risk Level:** HIGH -- CWE-732 (Incorrect Permission Assignment), CERT FIO06-C

### Description

`chmod 777` grants read, write, and execute permissions to all users. On a multi-user system or when containers share mount points, this allows any process to modify executable files, inject code, or read sensitive data.

### Detection

```bash
# Find overly permissive chmod patterns
grep -rn 'chmod 777\|chmod.*a+w\|chmod 666' scripts/ --include='*.sh' | grep -v '^\s*#'
```

### Remediation

| Current Permission | Correct Permission | Use Case                                |
| ------------------ | ------------------ | --------------------------------------- |
| `chmod 777`        | `chmod 755`        | Executables (owner rwx, group+other rx) |
| `chmod 777`        | `chmod 700`        | Scripts with secrets (owner only)       |
| `chmod 666`        | `chmod 644`        | Config files (owner rw, group+other r)  |
| `chmod 666`        | `chmod 660`        | Device files shared with a group        |
| `chmod a+w`        | `chmod g+w`        | Group-writable (if group access needed) |

```bash
# Before:
chmod 777 /opt/argos/scripts/*.sh
chmod 666 /dev/ttyUSB0

# After:
chmod 755 /opt/argos/scripts/*.sh
chmod 660 /dev/ttyUSB0  # group 'dialout' has access
```

### Verification

```bash
# Zero chmod 777 or chmod 666 instances
grep -rn 'chmod 777\|chmod 666' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# Zero world-writable permission grants
grep -rn 'chmod.*a+w' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0
```

---

## 9. Subtask 13.7: sudo Without Full Path Validation

**Priority:** 7
**Risk Level:** MEDIUM -- CWE-426 (Untrusted Search Path), CERT ENV03-C
**Instance Count:** ~1,017 across 122 files

### Description

When scripts invoke `sudo cmd` without specifying the full path to `cmd`, a PATH hijacking attack can substitute a malicious binary. While converting all 1,017 to full paths is impractical, the highest-risk patterns must be hardened.

### Remediation Tiers

**Tier 1 (MUST -- all installation/setup scripts):** Use full paths for commands invoked via sudo:

```bash
# Before:
sudo apt-get install -y package
sudo systemctl restart kismet

# After:
sudo /usr/bin/apt-get install -y package
sudo /usr/bin/systemctl restart kismet
```

**Tier 2 (SHOULD -- service management scripts):** Use full paths for critical commands (`kill`, `rm`, `cp`, `mv`, `mount`, `iptables`):

```bash
# Before:
sudo kill -9 $PID
sudo rm -rf /tmp/old-data

# After:
sudo /usr/bin/kill -9 "${PID}"
sudo /usr/bin/rm -rf "${CLEANUP_DIR}"
```

**Tier 3 (MAY -- diagnostic/monitoring scripts):** Set PATH explicitly at script start:

```bash
# At top of script, after strict mode:
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
```

### Detection

```bash
# Find sudo with relative command names (not full paths)
grep -rn 'sudo [^/]' scripts/ --include='*.sh' | grep -v '^\s*#' | grep -v 'sudo -' | head -20
# Count total
grep -rn 'sudo ' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# Baseline: ~1,017
```

### Verification

```bash
# All installation scripts use full paths with sudo
for f in scripts/install-*.sh scripts/setup-*.sh; do
    VIOLATIONS=$(grep -n 'sudo [a-z]' "${f}" 2>/dev/null | grep -v 'sudo /' | grep -v '^\s*#' | wc -l)
    [[ "${VIOLATIONS}" -gt 0 ]] && echo "RELATIVE sudo: ${f} (${VIOLATIONS} instances)"
done
# Expected: no output for Tier 1 scripts
```

---

## 10. Aggregate Verification Commands (This File Only)

```bash
# 13.4: Zero unquoted rm -rf
grep -rn 'rm -rf \$' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# 13.5: Zero curl|bash
grep -rn 'curl.*|.*\(bash\|sh\)\|wget.*|.*\(bash\|sh\)' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# 13.6: Zero chmod 777/666
grep -rn 'chmod 777\|chmod 666' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# MUST return: 0

# 13.7: Installation scripts use full sudo paths
for f in scripts/install-*.sh scripts/setup-*.sh; do
    grep -n 'sudo [a-z]' "${f}" 2>/dev/null | grep -v 'sudo /' | grep -v '^\s*#'
done | wc -l
# MUST return: 0 for Tier 1 scripts
```

---

## 11. Acceptance Criteria

- [ ] Zero unquoted `rm -rf $VAR` patterns; all `rm -rf` with variables have empty-check guards
- [ ] Zero `curl|bash` or `wget|sh` patterns (all use download-verify-execute)
- [ ] Zero `chmod 777` or `chmod 666` instances
- [ ] All installation/setup scripts use full paths with `sudo` (Tier 1)
- [ ] All modified scripts pass `bash -n` syntax check
- [ ] CWE-22, CWE-494, CWE-732, CWE-426 closure documented for audit trail

---

## 12. Overlap with Phase 6.2.08

Phase 6.2.08 (Supply Chain and Credential Security Remediation) executes BEFORE Phase 6.4.13 in the dependency graph. The following overlap exists for this file:

| This Subtask                   | Phase 6.2.08 Subtask                  | Overlap                                        | This File Action If 6.2.08 Complete                                        |
| ------------------------------ | ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| **13.5** (curl\|bash, CWE-494) | **6.2.8.2** (curl\|bash RCE, CWE-494) | IDENTICAL -- same 22 instances across 14 files | **VERIFICATION-ONLY**: Run detection, confirm 0 findings, document closure |
| 13.4 (rm -rf)                  | None                                  | No overlap                                     | Execute as written                                                         |
| 13.6 (chmod 777)               | None                                  | No overlap                                     | Execute as written                                                         |
| 13.7 (sudo paths)              | None                                  | No overlap                                     | Execute as written                                                         |

**Operational procedure:** Before beginning Subtask 13.5, check the Phase 6.2.08 completion status:

```bash
# Check if 6.2.8.2 was completed:
test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md && echo "6.2 COMPLETE"
# Also verify directly:
grep -rn 'curl.*|.*\(bash\|sh\)\|wget.*|.*\(bash\|sh\)' scripts/ --include='*.sh' | grep -v '^\s*#' | wc -l
# If returns 0: 6.2.8.2 is complete. Mark 13.5 as VERIFICATION-ONLY.
# If returns >0: Execute 13.5 remediation in full.
```

---

## 13. Traceability

| Subtask | Deficiency                                              | Standard                        | Files Affected                         | Verification Command                                                                                |
| ------- | ------------------------------------------------------- | ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 13.4    | `rm -rf` with unquoted/empty variables enables deletion | CWE-22, CWE-73, NASA/JPL Rule 1 | TBD files                              | `grep -rn 'rm -rf \$' scripts/ --include='*.sh' \| grep -v '^\s*#' \| wc -l` = 0                    |
| 13.5    | `curl\|bash` enables supply chain code execution        | CWE-494, CERT MSC33-C           | 14 files (22 instances)                | `grep -rn 'curl.*\|.*bash\|wget.*\|.*sh' scripts/ --include='*.sh' \| grep -v '^\s*#' \| wc -l` = 0 |
| 13.6    | `chmod 777/666` grants world-writable permissions       | CWE-732, CERT FIO06-C           | 2+ files (3+ instances)                | `grep -rn 'chmod 777\|chmod 666' scripts/ --include='*.sh' \| grep -v '^\s*#' \| wc -l` = 0         |
| 13.7    | `sudo` without full path enables PATH hijacking         | CWE-426, CERT ENV03-C           | 122 files (~1,017 instances, Tier 1/2) | Tier 1 verification: zero relative `sudo` in install/setup scripts                                  |

---

## 14. Execution Order Notes

**Position in critical path:** 12th (after 6.4.13a, before 6.4.13c)

```
... --> 6.4.13a (code execution) --> 6.4.13b (this file) --> 6.4.13c (runtime safety) --> 6.4.12 (CI)
```

**Full critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> 6.4.13a -> **6.4.13b** -> 6.4.13c -> 6.4.12

This file executes after Phase-6.4.13a because Subtask 13.4 (`rm -rf`) depends on variable quoting from 13.1 being resolved. This file executes before Phase-6.4.13c because permission hardening should precede runtime security posture work.

**Estimated effort:** 3-4 engineer-hours (13.5 may be verification-only if 6.2.08 is complete; 13.7 is highest volume but tiered).

---

```
END OF TASK DOCUMENT
Task:     6.4.13b - Permission and Credential Hardening (Subtasks 13.4 + 13.5 + 13.6 + 13.7)
Parent:   6.4.13 - Security-Critical Pattern Remediation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
