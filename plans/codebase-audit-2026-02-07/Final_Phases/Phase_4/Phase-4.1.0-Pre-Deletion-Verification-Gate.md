# Phase 4.1.0: Pre-Deletion Verification Gate

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity     |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                               |
| **Task ID**            | 4.1.0                                                                      |
| **Title**              | Pre-Deletion Verification Gate                                             |
| **Status**             | PLANNED                                                                    |
| **Risk Level**         | LOW -- verification only, no file modifications                            |
| **Estimated Duration** | 20 minutes                                                                 |
| **Dependencies**       | Git working tree clean; `npm run build` passes; `npm run typecheck` passes |
| **Blocks**             | ALL Phase 4.1 tasks (4.1.1 through 4.1.6) -- this is a mandatory GATE      |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                               |
| **Commit Message**     | N/A -- verification only, no commit produced                               |

---

## Objective

Independently verify every file targeted for deletion across Tasks 4.1.1 through 4.1.6 has zero active imports. This is the safety gate -- no file is deleted without passing this check. This task produces NO file changes; it only validates that downstream deletion tasks are safe to execute.

---

## Current State Assessment

| Metric                               | Verified Value                                 | Target                           | Verification Command                             |
| ------------------------------------ | ---------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| Files targeted for deletion          | 21 service/utility files + 8 dirs + 5 examples | All confirmed dead               | Verification script in this document             |
| Known false positives (pre-excluded) | 11 files (4,236 lines)                         | Excluded from all deletion lists | See Appendix A below                             |
| TypeScript compilation               | Must pass before verification begins           | 0 errors                         | `npm run typecheck 2>&1 \| tail -5`              |
| Git working tree                     | Must be clean                                  | No uncommitted changes           | `git status --porcelain \| wc -l` -- expected: 0 |

### The False Positive Problem

The original dead code audit (`plans/dead-code-audit-2026-02-08.md`) identified 104 dead files totaling 24,088 lines. Root-cause verification against the actual import graph revealed that **9 files listed as dead are FALSE POSITIVES** -- they have active import chains and deleting them would break the application.

The root cause of these false positives was a methodological flaw: the audit checked whether files were exported by their parent barrel (`index.ts`) but failed to check for **direct relative imports** between sibling files. A file does not need barrel exposure to be alive -- it only needs one reachable importer.

### False Positive Evidence Table

| File                                                                | Lines | Active Import Evidence                                                                                              |
| ------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/kismet/device_tracker.ts`                           | 503   | `import { DeviceTracker } from './device_tracker'` in `kismet_controller.ts:4`                                      |
| `src/lib/services/map/signalInterpolation.ts`                       | 544   | `import { ... } from './signalInterpolation'` in `heatmapService.ts:7`                                              |
| `src/lib/server/kismet/wifi_adapter_detector.ts`                    | 241   | `const { WiFiAdapterDetector } = await import('./wifi_adapter_detector')` in `fusion_controller.ts:36`              |
| `src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts`       | 228   | Re-exported from `adapters/index.ts:10`, registered by `init.ts`                                                    |
| `src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts` | 218   | Re-exported from `adapters/index.ts:11`, registered by `init.ts`                                                    |
| `src/lib/services/localization/coral/CoralAccelerator.ts`           | 157   | `import { CoralAccelerator, createCoralAccelerator } from './coral/CoralAccelerator'` in `HybridRSSILocalizer.ts:9` |
| `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 108   | Re-exported from `gnuradio/index.ts:1`, consumed by `api/gnuradio/status/+server.ts:3`                              |
| `src/lib/server/btle/types.ts`                                      | 22    | `import type { BLEPacket, BTLEStatus, BTLEConfig } from './types'` in `processManager.ts:7`                         |
| `src/lib/server/companion/types.ts`                                 | 17    | `import type { CompanionApp, CompanionStatus } from './types'` in `launcher.ts:6`                                   |

### AMENDMENT: Additional False Positives Discovered During Plan Verification

During verification of the "confirmed dead" list, grep analysis revealed that `kismet_controller.ts` (808 lines) imports three files listed as confirmed dead:

| File                                           | Lines | Evidence                                                                                 |
| ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `src/lib/server/kismet/device_intelligence.ts` | 930   | `import { DeviceIntelligence } from './device_intelligence'` in `kismet_controller.ts:6` |
| `src/lib/server/kismet/security_analyzer.ts`   | 813   | `import { SecurityAnalyzer } from './security_analyzer'` in `kismet_controller.ts:5`     |

