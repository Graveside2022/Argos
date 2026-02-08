# Phase 1.5: Root File and .gitignore Cleanup

**Task ID**: 1.5
**Risk Level**: ZERO
**Produces Git Commit**: Yes
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: NASA/JPL Rule 2 (all code must be traceable), Git best practices
**Audit Findings Resolved**: CE-5, MO-3, MO-4, NF-1
**Commit Message**: `cleanup(phase1.5): stage root file deletions, update .gitignore`

---

## Purpose

Stage 5 already-deleted root markdown files in git (currently showing as ` D` unstaged deletions), add a missing `.gitignore` pattern, and document the keep decision for `AGUI-QUICK-START.md`. This produces a clean `git status` with no lingering unstaged deletions.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] The 5 root files are already deleted from disk (showing as ` D` in git status)

---

## Subtask 1.5.1: Verify Current State

### Confirm Files Are Deleted From Disk But Unstaged

```bash
git status --short | grep "^ D"
```

**Expected output** (5 entries with ` D` prefix indicating unstaged deletion):

```
 D MEMORY_LEAK_FIXES_COMPLETE.md
 D SECURITY_AND_MEMORY_FIXES_PROGRESS.md
 D STABILITY-ANALYSIS-REPORT.md
 D TESTING_SUMMARY.md
 D TEST_RESULTS.md
```

**HALT condition**: If any of these files show a different status (e.g., `M` for modified), investigate. If a file is NOT showing as ` D`, it may have been restored -- verify the file does not exist on disk before proceeding.

### Confirm Files Do Not Exist On Disk

```bash
for f in MEMORY_LEAK_FIXES_COMPLETE.md SECURITY_AND_MEMORY_FIXES_PROGRESS.md STABILITY-ANALYSIS-REPORT.md TESTING_SUMMARY.md TEST_RESULTS.md; do
    test -f "$f" && echo "UNEXPECTED: $f exists on disk" || echo "CONFIRMED: $f deleted"
done
```

**Expected**: All CONFIRMED.

### Confirm Non-Existent Files Are NOT In This Plan

The original Phase 1 plan listed 3 additional files for deletion that do not exist and have never existed in this repository:

- `COMPLETE_SYSTEM_SUMMARY.md` -- does not exist
- `MCP_INTEGRATION_COMPLETE.md` -- does not exist
- `QUICK_START.md` -- does not exist

These have been removed from this task. Do not attempt to `git rm` them.

---

## Subtask 1.5.2: Stage Deletions

```bash
git rm MEMORY_LEAK_FIXES_COMPLETE.md
git rm SECURITY_AND_MEMORY_FIXES_PROGRESS.md
git rm STABILITY-ANALYSIS-REPORT.md
git rm TESTING_SUMMARY.md
git rm TEST_RESULTS.md
```

### Post-Stage Verification

```bash
# Verify deletions are now staged (D in first column, not second)
git status --short | grep "^D "
```

**Expected**: 5 entries with `D ` prefix (staged deletion, note: D is in the FIRST column now).

```bash
# Verify no unstaged deletions remain
git status --short | grep "^ D"
```

**Expected**: 0 results (no unstaged deletions for these files).

---

## Subtask 1.5.3: AGUI-QUICK-START.md Review (NO ACTION)

`AGUI-QUICK-START.md` exists in the project root and IS tracked by git. It is documentation for the `@ag-ui` packages which are currently reserved (Phase 1.2, Subtask 1.2.3).

**Decision**: KEEP with no action.

**Rationale**: The `@ag-ui/*` packages are reserved for planned Agent UI upgrade work. If those packages are later removed, this documentation file should be removed with them. For Phase 1, no action is required.

---

## Subtask 1.5.4: Add Missing .gitignore Patterns

### Patterns Already Present (Do Not Duplicate)

These patterns were proposed in the original plan but already exist in `.gitignore`:

| Pattern                        | Status         | .gitignore Line |
| ------------------------------ | -------------- | --------------- |
| `css-integrity-baselines.json` | ALREADY EXISTS | Line 384        |
| `css-integrity-report.json`    | ALREADY EXISTS | Line 385        |
| `core.*`                       | ALREADY EXISTS | Line 398        |
| `*.kismet`                     | ALREADY EXISTS | Line 376        |
| `*.db`                         | ALREADY EXISTS | Line 313        |
| `*.db-shm`                     | ALREADY EXISTS | Line 315        |
| `*.db-wal`                     | ALREADY EXISTS | Line 316        |

**NF-1 Correction**: The original plan proposed adding `rf_signals.db`, `rf_signals.db-shm`, `rf_signals.db-wal`. These are ALREADY covered by the `*.db`, `*.db-shm`, and `*.db-wal` wildcard patterns. Adding specific `rf_signals.db*` patterns would be redundant.

### Pattern to Add

Only one pattern is genuinely missing:

| Pattern              | Reason                                    | Files on Disk                             |
| -------------------- | ----------------------------------------- | ----------------------------------------- |
| `.claude-container/` | Claude Code container workspace artifacts | Preventive (dir does not currently exist) |

### Execution

Append to `.gitignore`:

```
# Claude Code artifacts
.claude-container/
```

**Placement**: Append to the end of the file. Do not modify existing patterns.

### Post-Edit Verification

```bash
# Verify pattern is present
grep ".claude-container" .gitignore
# Expected: .claude-container/ found

# Verify rf_signals.db is covered by existing wildcard
grep "^\*\.db$" .gitignore
# Expected: *.db found (no specific rf_signals.db needed)

# Verify no duplicate patterns introduced
sort .gitignore | uniq -d | head -20
# Expected: 0 duplicates (or only intentional ones)
```

---

## Subtask 1.5.5: Final Verification

```bash
# 1. Staged deletions present
git status --short | grep "^D " | wc -l
# Expected: 5 (the git rm'd files)

# 2. No unstaged deletions remain for these files
git status --short | grep "^ D" | grep -E "(MEMORY_LEAK|SECURITY_AND_MEMORY|STABILITY-ANALYSIS|TESTING_SUMMARY|TEST_RESULTS)" | wc -l
# Expected: 0

# 3. Files do not exist on disk
for f in MEMORY_LEAK_FIXES_COMPLETE.md SECURITY_AND_MEMORY_FIXES_PROGRESS.md STABILITY-ANALYSIS-REPORT.md TESTING_SUMMARY.md TEST_RESULTS.md; do
    test -f "$f" && echo "FAIL: $f still on disk" || echo "PASS: $f gone"
done
# Expected: all PASS

# 4. New .gitignore pattern present
grep ".claude-container" .gitignore && echo "PASS" || echo "FAIL"
# Expected: PASS

# 5. Verify rf_signals.db is ALREADY covered by wildcard
grep "^\*\.db$" .gitignore && echo "PASS: *.db wildcard exists" || echo "FAIL"
# Expected: PASS

# 6. AGUI-QUICK-START.md still exists (not accidentally deleted)
test -f AGUI-QUICK-START.md && echo "PASS: AGUI doc preserved" || echo "INFO: AGUI doc not found"

# 7. Build passes
npm run build
# Expected: exit 0
```

---

## Rollback Procedure

```bash
git reset --soft HEAD~1
```

All changes in this task are git-tracked files. No `npm install` required.

## Risk Assessment

| Risk                                 | Level | Mitigation                                                             |
| ------------------------------------ | ----- | ---------------------------------------------------------------------- |
| Staging wrong files                  | ZERO  | Files already deleted from disk; git rm only stages existing deletions |
| Deleting tracked .gitignore patterns | ZERO  | Only appending, not modifying existing patterns                        |
| Missing AGUI-QUICK-START.md          | ZERO  | Explicit KEEP decision documented                                      |
| Redundant .gitignore patterns        | ZERO  | NF-1 audit finding eliminated redundant additions                      |

## Completion Criteria

- [ ] 5 root file deletions staged in git (`D ` status)
- [ ] Zero unstaged deletions for these files
- [ ] `.claude-container/` pattern added to `.gitignore`
- [ ] No redundant `.gitignore` patterns introduced
- [ ] `AGUI-QUICK-START.md` preserved (not deleted)
- [ ] `npm run build` exits 0
- [ ] Git commit created with correct message format
