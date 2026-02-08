# Phase 4.5: ESLint and Compiler Strictness Escalation

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Phase            | 4.5                                                         |
| Title            | ESLint and Compiler Strictness Escalation                   |
| Status           | PLANNED                                                     |
| Author           | Alex (Lead Audit Agent)                                     |
| Date             | 2026-02-08                                                  |
| Risk Level       | MEDIUM (compiler strictness may surface latent type errors) |
| Estimated Effort | 6-10 hours                                                  |
| Dependencies     | Phase 4.1 (dead code removal), Phase 4.3 (any elimination)  |
| Branch           | `agent/alex/phase-4.5-eslint-compiler-strictness`           |

---

## 1. Current State Assessment

### 1.1 svelte-check Baseline (verified 2026-02-08)

```
svelte-check found 110 errors and 236 warnings in 74 files
```

| Severity | Count | Notes                                              |
| -------- | ----- | -------------------------------------------------- |
| Errors   | 110   | Must reach 0 before enabling additional strictness |
| Warnings | 236   | Accessibility and CSS warnings; lower priority     |
| Files    | 74    | ~25% of source files have at least one issue       |

**Top Error Categories (by frequency):**

| Error Pattern                                                                     | Count | Root Cause                                                               |
| --------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `Property 'data' does not exist on type 'Event'`                                  | 12    | Custom event typing in Svelte components                                 |
| `Cannot use 'bind:' with this property`                                           | 6     | Svelte 5 non-bindable property declarations                              |
| `Type 'unknown' is not assignable to type 'Record<string, unknown> \| undefined'` | 5     | Logger metadata parameter typing                                         |
| `Element implicitly has an 'any' type` (KismetDevice indexing)                    | 12    | KismetDevice type missing index signature for Kismet dot-notation fields |
| `'result.data' is possibly 'undefined'`                                           | 4     | Missing null checks on optional properties                               |
| `Parameter 'd' implicitly has an 'any' type`                                      | 4     | Callback parameters in D3/chart code                                     |
| `Parameter 'device' implicitly has an 'any' type`                                 | 3     | Callback parameters missing type annotations                             |
| `Property 'totalExecutions' does not exist on type`                               | 3     | Agent tool execution status type incomplete                              |
| `Type 'BackendConfig' mismatch`                                                   | 2     | Agent backend configuration type narrowing                               |
| `Property 'find' does not exist on type 'Map'`                                    | 2     | Incorrect method call on Map (should be `.get()`)                        |

**Top Warning Categories (by frequency):**

| Warning Pattern                                             | Count | Category                      |
| ----------------------------------------------------------- | ----- | ----------------------------- |
| `A form label must be associated with a control`            | 17    | Accessibility (a11y)          |
| `Buttons/links should contain text or aria-label`           | 14    | Accessibility (a11y)          |
| `Self-closing HTML tags for non-void elements`              | 18    | HTML correctness              |
| `Unknown at rule @apply`                                    | 10    | PostCSS/Tailwind config       |
| `div with click handler must have ARIA role`                | 9     | Accessibility (a11y)          |
| `Non-interactive elements with click need keyboard handler` | 8     | Accessibility (a11y)          |
| `aria-selected not supported by role button`                | 6     | Accessibility (a11y)          |
| `Unused CSS selector`                                       | 16+   | Dead CSS                      |
| `The text-neon-cyan class does not exist`                   | 1     | Missing Tailwind custom class |

### 1.2 ESLint Baseline (verified 2026-02-08)

```
633 problems (36 errors, 597 warnings)
```

| Rule                                         | Count | Severity | Action                                         |
| -------------------------------------------- | ----- | -------- | ---------------------------------------------- |
| `@typescript-eslint/no-explicit-any`         | 285   | warn     | Escalate to error after Phase 4.3              |
| `no-console`                                 | 275   | warn     | Escalate after Phase 3 logger migration        |
| `@typescript-eslint/no-non-null-assertion`   | 37    | warn     | Escalate to error                              |
| `@typescript-eslint/no-unused-vars`          | 26    | error    | Fix all (blocks compilation)                   |
| `no-undef`                                   | 6     | error    | Fix all                                        |
| `@typescript-eslint/no-unsafe-function-type` | 2     | warn     | Fix (replace `Function` with typed signatures) |
| `no-useless-escape`                          | 1     | error    | Fix                                            |
| `no-async-promise-executor`                  | 1     | error    | Fix                                            |

