# Phase 4.1 -- Dead Code Elimination

| Attribute                   | Value                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| **Risk Level**              | MEDIUM -- deletions only, no behavioral changes to live code (except Task 4.1.4 type migration) |
| **Prerequisites**           | Git working tree clean; `npm run build` passes; `npm run typecheck` passes                      |
| **Estimated Files Deleted** | ~35 files + 8 directories                                                                       |
| **Estimated Lines Removed** | ~9,600                                                                                          |
| **Execution Blocks**        | 7 tasks (4.1.1 through 4.1.7)                                                                   |
| **Estimated Duration**      | 2-3 hours (includes verification between batches)                                               |
| **Branch**                  | `agent/alex/phase-4.1-dead-code-elimination`                                                    |
| **Base**                    | `main`                                                                                          |

---

## Current State Assessment

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

**These files are excluded from all deletion tasks below.** Task 4.1.1 (pre-deletion verification) will independently confirm this via grep before any file is touched.

---

## Execution Order and Task Dependency Graph

```
4.1.1 Pre-Deletion Verification (GATE -- must pass before any deletion)
  |
  +---> 4.1.2 Delete Confirmed Dead Files (Batch 1 -- Original Plan)
  |       |
  |       +---> 4.1.7 Clean Up Orphaned Barrel Exports (depends on 4.1.2 + 4.1.3 + 4.1.5 + 4.1.6)
  |
  +---> 4.1.3 Delete Additional Dead Files (Batch 2 -- Newly Discovered)
  |       |
  |       +---> 4.1.7 (same)
  |
  +---> 4.1.4 GridProcessor Type Migration (independent, has type dependency)
  |
  +---> 4.1.5 Remove Test Route Directories (independent)
  |       |
  |       +---> 4.1.7 (same -- websocket barrel's only consumer is test/+page.svelte)
  |
  +---> 4.1.6 Remove Example/Test Files (independent)
          |
          +---> 4.1.7 (same -- api barrel's only consumer is api/example-usage.ts)

4.1.7 Clean Up Orphaned Barrel Exports and Empty Directories
  |
  +---> Final Verification (npm run build && npm run typecheck)
```

Tasks 4.1.2 through 4.1.6 are independent of each other (no cross-dependencies). Task 4.1.7 depends on **4.1.2, 4.1.3, 4.1.5, AND 4.1.6** completing first. The barrel files' consumers are removed by these tasks:

- `services/websocket/index.ts` barrel: sole consumer is `routes/test/+page.svelte:3` (deleted by Task 4.1.5)
- `services/api/index.ts` barrel: sole consumer is `services/api/example-usage.ts:128` (deleted by Task 4.1.6)
- `services/kismet/index.ts` barrel: zero external consumers
- `services/index.ts` barrel: zero external consumers

---

## Task 4.1.1: Pre-Deletion Verification

**Purpose**: Independently verify every file targeted for deletion has zero active imports. This is the safety gate -- no file is deleted without passing this check.

**Estimated Duration**: 20 minutes

### Verification Command Pattern

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

### Batch Verification Script

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

### Expected Results

The following files will FAIL verification (they are alive) and must be excluded:

- `device_intelligence.ts` -- imported by `kismet_controller.ts:6`
- `security_analyzer.ts` -- imported by `kismet_controller.ts:5`

These are already excluded from the deletion lists below per the AMENDMENT above. If the verification script reports any additional failures, STOP and investigate before proceeding.

### Special Case: gridProcessor.ts

`gridProcessor.ts` will show a single `type`-only import from `heatmapService.ts:10`:

```
import type { GridCell } from './gridProcessor';
```

This is a type-only import. The file is eligible for deletion AFTER Task 4.1.4 migrates the `GridCell` type. The verification script will flag it; this is expected and handled by task ordering.

### Special Case: signalProcessor.ts and sweepAnalyzer.ts

These will show hits from their parent barrel `src/lib/services/hackrf/index.ts`. A barrel re-export without an external consumer is dead code. The barrel cleanup in Task 4.1.7 removes these re-exports.

### Special Case: deviceManager.ts

Will show a hit from `src/lib/services/kismet/index.ts`. Same barrel-only pattern. The barrel `src/lib/services/kismet/index.ts` itself has zero external consumers (verified: `grep -rn 'from.*\$lib/services/kismet' src/ --include="*.ts" --include="*.svelte"` returns 0 results). Task 4.1.7 handles barrel cleanup.

