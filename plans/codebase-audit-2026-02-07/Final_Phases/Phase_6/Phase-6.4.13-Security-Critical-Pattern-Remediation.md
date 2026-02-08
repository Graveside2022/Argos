# Phase 6.4.13: Security-Critical Pattern Remediation

> **DECOMPOSED**: This monolithic document has been decomposed into 3 focused sub-task files for independent execution and tracking:
>
> - Phase-6.4.13a-Code-Execution-Prevention.md (Subtasks 13.1 + 13.2 + 13.3)
> - Phase-6.4.13b-Permission-Credential-Hardening.md (Subtasks 13.4 + 13.5 + 13.6 + 13.7)
> - Phase-6.4.13c-Runtime-Safety-Privilege-Management.md (Subtasks 13.8 + 13.9 + 13.10)
>   The sub-task files are the authoritative source. This file is retained for historical reference only.

**Document ID**: ARGOS-AUDIT-P6.4.13
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.13
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (security remediation -- addresses CWE-78, CWE-94, CWE-377, CWE-494, CWE-732, CWE-798)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Remediate all security-critical patterns in the shell script corpus that ShellCheck either does not detect or flags only at informational severity. Tasks 6.4.1 through 6.4.12 address structural quality (ShellCheck compliance, strict mode, headers, etc.). This task addresses **actual attack surfaces** in a field-deployed EW training platform where scripts run with elevated privileges.

**This task is the #1 security priority for the shell script corpus.** Without it, the Phase 6.4 standardization is structurally clean but leaves exploitable vulnerabilities in place.

This task comprises 10 subtasks (13.1 through 13.10), each addressing a distinct vulnerability class. The subtasks may be committed individually (one commit per subtask) due to the breadth of changes.

**Summary of security findings from independent audit:**

| Pattern                          | Instances               | Risk Level | CWE Reference |
| -------------------------------- | ----------------------- | ---------- | ------------- |
| SC2086 unquoted variables        | 220 across ~70 files    | HIGH       | CWE-78        |
| `eval` usage                     | 13 across 7 files       | CRITICAL   | CWE-94        |
| Backtick command substitution    | TBD                     | MEDIUM     | CWE-78        |
| `rm -rf` with unquoted variables | TBD                     | CRITICAL   | CWE-22        |
| `curl\|bash` / `wget\|sh`        | 22 across 14 files      | CRITICAL   | CWE-494       |
| `chmod 777` / `chmod 666`        | 3+ in 2+ files          | HIGH       | CWE-732       |
| `sudo` without full path         | ~1,017 across 122 files | MEDIUM     | CWE-426       |
| Hardcoded credentials            | 5 across 4 files        | CRITICAL   | CWE-798       |
| `NOPASSWD: /bin/kill *`          | 2 in 1 file             | CRITICAL   | CWE-269       |
| Unsafe `/tmp` usage              | 185 lines vs 3 mktemp   | HIGH       | CWE-377       |

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

- **Task 6.4.5 (Variable Quoting and Input Validation) MUST be complete.** Many security fixes overlap with quoting fixes. Subtask 13.1 (SC2086) is also tracked as Task 6.4.5.
- **Task 6.4.10 (Exit Code Conventions) MUST be complete.** Security remediation uses `EXIT_ERROR`, `EXIT_CONFIG` constants.
- **Task 6.4.6 (Trap and Cleanup Handlers) MUST be complete.** Subtask 13.10 (unsafe /tmp) depends on trap-based cleanup being in place.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                                      |
| ---------- | ---------- | ------ | --------------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.5  | Quoting overlaps with 13.1 (SC2086); must not duplicate work                |
| AFTER      | Upstream   | 6.4.10 | Exit code constants must be available for error handlers                    |
| AFTER      | Upstream   | 6.4.6  | Trap-based cleanup must be in place for 13.10 (unsafe /tmp)                 |
| AFTER      | Upstream   | 6.4.11 | Shared library functions (`log_error`, `require_cmd`) must be available     |
| BEFORE     | Downstream | 6.4.12 | CI enforcement must validate security patterns; cannot enforce before fixed |

---

## 4. Rollback Strategy

### Per-Subtask Commits

This task MAY be split into multiple commits (one per subtask 13.1-13.10) due to its breadth:

```
security(scripts): Phase 6.4.13.1 - SC2086 unquoted variable injection remediation
security(scripts): Phase 6.4.13.2 - eval arbitrary code execution remediation
security(scripts): Phase 6.4.13.3 - backtick command substitution modernization
security(scripts): Phase 6.4.13.4 - rm -rf path traversal prevention
security(scripts): Phase 6.4.13.5 - curl|bash supply chain attack remediation
security(scripts): Phase 6.4.13.6 - chmod 777 world-writable permission fix
security(scripts): Phase 6.4.13.7 - sudo full path validation
security(scripts): Phase 6.4.13.8 - hardcoded credential removal
security(scripts): Phase 6.4.13.9 - NOPASSWD sudoers restriction
security(scripts): Phase 6.4.13.10 - unsafe /tmp symlink attack prevention
```