**ESLint Configuration Location**: `config/eslint.config.js`

**Key Configuration Facts:**

- `project: false` on line 56 -- type-checked rules are DISABLED for performance
- `@typescript-eslint/no-explicit-any: 'warn'` on line 74 -- does not block CI
- `@typescript-eslint/explicit-module-boundary-types: 'off'` on line 75 -- public APIs untyped
- `no-console: ['warn', { allow: ['warn', 'error'] }]` on line 77
- No `@typescript-eslint/strict` or `@typescript-eslint/stylistic` rule sets enabled

### 1.3 TypeScript Compiler Configuration (verified 2026-02-08)

**File**: `tsconfig.json`

Currently enabled:

```json
{
	"strict": true,
	"allowJs": true,
	"checkJs": true,
	"esModuleInterop": true,
	"forceConsistentCasingInFileNames": true,
	"resolveJsonModule": true,
	"skipLibCheck": true,
	"sourceMap": true,
	"moduleResolution": "bundler"
}
```

`strict: true` enables: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`.

**NOT enabled (available for escalation):**

| Option                               | Purpose                                               | Risk                                                  | CERT/MISRA Required |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------- |
| `noImplicitReturns`                  | Flags functions with incomplete return paths          | LOW                                                   | YES                 |
| `noFallthroughCasesInSwitch`         | Requires `break` in switch cases                      | LOW                                                   | YES                 |
| `noUncheckedIndexedAccess`           | Adds `undefined` to index signatures                  | HIGH -- many array/object accesses will need guards   | YES                 |
| `noImplicitOverride`                 | Requires `override` keyword on class method overrides | LOW -- mechanical fix                                 | RECOMMENDED         |
| `exactOptionalPropertyTypes`         | Distinguishes `undefined` from missing property       | HIGH -- behavioral changes in optional field handling | RECOMMENDED         |
| `noPropertyAccessFromIndexSignature` | Forces bracket notation for index signatures          | MEDIUM                                                | RECOMMENDED         |

### 1.4 knip Status (verified 2026-02-08)

```
npm ls knip -> (empty)
```

knip is NOT installed. The original plan incorrectly claimed v5.83.1. Installation is a prerequisite for dead export detection.

### 1.5 Type-Checked Linting (currently disabled)

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

---

## 2. Execution Order (Dependency Graph)

```
Phase 4.1 (Dead Code) ----+
                           |
Phase 4.3 (Any Elim) -----+---> Task 4.5.1: Fix Existing Errors (GATE)
                           |         |
Phase 4.4 (Catch Blocks) -+         |
                                     v
                               Task 4.5.2: Install knip + Run Dead Export Analysis
                                     |
                                     v
                               Task 4.5.3: ESLint Strictness Escalation
                                     |
                                     v
                               Task 4.5.4: Enable noFallthroughCasesInSwitch
                                     |
                                     v
                               Task 4.5.5: Enable noImplicitOverride
                                     |
                                     v
                               Task 4.5.6: Evaluate noUncheckedIndexedAccess
                                     |
                                     v
                               Task 4.5.7: Enable Type-Checked Linting
                                     |
                                     v
                               Task 4.5.8: CI Pipeline Integration