### Special Case: controlService.ts (hackrfsweep)

Will show a self-reference pattern (the file references its own exported `controlService` variable internally). No external consumers exist. Also imports from `$lib/services/hackrf/api` which is alive, but that is an outgoing dependency, not an incoming one.

### Gate Criteria

Proceed to Task 4.1.2 ONLY when:

1. The verification script exits with code 0 (after excluding known special cases)
2. All special cases have been manually reviewed and confirmed as barrel-only or type-only

---

## Task 4.1.2: Delete Confirmed Dead Files (Batch 1 -- Original Plan)

**Purpose**: Remove the 9 files from the original plan that are confirmed dead after false positive correction.

**Estimated Duration**: 15 minutes

**Commit**: `refactor: remove 9 dead service files identified by codebase audit (3,091 lines)`

### Files to Delete

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
| 9   | `src/lib/services/map/gridProcessor.ts`                      | 267   | Type-only import; Task 4.1.4 migrates type FIRST |

**Total**: 2,991 lines (gridProcessor deletion deferred to after Task 4.1.4)

**Subtotal without gridProcessor**: 2,724 lines

### Execution Order

1. Delete files 1-8 (no dependencies on each other)
2. File 9 (`gridProcessor.ts`) is deleted AFTER Task 4.1.4 completes the type migration
3. Run intermediate verification

### Commands

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

# Intermediate verification: build must still pass
npm run typecheck
```

### Post-Task Verification

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

# TypeScript compilation must succeed
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

---

## Task 4.1.3: Delete Additional Dead Files (Batch 2 -- Newly Discovered)

**Purpose**: Remove 12 dead files discovered during the comprehensive audit that were not in the original plan.

**Estimated Duration**: 15 minutes

**Commit**: `refactor: remove 12 additional dead files found by exhaustive import analysis (2,790 lines)`

### Files to Delete

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

### Commands

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

# Delete entire dead directory
rm -r src/lib/server/database/

# Intermediate verification
npm run typecheck
```

### Post-Task Verification

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

## Task 4.1.4: GridProcessor Type Migration

**Purpose**: Migrate ALL exported interfaces from `gridProcessor.ts` into `heatmapService.ts` so that `gridProcessor.ts` can be safely deleted.

**Estimated Duration**: 10 minutes

**Commit**: `refactor: inline gridProcessor types into heatmapService and delete gridProcessor.ts`

### Current State

File `src/lib/services/map/heatmapService.ts:10` contains:

```typescript
import type { GridCell } from './gridProcessor';
```

File `src/lib/services/map/gridProcessor.ts` exports FOUR interfaces that must ALL be migrated:

```
Lines 5-11:   export interface GridSignal { lat, lon, power, freq, timestamp }
Lines 13-18:  export interface GridBounds { minLat, maxLat, minLon, maxLon }
Lines 20-25:  export interface FrequencyInfo { freq, power, band, count }
Lines 27-53:  export interface GridCell { ... topFrequencies: FrequencyInfo[] ... }
```

**CRITICAL**: `GridCell` references `FrequencyInfo` (via `topFrequencies: FrequencyInfo[]`) and `GridBounds`. Migrating only `GridCell` without its dependencies will cause a TypeScript compilation error. All four interfaces must be migrated together.

### Migration Steps

**Step 1**: Read ALL exported interfaces from `gridProcessor.ts`.

```bash
# Extract all four interfaces
head -53 src/lib/services/map/gridProcessor.ts
```

**Step 2**: Copy ALL FOUR interface definitions (`GridSignal`, `GridBounds`, `FrequencyInfo`, `GridCell`) into `heatmapService.ts`, replacing the import statement.

In `src/lib/services/map/heatmapService.ts`, replace:

```typescript
import type { GridCell } from './gridProcessor';
```

with the full interface definitions for `GridSignal`, `GridBounds`, `FrequencyInfo`, and `GridCell` (copied verbatim from `gridProcessor.ts` lines 5-53).

**Step 3**: Verify no other files import from `gridProcessor`.

```bash
grep -rn "from.*gridProcessor" src/ --include="*.ts" --include="*.svelte"
# Must return 0 results after the import replacement
```

**Step 4**: Delete `gridProcessor.ts`.

```bash
rm src/lib/services/map/gridProcessor.ts
```

**Step 5**: Verify.

