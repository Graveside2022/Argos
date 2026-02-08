# Phase 5.6.3: Pre-Commit Hook Enhancement

| Attribute            | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.3                                |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                   |
| **Risk Level**       | LOW                                               |
| **Prerequisites**    | Task 5.6.1 COMPLETE (size rules in ESLint config) |
| **Estimated Effort** | 20 minutes                                        |
| **Standards**        | MISRA C:2023 Directive 4.1, NASA/JPL Rule 31      |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY             |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                |
| **Date**             | 2026-02-08                                        |

---

## 1. Objective

Enhance the existing `.husky/pre-commit` hook with an explicit two-phase size enforcement gate. The enhanced hook provides clear, actionable error messages when developers attempt to commit files or functions that exceed size limits.

---

## 2. Current State

The pre-commit infrastructure is already operational:

```
.husky/pre-commit  -->  npx lint-staged  -->  config/.lintstagedrc.json
                                                |
                                                +--> eslint --config config/eslint.config.js --fix
                                                +--> prettier --write
```

Because lint-staged already runs ESLint on staged `*.{js,ts,svelte}` files, the `max-lines` and `max-lines-per-function` rules added in Task 5.6.1 will AUTOMATICALLY be enforced on every commit. No changes to `.husky/pre-commit` or `.lintstagedrc.json` are required for basic enforcement.

### Why Enhancement Is Still Needed

There is a subtlety: the current lint-staged config uses `--fix`, which auto-fixes violations where possible. The `max-lines` and `max-lines-per-function` rules are NOT auto-fixable (ESLint cannot automatically split files or functions). The `--fix` flag is harmless but does not help for size rules. ESLint will correctly report these as errors and lint-staged will block the commit.

However, lint-staged's error output is verbose and includes the full ESLint report. The enhanced hook provides clearer, targeted error messages with actionable instructions BEFORE lint-staged runs.

---

## 3. Two-Phase Hook Architecture

### Phase 1: Size Enforcement (Fast, Targeted)

- Runs ONLY on staged `.ts`, `.js`, `.svelte` files
- Checks ONLY `max-lines` and `max-lines-per-function` rules
- Uses `--no-fix` (no auto-correction attempted)
- Produces clear `COMMIT BLOCKED` message with fix instructions
- Fails fast: if size violation found, does NOT proceed to Phase 2

### Phase 2: Full lint-staged Pipeline

- Runs `npx lint-staged` (existing behavior)
- Includes ALL ESLint rules (not just size), Prettier formatting
- Applies auto-fixes where possible (`--fix`)
- Only reached if Phase 1 passes

### Why Two Phases

1. **Clearer error messages**: lint-staged's error output is verbose. Phase 1 extracts only size-related violations and presents them with actionable instructions.

2. **Faster feedback**: If a file exceeds 300 lines, there is no point running Prettier or auto-fixable ESLint rules on it. The developer needs to decompose the file first. Failing fast saves time.

---

## 4. Complete Pre-Commit Hook Script

**File**: `.husky/pre-commit`

This is the FULL replacement content for the pre-commit hook file:

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

**Net change**: +35 lines (1-line file replaced with 36-line file).

---

## 5. Script Technical Details

### 5.1 Staged File Selection

```bash
git diff --cached --name-only --diff-filter=ACM
```

| Flag                | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `--cached`          | Only staged files (not working tree changes)          |
| `--name-only`       | Output file paths only (no diff content)              |
| `--diff-filter=ACM` | Added, Copied, Modified files only (excludes Deleted) |

The pipeline then filters to `.ts`, `.js`, `.svelte` extensions and excludes `node_modules` and `.svelte-kit` directories.

### 5.2 ESLint Invocation

```bash
echo "$STAGED_FILES" | xargs npx eslint \
    --config config/eslint.config.js \
    --no-fix \
    --rule '{"max-lines": ...}' \
    --rule '{"max-lines-per-function": ...}' \
    2>&1 | grep -E "max-lines|max-lines-per-function"
```

| Flag       | Purpose                                                   |
| ---------- | --------------------------------------------------------- |
| `--config` | Uses the project ESLint config                            |
| `--no-fix` | Do not auto-fix (size rules are not fixable anyway)       |
| `--rule`   | Inline rule override ensures size rules are always active |
| `2>&1`     | Capture both stdout and stderr                            |
| `grep -E`  | Extract only size-related violation messages              |