```

Tasks 4.5.4 and 4.5.5 are independent and can run in parallel.
Task 4.5.6 is an evaluation gate -- it may or may not result in enabling the option.
Task 4.5.7 depends on all `any` being eliminated (Phase 4.3 complete).
Task 4.5.8 is the final integration step.

---

## 3. Task 4.5.1: Fix All Existing TypeScript and ESLint Errors

**Purpose**: Establish a green baseline. No strictness options can be enabled while 110 TypeScript errors and 36 ESLint errors exist. This task is the mandatory gate.

**Estimated Duration**: 3-4 hours
**Risk**: LOW (fixing existing errors, not changing behavior)

### 3.1 TypeScript Error Resolution Plan

#### 3.1.1 KismetDevice Index Signature Errors (12 occurrences)

**Root cause**: Kismet REST API returns devices with dot-notation keys like `kismet.device.base.signal`, `dot11.device`, etc. The `KismetDevice` type (canonical: `src/lib/server/kismet/types.ts`) does not include an index signature.

**Fix**: Add an index signature to the canonical `KismetDevice` interface:

```typescript
// At the end of the KismetDevice interface in src/lib/server/kismet/types.ts
[key: string]: unknown;
```

This allows bracket-notation access to Kismet dot-notation fields while preserving type safety for known properties. All 12 errors resolve with this single change.

**Verification**: `npx svelte-check 2>&1 | grep "KismetDevice" | wc -l` should return 0.

#### 3.1.2 Event 'data' Property Errors (12 occurrences)

**Root cause**: Custom events dispatched from Svelte components carry data in `event.detail`, not `event.data`. Some event handlers access `event.data` which does not exist on the base `Event` type.

**Fix**: For each occurrence, determine whether the code should use:

1. `event.detail` (CustomEvent) -- add type annotation `(event: CustomEvent<DataType>)`
2. `event.data` (MessageEvent) -- add type annotation `(event: MessageEvent<DataType>)`
3. `event.data` (SSE) -- cast to appropriate EventSource message type

Each fix is file-specific. The 12 files must be individually inspected.

**Files to inspect** (identified from svelte-check output):

- Components using `on:message` handlers (likely MessageEvent)
- Components using `createEventDispatcher` consumers (likely CustomEvent)

#### 3.1.3 'bind:' Non-Bindable Property Errors (6 occurrences)

**Root cause**: Svelte 5 components declare certain props as non-bindable. Parent components attempt to use `bind:propName`.

**Fix**: Replace `bind:propName={value}` with `propName={value}` and add an `on:change` handler if two-way binding is needed, or use `$bindable()` in the child component's prop declaration.

#### 3.1.4 Logger Metadata Type Errors (5 occurrences)

**Root cause**: The logger functions (`logInfo`, `logError`, `logWarn`) accept `metadata?: Record<string, unknown>`. Callers pass `unknown` or `Error` objects directly.

**Fix**: Wrap non-Record metadata in `{ error: getErrorMessage(err) }` or use `toError()` from `src/lib/types/errors.ts`. The 5 occurrences:

- Passing `unknown` from catch blocks: wrap with `{ error: String(err) }`
- Passing `Error` objects: wrap with `{ error: err.message, stack: err.stack }`

#### 3.1.5 Remaining TypeScript Errors (~71 occurrences)

Group by fix category:

| Category                                         | Count | Fix Strategy                                           |
| ------------------------------------------------ | ----- | ------------------------------------------------------ |
| `Parameter 'x' implicitly has 'any' type`        | 11    | Add explicit parameter types (overlaps with Phase 4.3) |
| `Property does not exist on type`                | 8     | Fix type definitions or add type guards                |
| `Type 'unknown' not assignable`                  | 5     | Add type narrowing or assertions                       |
| `'result.data' possibly undefined`               | 4     | Add null checks                                        |
| `Property 'totalExecutions' missing`             | 3     | Update type definition                                 |
| `Map.find() does not exist`                      | 2     | Replace with correct Map methods                       |
| `BackendConfig type mismatch`                    | 2     | Fix interface definition                               |
| `Cannot find module '@modelcontextprotocol/sdk'` | 1     | Install types or add declaration                       |
| PostCSS/Tailwind class not found                 | 1     | Define custom class in Tailwind config                 |
| Miscellaneous                                    | ~32   | Individual fixes                                       |

### 3.2 ESLint Error Resolution Plan (36 errors)

| Rule                                | Count | Fix Strategy                                    |
| ----------------------------------- | ----- | ----------------------------------------------- |
| `@typescript-eslint/no-unused-vars` | 26    | Remove unused variables or prefix with `_`      |
| `no-undef`                          | 6     | Add proper imports or global declarations       |
| `no-useless-escape`                 | 1     | Remove unnecessary escape character             |
| `no-async-promise-executor`         | 1     | Extract async logic outside Promise constructor |
| Other                               | 2     | Individual fixes                                |

The 26 unused-vars errors: run `npx eslint --config config/eslint.config.js src/ --rule '@typescript-eslint/no-unused-vars: error' 2>&1 | grep "no-unused-vars"` to get the full file:line list.

### 3.3 Verification Gate

After all fixes:

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
# Expected: svelte-check found 0 errors and <N> warnings in <M> files

npx eslint --config config/eslint.config.js src/ 2>&1 | tail -1
# Expected: 0 errors, <N> warnings
```

