> **DECOMPOSED**: This monolithic document has been decomposed into 3 focused sub-task files for independent execution and tracking:
>
> - Phase-6.2.08a-Credential-Token-Security.md (Sub-Tasks 6.2.8.1 + 6.2.8.4)
> - Phase-6.2.08b-Supply-Chain-Privilege-Hardening.md (Sub-Tasks 6.2.8.2 + 6.2.8.3)
> - Phase-6.2.08c-Network-Filesystem-Safety.md (Sub-Tasks 6.2.8.5 + 6.2.8.6)
>   The sub-task files are the authoritative source. This file is retained for historical reference only.

# Phase 6.2.08: Supply Chain and Credential Security Remediation

**Document ID**: ARGOS-AUDIT-P6.2.08
**Parent Document**: Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md
**Original Task ID**: 6.2.8
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks, CWE-798, CWE-377, CWE-829, NIST SP 800-218 PW.4.1, DISA STIG V-230380, CIS Benchmark 5.3

---

## 1. Objective

Remediate 331 security finding instances across 6 categories (2 CRITICAL, 4 HIGH) identified by the independent audit (2026-02-08). These findings affect both scripts being archived AND scripts being KEPT, so they must be addressed in the surviving 114 scripts. Consolidation without security remediation means the reduced script set inherits the worst security posture of all 202 originals.

**Priority**: CRITICAL -- These must be remediated either before or concurrent with consolidation tasks 6.2.1-6.2.7. Do NOT mark Phase 6.2 as complete until all subtasks in this section pass verification.

### Security Finding Summary

| Sub-Task  | Category               | Severity | Instance Count | Files Affected | Estimated Effort |
| --------- | ---------------------- | -------- | -------------- | -------------- | ---------------- |
| 6.2.8.1   | Hardcoded API Tokens   | CRITICAL | 2              | 2              | 0.5 hours        |
| 6.2.8.2   | curl\|bash RCE Vectors | CRITICAL | 22+            | 14+            | 4 hours          |
| 6.2.8.3   | NOPASSWD /bin/kill \*  | CRITICAL | 2              | 1              | 0.5 hours        |
| 6.2.8.4   | Hardcoded Passwords    | HIGH     | 3+             | 3+             | 1 hour           |
| 6.2.8.5   | Hardcoded IP Addresses | HIGH     | 55             | ~20            | 3 hours          |
| 6.2.8.6   | Unsafe /tmp Usage      | HIGH     | 185            | ~50            | 6 hours          |
| **TOTAL** |                        |          | **269+**       |                | **15 hours**     |

**NOTE**: Instance counts above reflect the pre-archival state (202 scripts). After Tasks 6.2.1-6.2.7 archive ~88 scripts, the surviving instance counts for 6.2.8.2, 6.2.8.5, and 6.2.8.6 will be lower. The total of 331 cited in the header includes duplicate-directory instances that will be eliminated by archiving.

---

## 2. Prerequisites

1. **Phase 5 complete** (architecture decomposition).
2. **Phase 6.1 complete** (dead code removal).
3. **Phase 6.3 (`argos-env.sh`) recommended** -- IP externalization (Sub-Task 6.2.8.5) has significant overlap with Phase 6.3 centralized path variables. Coordinate to avoid double-work.
4. **Sub-Tasks 6.2.8.1 and 6.2.8.3 MUST execute BEFORE consolidation Tasks 6.2.1-6.2.7** -- immediate credential/privilege escalation risk.
5. **Sub-Tasks 6.2.8.2, 6.2.8.5, 6.2.8.6 should execute AFTER consolidation Tasks 6.2.1-6.2.7** -- archiving reduces the remediation scope.
6. **OpenCellID account access** required for token rotation (Sub-Task 6.2.8.1).

---

## 3. Dependencies

| Dependency                       | Direction                                 | Description                                                            |
| -------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Sub-Task 6.2.8.1 (API Tokens)    | BLOCKS Tasks 6.2.1-6.2.7                  | Token rotation has external dependency; execute first                  |
| Sub-Task 6.2.8.3 (NOPASSWD kill) | BLOCKS Tasks 6.2.1-6.2.7                  | Immediate privilege escalation risk                                    |
| Sub-Task 6.2.8.4 (Passwords)     | Can parallel with 6.2.8.3                 |                                                                        |
| Tasks 6.2.1-6.2.7                | BLOCK Sub-Tasks 6.2.8.2, 6.2.8.5, 6.2.8.6 | Archiving reduces scope; only remediate surviving scripts              |
| Phase 6.3                        | Cross-reference                           | IP externalization (6.2.8.5) overlaps with Phase 6.3 centralized paths |

