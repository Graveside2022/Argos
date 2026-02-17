# Feature Specification: MIL-STD-2525 Military Symbology & Native TAK Integration

**Feature Branch**: `005-milsymbol-tak-integration`
**Created**: 2026-02-17
**Status**: Draft
**Input**: "Replace colored dots with military symbols, integrate native Google Hybrid maps for visual parity with TAK, and implement full bidirectional TAK server connectivity using .p12 certificates."
**Depends on**: `004-ui-implementation` (Settings panel infrastructure)

## Overview

Argos currently uses a tactical dark vector map with colored dots for devices. To function as a true **Common Operating Picture (COP)** node in a TAK network, it must match both the **data** and the **visual language** of other TAK clients (ATAK, WebTAK).

This feature upgrades Argos to:

1.  **Visual Parity**: Replace dots with **MIL-STD-2525 military symbols** and allow operators to switch the map background to **Google Hybrid Satellite** imagery, matching the standard TAK view.
2.  **Data Parity**: Connect natively to TAK servers using **Certificate Authentication (.p12)** to send WiFi/RF detections and receive team positions.

The goal is to make Argos look and behave like a specialized TAK client—without running a separate heavy application like WebTAK. It remains one lightweight, integrated tool.

## Clarifications

### Session 2026-02-17

- Q: How should the extracted TAK client certificate and key (PEM files) be stored on the host system? → A: Filesystem (Protected) - Save to a restricted directory (e.g., `data/certs`) with strict OS permissions (0600).
- Q: How should the system handle self-signed TAK server certificates? → A: Strict Mode Only - Require a valid CA-signed certificate or an explicitly uploaded CA. No "Insecure" toggle.
- Q: How should the system access satellite imagery (Google Maps)? → A: Custom Source Support (TAK Style) - Default to compliant provider (Esri World Imagery); allow users to enter any Custom XYZ URL (including Google, at their own risk).
- Q: How should the MIL-STD-2525 symbols be generated? → A: Client-Side (mil-sym-ts) - Use the `missioncommand/mil-sym-ts` library for strict 2525D compliance and performance.
- Q: How should we handle map clutter from thousands of Kismet detections? → A: Tri-Mode Visibility - Support "Dynamic Filter" (Auto-Squelch), "Show All" (Raw), and "Manual Only". Allow individual device promotion in all modes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Google Hybrid Map Integration (Priority: P1)

As an operator, I want to switch the tactical map background to "Satellite Hybrid" (Google Maps) so I can recognize terrain features and see the exact same visual map that my team sees on their ATAK devices.

**Why this priority**: Visual parity is critical for coordination. "The target is near the white building" means nothing on a dark vector map. It requires satellite imagery. This also makes Argos feel like a professional TAK tool.

**Independent Test**: Click the Gear Icon (Settings) > "Map Layers".

- **Standard**: Select "Satellite Hybrid" from the dropdown.
- **Custom**: Click "Import Source". Upload a TAK-compatible XML file (e.g., `Google_Maps.xml`) or paste a standard XYZ URL. The map updates immediately.

**Acceptance Scenarios**:

1.  **Given** the Map Settings panel, **When** the operator selects "Satellite Hybrid," **Then** the map background instantly changes to Google Hybrid raster tiles.
2.  **Given** a custom map requirement, **When** the user uploads a TAK Map Source XML or pastes an XYZ URL, **Then** the system parses the template and applies it as the base layer.
3.  **Given** the "Satellite Hybrid" view, **When** the operator zooms in, **Then** high-resolution satellite imagery is displayed with street names and labels overlaying it.
4.  **Given** the map view, **When** the operator selects "Tactical Dark," **Then** the map reverts to the standard Stadia/MapLibre vector style.
5.  **Given** a selected map source, **When** the page is refreshed, **Then** the map remembers the user's selection (persisted state).
6.  **Given** an offline environment (no internet), **When** "Satellite Hybrid" is selected, **Then** the map handles the failure gracefully (e.g., shows cached tiles or a specific "Offline" placeholder if tiles fail to load).

---

### User Story 2 - Military Symbols on the Tactical Map (Priority: P1)