Both must show **0 errors** before proceeding to Task 4.5.2.

**Commit**: `fix: resolve all TypeScript and ESLint errors to establish green baseline`

---

## 4. Task 4.5.2: Install knip and Run Dead Export Analysis

**Purpose**: Install knip for automated unused export detection. This provides tooling support for ongoing dead code prevention.

**Estimated Duration**: 30 minutes
**Risk**: LOW (dev dependency only)

### 4.1 Installation

```bash
npm install --save-dev knip
```

### 4.2 Configuration

Create `knip.config.ts` at project root:

```typescript
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	entry: [
		'src/routes/**/+page.svelte',
		'src/routes/**/+page.ts',
		'src/routes/**/+page.server.ts',
		'src/routes/**/+layout.svelte',
		'src/routes/**/+layout.ts',
		'src/routes/**/+layout.server.ts',
		'src/routes/**/+server.ts',
		'src/routes/**/+error.svelte',
		'src/hooks.server.ts',
		'src/hooks.client.ts',
		'config/app.d.ts',
		'src/lib/server/mcp/dynamic-server.ts',
		'vite.config.ts',
		'config/*.ts',
		'config/*.js'
	],
	project: ['src/**/*.{ts,svelte}'],
	ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**', 'src/types/**/*.d.ts'],
	ignoreDependencies: ['@sveltejs/adapter-auto', 'autoprefixer', 'postcss', 'tailwindcss'],
	svelte: {
		entry: ['src/routes/**/+*.svelte']
	}
};

export default config;
```

### 4.3 Initial Run

```bash
npx knip --reporter compact 2>&1 | tee plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/knip-baseline.txt
```

Record the baseline count of unused exports. Do NOT act on the results in this phase -- the output is informational for future dead code cleanup passes.

### 4.4 Add npm Script

Add to `package.json`:

```json
"knip": "knip --config knip.config.ts"
```

**Commit**: `chore: install knip and add dead export detection configuration`

---

## 5. Task 4.5.3: ESLint Strictness Escalation

**Purpose**: Upgrade ESLint rules from permissive to strict, ensuring violations block CI.

**Estimated Duration**: 1 hour
**Risk**: LOW (only changes warning-to-error thresholds after fixes are in place)
**Depends on**: Phase 4.3 complete (all `any` eliminated), Task 4.5.1 complete (0 errors)

### 5.1 Rule Escalations

All changes in `config/eslint.config.js`:

| Rule                                                | Current   | Target  | Prerequisite       |
| --------------------------------------------------- | --------- | ------- | ------------------ |
| `@typescript-eslint/no-explicit-any`                | `warn`    | `error` | Phase 4.3 complete |
| `@typescript-eslint/no-non-null-assertion`          | `warn`    | `error` | Task 4.5.1         |
| `@typescript-eslint/no-unsafe-function-type`        | (default) | `error` | Task 4.5.1         |
| `@typescript-eslint/explicit-module-boundary-types` | `off`     | `warn`  | --                 |
| `no-console`                                        | `warn`    | `error` | Phase 3 complete   |

### 5.2 New Rules to Add

```javascript
// Add to the TypeScript rules block (line 64-78):
'@typescript-eslint/no-unsafe-function-type': 'error',
'@typescript-eslint/no-duplicate-type-constituents': 'warn',
'@typescript-eslint/no-redundant-type-constituents': 'warn',
'@typescript-eslint/prefer-as-const': 'error',
```

