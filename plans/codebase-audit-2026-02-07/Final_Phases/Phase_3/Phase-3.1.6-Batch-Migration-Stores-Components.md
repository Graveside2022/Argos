# Phase 3.1.6: Batch Migration -- Stores and Components

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (adopt consistent error handling), BARR-C Rule 8.7 (no side effects in debug code), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.1 -- Logger Infrastructure Repair and Migration
**Task ID**: 3.1.6
**Risk Level**: LOW -- Mechanical replacements with semantic level review, no behavior changes
**Prerequisites**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) complete
**Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) (ESLint escalation)
**Estimated Files Touched**: 18 (4 stores + 14 components)
**Standards**: CERT ERR00-C (consistent error handling), BARR-C Rule 8.7, NASA/JPL Rule 14

---

## Objective

Migrate all `console.*` statements in `src/lib/stores/` and `src/lib/components/` to the structured logger. This combines Batches 4 and 5 of the 7-batch migration plan: 18 files, 56 statements total.

## Current State Assessment

| Metric                                                     | Verified Value     | Verification Command                                                                                                              |
| ---------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Total `console.*` in `src/lib/stores/` (.ts)               | 10 across 4 files  | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" \| wc -l`                          |
| Total `console.*` in `src/lib/components/` (.ts + .svelte) | 46 across 14 files | `grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" \| wc -l` |

## Scope

This task covers two batches combined into one task file for efficiency:

- **Batch 4**: `src/lib/stores/` -- 4 files, 10 statements
- **Batch 5**: `src/lib/components/` -- 14 files, 46 statements

---

## Per-Batch Procedure (Reference)

Refer to [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md) for the complete per-batch procedure and Semantic Log Level Mapping Rule. The same 8-step process applies to both batches.

---

## Batch 4: `src/lib/stores/` (4 files, 10 statements)

| #   | File                         | Count |
| --- | ---------------------------- | ----- |
| 1   | `rtl433Store.ts`             | 4     |
| 2   | `gsmEvilStore.ts`            | 4     |
| 3   | `usrp.ts`                    | 1     |
| 4   | `dashboard/terminalStore.ts` | 1     |

### Commit for Batch 4

```
fix(logging): migrate console.* to structured logger -- batch 4 (stores, 4 files)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Verification for Batch 4

```bash
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" | wc -l
# Expected: 0
```

---

## Batch 5: `src/lib/components/` (14 files, 46 statements)

| #   | File                                         | Count |
| --- | -------------------------------------------- | ----- |
| 1   | `map/AirSignalOverlay.svelte`                | 21    |
| 2   | `tactical-map/map/MarkerManager.svelte`      | 3     |
| 3   | `kismet/ServiceControl.svelte`               | 3     |
| 4   | `kismet/GPSStatusButton.svelte`              | 3     |
| 5   | `hackrf/SweepControl.svelte`                 | 3     |
| 6   | `dashboard/TerminalTabContent.svelte`        | 3     |
| 7   | `kismet/DataSourceModal.svelte`              | 2     |
| 8   | `dashboard/frontendToolExecutor.ts`          | 2     |
| 9   | `tactical-map/system/SystemInfoPopup.svelte` | 1     |
| 10  | `tactical-map/map/MapContainer.svelte`       | 1     |
| 11  | `map/KismetDashboardOverlay.svelte`          | 1     |
| 12  | `hackrf/TimeWindowControl.svelte`            | 1     |
| 13  | `hackrf/ConnectionStatus.svelte`             | 1     |
| 14  | `hackrf/AnalysisTools.svelte`                | 1     |

### Note on Svelte Imports

In `.svelte` files, use the same `$lib/utils/logger` import path as in `.ts` files. The import goes in the `<script>` block:

```svelte
<script lang="ts">
	import { logInfo, logError, logWarn } from '$lib/utils/logger';
	// ... rest of component
