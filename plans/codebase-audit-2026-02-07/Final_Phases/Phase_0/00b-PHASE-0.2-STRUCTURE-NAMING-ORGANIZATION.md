# Phase 0.2: Structure, Naming, and Module Organization (REVISED)

**Risk Level**: LOW-MEDIUM -- File renames, moves, import path updates, barrel export creation. No logic changes, but import rewiring touches many files.
**Prerequisites**: Phase 0.1 MUST be complete (dead code removed, git hygiene established).
**Blocks**: ALL subsequent phases (1-7) depend on this structure being finalized.
**Standards**: Modeled after Immich (91k stars), HuggingFace chat-ui, Twenty CRM -- verified enterprise SvelteKit patterns.
**Revision Date**: 2026-02-08
**Revision Reason**: Original plan (2026-02-07) covered 31% of naming violations (33/106) and 4% of architecture boundary violations (3/52). This revision achieves 100% coverage.
**Verification Method**: Every file path verified against live codebase by 3 parallel investigation agents scanning all of `src/lib/` and `src/routes/`. Totals cross-checked against independent audit from 2026-02-08.

---

## Commit Strategy

**MANDATORY**: Each Task produces exactly ONE atomic commit. Subtasks are executed sequentially within each Task. The commit occurs only after ALL subtasks within that Task are complete and the verification gate passes.

| Task | Commit Message                                                            | Verification Gate                                  |
| ---- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| 0.2  | `refactor: relocate 5 misplaced files from routes/ to lib/`               | `npm run typecheck && npm run build`               |
| 0.3  | `refactor: enforce kebab-case naming across 106 files`                    | `npm run typecheck` after each batch of 10 renames |
| 0.4  | `refactor: consolidate directories, flatten sweep-manager depth`          | `npm run typecheck && npm run build`               |
| 0.5  | `refactor: create barrel exports for all module directories`              | `npm run typecheck && npm run build`               |
| 0.6  | `refactor: consolidate type system, fix 30 type-only boundary violations` | `npm run typecheck`                                |
| 0.7  | `refactor: standardize import paths to $lib/ aliases`                     | `npm run typecheck && npm run build`               |
| 0.8  | `refactor: create shared component directory`                             | `npm run typecheck && npm run build`               |
| 0.9  | `chore: clean root files, move vite plugin to config/`                    | `npm run typecheck && npm run build`               |

**Rollback procedure**: If any verification gate fails, run `git checkout -- .` to discard unstaged changes. If a commit was already made and verification fails afterward, run `git revert HEAD`. The `v-pre-consolidation` tag from Phase 0.1 remains the hard recovery point.

---

## Enterprise Target Architecture

Based on analysis of Immich (immich-app/immich), HuggingFace (huggingface/chat-ui), and Twenty (twentyhq/twenty):

```
src/
+-- lib/
|   +-- components/           # Feature-based, PascalCase .svelte, barrel exports per domain
|   |   +-- shared/           # Cross-domain reusable components
|   |   +-- hackrf/           # Feature domain
|   |   +-- kismet/
|   |   +-- {domain}/
|   +-- services/             # Business logic, kebab-case .ts files
|   |   +-- hackrf/
|   |   +-- {domain}/
|   +-- stores/               # State management, kebab-case, flat per domain
|   +-- server/               # Server-only code, never imports from stores/components
|   |   +-- db/
|   |   +-- hardware/
|   |   +-- {domain}/
|   +-- types/                # SINGLE canonical type location, barrel exported
|   +-- utils/                # Utility functions, kebab-case
|   +-- constants/            # Application constants
|   +-- config/               # Runtime configuration
|   +-- data/                 # Static data files
+-- routes/
|   +-- api/                  # Thin controller layer only -- delegates to server/services
|   |   +-- {domain}/
|   +-- {feature}/            # Page routes -- orchestration only, <400 lines
+-- hooks.server.ts
+-- app.html
```

**Naming Rules** (enforced by ESLint post-migration):

| File Type            | Convention           | Example                 |
| -------------------- | -------------------- | ----------------------- |
| `.svelte` components | PascalCase           | `SweepControl.svelte`   |
| `.ts` modules        | kebab-case           | `sweep-manager.ts`      |
| `.ts` types          | kebab-case           | `hackrf-types.ts`       |
| `.ts` stores         | kebab-case           | `hackrf-store.ts`       |
| `.ts` services       | kebab-case           | `hackrf-service.ts`     |
| `.test.ts` tests     | kebab-case + `.test` | `sweep-manager.test.ts` |
| Barrel exports       | `index.ts`           | `index.ts`              |
| Directories          | kebab-case           | `sweep-manager/`        |

---

## Task 0.2: Relocate Misplaced Files

**Rationale**: 5 files in `src/routes/` contain business logic or components that belong in `src/lib/`. 1 service imports from routes (architecture violation). These violate the SvelteKit convention that `routes/` contains only routing glue (page components, layout files, `+server.ts` API handlers that delegate to services).

### Subtask 0.2.1: Move Components Out of Routes

| #   | Current Path                                                | Target Path                                           | Lines | Importers to Update                                                                      |
| --- | ----------------------------------------------------------- | ----------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| 1   | `src/routes/gsm-evil/IMSIDisplay.svelte`                    | `src/lib/components/gsm-evil/IMSIDisplay.svelte`      | 221   | Zero importers (dead component -- consider deleting in Phase 0.1 if not already covered) |
| 2   | `src/routes/gsm-evil/LocalIMSIDisplay.svelte`               | `src/lib/components/gsm-evil/LocalIMSIDisplay.svelte` | 358   | Zero importers (dead component -- consider deleting in Phase 0.1 if not already covered) |
| 3   | `src/routes/tactical-map-simple/integration-example.svelte` | DELETE (documentation artifact, zero importers)       | 132   | None                                                                                     |

**DECISION REQUIRED for items 1-2**: Both IMSIDisplay.svelte and LocalIMSIDisplay.svelte have ZERO importers. If these were not included in Phase 0.1 dead code removal, they should be deleted here rather than relocated. Run verification:

```bash
grep -rn "IMSIDisplay\|LocalIMSIDisplay" src/ --include="*.ts" --include="*.svelte" | grep -v "^src/routes/gsm-evil/"
```

If the output is empty (no importers outside their own directory), DELETE both files.

**Process for relocation (if kept)**:

```bash
mkdir -p src/lib/components/gsm-evil/
git mv src/routes/gsm-evil/IMSIDisplay.svelte src/lib/components/gsm-evil/IMSIDisplay.svelte
git mv src/routes/gsm-evil/LocalIMSIDisplay.svelte src/lib/components/gsm-evil/LocalIMSIDisplay.svelte
```

### Subtask 0.2.2: Move Services Out of Routes

| #   | Current Path                                         | Target Path                                    | Lines | Importers to Update                                                                                                |
| --- | ---------------------------------------------------- | ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | `src/routes/tactical-map-simple/SignalAggregator.ts` | `src/lib/services/map/signal-aggregator.ts`    | 108   | `src/routes/tactical-map-simple/+page.svelte` (line 6), `src/lib/services/tactical-map/hackrfService.ts` (line 11) |
| 2   | `src/routes/tactical-map-simple/rssi-integration.ts` | `src/lib/services/map/rssi-map-integration.ts` | 220   | Zero importers (unused -- DELETE or relocate as dead code)                                                         |

**Process**:

```bash
git mv src/routes/tactical-map-simple/SignalAggregator.ts src/lib/services/map/signal-aggregator.ts
# Update ALL importers:
# 1. src/routes/tactical-map-simple/+page.svelte line 6:
#    OLD: import { SignalAggregator } from './SignalAggregator';
#    NEW: import { SignalAggregator } from '$lib/services/map/signal-aggregator';
# 2. src/lib/services/tactical-map/hackrfService.ts line 11:
#    OLD: import { SignalAggregator } from '../../../routes/tactical-map-simple/SignalAggregator';
#    NEW: import { SignalAggregator } from '$lib/services/map/signal-aggregator';
```

