# Phase 5.6: ESLint Enforcement Gates

**Document ID**: ARGOS-AUDIT-P5.6
**Version**: 1.0 (Final)
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Review Standard**: MISRA C:2023 Rule 1.1 (all code shall conform to coding standards), CERT C MSC41-C (never hard-code sizes), NASA/JPL Rule 2 (compiler warnings as errors), Barr C Rule 8.4 (static analysis required)

---

## 0. Executive Summary

| Attribute                 | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| **Risk Level**            | LOW                                                                   |
| **Estimated Effort**      | 2 hours                                                               |
| **Files Touched**         | 3 configuration files, 1 documentation file                           |
| **Files Created**         | 0 (all files already exist)                                           |
| **Prerequisites**         | Phase 5.1 through 5.5 ALL COMPLETE and verified                       |
| **Defects Resolved**      | P5-019 (no ESLint size enforcement), P5-020 (no pre-commit size gate) |
| **Blocking Dependencies** | NONE -- this phase runs last                                          |
| **Rollback Strategy**     | `git revert` the config commits; zero production code is modified     |

### Purpose

This phase adds **automated enforcement** to prevent the codebase from ever regressing to oversized files or functions. After Phases 5.1 through 5.5 reduce every file to <=300 lines and every function to <=60 lines, Phase 5.6 locks that state permanently via three enforcement layers:

1. **Layer 1 -- ESLint Rules**: Static analysis rules integrated into the existing ESLint flat config at `config/eslint.config.js`. Every invocation of `npm run lint` will enforce size limits.

2. **Layer 2 -- Pre-Commit Hook**: The existing husky v9 + lint-staged infrastructure at `.husky/pre-commit` and `config/.lintstagedrc.json` is extended to enforce size rules on staged files before every commit.

3. **Layer 3 -- CI/CD Gate**: A dedicated `npm run lint:size` script provides an independent size-check command for pipeline integration.

No layer depends on the others. Any single layer failing will still catch violations. This defense-in-depth approach follows MISRA C:2023 Directive 4.1 (run-time failures shall be minimized through static analysis) and NASA/JPL Rule 31 (static analysis tools shall be applied).

---

## 1. Current State Assessment

### 1.1 ESLint Configuration

**File**: `/home/kali/Documents/Argos/Argos/config/eslint.config.js`

ESLint 9.30.1 flat config format. Four config objects:

| Object                          | Files Targeted | Current Rules                                              |
| ------------------------------- | -------------- | ---------------------------------------------------------- |
| `js.configs.recommended`        | All JS         | ESLint recommended defaults                                |
| `**/*.js, **/*.ts, **/*.svelte` | All source     | `no-unused-vars` with `^_` ignore pattern                  |
| `**/*.ts, **/*.svelte`          | TypeScript     | `@typescript-eslint/recommended` rules, `no-console: warn` |
| `**/*.svelte`                   | Svelte only    | `svelte.configs.recommended.rules`                         |
| `**/*.cjs`                      | CommonJS       | `no-unused-vars` with `^_` ignore pattern                  |

**Size rules currently configured**: NONE.

### 1.2 Pre-Commit Hook Infrastructure

| Component            | Status                                | Location                                                              |
| -------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| husky v9.1.7         | Installed (devDependency)             | `node_modules/husky/`                                                 |
| `.husky/pre-commit`  | EXISTS, contains `npx lint-staged`    | `.husky/pre-commit`                                                   |
| lint-staged v16.1.2  | Installed (devDependency)             | `node_modules/lint-staged/`                                           |
| `.lintstagedrc.json` | EXISTS at `config/.lintstagedrc.json` | Runs `eslint --fix` + `prettier --write` on staged `*.{js,ts,svelte}` |
| `prepare` script     | EXISTS: `"husky install"`             | `package.json` line 27                                                |

**Observation**: The pre-commit hook infrastructure is FULLY OPERATIONAL. lint-staged already runs ESLint on staged files. Adding `max-lines` and `max-lines-per-function` rules to the ESLint config will automatically propagate to the pre-commit hook with ZERO additional configuration.

This is the simplest possible integration path. No new tooling installation required.

### 1.3 CI/CD Scripts

Current `lint` script in `package.json`:

```
"lint": "eslint . --config config/eslint.config.js"
```

No dedicated size-checking script exists. Adding one provides an independent verification path.

---

## 2. Task 5.6.1: Add ESLint Size Rules

### 2.1 Subtask 5.6.1.1: Verify Current Config Structure

**Action**: Read `config/eslint.config.js` and confirm the config object where rules should be added.

**Target config object**: The second object (lines 28-49), which applies to `**/*.js, **/*.ts, **/*.svelte` -- all source files. This is the correct location because:

