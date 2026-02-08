# Phase 5.4.8 -- Tier 2: Server Cluster Decomposition (Items 5.4.2-01 through 5.4.2-06)

```
Document ID:    ARGOS-AUDIT-P5.4.8-TIER2-SERVER-CLUSTER
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.8 -- Decompose 6 Tier 2 server files (500-999 lines)
Risk Level:     MEDIUM
Prerequisites:  Phase 5.4.1-5.4.7 (all Tier 1) COMPLETE
Files Touched:  6 source files -> ~29 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Scope

This sub-task covers Tier 2 items 5.4.2-01 through 5.4.2-06 -- server-side files in the
Kismet and drone detection clusters.

| Item     | File                                             | Lines | Execution Order |
| -------- | ------------------------------------------------ | ----- | --------------- |
| 5.4.2-01 | `src/lib/server/kismet/device_intelligence.ts`   | 930   | 8               |
| 5.4.2-02 | `src/lib/components/drone/MissionControl.svelte` | 853   | 9               |
| 5.4.2-03 | `src/lib/services/map/droneDetection.ts`         | 830   | 10              |
| 5.4.2-04 | `src/lib/server/kismet/security_analyzer.ts`     | 813   | 11              |
| 5.4.2-05 | `src/routes/droneid/+page.svelte`                | 812   | 12              |
| 5.4.2-06 | `src/lib/server/kismet/kismet_controller.ts`     | 808   | 13              |

---

## 2. Item 5.4.2-01: device_intelligence.ts (930 lines)

### Content Analysis

OUI database (~400 lines of MAC prefix mappings), device classification logic,
manufacturer lookup, device capability inference, threat scoring heuristics.

### Decomposition Strategy

Extract the OUI database into a standalone data module. Extract threat scoring into a
separate heuristics module. Keep classification logic in the main classifier.

### New File Manifest

| New File                                              | Content                                     | Est. Lines |
| ----------------------------------------------------- | ------------------------------------------- | ---------- |
| `server/kismet/device_intelligence/index.ts`          | Barrel re-export                            | ~30        |
| `server/kismet/device_intelligence/oui-database.ts`   | ReadonlyMap<string, string> MAC->vendor     | ~420       |
| `server/kismet/device_intelligence/threat-scoring.ts` | Threat scoring heuristics                   | ~180       |
| `server/kismet/device_intelligence/classifier.ts`     | Device classification, capability inference | ~250       |

**Note:** `oui-database.ts` at ~420 lines is a documented exception (Phase 5.4.0 Section 7).
Pure data file with zero logic branches. Exempt from 500-line hard limit.

### Verification

```bash
grep -r "device_intelligence" src/ --include="*.ts" -l  # all importers must resolve
npx tsc --noEmit
wc -l src/lib/server/kismet/device_intelligence/*.ts
```

---

## 3. Item 5.4.2-02: MissionControl.svelte (853 lines)

### Content Analysis

Waypoint editor with drag-and-drop reordering, mission timeline visualization,
flight control buttons (arm, takeoff, land, RTL), telemetry display, and mission upload.

### Decomposition Strategy

Extract three subcomponents. Parent becomes layout orchestrator.

### New File Manifest

| New File                                          | Content                                         | Est. Lines |
| ------------------------------------------------- | ----------------------------------------------- | ---------- |
| `components/drone/mission/MissionControl.svelte`  | Orchestrator, layout, state management          | ~180       |
| `components/drone/mission/WaypointEditor.svelte`  | Waypoint list + drag reorder                    | ~250       |
| `components/drone/mission/MissionTimeline.svelte` | Timeline bar + progress indicator               | ~200       |
| `components/drone/mission/FlightControls.svelte`  | Arm/takeoff/land buttons + confirmation dialogs | ~180       |

### Key Constraints

- Drag-and-drop state (currently active drag item) stays in the parent, passed as prop.
- Flight control buttons require confirmation dialogs. Dialog state management stays in FlightControls.
- Telemetry display stays in the parent or in a dedicated TelemetryDisplay if >60 lines.

### Verification

```bash
wc -l src/lib/components/drone/mission/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
npm run build 2>&1 | tail -5
```

---

## 4. Item 5.4.2-03: droneDetection.ts (830 lines)

### Content Analysis

RF-based drone detection algorithms: frequency signature matching, protocol
identification (DJI OcuSync, Lightbridge), signal strength triangulation, flight path
prediction, and alert generation.

### Decomposition Strategy

Split by algorithm domain. Each detection algorithm becomes a standalone module.

### New File Manifest

| New File                                            | Content                            | Est. Lines |
| --------------------------------------------------- | ---------------------------------- | ---------- |
| `services/map/droneDetection/index.ts`              | Barrel re-export                   | ~30        |
| `services/map/droneDetection/signatureMatching.ts`  | Frequency pattern matching         | ~200       |
| `services/map/droneDetection/protocolIdentifier.ts` | DJI protocol constants + detection | ~200       |
| `services/map/droneDetection/triangulation.ts`      | Multi-sensor position estimation   | ~200       |
| `services/map/droneDetection/alertGenerator.ts`     | Threat assessment + alert emission | ~150       |

### Barrel Re-Export Pattern

```typescript
// services/map/droneDetection/index.ts
export { matchSignature, type SignatureMatch } from './signatureMatching';
export { identifyProtocol, type ProtocolResult } from './protocolIdentifier';
export { triangulatePosition } from './triangulation';
export { generateAlert, type DroneAlert } from './alertGenerator';
```

### Verification

```bash
wc -l src/lib/services/map/droneDetection/*.ts
npx tsc --noEmit
npx madge --circular src/lib/services/map/droneDetection/
```

---

## 5. Item 5.4.2-04: security_analyzer.ts (813 lines)

### Content Analysis

WiFi security rule engine. Contains inline rule definitions for WEP detection,
WPA downgrade attacks, rogue AP detection, deauth flood detection, PMKID harvesting
signatures. Mix of rule data and evaluation logic.

### Decomposition Strategy

Extract rule definitions into a `rules/` subdirectory with one file per attack category.
Keep the evaluation engine separate from rule data.

### New File Manifest

| New File                                                  | Content                                    | Est. Lines |
| --------------------------------------------------------- | ------------------------------------------ | ---------- |
| `server/kismet/security_analyzer/index.ts`                | Barrel re-export                           | ~30        |
| `server/kismet/security_analyzer/engine.ts`               | Rule evaluation engine                     | ~200       |
| `server/kismet/security_analyzer/types.ts`                | SecurityRule, SecurityFinding, ThreatLevel | ~60        |
| `server/kismet/security_analyzer/rules/wep-rules.ts`      | WEP detection rules                        | ~80        |
| `server/kismet/security_analyzer/rules/wpa-rules.ts`      | WPA downgrade rules                        | ~80        |
| `server/kismet/security_analyzer/rules/rogue-ap-rules.ts` | Rogue AP detection rules                   | ~80        |
| `server/kismet/security_analyzer/rules/deauth-rules.ts`   | Deauth flood detection rules               | ~80        |
| `server/kismet/security_analyzer/rules/pmkid-rules.ts`    | PMKID harvesting signature rules           | ~80        |

### Key Constraints

- `types.ts` imports NOTHING from siblings (dependency DAG root).
- Each rule file exports a `SecurityRule[]` array. The engine imports and aggregates all rule arrays.
- Rule data is static and declarative. No functions >60 lines expected in rule files.

### Verification

```bash
wc -l src/lib/server/kismet/security_analyzer/*.ts src/lib/server/kismet/security_analyzer/rules/*.ts
npx tsc --noEmit
```

---

## 6. Item 5.4.2-05: droneid/+page.svelte (812 lines)

### Content Analysis

DroneID monitoring page. Drone list with real-time updates, drone detail panel
with telemetry, WebSocket connection management panel, frequency spectrum mini-display.

### Decomposition Strategy

Extract three subcomponents. Parent handles layout and store subscriptions.

### New File Manifest

| New File                               | Content                                       | Est. Lines |
| -------------------------------------- | --------------------------------------------- | ---------- |
| `routes/droneid/+page.svelte`          | Page shell, store subscriptions, layout       | ~180       |
| `routes/droneid/DroneList.svelte`      | Filterable drone table with real-time updates | ~200       |
| `routes/droneid/DroneDetail.svelte`    | Telemetry detail panel                        | ~250       |
| `routes/droneid/WebSocketPanel.svelte` | Connection status + controls                  | ~150       |

### Verification

```bash
wc -l src/routes/droneid/*.svelte
npm run build 2>&1 | tail -5
```

---

## 7. Item 5.4.2-06: kismet_controller.ts (808 lines)

### Content Analysis

Kismet process lifecycle management (start/stop/restart), device enrichment
pipeline (calls device_intelligence + security_analyzer), HTTP API client orchestration,
health monitoring with restart logic.

### Decomposition Strategy

Extract process management and device enrichment into separate modules. Keep HTTP
orchestration as the main controller.

### New File Manifest

| New File                                              | Content                               | Est. Lines |
| ----------------------------------------------------- | ------------------------------------- | ---------- |
| `server/kismet/kismet_controller/index.ts`            | Barrel re-export                      | ~30        |
| `server/kismet/kismet_controller/processLifecycle.ts` | Start/stop/restart process management | ~200       |
| `server/kismet/kismet_controller/deviceEnrichment.ts` | Device enrichment pipeline            | ~250       |
| `server/kismet/kismet_controller/controller.ts`       | HTTP orchestration, health monitoring | ~250       |

### Key Constraints

- `deviceEnrichment.ts` imports from `device_intelligence` and `security_analyzer`.
  After those modules are decomposed (items 5.4.2-01 and 5.4.2-04), imports reference
  their barrel `index.ts` files.
- `processLifecycle.ts` uses `child_process.spawn`. Ensure the spawn call and its
  cleanup remain in the same module (CERT C MEM00).
- The controller's health monitoring restart logic calls into `processLifecycle`.
  Dependency direction: `controller.ts` -> `processLifecycle.ts` (no reverse dependency).

### Verification

```bash
wc -l src/lib/server/kismet/kismet_controller/*.ts
npx tsc --noEmit
npx madge --circular src/lib/server/kismet/kismet_controller/
```

---

## 8. Execution Order Within This Sub-Task

| Order | Item     | File                   | Commit Message                                                   |
| ----- | -------- | ---------------------- | ---------------------------------------------------------------- |
| 8     | 5.4.2-01 | device_intelligence.ts | `refactor(kismet): decompose device_intelligence into modules`   |
| 9     | 5.4.2-02 | MissionControl.svelte  | `refactor(drone): decompose MissionControl into subcomponents`   |
| 10    | 5.4.2-03 | droneDetection.ts      | `refactor(map): decompose droneDetection into algorithm modules` |
| 11    | 5.4.2-04 | security_analyzer.ts   | `refactor(kismet): decompose security_analyzer into rule engine` |
| 12    | 5.4.2-05 | droneid/+page.svelte   | `refactor: decompose droneid page into components`               |
| 13    | 5.4.2-06 | kismet_controller.ts   | `refactor(kismet): decompose kismet_controller into modules`     |

**One commit per file.** Each commit must pass `npx tsc --noEmit` and `npm run build`.

---

## 9. Aggregate Verification

After all 6 items are committed:

```bash
# All new files within limits
find src/lib/server/kismet/ src/lib/services/map/droneDetection/ \
  src/lib/components/drone/mission/ src/routes/droneid/ \
  -name "*.ts" -o -name "*.svelte" | xargs wc -l | awk '$1 > 300 {print}'
# Expected: zero lines (no file >300)

# Full type check
npx tsc --noEmit 2>&1 | grep -c "error"
# Expected: 0

# No circular dependencies in decomposed modules
npx madge --circular src/lib/server/kismet/device_intelligence/
npx madge --circular src/lib/services/map/droneDetection/
npx madge --circular src/lib/server/kismet/security_analyzer/
npx madge --circular src/lib/server/kismet/kismet_controller/
```

---

## 10. Standards Compliance

| Standard             | Compliance                                                         |
| -------------------- | ------------------------------------------------------------------ |
| Barr Group Rule 1.3  | All files <300 lines except oui-database.ts (documented exception) |
| NASA/JPL Rule 2.4    | Functions extracted into appropriately-sized modules               |
| CERT C MEM00         | Process spawn/cleanup in same module (processLifecycle.ts)         |
| CERT C MSC41         | No secrets in any extracted module                                 |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                                 |
| DoD STIG V-222602    | Cross-referenced Phase 4; all files confirmed alive                |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.8 -- Tier 2: Server Cluster Decomposition
```
