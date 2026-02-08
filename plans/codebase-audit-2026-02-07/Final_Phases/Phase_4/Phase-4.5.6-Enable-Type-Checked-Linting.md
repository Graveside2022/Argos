# Phase 4.5.6: Enable Type-Checked Linting

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR33-C (detect and handle function errors), CERT FLP30-C (no floating-point in loop controls), MISRA Rule 1.1 (all code shall conform), BARR-C Rule 1.7 (resolve all warnings), NASA/JPL Rule 15 (validate all function returns)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.6
**Risk Level**: MEDIUM -- May surface many new violations; performance impact on RPi 5
**Prerequisites**: Phase 4.3 complete (all `any` eliminated), Tasks 4.5.0-4.5.2 complete
**Blocks**: Task 4.5.7 (CI Pipeline Integration)
**Estimated Duration**: 2-3 hours
**Estimated Files Touched**: 1 (`config/eslint.config.js`) + source files with new violations
**Standards**: CERT ERR33-C, CERT FLP30-C, MISRA Rule 1.1, BARR-C Rule 1.7, NASA/JPL Rule 15

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Phase        | 4.5                                                                       |
| Task         | 4.5.6                                                                     |
| Title        | Enable Type-Checked Linting                                               |
| Status       | PLANNED                                                                   |
| Risk Level   | MEDIUM                                                                    |
| Duration     | 2-3 hours                                                                 |
| Dependencies | Phase 4.3, Tasks 4.5.0, 4.5.1, 4.5.2                                      |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`                         |
| Commit       | `feat: enable type-checked ESLint rules for full type safety enforcement` |

---

## Objective

Enable ESLint's type-aware rules by setting `project: true`. This activates the most powerful class of lint rules that can detect `any` propagation, floating promises, and unsafe operations. These rules require the TypeScript type-checker to run during linting, which has significant performance implications on the RPi 5 target hardware.

## Current State Assessment

### Type-Checked Linting Status (verified 2026-02-08)

ESLint config has `project: false` (line 56 of `config/eslint.config.js`), which disables all type-aware lint rules. The following rules CANNOT be enabled without first setting `project: true`:

| Rule                                            | Purpose                                     | Impact          |
| ----------------------------------------------- | ------------------------------------------- | --------------- |
| `@typescript-eslint/no-unsafe-assignment`       | Blocks `any` propagation through assignment | HIGH            |
| `@typescript-eslint/no-unsafe-call`             | Blocks calling `any`-typed values           | HIGH            |
| `@typescript-eslint/no-unsafe-member-access`    | Blocks property access on `any`             | HIGH            |
| `@typescript-eslint/no-unsafe-return`           | Blocks returning `any` from typed functions | HIGH            |
| `@typescript-eslint/no-unsafe-argument`         | Blocks passing `any` to typed params        | HIGH            |
| `@typescript-eslint/strict-boolean-expressions` | Prevents truthy/falsy checks on non-boolean | MEDIUM          |
| `@typescript-eslint/no-floating-promises`       | Catches unhandled promise rejections        | HIGH (security) |
| `@typescript-eslint/no-misused-promises`        | Catches promises in boolean contexts        | MEDIUM          |

**Performance Warning**: Enabling `project: true` activates TypeScript's type-checker during linting. On the RPi 5 (4x Cortex-A76, 8GB RAM), this will increase lint time from ~10s to ~60-120s. This is acceptable for CI but not for editor integration.

**Key Configuration Facts (config/eslint.config.js):**

- `project: false` on line 56 -- type-checked rules are DISABLED for performance
- No `@typescript-eslint/strict` or `@typescript-eslint/stylistic` rule sets enabled

---

## Execution Steps

### Step 1: Enable Type-Checked Parsing

In `config/eslint.config.js`, line 56:

```javascript
// Before
project: false, // Disable type checking for performance

// After
project: './tsconfig.json',
```

### Step 2: Add Type-Checked Rules (Graduated)

Add rules in order of priority. Each tier is a separate verification step. Do NOT proceed to the next tier until the current tier shows 0 errors.

**Tier 1 (Critical -- security and correctness):**

```javascript
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/no-misused-promises': 'error',
```

**Rationale**: Floating promises are the #1 source of unhandled rejections, which can crash the Node.js process or silently swallow errors in the RF processing pipeline. `no-misused-promises` prevents promises from being used in boolean contexts (e.g., `if (fetchData())` which always evaluates to `true`).

Verify Tier 1:

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -3
# If errors > 20, fix all before proceeding to Tier 2
```

**Tier 2 (any propagation prevention):**

```javascript
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-member-access': 'error',
'@typescript-eslint/no-unsafe-return': 'error',
'@typescript-eslint/no-unsafe-argument': 'error',
```

**Rationale**: These 5 rules form a complete barrier against `any` propagation. After Phase 4.3 eliminates all explicit `any`, these rules prevent `any` from re-entering the type system through assignments, calls, member access, returns, and arguments.

Verify Tier 2:

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -3
# If errors > 20, fix all before proceeding to Tier 3
```

**Tier 3 (code quality):**

```javascript
'@typescript-eslint/await-thenable': 'error',
'@typescript-eslint/require-await': 'warn',
```

**Rationale**: `await-thenable` prevents `await`-ing non-Promise values (which is a no-op but indicates a logic error). `require-await` warns on `async` functions that never `await` (may be intentionally async for interface conformance, hence `warn` not `error`).

Verify Tier 3:

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -3
```

### Step 3: Graduated Enablement Process

For each tier:

