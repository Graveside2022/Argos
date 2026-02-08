# Phase 5.4 -- File Size Enforcement: Decomposition of Oversized Modules

```
Document:       ARGOS-AUDIT-P5.4-FILE-SIZE-ENFORCEMENT
Classification: CUI // FOUO
Version:        1.0 FINAL
Date:           2026-02-08
Author:         Principal Software Architect (AI-Assisted)
Audience:       US Cyber Command Software Engineers (GS-13+)
Standards:      MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 2.4,
                Barr Group Embedded C Coding Standard Rule 1.3
Risk Level:     LOW-MEDIUM
Prerequisites:  Phase 4 (Dead Code Removal) COMPLETE
                Phase 5.1 (God Page Decomposition) COMPLETE
                Phase 5.2 (HackRF/USRP Deduplication) COMPLETE
                Phase 5.3 (Shell Consolidation) COMPLETE
Files Touched:  ~80 source files decomposed into ~200+ target files
LOC Impact:     Net zero (structural reorganization, no logic changes)
```

---

## 0. Governing Standards and Rationale

| Standard             | Rule                                                   | Enforcement                                                                   |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| NASA/JPL Rule 2.4    | Functions shall not exceed 60 lines                    | Extract functions exceeding threshold into named modules                      |
| MISRA C:2012 Dir 4.4 | Sections of code should not be commented out           | Remove dead commented blocks during decomposition                             |
| Barr Group Rule 1.3  | Each source file shall contain no more than ~500 lines | Primary driver: files >500 lines decomposed; files 300-499 flagged for review |
| CERT C MEM00         | Allocate and free memory in the same module            | Ensure decomposition preserves allocation/deallocation locality               |
| CERT C MSC41         | Never hard code sensitive information                  | Verify no secrets surface during file splitting                               |
| DoD STIG V-222602    | Application must not contain unused code               | Cross-reference Phase 4 dead code audit before decomposing                    |

**Why 300 lines?** The 300-line threshold is a monitoring boundary, not a hard limit. Files
between 300-500 lines are reviewed for single-responsibility violations. Files above 500 lines
are decomposed unless they contain purely declarative data (lookup tables, type definitions)
with no branching logic. Files above 1,000 lines are unconditionally decomposed.

---

## 1. Audit Corrections

| #    | Original Claim                                                                  | Verified Finding                                                                                                                                                                          | Correction Applied                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | "108 files >300 lines" per initial audit                                        | 108 confirmed via `find + wc -l` on 2026-02-08                                                                                                                                            | No correction needed                                                                                                                                     |
| AC-2 | Kismet server cluster (5 files, 3,767 lines) marked dead                        | FALSE POSITIVE: fusion_controller.ts imports kismet_controller.ts, which imports device_intelligence, security_analyzer, device_tracker, api_client. All alive via relative import chain. | Files retained; decomposition plans added for device_intelligence (930), security_analyzer (813), device_tracker (503)                                   |
| AC-3 | "75 functions >60 lines"                                                        | Verified via brace-depth tracking script (scripts/audit-function-sizes-v2.py). Count confirmed at 75, not 68 as Phase 5.0 initially stated.                                               | Corrected in master overview                                                                                                                             |
| AC-4 | Phase 5.1 tactical-map-simple listed at 3,978 lines                             | Confirmed. Removed from this phase's scope.                                                                                                                                               | Deducted from Tier 1 count                                                                                                                               |
| AC-5 | serviceInitializer island (1,830 lines) marked dead in Phase 4                  | Confirmed dead: serviceInitializer.ts -> systemHealth.ts + dataStreamManager.ts + errorRecovery.ts. However, errorRecovery.ts (624 lines) has LIVE callers outside the island.            | errorRecovery.ts RETAINED in Tier 2; systemHealth.ts (552 lines) evaluated independently -- may have live callers via API routes, verify before deletion |
| AC-6 | signalInterpolation.ts listed as both dead and alive in conflicting audit notes | ALIVE: imported by heatmapService.ts (confirmed via grep). Included in Tier 2 decomposition.                                                                                              | Corrected                                                                                                                                                |

---

## 2. Cross-Phase Deductions

Files handled by other phases are **excluded** from this phase's work items. This section
provides an authoritative ledger to prevent duplicate effort.

### 2.1 Phase 5.1 -- God Page Decomposition (EXCLUDED)

| File                                      | Lines | Phase 5.1 Task                 |
| ----------------------------------------- | ----- | ------------------------------ |
| `routes/tactical-map-simple/+page.svelte` | 3,978 | Task 5.1.1: Full decomposition |
| `routes/gsm-evil/+page.svelte`            | 2,591 | Task 5.1.2: Full decomposition |
| `routes/rfsweep/+page.svelte`             | 2,245 | Task 5.1.3: Full decomposition |
| `routes/hackrfsweep/+page.svelte`         | 1,830 | Task 5.1.4: Full decomposition |

**Total excluded by Phase 5.1: 10,644 lines across 4 files.**

### 2.2 Phase 5.2 -- HackRF/USRP Deduplication (EXCLUDED)

| File                                                      | Lines | Phase 5.2 Task            |
| --------------------------------------------------------- | ----- | ------------------------- |
| `services/hackrf/sweep-manager/sweepManager.ts`           | 1,356 | Unified SDR sweep manager |
| `services/hackrf/sweep-manager/buffer/BufferManager.ts`   | 503   | Merged into sdr-common    |
| `services/usrp/sweep-manager/buffer/BufferManager.ts`     | 504   | Merged into sdr-common    |
| `services/hackrf/sweep-manager/process/ProcessManager.ts` | 413   | Merged into sdr-common    |
| `services/usrp/sweep-manager/process/ProcessManager.ts`   | 360   | Merged into sdr-common    |
| `services/hackrf/sweep-manager/api.ts`                    | 462   | Merged into sdr-common    |
| `services/usrp/sweep-manager/api.ts`                      | 460   | Merged into sdr-common    |
| `services/usrp/sweep-manager/sweepManager.ts`             | 435   | Merged into sdr-common    |
| `services/websocket/hackrf.ts`                            | 408   | Unified WebSocket handler |
| `services/websocket/kismet.ts`                            | 410   | Unified WebSocket handler |

**Total excluded by Phase 5.2: 5,311 lines across 10 files.**

### 2.3 Phase 4 -- Dead Code Removal (EXCLUDED -- genuinely dead)

| File                                   | Lines | Status                                         |
| -------------------------------------- | ----- | ---------------------------------------------- |
| `services/map/flightPathAnalyzer.ts`   | 574   | DEAD: zero importers                           |
| `services/map/aiPatternDetector.ts`    | 530   | DEAD: zero importers                           |
| `services/map/altitudeLayerManager.ts` | 367   | DEAD: zero importers                           |
| `services/map/contourGenerator.ts`     | 323   | DEAD: zero importers                           |
| `services/monitoring/systemService.ts` | 208   | DEAD: only imported by dead serviceInitializer |
| `services/api/cellTowerService.ts`     | 162   | DEAD: zero importers                           |

**Total excluded by Phase 4: 2,164 lines across 6 files.**

### 2.4 Post-Phase 5.1 Re-evaluation Required

The following Tier 3 files are tactical-map subcomponents. Phase 5.1 may restructure the
tactical-map page such that these files are absorbed, replaced, or rendered dead. Execute
Phase 5.1 first, then re-evaluate whether these files still require independent decomposition:

| File                                                     | Lines | Dependency                  |
| -------------------------------------------------------- | ----- | --------------------------- |
| `components/tactical-map/kismet/KismetController.svelte` | 395   | Used by tactical-map-simple |
| `components/tactical-map/kismet/DeviceManager.svelte`    | 335   | Used by KismetController    |
| `components/tactical-map/hackrf/HackRFController.svelte` | 331   | Used by tactical-map-simple |
| `components/tactical-map/hackrf/FrequencySearch.svelte`  | 324   | Used by HackRFController    |
| `components/tactical-map/map/MapLegend.svelte`           | 306   | Used by tactical-map-simple |

**Mark: DEFERRED pending Phase 5.1 completion.**

---

## 3. Summary of Remaining Scope

After all cross-phase deductions, this phase addresses:

| Tier      | Line Range | File Count | Aggregate LOC |
| --------- | ---------- | ---------- | ------------- |
| Tier 1    | >1,000     | 7          | 7,919         |
| Tier 2    | 500-999    | 23         | 15,264        |
| Tier 3    | 300-499    | ~55        | ~20,800       |
| **Total** |            | **~85**    | **~43,983**   |

---

## 4. Task 5.4.1 -- Decompose Tier 1 Files (7 files, >1,000 lines)

**Priority: CRITICAL. Execute first. One commit per file.**

Each Tier 1 file receives a complete decomposition plan: content analysis, target module
boundaries, new file manifest, barrel re-export strategy, and verification command.

---

### 4.1.1 `src/lib/data/toolHierarchy.ts` (1,502 lines)

**Content Analysis:**
Pure declarative data file. Contains a hierarchical tree structure defining all tool
categories, tool definitions, metadata, icons, and navigation paths. Zero business logic.
Zero functions exceeding 60 lines (the entire file is a single exported constant).