**Full live chain**: `api/kismet/devices/+server.ts:3` and `api/kismet/status/+server.ts:3` both import `fusionKismetController` from `fusion_controller.ts`, which imports `KismetController` from `kismet_controller.ts:1`, which imports `DeviceIntelligence` (line 6), `SecurityAnalyzer` (line 5), `DeviceTracker` (line 4), and `KismetAPIClient` from `api_client.ts` (line 3).

**All five Kismet server files are ALIVE.** The original audit's "Kismet Server Rewrite (3,767 lines)" cluster is a false positive. This reduces the confirmed dead file count from 11 to 9 in the original plan batch, and removes 1,743 lines (930 + 813) from the deletion target.

**These files are excluded from all deletion tasks below.** This verification gate (Task 4.1.0) will independently confirm this via grep before any file is touched.

---

## Execution Steps

### Step 1: Verify Prerequisites

```bash
# Working tree must be clean
git status --porcelain | wc -l
# Expected: 0

# TypeScript must compile
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

### Step 2: Create Safety Tag

```bash
git tag pre-phase-4.1-backup
```

### Step 3: Verification Command Pattern

For each file targeted for deletion, execute:

```bash
# Convert to $lib import path and strip extension
FILEPATH="<absolute_path_to_file>"
IMPORT_PATH=$(echo "$FILEPATH" | sed 's|.*/src/lib/|$lib/|' | sed 's|\.ts$||')
BASENAME=$(basename "$FILEPATH" .ts)

# Check $lib-style imports
grep -rn "$IMPORT_PATH" src/ --include="*.ts" --include="*.svelte" | grep -v "^${FILEPATH}:"

# Check relative imports (same-directory siblings)
grep -rn "from.*['\"]\./${BASENAME}['\"]" src/ --include="*.ts" --include="*.svelte" | grep -v "^${FILEPATH}:"
grep -rn "from.*['\"]\.\./${BASENAME}['\"]" src/ --include="*.ts" --include="*.svelte" | grep -v "^${FILEPATH}:"

# Check dynamic imports
grep -rn "import.*['\"].*${BASENAME}['\"]" src/ --include="*.ts" --include="*.svelte" | grep -v "^${FILEPATH}:"

# REQUIREMENT: ALL four commands must return 0 results before the file is cleared for deletion.
# If ANY command returns results, the file is a FALSE POSITIVE and must NOT be deleted.
```

### Step 4: Run Batch Verification Script

Run this script from the repository root to verify all files at once:

```bash
#!/bin/bash
# File: scripts/verify-dead-code.sh
# Run from repository root: bash scripts/verify-dead-code.sh

set -euo pipefail
ERRORS=0

verify_dead() {
    local filepath="$1"
    local relpath="${filepath#*/src/lib/}"
    local import_path="\$lib/${relpath%.ts}"
    local basename=$(basename "$filepath" .ts)

    # Check all import patterns
    local hits=$(grep -rn "$import_path\|from.*['\"]\./${basename}['\"]\|from.*['\"]\.\./${basename}['\"]\|import.*['\"].*${basename}['\"]" \
        src/ --include="*.ts" --include="*.svelte" 2>/dev/null \
        | grep -v "^${filepath}:" \
        | grep -v "^Binary" \
        || true)

    if [ -n "$hits" ]; then
        echo "FAIL: ${filepath} has active imports:"
        echo "$hits"
        echo ""
        ERRORS=$((ERRORS + 1))
    else
        echo "PASS: ${filepath}"
    fi
}

echo "=== Dead Code Pre-Deletion Verification ==="
echo ""

# Batch 1: Original plan confirmed dead files
verify_dead "src/lib/services/drone/flightPathAnalyzer.ts"
verify_dead "src/lib/services/map/aiPatternDetector.ts"
verify_dead "src/lib/services/map/altitudeLayerManager.ts"
verify_dead "src/lib/services/map/contourGenerator.ts"
verify_dead "src/lib/services/websocket/example-usage.ts"
verify_dead "src/lib/services/localization/coral/CoralAccelerator.v2.ts"
verify_dead "src/lib/services/tactical-map/systemService.ts"
verify_dead "src/lib/services/tactical-map/cellTowerService.ts"
verify_dead "src/lib/services/map/gridProcessor.ts"

