# Phase 4.1.2: Delete Additional Dead Files -- Batch 2 (Newly Discovered)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity                          |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                                                    |
| **Task ID**            | 4.1.2                                                                                           |
| **Title**              | Delete Additional Dead Files -- Batch 2 (Newly Discovered)                                      |
| **Status**             | PLANNED                                                                                         |
| **Risk Level**         | MEDIUM -- deletions only, but includes barrel-exported files requiring simultaneous barrel edit |
| **Estimated Duration** | 15 minutes                                                                                      |
| **Dependencies**       | Phase 4.1.0 (Pre-Deletion Verification Gate) must PASS                                          |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                                                    |
| **Commit Message**     | `refactor: remove 12 additional dead files found by exhaustive import analysis (2,790 lines)`   |

---

## Objective

Remove 12 dead files discovered during the comprehensive audit that were not in the original plan. These files were identified through exhaustive import graph analysis performed after the initial dead code audit.

---

## Current State Assessment

| Metric                       | Verified Value         | Target      | Verification Command                |
| ---------------------------- | ---------------------- | ----------- | ----------------------------------- |
| Files targeted in this batch | 12 files + 1 directory | 0 remaining | `ls` on each file path              |
| Total lines in batch         | 2,790                  | Removed     | `wc -l` on each file                |
| TypeScript compilation       | Must pass              | 0 errors    | `npm run typecheck 2>&1 \| tail -5` |
| Pre-deletion gate            | Must be PASSED         | PASSED      | Phase 4.1.0 exit code 0             |

---

## Files to Delete

| #   | File                                               | Lines | Verification                                             |
| --- | -------------------------------------------------- | ----- | -------------------------------------------------------- |
| 1   | `src/lib/services/db/dataAccessLayer.ts`           | 378   | Zero imports anywhere in `src/`                          |
| 2   | `src/lib/services/gsm-evil/server.ts`              | 356   | Zero imports anywhere in `src/`                          |
| 3   | `src/lib/server/agent/runtime.ts`                  | 335   | Zero imports anywhere in `src/`                          |
| 4   | `src/lib/services/hackrf/signalProcessor.ts`       | 432   | Barrel-exported only; no external consumer               |
| 5   | `src/lib/services/hackrf/sweepAnalyzer.ts`         | 290   | Barrel-exported only; no external consumer               |
| 6   | `src/lib/services/hackrfsweep/controlService.ts`   | 148   | Zero external imports                                    |
| 7   | `src/lib/services/hackrfsweep/frequencyService.ts` | 117   | Zero external imports                                    |
| 8   | `src/lib/server/database/index.ts`                 | 21    | Entire `server/database/` directory dead                 |
| 9   | `src/lib/server/database/schema.ts`                | 29    | Entire `server/database/` directory dead                 |
| 10  | `src/lib/server/database/signals.repository.ts`    | 12    | Entire `server/database/` directory dead                 |
| 11  | `src/lib/server/networkInterfaces.ts`              | 57    | Zero imports anywhere in `src/`                          |
| 12  | `src/lib/services/kismet/deviceManager.ts`         | 615   | Barrel-exported only; barrel has zero external consumers |

**Total**: 2,790 lines

### High-Risk Files in This Batch (Extra Scrutiny Required)