---

## 4. Rollback Strategy

**CRITICAL**: Security remediations modify files in-place (unlike consolidation tasks which archive). Rollback requires git:

```bash
# If a security remediation introduces a regression, revert the specific file:
git checkout HEAD~1 -- scripts/<modified-file>.sh

# Or restore from the pre-execution snapshot:
sha256sum scripts/<modified-file>.sh
grep "<modified-file>" scripts/_archived/phase-6.2/CHECKSUMS-BEFORE.txt
# If checksums differ, the file was modified by this task.
# Restore original from git history or CHECKSUMS-BEFORE.txt reference.
```

**NOTE**: Token rotation (Sub-Task 6.2.8.1) CANNOT be rolled back -- once rotated, the old token is invalidated. Document the new token securely.

---

## 5. Production-Critical Script Protection

Several production-critical scripts contain security findings that must be remediated IN PLACE (not archived). The following scripts will be MODIFIED by this task:

| Script                                | Security Finding              | Sub-Task |
| ------------------------------------- | ----------------------------- | -------- |
| `scripts/setup-droneid-sudoers.sh`    | NOPASSWD /bin/kill \*         | 6.2.8.3  |
| `scripts/configure-openwebrx-b205.sh` | Hardcoded password 'argos123' | 6.2.8.4  |
| `scripts/install-openwebrx-hackrf.sh` | Hardcoded password 'hackrf'   | 6.2.8.4  |
| `scripts/download-opencellid-full.sh` | Hardcoded API token           | 6.2.8.1  |
| `scripts/setup-opencellid-full.sh`    | Hardcoded API token           | 6.2.8.1  |

**Verification** (run after each sub-task to confirm scripts still function):

```bash
# Syntax check all modified scripts
for f in setup-droneid-sudoers.sh configure-openwebrx-b205.sh install-openwebrx-hackrf.sh \
  download-opencellid-full.sh setup-opencellid-full.sh; do
  bash -n "scripts/$f" && echo "PASS: $f syntax" || echo "FAIL: $f syntax error"
done
```

---

## 6. Task Details

### 6.2.8.1 CRITICAL: Hardcoded API Tokens (2 instances)

**Description**: Two shell scripts contain a hardcoded OpenCellID API token in plain text. This token is committed to version control and must be considered compromised.

**Standards Violated**: CERT C MSC41-C, CWE-798. Secrets must never be hardcoded in version-controlled files.

**Detection Command**:

```bash
grep -rn 'API_KEY=.*"pk\.' scripts/ --include='*.sh' | grep -v '_archived'
# Verified output (2026-02-08):
#   scripts/download-opencellid-full.sh:6:API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
#   scripts/setup-opencellid-full.sh:4:API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
```

**Count**: 2 instances in 2 files.

**Remediation**:

1. Replace hardcoded token with environment variable lookup:

    ```bash
    # BEFORE (vulnerable):
    API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"

    # AFTER (remediated):
    API_KEY="${OPENCELLID_API_KEY:?ERROR: OPENCELLID_API_KEY not set. Export it or add to .env}"
    ```

2. Add `OPENCELLID_API_KEY` to the project `.env.example` with a placeholder value.
3. **Rotate the exposed token immediately** at https://opencellid.org -- the current token must be considered compromised since it exists in git history.
4. Add `**/scripts/**/*.key` and `**/scripts/**/*.token` patterns to `.gitignore` as a defense-in-depth measure.

**Verification Command**:

```bash
# Zero hardcoded tokens:
grep -rn 'pk\.d6291c07a2907c915cd8994fb22bc189' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0

# Both files now use env var:
grep -rn 'OPENCELLID_API_KEY' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return >= 2 (both files now use env var)
```

**Acceptance Criteria**: Zero hardcoded API tokens in any non-archived script. Token rotated. `.env.example` updated.

---

### 6.2.8.2 CRITICAL: curl|bash Remote Code Execution Vectors (22+ instances)

**Description**: Multiple scripts download remote content and pipe it directly to a shell interpreter (`curl ... | bash`, `curl ... | sh`, `wget ... | bash`). This is a supply chain attack vector -- a compromised or MITM'd upstream server can execute arbitrary code as root (many use `sudo`).

**Standards Violated**: NASA/JPL Rule 1 (simple control flow), NIST SP 800-218 PW.4.1.