**For rssi-integration.ts**: Run `grep -rn "rssi-integration\|rssi_integration\|RSSIMapIntegration" src/` to confirm zero importers. If confirmed, DELETE.

### Subtask 0.2.3: Fix Architecture Violation (Service Importing from Routes)

**File**: `src/lib/services/tactical-map/hackrfService.ts` line 11
**Current**: `import { SignalAggregator } from '../../../routes/tactical-map-simple/SignalAggregator'`
**Fix**: After Subtask 0.2.2 completes, update to:

```typescript
import { SignalAggregator } from '$lib/services/map/signal-aggregator';
```

This is a dependency of Subtask 0.2.2. Do NOT execute this subtask independently.

### Subtask 0.2.4: Move Shared Modal to Shared Domain

**Issue**: `HardwareConflictModal` in `components/hardware/` is imported by `bettercap/BettercapDashboard.svelte` and `companion/CompanionLauncher.svelte` -- cross-domain coupling indicates this is a shared component.

**Action**:

```bash
mkdir -p src/lib/components/shared/
git mv src/lib/components/hardware/HardwareConflictModal.svelte src/lib/components/shared/HardwareConflictModal.svelte
```

**Update imports in all 3 consumers**:

1. `src/lib/components/hardware/` (any file importing it)
2. `src/lib/components/bettercap/BettercapDashboard.svelte`
3. `src/lib/components/companion/CompanionLauncher.svelte`

**Verification**: `grep -rn "HardwareConflictModal" src/ --include="*.ts" --include="*.svelte"` -- all results should reference `$lib/components/shared/`.