1. **`src/lib/services/hackrf/signalProcessor.ts`** (File #4) -- Barrel-exported by a live barrel (`hackrf/index.ts`). Deletion requires simultaneous barrel edit in Task 4.1.6. Execute barrel edit and file deletion in the same commit, or ensure Task 4.1.6 follows immediately.

2. **`src/lib/services/hackrf/sweepAnalyzer.ts`** (File #5) -- Same pattern as signalProcessor. Same mitigation.

3. **`src/lib/services/kismet/deviceManager.ts`** (File #12) -- Barrel-exported by a potentially dead barrel (`kismet/index.ts`). Verify the barrel has zero consumers AFTER test route deletions (Task 4.1.4 removes possible consumers).

---

## Execution Steps

### Step 1: Confirm Gate Passed

```bash
# Verify the pre-deletion gate tag exists
git tag -l "pre-phase-4.1-backup" | wc -l
# Expected: 1
```

### Step 2: Delete Individual Files

```bash
# Delete individual files
rm src/lib/services/db/dataAccessLayer.ts
rm src/lib/services/gsm-evil/server.ts
rm src/lib/server/agent/runtime.ts
rm src/lib/services/hackrf/signalProcessor.ts
rm src/lib/services/hackrf/sweepAnalyzer.ts
rm src/lib/services/hackrfsweep/controlService.ts
rm src/lib/services/hackrfsweep/frequencyService.ts
rm src/lib/server/networkInterfaces.ts
rm src/lib/services/kismet/deviceManager.ts
```

### Step 3: Delete Entire Dead Directory

```bash
# Delete entire dead directory (3 files, 62 lines)
rm -r src/lib/server/database/
```

### Step 4: Intermediate Verification

```bash
# TypeScript compilation -- may fail if barrel re-exports reference deleted files.
# If it fails, proceed to Task 4.1.6 barrel cleanup immediately, then re-verify.
npm run typecheck
```

**NOTE**: If `npm run typecheck` fails here due to barrel files (`hackrf/index.ts`, `kismet/index.ts`) referencing deleted modules, this is expected. The barrel edits in Task 4.1.6 resolve these errors. In practice, Tasks 4.1.2 and 4.1.6 (barrel cleanup) should be committed together to maintain a compilable state at every commit.

### Step 5: Stage and Commit

```bash
git add -A src/lib/services/db/dataAccessLayer.ts \
         src/lib/services/gsm-evil/server.ts \
         src/lib/server/agent/runtime.ts \
         src/lib/services/hackrf/signalProcessor.ts \
         src/lib/services/hackrf/sweepAnalyzer.ts \
         src/lib/services/hackrfsweep/controlService.ts \
         src/lib/services/hackrfsweep/frequencyService.ts \
         src/lib/server/database/ \
         src/lib/server/networkInterfaces.ts \
         src/lib/services/kismet/deviceManager.ts

git commit -m "$(cat <<'EOF'
refactor: remove 12 additional dead files found by exhaustive import analysis (2,790 lines)

Delete 12 files with zero external consumers confirmed by import graph analysis:
- db/dataAccessLayer.ts (378 lines)
- gsm-evil/server.ts (356 lines)
- agent/runtime.ts (335 lines)
- hackrf/signalProcessor.ts (432 lines, barrel-only)
- hackrf/sweepAnalyzer.ts (290 lines, barrel-only)
- hackrfsweep/controlService.ts (148 lines)
- hackrfsweep/frequencyService.ts (117 lines)
- server/database/ directory (3 files, 62 lines)
- server/networkInterfaces.ts (57 lines)
- kismet/deviceManager.ts (615 lines, barrel-only)

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
  src/lib/services/db/dataAccessLayer.ts \
  src/lib/services/gsm-evil/server.ts \
  src/lib/server/agent/runtime.ts \
  src/lib/services/hackrf/signalProcessor.ts \
  src/lib/services/hackrf/sweepAnalyzer.ts \
  src/lib/services/hackrfsweep/controlService.ts \
  src/lib/services/hackrfsweep/frequencyService.ts \
  src/lib/server/networkInterfaces.ts \
  src/lib/services/kismet/deviceManager.ts; do
  [ -f "$f" ] && echo "ERROR: $f still exists" || echo "OK: $f deleted"
done

# Confirm directory removed
[ -d "src/lib/server/database/" ] && echo "ERROR: database/ dir still exists" || echo "OK: database/ dir deleted"

# TypeScript compilation must succeed
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

---

## Risk Assessment

| Risk                                       | Likelihood | Impact               | Mitigation                                                                         |
| ------------------------------------------ | ---------- | -------------------- | ---------------------------------------------------------------------------------- |
| Barrel re-export references deleted file   | HIGH       | MEDIUM (build break) | Task 4.1.6 removes barrel re-exports; commit together if needed                    |
| File listed as dead has an active consumer | LOW        | HIGH (build break)   | Task 4.1.0 pre-deletion verification; `npm run typecheck` after batch              |
| Dynamic import not caught by static grep   | LOW        | HIGH (runtime crash) | Grep pattern includes `import()` syntax; manual review of `await import(` patterns |
| Deleted file referenced in `tsconfig.json` | LOW        | LOW                  | Check tsconfig after deletions                                                     |

---

## Rollback Strategy

### Revert This Batch Only

```bash
git revert HEAD
```

### Restore Specific Files

```bash
git checkout pre-phase-4.1-backup -- src/lib/services/db/dataAccessLayer.ts
# Repeat for any other file needed
```

### Restore Entire Directory

```bash
git checkout pre-phase-4.1-backup -- src/lib/server/database/
```

### Post-Rollback Verification

```bash
npm run typecheck && npm run build
# Both must pass after rollback
```

---

## Standards Traceability

| Standard         | Rule                          | Relevance                                               |
| ---------------- | ----------------------------- | ------------------------------------------------------- |
| NASA/JPL Rule 31 | No dead code                  | Removing 12 confirmed dead files from delivered product |
| MISRA Rule 3.1   | No commented/unreachable code | Files have zero external consumers -- unreachable       |
| CERT MSC12-C     | Detect and remove dead code   | Systematic removal after verification gate passed       |

---

## Execution Tracking

| Step | Description                | Status  | Started | Completed | Verified By |
| ---- | -------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Confirm gate passed        | PENDING | --      | --        | --          |
| 2    | Delete individual files    | PENDING | --      | --        | --          |
| 3    | Delete database/ directory | PENDING | --      | --        | --          |
| 4    | Intermediate verification  | PENDING | --      | --        | --          |
| 5    | Stage and commit           | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 4.1.0](Phase-4.1.0-Pre-Deletion-Verification-Gate.md) -- Gate must pass
- **Related**: [Phase 4.1.6](Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md) -- Barrel re-exports for signalProcessor, sweepAnalyzer, deviceManager must be cleaned
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.3
