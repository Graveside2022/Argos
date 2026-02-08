# Phase 4.4.6: Batches 5-8 -- UI Components, Stores, Database, and Other Catch Block Migration

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C, MISRA C++ Rule 15-3-4
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field        | Value                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| Phase        | 4.4                                                                                   |
| Task         | 4.4.6                                                                                 |
| Title        | Batches 5-8 -- UI, Stores, Database, and Other Catch Migrations                       |
| Status       | PLANNED                                                                               |
| Risk Level   | LOW (mechanical transformation, no behavioral change)                                 |
| Duration     | 1 hour 35 minutes (Batch 5: 45min + Batch 6: 30min + Batch 7: 10min + Batch 8: 10min) |
| Dependencies | Phase-4.4.1 (errors.ts extensions must be complete)                                   |
| Commit       | `fix: annotate UI/store/db/other catch blocks with : unknown (batches 5-8/8)`         |

---

## Objective

Migrate all remaining 46 untyped catch blocks across 31 files in four code areas to explicit `catch (error: unknown)` annotations. This task completes the catch block migration, bringing the total untyped count from 402 to 0.

## Current State Assessment

| Batch     | Scope                               | Untyped Catches | Files  |
| --------- | ----------------------------------- | --------------- | ------ |
| 5         | src/lib/components/                 | 27              | 18     |
| 6         | src/lib/stores/                     | 13              | 8      |
| 7         | src/lib/database/                   | 3               | 2      |
| 8         | Other (utils, hardware, routes .ts) | 3               | 3      |
| **Total** |                                     | **46**          | **31** |

Note: Batches 6-8 were added by verification audit 2026-02-08 (MEDIUM-3 resolution). The original plan's 5 batches accounted for 383 of 402 untyped catches. The remaining 19 catches in "Other" locations were unassigned and are now assigned here.

---

## Batch 5: UI Components (27 catches, 18 files)

### Processing Order

| Order | File                                                              | Catches |
| ----- | ----------------------------------------------------------------- | ------- |
| 1     | src/lib/components/wigletotak/directory/DirectoryCard.svelte      | 3       |
| 2     | src/lib/components/tactical-map/map/MarkerManager.svelte          | 3       |
| 3     | src/lib/components/hackrf/SweepControl.svelte                     | 3       |
| 4     | src/lib/components/wigletotak/settings/TAKSettingsCard.svelte     | 2       |
| 5     | src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte | 2       |
| 6     | src/lib/components/hackrfsweep/control/SweepControls.svelte       | 2       |
| 7     | src/lib/components/wigletotak/settings/AnalysisModeCard.svelte    | 1       |
| 8     | src/lib/components/wigletotak/filter/WhitelistCard.svelte         | 1       |
| 9     | src/lib/components/wigletotak/filter/BlacklistCard.svelte         | 1       |
| 10    | src/lib/components/tactical-map/system/SystemInfoPopup.svelte     | 1       |
| 11    | src/lib/components/tactical-map/map/MapContainer.svelte           | 1       |
| 12    | src/lib/components/map/KismetDashboardOverlay.svelte              | 1       |
| 13    | src/lib/components/map/AirSignalOverlay.svelte                    | 1       |
| 14    | src/lib/components/kismet/DataSourceModal.svelte                  | 1       |
| 15    | src/lib/components/hackrf/ConnectionStatus.svelte                 | 1       |
| 16    | src/lib/components/hackrf/AnalysisTools.svelte                    | 1       |
| 17    | src/lib/components/dashboard/frontendToolExecutor.ts              | 1       |
| 18    | src/lib/components/dashboard/AgentChatPanel.svelte                | 1       |

### Batch 5 Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' \
  src/lib/components/ | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## Batch 6: Stores (13 catches, 8 files)

### Processing Order (with line numbers)

| Order | File                             | Catches | Lines         |
| ----- | -------------------------------- | :-----: | ------------- |
| 1     | src/lib/stores/hardwareStore.ts  |    3    | 101, 121, 140 |
| 2     | src/lib/stores/companionStore.ts |    2    | 66, 86        |
| 3     | src/lib/stores/rtl433Store.ts    |    2    | 86, 104       |
| 4     | src/lib/stores/gsmEvilStore.ts   |    2    | 95, 113       |
| 5     | src/lib/stores/pagermonStore.ts  |    1    | 89            |
| 6     | src/lib/stores/btleStore.ts      |    1    | 82            |
| 7     | src/lib/stores/wifiteStore.ts    |    1    | 155           |
| 8     | src/lib/stores/bettercapStore.ts |    1    | 95            |

All store catch blocks follow Pattern A (pass-through) or Pattern B (.message access). Apply the same transformation as Batches 1-5.

### Batch 6 Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/stores/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## Batch 7: Database (3 catches, 2 files)

### Processing Order (with line numbers)

| Order | File                           | Catches | Lines  |
| ----- | ------------------------------ | :-----: | ------ |
| 1     | src/lib/database/dal.ts        |    1    | 102    |
| 2     | src/lib/database/migrations.ts |    2    | 43, 65 |

### Batch 7 Verification

```bash
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/database/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# Expected: 0
```

---

## Batch 8: Other Locations (3 catches, 3 files)

### Processing Order (with line numbers)

| Order | File                                               | Catches | Lines |
| ----- | -------------------------------------------------- | :-----: | ----- |
| 1     | src/lib/utils/mgrsConverter.ts                     |    1    | 24    |
| 2     | src/lib/hardware/usrp-verification.ts              |    1    | 23    |
| 3     | src/routes/tactical-map-simple/rssi-integration.ts |    1    | 143   |

---

## Execution Steps

### Step 1: Verify Prerequisite