### Task 0.2 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
# Verify no services import from routes:
grep -rn "from.*routes/" src/lib/services/ --include="*.ts" | wc -l  # Must be 0
# Verify no business logic files in routes (only +prefixed files):
find src/routes -name "*.ts" -not -name "+*" -not -name "*.d.ts" | wc -l  # Must be 0
find src/routes -name "*.svelte" -not -name "+*" -not -name "*.d.ts" | wc -l  # Must be 0
```

---

## Task 0.3: Naming Convention Enforcement

**Rationale**: 106 files violate the kebab-case naming convention for `.ts` files. This creates inconsistency that a MISRA or Barr C reviewer would flag immediately. Enterprise codebases (Immich, Twenty, HuggingFace) enforce a single naming convention uniformly.

**Process for every rename**:

1. `git mv old-name.ts new-name.ts`
2. Find all importers: `grep -rn "old-name\|oldName" src/ --include="*.ts" --include="*.svelte"`
3. Update every import path
4. Run `npm run typecheck` after each batch of 10 renames

### Subtask 0.3.1: Rename snake_case Server/Kismet Files (8 files)

All in `src/lib/server/kismet/`:

| #   | Current                    | New                        | Importers (find with grep)              |
| --- | -------------------------- | -------------------------- | --------------------------------------- |
| 1   | `alfa_detector.ts`         | `alfa-detector.ts`         | `grep -rn "alfa_detector" src/`         |
| 2   | `api_client.ts`            | `api-client.ts`            | `grep -rn "api_client" src/`            |
| 3   | `device_intelligence.ts`   | `device-intelligence.ts`   | `grep -rn "device_intelligence" src/`   |
| 4   | `device_tracker.ts`        | `device-tracker.ts`        | `grep -rn "device_tracker" src/`        |
| 5   | `fusion_controller.ts`     | `fusion-controller.ts`     | `grep -rn "fusion_controller" src/`     |
| 6   | `kismet_controller.ts`     | `kismet-controller.ts`     | `grep -rn "kismet_controller" src/`     |
| 7   | `security_analyzer.ts`     | `security-analyzer.ts`     | `grep -rn "security_analyzer" src/`     |
| 8   | `wifi_adapter_detector.ts` | `wifi-adapter-detector.ts` | `grep -rn "wifi_adapter_detector" src/` |

### Subtask 0.3.2: Rename snake_case Server/Other Files (1 file)

| #   | Current                                | New                                    |
| --- | -------------------------------------- | -------------------------------------- |
| 1   | `server/gnuradio/spectrum_analyzer.ts` | `server/gnuradio/spectrum-analyzer.ts` |

### Subtask 0.3.3: Rename camelCase Server/Kismet Files (4 files)

All in `src/lib/server/kismet/`:

| #   | Current               | New                     |
| --- | --------------------- | ----------------------- |
| 1   | `kismetProxy.ts`      | `kismet-proxy.ts`       |
| 2   | `scriptManager.ts`    | `script-manager.ts`     |
| 3   | `serviceManager.ts`   | `service-manager.ts`    |
| 4   | `webSocketManager.ts` | `web-socket-manager.ts` |

### Subtask 0.3.4: Rename camelCase Server/DB Files (6 files)

All in `src/lib/server/db/`:

| #   | Current                | New                     |
| --- | ---------------------- | ----------------------- |
| 1   | `dbOptimizer.ts`       | `db-optimizer.ts`       |
| 2   | `spatialRepository.ts` | `spatial-repository.ts` |
| 3   | `networkRepository.ts` | `network-repository.ts` |
| 4   | `deviceService.ts`     | `device-service.ts`     |
| 5   | `signalRepository.ts`  | `signal-repository.ts`  |
| 6   | `cleanupService.ts`    | `cleanup-service.ts`    |

### Subtask 0.3.5: Rename camelCase Server/Hardware Files (3 files)

All in `src/lib/server/hardware/`:

| #   | Current              | New                   |
| --- | -------------------- | --------------------- |
| 1   | `hackrfManager.ts`   | `hackrf-manager.ts`   |
| 2   | `alfaManager.ts`     | `alfa-manager.ts`     |
| 3   | `resourceManager.ts` | `resource-manager.ts` |

### Subtask 0.3.6: Rename camelCase Server Misc Files (8 files)

| #   | Current                             | New                                  |
| --- | ----------------------------------- | ------------------------------------ |
| 1   | `server/hostExec.ts`                | `server/host-exec.ts`                |
| 2   | `server/toolChecker.ts`             | `server/tool-checker.ts`             |
| 3   | `server/networkInterfaces.ts`       | `server/network-interfaces.ts`       |
| 4   | `server/hackrf/sweepManager.ts`     | `server/hackrf/sweep-manager.ts`     |
| 5   | `server/usrp/sweepManager.ts`       | `server/usrp/sweep-manager.ts`       |
| 6   | `server/bettercap/apiClient.ts`     | `server/bettercap/api-client.ts`     |
| 7   | `server/pagermon/processManager.ts` | `server/pagermon/process-manager.ts` |
| 8   | `server/btle/processManager.ts`     | `server/btle/process-manager.ts`     |

### Subtask 0.3.7: Rename camelCase Server/Wifite Files (1 file)

| #   | Current                           | New                                |
| --- | --------------------------------- | ---------------------------------- |
| 1   | `server/wifite/processManager.ts` | `server/wifite/process-manager.ts` |

**Server subtotal: 31 files renamed** (8 + 1 + 4 + 6 + 3 + 8 + 1)

### Subtask 0.3.8: Rename PascalCase Service Files (10 files)

| #   | Current                                                      | New                        | Lines |
| --- | ------------------------------------------------------------ | -------------------------- | ----- |
| 1   | `services/hackrf/sweep-manager/buffer/BufferManager.ts`      | `buffer-manager.ts`        | 503   |
| 2   | `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | `error-tracker.ts`         | 97    |
| 3   | `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | `frequency-cycler.ts`      | 423   |
| 4   | `services/hackrf/sweep-manager/process/ProcessManager.ts`    | `process-manager.ts`       | 413   |
| 5   | `services/usrp/sweep-manager/buffer/BufferManager.ts`        | `buffer-manager.ts`        | 504   |
| 6   | `services/usrp/sweep-manager/process/ProcessManager.ts`      | `process-manager.ts`       | 360   |
| 7   | `services/localization/RSSILocalizer.ts`                     | `rssi-localizer.ts`        | 172   |
| 8   | `services/localization/HybridRSSILocalizer.ts`               | `hybrid-rssi-localizer.ts` | 103   |
| 9   | `services/localization/coral/CoralAccelerator.ts`            | `coral-accelerator.ts`     | 157   |
| 10  | `services/localization/coral/CoralAccelerator.v2.ts`         | `coral-accelerator-v2.ts`  | 277   |

### Subtask 0.3.9: Rename camelCase Service/Hackrf Files (4 files)

All in `src/lib/services/hackrf/`:

| #   | Current               | New                     |
| --- | --------------------- | ----------------------- |
| 1   | `timeWindowFilter.ts` | `time-window-filter.ts` |
| 2   | `sweepAnalyzer.ts`    | `sweep-analyzer.ts`     |
| 3   | `signalProcessor.ts`  | `signal-processor.ts`   |
| 4   | `hackrfService.ts`    | `hackrf-service.ts`     |

### Subtask 0.3.10: Rename camelCase Service/Hackrfsweep Files (4 files)

All in `src/lib/services/hackrfsweep/`:

| #   | Current               | New                    |
| --- | --------------------- | ---------------------- |
| 1   | `displayService.ts`   | `display-service.ts`   |
| 2   | `frequencyService.ts` | `frequency-service.ts` |
| 3   | `signalService.ts`    | `signal-service.ts`    |
| 4   | `controlService.ts`   | `control-service.ts`   |

### Subtask 0.3.11: Rename camelCase Service/Map Files (14 files)

All in `src/lib/services/map/`:

| #   | Current                   | New                         |
| --- | ------------------------- | --------------------------- |
| 1   | `aiPatternDetector.ts`    | `ai-pattern-detector.ts`    |
| 2   | `altitudeLayerManager.ts` | `altitude-layer-manager.ts` |
| 3   | `contourGenerator.ts`     | `contour-generator.ts`      |
| 4   | `droneDetection.ts`       | `drone-detection.ts`        |
| 5   | `gridProcessor.ts`        | `grid-processor.ts`         |
| 6   | `heatmapService.ts`       | `heatmap-service.ts`        |
| 7   | `kismetRSSIService.ts`    | `kismet-rssi-service.ts`    |
| 8   | `mapUtils.ts`             | `map-utils.ts`              |
| 9   | `networkAnalyzer.ts`      | `network-analyzer.ts`       |
| 10  | `performanceMonitor.ts`   | `performance-monitor.ts`    |
| 11  | `signalClustering.ts`     | `signal-clustering.ts`      |
| 12  | `signalFiltering.ts`      | `signal-filtering.ts`       |
| 13  | `signalInterpolation.ts`  | `signal-interpolation.ts`   |
| 14  | `webglHeatmapRenderer.ts` | `webgl-heatmap-renderer.ts` |

### Subtask 0.3.12: Rename camelCase Service/Tactical-Map Files (6 files)

All in `src/lib/services/tactical-map/`:

| #   | Current               | New                     |
| --- | --------------------- | ----------------------- |
| 1   | `cellTowerService.ts` | `cell-tower-service.ts` |
| 2   | `gpsService.ts`       | `gps-service.ts`        |
| 3   | `hackrfService.ts`    | `hackrf-service.ts`     |
| 4   | `kismetService.ts`    | `kismet-service.ts`     |
| 5   | `mapService.ts`       | `map-service.ts`        |
| 6   | `systemService.ts`    | `system-service.ts`     |

### Subtask 0.3.13: Rename camelCase Service/Other Files (7 files)

| #   | Current                                | New                                      |
| --- | -------------------------------------- | ---------------------------------------- |
| 1   | `services/db/signalDatabase.ts`        | `services/db/signal-database.ts`         |
| 2   | `services/db/dataAccessLayer.ts`       | `services/db/data-access-layer.ts`       |
| 3   | `services/kismet/kismetService.ts`     | `services/kismet/kismet-service.ts`      |
| 4   | `services/kismet/deviceManager.ts`     | `services/kismet/device-manager.ts`      |
| 5   | `services/drone/flightPathAnalyzer.ts` | `services/drone/flight-path-analyzer.ts` |
| 6   | `services/wigletotak/wigleService.ts`  | `services/wigletotak/wigle-service.ts`   |
| 7   | `services/gsm/protocolParser.ts`       | `services/gsm/protocol-parser.ts`        |

### Subtask 0.3.14: Rename camelCase Service Root + Single-Dir Files (4 files)

| #   | Current                                   | New                                         |
| --- | ----------------------------------------- | ------------------------------------------- |
| 1   | `services/serviceInitializer.ts`          | `services/service-initializer.ts`           |
| 2   | `services/monitoring/systemHealth.ts`     | `services/monitoring/system-health.ts`      |
| 3   | `services/recovery/errorRecovery.ts`      | `services/recovery/error-recovery.ts`       |
| 4   | `services/streaming/dataStreamManager.ts` | `services/streaming/data-stream-manager.ts` |

**Services subtotal: 49 files renamed** (10 + 4 + 4 + 14 + 6 + 7 + 4)

### Subtask 0.3.15: Rename camelCase Top-Level Store Files (9 files)

All in `src/lib/stores/`:

| #   | Current                  | New                        |
| --- | ------------------------ | -------------------------- |
| 1   | `companionStore.ts`      | `companion-store.ts`       |
| 2   | `bettercapStore.ts`      | `bettercap-store.ts`       |
| 3   | `btleStore.ts`           | `btle-store.ts`            |
| 4   | `gsmEvilStore.ts`        | `gsm-evil-store.ts`        |
| 5   | `hardwareStore.ts`       | `hardware-store.ts`        |
| 6   | `pagermonStore.ts`       | `pagermon-store.ts`        |
| 7   | `rtl433Store.ts`         | `rtl433-store.ts`          |
| 8   | `wifiteStore.ts`         | `wifite-store.ts`          |
| 9   | `packetAnalysisStore.ts` | `packet-analysis-store.ts` |

### Subtask 0.3.16: Rename camelCase Store/Dashboard Files (4 files)

All in `src/lib/stores/dashboard/`:

| #   | Current                | New                      |
| --- | ---------------------- | ------------------------ |
| 1   | `toolsStore.ts`        | `tools-store.ts`         |
| 2   | `agentContextStore.ts` | `agent-context-store.ts` |
| 3   | `dashboardStore.ts`    | `dashboard-store.ts`     |
| 4   | `terminalStore.ts`     | `terminal-store.ts`      |

### Subtask 0.3.17: Rename camelCase Store/Tactical-Map Files (5 files)

All in `src/lib/stores/tactical-map/`:

| #   | Current          | New               |
| --- | ---------------- | ----------------- |
| 1   | `mapStore.ts`    | `map-store.ts`    |
| 2   | `hackrfStore.ts` | `hackrf-store.ts` |
| 3   | `systemStore.ts` | `system-store.ts` |
| 4   | `kismetStore.ts` | `kismet-store.ts` |
| 5   | `gpsStore.ts`    | `gps-store.ts`    |

### Subtask 0.3.18: Rename camelCase Store/Other Subdirectory Files (5 files)

| #   | Current                                | New                                     |
| --- | -------------------------------------- | --------------------------------------- |
| 1   | `stores/wigletotak/wigleStore.ts`      | `stores/wigletotak/wigle-store.ts`      |
| 2   | `stores/hackrfsweep/controlStore.ts`   | `stores/hackrfsweep/control-store.ts`   |
| 3   | `stores/hackrfsweep/displayStore.ts`   | `stores/hackrfsweep/display-store.ts`   |
| 4   | `stores/hackrfsweep/signalStore.ts`    | `stores/hackrfsweep/signal-store.ts`    |
| 5   | `stores/hackrfsweep/frequencyStore.ts` | `stores/hackrfsweep/frequency-store.ts` |

**Stores subtotal: 23 files renamed** (9 + 4 + 5 + 5)

### Subtask 0.3.19: Rename camelCase Utility Files (6 files)

All in `src/lib/utils/`:

| #   | Current              | New                   |
| --- | -------------------- | --------------------- |
| 1   | `cssLoader.ts`       | `css-loader.ts`       |
| 2   | `deviceIcons.ts`     | `device-icons.ts`     |
| 3   | `popupTemplates.ts`  | `popup-templates.ts`  |
| 4   | `mgrsConverter.ts`   | `mgrs-converter.ts`   |
| 5   | `signalUtils.ts`     | `signal-utils.ts`     |
| 6   | `countryDetector.ts` | `country-detector.ts` |

### Subtask 0.3.20: Rename camelCase Config, Data, and Component .ts Files (4 files)

| #   | Current                                        | New                                              |
| --- | ---------------------------------------------- | ------------------------------------------------ |
| 1   | `config/mapConfig.ts`                          | `config/map-config.ts`                           |
| 2   | `data/toolIcons.ts`                            | `data/tool-icons.ts`                             |
| 3   | `data/toolHierarchy.ts`                        | `data/tool-hierarchy.ts`                         |
| 4   | `components/dashboard/frontendToolExecutor.ts` | `components/dashboard/frontend-tool-executor.ts` |

**Other subtotal: 10 files renamed** (6 + 4)

### Task 0.3 Verification Gate

```bash
npm run typecheck   # Must pass