### 5.3 Verification

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -1
# Expected: 0 errors, <N> warnings (warnings from newly-added rules only)
```

**Commit**: `chore: escalate ESLint rules from warn to error for type safety enforcement`

---

## 6. Task 4.5.4: Enable noFallthroughCasesInSwitch and noImplicitReturns

**Purpose**: Prevent silent fallthrough in switch statements and functions with missing return statements. Both are CERT/MISRA-required compiler options.

**Estimated Duration**: 30 minutes
**Risk**: LOW

### 6.1 Impact Assessment

```bash
# Count switch statements in the codebase
grep -rn 'switch\s*(' --include='*.ts' --include='*.svelte' src/ | wc -l
```

### 6.2 Implementation

Add to `tsconfig.json` compilerOptions:

```json
"noFallthroughCasesInSwitch": true,
"noImplicitReturns": true
```

**Note on `noImplicitReturns`**: This option flags functions where some code paths return a value and others fall off the end without returning. In a real-time RF processing pipeline, a missing return value can propagate `undefined` through the signal chain silently. This is classified as HIGH severity by CERT/MISRA standards.

### 6.3 Fix Any Failures

For `noFallthroughCasesInSwitch`: If any switch cases intentionally fall through, add `// falls through` comment (recognized by TypeScript as intentional fallthrough).

For `noImplicitReturns`: Add explicit return statements to all code paths. Common patterns:

- Add `return undefined` to void-returning branches
- Add early return with error for guard clauses
- Convert to arrow functions with explicit return types where appropriate

### 6.4 Verification

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
# Must show 0 new errors
```

**Commit**: `chore: enable noFallthroughCasesInSwitch and noImplicitReturns compiler options`

---

## 7. Task 4.5.5: Enable noImplicitOverride

**Purpose**: Require explicit `override` keyword when overriding class methods. Prevents accidental name collisions and makes inheritance chains auditable.

**Estimated Duration**: 30 minutes
**Risk**: LOW

### 7.1 Impact Assessment

```bash
# Count class declarations
grep -rn 'class\s\+\w\+\s\+extends' --include='*.ts' src/ | wc -l

# Count method declarations in extending classes
# These will need `override` keyword if they override parent methods
```

### 7.2 Implementation

Add to `tsconfig.json` compilerOptions:

```json
"noImplicitOverride": true
```

### 7.3 Fix Failures

For each error, add `override` keyword before the method declaration:

```typescript
// Before
class Child extends Parent {
  doWork() { ... }
}

// After
class Child extends Parent {
  override doWork() { ... }
}
```

### 7.4 Verification

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
```

**Commit**: `chore: enable noImplicitOverride compiler option`

---

## 8. Task 4.5.6: Evaluate noUncheckedIndexedAccess

**Purpose**: Evaluate whether enabling `noUncheckedIndexedAccess` is feasible. This option adds `| undefined` to every index access, catching potential runtime errors but requiring extensive null guards.

**Estimated Duration**: 1 hour (evaluation only)
**Risk**: EVALUATION ONLY -- no changes unless impact is manageable

### 8.1 Trial Run

```bash
# Temporarily add the option
cp tsconfig.json tsconfig.json.bak

# Add noUncheckedIndexedAccess: true
# Run svelte-check and count new errors
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1

# Restore original
mv tsconfig.json.bak tsconfig.json
```

### 8.2 Decision Criteria

| New Errors | Decision                                                       |
| ---------- | -------------------------------------------------------------- |
| < 20       | ENABLE -- fix all errors in this task                          |
| 20-50      | DEFER -- create separate Phase 4.6 plan                        |
| > 50       | DEFER -- too many changes for this phase, track as future work |

### 8.3 If Enabling

Add to `tsconfig.json`:

```json
"noUncheckedIndexedAccess": true
```

Fix each error by adding null checks:

```typescript
// Before
const item = array[index];
item.process(); // Might be undefined

// After
const item = array[index];
if (item) {
	item.process();
}
```