As an operator, I want detected devices to appear as proper MIL-STD-2525 military symbols instead of colored dots, so I can instantly distinguish between "Friendly," "Hostile," and "Unknown" entities using standard NATO symbology.

**Why this priority**: This is the "language" of tactical operations. Dots are ambiguous; symbols are precise.

**Independent Test**: Start a Kismet scan. Devices appear on the map. Verify they are icons (Ground Equipment for WiFi, Infrastructure for Towers), not dots. Click a device, change affiliation to "Hostile." It becomes a Red Diamond.

**Acceptance Scenarios**:

1.  **Given** a detected WiFi AP, **When** displayed, **Then** it renders as a MIL-STD-2525 "Ground Equipment" symbol (Icon: Sensor/Antenna).
2.  **Given** the Argos node itself, **When** displayed, **Then** it renders as a Blue "Friendly" Rectangle (Unit: Cyber/EW Team).
3.  **Given** a Cell Tower, **When** displayed, **Then** it renders as "Ground Infrastructure" (Icon: Communications Tower).
4.  **Given** a device with unknown type, **When** displayed, **Then** it renders as "Ground Unknown" (Yellow Quatrefoil).
5.  **Given** the "Military Symbols" toggle, **When** disabled, **Then** the map reverts to simple dots (for clutter reduction).

---

### User Story 3 - Secure TAK Server Connection (Priority: P2)

As an operator, I want to connect to a TAK Server using my **.p12 client certificate**, so I can securely authenticate and participate in the encrypted mission network.

**Why this priority**: Real-world TAK networks use TLS/SSL with mutual authentication. Without `.p12` support, Argos cannot connect to production servers.

**Independent Test**: Click the Gear Icon (Settings) > "TAK Integration".

- **Identity**: Upload `user.p12`. Enter password. System validates.
- **Trust**: Upload `root-ca.pem` or `truststore.p12` (for private CAs).
- **Connect**: Enter `tls://tak-server:8089`. Click "Connect". Status: "Connected".

**Acceptance Scenarios**:

1.  **Given** the Settings > TAK panel, **When** the user uploads a `.p12`, **Then** the system extracts the Client Cert and Private Key.
2.  **Given** a private TAK server, **When** the user uploads a CA/Trust Store file, **Then** the system adds it to the trusted root for the connection (allowing self-signed verification).
3.  **Given** a valid certificate and server URL, **When** "Connect" is clicked, **Then** the backend establishes a mutual TLS connection and updates the status to "Connected."
4.  **Given** an invalid certificate or password, **When** connecting, **Then** a clear error message ("Authentication Failed") is displayed.
5.  **Given** a connection drop, **When** it happens, **Then** the system attempts to reconnect automatically with exponential backoff.
6.  **Given** a successful connection, **When** the page is refreshed, **Then** the connection remains active (managed server-side).

---

### User Story 4 - Bi-Directional CoT Sync (Priority: P2)

As an operator, I want Argos to send its WiFi/RF detections to the TAK server and receive team positions from the server, so I have a complete picture of the battlespace.

**Why this priority**: This is the functional "integration." It turns Argos into a sensor node for the team and a display for the operator.

**Independent Test**:

- **Outbound**: Detect a WiFi network in Argos. Check ATAK/WebTAK. See the WiFi network appear as a "Hostile" or "Suspect" marker.
- **Inbound**: Create a marker in ATAK. Check Argos map. See the marker appear as a MIL-STD-2525 symbol.

**Acceptance Scenarios**:

1.  **Given** a newly detected WiFi device, **When** it is classified (e.g., "Hostile"), **Then** Argos sends a CoT event to the TAK server with the correct UID, location, and Type (Affiliation).
2.  **Given** the Argos node moves, **When** GPS updates, **Then** Argos sends a "Self Position" (SA) CoT update to the server.
3.  **Given** a generic CoT event received from the server (e.g., a "Friendly Ground Unit"), **When** received, **Then** it appears on the Argos map with the correct Blue Rectangle symbol.
4.  **Given** a "Stale" marker, **When** the timeout expires, **Then** it is removed from the Argos map.
5.  **Given** high network traffic, **When** sending CoT, **Then** Argos throttles updates to avoid flooding the low-bandwidth tactical link (max 1 update/sec per entity).