```bash
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

### Verification

```bash
# All four interfaces should now be defined in heatmapService.ts
grep -n "interface GridCell\|interface GridBounds\|interface FrequencyInfo\|interface GridSignal" \
  src/lib/services/map/heatmapService.ts
# Expected: 4 results (one for each interface)

# No remaining imports from gridProcessor
grep -rn "gridProcessor" src/ --include="*.ts" --include="*.svelte"
# Expected: 0 results

# Build passes
npm run typecheck
```

---

## Task 4.1.5: Remove Test Route Directories

**Purpose**: Remove 8 test/debug route directories that are publicly routable in production. This is a security-relevant cleanup.

**Estimated Duration**: 10 minutes

**Commit**: `fix(security): remove 8 publicly routable test/debug route directories (927 lines)`

### Directories to Delete

| #   | Directory                      | Files | Lines | Security Risk                                 |
| --- | ------------------------------ | ----- | ----- | --------------------------------------------- |
| 1   | `src/routes/test/`             | 1     | 300   | Exposes internal test page at `/test`         |
| 2   | `src/routes/test-simple/`      | 1     | 49    | Exposes test page at `/test-simple`           |
| 3   | `src/routes/test-map/`         | 1     | 14    | Exposes test page at `/test-map`              |
| 4   | `src/routes/test-hackrf-stop/` | 1     | 93    | Exposes HackRF control at `/test-hackrf-stop` |
| 5   | `src/routes/test-time-filter/` | 1     | 138   | Exposes test page at `/test-time-filter`      |
| 6   | `src/routes/test-db-client/`   | 1     | 132   | Exposes database client at `/test-db-client`  |
| 7   | `src/routes/api/test/`         | 1     | 42    | Exposes test API at `/api/test`               |
| 8   | `src/routes/api/test-db/`      | 1     | 53    | Exposes database API at `/api/test-db`        |

**Total**: 8 directories, ~821 lines (page routes + API routes)

**NOTE**: `src/routes/api/debug/` is intentionally RETAINED. It provides field diagnostics functionality needed during deployment.

### Pre-Deletion Check

Verify no live route imports from test routes:

```bash
# Check if any non-test file imports from test route directories
grep -rn "test-hackrf-stop\|test-simple\|test-map\|test-time-filter\|test-db-client" \
  src/ --include="*.ts" --include="*.svelte" \
  | grep -v "^src/routes/test"
# Must return 0 results
```

### Commands

```bash
rm -r src/routes/test/
rm -r src/routes/test-simple/
rm -r src/routes/test-map/
rm -r src/routes/test-hackrf-stop/
rm -r src/routes/test-time-filter/
rm -r src/routes/test-db-client/
rm -r src/routes/api/test/
rm -r src/routes/api/test-db/
```

### Post-Task Verification

```bash
# Confirm directories are gone
for d in \
  src/routes/test \
  src/routes/test-simple \
  src/routes/test-map \
  src/routes/test-hackrf-stop \
  src/routes/test-time-filter \
  src/routes/test-db-client \
  src/routes/api/test \
  src/routes/api/test-db; do
  [ -d "$d" ] && echo "ERROR: $d still exists" || echo "OK: $d deleted"
done

# Debug routes should still exist
[ -d "src/routes/api/debug" ] && echo "OK: debug/ retained" || echo "ERROR: debug/ was deleted"

# Build must pass
npm run typecheck 2>&1 | tail -5
```

---

## Task 4.1.6: Remove Example/Test Files

**Purpose**: Remove 5 example and test utility files that are not part of the test suite and have no production consumers.

**Estimated Duration**: 5 minutes

**Commit**: `refactor: remove 5 example/test utility files (708 lines)`

### Files to Delete

| #   | File                                                            | Lines | Verification                                        |
| --- | --------------------------------------------------------------- | ----- | --------------------------------------------------- |
| 1   | `src/lib/services/websocket/test-connection.ts`                 | 109   | Test utility, zero imports                          |
| 2   | `src/lib/services/localization/coral/integration-example.ts`    | 75    | Example code, zero imports                          |
| 3   | `src/lib/services/api/example-usage.ts`                         | 173   | Example code, zero imports                          |
| 4   | `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 219   | Example tools, zero imports                         |
| 5   | `src/routes/tactical-map-simple/integration-example.svelte`     | 132   | Example component, not referenced by `+page.svelte` |

**Total**: 708 lines

### Pre-Deletion Check