</script>
```

The logger works in both SSR and CSR contexts after the Defect 2 fix in Phase 3.1.0. `console.log`, `console.debug`, `console.error`, and `console.warn` are all available in both Node.js (SSR) and browser (CSR) environments.

### `AirSignalOverlay.svelte` (21 statements) -- Special Attention

This is the largest file in this batch with 21 `console.*` statements. Review each carefully:

- Map/overlay debug logging likely maps to `logDebug` or `logInfo`
- Error handlers in catch blocks map to `logError`
- Warning conditions map to `logWarn`

### Commit for Batch 5

```
fix(logging): migrate console.* to structured logger -- batch 5 (components, 14 files)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Verification for Batch 5

```bash
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" | wc -l
# Expected: 0
```

---

## Combined Verification (Both Batches)

```bash
# 1. Zero console.* in stores
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/stores/ --include="*.ts" | wc -l
# Expected: 0

# 2. Zero console.* in components
grep -rn "console\.\(log\|warn\|error\|info\|debug\|trace\)" src/lib/components/ --include="*.ts" --include="*.svelte" | wc -l
# Expected: 0

# 3. TypeScript compiles
npm run typecheck
# Expected: Exit 0

# 4. Lint passes
npm run lint
# Expected: Exit 0

# 5. Unit tests pass
npm run test:unit
# Expected: Exit 0
```

## Risk Assessment

| Risk                                                        | Likelihood | Impact | Mitigation                                                |
| ----------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------- |
| Svelte SSR context lacks console.debug                      | VERY LOW   | LOW    | All browsers and Node.js support console.debug            |
| AirSignalOverlay.svelte has performance-sensitive rendering | LOW        | LOW    | Logger is synchronous; no observable latency for 21 calls |
| Store reactivity affected by import change                  | VERY LOW   | NONE   | Import adds no reactive dependencies                      |

## Success Criteria

- Zero `console.*` calls in `src/lib/stores/`
- Zero `console.*` calls in `src/lib/components/`
- All log levels are semantically correct
- Svelte components use `$lib/utils/logger` import path in `<script>` blocks
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test:unit` exits 0

## Execution Tracking

### Batch 4 (Stores)

| #   | File                       | Count | Status  | Started | Completed | Verified By |
| --- | -------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1   | rtl433Store.ts             | 4     | PENDING | --      | --        | --          |
| 2   | gsmEvilStore.ts            | 4     | PENDING | --      | --        | --          |
| 3   | usrp.ts                    | 1     | PENDING | --      | --        | --          |
| 4   | dashboard/terminalStore.ts | 1     | PENDING | --      | --        | --          |

### Batch 5 (Components)

| #    | File                                  | Count | Status  | Started | Completed | Verified By |
| ---- | ------------------------------------- | ----- | ------- | ------- | --------- | ----------- |
| 1    | map/AirSignalOverlay.svelte           | 21    | PENDING | --      | --        | --          |
| 2    | tactical-map/map/MarkerManager.svelte | 3     | PENDING | --      | --        | --          |
| 3    | kismet/ServiceControl.svelte          | 3     | PENDING | --      | --        | --          |
| 4    | kismet/GPSStatusButton.svelte         | 3     | PENDING | --      | --        | --          |
| 5    | hackrf/SweepControl.svelte            | 3     | PENDING | --      | --        | --          |
| 6    | dashboard/TerminalTabContent.svelte   | 3     | PENDING | --      | --        | --          |
| 7-14 | (remaining 8 files)                   | 8     | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 3.1.2](Phase-3.1.2-Incomplete-Logger-Migration-Completion.md) -- Partially-migrated files must be clean first
- **Parallel with**: [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md), [Phase 3.1.4](Phase-3.1.4-Batch-Migration-API-Routes.md), [Phase 3.1.5](Phase-3.1.5-Batch-Migration-Services.md), [Phase 3.1.7](Phase-3.1.7-Batch-Migration-Pages-Remaining.md)
- **Blocks**: [Phase 3.1.8](Phase-3.1.8-ESLint-No-Console-Escalation.md) -- ESLint escalation requires all batches complete
- **Source**: [Phase 3.1 Master](Phase-3.1-LOGGER-INFRASTRUCTURE-AND-MIGRATION.md) -- Subtask 3.1.4, Batches 4 and 5
- **Semantic mapping rule**: Defined in [Phase 3.1.3](Phase-3.1.3-Batch-Migration-Server-Core.md)
