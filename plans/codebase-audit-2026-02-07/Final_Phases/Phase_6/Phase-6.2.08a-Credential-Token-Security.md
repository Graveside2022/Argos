# Phase 6.2.08a: Credential and Token Security Remediation

**Document ID**: ARGOS-AUDIT-P6.2.08a
**Parent Document**: Phase-6.2.08-Security-Remediation.md (ARGOS-AUDIT-P6.2.08)
**Original Task IDs**: 6.2.8.1, 6.2.8.4
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: CRITICAL (6.2.8.1), HIGH (6.2.8.4)
**Review Standard**: DoD STIG Shell Script Security, NIST SP 800-123, CWE-798, NIST SP 800-218 PW.4.1, CERT C MSC41-C

---

## 1. Objective

Remediate all hardcoded secrets (API tokens and plaintext passwords) in version-controlled shell scripts. This file covers two logically coupled sub-tasks that share the same remediation pattern: externalize secrets to environment variables, update `.env.example`, and validate fail-closed behavior.

**Scope**: Sub-Task 6.2.8.1 (Hardcoded API Tokens -- CRITICAL, 2 instances) and Sub-Task 6.2.8.4 (Hardcoded Passwords -- HIGH, 3+ instances).

**Coupling Rationale**: Both sub-tasks address CWE-798 (Hardcoded Credentials) in version-controlled files. Both require the identical remediation pattern (`${VARNAME:?ERROR}` shell expansion). Both require `.env.example` updates. Executing them together ensures a single, consistent secrets-externalization pass.

### Security Finding Summary (This File)

| Sub-Task  | Category             | Severity | Instance Count | Files Affected | Estimated Effort |
| --------- | -------------------- | -------- | -------------- | -------------- | ---------------- |
| 6.2.8.1   | Hardcoded API Tokens | CRITICAL | 2              | 2              | 0.5 hours        |
| 6.2.8.4   | Hardcoded Passwords  | HIGH     | 3+             | 3+             | 1 hour           |
| **TOTAL** |                      |          | **5+**         | **5+**         | **1.5 hours**    |

---

## 2. Prerequisites

1. **Phase 5 complete** (architecture decomposition).
2. **Phase 6.1 complete** (dead code removal).
3. **OpenCellID account access** required for token rotation (Sub-Task 6.2.8.1).
4. **Sub-Tasks 6.2.8.1 and 6.2.8.4 MUST execute BEFORE consolidation Tasks 6.2.1-6.2.7** -- immediate credential exposure risk regardless of which scripts survive consolidation.

---

## 3. Dependencies

| Dependency                             | Direction                             | Description                                                             |
| -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Sub-Task 6.2.8.1 (API Tokens)          | BLOCKS Tasks 6.2.1-6.2.7              | Token rotation has external dependency; execute first                   |
| Sub-Task 6.2.8.4 (Passwords)           | Can parallel with 6.2.8.1 and 6.2.8.3 | No external dependency                                                  |
| Phase-6.2.08b (Supply Chain/Privilege) | Sibling -- no dependency              | Can execute in parallel; 6.2.8.3 also blocks consolidation              |
| Phase-6.2.08c (Network/Filesystem)     | Sibling -- no dependency              | Executes AFTER consolidation Tasks 6.2.1-6.2.7                          |
| Tasks 6.2.1-6.2.7                      | BLOCKED BY this file                  | Consolidation must not proceed until 6.2.8.1 token rotation is complete |

### Cross-References to Sibling Decomposed Files

- **Phase-6.2.08b-Supply-Chain-Privilege-Hardening.md**: Contains Sub-Tasks 6.2.8.2 (curl|bash RCE) and 6.2.8.3 (NOPASSWD kill \*). Sub-Task 6.2.8.3 also blocks consolidation.
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

**NOTE**: Token rotation (Sub-Task 6.2.8.1) CANNOT be rolled back -- once rotated, the old token is invalidated. Document the new token securely before rotating.

---

## 5. Production-Critical Script Protection

The following production-critical scripts contain credential findings and will be MODIFIED IN PLACE by this task:

| Script                                | Security Finding                           | Sub-Task |
| ------------------------------------- | ------------------------------------------ | -------- |
| `scripts/download-opencellid-full.sh` | Hardcoded API token                        | 6.2.8.1  |
| `scripts/setup-opencellid-full.sh`    | Hardcoded API token                        | 6.2.8.1  |
| `scripts/configure-openwebrx-b205.sh` | Hardcoded password 'argos123'              | 6.2.8.4  |
| `scripts/install-openwebrx-hackrf.sh` | Hardcoded password 'hackrf'                | 6.2.8.4  |
| `scripts/argos-wifi-resilience.sh`    | Placeholder password 'YourNetworkPassword' | 6.2.8.4  |

