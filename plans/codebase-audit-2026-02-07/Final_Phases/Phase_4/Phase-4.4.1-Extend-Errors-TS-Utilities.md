# Phase 4.4.1: Extend errors.ts with Error Extraction Utilities

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, CERT ERR07-C (Prefer Functions Over Macros)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Phase        | 4.4                                                                                    |
| Task         | 4.4.1                                                                                  |
| Title        | Extend errors.ts with Error Extraction Utilities                                       |
| Status       | PLANNED                                                                                |
| Risk Level   | LOW -- additive-only changes to existing utility file                                  |
| Duration     | 30 minutes                                                                             |
| Dependencies | None (standalone, but MUST complete before Phase-4.4.2 through Phase-4.4.6)            |
| Commit       | `feat(errors): add getErrorMessage, isBaseError, getErrorStack, isExecError utilities` |

---

## Objective

Add four new utility functions to `src/lib/types/errors.ts` that enable safe property access on `unknown` catch variables. These functions are prerequisites for the batch catch block migrations in Phase-4.4.2 through Phase-4.4.6.

## Current State Assessment

### Existing Error Infrastructure

File: `src/lib/types/errors.ts` (185 lines)

Already provides:

- **Interfaces**: BaseError, DatabaseError, ApiError, WebSocketError, ValidationError
- **Type guards**: isDatabaseError(), isApiError(), isWebSocketError(), isValidationError()
- **Factory functions**: createDatabaseError(), createApiError(), createWebSocketError(), createValidationError()
- **Utilities**: getErrorProperty(), toError()
- **Total exported functions**: **10** (verified 2026-02-08)

Missing (required by this plan):

- `getErrorMessage(error: unknown): string` -- safe message extraction
- `isBaseError(error: unknown): error is BaseError` -- general type guard
- `getErrorStack(error: unknown): string | undefined` -- safe stack extraction
- `isExecError(error: unknown): error is Error & { stdout: string; stderr: string }` -- exec rejection guard

### Error Access Patterns in Existing Catch Blocks

Analysis of the 402 untyped catch blocks reveals these access patterns:

| Pattern                        | Occurrences | Migration Strategy               |
| ------------------------------ | ----------- | -------------------------------- |
| `instanceof Error` check       | 88          | Keep as-is (valid on unknown)    |
| `.message` property access     | 69          | Replace with getErrorMessage()   |
| `as Error` cast                | 85          | Replace with type guard          |
| String interpolation `${err}`  | 4           | Replace with getErrorMessage()   |
| Pass-through (rethrow/log obj) | 156         | Add `: unknown`, no other change |

### Rationale for Explicit `: unknown` Annotation

TypeScript strict mode (`useUnknownInCatchVariables: true`) is enabled in `tsconfig.json`. The
compiler already treats catch variables as `unknown` internally. However, explicit annotation is
required for:

1. **MISRA C++ compliance analog**: Intent must be unambiguous in safety-critical code. Implicit compiler behavior is insufficient for audit trail.
2. **Code review clarity**: Reviewers must see the type at the catch site without consulting tsconfig.json to understand the variable's type.
3. **Defense in depth**: If tsconfig changes, explicit annotations prevent silent regression to `any`.
4. **Grep-ability**: `catch (error: unknown)` is searchable; implicit typing is invisible.

## Scope

**File**: `src/lib/types/errors.ts` (185 lines)
**Action**: Append new utilities after line 185. Do NOT create a new file.
**Net additions**: 4 new exported functions (~60 lines including JSDoc)

## Execution Steps

### Step 1: Verify Current Export Count

```bash
grep -c 'export function' src/lib/types/errors.ts
# Expected: 10
```

### Step 2: Append New Functions

Add the following code after line 185 of `src/lib/types/errors.ts`:

```typescript
/**
 * Extract a human-readable error message from an unknown catch variable.
 * Handles Error instances, strings, objects with .message, and fallback to String().
 *
 * Usage in catch blocks:
 *   } catch (error: unknown) {
 *       console.error('Operation failed:', getErrorMessage(error));
 *   }
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof (error as { message: unknown }).message === 'string'
	) {
		return (error as { message: string }).message;
	}
	return String(error);
}

/**
 * Type guard for BaseError (Error with optional code/statusCode/details).
 */
export function isBaseError(error: unknown): error is BaseError {
	return error instanceof Error;
}

/**
 * Safely extract stack trace from an unknown error.
 * Returns undefined if the value is not an Error or has no stack.
 */
export function getErrorStack(error: unknown): string | undefined {
	if (error instanceof Error) {
		return error.stack;
	}
	return undefined;
}

/**
 * Type guard for exec/spawn rejection objects with stdout/stderr.
 * Used in catch blocks handling child_process errors.
 */
export function isExecError(error: unknown): error is Error & { stdout: string; stderr: string } {
	return (
		error instanceof Error &&
		'stdout' in error &&
		'stderr' in error &&
		typeof (error as Error & { stdout: unknown }).stdout === 'string' &&
		typeof (error as Error & { stderr: unknown }).stderr === 'string'
	);
}
```

### Step 3: Relationship to Existing toError()

The existing `toError()` function (line 171) converts unknown to Error objects. The new `getErrorMessage()` serves a different purpose: it extracts the message string without creating an Error instance. Both are needed:

- `getErrorMessage(error)` -- for logging and string interpolation
- `toError(error)` -- for rethrowing or passing to error handlers expecting Error
- `isExecError(error)` -- for child_process catch blocks accessing .stdout/.stderr
- `isBaseError(error)` -- general guard for BaseError interface checks
- `getErrorStack(error)` -- safe stack trace extraction for logging

## Verification

| #   | Check                    | Command                                                          | Expected                                                             |
| --- | ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | File compiles            | `npx tsc --noEmit --pretty 2>&1 \| grep errors.ts`               | 0 errors                                                             |
| 2   | Export count             | `grep -c 'export function' src/lib/types/errors.ts`              | 14 (was 10, now 14 with 4 new)                                       |
| 3   | getErrorMessage exported | `grep 'export function getErrorMessage' src/lib/types/errors.ts` | `export function getErrorMessage(error: unknown): string`            |
| 4   | isBaseError exported     | `grep 'export function isBaseError' src/lib/types/errors.ts`     | `export function isBaseError(error: unknown): error is BaseError`    |
| 5   | getErrorStack exported   | `grep 'export function getErrorStack' src/lib/types/errors.ts`   | `export function getErrorStack(error: unknown): string \| undefined` |
| 6   | isExecError exported     | `grep 'export function isExecError' src/lib/types/errors.ts`     | `export function isExecError(error: unknown): error is Error & ...`  |
| 7   | Full type check          | `npx tsc --noEmit 2>&1 \| grep -c 'error TS'`                    | 0                                                                    |

## Risk Assessment

| Risk                                 | Likelihood | Impact | Mitigation                                        |
| ------------------------------------ | ---------- | ------ | ------------------------------------------------- |
| Import cycle from errors.ts          | NONE       | --     | errors.ts has zero imports from project files     |
| Existing exports break               | NONE       | --     | Append-only; no existing code modified            |
| getErrorMessage returns wrong string | LOW        | LOW    | Follows instanceof > typeof > in > String() chain |

## Rollback Strategy

Revert the single file:

```bash
git checkout HEAD~1 -- src/lib/types/errors.ts
```

Since Batches 1-8 depend on these functions, rolling back errors.ts requires also rolling back any batches that import `getErrorMessage`. If errors.ts is reverted before batches are applied, no cascading impact.

## Out of Scope

The 35 parameterless `catch {}` blocks are intentionally error-swallowing and do NOT require migration. See Phase-4.4.6 Appendix for the full list.

## Cross-References

- **Depended on by**: Phase-4.4.2 through Phase-4.4.6 (batch catch migrations import getErrorMessage)
- **Independent of**: Phase-4.4.0 (`: any` fix), Phase-4.4.7/4.4.8 (Zod schemas)
- **Related**: Phase 3.4.5 (Unsafe Error Cast Pattern Fix) -- uses similar patterns
- **Source**: Phase 4.4 monolithic plan, Section 4 (Task 4.4.2)