# Batch 2: Additional dead files
verify_dead "src/lib/services/db/dataAccessLayer.ts"
verify_dead "src/lib/services/gsm-evil/server.ts"
verify_dead "src/lib/server/agent/runtime.ts"
verify_dead "src/lib/services/hackrf/signalProcessor.ts"
verify_dead "src/lib/services/hackrf/sweepAnalyzer.ts"
verify_dead "src/lib/services/hackrfsweep/controlService.ts"
verify_dead "src/lib/services/hackrfsweep/frequencyService.ts"
verify_dead "src/lib/server/database/index.ts"
verify_dead "src/lib/server/database/schema.ts"
verify_dead "src/lib/server/database/signals.repository.ts"
verify_dead "src/lib/server/networkInterfaces.ts"
verify_dead "src/lib/services/kismet/deviceManager.ts"

echo ""
echo "=== Results ==="
if [ $ERRORS -gt 0 ]; then
    echo "BLOCKED: ${ERRORS} files have active imports. Do NOT proceed with deletion."
    exit 1
else
    echo "ALL CLEAR: All files verified dead. Safe to proceed."
    exit 0
fi
```

### Step 5: Review Expected Results

The following files will report hits that are EXPECTED and ACCEPTABLE:

- **`gridProcessor.ts`** -- Will show a single `type`-only import from `heatmapService.ts:10`:

    ```
    import type { GridCell } from './gridProcessor';
    ```

    This is a type-only import. The file is eligible for deletion AFTER Task 4.1.3 migrates the `GridCell` type. The verification script will flag it; this is expected and handled by task ordering.

- **`signalProcessor.ts` and `sweepAnalyzer.ts`** -- Will show hits from their parent barrel `src/lib/services/hackrf/index.ts`. A barrel re-export without an external consumer is dead code. The barrel cleanup in Task 4.1.6 removes these re-exports.

- **`deviceManager.ts`** -- Will show a hit from `src/lib/services/kismet/index.ts`. Same barrel-only pattern. The barrel `src/lib/services/kismet/index.ts` itself has zero external consumers (verified: `grep -rn 'from.*\$lib/services/kismet' src/ --include="*.ts" --include="*.svelte"` returns 0 results). Task 4.1.6 handles barrel cleanup.

- **`controlService.ts` (hackrfsweep)** -- Will show a self-reference pattern (the file references its own exported `controlService` variable internally). No external consumers exist. Also imports from `$lib/services/hackrf/api` which is alive, but that is an outgoing dependency, not an incoming one.

### Step 6: Gate Decision

Proceed to Task 4.1.1 ONLY when:

1. The verification script exits with code 0 (after excluding known special cases listed in Step 5)
2. All special cases have been manually reviewed and confirmed as barrel-only or type-only
3. No UNEXPECTED failures are reported

If any UNEXPECTED failure occurs, STOP. Investigate the import chain. Update the deletion plan to exclude the file. Do NOT proceed with deletion until the gate is clean.

---

## Verification

```bash
# Gate verification is the task itself. Confirm:

# 1. Safety tag created
git tag -l "pre-phase-4.1-backup" | wc -l
# Expected: 1

# 2. Verification script ran to completion
bash scripts/verify-dead-code.sh
# Expected: exits 0 (with known special cases producing expected FAIL outputs)

