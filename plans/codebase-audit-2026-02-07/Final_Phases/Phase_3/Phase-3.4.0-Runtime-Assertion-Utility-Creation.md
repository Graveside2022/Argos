# Phase 3.4.0: Runtime Assertion Utility Creation

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: NASA/JPL Rule 5 (minimum of two runtime assertions per function), CERT ERR00-C (consistent error handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.0
**Risk Level**: LOW -- New utility file, no changes to existing behavior
**Prerequisites**: Phase 3.1.0 (Logger infrastructure -- assertions log via structured logger before throwing)
**Blocks**: Phase 3.4.1 (Critical Function Assertion Integration), Phase 3.4.4 (ParseInt/ParseFloat NaN Guards)
**Estimated Files Touched**: 1 (new file)
**Standards**: NASA/JPL Rule 5 (runtime assertions), CERT ERR00-C (consistent error handling), MISRA Rule 21.8 (no undefined behavior from invalid input)

---

## Objective

Create `src/lib/utils/assert.ts` -- a runtime assertion utility that logs failures via the structured logger before throwing. This utility provides the foundation for all subsequent defensive coding tasks in Phase 3.4.

## Current State Assessment

| Metric                        | Verified Value | Target                  | Verification Command                                       |
| ----------------------------- | -------------- | ----------------------- | ---------------------------------------------------------- |
| `import.*assert` in src/\*.ts | 0              | 1 (assertion utility)   | `grep -rn "import.*assert" src/ --include="*.ts" \| wc -l` |
| `assert(` calls in src/\*.ts  | 0              | 50+ (after Phase 3.4.1) | `grep -rn "assert(" src/ --include="*.ts" \| wc -l`        |

**NASA/JPL Rule 5**: "Use a minimum of two runtime assertions per function." The current codebase has **zero** assertions. Functions that process GPS coordinates, RF frequencies, and IMSI data accept any value without range validation. Garbage input produces garbage output silently.

This is the first item that would be flagged in a US Cyber Command code review. A SIGINT system that processes IMSI numbers, GPS coordinates, and RF spectrum data with zero input validation and zero assertions is operating on faith that every upstream data source provides well-formed data.

## Scope

### File to Create: `src/lib/utils/assert.ts`

```typescript
import { logError } from '$lib/utils/logger';

/**
 * Runtime assertion for conditions that must be true.
 * Logs via structured logger before throwing to ensure
 * assertion failures are captured in log output.
 *
 * NASA/JPL Rule 5: "Use a minimum of two runtime assertions per function."
 *
 * @param condition - The condition that must be true
 * @param message - Description of what was expected
 * @param context - Optional structured context for logging
 * @throws AssertionError if condition is false
 */
export function assert(
	condition: unknown,
	message: string,
	context?: Record<string, unknown>
): asserts condition {
	if (!condition) {
		const error = new Error(`Assertion failed: ${message}`);
		error.name = 'AssertionError';
		logError(`Assertion failed: ${message}`, context);
		throw error;
	}
}

/**
 * Assert that a value is not null or undefined.
 * Returns the value with a narrowed type.
 *
 * @param value - The value to check
 * @param name - Human-readable name for the value (used in error messages)
 * @returns The value, guaranteed non-null and non-undefined
 * @throws AssertionError if value is null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, name: string): T {
	assert(value != null, `${name} must not be null or undefined`, { name, value });
	return value;
}

/**
 * Assert that a numeric value is within a specified range.
 * Used for coordinate validation, frequency bounds, port numbers, etc.
 *
 * @param value - The numeric value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param name - Human-readable name for the value (used in error messages)
 * @throws AssertionError if value is NaN or outside [min, max]
 */
export function assertRange(value: number, min: number, max: number, name: string): void {
	assert(
		!isNaN(value) && value >= min && value <= max,
		`${name} must be between ${min} and ${max}, got ${value}`,
		{ name, value, min, max }
	);
}

/**
 * Assert that a value is a finite number (not NaN, not Infinity).
 * Used after parseInt/parseFloat calls.
 *
 * @param value - The numeric value to validate
 * @param name - Human-readable name for the value (used in error messages)
 * @throws AssertionError if value is NaN or Infinity
 */
export function assertFiniteNumber(value: number, name: string): void {
	assert(Number.isFinite(value), `${name} must be a finite number, got ${value}`, {
		name,
		value
	});
}
```

### Design Decisions

1. **Log before throw**: Assertions log the failure via the structured logger (Phase 3.1) before throwing. This ensures assertion failures are captured in log files even if the throw is caught and swallowed upstream.

2. **Always-on in production**: For military deployment, assertions are NOT tree-shaken. Assertions check conditions that should never be false. If they fire in production, that is a real bug that must be logged and investigated.

3. **TypeScript `asserts` return type**: The `assert()` function uses TypeScript's `asserts condition` return type, enabling the compiler to narrow types after the assertion call.

4. **Structured context**: All assertion functions accept or generate structured context objects for machine-parseable log entries.

## Execution Steps

### Step 1: Verify Logger Infrastructure Exists

```bash
test -f src/lib/utils/logger.ts && echo "Logger EXISTS" || echo "Logger MISSING -- Phase 3.1 prerequisite not met"
grep -c "export function logError" src/lib/utils/logger.ts
# Expected: 1
```

### Step 2: Create the Assert Utility

Write the file `src/lib/utils/assert.ts` with the contents specified above.

### Step 3: Verify TypeScript Compilation

```bash
npm run typecheck
# Must pass
```

### Step 4: Verify Exported Functions

```bash
grep -c "export function assert" src/lib/utils/assert.ts
# Expected: 4 (assert, assertDefined, assertRange, assertFiniteNumber)
```

### Step 5: Run Unit Tests

```bash
npm run test:unit
# Must pass
```

## Commit Message

```
feat(assert): create runtime assertion utility for defensive coding (NASA/JPL Rule 5)
```

## Verification

| #   | Check                    | Command                                                    | Expected |
| --- | ------------------------ | ---------------------------------------------------------- | -------- |
| 1   | File exists              | `test -f src/lib/utils/assert.ts && echo EXISTS`           | EXISTS   |
| 2   | 4 exported functions     | `grep -c "export function assert" src/lib/utils/assert.ts` | 4        |
| 3   | Imports logger           | `grep -c "import.*logError.*from" src/lib/utils/assert.ts` | 1        |
| 4   | Uses asserts return type | `grep -c "asserts condition" src/lib/utils/assert.ts`      | 1        |
| 5   | TypeScript compiles      | `npm run typecheck`                                        | Exit 0   |
| 6   | Build succeeds           | `npm run build`                                            | Exit 0   |
| 7   | Unit tests pass          | `npm run test:unit`                                        | Exit 0   |

## Risk Assessment

| Risk                                          | Likelihood | Impact   | Mitigation                                                                                                                                         |
| --------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assertion throws in production for edge case  | MEDIUM     | MEDIUM   | Assertions are for "should never happen" conditions; catching real bugs is the intended outcome. Log before throw ensures the failure is recorded. |
| Logger not available (Phase 3.1 not complete) | LOW        | MEDIUM   | Prerequisite check in Step 1. If logger is missing, this task cannot proceed.                                                                      |
| AssertionError name typo (missing "s")        | VERY LOW   | VERY LOW | Intentional choice: `AssertionError` is a custom error name, not Node.js `AssertionError`. Can be renamed if team prefers `AssertionError`.        |

## Success Criteria

- [ ] `src/lib/utils/assert.ts` created with 4 exported functions
- [ ] All functions log via structured logger before throwing
- [ ] `assert()` uses TypeScript `asserts condition` return type for type narrowing
- [ ] `assertDefined()` returns the narrowed non-null type
- [ ] `assertRange()` validates inclusive [min, max] bounds and NaN
- [ ] `assertFiniteNumber()` validates `Number.isFinite()`
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.1.0 (Logger infrastructure -- `logError` must be importable from `$lib/utils/logger`)
- **Depended on by**: Phase 3.4.1 (Critical Function Assertion Integration)
- **Depended on by**: Phase 3.4.4 (ParseInt/ParseFloat NaN Guards use `assertFiniteNumber`)
- **Related**: Phase 3.2.0 (Constants centralization -- assertion bounds like RF_BANDS.WIFI_2G_MIN come from Phase 3.2)

## Execution Tracking

| Step | Description                   | Status  | Started | Completed | Verified By |
| ---- | ----------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Verify logger infrastructure  | PENDING | --      | --        | --          |
| 2    | Create assert.ts              | PENDING | --      | --        | --          |
| 3    | Verify TypeScript compilation | PENDING | --      | --        | --          |
| 4    | Verify exported functions     | PENDING | --      | --        | --          |
| 5    | Run unit tests                | PENDING | --      | --        | --          |
