# Phase 6.2.08b: Supply Chain and Privilege Escalation Hardening

**Document ID**: ARGOS-AUDIT-P6.2.08b
**Parent Document**: Phase-6.2.08-Security-Remediation.md (ARGOS-AUDIT-P6.2.08)
**Original Task IDs**: 6.2.8.2, 6.2.8.3
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (both sub-tasks)
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CIS Benchmarks 5.3, CWE-829, NIST SP 800-218 PW.4.1, DISA STIG V-230380, NASA/JPL Rule 1

---

## 1. Objective

Eliminate privilege escalation and remote code execution vectors in shell scripts. This file covers two CRITICAL sub-tasks that both enable arbitrary code execution -- one through supply chain compromise (curl|bash), the other through unrestricted sudoers rules (NOPASSWD /bin/kill \*).

**Scope**: Sub-Task 6.2.8.2 (curl|bash Remote Code Execution -- CRITICAL, 22+ instances) and Sub-Task 6.2.8.3 (NOPASSWD /bin/kill \* -- CRITICAL, 2 rules in 1 file).

**Coupling Rationale**: Both sub-tasks are privilege escalation / remote code execution vectors. Both allow an attacker to execute arbitrary commands with elevated privileges. Sub-Task 6.2.8.3 is an immediate local privilege escalation (must execute before consolidation), while Sub-Task 6.2.8.2 is a supply chain RCE vector best addressed after consolidation reduces scope.

### Security Finding Summary (This File)

| Sub-Task  | Category               | Severity | Instance Count | Files Affected | Estimated Effort |
| --------- | ---------------------- | -------- | -------------- | -------------- | ---------------- |
| 6.2.8.2   | curl\|bash RCE Vectors | CRITICAL | 22+            | 14+            | 4 hours          |
| 6.2.8.3   | NOPASSWD /bin/kill \*  | CRITICAL | 2              | 1              | 0.5 hours        |
| **TOTAL** |                        |          | **24+**        | **15+**        | **4.5 hours**    |

---

## 2. Prerequisites

1. **Phase 5 complete** (architecture decomposition).
2. **Phase 6.1 complete** (dead code removal).
3. **Sub-Task 6.2.8.3 MUST execute BEFORE consolidation Tasks 6.2.1-6.2.7** -- immediate privilege escalation risk. An attacker with local access can `kill -9 1` (crash the system) or `kill -STOP` on sshd (lock out remote access) without any authentication.
4. **Sub-Task 6.2.8.2 SHOULD execute AFTER consolidation Tasks 6.2.1-6.2.7** -- archiving eliminates ~6-8 of the 14+ affected files, reducing remediation scope to ~8-10 surviving scripts.

---

## 3. Dependencies

| Dependency                         | Direction                | Description                                                |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Sub-Task 6.2.8.3 (NOPASSWD kill)   | BLOCKS Tasks 6.2.1-6.2.7 | Immediate privilege escalation risk; execute first         |
| Tasks 6.2.1-6.2.7                  | BLOCK Sub-Task 6.2.8.2   | Archiving reduces curl\|bash remediation scope             |
| Phase-6.2.08a (Credentials/Tokens) | Sibling -- no dependency | Can execute in parallel; 6.2.8.1 also blocks consolidation |
| Phase-6.2.08c (Network/Filesystem) | Sibling -- no dependency | Executes AFTER consolidation Tasks 6.2.1-6.2.7             |

### Cross-References to Sibling Decomposed Files

- **Phase-6.2.08a-Credential-Token-Security.md**: Contains Sub-Tasks 6.2.8.1 (Hardcoded API Tokens) and 6.2.8.4 (Hardcoded Passwords). Sub-Task 6.2.8.1 also blocks consolidation.
- **Phase-6.2.08c-Network-Filesystem-Safety.md**: Contains Sub-Tasks 6.2.8.5 (Hardcoded IPs) and 6.2.8.6 (Unsafe /tmp). Both execute AFTER consolidation.

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

**NOTE**: Sub-Task 6.2.8.3 modifies sudoers configuration via a setup script. If the script has already been executed (sudoers file written), the rollback must also restore the sudoers file on the target system:

