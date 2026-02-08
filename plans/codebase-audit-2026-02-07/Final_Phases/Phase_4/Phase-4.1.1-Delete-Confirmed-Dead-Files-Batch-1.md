# Phase 4.1.1: Delete Confirmed Dead Files -- Batch 1 (Original Plan)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity             |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                                       |
| **Task ID**            | 4.1.1                                                                              |
| **Title**              | Delete Confirmed Dead Files -- Batch 1 (Original Plan)                             |
| **Status**             | PLANNED                                                                            |
| **Risk Level**         | MEDIUM -- deletions only, no behavioral changes to live code                       |
| **Estimated Duration** | 15 minutes                                                                         |
| **Dependencies**       | Phase 4.1.0 (Pre-Deletion Verification Gate) must PASS                             |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                                       |
| **Commit Message**     | `refactor: remove 8 dead service files identified by codebase audit (2,724 lines)` |

---

## Objective

Remove the 9 files from the original dead code plan that are confirmed dead after false positive correction. File 9 (`gridProcessor.ts`, 267 lines) is deferred to after Task 4.1.3 completes the type migration. This task deletes files 1-8 (2,724 lines).

---

## Current State Assessment

| Metric                       | Verified Value               | Target      | Verification Command                |
| ---------------------------- | ---------------------------- | ----------- | ----------------------------------- |
| Files targeted in this batch | 9 (8 immediate + 1 deferred) | 0 remaining | `ls` on each file path              |
| Total lines in batch         | 2,991 (2,724 immediate)      | Removed     | `wc -l` on each file                |
| TypeScript compilation       | Must pass                    | 0 errors    | `npm run typecheck 2>&1 \| tail -5` |
| Pre-deletion gate            | Must be PASSED               | PASSED      | Phase 4.1.0 exit code 0             |

---

## Files to Delete

| #   | File                                                         | Lines | Verification                                     |
| --- | ------------------------------------------------------------ | ----- | ------------------------------------------------ |
| 1   | `src/lib/services/drone/flightPathAnalyzer.ts`               | 574   | Zero imports anywhere in `src/`                  |
| 2   | `src/lib/services/map/aiPatternDetector.ts`                  | 530   | Zero imports anywhere in `src/`                  |
| 3   | `src/lib/services/map/altitudeLayerManager.ts`               | 367   | Zero imports anywhere in `src/`                  |
| 4   | `src/lib/services/map/contourGenerator.ts`                   | 323   | Zero imports anywhere in `src/`                  |
| 5   | `src/lib/services/websocket/example-usage.ts`                | 283   | Example code, zero imports                       |
| 6   | `src/lib/services/localization/coral/CoralAccelerator.v2.ts` | 277   | Backup `.v2` file, zero imports                  |
| 7   | `src/lib/services/tactical-map/systemService.ts`             | 208   | Zero imports anywhere in `src/`                  |
| 8   | `src/lib/services/tactical-map/cellTowerService.ts`          | 162   | Zero imports anywhere in `src/`                  |
| 9   | `src/lib/services/map/gridProcessor.ts`                      | 267   | Type-only import; Task 4.1.3 migrates type FIRST |

**Total**: 2,991 lines (gridProcessor deletion deferred to after Task 4.1.3)

**Subtotal without gridProcessor**: 2,724 lines

---

## Execution Steps

### Step 1: Confirm Gate Passed

```bash
# Verify the pre-deletion gate tag exists (created by Task 4.1.0)
git tag -l "pre-phase-4.1-backup" | wc -l
# Expected: 1
```

### Step 2: Delete Files 1-8

Files 1-8 have no dependencies on each other and can be deleted in any order.

```bash
# Delete files 1-8
rm src/lib/services/drone/flightPathAnalyzer.ts
rm src/lib/services/map/aiPatternDetector.ts
rm src/lib/services/map/altitudeLayerManager.ts
rm src/lib/services/map/contourGenerator.ts
rm src/lib/services/websocket/example-usage.ts
rm src/lib/services/localization/coral/CoralAccelerator.v2.ts
rm src/lib/services/tactical-map/systemService.ts
rm src/lib/services/tactical-map/cellTowerService.ts
```

### Step 3: Intermediate Verification

```bash
# TypeScript compilation must succeed with files 1-8 deleted
npm run typecheck
```

**NOTE**: File 9 (`gridProcessor.ts`) is NOT deleted in this step. It contains type definitions (`GridCell`, `GridBounds`, `FrequencyInfo`, `GridSignal`) that are imported by `heatmapService.ts`. Task 4.1.3 (GridProcessor Type Migration) must complete first to move these types into `heatmapService.ts` before `gridProcessor.ts` can be safely deleted.

