# Phase 6.3.09: Branch Protection and Git Hygiene

**Document ID**: ARGOS-AUDIT-P6.3.09
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.9
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

Four git hygiene issues have been identified:

1. **No branch protection rules on `main`**: Any push (including force-push) is allowed. A single erroneous `git push --force origin main` can destroy the entire commit history with no recovery mechanism beyond git reflog (which expires).

2. **Broken git submodule**: `RemoteIDReceiver/` is an empty directory tracked by git, but no `.gitmodules` file exists. `git submodule status` returns no output. This confuses tooling and developers, and the directory occupies an entry in the git tree for no purpose.

3. **No `CODEOWNERS` file**: PRs have no automatic reviewer assignment. In a military-grade review environment, every PR to security-sensitive paths must have a designated reviewer.

4. **Pre-commit hook routinely bypassed**: The husky + lint-staged pre-commit hook exists but is routinely bypassed with `--no-verify`. No pre-push hook exists to catch issues before they reach the remote.

### Current State vs Desired State

| Metric                      | Current                            | Target                                                 |
| --------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Branch protection on main   | None                               | Enforced (CI required, review required, no force-push) |
| RemoteIDReceiver/ submodule | Broken (empty dir, no .gitmodules) | Removed from git tracking                              |
| CODEOWNERS                  | Does not exist                     | Created with per-path ownership                        |
| Pre-push hook               | Does not exist                     | Typecheck on push                                      |

---

## 2. Prerequisites

- Task 6.3.7 must be complete: CI pipeline must be passing before branch protection can require CI status checks. Enabling branch protection with a failing CI permanently blocks all merges.
- GitHub CLI (`gh`) must be authenticated with admin access to the repository.

---

## 3. Dependencies

- **Upstream**: Task 6.3.7 (CI must be passing before protection can reference status checks)
- **Downstream**: None (terminal task for git hygiene)
- **Cross-reference**: Task 6.3.8 (Security Tooling) -- both depend on Task 6.3.7 but are independent of each other

---

## 4. Rollback Strategy

```bash
# Remove CODEOWNERS and SECURITY.md
git rm .github/CODEOWNERS

# Restore RemoteIDReceiver/ if needed (re-create empty dir)
mkdir RemoteIDReceiver
git add RemoteIDReceiver

# Remove pre-push hook
rm .husky/pre-push

# Remove branch protection via GitHub API
gh api repos/Graveside2022/Argos/branches/main/protection --method DELETE
```

**Warning**: Removing branch protection requires admin access. The `gh api DELETE` command irreversibly removes all protection rules and must be re-applied manually.

---

## 5. Current State / Inventory

### 5.1 Branch Protection Status

```bash
gh api repos/Graveside2022/Argos/branches/main/protection 2>&1
# Expected current result: 404 (no protection configured)
```

No branch protection rules exist. Any authenticated user with write access can:

- Push directly to main (bypassing PR review)
- Force-push to main (rewriting history)
- Delete the main branch

### 5.2 RemoteIDReceiver/ Submodule Status

```bash
ls -la RemoteIDReceiver/
# Expected: empty directory (only . and ..)

cat .gitmodules 2>/dev/null
# Expected: file does not exist or no entry for RemoteIDReceiver

git submodule status
# Expected: no output
```

The directory is tracked by git as an empty tree entry. It was likely a git submodule whose `.gitmodules` entry was deleted without cleaning up the directory reference.

### 5.3 CODEOWNERS Status

```bash
test -f .github/CODEOWNERS && echo "EXISTS" || echo "MISSING"
# Expected: MISSING
```

### 5.4 Pre-Push Hook Status

```bash
test -f .husky/pre-push && echo "EXISTS" || echo "MISSING"
# Expected: MISSING
```

Existing pre-commit hook:

```bash
ls -la .husky/pre-commit 2>/dev/null
# May or may not exist; if exists, uses lint-staged
```

---

## 6. Actions / Changes

### 6.1 Action A: Remove Broken Submodule Reference

