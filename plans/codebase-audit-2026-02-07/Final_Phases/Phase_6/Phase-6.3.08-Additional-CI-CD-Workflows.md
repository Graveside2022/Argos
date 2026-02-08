# Phase 6.3.08: CI/CD Security Tooling

**Document ID**: ARGOS-AUDIT-P6.3.08
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.8
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

The project has zero automated security scanning. No Dependabot, no SAST, no secret scanning, no container scanning, no SBOM. There are currently 19 npm vulnerabilities (14 high, 4 moderate, 1 low). Default passwords exist in version-controlled config files.

This task establishes automated security scanning infrastructure:

- Dependabot for dependency updates
- NPM audit for known vulnerabilities
- Secret detection via gitleaks
- Static analysis via CodeQL
- A `SECURITY.md` disclosure policy

### Current State vs Desired State

| Metric                      | Current             | Target                                     |
| --------------------------- | ------------------- | ------------------------------------------ |
| Dependabot configuration    | None                | Configured for npm, GitHub Actions, Docker |
| Security scanning workflow  | None                | npm audit + gitleaks + CodeQL              |
| SECURITY.md                 | Does not exist      | Created with disclosure policy             |
| npm vulnerabilities (high+) | 14 high, 4 moderate | Reduced via `npm audit fix`                |
| SAST/CodeQL                 | None                | Enabled on push to main and PRs            |
| Secret scanning             | None                | gitleaks on every push                     |

---

## 2. Prerequisites

- Task 6.3.7 must be substantially complete: CI pipeline must be functional for security scanning workflows to run.
- GitHub repository must be accessible via `gh` CLI for configuration.

---

## 3. Dependencies

- **Upstream**: Task 6.3.7 (CI must be working for new workflows to succeed)
- **Downstream**: None (terminal task for security infrastructure)
- **Cross-reference**: Task 6.3.9 (Branch Protection) references the CI pipeline status established here

---

## 4. Rollback Strategy

```bash
# Remove new workflow and config files
git rm .github/dependabot.yml .github/workflows/security.yml SECURITY.md

# Restore original .github/ directory state
git checkout HEAD -- .github/
```

Dependabot PRs can be closed individually via GitHub UI. No security scanning workflow runs have side effects beyond generating reports.

---

## 5. Current State / Inventory

### 5.1 Existing Security Infrastructure

| Component          | Status         | Location       |
| ------------------ | -------------- | -------------- |
| Dependabot         | Not configured | N/A            |
| npm audit          | Not in CI      | Manual only    |
| gitleaks           | Not installed  | N/A            |
| CodeQL             | Not configured | N/A            |
| SECURITY.md        | Does not exist | N/A            |
| SBOM generation    | Not configured | N/A (deferred) |
| Container scanning | Not configured | N/A (deferred) |

### 5.2 Current npm Vulnerability Breakdown (verified 2026-02-08)

| Severity  | Count  | Primary Source                        | Impact                                  |
| --------- | ------ | ------------------------------------- | --------------------------------------- |
| High      | 14     | puppeteer dependencies (tar-fs), vite | Dev server and test infrastructure only |
| Moderate  | 4      | vite server.fs bypass variants        | Dev server only                         |
| Low       | 1      | Minor info disclosure                 | Minimal                                 |
| **Total** | **19** |                                       |                                         |

The vite vulnerabilities affect the dev server only (not production). The tar-fs vulnerability is in puppeteer's browser download pipeline (test infrastructure only). Neither impacts the production Argos deployment. However, they should still be fixed to maintain a clean audit trail.

---

## 6. Actions / Changes

### 6.1 Action A: Enable Dependabot

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
    - package-ecosystem: 'npm'
      directory: '/'
      schedule:
          interval: 'weekly'
          day: 'monday'
      open-pull-requests-limit: 10
      reviewers:
          - 'Graveside2022'
      labels:
          - 'dependencies'
      groups:
          development:
              dependency-type: 'development'
              update-types:
                  - 'minor'
                  - 'patch'
          production:
              dependency-type: 'production'
              update-types:
                  - 'patch'

    - package-ecosystem: 'github-actions'
      directory: '/'
      schedule:
          interval: 'weekly'
      labels:
          - 'ci'

    - package-ecosystem: 'docker'
      directory: '/docker'
      schedule:
          interval: 'weekly'
      labels:
          - 'docker'