```bash
# Restore previous sudoers configuration (if already applied):
sudo cp /etc/sudoers.d/droneid.bak /etc/sudoers.d/droneid
# Or remove the modified sudoers drop-in entirely:
sudo rm /etc/sudoers.d/droneid
```

---

## 5. Production-Critical Script Protection

The following production-critical script contains privilege escalation findings and will be MODIFIED IN PLACE:

| Script                             | Security Finding      | Sub-Task |
| ---------------------------------- | --------------------- | -------- |
| `scripts/setup-droneid-sudoers.sh` | NOPASSWD /bin/kill \* | 6.2.8.3  |

Additionally, the following scripts will be modified for curl|bash remediation (post-consolidation, only surviving scripts):

| Script                                                   | Security Finding       | Sub-Task |
| -------------------------------------------------------- | ---------------------- | -------- |
| `scripts/install-argos.sh`                               | curl \| sudo -E bash - | 6.2.8.2  |
| `scripts/setup-host-complete.sh`                         | curl -fsSL ... \| sh   | 6.2.8.2  |
| `scripts/install-system-dependencies.sh`                 | Multiple curl\|bash    | 6.2.8.2  |
| `scripts/install/quick-install.sh`                       | curl ... \| bash       | 6.2.8.2  |
| _(additional surviving scripts TBD after consolidation)_ |                        | 6.2.8.2  |

**Post-Modification Verification** (run after each sub-task to confirm scripts still function):

```bash
# Syntax check the sudoers setup script
bash -n "scripts/setup-droneid-sudoers.sh" && echo "PASS: syntax" || echo "FAIL: syntax error"

# After 6.2.8.2 (post-consolidation), syntax check all modified install scripts:
for f in $(find scripts/ -name '*.sh' -not -path '*_archived*' -newer scripts/.security-baseline 2>/dev/null); do
  bash -n "$f" && echo "PASS: $f syntax" || echo "FAIL: $f syntax error"
done
```

---

## 6. Task Details

### 6.2.8.3 CRITICAL: NOPASSWD Sudoers for /bin/kill \* (1 file, 2 rules)

**EXECUTION TIMING**: BEFORE consolidation Tasks 6.2.1-6.2.7.

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

### 6.2.8.2 CRITICAL: curl|bash Remote Code Execution Vectors (22+ instances)

**EXECUTION TIMING**: AFTER consolidation Tasks 6.2.1-6.2.7 (archiving reduces scope).

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

**Post-Archival Scope Reduction**:

After Tasks 6.2.1-6.2.7 archive ~88 scripts, many of the 22+ instances will be in archived files. Run the detection command again after archiving to determine the surviving count (estimated: ~10-14 instances in surviving scripts).

**Verification Command**:

```bash
grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' | \
  grep -v '_archived' | grep -v '#' | wc -l
# ACCEPTANCE: must return 0
```

**Acceptance Criteria**: Zero `curl|bash` or `wget|bash` patterns in any non-archived script.

---

## 7. Post-Execution Verification

### 7.1 Combined Supply Chain / Privilege Verification Script

Run after both sub-tasks in this file are complete (note: 6.2.8.3 runs pre-consolidation, 6.2.8.2 runs post-consolidation, so this combined script runs at the END after both are done):

```bash
#!/bin/bash
# Phase 6.2.08b Supply Chain / Privilege Hardening Verification
# Run from project root after Sub-Tasks 6.2.8.2 and 6.2.8.3 complete

PASS=0
FAIL=0

echo "=== 6.2.8.3: NOPASSWD /bin/kill * ==="
count=$(grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero unrestricted kill rules"; ((PASS++)); else echo "FAIL: $count unrestricted kill rules remain"; ((FAIL++)); fi

count=$(grep -rn 'NOPASSWD.*/tmp/' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero NOPASSWD /tmp rules"; ((PASS++)); else echo "FAIL: $count NOPASSWD /tmp rules remain"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.2: curl|bash RCE Vectors ==="
count=$(grep -rn 'curl.*|.*bash\|curl.*|.*sh\|wget.*|.*bash\|wget.*|.*sh' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | grep -v '#' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero curl|bash patterns"; ((PASS++)); else echo "FAIL: $count curl|bash patterns remain"; ((FAIL++)); fi

echo ""
echo "=== Syntax Check Modified Scripts ==="
bash -n "scripts/setup-droneid-sudoers.sh" 2>/dev/null && { echo "PASS: setup-droneid-sudoers.sh syntax"; ((PASS++)); } || { echo "FAIL: setup-droneid-sudoers.sh syntax error"; ((FAIL++)); }

# Check all install/setup scripts for syntax errors
for f in install-argos.sh setup-host-complete.sh install-system-dependencies.sh; do
  if [ -f "scripts/$f" ]; then
    bash -n "scripts/$f" 2>/dev/null && { echo "PASS: $f syntax"; ((PASS++)); } || { echo "FAIL: $f syntax error"; ((FAIL++)); }
  fi
done

echo ""
echo "=== SUMMARY (Phase 6.2.08b) ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "STATUS: ALL SUPPLY CHAIN / PRIVILEGE CHECKS PASSED"
else
  echo "STATUS: $FAIL CHECKS FAILED -- DO NOT MARK PHASE 6.2 COMPLETE"
fi
```

