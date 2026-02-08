# Phase 3.3.4: TODO/FIXME Resolution

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA Rule 3.1 (no unresolved markers in production), BARR-C Rule 1.7 (resolve all warnings)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.3 -- ESLint Enforcement, TODO Resolution, and Error Hygiene
**Task ID**: 3.3.4
**Risk Level**: LOW -- Implementing trivial functionality, converting markers to tracked issues
**Prerequisites**: Phase 3.1 (Logger needed for direct implementations)
**Blocks**: None
**Estimated Files Touched**: 11
**Standards**: MISRA Rule 3.1 (no unresolved markers), BARR-C Rule 1.7 (resolve all warnings)

---

## Objective

Resolve all 15 TODO markers across 11 files. Each marker must be either implemented directly, converted to a tracked GitHub issue, or deleted if the containing file is dead code.

## Current State Assessment

| Metric                     | Value                                                  |
| -------------------------- | ------------------------------------------------------ |
| TODO comments              | 15 across 11 files (corrected 2026-02-08; was 9 files) |
| FIXME comments             | 0                                                      |
| WORKAROUND comments        | 1 (legitimate, addressed in Phase 3.3.7)               |
| HACK/KLUDGE/BROKEN/BUG/XXX | 0                                                      |

## Scope

### Category 1: Implement Directly (3 Items)

These TODOs are trivial to implement with the structured logger from Phase 3.1.

| #   | File                                            | Line | TODO                                     | Implementation                                                                                            |
| --- | ----------------------------------------------- | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 8   | `src/routes/tactical-map-simple/+page.svelte`   | 1440 | `TODO: Add connection status logging`    | Replace TODO comment with: `logInfo('WebSocket connected', { url })`                                      |
| 9   | `src/routes/tactical-map-simple/+page.svelte`   | 1455 | `TODO: Add disconnection status logging` | Replace TODO comment with: `logWarn('WebSocket disconnected', { code, reason })`                          |
| 10  | `src/routes/api/hackrf/cycle-status/+server.ts` | 8    | `TODO: Call sweepManager.getStatus()`    | Implement the status call -- `sweepManager` is already imported; call `getStatus()` and return the result |

### Category 2: Convert to GitHub Issue (9 Items)

These TODOs require design decisions or external dependency work that cannot be resolved in a code quality pass.

| #   | File                                          | Line    | TODO                                                | Proposed Issue Title                                                                                        |
| --- | --------------------------------------------- | ------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/components/kismet/MapView.svelte`    | 44      | `TODO: Implement GPS centering logic`               | "MapView: Implement GPS centering for Kismet map"                                                           |
| 2   | `src/lib/server/websockets.ts`                | 47      | `TODO: Add GNU Radio and Kismet event listeners`    | "WebSocket: Add GNU Radio and Kismet event listener integration"                                            |
| 3   | `src/lib/server/db/networkRepository.ts`      | 33      | `TODO: Implement network detection`                 | "DB: Implement network detection in networkRepository"                                                      |
| 4   | `src/lib/server/db/deviceService.ts`          | 73      | `TODO: OUI lookup`                                  | "DB: Implement OUI manufacturer lookup for device MAC addresses"                                            |
| 5   | `src/lib/server/db/cleanupService.ts`         | 178     | `TODO: Calculate actual movement`                   | "DB: Calculate actual GPS movement distance in cleanup aggregation"                                         |
| 6   | `src/routes/wigletotak/+page.svelte`          | 22      | `TODO: Implement connection status logic`           | "WigleToTAK: Implement connection status indicator"                                                         |
| 7   | `src/routes/tactical-map-simple/+page.svelte` | 478     | `TODO: Implement multi-frequency search`            | "Tactical Map: Implement multi-frequency signal search"                                                     |
| 11  | `src/lib/services/map/networkAnalyzer.ts`     | 153-154 | `TODO: Extract SSID` / `TODO: Extract manufacturer` | "NetworkAnalyzer: Extract SSID and manufacturer from signal data" (consolidates 2 TODOs; #12 duplicates #4) |
| 13  | `src/lib/services/db/dataAccessLayer.ts`      | 201     | `TODO: Calculate from signals`                      | "DAL: Calculate average power from signal readings"                                                         |

### Category 3: Delete with File (2 Items)

These TODOs are in example/dead code files. If the file was deleted in Phase 1 (Dead Code Removal), these TODOs are already gone. If the file still exists, convert to a GitHub issue.

| #   | File                                                         | Line | TODO                             | Action                                                   |
| --- | ------------------------------------------------------------ | ---- | -------------------------------- | -------------------------------------------------------- |
| 14  | `src/lib/services/localization/coral/integration-example.ts` | 61   | `TODO: Implement heatMapService` | Delete if file deleted in Phase 1; else convert to issue |
| 15  | `src/lib/services/localization/coral/integration-example.ts` | 70   | `TODO: Implement localizer`      | Same as #14                                              |

### Post-Resolution Comment Format

For items converted to GitHub issues, replace the TODO comment with:

```typescript
// See GitHub issue #NNN -- [brief description]
```

For items implemented directly, delete the TODO comment entirely (the implementation replaces it).

## Execution Steps

### Step 1: Verify Current TODO Count

```bash
grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "HACKRF\|HackRF" | wc -l
# Expected: 15
```

**Note**: The `HACKRF` exclusion is required because "HACKRF" contains "HACK" which would false-positive match.

### Step 2: Implement Category 1 (3 Items)

1. In `src/routes/tactical-map-simple/+page.svelte` line 1440:
    - Add `import { logInfo, logWarn } from '$lib/utils/logger';` (if not already imported)
    - Replace `// TODO: Add connection status logging` with `logInfo('WebSocket connected', { url });`