**Detection Command**:

```bash
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | grep -v '_archived' | grep -v '#'
# Count:
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | grep -v '_archived' | grep -v '#' | wc -l
# Verified count (2026-02-08): 22+ instances across 14+ files
```

**Count**: 22+ instances across 14+ files (exact count varies as some are in duplicate directories being archived).

**Known Affected Files** (examples):

- `scripts/install-argos.sh:113` -- `curl ... | sudo -E bash -`
- `scripts/setup-host-complete.sh:99` -- `curl -fsSL https://get.docker.com | sh`
- `scripts/install-system-dependencies.sh` -- multiple instances
- `scripts/install/quick-install.sh:102` -- `curl ... | bash`

**Remediation**:

For each `curl|bash` pattern, replace with the download-then-verify pattern:

```bash
# BEFORE (vulnerable):
curl -fsSL https://get.docker.com | sh

# AFTER (remediated):
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
curl -fsSL -o "$TMPFILE" https://get.docker.com
# Verify checksum if available (Docker publishes GPG signatures):
# gpg --verify "$TMPFILE.asc" "$TMPFILE" || { echo "GPG verification failed"; exit 1; }
chmod +x "$TMPFILE"
sh "$TMPFILE"
```

For scripts where upstream checksums/signatures are not available, at minimum:

1. Download to a temp file (not pipe to shell).
2. Log the SHA256 of the downloaded file before execution.
3. Set `set -euo pipefail` so failures are caught.

**Priority by file**:

- Scripts in `deploy/`, `development/`, `testing/`, `maintenance/` are being ARCHIVED (Task 6.2.1) -- remediate ONLY in the canonical copies that survive.
- Focus on the ~8-10 surviving scripts that contain this pattern (install-argos.sh, setup-host-complete.sh, install-system-dependencies.sh, etc.).

**Verification Command**:

```bash
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: Zero `curl|bash` or `wget|bash` patterns in any non-archived script.

---

### 6.2.8.3 CRITICAL: NOPASSWD Sudoers for /bin/kill \* (1 file, 2 rules)

**Description**: `scripts/setup-droneid-sudoers.sh` lines 22 and 32 grant `NOPASSWD: /bin/kill *` to the `ubuntu` and `node` users respectively. The wildcard `*` allows sending any signal to ANY process on the system without authentication. `kill -9 1` would crash the entire system. `kill -STOP` on sshd would lock out remote access.

**Standards Violated**: CIS Benchmark 5.3, DISA STIG V-230380.

**Detection Command**:

```bash
grep -rn 'NOPASSWD.*\/bin\/kill \*' scripts/ --include='*.sh' | grep -v '_archived'
# Verified output (2026-02-08):
#   scripts/setup-droneid-sudoers.sh:22:ubuntu ALL=(ALL) NOPASSWD: /bin/kill *
#   scripts/setup-droneid-sudoers.sh:32:node ALL=(ALL) NOPASSWD: /bin/kill *
```

**Count**: 2 rules in 1 file.

**Remediation**:

Replace the unrestricted `/bin/kill *` with specific, scoped alternatives:

```bash
# BEFORE (vulnerable):
ubuntu ALL=(ALL) NOPASSWD: /bin/kill *

# OPTION A -- Restrict to specific signal and process pattern:
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f dronesniffer/main.py

# OPTION B -- Use systemctl for service management (preferred):
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop droneid.service
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart droneid.service
```

Additionally, the same file (line 23, 33) grants `NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh` which is a secondary risk (arbitrary code execution via temp file replacement). Replace with a fixed path:

```bash
# BEFORE:
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh
# AFTER:
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /opt/argos/scripts/start-droneid.sh
```

**Verification Command**:

```bash
# Zero unrestricted kill rules:
grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0

# Zero NOPASSWD rules referencing /tmp/:
grep -rn 'NOPASSWD.*/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: No unrestricted `/bin/kill *` NOPASSWD rules. No NOPASSWD rules referencing `/tmp/` paths.

---

### 6.2.8.4 HIGH: Hardcoded Admin Passwords (3+ instances)

**Description**: Shell scripts contain plaintext admin passwords for service configuration. These are committed to version control and are visible to anyone with repository access.

**Standards Violated**: CWE-798 (Hardcoded Credentials), NIST SP 800-218 PW.4.1.

**Detection Command**:

```bash
# Specific known instances:
grep -rn "argos123\|'hackrf'\|\"admin\"" scripts/ --include='*.sh' | grep -vi 'echo\|print\|#' | grep -v '_archived'
# Broader search for password assignments:
grep -rn 'PASSWORD=\|password.*=' scripts/ --include='*.sh' | grep -v '#' | grep -v '_archived' | \
  grep -v '""' | grep -v "=''" | grep -v '\${'
# Verified instances (2026-02-08):
#   scripts/configure-openwebrx-b205.sh:21  -- OWRX_ADMIN_PASSWORD = 'argos123'
#   scripts/configure-openwebrx-b205.sh:26  -- userlist.addUser('admin', 'argos123')
#   scripts/install-openwebrx-hackrf.sh:210 -- admin_password = hackrf
#   scripts/final-usrp-setup.sh:45          -- "password": "admin"
#   scripts/argos-wifi-resilience.sh:295    -- WIFI_PASSWORD="YourNetworkPassword" (placeholder but dangerous pattern)
```

**Count**: 3 confirmed hardcoded passwords + 1 placeholder password pattern in 4 files. Note: `final-usrp-setup.sh` is being archived in Task 6.2.7, but the other 3 files SURVIVE consolidation.

**Remediation**:

For shell scripts:

```bash
# BEFORE (vulnerable):
ADMIN_PASSWORD="argos123"

# AFTER (remediated):
ADMIN_PASSWORD="${OWRX_ADMIN_PASSWORD:?ERROR: OWRX_ADMIN_PASSWORD not set. Export it or add to .env}"
```

For Python-in-shell (configure-openwebrx-b205.sh contains Python code):

```bash
# BEFORE (vulnerable):
os.environ['OWRX_ADMIN_PASSWORD'] = 'argos123'

# AFTER (remediated):
os.environ['OWRX_ADMIN_PASSWORD'] = os.environ.get('OWRX_ADMIN_PASSWORD', '')
if not os.environ['OWRX_ADMIN_PASSWORD']:
    print("ERROR: OWRX_ADMIN_PASSWORD not set")
    sys.exit(1)
```

For each surviving file:

1. Replace hardcoded password with `${VARNAME:?ERROR: VARNAME not set}` pattern.
2. Add the variable to `.env.example` with a placeholder.
3. Document the required environment variables in the script header comment.

**Verification Command**:

```bash
grep -rn "argos123\|password.*=.*hackrf\|password.*=.*admin" scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: Zero plaintext passwords in any non-archived script. All password values sourced from environment variables or secure credential store.

---

### 6.2.8.5 HIGH: Hardcoded Tailscale/Internal IP Addresses (55 instances)

**Description**: 55 instances of hardcoded IP addresses (excluding 127.0.0.1, 0.0.0.0, and broadcast addresses) exist across shell scripts. These include Tailscale VPN IPs (100.x.x.x range), internal LAN IPs, and other infrastructure addresses. For a military EW training platform, hardcoded IPs are an OPSEC violation -- they leak network topology and are non-portable across deployment environments.

**Detection Command**:

```bash
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l
# Verified count (2026-02-08): 55

# To see the actual unique IPs:
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | \
  grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}' | sort -u
```

**Count**: 55 instances across multiple files.

**Remediation**:

1. Create a centralized network configuration file (aligns with Phase 6.3 `argos-env.sh`):

    ```bash
    # In argos-env.sh (Phase 6.3):
    export ARGOS_TAILSCALE_IP="${ARGOS_TAILSCALE_IP:-}"
    export ARGOS_LAN_IP="${ARGOS_LAN_IP:-}"
    export ARGOS_REMOTE_HOST="${ARGOS_REMOTE_HOST:-}"
    ```

2. Replace each hardcoded IP with the corresponding environment variable.
3. For scripts being archived, no action needed (they are eliminated).
4. Focus on surviving scripts -- after Task 6.2.1-6.2.7 archiving, re-count to get the surviving instance count.

**Post-Archival Scope Reduction**:

After Tasks 6.2.1-6.2.7 archive ~88 scripts, many of the 55 instances will be in archived files. Run the detection command again after archiving to determine the surviving count (estimated: ~25-35 instances in surviving scripts).

**Verification Command**:

```bash
# Post-archival count (run after all consolidation tasks):
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l
# ACCEPTANCE: must return 0 (all IPs externalized to env vars or argos-env.sh)
```

**Acceptance Criteria**: Zero hardcoded non-loopback IP addresses in any non-archived script. All IPs sourced from environment variables or `argos-env.sh` configuration.

**NOTE**: This sub-task has significant overlap with Phase 6.3 (Hardcoded Path Remediation). Coordinate execution to avoid double-work. IP externalization can be done in the same pass as path variable externalization.

---

### 6.2.8.6 HIGH: Unsafe /tmp Usage (185 instances vs. 4 mktemp uses)

**Description**: 185 references to `/tmp/` with predictable, hardcoded filenames. Only 4 scripts in the entire codebase use `mktemp` for safe temporary file creation. On multi-user systems, hardcoded `/tmp/` paths are vulnerable to symlink attacks (CWE-377) -- an attacker can create a symlink at the expected path pointing to a sensitive file, causing the script to overwrite or read the wrong file.

**Standards Violated**: CWE-377, CERT C FIO43-C.

**Detection Command**:

```bash
# Count all /tmp/ references:
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# Verified count (2026-02-08): 185

