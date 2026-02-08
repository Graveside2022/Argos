# Phase 3.4.5: Unsafe Error Cast Pattern Fix

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: CERT ERR00-C (Consistent Error Handling), CERT ERR07-C (Prefer Standard Exceptions)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.5
**Risk Level**: LOW -- Replacing unsafe type casts with safe runtime checks
**Prerequisites**: Phase 3.1 (Logger infrastructure for logError calls in catch blocks)
**Blocks**: None
**Estimated Files Touched**: ~40
**Standards**: CERT ERR00-C (consistent error handling), CERT ERR07-C (prefer standard exceptions)

---

## Objective

Replace approximately 40 instances of the unsafe `(error as Error).message` pattern with a safe `error instanceof Error ? error.message : String(error)` check. The current pattern silently produces `undefined` when the thrown value is not an Error object.

## Current State Assessment

| Metric                                  | Verified Value | Target | Verification Command                                               |
| --------------------------------------- | -------------- | ------ | ------------------------------------------------------------------ |
| `(error as Error).message` unsafe casts | ~40            | 0      | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`       |
| `error instanceof Error` safe checks    | ~0             | ~40    | `grep -rn "error instanceof Error" src/ --include="*.ts" \| wc -l` |

## Scope

### Root Cause

Nearly every API route catch block uses this pattern:

```typescript
} catch (error) {
    return json({ success: false, error: (error as Error).message }, { status: 500 });
}
```

**Why this is unsafe**: TypeScript's `as` keyword is a compile-time assertion, not a runtime check. If the thrown value is:

- A **string** (e.g., `throw 'something failed'`): `.message` returns `undefined`
- **null**: accessing `.message` throws `TypeError: Cannot read property 'message' of null`
- **undefined**: same TypeError
- A **non-Error object** (e.g., `throw { code: 404 }`): `.message` returns `undefined`

The API response becomes `{ success: false, error: undefined }` -- the error is silently lost.

### Fix Pattern

```typescript
// BEFORE (unsafe):
} catch (error) {
    return json({ success: false, error: (error as Error).message }, { status: 500 });
}

// AFTER (safe):
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Operation failed', { error: message });
    return json({ success: false, error: message }, { status: 500 });
}
```

Key changes:

1. `instanceof Error` check handles non-Error thrown values
2. `String(error)` is safe for all types (null, undefined, objects, primitives)
3. `logError()` ensures the error is captured in structured logs (Phase 3.1)
4. The error message is always a string, never undefined

### Discovery Command

```bash
grep -rn "(error as Error)" src/ --include="*.ts"
```

## Execution Steps

### Step 1: Enumerate All ~40 Instances

```bash
grep -rn "(error as Error)" src/ --include="*.ts" | wc -l
# Expected: ~40
```

List all instances with file paths and line numbers.

### Step 2: Apply Fix Pattern to Each Instance

For each instance:

1. Replace `(error as Error).message` with `error instanceof Error ? error.message : String(error)`
2. Add `logError()` call if not already present in the catch block
3. Store the message in a `const message` variable for clarity

### Step 3: Verify Zero Remaining Unsafe Casts

```bash
grep -rn "(error as Error)" src/ --include="*.ts" | wc -l
# Target: 0
```

### Step 4: Run Full Verification

```bash
npm run typecheck  # Must pass
npm run test:unit  # Must pass
npm run build      # Must pass
```

## Commit Message

```
fix(error-handling): replace unsafe (error as Error).message casts with instanceof checks
```

## Verification

| #   | Check                            | Command                                                            | Expected |
| --- | -------------------------------- | ------------------------------------------------------------------ | -------- |
| 1   | No unsafe error casts            | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`       | 0        |
| 2   | Safe instanceof checks present   | `grep -rn "error instanceof Error" src/ --include="*.ts" \| wc -l` | 40+      |
| 3   | logError present in catch blocks | `grep -rn "logError" src/routes/api/ --include="*.ts" \| wc -l`    | 30+      |
| 4   | TypeScript compiles              | `npm run typecheck`                                                | Exit 0   |
| 5   | Build succeeds                   | `npm run build`                                                    | Exit 0   |
| 6   | Unit tests pass                  | `npm run test:unit`                                                | Exit 0   |

---

## Phase 3.4 Verification Checklist (Complete)

This checklist covers all Phase 3.4 sub-tasks (3.4.0 through 3.4.5). Execute after ALL Phase 3.4 tasks are complete.

