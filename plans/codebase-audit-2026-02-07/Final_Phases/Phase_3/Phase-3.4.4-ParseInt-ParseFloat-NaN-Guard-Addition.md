# Phase 3.4.4: ParseInt/ParseFloat NaN Guard Addition

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: CERT INT09-C (ensure integers do not have unintended wraparound), CERT INT04-C (enforce limits on integer values), MISRA Rule 21.8 (no undefined behavior from invalid input)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.4
**Risk Level**: LOW-MEDIUM -- Adding guards to existing parse calls; may expose latent NaN propagation
**Prerequisites**: Phase 3.4.0 (assertFiniteNumber utility), Phase 3.2 (BUFFER_LIMITS and other named constants for default fallback values)
**Blocks**: None
**Estimated Files Touched**: 46
**Standards**: CERT INT09-C (always specify radix), CERT INT04-C (enforce limits), MISRA Rule 21.8 (no undefined behavior)

---

## Objective

Add `isNaN` guards to 96 unguarded `parseInt`/`parseFloat` calls across 46 files. When input is not a valid number, `NaN` currently propagates silently through arithmetic and into database queries, producing corrupt data. Additionally, ensure all `parseInt` calls specify radix 10 per CERT INT09-C.

## Current State Assessment

| Metric                                   | Verified Value                    | Target |
| ---------------------------------------- | --------------------------------- | ------ |
| Total `parseInt`/`parseFloat` calls      | 126                               | 126    |
| Calls WITH `isNaN` guard                 | 30                                | 126    |
| Calls WITHOUT `isNaN` guard              | 96                                | 0      |
| `parseInt` calls without radix parameter | Unknown (audit at execution time) | 0      |
| Files containing unguarded parse calls   | 46                                | 0      |

## Scope

### Strategy: 3 Fix Patterns

For each of the 96 unguarded `parseInt`/`parseFloat` calls, apply one of three patterns:

#### Pattern 1: Default Fallback (most common)

When the value has a sensible default (e.g., page size, limit, timeout):

```typescript
// BEFORE:
const limit = parseInt(url.searchParams.get('limit') || '1000');

// AFTER:
const rawLimit = parseInt(url.searchParams.get('limit') || '1000', 10);
const limit = Number.isFinite(rawLimit) ? rawLimit : BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT;
```

#### Pattern 2: Assertion (for values that must be valid)

When NaN indicates a bug that should fail loudly (e.g., frequency, coordinates):

```typescript
// BEFORE:
const freq = parseFloat(body.frequency);

// AFTER:
const freq = parseFloat(body.frequency);
assertFiniteNumber(freq, 'frequency');
```

#### Pattern 3: Radix-Only Fix

When the parse call already has an `isNaN` guard but is missing the radix parameter:

```typescript
// BEFORE (CERT INT09-C violation):
parseInt(value);

// AFTER:
parseInt(value, 10);
```

### CERT INT09-C: Always Specify Radix 10

Every `parseInt` call must specify radix 10. Without it, strings with leading zeros (e.g., `"010"`) are parsed as octal in some environments. While modern ECMAScript defaults to base 10, CERT INT09-C requires explicit specification for code clarity and portability.

### Discovery Commands

Execute at task start to enumerate all instances:

```bash
# All parseInt/parseFloat calls:
grep -rn "parseInt\|parseFloat" src/ --include="*.ts" --include="*.svelte" | wc -l

# parseInt calls without radix parameter:
grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" | grep -v ', 10' | grep -v ', 16'

# parseFloat calls without isNaN guard (heuristic -- manual review required):
grep -rn "parseFloat" src/ --include="*.ts" --include="*.svelte" | grep -v "isNaN\|isFinite\|assert"
```

## Execution Steps

### Step 1: Enumerate All 96 Unguarded Instances

```bash
grep -rn "parseInt\|parseFloat" src/ --include="*.ts" --include="*.svelte" | wc -l
# Total should be ~126

# Cross-reference with guarded instances:
grep -rn "parseInt\|parseFloat" src/ --include="*.ts" --include="*.svelte" | grep "isNaN\|isFinite\|assert" | wc -l
# Guarded should be ~30
```

