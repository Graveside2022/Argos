# Phase 5.3.6: Dead Example/Test File Deletion

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.7 (no dead code in production), MISRA C:2012 Rule 2.2 (no dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.6
**Risk Level**: LOW -- Deleting files with zero import references
**Prerequisites**: Tasks 5.3.3 and 5.3.4 (runtime violation fixes) complete (ensures no new references were accidentally created to these files)
**Blocks**: Task 5.3.7 (deleted file verification)
**Estimated Files Touched**: 2 (both deleted)
**Standards**: BARR-C Rule 8.7, MISRA C:2012 Rule 2.2

---

## Objective

Delete 2 dead example/test files from the WebSocket service directory. These files contain store imports but are not imported by any production module. Their presence inflates the store-service violation count and leaves non-production code in the repository that could confuse future auditors or be accidentally imported.

---

## Current State

| File                                    | Reason for Deletion                                            | Store Imports              |
| --------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| `services/websocket/example-usage.ts`   | Example code, not imported by any production module            | Multi-store imports        |
| `services/websocket/test-connection.ts` | Test helper, not imported; contains commented-out store import | Commented-out store import |

### File Paths (Absolute)

- `src/lib/services/websocket/example-usage.ts`
- `src/lib/services/websocket/test-connection.ts`

---

## Pre-Deletion Verification

These commands MUST be executed and produce the expected results before deletion proceeds.

```bash
# Verify zero imports of example-usage.ts anywhere in the codebase
grep -rn "example-usage" src/ --include="*.ts" --include="*.svelte" --include="*.js"
# EXPECTED: 0 results (if any results appear, the file is referenced and must NOT be deleted)

# Verify zero imports of test-connection.ts anywhere in the codebase
grep -rn "test-connection" src/ --include="*.ts" --include="*.svelte" --include="*.js"
# EXPECTED: 0 results (if any results appear, the file is referenced and must NOT be deleted)

# Verify the files exist before attempting deletion
ls -la src/lib/services/websocket/example-usage.ts
ls -la src/lib/services/websocket/test-connection.ts
# EXPECTED: both files exist

# Check barrel exports -- verify these files are NOT exported from an index.ts
grep -rn "example-usage\|test-connection" src/lib/services/websocket/index.ts 2>/dev/null
# EXPECTED: 0 results or file not found (if index.ts doesn't exist)
```

**STOP GATE**: If any of the above commands produce unexpected results (non-zero matches for import references), do NOT proceed with deletion. Investigate the reference chain first.

---

## Execution Steps

### Step 1: Record File Contents for Audit Trail

Before deletion, record the file sizes and line counts:

```bash
wc -l src/lib/services/websocket/example-usage.ts
wc -l src/lib/services/websocket/test-connection.ts
```

### Step 2: Delete Files

```bash
git rm src/lib/services/websocket/example-usage.ts
git rm src/lib/services/websocket/test-connection.ts
```

### Step 3: Verify No Compilation Errors

```bash
# TypeScript must still compile
npx tsc --noEmit
# EXPECTED: 0 errors

# Build must succeed
npm run build
# EXPECTED: build succeeds with no import resolution errors
```

---

## Post-Deletion Verification

```bash
# Verify files are gone
ls src/lib/services/websocket/example-usage.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS: deleted"
ls src/lib/services/websocket/test-connection.ts 2>/dev/null && echo "FAIL: still exists" || echo "PASS: deleted"

# Verify the websocket directory still has its production files
ls -la src/lib/services/websocket/
# EXPECTED: other production files remain (e.g., websocket-client.ts, etc.)

# Verify TypeScript compilation
npx tsc --noEmit
# EXPECTED: 0 errors

# Verify build
npm run build
# EXPECTED: success
```

---

## Risk Assessment

### Risk 1: File Is Actually Referenced

**Probability**: LOW. Pre-deletion grep verification eliminates this risk.

**Mitigation**: The pre-deletion verification commands are a STOP GATE. If references are found, investigate before deleting.

### Risk 2: Barrel Export References

**Probability**: LOW. If an `index.ts` barrel in the websocket directory re-exports from these files, deletion breaks the barrel.

**Mitigation**: The pre-deletion verification includes a barrel export check.

### Rollback Strategy

```bash
# Restore both files from git history
git checkout HEAD -- \
  src/lib/services/websocket/example-usage.ts \
  src/lib/services/websocket/test-connection.ts
```

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: BARR-C Rule 8.7, MISRA C:2012 Rule 2.2_
_Classification: UNCLASSIFIED // FOUO_