### Step 4: Stage and Commit

```bash
git add -A src/lib/services/drone/flightPathAnalyzer.ts \
         src/lib/services/map/aiPatternDetector.ts \
         src/lib/services/map/altitudeLayerManager.ts \
         src/lib/services/map/contourGenerator.ts \
         src/lib/services/websocket/example-usage.ts \
         src/lib/services/localization/coral/CoralAccelerator.v2.ts \
         src/lib/services/tactical-map/systemService.ts \
         src/lib/services/tactical-map/cellTowerService.ts

git commit -m "$(cat <<'EOF'
refactor: remove 8 dead service files identified by codebase audit (2,724 lines)

Delete 8 files with zero imports confirmed by exhaustive grep verification:
- drone/flightPathAnalyzer.ts (574 lines)
- map/aiPatternDetector.ts (530 lines)
- map/altitudeLayerManager.ts (367 lines)
- map/contourGenerator.ts (323 lines)
- websocket/example-usage.ts (283 lines)
- coral/CoralAccelerator.v2.ts (277 lines)
- tactical-map/systemService.ts (208 lines)
- tactical-map/cellTowerService.ts (162 lines)

gridProcessor.ts deferred to after type migration (Task 4.1.3).

Standards: NASA/JPL Rule 31, MISRA Rule 3.1, CERT MSC12-C

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Post-Task Verification

```bash
# Confirm files are gone
for f in \
  src/lib/services/drone/flightPathAnalyzer.ts \
  src/lib/services/map/aiPatternDetector.ts \
  src/lib/services/map/altitudeLayerManager.ts \
  src/lib/services/map/contourGenerator.ts \
  src/lib/services/websocket/example-usage.ts \
  src/lib/services/localization/coral/CoralAccelerator.v2.ts \
  src/lib/services/tactical-map/systemService.ts \
  src/lib/services/tactical-map/cellTowerService.ts; do
  [ -f "$f" ] && echo "ERROR: $f still exists" || echo "OK: $f deleted"
done

# gridProcessor.ts should STILL exist at this point
[ -f "src/lib/services/map/gridProcessor.ts" ] && echo "OK: gridProcessor.ts retained (pending type migration)" || echo "ERROR: gridProcessor.ts was prematurely deleted"

# TypeScript compilation must succeed
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

---

## Risk Assessment

| Risk                                       | Likelihood | Impact               | Mitigation                                                            |
| ------------------------------------------ | ---------- | -------------------- | --------------------------------------------------------------------- |
| File listed as dead has an active consumer | LOW        | HIGH (build break)   | Task 4.1.0 pre-deletion verification; `npm run typecheck` after batch |
| Dynamic import not caught by static grep   | LOW        | HIGH (runtime crash) | Grep pattern includes `import()` syntax; manual review                |
| Empty directory causes tooling issues      | VERY LOW   | LOW                  | Task 4.1.6 handles empty directory cleanup                            |

---

## Rollback Strategy

### Revert This Batch Only

```bash
git revert HEAD
```

### Restore Specific Files

```bash
git checkout pre-phase-4.1-backup -- src/lib/services/drone/flightPathAnalyzer.ts
# Repeat for any other file needed
```

### Post-Rollback Verification

```bash
npm run typecheck && npm run build
# Both must pass after rollback
```

---

## Standards Traceability

| Standard         | Rule                          | Relevance                                                   |
| ---------------- | ----------------------------- | ----------------------------------------------------------- |
| NASA/JPL Rule 31 | No dead code                  | Removing 8 confirmed dead files from delivered product      |
| MISRA Rule 3.1   | No commented/unreachable code | Files have zero imports -- unreachable from any entry point |
| CERT MSC12-C     | Detect and remove dead code   | Systematic removal after verification gate passed           |

---

## Execution Tracking

| Step | Description               | Status  | Started | Completed | Verified By |
| ---- | ------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Confirm gate passed       | PENDING | --      | --        | --          |
| 2    | Delete files 1-8          | PENDING | --      | --        | --          |
| 3    | Intermediate verification | PENDING | --      | --        | --          |
| 4    | Stage and commit          | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 4.1.0](Phase-4.1.0-Pre-Deletion-Verification-Gate.md) -- Gate must pass
- **Related**: [Phase 4.1.3](Phase-4.1.3-GridProcessor-Type-Migration.md) -- gridProcessor.ts deletion deferred until type migration completes
- **Followed by**: [Phase 4.1.6](Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md) -- Barrel cleanup depends on this task
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.2