**Note**: `scripts/final-usrp-setup.sh` (password 'admin') is being archived in Task 6.2.7 and does NOT require in-place remediation.

**Post-Modification Verification** (run after each sub-task to confirm scripts still function):

```bash
# Syntax check all modified scripts
for f in download-opencellid-full.sh setup-opencellid-full.sh \
  configure-openwebrx-b205.sh install-openwebrx-hackrf.sh argos-wifi-resilience.sh; do
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

## 7. Post-Execution Verification

### 7.1 Combined Credential Security Verification Script

Run after both sub-tasks in this file are complete:

```bash
#!/bin/bash
# Phase 6.2.08a Credential/Token Security Verification
# Run from project root after Sub-Tasks 6.2.8.1 and 6.2.8.4 complete

PASS=0
FAIL=0

echo "=== 6.2.8.1: Hardcoded API Tokens ==="
count=$(grep -rn 'pk\.d6291c07a2907c915cd8994fb22bc189' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded API tokens"; ((PASS++)); else echo "FAIL: $count hardcoded API tokens remain"; ((FAIL++)); fi

count=$(grep -rn 'OPENCELLID_API_KEY' scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | wc -l)
if [ "$count" -ge 2 ]; then echo "PASS: $count files use env var"; ((PASS++)); else echo "FAIL: Only $count files use env var (need >= 2)"; ((FAIL++)); fi

echo ""
echo "=== 6.2.8.4: Hardcoded Passwords ==="
count=$(grep -rn "argos123\|password.*=.*hackrf\|password.*=.*admin" scripts/ --include='*.sh' 2>/dev/null | grep -v '_archived' | grep -v '#' | wc -l)
if [ "$count" -eq 0 ]; then echo "PASS: Zero hardcoded passwords"; ((PASS++)); else echo "FAIL: $count hardcoded passwords remain"; ((FAIL++)); fi

echo ""
echo "=== Syntax Check All Modified Scripts ==="
for f in download-opencellid-full.sh setup-opencellid-full.sh \
  configure-openwebrx-b205.sh install-openwebrx-hackrf.sh argos-wifi-resilience.sh; do
  if [ -f "scripts/$f" ]; then
    bash -n "scripts/$f" 2>/dev/null && echo "PASS: $f syntax" && ((PASS++)) || { echo "FAIL: $f syntax error"; ((FAIL++)); }
  fi
done

echo ""
echo "=== .env.example Check ==="
for var in OPENCELLID_API_KEY OWRX_ADMIN_PASSWORD HACKRF_ADMIN_PASSWORD WIFI_PASSWORD; do
  if grep -q "$var" .env.example 2>/dev/null; then
    echo "PASS: $var in .env.example"; ((PASS++))
  else
    echo "FAIL: $var missing from .env.example"; ((FAIL++))
  fi
done

echo ""
echo "=== SUMMARY (Phase 6.2.08a) ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "STATUS: ALL CREDENTIAL SECURITY CHECKS PASSED"
else
  echo "STATUS: $FAIL CHECKS FAILED -- DO NOT PROCEED TO CONSOLIDATION"
fi
```

---

## 8. Acceptance Criteria

From parent document Section 9 (items 1, 5, 8, 9, 10, 11), specific to this file:

1. **Zero hardcoded API tokens** in non-archived scripts (Section 7.1 check 6.2.8.1).
2. **Zero hardcoded plaintext passwords** in non-archived scripts (Section 7.1 check 6.2.8.4).
3. **OpenCellID API token rotated** and old token invalidated.
4. **`.env.example` updated** with all externalized variables (OPENCELLID_API_KEY, OWRX_ADMIN_PASSWORD, HACKRF_ADMIN_PASSWORD, WIFI_PASSWORD).
5. **All modified scripts pass `bash -n` syntax check**.
6. **Verification script** (Section 7.1) returns "ALL CREDENTIAL SECURITY CHECKS PASSED".

---

## 9. Traceability

### Finding-to-Remediation Map (This File)

| Finding ID | Category             | Severity | File(s) Affected                                      | Remediation Pattern                     | Verified By                              |
| ---------- | -------------------- | -------- | ----------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| 6.2.8.1    | Hardcoded API Token  | CRITICAL | download-opencellid-full.sh, setup-opencellid-full.sh | `${OPENCELLID_API_KEY:?...}` env var    | grep for `pk.d629...` returns 0          |
| 6.2.8.4a   | Hardcoded password   | HIGH     | configure-openwebrx-b205.sh:21,26                     | `${OWRX_ADMIN_PASSWORD:?...}` env var   | grep for `argos123` returns 0            |
| 6.2.8.4b   | Hardcoded password   | HIGH     | install-openwebrx-hackrf.sh:210                       | `${HACKRF_ADMIN_PASSWORD:?...}` env var | grep for `password.*hackrf` returns 0    |
| 6.2.8.4c   | Hardcoded password   | HIGH     | final-usrp-setup.sh:45                                | File archived in Task 6.2.7             | N/A (archived)                           |
| 6.2.8.4d   | Placeholder password | HIGH     | argos-wifi-resilience.sh:295                          | `${WIFI_PASSWORD:?...}` env var         | grep for `YourNetworkPassword` returns 0 |

### Independent Audit Cross-Reference

| Audit Finding ID                              | This Document Sub-Task | Status    |
| --------------------------------------------- | ---------------------- | --------- |
| CRITICAL-S1 (Hardcoded OpenCellID API Tokens) | 6.2.8.1                | Addressed |
| HIGH-S4 (Hardcoded Admin Passwords)           | 6.2.8.4                | Addressed |

### Appendix A Raw Data Cross-Reference

The independent audit raw data for CRITICAL-S1 and HIGH-S4 is preserved in the parent document (Phase-6.2.08-Security-Remediation.md, Appendix A). Refer to the parent document for the original unprocessed audit findings.

---

## 10. OVERLAP WARNING: Phase 6.4.13 Interaction

**Phase 6.4.13** (Security-Critical Pattern Remediation) includes subtasks that address credential and password patterns in shell scripts. Since **Phase 6.2.08a executes FIRST** (before consolidation), the following Phase 6.4.13 subtasks become **verification-only** for patterns already remediated here:

| Phase 6.4.13 Subtask          | Overlap with This File                      | Expected State After 6.2.08a                        |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------- |
| 13.1 (Hardcoded Credentials)  | Full overlap with 6.2.8.1 and 6.2.8.4       | All instances remediated; 6.4.13 verifies only      |
| 13.2 (Secrets in Git History) | Partial overlap with 6.2.8.1 token rotation | Token rotated; 6.4.13 may address git-filter-branch |

**Coordination Protocol**: When Phase 6.4.13 executes, the implementer MUST:

1. Run the verification script from Section 7.1 of this document.
2. If all checks pass, mark the overlapping 6.4.13 subtasks as "VERIFIED -- already remediated by Phase 6.2.08a".
3. If any check fails, remediate the regression and document which task introduced it.

---

## 11. Execution Order Notes

### 11.1 Internal Execution Order (Within This File)

```
Sub-Task 6.2.8.1 (API Tokens)  -- Execute FIRST (token rotation has external dependency)
    |
Sub-Task 6.2.8.4 (Passwords)   -- Execute SECOND (can parallel with 6.2.8.1)
    |
    v
Verification Script (Section 7.1)
```

### 11.2 Integration with Parent Task Order

```
THIS FILE (6.2.08a)             -- Execute BEFORE consolidation
Phase 6.2.08b (6.2.8.3)        -- Execute BEFORE consolidation (parallel with this file)
    |
Tasks 6.2.1-6.2.7              -- Consolidation tasks
    |
Phase 6.2.08b (6.2.8.2)        -- Execute AFTER consolidation
Phase 6.2.08c (6.2.8.5, 6.2.8.6) -- Execute AFTER consolidation
    |
    v
Final Verification Checklist
```

**Minimum critical path**: 6.2.8.1 -> consolidation (6.2.1-6.2.7) -> post-archival tasks

---

## 12. Metrics (This File)

| Metric                           | Value                               |
| -------------------------------- | ----------------------------------- |
| Total Security Finding Instances | 5+ (2 CRITICAL + 3+ HIGH)           |
| CRITICAL Findings                | 1 sub-task (6.2.8.1)                |
| HIGH Findings                    | 1 sub-task (6.2.8.4)                |
| Files Modified (in-place)        | 4 surviving scripts + .env.example  |
| Files Created                    | 0 (modifications only)              |
| Estimated Effort                 | 1.5 engineer-hours                  |
| External Dependency              | OpenCellID token rotation (6.2.8.1) |

---

END OF DOCUMENT
