# Phase 4.5.5: Evaluate noUncheckedIndexedAccess

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ARR30-C (do not form out-of-bounds pointers), MISRA Rule 18.1 (bounds of array access), BARR-C Rule 1.7 (resolve all warnings), NASA/JPL Rule 25 (validate array bounds)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.5 (EVALUATION GATE)
**Risk Level**: EVALUATION ONLY -- No production changes unless impact is manageable
**Prerequisites**: Task 4.5.3 (noFallthrough/noImplicitReturns), Task 4.5.4 (noImplicitOverride)
**Blocks**: Task 4.5.6 (Type-Checked Linting)
**Estimated Duration**: 1 hour (evaluation only)
**Estimated Files Touched**: 0 (evaluation) or 1 (tsconfig.json) + affected source files
**Standards**: CERT ARR30-C, MISRA Rule 18.1, BARR-C Rule 1.7, NASA/JPL Rule 25

| Field        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Phase        | 4.5                                                        |
| Task         | 4.5.5                                                      |
| Title        | Evaluate noUncheckedIndexedAccess                          |
| Status       | PLANNED                                                    |
| Risk Level   | EVALUATION ONLY (HIGH if enabling)                         |
| Duration     | 1 hour                                                     |
| Dependencies | Task 4.5.3, Task 4.5.4                                     |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`          |
| Commit       | See Decision Criteria below (depends on evaluation result) |

---

## Objective

Evaluate whether enabling `noUncheckedIndexedAccess` is feasible. This TypeScript compiler option adds `| undefined` to every index access (array subscripts, object bracket notation, Map/Set access), catching potential runtime errors but requiring extensive null guards. This is the most impactful strictness option available and may require deferral to a dedicated phase.

## Current State Assessment

| Metric                              | Current State                   | Target State                         |
| ----------------------------------- | ------------------------------- | ------------------------------------ |
| `noUncheckedIndexedAccess`          | NOT configured in tsconfig.json | Evaluated; enable or defer with data |
| Array/object index accesses         | Unknown (measured in trial run) | All guarded if enabled               |
| Runtime undefined-from-index errors | Likely present but undetected   | Prevented at compile time if enabled |

---

## Execution Steps

### Step 1: Trial Run

```bash
# Backup current config
cp tsconfig.json tsconfig.json.bak
```

### Step 2: Temporarily Add Option

Edit `tsconfig.json` to add `noUncheckedIndexedAccess: true` in compilerOptions:

```json
"noUncheckedIndexedAccess": true
```

### Step 3: Count New Errors

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
# Record the new error count
```

Capture full error list for analysis:

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 > plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/noUncheckedIndexedAccess-trial.txt
```

### Step 4: Restore Original Config

```bash
mv tsconfig.json.bak tsconfig.json
```

### Step 5: Apply Decision Criteria

| New Errors | Decision                                                       |
| ---------- | -------------------------------------------------------------- |
| < 20       | ENABLE -- fix all errors in this task                          |
| 20-50      | DEFER -- create separate Phase 4.6 plan                        |
| > 50       | DEFER -- too many changes for this phase, track as future work |

### Step 6a: If ENABLING (< 20 new errors)

Re-add the option to `tsconfig.json`:

```json
"noUncheckedIndexedAccess": true
```

Fix each error by adding null checks:

```typescript
// BEFORE (flagged -- array[index] is now T | undefined):
const item = array[index];
item.process(); // Error: Object is possibly 'undefined'

// AFTER (fixed -- null guard):
const item = array[index];
if (item) {
	item.process();
}
```

Alternative patterns:

```typescript
// Non-null assertion (use ONLY when index is provably in bounds):
const item = array[index]!;

// Optional chaining:
const result = array[index]?.process();