# 3. All special cases manually reviewed
# Manual confirmation required -- no automated check
```

---

## Risk Assessment

| Risk                                                              | Likelihood | Impact                | Mitigation                                                   |
| ----------------------------------------------------------------- | ---------- | --------------------- | ------------------------------------------------------------ |
| Verification script misses a dynamic import                       | LOW        | HIGH (runtime crash)  | Script includes `import()` pattern; manual review of results |
| False positive in verification (reports FAIL for truly dead file) | MEDIUM     | LOW (delays deletion) | Known special cases documented; manual override permitted    |
| Grep pattern too broad (matches comments/strings)                 | LOW        | LOW (false alarm)     | Review actual grep output for `from` and `import` keywords   |

---

## Rollback Strategy

This task makes no changes to source code. The only artifact is the `pre-phase-4.1-backup` git tag, which can be deleted if the phase is abandoned:

```bash
git tag -d pre-phase-4.1-backup
```

---

## Standards Traceability

| Standard         | Rule                          | Relevance                                                      |
| ---------------- | ----------------------------- | -------------------------------------------------------------- |
| NASA/JPL Rule 31 | No dead code                  | This gate ensures only truly dead code is targeted for removal |
| MISRA Rule 3.1   | No commented/unreachable code | Verification prevents accidental deletion of reachable code    |
| CERT MSC12-C     | Detect and remove dead code   | Systematic verification script detects dead vs. alive status   |

---

## Appendix A: Files NOT Deleted (False Positives)

For future reference, these 11 files were flagged by the original audit or analysis but are confirmed ALIVE through verified import chains:

| File                                                                | Lines | Live Import Chain                                                                                                 |
| ------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/kismet/device_tracker.ts`                           | 503   | `api/kismet/devices/+server.ts` -> `fusion_controller.ts` -> `kismet_controller.ts:4` -> `device_tracker.ts`      |
| `src/lib/server/kismet/device_intelligence.ts`                      | 930   | `api/kismet/devices/+server.ts` -> `fusion_controller.ts` -> `kismet_controller.ts:6` -> `device_intelligence.ts` |
| `src/lib/server/kismet/security_analyzer.ts`                        | 813   | `api/kismet/devices/+server.ts` -> `fusion_controller.ts` -> `kismet_controller.ts:5` -> `security_analyzer.ts`   |
| `src/lib/server/kismet/api_client.ts`                               | 472   | `api/kismet/devices/+server.ts` -> `fusion_controller.ts` -> `kismet_controller.ts:3` -> `api_client.ts`          |
| `src/lib/server/kismet/wifi_adapter_detector.ts`                    | 241   | `api/kismet/devices/+server.ts` -> `fusion_controller.ts:36` -> dynamic `import('./wifi_adapter_detector')`       |
| `src/lib/services/map/signalInterpolation.ts`                       | 544   | `rssi-integration.ts` -> `heatmapService.ts:7` -> `signalInterpolation.ts`                                        |
| `src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts`       | 228   | `hooks.server.ts` -> `init.ts` -> `adapters/index.ts:10` -> `mcp-adapter.ts`                                      |
| `src/lib/server/agent/tool-execution/adapters/websocket-adapter.ts` | 218   | `hooks.server.ts` -> `init.ts` -> `adapters/index.ts:11` -> `websocket-adapter.ts`                                |
| `src/lib/services/localization/coral/CoralAccelerator.ts`           | 157   | `HybridRSSILocalizer.ts:9` -> `CoralAccelerator.ts`                                                               |
| `src/lib/server/gnuradio/spectrum_analyzer.ts`                      | 108   | `api/gnuradio/status/+server.ts:3` -> `gnuradio/index.ts:1` -> `spectrum_analyzer.ts`                             |
| `src/lib/server/btle/types.ts`                                      | 22    | `processManager.ts:7` -> `types.ts`                                                                               |

**Total preserved**: 4,236 lines that would have been incorrectly deleted without root-cause verification.

---

## Execution Tracking

| Step | Description                   | Status  | Started | Completed | Verified By |
| ---- | ----------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Verify prerequisites          | PENDING | --      | --        | --          |
| 2    | Create safety tag             | PENDING | --      | --        | --          |
| 3-4  | Run batch verification script | PENDING | --      | --        | --          |
| 5    | Review special case results   | PENDING | --      | --        | --          |
| 6    | Gate decision                 | PENDING | --      | --        | --          |

## Cross-References

- **Blocks**: [Phase 4.1.1](Phase-4.1.1-Delete-Confirmed-Dead-Files-Batch-1.md) -- Cannot delete files without gate passing
- **Blocks**: [Phase 4.1.2](Phase-4.1.2-Delete-Additional-Dead-Files-Batch-2.md) -- Cannot delete files without gate passing
- **Blocks**: [Phase 4.1.3](Phase-4.1.3-GridProcessor-Type-Migration.md) -- Cannot migrate types without gate passing
- **Blocks**: [Phase 4.1.4](Phase-4.1.4-Remove-Test-Route-Directories.md) -- Cannot remove routes without gate passing
- **Blocks**: [Phase 4.1.5](Phase-4.1.5-Remove-Example-Test-Files.md) -- Cannot remove examples without gate passing
- **Blocks**: [Phase 4.1.6](Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md) -- Cannot clean barrels without gate passing
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.1
