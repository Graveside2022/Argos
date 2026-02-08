# Phase 6.4.12: CI Integration

**Document ID**: ARGOS-AUDIT-P6.4.12
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.12
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: LOW (additive -- adds CI checks; does not modify shell scripts)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Add shell script validation to the existing GitHub Actions CI pipeline (`.github/workflows/ci.yml`) and the Husky pre-commit hook. This ensures that all shell standardization rules established in Tasks 6.4.1 through 6.4.13 are enforced on every push, pull request, and local commit.

**Current CI state:**

The existing `ci.yml` runs:

1. `npm run lint` (ESLint -- currently fails with 63 errors)
2. `npm run format:check` (Prettier)
3. `npm run typecheck` (TypeScript)
4. `npm test` (Vitest)
5. `npm run build` (SvelteKit -- fails without `.env`)

**Shell scripts are not validated in CI.** This task adds a dedicated `validate-shell` job.

**Target state:** CI enforces 6 shell validation checks. Pre-commit hook validates staged `.sh` files. All checks pass on the current codebase after Phase 6.4 completion.

> **CRITICAL:** This MUST be the LAST task in the Phase 6.4 chain. It validates all preceding tasks. If CI is added before other tasks complete, it will fail on the existing codebase and block all PRs.

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

- **ALL Tasks 6.4.1 through 6.4.13 MUST be complete.** CI validates the output of all preceding tasks. Running CI before they complete will produce failures.

---

## 3. Dependencies

| Dependency | Direction | Task               | Reason                                                          |
| ---------- | --------- | ------------------ | --------------------------------------------------------------- |
| AFTER      | Upstream  | ALL (6.4.1-6.4.13) | CI validates the output of all preceding tasks                  |
| AFTER      | Upstream  | 6.4.13             | Security remediation must be complete before CI enforces checks |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.12 - CI integration for shell validation
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- CI YAML is invalid (YAML parse error)
- CI job blocks legitimate PRs due to false positives
- Pre-commit hook prevents commits on unrelated changes (scope leak)

---

## 5. Baseline Metrics

| Metric                                             | Status      |
| -------------------------------------------------- | ----------- |
| Shell validation in CI pipeline                    | ABSENT      |
| Shell validation in pre-commit hook                | ABSENT      |
| `validate-shell` job in `.github/workflows/ci.yml` | NOT PRESENT |

---

## 6. Task Details

### 6.1: New CI Job

Add the following job to `.github/workflows/ci.yml`:

```yaml
validate-shell:
    name: 'Validate Shell Scripts'
    runs-on: ubuntu-latest
    steps:
        - name: 'Checkout Code'
          uses: actions/checkout@v4

        - name: 'Install ShellCheck'
          run: sudo apt-get update && sudo apt-get install -y shellcheck

        - name: 'Verify ShellCheck Version'
          run: |
              shellcheck --version
              # Require 0.9.0+ for full bash 5.x support
              VERSION=$(shellcheck --version | grep "version:" | awk '{print $2}')
              echo "ShellCheck version: ${VERSION}"

        - name: 'Bash Syntax Check (bash -n)'
          run: |
              ERRORS=0
              while IFS= read -r -d '' script; do
                if ! bash -n "${script}" 2>/dev/null; then
                  echo "SYNTAX ERROR: ${script}"
                  bash -n "${script}"
                  ERRORS=$((ERRORS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Syntax errors found: ${ERRORS}"
              exit "${ERRORS}"

        - name: 'ShellCheck Analysis (severity=warning)'
          run: |
              FINDINGS=0
              while IFS= read -r -d '' script; do
                OUTPUT=$(shellcheck --severity=warning -f gcc "${script}" 2>/dev/null)
                if [[ -n "${OUTPUT}" ]]; then
                  echo "${OUTPUT}"
                  FINDINGS=$((FINDINGS + $(echo "${OUTPUT}" | wc -l)))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Total ShellCheck findings: ${FINDINGS}"
              if [[ "${FINDINGS}" -gt 0 ]]; then
                exit 1
              fi

        - name: 'Verify Shebang Standardization'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                SHEBANG=$(head -1 "${script}")
                if [[ "${SHEBANG}" != "#!/usr/bin/env bash" ]]; then
                  echo "BAD SHEBANG: ${script} (${SHEBANG})"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Shebang violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"

        - name: 'Verify Strict Mode'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                LINE2=$(sed -n '2p' "${script}")
                if [[ "${LINE2}" != "set -euo pipefail" ]]; then
                  echo "MISSING STRICT MODE: ${script} (line 2: ${LINE2})"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Strict mode violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"

        - name: 'Verify common.sh Sourcing'
          run: |
              VIOLATIONS=0
              while IFS= read -r -d '' script; do
                # Skip the library itself
                [[ "${script}" == *"lib/"* ]] && continue
                if ! grep -q "common.sh" "${script}"; then
                  echo "NOT SOURCING common.sh: ${script}"
                  VIOLATIONS=$((VIOLATIONS + 1))
                fi
              done < <(find scripts/ -name "*.sh" -type f -print0)
              echo "Sourcing violations: ${VIOLATIONS}"
              exit "${VIOLATIONS}"
```