// Nullish coalescing with default:
const item = array[index] ?? defaultValue;
```

**Commit message (if enabling)**:

```
chore: enable noUncheckedIndexedAccess with null guards
```

### Step 6b: If DEFERRING (>= 20 new errors)

Do NOT modify `tsconfig.json`. Record the evaluation result:

**Commit message (if deferring)**:

```
docs: evaluate noUncheckedIndexedAccess -- deferred (N errors)
```

Create a tracking note in the trial output file with:

- Number of new errors
- Decision: DEFER
- Estimated effort to fix
- Recommended phase for enablement

### Step 7: Documentation

Regardless of the decision, record the evaluation result in:

1. The trial output file (`noUncheckedIndexedAccess-trial.txt`)
2. The commit message
3. A summary line in the Phase 4.5 master index

---

## Verification

### If ENABLED

| #   | Check                            | Command                                                       | Expected                           |
| --- | -------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| 1   | noUncheckedIndexedAccess enabled | `grep "noUncheckedIndexedAccess" tsconfig.json`               | `"noUncheckedIndexedAccess": true` |
| 2   | svelte-check 0 errors            | `npx svelte-check --tsconfig ./tsconfig.json 2>&1 \| tail -1` | `0 errors`                         |
| 3   | Build succeeds                   | `npm run build`                                               | Exit 0                             |
| 4   | Unit tests pass                  | `npm run test:unit`                                           | Exit 0                             |

### If DEFERRED

| #   | Check                   | Command                                                                                                            | Expected |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | tsconfig.json unchanged | `grep "noUncheckedIndexedAccess" tsconfig.json \| wc -l`                                                           | 0        |
| 2   | Trial output recorded   | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/noUncheckedIndexedAccess-trial.txt && echo "exists"` | `exists` |
| 3   | Build still passes      | `npm run build`                                                                                                    | Exit 0   |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| >50 errors make enablement impractical                   | HIGH       | NONE   | Evaluation-only task; no forced changes                  |
| Null guards add verbosity and reduce readability         | MEDIUM     | LOW    | Use optional chaining (`?.`) where appropriate           |
| Performance overhead from additional runtime null checks | LOW        | LOW    | Null checks are nearly zero-cost in V8                   |
| False sense of safety with `!` non-null assertions       | MEDIUM     | MEDIUM | Phase 4.5.2 escalates `no-non-null-assertion` to `error` |

## Rollback Strategy

### If ENABLED

```bash
# Remove noUncheckedIndexedAccess from tsconfig.json
# Revert null guard additions (the guards are harmless but can be reverted for clarity)
git revert <commit-hash>
```

### If DEFERRED

No rollback needed -- no changes were made.

## Standards Traceability

| Standard | Rule      | Requirement                            | How This Task Satisfies It                                |
| -------- | --------- | -------------------------------------- | --------------------------------------------------------- |
| CERT     | ARR30-C   | Do not form out-of-bounds pointers     | noUncheckedIndexedAccess forces bounds awareness          |
| MISRA    | Rule 18.1 | Bounds of array access must be checked | Compiler treats all index access as potentially undefined |
| BARR-C   | Rule 1.7  | Resolve all compiler warnings          | Evaluation ensures informed decision on enablement        |
| NASA/JPL | Rule 25   | Validate array bounds before access    | TypeScript type system enforces undefined-awareness       |

---

## Appendix A: exactOptionalPropertyTypes Evaluation (Deferred)

`exactOptionalPropertyTypes` is the strictest TypeScript option. It distinguishes between "property is `undefined`" and "property is absent." This is deferred because:

1. It requires changing every optional property access pattern
2. SvelteKit's generated types may not be compatible
3. The effort-to-benefit ratio is poor for a field-deployed application

This should be revisited only after all other strictness options are stable. It is NOT part of the Phase 4.5 scope and is tracked as a future consideration.

**Relationship to noUncheckedIndexedAccess**: Both options deal with `undefined` awareness, but `exactOptionalPropertyTypes` is significantly more invasive because it affects every `?:` optional property in every interface and type definition, including SvelteKit framework types.

## Execution Tracking

| Step | Description                              | Status  | Started | Completed | Verified By |
| ---- | ---------------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Backup tsconfig.json                     | PENDING | --      | --        | --          |
| 2    | Add noUncheckedIndexedAccess temporarily | PENDING | --      | --        | --          |
| 3    | Count new errors                         | PENDING | --      | --        | --          |
| 4    | Restore original tsconfig.json           | PENDING | --      | --        | --          |
| 5    | Apply decision criteria                  | PENDING | --      | --        | --          |
| 6    | Fix errors OR document deferral          | PENDING | --      | --        | --          |
| 7    | Record evaluation result                 | PENDING | --      | --        | --          |