### 8.4 Documentation

Regardless of the decision, record the evaluation result in the commit message or a tracking document:

- Number of new errors
- Decision (enable/defer)
- If deferred: estimated effort to fix

**Commit** (if enabling): `chore: enable noUncheckedIndexedAccess with null guards`
**Commit** (if deferring): `docs: evaluate noUncheckedIndexedAccess -- deferred (N errors)`

---

## 9. Task 4.5.7: Enable Type-Checked Linting

**Purpose**: Enable ESLint's type-aware rules by setting `project: true`. This activates the most powerful class of lint rules that can detect `any` propagation, floating promises, and unsafe operations.

**Estimated Duration**: 2-3 hours
**Risk**: MEDIUM (may surface many new violations; performance impact on RPi 5)
**Depends on**: Phase 4.3 complete (all `any` eliminated), Tasks 4.5.1-4.5.3 complete

### 9.1 Enable Type-Checked Parsing

In `config/eslint.config.js`, line 56:

```javascript
// Before
project: false, // Disable type checking for performance

// After
project: './tsconfig.json',
```

### 9.2 Add Type-Checked Rules (Graduated)

Add rules in order of priority. Each rule addition is a separate verification step.

**Tier 1 (Critical -- security and correctness):**

```javascript
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/no-misused-promises': 'error',
```

**Tier 2 (any propagation prevention):**

```javascript
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-member-access': 'error',
'@typescript-eslint/no-unsafe-return': 'error',
'@typescript-eslint/no-unsafe-argument': 'error',
```

**Tier 3 (code quality):**

```javascript
'@typescript-eslint/await-thenable': 'error',
'@typescript-eslint/require-await': 'warn',
```

### 9.3 Graduated Enablement