### 7.2 Interim Verification (After 6.2.8.3 Only, Pre-Consolidation)

Run this subset immediately after Sub-Task 6.2.8.3 completes, before proceeding to consolidation:

```bash
#!/bin/bash
# Interim verification: 6.2.8.3 only (pre-consolidation gate check)
PASS=0; FAIL=0

count=$(grep -rn '\/bin\/kill \*' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero unrestricted kill rules"; ((PASS++)); else echo "FAIL: $count unrestricted kill rules"; ((FAIL++)); fi

count=$(grep -rn 'NOPASSWD.*/tmp/' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero NOPASSWD /tmp rules"; ((PASS++)); else echo "FAIL: $count NOPASSWD /tmp rules"; ((FAIL++)); fi

bash -n "scripts/setup-droneid-sudoers.sh" 2>/dev/null && { echo "PASS: syntax OK"; ((PASS++)); } || { echo "FAIL: syntax error"; ((FAIL++)); }

echo "INTERIM RESULT: $PASS PASS, $FAIL FAIL"
[ "$FAIL" -eq 0 ] && echo "GATE: CLEARED -- consolidation may proceed" || echo "GATE: BLOCKED -- fix 6.2.8.3 before consolidation"
```

---

## 8. Acceptance Criteria

From parent document Section 9 (items 2, 3, 4, 10, 11), specific to this file:

1. **Zero `curl|bash` or `wget|bash` patterns** in non-archived scripts (Section 7.1 check 6.2.8.2).
2. **Zero unrestricted `/bin/kill *` NOPASSWD rules** in non-archived scripts (Section 7.1 check 6.2.8.3).
3. **Zero NOPASSWD rules referencing `/tmp/` paths** in non-archived scripts (Section 7.1 check 6.2.8.3).
4. **All modified scripts pass `bash -n` syntax check**.
5. **Verification script** (Section 7.1) returns "ALL SUPPLY CHAIN / PRIVILEGE CHECKS PASSED".
6. **Interim gate check** (Section 7.2) passes before consolidation proceeds.

---

## 9. Traceability

### Finding-to-Remediation Map (This File)

| Finding ID | Category         | Severity | File(s) Affected                      | Remediation Pattern                 | Verified By                          |
| ---------- | ---------------- | -------- | ------------------------------------- | ----------------------------------- | ------------------------------------ |
| 6.2.8.2    | curl\|bash RCE   | CRITICAL | ~8-10 surviving install/setup scripts | Download-then-verify pattern        | grep for `curl.*\|.*bash` returns 0  |
| 6.2.8.3a   | NOPASSWD kill \* | CRITICAL | setup-droneid-sudoers.sh:22,32        | Replace with systemctl or pkill -f  | grep for `/bin/kill \*` returns 0    |
| 6.2.8.3b   | NOPASSWD /tmp/   | CRITICAL | setup-droneid-sudoers.sh:23,33        | Replace /tmp/ path with /opt/argos/ | grep for `NOPASSWD.*/tmp/` returns 0 |

### Independent Audit Cross-Reference