# Count safe mktemp usage:
grep -rn 'mktemp' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# Verified count (2026-02-08): 4

# Identify the most dangerous patterns (write to /tmp with predictable names):
grep -rn '>/tmp/\|>>/tmp/\|mv.*\/tmp\/\|cp.*\/tmp\/' scripts/ --include='*.sh' | grep -v '_archived'
```

**Count**: 185 `/tmp/` instances; only 4 `mktemp` uses. Ratio: 46:1 unsafe-to-safe.

**Remediation**:

For each script that writes to `/tmp/`:

```bash
# BEFORE (vulnerable):
echo "$data" > /tmp/hackrf-status.txt
LOGFILE=/tmp/gsm-evil.log

# AFTER (remediated):
TMPDIR=$(mktemp -d "${TMPDIR:-/tmp}/argos-XXXXXX")
trap 'rm -rf "$TMPDIR"' EXIT
echo "$data" > "$TMPDIR/hackrf-status.txt"
LOGFILE="$TMPDIR/gsm-evil.log"
```

**Priority tiers** (remediate in this order):

1. **Tier 1 -- Scripts that write as root** (`sudo` + `/tmp/`): Highest symlink attack risk.
2. **Tier 2 -- Scripts that write sensitive data** (logs, credentials, configs) to `/tmp/`.
3. **Tier 3 -- Scripts that only read from `/tmp/`**: Lower risk but still non-portable.

**Post-Archival Scope Reduction**:

Many of the 185 instances are in scripts being archived (Tasks 6.2.1-6.2.2). After archiving, re-count to determine the surviving instance count. Estimate: ~80-100 instances will survive in the 114 retained scripts.

**Verification Command**:

```bash
# Post-remediation check (run after all tasks complete):
# Count remaining hardcoded /tmp/ paths (should be replaced with mktemp or $TMPDIR):
grep -rn '/tmp/' scripts/ --include='*.sh' | grep -v '_archived' | grep -v 'mktemp\|TMPDIR\|#' | wc -l
# ACCEPTANCE: must return 0

# Count mktemp usage (should be >= 1 per script that needs temp files):
grep -rn 'mktemp' scripts/ --include='*.sh' | grep -v '_archived' | wc -l
# ACCEPTANCE: must be >= 20 (replacing the ~80-100 surviving hardcoded patterns)
```

**Acceptance Criteria**: Zero hardcoded `/tmp/filename` patterns in any non-archived script. All temporary file creation uses `mktemp` or `mktemp -d` with trap-based cleanup.

---

## 7. Post-Execution Verification

### 7.1 Complete Security Verification Script

Run all verification commands sequentially after all 6 sub-tasks are complete:

```bash
#!/bin/bash
# Phase 6.2.8 Security Remediation Verification
# Run from project root after all sub-tasks complete

PASS=0
FAIL=0

