# Feature Specification: MIL-STD-2525 Military Symbology & TAK Integration

**Feature Branch**: `005-milsymbol-tak-integration`
**Created**: 2026-02-15
**Status**: Draft
**Input**: User description: "Replace colored dots on tactical map with proper MIL-STD-2525 military symbols and add bidirectional TAK server integration"
**Depends on**: `004-ui-implementation` (NATO-standard semantic colors, Settings panel infrastructure)

## Overview

Argos currently shows detected devices and signals on the tactical map as colored dots. Every soldier is trained to read MIL-STD-2525 military map symbols — the same ones used in ATAK, WinTAK, CPCE, and JBC-P. This spec replaces the colored dots with those real military symbols so any trained operator can read the Argos map instantly without learning Argos-specific iconography.

It also connects Argos to TAK servers so that Argos detections appear on other TAK clients (ATAK on phones, WinTAK on laptops) and external TAK markers appear on the Argos map. This makes Argos a full participant in the unit's Common Operating Picture (COP).

**What changes**: Map markers become proper military symbols with affiliation shapes (hostile diamond, friendly rectangle, unknown quatrefoil). Operators can classify any device's affiliation. A new TAK section in Settings lets operators connect to a TAK server. Detections flow out; TAK markers flow in.

**What stays the same**: Every panel, spectrum display, terminal, and feature works exactly as before. The map layout doesn't change. Scanning, monitoring, and data capture are unaffected.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Military Symbols on the Tactical Map (Priority: P1)

As an operator viewing the Argos tactical map, I want detected devices and signals to appear as proper MIL-STD-2525 military symbols instead of colored dots, so I can read the electromagnetic battlespace using the same symbology I already know from ATAK, CPCE, and operations orders.

**Why this priority**: This is the core visual upgrade. Without proper symbols, the map looks like a civilian tool. With them, it looks and reads like a real Common Operating Picture. Every other feature in this spec builds on these symbols being present.

**Independent Test**: Start a Kismet scan with devices in range. Open the tactical map. Devices appear as MIL-STD-2525 symbols — WiFi access points show as ground equipment icons, cell towers as infrastructure icons, the Argos node itself as a blue friendly sensor rectangle. Zoom in and out — symbols scale appropriately. Hover over a symbol — the detail popup still shows all device information.

**Acceptance Scenarios**:

1. **Given** a WiFi access point detected by Kismet with GPS coordinates, **When** it appears on the tactical map, **Then** it renders as a MIL-STD-2525 ground equipment symbol instead of a colored dot.
2. **Given** the Argos node's own GPS position, **When** displayed on the map, **Then** it renders as a blue friendly rectangle (affiliation: Friendly) with a sensor icon.
3. **Given** a detected cell tower, **When** displayed on the map, **Then** it renders as a ground infrastructure symbol.
4. **Given** any device type not recognized by the symbol mapping, **When** displayed on the map, **Then** it renders as a generic ground unknown symbol (yellow quatrefoil with "?" indicator).
5. **Given** the map zoomed to different levels, **When** symbols are visible, **Then** they remain legible and properly sized at every zoom level.
6. **Given** the "Military Symbols" toggle in the Layers panel, **When** turned off, **Then** the map reverts to the legacy colored-dot display. When turned back on, symbols return.

---

### User Story 2 - Device Affiliation Classification (Priority: P1)

As an operator, I want to classify any detected device as Hostile, Friendly, Unknown, or Neutral so that its map symbol changes shape and color to match standard NATO affiliation conventions, and my classifications persist between sessions.

**Why this priority**: Affiliation is fundamental to military symbology. A symbol without affiliation is meaningless — operators need to know at a glance whether a signal is friendly or hostile. This transforms the map from "here are some devices" to "here is the threat picture."

**Independent Test**: Click on a detected device's symbol on the map. The detail popup shows the current affiliation (defaults to "Unknown"). Change it to "Hostile." The symbol instantly changes to a red diamond shape. Close and reopen the browser — the device is still marked Hostile.

**Acceptance Scenarios**:

1. **Given** a newly detected device, **When** it first appears on the map, **Then** it defaults to "Unknown" affiliation (yellow quatrefoil frame).
2. **Given** a device detail popup, **When** the operator selects "Hostile" from the affiliation dropdown, **Then** the symbol instantly changes to a red diamond frame.
3. **Given** a device detail popup, **When** the operator selects "Friendly," **Then** the symbol changes to a blue rectangle frame.
4. **Given** a device detail popup, **When** the operator selects "Neutral," **Then** the symbol changes to a green square frame.
5. **Given** a device classified as "Hostile," **When** the operator refreshes the page or reopens the browser, **Then** the device retains its "Hostile" classification and red diamond symbol.
6. **Given** the Argos node itself, **When** displayed on the map, **Then** it is always "Friendly" and cannot be reclassified.

---

### User Story 3 - TAK Server Connection (Priority: P2)

As an operator, I want to configure a TAK server connection in the Settings panel by entering a server address, port, and optional credentials, so that Argos can send and receive tactical data.

**Why this priority**: TAK connectivity is the gateway to all bidirectional data exchange. Without a connection, Argos can't share detections or receive external markers. This must work before outbound or inbound CoT features (US4, US5) can function.

**Independent Test**: Open Settings. Navigate to the "TAK Integration" section. Enter a TAK server address and port. Click "Connect." The status indicator shows "Connected" (green) or an error message if the server is unreachable. Click "Disconnect." The status returns to "Disconnected."

**Acceptance Scenarios**:

1. **Given** the Settings panel, **When** the operator opens the TAK Integration section, **Then** it shows fields for server address, port, protocol (TCP/TLS), and an optional callsign.
2. **Given** valid TAK server credentials, **When** the operator clicks "Connect," **Then** the system establishes a connection and shows "Connected" status.
3. **Given** an unreachable TAK server, **When** the operator clicks "Connect," **Then** the system shows a clear error message (e.g., "Connection refused" or "Timeout") within 10 seconds.
4. **Given** an active TAK connection, **When** the operator clicks "Disconnect," **Then** the connection closes cleanly and the status returns to "Disconnected."
5. **Given** a TAK connection drops unexpectedly, **When** the connection is lost, **Then** the system attempts automatic reconnection up to 3 times before showing "Disconnected" with an error message.
6. **Given** the TAK server configuration, **When** the operator refreshes the page, **Then** the saved server address, port, and protocol persist. The connection does not auto-reconnect — the operator must click "Connect" again.

---

### User Story 4 - Outbound CoT: Argos Detections to TAK (Priority: P2)

As an operator with a TAK server connected, I want Argos detections (WiFi devices, cell towers, RF signals) to automatically appear on other TAK clients (ATAK, WinTAK, iTAK), so that my team sees the electromagnetic picture I'm collecting.

**Why this priority**: This is the primary tactical value of TAK integration — sharing Argos intelligence with the rest of the unit. Detection data flows from Argos to the TAK server, which distributes it to every connected TAK client.

**Independent Test**: Connect to a TAK server. Start a Kismet scan. On a separate ATAK/WinTAK client connected to the same TAK server, verify that Argos-detected devices appear as CoT markers on the TAK client's map within 5 seconds of detection.

**Acceptance Scenarios**:

1. **Given** an active TAK connection and a WiFi device detected by Kismet, **When** the detection occurs, **Then** a Cursor on Target (CoT) XML message is sent to the TAK server within 5 seconds.
2. **Given** an Argos node with GPS fix, **When** connected to TAK, **Then** the node's own position is broadcast as a friendly sensor CoT marker.
3. **Given** a device whose affiliation the operator has changed to "Hostile," **When** the CoT message is sent, **Then** the affiliation in the CoT type field reflects "Hostile" so TAK clients display a red diamond.
4. **Given** multiple detected devices, **When** sending CoT messages, **Then** total outbound bandwidth stays below 50 KB/s to work over limited tactical backhaul (4G LTE, Starlink).
5. **Given** a CoT marker sent for a device, **When** no updates occur within 5 minutes (GPS) or 10 minutes (device detection), **Then** the CoT stale time expires and the marker fades or removes itself from TAK clients.

---

