# Phase 3.3.1: Error Variable Catch Block Hygiene

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (Consistent Error Handling)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.3 -- ESLint Enforcement, TODO Resolution, and Error Hygiene
**Task ID**: 3.3.1
**Risk Level**: LOW -- Rename variables, add comments, add minimal logging
**Prerequisites**: Phase 3.1 (Logger infrastructure must be available for error logging tier)
**Blocks**: Phase 3.3.6 (ESLint Rule Additions depend on clean catch block hygiene)
**Estimated Files Touched**: ~70
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 1.7 (resolve all warnings)

---

## Objective

Normalize all 478 catch blocks that capture a named error variable but never reference it in the body. Make developer intent explicit by either renaming to `_error` (intentionally ignored) or adding a logger call (error should have been logged).

## Current State Assessment

| Metric                                        | Value                                |
| --------------------------------------------- | ------------------------------------ |
| Total `catch(variable)` blocks in codebase    | 677                                  |
| `_`-prefixed (intentionally unused)           | 197 (29.1%)                          |
| Named var, actually used in body              | ~2 (0.3%)                            |
| Named var, NOT used in body                   | 478 (70.6%) -- **this task's scope** |
| Parameterless `catch {}` blocks (no variable) | 35 (separate from this scope)        |

**Standards violation**: CERT ERR00-C requires errors to be either handled or explicitly marked as intentionally ignored. The current pattern (naming the variable but not using it) is ambiguous -- a reviewer cannot tell if the developer forgot to handle the error or intentionally ignored it.

## Scope

### Strategy: 3-Tier Triage

For each of the 478 catch blocks:

**Tier 1 -- Comment exists, rename only**: If the catch body already has a comment explaining why the error is ignored, rename the variable to `_error` (or `_e`, `_err` matching the existing convention). This makes the intent explicit.

**Tier 2 -- No comment, add comment + rename**: If the body has NO comment explaining the silence, add a one-line comment explaining why the error is safely ignored, then rename to `_error`.

**Tier 3 -- Should log, add logger call**: If the error genuinely should be logged (hardware operations, database failures, network requests), replace with `logWarn('context', { error: String(error) })` or `logError(...)`. Keep the named variable.

### Top 14 Files (28 Instances, Highest Concentration)

These files account for the most egregious instances and must be fixed first:

| #   | File                                                              | Catch Blocks | Action                                                                                              |
| --- | ----------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/tactical-map-simple/+page.svelte`                     | 10           | Most are fetch failures -- rename to `_error`, add comment "Network request failed, using fallback" |
| 2   | `src/routes/rtl-433/+page.svelte`                                 | 5            | API call failures -- rename to `_error`                                                             |
| 3   | `src/lib/server/wireshark.ts`                                     | 3            | JSON parse and process cleanup -- rename to `_error`                                                |
| 4   | `src/routes/test-hackrf-stop/+page.svelte`                        | 2            | Test page -- rename to `_error`                                                                     |
| 5   | `src/routes/test/+page.svelte`                                    | 2            | Test page -- rename to `_error`                                                                     |
| 6   | `src/routes/hackrf/+page.svelte`                                  | 1            | Rename to `_error`                                                                                  |
| 7   | `src/routes/test-simple/+page.svelte`                             | 1            | Rename to `_error`                                                                                  |
| 8   | `src/routes/gsm-evil/+page.svelte`                                | 1            | Rename to `_error`                                                                                  |
| 9   | `src/routes/tactical-map-simple/rssi-integration.ts`              | 1            | Rename to `_error`                                                                                  |
| 10  | `src/routes/tactical-map-simple/integration-example.svelte`       | 1            | Rename to `_error`                                                                                  |
| 11  | `src/lib/server/db/migrations/runMigrations.ts`                   | 1            | **Should log** -- replace with `logWarn`                                                            |
| 12  | `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts` | 1            | Process cleanup -- rename to `_error`                                                               |
| 13  | `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`   | 1            | Process cleanup -- rename to `_error`                                                               |
| 14  | `src/routes/api/kismet/start-with-adapter/+server.ts`             | 1            | **Should log** -- replace with `logWarn`                                                            |

### Remaining ~448 Catch Blocks

The remaining catch blocks with unused error variables are spread across ~60 files. Execute the same triage:

- **If the catch body already has a descriptive comment**: prefix with `_` (Tier 1)
- **If the catch body is empty or has only a generic comment**: add specific comment, prefix with `_` (Tier 2)
- **If the error genuinely should be logged** (hardware, DB, network): add logger call (Tier 3)

### Unsafe Error Cast Pattern: `(error as Error).message` (~40 instances)

Nearly every API route catch block uses:

```typescript
} catch (error) {
    return json({ success: false, error: (error as Error).message }, { status: 500 });
}
```

If the thrown value is not an Error (string, null, undefined), `(error as Error).message` returns `undefined`. The response becomes `{ success: false, error: undefined }` -- losing the error entirely.

**Correct pattern**:

```typescript
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Operation failed', { error: message });
    return json({ success: false, error: message }, { status: 500 });
}
```

This fix should be applied during the batch migration of catch blocks. Note: The full unsafe error cast fix is detailed in Phase 3.4.5 (`Phase-3.4.5-Unsafe-Error-Cast-Pattern-Fix.md`). During this task, apply the safe pattern wherever catch blocks are being modified.

### ESLint Enforcement

The existing `@typescript-eslint/no-unused-vars` rule already has `caughtErrorsIgnorePattern: '^_'`. After renaming, ESLint will enforce that:

- Named error variables (`error`, `err`, `e`) MUST be used in the catch body
- Underscore-prefixed variables (`_error`, `_err`, `_e`) are explicitly ignored

No ESLint config changes are needed for this task.

## Execution Steps

### Step 1: Enumerate All 478 Instances

```bash
# List all catch blocks with named but unused error variables:
npx eslint --no-eslintrc -c config/eslint.config.js src/ 2>&1 | grep "no-unused-vars" | grep -i "catch" | head -50
```

### Step 2: Fix Top 14 Files (Batch 1)

Process each file from the priority table above. For each catch block:

1. Determine tier (1, 2, or 3)
2. Apply the appropriate fix
3. Run `npm run typecheck` after each file to verify no regressions

### Step 3: Fix Remaining ~448 Instances (Batches 2-5)

Process remaining files in groups by code area:

- Batch 2: API routes (`src/routes/api/`)
- Batch 3: Services (`src/lib/services/`)
- Batch 4: Stores and components (`src/lib/stores/`, `src/lib/components/`)
- Batch 5: Pages (`src/routes/*/+page.svelte`)

### Step 4: Verify ESLint Compliance

```bash
npx eslint --no-eslintrc -c config/eslint.config.js src/ 2>&1 | grep "no-unused-vars" | grep -i "catch" | wc -l
# Expected: 0
```

## Commit Message

Split into 5 commits of ~95 files each:

```
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 1 (server)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 2 (API routes)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 3 (services)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 4 (stores/components)
refactor(error-handling): normalize unused catch variables to _error prefix -- batch 5 (pages)
```

## Verification

| #   | Check                        | Command                                                                                                              | Expected |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | No unnamed unused catch vars | `npx eslint --no-eslintrc -c config/eslint.config.js src/ 2>&1 \| grep "no-unused-vars" \| grep -i "catch" \| wc -l` | 0        |
| 2   | TypeScript compiles          | `npm run typecheck`                                                                                                  | Exit 0   |
| 3   | Build succeeds               | `npm run build`                                                                                                      | Exit 0   |
| 4   | Unit tests pass              | `npm run test:unit`                                                                                                  | Exit 0   |

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                             |
| -------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Renaming changes runtime behavior                  | NONE       | NONE   | Variable renaming has zero runtime effect                              |
| Added logWarn calls produce excessive output       | LOW        | LOW    | Only ~2-5 catch blocks elevated to logger calls (Tier 3)               |
| Incorrect tier assignment (should log but renamed) | LOW        | MEDIUM | Review during PR; Tier 3 candidates are hardware/DB/network operations |

## Success Criteria

- [ ] All 478 unnamed-but-unused catch variables either renamed to `_error`/`_e`/`_err` or converted to logger calls
- [ ] Every renamed variable has a comment explaining why the error is ignored (Tier 2)
- [ ] ESLint `no-unused-vars` reports zero catch-related violations
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.1 (Logger must be available for Tier 3 catch blocks)
- **Depended on by**: Phase 3.3.6 (ESLint Rule Additions)
- **Related**: Phase 3.3.2 (Promise Chain Silent Swallowing) -- addresses `.catch(() => {})` pattern
- **Related**: Phase 3.4.5 (Unsafe Error Cast Pattern Fix) -- addresses `(error as Error).message`
- **Related**: Phase 2.2.1 (Swallowed Error Remediation) -- addresses 39 exact-match `.catch(() => {})` patterns in Phase 2

## Execution Tracking

| Batch | Description           | Files | Status  | Started | Completed | Verified By |
| ----- | --------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1     | Top 14 files (server) | ~14   | PENDING | --      | --        | --          |
| 2     | API routes            | ~15   | PENDING | --      | --        | --          |
| 3     | Services              | ~15   | PENDING | --      | --        | --          |
| 4     | Stores/components     | ~13   | PENDING | --      | --        | --          |
| 5     | Pages                 | ~13   | PENDING | --      | --        | --          |