# Comprehensive verification -- ZERO violations must remain:
# No snake_case .ts files anywhere in src/lib/:
find src/lib/ -name "*_*.ts" -not -name "*.d.ts" -not -path "*/node_modules/*" | wc -l  # Must be 0

# No PascalCase .ts files in services/:
find src/lib/services -name "[A-Z]*.ts" -not -name "*.d.ts" | wc -l  # Must be 0

# No camelCase .ts files (files with lowercase-then-uppercase pattern):
find src/lib/ -name "*.ts" -not -name "*.d.ts" -not -name "index.ts" -not -path "*/node_modules/*" | \
  xargs -I {} basename {} | grep '[a-z][A-Z]' | wc -l  # Must be 0
```

**Total files renamed in Task 0.3: 113 files** (31 server + 49 services + 23 stores + 10 other)

**NOTE**: The count exceeds the audit's 106 because some files will be renamed AND relocated in Task 0.4 (e.g., `systemHealth.ts` becomes `system-health.ts` during rename, then moves to `services/system/` during consolidation). The net unique files touched is ~106. The verification gate catches any remainders.

---

## Task 0.4: Directory Structure Consolidation

**Rationale**: 28 single-file directories create unnecessary nesting. Redundant directories (`database/` vs `server/db/`, `scripts/dev/` vs `scripts/development/`) violate the DRY principle and confuse navigation.

### Subtask 0.4.1: Flatten Sweep Manager Depth (5 levels to 4 levels)

Each subdirectory under `sweep-manager/` contains exactly 1 file (after Phase 0.1 dead code removal). Flatten:

| Current (depth 5)                                             | New (depth 4)                                       |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `services/hackrf/sweep-manager/buffer/buffer-manager.ts`      | `services/hackrf/sweep-manager/buffer-manager.ts`   |
| `services/hackrf/sweep-manager/error/error-tracker.ts`        | `services/hackrf/sweep-manager/error-tracker.ts`    |
| `services/hackrf/sweep-manager/frequency/frequency-cycler.ts` | `services/hackrf/sweep-manager/frequency-cycler.ts` |
| `services/hackrf/sweep-manager/process/process-manager.ts`    | `services/hackrf/sweep-manager/process-manager.ts`  |
| `services/usrp/sweep-manager/buffer/buffer-manager.ts`        | `services/usrp/sweep-manager/buffer-manager.ts`     |
| `services/usrp/sweep-manager/process/process-manager.ts`      | `services/usrp/sweep-manager/process-manager.ts`    |

All paths relative to `src/lib/`.

**After moves**: Delete the 6 now-empty subdirectories (`buffer/`, `error/`, `frequency/`, `process/` under hackrf, and `buffer/`, `process/` under usrp).

### Subtask 0.4.2: Consolidate Service Single-File Directories

| Single-File Directory  | File                     | Action                                                                 |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `services/gsm/`        | `protocol-parser.ts`     | Move to `services/gsm-evil/protocol-parser.ts`, delete `services/gsm/` |
| `services/monitoring/` | `system-health.ts`       | Move to `services/system/system-health.ts` (create `services/system/`) |
| `services/recovery/`   | `error-recovery.ts`      | Move to `services/system/error-recovery.ts`                            |
| `services/streaming/`  | `data-stream-manager.ts` | Move to `services/websocket/data-stream-manager.ts`                    |

**Also move**: `service-initializer.ts` from `services/` root into `services/system/service-initializer.ts` (orphan file at root level of services directory).

**After moves**: Delete 4 empty directories (`gsm/`, `monitoring/`, `recovery/`, `streaming/`).

### Subtask 0.4.3: Remove Dead Database Directory

**VERIFIED (2026-02-07)**: `src/lib/database/` is entirely dead. `dal.ts` and `migrations.ts` have zero imports anywhere in the codebase. The active database layer is `src/lib/server/db/` (10 files, heavily imported).

**Action**: This directory was already deleted in Phase 0.1 (Subtask 0.1.2, items 7-8). If Phase 0.1 was executed correctly, this subtask is N/A. Verify:

```bash
test -d src/lib/database/ && echo "FAIL: still exists" || echo "PASS: already removed"
```

### Subtask 0.4.4: Consolidate Config Duplication

| Issue                                                                        | Action                                                                                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.prettierrc` exists in both project root AND `config/` (VERIFIED identical) | Delete `config/.prettierrc`, keep root `.prettierrc`. Root is the conventional location for Prettier config; tools find it automatically. |
| `config/eslint.simple.config.js`                                             | Run `grep -rn "eslint.simple" . --include="*.json" --include="*.js"`. If not referenced by any script or config, delete it.               |

### Subtask 0.4.5: Clean Script Directory Duplication

| Issue                                                  | Action                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `scripts/dev/` AND `scripts/development/` both exist   | Merge contents of `scripts/development/` into `scripts/dev/`, delete `scripts/development/`  |
| `scripts/deploy/` AND `scripts/deployment/` both exist | `scripts/deployment/` has 1 file. Move it to `scripts/deploy/`, delete `scripts/deployment/` |