2. In `src/routes/tactical-map-simple/+page.svelte` line 1455:
    - Replace `// TODO: Add disconnection status logging` with `logWarn('WebSocket disconnected', { code, reason });`

3. In `src/routes/api/hackrf/cycle-status/+server.ts` line 8:
    - Implement the `sweepManager.getStatus()` call and return the result as JSON

### Step 3: Create GitHub Issues for Category 2 (9 Items)

Use `gh issue create` for each item:

```bash
gh issue create --title "MapView: Implement GPS centering for Kismet map" --body "From TODO at src/lib/components/kismet/MapView.svelte:44"
# Repeat for each of the 9 items
```

Record the issue numbers returned.

### Step 4: Update Source Comments with Issue References

For each created issue, replace the TODO comment:

```typescript
// Before:
// TODO: Implement GPS centering logic

// After:
// See GitHub issue #NNN -- GPS centering for Kismet map
```

### Step 5: Handle Category 3 (2 Items)

Check if `src/lib/services/localization/coral/integration-example.ts` exists:

```bash
test -f src/lib/services/localization/coral/integration-example.ts && echo "EXISTS -- create issue" || echo "DELETED -- no action needed"
```

### Step 6: Verify Zero Remaining TODOs

```bash
grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v "HACKRF\|HackRF" | grep -v "issue #" | wc -l
# Target: 0
```

## Commit Message

```
fix(todos): resolve 15 TODO markers -- implement 3, file 9 issues, conditionally delete 2
```

## Verification

| #   | Check                            | Command                                                                                                                                       | Expected      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | No unresolved TODO/FIXME markers | `grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.svelte" \| grep -v node_modules \| grep -v "HACKRF" \| grep -v "issue #" \| wc -l` | 0             |
| 2   | Issue references present         | `grep -rn "issue #" src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                                      | 9+            |
| 3   | WebSocket logging implemented    | `grep -n "logInfo\|logWarn" src/routes/tactical-map-simple/+page.svelte \| head -5`                                                           | Lines present |
| 4   | cycle-status implemented         | `grep -n "getStatus" src/routes/api/hackrf/cycle-status/+server.ts`                                                                           | Line present  |
| 5   | TypeScript compiles              | `npm run typecheck`                                                                                                                           | Exit 0        |
| 6   | Build succeeds                   | `npm run build`                                                                                                                               | Exit 0        |
| 7   | Unit tests pass                  | `npm run test:unit`                                                                                                                           | Exit 0        |

## Risk Assessment

| Risk                                              | Likelihood | Impact | Mitigation                                                               |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Implementing TODO incorrectly                     | LOW        | LOW    | Only trivial TODOs are implemented (logging and status call)             |
| GitHub issue creation requires repo access        | LOW        | LOW    | Issues can be created after Phase 3.3; use placeholder numbers if needed |
| Deleting TODO in dead file that is actually alive | LOW        | LOW    | Check file existence before deciding action                              |

## Success Criteria

- [ ] All 3 direct-implementation TODOs replaced with working code
- [ ] All 9 design-decision TODOs converted to tracked GitHub issues
- [ ] All 2 dead-file TODOs either deleted (file gone) or converted to issues (file alive)
- [ ] Zero unresolved TODO/FIXME markers in source (excluding issue references)
- [ ] TypeScript compiles without errors
- [ ] Build succeeds

## Cross-References

- **Depends on**: Phase 3.1 (Logger infrastructure for direct implementations)
- **Depends on**: Phase 1 (Dead Code Removal) -- determines whether Category 3 files still exist
- **Depended on by**: Nothing
- **Related**: Phase 3.3.3 (Commented-Out Code Removal) -- some TODOs may be adjacent to commented-out code
- **Related**: Phase 3.3.7 (WORKAROUND Comment Documentation) -- the 1 WORKAROUND comment is separate from TODOs

## Execution Tracking

| Step | Description                    | Status  | Started | Completed | Verified By |
| ---- | ------------------------------ | ------- | ------- | --------- | ----------- |
| 1    | Verify current TODO count      | PENDING | --      | --        | --          |
| 2    | Implement Category 1 (3 items) | PENDING | --      | --        | --          |
| 3    | Create GitHub issues (9 items) | PENDING | --      | --        | --          |
| 4    | Update source with issue refs  | PENDING | --      | --        | --          |
| 5    | Handle Category 3 (2 items)    | PENDING | --      | --        | --          |
| 6    | Verify zero remaining TODOs    | PENDING | --      | --        | --          |
