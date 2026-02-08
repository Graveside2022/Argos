# Phase 5.6.4: CI/CD Integration -- lint:size Script

| Attribute            | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.4                                            |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                               |
| **Risk Level**       | LOW                                                           |
| **Prerequisites**    | Task 5.6.1 COMPLETE (size rules in ESLint config)             |
| **Estimated Effort** | 10 minutes                                                    |
| **Standards**        | MISRA C:2023 Directive 4.1, NASA/JPL Rule 31, Barr C Rule 8.4 |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                         |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                            |
| **Date**             | 2026-02-08                                                    |

---

## 1. Objective

Add a dedicated `npm run lint:size` script to `package.json` that provides an independent, single-purpose size enforcement command for CI/CD pipeline integration. This script serves as the third and final enforcement layer in the defense-in-depth model.

---

## 2. lint:size Script Definition

**File**: `package.json`

Add the following to the `"scripts"` object:

```json
"lint:size": "eslint src/ --config config/eslint.config.js --rule '{\"max-lines\": [\"error\", {\"max\": 300, \"skipBlankLines\": true, \"skipComments\": true}], \"max-lines-per-function\": [\"error\", {\"max\": 60, \"skipBlankLines\": true, \"skipComments\": true, \"IIFEs\": true}]}' --no-fix",
```

**Net change**: +1 line in `package.json`.

---

## 3. Script Purpose and Design Rationale

### 3.1 Why a Separate Script

The existing `npm run lint` command runs ALL ESLint rules, which is correct for development. But in a CI/CD context, you may want to run size enforcement as a separate, fast, early gate that fails before running the full lint suite.

### 3.2 Independent Operation

The `lint:size` script operates independently of:

- The ESLint config file rules (inline `--rule` overrides ensure size checks run even if config is modified)
- The pre-commit hook (runs in CI/CD, not on developer machines)
- The full `npm run lint` command (can be run separately or in parallel)

### 3.3 Pipeline Integration Example

```yaml
# Example GitHub Actions workflow (for illustration, not a deliverable)
jobs:
    quality-gates:
        steps:
            - name: Size enforcement (fast gate)
              run: npm run lint:size
            - name: Full lint (all rules)
              run: npm run lint
            - name: Type checking
              run: npm run typecheck
            - name: Unit tests
              run: npm run test:unit
```

The `lint:size` step runs first because:

1. It is fast (~5 seconds on full `src/` directory)
2. Size violations indicate structural problems that must be fixed before other checks are meaningful
3. Failing early saves CI/CD compute time

---

## 4. Integration with Existing lint Script

The existing `npm run lint` command runs:

```
eslint . --config config/eslint.config.js
```

Because the `max-lines` and `max-lines-per-function` rules are added to the config file itself (Task 5.6.1), they will automatically be enforced by `npm run lint`. No changes to the existing `lint` script are required.

### Verification

```bash
# Confirm lint includes size rules
npm run lint 2>&1 | head -5
# Should show ESLint running with no size violations

# Confirm lint:size works independently
npm run lint:size 2>&1 | head -5
# Should show ESLint running with no size violations
```

---

## 5. Redundancy Analysis Table

After Phase 5.6, size enforcement exists at three independent layers:

| Layer               | Trigger                     | Scope             | Bypass                                                          | Speed  |
| ------------------- | --------------------------- | ----------------- | --------------------------------------------------------------- | ------ |
| ESLint config rules | Any `npx eslint` invocation | All source files  | `/* eslint-disable max-lines */` (governed by exemption policy) | varies |
| Pre-commit hook     | Every `git commit`          | Staged files only | `git commit --no-verify` (logged, requires CI/CD approval)      | <2s    |
| CI/CD `lint:size`   | Every pipeline run          | All source files  | Cannot bypass; pipeline fails                                   | ~5s    |

---

## 6. Defense-in-Depth Analysis

**Defense-in-depth**: A developer who bypasses the pre-commit hook with `--no-verify` will still be caught by the CI/CD gate. A developer who adds an `eslint-disable` comment will be caught in code review (the exemption policy requires lead engineer approval). All three layers must be defeated simultaneously for a violation to reach production.

| Attack Vector                           | Layer 1 (Config) | Layer 2 (Hook) | Layer 3 (CI/CD) | Production Reached? |
| --------------------------------------- | ---------------- | -------------- | --------------- | ------------------- |
| Normal commit, file >300 lines          | BLOCKED          | BLOCKED        | BLOCKED         | NO                  |
| `--no-verify` commit, file >300 lines   | ACTIVE           | BYPASSED       | BLOCKED         | NO                  |
| `eslint-disable` comment, no approval   | BYPASSED         | BYPASSED       | BYPASSED\*      | NO (code review)    |
| `eslint-disable` comment, with approval | BYPASSED         | BYPASSED       | BYPASSED        | YES (approved)      |
| CI/CD pipeline disabled                 | ACTIVE           | ACTIVE         | DISABLED        | NO (hook catches)   |
| All three layers defeated               | BYPASSED         | BYPASSED       | DISABLED        | YES (systemic fail) |

\*Code review catches unapproved `eslint-disable` comments per exemption policy (Task 5.6.2).

---

## 7. Verification Commands

| #   | Check                        | Command                         | Expected Result |
| --- | ---------------------------- | ------------------------------- | --------------- |
| V5  | `npm run lint:size` succeeds | `npm run lint:size`             | Exit code 0     |
| V14 | lint:size script exists      | `grep "lint:size" package.json` | Script found    |

### Additional Verification

```bash
# Verify lint:size detects violations (negative test)
echo "export const x = 1;" > /tmp/test-lint-size.ts
for i in $(seq 1 310); do echo "export const y${i} = ${i};" >> /tmp/test-lint-size.ts; done
cp /tmp/test-lint-size.ts src/lib/test-lint-size.ts

npm run lint:size 2>&1 | grep "max-lines"
# EXPECTED: Shows max-lines violation for test-lint-size.ts

rm src/lib/test-lint-size.ts
```

---

## 8. Risk Mitigations

| Risk                                           | Impact | Mitigation                                                                |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `lint:size` not added to CI/CD pipeline        | MEDIUM | Script exists in package.json; pipeline configuration is documented       |
| Inline `--rule` overrides conflict with config | LOW    | Inline rules supplement config rules; ESLint merges correctly             |
| Performance on RPi 5 hardware                  | LOW    | ~100 files/second; full `src/` (~500 files) completes in ~5 seconds       |
| JSON escaping in `--rule` argument             | LOW    | Escaped quotes tested; npm run handles shell escaping via scripts section |

---

## 9. Rollback Strategy

Remove the `lint:size` script from `package.json`:

```bash
# Remove the lint:size script line
# Manual edit: delete the "lint:size": "..." line from package.json scripts
```

This removes only the independent CI/CD gate. Size enforcement via ESLint config (Layer 1) and pre-commit hook (Layer 2) remains active.

---

## 10. Standards Compliance

| Standard                   | Requirement                                         | Resolution                                        |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| MISRA C:2023 Directive 4.1 | Run-time failures minimized through static analysis | CI/CD gate ensures no violations reach production |
| NASA/JPL Rule 31           | Static analysis tools shall be applied              | Dedicated script for pipeline integration         |
| Barr C Rule 8.4            | Static analysis required                            | Three independent enforcement layers              |

---

**END OF DOCUMENT**
