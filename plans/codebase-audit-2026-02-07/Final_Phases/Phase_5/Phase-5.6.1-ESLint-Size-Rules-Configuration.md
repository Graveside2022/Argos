# Phase 5.6.1: ESLint Size Rules Configuration

| Attribute            | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.1                                         |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                            |
| **Risk Level**       | LOW                                                        |
| **Prerequisites**    | Phase 5.6.0 assessment PASSED; Phases 5.1-5.5 ALL COMPLETE |
| **Estimated Effort** | 20 minutes                                                 |
| **Standards**        | MISRA C:2023 Rule 1.1, NASA/JPL Rule 4, NASA/JPL Rule 31   |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                      |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                         |
| **Date**             | 2026-02-08                                                 |

---

## 1. Objective

Add `max-lines` and `max-lines-per-function` rules to the existing ESLint flat config at `config/eslint.config.js`. These rules enforce the size limits established by Phases 5.1-5.5 (300 lines per file, 60 lines per function) and prevent future regression.

---

## 2. Subtask 5.6.1.1: Verify Current Config Structure

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

---

## 3. Subtask 5.6.1.2: Add Size Rules

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

---

## 4. Rule Semantics Table

| Rule                     | Threshold | skipBlankLines | skipComments | Effect                                                                                                                            |
| ------------------------ | --------- | -------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `max-lines`              | 300       | true           | true         | Only executable code lines count. A 300-line file with 50 comment lines and 20 blank lines is still compliant (only 230 counted). |
| `max-lines-per-function` | 60        | true           | true         | Same counting semantics. IIFEs are counted as separate functions, not as part of the enclosing scope.                             |

### Rule Option Details

| Option           | Type    | Value  | Purpose                                                                                                |
| ---------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `max`            | number  | 300/60 | Maximum allowed executable lines                                                                       |
| `skipBlankLines` | boolean | true   | Blank lines do not count toward the limit                                                              |
| `skipComments`   | boolean | true   | Single-line (`//`) and multi-line (`/* */`) comments do not count toward the limit                     |
| `IIFEs`          | boolean | true   | Immediately Invoked Function Expressions counted as standalone functions (max-lines-per-function only) |

---

## 5. Rationale for Thresholds

### 5.1 300 Lines Per File

Aligns with Phase 5.4 target. A 300-line file fits on approximately 6 screens at 50 lines each, enabling full comprehension in a single review session. This is consistent with NASA/JPL Power of Ten Rule 4 ("no function should be longer than what can be printed on a single sheet of paper") scaled to file level.

### 5.2 60 Lines Per Function

Aligns with Phase 5.5 target. A 60-line function fits on a single screen plus context. MISRA C:2023 recommends functions that can be "fully understood in a single viewing." The Linux kernel coding style guide targets 24 lines; we use 60 as a pragmatic compromise for TypeScript/Svelte.

### 5.3 IIFEs: true

Immediately Invoked Function Expressions are counted as standalone functions. Without this flag, a module-level IIFE's body would count against the enclosing module scope, producing false positives on module files that use the IIFE pattern for encapsulation.

---

## 6. Subtask 5.6.1.3: Verify Zero Violations

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

---

## 7. Subtask 5.6.1.4: Handle Violations (Contingency)

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

## 8. Complete Config Object (After Modification)

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

---

## 9. Verification Commands

| #   | Check                                    | Command                                                                                           | Expected Result                       |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| V1  | ESLint parses config without error       | `npx eslint --print-config src/lib/stores/hackrf.ts 2>&1 \| grep max-lines`                       | Shows `max-lines` rule configured     |
| V2  | Zero `max-lines` violations              | `npx eslint src/ --config config/eslint.config.js 2>&1 \| grep "max-lines[^-]" \| wc -l`          | `0`                                   |
| V3  | Zero `max-lines-per-function` violations | `npx eslint src/ --config config/eslint.config.js 2>&1 \| grep "max-lines-per-function" \| wc -l` | `0`                                   |
| V4  | `npm run lint` succeeds                  | `npm run lint`                                                                                    | Exit code 0 (warnings OK, errors = 0) |

---

## 10. Risk Mitigations

| Risk                                           | Impact | Mitigation                                                          |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Phases 5.1-5.5 incomplete, violations found    | HIGH   | Contingency procedure in Section 7 routes back to correct phase     |
| ESLint config syntax error after rule addition | MEDIUM | Verify config loads (V1) before running full lint                   |
| skipBlankLines/skipComments semantics differ   | LOW    | Rule semantics table (Section 4) documents exact behavior           |
| IIFEs flag omitted, false positives on modules | LOW    | IIFEs: true explicitly set; verified against Svelte module patterns |

---

## 11. Rollback Strategy

Remove the two added rule definitions from `config/eslint.config.js`:

```bash
# Revert the config to pre-5.6.1 state
git checkout HEAD~1 -- config/eslint.config.js
```

Zero production code is modified. Only configuration is affected.

---

## 12. Commit Message

```
refactor(phase-5.6): add max-lines and max-lines-per-function ESLint rules

Adds enforcement gates to config/eslint.config.js:
- max-lines: 300 (skipBlankLines, skipComments)
- max-lines-per-function: 60 (skipBlankLines, skipComments, IIFEs)

Verification: npm run lint (0 size violations)
```

---

## 13. Standards Compliance

| Standard              | Requirement                                | Resolution                                           |
| --------------------- | ------------------------------------------ | ---------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | All code shall conform to coding standards | Size rules enforce conformance automatically         |
| NASA/JPL Rule 4       | Functions fit on one printed page          | max-lines-per-function: 60 enforces this             |
| NASA/JPL Rule 31      | Static analysis tools shall be applied     | ESLint with size rules runs on every lint invocation |

---

**END OF DOCUMENT**
