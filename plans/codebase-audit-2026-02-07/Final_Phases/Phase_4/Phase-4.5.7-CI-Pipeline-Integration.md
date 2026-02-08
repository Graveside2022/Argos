# Phase 4.5.7: CI Pipeline Integration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 1.7 (resolve all warnings), MISRA Rule 1.1 (all code shall conform), CERT MSC04-C (use comprehensive assertion strategy), NASA/JPL Rule 31 (no dead code), NASA/JPL Rule 13 (highest warning level)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.7 (FINAL INTEGRATION STEP)
**Risk Level**: LOW -- Configuration-only; no production code changes
**Prerequisites**: All preceding Tasks 4.5.0 through 4.5.6 complete
**Blocks**: Phase 5 (Architecture)
**Estimated Duration**: 30 minutes
**Estimated Files Touched**: 1-2 (`package.json`, optional pre-commit hook config)
**Standards**: BARR-C Rule 1.7, MISRA Rule 1.1, CERT MSC04-C, NASA/JPL Rule 31, NASA/JPL Rule 13

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Phase        | 4.5                                                     |
| Task         | 4.5.7                                                   |
| Title        | CI Pipeline Integration                                 |
| Status       | PLANNED                                                 |
| Risk Level   | LOW                                                     |
| Duration     | 30 minutes                                              |
| Dependencies | Tasks 4.5.0 through 4.5.6                               |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`       |
| Commit       | `chore: add CI strictness gate scripts to package.json` |

---

## Objective

Ensure all strictness checks are enforced in CI, preventing regressions. Add npm scripts for CI gates, define merge-blocking criteria, and optionally configure pre-commit hooks for developer workflow integration.

## Current State Assessment

| Metric               | Current State  | Target State                              |
| -------------------- | -------------- | ----------------------------------------- |
| CI typecheck script  | Not defined    | `ci:typecheck` in package.json            |
| CI lint script       | Not defined    | `ci:lint` in package.json                 |
| CI knip script       | Not defined    | `ci:knip` in package.json                 |
| CI all-checks script | Not defined    | `ci:all` in package.json                  |
| Pre-commit hook      | Not configured | Optional: lint-staged with husky/lefthook |
| Merge gate criteria  | Informal       | Documented and enforceable                |

---

## Execution Steps

### Step 1: Add CI Check Scripts to package.json

Add the following scripts to the `"scripts"` section of `package.json`:

```json
"ci:typecheck": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings false",
"ci:lint": "eslint --config config/eslint.config.js src/ --max-warnings 0",
"ci:knip": "knip --config knip.config.ts --no-exit-code",
"ci:all": "npm run ci:typecheck && npm run ci:lint"
```

**Script explanations:**

| Script         | Purpose                                                               | Exit Behavior             |
| -------------- | --------------------------------------------------------------------- | ------------------------- |
| `ci:typecheck` | Run svelte-check; fail on errors, allow warnings (a11y, CSS)          | Non-zero on TS errors     |
| `ci:lint`      | Run ESLint; fail on ANY error or warning (`--max-warnings 0`)         | Non-zero on any problem   |
| `ci:knip`      | Run knip dead export detection; informational only (`--no-exit-code`) | Always exits 0 (advisory) |
| `ci:all`       | Run typecheck + lint sequentially; fail if either fails               | Non-zero if either fails  |

### Step 2: Define Gate Criteria

| Check                  | Must Pass            | Blocks Merge  | Rationale                                            |
| ---------------------- | -------------------- | ------------- | ---------------------------------------------------- |
| `npm run ci:typecheck` | 0 errors             | YES           | Type errors indicate undefined behavior              |
| `npm run ci:lint`      | 0 errors, 0 warnings | YES           | All lint rules are intentionally set to their levels |
| `npm run ci:knip`      | Informational        | NO (advisory) | Dead exports are tracked, not blocking               |
| `npm run build`        | Clean build          | YES           | Production build must succeed                        |

### Step 3: Pre-Commit Hook Configuration (Optional)

If `husky` or `lefthook` is installed, configure pre-commit hooks.

**Option A: husky**

```bash
npx husky init
```

Add to `.husky/pre-commit`:

```bash
npx lint-staged
```

**Option B: lefthook**

Create `lefthook.yml`:

```yaml
pre-commit:
    commands:
        lint-staged:
            run: npx lint-staged
```

**lint-staged configuration** (add to `package.json`):

```json
"lint-staged": {
  "*.{ts,svelte}": ["eslint --config config/eslint.config.js --fix", "svelte-check"]
}
```

**Note**: The pre-commit hook is optional for Phase 4.5. The CI scripts are the primary enforcement mechanism. Pre-commit hooks improve developer experience but should not be the sole gate.

### Step 4: Verify All CI Scripts

```bash
npm run ci:typecheck
# Expected: Exit 0, 0 errors

