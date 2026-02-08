# Phase 4.1.3: GridProcessor Type Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code), BARR-C Rule 1.2 (types defined near point of use)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity                 |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                                           |
| **Task ID**            | 4.1.3                                                                                  |
| **Title**              | GridProcessor Type Migration                                                           |
| **Status**             | PLANNED                                                                                |
| **Risk Level**         | MEDIUM -- type migration changes interface shape if done incorrectly                   |
| **Estimated Duration** | 10 minutes                                                                             |
| **Dependencies**       | Phase 4.1.0 (Pre-Deletion Verification Gate) must PASS                                 |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                                           |
| **Commit Message**     | `refactor: inline gridProcessor types into heatmapService and delete gridProcessor.ts` |

---

## Objective

Migrate ALL exported interfaces from `src/lib/services/map/gridProcessor.ts` into `src/lib/services/map/heatmapService.ts` so that `gridProcessor.ts` can be safely deleted. This is the prerequisite for deleting the deferred file from Task 4.1.1.

---

## Current State Assessment

| Metric                               | Verified Value                                               | Target                         | Verification Command                                                  |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- |
| Import of GridCell in heatmapService | `import type { GridCell } from './gridProcessor'` at line 10 | Inline definition              | `grep -n "gridProcessor" src/lib/services/map/heatmapService.ts`      |
| Total interfaces in gridProcessor    | 4 (`GridSignal`, `GridBounds`, `FrequencyInfo`, `GridCell`)  | All migrated to heatmapService | `grep -c "export interface" src/lib/services/map/gridProcessor.ts`    |
| External importers of gridProcessor  | 1 (heatmapService.ts, type-only)                             | 0                              | `grep -rn "gridProcessor" src/ --include="*.ts" --include="*.svelte"` |
| gridProcessor.ts total lines         | 267                                                          | File deleted                   | `wc -l src/lib/services/map/gridProcessor.ts`                         |

### Current State of gridProcessor.ts

File `src/lib/services/map/gridProcessor.ts` exports FOUR interfaces that must ALL be migrated:

```
Lines 5-11:   export interface GridSignal { lat, lon, power, freq, timestamp }
Lines 13-18:  export interface GridBounds { minLat, maxLat, minLon, maxLon }
Lines 20-25:  export interface FrequencyInfo { freq, power, band, count }
Lines 27-53:  export interface GridCell { ... topFrequencies: FrequencyInfo[] ... }
```

**CRITICAL**: `GridCell` references `FrequencyInfo` (via `topFrequencies: FrequencyInfo[]`) and `GridBounds`. Migrating only `GridCell` without its dependencies will cause a TypeScript compilation error. All four interfaces must be migrated together.

### Current State of heatmapService.ts

File `src/lib/services/map/heatmapService.ts:10` contains:

```typescript
import type { GridCell } from './gridProcessor';
```

This is the ONLY import from `gridProcessor.ts` in the entire codebase.

---

## Execution Steps

### Step 1: Read ALL Exported Interfaces from gridProcessor.ts

```bash
# Extract all four interfaces
head -53 src/lib/services/map/gridProcessor.ts
```

Confirm the output contains exactly 4 `export interface` declarations: `GridSignal`, `GridBounds`, `FrequencyInfo`, `GridCell`.

### Step 2: Copy ALL FOUR Interface Definitions into heatmapService.ts

In `src/lib/services/map/heatmapService.ts`, replace:

```typescript
import type { GridCell } from './gridProcessor';
```

with the full interface definitions for `GridSignal`, `GridBounds`, `FrequencyInfo`, and `GridCell` (copied verbatim from `gridProcessor.ts` lines 5-53).

**IMPORTANT**: Copy the interfaces VERBATIM. Do not rename fields, change types, or omit optional markers. The interface shapes must be byte-for-byte identical to the originals.

### Step 3: Verify No Other Files Import from gridProcessor

```bash
grep -rn "from.*gridProcessor" src/ --include="*.ts" --include="*.svelte"
# Must return 0 results after the import replacement
```

### Step 4: Delete gridProcessor.ts

```bash
rm src/lib/services/map/gridProcessor.ts
```

### Step 5: TypeScript Verification

```bash
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

### Step 6: Stage and Commit

```bash
git add src/lib/services/map/heatmapService.ts \
        src/lib/services/map/gridProcessor.ts

git commit -m "$(cat <<'EOF'
refactor: inline gridProcessor types into heatmapService and delete gridProcessor.ts

