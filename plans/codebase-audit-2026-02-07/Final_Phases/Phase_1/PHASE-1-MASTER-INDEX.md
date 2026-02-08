# Phase 1: Zero-Risk Cleanup -- Master Index

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT Secure Coding, NASA/JPL Rules 1-2, MISRA C:2012 Dir 4.1
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This document serves as the master index and execution tracker for Phase 1: Zero-Risk Cleanup. Phase 1 eliminates confirmed-unused assets, corrects dependency misplacements, and stages already-deleted files. All changes are deletions or corrections with verified zero-risk to runtime behavior.

## Execution Constraints

| Constraint              | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Risk Level              | ZERO -- All changes verified against live codebase |
| Parallel-safe with      | Phase 2                                            |
| Prerequisites           | Phase 0 complete (dead code removal)               |
| Estimated Files Touched | ~30                                                |
| Total Disk Savings      | ~141 MB                                            |
| Git Commits Produced    | 5 (Tasks 1.1-1.5). Task 1.6 is disk-only.          |

## Sub-Task Files

| File                                          | Task | Description                                           | Dependencies | Commit Required |
| --------------------------------------------- | ---- | ----------------------------------------------------- | ------------ | --------------- |
| `Phase-1.0-Pre-Execution-Snapshot.md`         | 1.0  | Create git tag rollback point                         | None         | No (tag only)   |
| `Phase-1.1-Font-Asset-Optimization.md`        | 1.1  | Reduce fonts from 45.57 MB to ~5 MB, remove CDN leaks | Task 1.0     | Yes             |
| `Phase-1.2-NPM-Dependency-Cleanup.md`         | 1.2  | Remove 3 unused deps, move 8 misplaced deps           | Task 1.0     | Yes             |
| `Phase-1.3-Script-Directory-Consolidation.md` | 1.3  | Merge scripts/development/ into scripts/dev/          | Task 1.0     | Yes             |
| `Phase-1.4-Dead-Static-Asset-Removal.md`      | 1.4  | Delete 18 dead static files (~430 KB)                 | Task 1.0     | Yes             |
| `Phase-1.5-Root-File-Gitignore-Cleanup.md`    | 1.5  | Stage 5 deleted files, update .gitignore              | Task 1.0     | Yes             |
| `Phase-1.6-Core-Dump-Runtime-Cleanup.md`      | 1.6  | Delete core dumps + Kismet capture (~100 MB)          | Task 1.0     | No (disk-only)  |

## Execution Order

```
MANDATORY FIRST: Task 1.0 (Pre-Execution Snapshot)
         |
         v
    +----+----+----+----+----+
    |    |    |    |    |    |
   1.1  1.2  1.3  1.4  1.5  1.6
    |    |    |    |    |    |
    v    v    v    v    v    v
  COMMIT COMMIT COMMIT COMMIT COMMIT  (disk-only)
```

Tasks 1.1 through 1.6 are independent and may execute in any order after Task 1.0 completes. However, the recommended serial order is 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 -> 1.6 to allow incremental build verification.

## Commit Message Format

```
cleanup(phase1.N): <description>

Phase 1 Task N: <full task name>
Verified: <key verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

| Scope                      | Command                                                | Notes                        |
| -------------------------- | ------------------------------------------------------ | ---------------------------- |
| Single task (git-tracked)  | `git reset --soft HEAD~1`                              | Preserves staging area       |
| Single task (npm involved) | `git reset --soft HEAD~1 && npm install`               | Restores node_modules        |
| Full Phase 1 rollback      | `git reset --hard phase1-pre-execution && npm install` | Destroys all Phase 1 commits |
| Task 1.6 (disk-only)       | N/A -- non-reversible                                  | Gitignored runtime artifacts |

## Completion Criteria

Phase 1 is complete when ALL of the following are true:

1. All 7 sub-task verification checklists pass (0 FAIL results)
2. `npm run typecheck` exits 0
3. `npm run build` exits 0
4. `npm run test:unit` exits 0
5. `git status --short` shows no unstaged deletions (` D` entries)
6. `grep -rn "fonts.googleapis.com" static/ src/` returns 0 results
7. `du -sh static/fonts/` reports ~5 MB (down from 46 MB)
8. `ls core.* 2>/dev/null | wc -l` returns 0

## Execution Tracking

| Task | Status  | Started | Completed | Verified By | Notes |
| ---- | ------- | ------- | --------- | ----------- | ----- |
| 1.0  | PENDING | --      | --        | --          | --    |
| 1.1  | PENDING | --      | --        | --          | --    |
| 1.2  | PENDING | --      | --        | --          | --    |
| 1.3  | PENDING | --      | --        | --          | --    |
| 1.4  | PENDING | --      | --        | --          | --    |
| 1.5  | PENDING | --      | --        | --          | --    |
| 1.6  | PENDING | --      | --        | --          | --    |

---

## Audit Finding Traceability

Every finding from both audit rounds is resolved by a specific sub-task. See individual sub-task files for per-finding traceability.

| Finding | Sub-Task | Resolution Summary                                      |
| ------- | -------- | ------------------------------------------------------- |
| CE-1    | 1.2      | Phantom production deps eliminated                      |
| CE-2    | 1.2      | pngjs preserved with evidence                           |
| CE-3    | 1.2      | Exactly 8 misplaced packages identified                 |
| CE-4    | 1.4      | Dead scripts replaced with verified dead static files   |
| CE-5    | 1.5      | Only 5 confirmed files listed                           |
| FE-1    | 1.1      | 9 primary + 59+ inherited references clarified          |
| FE-2    | 1.1      | All 3 Google Fonts CDN locations listed                 |
| FE-3    | ALL      | Current State Assessment rewritten with live values     |
| FE-4    | 1.2      | @deck.gl/mesh-layers removed; maplibre-gl marked ACTIVE |
| FE-5    | 1.2      | @anthropic-ai/sdk note: not installed                   |
| MO-1    | 1.6      | 34 core dumps (92.9 MB) addressed                       |
| MO-2    | 1.4      | 18 dead static files with byte sizes                    |
| MO-3    | 1.5      | AGUI-QUICK-START.md keep decision documented            |
| MO-4    | 1.5      | Genuinely missing .gitignore patterns only              |
| MO-5    | Deferred | 66 scripts with wrong paths deferred to Phase 6         |
| MO-6    | ALL      | Commit strategy defined per-task                        |
| NF-1    | 1.5      | Redundant rf_signals.db patterns removed                |
| NF-2    | 1.4      | 7 additional dead files added (6 HTML/JS + logger.js)   |
| NF-3    | 1.1      | Light font variant removed from KEEP list               |
| NF-4    | 1.3      | build-tools/package.json scope added                    |
| NF-5    | 1.6      | Restructured as disk-only, no commit                    |
| NF-6    | 1.0      | Pre-execution git tag mandatory                         |
| NF-7    | ALL      | Per-task rollback commands specified                    |
| NF-8    | 1.1      | Exact CSS final state specified byte-for-byte           |
| NF-9    | 1.1      | 140 font-weight occurrences verified on system fonts    |