```bash
grep -c 'export function getErrorMessage' src/lib/types/errors.ts
# Expected: 1 (Phase-4.4.1 must be complete)
```

### Step 2: Process Batch 5 (UI Components, 18 files)

For each of the 18 files:

1. Open the file (`.svelte` or `.ts`).
2. Locate each `catch (varName)` without `: unknown`.
3. Determine the pattern (A through E, per Phase-4.4.2).
4. Apply the matching transformation.
5. Add `import { getErrorMessage } from '$lib/types/errors';` if needed.

### Step 3: Process Batch 6 (Stores, 8 files)

Same procedure. Use the line numbers provided to locate catch blocks quickly.

### Step 4: Process Batch 7 (Database, 2 files)

Same procedure.

### Step 5: Process Batch 8 (Other, 3 files)

Same procedure.

## Combined Verification

### Batch 5-8 Completion Verification

```bash
# Confirm 0 untyped catches remain ANYWHERE in src/
grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \
  | grep -v ': unknown' | grep -v ': any' | wc -l
# MUST BE: 0
```

| #   | Check                       | Command                                                                                                                                                          | Expected  |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Zero untyped in components/ | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/lib/components/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l` | 0         |
| 2   | Zero untyped in stores/     | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/stores/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l`                          | 0         |
| 3   | Zero untyped in database/   | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' src/lib/database/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l`                        | 0         |
| 4   | Zero untyped ANYWHERE       | `grep -rn 'catch\s*(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)' --include='*.ts' --include='*.svelte' src/ \| grep -v ': unknown' \| grep -v ': any' \| wc -l`                | 0         |
| 5   | TypeScript compiles         | `npx tsc --noEmit 2>&1 \| tail -5`                                                                                                                               | No errors |
| 6   | Svelte check passes         | `npm run check 2>&1 \| tail -5`                                                                                                                                  | No errors |

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                               |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| Type error from adding `: unknown`                       | LOW        | LOW    | Pattern-based transformation; tsc validates              |
| Runtime behavior change                                  | NONE       | --     | `: unknown` is annotation-only; no codegen               |
| getErrorMessage() returns different string than .message | LOW        | LOW    | getErrorMessage() preserves .message for Error instances |

## Rollback Strategy

### Git-Based Rollback

```bash
# Revert the entire batch
git revert <batches-5-8-commit-sha>
```

Commit message: `fix: annotate UI/store/db/other catch blocks with : unknown (batches 5-8/8)`

If batches 5-8 are committed separately, revert each independently:

```
fix: annotate UI component catch blocks with : unknown (batch 5/8)
fix: annotate store catch blocks with : unknown (batch 6/8)
fix: annotate database catch blocks with : unknown (batch 7/8)
fix: annotate other catch blocks with : unknown (batch 8/8)
```

### Partial Rollback

If a specific file causes issues:

1. `git diff HEAD~1 -- path/to/file.ts` to see exactly what changed
2. `git checkout HEAD~1 -- path/to/file.ts` to restore the single file
3. The file will revert to untyped catches, which is valid TypeScript (just not compliant)

---

## Appendix A: File Count Summary

| Location                      | Untyped Catches | Unique Files | Already Typed | Parameterless |
| ----------------------------- | --------------- | ------------ | ------------- | ------------- |
| src/lib/server/               | 143             | 47           | (n/a)         | (n/a)         |
| src/lib/services/             | 95              | 25           | (n/a)         | (n/a)         |
| src/routes/api/               | 80              | 51           | (n/a)         | (n/a)         |
| src/routes/\*.svelte          | 38              | 13           | (n/a)         | (n/a)         |
| src/lib/components/           | 27              | 18           | (n/a)         | (n/a)         |
| src/lib/stores/               | 13              | 8            | (n/a)         | (n/a)         |
| src/lib/database/             | 3               | 2            | (n/a)         | (n/a)         |
| Other (utils, hw, routes .ts) | 3               | 3            | (n/a)         | (n/a)         |
| **TOTAL**                     | **402**         | **167**      | **273**       | **35**        |

## Appendix C: Parameterless Catch Blocks (35 total, NOT in scope)

These blocks intentionally swallow errors (e.g., "try to parse, ignore failure"). They are valid TypeScript and do not require migration. Listed for completeness:

```
src/routes/api/agent/status/+server.ts:23,37
src/routes/api/terminal/shells/+server.ts:32
src/lib/stores/dashboard/terminalStore.ts:57
src/lib/stores/dashboard/dashboardStore.ts:15,35
src/lib/server/agent/runtime.ts:82,96,196
src/lib/server/agent/tool-execution/detection/docker-detector.ts:77,102,114
src/lib/server/agent/tool-execution/detection/service-detector.ts:127,139
src/lib/server/agent/tool-execution/detection/binary-detector.ts:35,59,101,116,129
src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts:165
src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts:159
src/lib/server/mcp/dynamic-server.ts:249,352,374
src/lib/server/hardware/detection/usb-detector.ts:279,328
src/lib/server/hardware/detection/serial-detector.ts:95,205
src/lib/components/dashboard/panels/ToolsNavigationView.svelte:97,136
src/lib/components/dashboard/AgentChatPanel.svelte:46,179
src/lib/components/dashboard/TerminalPanel.svelte:35
src/lib/components/dashboard/TerminalTabContent.svelte:90,177
```

## Cross-References

- **Depends on**: Phase-4.4.1 (errors.ts extensions)
- **Preceded by**: Phase-4.4.5 (Batch 4: Page components)
- **Completes**: All 402 untyped catch block migrations
- **Source**: Phase 4.4 monolithic plan, Section 9 (Task 4.4.7) and Section 9B (Batches 6-8)