### Step 2: Categorize Each Instance

For each of the 96 unguarded calls, determine which pattern applies:

- **Pattern 1** (default fallback): URL params, config values, page numbers, limits
- **Pattern 2** (assertion): Frequencies, coordinates, power levels, critical measurements
- **Pattern 3** (radix-only): Already guarded but missing radix 10

### Step 3: Apply Fixes in Batches

Process files in groups:

- Batch 1: API routes (`src/routes/api/`) -- highest risk
- Batch 2: Server layer (`src/lib/server/`)
- Batch 3: Services (`src/lib/services/`)
- Batch 4: Client-side pages and components

### Step 4: Verify Zero Unguarded parseInt Without Radix

```bash
grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" | grep -v ', 10' | grep -v ', 16' | wc -l
# Target: 0
```

### Step 5: Run Full Verification

```bash
npm run typecheck  # Must pass
npm run test:unit  # Must pass
npm run build      # Must pass
```

## Commit Message

```
fix(validation): add isNaN guards to 96 unguarded parseInt/parseFloat calls across 46 files
```

## Verification

| #   | Check                     | Command                                                                                                      | Expected |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | No parseInt without radix | `grep -Prn 'parseInt\([^,)]+\)' src/ --include="*.ts" \| grep -v ', 10' \| grep -v ', 16' \| wc -l`          | 0        |
| 2   | No unguarded parseFloat   | `grep -rn "parseFloat" src/ --include="*.ts" \| grep -v "isNaN\|isFinite\|assert\|Number.isFinite" \| wc -l` | 0        |
| 3   | TypeScript compiles       | `npm run typecheck`                                                                                          | Exit 0   |
| 4   | Build succeeds            | `npm run build`                                                                                              | Exit 0   |
| 5   | Unit tests pass           | `npm run test:unit`                                                                                          | Exit 0   |

## Risk Assessment

| Risk                                                  | Likelihood | Impact   | Mitigation                                                                                                                                |
| ----------------------------------------------------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| parseInt radix change alters parsing                  | VERY LOW   | LOW      | Specifying radix 10 only affects strings with leading zeros (e.g., "010"). No frequency or port values in this system have leading zeros. |
| Default fallback hides real input errors              | LOW        | LOW      | Default values are from named constants (Phase 3.2), not magic numbers. Logging can be added for fallback cases.                          |
| assertFiniteNumber throws for previously-accepted NaN | MEDIUM     | MEDIUM   | This is the intended behavior -- NaN propagation is a bug. Assertions reveal the source of corrupt data.                                  |
| Performance overhead from isNaN checks                | VERY LOW   | VERY LOW | `isNaN` and `Number.isFinite` are single-instruction operations; negligible overhead.                                                     |

## Success Criteria

- [ ] All 96 unguarded `parseInt`/`parseFloat` calls now have NaN guards
- [ ] All `parseInt` calls specify radix 10 (CERT INT09-C)
- [ ] Pattern 1 instances use named constants from Phase 3.2 for defaults
- [ ] Pattern 2 instances use `assertFiniteNumber` from Phase 3.4.0
- [ ] Zero instances of `parseInt(value)` without radix parameter
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Unit tests pass

## Cross-References

- **Depends on**: Phase 3.4.0 (assertFiniteNumber utility must exist for Pattern 2)
- **Depends on**: Phase 3.2 (BUFFER_LIMITS and other named constants for Pattern 1 default values)
- **Depended on by**: Nothing
- **Related**: Phase 3.4.3 (Zod Schema Validation) -- Zod validates API input at the boundary; NaN guards validate after parsing
- **Related**: Phase 3.4.1 (Critical Function Assertions) -- assertion-based guards for domain-critical values

## Execution Tracking

| Step | Description                    | Status  | Started | Completed | Verified By |
| ---- | ------------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Enumerate all 96 instances     | PENDING | --      | --        | --          |
| 2    | Categorize by pattern          | PENDING | --      | --        | --          |
| 3    | Apply fixes (4 batches)        | PENDING | --      | --        | --          |
| 4    | Verify zero unguarded parseInt | PENDING | --      | --        | --          |
| 5    | Run full verification          | PENDING | --      | --        | --          |
