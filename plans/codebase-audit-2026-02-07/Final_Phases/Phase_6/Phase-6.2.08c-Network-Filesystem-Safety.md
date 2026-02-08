# Phase 6.2.08c: Network Configuration and Filesystem Safety Remediation

**Document ID**: ARGOS-AUDIT-P6.2.08c
**Parent Document**: Phase-6.2.08-Security-Remediation.md (ARGOS-AUDIT-P6.2.08)
**Original Task IDs**: 6.2.8.5, 6.2.8.6
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: HIGH (both sub-tasks)
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CWE-377, CERT C FIO43-C, CIS Benchmarks

---

## 1. Objective

Remediate hardcoded network addresses (OPSEC violation) and unsafe temporary file usage (symlink attack vector) across surviving shell scripts. These are the highest-volume findings in the security audit (240 combined instances pre-archival) and have significant scope that depends on how many scripts survive consolidation.

**Scope**: Sub-Task 6.2.8.5 (Hardcoded IP Addresses -- HIGH, 55 instances) and Sub-Task 6.2.8.6 (Unsafe /tmp Usage -- HIGH, 185 instances).

**Coupling Rationale**: Both sub-tasks are post-archival tasks that execute AFTER consolidation Tasks 6.2.1-6.2.7. Both have scope counts that decrease substantially once ~88 scripts are archived. Both involve systematic find-and-replace patterns across the surviving script set. Sub-Task 6.2.8.5 has significant overlap with Phase 6.3 centralized path/configuration variables. Sub-Task 6.2.8.6 has significant overlap with Phase 6.4.13 subtask 13.10.

### Security Finding Summary (This File)

| Sub-Task  | Category               | Severity | Instance Count (Pre-Archival) | Instance Count (Post-Archival Est.) | Files Affected | Estimated Effort |
| --------- | ---------------------- | -------- | ----------------------------- | ----------------------------------- | -------------- | ---------------- |
| 6.2.8.5   | Hardcoded IP Addresses | HIGH     | 55                            | ~25-35                              | ~20            | 3 hours          |
| 6.2.8.6   | Unsafe /tmp Usage      | HIGH     | 185                           | ~80-100                             | ~50            | 6 hours          |
| **TOTAL** |                        |          | **240**                       | **~105-135**                        |                | **9 hours**      |

---

## 2. Prerequisites

1. **Phase 5 complete** (architecture decomposition).
2. **Phase 6.1 complete** (dead code removal).
3. **Tasks 6.2.1-6.2.7 MUST be complete** (consolidation/archiving). Both sub-tasks in this file operate on the SURVIVING script set only. Remediating scripts that will be archived is wasted effort.
4. **Phase-6.2.08a complete** (credential/token security) -- credentials must be externalized before this file runs.
5. **Phase-6.2.08b Sub-Task 6.2.8.3 complete** (NOPASSWD kill \*) -- privilege escalation must be fixed before this file runs.
6. **Phase 6.3 (`argos-env.sh`) recommended** -- IP externalization (Sub-Task 6.2.8.5) has significant overlap with Phase 6.3 centralized path variables. Coordinate to avoid double-work. If Phase 6.3 executes first, Sub-Task 6.2.8.5 scope may be substantially reduced.

---

## 3. Dependencies

| Dependency                     | Direction                        | Description                                                            |
| ------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| Tasks 6.2.1-6.2.7              | BLOCK this entire file           | Archiving must complete first to determine surviving script set        |
| Phase-6.2.08a (Credentials)    | Should complete before this file | Logical ordering: secrets first, then network/filesystem               |
| Phase-6.2.08b Sub-Task 6.2.8.3 | Should complete before this file | Privilege escalation is higher priority than IP/tmp                    |
| Phase 6.3                      | Cross-reference                  | IP externalization (6.2.8.5) overlaps with Phase 6.3 centralized paths |
| Phase 6.4.13                   | Cross-reference                  | Unsafe /tmp (6.2.8.6) overlaps with Phase 6.4.13 subtask 13.10         |

### Cross-References to Sibling Decomposed Files

