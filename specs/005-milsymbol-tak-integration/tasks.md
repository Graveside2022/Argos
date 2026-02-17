# Tasks: MIL-STD-2525 & TAK Integration

**Feature**: `005-milsymbol-tak-integration`
**Status**: Pending
**Based on**: Plan, Spec, Data Model

## Dependencies & Resources

- **MIL-STD-2525 Library**: [missioncommand/mil-sym-ts](https://github.com/missioncommand/mil-sym-ts)
- **TAK Library**: [dfpc-coe/node-tak](https://github.com/dfpc-coe/node-tak) (as `@tak-ps/node-tak`)

## Phase 1: Setup
- [ ] T001 Install dependencies: `npm install @missioncommand/mil-sym-ts @tak-ps/node-tak`
- [ ] T002 Create directory structure: `mkdir -p src/lib/server/tak src/lib/map/layers src/lib/map/symbols src/lib/types data/certs`

## Phase 2: Foundational
- [ ] T003 Create TakServerConfig migration in `src/lib/server/db/migrations/20260217_create_tak_configs.ts`
- [ ] T004 Implement CertManager for secure file handling in `src/lib/server/tak/CertManager.ts`
- [ ] T005 [P] Define TakServerConfig and TakContact interfaces in `src/lib/types/tak.ts`

## Phase 3: Google Hybrid Map (US1)
- [ ] T006 [P] [US1] Create SatelliteLayer class for raster tiles in `src/lib/map/layers/SatelliteLayer.ts` (Ensure compatibility with both MapLibre and legacy Leaflet views if still active)
- [ ] T007 [P] [US1] Update MapSettings component to include layer switching in `src/components/map/MapSettings.svelte`
- [ ] T007b [US1] Implement Map Source XML parser (TAK format) in `src/lib/map/MapSourceParser.ts` to support FR-014.
- [ ] T008 [US1] Integrate SatelliteLayer into `DashboardMap.svelte` (MapLibre) and verify legacy `LeafletMap.svelte` (if any) handles raster fallback.

## Phase 4: MIL-STD-2525 Symbols (US2)
- [ ] T009 [P] [US2] Create SymbolFactory wrapper for [mil-sym-ts](https://github.com/missioncommand/mil-sym-ts) in `src/lib/map/symbols/SymbolFactory.ts`
- [ ] T010 [US2] Create SymbolLayer to render symbols on map in `src/lib/map/layers/SymbolLayer.ts` (MapLibre implementation)
- [ ] T010b [US2] Create LeafletSymbolProvider (if needed) for legacy map consistency.
- [ ] T011 [US2] Update signal rendering to use SymbolLayer in `src/lib/map/MapController.ts`
- [ ] T011b [US2] Implement Tri-Mode Visibility (Dynamic Filter/Auto-Squelch) logic in `src/lib/map/VisibilityEngine.ts` as per FR-013.

## Phase 5: TAK Server Connectivity (US3 & US4)
- [ ] T012 [P] [US3] Implement TakClient wrapper for [node-tak](https://github.com/dfpc-coe/node-tak) in `src/lib/server/tak/TakClient.ts`. Include CoT XML translation logic (FR-008).
- [ ] T013 [US3] Implement TakService for connection management in `src/lib/server/tak/TakService.ts`. Include CoT-to-GeoJSON conversion for map updates (FR-009).
- [ ] T013b [US4] Implement outbound CoT throttling (max 1 update/sec per entity) as per US4 AC 5.
- [ ] T014 [P] [US3] Create API endpoint for TAK config in `src/routes/api/tak/config/+server.ts`
- [ ] T015 [P] [US3] Create API endpoint for Cert upload in `src/routes/api/tak/certs/+server.ts` (Include logic to deny insecure TLS as per FR-012).
- [ ] T016 [US3] Create UI for TAK Server settings in `src/routes/settings/tak/+page.svelte`

## Phase 6: Polish & Verification
- [ ] T017 Improve error handling for TAK connection failures in `src/lib/server/tak/TakService.ts`
- [ ] T018 Verify CSP headers for external tile sources in `src/hooks.server.ts`
- [ ] T019 [SC-006] Perform performance stress test with 100+ simulated CoT markers and verify > 30 FPS on MapLibre.

## Implementation Strategy
- **MVP**: Complete Phase 3 (US1) first for visual quick win on MapLibre.
- **Full Feature**: Complete Phase 4 and 5 in parallel, ensuring both map engines are considered during the transition.