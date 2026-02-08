# Phase 4.5.4: Enable noImplicitOverride

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT OOP51-CPP (do not slice derived objects), MISRA Rule 10.2 (override specifier), BARR-C Rule 1.7 (resolve all warnings), NASA/JPL Rule 16 (use explicit modifiers)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 4 -- Type Safety, Dead Code Elimination, and Compiler Strictness
**Sub-Phase**: 4.5 -- ESLint and Compiler Strictness Escalation
**Task ID**: 4.5.4
**Risk Level**: LOW -- Mechanical fix (add `override` keyword)
**Prerequisites**: Task 4.5.0 (green baseline), Task 4.5.3 (noFallthrough/noImplicitReturns enabled)
**Blocks**: Task 4.5.5 (noUncheckedIndexedAccess evaluation)
**Estimated Duration**: 30 minutes
**Estimated Files Touched**: 1 (tsconfig.json) + class files with method overrides
**Standards**: CERT OOP51-CPP, MISRA Rule 10.2, BARR-C Rule 1.7, NASA/JPL Rule 16

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Phase        | 4.5                                                |
| Task         | 4.5.4                                              |
| Title        | Enable noImplicitOverride                          |
| Status       | PLANNED                                            |
| Risk Level   | LOW                                                |
| Duration     | 30 minutes                                         |
| Dependencies | Task 4.5.0, Task 4.5.3                             |
| Branch       | `agent/alex/phase-4.5-eslint-compiler-strictness`  |
| Commit       | `chore: enable noImplicitOverride compiler option` |

---

## Objective

Require explicit `override` keyword when overriding class methods. This prevents accidental name collisions and makes inheritance chains auditable. When a parent class changes its method signature, all child classes that override the method will produce compile errors, preventing silent behavioral changes.

**Note**: Tasks 4.5.3 and 4.5.4 are independent and can run in parallel.

## Current State Assessment

| Metric                                      | Current State                | Target State            |
| ------------------------------------------- | ---------------------------- | ----------------------- |
| `noImplicitOverride` in tsconfig.json       | NOT configured               | `true`                  |
| Class declarations using `extends`          | Unknown (measured in Step 1) | All overrides annotated |
| Override methods without `override` keyword | Unknown (measured in Step 1) | 0                       |

---

## Execution Steps

### Step 1: Impact Assessment

```bash
# Count class declarations that extend other classes
grep -rn 'class\s\+\w\+\s\+extends' --include='*.ts' src/ | wc -l

# Count method declarations in extending classes
# These will need `override` keyword if they override parent methods
grep -rn 'class\s\+\w\+\s\+extends' --include='*.ts' src/
```

Review each extending class to identify which methods override parent class methods.

### Step 2: Enable Compiler Option

Add to `tsconfig.json` compilerOptions:

```json
"noImplicitOverride": true
```

### Step 3: Run svelte-check to Identify Failures

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "override" | head -20
```

### Step 4: Fix Failures

For each error, add the `override` keyword before the method declaration:

```typescript
// BEFORE (flagged by noImplicitOverride):
class Child extends Parent {
  doWork() { ... }
}

// AFTER (fixed):
class Child extends Parent {
  override doWork() { ... }
}
```

For property overrides:

```typescript
// BEFORE:
class Child extends Parent {
	name = 'child';
}

// AFTER:
class Child extends Parent {
	override name = 'child';
}
```

### Step 5: Verify Zero Errors

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -1
# Expected: 0 errors
```

---

## Verification

| #   | Check                         | Command                                                       | Expected                         |
| --- | ----------------------------- | ------------------------------------------------------------- | -------------------------------- |
| 1   | noImplicitOverride enabled    | `grep "noImplicitOverride" tsconfig.json`                     | `"noImplicitOverride": true`     |
| 2   | svelte-check 0 errors         | `npx svelte-check --tsconfig ./tsconfig.json 2>&1 \| tail -1` | `0 errors`                       |
| 3   | Build succeeds                | `npm run build`                                               | Exit 0                           |
| 4   | Unit tests pass               | `npm run test:unit`                                           | Exit 0                           |
| 5   | All override keywords present | `grep -rn 'override ' --include='*.ts' src/ \| wc -l`         | Count matches expected overrides |

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                            |
| -------------------------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Missing `override` keyword on non-override methods | LOW        | LOW    | TypeScript only flags actual overrides                |
| Few class hierarchies means low impact             | HIGH       | NONE   | Proportionally fast task                              |
| Third-party class extensions (e.g., Leaflet)       | LOW        | LOW    | `skipLibCheck: true` prevents .d.ts validation issues |

## Rollback Strategy

```bash
# Remove noImplicitOverride from tsconfig.json
# Remove all added `override` keywords from source files
git checkout tsconfig.json
git checkout src/
```

## Standards Traceability

| Standard | Rule      | Requirement                                  | How This Task Satisfies It                             |
| -------- | --------- | -------------------------------------------- | ------------------------------------------------------ |
| CERT     | OOP51-CPP | Prevent implicit override behavior           | noImplicitOverride forces explicit `override` keyword  |
| MISRA    | Rule 10.2 | Use override specifier on overriding methods | Compiler enforces `override` on all overriding methods |
| BARR-C   | Rule 1.7  | Resolve all compiler warnings                | Another strictness option enabled                      |
| NASA/JPL | Rule 16   | Use explicit modifiers                       | Override modifier made mandatory                       |

## Commit Message

```
chore: enable noImplicitOverride compiler option
```

## Execution Tracking

| Step | Description                                      | Status  | Started | Completed | Verified By |
| ---- | ------------------------------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Impact assessment (count class extends)          | PENDING | --      | --        | --          |
| 2    | Enable noImplicitOverride in tsconfig.json       | PENDING | --      | --        | --          |
| 3    | Identify failures                                | PENDING | --      | --        | --          |
| 4    | Add `override` keyword to all overriding methods | PENDING | --      | --        | --          |
| 5    | Verify zero errors                               | PENDING | --      | --        | --          |