- **Phase-6.2.08a-Credential-Token-Security.md**: Contains Sub-Tasks 6.2.8.1 (Hardcoded API Tokens) and 6.2.8.4 (Hardcoded Passwords). Both execute BEFORE consolidation.
- **Phase-6.2.08b-Supply-Chain-Privilege-Hardening.md**: Contains Sub-Tasks 6.2.8.2 (curl|bash RCE) and 6.2.8.3 (NOPASSWD kill \*). Sub-Task 6.2.8.3 executes before consolidation; 6.2.8.2 executes after (can parallel with this file).

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

**NOTE**: Both sub-tasks in this file are fully reversible via git. No external state is modified (unlike token rotation in 6.2.08a).

---

## 5. Production-Critical Script Protection

Both sub-tasks in this file modify a large number of surviving scripts. The exact file list is determined AFTER consolidation (Tasks 6.2.1-6.2.7). The following are known high-priority scripts that will be modified:

**Sub-Task 6.2.8.5 (Hardcoded IPs) -- known affected scripts**:

| Script                                          | Finding                            | Notes                                   |
| ----------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Multiple scripts with Tailscale IPs (100.x.x.x) | Hardcoded VPN addresses            | OPSEC violation for military deployment |
| Multiple scripts with LAN IPs                   | Hardcoded infrastructure addresses | Non-portable across environments        |

**Sub-Task 6.2.8.6 (Unsafe /tmp) -- known affected scripts**:

| Script Category    | Finding                          | Notes                                 |
| ------------------ | -------------------------------- | ------------------------------------- |
| Install scripts    | `/tmp/<predictable-name>` writes | Root-context symlink attack risk      |
| Monitoring scripts | `/tmp/<service>.log` patterns    | Sensitive data in world-readable temp |
| Setup scripts      | `/tmp/<config>` staging          | Config poisoning via symlink          |

**Post-Modification Verification** (run after each sub-task to confirm scripts still function):

```bash
# Syntax check ALL non-archived scripts after modification:
for f in $(find scripts/ -name '*.sh' -not -path '*_archived*'); do
  bash -n "$f" 2>/dev/null || echo "SYNTAX ERROR: $f"
done
# EXPECTED: no output (all scripts parse)
```

---

## 6. Task Details

### 6.2.8.5 HIGH: Hardcoded Tailscale/Internal IP Addresses (55 instances)

**EXECUTION TIMING**: AFTER consolidation Tasks 6.2.1-6.2.7.

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

**EXECUTION TIMING**: AFTER consolidation Tasks 6.2.1-6.2.7.

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

### 7.1 Combined Network/Filesystem Safety Verification Script

Run after both sub-tasks in this file are complete:

```bash
#!/bin/bash
# Phase 6.2.08c Network/Filesystem Safety Verification
# Run from project root after Sub-Tasks 6.2.8.5 and 6.2.8.6 complete

PASS=0
FAIL=0

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
echo "=== Syntax Check All Non-Archived Scripts ==="
syntax_fail=0
for f in $(find scripts/ -name '*.sh' -not -path '*_archived*'); do
  bash -n "$f" 2>/dev/null || { echo "SYNTAX ERROR: $f"; ((syntax_fail++)); }
done
if [ "$syntax_fail" -eq 0 ]; then echo "PASS: All scripts pass syntax check"; ((PASS++)); else echo "FAIL: $syntax_fail scripts have syntax errors"; ((FAIL++)); fi

echo ""
echo "=== SUMMARY (Phase 6.2.08c) ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "STATUS: ALL NETWORK/FILESYSTEM SAFETY CHECKS PASSED"
else
  echo "STATUS: $FAIL CHECKS FAILED -- DO NOT MARK PHASE 6.2 COMPLETE"
fi
```

### 7.2 Post-Archival Scope Assessment (Run Before Remediation)

Before starting the sub-tasks in this file, run this assessment to determine actual scope after consolidation:

```bash
#!/bin/bash
# Phase 6.2.08c Pre-Remediation Scope Assessment
# Run AFTER Tasks 6.2.1-6.2.7 complete, BEFORE starting 6.2.8.5/6.2.8.6

echo "=== Post-Archival Scope Assessment ==="

echo ""
echo "--- 6.2.8.5: Hardcoded IPs ---"
ip_count=$(grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' 2>/dev/null | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | wc -l)
echo "Surviving hardcoded IP instances: $ip_count (pre-archival was 55)"

echo "Unique IPs in surviving scripts:"
grep -rn '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}' scripts/ --include='*.sh' 2>/dev/null | \
  grep -v '127.0.0.1\|0.0.0.0\|255.\|localhost\|_archived' | \
  grep -oP '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}' | sort -u

echo ""
echo "--- 6.2.8.6: Unsafe /tmp ---"
tmp_count=$(grep -rn '/tmp/' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
mktemp_count=$(grep -rn 'mktemp' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
echo "Surviving /tmp/ instances: $tmp_count (pre-archival was 185)"
echo "Existing mktemp usages: $mktemp_count (pre-archival was 4)"
echo "Unsafe-to-safe ratio: $(( tmp_count / (mktemp_count + 1) )):1"

echo ""
echo "=== Estimated Effort ==="
echo "IP remediation: ~$(( ip_count / 5 )) files to modify"
echo "/tmp remediation: ~$(( tmp_count / 3 )) files to modify"
```

---

## 8. Acceptance Criteria

From parent document Section 9 (items 6, 7, 10, 11), specific to this file:

1. **Zero hardcoded non-loopback IP addresses** in non-archived scripts (Section 7.1 check 6.2.8.5).
2. **Zero hardcoded `/tmp/filename` patterns** in non-archived scripts (Section 7.1 check 6.2.8.6).
3. **All temporary file creation uses `mktemp` or `mktemp -d`** with trap-based cleanup.
4. **mktemp usage count >= 20** in non-archived scripts (replacing the surviving hardcoded patterns).
5. **All modified scripts pass `bash -n` syntax check**.
6. **Verification script** (Section 7.1) returns "ALL NETWORK/FILESYSTEM SAFETY CHECKS PASSED".

---

## 9. Traceability

### Finding-to-Remediation Map (This File)

| Finding ID | Category      | Severity | File(s) Affected                        | Remediation Pattern         | Verified By                         |
| ---------- | ------------- | -------- | --------------------------------------- | --------------------------- | ----------------------------------- |
| 6.2.8.5    | Hardcoded IPs | HIGH     | ~20 files, 55 instances (pre-archival)  | Env vars via argos-env.sh   | IP regex grep returns 0             |
| 6.2.8.6    | Unsafe /tmp   | HIGH     | ~50 files, 185 instances (pre-archival) | mktemp -d with trap cleanup | /tmp/ grep (excl. mktemp) returns 0 |

### Independent Audit Cross-Reference

| Audit Finding ID                           | This Document Sub-Task | Status    |
| ------------------------------------------ | ---------------------- | --------- |
| HIGH-S5 (Hardcoded Tailscale/Internal IPs) | 6.2.8.5                | Addressed |
| HIGH-S6 (Unsafe /tmp Usage)                | 6.2.8.6                | Addressed |

### Appendix A Raw Data Cross-Reference

The independent audit raw data for HIGH-S5 and HIGH-S6 is preserved in the parent document (Phase-6.2.08-Security-Remediation.md, Appendix A). Refer to the parent document for the original unprocessed audit findings.

---

## 10. OVERLAP WARNING: Phase 6.3 and Phase 6.4.13 Interaction

### 10.1 Phase 6.3 Overlap (Centralized Configuration)

**Sub-Task 6.2.8.5** (Hardcoded IPs) has **significant overlap** with Phase 6.3, which introduces `argos-env.sh` as a centralized configuration file for paths and environment variables. IP addresses are a natural fit for the same centralization mechanism.

| Phase 6.3 Subtask                                    | Overlap with This File          | Coordination                                          |
| ---------------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| 6.3.3 (Hardcoded Path Elimination -- TypeScript)     | No direct overlap               | Different file types                                  |
| 6.3.4 (Hardcoded Path Elimination -- Shell Scripts)  | **Direct overlap** with 6.2.8.5 | IP vars should go in argos-env.sh alongside path vars |
| 6.3.5 (Hardcoded Path Elimination -- Service Config) | Partial overlap                 | Service configs may contain IPs                       |

**Coordination Protocol**:

- If Phase 6.3 executes FIRST: Sub-Task 6.2.8.5 becomes a verification task (confirm all IPs are externalized in argos-env.sh).
- If Phase 6.2.08c executes FIRST: IP variables should be added to a format compatible with the planned argos-env.sh structure. Phase 6.3 then absorbs these variables.
- **Recommended**: Execute Phase 6.3 and Sub-Task 6.2.8.5 in the SAME implementation pass to avoid double-work.

### 10.2 Phase 6.4.13 Overlap (Security-Critical Patterns)

**Phase 6.4.13** (Security-Critical Pattern Remediation) includes subtasks that address /tmp safety and network configuration patterns. Since **Phase 6.2.08c executes FIRST**, the following Phase 6.4.13 subtasks become **verification-only** for patterns already remediated here:

| Phase 6.4.13 Subtask                    | Overlap with This File       | Expected State After 6.2.08c                                     |
| --------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| 13.7 (Hardcoded IP/Host Remediation)    | Full overlap with 6.2.8.5    | All IPs externalized; 6.4.13 verifies only                       |
| 13.10 (Unsafe /tmp Pattern Remediation) | Full overlap with 6.2.8.6    | All /tmp patterns use mktemp; 6.4.13 verifies only               |
| 13.11 (Trap-based Cleanup)              | Partial overlap with 6.2.8.6 | mktemp patterns include trap; 6.4.13 may extend to non-tmp traps |

**Coordination Protocol**: When Phase 6.4.13 executes, the implementer MUST:

1. Run the verification script from Section 7.1 of this document.
2. If all checks pass, mark the overlapping 6.4.13 subtasks as "VERIFIED -- already remediated by Phase 6.2.08c".
3. If any check fails, remediate the regression and document which task introduced it.
4. Phase 6.4.13 MAY add additional hardening (e.g., more comprehensive trap handlers, sticky-bit checks on /tmp) beyond the baseline remediation performed here.

---

## 11. Execution Order Notes

### 11.1 Internal Execution Order (Within This File)

Both sub-tasks execute AFTER consolidation. They can be executed in parallel or sequentially:

```
Tasks 6.2.1-6.2.7 complete     -- PREREQUISITE: archiving done
    |
Post-Archival Scope Assessment (Section 7.2) -- Determine actual surviving counts
    |
    +-----> Sub-Task 6.2.8.5 (Hardcoded IPs)  -- Can run in parallel with 6.2.8.6
    |           Coordinate with Phase 6.3 if in progress
    |
    +-----> Sub-Task 6.2.8.6 (Unsafe /tmp)    -- Can run in parallel with 6.2.8.5
    |
    v
Full Verification Script (Section 7.1)
```

**Recommended**: Execute Sub-Task 6.2.8.5 before 6.2.8.6 because IP externalization (6.2.8.5) may create `argos-env.sh` or add to it, and 6.2.8.6 may need to source it.

### 11.2 Integration with Parent Task Order

```
Phase 6.2.08a (6.2.8.1, 6.2.8.4)  -- Execute BEFORE consolidation
Phase 6.2.08b (6.2.8.3)            -- Execute BEFORE consolidation
    |
Tasks 6.2.1-6.2.7                  -- Consolidation tasks
    |
Phase 6.2.08b (6.2.8.2)            -- Execute AFTER consolidation (parallel with this file)
THIS FILE (6.2.8.5, 6.2.8.6)       -- Execute AFTER consolidation
    |
    v
Final Verification Checklist         -- ALL checks from 6.2.08a + 6.2.08b + 6.2.08c must pass
```

**Minimum critical path**: consolidation -> 6.2.8.5 + 6.2.8.6 -> Verify

---

## 12. Metrics (This File)

| Metric                                                | Value                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Total Security Finding Instances (Pre-Archival)       | 240 (55 IPs + 185 /tmp)                                    |
| Total Security Finding Instances (Post-Archival Est.) | ~105-135                                                   |
| CRITICAL Findings                                     | 0                                                          |
| HIGH Findings                                         | 2 sub-tasks (6.2.8.5, 6.2.8.6)                             |
| Files Modified (in-place)                             | ~30-50 surviving scripts                                   |
| Files Created                                         | 0 (modifications only)                                     |
| Estimated Effort                                      | 9 engineer-hours                                           |
| External Dependency                                   | None (Phase 6.3 coordination recommended but not required) |

---

END OF DOCUMENT