---

## Requirements _(mandatory)_

### Functional Requirements

**Map Visualization**

- **FR-001**: System MUST support switching the map tile provider between "Stadia (Vector)", "Esri Satellite (Raster)", and "Custom XYZ Source".
- **FR-002**: System MUST render MIL-STD-2525 symbols for all entities (local detections + remote TAK markers) on top of either map background.
- **FR-003**: System MUST persist the user's map provider selection and custom URL configuration.
- **FR-014**: System MUST support importing TAK-compatible Map Source XML files (containing XYZ templates) to configure custom map layers.

**Authentication & Security**

- **FR-004**: System MUST allow uploading of PKCS#12 (`.p12`) files for TAK authentication.
- **FR-005**: System MUST extract client certificates/keys from the .p12 file (converting to PEM) and store them securely on the host filesystem with restricted permissions (0600/root only).
- **FR-006**: System MUST support TLS (Secure TCP) connections to TAK servers on standard ports (e.g., 8089).
- **FR-012**: System MUST allow uploading a custom CA certificate (PEM/CRT) to trust private TAK servers. Insecure TLS connections (skipping verification) MUST NOT be supported.

**TAK Protocol (CoT)**

- **FR-007**: System MUST use a native server-side client (e.g., `@tak-ps/node-tak`) to maintain the connection, ensuring it persists even if the browser is closed.
- **FR-008**: System MUST translate internal Kismet/RF entities into standard CoT XML schema (UID, Type, Point, Detail).
- **FR-009**: System MUST process incoming CoT messages and convert them to GeoJSON for the frontend map.

**Symbology**

- **FR-010**: System MUST use the `@missioncommand/mil-sym-ts` library to render client-side SVG symbols for all map entities.
- **FR-011**: System MUST support standard affiliations: Friendly (Blue), Hostile (Red), Neutral (Green), Unknown (Yellow).
- **FR-013**: System MUST implement three visibility modes for Kismet detections: (1) "Dynamic Filter" (Default: hide noise), (2) "Show All" (show every device), and (3) "Manual Only" (show only promoted devices). Operators MUST be able to manually toggle visibility for individual devices in any mode.

### Key Entities

- **Map Provider**: Configuration object defining the tile URL template (e.g., `mt1.google.com/...`) and attribution.
- **TAK Certificate**: The user's `.p12` file, parsed into Key and Cert for TLS.
- **CoT Message**: The XML payload exchanged with the server.
- **TAK Contact**: A remote entity (User, Vehicle, Marker) tracked by the TAK server.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Operator can switch to "Satellite Hybrid" view and see Google Maps imagery with < 2s tile load time on standard broadband.
- **SC-002**: User can successfully connect to a TLS-secured TAK server using a `.p12` file.
- **SC-003**: WiFi detections from Argos appear on a connected ATAK device within 5 seconds.
- **SC-004**: Markers created on ATAK appear on the Argos map within 2 seconds.
- **SC-005**: Argos maintains the TAK connection for > 1 hour without dropping, or auto-reconnects within 30s if dropped.
- **SC-006**: System handles 100+ incoming TAK markers without UI lag (maintains > 30 FPS map panning).

## Assumptions

- The operator has a valid `.p12` certificate and password for the target TAK server.
- The Raspberry Pi has internet access (for Google Maps tiles) and network access to the TAK server (via VPN/Tailscale or direct).
- Google Maps tile usage complies with standard "Direct Tile Access" patterns used by other OSINT/TAK tools (or user accepts the ToS implications).
- The existing MapLibre engine can handle the raster tile overlay without performance regression.

## Constraints

- **Hardware**: Raspberry Pi 5. Map rendering must remain efficient (Raster tiles are generally lighter than Vector, but bandwidth is higher).
- **Network**: Tactical networks may be slow. CoT updates should be optimized (only send changes).
- **Storage**: Certificates must be stored securely (restricted file permissions).