### User Story 5 - Inbound CoT: TAK Markers on Argos Map (Priority: P2)

As an operator with a TAK server connected, I want to see markers from other TAK users (friendly positions, reported threats, points of interest) on my Argos tactical map, so I have a complete tactical picture without switching between apps.

**Why this priority**: Bidirectional flow completes the COP. If Argos can only send but not receive, operators still need a separate TAK client open. Receiving TAK markers makes Argos a single-pane-of-glass for both electromagnetic and conventional tactical data.

**Independent Test**: Connect to a TAK server where other users are broadcasting positions. Their markers appear on the Argos tactical map as MIL-STD-2525 symbols. Moving a marker in ATAK causes it to move on the Argos map within a few seconds.

**Acceptance Scenarios**:

1. **Given** an active TAK connection, **When** a CoT event is received from the TAK server, **Then** the corresponding marker appears on the Argos tactical map within 2 seconds.
2. **Given** a received CoT event with a valid MIL-STD-2525 type code, **When** rendered on the map, **Then** it displays the correct military symbol with proper affiliation shape and color.
3. **Given** a received CoT event with an updated position, **When** the update arrives, **Then** the existing marker moves to the new position rather than creating a duplicate.
4. **Given** a received CoT event whose stale time has expired, **When** the stale time passes, **Then** the marker is removed from the map within 30 seconds.
5. **Given** more than 500 TAK markers received, **When** the cap is reached, **Then** the oldest markers are removed to keep memory usage bounded. A subtle indicator shows the cap has been reached.
6. **Given** the "TAK Markers" toggle in the Layers panel, **When** turned off, **Then** all external TAK markers are hidden from the map. When turned back on, they reappear.

---

### User Story 6 - Symbol Legend and Preferences (Priority: P3)

As an operator, I want a legend overlay on the tactical map that explains what each symbol shape and color means, and I want to adjust symbol size to my preference, so I can quickly reference the symbology and optimize readability for my display.

**Why this priority**: Not everyone has MIL-STD-2525 symbology memorized. A legend removes the learning curve. Symbol size preferences help operators on different screen sizes (RPi touchscreen vs. external monitor). These are quality-of-life improvements that aren't required for core functionality.

**Independent Test**: Click a "Legend" button on the map toolbar. An overlay appears showing the four affiliation shapes (diamond/rectangle/quatrefoil/square) with their colors and meanings, plus the device type icons used in Argos. Close the legend. Open Settings and adjust symbol size — symbols on the map grow or shrink accordingly.

**Acceptance Scenarios**:

1. **Given** the map toolbar, **When** the operator clicks the "Legend" button, **Then** a translucent overlay appears showing affiliation shapes (Hostile=red diamond, Friendly=blue rectangle, Unknown=yellow quatrefoil, Neutral=green square) and device type icons.
2. **Given** the legend overlay is open, **When** the operator clicks outside it or presses Escape, **Then** the overlay closes.
3. **Given** the Settings panel, **When** the operator adjusts the "Symbol Size" slider (Small / Medium / Large), **Then** all map symbols resize accordingly without affecting map zoom or layout.
4. **Given** a symbol size preference, **When** the page is refreshed, **Then** the selected size persists.

---

### Edge Cases

- What happens if the symbol library cannot generate a symbol for an unrecognized device type? The system falls back to a generic "unknown ground" symbol (yellow quatrefoil). No blank or missing markers.
- What happens if a malformed CoT XML message is received from the TAK server? The message is silently discarded and logged. No crash, no corrupted map state.
- What happens if the TAK server connection drops during a scan? Outbound CoT messages are dropped (not queued) to avoid unbounded memory growth. The operator sees a "Disconnected" status. Reconnection is attempted automatically up to 3 times.
- What happens if two Argos nodes detect the same device and both send CoT to the same TAK server? The TAK server handles deconfliction by UID — each Argos node uses its own node ID prefix in the CoT UID, so they appear as separate detections. Deduplication is a TAK server responsibility.
- What happens if memory pressure rises above 900MB with TAK active? The inbound TAK marker cap (500) is reduced to 200. If pressure continues, inbound markers are paused entirely until memory drops. Outbound CoT continues unaffected.
- What happens if the operator switches themes (spec 004) while military symbols are active? The affiliation colors (red/blue/yellow/green) are NATO standard and do not change with theme. Other map elements follow the theme.
- What happens if GPS is unavailable? Devices without GPS coordinates are not sent to TAK (CoT requires lat/lon). They still appear in the Argos device list but not on the map or in TAK.
- What happens if local storage is cleared? Affiliation classifications are lost and all devices revert to "Unknown." TAK server configuration is also lost. The operator must reconfigure.
- What happens if the operator tries to connect to two TAK servers simultaneously? Only one TAK connection is supported at a time. The operator must disconnect from the current server before connecting to another.