echo "=== 6.2.8.1: Hardcoded API Tokens ==="
count=$(grep -rn 'pk\.d6291c07a2907c915cd8994fb22bc189' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded API tokens"; ((PASS++)); else echo "FAIL: $count hardcoded API tokens remain"; ((FAIL++)); fi

count=$(grep -rn 'OPENCELLID_API_KEY' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -ge 2 ]; then echo "PASS: $count files use env var"; ((PASS++)); else echo "FAIL: Only $count files use env var (need >= 2)"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.2: curl|bash RCE Vectors ==="
count=$(grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | grep -v '#' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero curl|bash patterns"; ((PASS++)); else echo "FAIL: $count curl|bash patterns remain"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.3: NOPASSWD /bin/kill * ==="
count=$(grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero unrestricted kill rules"; ((PASS++)); else echo "FAIL: $count unrestricted kill rules remain"; ((FAIL++)); fi

count=$(grep -rn 'NOPASSWD.*/tmp/' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero NOPASSWD /tmp rules"; ((PASS++)); else echo "FAIL: $count NOPASSWD /tmp rules remain"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.4: Hardcoded Passwords ==="
count=$(grep -rn "argos123\|password.*=.*hackrf\|password.*=.*admin" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | grep -v '#' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded passwords"; ((PASS++)); else echo "FAIL: $count hardcoded passwords remain"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.5: Hardcoded IP Addresses ==="
count=$(grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' 2>/dev/null | grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded IPs"; ((PASS++)); else echo "FAIL: $count hardcoded IPs remain"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.6: Unsafe /tmp Usage ==="
count=$(grep -rn '/tmp/' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | grep -v 'mktemp\|TMPDIR\|#' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded /tmp paths"; ((PASS++)); else echo "FAIL: $count hardcoded /tmp paths remain"; ((FAIL++)); fi

mktemp_count=$(grep -rn 'mktemp' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$mktemp_count" -ge 20 ]; then echo "PASS: $mktemp_count mktemp usages (>= 20)"; ((PASS++)); else echo "WARN: Only $mktemp_count mktemp usages (target: >= 20)"; fi

echo ""
echo "=== SUMMARY ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "STATUS: ALL SECURITY CHECKS PASSED"
else
  echo "STATUS: $FAIL CHECKS FAILED -- DO NOT MARK PHASE 6.2 COMPLETE"
fi
```

### 7.2 Syntax Check All Modified Scripts

```bash
# After security remediation, verify all modified scripts still parse correctly:
for f in $(find scripts/ -name '*.sh' -not -path '*_archived*'); do
  bash -n "$f" 2>/dev/null || echo "SYNTAX ERROR: $f"
done
# EXPECTED: no output (all scripts parse)
```

---

## 8. Metrics

| Metric                           | Value                                     |
| -------------------------------- | ----------------------------------------- |
| Total Security Finding Instances | 331 (pre-archival), ~269+ (post-archival) |
| CRITICAL Findings                | 3 sub-tasks (6.2.8.1, 6.2.8.2, 6.2.8.3)   |
| HIGH Findings                    | 3 sub-tasks (6.2.8.4, 6.2.8.5, 6.2.8.6)   |
| Files Modified (in-place)        | ~30-50 surviving scripts                  |
| Files Created                    | 0 (modifications only)                    |
| Estimated Effort                 | 15 engineer-hours                         |
| External Dependency              | OpenCellID token rotation (6.2.8.1)       |

---

## 9. Acceptance Criteria

From parent document Section 18 (items 9-16), specific to this task:

1. **Zero hardcoded API tokens** in non-archived scripts (Section 7.1 check 6.2.8.1).
2. **Zero `curl|bash` or `wget|bash` patterns** in non-archived scripts (Section 7.1 check 6.2.8.2).
3. **Zero unrestricted `/bin/kill *` NOPASSWD rules** in non-archived scripts (Section 7.1 check 6.2.8.3).
4. **Zero NOPASSWD rules referencing `/tmp/` paths** in non-archived scripts (Section 7.1 check 6.2.8.3).
5. **Zero hardcoded plaintext passwords** in non-archived scripts (Section 7.1 check 6.2.8.4).
6. **Zero hardcoded non-loopback IP addresses** in non-archived scripts (Section 7.1 check 6.2.8.5).
7. **Zero hardcoded `/tmp/filename` patterns** in non-archived scripts (Section 7.1 check 6.2.8.6).
8. **OpenCellID API token rotated** and old token invalidated.
9. **`.env.example` updated** with all externalized variables (OPENCELLID_API_KEY, OWRX_ADMIN_PASSWORD, etc.).
10. **All modified scripts pass `bash -n` syntax check** (Section 7.2).
11. **Security verification script** (Section 7.1) returns "ALL SECURITY CHECKS PASSED".

---

## 10. Traceability

### Task 6.2.8: Security Remediation -- Finding-to-Remediation Map

| Finding ID | Category             | Severity | File(s) Affected                                      | Remediation Pattern                     | Verified By                              |
| ---------- | -------------------- | -------- | ----------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| 6.2.8.1    | Hardcoded API Token  | CRITICAL | download-opencellid-full.sh, setup-opencellid-full.sh | `${OPENCELLID_API_KEY:?...}` env var    | grep for `pk.d629...` returns 0          |
| 6.2.8.2    | curl\|bash RCE       | CRITICAL | ~8-10 surviving install/setup scripts                 | Download-then-verify pattern            | grep for `curl.*\|.*bash` returns 0      |
| 6.2.8.3a   | NOPASSWD kill \*     | CRITICAL | setup-droneid-sudoers.sh:22,32                        | Replace with systemctl or pkill -f      | grep for `/bin/kill \*` returns 0        |
| 6.2.8.3b   | NOPASSWD /tmp/       | CRITICAL | setup-droneid-sudoers.sh:23,33                        | Replace /tmp/ path with /opt/argos/     | grep for `NOPASSWD.*/tmp/` returns 0     |
| 6.2.8.4a   | Hardcoded password   | HIGH     | configure-openwebrx-b205.sh:21,26                     | `${OWRX_ADMIN_PASSWORD:?...}` env var   | grep for `argos123` returns 0            |
| 6.2.8.4b   | Hardcoded password   | HIGH     | install-openwebrx-hackrf.sh:210                       | `${HACKRF_ADMIN_PASSWORD:?...}` env var | grep for `password.*hackrf` returns 0    |
| 6.2.8.4c   | Hardcoded password   | HIGH     | final-usrp-setup.sh:45                                | File archived in Task 6.2.7             | N/A (archived)                           |
| 6.2.8.4d   | Placeholder password | HIGH     | argos-wifi-resilience.sh:295                          | `${WIFI_PASSWORD:?...}` env var         | grep for `YourNetworkPassword` returns 0 |
| 6.2.8.5    | Hardcoded IPs        | HIGH     | ~20 files, 55 instances                               | Env vars via argos-env.sh               | IP regex grep returns 0                  |
| 6.2.8.6    | Unsafe /tmp          | HIGH     | ~50 files, 185 instances                              | mktemp -d with trap cleanup             | /tmp/ grep (excl. mktemp) returns 0      |

### Independent Audit Cross-Reference

| Audit Finding ID                              | This Document Sub-Task | Status    |
| --------------------------------------------- | ---------------------- | --------- |
| CRITICAL-S1 (Hardcoded OpenCellID API Tokens) | 6.2.8.1                | Addressed |
| CRITICAL-S2 (curl\|bash RCE Vectors)          | 6.2.8.2                | Addressed |
| CRITICAL-S3 (NOPASSWD /bin/kill \*)           | 6.2.8.3                | Addressed |
| HIGH-S4 (Hardcoded Admin Passwords)           | 6.2.8.4                | Addressed |
| HIGH-S5 (Hardcoded Tailscale/Internal IPs)    | 6.2.8.5                | Addressed |
| HIGH-S6 (Unsafe /tmp Usage)                   | 6.2.8.6                | Addressed |

---

## 11. Execution Order Notes

### 11.1 Internal Execution Order (Within Task 6.2.8)

```
Sub-Task 6.2.8.1 (API Tokens)      -- Execute FIRST (token rotation has external dependency)
    |
Sub-Task 6.2.8.3 (NOPASSWD kill)   -- Execute SECOND (immediate privilege escalation risk)
    |
Sub-Task 6.2.8.4 (Passwords)       -- Can parallel with 6.2.8.3
    |
Tasks 6.2.1-6.2.7                  -- Consolidation tasks (archives reduce the scope of 6.2.8.2, 6.2.8.5, 6.2.8.6)
    |
Sub-Task 6.2.8.2 (curl|bash)       -- Execute AFTER archiving (only remediate surviving scripts)
    |
Sub-Task 6.2.8.5 (Hardcoded IPs)   -- Execute AFTER archiving, coordinate with Phase 6.3
    |
Sub-Task 6.2.8.6 (Unsafe /tmp)     -- Execute AFTER archiving (only remediate surviving scripts)
    |
    v
Verification Checklist (Section 7)
```

### 11.2 Integration with Parent Task Order

From parent document Section 16:

```
Task 6.2.8.1 (API Tokens)        -- Execute BEFORE consolidation
Task 6.2.8.3 (NOPASSWD kill)     -- Execute BEFORE consolidation
Task 6.2.8.4 (Passwords)         -- Execute BEFORE or during consolidation
    |
Task 6.2.1 (Duplicate Dirs)      -- No dependencies, execute first among consolidation
    |
    v
Task 6.2.2 (GSM)                 -- Depends on 6.2.1
    |
Task 6.2.3 (Kismet)              -- Independent of 6.2.2, can run in parallel
    |
Task 6.2.4 (WiFi)                -- Independent of 6.2.2-6.2.3, can run in parallel
    |
Task 6.2.5 (Keepalive)           -- Independent
    |
Task 6.2.6 (Install)             -- Depends on 6.2.1
    |
Task 6.2.7 (Remaining)           -- Depends on 6.2.1-6.2.6
    |
    v
Task 6.2.8.2 (curl|bash)         -- Execute AFTER all archiving complete
Task 6.2.8.5 (Hardcoded IPs)     -- Execute AFTER all archiving, coordinate with Phase 6.3
Task 6.2.8.6 (Unsafe /tmp)       -- Execute AFTER all archiving complete
    |
    v
Verification Checklist            -- ALL checks must pass
```

**Minimum critical path**: 6.2.8.1 + 6.2.8.3 -> 6.2.1 -> 6.2.2 || 6.2.3 || 6.2.4 || 6.2.5 -> 6.2.6 -> 6.2.7 -> 6.2.8.2 + 6.2.8.5 + 6.2.8.6 -> Verify

---

## APPENDIX A: Independent Audit Security Findings -- Raw Data (2026-02-08)

> **NOTE**: This appendix preserves the original independent audit findings for traceability. The actionable remediation plan is in **Section 6 (Sub-Tasks 6.2.8.1-6.2.8.6)**, which supersedes this appendix with full detection commands, remediation steps, and verification criteria.

### CRITICAL-S1: Hardcoded OpenCellID API Tokens (2 instances)

| File                                  | Line | Content                                         |
| ------------------------------------- | ---- | ----------------------------------------------- |
| `scripts/download-opencellid-full.sh` | 6    | `API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"` |
| `scripts/setup-opencellid-full.sh`    | 4    | `API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"` |

**Standard Violated**: CERT C MSC41-C, CWE-798. Secrets must never be hardcoded in version-controlled files.
**Required Action**: Externalize to environment variable or `.env` file. Rotate the exposed token immediately.

### CRITICAL-S2: curl|bash Remote Code Execution Vectors (22 instances across 14 files)

Twenty-two shell scripts download and pipe remote content directly to a shell interpreter. This is a supply chain attack vector.

**Examples**:

- `scripts/install-argos.sh:113` -- `curl ... | sudo -E bash -`
- `scripts/setup-host-complete.sh:99` -- `curl -fsSL https://get.docker.com | sh`
- `scripts/deploy/quick-install.sh:102` -- `curl ... | bash`

**Standard Violated**: NASA/JPL Rule 1 (simple control flow), NIST SP 800-218 PW.4.1.
**Required Action**: Replace with download-then-verify pattern: download to temp file, verify checksum/GPG signature, then execute.

### CRITICAL-S3: NOPASSWD Sudoers for /bin/kill \*

**File**: `scripts/setup-droneid-sudoers.sh:22,32`
**Finding**: Grants `ubuntu ALL=(ALL) NOPASSWD: /bin/kill *` and `node ALL=(ALL) NOPASSWD: /bin/kill *`. Allows any signal to any process without authentication. `kill -9 1` would crash the system.
**Standard Violated**: CIS Benchmark 5.3, DISA STIG V-230380.
**Required Action**: Restrict to specific PIDs or use `systemctl` for service management instead.

### HIGH-S4: Hardcoded Admin Passwords (3 instances)

| File                                  | Password   |
| ------------------------------------- | ---------- |
| `scripts/configure-openwebrx-b205.sh` | `argos123` |
| `scripts/install-openwebrx-hackrf.sh` | `hackrf`   |
| `scripts/final-usrp-setup.sh`         | `admin`    |

**Required Action**: Externalize to environment variables. Never commit passwords to version control.

### HIGH-S5: Hardcoded Tailscale/Internal IP Addresses (55 instances)

Multiple Tailscale VPN IPs (100.79.154.94, 100.68.185.86, etc.) and internal LAN IPs hardcoded across scripts. These leak network topology and are an OPSEC violation for military deployment.
**Required Action**: Externalize all IP addresses to configuration file or environment variables.

### HIGH-S6: Unsafe /tmp Usage (185 instances vs. 4 mktemp uses)

185 references to `/tmp/` with predictable filenames. Only 4 scripts use `mktemp` for safe temporary file creation. Symlink attack vector on multi-user systems.
**Standard Violated**: CWE-377, CERT C FIO43-C.
**Required Action**: Replace all hardcoded `/tmp/` paths with `mktemp -d` patterns.

---

END OF DOCUMENT