1. Add the rules to `config/eslint.config.js`
2. Run lint: `npx eslint --config config/eslint.config.js src/ 2>&1 | tail -3`
3. If error count exceeds 20 for a tier, fix all errors before enabling the next tier
4. Commit the tier's rules and fixes together

### Step 4: Performance Mitigation

Type-checked linting will be slow on RPi 5. Mitigate with:

1. **Editor**: Create a separate editor-only ESLint config that keeps `project: false`:

```bash
# config/eslint.editor.config.js -- for IDE integration only
# Copy of eslint.config.js with project: false
# Do NOT use in CI
```

2. **CI**: Use the full type-checked config (`config/eslint.config.js`) only in CI pipelines
3. **Pre-commit**: Use `lint-staged` to only type-check changed files:

```json
"lint-staged": {
  "*.{ts,svelte}": ["eslint --config config/eslint.config.js --fix"]
}
```

### Step 5: Final Verification

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -1
# Expected: 0 errors
```

---

## Verification

| #   | Check                          | Command                                                            | Expected            |
| --- | ------------------------------ | ------------------------------------------------------------------ | ------------------- |
| 1   | project: true in ESLint config | `grep "project:" config/eslint.config.js`                          | `'./tsconfig.json'` |
| 2   | no-floating-promises active    | `grep "no-floating-promises" config/eslint.config.js \| wc -l`     | 1                   |
| 3   | no-misused-promises active     | `grep "no-misused-promises" config/eslint.config.js \| wc -l`      | 1                   |
| 4   | no-unsafe-assignment active    | `grep "no-unsafe-assignment" config/eslint.config.js \| wc -l`     | 1                   |
| 5   | no-unsafe-call active          | `grep "no-unsafe-call" config/eslint.config.js \| wc -l`           | 1                   |
| 6   | no-unsafe-member-access active | `grep "no-unsafe-member-access" config/eslint.config.js \| wc -l`  | 1                   |
| 7   | no-unsafe-return active        | `grep "no-unsafe-return" config/eslint.config.js \| wc -l`         | 1                   |
| 8   | no-unsafe-argument active      | `grep "no-unsafe-argument" config/eslint.config.js \| wc -l`       | 1                   |
| 9   | await-thenable active          | `grep "await-thenable" config/eslint.config.js \| wc -l`           | 1                   |
| 10  | require-await active           | `grep "require-await" config/eslint.config.js \| wc -l`            | 1                   |
| 11  | ESLint passes (0 errors)       | `npx eslint --config config/eslint.config.js src/ 2>&1 \| tail -1` | `0 errors`          |
| 12  | Build succeeds                 | `npm run build`                                                    | Exit 0              |
| 13  | Unit tests pass                | `npm run test:unit`                                                | Exit 0              |

## Risk Assessment

| Risk                                                          | Likelihood | Impact | Mitigation                                                                  |
| ------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| >100 type-checked violations surface                          | MEDIUM     | HIGH   | Graduated tier enablement; fix each tier before proceeding                  |
| Lint time increases to 60-120s on RPi 5                       | HIGH       | MEDIUM | Separate editor config; CI-only for full checks; lint-staged for pre-commit |
| no-unsafe-\* rules conflict with legitimate external API data | MEDIUM     | MEDIUM | Use type narrowing and runtime validation (Phase 3.4 Zod schemas)           |
| Memory pressure from type-checker + ESLint on RPi 5           | MEDIUM     | HIGH   | Monitor with `free -m`; earlyoom protects against OOM                       |
| require-await flags intentionally async functions             | HIGH       | LOW    | Set as `warn` not `error`; suppress with eslint-disable where documented    |

## Rollback Strategy

### Tier-by-tier rollback

If a specific tier causes too many violations, remove only that tier's rules and commit the previously-passing tiers.

### Full rollback

```bash
# Revert project: true back to project: false
# Remove all type-checked rules
git checkout config/eslint.config.js
```

## Standards Traceability

| Standard | Rule     | Requirement                        | How This Task Satisfies It                                     |
| -------- | -------- | ---------------------------------- | -------------------------------------------------------------- |
| CERT     | ERR33-C  | Detect and handle function errors  | no-floating-promises catches unhandled promise rejections      |
| CERT     | FLP30-C  | No floating-point in loop controls | no-misused-promises prevents promises in boolean contexts      |
| MISRA    | Rule 1.1 | All code shall conform to standard | Type-checked linting is the highest level of static analysis   |
| BARR-C   | Rule 1.7 | Resolve all compiler warnings      | Type-aware rules surface violations invisible to basic linting |
| NASA/JPL | Rule 15  | Validate all function returns      | no-unsafe-return prevents returning `any` from typed functions |

## Commit Message

```
feat: enable type-checked ESLint rules for full type safety enforcement
```

## Execution Tracking

| Step | Description                                      | Status  | Started | Completed | Verified By |
| ---- | ------------------------------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Set project: './tsconfig.json'                   | PENDING | --      | --        | --          |
| 2    | Add Tier 1 rules (floating/misused promises)     | PENDING | --      | --        | --          |
| 3    | Fix Tier 1 violations                            | PENDING | --      | --        | --          |
| 4    | Add Tier 2 rules (5 no-unsafe-\* rules)          | PENDING | --      | --        | --          |
| 5    | Fix Tier 2 violations                            | PENDING | --      | --        | --          |
| 6    | Add Tier 3 rules (await-thenable, require-await) | PENDING | --      | --        | --          |
| 7    | Fix Tier 3 violations                            | PENDING | --      | --        | --          |
| 8    | Create editor-only config                        | PENDING | --      | --        | --          |
| 9    | Final verification                               | PENDING | --      | --        | --          |
