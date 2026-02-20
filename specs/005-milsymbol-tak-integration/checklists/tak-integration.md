# Checklist: MIL-STD-2525 & TAK Integration Requirements

**Purpose**: Validate the completeness, safety, and resilience of the Google Maps & TAK integration specification.
**Focus**: Visual Experience, Security/Connectivity, Resilience.
**Created**: 2026-02-17
**Last Validated**: 2026-02-17 (post-implementation audit)

## 1. Visual Specification (Maps & Symbology)

These items ensure the map visualization requirements are complete and unambiguous for implementation.

- [x] CHK001 Are the specific map tile provider URLs or templates defined for the "Google Hybrid" source? [Clarity, Spec §FR-001]
    - Defined in map-settings-store.ts: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`
- [x] CHK002 Is the default map state (Vector vs. Raster) defined for the first application launch? [Completeness]
    - Default: "Tactical Dark" (vector) in map-settings-store.ts.
- [x] CHK003 Are specific MIL-STD-2525 symbol codes (SIDC) defined for all mapped entity types (WiFi, Towers, Drones)? [Completeness, Spec §FR-002]
    - **Fixed**: SymbolFactory has per-type SIDC map: WiFi→EVSR, Client→EVSC, BT→EVSDF, Cell→IPC, Drone→MFQ(Air), Self→UCFEW.
- [ ] CHK004 Is the behavior defined when a symbol icon fails to load or render? [Edge Case]
    - **Gap**: No fallback behavior if SymbolFactory.createSymbol() fails.
- [x] CHK005 Are "clustering" or "decluttering" requirements defined for high-density scenarios (100+ markers)? [Scalability, Spec §FR-13]
    - **Fixed**: VisibilityEngine.ts implements tri-mode filtering (dynamic/all/manual). MapLibre clustering active for device source. Performance verified at 150 markers in <1ms.
- [ ] CHK006 Is the visual hierarchy defined between local detections (Argos) and remote TAK markers? (Which draws on top?) [Clarity]
    - **Gap**: Both local and TAK features go into the same SymbolLayer. No z-index differentiation.

## 2. Security & Authentication Requirements

These items ensure the security implementation is robust and follows best practices.

- [ ] CHK007 Are validation requirements defined for the `.p12` file upload (e.g., max size, file format check)? [Input Validation, Spec §FR-004]
    - **Gap**: No file size limit or format validation on upload endpoint.
- [x] CHK008 Are error messages defined for invalid passwords or corrupt certificate files? [UX/Error, Spec §SC-002]
    - CertManager throws descriptive error on extraction failure. Certs endpoint returns error message.
- [x] CHK009 Is the secure storage mechanism for extracted PEM files explicitly defined (e.g., file permissions 0600)? [Security, Spec §FR-005]
    - CertManager: dirs 0700, files 0600.
- [x] CHK010 Are requirements defined for handling self-signed vs. public CA certificates? [Completeness, Spec §FR-012]
    - Spec: "Strict Mode Only". TakClient now enforces rejectUnauthorized: true. CA upload supported.
- [ ] CHK011 Is the behavior defined when a certificate expires or is revoked during a session? [Edge Case]
    - **Gap**: No certificate expiry monitoring.
- [ ] CHK012 Are TLS version requirements specified (e.g., TLS 1.2+ only)? [Security Standard]
    - **Gap**: Not specified. Node.js defaults to TLS 1.2+ but not explicitly enforced.

## 3. Data Integration & Protocol (CoT)

These items ensure the data exchange format is standard-compliant and reliable.

- [x] CHK013 Are the specific CoT message fields (UID, Type, Point, How) defined for outbound messages? [Interop, Spec §FR-008]
    - CotMessage interface defines all required fields. TakClient.send() builds XML.
- [x] CHK014 Is the mapping of incoming CoT types to internal Argos entity types clearly defined? [Clarity, Spec §FR-009]
    - **Fixed**: cot-parser.ts now uses SymbolFactory.cotTypeToSidc() to convert CoT atom types (a-f-G-U-C) to valid 2525C SIDCs.
- [x] CHK015 Are requirements defined for "stale" or "timed out" markers (when to remove them from map)? [Lifecycle, Spec §SC-004]
    - Spec defines stale timeout. CotMessage has `stale` field.
- [ ] CHK016 Is the behavior defined for duplicate CoT messages (same UID, different timestamp)? [Data Integrity]
    - **Gap**: takCotMessages store just appends all messages. No deduplication by UID.
- [x] CHK017 Are throttle/rate-limit requirements defined for outbound CoT updates to prevent network flooding? [Performance, Spec §SC-006]
    - **Fixed**: TakService.sendCot() throttles to max 1 update/sec per entity UID. Latest-wins for queued updates.

## 4. Resilience & "Safe Behaviors" (Critical)

These items ensure the application remains stable during failures (Network, Data, User Error).

- [x] CHK018 Is the behavior defined when map tiles fail to load (e.g., offline mode)? [Resilience, Spec §SC-001]
    - MapLibre handles tile failures natively (blank tiles). Spec mentions graceful failure.
- [x] CHK019 Are retry intervals and backoff strategies defined for lost TAK server connections? [Robustness, Spec §SC-005]
    - **Fixed**: TakClient now uses exponential backoff (1s→2s→4s→...→30s max) with jitter. Credentials cached for auto-reconnect.
- [ ] CHK020 Is error handling defined for malformed or incomplete CoT messages from the server? [Stability]
    - **Gap**: cot-parser.ts returns null but TakClient emits raw XML without validation.
- [ ] CHK021 Is the system behavior defined if the local disk is full when saving certificates? [Edge Case]
    - **Gap**: No disk space check before writing certs.
- [ ] CHK022 Are requirements defined for graceful degradation on slow networks (high latency)? [Performance]
    - **Gap**: No specific handling for high-latency networks.

## 5. User Experience (UX) Consistency

- [x] CHK023 Is the "Connected/Disconnected" status indicator clearly defined in the UI? [Visibility, Spec §FR-006]
    - TAK settings page has status indicator with colored dot.
- [ ] CHK024 Are loading states defined while map layers are switching or initializing? [Responsiveness]
    - **Gap**: No loading indicator when switching between vector and satellite.
- [ ] CHK025 Is the workflow defined for updating/replacing an existing certificate? [Usability]
    - **Gap**: CertManager.saveAndExtract deletes old dir but UI doesn't show current cert info or confirm replacement.
