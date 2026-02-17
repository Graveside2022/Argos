# Tasks: MIL-STD-2525 Military Symbology & Native TAK Integration

This document outlines the implementation tasks for the 005-milsymbol-tak-integration feature, organized by priority and user story.

## Dependencies

- Phase 2 depends on Phase 1.
- Phase 3 (US1) and Phase 4 (US2) are largely independent.
- Phase 5 (US3) is required for Phase 6 (US4).

## Phase 1: Setup & Foundations

- [ ] T001 [P] Fix `src/lib/map/symbols/SymbolFactory.ts` to use `@armyc2.c5isr.renderer/mil-sym-ts-web` instead of missing `milsymbol`
- [ ] T002 [P] Implement/Verify `src/lib/map/MapSourceParser.ts` for TAK Map Source XML compatibility
- [ ] T003 [P] Ensure `src/lib/server/tak/CertManager.ts` enforces 0600 permissions on all extracted files

## Phase 2: Foundational Map Infrastructure

- [ ] T004 [P] Verify `src/lib/map/layers/SatelliteLayer.ts` supports dynamic URL updates from `mapSettings` store
- [ ] T005 [P] Verify `src/lib/map/layers/SymbolLayer.ts` correctly manages MapLibre image sprite for 2525 symbols
- [ ] T006 [P] Ensure `src/lib/server/tak/TakService.ts` is properly initialized in `src/hooks.server.ts`

## Phase 3: User Story 1 - Google Hybrid Map & Custom Sources (P1)

- [ ] T007 [US1] Add "Import Source" file upload input to `src/lib/components/dashboard/panels/LayersPanel.svelte`
- [ ] T008 [US1] Implement Map Source XML parsing logic in `src/lib/components/dashboard/panels/LayersPanel.svelte` using `MapSourceParser.ts`
- [ ] T009 [US1] Persist custom map source configurations in the database via new API or `mapSettings` store
- [ ] T010 [US1] Add integration test for switching between Tactical, Satellite, and Custom map layers in `tests/integration/map-layers.test.ts`

## Phase 4: User Story 2 - Military Symbols (Visuals) (P1)

- [ ] T011 [US2] Map all Argos device types (WiFi AP, Client, Cell Tower, Drone) to specific MIL-STD-2525 SIDC codes in `src/lib/map/symbols/SymbolFactory.ts`
- [ ] T012 [US2] Ensure `src/lib/components/dashboard/DashboardMap.svelte` correctly reactive-updates symbol layers when device affiliations change
- [ ] T013 [US2] Implement "Military Symbols" toggle logic in `src/lib/components/dashboard/DashboardMap.svelte` to switch between dots and icons
- [ ] T014 [US2] Add visual regression test for symbol rendering in `tests/visual/symbology.test.ts`

## Phase 5: User Story 3 - Secure TAK Connection (P2)

- [ ] T015 [US3] Add standalone CA Certificate upload support to `src/routes/api/tak/certs/+server.ts` and `src/lib/server/tak/CertManager.ts`
- [ ] T016 [US3] Update `src/routes/settings/tak/+page.svelte` to support separate CA file upload and password-protected .p12
- [ ] T017 [US3] Implement comprehensive error reporting for TAK connection states (Auth Failure vs. Timeout) in `src/lib/server/tak/TakClient.ts`
- [ ] T018 [US3] Add unit tests for certificate extraction and secure storage in `tests/unit/server/tak/CertManager.test.ts`

## Phase 6: User Story 4 - Bi-Directional CoT Sync (P2)

- [ ] T019 [US4] Implement Kismet-to-CoT translation bridge in `src/lib/server/tak/TakService.ts` to send detections to TAK server
- [ ] T020 [US4] Implement GPS-to-CoT (Self-Position/SA) update logic in `src/lib/server/tak/TakService.ts`
- [ ] T021 [US4] Verify Inbound CoT to GeoJSON conversion in `src/lib/utils/cot-parser.ts` handles remote team members and markers
- [ ] T022 [US4] Implement stale marker cleanup logic for incoming TAK contacts to prevent map clutter
- [ ] T023 [US4] Add E2E test for bi-directional CoT sync between Argos and a mock TAK server in `tests/e2e/tak-sync.test.ts`

## Phase 7: Polish & Cross-Cutting

- [ ] T024 Optimize map rendering performance for 100+ concurrent symbols to ensure SC-006 (30+ FPS)
- [ ] T025 Implement graceful failure and "Offline" placeholder for raster map tiles in `src/lib/map/layers/SatelliteLayer.ts`
- [ ] T026 Final security audit of certificate storage and connection handling per Article VIII of the plan
- [ ] T027 Verify all Acceptance Scenarios from `spec.md` pass in the final prototype

## Implementation Strategy

1.  **MVP (Phase 1-2)**: Get symbols rendering correctly and raster tiles working with hardcoded URLs.
2.  **Visual Completion (Phase 3-4)**: Enable full operator control over maps and symbology.
3.  **Connectivity (Phase 5)**: Establish secure connection to TAK servers.
4.  **Functional Parity (Phase 6)**: Enable bidirectional data flow (The "Real" Integration).

## Parallel Execution

- T001, T002, T003 can be done in parallel.
- US1 (T007-T009) and US2 (T011-T013) can be developed in parallel once foundational map work is done.
- Backend TAK logic (T015, T017, T019) can be developed in parallel with Frontend TAK UI (T016).
