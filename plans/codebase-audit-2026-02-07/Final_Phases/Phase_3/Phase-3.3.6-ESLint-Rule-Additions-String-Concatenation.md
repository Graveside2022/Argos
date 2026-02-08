# Phase 3.3.6: ESLint Rule Additions and String Concatenation Fixes

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 1.7 (resolve all warnings), MISRA Rule 15.1 (complexity limits), NASA/JPL Rule 31 (no dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.3 -- ESLint Enforcement, TODO Resolution, and Error Hygiene
**Task ID**: 3.3.6
**Risk Level**: LOW -- Configuration changes and mechanical string template conversion
**Prerequisites**: Phase 3.1.8 (no-console escalated to error), Phase 3.2 (constants centralized)
**Blocks**: Phase 4 (Type Safety), Phase 5 (Architecture)
**Estimated Files Touched**: ~25
**Standards**: BARR-C Rule 1.7, MISRA Rule 15.1, NASA/JPL Rule 31, CERT MSC04-C

---

## Objective

Add 8 new ESLint rules to prevent regression of Phase 3 improvements. Fix all ~52 string concatenation violations before enabling the `prefer-template` rule as `error`.

## Correction History

| Date       | Correction ID | Description                                                                                                                                        |
| ---------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-08 | CA-04         | String concatenation count corrected from 47 to ~52. Three additional rules added: `no-unreachable`, `no-constant-condition`, `naming-convention`. |

## Current State Assessment

| Metric                                              | Current State  | Target State                          |
| --------------------------------------------------- | -------------- | ------------------------------------- |
| `no-magic-numbers` rule                             | NOT CONFIGURED | `warn` initially, escalate to `error` |
| `prefer-template` rule                              | NOT CONFIGURED | `error`                               |
| `complexity` rule                                   | NOT CONFIGURED | `warn` at threshold 20                |
| `max-depth` rule                                    | NOT CONFIGURED | `warn` at threshold 5                 |
| `@typescript-eslint/explicit-module-boundary-types` | `off`          | `warn`                                |
| `no-unreachable` rule                               | NOT CONFIGURED | `error` (added 2026-02-08)            |
| `no-constant-condition` rule                        | NOT CONFIGURED | `error` (added 2026-02-08)            |
| `@typescript-eslint/naming-convention`              | NOT CONFIGURED | `warn` (added 2026-02-08)             |
| String concatenation violations                     | ~52            | 0                                     |

## Scope

### Part 1: Fix ~52 String Concatenation Violations

Before enabling `prefer-template: error`, all existing violations must be fixed.

#### Server-Side (11 instances)

| #   | File                                            | Line(s)  |
| --- | ----------------------------------------------- | -------- |
| 1   | `src/lib/server/bettercap/apiClient.ts`         | 93-94    |
| 2   | `src/routes/api/hardware/details/+server.ts`    | 240      |
| 3   | `src/lib/services/map/webglHeatmapRenderer.ts`  | 128      |
| 4   | `src/lib/services/map/mapUtils.ts`              | 197      |
| 5   | `src/lib/services/map/altitudeLayerManager.ts`  | 306, 308 |
| 6   | `src/lib/services/gsm-evil/server.ts`           | 120      |
| 7   | `src/lib/services/monitoring/systemHealth.ts`   | 170      |
| 8   | `src/lib/services/hackrfsweep/signalService.ts` | 120, 126 |

#### Client-Side (36 instances)

| File                                              | Count |
| ------------------------------------------------- | ----- |
| `src/routes/hackrfsweep/+page.svelte`             | 12    |
| `src/routes/rfsweep/+page.svelte`                 | 11    |
| `src/routes/redesign/+page.svelte`                | 2     |
| `src/routes/kismet/+page.svelte`                  | 2     |
| `src/lib/components/hackrf/SweepControls.svelte`  | 4     |
| `src/lib/components/hackrf/SignalAnalyzer.svelte` | 2     |
| `src/lib/components/hackrf/OverviewPanel.svelte`  | 1     |
| `src/lib/components/hackrf/TopStatusBar.svelte`   | 1     |
| `src/routes/rtl-433/+page.svelte`                 | 1     |

**Total**: 11 (server) + 36 (client) = **47 enumerated + ~5 additional** = ~52 (corrected 2026-02-08)

#### Fix Pattern

```typescript
// BEFORE (string concatenation):
const label = 'Frequency: ' + freq + ' MHz';

// AFTER (template literal):
const label = `Frequency: ${freq} MHz`;
```

### Part 2: Add 8 New ESLint Rules

**File**: `config/eslint.config.js`, Block 3 (TypeScript rules)

```javascript
// Add after existing rules:

// Prevent magic numbers (regression guard for Phase 3.2)
'no-magic-numbers': ['warn', {
    ignore: [0, 1, -1, 2, 100, 1000, 1e6],
    ignoreArrayIndexes: true,
    ignoreDefaultValues: true,
    enforceConst: true,
    detectObjects: false
}],

// Enforce template literals over string concatenation
'prefer-template': 'error',

// Enforce complexity limits (26 files with depth >= 8)
'complexity': ['warn', { max: 20 }],
'max-depth': ['warn', { max: 5 }],

// Enforce explicit return types on exported functions (66 missing)
'@typescript-eslint/explicit-module-boundary-types': ['warn', {
    allowArgumentsExplicitlyTypedAsAny: false,
    allowDirectConstAssertionInArrowFunctions: true,
    allowHigherOrderFunctions: true,
    allowTypedFunctionExpressions: true,
}],

// ADDED 2026-02-08: Prevent unreachable code (currently suppressed in hackrfsweep/+page.svelte:59)
'no-unreachable': 'error',

// ADDED 2026-02-08: Prevent constant conditions (if(true), while(1))
'no-constant-condition': 'error',

// ADDED 2026-02-08: Enforce naming conventions (9 snake_case files coexist with camelCase)
'@typescript-eslint/naming-convention': ['warn',
    // Variables and functions: camelCase
    { selector: 'variableLike', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
    // Types, interfaces, classes, enums: PascalCase
    { selector: 'typeLike', format: ['PascalCase'] },
    // Enum members: UPPER_CASE or PascalCase
    { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
],
```

### Rationale for `warn` vs `error` for Each Rule

| Rule                             | Level   | Rationale                                                                                                         |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `no-magic-numbers`               | `warn`  | Phase 3.2 may not catch every magic number. Escalate to `error` after a full warning-elimination pass.            |
| `prefer-template`                | `error` | All ~52 violations are straightforward fixes. No reason to allow new concatenations.                              |
| `complexity`                     | `warn`  | 26 files exceed threshold. Addressed structurally in Phase 5 (Architecture). `error` would block builds.          |
| `max-depth`                      | `warn`  | 26 files exceed depth 4. Addressed structurally in Phase 5. `error` would block builds.                           |
| `explicit-module-boundary-types` | `warn`  | 66 functions lack return types. Should be added incrementally, not blocking builds.                               |
| `no-unreachable`                 | `error` | Unreachable code should be deleted, not suppressed. The existing eslint-disable in hackrfsweep must be resolved.  |
| `no-constant-condition`          | `error` | Constant conditions indicate dead branches. No legitimate use case in this codebase.                              |
| `naming-convention`              | `warn`  | 9+ snake_case files coexist with camelCase. Enforces variable-level naming; file-level naming is Phase 0.2 scope. |

## Execution Steps

### Step 1: Fix All ~52 String Concatenation Violations

Process each file from the inventory above. Replace string concatenation with template literals.

```bash
# Discover any additional instances not in the inventory:
npm run lint 2>&1 | grep "prefer-template"
# (Run after temporarily adding the rule as warn to discover all violations)
```

### Step 2: Verify Zero Concatenation Violations

```bash
# Temporarily add prefer-template as warn, run lint:
npm run lint 2>&1 | grep "prefer-template" | wc -l
# Expected: 0
```

### Step 3: Add All 8 Rules to ESLint Config

Edit `config/eslint.config.js` and add the rules from the code block above.

### Step 4: Run Full Lint Check

```bash
npm run lint
# Expected: Exit 0 (no errors; warnings acceptable for warn-level rules)
```

### Step 5: Verify Rule Presence

```bash
grep "no-magic-numbers" config/eslint.config.js | wc -l   # Expected: 1
grep "prefer-template" config/eslint.config.js | wc -l     # Expected: 1
grep "complexity" config/eslint.config.js | wc -l           # Expected: 1
grep "max-depth" config/eslint.config.js | wc -l            # Expected: 1
grep "no-unreachable" config/eslint.config.js | wc -l       # Expected: 1
grep "no-constant-condition" config/eslint.config.js | wc -l # Expected: 1
grep "naming-convention" config/eslint.config.js | wc -l     # Expected: 1
```

## Commit Message

Two commits (fix violations first, then add rules):

```
refactor(style): replace ~52 string concatenations with template literals

build(eslint): add no-magic-numbers, prefer-template, complexity, max-depth, no-unreachable, no-constant-condition, naming-convention rules
```

## Verification

| #   | Check                              | Command                                                         | Expected |
| --- | ---------------------------------- | --------------------------------------------------------------- | -------- |
| 1   | no-magic-numbers rule active       | `grep "no-magic-numbers" config/eslint.config.js \| wc -l`      | 1        |
| 2   | prefer-template rule active        | `grep "prefer-template" config/eslint.config.js \| wc -l`       | 1        |
| 3   | No string concatenation violations | `npm run lint 2>&1 \| grep "prefer-template" \| wc -l`          | 0        |
| 4   | complexity rule active             | `grep "complexity" config/eslint.config.js \| wc -l`            | 1        |
| 5   | max-depth rule active              | `grep "max-depth" config/eslint.config.js \| wc -l`             | 1        |
| 6   | no-unreachable rule active         | `grep "no-unreachable" config/eslint.config.js \| wc -l`        | 1        |
| 7   | no-constant-condition rule active  | `grep "no-constant-condition" config/eslint.config.js \| wc -l` | 1        |
| 8   | naming-convention rule active      | `grep "naming-convention" config/eslint.config.js \| wc -l`     | 1        |
| 9   | Lint passes (warnings OK)          | `npm run lint`                                                  | Exit 0   |
| 10  | TypeScript compiles                | `npm run typecheck`                                             | Exit 0   |
| 11  | Build succeeds                     | `npm run build`                                                 | Exit 0   |
| 12  | Unit tests pass                    | `npm run test:unit`                                             | Exit 0   |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                      |
| -------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| no-magic-numbers generates excessive warnings            | HIGH       | LOW    | Set to `warn`, not `error`; liberal ignore list                 |
| prefer-template breaks template literal in Svelte markup | LOW        | MEDIUM | Rule only applies to JS/TS expressions, not HTML attributes     |
| complexity/max-depth warnings flood lint output          | MEDIUM     | LOW    | Set to `warn`; addressed structurally in Phase 5                |
| naming-convention warnings on external API field names   | MEDIUM     | LOW    | Convention only enforces on declared variables, not object keys |

## Success Criteria

- [ ] All ~52 string concatenation violations fixed with template literals
- [ ] 8 new ESLint rules added to `config/eslint.config.js`
- [ ] `npm run lint` exits 0 (warnings acceptable for warn-level rules)
- [ ] No `prefer-template` errors in lint output
- [ ] TypeScript compiles without errors
- [ ] Build succeeds

## Cross-References

- **Depends on**: Phase 3.1.8 (no-console must be escalated to `error` before adding more rules)
- **Depends on**: Phase 3.2 (Constants must be centralized before no-magic-numbers is meaningful)
- **Depends on**: Phase 3.3.5 (eslint-disable Audit should be complete so new rules do not conflict with suppressions)
- **Depended on by**: Phase 4 (`@typescript-eslint/no-explicit-any` escalation from `warn` to `error`)
- **Depended on by**: Phase 5 (`complexity` and `max-depth` warnings resolved by architecture decomposition)

## Execution Tracking

| Step | Description                      | Status  | Started | Completed | Verified By |
| ---- | -------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Fix ~52 string concatenations    | PENDING | --      | --        | --          |
| 2    | Verify zero concatenation errors | PENDING | --      | --        | --          |
| 3    | Add 8 rules to ESLint config     | PENDING | --      | --        | --          |
| 4    | Run full lint check              | PENDING | --      | --        | --          |
| 5    | Verify rule presence             | PENDING | --      | --        | --          |