## Requirements _(mandatory)_

### Functional Requirements

**Symbol Rendering**

- **FR-001**: System MUST render detected devices on the tactical map as MIL-STD-2525 military symbols instead of colored dots when the "Military Symbols" toggle is enabled.
- **FR-002**: System MUST map each device type to an appropriate MIL-STD-2525 symbol category (WiFi AP → ground equipment, cell tower → ground infrastructure, Argos node → friendly sensor, unknown → ground unknown).
- **FR-003**: System MUST generate symbols with the correct affiliation frame shape: Hostile = red diamond, Friendly = blue rectangle, Unknown = yellow quatrefoil, Neutral = green square.
- **FR-004**: System MUST scale symbols appropriately across all map zoom levels so they remain legible without obscuring the map.

**Affiliation System**

- **FR-005**: System MUST default all newly detected devices to "Unknown" affiliation.
- **FR-006**: System MUST always classify the Argos node itself as "Friendly" and prevent reclassification.
- **FR-007**: System MUST allow operators to change a device's affiliation (Hostile, Friendly, Unknown, Neutral) from the device detail popup on the map.
- **FR-008**: System MUST persist affiliation classifications in local storage, keyed by device MAC address, so they survive page refreshes.

**Display Toggles**

- **FR-009**: System MUST provide a "Military Symbols" toggle in the Layers panel that switches between MIL-STD-2525 symbols and legacy colored-dot display.
- **FR-010**: System MUST provide a "TAK Markers" toggle in the Layers panel to show or hide external TAK markers independently.

**TAK Connection**

- **FR-011**: System MUST display a "TAK Integration" section in the Settings panel with fields for server address, port, protocol (TCP/TLS), and callsign.
- **FR-012**: System MUST establish TAK connections server-side (not from the browser) to support TCP/TLS sockets.
- **FR-013**: System MUST display connection status (Disconnected, Connecting, Connected, Error) with clear feedback.
- **FR-014**: System MUST attempt automatic reconnection up to 3 times when a connection drops, then show "Disconnected" with an error.
- **FR-015**: System MUST persist TAK server configuration in local storage so it survives page refreshes. Connections do not auto-reconnect on page load.

**Outbound CoT (Argos → TAK)**

- **FR-016**: System MUST convert Argos detections to Cursor on Target (CoT) XML messages and send them to the connected TAK server.
- **FR-017**: System MUST include the operator's affiliation classification in outbound CoT type codes so TAK clients display the correct symbol.
- **FR-018**: System MUST cap outbound CoT bandwidth at 50 KB/s to work over limited tactical backhaul.
- **FR-019**: System MUST set CoT stale times (5 minutes for GPS positions, 10 minutes for device detections) so expired markers auto-remove on TAK clients.

**Inbound CoT (TAK → Argos)**

- **FR-020**: System MUST receive CoT events from the TAK server and display them as MIL-STD-2525 symbols on the Argos tactical map.
- **FR-021**: System MUST cap inbound TAK markers at 500 to prevent unbounded memory growth. When the cap is reached, the oldest markers are removed first.
- **FR-022**: System MUST remove inbound TAK markers within 30 seconds after their CoT stale time expires.

### Key Entities

