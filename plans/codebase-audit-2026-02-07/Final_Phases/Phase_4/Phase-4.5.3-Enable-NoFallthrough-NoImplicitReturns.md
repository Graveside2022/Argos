# Phase 4.5.3: Enable noFallthroughCasesInSwitch and noImplicitReturns

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT MSC01-C (strive for logical completeness), MISRA Rule 16.3 (unconditional break in switch), MISRA Rule 17.4 (function return type), BARR-C Rule 1.7 (resolve all warnings), NASA/JPL Rule 13 (highest warning level)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.3
**Risk Level**: LOW -- Compiler options that catch existing latent bugs
**Prerequisites**: Task 4.5.0 (green baseline), Task 4.5.2 (ESLint escalation)
**Blocks**: Task 4.5.4 (noImplicitOverride), Task 4.5.5 (noUncheckedIndexedAccess evaluation)
**Estimated Duration**: 30 minutes
**Estimated Files Touched**: 1 (tsconfig.json) + affected source files with switch/return issues
**Standards**: CERT MSC01-C, MISRA Rule 16.3, MISRA Rule 17.4, BARR-C Rule 1.7, NASA/JPL Rule 13

| Field        | Value                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Phase        | 4.5                                                                               |
| Task         | 4.5.3                                                                             |
| Title        | Enable noFallthroughCasesInSwitch and noImplicitReturns                           |
| Status       | PLANNED                                                                           |
| Risk Level   | LOW                                                                               |
| Duration     | 30 minutes                                                                        |
| Dependencies | Task 4.5.0, Task 4.5.2                                                            |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`                                 |
| Commit       | `chore: enable noFallthroughCasesInSwitch and noImplicitReturns compiler options` |

---

## Objective

Prevent silent fallthrough in switch statements and functions with missing return statements. Both are CERT/MISRA-required compiler options. In a real-time RF processing pipeline, a missing return value can propagate `undefined` through the signal chain silently. This is classified as HIGH severity by CERT/MISRA standards.

## Current State Assessment

### TypeScript Compiler Configuration (verified 2026-02-08)

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

This task addresses the first two rows: `noFallthroughCasesInSwitch` and `noImplicitReturns`.

---

## Execution Steps

### Step 1: Impact Assessment

Before enabling the options, measure the expected error count:

```bash
# Count switch statements in the codebase
grep -rn 'switch\s*(' --include='*.ts' --include='*.svelte' src/ | wc -l

# Count functions that may have implicit returns (rough estimate)
# Functions with mixed return/no-return paths
grep -rn 'return ' --include='*.ts' src/ | wc -l
```

### Step 2: Backup Configuration

```bash
cp tsconfig.json tsconfig.json.bak
```

### Step 3: Enable Compiler Options

Add to `tsconfig.json` compilerOptions:

```json
"noFallthroughCasesInSwitch": true,
"noImplicitReturns": true
```

The full compilerOptions block should become:

```json
{
	"compilerOptions": {
		"strict": true,
		"allowJs": true,
		"checkJs": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"skipLibCheck": true,
		"sourceMap": true,
		"moduleResolution": "bundler",
		"noFallthroughCasesInSwitch": true,
		"noImplicitReturns": true
	}
}
```

### Step 4: Run svelte-check to Identify Failures

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "error" | head -50
```

### Step 5: Fix noFallthroughCasesInSwitch Failures

For switch cases that intentionally fall through, add the `// falls through` comment (recognized by TypeScript as intentional fallthrough):

```typescript
// BEFORE (flagged):
switch (status) {
	case 'critical':
		triggerAlarm();
	case 'warning':
		logEvent();
		break;
	case 'ok':
		break;
}

// AFTER (fixed -- option A: explicit fallthrough comment):
switch (status) {
	case 'critical':
		triggerAlarm();
	// falls through
	case 'warning':
		logEvent();
		break;
	case 'ok':
		break;
}

// AFTER (fixed -- option B: add break if fallthrough was unintentional):
switch (status) {
	case 'critical':
		triggerAlarm();
		break;
	case 'warning':
		logEvent();
		break;
	case 'ok':
		break;
}
```