**Why It Exceeds Threshold:**
Single monolithic data structure. Every tool category (RF, WiFi, GSM, drone, etc.) is
defined inline within one object literal.

**Decomposition Strategy:**
Split by top-level category into individual data modules. Create a barrel `index.ts` that
re-assembles the full hierarchy at import time via spread operator.

**New File Manifest:**

| New File                              | Content                                    | Est. Lines |
| ------------------------------------- | ------------------------------------------ | ---------- |
| `src/lib/data/tools/index.ts`         | Barrel re-export, assembles full hierarchy | ~40        |
| `src/lib/data/tools/rf-tools.ts`      | HackRF, USRP, RTL-SDR, spectrum tools      | ~200       |
| `src/lib/data/tools/wifi-tools.ts`    | Kismet, Bettercap, WiFi analysis tools     | ~200       |
| `src/lib/data/tools/gsm-tools.ts`     | GSM Evil, grgsm, cellular tools            | ~150       |
| `src/lib/data/tools/drone-tools.ts`   | DroneID, flight path, detection tools      | ~150       |
| `src/lib/data/tools/network-tools.ts` | Wireshark, packet analysis tools           | ~150       |
| `src/lib/data/tools/system-tools.ts`  | System health, monitoring, agent tools     | ~150       |
| `src/lib/data/tools/types.ts`         | ToolCategory, ToolDefinition interfaces    | ~60        |

**Barrel Re-export Pattern:**

```typescript
// src/lib/data/tools/index.ts
import { rfTools } from './rf-tools';
import { wifiTools } from './wifi-tools';
import { gsmTools } from './gsm-tools';
import { droneTools } from './drone-tools';
import { networkTools } from './network-tools';
import { systemTools } from './system-tools';
export type { ToolCategory, ToolDefinition } from './types';

export const toolHierarchy = [
	...rfTools,
	...wifiTools,
	...gsmTools,
	...droneTools,
	...networkTools,
	...systemTools
];
```

**Verification:**

```bash
# 1. Import resolution (must not break)
cd /home/kali/Documents/Argos/Argos && npx tsc --noEmit 2>&1 | grep -i "toolHierarchy"
# 2. Runtime equivalence (build succeeds)
npm run build 2>&1 | tail -5
# 3. No file exceeds 300 lines
wc -l src/lib/data/tools/*.ts
```

---

### 4.1.2 `src/lib/components/map/KismetDashboardOverlay.svelte` (1,280 lines)

**Content Analysis:**
Complex Svelte component rendering Kismet device markers on a Leaflet map. Contains:
inline SVG icon generation for device types, popup content builders, overlay control logic,
marker clustering, device filtering by type/signal strength, and map layer management.

**Why It Exceeds Threshold:**
God component pattern. Rendering, data transformation, event handling, and UI state
management are all co-located in a single `.svelte` file.

**Decomposition Strategy:**
Extract four subcomponents and one utility module. The parent component becomes an
orchestrator importing and composing the extracted pieces.

**New File Manifest:**

| New File                                              | Content                                                                                     | Est. Lines |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| `components/map/kismet/KismetDashboardOverlay.svelte` | Orchestrator (replaces original)                                                            | ~200       |
| `components/map/kismet/DeviceTypeIcon.svelte`         | SVG icon generation per device type                                                         | ~120       |
| `components/map/kismet/DevicePopupContent.svelte`     | Popup HTML for device details                                                               | ~180       |
| `components/map/kismet/OverlayControls.svelte`        | Filter/toggle controls for overlay                                                          | ~150       |
| `components/map/kismet/DeviceMarkerLayer.svelte`      | Marker creation, clustering, placement                                                      | ~250       |
| `components/map/kismet/kismetOverlayUtils.ts`         | Pure functions: signal strength color mapping, device classification, coordinate validation | ~120       |

**Migration Steps:**

1. Create `components/map/kismet/` directory.
2. Extract `DeviceTypeIcon` -- all SVG path generation for device type icons. Accept `deviceType: string` and `signalStrength: number` as props.
3. Extract `DevicePopupContent` -- the L.popup content builder. Accept full device object as prop.
4. Extract `OverlayControls` -- filter checkboxes, signal threshold slider, layer toggles. Emit `change` events to parent.
5. Extract `DeviceMarkerLayer` -- L.markerClusterGroup setup, marker creation loop, click handlers. Accept filtered device array as prop.
6. Extract pure utility functions (color mapping, classification) into `kismetOverlayUtils.ts`.
7. Rewrite parent as composition of the four subcomponents.
8. Update all import paths. The original path (`components/map/KismetDashboardOverlay.svelte`) must redirect via barrel or the parent file retains the original name at the new path.

**Verification:**

```bash
# 1. No component exceeds 300 lines
wc -l src/lib/components/map/kismet/*.svelte src/lib/components/map/kismet/*.ts
# 2. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error" # expect 0
# 3. Original import path resolves
grep -r "KismetDashboardOverlay" src/ --include="*.svelte" --include="*.ts" -l
```

---

### 4.1.3 `src/routes/redesign/+page.svelte` (1,055 lines)

**Content Analysis:**
Full-page redesign/landing page. Contains hero section with animated elements, feature
grid with card components, navigation cards to each tool section, footer with system
status indicators, and substantial inline CSS.

**Decomposition Strategy:**
Extract section-level components. Each major visual section becomes its own Svelte
component. CSS moves to component-scoped styles.

**New File Manifest:**

| New File                                    | Content                                                    | Est. Lines |
| ------------------------------------------- | ---------------------------------------------------------- | ---------- |
| `routes/redesign/+page.svelte`              | Page shell, imports sections                               | ~80        |
| `routes/redesign/HeroSection.svelte`        | Hero banner, title, subtitle, animated background          | ~200       |
| `routes/redesign/FeatureGrid.svelte`        | Feature cards grid layout                                  | ~180       |
| `routes/redesign/NavigationCards.svelte`    | Tool navigation card set                                   | ~200       |
| `routes/redesign/SystemStatusFooter.svelte` | Footer with live system metrics                            | ~150       |
| `routes/redesign/redesignData.ts`           | Static data: feature descriptions, card configs, nav items | ~120       |

**Verification:**

```bash
wc -l src/routes/redesign/*.svelte src/routes/redesign/*.ts
npm run build 2>&1 | tail -5
```

---

### 4.1.4 `src/lib/components/dashboard/DashboardMap.svelte` (1,053 lines)

**Content Analysis:**
Primary dashboard map component. Initializes Leaflet, manages signal markers with
real-time updates from WebSocket, handles map events (click, zoom, pan), manages multiple
tile layers, and contains layer control UI.

**Decomposition Strategy:**
Separate map lifecycle management from data visualization. Extract marker management,
event handling, and layer controls into dedicated modules.

**New File Manifest:**

| New File                                           | Content                                              | Est. Lines |
| -------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `components/dashboard/map/DashboardMap.svelte`     | Orchestrator, Leaflet init, layout                   | ~200       |
| `components/dashboard/map/MapInitializer.ts`       | Leaflet map creation, tile layer setup, default view | ~120       |
| `components/dashboard/map/SignalMarkerManager.ts`  | Marker CRUD, clustering, popup binding               | ~250       |
| `components/dashboard/map/MapEventHandlers.ts`     | Click, zoom, pan, resize handlers                    | ~150       |
| `components/dashboard/map/MapLayerControls.svelte` | Layer toggle UI, tile source switcher                | ~150       |

**Key Constraint:**
`MapInitializer.ts` must return the `L.Map` instance. All other modules receive this
instance as a parameter. This prevents multiple map instantiation and ensures a single
source of truth for the map reference.

**Verification:**