| #   | Check                      | Command                                                                           | Expected |
| --- | -------------------------- | --------------------------------------------------------------------------------- | -------- |
| 1   | assert.ts exists           | `test -f src/lib/utils/assert.ts && echo EXISTS`                                  | EXISTS   |
| 2   | Assertions in geo.ts       | `grep -c "assert" src/lib/server/db/geo.ts`                                       | 6+       |
| 3   | Assertions in sweepManager | `grep -c "assert" src/lib/server/hackrf/sweepManager.ts`                          | 3+       |
| 4   | Logging policy exists      | `test -f docs/LOGGING-POLICY.md && echo EXISTS`                                   | EXISTS   |
| 5   | PII rules documented       | `grep -c "NEVER" docs/LOGGING-POLICY.md`                                          | 2+       |
| 6   | Zod schemas in API routes  | `grep -rl "z\.\|zod" src/routes/api/ --include="*.ts" \| wc -l`                   | 10+      |
| 7   | No unguarded parseInt      | `grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" \| grep -v ', 10' \| wc -l` | 0        |
| 8   | No unsafe error casts      | `grep -rn "(error as Error)" src/ --include="*.ts" \| wc -l`                      | 0        |
| 9   | TypeScript compiles        | `npm run typecheck`                                                               | Exit 0   |
| 10  | Build succeeds             | `npm run build`                                                                   | Exit 0   |
| 11  | Unit tests pass            | `npm run test:unit`                                                               | Exit 0   |

---

## Phase 3.4 Risk Assessment (Complete)

| Risk                                             | Likelihood | Impact | Mitigation                                                                                                                                                           |
| ------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assertion throws in production for edge case     | MEDIUM     | MEDIUM | Assertions are for "should never happen" conditions; catching real bugs is the intended outcome. Log before throw ensures the failure is recorded.                   |
| Zod validation rejects previously-accepted input | MEDIUM     | LOW    | Schemas use `.default()` for optional fields. Existing valid input will continue to work. Invalid input that previously silently corrupted data will now return 400. |
| parseInt radix change alters parsing             | VERY LOW   | LOW    | Specifying radix 10 only affects strings with leading zeros (e.g., "010"). No frequency or port values in this system have leading zeros.                            |
| PII logging policy too restrictive for debugging | LOW        | LOW    | DEBUG level is exempt from truncation. Policy only restricts INFO and above.                                                                                         |
| error instanceof Error misses cross-realm errors | VERY LOW   | LOW    | All errors in this system are thrown within the same V8 isolate. Cross-realm Error objects are not a concern.                                                        |

---

## Phase 3.4 Dependencies (Complete)

- **Phase 3.1**: Must be complete (assertions use structured logger for failure reporting)
- **Phase 3.2**: Must be complete (assertions reference named constants for range bounds, e.g., RF_BANDS.WIFI_2G_MIN)
- **Phase 3.3**: Runs in parallel with Phase 3.3.2 addendum (catch-related fixes)
- **Phase 4**: Type safety improvements benefit from Zod schemas (runtime validation + compile-time types via `z.infer<>`)
- **Phase 2**: Security hardening benefits from input validation (Zod schemas prevent injection at the validation boundary)

---

## Risk Assessment (This Task)

| Risk                                               | Likelihood | Impact   | Mitigation                                                                       |
| -------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------- |
| error instanceof Error misses cross-realm errors   | VERY LOW   | LOW      | All errors thrown within same V8 isolate. Not a concern for this system.         |
| String(error) produces unhelpful output            | LOW        | LOW      | String() on objects calls .toString(). For most thrown values, this is adequate. |
| logError in catch block creates double-logging     | LOW        | LOW      | Check if upstream already logs; add logError only where no logging exists.       |
| Behavioral change: error field no longer undefined | VERY LOW   | POSITIVE | Previously-undefined error fields now contain useful error messages.             |

## Success Criteria

- [ ] All ~40 `(error as Error).message` patterns replaced with `instanceof` checks
- [ ] Every catch block with the fix also includes a `logError()` call
- [ ] Error response `.error` field is always a string, never undefined
- [ ] Zero instances of `(error as Error)` remaining in codebase
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.1 (Logger infrastructure for logError calls)
- **Depended on by**: Nothing (terminal task in Phase 3.4)
- **Related**: Phase 3.3.1 (Error Variable Catch Block Hygiene) -- addresses catch variable naming; this task addresses error extraction
- **Related**: Phase 3.3.2 (Promise Chain Silent Swallowing) -- addresses .catch(() => {}) patterns
- **Related**: Phase 2.2.1 (Swallowed Error Remediation) -- Phase 2 addresses swallowed errors; this task addresses unsafe error extraction in non-swallowed catch blocks

## Execution Tracking

| Step | Description                 | Status  | Started | Completed | Verified By |
| ---- | --------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Enumerate all ~40 instances | PENDING | --      | --        | --          |
| 2    | Apply fix pattern to each   | PENDING | --      | --        | --          |
| 3    | Verify zero remaining casts | PENDING | --      | --        | --          |
| 4    | Run full verification       | PENDING | --      | --        | --          |
