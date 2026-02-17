# Tasks: MIL-STD-2525 & TAK Integration

**Feature**: `005-milsymbol-tak-integration`
**Status**: Complete (100% — 21/21 tasks done, 3 security fixes applied)
**Based on**: Plan, Spec, Data Model
**Last Audit**: 2026-02-17

## Dependencies & Resources

- **MIL-STD-2525 Library**: [missioncommand/mil-sym-ts](https://github.com/missioncommand/mil-sym-ts) (installed as `@armyc2.c5isr.renderer/mil-sym-ts-web`, brings `milsymbol` transitive dep)
- **TAK Library**: [dfpc-coe/node-tak](https://github.com/dfpc-coe/node-tak) (as `@tak-ps/node-tak`, installed but TakClient hand-rolled)

## Phase 1: Setup
- [x] T001 Install dependencies: `@armyc2.c5isr.renderer/mil-sym-ts-web`, `@xmldom/xmldom` (note: used milsymbol instead of @missioncommand/mil-sym-ts)
- [x] T002 Create directory structure: `src/lib/server/tak`, `src/lib/map/layers`, `src/lib/map/symbols`, `src/lib/types`, `data/certs`

## Phase 2: Foundational
- [x] T003 Create TakServerConfig migration in `src/lib/server/db/migrations/20260217_create_tak_configs.ts`
- [x] T004 Implement CertManager for secure file handling in `src/lib/server/tak/CertManager.ts` (SECURITY FIX: switched exec→execFile)
- [x] T005 [P] Define TakServerConfig, TakContact, CotMessage interfaces in `src/lib/types/tak.ts`

## Phase 3: Google Hybrid Map (US1)
- [x] T006 [P] [US1] Create SatelliteLayer class for raster tiles in `src/lib/map/layers/SatelliteLayer.ts`
- [x] T007 [P] [US1] Update MapSettings component to include layer switching in `src/lib/components/dashboard/MapSettings.svelte`
- [x] T007b [US1] Implement Map Source XML parser (TAK format) in `src/lib/map/MapSourceParser.ts`
- [x] T008 [US1] Integrate SatelliteLayer into `DashboardMap.svelte` and sync with map-settings-store

## Phase 4: MIL-STD-2525 Symbols (US2)
- [x] T009 [P] [US2] Create SymbolFactory wrapper using milsymbol in `src/lib/map/symbols/SymbolFactory.ts`
- [x] T010 [US2] Create SymbolLayer to render symbols on map in `src/lib/map/layers/SymbolLayer.ts`
- [x] T010b [US2] LeafletSymbolProvider — SKIPPED (project is MapLibre-only)
- [x] T011 [US2] Proper SIDC mapping per device type in SymbolFactory.getSidcForDevice()
  - WiFi/AP → Ground SIGINT Sensor (EVSR), Client → SIGINT Intercept (EVSC)
  - Bluetooth/BLE → Direction Finding (EVSDF), Cell Tower → Infrastructure Comms (IPC)
  - Drone/UAV → Air Track (MFQ), Self/Argos → Cyber/EW Team (UCFEW)
  - Also added cotTypeToSidc() for proper CoT atom→SIDC conversion in cot-parser.ts
- [x] T011b [US2] Implement Tri-Mode Visibility (Dynamic Filter/Auto-Squelch) in `src/lib/map/VisibilityEngine.ts`
  - Three modes: Dynamic (auto-squelch noise), Show All, Manual Only
  - Promoted devices visible in all modes, persisted to localStorage
  - Integrated into DashboardMap.svelte and MapSettings.svelte UI

## Phase 5: TAK Server Connectivity (US3 & US4)
- [x] T012 [P] [US3] Implement TakClient in `src/lib/server/tak/TakClient.ts` (SECURITY FIX: rejectUnauthorized=true)
- [x] T013 [US3] Implement TakService in `src/lib/server/tak/TakService.ts` with WebSocket broadcast
- [x] T013b [US4] Implement outbound CoT throttling (max 1 update/sec per entity)
  - Per-UID throttle map in TakService.sendCot(), latest-wins for queued updates
  - Throttle entries cleaned on disconnect to prevent memory leaks
- [x] T014 [P] [US3] Create API endpoint for TAK config in `src/routes/api/tak/config/+server.ts`
- [x] T015 [P] [US3] Create API endpoint for Cert upload in `src/routes/api/tak/certs/+server.ts`
- [x] T016 [US3] Create UI for TAK Server settings in `src/routes/settings/tak/+page.svelte`

## Phase 6: Polish & Verification
- [x] T017 Exponential backoff + custom error classes (TakAuthError, TakConnectionError)
  - Backoff: 1s→2s→4s→8s→16s→30s max, with jitter. Credentials cached for auto-reconnect.
  - TakAuthError (cert/handshake failures), TakConnectionError (network issues)
  - Intentional disconnect suppresses reconnect; attempt counter resets on success
- [x] T018 Verify CSP headers for external tile sources in `src/hooks.server.ts` (FIXED: added Google/Esri domains)
- [x] T019 [SC-006] Performance stress test: 150 CoT markers processed in <1ms (tests/performance/tak-markers.test.ts)
  - 8 tests: SIDC resolution (0.35ms/150), CoT→SIDC mapping (0.49ms/150), VisibilityEngine (0.34ms/150)
  - Validates distinct SIDCs per device type and correct visibility filtering behavior