```bash
for f in \
  src/lib/services/websocket/test-connection.ts \
  src/lib/services/localization/coral/integration-example.ts \
  src/lib/services/api/example-usage.ts \
  src/lib/server/agent/tool-execution/examples/example-tools.ts \
  src/routes/tactical-map-simple/integration-example.svelte; do

  BASENAME=$(basename "$f" | sed 's/\.\(ts\|svelte\)$//')
  HITS=$(grep -rn "$BASENAME" src/ --include="*.ts" --include="*.svelte" | grep -v "^${f}:" | grep -v "example" || true)
  if [ -n "$HITS" ]; then
    echo "WARN: $f may have consumers:"
    echo "$HITS"
  else
    echo "PASS: $f is dead"
  fi
done
```

### Commands

```bash
rm src/lib/services/websocket/test-connection.ts
rm src/lib/services/localization/coral/integration-example.ts
rm src/lib/services/api/example-usage.ts
rm src/lib/server/agent/tool-execution/examples/example-tools.ts
rm src/routes/tactical-map-simple/integration-example.svelte
```

### Post-Task Verification

```bash
for f in \
  src/lib/services/websocket/test-connection.ts \
  src/lib/services/localization/coral/integration-example.ts \
  src/lib/services/api/example-usage.ts \
  src/lib/server/agent/tool-execution/examples/example-tools.ts \
  src/routes/tactical-map-simple/integration-example.svelte; do
  [ -f "$f" ] && echo "ERROR: $f still exists" || echo "OK: $f deleted"
done

npm run typecheck 2>&1 | tail -5
```

---

## Task 4.1.7: Clean Up Orphaned Barrel Exports and Empty Directories

**Purpose**: After file deletions, barrel `index.ts` files may reference deleted modules. These broken re-exports will cause TypeScript compilation errors. This task removes them. Additionally, any directories left empty by file deletions are removed.

**Estimated Duration**: 20 minutes

**Commit**: `refactor: clean up orphaned barrel exports and empty directories after dead code removal`

### Barrel Files Requiring Edits

**File 1**: `src/lib/services/hackrf/index.ts`

Remove the re-exports for deleted `sweepAnalyzer` and `signalProcessor`:

```typescript
// REMOVE these two lines:
export { sweepAnalyzer } from './sweepAnalyzer';
export { signalProcessor } from './signalProcessor';
```

Verification after edit:

```bash
# Barrel should only export hackrfService and types
grep -n "export" src/lib/services/hackrf/index.ts
# Expected: hackrfService export + type re-exports only
```

**File 2**: `src/lib/services/kismet/index.ts`

Remove the re-export for deleted `deviceManager`:

```typescript
// REMOVE this line:
export { deviceManager } from './deviceManager';
```

Verification after edit:

```bash
grep -n "export" src/lib/services/kismet/index.ts
# Expected: kismetService export + type re-exports only
```

### Dead Barrel Files to Delete

The following barrel files themselves have zero external consumers (after Tasks 4.1.5 and 4.1.6 remove their sole consumers) and should be deleted entirely:

| File                                  | Lines | Reason                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/kismet/index.ts`    | 15    | Zero external importers (verified: `grep -rn 'from.*\$lib/services/kismet' src/` returns 0)                                                                                                                                                                               |
| `src/lib/services/websocket/index.ts` | 108   | Only consumer was `routes/test/+page.svelte:3` (deleted in Task 4.1.5). **NOTE**: This is not a simple re-export file -- it contains a full `WebSocketManager` class (singleton pattern, lifecycle methods, connection management). It becomes orphaned after Task 4.1.5. |
| `src/lib/services/api/index.ts`       | 38    | Only consumer was `services/api/example-usage.ts:128` (deleted in Task 4.1.6)                                                                                                                                                                                             |
| `src/lib/services/index.ts`           | 23    | Zero external importers                                                                                                                                                                                                                                                   |

**Total barrel lines**: 184

### Additional Dead File: `src/lib/services/api/hackrf.ts`

This file (separate from the live `src/lib/services/hackrf/api.ts`) re-exports a `hackrfAPI` client through the `services/api/index.ts` barrel. Since the barrel is dead (above), this file is also dead. It has zero direct importers outside the barrel.

| File                             | Lines | Reason                                                |
| -------------------------------- | ----- | ----------------------------------------------------- |
| `src/lib/services/api/hackrf.ts` | ~38   | Only consumed via dead `services/api/index.ts` barrel |

Delete alongside the barrel.

**Pre-deletion verification for each barrel**:

```bash
# For each barrel file, verify zero external consumers AFTER previous deletions
grep -rn "from.*\$lib/services/kismet'" src/ --include="*.ts" --include="*.svelte"
grep -rn "from.*\$lib/services/websocket'" src/ --include="*.ts" --include="*.svelte"
grep -rn "from.*\$lib/services/api'" src/ --include="*.ts" --include="*.svelte"
grep -rn "from.*\$lib/services'" src/ --include="*.ts" --include="*.svelte"
# ALL must return 0 results
```

**NOTE**: Only delete a barrel if ALL of its remaining re-exports are also dead. If a barrel still re-exports live modules (like `hackrf/index.ts` still exports `hackrfService`), edit the barrel instead of deleting it.

### Empty Directory Cleanup

After all deletions, check for empty directories:

```bash
find src/ -type d -empty -print
```

Remove any empty directories found:

```bash
find src/ -type d -empty -delete
```

Likely candidates:

- `src/lib/server/database/` (already deleted in Task 4.1.3)
- `src/lib/server/agent/tool-execution/examples/` (if `example-tools.ts` was the only file)
- `src/routes/test*/` directories (already deleted in Task 4.1.5)

### Post-Task Verification

```bash
# No empty directories in src/
find src/ -type d -empty | wc -l
# Expected: 0