npm run ci:lint
# Expected: Exit 0, 0 errors, 0 warnings

npm run ci:knip
# Expected: Exit 0 (advisory output)

npm run ci:all
# Expected: Exit 0

npm run build
# Expected: Exit 0
```

---

## Verification

| #   | Check                      | Command                                       | Expected |
| --- | -------------------------- | --------------------------------------------- | -------- |
| 1   | ci:typecheck script exists | `grep '"ci:typecheck"' package.json \| wc -l` | 1        |
| 2   | ci:lint script exists      | `grep '"ci:lint"' package.json \| wc -l`      | 1        |
| 3   | ci:knip script exists      | `grep '"ci:knip"' package.json \| wc -l`      | 1        |
| 4   | ci:all script exists       | `grep '"ci:all"' package.json \| wc -l`       | 1        |
| 5   | ci:typecheck passes        | `npm run ci:typecheck`                        | Exit 0   |
| 6   | ci:lint passes             | `npm run ci:lint`                             | Exit 0   |
| 7   | ci:knip runs               | `npm run ci:knip`                             | Exit 0   |
| 8   | ci:all passes              | `npm run ci:all`                              | Exit 0   |
| 9   | Build succeeds             | `npm run build`                               | Exit 0   |
| 10  | Unit tests pass            | `npm run test:unit`                           | Exit 0   |

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                 |
| --------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| --max-warnings 0 too strict for initial deployment  | MEDIUM     | LOW    | All warnings should already be resolved by prior tasks     |
| lint-staged slow on RPi 5 with type-checked linting | MEDIUM     | LOW    | Pre-commit hook is optional; CI is primary gate            |
| svelte-check --fail-on-warnings false misses issues | LOW        | LOW    | Warnings are a11y/CSS; tracked separately, not type safety |
| husky/lefthook not installed                        | MEDIUM     | NONE   | Pre-commit hook is optional; document installation steps   |

## Rollback Strategy

```bash
# Remove CI scripts from package.json
git checkout package.json

# Remove pre-commit hook if installed
rm -f .husky/pre-commit
# or
rm -f lefthook.yml
```

## Standards Traceability

| Standard | Rule     | Requirement                        | How This Task Satisfies It                         |
| -------- | -------- | ---------------------------------- | -------------------------------------------------- |
| BARR-C   | Rule 1.7 | Resolve all compiler warnings      | CI gate rejects any merge with errors or warnings  |
| MISRA    | Rule 1.1 | All code shall conform to standard | Automated enforcement prevents non-conforming code |
| CERT     | MSC04-C  | Comprehensive assertion strategy   | CI runs all assertion/lint tools on every change   |
| NASA/JPL | Rule 31  | No dead code                       | knip runs in CI (advisory) to track dead exports   |
| NASA/JPL | Rule 13  | Compile at highest warning level   | CI typecheck + lint at strictest settings          |

---

## Summary of Deliverables (Phase 4.5 Complete)

| Task  | Action                                                    | Outcome                             |
| ----- | --------------------------------------------------------- | ----------------------------------- |
| 4.5.0 | Fix 110 TS errors + 36 ESLint errors                      | Green baseline (0 errors)           |
| 4.5.1 | Install knip                                              | Dead export detection tooling       |
| 4.5.2 | Escalate ESLint rules                                     | `no-explicit-any` -> error, etc.    |
| 4.5.3 | Enable `noFallthroughCasesInSwitch` + `noImplicitReturns` | Switch safety + return completeness |
| 4.5.4 | Enable `noImplicitOverride`                               | Inheritance auditing                |
| 4.5.5 | Evaluate `noUncheckedIndexedAccess`                       | Decision: enable or defer           |
| 4.5.6 | Enable type-checked linting                               | Full `any` propagation prevention   |
| 4.5.7 | CI pipeline integration                                   | Regression prevention               |

**Total Commits**: 6-7 (one per task, 4.5.5 depends on evaluation result)

**End State**: Zero TypeScript errors, zero ESLint errors, type-checked linting active, CI gates enforced. The codebase will reject any new `any` introduction, any unhandled promise, and any type safety regression at the lint and compile level.

## Commit Message

```
chore: add CI strictness gate scripts to package.json
```

## Execution Tracking

| Step | Description                          | Status  | Started | Completed | Verified By |
| ---- | ------------------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Add CI scripts to package.json       | PENDING | --      | --        | --          |
| 2    | Document gate criteria               | PENDING | --      | --        | --          |
| 3    | Configure pre-commit hook (optional) | PENDING | --      | --        | --          |
| 4    | Verify all CI scripts pass           | PENDING | --      | --        | --          |