```

**Configuration notes:**

- npm: Weekly on Monday, groups dev deps (minor+patch) and prod deps (patch only) to reduce PR noise.
- GitHub Actions: Weekly updates for action version pinning.
- Docker: Weekly updates for base image security patches.
- `open-pull-requests-limit: 10` prevents Dependabot from opening too many PRs at once.
- All PRs auto-assign `Graveside2022` as reviewer.

### 6.2 Action B: Add Security Scanning Workflow

Create `.github/workflows/security.yml`:

```yaml
name: 'Security Scanning'

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]
    schedule:
        - cron: '0 6 * * 1' # Weekly Monday 0600 UTC

jobs:
    npm-audit:
        name: 'NPM Vulnerability Audit'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: '20.x'
                  cache: 'npm'
            - run: npm ci
            - name: 'Run npm audit'
              run: npm audit --audit-level=high
              continue-on-error: true
            - name: 'Run npm audit (strict)'
              run: npm audit --audit-level=critical

    secret-scanning:
        name: 'Secret Detection (gitleaks)'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
              with:
                  fetch-depth: 0
            - uses: gitleaks/gitleaks-action@v2
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

    sast:
        name: 'Static Analysis (CodeQL)'
        runs-on: ubuntu-latest
        permissions:
            actions: read
            contents: read
            security-events: write
        steps:
            - uses: actions/checkout@v4
            - uses: github/codeql-action/init@v3
              with:
                  languages: javascript-typescript
            - uses: github/codeql-action/autobuild@v3
            - uses: github/codeql-action/analyze@v3
```

**Workflow design:**

- **npm-audit**: Two-tier approach. First run reports high-severity (non-blocking, `continue-on-error: true`). Second run fails only on critical-severity vulnerabilities. This allows visibility into high-severity issues without blocking PRs.
- **secret-scanning**: Uses gitleaks with full history (`fetch-depth: 0`) to detect secrets in any commit, not just the latest.
- **sast**: CodeQL for JavaScript/TypeScript static analysis. Requires `security-events: write` permission for GitHub Security tab integration.
- **Schedule**: Weekly Monday 0600 UTC ensures vulnerabilities are caught even without code changes.

### 6.3 Action C: Fix Immediate npm Vulnerabilities

```bash
# Run automated fix for non-breaking updates
npm audit fix

# For remaining vulnerabilities requiring major version bumps, evaluate:
npm audit fix --dry-run
# Review output and apply selectively
```

Expected outcomes:

- Most vite vulnerabilities resolved by minor version bump (dev dependency).
- tar-fs in puppeteer may require puppeteer major version bump (evaluate compatibility).
- Any unfixable vulnerabilities documented as accepted risk with justification.

### 6.4 Action D: Create SECURITY.md

Create `SECURITY.md` at project root:

```markdown
# Security Policy

## Supported Versions

| Version | Supported           |
| ------- | ------------------- |
| 0.x.x   | Current development |

## Reporting a Vulnerability

Report security vulnerabilities by emailing [REDACTED -- insert contact].
Do NOT open public GitHub issues for security vulnerabilities.

Expected response time: 72 hours.

## Security Practices

- All dependencies scanned weekly via Dependabot and npm audit
- Static analysis via CodeQL on every PR
- Secret scanning via gitleaks on every push
- No credentials stored in version control
- SystemD services run with least-privilege hardening
```

**Note**: The email address must be filled in by the project owner before publishing. The `[REDACTED -- insert contact]` placeholder prevents accidental PII exposure in the plan document.

### 6.5 Deferred Items

Two security scanning capabilities are out of scope for this task:

1. **SBOM generation**: Requires tooling selection (Syft, CycloneDX) and integration with the build pipeline. Deferred to a follow-on task.

2. **Container scanning**: Requires a Docker build workflow that does not currently exist. Creating a complete Docker CI workflow is out of scope for this phase. Track as a follow-on to this task.

---

## 7. Verification Commands

```bash
# 1. Verify dependabot.yml exists and is valid YAML
python3 -c "import yaml; yaml.safe_load(open('.github/dependabot.yml'))"
# Expected: no error