# No broken imports referencing deleted files
npm run typecheck 2>&1 | tail -10
# Expected: "0 errors"

# Full build passes
npm run build 2>&1 | tail -10
# Expected: successful build
```

---

## Risk Assessment

| Risk                                                          | Likelihood | Impact               | Mitigation                                                                         |
| ------------------------------------------------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------- |
| File listed as dead has an active consumer not caught by grep | LOW        | HIGH (build break)   | Task 4.1.1 pre-deletion verification; `npm run typecheck` after each batch         |
| Barrel edit introduces syntax error                           | LOW        | MEDIUM (build break) | Immediate `npm run typecheck` after barrel edits                                   |
| Dynamic import not caught by static grep                      | LOW        | HIGH (runtime crash) | Grep pattern includes `import()` syntax; manual review of `await import(` patterns |
| Type migration changes interface shape                        | LOW        | MEDIUM (type errors) | Copy interface verbatim; `npm run typecheck` confirms compatibility                |
| Empty directory causes tooling issues                         | VERY LOW   | LOW                  | `find -empty -delete` cleanup in Task 4.1.7                                        |
| Test route removal breaks E2E tests                           | MEDIUM     | LOW (test-only)      | Check `tests/` for references to `/test` routes before deletion                    |
| Deleted file referenced in `tsconfig.json` includes/excludes  | LOW        | LOW                  | Check tsconfig after deletions                                                     |

### High-Risk Files (Extra Scrutiny Required)

1. **`src/lib/services/hackrf/signalProcessor.ts`** -- Barrel-exported by a live barrel. Deletion requires simultaneous barrel edit. Execute barrel edit and file deletion in the same commit.

2. **`src/lib/services/hackrf/sweepAnalyzer.ts`** -- Same pattern as signalProcessor. Same mitigation.

3. **`src/lib/services/kismet/deviceManager.ts`** -- Barrel-exported by a potentially dead barrel. Verify the barrel has zero consumers AFTER test route deletions (Task 4.1.5 removes possible consumers).

4. **`src/lib/services/map/gridProcessor.ts`** -- Has a type-only import. Must complete Task 4.1.4 (type migration) before deletion. If type migration introduces errors, STOP and investigate.

---

## Verification Checklist

Execute these commands after ALL tasks are complete. Every check must pass.

### 1. TypeScript Compilation

```bash
npm run typecheck 2>&1 | tail -5
# REQUIRED: "0 errors" or "Found 0 errors"
```

### 2. Production Build

```bash
npm run build 2>&1 | tail -10
# REQUIRED: Build completes successfully
```

### 3. No Broken Imports

```bash
# Search for imports referencing any deleted file
grep -rn "flightPathAnalyzer\|aiPatternDetector\|altitudeLayerManager\|contourGenerator\|CoralAccelerator.v2\|systemService\|cellTowerService\|gridProcessor\|dataAccessLayer\|gsm-evil/server\|agent/runtime\|signalProcessor\|sweepAnalyzer\|controlService\|frequencyService\|server/database\|networkInterfaces\|deviceManager" \
  src/ --include="*.ts" --include="*.svelte" \
  | grep -v "node_modules" \
  | grep -v "\.md$" \
  | grep -v "plans/"
# REQUIRED: 0 results (or only references in comments/strings, not imports)
```

### 4. No Empty Directories

```bash
find src/ -type d -empty
# REQUIRED: 0 results
```

### 5. Deleted File Count

```bash
# Count deleted files via git
git diff --stat HEAD --diff-filter=D -- src/ | tail -1
# EXPECTED: ~35 files deleted
```

### 6. Line Count Reduction

```bash
# Total lines removed
git diff HEAD --stat --diff-filter=D -- src/ | grep "deletion" | awk '{print $4}'
# EXPECTED: approximately 7,200-7,500 lines (excluding test routes and example files in separate counts)
```

### 7. Test Routes Gone

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test 2>/dev/null || echo "Server not running (OK for offline verification)"
# If server is running: REQUIRED: 404
# Verify directories don't exist:
ls -d src/routes/test* src/routes/api/test* 2>/dev/null | wc -l
# REQUIRED: 0
```

### 8. Debug Routes Retained

```bash
[ -d "src/routes/api/debug" ] && echo "PASS: debug/ retained" || echo "FAIL: debug/ was incorrectly deleted"
# REQUIRED: PASS
```

### 9. Lint Check

```bash
npm run lint 2>&1 | tail -5
# REQUIRED: No new errors introduced
```

---

## Rollback Strategy

### Before Starting

```bash
# Create a safety tag before any deletions
git tag pre-phase-4.1-backup
```

### If TypeScript Errors After a Batch

```bash
# Revert the current batch only
git checkout -- src/
# Or restore specific files:
git checkout HEAD -- <file_path>
```

### Full Rollback

```bash
# Reset to the pre-deletion state
git reset --hard pre-phase-4.1-backup
```

### Partial Rollback (Restore Single File)

```bash
git checkout pre-phase-4.1-backup -- <file_path>
```

### Post-Rollback Verification

```bash
npm run typecheck && npm run build
# Both must pass after rollback
```

---

## Summary of Changes

| Task                               | Files Deleted                       | Lines Removed         | Commits |
| ---------------------------------- | ----------------------------------- | --------------------- | ------- |
| 4.1.2 Batch 1 (original plan)      | 8 (+1 deferred)                     | 2,724 (+267 deferred) | 1       |
| 4.1.3 Batch 2 (newly discovered)   | 12                                  | 2,790                 | 1       |
| 4.1.4 GridProcessor type migration | 1                                   | 267                   | 1       |
| 4.1.5 Test route directories       | 8 dirs (~8 files)                   | ~821                  | 1       |
| 4.1.6 Example/test files           | 5                                   | 708                   | 1       |
| 4.1.7 Barrel cleanup + empty dirs  | 4 barrels deleted + 1 dead api file | 184 + ~38 = 222       | 1       |
| **TOTAL**                          | **~36 files + 8 directories**       | **~7,532**            | **6**   |

**NOTE**: The original estimate of ~9,600 lines was based on the pre-correction data that included `device_intelligence.ts` (930 lines) and `security_analyzer.ts` (813 lines) as dead. After the AMENDMENT correction removing these two false positives, the revised total is approximately **7,360 lines**. This is still a substantial cleanup representing approximately 4.1% of the total codebase.

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

## Appendix B: Files From Dead Code Audit Not Addressed in Phase 4.1

The full dead code audit (`plans/dead-code-audit-2026-02-08.md`) identified 104 dead files totaling 24,088 lines. This phase addresses approximately 35 files (~7,360 lines). The remaining ~69 dead files (~16,728 lines) fall into categories that require separate phases:

- **Dead Svelte Components** (36 files, 8,419 lines) -- Phase 4.2
- **Dead Server Modules beyond Kismet/Database** (MCP dead barrel, websocket-server.ts, etc.) -- Phase 4.3
- **Dead Database/Config/Utils/Types** (dal.ts, migrations, logging, etc.) -- Phase 4.4
- **Dead Stores** (packetAnalysisStore.ts, 370 lines) -- Phase 4.5
- **Dead Service Island** (serviceInitializer + systemHealth + dataStreamManager + errorRecovery, 1,830 lines) -- Phase 4.6

These are deferred because they require additional analysis (component usage in `.svelte` files requires different grep patterns than TypeScript imports) or involve interconnected deletion chains that need their own dependency graphs.