This enables targeted rollback of any single subtask via `git revert <commit-sha>`.

### Rollback Decision Criteria

Immediate rollback if:

- Any service management script fails to start/stop its target service
- Installation scripts fail to install required packages
- Credential externalization breaks scripts in CI/Docker (no secrets.env available)
- `sudo` full-path conversion breaks on the target platform

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

## 9. Subtask 13.4: rm -rf with Unquoted or Unvalidated Variables

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

## 10. Subtask 13.5: curl|bash / wget|sh Patterns -- Supply Chain Attack Vector

**Priority:** 5
**Risk Level:** CRITICAL -- CWE-494 (Download of Code Without Integrity Check), CERT MSC33-C
**Instance Count:** 22 across 14 files

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

## 11. Subtask 13.6: chmod 777 / World-Writable File Permissions

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

## 12. Subtask 13.7: sudo Without Full Path Validation

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

## 13. Subtask 13.8: Hardcoded Credentials Removal

**Priority:** 8
**Risk Level:** CRITICAL -- CWE-798 (Use of Hard-Coded Credentials), CWE-259
**Instance Count:** 5 across 4 files

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

## 14. Subtask 13.9: NOPASSWD Sudoers Restriction

**Priority:** 9
**Risk Level:** CRITICAL -- CWE-269 (Improper Privilege Management), CWE-250
**Instance Count:** 2 in 1 file

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

## 15. Subtask 13.10: Unsafe /tmp Usage -- Symlink Attack Prevention

**Priority:** 10
**Risk Level:** HIGH -- CWE-377 (Insecure Temporary File), CWE-367 (TOCTOU), CERT FIO21-C
**Instance Count:** ~185 hardcoded /tmp paths vs 3 proper mktemp uses

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

## 16. ShellCheck Blind Spots: Manual Audit Requirements

ShellCheck's static analysis does not detect the following patterns. This section documents what ShellCheck **cannot detect** and the corresponding manual audit procedures required as part of this task.

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

## 17. Aggregate Verification Commands

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

## 18. Acceptance Criteria (Aggregate)

- [ ] Zero SC2086 (unquoted variable) instances from ShellCheck
- [ ] Zero `eval` with variable expansion (static eval requires documented justification)
- [ ] Zero backtick command substitutions
- [ ] Zero unquoted `rm -rf $VAR` patterns; all `rm -rf` with variables have empty-check guards
- [ ] Zero `curl|bash` or `wget|sh` patterns (all use download-verify-execute)
- [ ] Zero `chmod 777` or `chmod 666` instances
- [ ] All installation/setup scripts use full paths with `sudo` (Tier 1)
- [ ] Zero hardcoded credentials in script source
- [ ] Zero wildcard NOPASSWD sudoers entries
- [ ] All temp file creation uses `mktemp` (zero writes to hardcoded `/tmp/` paths)
- [ ] `gitleaks` or `trufflehog` scan produces zero findings against scripts/

---

## 19. Traceability

| Task   | Deficiency                                                                               | Standard                               | Files Affected                         | Verification Command                  |
| ------ | ---------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------- |
| 6.4.13 | Security-critical patterns not covered by ShellCheck (eval, curl\|bash, chmod 777, etc.) | CERT STR02-C, CWE-78, CWE-494, CWE-798 | All scripts (manual + automated audit) | See per-subtask verification commands |

---

## 20. Execution Order Notes

**Position in critical path:** 12th (after 6.4.10, before 6.4.12)

```
... --> 6.4.10 (exit codes) --> 6.4.13 (security) --> 6.4.12 (CI)
```

**Critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> 6.4.13 -> 6.4.12

This task executes after 6.4.5 (variable quoting) because many security fixes overlap with quoting fixes. Subtask 13.1 (SC2086 unquoted variables) is also tracked as Task 6.4.5 -- the two tasks share verification but differ in scope:

- **6.4.5:** Achieve zero ShellCheck findings (mechanical fix)
- **6.4.13.1:** Document the security impact and verify from a CWE/CERT perspective

This task MUST execute BEFORE 6.4.12 (CI) because CI enforces security patterns. CI cannot be enabled until all security patterns are remediated, or the CI job will fail and block all PRs.

**Estimated effort for this task alone:** 8-12 engineer-hours (the largest single task in Phase 6.4).

---

```
END OF TASK DOCUMENT
Task:     6.4.13 - Security-Critical Pattern Remediation
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