| Audit Finding ID                     | This Document Sub-Task | Status    |
| ------------------------------------ | ---------------------- | --------- |
| CRITICAL-S2 (curl\|bash RCE Vectors) | 6.2.8.2                | Addressed |
| CRITICAL-S3 (NOPASSWD /bin/kill \*)  | 6.2.8.3                | Addressed |

### Appendix A Raw Data Cross-Reference

The independent audit raw data for CRITICAL-S2 and CRITICAL-S3 is preserved in the parent document (Phase-6.2.08-Security-Remediation.md, Appendix A). Refer to the parent document for the original unprocessed audit findings.

---

## 10. OVERLAP WARNING: Phase 6.4.13 Interaction

**Phase 6.4.13** (Security-Critical Pattern Remediation) includes subtasks that address supply chain and privilege escalation patterns in shell scripts. Since **Phase 6.2.08b Sub-Task 6.2.8.3 executes BEFORE consolidation** and **Sub-Task 6.2.8.2 executes AFTER consolidation but BEFORE Phase 6.4**, the following Phase 6.4.13 subtasks become **verification-only** for patterns already remediated here:

| Phase 6.4.13 Subtask          | Overlap with This File       | Expected State After 6.2.08b                                          |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| 13.3 (curl\|bash Patterns)    | Full overlap with 6.2.8.2    | All instances remediated; 6.4.13 verifies only                        |
| 13.4 (Sudoers Hardening)      | Full overlap with 6.2.8.3    | All unrestricted kill rules eliminated; 6.4.13 verifies only          |
| 13.5 (Supply Chain Integrity) | Partial overlap with 6.2.8.2 | Download-then-verify pattern applied; 6.4.13 may add GPG verification |

**Coordination Protocol**: When Phase 6.4.13 executes, the implementer MUST:

1. Run the verification script from Section 7.1 of this document.
2. If all checks pass, mark the overlapping 6.4.13 subtasks as "VERIFIED -- already remediated by Phase 6.2.08b".
3. If any check fails, remediate the regression and document which task introduced it.
4. Phase 6.4.13 MAY add additional hardening (e.g., GPG signature verification for downloads) beyond the baseline remediation performed here.

---

## 11. Execution Order Notes

### 11.1 Internal Execution Order (Within This File)

**IMPORTANT**: The two sub-tasks in this file execute at DIFFERENT times relative to consolidation:

```
Sub-Task 6.2.8.3 (NOPASSWD kill)   -- Execute BEFORE consolidation (immediate risk)
    |
    v
Interim Gate Check (Section 7.2)    -- Must pass before consolidation proceeds
    |
Tasks 6.2.1-6.2.7                  -- Consolidation tasks (archives reduce 6.2.8.2 scope)
    |
    v
Sub-Task 6.2.8.2 (curl|bash)       -- Execute AFTER consolidation (only surviving scripts)
    |
    v
Full Verification Script (Section 7.1)
```

### 11.2 Integration with Parent Task Order

```
Phase 6.2.08a (6.2.8.1, 6.2.8.4)  -- Execute BEFORE consolidation (parallel with 6.2.8.3)
THIS FILE: 6.2.8.3                  -- Execute BEFORE consolidation
    |
Tasks 6.2.1-6.2.7                  -- Consolidation tasks
    |
THIS FILE: 6.2.8.2                  -- Execute AFTER consolidation
Phase 6.2.08c (6.2.8.5, 6.2.8.6)  -- Execute AFTER consolidation (parallel with 6.2.8.2)
    |
    v
Final Verification Checklist
```

**Minimum critical path**: 6.2.8.3 -> 6.2.1 -> ... -> 6.2.7 -> 6.2.8.2 -> Verify

---

## 12. Metrics (This File)

| Metric                           | Value                                          |
| -------------------------------- | ---------------------------------------------- |
| Total Security Finding Instances | 24+ (2 NOPASSWD rules + 22+ curl\|bash)        |
| CRITICAL Findings                | 2 sub-tasks (6.2.8.2, 6.2.8.3)                 |
| HIGH Findings                    | 0                                              |
| Files Modified (in-place)        | 1 pre-consolidation + ~8-10 post-consolidation |
| Files Created                    | 0 (modifications only)                         |
| Estimated Effort                 | 4.5 engineer-hours                             |
| External Dependency              | None                                           |

---

END OF DOCUMENT
