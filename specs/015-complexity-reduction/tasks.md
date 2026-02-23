# Tasks: Complexity Reduction

**Input**: Design documents from `/specs/015-complexity-reduction/`
**Prerequisites**: plan.md, spec.md, research.md
**Threshold**: Cyclomatic ≤5, Cognitive ≤5 — error level, zero exceptions
**Scope**: 536 violations across 185 files

**Organization**: Tasks are grouped by file proximity clusters per plan.md execution order. Each task addresses ALL violations in a single file. Each cluster can be independently verified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=critical 25+, US2=moderate 6-24, US3=borderline 6)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Verify current violation inventory and establish baseline

- [ ] T001 Run full complexity audit at threshold 5 and record baseline: `npx eslint src/ --config config/eslint.config.js 2>&1 | grep -c complexity` — expect ~536
- [ ] T002 Verify all existing tests pass before refactoring with `npx vitest run --no-coverage`

**Checkpoint**: Baseline established (536 violations), all tests green

---

## Phase 2: Dashboard Map Cluster (17 violations, 4 files) — Critical

**Goal**: Refactor the highest-complexity functions in the dashboard map subsystem

**Independent Test**: `npx eslint src/lib/components/dashboard/map/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T003 [US1] Refactor all functions in src/lib/components/dashboard/map/map-geojson.ts — `buildDeviceGeoJSON` (cyc=35, cog=20), arrow@L86 (cyc=12), arrow@L160 (cyc=21, cog=9). Extract `buildFeatureFromDevice`, `classifyDeviceType`, `buildCoordinates`, `assembleProperties` helpers. Use lookup tables for device type classification
- [ ] T004 [US1] Refactor all functions in src/lib/components/dashboard/map/map-handlers.ts — `handleDeviceClick` (cyc=29), `handleTowerClick` (cyc=20), `syncLayerVisibility` (cyc=8, cog=13), `updateSymbolLayer` (cyc=9), `handleClusterClick` (cyc=8), `syncThemePaint` (cyc=7, cog=6), arrow@L226 (cyc=7), `maybeFetchCellTowers` (cyc=7). Extract per-handler helpers, use dispatch maps for layer operations
- [ ] T005 [P] [US2] Refactor src/lib/components/dashboard/map/map-setup.ts — arrow@L148 (cog=10). Extract setup configuration helpers
- [ ] T006 [P] [US2] Refactor src/lib/components/dashboard/map/map-helpers.ts — `fetchCellTowers` (cyc=6). Simplify with early returns
- [ ] T007 Verify dashboard map cluster: lint + build + vitest for map-related tests

**Checkpoint**: Dashboard map cluster — all functions ≤5 complexity

---

## Phase 3: Server Services Cluster (106 violations, 33 files) — Critical + Moderate

**Goal**: Refactor complex server-side service functions

**Independent Test**: `npx eslint src/lib/server/ --config config/eslint.config.js` reports zero complexity errors

### 3A: Hardware Details & Detection (29 violations, 5 files)

- [ ] T008 [US1] Refactor src/lib/server/services/hardware/hardware-details-service.ts — `getWifiDetails` (cyc=34, cog=51), `getGpsDetails` (cyc=19, cog=23), `getSdrDetails` (cyc=10, cog=12). Extract per-device detection helpers: `detectHackRF`, `detectAlfa`, `detectGPS`, `detectUSRP`, `detectKismet`. Split into -helpers.ts if >300 lines
- [ ] T009 [P] [US1] Refactor src/lib/server/hardware/detection/network-detector.ts — `detectNetworkUSRP` (cyc=16, cog=31), `detectKismetServer` (cyc=6), `detectHackRFServer` (cyc=6). Extract `probeUSRPDevice`, `parseUSRPResponse` helpers
- [ ] T010 [P] [US1] Refactor src/lib/server/hardware/detection/usb-sdr-detectors.ts — `detectUSRP` (cyc=15, cog=28), `detectHackRF` (cyc=7). Extract per-device-type detection helpers
- [ ] T011 [P] [US2] Refactor src/lib/server/hardware/detection/serial-detector.ts — `detectCellularModems` (cyc=15, cog=16), `detectGPSModules` (cyc=10, cog=8), `detectGenericSerialDevices` (cyc=9, cog=9). Extract per-device helpers
- [ ] T012 [P] [US2] Refactor src/lib/server/hardware/detection/usb-detector.ts — `detectWiFiAdapters` (cyc=9, cog=10). Simplify with early returns

### 3B: Hardware Resource Management (8 violations, 4 files)

- [ ] T013 [P] [US2] Refactor src/lib/server/hardware/resource-manager.ts — `refreshDetection` (cyc=13, cog=16). Extract detection step helpers
- [ ] T014 [P] [US2] Refactor src/lib/server/hardware/resource-scan.ts — `scanForOrphans` (cyc=8, cog=12). Extract process classification helpers
- [ ] T015 [P] [US2] Refactor src/lib/server/hardware/hardware-registry.ts — `query` (cyc=7), arrow@L103 (cyc=6). Simplify conditionals
- [ ] T016 [P] [US2] Refactor src/lib/server/hardware/process-utils.ts — `findBlockingProcesses` (cyc=6, cog=7). Simplify with early returns

### 3C: Kismet Services (42 violations, 9 files)

- [ ] T017 [US1] Refactor src/lib/server/kismet/service-manager.ts — `stop` (cyc=14, cog=32), arrow@L64 (cog=6). Extract `checkServiceStatus`, `startService`, `stopService` helpers
- [ ] T018 [P] [US1] Refactor src/lib/server/kismet/kismet-proxy-transform.ts — `transformDevice` (cyc=25, cog=16), `parseEncryptionNumber` (cyc=18, cog=22), `extractLocationFromRaw` (cyc=9), `mapDeviceType` (cyc=7, cog=6). Use lookup tables for field mapping and device types
- [ ] T019 [P] [US2] Refactor src/lib/server/kismet/alfa-detector.ts — `detectAlfaAdapters` (cyc=10, cog=16), arrow@L97 (cog=8), `findInterfaceForAdapter` (cyc=6). Extract detection step helpers
- [ ] T020 [P] [US2] Refactor src/lib/server/kismet/kismet-device-transform.ts — `transformRawDevice` (cyc=14), `getEncryptionTypes` (cyc=7, cog=6). Extract field mapping helpers
- [ ] T021 [P] [US2] Refactor src/lib/server/kismet/kismet-proxy.ts — arrow@L122 (cyc=11, cog=9), `request` (cyc=8, cog=6), `getDevices` (cyc=8), arrow@L177 (cyc=6), `proxy` (cyc=6). Extract request handling helpers
- [ ] T022 [P] [US2] Refactor src/lib/server/kismet/kismet-poller.ts — `fetchAndEmitSystemStatus` (cyc=10), `pollKismetDevices` (cyc=8, cog=6), `processDeviceUpdate` (cyc=6). Extract polling step helpers
- [ ] T023 [P] [US2] Refactor src/lib/server/kismet/web-socket-manager.ts — `handleClientMessage` (cyc=10, cog=8), `addClient` (cyc=7), arrow@L201 (cyc=7, cog=7). Extract per-message-type dispatch map
- [ ] T024 [P] [US2] Refactor src/lib/server/services/kismet.service.ts — `transformRawKismetDevices` (cyc=25, cog=11), `transformKismetDevices` (cyc=18), `getDevices` (cyc=10, cog=8), `getGPSPosition` (cyc=8, cog=7), `resolveLocation` (cyc=7). Extract transform and parsing helpers
- [ ] T025 [P] [US2] Refactor src/lib/server/services/kismet/ (2 files) — `startKismetExtended` (cyc=23, cog=22), `stopKismetExtended` (cyc=8, cog=9), `getKismetStatus` (cyc=6) in kismet-control-service-extended.ts; `waitForKismetReady` (cyc=6, cog=8), `startKismet` (cyc=6, cog=7) in kismet-control-service.ts. Extract command builders

### 3D: Agent Runtime (7 violations, 3 files)

- [ ] T026 [US1] Refactor src/lib/server/agent/runtime.ts — `processWithAnthropic` (cyc=23, cog=38), `run` (cyc=8). Extract `buildMessagePayload`, `handleStreamChunk`, `processToolCall` helpers
- [ ] T027 [P] [US1] Refactor src/lib/server/agent/tools.ts — `getSystemPrompt` (cyc=23, cog=10). Use template composition with lookup table
- [ ] T028 [P] [US2] Refactor src/lib/server/agent/frontend-tools.ts — `validateFrontendToolCall` (cyc=8, cog=11). Extract validation helpers

### 3E: GSM Evil Services (30 violations, 8 files)

- [ ] T029 [P] [US1] Refactor src/lib/server/services/gsm-evil/protocol-parser.ts — `classifySignalStrength` (cyc=14, cog=24), `parseCellIdentity` (cyc=14, cog=20), `analyzeGsmFrames` (cyc=11, cog=14), `determineChannelType` (cyc=7). Use lookup tables for classification
- [ ] T030 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-scan-frequency-analysis.ts — `testFrequency` (cyc=19, cog=19). Extract band classification helper
- [ ] T031 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-scan-prerequisites.ts — `acquireHackrf` (cyc=9, cog=16), `checkPrerequisites` (cyc=6). Extract prerequisite step helpers
- [ ] T032 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts — `performIntelligentScan` (cyc=11, cog=14), `emitSummary` (cyc=10, cog=8). Extract scan orchestration helpers
- [ ] T033 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-scan-capture.ts — `appendCellIdentityEvents` (cyc=11, cog=9), arrow@L241 (cog=9), `appendChannelEvents` (cyc=7), `cleanupProcess` (cyc=6). Extract event processing helpers
- [ ] T034 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-scan-helpers.ts — arrow@L181 (cog=10), `checkHardwareErrors` (cyc=8), `classifySignalStrength` (cyc=7, cog=6). Simplify with early returns and lookup tables
- [ ] T035 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-evil-health-service.ts — `aggregateOverallHealth` (cyc=9, cog=6), `collectIssuesAndRecommendations` (cyc=6). Extract health aggregation helpers
- [ ] T036 [P] [US2] Refactor src/lib/server/services/gsm-evil/gsm-monitor-service.ts — `processFrame` (cyc=8). Simplify with early returns

### 3F: Cell Tower, GPS, TAK Services (31 violations, 11 files)

- [ ] T037 [P] [US2] Refactor src/lib/server/services/cell-towers/cell-tower-service.ts — `queryOpenCellID` (cyc=19, cog=16), arrow@L91 (cyc=6). Extract API response parsing helper
- [ ] T038 [P] [US2] Refactor src/lib/server/services/gps/gps-data-parser.ts — `parseTPVData` (cyc=14, cog=11), arrow@L149 (cog=11), `parseSkyMessage` (cyc=8), `parseGpsdLines` (cyc=7). Extract field parsing helpers
- [ ] T039 [P] [US2] Refactor src/lib/server/services/gps/gps-satellite-service.ts — arrow@L107 (cog=10), `parseGpsdSkyLines` (cyc=7), `mapConstellation` (cyc=6), `parseSatellites` (cyc=6). Use lookup table for constellations
- [ ] T040 [P] [US2] Refactor src/lib/server/services/gps/gps-response-builder.ts — `buildFixedPositionResponse` (cyc=9). Extract field assembly helpers
- [ ] T041 [P] [US2] Refactor src/lib/server/services/gps/gps-position-service.ts — `getGpsPosition` (cyc=7, cog=6), `checkPositionCircuitBreaker` (cyc=6), `handlePositionQueryFailure` (cyc=6, cog=6). Simplify with early returns
- [ ] T042 [P] [US2] Refactor src/lib/server/services/gps/gps-satellite-circuit-breaker.ts — `checkSatelliteCircuitBreaker` (cyc=6). Simplify with early returns
- [ ] T043 [P] [US2] Refactor src/lib/server/tak/tak-service.ts — `connect` (cyc=11, cog=12), `sendCot` (cyc=9, cog=8), `getStatus` (cyc=6). Extract connection and messaging helpers
- [ ] T044 [P] [US2] Refactor src/lib/server/tak/tak-db.ts — `rowToConfig` (cyc=11), `configToParams` (cyc=9). Use lookup table for field mapping
- [ ] T045 [P] [US2] Refactor src/lib/server/tak/tak-package-parser.ts — `parsePreferencePref` (cyc=11, cog=8), `parseConnectString` (cyc=6). Extract parsing step helpers
- [ ] T046 [P] [US2] Refactor src/lib/server/tak/cert-manager.ts — `saveAndExtract` (cyc=8, cog=7). Simplify with early returns
- [ ] T047 [P] [US2] Refactor src/lib/server/hackrf/sweep-cycle-init.ts — `startCycle` (cyc=13, cog=14), `runNextFrequency` (cyc=7). Extract cycle step helpers

### 3G: Database Layer (24 violations, 8 files)

- [ ] T048 [P] [US2] Refactor src/lib/server/db/db-optimizer.ts — `estimateQueryCost` (cyc=8, cog=18), `applyOptimizations` (cyc=8, cog=7). Extract estimation and optimization step helpers
- [ ] T049 [P] [US2] Refactor src/lib/server/db/geo.ts — `detectDeviceType` (cyc=11, cog=10), `generateDeviceId` (cyc=6, cog=7). Use lookup table for device types
- [ ] T050 [P] [US2] Refactor src/lib/server/db/signal-repository.ts — `insertSignal` (cyc=10, cog=9), arrow@L105 (cyc=9, cog=7), `insertSignalsBatch` (cyc=6, cog=6), arrow@L84 (cog=6), `findSignalsInRadius` (cyc=6). Extract signal processing helpers
- [ ] T051 [P] [US2] Refactor src/lib/server/db/device-service.ts — `updateDeviceFromSignal` (cyc=6, cog=10). Simplify with early returns
- [ ] T052 [P] [US3] Refactor remaining db files — cleanup-aggregation.ts (cyc=6, cog=8), cleanup-service.ts (cyc=7, cog=6), db-health-report.ts (cyc=7, cog=6), network-repository.ts (cog=6). Minor simplifications with early returns

### 3H: Other Server Files (15 violations, 8 files)

- [ ] T053 [P] [US2] Refactor src/lib/server/middleware/ws-connection-handler.ts — `handleWsConnection` (cyc=15, cog=6). Extract connection step helpers
- [ ] T054 [P] [US2] Refactor src/lib/server/middleware/rate-limit-middleware.ts — `checkRateLimit` (cyc=10, cog=9), arrow@L42 (cog=6). Extract rate limit evaluation helpers
- [ ] T055 [P] [US2] Refactor src/lib/server/hackrf/sweep-coordinator.ts — arrow@L242 (cog=7), arrow@L242 (cyc=6). Simplify with early returns
- [ ] T056 [P] [US2] Refactor src/lib/server/gsm/l3-decoder.ts — `decodeMM` (cyc=9), `decodeRR` (cyc=8), arrow@L170 (cog=6). Use lookup table for message type dispatch
- [ ] T057 [P] [US2] Refactor src/lib/server/gsm/l3-message-decoders.ts — arrow@L61 (cog=9). Simplify with early returns
- [ ] T058 [P] [US2] Refactor src/lib/server/db/migrations/run-migrations.ts — `isDuplicateColumnError` (cyc=7), arrow@L119 (cog=6). Simplify with early returns
- [ ] T059 [P] [US2] Refactor src/lib/server/websocket-server.ts — `authenticateUpgrade` (cyc=8). Extract auth step helpers
- [ ] T060 [P] [US2] Refactor src/lib/server/websocket-handlers.ts — `handleHackRFMessage` (cyc=7), `handleStartSweep` (cyc=7). Extract per-message helpers
- [ ] T061 [P] [US2] Refactor src/lib/server/security/auth-audit.ts — `logAuthEvent` (cyc=9). Simplify with early returns
- [ ] T062 Verify server services cluster: lint + build

**Checkpoint**: Server services — all functions ≤5 complexity

---

## Phase 4: MCP Servers (63 violations, 13 files) — Critical + Moderate

**Goal**: Refactor MCP diagnostic server tool handlers

**Independent Test**: `npx eslint src/lib/server/mcp/ --config config/eslint.config.js` reports zero complexity errors

- [ ] T063 [US1] Refactor src/lib/server/mcp/servers/system-inspector.ts — `execute`@L38 (cyc=30, cog=23), `execute`@L138 (cyc=9, cog=6), `execute`@L185 (cyc=9), `execute`@L232 (cyc=6). Extract per-subsystem info collectors into lookup dispatch
- [ ] T064 [P] [US1] Refactor src/lib/server/mcp/servers/hardware-debugger.ts — `execute`@L148 (cyc=17, cog=27), `execute`@L227 (cyc=12, cog=8), `execute`@L41 (cyc=8, cog=8). Extract per-hardware debug helpers
- [ ] T065 [P] [US1] Refactor src/lib/server/mcp/dynamic-server-tools.ts — `execute`@L93 (cyc=25), arrow@L62 (cyc=21), arrow@L195 (cyc=16), `execute`@L273 (cyc=10), `execute`@L38 (cyc=6), arrow@L101 (cyc=6), arrow@L182 (cyc=6). Extract `createToolDefinition`, `buildToolHandler` helpers. Split into -helpers.ts
- [ ] T066 [P] [US2] Refactor src/lib/server/mcp/servers/system-inspector-tools.ts — `verifyDevEnvironment` (cyc=15, cog=14), `generateMemoryRecommendations` (cyc=8, cog=6), arrow@L49 (cog=8). Extract per-check helpers
- [ ] T067 [P] [US2] Refactor src/lib/server/mcp/servers/test-runner.ts — `execute`@L171 (cyc=15, cog=13), `execute`@L39 (cyc=13, cog=8), `execute`@L124 (cyc=7). Extract test execution helpers
- [ ] T068 [P] [US2] Refactor src/lib/server/mcp/servers/api-debugger.ts — `execute`@L236 (cyc=14, cog=13), `execute`@L37 (cyc=9, cog=8). Extract per-endpoint debug helpers
- [ ] T069 [P] [US2] Refactor src/lib/server/mcp/servers/hardware-debugger-tools.ts — `detectConflicts` (cyc=14, cog=11), `checkHardwareScan` (cyc=11, cog=10), `diagnoseHackrf` (cyc=7), `diagnoseKismet` (cyc=7), `diagnoseGps` (cyc=7), `buildRecoverySteps` (cyc=7). Extract per-device diagnostic helpers
- [ ] T070 [P] [US2] Refactor src/lib/server/mcp/servers/database-inspector-tools.ts — `queryRecentActivity` (cyc=13, cog=7), `debugSpatialIndex` (cyc=12, cog=11). Extract query composition helpers
- [ ] T071 [P] [US2] Refactor src/lib/server/mcp/servers/streaming-inspector-tools.ts — `generateStreamRecommendations` (cyc=8, cog=7), arrow@L48 (cyc=6). Extract analysis helpers
- [ ] T072 [P] [US2] Refactor src/lib/server/mcp/servers/database-inspector.ts — `execute`@L33 (cyc=7, cog=6), `execute`@L103 (cyc=6). Simplify with early returns
- [ ] T073 [P] [US2] Refactor src/lib/server/mcp/dynamic-server-tools-system.ts — `execute`@L35 (cyc=7), arrow@L131 (cyc=7), `execute`@L180 (cyc=7). Extract system command helpers
- [ ] T074 [P] [US2] Refactor src/lib/server/mcp/dynamic-server.ts — arrow@L90 (cyc=7, cog=6), arrow@L156 (cog=7), arrow@L156 (cyc=6). Simplify with early returns
- [ ] T075 [P] [US2] Refactor src/lib/server/mcp/config-generator.ts — `generateArgosMCPServer` (cyc=7), `generateMCPServer` (cyc=6). Simplify with early returns
- [ ] T076 Verify MCP servers: lint + build

**Checkpoint**: MCP servers — all functions ≤5 complexity

---

## Phase 5: API Route Handlers (79 violations, 37 files) — Moderate

**Goal**: Refactor API endpoint handlers using early returns and lookup tables

**Independent Test**: `npx eslint src/routes/api/ --config config/eslint.config.js` reports zero complexity errors

### 5A: High-complexity routes (22+ violations in routes with cyc/cog > 15)

- [ ] T077 [P] [US1] Refactor src/routes/api/system/info/+server.ts — GET (cyc=22, cog=33). Extract `collectSystemInfo`, `collectServiceStatus` helpers
- [ ] T078 [P] [US1] Refactor src/routes/api/gsm-evil/status/+server.ts — GET (cyc=18, cog=27). Extract `buildStatusResponse` helper
- [ ] T079 [P] [US1] Refactor src/routes/api/gps/location/+server.ts — GET (cyc=26, cog=9). Extract `parseGpsData`, `formatGpsResponse` helpers
- [ ] T080 [P] [US2] Refactor src/routes/api/tak/import-package/+server.ts — POST (cyc=20, cog=24). Extract `validatePackage`, `processPackageContents` helpers
- [ ] T081 [P] [US2] Refactor src/routes/api/gsm-evil/intelligent-scan/+server.ts — POST (cyc=17, cog=23). Extract scan orchestration helpers
- [ ] T082 [P] [US2] Refactor src/routes/api/gsm-evil/tower-location/+server.ts — POST (cyc=17, cog=22). Extract `lookupTowerLocation`, `formatTowerResponse` helpers
- [ ] T083 [P] [US2] Refactor src/routes/api/gsm-evil/frames/+server.ts — POST@L53 (cyc=22, cog=14), GET@L12 (cyc=7, cog=6). Simplify frame processing logic
- [ ] T084 [P] [US2] Refactor src/routes/api/gsm-evil/activity/+server.ts — GET (cyc=17, cog=17). Extract activity aggregation helper
- [ ] T085 [P] [US2] Refactor src/routes/api/kismet/devices/+server.ts — arrow@L57 (cyc=17), `getReceiverGPS` (cyc=8, cog=7), arrow@L94 (cyc=6). Extract device filtering helpers
- [ ] T086 [P] [US2] Refactor src/routes/api/system/memory-pressure/+server.ts — GET (cyc=16, cog=19). Extract memory parsing helpers
- [ ] T087 [P] [US2] Refactor src/routes/api/tak/enroll/+server.ts — POST (cyc=16, cog=16). Extract enrollment validation helper
- [ ] T088 [P] [US2] Refactor src/routes/api/db/cleanup/+server.ts — POST@L54 (cyc=18, cog=6), GET@L178 (cyc=9, cog=7). Extract cleanup orchestration helper
- [ ] T089 [P] [US2] Refactor src/routes/api/signals/batch/+server.ts — POST@L42 (cyc=16), GET@L23 (cyc=6, cog=6). Extract batch validation helper
- [ ] T090 [P] [US2] Refactor src/routes/api/kismet/control/+server.ts — POST (cyc=13, cog=18). Extract control action helpers

### 5B: Moderate-complexity routes (cyc/cog 8-15)

- [ ] T091 [P] [US2] Refactor src/routes/api/database/query/+server.ts — GET (cyc=13, cog=17). Extract query building helpers
- [ ] T092 [P] [US2] Refactor src/routes/api/database/health/+server.ts — GET (cyc=14, cog=16). Extract health check helpers
- [ ] T093 [P] [US2] Refactor src/routes/api/gsm-evil/control/+server.ts — POST (cyc=12, cog=15). Extract control flow helpers
- [ ] T094 [P] [US2] Refactor src/routes/api/signals/statistics/+server.ts — GET (cyc=14). Simplify with early returns
- [ ] T095 [P] [US2] Refactor src/routes/api/system/logs/+server.ts — GET (cyc=13, cog=13). Extract log filtering helpers
- [ ] T096 [P] [US2] Refactor src/routes/api/kismet/status/+server.ts — GET (cyc=14, cog=7). Extract status building helpers
- [ ] T097 [P] [US2] Refactor src/routes/api/gsm-evil/intelligent-scan-stream/+server.ts — POST (cyc=10, cog=14). Extract stream setup helpers
- [ ] T098 [P] [US2] Refactor src/routes/api/openwebrx/control/+server.ts — POST (cyc=11, cog=12). Extract Docker command helpers
- [ ] T099 [P] [US2] Refactor src/routes/api/rf/start-sweep/+server.ts — POST@L11 (cyc=9, cog=12), POST@L28 (cyc=8, cog=10). Extract sweep setup helpers
- [ ] T100 [P] [US2] Refactor src/routes/api/tak/truststore/+server.ts — POST (cyc=12, cog=10). Extract truststore validation helpers
- [ ] T101 [P] [US2] Refactor src/routes/api/gsm-evil/imsi-data/+server.ts — GET@L38 (cyc=10, cog=11), GET@L69 (cyc=8). Extract IMSI data processing helpers
- [ ] T102 [P] [US2] Refactor src/routes/api/hackrf/start-sweep/+server.ts — POST@L41 (cyc=8, cog=11), POST@L71 (cyc=6, cog=6). Extract sweep start helpers
- [ ] T103 [P] [US2] Refactor src/routes/api/system/services/+server.ts — GET (cyc=10, cog=9). Simplify with early returns
- [ ] T104 [P] [US2] Refactor src/routes/api/system/docker/[action]/+server.ts — POST (cyc=9, cog=9). Simplify with lookup table
- [ ] T105 [P] [US2] Refactor src/routes/api/hackrf/data-stream/+server.ts — `cancel`@L206 (cyc=9, cog=8), arrow@L136 (cyc=8), arrow@L66 (cyc=6, cog=6). Extract stream lifecycle helpers
- [ ] T106 [P] [US2] Refactor src/routes/api/map-tiles/[...path]/+server.ts — GET (cyc=9, cog=7). Simplify with early returns
- [ ] T107 [P] [US2] Refactor src/routes/api/tak/certs/+server.ts — GET (cyc=9, cog=9). Simplify with early returns
- [ ] T108 [P] [US2] Refactor src/routes/api/agent/stream/+server.ts — POST (cyc=8, cog=8). Simplify with early returns
- [ ] T109 [P] [US2] Refactor src/routes/api/kismet/stop/+server.ts — POST (cyc=9, cog=10). Simplify with early returns
- [ ] T110 [P] [US2] Refactor src/routes/api/system/metrics/+server.ts — `getNetworkStats` (cyc=8). Simplify with early returns
- [ ] T111 [P] [US2] Refactor src/routes/api/hardware/scan/+server.ts — POST (cyc=6, cog=8). Simplify with early returns

### 5C: Low-complexity routes (cyc/cog = 6-7)

- [ ] T112 [P] [US3] Refactor remaining API route files with single violations (cyc/cog=6-9) — gsm-evil/live-frames (cyc=8), system/docker (cyc=8), rf/data-stream (cyc=9), rf/status (cyc=6, cog=7), rf/stop-sweep (cyc=7, cog=6), signals (cyc=9), rf/emergency-stop (cog=6), database/schema (cog=6), gsm-evil/imsi (cyc=6), terminal/shells (cyc=6), weather/current (cyc=6). Simplify with early returns
- [ ] T113 Verify API route handlers: lint + build

**Checkpoint**: API routes — all handlers ≤5 complexity

---

## Phase 6: UI Components and Stores (105 violations, 27 files) — Mixed

**Goal**: Refactor dashboard components, stores, and page logic

**Independent Test**: `npx eslint src/lib/components/ src/lib/stores/ src/routes/dashboard/ src/routes/gsm-evil/ src/lib/kismet/ --config config/eslint.config.js` reports zero complexity errors

### 6A: Dashboard Components (41 violations, 12 files)

- [ ] T114 [US1] Refactor src/hooks.server.ts — `handle` (cyc=25, cog=27). Extract `applyRateLimiting`, `applySecurityHeaders`, `authenticateRequest` helpers
- [ ] T115 [P] [US1] Refactor src/lib/components/dashboard/panels/overview/HardwareCard.svelte — arrow@L31 (cyc=25, cog=10), arrow@L14 (cyc=18, cog=8). Extract status rendering helpers into lookup tables
- [ ] T116 [P] [US2] Refactor src/lib/components/dashboard/panels/ToolsNavigationView.svelte — `handleStart` (cyc=13, cog=24), `handleStop` (cyc=10, cog=16). Extract tool categorization helper
- [ ] T117 [P] [US2] Refactor src/lib/components/dashboard/panels/DevicesPanel.svelte — `handleRowClick` (cyc=13, cog=17), arrow@L32 (cog=6). Extract click handling helpers
- [ ] T118 [P] [US2] Refactor src/lib/components/dashboard/panels/GsmEvilPanel.svelte — arrow@L85 (cyc=7). Simplify with early returns
- [ ] T119 [P] [US2] Refactor src/lib/components/dashboard/agent-chat-logic.svelte.ts — `sendMessageWithContent` (cyc=14, cog=23), `handleInteractionEvent` (cyc=6). Extract message handling helpers
- [ ] T120 [P] [US2] Refactor src/lib/components/dashboard/TerminalTabContent.svelte — arrow@L68 (cyc=17, cog=21), arrow@L131 (cyc=6). Extract terminal lifecycle helpers
- [ ] T121 [P] [US2] Refactor src/lib/components/dashboard/status/weather-helpers.ts — `getWeatherCondition` (cyc=23, cog=22), `getWeatherIcon` (cyc=15, cog=13), `getFlightConditions` (cyc=6). Replace if-else chains with lookup tables
- [ ] T122 [P] [US2] Refactor src/lib/components/dashboard/status/status-bar-data.ts — `fetchHardwareStatus` (cyc=13, cog=8), `reverseGeocode` (cyc=7, cog=6), `fetchWeather` (cyc=6, cog=6). Extract status building helpers
- [ ] T123 [P] [US2] Refactor src/lib/components/dashboard/TopStatusBar.svelte — arrow@L60 (cyc=6, cog=8), arrow@L128 (cyc=7). Simplify with early returns
- [ ] T124 [P] [US2] Refactor src/lib/components/dashboard/dashboard-map-logic.svelte.ts — arrow@L99 (cyc=7), arrow@L191 (cyc=6). Simplify with early returns
- [ ] T125 [P] [US2] Refactor src/lib/components/dashboard/panels/devices/device-filters.ts — arrow@L61 (cyc=22, cog=11), arrow@L48 (cyc=14, cog=7), `filterAndSortDevices` (cyc=7, cog=12). Extract filter predicate builders
- [ ] T126 [P] [US2] Refactor src/lib/components/dashboard/panels/devices/device-formatters.ts — `formatLastSeen` (cyc=12, cog=7), `formatFirstSeen` (cyc=9, cog=6), `formatEncryption` (cyc=6). Extract formatting helpers

### 6B: TAK Components (7 violations, 5 files)

- [ ] T127 [P] [US2] Refactor src/lib/components/dashboard/tak/tak-config-logic.ts — `applyCertPaths` (cyc=8), `saveConfig` (cyc=6), `applyPackageImport` (cyc=6). Simplify with early returns
- [ ] T128 [P] [US2] Refactor TAK Svelte components — TakAuthEnroll.svelte (cyc=8), TakAuthImport.svelte (cyc=8), TakDataPackage.svelte (cyc=8), TakTruststore.svelte (cyc=7). Extract upload/enrollment step helpers

### 6C: GSM Evil Components (4 violations, 2 files)

- [ ] T129 [P] [US2] Refactor src/lib/components/gsm-evil/ScanResultsTable.svelte — `getQualityClass` (cyc=7). Use lookup table
- [ ] T130 [P] [US2] Refactor src/lib/components/gsm-evil/TowerTable.svelte — `formatTimestamp` (cyc=7, cog=7), arrow@L70 (cog=6). Simplify with early returns

### 6D: GSM Evil Page (12 violations, 2 files)

- [ ] T131 [P] [US2] Refactor src/routes/gsm-evil/gsm-evil-page-logic.ts — `processScanStream` (cyc=13, cog=28), arrow@L83 (cyc=9, cog=13), `handleScanResult` (cyc=9, cog=8). Extract scan workflow helpers
- [ ] T132 [P] [US2] Refactor src/routes/gsm-evil/+page.svelte — `scanFrequencies` (cyc=11, cog=13), `handleScanButton` (cyc=10, cog=10), arrow@L91 (cyc=9), arrow@L176 (cyc=6). Extract scan UI helpers

### 6E: Stores (15 violations, 7 files)

- [ ] T133 [US1] Refactor src/lib/stores/dashboard/agent-context-store.ts — arrow@L72 (cyc=35). Extract context-building helpers and use lookup table for context sections
- [ ] T134 [P] [US2] Refactor src/lib/stores/dashboard/terminal-store.ts — arrow@L183 (cyc=8, cog=9), `createNewSession` (cyc=7), `deserialize` (cyc=6). Extract terminal management helpers
- [ ] T135 [P] [US3] Refactor remaining store files — gsm-evil-store.ts (`persistState` cyc=6, cog=7), persisted-writable.ts (`persistedWritable` cyc=7, `load` cyc=6 cog=6), connection.ts (cyc=6), tak-store.ts (cog=6), theme-store.svelte.ts (cyc=6). Minor simplifications
- [ ] T136 [P] [US2] Refactor src/lib/stores/tactical-map/kismet-store.ts — arrow@L130 (cyc=11), arrow@L175 (cyc=8). Extract data processing helpers

### 6F: Kismet & WebSocket Handlers (11 violations, 1 file)

- [ ] T137 [US2] Refactor src/lib/kismet/websocket-handlers.ts — `handleAlert` (cyc=22, cog=13), `handleNewDevice` (cyc=9), `handleGpsUpdate` (cyc=9, cog=6), `handleStatusUpdate` (cyc=7), `handleDeviceUpdate` (cyc=7), `handleNetworkUpdate` (cyc=7), `handleDeviceRemoved` (cyc=6), `handleDevicesList` (cyc=6), `handleNetworksList` (cyc=6). Extract per-message-type handlers into dispatch map

### 6G: Dashboard Page (2 violations, 1 file)

- [ ] T138 [P] [US2] Refactor src/routes/dashboard/+page.svelte — `handleKeydown` (cyc=16, cog=13). Use lookup table for key dispatch

- [ ] T139 Verify UI components/stores: lint + build + vitest

**Checkpoint**: UI components/stores — all functions ≤5 complexity

---

## Phase 7: Utilities, HackRF, and Remaining (68 violations, 24 files) — Moderate

**Goal**: Refactor utilities, HackRF sweep manager, and all remaining functions

**Independent Test**: `npx eslint src/lib/utils/ src/lib/hackrf/ src/lib/map/ src/lib/tactical-map/ src/lib/websocket/ src/lib/data/ src/lib/schemas/ --config config/eslint.config.js` reports zero complexity errors

### 7A: Utilities (17 violations, 9 files)

- [ ] T140 [US1] Refactor src/lib/utils/gsm-tower-utils.ts — arrow@L79 (cyc=25, cog=15), arrow@L172 (cyc=16, cog=11). Replace conditional chains with lookup tables
- [ ] T141 [P] [US2] Refactor src/lib/utils/validation-error.ts — `formatZodIssue` (cyc=14, cog=16). Use lookup table for issue type formatting
- [ ] T142 [P] [US2] Refactor src/lib/utils/cot-parser.ts — `parseCotToFeature` (cyc=15, cog=6). Extract field parsing helpers
- [ ] T143 [P] [US2] Refactor src/lib/utils/logger.ts — `log` (cyc=14, cog=9). Extract log level dispatch helpers
- [ ] T144 [P] [US3] Refactor remaining utility files — css-loader.ts (cyc=7, cog=6), mgrs-converter.ts (cyc=7), country-detector.ts (cyc=6), signal-utils.ts (cyc=6+6), theme-colors.ts (cyc=6). Minor simplifications with early returns or lookup tables

### 7B: HackRF Sweep Manager (31 violations, 10 files)

- [ ] T145 [P] [US2] Refactor src/lib/hackrf/sweep-manager/sweep-health-checker.ts — `performHealthCheck` (cyc=17, cog=17), arrow@L189 (cyc=6, cog=7). Extract health evaluation helpers
- [ ] T146 [P] [US2] Refactor src/lib/hackrf/sweep-manager/buffer-parser.ts — `parseSpectrumData` (cyc=15, cog=16), `validateSpectrumData` (cyc=11, cog=11), `parseLine` (cyc=8, cog=9). Extract parsing step helpers
- [ ] T147 [P] [US2] Refactor src/lib/hackrf/sweep-manager/error-analysis.ts — `analyzeError` (cyc=13, cog=7), `deriveDeviceStatus` (cyc=6), arrow@L127 (cog=6). Use lookup table for error classification
- [ ] T148 [P] [US2] Refactor src/lib/hackrf/sweep-manager/sweep-utils.ts — `getSignalStrength` (cyc=10, cog=9). Use lookup table for signal classification
- [ ] T149 [P] [US2] Refactor src/lib/hackrf/sweep-manager/error-tracker.ts — `shouldAttemptRecovery` (cyc=9), `recordError` (cyc=7). Simplify with early returns
- [ ] T150 [P] [US2] Refactor src/lib/hackrf/sweep-manager/process-manager.ts — `getProcessState` (cyc=9), `attachEventHandlers` (cyc=6, cog=6), arrow@L196 (cyc=6, cog=8), arrow@L47 (cyc=6). Extract process lifecycle helpers
- [ ] T151 [P] [US2] Refactor src/lib/hackrf/sweep-manager/buffer-manager.ts — `getHealthStatus` (cyc=8, cog=7), arrow@L65 (cog=6). Simplify with early returns
- [ ] T152 [P] [US3] Refactor remaining HackRF files — process-lifecycle.ts (cyc=6, cog=8), frequency-cycler.ts (cyc=6), frequency-utils.ts (cyc=6). Minor simplifications

### 7C: Map, Tactical, WebSocket, Data (17 violations, 8 files)

- [ ] T153 [P] [US2] Refactor src/lib/tactical-map/gps-service.ts — `updateGPSPosition` (cyc=14, cog=10). Extract GPS update step helpers
- [ ] T154 [P] [US2] Refactor src/lib/tactical-map/kismet-service.ts — `checkKismetStatus` (cyc=8, cog=9), `stopKismet` (cyc=7), `fetchKismetDevices` (cyc=7). Extract Kismet operation helpers
- [ ] T155 [P] [US2] Refactor src/lib/websocket/base.ts — `connect` (cyc=8, cog=7), arrow@L41 (cyc=6), arrow@L107 (cog=6). Extract connection lifecycle helpers
- [ ] T156 [P] [US2] Refactor src/lib/data/tool-hierarchy.ts — arrow@L132 (cog=8), arrow@L157 (cog=7). Simplify with early returns
- [ ] T157 [P] [US2] Refactor src/lib/schemas/api.ts — arrow@L100 (cyc=9). Simplify with early returns
- [ ] T158 [P] [US2] Refactor src/lib/map/symbols/symbol-factory.ts — `createSymbolSVG` (cyc=7), `createSymbolDataUrl` (cyc=7). Simplify with early returns
- [ ] T159 [P] [US3] Refactor remaining map/tactical files — satellite-layer.ts (cyc=6), visibility-engine.ts (cyc=6), signal-aggregator.ts (cyc=7). Minor simplifications
- [ ] T160 [P] [US3] Refactor src/lib/server/db/migrations/20260218_extend_tak_configs.ts — arrow@L4 (cog=7). Simplify migration logic

### 7D: Test File (2 violations, 1 file)

- [ ] T161 [P] [US2] Refactor src/lib/components/components.test.ts — arrow@L199 (cyc=7, cog=12). Simplify test helper logic

- [ ] T162 Verify utilities/HackRF/remaining: lint + build

**Checkpoint**: All remaining functions ≤5 complexity

---

## Phase 8: Final Verification

**Purpose**: Full codebase verification — zero complexity violations at threshold 5

- [ ] T163 Run `npx eslint src/ --config config/eslint.config.js 2>&1 | grep -c "complexity"` — must output 0
- [ ] T164 Run `npm run build` — must pass clean
- [ ] T165 Run `npx vitest run --no-coverage` — all tests pass
- [ ] T166 Run `git diff --stat main...HEAD` to document total scope of changes
- [ ] T167 Verify no file exceeds 300 lines: `find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | sort -rn | awk '$1 > 300'` — must output 0 files (SC-005)
- [ ] T168 Verify function proliferation within budget: count total exported/declared functions before and after refactoring — growth must not exceed 150% of refactored function count (SC-006)
- [ ] T169 Verify all extracted helper functions have descriptive verb-noun names per research.md Decision 3 (FR-004)
- [ ] T170 Spot-check that no new `-helpers.ts` file duplicates logic already present elsewhere in the codebase (FR-006)

**Checkpoint**: SC-001 through SC-006 verified — zero complexity violations at threshold 5, all tests pass, no oversized files, function growth within budget

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Phases 2-7**: All depend on Phase 1. Can proceed in any order (grouped by proximity, not dependency)
- **Phase 8**: Depends on ALL Phases 2-7 completing

### User Story Dependencies

- **US1 (Critical, 25+)**: Functions in Phases 2, 3, 4, 5, 6, 7 — no inter-story dependencies
- **US2 (Moderate, 6-24)**: Functions in all phases — no inter-story dependencies
- **US3 (Borderline, 6-9)**: Functions in Phases 3, 5, 6, 7 — no inter-story dependencies

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel since they target different files:
- Phase 3: Sub-phases 3A-3H target different server directories
- Phase 4: All MCP server files are independent
- Phase 5: All API route files are independent
- Phase 6: Sub-phases 6A-6G target different component/store directories
- Phase 7: Sub-phases 7A-7D target different utility/library directories

---

## Implementation Strategy

### MVP First (Phase 2 Only)

1. Complete Phase 1: Setup baseline
2. Complete Phase 2: Dashboard map cluster (highest complexity, most visible)
3. **STOP and VALIDATE**: Confirm map functions pass lint at error level 5
4. This alone removes the worst offenders (complexity 35, 29)

### Incremental Delivery

1. Phase 2: Dashboard map (17 violations) → Verify
2. Phase 3: Server services (106 violations) → Verify
3. Phase 4: MCP servers (63 violations) → Verify
4. Phase 5: API routes (79 violations) → Verify
5. Phase 6: UI components + stores (105 violations) → Verify
6. Phase 7: Utilities + HackRF + remaining (68 violations) → Verify
7. Phase 8: Final full-codebase verification

---

## Notes

- Pure structural refactoring — NO behavioral changes
- If a refactored function's tests break, the refactoring has a bug — do not modify the test
- Every commit must pass pre-commit hooks — structure refactoring so each file is fully compliant before committing
- Files exceeding 300 lines after helper extraction must be split per research.md Decision 4
- The 536-violation count is at threshold 5; Phase 1 establishes the actual baseline
- At threshold 5, even functions with 3+ if-else branches need lookup tables or helper extraction
- Expect significant helper file creation (-helpers.ts) — this is intentional per the aggressive target