Migrate 4 interfaces (GridSignal, GridBounds, FrequencyInfo, GridCell) from
the dead gridProcessor.ts into heatmapService.ts (the sole consumer via
type-only import). Delete gridProcessor.ts (267 lines).

All four interfaces must be migrated together because GridCell references
FrequencyInfo and GridBounds.

Standards: NASA/JPL Rule 31, MISRA Rule 3.1, BARR-C Rule 1.2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Post-Task Verification

```bash
# 1. All four interfaces should now be defined in heatmapService.ts
grep -n "interface GridCell\|interface GridBounds\|interface FrequencyInfo\|interface GridSignal" \
  src/lib/services/map/heatmapService.ts
# Expected: 4 results (one for each interface)

# 2. No remaining imports from gridProcessor
grep -rn "gridProcessor" src/ --include="*.ts" --include="*.svelte"
# Expected: 0 results

# 3. gridProcessor.ts is deleted
[ -f "src/lib/services/map/gridProcessor.ts" ] && echo "ERROR: gridProcessor.ts still exists" || echo "OK: gridProcessor.ts deleted"

# 4. TypeScript compilation passes
npm run typecheck
# Expected: 0 errors

# 5. Build passes
npm run build 2>&1 | tail -10
# Expected: successful build
```

---

## Risk Assessment

| Risk                                                    | Likelihood | Impact               | Mitigation                                                          |
| ------------------------------------------------------- | ---------- | -------------------- | ------------------------------------------------------------------- |
| Type migration changes interface shape                  | LOW        | MEDIUM (type errors) | Copy interface verbatim; `npm run typecheck` confirms compatibility |
| Missing dependency interface (FrequencyInfo/GridBounds) | LOW        | HIGH (compile error) | All 4 interfaces migrated together per this plan                    |
| heatmapService.ts already defines conflicting types     | VERY LOW   | MEDIUM (name clash)  | Verify no existing `GridCell`/`GridSignal` etc. before copy         |

### High-Risk File: gridProcessor.ts

This is the highest-risk file in the entire Phase 4.1 because it has a type-only import. A type-only import means the file is still actively referenced at compile time, even though no runtime code depends on it. The migration must be exact:

1. All 4 interfaces must be copied (not just `GridCell`)
2. The `import type` statement must be replaced (not just deleted)
3. `npm run typecheck` must pass AFTER migration, BEFORE deletion

If type migration introduces errors, STOP and investigate. Do NOT delete `gridProcessor.ts` if typecheck fails.

---

## Rollback Strategy

### If Type Migration Fails

```bash
# Restore the original import in heatmapService.ts
git checkout HEAD -- src/lib/services/map/heatmapService.ts

# Verify gridProcessor.ts still exists
ls -la src/lib/services/map/gridProcessor.ts
```

### If gridProcessor.ts Was Already Deleted

```bash
git checkout pre-phase-4.1-backup -- src/lib/services/map/gridProcessor.ts
git checkout pre-phase-4.1-backup -- src/lib/services/map/heatmapService.ts
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
| NASA/JPL Rule 31 | No dead code                  | gridProcessor.ts body is dead code; only types are consumed |
| MISRA Rule 3.1   | No commented/unreachable code | 267-line file with 4 interfaces consumed, ~214 lines dead   |
| CERT MSC12-C     | Detect and remove dead code   | Safe removal after type dependency migration                |
| BARR-C Rule 1.2  | Types near point of use       | Types moved into their sole consumer (heatmapService.ts)    |

---

## Execution Tracking

| Step | Description                              | Status  | Started | Completed | Verified By |
| ---- | ---------------------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Read interfaces from gridProcessor.ts    | PENDING | --      | --        | --          |
| 2    | Copy 4 interfaces into heatmapService.ts | PENDING | --      | --        | --          |
| 3    | Verify no other importers remain         | PENDING | --      | --        | --          |
| 4    | Delete gridProcessor.ts                  | PENDING | --      | --        | --          |
| 5    | TypeScript verification                  | PENDING | --      | --        | --          |
| 6    | Stage and commit                         | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 4.1.0](Phase-4.1.0-Pre-Deletion-Verification-Gate.md) -- Gate must pass
- **Completes**: [Phase 4.1.1](Phase-4.1.1-Delete-Confirmed-Dead-Files-Batch-1.md) -- Deferred gridProcessor.ts deletion
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.4