- It targets ALL source file types (JS, TS, Svelte)
- It is the broadest rule set (not TypeScript-specific, not Svelte-specific)
- `max-lines` and `max-lines-per-function` are core ESLint rules, not plugin rules
- They must apply to ALL source files uniformly

**Verification command**:

```bash
node -e "
const config = await import('./config/eslint.config.js');
const obj = config.default[2]; // 0=recommended, 1=ignores, 2=all-source
console.log('Files:', obj.files);
console.log('Rules:', Object.keys(obj.rules));
" --input-type=module
```

### 2.2 Subtask 5.6.1.2: Add Size Rules

**File**: `config/eslint.config.js`

**Location**: Inside the `rules` object of the config block targeting `['**/*.js', '**/*.ts', '**/*.svelte']` (lines 40-48).

**Rules to add** (insert after the existing `no-unused-vars` rule at line 48):

```javascript
{
    files: ['**/*.js', '**/*.ts', '**/*.svelte'],
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.es2022,
            NodeJS: 'readonly'
        }
    },
    rules: {
        'no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }
        ],
        'max-lines': ['error', {
            max: 300,
            skipBlankLines: true,
            skipComments: true
        }],
        'max-lines-per-function': ['error', {
            max: 60,
            skipBlankLines: true,
            skipComments: true,
            IIFEs: true
        }]
    }
},
```

**Rule semantics**:

| Rule                     | Threshold | skipBlankLines | skipComments | Effect                                                                                                                            |
| ------------------------ | --------- | -------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `max-lines`              | 300       | true           | true         | Only executable code lines count. A 300-line file with 50 comment lines and 20 blank lines is still compliant (only 230 counted). |
| `max-lines-per-function` | 60        | true           | true         | Same counting semantics. IIFEs are counted as separate functions, not as part of the enclosing scope.                             |

**Rationale for thresholds**:

- **300 lines per file**: Aligns with Phase 5.4 target. A 300-line file fits on ~6 screens at 50 lines each, enabling full comprehension in a single review session. This is consistent with NASA/JPL Power of Ten Rule 4 ("no function should be longer than what can be printed on a single sheet of paper") scaled to file level.

- **60 lines per function**: Aligns with Phase 5.5 target. A 60-line function fits on a single screen plus context. MISRA C:2023 recommends functions that can be "fully understood in a single viewing." The Linux kernel coding style guide targets 24 lines; we use 60 as a pragmatic compromise for TypeScript/Svelte.

- **IIFEs: true**: Immediately Invoked Function Expressions are counted as standalone functions. Without this flag, a module-level IIFE's body would count against the enclosing module scope, producing false positives on module files that use the IIFE pattern for encapsulation.

### 2.3 Subtask 5.6.1.3: Verify Zero Violations

**Action**: Run ESLint against the full source tree and confirm zero `max-lines` or `max-lines-per-function` violations.

```bash
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep -E "max-lines|max-lines-per-function" \
  | tee /tmp/eslint-size-violations.txt

VIOLATION_COUNT=$(wc -l < /tmp/eslint-size-violations.txt)
echo "Size violations: ${VIOLATION_COUNT}"

if [ "${VIOLATION_COUNT}" -gt 0 ]; then
    echo "FAIL: ${VIOLATION_COUNT} size violations detected."
    echo "Phase 5.1-5.5 is INCOMPLETE. Fix all oversized files/functions before proceeding."
    exit 1
else
    echo "PASS: Zero size violations. Phase 5.6.1 complete."
fi
```

**Expected output**: `PASS: Zero size violations. Phase 5.6.1 complete.`

### 2.4 Subtask 5.6.1.4: Handle Violations (Contingency)

If violations are found, this indicates that Phases 5.1 through 5.5 did not complete successfully. The correct response is:

1. **DO NOT weaken the rules** (do not raise max to 400 or 80)
2. **DO NOT add eslint-disable comments** (except for files meeting the exemption criteria in Task 5.6.2)
3. **Return to the appropriate prior phase** and complete the decomposition work
4. **Log the discrepancy** in the audit trail with the exact file/function and expected phase

| Violation Type                                                    | Return To |
| ----------------------------------------------------------------- | --------- |
| File >300 lines, file is a God Page (>1000)                       | Phase 5.1 |
| File >300 lines, file is in `services/hackrf/` or `services/sdr/` | Phase 5.2 |
| File >300 lines, file is in `services/` or `server/`              | Phase 5.4 |
| Function >60 lines                                                | Phase 5.5 |

---

## 3. Task 5.6.2: Configure Exemptions

### 3.1 Exemption Policy

Exemptions from `max-lines` are granted ONLY for files meeting ALL of the following criteria:

1. The file contains ONLY static data (lookup tables, constant arrays, enum mappings)
2. The file contains ZERO functions, ZERO control flow, ZERO side effects
3. The file is a pure declaration -- it would compile to a constant in any compiled language
4. A written justification is reviewed and approved by the lead engineer
5. The exemption comment references this document by ID (ARGOS-AUDIT-P5.6)

**No file may EVER be exempted from `max-lines-per-function`.** There are zero legitimate engineering reasons for a function to exceed 60 lines of executable code. Any function claiming to need an exemption is a function that has not been properly decomposed.

### 3.2 Candidate Exemption Files

| File                              | Expected Size                                 | Content                                                                   | Justification                                                                                                                                                         |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/gsmLookupTables.ts` | ~800 lines                                    | Static MNC-to-carrier and MCC-to-country `Record<string, string>` objects | Pure data. No functions. No logic. Splitting would create artificial module boundaries within a single lookup table. ITU-T E.212 defines the structure; we mirror it. |
| `src/lib/server/kismet/types.ts`  | ~350 lines (after Phase 4 type consolidation) | Pure TypeScript `interface` and `type` definitions                        | No runtime code. No functions. Interfaces are compile-time only. Splitting type files by arbitrary line count reduces co-location of related types.                   |

### 3.3 Exemption Format

The exemption comment MUST appear as the FIRST non-empty line of the file, before any imports:

```typescript
/* eslint-disable max-lines */
// EXEMPTION: ARGOS-AUDIT-P5.6 Section 3.2
// Reason: Pure static ITU-T E.212 lookup tables. Zero functions, zero control flow.
// Approved by: [Lead Engineer Name], [Date]
// Review date: [Next quarterly review date]

export const mncToCarrier: Record<string, string> = {
	// ...
};
```

**Requirements for the exemption comment**:

1. References this document ID (`ARGOS-AUDIT-P5.6 Section 3.2`)
2. States the specific reason (not a generic "file is too large")
3. Names the approving engineer
4. Includes a review date (quarterly review of all exemptions)

### 3.4 Exemption Audit Schedule

All exemptions must be reviewed quarterly. During each review:

1. Verify the file still meets all five criteria in Section 3.1
2. Verify no functions have been added to the file
3. Verify the file size has not grown beyond its last-reviewed size without justification
4. Update the review date in the exemption comment
5. Log the review in the project audit trail

---

## 4. Task 5.6.3: Pre-Commit Hook Configuration

### 4.1 Current State

The pre-commit infrastructure is already operational:

```
.husky/pre-commit  -->  npx lint-staged  -->  config/.lintstagedrc.json
                                                |
                                                +--> eslint --config config/eslint.config.js --fix
                                                +--> prettier --write
```

Because lint-staged already runs ESLint on staged `*.{js,ts,svelte}` files, the `max-lines` and `max-lines-per-function` rules added in Task 5.6.1 will AUTOMATICALLY be enforced on every commit. No changes to `.husky/pre-commit` or `.lintstagedrc.json` are required for basic enforcement.

### 4.2 Enhancement: Explicit Size Check in Pre-Commit

However, there is a subtlety: the current lint-staged config uses `--fix`, which auto-fixes violations where possible. The `max-lines` and `max-lines-per-function` rules are NOT auto-fixable (ESLint cannot automatically split files or functions). The `--fix` flag is harmless but does not help for size rules. ESLint will correctly report these as errors and lint-staged will block the commit.

To provide clearer error messages to developers, we enhance the `.husky/pre-commit` hook to add an explicit size-violation check with human-readable output BEFORE lint-staged runs:

**File**: `.husky/pre-commit`

```bash
#!/usr/bin/env sh

# ============================================================================
# ARGOS Pre-Commit Hook (husky v9)
# Enforcement: ARGOS-AUDIT-P5.6 -- File and Function Size Gates
# ============================================================================

# Phase 1: Size enforcement on staged source files (fast, targeted)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '\.(ts|js|svelte)$' \
  | grep -v 'node_modules' \
  | grep -v '.svelte-kit')

if [ -n "$STAGED_FILES" ]; then
    # Run ESLint size rules ONLY (fast check, no auto-fix)
    SIZE_VIOLATIONS=$(echo "$STAGED_FILES" | xargs npx eslint \
        --config config/eslint.config.js \
        --no-fix \
        --rule '{"max-lines": ["error", {"max": 300, "skipBlankLines": true, "skipComments": true}]}' \
        --rule '{"max-lines-per-function": ["error", {"max": 60, "skipBlankLines": true, "skipComments": true, "IIFEs": true}]}' \
        2>&1 | grep -E "max-lines|max-lines-per-function")

    if [ -n "$SIZE_VIOLATIONS" ]; then
        echo ""
        echo "================================================================"
        echo "  COMMIT BLOCKED: File/Function Size Violations Detected"
        echo "  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)"
        echo "================================================================"
        echo ""
        echo "$SIZE_VIOLATIONS"
        echo ""
        echo "To fix:"
        echo "  - Files >300 lines: Split into smaller modules"
        echo "  - Functions >60 lines: Extract helper functions"
        echo "  - Data-only files: See exemption policy in Phase_5.6 Section 3"
        echo ""
        echo "To bypass (EMERGENCY ONLY, requires CI/CD approval):"
        echo "  git commit --no-verify"
        echo ""
        exit 1
    fi
