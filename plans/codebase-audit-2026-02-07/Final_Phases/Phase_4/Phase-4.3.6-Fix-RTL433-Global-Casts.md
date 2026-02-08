# Phase 4.3.6: Fix RTL-433 Global Casts

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL30-C (declare variable with correct type), CERT ENV33-C (do not call system() with untrusted data), BARR-C Rule 1.3 (braces), NASA/JPL Rule 3 (no dynamic memory after init)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Phase**        | 4 -- Type Safety Hardening                                         |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                      |
| **Task ID**      | 4.3.6                                                              |
| **Title**        | Fix RTL-433 Global Casts                                           |
| **Status**       | PLANNED                                                            |
| **Risk Level**   | MEDIUM -- `globalThis` declaration affects TypeScript global scope |
| **Duration**     | 20 minutes                                                         |
| **Dependencies** | None (independent of other 4.3.x tasks)                            |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation)                  |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                             |
| **Commit**       | `fix(types): type RTL-433 global state and process variable`       |
| **Standards**    | CERT DCL30-C, CERT ENV33-C, BARR-C Rule 1.3, NASA/JPL Rule 3       |

---

## Objective

Eliminate 7 `any` occurrences in `src/routes/api/rtl-433/control/+server.ts`, all related to storing data on the Node.js `global` object without type declarations.

**Result**: 7 `any` removed.

---

## Current State Assessment

### Problem Table

| Line | Code                                                                   |
| ---- | ---------------------------------------------------------------------- |
| 10   | `let rtl433Process: any = null;`                                       |
| 107  | `(global as any).rtl433Output = (global as any).rtl433Output \|\| [];` |
| 108  | `(global as any).rtl433Output.push({`                                  |
| 114  | `if ((global as any).rtl433Output.length > 100) {`                     |
| 115  | `(global as any).rtl433Output.shift();`                                |
| 127  | `(global as any).rtl433Output = (global as any).rtl433Output \|\| [];` |
| 128  | `(global as any).rtl433Output.push({`                                  |

**Total**: 7 `any` (1 variable declaration + 6 `global as any` casts across 4 lines)

---

## Execution Steps

### Step 1: Create Global Type Declaration

Add to `src/app.d.ts`. If the file already exists, append the `var rtl433Output` declaration inside the existing `declare global` block.

```typescript
// src/app.d.ts

// See https://kit.svelte.dev/docs/types#app
declare global {
	// RTL-433 global state
	var rtl433Output: Array<{ timestamp: string; data: string }> | undefined;
}

export {};
```

**Pre-check**: Verify whether `src/app.d.ts` already exists and contains a `declare global` block:

```bash
ls -la src/app.d.ts
grep -n 'declare global' src/app.d.ts
```

If the file exists with an existing `declare global` block, add only the `var rtl433Output` line inside it. Do NOT create a second `declare global` block.

### Step 2: Type the Process Variable

**BEFORE** (line 10):

```typescript
let rtl433Process: any = null;
```

**AFTER**:

```typescript
import type { ChildProcess } from 'child_process';
let rtl433Process: ChildProcess | null = null;
```

`ChildProcess` is the return type of `spawn()` from the `child_process` module, already imported on line 3.

### Step 3: Replace All `(global as any).rtl433Output` with `globalThis.rtl433Output`

**BEFORE** (lines 107-108):

```typescript
(global as any).rtl433Output = (global as any).rtl433Output || [];
(global as any).rtl433Output.push({
```

**AFTER**:

```typescript
globalThis.rtl433Output = globalThis.rtl433Output || [];
globalThis.rtl433Output.push({
```

**BEFORE** (lines 114-115):

```typescript
if ((global as any).rtl433Output.length > 100) {
    (global as any).rtl433Output.shift();
```

**AFTER**:

```typescript
if (globalThis.rtl433Output && globalThis.rtl433Output.length > 100) {
    globalThis.rtl433Output.shift();
```

**BEFORE** (lines 127-128):

```typescript
(global as any).rtl433Output = (global as any).rtl433Output || [];
(global as any).rtl433Output.push({
```

**AFTER**:

```typescript
globalThis.rtl433Output = globalThis.rtl433Output || [];
globalThis.rtl433Output.push({
```

---

## Verification

```bash
# 1. Zero any remaining
grep -n ': any\|as any' src/routes/api/rtl-433/control/+server.ts
# Expected: 0 matches

# 2. TypeScript compiles
npx tsc --noEmit 2>&1 | grep 'rtl-433'
# Expected: 0 errors

# 3. Global declaration resolves
npx tsc --noEmit 2>&1 | grep 'rtl433Output'
# Expected: 0 errors

# 4. No other files also set rtl433Output
grep -rn 'rtl433Output' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules src/
# Expected: only rtl-433/control/+server.ts and app.d.ts
```

---

## Risk Assessment

| Risk                                      | Likelihood | Impact | Mitigation                                |
| ----------------------------------------- | ---------- | ------ | ----------------------------------------- |
| Other files also set `rtl433Output`       | LOW        | MEDIUM | Grep for all `rtl433Output` references    |
| `app.d.ts` already has conflicting global | LOW        | LOW    | Pre-check existing `declare global` block |
| `ChildProcess` import conflicts           | LOW        | LOW    | Type import only; no runtime effect       |

---

## Rollback Strategy

```bash
git checkout -- src/routes/api/rtl-433/control/+server.ts
# If app.d.ts was modified (not created):
git checkout -- src/app.d.ts
# If app.d.ts was created new:
rm src/app.d.ts
```

---

## Standards Traceability

| Standard        | Rule         | Applicability                                                |
| --------------- | ------------ | ------------------------------------------------------------ |
| CERT DCL30-C    | Correct type | `ChildProcess` replaces `any` for process variable           |
| CERT ENV33-C    | System data  | Typed global state prevents uncontrolled data shape mutation |
| BARR-C Rule 1.3 | Braces       | Global type declaration uses proper syntax                   |
| NASA/JPL Rule 3 | Dynamic mem  | Global array typed and bounded (length > 100 check retained) |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.7 and Task 4.3.2c
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (ESLint escalation)