# 2. Verify security workflow exists
test -f .github/workflows/security.yml && echo "PASS" || echo "FAIL"
# Expected: PASS

# 3. Verify SECURITY.md exists
test -f SECURITY.md && echo "PASS" || echo "FAIL"
# Expected: PASS

# 4. Verify dependabot.yml covers 3 ecosystems
grep -c 'package-ecosystem' .github/dependabot.yml
# Expected: 3

# 5. Verify security workflow has 3 jobs
grep -c 'name:.*"' .github/workflows/security.yml
# Expected: at least 3 (npm-audit, secret-scanning, sast)

# 6. Verify npm audit shows reduced vulnerability count after fix
npm audit 2>&1 | tail -3
# Expected: fewer vulnerabilities than current 19

# 7. Verify SECURITY.md has disclosure instructions
grep -q 'Reporting a Vulnerability' SECURITY.md && echo "PASS" || echo "FAIL"
# Expected: PASS
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                    | Command                                  | Expected |
| --- | ------------------------ | ---------------------------------------- | -------- |
| 16  | Dependabot config exists | `test -f .github/dependabot.yml`         | Exit 0   |
| 17  | Security workflow exists | `test -f .github/workflows/security.yml` | Exit 0   |
| 18  | SECURITY.md exists       | `test -f SECURITY.md`                    | Exit 0   |

### Additional Pass/Fail Criteria

1. `.github/dependabot.yml` is valid YAML and configures 3 ecosystems (npm, github-actions, docker).
2. `.github/workflows/security.yml` defines 3 jobs (npm-audit, secret-scanning, sast).
3. `SECURITY.md` contains a vulnerability disclosure policy with expected response time.
4. npm audit vulnerability count is reduced from baseline (19 total).
5. CodeQL configuration targets `javascript-typescript` language.
6. gitleaks is configured with `fetch-depth: 0` for full history scanning.
7. Security workflow runs on push to main, PRs to main, and weekly schedule.

---

## 9. Traceability

| Finding                               | Task                                       | Status   |
| ------------------------------------- | ------------------------------------------ | -------- |
| No Dependabot                         | 6.3.8 Action A                             | PLANNED  |
| No SAST/CodeQL                        | 6.3.8 Action B (sast job)                  | PLANNED  |
| No secret scanning                    | 6.3.8 Action B (secret-scanning job)       | PLANNED  |
| 19 npm vulnerabilities (14 high)      | 6.3.8 Action C                             | PLANNED  |
| No SECURITY.md                        | 6.3.8 Action D                             | PLANNED  |
| No SBOM generation                    | 6.3.8 (deferred)                           | DEFERRED |
| No container scanning                 | 6.3.8 (deferred; needs Docker workflow)    | DEFERRED |
| Docker passwords hardcoded in compose | 6.3.8 (noted; requires secrets management) | DEFERRED |

### Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                                                  |
| -------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| gitleaks detects historical secrets in git history | High       | Medium | Rotate any detected secrets immediately; add to `.gitleaksignore` for known false positives |
| Dependabot opens too many PRs at once              | Medium     | Low    | `open-pull-requests-limit: 10`; group dev dependency updates                                |
| CodeQL produces false positives                    | Medium     | Low    | Review findings manually; tune query packs as needed                                        |
| npm audit fix introduces breaking changes          | Low        | Medium | Run `--dry-run` first; test locally before committing                                       |

---

## 10. Execution Order Notes

This task runs on **Track C** (CI/CD pipeline chain).

**Position in execution chain:**

- After: Task 6.3.7 (CI must be functional)
- Parallel with: Task 6.3.9 (Branch Protection) -- both depend on Task 6.3.7 but are independent of each other
- Before: None (terminal task for security infrastructure)

**Recommended execution within this task:**

1. Create `.github/dependabot.yml` (Action A -- immediate, no dependencies).
2. Create `.github/workflows/security.yml` (Action B -- immediate, no dependencies).
3. Create `SECURITY.md` (Action D -- immediate, no dependencies).
4. Run `npm audit fix` (Action C -- after Actions A and B are committed, so the security workflow can baseline).
5. Run verification commands.

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation).

---

END OF DOCUMENT