- **Military Symbol**: A MIL-STD-2525 icon rendered on the tactical map. Composed of a frame shape (determined by affiliation), an icon (determined by device type), and optional modifiers. Generated as SVG by the rendering library.
- **Affiliation**: The tactical classification of a detected device — Hostile, Friendly, Unknown, or Neutral. Determines the symbol's frame shape and color. Persisted per device (keyed by MAC address).
- **CoT Event**: A Cursor on Target XML message conforming to the CoT protocol. Contains a UID, type code (maps to MIL-STD-2525 SIDC), geographic point, timestamp, stale time, and detail element with device metadata.
- **TAK Connection**: A persistent TCP or TLS socket connection from the Argos server to a TAK server. Carries bidirectional CoT messages. Managed server-side with status exposed to the browser via internal API.
- **TAK Marker**: An inbound CoT event rendered on the Argos map. Has a capped lifetime (stale time) and contributes to the 500-marker memory cap.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All detected devices on the tactical map render as recognizable MIL-STD-2525 symbols (not colored dots) when the "Military Symbols" toggle is on.
- **SC-002**: Affiliation changes (Hostile/Friendly/Unknown/Neutral) are reflected instantly on the map — frame shape and color update within one render cycle.
- **SC-003**: Affiliation classifications persist across page refreshes with zero data loss.
- **SC-004**: A TAK server connection can be established, monitored, and disconnected entirely from the Settings panel — no command-line configuration required.
- **SC-005**: Argos detections appear on a connected TAK client (ATAK/WinTAK) within 5 seconds of detection.
- **SC-006**: TAK markers from external users appear on the Argos map within 2 seconds of receipt.
- **SC-007**: Symbol generation completes in under 50 milliseconds per symbol, verified by performance test.
- **SC-008**: Outbound CoT bandwidth stays below 50 KB/s during active scanning with 50+ detected devices.
- **SC-009**: Memory usage stays below 900MB with TAK active and 500 inbound markers.
- **SC-010**: The "Military Symbols" toggle switches between MIL-STD-2525 and legacy colored dots with no data loss or scan interruption.
- **SC-011**: The "TAK Markers" toggle hides and shows external markers independently of Argos-detected symbols.
- **SC-012**: Stale TAK markers are cleaned up within 30 seconds of expiry — no phantom markers persist.
- **SC-013**: All quality checks pass (type safety, code quality, unit tests, build) after all changes.

## Assumptions

- Spec 004 is complete: semantic color system operational (NATO affiliation colors available as design tokens), Settings panel infrastructure in place.
- Operators are familiar with basic MIL-STD-2525 symbology from their military training. The legend (US6) helps those who need a refresher, but symbols are already standard knowledge.
- TAK server is accessible over the network (TCP port 8087 or TLS port 8089). Firewall/VPN configuration is the operator's responsibility.
- GPS is available for most detected devices (Kismet associates GPS with WiFi detections). Devices without GPS coordinates appear in the device list but not on the map or in TAK.
- The TAK server handles deconfliction when multiple Argos nodes report the same device. Each node prefixes CoT UIDs with its own node ID.
- Local storage is available for persistence. In private browsing mode, affiliations and TAK config are lost on page close.

## Constraints

- **Memory**: Node.js heap capped at 1024MB. Inbound TAK markers capped at 500. Symbol SVGs are cached after first generation to avoid redundant computation.
- **Hardware**: Target is Raspberry Pi 5 (8GB RAM, ARM64). All dependencies must work on ARM with zero native compilation.
- **Bandwidth**: Outbound CoT capped at 50 KB/s. Device update rate ~0.1 Hz per device. Designed for tactical backhaul (4G LTE at minimum).
- **Single TAK Connection**: Only one TAK server connection at a time. Multi-server federation is a future enhancement.
- **NATO Colors Are Fixed**: Affiliation colors (red, blue, yellow, green) follow NATO standard and do not change with operator-selected theme palettes from spec 004.
- **No Layout Changes**: All panels, map controls, spectrum displays, and terminals remain in their current positions.
- **No Functionality Changes**: Scanning, monitoring, data capture, and all existing features remain untouched.
- **Incremental Delivery**: P1 (symbols + affiliation) ships independently of P2 (TAK connection). P3 (legend + preferences) ships last. Each priority tier is independently deployable.
- **Step-by-step Implementation**: Each change is implemented, verified, and committed individually before moving to the next.