The `RemoteIDReceiver/` directory is empty (contains only `.` and `..`). It was likely a git submodule whose `.gitmodules` entry was deleted without cleaning up the directory reference.

```bash
# Remove the empty directory from git tracking
git rm -r RemoteIDReceiver/

# Add to .gitignore to prevent re-addition
echo "RemoteIDReceiver/" >> .gitignore
```

If DroneID functionality is needed in the future, re-add it as a proper submodule with:

```bash
git submodule add <repo-url> RemoteIDReceiver
```

**Impact**: Zero runtime impact. The directory is empty and not referenced by any code (DroneID paths in TypeScript reference subdirectories that do not exist under this empty dir -- they use the hardcoded `/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver` path which is being fixed in Task 6.3.3).

### 6.2 Action B: Create CODEOWNERS

Create `.github/CODEOWNERS`:

```
# Default owner for all files
* @Graveside2022

# Critical infrastructure
deployment/ @Graveside2022
.github/ @Graveside2022
docker/ @Graveside2022
svelte.config.js @Graveside2022
package.json @Graveside2022

# Security-sensitive files
src/routes/api/gsm-evil/ @Graveside2022
src/lib/server/ @Graveside2022
scripts/setup-gsmevil-sudoers.sh @Graveside2022
```

**CODEOWNERS behavior:**

- The `*` rule ensures every file has at least one designated reviewer.
- More specific path rules override the default for critical directories.
- When a PR modifies files matching a CODEOWNERS path, GitHub automatically requests review from the specified owner(s).
- CODEOWNERS requires branch protection to be enabled (Action C) for enforcement.

### 6.3 Action C: Enable Branch Protection

Using the GitHub CLI (requires admin access):

```bash
gh api repos/Graveside2022/Argos/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["validate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

This enforces:

| Protection Rule        | Setting                    | Effect                                |
| ---------------------- | -------------------------- | ------------------------------------- |
| Required status checks | `validate` job from ci.yml | CI must pass before merge             |
| Strict status checks   | `true`                     | Branch must be up-to-date with base   |
| Required reviews       | 1 approving review         | At least 1 approval required          |
| Dismiss stale reviews  | `true`                     | New pushes dismiss previous approvals |
| Enforce for admins     | `true`                     | Rules apply to repository admins      |
| Allow force pushes     | `false`                    | Force-push to main is blocked         |
| Allow deletions        | `false`                    | Main branch cannot be deleted         |

**Critical**: Branch protection requires the CI pipeline to be passing first (Task 6.3.7). Enable protection AFTER CI is green. Enabling protection with a failing CI permanently blocks all merges until CI is fixed via a workaround (temporary admin bypass or protection removal).

**Consideration for sole developer**: With `enforce_admins=true` and 1 required review, the sole developer (`Graveside2022`) cannot merge their own PRs without a second reviewer. Two options:

1. **Set `enforce_admins=false` initially**: Allows the admin to bypass review requirements. Tighten after CI is stable and a second reviewer is available.
2. **Use a GitHub App or bot for auto-approval**: Not recommended for a security-critical project.

**Recommendation**: Start with `enforce_admins=false` to avoid self-lockout. Upgrade to `enforce_admins=true` when a second reviewer is available.

### 6.4 Action D: Add Pre-Push Hook

Create `.husky/pre-push`:

```bash
#!/usr/bin/env bash
npm run typecheck
```

Make it executable:

```bash
chmod +x .husky/pre-push
```

This ensures type errors cannot be pushed even if pre-commit is bypassed with `--no-verify`. The typecheck is fast enough (~15 seconds on the RPi 5) to not impede workflow.

**Note**: The `--no-verify` flag also bypasses pre-push hooks. This hook is a defense-in-depth measure, not an absolute gate. The absolute gate is the CI pipeline enforced by branch protection (Action C).

---

## 7. Verification Commands

```bash
# 1. Verify RemoteIDReceiver is removed from git
git ls-files RemoteIDReceiver/
# Expected: no output