### Task 0.4 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
# No single-file directories in sweep-manager:
find src/lib/services/hackrf/sweep-manager -mindepth 1 -type d | wc -l  # Must be 0
find src/lib/services/usrp/sweep-manager -mindepth 1 -type d | wc -l  # Must be 0
# Redundant dirs removed:
test -d src/lib/services/gsm/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/monitoring/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/recovery/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/streaming/ && echo "FAIL" || echo "PASS"
test -d scripts/development/ && echo "FAIL" || echo "PASS"
test -d scripts/deployment/ && echo "FAIL" || echo "PASS"
```

---

## Task 0.5: Barrel Export Creation

**Rationale**: Only 16 of 97 directories under `src/lib/` have `index.ts` barrel exports. Immich, HuggingFace, and Twenty all use barrel exports as the standard module interface. Without them, consumers import from deep internal paths that break on refactor and expose implementation details.

### Subtask 0.5.1: Top-Level Barrel Exports (Critical)

**Create these 4 barrel files**. Each barrel must use explicit named re-exports (NOT `export *`) to prevent namespace collisions and enable dead code elimination by the bundler.

**`src/lib/stores/index.ts`**:

At execution time, generate the barrel by running:

```bash
ls src/lib/stores/*.ts | grep -v index.ts
```

For each file, inspect whether it uses `export default` or named exports. Generate the barrel using named re-exports.

**Template** (actual names determined by the `ls` output above):

```typescript
// Barrel export for all top-level stores
// Usage: import { hackrfStore } from '$lib/stores';
export { hackrfStore } from './hackrf-store';
export { kismetStore } from './kismet-store';
// ... one explicit line per store file found
```

**Rules**:

- Every `.ts` file in `src/lib/stores/` (excluding `index.ts`) MUST have a corresponding export line
- Do NOT use `export * from` -- name each export explicitly
- If a store file uses `export default`, re-export it as a named export: `export { default as storeName } from './store-file'`

**`src/lib/types/index.ts`**:

```typescript
// Canonical type barrel -- ONE import path for all shared types
// Usage: import type { SpectrumData, KismetDevice } from '$lib/types';
export * from './enums';
export * from './shared';
export * from './errors';
export * from './signals';
export * from './kismet';
export * from './gsm';
export * from './validation';
export * from './terminal';
export * from './tools';
```

**NOTE**: `export *` is acceptable for type files because types do not have runtime side effects and namespace collisions are caught at compile time.

**`src/lib/utils/index.ts`**:

```typescript
export { logger, logInfo, logError, logWarn } from './logger';
export { detectCountry, formatCoordinates } from './country-detector';
export { latLonToMGRS } from './mgrs-converter';
```

**Verify**: Run `ls src/lib/utils/*.ts | grep -v index.ts` and ensure every utility file has at least one export in the barrel.

**`src/lib/constants/index.ts`**:

```typescript
export * from './limits';
```

### Subtask 0.5.2: Server Module Barrel Exports

Create `index.ts` for each directory. Use explicit named re-exports.

| Directory           | Approx Files | Priority | Notes                                         |
| ------------------- | ------------ | -------- | --------------------------------------------- |
| `server/db/`        | 10           | HIGH     | Heavily imported across the codebase          |
| `server/agent/`     | 22           | HIGH     | Largest server module                         |
| `server/hardware/`  | 11           | HIGH     | Verify if barrel already exists; update if so |
| `server/kismet/`    | 14           | HIGH     | After renames in Task 0.3                     |
| `server/bettercap/` | 2            | MEDIUM   |                                               |
| `server/btle/`      | 2            | MEDIUM   |                                               |
| `server/companion/` | 2            | MEDIUM   |                                               |
| `server/wifite/`    | 2            | MEDIUM   |                                               |
| `server/pagermon/`  | 2            | MEDIUM   |                                               |
| `server/usrp/`      | 1            | LOW      |                                               |

**Process for each directory**:

1. `ls <directory>/*.ts | grep -v index.ts` to list all module files
2. For each file, identify its public exports
3. Create `index.ts` with explicit named re-exports
4. Run `npm run typecheck`

### Subtask 0.5.3: Service Module Barrel Exports

| Directory                | Approx Files                 | Priority |
| ------------------------ | ---------------------------- | -------- |
| `services/map/`          | 14                           | HIGH     |
| `services/tactical-map/` | 6                            | HIGH     |
| `services/localization/` | 6                            | MEDIUM   |
| `services/hackrfsweep/`  | 4                            | MEDIUM   |
| `services/db/`           | 2                            | MEDIUM   |
| `services/system/`       | 3 (after merges in Task 0.4) | MEDIUM   |

### Subtask 0.5.4: Component Module Barrel Exports

| Directory                  | Approx Files                     | Priority |
| -------------------------- | -------------------------------- | -------- |
| `components/hackrf/`       | ~15 (after dead code removal)    | HIGH     |
| `components/kismet/`       | ~7 (after dead code removal)     | HIGH     |
| `components/map/`          | ~16 (after dead code removal)    | HIGH     |
| `components/dashboard/`    | ~25 (after dead code removal)    | HIGH     |
| `components/tactical-map/` | ~11 (after dead code removal)    | HIGH     |
| `components/shared/`       | 3+ (after moves in Task 0.2/0.8) | MEDIUM   |
| `components/hackrfsweep/`  | ~7 (after dead code removal)     | MEDIUM   |
| `components/wigletotak/`   | 6                                | MEDIUM   |
| `components/drone/`        | ~2 (after dead code removal)     | LOW      |
| `components/hardware/`     | ~3 (after dead code removal)     | LOW      |

**NOTE**: File counts are approximate because Phase 0.1 dead code removal changes the inventory. Run `ls <directory>/*.svelte | wc -l` at execution time to get the exact count.

### Subtask 0.5.5: Store Subdirectory Barrel Exports

| Directory              | Files |
| ---------------------- | ----- |
| `stores/dashboard/`    | 4     |
| `stores/tactical-map/` | 5     |
| `stores/hackrfsweep/`  | 4     |
| `stores/map/`          | 1     |
| `stores/wigletotak/`   | 1     |

### Task 0.5 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
# Verify critical barrels exist:
test -f src/lib/stores/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/types/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/utils/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/constants/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/server/db/index.ts && echo "PASS" || echo "FAIL"
```

---

## Task 0.6: Type System Consolidation and Boundary Violation Fix

**Rationale**: Type definitions are scattered across 13+ locations. 30 type-only imports cross architectural boundaries because types live in the wrong layer. Extracting types to `$lib/types/` eliminates all 30 type-only boundary violations in a single pass.

### Boundary Violation Inventory (52 total, verified 2026-02-08)

| Category                   | CRITICAL (Value)             | MEDIUM (Type-only) | Phase 0.2 Scope                                 |
| -------------------------- | ---------------------------- | ------------------ | ----------------------------------------------- |
| Server -> Stores           | 0                            | 3                  | FIX (extract types)                             |
| Stores -> Server           | 0                            | 3                  | FIX (extract types)                             |
| Services -> Stores (value) | **28** (verified 2026-02-08) | 0                  | DOCUMENT ONLY (Phase 5)                         |
| Services -> Stores (type)  | 0                            | 14                 | FIX (extract types)                             |
| Services -> Routes         | 1                            | 0                  | FIX (Task 0.2)                                  |
| Stores -> Services         | 1                            | 0                  | FIX (lazy import)                               |
| Server -> Services         | 3                            | 2                  | DOCUMENT ONLY (Phase 5)                         |
| API Routes -> Stores       | 0                            | 3                  | FIX (extract types)                             |
| Svelte Pages -> Server     | 0                            | 2                  | FIX (extract types)                             |
| **TOTAL**                  | **33**                       | **27**             | **FIX: 27 type + 2 value. DOCUMENT: 34 value.** |

**NOTE (2026-02-08 Independent Verification)**: Services-to-stores VALUE violations were originally counted as 17 but independent audit verified **28** in the live codebase. The 11 additional violations are documented in the expanded list in Task 0.6.4 below.

### Subtask 0.6.1: Extract SignalMarker to $lib/types/signals.ts

**Impact**: Fixes 17 type-only violations in one operation. `SignalMarker` is imported by:

- 3 server/db files (from `$lib/stores/map/signals`)
- 10 services/map files (from `$lib/stores/map/signals`)
- 2 services/db files (from `$lib/stores/map/signals`)
- 3 API routes (from `$lib/stores/map/signals`)

**Fix** (execute in order):

1. Copy the `SignalMarker` interface definition from `src/lib/stores/map/signals.ts` to `src/lib/types/signals.ts` (create file if it does not exist; if it exists, append the interface)
2. Update ALL 18 files to import from `$lib/types/signals` instead of `$lib/stores/map/signals`
3. In `src/lib/stores/map/signals.ts`, replace the local interface definition with a re-export from `$lib/types/signals` to maintain backward compatibility for existing store consumers

**Files to update** (complete list):

```
src/lib/server/db/geo.ts:7
src/lib/server/db/signalRepository.ts:8
src/lib/server/db/database.ts:17
src/lib/services/map/signalFiltering.ts:7
src/lib/services/map/networkAnalyzer.ts:6
src/lib/services/map/droneDetection.ts:6
src/lib/services/map/heatmapService.ts:6
src/lib/services/map/mapUtils.ts:1
src/lib/services/map/contourGenerator.ts:6
src/lib/services/map/signalClustering.ts:6
src/lib/services/map/aiPatternDetector.ts:6
src/lib/services/db/dataAccessLayer.ts:7
src/lib/services/db/signalDatabase.ts:6
src/routes/api/signals/batch/+server.ts:4
src/routes/api/signals/+server.ts:4
src/routes/api/test-db/+server.ts:3
```

**NOTE**: File names above reflect pre-rename state. After Task 0.3, use the kebab-case names.

### Subtask 0.6.2: Extract Store-Resident Types to $lib/types/

**3 stores-to-server type violations** (types defined in server, imported by stores):

| Store File                      | Type Imported                                        | Source                        | Target                    |
| ------------------------------- | ---------------------------------------------------- | ----------------------------- | ------------------------- |
| `stores/bettercapStore.ts`      | `BettercapWiFiAP, BettercapBLEDevice, BettercapMode` | `$lib/server/bettercap/types` | `$lib/types/bettercap.ts` |
| `stores/wifiteStore.ts`         | `AttackMode`                                         | `$lib/server/wifite/types`    | `$lib/types/wifite.ts`    |
| `stores/packetAnalysisStore.ts` | `NetworkPacket`                                      | `$lib/server/wireshark`       | `$lib/types/wireshark.ts` |

**Fix**: For each type:

1. Move the type/interface definition to `$lib/types/<domain>.ts`
2. Update the store to import from `$lib/types/`
3. Update the server file to re-export from `$lib/types/` (backward compat)
4. Search for any other importers and update them

**2 Svelte pages-to-server type violations**:

| Page File                                               | Type Imported  | Source                     | Target                                       |
| ------------------------------------------------------- | -------------- | -------------------------- | -------------------------------------------- |
| `routes/wifite/+page.svelte`                            | `AttackMode`   | `$lib/server/wifite/types` | `$lib/types/wifite.ts` (already moved above) |
| `routes/tactical-map-simple/integration-example.svelte` | `KismetDevice` | `$lib/server/kismet/types` | Already in `$lib/types/kismet.ts`            |

**Additional type-only violations to fix**:

| File                                        | Type Imported                                | Source                                 | Target                  |
| ------------------------------------------- | -------------------------------------------- | -------------------------------------- | ----------------------- |
| `services/drone/flightPathAnalyzer.ts`      | `FlightPoint, SignalCapture, AreaOfInterest` | `$lib/stores/drone`                    | `$lib/types/drone.ts`   |
| `services/tactical-map/cellTowerService.ts` | `LeafletMap`                                 | `$lib/stores/tactical-map/mapStore`    | `$lib/types/map.ts`     |
| `services/tactical-map/systemService.ts`    | `SystemInfo`                                 | `$lib/stores/tactical-map/systemStore` | `$lib/types/system.ts`  |
| `server/db/database.ts`                     | `NetworkNode, NetworkEdge`                   | `$lib/services/map/networkAnalyzer`    | `$lib/types/network.ts` |
| `server/db/networkRepository.ts`            | `NetworkNode, NetworkEdge`                   | `$lib/services/map/networkAnalyzer`    | `$lib/types/network.ts` |

### Subtask 0.6.3: Extract Inline Types from God Page

The tactical-map-simple God Page (3,978 lines) defines inline interfaces at the top of the file:

- `GPSPositionData` (lines ~18-28)
- `GPSApiResponse` (lines ~30-36)
- `SystemInfo` (lines ~39-70)
- `KismetDevicesResponse` (lines ~74-76)
- `LeafletIcon`, `LeafletLibrary`, `LeafletMap`, `LeafletTileLayer`, `LeafletMarker`, `LeafletCircle`, `LeafletCircleMarker` (lines ~84-120)

**Action**:

1. Extract `GPSPositionData` and `GPSApiResponse` to `src/lib/types/gps.ts` (create new file)
2. Extract `SystemInfo` to `src/lib/types/system.ts` (may already exist from 0.6.2)
3. Extract Leaflet interfaces to `src/lib/types/map.ts` (may already exist from 0.6.2)
4. Update the God Page to import these types from `$lib/types/`
5. Add all new files to the types barrel (`src/lib/types/index.ts`)

### Subtask 0.6.4: Document Value Import Violations (NOT Fixed in Phase 0.2)

**33 CRITICAL value import violations are OUT OF SCOPE for Phase 0.2.** These require architectural changes (inverting dependency direction, introducing event emitters, or creating mediator patterns) that belong in Phase 5.

Create file: `src/lib/BOUNDARY-VIOLATIONS.md` documenting all 33 for Phase 5 reference.

**NOTE (2026-02-08 Independent Verification)**: Original count was 22 (17 services-to-stores + 3 server-to-services + 1 stores-to-services + 1 services-to-routes). Verified count is **33** (28 services-to-stores + 3 server-to-services + 1 stores-to-services + 1 services-to-routes fixed in Task 0.2).

**28 Services -> Stores VALUE imports** (services directly calling `store.set()` and `get(store)`):

| #   | Service File                               | Store Imported                                             | Impact                          |
| --- | ------------------------------------------ | ---------------------------------------------------------- | ------------------------------- |
| 1   | `services/websocket/hackrf.ts`             | `stores/hackrf` (6 exports)                                | Service WRITES to store         |
| 2   | `services/websocket/kismet.ts`             | `stores/kismet`, `stores/connection`                       | Service WRITES to store         |
| 3   | `services/hackrfsweep/signalService.ts`    | `stores/hackrfsweep/signalStore`, `displayStore`, `hackrf` | Service READS + WRITES          |
| 4   | `services/hackrfsweep/displayService.ts`   | `stores/hackrfsweep/displayStore`                          | Service WRITES to store         |
| 5   | `services/hackrfsweep/controlService.ts`   | `stores/hackrfsweep/controlStore`, `frequencyStore`        | Service WRITES to store         |
| 6   | `services/hackrfsweep/frequencyService.ts` | `stores/hackrfsweep/frequencyStore`                        | Service WRITES to store         |
| 7   | `services/tactical-map/hackrfService.ts`   | `stores/hackrf`, `stores/tactical-map/hackrfStore`         | Service READS + WRITES          |
| 8   | `services/tactical-map/gpsService.ts`      | `stores/tactical-map/gpsStore`                             | Service WRITES to store         |
| 9   | `services/tactical-map/mapService.ts`      | `stores/tactical-map/mapStore`, `gpsStore`                 | Service WRITES to store         |
| 10  | `services/tactical-map/systemService.ts`   | `stores/tactical-map/systemStore`                          | Service WRITES to store         |
| 11  | `services/tactical-map/kismetService.ts`   | `stores/tactical-map/kismetStore`                          | Service WRITES to store         |
| 12  | `services/hackrf/api.ts`                   | `stores/hackrf`                                            | Service WRITES to store         |
| 13  | `services/hackrf/usrp-api.ts`              | `stores/hackrf`                                            | Service WRITES to store         |
| 14  | `services/map/kismetRSSIService.ts`        | `stores/tactical-map/gpsStore`                             | Service READS via `get()`       |
| 15  | `services/wigletotak/wigleService.ts`      | `stores/wigletotak/wigleStore`                             | Service WRITES to store         |
| 16  | `services/websocket/example-usage.ts`      | Multiple stores (6 imports)                                | Example file, still a violation |
| 17  | `services/hackrf/hackrfService.ts`         | `stores/hackrf`                                            | Service WRITES to store         |
| 18  | `services/hackrf/signalProcessor.ts`       | `stores/hackrf`                                            | Service READS + WRITES          |
| 19  | `services/hackrf/sweepAnalyzer.ts`         | `stores/hackrf`                                            | Service READS from store        |
| 20  | `services/hackrf/timeWindowFilter.ts`      | `stores/hackrf`                                            | Service READS from store        |
| 21  | `services/hackrf/usrp-api.ts`              | `stores/hackrf`                                            | Service WRITES to store         |
| 22  | `services/map/heatmapService.ts`           | `stores/tactical-map/gpsStore`                             | Service READS via `get()`       |
| 23  | `services/map/signalFiltering.ts`          | `stores/map/signals`                                       | Service READS from store        |
| 24  | `services/map/networkAnalyzer.ts`          | `stores/map/signals`                                       | Service READS from store        |
| 25  | `services/map/droneDetection.ts`           | `stores/drone`                                             | Service READS from store        |
| 26  | `services/db/signalDatabase.ts`            | `stores/map/signals`                                       | Service READS from store        |
| 27  | `services/db/dataAccessLayer.ts`           | `stores/map/signals`                                       | Service READS from store        |
| 28  | `services/localization/RSSILocalizer.ts`   | `stores/tactical-map/gpsStore`                             | Service READS via `get()`       |

**NOTE**: Items 17-28 were identified by the independent verification agent on 2026-02-08. Some may overlap with items 1-16 if the same file imports from multiple stores. The verification gate (grep command in Task 0.6) will produce the definitive count at execution time.

**3 Server -> Services VALUE imports** (server importing runtime service classes):

| #   | Server File                     | Service Imported                                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | `server/hackrf/sweepManager.ts` | `ProcessManager, FrequencyCycler, BufferManager, ErrorTracker` from services/hackrf/ |
| 2   | `server/usrp/sweepManager.ts`   | `ProcessManager, BufferManager` from services/usrp/                                  |

**1 Stores -> Services VALUE import**:

| #   | Store File       | Service Imported                   |
| --- | ---------------- | ---------------------------------- |
| 1   | `stores/usrp.ts` | `usrpAPI` from `services/usrp/api` |

**Phase 5 will address these by**: Inverting service-to-store dependencies using callback patterns, event emitters, or return-value-based approaches where services return data and the calling layer writes to stores.

### Subtask 0.6.5: Fix Stores-to-Services Circular Dependency

**File**: `src/lib/stores/usrp.ts` line 2
**Issue**: `import { usrpAPI } from '$lib/services/usrp/api'` at module scope creates store-to-service coupling at initialization time.

**Fix**: Move the import inside the function that uses it (lazy import pattern):

```typescript
// BEFORE (module scope -- eagerly loaded):
import { usrpAPI } from '$lib/services/usrp/api';

export function startSweep() {
	usrpAPI.start();
}

// AFTER (lazy -- loaded on first use):
let _api: typeof import('$lib/services/usrp/api').usrpAPI | null = null;

async function getAPI() {
	if (!_api) {
		const mod = await import('$lib/services/usrp/api');
		_api = mod.usrpAPI;
	}
	return _api;
}

export async function startSweep() {
	const api = await getAPI();
	api.start();
}
```

**NOTE**: This changes the function signature from sync to async. All callers must be updated to `await` the result. Run `grep -rn "startSweep\|usrpStore" src/ --include="*.ts" --include="*.svelte"` to find all callers.

### Subtask 0.6.6: Verify No Duplicate Type Definitions Remain

After consolidation, run the following verification commands. Each type name should appear in exactly ONE canonical location (in `$lib/types/`) plus any re-exports:

```bash
grep -rn "interface SignalMarker" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface SpectrumData" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface KismetDevice" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface SystemInfo" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface NetworkNode" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface AttackMode\|type AttackMode" src/ --include="*.ts" | grep -v "node_modules"
```

If any type appears in more than 2 locations (1 canonical + 1 re-export), consolidate the duplicates.

### Task 0.6 Verification Gate

```bash
npm run typecheck   # Must pass

# No server imports from stores (type or value):
grep -rn "from '\$lib/stores" src/lib/server/ --include="*.ts" | wc -l  # Must be 0

# No stores imports from server (type or value):
grep -rn "from '\$lib/server" src/lib/stores/ --include="*.ts" | wc -l  # Must be 0

# No API routes importing from stores:
grep -rn "from '\$lib/stores" src/routes/api/ --include="*.ts" | wc -l  # Must be 0

# Services-to-stores TYPE imports eliminated (value imports remain, documented):
grep -rn "import type.*from '\$lib/stores" src/lib/services/ --include="*.ts" | wc -l  # Must be 0

# Boundary violation doc exists:
test -f src/lib/BOUNDARY-VIOLATIONS.md && echo "PASS" || echo "FAIL"
```

---

## Task 0.7: Import Path Standardization

**Rationale**: 94% of imports use `$lib/` aliases, but 35+ cross-directory imports use relative `../` paths. These relative paths break when files are moved and obscure the dependency graph. 100% `$lib/` usage is the enterprise standard.

### Subtask 0.7.1: Convert Relative Cross-Directory Imports to $lib/ Aliases

**Identify all**:

```bash
grep -rn "from '\.\.\/" src/lib/ --include="*.ts" --include="*.svelte" | grep -v "node_modules"
```

**Exception**: Relative imports within the SAME directory (e.g., `from './types'`) are acceptable and should NOT be converted. Only cross-directory relative imports (containing `../`) need conversion.

**For each match**, convert:

```typescript
// BEFORE:
import { SignalAggregator } from '../../../routes/tactical-map-simple/SignalAggregator';
// AFTER:
import { SignalAggregator } from '$lib/services/map/signal-aggregator';
```

### Task 0.7 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
# No relative cross-directory imports in lib/:
grep -rn "from '\.\.\/" src/lib/ --include="*.ts" | wc -l  # Target: 0
```

---

## Task 0.8: Create Shared Component Directory

**Rationale**: Cross-domain components should live in a `shared/` directory to signal their reusability and prevent domain directories from accumulating unrelated code.

**Create**: `src/lib/components/shared/` (may already exist from Task 0.2.4).

Move cross-domain reusable components:

| Component                      | Current Location        | Reason                                                       |
| ------------------------------ | ----------------------- | ------------------------------------------------------------ |
| `HardwareConflictModal.svelte` | `components/hardware/`  | Used by bettercap, companion, hardware (moved in Task 0.2.4) |
| `CompanionLauncher.svelte`     | `components/companion/` | Single-file domain directory, utility component              |

**Create**: `src/lib/components/shared/index.ts` barrel export:

```typescript
export { default as HardwareConflictModal } from './HardwareConflictModal.svelte';
export { default as CompanionLauncher } from './CompanionLauncher.svelte';
```

**After moves**:

- If `components/companion/` is empty, delete it
- If `components/navigation/` is empty (SpectrumLink was deleted in Phase 0.1), delete it

### Task 0.8 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
test -f src/lib/components/shared/index.ts && echo "PASS" || echo "FAIL"
```

---

## Task 0.9: Root File Cleanup

**Rationale**: Build tools and generated outputs should not clutter the project root. A clean root directory is the first thing a reviewer sees.

### Subtask 0.9.1: Move vite-plugin-terminal.ts

**Current**: `vite-plugin-terminal.ts` (382 lines, 10,551 bytes) in project root.
**Target**: `config/vite-plugin-terminal.ts` -- it is a build tool configuration, belongs with other config files.

```bash
git mv vite-plugin-terminal.ts config/vite-plugin-terminal.ts
```

**Update**: `vite.config.ts` import path from `./vite-plugin-terminal` to `./config/vite-plugin-terminal`.

### Subtask 0.9.2: Handle Generated Files in Root

| File                           | Size (bytes) | Action                                     |
| ------------------------------ | ------------ | ------------------------------------------ |
| `css-integrity-baselines.json` | 746          | Already in `.gitignore`. No action needed. |
| `css-integrity-report.json`    | 941          | Already in `.gitignore`. No action needed. |

### Task 0.9 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
test -f vite-plugin-terminal.ts && echo "FAIL: still in root" || echo "PASS"
```

---

## Execution Order

Execute in this exact sequence. Each step depends on the previous:

```
Step 1: Task 0.2 -- Relocate misplaced files (before renames, to avoid double-moves)
         +-- 0.2.1: Move/delete 3 components from routes
         +-- 0.2.2: Move/delete 2 services from routes
         +-- 0.2.3: Fix service-to-route import violation
         +-- 0.2.4: Move shared modal
         -> COMMIT: "refactor: relocate misplaced files from routes/ to lib/"
         -> VERIFY: npm run typecheck && npm run build

Step 2: Task 0.3 -- Naming enforcement (biggest batch of changes, 106 files)
         +-- 0.3.1-0.3.7: Server files (31 renames)
         +-- 0.3.8-0.3.14: Service files (49 renames)
         +-- 0.3.15-0.3.18: Store files (23 renames)
         +-- 0.3.19-0.3.20: Utils, config, data, components (10 renames)
         -> VERIFY: npm run typecheck after EACH batch of 10 renames
         -> COMMIT: "refactor: enforce kebab-case naming across 106 files"

Step 3: Task 0.4 -- Directory consolidation (depends on renames being done)
         +-- 0.4.1: Flatten sweep manager depth
         +-- 0.4.2: Consolidate service single-file dirs
         +-- 0.4.3: Verify dead database dir removed (from Phase 0.1)
         +-- 0.4.4: Consolidate config duplication
         +-- 0.4.5: Clean script directory duplication
         -> COMMIT: "refactor: consolidate directories, flatten sweep-manager depth"
         -> VERIFY: npm run typecheck && npm run build

Step 4: Task 0.6 -- Type consolidation and boundary fixes (requires final file locations)
         +-- 0.6.1: Extract SignalMarker to $lib/types/ (fixes 17 violations)
         +-- 0.6.2: Extract other store-resident types (fixes 8 violations)
         +-- 0.6.3: Extract inline types from God Page
         +-- 0.6.4: Document 22 value violations for Phase 5
         +-- 0.6.5: Fix stores-to-services circular dependency
         +-- 0.6.6: Verify no duplicate type definitions
         -> COMMIT: "refactor: consolidate type system, fix 30 type-only boundary violations"
         -> VERIFY: npm run typecheck

Step 5: Task 0.5 -- Barrel exports (requires all paths finalized)
         +-- 0.5.1: Top-level barrels (stores, types, utils, constants)
         +-- 0.5.2: Server module barrels
         +-- 0.5.3: Service module barrels
         +-- 0.5.4: Component module barrels
         +-- 0.5.5: Store subdirectory barrels
         -> COMMIT: "refactor: create barrel exports for all module directories"
         -> VERIFY: npm run typecheck && npm run build

Step 6: Task 0.7 -- Import standardization (after barrels exist)
         +-- 0.7.1: Convert relative imports to $lib/
         -> COMMIT: "refactor: standardize import paths to $lib/ aliases"
         -> VERIFY: npm run typecheck && npm run build

Step 7: Tasks 0.8 + 0.9 -- Final cleanup
         +-- 0.8: Create shared component directory
         +-- 0.9: Root file cleanup
         -> COMMIT: "chore: create shared components, clean root files"
         -> VERIFY: Full suite (see below)
```

---

## Phase 0.2 Final Verification Checklist

**Zero-tolerance checks -- ALL must pass before Phase 0.2 is declared complete**:

```bash
# 1. No snake_case .ts files anywhere in src/lib/
find src/lib/ -name "*_*.ts" -not -name "*.d.ts" -not -path "*/node_modules/*" | wc -l
# Must be 0

# 2. No PascalCase .ts files in services/
find src/lib/services -name "[A-Z]*.ts" -not -name "*.d.ts" | wc -l
# Must be 0

# 3. No camelCase .ts files in src/lib/
find src/lib/ -name "*.ts" -not -name "*.d.ts" -not -name "index.ts" -not -path "*/node_modules/*" | \
  xargs -I {} basename {} | grep '[a-z][A-Z]' | wc -l
# Must be 0

# 4. No server imports from stores
grep -rn "from '\$lib/stores" src/lib/server/ --include="*.ts" | wc -l
# Must be 0

# 5. No stores imports from server
grep -rn "from '\$lib/server" src/lib/stores/ --include="*.ts" | wc -l
# Must be 0

# 6. No service imports from routes/
grep -rn "from.*routes/" src/lib/services/ --include="*.ts" | wc -l
# Must be 0

# 7. No API routes importing from stores
grep -rn "from '\$lib/stores" src/routes/api/ --include="*.ts" | wc -l
# Must be 0

# 8. No relative cross-directory imports in lib/
grep -rn "from '\.\.\/" src/lib/ --include="*.ts" | wc -l
# Target: 0

# 9. No business logic files in routes/ (only +prefixed files)
find src/routes -name "*.ts" -not -name "+*" -not -name "*.d.ts" | wc -l
# Must be 0

# 10. Barrel exports exist for top-level modules
test -f src/lib/stores/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/types/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/utils/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/constants/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/server/db/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/components/shared/index.ts && echo "PASS" || echo "FAIL"

# 11. Boundary violations documented
test -f src/lib/BOUNDARY-VIOLATIONS.md && echo "PASS" || echo "FAIL"

# 12. Redundant directories removed
test -d src/lib/services/gsm/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/monitoring/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/recovery/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/streaming/ && echo "FAIL" || echo "PASS"
test -d scripts/development/ && echo "FAIL" || echo "PASS"
test -d scripts/deployment/ && echo "FAIL" || echo "PASS"

# 13. Vite plugin moved from root
test -f vite-plugin-terminal.ts && echo "FAIL" || echo "PASS"
test -f config/vite-plugin-terminal.ts && echo "PASS" || echo "FAIL"

# 14. Full build pipeline
npm run typecheck
npm run build
npm run lint
npm run test:unit
```

---

## Definition of Done for Phase 0.2

1. All 106 naming violations corrected (kebab-case enforced across all .ts files)
2. All 5 misplaced files relocated from `routes/` to `lib/` (or deleted if dead)
3. All 30 type-only boundary violations resolved (types extracted to `$lib/types/`)
4. All 33 value boundary violations DOCUMENTED in `BOUNDARY-VIOLATIONS.md` (28 services-to-stores + 3 server-to-services + 1 stores-to-services + 1 fixed in Task 0.2; fix deferred to Phase 5)
5. Stores-to-services circular dependency fixed (lazy import in usrp.ts)
6. All single-file directories consolidated or justified
7. Barrel exports exist for every module directory
8. Type system consolidated to `$lib/types/` as single source of truth
9. 100% `$lib/` import aliases (zero cross-directory relative imports)
10. Shared component directory established
11. Root directory clean (no misplaced build tools)
12. All 7 commits follow conventional commit format
13. `npm run typecheck && npm run build && npm run lint && npm run test:unit` all pass
14. Zero non-SvelteKit files remain in `src/routes/` (only `+`-prefixed files)

**When a senior engineer with 30 years of experience opens this codebase after Phase 0.2, they should see**:

- Every file in its correct domain directory
- Consistent kebab-case naming across all `.ts` files
- PascalCase for all `.svelte` components
- Barrel exports providing clean module interfaces
- Types in one canonical location (`$lib/types/`)
- Zero type-only architecture boundary violations
- Value boundary violations documented and tracked for Phase 5
- Clean import paths using `$lib/` exclusively
- A project root containing only configuration files, not build tools or generated output