**Decision criteria**: If the fallthrough behavior is documented or clearly intentional (e.g., grouping cases), use option A. If the fallthrough appears accidental, use option B and verify behavior with tests.

### Step 6: Fix noImplicitReturns Failures

Add explicit return statements to all code paths. Common patterns:

```typescript
// BEFORE (flagged):
function processSignal(signal: Signal): ProcessedSignal {
	if (signal.frequency > 0) {
		return { ...signal, processed: true };
	}
	// Missing return for else branch
}

// AFTER (fixed -- option A: explicit return):
function processSignal(signal: Signal): ProcessedSignal {
	if (signal.frequency > 0) {
		return { ...signal, processed: true };
	}
	return { ...signal, processed: false };
}

// AFTER (fixed -- option B: early return with error for guard clause):
function processSignal(signal: Signal): ProcessedSignal {
	if (signal.frequency <= 0) {
		throw new Error(`Invalid frequency: ${signal.frequency}`);
	}
	return { ...signal, processed: true };
}
```

### Step 7: Remove Backup

```bash
rm tsconfig.json.bak
```

---

## Verification

| #   | Check                                   | Command                                                       | Expected                             |
| --- | --------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| 1   | noFallthroughCasesInSwitch enabled      | `grep "noFallthroughCasesInSwitch" tsconfig.json`             | `"noFallthroughCasesInSwitch": true` |
| 2   | noImplicitReturns enabled               | `grep "noImplicitReturns" tsconfig.json`                      | `"noImplicitReturns": true`          |
| 3   | svelte-check 0 errors                   | `npx svelte-check --tsconfig ./tsconfig.json 2>&1 \| tail -1` | `0 errors`                           |
| 4   | Build succeeds                          | `npm run build`                                               | Exit 0                               |
| 5   | Unit tests pass                         | `npm run test:unit`                                           | Exit 0                               |
| 6   | No `// falls through` without intention | `grep -rn "falls through" --include="*.ts" src/ \| wc -l`     | Count documented                     |

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                                   |
| ------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------- |
| Intentional fallthrough broken by adding `break` | LOW        | HIGH   | Review each switch case individually; use `// falls through` for intentional |
| noImplicitReturns fix changes function behavior  | LOW        | HIGH   | Verify with unit tests; prefer throwing on invalid paths over returning null |
| Existing tests depend on undefined return values | LOW        | MEDIUM | Run full test suite after changes                                            |

## Rollback Strategy

```bash
# Remove the two compiler options from tsconfig.json
# Revert any source file changes
git checkout tsconfig.json
git checkout src/
```

Alternatively, revert the entire commit:

```bash
git revert <commit-hash>
```

## Standards Traceability

| Standard | Rule      | Requirement                               | How This Task Satisfies It                            |
| -------- | --------- | ----------------------------------------- | ----------------------------------------------------- |
| CERT     | MSC01-C   | Strive for logical completeness           | noImplicitReturns ensures all function paths return   |
| MISRA    | Rule 16.3 | Every switch-clause shall end with break  | noFallthroughCasesInSwitch enforces break/fallthrough |
| MISRA    | Rule 17.4 | All exit paths shall have explicit return | noImplicitReturns flags incomplete return paths       |
| BARR-C   | Rule 1.7  | Resolve all compiler warnings             | Both options surface latent issues as compile errors  |
| NASA/JPL | Rule 13   | Compile at highest warning level          | Two additional strictness options enabled             |

## Commit Message

```
chore: enable noFallthroughCasesInSwitch and noImplicitReturns compiler options
```

## Execution Tracking

| Step | Description                              | Status  | Started | Completed | Verified By |
| ---- | ---------------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Impact assessment (count switch/returns) | PENDING | --      | --        | --          |
| 2    | Backup tsconfig.json                     | PENDING | --      | --        | --          |
| 3    | Enable compiler options                  | PENDING | --      | --        | --          |
| 4    | Identify failures                        | PENDING | --      | --        | --          |
| 5    | Fix noFallthroughCasesInSwitch failures  | PENDING | --      | --        | --          |
| 6    | Fix noImplicitReturns failures           | PENDING | --      | --        | --          |
| 7    | Remove backup, run verification          | PENDING | --      | --        | --          |