fi

# Phase 2: Full lint-staged pipeline (ESLint --fix + Prettier)
npx lint-staged
```

### 4.3 Why Two Phases in the Hook

The hook runs size checks BEFORE lint-staged for two reasons:

1. **Clearer error messages**: lint-staged's error output is verbose and includes the full ESLint report. The Phase 1 check extracts only size-related violations and presents them with actionable instructions.

2. **Faster feedback**: If a file exceeds 300 lines, there is no point running Prettier or auto-fixable ESLint rules on it. The developer needs to go back and decompose the file first. Failing fast saves time.

Phase 2 (`npx lint-staged`) then runs the full pipeline, which includes all ESLint rules (not just size), Prettier formatting, and any other staged-file checks configured in `.lintstagedrc.json`.

### 4.4 Testing the Hook

After installing the enhanced hook, verify it works correctly:

```bash
# Test 1: Create an oversized file and attempt to commit it
cat > /tmp/test-oversized.ts << 'EOF'
// This file has >300 lines of executable code
export const data = {
EOF
for i in $(seq 1 310); do
    echo "    field_${i}: ${i}," >> /tmp/test-oversized.ts
done
echo "};" >> /tmp/test-oversized.ts

cp /tmp/test-oversized.ts src/lib/test-oversized.ts
git add src/lib/test-oversized.ts
git commit -m "test: oversized file should be blocked"
# EXPECTED: Commit blocked with "COMMIT BLOCKED" message

# Clean up
git reset HEAD src/lib/test-oversized.ts
rm src/lib/test-oversized.ts

# Test 2: Create a compliant file and verify it commits successfully
cat > /tmp/test-compliant.ts << 'EOF'
export function hello(): string {
    return 'world';
}
EOF

cp /tmp/test-compliant.ts src/lib/test-compliant.ts
git add src/lib/test-compliant.ts
git commit -m "test: compliant file should be allowed"
# EXPECTED: Commit succeeds

# Clean up
git revert HEAD --no-edit
rm src/lib/test-compliant.ts
```

---

## 5. Task 5.6.4: CI/CD Integration

### 5.1 Add Dedicated Size-Check Script

**File**: `package.json`

Add the following script to the `"scripts"` object:

```json
"lint:size": "eslint src/ --config config/eslint.config.js --rule '{\"max-lines\": [\"error\", {\"max\": 300, \"skipBlankLines\": true, \"skipComments\": true}], \"max-lines-per-function\": [\"error\", {\"max\": 60, \"skipBlankLines\": true, \"skipComments\": true, \"IIFEs\": true}]}' --no-fix"
```

**Purpose**: This script provides an independent, single-purpose size enforcement command that can be invoked in any CI/CD pipeline (GitHub Actions, Jenkins, GitLab CI, etc.) without requiring the full lint configuration.

**Why a separate script**: The existing `npm run lint` command runs ALL ESLint rules, which is correct for development. But in a CI/CD context, you may want to run size enforcement as a separate, fast, early gate that fails before running the full lint suite. This enables a pipeline like:

```yaml
# Example GitHub Actions workflow (not a deliverable, for illustration)
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

### 5.2 Verify Integration with Existing Lint

The existing `npm run lint` command runs:

```
eslint . --config config/eslint.config.js
```

Because the `max-lines` and `max-lines-per-function` rules are added to the config file itself (Task 5.6.1), they will automatically be enforced by `npm run lint`. No changes to the existing `lint` script are required.

**Verification**:

```bash
# Confirm lint includes size rules
npm run lint 2>&1 | head -5
# Should show ESLint running with no size violations

# Confirm lint:size works independently
npm run lint:size 2>&1 | head -5
# Should show ESLint running with no size violations
```

### 5.3 Redundancy Analysis

After Phase 5.6, size enforcement exists at three independent layers:

| Layer               | Trigger                     | Scope             | Bypass                                                          |
| ------------------- | --------------------------- | ----------------- | --------------------------------------------------------------- |
| ESLint config rules | Any `npx eslint` invocation | All source files  | `/* eslint-disable max-lines */` (governed by exemption policy) |
| Pre-commit hook     | Every `git commit`          | Staged files only | `git commit --no-verify` (logged, requires CI/CD approval)      |
| CI/CD `lint:size`   | Every pipeline run          | All source files  | Cannot bypass; pipeline fails                                   |

**Defense-in-depth**: A developer who bypasses the pre-commit hook with `--no-verify` will still be caught by the CI/CD gate. A developer who adds an `eslint-disable` comment will be caught in code review (the exemption policy requires lead engineer approval). All three layers must be defeated simultaneously for a violation to reach production.

---

## 6. Task 5.6.5: Developer Documentation

### 6.1 Addition to CLAUDE.md

The following section should be appended to the `## Important Development Notes` section of `CLAUDE.md`:

```markdown
8. **File and Function Size Limits**: ESLint enforces strict size limits on all source files:
    - Maximum **300 lines** per file (blank lines and comments excluded)
    - Maximum **60 lines** per function (blank lines and comments excluded)
    - These rules are enforced at three layers: ESLint config, pre-commit hook, and CI/CD
    - Violations block commits and fail CI/CD pipelines
    - To check a specific file: `npx eslint <file> --config config/eslint.config.js`
    - To check all files: `npm run lint:size`
    - Exemptions: Only pure data files (zero functions, zero logic) may be exempted.
      Add `/* eslint-disable max-lines */` with justification referencing ARGOS-AUDIT-P5.6.
      Requires lead engineer approval. Functions may NEVER be exempted.
```

### 6.2 Quick Reference Card

The following commands are available for size-related checks:

| Task                                     | Command                                                                      | Speed |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ----- |
| Check one file for size violations       | `npx eslint <file> --config config/eslint.config.js`                         | <1s   |
| Check all files for size violations only | `npm run lint:size`                                                          | ~10s  |
| Check all files for all lint violations  | `npm run lint`                                                               | ~30s  |
| Count lines in a file (raw)              | `wc -l <file>`                                                               | <1s   |
| Count executable lines in a file         | `grep -cv '^\s*$\|^\s*//' <file>`                                            | <1s   |
| Find all files >300 lines (raw count)    | `find src -name '*.ts' -o -name '*.svelte' \| xargs wc -l \| awk '$1 > 300'` | ~2s   |
| Scan function sizes (Python scanner)     | `python3 scripts/verify-function-length.py`                                  | ~5s   |

### 6.3 Common Scenarios

**Scenario 1**: Developer adds code to a file, pushing it to 310 lines.

```
$ git commit -m "feat: add new endpoint"
================================================================
  COMMIT BLOCKED: File/Function Size Violations Detected
  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)
================================================================

  src/lib/services/kismet/scanner.ts
    1:1  error  File has too many lines (310). Maximum allowed is 300  max-lines

To fix:
  - Files >300 lines: Split into smaller modules
```

**Resolution**: Extract 10+ lines into a helper module. Import the helper. Re-stage and commit.

**Scenario 2**: Developer creates a 70-line function.

```
$ git commit -m "feat: complex validation logic"
================================================================
  COMMIT BLOCKED: File/Function Size Violations Detected
  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)
================================================================

  src/lib/services/validation/inputValidator.ts
    15:1  error  Function 'validateInput' has too many lines (70).
                 Maximum allowed is 60  max-lines-per-function

To fix:
  - Functions >60 lines: Extract helper functions
```

**Resolution**: Decompose `validateInput` into `validateInputFormat` and `validateInputSemantics`. Each function handles one concern. Re-stage and commit.

**Scenario 3**: Developer needs to add entries to a lookup table that is already exempted.

```
$ git commit -m "feat: add new GSM carrier codes"
# Commits successfully -- the file has /* eslint-disable max-lines */ at top
```

This is correct behavior. The exempted file is allowed to grow because it contains only static data. The exemption was approved by the lead engineer per Section 3.

---

## 7. Complete File Diffs

### 7.1 config/eslint.config.js (after modification)

The modified config object (lines 28-49 in current file) becomes:

```javascript
{
    files: ['**/*.js', '**/*.ts', '**/*.svelte'],
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.es2022,
            NodeJS: 'readonly'
        }
    },
    rules: {
        'no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }
        ],
        'max-lines': ['error', {
            max: 300,
            skipBlankLines: true,
            skipComments: true
        }],
        'max-lines-per-function': ['error', {
            max: 60,
            skipBlankLines: true,
            skipComments: true,
            IIFEs: true
        }]
    }
},
```

**Net change**: +10 lines (two rule definitions added to existing `rules` object).

### 7.2 .husky/pre-commit (full replacement)

See Section 4.2 for the complete file content. The current single-line file (`npx lint-staged`) is replaced with the enhanced two-phase hook.

**Net change**: +35 lines (1 line replaced with 36 lines).

### 7.3 package.json (one script added)

Add to the `"scripts"` section:

```json
"lint:size": "eslint src/ --config config/eslint.config.js --rule '{\"max-lines\": [\"error\", {\"max\": 300, \"skipBlankLines\": true, \"skipComments\": true}], \"max-lines-per-function\": [\"error\", {\"max\": 60, \"skipBlankLines\": true, \"skipComments\": true, \"IIFEs\": true}]}' --no-fix",
```

**Net change**: +1 line.

### 7.4 CLAUDE.md (one section appended)

See Section 6.1 for the text to append. Insert after item 7 in `## Important Development Notes`.

**Net change**: +9 lines.

---

## 8. Svelte File Considerations

### 8.1 How ESLint Counts Lines in .svelte Files

Svelte files have three sections:

```svelte
<script lang="ts">
	// TypeScript code
</script>

<!-- HTML template -->
<div>...</div>

<style>
	/* CSS */
</style>
```

When ESLint processes `.svelte` files through `svelte-eslint-parser` (v1.2.0, installed in this project), the `max-lines` rule counts ALL lines in the file, including the `<template>` and `<style>` sections. This is because ESLint sees the entire file as a single source unit.

**Implication**: A Svelte file with 100 lines of TypeScript, 150 lines of template HTML, and 50 lines of CSS totals 300+ raw lines. After `skipBlankLines` and `skipComments`, the count may still exceed 300 if the template is large.

### 8.2 Mitigation

Phase 5.1 (God Page Decomposition) addresses this by:

1. Extracting large template sections into child components (reduces template lines)
2. Extracting CSS to Tailwind utility classes or shared stylesheets (reduces style lines)
3. Extracting TypeScript logic to service modules (reduces script lines)

After Phase 5.1, the largest Svelte pages should fit within 300 total lines. However, if edge cases arise where a Svelte file exceeds 300 lines due to template density (many short HTML elements, each on its own line), the resolution is component extraction, NOT an exemption.

### 8.3 max-lines-per-function and Svelte

The `max-lines-per-function` rule applies to functions defined in the `<script>` section. It does NOT count template lines or style lines as part of any function. This rule works correctly with `svelte-eslint-parser` and requires no special handling for Svelte files.

### 8.4 Verification with Actual Svelte Files

After enabling the rules, run the following to identify any Svelte-specific issues:

```bash
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep -E "\.svelte" \
  | grep -E "max-lines" \
  | tee /tmp/svelte-size-issues.txt

echo "Svelte-specific size issues: $(wc -l < /tmp/svelte-size-issues.txt)"
```

If Svelte-specific issues are found, resolve them by extracting child components. Do NOT create Svelte-specific exemptions.

---

## 9. Verification Checklist

Execute each verification in order. All must pass before Phase 5.6 is marked COMPLETE.

### 9.1 ESLint Config Verification

| #   | Check                                    | Command                                                                                           | Expected Result                       | Pass/Fail |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- | --------- |
| V1  | ESLint parses config without error       | `npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 \| grep max-lines`                       | Shows `max-lines` rule configured     |           |
| V2  | Zero `max-lines` violations              | `npx eslint src/ --config config/eslint.config.js 2>&1 \| grep "max-lines[^-]" \| wc -l`          | `0`                                   |           |
| V3  | Zero `max-lines-per-function` violations | `npx eslint src/ --config config/eslint.config.js 2>&1 \| grep "max-lines-per-function" \| wc -l` | `0`                                   |           |
| V4  | `npm run lint` succeeds                  | `npm run lint`                                                                                    | Exit code 0 (warnings OK, errors = 0) |           |
| V5  | `npm run lint:size` succeeds             | `npm run lint:size`                                                                               | Exit code 0                           |           |

### 9.2 Pre-Commit Hook Verification

| #   | Check                                  | Command                                                  | Expected Result                                        | Pass/Fail |
| --- | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | --------- |
| V6  | Hook blocks oversized file             | Create 310-line file, stage, attempt commit              | Commit blocked with `COMMIT BLOCKED` message           |           |
| V7  | Hook blocks oversized function         | Create file with 65-line function, stage, attempt commit | Commit blocked with `max-lines-per-function` in output |           |
| V8  | Hook allows compliant file             | Create 50-line file with 10-line function, stage, commit | Commit succeeds                                        |           |
| V9  | Hook runs lint-staged after size check | Commit a file with trailing whitespace                   | Prettier formats it before commit completes            |           |

### 9.3 Exemption Verification

| #   | Check                                    | Command                                                  | Expected Result                                            | Pass/Fail |
| --- | ---------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| V10 | Exempted file has correct comment format | `head -4 src/lib/data/gsmLookupTables.ts`                | Shows `eslint-disable max-lines` + justification           |           |
| V11 | Exempted file contains zero functions    | `grep -c "function\|=>" src/lib/data/gsmLookupTables.ts` | `0` (or only type annotations, not function definitions)   |           |
| V12 | All exemptions documented                | Count `eslint-disable max-lines` across `src/`           | Count matches number of approved exemptions in Section 3.2 |           |

### 9.4 Documentation Verification

| #   | Check                   | Command                                                            | Expected Result                | Pass/Fail |
| --- | ----------------------- | ------------------------------------------------------------------ | ------------------------------ | --------- |
| V13 | CLAUDE.md updated       | `grep "max-lines" CLAUDE.md`                                       | Shows size limit documentation |           |
| V14 | lint:size script exists | `npm run lint:size --help 2>&1` or `grep "lint:size" package.json` | Script found                   |           |

---

## 10. Risk Mitigations

### 10.1 Developer Friction

**Risk**: Developers accustomed to writing large files or functions will find the size limits restrictive and may resist or frequently bypass the hooks.

**Mitigation**:

- Document the rules clearly (Task 5.6.5) with concrete examples of how to resolve violations
- Provide the `lint:size` command so developers can check compliance before attempting a commit
- Communicate the rationale: smaller files and functions are easier to review, test, debug, and maintain
- Phase 5.1-5.5 has already done the hard work -- these rules only prevent regression

**Escalation path**: If a developer believes a specific case genuinely requires an exemption, they follow the exemption process in Section 3. The lead engineer evaluates and either approves (with documentation) or provides guidance on decomposition.

### 10.2 Svelte Template False Positives

**Risk**: Svelte files may trigger `max-lines` due to large HTML templates, even when the TypeScript logic section is small.

**Mitigation**: Phase 5.1 decomposes God Pages by extracting child components, which reduces template size. For remaining cases, the solution is always component extraction, never an exemption. See Section 8 for detailed analysis.

### 10.3 Hook Bypass via --no-verify

**Risk**: Developers can bypass the pre-commit hook with `git commit --no-verify`.

**Mitigation**:

- The CI/CD `lint:size` gate is the backstop -- it cannot be bypassed by individual developers
- Code review should flag `--no-verify` usage (visible in commit metadata if hooks were skipped)
- The `--no-verify` bypass path is intentionally preserved for genuine emergencies (production hotfixes that require immediate deployment)
- Document that `--no-verify` usage requires post-hoc justification

### 10.4 ESLint Version Compatibility

**Risk**: Future ESLint upgrades may change rule behavior or flat config format.

**Mitigation**:

- `max-lines` and `max-lines-per-function` are core ESLint rules that have existed since ESLint v1. They are extremely stable.
- The flat config format is the only format supported in ESLint 9+. This project already uses it.
- Pin ESLint to a major version in `package.json` (currently `^9.30.1`, which allows 9.x updates but blocks ESLint 10).

### 10.5 Performance Impact on Large Repositories

**Risk**: Running ESLint size checks on every commit adds latency to the development workflow.

**Mitigation**:

- lint-staged only processes STAGED files, not the entire source tree. A typical commit stages 1-5 files, taking <2 seconds to lint.
- The Phase 1 size check in the pre-commit hook uses `--no-fix`, which is faster than the `--fix` pass that follows.
- On the RPi 5 hardware (4x Cortex-A76), ESLint processes ~100 files/second. The full `lint:size` run over `src/` (~500 files) completes in ~5 seconds.

---

## 11. Commit Plan

This phase produces exactly two commits:

### Commit 1: ESLint Size Rules

```
refactor(phase-5.6): add max-lines and max-lines-per-function ESLint rules

Adds enforcement gates to config/eslint.config.js:
- max-lines: 300 (skipBlankLines, skipComments)
- max-lines-per-function: 60 (skipBlankLines, skipComments, IIFEs)

Adds lint:size script to package.json for independent CI/CD enforcement.

Updates CLAUDE.md with size limit documentation.

Verification: npm run lint && npm run lint:size (0 violations)
```

### Commit 2: Pre-Commit Hook Enhancement

```
refactor(phase-5.6): enhance pre-commit hook with size enforcement gate

Replaces single-line .husky/pre-commit with two-phase hook:
- Phase 1: Fast size-only ESLint check with clear error messages
- Phase 2: Full lint-staged pipeline (ESLint --fix + Prettier)

Adds explicit COMMIT BLOCKED messaging when files exceed 300 lines
or functions exceed 60 lines. Provides fix instructions in output.

Verification: Stage oversized test file, verify commit is blocked.
```

---

## 12. Traceability

| Defect ID | Description                           | Resolution                                                                                                     | Verification                                                                                   |
| --------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P5-019    | No ESLint size enforcement configured | Task 5.6.1 adds `max-lines: 300` and `max-lines-per-function: 60` to `config/eslint.config.js`                 | `npx eslint --print-config src/lib/stores/hackrf.ts \| grep max-lines` returns configured rule |
| P5-020    | No pre-commit size gate               | Task 5.6.3 enhances `.husky/pre-commit` with explicit size checks; lint-staged already propagates ESLint rules | Stage oversized file, verify commit is blocked                                                 |

---

## 13. Phase Completion Criteria

Phase 5.6 is COMPLETE when ALL of the following are true:

1. `config/eslint.config.js` contains `max-lines` and `max-lines-per-function` rules
2. `npx eslint src/ --config config/eslint.config.js` reports ZERO size violations
3. `.husky/pre-commit` contains the enhanced two-phase hook from Section 4.2
4. `package.json` contains the `lint:size` script
5. `CLAUDE.md` documents the size limits and exemption policy
6. All exempted files have the correct comment format per Section 3.3
7. All 14 verification checks (V1-V14) in Section 9 pass
8. Both commits (Section 11) are pushed to the feature branch

Upon completion, the codebase is permanently protected against file and function size regression. No file or function can grow beyond the enforced limits without explicit, documented, lead-engineer-approved exemption.

---

## 14. Security Enforcement Additions (REGRADE ADDITION)

> **REGRADE CORRECTION (2026-02-08)**: Per Phase 5 Final Audit Report, the enforcement
> gates should include security rules, not just size rules. This section adds
> `eslint-plugin-security` and escalates existing type safety rules.

### 14.1 Install eslint-plugin-security

```bash
npm install --save-dev eslint-plugin-security
```

### 14.2 ESLint Security Rules

Add to `config/eslint.config.js`:

```javascript
import security from 'eslint-plugin-security';

// In the rules array:
{
    plugins: { security },
    rules: {
        // CRITICAL: Detect child_process usage without validation
        'security/detect-child-process': 'error',
        // CRITICAL: Detect non-literal fs filenames (path traversal risk)
        'security/detect-non-literal-fs-filename': 'warn',
        // HIGH: Detect eval-like patterns
        'security/detect-eval-with-expression': 'error',
        // HIGH: Detect non-literal require (code injection risk)
        'security/detect-non-literal-require': 'error',
        // MEDIUM: Detect potential RegExp DoS
        'security/detect-unsafe-regex': 'warn',
        // Detect SQL injection patterns
        'security/detect-sql-injection': 'warn',
    }
}
```

### 14.3 Type Safety Escalations

```javascript
// Escalate existing rules:
'@typescript-eslint/no-explicit-any': 'error',  // was 'warn'
// Enable floating promise detection (catches unhandled async errors):
'@typescript-eslint/no-floating-promises': 'error',  // requires parserOptions.project
```

### 14.4 Rollout Strategy (REGRADE ADDITION)

> **REGRADE CORRECTION (2026-02-08)**: Per Phase 5 Final Audit Report deficiency 1,
> the enforcement gates need a phased rollout. Enabling all rules at once would block
> all commits if any file or function is still oversized.

**Phase A: Warning Mode** (enable immediately, before Phase 5.1 begins)

```javascript
'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
'security/detect-child-process': 'warn',
```

- Pre-commit hook runs but does NOT block commits
- Developers see warnings and violation counts
- Track violation count trend weekly

**Phase B: Partial Enforcement** (after Phases 5.1-5.4 complete)

```javascript
// Enforce ONLY on already-clean directories:
// config/eslint.config.js overrides per directory
{
    files: ['src/lib/services/sdr-common/**/*.ts'],
    rules: { 'max-lines': 'error', 'max-lines-per-function': 'error' }
}
```

- Enforce on newly created code (sdr-common, extracted modules)
- Legacy code remains warning-only
- Add `eslint-disable max-lines` to remaining oversized files

**Phase C: Full Enforcement** (after Phase 5.5 complete, all functions <60)

```javascript
'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
'security/detect-child-process': 'error',
```

- Pre-commit hook blocks ALL oversized commits
- CI/CD gate rejects PRs with violations
- Zero tolerance from this point forward

**Transition inline disables**: During Phase B, remaining oversized files receive:

```typescript
/* eslint-disable max-lines -- Phase 5.5 will decompose this file */
```

These comments serve as tracking markers. Phase 5.5 removes them as each function
is decomposed. When Phase C begins, `grep "eslint-disable max-lines" src/` MUST
return 0 results.

---

**END OF DOCUMENT**
