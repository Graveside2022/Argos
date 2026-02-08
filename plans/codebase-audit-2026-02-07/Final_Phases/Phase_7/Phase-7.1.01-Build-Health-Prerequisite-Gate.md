# Phase 7.1.01: Build Health Prerequisite Gate

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Task 7.1.0)
**Risk Level**: LOW -- Diagnostic only. No production code modified.
**Prerequisites**: None. This is the absolute first gate for all Phase 7 work.
**Estimated Duration**: 15-60 minutes (depending on current failure count)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Phase 7 culminates in Phase 7.6 (Verification Suite), which requires `npm run build`, `npm run typecheck`, and `npm run test:unit` to pass as gate checks. If these are broken at the START of Phase 7, every verification gate downstream is meaningless -- you cannot verify a migration succeeded against a baseline that was already failing.

This gate ensures the codebase is in a known-good state before any migration work begins. It is a HARD BLOCKER. No Phase 7 sub-task may proceed until all three checks pass.

---

## Task Description

Before any Phase 7 work begins, the following three prerequisites MUST be verified:

### Gate 1: Production Build

```bash
cd /home/kali/Documents/Argos/Argos && npm run build
```

**Current known failure**: Build fails due to MCP SDK import error in `src/routes/api/agent/stream/+server.ts`.

**Expected outcome**: Build completes with exit code 0 and no errors.

### Gate 2: TypeScript Type Checking

```bash
cd /home/kali/Documents/Argos/Argos && npm run typecheck
```

**Current known failure count**: 111 errors in 74 files (as of 2026-02-08).

**Expected outcome**: Zero type errors reported.

### Gate 3: Unit Test Suite

```bash
cd /home/kali/Documents/Argos/Argos && npm run test:unit
```

**Current known failure count**: 44 test failures (as of 2026-02-08).

**Expected outcome**: All tests pass with exit code 0.

### Failure Resolution Protocol

If any prerequisite fails, resolve it before proceeding with Phase 7.1. The resolution approach depends on the failure type:

1. **Build failure** (MCP SDK import): Either fix the import or conditionally exclude the file from the build. This is likely the fastest to resolve.
2. **Typecheck errors** (111 errors): Categorize errors by type. Many may stem from a single root cause (e.g., missing type definitions, stale imports). Fix in batch where possible.
3. **Test failures** (44 failures): Run `npm run test:unit -- --reporter=verbose` to identify failure clusters. Prioritize failures in modules that Phase 7 will touch (hackrf, rf_workflows, sweep-manager).

**IMPORTANT**: Fixes applied here must NOT alter the behavior of any code that Phase 7 migrates. Type annotation changes and test fixture updates are acceptable. Logic changes are NOT -- those belong in separate pre-Phase-7 remediation commits.

---

## Verification Commands

### Verify all three gates pass

```bash
# Gate 1: Build
cd /home/kali/Documents/Argos/Argos && npm run build 2>&1 | tail -5
echo "Build exit code: $?"

# Gate 2: Typecheck
cd /home/kali/Documents/Argos/Argos && npm run typecheck 2>&1 | tail -5
echo "Typecheck exit code: $?"

# Gate 3: Tests
cd /home/kali/Documents/Argos/Argos && npm run test:unit 2>&1 | tail -20
echo "Test exit code: $?"
```

### Capture current failure counts (run BEFORE attempting fixes)

```bash
# Record exact typecheck error count
cd /home/kali/Documents/Argos/Argos && npm run typecheck 2>&1 | grep -c "error TS"

# Record exact test failure count
cd /home/kali/Documents/Argos/Argos && npm run test:unit 2>&1 | grep -E "Tests\s+[0-9]+ failed"
```

---

## Verification Checklist

- [ ] `npm run build` completes with exit code 0
- [ ] `npm run typecheck` reports 0 errors
- [ ] `npm run test:unit` reports 0 failures
- [ ] No behavioral changes were made to hackrf_emitter/ or rf_workflows/ code
- [ ] All fixes committed with clear commit messages referencing Phase 7.1.01

---

## Definition of Done

This gate is satisfied when all three commands (`npm run build`, `npm run typecheck`, `npm run test:unit`) exit with code 0 on a clean working tree. The exact error counts at the time of resolution must be recorded in a commit message for audit traceability.

---

## Cross-References

- **Required by**: ALL subsequent Phase 7.1 sub-tasks (Phase-7.1.02 through Phase-7.1.07)
- **Required by**: Phase-7.6-VERIFICATION-SUITE.md (verification gates depend on build/typecheck/test health)
- **Rationale documented in**: Phase-7.1-PRE-MIGRATION-BASELINE.md, Task 7.1.0