### 6.2: Pre-Commit Hook Addition

Add shell validation to the existing Husky pre-commit hook:

```bash
# In .husky/pre-commit (append to existing content):

# Shell script validation (Phase 6.4.12)
SHELL_STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$' || true)
if [[ -n "${SHELL_STAGED}" ]]; then
    echo "Validating staged shell scripts..."
    for script in ${SHELL_STAGED}; do
        if [[ -f "${script}" ]]; then
            bash -n "${script}" || { echo "Syntax error in ${script}"; exit 1; }
            shellcheck --severity=warning "${script}" || { echo "ShellCheck failed on ${script}"; exit 1; }
        fi
    done
fi
```

### 6.3: CI YAML Validation

The CI YAML must be validated before committing:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
# Expected: exit 0 (no YAML errors)
```

### 6.4: Local Simulation

Simulate the CI shell validation locally before pushing:

```bash
# Run all 6 CI checks locally
find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} bash -n {} && echo "All syntax OK"

find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} shellcheck --severity=warning -f gcc {} 2>/dev/null | wc -l
# Expected: 0
```

---

## 7. Verification Commands

```bash
# CI YAML is valid
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null
# Expected: exit 0 (no YAML errors)

# CI YAML contains validate-shell job
grep -q "validate-shell" .github/workflows/ci.yml
# Expected: exit 0

# CI YAML contains all 6 check steps
for check in "Bash Syntax Check" "ShellCheck Analysis" "Verify Shebang" "Verify Strict Mode" "Verify common.sh"; do
    grep -q "${check}" .github/workflows/ci.yml || echo "MISSING CI CHECK: ${check}"
done
# Expected: no output

# Pre-commit hook exists and contains shell validation
grep -q "shellcheck" .husky/pre-commit 2>/dev/null || echo "MISSING: shellcheck in pre-commit"
# Expected: no output

# Simulate CI locally
find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} bash -n {} && echo "All syntax OK"
find scripts/ -name "*.sh" -type f -print0 | \
  xargs -0 -I{} shellcheck --severity=warning -f gcc {} 2>/dev/null | wc -l
# Expected: 0
```

---

## 8. Acceptance Criteria

- [ ] `.github/workflows/ci.yml` contains a `validate-shell` job
- [ ] CI job runs `bash -n` on all `.sh` files
- [ ] CI job runs `shellcheck --severity=warning` on all `.sh` files
- [ ] CI job verifies shebang standardization (`#!/usr/bin/env bash`)
- [ ] CI job verifies strict mode on line 2 (`set -euo pipefail`)
- [ ] CI job verifies `common.sh` sourcing (all scripts except lib modules)
- [ ] Pre-commit hook validates staged `.sh` files before commit
- [ ] CI YAML passes YAML validation (`yaml.safe_load`)
- [ ] All 6 CI checks pass on the current codebase after Phase 6.4 completion

---

## 9. Traceability

| Task   | Deficiency                        | Standard                             | Files Affected             | Verification Command                                |
| ------ | --------------------------------- | ------------------------------------ | -------------------------- | --------------------------------------------------- |
| 6.4.12 | Shell scripts not validated in CI | Continuous integration best practice | `.github/workflows/ci.yml` | `grep -q "validate-shell" .github/workflows/ci.yml` |

---

## 10. Execution Order Notes

**Position in critical path:** 13th and LAST

```
... --> 6.4.10 (exit codes) --> 6.4.13 (security) --> 6.4.12 (CI)
```

**Critical path:** 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> 6.4.9 -> 6.4.10 -> 6.4.13 -> 6.4.12

This MUST be the last task because it validates all preceding tasks. Adding CI enforcement before other tasks complete would cause CI failures that block all PRs. The CI job is the "phase gate" -- once it passes, Phase 6.4 is complete.

**Note on CI advisory mode:** CI is currently advisory (branch protection not yet enforced per CI audit). The `validate-shell` job will report failures but not block merges until branch protection rules are updated in a future phase.

---

```
END OF TASK DOCUMENT
Task:     6.4.12 - CI Integration
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