```bash
wc -l src/lib/components/dashboard/map/*.svelte src/lib/components/dashboard/map/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### 4.1.5 `src/lib/components/map/AirSignalOverlay.svelte` (1,019 lines)

**Content Analysis:**
Renders RF signal detections as overlay markers on the tactical map. Contains signal
processing logic (frequency binning, power level normalization), detection classification
(radar, comms, jamming), and Leaflet rendering with custom icons.

**Decomposition Strategy:**
Separate domain logic (RF detection, classification) from presentation (Leaflet overlay).
The processing pipeline becomes a standalone TypeScript service; the renderer becomes a
thin Svelte component.

**New File Manifest:**

| New File                                             | Content                                                  | Est. Lines |
| ---------------------------------------------------- | -------------------------------------------------------- | ---------- |
| `components/map/air-signal/AirSignalOverlay.svelte`  | Orchestrator, binds service to map                       | ~180       |
| `components/map/air-signal/RFDetectionService.ts`    | Detection classification, threat assessment              | ~200       |
| `components/map/air-signal/SpectrumProcessor.ts`     | Frequency binning, power normalization, averaging        | ~200       |
| `components/map/air-signal/SignalOverlayRenderer.ts` | Leaflet marker creation, icon factories, popup builders  | ~220       |
| `components/map/air-signal/airSignalTypes.ts`        | DetectionResult, SignalClassification, ThreatLevel types | ~60        |

**Verification:**

```bash
wc -l src/lib/components/map/air-signal/*.svelte src/lib/components/map/air-signal/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

### 4.1.6 `src/routes/rtl-433/+page.svelte` (1,009 lines)

**Content Analysis:**
RTL-433 SDR receiver page. Contains device signal table, protocol decoder display,
frequency controls, signal history chart, and device configuration panel. Heavy inline
logic for decoding RTL-433 JSON output into typed device records.

**Decomposition Strategy:**
Extract the three major UI sections into components and the decoder logic into a service.

**New File Manifest:**

| New File                               | Content                                             | Est. Lines |
| -------------------------------------- | --------------------------------------------------- | ---------- |
| `routes/rtl-433/+page.svelte`          | Page shell, layout, store subscriptions             | ~120       |
| `routes/rtl-433/RTL433Controls.svelte` | Frequency selector, gain controls, start/stop       | ~180       |
| `routes/rtl-433/SignalTable.svelte`    | Signal history data table with sorting/filtering    | ~250       |
| `routes/rtl-433/DeviceDecoder.svelte`  | Protocol decoder output display                     | ~200       |
| `routes/rtl-433/rtl433Decoder.ts`      | JSON parsing, protocol identification, type mapping | ~150       |

**Verification:**

```bash
wc -l src/routes/rtl-433/*.svelte src/routes/rtl-433/*.ts
npm run build 2>&1 | tail -5
```

---

### 4.1.7 `src/lib/components/dashboard/TopStatusBar.svelte` (1,001 lines)

**Content Analysis:**
Dashboard header bar. Displays system metrics (CPU, memory, disk), connection indicators
for each service (Kismet, HackRF, GPS, GSM), GPS coordinates with fix quality, and a
real-time clock. Contains substantial polling logic and WebSocket subscription management.

**Decomposition Strategy:**
Extract each indicator cluster into a self-contained component. Move polling logic into
a shared status service.

**New File Manifest:**

| New File                                                      | Content                                        | Est. Lines |
| ------------------------------------------------------------- | ---------------------------------------------- | ---------- |
| `components/dashboard/status-bar/TopStatusBar.svelte`         | Bar layout, imports indicators                 | ~120       |
| `components/dashboard/status-bar/SystemMetrics.svelte`        | CPU, memory, disk gauges                       | ~180       |
| `components/dashboard/status-bar/ConnectionIndicators.svelte` | Service status dots (Kismet, HackRF, etc.)     | ~200       |
| `components/dashboard/status-bar/GPSStatusBadge.svelte`       | GPS fix quality, lat/lon display               | ~150       |
| `components/dashboard/status-bar/ClockDisplay.svelte`         | UTC/local time, mission elapsed timer          | ~80        |
| `components/dashboard/status-bar/statusBarService.ts`         | Polling orchestration, WebSocket subscriptions | ~150       |

**Verification:**

```bash
wc -l src/lib/components/dashboard/status-bar/*.svelte src/lib/components/dashboard/status-bar/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

## 5. Task 5.4.2 -- Decompose Tier 2 Files (23 files, 500-999 lines)

**Priority: HIGH. Execute after all Tier 1 files are committed.**

Each file receives a decomposition strategy and target output. Decompositions are ordered
by directory to minimize context-switching during execution.

---

### 5.4.2-01 `src/lib/server/kismet/device_intelligence.ts` (930 lines)

**Content:** OUI database (~400 lines of MAC prefix mappings), device classification logic,
manufacturer lookup, device capability inference, threat scoring heuristics.

**Strategy:** Extract the OUI database into `device_intelligence/oui-database.ts` as a
`ReadonlyMap<string, string>`. Extract threat scoring into `device_intelligence/threat-scoring.ts`.
Keep classification logic in `device_intelligence/classifier.ts`. Create barrel `index.ts`.

**Target Files:** 4 files. Largest: oui-database.ts (~420 lines -- acceptable as pure data).

**Verification:** `grep -r "device_intelligence" src/ --include="*.ts" -l` -- all importers
must resolve. `npx tsc --noEmit`.

---

### 5.4.2-02 `src/lib/components/drone/MissionControl.svelte` (853 lines)

**Content:** Waypoint editor with drag-and-drop reordering, mission timeline visualization,
flight control buttons (arm, takeoff, land, RTL), telemetry display, and mission upload.

**Strategy:** Extract `WaypointEditor.svelte` (waypoint list + drag reorder, ~250 lines),
`MissionTimeline.svelte` (timeline bar + progress, ~200 lines), `FlightControls.svelte`
(arm/takeoff/land buttons + confirmation dialogs, ~180 lines). Parent orchestrates.

**Target Files:** 4 Svelte files. Parent: ~180 lines.

---

### 5.4.2-03 `src/lib/services/map/droneDetection.ts` (830 lines)

**Content:** RF-based drone detection algorithms: frequency signature matching, protocol
identification (DJI OcuSync, Lightbridge), signal strength triangulation, flight path
prediction, and alert generation.

**Strategy:** Split by algorithm domain. `droneDetection/signatureMatching.ts` (frequency
pattern matching, ~200 lines). `droneDetection/protocolIdentifier.ts` (DJI protocol
constants + detection, ~200 lines). `droneDetection/triangulation.ts` (multi-sensor
position estimation, ~200 lines). `droneDetection/alertGenerator.ts` (threat assessment +
alert emission, ~150 lines). Barrel `index.ts` re-exports public API.

**Target Files:** 5 files. No file exceeds 250 lines.

---

### 5.4.2-04 `src/lib/server/kismet/security_analyzer.ts` (813 lines)

**Content:** WiFi security rule engine. Contains inline rule definitions for WEP detection,
WPA downgrade attacks, rogue AP detection, deauth flood detection, PMKID harvesting
signatures. Mix of rule data and evaluation logic.

**Strategy:** Extract rule definitions into `security_analyzer/rules/` directory with one
file per attack category: `wep-rules.ts`, `wpa-rules.ts`, `rogue-ap-rules.ts`,
`deauth-rules.ts`, `pmkid-rules.ts`. Keep evaluation engine in `security_analyzer/engine.ts`.
Create `security_analyzer/types.ts` for SecurityRule, SecurityFinding, ThreatLevel.

**Target Files:** 8 files. Largest: engine.ts (~200 lines).

---

### 5.4.2-05 `src/routes/droneid/+page.svelte` (812 lines)

**Content:** DroneID monitoring page. Drone list with real-time updates, drone detail panel
with telemetry, WebSocket connection management panel, frequency spectrum mini-display.

**Strategy:** Extract `DroneList.svelte` (filterable drone table, ~200 lines),
`DroneDetail.svelte` (telemetry detail panel, ~250 lines), `WebSocketPanel.svelte`
(connection status + controls, ~150 lines). Parent handles layout + store subscriptions.

**Target Files:** 4 Svelte files. Parent: ~180 lines.

---

### 5.4.2-06 `src/lib/server/kismet/kismet_controller.ts` (808 lines)

**Content:** Kismet process lifecycle management (start/stop/restart), device enrichment
pipeline (calls device_intelligence + security_analyzer), HTTP API client orchestration,
health monitoring with restart logic.

**Strategy:** Extract process management into `kismet_controller/processLifecycle.ts` (~200
lines). Extract device enrichment pipeline into `kismet_controller/deviceEnrichment.ts`
(~250 lines). Keep HTTP orchestration in `kismet_controller/controller.ts` (~250 lines).
Create barrel `index.ts`.

**Target Files:** 4 files.

---

### 5.4.2-07 `src/lib/components/map/SignalFilterControls.svelte` (784 lines)

**Content:** Complex filter UI with frequency range slider, signal type checkboxes, time
window selector, custom filter presets with save/load, and filter combination logic.

**Strategy:** Extract `FilterPresets.svelte` (preset management UI, ~200 lines),
`FrequencyRangeSlider.svelte` (dual-thumb range slider, ~180 lines), `SignalTypeFilter.svelte`
(checkbox groups by signal type, ~150 lines). Parent composes filters and emits combined
filter predicate.

**Target Files:** 4 Svelte files. Parent: ~200 lines.

---

### 5.4.2-08 `src/routes/+page.svelte` (753 lines)

**Content:** Application landing page / main navigation hub. Hero section, feature cards,
tool navigation grid, system status summary.

**Strategy:** Extract `HeroSection.svelte` (~180 lines), `FeatureGrid.svelte` (~200 lines),
`NavigationCards.svelte` (~200 lines). Move static content data (card titles, descriptions,
icons) into `landingPageData.ts`.

**Target Files:** 4 Svelte files + 1 data file. Parent: ~100 lines.

---

### 5.4.2-09 `src/lib/components/dashboard/panels/OverviewPanel.svelte` (751 lines)

**Content:** Dashboard overview tab. Metrics grid (4-6 KPI cards), activity feed (scrolling
event log), quick action buttons, service health summary, and mini charts.

**Strategy:** Extract `MetricsGrid.svelte` (~200 lines), `ActivityFeed.svelte` (~180 lines),
`QuickActions.svelte` (~120 lines), `ServiceHealthSummary.svelte` (~150 lines). Parent
handles data subscription and layout.

**Target Files:** 5 Svelte files. Parent: ~100 lines.

---

### 5.4.2-10 `src/routes/kismet/+page.svelte` (744 lines)

**Content:** Kismet WiFi scanner page. Device table with sorting/filtering, Kismet service
controls (start/stop/configure), channel hopping controls, alert display.

**Strategy:** Extract `DeviceTable.svelte` (sortable device list, ~250 lines),
`KismetControls.svelte` (service management UI, ~200 lines), `ChannelControls.svelte`
(channel hopping config, ~120 lines). Parent handles page layout + store wiring.

**Target Files:** 4 Svelte files. Parent: ~150 lines.

---

### 5.4.2-11 `src/routes/wifite/+page.svelte` (698 lines)

**Content:** Wifite automated WiFi attack tool page. Target network list, attack
configuration panel, progress display, results table.

**Strategy:** Extract `TargetList.svelte` (network selection table, ~200 lines),
`AttackConfig.svelte` (attack type selector + parameters, ~180 lines),
`AttackProgress.svelte` (progress bars + log output, ~150 lines). Parent manages
WebSocket connection and page layout.

**Target Files:** 4 Svelte files. Parent: ~140 lines.

---

### 5.4.2-12 `src/lib/components/dashboard/TerminalPanel.svelte` (691 lines)

**Content:** Embedded terminal emulator component. Tab management for multiple terminal
sessions, command input with history, output rendering with ANSI color support, terminal
resize handling.

**Strategy:** Extract `TerminalTabs.svelte` (tab bar + new/close, ~150 lines),
`CommandInput.svelte` (input line + history navigation, ~180 lines), `TerminalOutput.svelte`
(ANSI-parsed output display, ~200 lines). Parent orchestrates tab state and I/O routing.

**Target Files:** 4 Svelte files. Parent: ~150 lines.

---

### 5.4.2-13 `src/lib/server/mcp/dynamic-server.ts` (646 lines)

**Content:** MCP (Model Context Protocol) server with 12 tool handlers inline. Each handler
contains HTTP fetch logic, response parsing, and error handling. The tool registration
and dispatch boilerplate is interspersed with business logic.

**Strategy:** Extract each tool handler into `mcp/tools/{tool-name}.ts`. Keep server
bootstrap, tool registration, and transport setup in `dynamic-server.ts`. Create
`mcp/tools/index.ts` barrel that exports a `ToolHandler[]` array.

**Target Files:** 13+ files (1 per tool + barrel + server). Server reduces to ~120 lines.

**Note:** This is the MCP server documented in project memory. Preserve the HTTP API
communication pattern (localhost:5173). Do NOT introduce SvelteKit internal imports.

---

### 5.4.2-14 `src/lib/services/recovery/errorRecovery.ts` (624 lines)

**Content:** Error recovery service. Contains recovery strategy definitions for each service
type (Kismet, HackRF, GPS, WebSocket), retry logic with exponential backoff, circuit
breaker implementation, health check orchestration.

**Strategy:** Extract recovery strategies into `errorRecovery/strategies/` with one file per
service: `kismetRecovery.ts`, `hackrfRecovery.ts`, `gpsRecovery.ts`, `websocketRecovery.ts`.
Keep orchestration engine in `errorRecovery/engine.ts`. Extract circuit breaker into
`errorRecovery/circuitBreaker.ts` (reusable pattern).

**Target Files:** 7 files. Largest: engine.ts (~150 lines).

**CAUTION:** Per AC-5, verify this file's live callers are outside the dead serviceInitializer
island before decomposing. If all callers are dead, defer to Phase 4 deletion.

---

### 5.4.2-15 `src/lib/components/dashboard/AgentChatPanel.svelte` (623 lines)

**Content:** AI agent chat interface. Message list with markdown rendering, input area with
tool approval UI, streaming response display, conversation history management.

**Strategy:** Extract `MessageList.svelte` (message rendering + markdown, ~200 lines),
`ChatInputArea.svelte` (input + send button + tool approval, ~180 lines),
`StreamingResponse.svelte` (typing indicator + streaming text, ~100 lines). Parent manages
conversation state and API calls.

**Target Files:** 4 Svelte files. Parent: ~130 lines.

---

### 5.4.2-16 `src/lib/server/kismet/types.ts` (616 lines)

**Content:** Monolithic type file. Contains Kismet device interfaces, network interfaces,
API response types, WebSocket message types, and internal service types. Multiple
`KismetDevice` variants (raw, normalized, enriched).

**Strategy:** Split into layered type files: `types/raw-api.ts` (Kismet REST API response
shapes, snake_case), `types/device.ts` (normalized KismetDevice, camelCase),
`types/network.ts` (network/SSID types), `types/websocket.ts` (WS message types),
`types/internal.ts` (service-internal types). Barrel `types/index.ts` re-exports all.

**Target Files:** 6 files. This decomposition directly addresses the KismetDevice type
duplication flagged in the Type Duplicate Audit.

---

### 5.4.2-17 `src/lib/services/kismet/deviceManager.ts` (615 lines)

**Content:** Device data management service. Normalization of raw Kismet device records,
LRU caching of device state, diffing engine for detecting device state changes, batch
update aggregation.

**Strategy:** Extract `deviceManager/normalizer.ts` (raw-to-domain transformation, ~180
lines), `deviceManager/cache.ts` (LRU cache implementation, ~150 lines),
`deviceManager/diffEngine.ts` (state change detection, ~150 lines). Keep orchestration
in `deviceManager/manager.ts` (~130 lines).

**Target Files:** 4 files + barrel.

---

### 5.4.2-18 `src/lib/services/map/signalFiltering.ts` (586 lines)

**Content:** Signal filter predicate library. Contains filter functions for frequency range,
signal strength threshold, time window, device type, geographic bounds, and composite
filter builder.

**Strategy:** Extract individual filter predicates into `signalFiltering/predicates/` with
logical groupings: `frequency.ts`, `strength.ts`, `temporal.ts`, `geographic.ts`,
`deviceType.ts`. Keep composite builder in `signalFiltering/compositeFilter.ts`.

**Target Files:** 6 files + barrel. Each predicate file: ~80-100 lines.

---

### 5.4.2-19 `src/lib/server/kismet/webSocketManager.ts` (586 lines)

**Content:** WebSocket connection pool to Kismet. Connection lifecycle, message routing to
subscribers, automatic reconnection, health ping, message serialization/deserialization.

**Strategy:** Extract `webSocketManager/connectionPool.ts` (pool management + reconnection,
~200 lines), `webSocketManager/messageRouter.ts` (subscription registry + dispatch, ~180
lines). Keep lifecycle management in `webSocketManager/manager.ts` (~180 lines).

**Target Files:** 3 files + barrel.

---

### 5.4.2-20 `src/lib/services/kismet/kismetService.ts` (584 lines)

**Content:** High-level Kismet service. Polling orchestration for device lists, SSID lists,
and alerts. Response transformation from raw API to domain types. Cache invalidation logic.

**Strategy:** Extract `kismetService/poller.ts` (polling timer management, ~180 lines),
`kismetService/transformer.ts` (API response to domain type mapping, ~200 lines). Keep
service facade in `kismetService/service.ts` (~180 lines).

**Target Files:** 3 files + barrel.

---

### 5.4.2-21 `src/lib/services/monitoring/systemHealth.ts` (552 lines)

**Content:** System health metric collection. CPU usage reader, memory stats, disk usage,
service availability checks, temperature monitoring (RPi thermal zone), metric aggregation.

**Strategy:** Extract per-metric collectors: `systemHealth/cpuCollector.ts`,
`systemHealth/memoryCollector.ts`, `systemHealth/diskCollector.ts`,
`systemHealth/temperatureCollector.ts`, `systemHealth/serviceChecker.ts`. Keep aggregation
in `systemHealth/aggregator.ts`.

**Target Files:** 6 files + barrel. Each collector: ~80-100 lines.

**CAUTION:** Per AC-5, verify this file is NOT part of the dead serviceInitializer island.
If imported only by serviceInitializer, defer to Phase 4. If imported by live API routes,
proceed with decomposition.

---

### 5.4.2-22 `src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts` (546 lines)

**Content:** SSE streaming endpoint for GSM intelligent scanning. Contains stream parser
for GSM Evil output, frequency band scanning logic, IMSI capture processing, and SSE
event formatting.

**Strategy:** Extract `gsm-evil/intelligent-scan-stream/streamParser.ts` (GSM output
parsing, ~200 lines), `gsm-evil/intelligent-scan-stream/scanLogic.ts` (band scanning
algorithm, ~150 lines). Keep SSE endpoint handler in `+server.ts` (~180 lines).

**Target Files:** 3 files. SSE flow remains in endpoint (per established pattern: SSE
ReadableStream closures cannot be fully extracted to services).

**SECURITY NOTE:** Per runtime validation audit, the sibling `gsm-evil/control/+server.ts`
has a CRITICAL command injection at line 91. While decomposing this directory, add a
TODO comment referencing the injection finding but do NOT fix it in this phase (that is
Phase 6 scope -- runtime validation).

---

### 5.4.2-23 `src/lib/services/map/signalInterpolation.ts` (544 lines)

**Content:** Spatial interpolation algorithms for signal heatmap generation. IDW (inverse
distance weighting), kriging approximation, natural neighbor interpolation, grid
discretization, boundary handling.

**Strategy:** Extract each interpolation algorithm into its own module:
`signalInterpolation/idw.ts` (~120 lines), `signalInterpolation/kriging.ts` (~150 lines),
`signalInterpolation/naturalNeighbor.ts` (~120 lines). Keep grid management and algorithm
selection in `signalInterpolation/interpolator.ts` (~150 lines).

**Target Files:** 4 files + barrel.

---

## 6. Task 5.4.3 -- Decompose Tier 3 Files (~55 files, 300-499 lines)

**Priority: MEDIUM. Execute after Tier 1 and Tier 2 are committed.**

Tier 3 files are at or near the 300-line monitoring boundary. Not all require
decomposition. The decision matrix:

| Condition                                    | Action                           |
| -------------------------------------------- | -------------------------------- |
| File is pure data/types (no logic branches)  | ACCEPT as-is, document exception |
| File has 1-2 extractable functions >60 lines | Extract those functions only     |
| File has 3+ concerns mixed                   | Full decomposition               |
| File is 300-350 lines with clean SRP         | ACCEPT as-is, document exception |

Files are grouped by directory for batch processing efficiency.

---

### 6.1 Server Directory (`src/lib/server/`)

| #     | File                                        | Lines | Action    | Strategy                                                                                                                           |
| ----- | ------------------------------------------- | ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| T3-01 | `server/db/cleanupService.ts`               | 506   | DECOMPOSE | Extract cleanup strategies (signal, spatial, device) into `cleanupService/` modules. Keep scheduler in main file. Target: 3 files. |
| T3-02 | `server/wireshark.ts`                       | 494   | DECOMPOSE | Extract packet parser, protocol decoder, and capture manager. Target: 3 files.                                                     |
| T3-03 | `server/db/dbOptimizer.ts`                  | 492   | DECOMPOSE | Extract VACUUM logic, R-tree optimization, and index management. Target: 3 files.                                                  |
| T3-04 | `server/kismet/kismetProxy.ts`              | 484   | DECOMPOSE | Extract request rewriting, response transformation, and proxy middleware. Target: 3 files.                                         |
| T3-05 | `server/kismet/api_client.ts`               | 472   | REVIEW    | If mostly HTTP methods (GET/POST wrappers), ACCEPT. If mixed with business logic, extract.                                         |
| T3-06 | `server/wifite/processManager.ts`           | 453   | DECOMPOSE | Extract process lifecycle, output parser, and result collector. Target: 3 files.                                                   |
| T3-07 | `server/hardware/detection/usb-detector.ts` | 378   | REVIEW    | If device detection logic is cleanly separated, ACCEPT. Otherwise extract USB enumeration from classification.                     |
| T3-08 | `server/agent/frontend-tools.ts`            | 368   | DECOMPOSE | Extract tool definitions into individual files under `agent/tools/`. Target: 5+ files.                                             |
| T3-09 | `server/db/database.ts`                     | 356   | ACCEPT    | Database facade after Phase 5.0 repository decomposition. Already decomposed per memory notes.                                     |
| T3-10 | `server/agent/runtime.ts`                   | 335   | REVIEW    | If single-concern (agent execution runtime), ACCEPT. If mixed with tool dispatch, extract dispatcher.                              |
| T3-11 | `server/services/kismet.service.ts`         | 331   | REVIEW    | May overlap with kismetService.ts in services/. Verify not a duplicate before decomposing.                                         |
| T3-12 | `server/agent/tools.ts`                     | 315   | DECOMPOSE | Move each tool handler to individual files under `agent/tools/`. Target: matches 5.4.2-13 pattern.                                 |
| T3-13 | `server/websocket-server.ts`                | 304   | ACCEPT    | Core WebSocket server. Clean single-concern. 304 lines is acceptable.                                                              |

---

### 6.2 Services Directory (`src/lib/services/`)

| #     | File                                                         | Lines | Action    | Strategy                                                                                                                                                                     |
| ----- | ------------------------------------------------------------ | ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3-14 | `services/db/signalDatabase.ts`                              | 536   | DECOMPOSE | Extract query builders, batch insert logic, and spatial queries. Target: 3 files.                                                                                            |
| T3-15 | `services/streaming/dataStreamManager.ts`                    | 529   | DECOMPOSE | Extract stream lifecycle, backpressure management, and subscription registry. Target: 3 files. However, verify this is NOT part of the dead serviceInitializer island first. |
| T3-16 | `services/map/heatmapService.ts`                             | 499   | DECOMPOSE | Extract grid generation, color mapping, and canvas rendering. Target: 3 files.                                                                                               |
| T3-17 | `services/hackrf/timeWindowFilter.ts`                        | 485   | REVIEW    | If mostly filter predicates, ACCEPT. If mixed with buffer management, extract.                                                                                               |
| T3-18 | `services/hackrf/hackrfService.ts`                           | 481   | DECOMPOSE | Extract device lifecycle, configuration management, and streaming setup. Target: 3 files.                                                                                    |
| T3-19 | `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | 457   | REVIEW    | Single-concern error tracking. If clean, ACCEPT. May be consolidated with Phase 5.2 sdr-common.                                                                              |
| T3-20 | `services/map/networkAnalyzer.ts`                            | 435   | DECOMPOSE | Extract protocol analysis, topology mapping, and metrics calculation. Target: 3 files.                                                                                       |
| T3-21 | `services/hackrf/signalProcessor.ts`                         | 432   | DECOMPOSE | Extract FFT processing, peak detection, and signal classification. Target: 3 files.                                                                                          |
| T3-22 | `services/api/kismet.ts`                                     | 428   | REVIEW    | API client wrapper. If clean HTTP methods, ACCEPT. If mixed with transformation, extract transformer.                                                                        |
| T3-23 | `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | 423   | REVIEW    | May be consolidated with Phase 5.2 sdr-common. Defer if Phase 5.2 absorbs it.                                                                                                |
| T3-24 | `services/map/webglHeatmapRenderer.ts`                       | 411   | REVIEW    | WebGL shader setup + rendering. If shader code is inline, extract shaders. Otherwise ACCEPT.                                                                                 |
| T3-25 | `services/map/signalClustering.ts`                           | 411   | DECOMPOSE | Extract clustering algorithm (DBSCAN/k-means), cluster metrics, and spatial indexing. Target: 3 files.                                                                       |
| T3-26 | `services/db/dataAccessLayer.ts`                             | 378   | REVIEW    | If clean DAL pattern, ACCEPT. If mixed with business logic, extract.                                                                                                         |
| T3-27 | `services/websocket/base.ts`                                 | 376   | ACCEPT    | Base WebSocket class. Single inheritance concern. Acceptable size.                                                                                                           |
| T3-28 | `services/gsm-evil/server.ts`                                | 356   | REVIEW    | GSM Evil server integration. If clean process management, ACCEPT.                                                                                                            |
| T3-29 | `services/api/system.ts`                                     | 328   | ACCEPT    | System API client. Clean wrapper pattern. Acceptable size.                                                                                                                   |
| T3-30 | `services/monitoring/systemHealth.ts`                        | 552   | NOTE      | Already listed in Tier 2 (5.4.2-21). Do not double-count.                                                                                                                    |

---

### 6.3 Components Directory (`src/lib/components/`)

| #     | File                                                     | Lines | Action    | Strategy                                                                                         |
| ----- | -------------------------------------------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------ |
| T3-31 | `components/hackrf/SpectrumAnalysis.svelte`              | 416   | DECOMPOSE | Extract SpectrumControls, SpectrumChart (separate from T3-38), PeakAnnotations. Target: 3 files. |
| T3-32 | `components/dashboard/panels/DevicesPanel.svelte`        | 415   | DECOMPOSE | Extract DeviceCard, DeviceFilter, DeviceList. Target: 3 files.                                   |
| T3-33 | `components/kismet/ServiceControl.svelte`                | 411   | DECOMPOSE | Extract ServiceStatus, ControlButtons, ConfigEditor. Target: 3 files.                            |
| T3-34 | `components/hackrf/SpectrumChart.svelte`                 | 408   | REVIEW    | If primarily Chart.js/canvas config, ACCEPT. If mixed with data processing, extract processor.   |
| T3-35 | `components/tactical-map/kismet/KismetController.svelte` | 395   | DEFERRED  | Pending Phase 5.1 re-evaluation (see Section 2.4).                                               |
| T3-36 | `components/drone/FlightPathVisualization.svelte`        | 393   | REVIEW    | If primarily Leaflet polyline rendering, ACCEPT. If mixed with path calculation, extract.        |
| T3-37 | `components/dashboard/ToolApprovalDialog.svelte`         | 391   | REVIEW    | Single dialog component. If clean, ACCEPT. If >2 sub-dialogs embedded, extract.                  |
| T3-38 | `components/kismet/AlertsPanel.svelte`                   | 381   | REVIEW    | Alert list + filter. If clean, ACCEPT at 381 lines.                                              |
| T3-39 | `components/kismet/StatisticsPanel.svelte`               | 376   | REVIEW    | Statistics display. If primarily charts, ACCEPT.                                                 |
| T3-40 | `components/dashboard/frontendToolExecutor.ts`           | 371   | DECOMPOSE | Extract tool execution logic per tool type. Pattern matches 5.4.2-13. Target: per-tool files.    |
| T3-41 | `components/kismet/DeviceList.svelte`                    | 359   | REVIEW    | Device list with sorting. If clean, ACCEPT.                                                      |
| T3-42 | `components/dashboard/TerminalTabContent.svelte`         | 347   | REVIEW    | Tab content renderer. If clean, ACCEPT.                                                          |
| T3-43 | `components/tactical-map/kismet/DeviceManager.svelte`    | 335   | DEFERRED  | Pending Phase 5.1 re-evaluation.                                                                 |
| T3-44 | `components/tactical-map/hackrf/HackRFController.svelte` | 331   | DEFERRED  | Pending Phase 5.1 re-evaluation.                                                                 |
| T3-45 | `components/tactical-map/hackrf/FrequencySearch.svelte`  | 324   | DEFERRED  | Pending Phase 5.1 re-evaluation.                                                                 |
| T3-46 | `components/map/TimeFilterControls.svelte`               | 320   | ACCEPT    | Filter controls, near threshold. Clean SRP.                                                      |
| T3-47 | `components/hackrf/TimeWindowControl.svelte`             | 310   | ACCEPT    | Single-concern time window UI.                                                                   |
| T3-48 | `components/dashboard/views/TerminalView.svelte`         | 310   | ACCEPT    | Terminal view wrapper. Clean layout concern.                                                     |
| T3-49 | `components/kismet/MapView.svelte`                       | 309   | ACCEPT    | Map view wrapper for Kismet. Clean composition.                                                  |
| T3-50 | `components/tactical-map/map/MapLegend.svelte`           | 306   | DEFERRED  | Pending Phase 5.1 re-evaluation.                                                                 |

---

### 6.4 Routes Directory (`src/routes/`)

| #     | File                                                     | Lines | Action    | Strategy                                                                                                                                   |
| ----- | -------------------------------------------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| T3-51 | `routes/api/agent/tools/+server.ts`                      | 495   | DECOMPOSE | Extract individual tool handlers into `routes/api/agent/tools/handlers/`. Keep routing dispatch in `+server.ts`. Target: 5+ handler files. |
| T3-52 | `routes/api/gsm-evil/intelligent-scan-stream/+server.ts` | 546   | NOTE      | Already listed in Tier 2 (5.4.2-22). Do not double-count.                                                                                  |
| T3-53 | `routes/dashboard/+page.svelte`                          | 367   | REVIEW    | Dashboard page. If primarily layout + component imports, ACCEPT.                                                                           |
| T3-54 | `routes/api/gps/position/+server.ts`                     | 361   | REVIEW    | GPS API endpoint. If clean request/response, ACCEPT. If mixed with parsing, extract parser.                                                |
| T3-55 | `routes/gsm-evil/LocalIMSIDisplay.svelte`                | 358   | REVIEW    | IMSI display component. If primarily table + formatting, ACCEPT.                                                                           |
| T3-56 | `routes/api/hardware/details/+server.ts`                 | 325   | ACCEPT    | Hardware details API. Near threshold.                                                                                                      |

---

### 6.5 Stores Directory (`src/lib/stores/`)

| #     | File                                | Lines | Action    | Strategy                                                                                                  |
| ----- | ----------------------------------- | ----- | --------- | --------------------------------------------------------------------------------------------------------- |
| T3-57 | `stores/drone.ts`                   | 401   | DECOMPOSE | Extract flight state management, mission store, and telemetry store into separate files. Target: 3 files. |
| T3-58 | `stores/gsmEvilStore.ts`            | 389   | REVIEW    | If clean store with bounded arrays (per memory leak fixes), ACCEPT.                                       |
| T3-59 | `stores/packetAnalysisStore.ts`     | 370   | REVIEW    | If clean store pattern, ACCEPT.                                                                           |
| T3-60 | `stores/dashboard/terminalStore.ts` | 336   | ACCEPT    | Terminal state management. Clean concern.                                                                 |
| T3-61 | `stores/hackrf.ts`                  | 318   | ACCEPT    | HackRF state store. Near threshold with clean SRP.                                                        |

---

### 6.6 Tier 3 REVIEW Resolution Policy

> **REGRADE CORRECTION (2026-02-08)**: The Phase 5 Final Audit Report identified that 23
> Tier 3 files were marked "REVIEW" with conditional decisions (e.g., "If clean, ACCEPT.
> If mixed, extract.") This leaves the executing engineer to make independent architectural
> decisions, violating the zero-ambiguity principle. This section resolves all REVIEW files
> to a definitive action with a concrete decomposition template.

**Resolution principle**: After Phases 5.1-5.2 complete, each REVIEW file is inspected
using the criteria below. The **default action is ACCEPT** unless any of these triggers fire:

| Trigger                                                                          | Action             |
| -------------------------------------------------------------------------------- | ------------------ |
| Contains ≥3 functions >60 lines (per Phase 5.5 scanner)                          | DECOMPOSE          |
| Contains ≥2 distinct concerns (data fetch + rendering, parsing + business logic) | DECOMPOSE          |
| Contains inline data >100 lines (lookup tables, constants)                       | EXTRACT DATA       |
| Is consolidated by Phase 5.2 into sdr-common                                     | DEFER to Phase 5.2 |
| Is absorbed/restructured by Phase 5.1                                            | DEFER to Phase 5.1 |

**Resolved REVIEW actions:**

| #     | File                                                         | Lines | Resolution    | Rationale                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------ | ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3-05 | `server/kismet/api_client.ts`                                | 472   | **ACCEPT**    | HTTP wrapper with clean method-per-endpoint pattern. No logic mixing.                                                                                                                         |
| T3-07 | `server/hardware/detection/usb-detector.ts`                  | 378   | **ACCEPT**    | USB enumeration is single-concern. Device classification is co-located but logically part of detection.                                                                                       |
| T3-10 | `server/agent/runtime.ts`                                    | 335   | **ACCEPT**    | Single-concern agent execution runtime. 335 lines is acceptable.                                                                                                                              |
| T3-11 | `server/services/kismet.service.ts`                          | 331   | **ACCEPT**    | Verify not a duplicate of services/kismet/ first. If duplicate, delete in Phase 4. If unique, ACCEPT at 331 lines.                                                                            |
| T3-17 | `services/hackrf/timeWindowFilter.ts`                        | 485   | **DECOMPOSE** | 485 lines with mixed filter predicates and buffer management. Extract: `timeWindowFilter/predicates.ts` (~200), `timeWindowFilter/bufferRing.ts` (~150), `timeWindowFilter/filter.ts` (~135). |
| T3-19 | `services/hackrf/sweep-manager/error/ErrorTracker.ts`        | 457   | **DEFER**     | Will be consolidated into `sdr-common/error/` by Phase 5.2 Task 5.2.1. Do not decompose independently.                                                                                        |
| T3-22 | `services/api/kismet.ts`                                     | 428   | **ACCEPT**    | API client wrapper with clean HTTP method pattern. Transformation is per-endpoint, not extractable.                                                                                           |
| T3-23 | `services/hackrf/sweep-manager/frequency/FrequencyCycler.ts` | 423   | **DEFER**     | Will be consolidated into `sdr-common/frequency/` by Phase 5.2.                                                                                                                               |
| T3-24 | `services/map/webglHeatmapRenderer.ts`                       | 411   | **ACCEPT**    | WebGL shader setup + rendering is inherently coupled. Extracting shaders would create non-standard file types.                                                                                |
| T3-26 | `services/db/dataAccessLayer.ts`                             | 378   | **ACCEPT**    | Clean DAL pattern. All methods are thin query wrappers.                                                                                                                                       |
| T3-28 | `services/gsm-evil/server.ts`                                | 356   | **ACCEPT**    | Process management for GSM Evil. Clean single-concern.                                                                                                                                        |
| T3-34 | `components/hackrf/SpectrumChart.svelte`                     | 408   | **DECOMPOSE** | Mixed: Chart.js config + data transformation + user interaction. Extract: `SpectrumChartConfig.ts` (chart options, ~80), `SpectrumDataTransform.ts` (FFT display prep, ~120). Parent: ~210.   |
| T3-36 | `components/drone/FlightPathVisualization.svelte`            | 393   | **ACCEPT**    | Primarily Leaflet polyline rendering. Path calculation is light (<30 lines).                                                                                                                  |
| T3-37 | `components/dashboard/ToolApprovalDialog.svelte`             | 391   | **ACCEPT**    | Single dialog with sub-views. 391 lines is near threshold and has clean SRP.                                                                                                                  |
| T3-38 | `components/kismet/AlertsPanel.svelte`                       | 381   | **ACCEPT**    | Alert list + filter. Clean single-concern.                                                                                                                                                    |
| T3-39 | `components/kismet/StatisticsPanel.svelte`                   | 376   | **ACCEPT**    | Statistics display. Primarily declarative chart config.                                                                                                                                       |
| T3-41 | `components/kismet/DeviceList.svelte`                        | 359   | **ACCEPT**    | Device list with sorting. Clean table component.                                                                                                                                              |
| T3-42 | `components/dashboard/TerminalTabContent.svelte`             | 347   | **ACCEPT**    | Tab content renderer. Clean composition.                                                                                                                                                      |
| T3-53 | `routes/dashboard/+page.svelte`                              | 367   | **ACCEPT**    | Dashboard page is layout + component imports. Clean orchestrator.                                                                                                                             |
| T3-54 | `routes/api/gps/position/+server.ts`                         | 361   | **ACCEPT**    | GPS API endpoint. Request/response handling is single-concern.                                                                                                                                |
| T3-55 | `routes/gsm-evil/LocalIMSIDisplay.svelte`                    | 358   | **ACCEPT**    | IMSI display table + formatting. Clean SRP.                                                                                                                                                   |
| T3-58 | `stores/gsmEvilStore.ts`                                     | 389   | **ACCEPT**    | Clean store with bounded arrays (per memory leak fixes f300b8f).                                                                                                                              |
| T3-59 | `stores/packetAnalysisStore.ts`                              | 370   | **ACCEPT**    | Clean store pattern.                                                                                                                                                                          |

**Summary of resolutions**: 23 REVIEW files → 2 DECOMPOSE + 2 DEFER + 19 ACCEPT.

**Decomposition templates for resolved DECOMPOSE files:**

**Template: Mixed Concern Component** (T3-34 SpectrumChart):

```
Original:  ComponentName.svelte (>350 lines, mixed config + data + interaction)
Extract 1: ComponentNameConfig.ts       -- chart/canvas configuration objects
Extract 2: ComponentNameDataTransform.ts -- data preparation for display
Remaining: ComponentName.svelte          -- orchestrator + user interaction
Target: each file <250 lines
```

**Template: Mixed Filter/Buffer Service** (T3-17 timeWindowFilter):

```
Original:  serviceName.ts (>400 lines, mixed predicates + buffer management)
Extract 1: serviceName/predicates.ts  -- pure filter functions
Extract 2: serviceName/bufferRing.ts  -- data structure management
Remaining: serviceName/filter.ts      -- orchestration + public API
Barrel:    serviceName/index.ts       -- re-exports public API
Target: each file <200 lines
```

---

## 7. Execution Order

Strict sequential execution. Each tier completes fully before the next begins. Within
each tier, files are ordered by directory to minimize context-switching.

### Phase Gate: Pre-Execution

Before beginning any decomposition:

```bash
# 1. Verify Phase 4 dead code removal is complete
git log --oneline | head -20  # confirm dead code removal commits

# 2. Verify Phase 5.1 god page decomposition is complete
wc -l src/routes/tactical-map-simple/+page.svelte  # should be <500
wc -l src/routes/gsm-evil/+page.svelte              # should be <500

# 3. Verify Phase 5.2 deduplication is complete
ls src/lib/services/sdr-common/  # should exist with unified types

# 4. Baseline: count files >300 lines BEFORE this phase
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 300 {print}' | wc -l
```

### Tier 1 Execution (7 files, ~1 day)

| Order | File                            | Commit Message                                           |
| ----- | ------------------------------- | -------------------------------------------------------- |
| 1     | `toolHierarchy.ts`              | `refactor: split toolHierarchy into category modules`    |
| 2     | `KismetDashboardOverlay.svelte` | `refactor: extract KismetDashboardOverlay subcomponents` |
| 3     | `redesign/+page.svelte`         | `refactor: decompose redesign page into sections`        |
| 4     | `DashboardMap.svelte`           | `refactor: extract DashboardMap services and controls`   |
| 5     | `AirSignalOverlay.svelte`       | `refactor: extract RF detection and rendering services`  |
| 6     | `rtl-433/+page.svelte`          | `refactor: decompose RTL-433 page into components`       |
| 7     | `TopStatusBar.svelte`           | `refactor: extract status bar indicator components`      |

### Tier 2 Execution (23 files, ~3 days)

Execute by directory cluster:

| Order | Directory Cluster       | Files                                                     | Commit Pattern                             |
| ----- | ----------------------- | --------------------------------------------------------- | ------------------------------------------ |
| 8-10  | `server/kismet/`        | device_intelligence, security_analyzer, kismet_controller | `refactor(kismet): decompose {file}`       |
| 11    | `server/mcp/`           | dynamic-server                                            | `refactor(mcp): extract tool handlers`     |
| 12-13 | `server/kismet/`        | types, webSocketManager                                   | `refactor(kismet): split {file}`           |
| 14-16 | `services/kismet/`      | deviceManager, kismetService                              | `refactor(kismet): decompose {file}`       |
| 17-19 | `services/map/`         | droneDetection, signalFiltering, signalInterpolation      | `refactor(map): decompose {file}`          |
| 20    | `services/recovery/`    | errorRecovery                                             | `refactor(recovery): extract strategies`   |
| 21    | `services/monitoring/`  | systemHealth                                              | `refactor(monitoring): extract collectors` |
| 22-24 | `components/`           | MissionControl, SignalFilterControls, AgentChatPanel      | `refactor(ui): decompose {component}`      |
| 25-27 | `components/dashboard/` | OverviewPanel, TerminalPanel                              | `refactor(dashboard): decompose {panel}`   |
| 28-30 | `routes/`               | droneid, kismet, wifite, +page                            | `refactor: decompose {route} page`         |

### Tier 3 Execution (selective, ~2 days)

Execute only files marked DECOMPOSE (not ACCEPT or DEFERRED):

| Order | Action                     | Files                                                                             |
| ----- | -------------------------- | --------------------------------------------------------------------------------- |
| 31-35 | Server decompositions      | cleanupService, wireshark, dbOptimizer, kismetProxy, wifite/processManager        |
| 36-40 | Service decompositions     | signalDatabase, dataStreamManager, heatmapService, hackrfService, networkAnalyzer |
| 41-45 | Service decompositions     | signalProcessor, signalClustering                                                 |
| 46-50 | Component decompositions   | SpectrumAnalysis, DevicesPanel, ServiceControl, frontendToolExecutor              |
| 51-53 | Route/store decompositions | api/agent/tools, drone store                                                      |
| 54    | Server tools               | agent/frontend-tools, agent/tools                                                 |

### Phase Gate: Post-Execution

```bash
# 1. Count files >300 lines AFTER this phase
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 300 {print}' | wc -l
# Target: <30 (down from ~85 in scope)

# 2. Count files >500 lines (hard limit)
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 500 {print}' | wc -l
# Target: 0 (excluding documented exceptions for pure data files)

# 3. Full type check
npx tsc --noEmit 2>&1 | grep -c "error"
# Target: 0

# 4. Build verification
npm run build 2>&1 | tail -5
# Target: successful build

# 5. No broken imports
grep -r "from '\.\." src/ --include="*.ts" --include="*.svelte" | \
  grep -v node_modules | grep -v ".svelte-kit" | head -20
# Manually verify sample of relative imports resolve
```

---

## 8. Verification Checklist

Each decomposition commit MUST pass ALL of the following checks before merge:

### 8.1 Structural Verification

- [ ] No new file exceeds 500 lines (300-line target, 500-line hard limit)
- [ ] No function exceeds 60 lines (NASA/JPL Rule 2.4)
- [ ] Original file is either deleted or reduced to an orchestrator/barrel <200 lines
- [ ] All new files have appropriate TypeScript strict mode compliance
- [ ] No circular imports introduced (verify with `madge --circular src/`)

### 8.2 Functional Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes (or only pre-existing warnings)
- [ ] All existing import paths resolve (grep for old import path, verify zero matches
      or proper re-exports)
- [ ] Runtime smoke test: `npm run dev` starts without crash

### 8.3 Behavioral Preservation

- [ ] No logic changes -- decomposition is STRUCTURAL ONLY
- [ ] Function signatures unchanged (same parameters, same return types)
- [ ] Export surface unchanged (all previously exported symbols still exported)
- [ ] Store subscriptions unchanged (no new stores, no removed stores)
- [ ] WebSocket message handlers unchanged

### 8.4 Security Verification

- [ ] No secrets exposed during file splitting (grep for API keys, tokens, passwords)
- [ ] No new files with overly permissive exports (avoid `export *` from internal modules)
- [ ] File permissions unchanged (`ls -la` on new files)
- [ ] No commented-out code in new files (MISRA C:2012 Dir 4.4)

---

## 9. Risk Mitigations

### 9.1 Barrel Re-Export Strategy

**Risk:** Breaking existing import paths when moving files into subdirectories.

**Mitigation:** Every decomposed module MUST provide a barrel `index.ts` that re-exports
the full public API of the original file. Existing importers can use either:

- The barrel path: `import { fn } from './module'` (resolves to `./module/index.ts`)
- Direct submodule: `import { fn } from './module/submodule'`

The barrel ensures backward compatibility. After all importers are verified, the barrel
can optionally be thinned to export only the true public surface.

**Implementation Pattern:**

```typescript
// src/lib/services/map/droneDetection/index.ts
export { matchSignature, type SignatureMatch } from './signatureMatching';
export { identifyProtocol, type ProtocolResult } from './protocolIdentifier';
export { triangulatePosition } from './triangulation';
export { generateAlert, type DroneAlert } from './alertGenerator';
```

### 9.2 One File Per Commit

**Risk:** Large refactoring commits that are difficult to review, bisect, or revert.

**Mitigation:** Each Tier 1 and Tier 2 file decomposition is a single atomic commit.
Tier 3 files may be batched by directory (up to 3 files per commit) when the changes
are trivial extractions.

**Commit Message Format:**

```
refactor(scope): decompose {OriginalFile} into {N} modules

- Extract {Module1}: {brief description}
- Extract {Module2}: {brief description}
- Original file reduced from {X} to {Y} lines
- Barrel re-export preserves all existing import paths
- No logic changes, structural only
```

### 9.3 Test Coverage Gate

**Risk:** Decomposition introduces subtle import resolution bugs that pass type checking
but fail at runtime.

**Mitigation:** Before decomposing any file:

1. Run existing tests to establish baseline: `npm run test 2>&1 | tail -20`
2. After decomposition, re-run same tests. Zero regression tolerance.
3. If the file has no test coverage, add a minimal import-resolution test:

```typescript
// tests/unit/decomposition/{module}.test.ts
import { describe, it, expect } from 'vitest';
import * as module from '$lib/services/map/droneDetection';

describe('droneDetection barrel export', () => {
	it('exports all public symbols', () => {
		expect(module.matchSignature).toBeDefined();
		expect(module.identifyProtocol).toBeDefined();
		expect(module.triangulatePosition).toBeDefined();
		expect(module.generateAlert).toBeDefined();
	});
});
```

### 9.4 Handling Svelte Component Decomposition

**Risk:** Svelte components share reactive state via `$:` declarations, context API
(`setContext`/`getContext`), and slot forwarding. Naive extraction breaks reactivity.

**Mitigation:**

1. Props down, events up. Extracted child components receive data as props and emit
   changes via `createEventDispatcher()` or callback props.
2. Shared reactive state stays in the parent and is passed down. Do NOT create new
   stores for component-internal state.
3. Context API usage: if the parent uses `setContext`, all children that call
   `getContext` for the same key MUST remain in the same component tree.
4. Slot content: if the original component uses `<slot>`, the orchestrator parent
   retains the slot and passes content to the appropriate child.

### 9.5 Handling Service Singletons

**Risk:** Services using `globalThis` singleton pattern (per memory leak fixes) may
break if the module boundary changes.

**Mitigation:** The `globalThis` singleton guard MUST remain in the barrel `index.ts`,
not in submodules. Submodules export factory functions or classes. The barrel creates
and caches the singleton:

```typescript
// src/lib/services/map/droneDetection/index.ts
import { DroneDetectionService } from './service';

const GLOBAL_KEY = '__droneDetection__';

export function getDroneDetectionService(): DroneDetectionService {
	if (!(globalThis as any)[GLOBAL_KEY]) {
		(globalThis as any)[GLOBAL_KEY] = new DroneDetectionService();
	}
	return (globalThis as any)[GLOBAL_KEY];
}
```

### 9.6 Circular Dependency Prevention

**Risk:** Decomposing a large file into multiple smaller files in the same directory
can introduce circular imports when the extracted modules reference each other.

**Mitigation:**

1. Identify the dependency DAG BEFORE splitting. Draw which functions call which.
2. Types go in a dedicated `types.ts` file that has ZERO imports from sibling modules.
3. If A depends on B and B depends on A, introduce an interface in `types.ts` that
   both depend on, breaking the cycle.
4. Post-decomposition verification:

```bash
npx madge --circular src/lib/services/map/droneDetection/
# Must return: "No circular dependency found"
```

---

## 10. Documented Exceptions

Files that exceed 300 lines but are ACCEPTED without decomposition, with justification:

| File                                             | Lines             | Justification                                                                                                                                                         |
| ------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/websocket-server.ts`                     | 304               | Core WebSocket server. Single responsibility. Near threshold. Decomposition would scatter connection lifecycle across modules, increasing complexity.                 |
| `services/websocket/base.ts`                     | 376               | Base class for WebSocket services. Single inheritance concern. Extracting methods would require passing `this` context, adding complexity.                            |
| `stores/dashboard/terminalStore.ts`              | 336               | Terminal state management. Single store concern. Clean reactive pattern.                                                                                              |
| `stores/hackrf.ts`                               | 318               | HackRF state store. Clean Svelte store pattern.                                                                                                                       |
| `components/map/TimeFilterControls.svelte`       | 320               | Filter control component. Clean SRP. Near threshold.                                                                                                                  |
| `components/hackrf/TimeWindowControl.svelte`     | 310               | Time window UI. Single concern.                                                                                                                                       |
| `components/dashboard/views/TerminalView.svelte` | 310               | Terminal view layout. Clean composition.                                                                                                                              |
| `components/kismet/MapView.svelte`               | 309               | Map view wrapper. Clean composition.                                                                                                                                  |
| `server/db/database.ts`                          | 356               | Database facade. Already decomposed in prior phase (repository pattern). Stable.                                                                                      |
| `services/api/system.ts`                         | 328               | System API client. Clean HTTP wrapper pattern.                                                                                                                        |
| `routes/api/hardware/details/+server.ts`         | 325               | Hardware API endpoint. Clean request/response.                                                                                                                        |
| `toolHierarchy/oui-database.ts`                  | ~420 (post-split) | Pure data file (MAC prefix map). Zero logic branches. Exception per standard: declarative data files without branching logic are exempt from the 500-line hard limit. |

---

## 11. Success Criteria

This phase is COMPLETE when all of the following are true:

1. **Zero files >1,000 lines** in `src/` (excluding `node_modules`, `.svelte-kit`)
2. **Zero files >500 lines** except documented exceptions (Section 10)
3. **Files >300 lines reduced to <30** (from ~85 in scope)
4. **`npx tsc --noEmit`** returns zero errors
5. **`npm run build`** succeeds
6. **`npm run test`** passes with zero regressions from pre-decomposition baseline
7. **All Tier 1 and Tier 2 files** decomposed per their individual plans
8. **All barrel re-exports** verified to preserve existing import paths
9. **`npx madge --circular src/`** reports zero circular dependencies introduced by this phase
10. **Every commit** follows the one-file-per-commit rule (Tier 1/2) or directory-batch rule (Tier 3)

---

## 12. Appendix A: File Size Distribution (Pre-Phase)

```
Lines Range    | Count | % of 108 | Action
---------------|-------|----------|------------------
>1,000         |     7 |    6.5%  | DECOMPOSE (Tier 1)
500-999        |    23 |   21.3%  | DECOMPOSE (Tier 2)
300-499        |   ~55 |   50.9%  | REVIEW/DECOMPOSE (Tier 3)
Handled by 5.1 |     4 |    3.7%  | EXCLUDED
Handled by 5.2 |    10 |    9.3%  | EXCLUDED
Handled by P4  |     6 |    5.6%  | EXCLUDED (deleted)
Deferred (5.1) |     5 |    4.6%  | DEFERRED
---------------|-------|----------|------------------
Total          |   108*|  100.0%  |
```

\*Note: Some files appear in multiple categories (e.g., systemHealth.ts counted once
but flagged in both AC-5 and Tier 2). The 108 count represents unique files.

---

## 13. Appendix B: Naming Conventions for Extracted Modules

| Pattern                   | Convention                         | Example                                        |
| ------------------------- | ---------------------------------- | ---------------------------------------------- |
| Svelte subcomponent       | PascalCase matching parent prefix  | `KismetDashboardOverlay/DeviceTypeIcon.svelte` |
| TypeScript service module | camelCase matching function domain | `droneDetection/signatureMatching.ts`          |
| Types file                | `types.ts` in module directory     | `droneDetection/types.ts`                      |
| Barrel re-export          | `index.ts` in module directory     | `droneDetection/index.ts`                      |
| Pure data file            | descriptive camelCase              | `tools/rf-tools.ts`                            |
| Utility functions         | `{domain}Utils.ts`                 | `kismetOverlayUtils.ts`                        |
| Constants file            | `constants.ts` in module directory | `security_analyzer/constants.ts`               |

---

## 14. Appendix C: Dependency Graph Notation

Before decomposing any Tier 1 or Tier 2 file, draw the internal dependency graph using
this notation:

```
[Module A] --imports--> [Module B]
[Module A] --calls--> [Function C]
[Module A] --reads--> [Store D]
[Module A] --emits--> [Event E]
```

Verify the graph is a DAG (directed acyclic graph). If cycles exist, resolve them
BEFORE beginning extraction by introducing an interface in `types.ts`.

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4 File Size Enforcement -- Version 1.1 FINAL
```

**Revision History:**

| Version | Date       | Change                                                                                                                                                                                                                                  |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-08 | Initial release.                                                                                                                                                                                                                        |
| 1.1     | 2026-02-08 | **REGRADE CORRECTION**: Added Section 6.6 resolving all 23 REVIEW files to definitive actions (2 DECOMPOSE, 2 DEFER, 19 ACCEPT). Added decomposition templates for resolved DECOMPOSE files. Per Phase 5 Final Audit Report Priority 4. |
