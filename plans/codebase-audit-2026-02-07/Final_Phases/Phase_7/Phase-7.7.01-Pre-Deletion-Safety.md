# Phase 7.7.01: Pre-Deletion Safety

**Decomposed from**: Phase-7.7-DELETION-CLEANUP.md (Tasks 7.7.1 and 7.7.2)
**Risk Level**: HIGH -- Establishes the safety net for all subsequent irreversible deletion operations.
**Prerequisites**: Phase 7.6 ALL gates passed (every test green)
**Estimated Duration**: 15 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Establish the safety infrastructure for the irreversible deletion of the Python backend and React
frontend. This sub-task creates the git rollback tag and re-verifies ALL Phase 7.6 gates immediately
before any files are removed. If any verification fails, the entire Phase 7.7 sequence MUST abort.

---

## CORRECTED DELETION METRICS

The original Phase 7 plan contained the following false claims about deletion scope. These corrections
were verified against the live codebase on 2026-02-08.

| Metric               | Original Claim      | Actual Value                              | Correction          |
| -------------------- | ------------------- | ----------------------------------------- | ------------------- |
| Startup script lines | ~19,000             | 689 (start.sh=495, start_services.sh=194) | 27.6x overstatement |
| Total lines removed  | ~30,000+            | ~12,182 hand-written lines                | 2.5x overstatement  |
| Files deleted        | ~25                 | 45 project files (excl. vendored)         | 1.8x understatement |
| Dockerfile target    | "docker/Dockerfile" | `hackrf_emitter/backend/Dockerfile`       | Wrong file          |

### Corrected Deletion Inventory

| Category                | Files   | Lines                                       |
| ----------------------- | ------- | ------------------------------------------- |
| Python backend (.py)    | 21      | 7,913                                       |
| React frontend (src/)   | 12      | 2,304                                       |
| Shell scripts           | 3       | 723                                         |
| Documentation           | 2       | 661                                         |
| Configuration           | 6       | 433                                         |
| Frontend config/build   | 5       | 17,830 (mostly generated package-lock.json) |
| Backend non-code        | 5       | 230                                         |
| **Total project files** | **45**  | **~29,990**                                 |
| **Total hand-written**  | **~40** | **~12,182**                                 |

**NOTE**: The original plan stated `config/settings.json` does not exist. This is INCORRECT.
The file `hackrf_emitter/backend/config/settings.json` DOES exist (62 lines) and must be deleted
as part of the Python backend removal in Phase-7.7.02. The config/ directory adds 1 file and
62 lines to the backend deletion totals. The inventory above already accounts for this in the
"Configuration" category.

---

## Task 7.7.1: Create Git Tag

**This MUST execute before any file deletion. No exceptions.**

The git tag serves as the single emergency rollback point for the entire Phase 7.7 deletion
sequence. Without this tag, recovery from a botched deletion requires manual `git reflog` archaeology.

```bash
# Tag the last commit containing Python code
git tag -a pre-python-removal -m "Last commit containing hackrf_emitter Python backend and React frontend. Restore with: git checkout pre-python-removal -- hackrf_emitter/"

# Verify tag exists
git tag -l 'pre-python-removal'

# Verify tag points to current HEAD
git show pre-python-removal --stat | head -5

# Verify tag is annotated (not lightweight)
git cat-file -t pre-python-removal
# Expected output: tag
```

**IMPORTANT**: The tag must be created AFTER all pending commits are complete. Do NOT create
the tag and then make additional commits before deletion -- the tag would miss those commits,
making rollback incomplete.

### Tag Verification Commands

```bash
# Verify the tag contains hackrf_emitter
git ls-tree -r --name-only pre-python-removal | grep hackrf_emitter | head -5
# Must show hackrf_emitter files

# Verify the tag commit matches current HEAD
git log --oneline -1 pre-python-removal
git log --oneline -1 HEAD
# Both should show the same commit hash
```

---

## Task 7.7.2: Final Gate Verification

Re-run ALL Phase 7.6 gates one final time immediately before deletion. This is the last
opportunity to abort. The gates verify that the TypeScript replacement is fully functional
and the Python backend can be safely removed.

```bash
# Gate 1: Unit tests
npm run test:unit -- tests/unit/hackrf/ --reporter=verbose

# Gate 2: Integration tests
npm run test:integration -- tests/integration/hackrf-transmit.test.ts

# Gate 3: Type check (full project)
npm run typecheck

# Gate 4: Production build
npm run build
```

### ABORT RULE

**If ANY of the four gate commands above exits with a non-zero status code, ABORT the entire
Phase 7.7 deletion sequence. Do NOT proceed to Phase-7.7.02. Do NOT delete any files.**

Failure at this stage means the TypeScript replacement has a regression that was not caught
during Phase 7.6, or an environmental change has introduced a new failure. Diagnose and fix
the failure, then re-run ALL four gates from the beginning.

---

## Verification Checklist

- [ ] Git tag `pre-python-removal` created with annotated message
- [ ] Tag verified to point at current HEAD (same commit hash)
- [ ] Tag verified to be annotated type (not lightweight)
- [ ] Tag contains hackrf_emitter files (verified via `git ls-tree`)
- [ ] Gate 1: Unit tests pass (exit code 0)
- [ ] Gate 2: Integration tests pass (exit code 0)
- [ ] Gate 3: Type check passes (exit code 0)
- [ ] Gate 4: Build succeeds (exit code 0)
- [ ] No pending uncommitted changes exist (`git status` clean)
- [ ] Operator confirms readiness to proceed with irreversible deletion

---

## Definition of Done

This sub-task is complete when:

1. The git tag `pre-python-removal` exists and points to the current HEAD commit
2. All four Phase 7.6 gates pass with zero failures
3. The operator has explicitly confirmed readiness to proceed

---

## Cross-References

- **Next**: Phase-7.7.02-File-Deletion-Sequence.md (begins actual deletion)
- **Rollback**: Phase-7.7.05-Post-Deletion-Verification.md (rollback procedure)
- **Gate Definitions**: Phase-7.6-VERIFICATION-SUITE.md
- **Parent**: Phase-7.7-DELETION-CLEANUP.md