### 5.3 Exit Behavior

| Condition                   | Exit Code | Result                              |
| --------------------------- | --------- | ----------------------------------- |
| No staged source files      | 0         | Hook passes, commit proceeds        |
| Staged files, no violations | 0         | Proceeds to Phase 2 (lint-staged)   |
| Size violations detected    | 1         | Commit blocked, error message shown |
| lint-staged fails (Phase 2) | non-zero  | Commit blocked by lint-staged       |

---

## 6. Testing Procedure

### Test 1: Oversized File -- Commit Must Be Blocked

```bash
# Create an oversized file with >300 lines of executable code
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
```

**Expected output**:

```
================================================================
  COMMIT BLOCKED: File/Function Size Violations Detected
  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)
================================================================

  src/lib/test-oversized.ts
    1:1  error  File has too many lines (312). Maximum allowed is 300  max-lines
```

### Test 2: Oversized Function -- Commit Must Be Blocked

```bash
# Create a file with a 65-line function
cat > /tmp/test-longfn.ts << 'EOF'
export function longFunction(): void {
EOF
for i in $(seq 1 63); do
    echo "    const x${i} = ${i};" >> /tmp/test-longfn.ts
done
echo "}" >> /tmp/test-longfn.ts

cp /tmp/test-longfn.ts src/lib/test-longfn.ts
git add src/lib/test-longfn.ts
git commit -m "test: oversized function should be blocked"
# EXPECTED: Commit blocked with max-lines-per-function in output

# Clean up
git reset HEAD src/lib/test-longfn.ts
rm src/lib/test-longfn.ts
```

### Test 3: Compliant File -- Commit Must Succeed

```bash
# Create a compliant file
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

### Test 4: lint-staged Phase 2 Still Runs

```bash
# Commit a file with trailing whitespace (Prettier should fix it)
echo "export const x = 1;   " > src/lib/test-prettier.ts
git add src/lib/test-prettier.ts
git commit -m "test: prettier should format trailing whitespace"
# EXPECTED: Commit succeeds, trailing whitespace removed by Prettier

# Clean up
git revert HEAD --no-edit
rm src/lib/test-prettier.ts
```

---

## 7. Verification Commands

| #   | Check                                  | Command                                                  | Expected Result                                        |
| --- | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| V6  | Hook blocks oversized file             | Create 310-line file, stage, attempt commit              | Commit blocked with `COMMIT BLOCKED` message           |
| V7  | Hook blocks oversized function         | Create file with 65-line function, stage, attempt commit | Commit blocked with `max-lines-per-function` in output |
| V8  | Hook allows compliant file             | Create 50-line file with 10-line function, stage, commit | Commit succeeds                                        |
| V9  | Hook runs lint-staged after size check | Commit a file with trailing whitespace                   | Prettier formats it before commit completes            |

---

## 8. Risk Mitigations

| Risk                                         | Impact | Mitigation                                                                            |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Hook bypass via `--no-verify`                | MEDIUM | CI/CD `lint:size` gate is the backstop; `--no-verify` requires post-hoc justification |
| xargs fails on filenames with spaces         | LOW    | Argos codebase uses no filenames with spaces; grep filters prevent this               |
| npx eslint not found in PATH                 | LOW    | husky v9 sets up PATH; `npx` resolves from node_modules                               |
| Large number of staged files causes slowness | LOW    | Typical commit stages 1-5 files (<2s); full src/ ~500 files takes ~5s on RPi 5        |

---

## 9. Rollback Strategy

Restore the single-line pre-commit hook:

```bash
echo "npx lint-staged" > .husky/pre-commit
chmod +x .husky/pre-commit
```

This reverts to the pre-5.6.3 state. lint-staged still runs ESLint (which now includes size rules from 5.6.1), so basic enforcement remains. Only the enhanced error messaging is lost.

---

## 10. Commit Message

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

## 11. Standards Compliance

| Standard                   | Requirement                                         | Resolution                                                |
| -------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| MISRA C:2023 Directive 4.1 | Run-time failures minimized through static analysis | Pre-commit check catches violations before they enter VCS |
| NASA/JPL Rule 31           | Static analysis tools shall be applied              | Hook runs ESLint on every commit automatically            |

---

**END OF DOCUMENT**