# 2. Verify RemoteIDReceiver is in .gitignore
grep 'RemoteIDReceiver/' .gitignore
# Expected: found

# 3. Verify CODEOWNERS exists
test -f .github/CODEOWNERS && echo "PASS" || echo "FAIL"
# Expected: PASS

# 4. Verify CODEOWNERS has default rule
grep '^\*' .github/CODEOWNERS
# Expected: * @Graveside2022

# 5. Verify pre-push hook exists and is executable
test -x .husky/pre-push && echo "PASS" || echo "FAIL"
# Expected: PASS

# 6. Verify pre-push hook runs typecheck
grep 'typecheck' .husky/pre-push
# Expected: found

# 7. Verify branch protection (after enabling)
gh api repos/Graveside2022/Argos/branches/main/protection \
  --jq '.required_status_checks.strict'
# Expected: true

# 8. Verify force-push is blocked
gh api repos/Graveside2022/Argos/branches/main/protection \
  --jq '.allow_force_pushes.enabled'
# Expected: false
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                             | Command                          | Expected  |
| --- | --------------------------------- | -------------------------------- | --------- |
| 19  | CODEOWNERS exists                 | `test -f .github/CODEOWNERS`     | Exit 0    |
| 20  | RemoteIDReceiver removed from git | `git ls-files RemoteIDReceiver/` | No output |
| 23  | Pre-push hook exists              | `test -x .husky/pre-push`        | Exit 0    |

### Additional Pass/Fail Criteria

1. `RemoteIDReceiver/` is not tracked by git (`git ls-files` returns empty).
2. `RemoteIDReceiver/` is listed in `.gitignore` to prevent re-addition.
3. `.github/CODEOWNERS` exists with a default rule (`*`) and security-sensitive path rules.
4. `.husky/pre-push` exists, is executable, and runs `npm run typecheck`.
5. Branch protection is enabled on `main` with required status checks and no force-push.
6. Branch protection blocks direct push to main (requires PR).

---

## 9. Traceability

| Finding                                 | Task                                       | Status  |
| --------------------------------------- | ------------------------------------------ | ------- |
| No branch protection on main            | 6.3.9 Action C                             | PLANNED |
| Broken git submodule (RemoteIDReceiver) | 6.3.9 Action A                             | PLANNED |
| No CODEOWNERS                           | 6.3.9 Action B                             | PLANNED |
| Pre-commit hook routinely bypassed      | 6.3.9 Action D (pre-push defense-in-depth) | PLANNED |
| No pre-push hook                        | 6.3.9 Action D                             | PLANNED |

### Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                              |
| -------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Branch protection locks out sole developer               | Medium     | High   | Start with `enforce_admins=false`; tighten after CI is stable           |
| Pre-push hook slows development workflow                 | Low        | Low    | Typecheck takes ~15 seconds; acceptable for push operations             |
| Removing RemoteIDReceiver breaks DroneID functionality   | Very Low   | Low    | Directory is empty; DroneID uses hardcoded paths (being fixed in 6.3.3) |
| CODEOWNERS auto-review requests overwhelm sole developer | Low        | Low    | All paths point to same owner; no additional review burden              |

---

## 10. Execution Order Notes

This task runs on **Track C** (CI/CD pipeline chain).

**Position in execution chain:**

- After: Task 6.3.7 (CI must be passing before protection can reference status checks)
- Parallel with: Task 6.3.8 (Security Tooling) -- both depend on Task 6.3.7 but are independent of each other
- Before: None (terminal task for git hygiene)

**Recommended execution within this task:**

1. Action A (Remove broken submodule) -- immediate, no dependencies.
2. Action B (Create CODEOWNERS) -- immediate, no dependencies.
3. Action D (Create pre-push hook) -- immediate, no dependencies.
4. Action C (Enable branch protection) -- LAST, requires CI pipeline to be passing (Task 6.3.7 complete and verified green).

**Critical sequencing warning**: Do NOT enable branch protection (Action C) until CI is green. If CI is still failing when protection is enabled, all PRs will be blocked from merging.

---

END OF DOCUMENT