Enable one tier at a time. After each tier:

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -3
```

If error count exceeds 20 for a tier, fix all errors before enabling the next tier.

### 9.4 Performance Mitigation

Type-checked linting will be slow on RPi 5. Mitigate with:

1. **Editor**: Keep `project: false` in a separate editor-only ESLint config
2. **CI**: Use the full type-checked config only in CI pipelines
3. **Pre-commit**: Use `lint-staged` to only type-check changed files

### 9.5 Verification

```bash
npx eslint --config config/eslint.config.js src/ 2>&1 | tail -1
# Expected: 0 errors
```

**Commit**: `feat: enable type-checked ESLint rules for full type safety enforcement`

---

## 10. Task 4.5.8: CI Pipeline Integration

**Purpose**: Ensure all strictness checks are enforced in CI, preventing regressions.

**Estimated Duration**: 30 minutes
**Risk**: LOW

### 10.1 Add CI Check Scripts

Add to `package.json`:

```json
"ci:typecheck": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings false",
"ci:lint": "eslint --config config/eslint.config.js src/ --max-warnings 0",
"ci:knip": "knip --config knip.config.ts --no-exit-code",
"ci:all": "npm run ci:typecheck && npm run ci:lint"
```

### 10.2 Gate Criteria

| Check                  | Must Pass            | Blocks Merge  |
| ---------------------- | -------------------- | ------------- |
| `npm run ci:typecheck` | 0 errors             | YES           |
| `npm run ci:lint`      | 0 errors, 0 warnings | YES           |
| `npm run ci:knip`      | Informational        | NO (advisory) |
| `npm run build`        | Clean build          | YES           |

### 10.3 Pre-Commit Hook (Optional)

If `husky` or `lefthook` is installed, add:

```bash
# .husky/pre-commit or lefthook.yml
npx lint-staged
```

With `lint-staged` config:

```json
"lint-staged": {
  "*.{ts,svelte}": ["eslint --config config/eslint.config.js --fix", "svelte-check"]
}
```

### 10.4 Verification

```bash
npm run ci:all
# Expected: 0 errors on all checks
```

**Commit**: `chore: add CI strictness gate scripts to package.json`

---

## 11. Summary of Deliverables

| Task  | Action                                                    | Outcome                             |
| ----- | --------------------------------------------------------- | ----------------------------------- |
| 4.5.1 | Fix 110 TS errors + 36 ESLint errors                      | Green baseline (0 errors)           |
| 4.5.2 | Install knip                                              | Dead export detection tooling       |
| 4.5.3 | Escalate ESLint rules                                     | `no-explicit-any` -> error, etc.    |
| 4.5.4 | Enable `noFallthroughCasesInSwitch` + `noImplicitReturns` | Switch safety + return completeness |
| 4.5.5 | Enable `noImplicitOverride`                               | Inheritance auditing                |
| 4.5.6 | Evaluate `noUncheckedIndexedAccess`                       | Decision: enable or defer           |
| 4.5.7 | Enable type-checked linting                               | Full `any` propagation prevention   |
| 4.5.8 | CI pipeline integration                                   | Regression prevention               |

**Total Commits**: 6-7 (one per task, 4.5.6 depends on evaluation result)

**End State**: Zero TypeScript errors, zero ESLint errors, type-checked linting active, CI gates enforced. The codebase will reject any new `any` introduction, any unhandled promise, and any type safety regression at the lint and compile level.

---

## Appendix A: exactOptionalPropertyTypes Evaluation (Deferred)

`exactOptionalPropertyTypes` is the strictest TypeScript option. It distinguishes between "property is `undefined`" and "property is absent." This is deferred because:

1. It requires changing every optional property access pattern
2. SvelteKit's generated types may not be compatible
3. The effort-to-benefit ratio is poor for a field-deployed application

This should be revisited only after all other strictness options are stable.

## Appendix B: Full ESLint Rule Audit

The following rules from `@typescript-eslint/strict` are NOT currently enabled and should be considered for future phases:

| Rule                                               | Purpose                              | Priority |
| -------------------------------------------------- | ------------------------------------ | -------- |
| `@typescript-eslint/no-dynamic-delete`             | Prevents `delete obj[key]`           | LOW      |
| `@typescript-eslint/no-invalid-void-type`          | Prevents `void` outside return types | LOW      |
| `@typescript-eslint/no-unnecessary-condition`      | Prevents always-truthy checks        | MEDIUM   |
| `@typescript-eslint/no-unnecessary-type-assertion` | Prevents redundant `as Type`         | MEDIUM   |
| `@typescript-eslint/prefer-literal-enum-member`    | Prevents computed enum values        | LOW      |
| `@typescript-eslint/unified-signatures`            | Merges overload signatures           | LOW      |

These are informational only and not part of Phase 4.5 scope.

## Appendix C: Additional Findings from Verification (2026-02-08)

The following findings were surfaced by the tsconfig/ESLint verification agent and are documented here for completeness. They are tracked but deferred to future phases unless otherwise noted.

| Finding                                                                                                | Severity | Disposition                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `app.d.ts` App namespace entirely empty (Error, Locals, PageData, PageState all commented out)         | HIGH     | Deferred to Phase 5 (Architecture) -- requires design decision on SvelteKit type contracts                          |
| `skipLibCheck: true` bypasses .d.ts validation                                                         | HIGH     | Deferred -- changing to `false` may surface errors in node_modules that require upstream fixes                      |
| `as unknown as` double assertions: 16 across 8 files                                                   | MEDIUM   | Tracked for Phase 4.3 follow-up (lower priority than `as any` since `as unknown as` forces explicit type narrowing) |
| Non-null assertions (`!.`): 37 (ESLint count; 8 dot-access instances across 8 files)                   | MEDIUM   | Addressed by Phase 4.5 Task 4.5.3 (escalates `no-non-null-assertion` to error)                                      |
| `eslint.simple.config.js` has zero TypeScript rules                                                    | MEDIUM   | Document in README; do not use in CI                                                                                |
| `leaflet-extensions.d.ts` (29 lines) coexists with `leaflet.d.ts` (166 lines) creating merge conflicts | MEDIUM   | Phase 4.3 Task 4.3.1 deletes `leaflet.d.ts`; `leaflet-extensions.d.ts` is clean (0 `any`) and should remain         |
