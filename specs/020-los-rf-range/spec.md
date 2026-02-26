# Feature Specification: Line-of-Sight RF Range Overlay

**Feature Branch**: `020-los-rf-range`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "Depending on the SDR connected create a line of sight feature that is based on the frequency you are transmitting at. Have it show the effective distance based on the location"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View RF Range Circle on Map (Priority: P1)

An operator has a HackRF One connected and is monitoring or transmitting on a specific frequency. They want to see their effective RF range displayed as a visual overlay on the map, centered on their current GPS position. The range circle automatically adjusts when the active frequency changes — a 900 MHz GSM signal reaches much farther than a 5.8 GHz WiFi signal under identical conditions.

**Why this priority**: This is the core value proposition. Without a visible range overlay tied to the active frequency, no other feature in this spec delivers value. A flat-earth free-space model (Friis equation) provides an immediately useful approximation that works without any external data dependencies.

**Independent Test**: Can be fully tested by connecting a HackRF, selecting a frequency, and observing that a colored range ring appears on the map centered on the GPS fix. Changing the frequency should visibly grow or shrink the ring.

**Acceptance Scenarios**:

1. **Given** a HackRF is connected and GPS has a fix, **When** the operator is sweeping at 900 MHz, **Then** a filled range overlay appears on the map centered on their position showing the estimated effective range at that frequency.
2. **Given** the range overlay is visible at 900 MHz, **When** the operator switches to sweeping at 2400 MHz, **Then** the range overlay shrinks to reflect the shorter effective distance at the higher frequency.
3. **Given** no SDR hardware is connected, **When** the operator views the map, **Then** no RF range overlay is shown (the feature is inactive).
4. **Given** a HackRF is connected but GPS has no fix, **When** the operator views the map, **Then** no RF range overlay is shown (position unknown).

---

### User Story 2 - Configure Transmission Parameters (Priority: P2)

The operator wants to adjust the parameters that affect range calculation — specifically the transmit power, antenna gain, receiver sensitivity threshold, and antenna height above ground level (AGL). Different missions use different antennas, power levels, and mounting positions (handheld, vehicle-mounted, mast-mounted), so a one-size-fits-all calculation is insufficient. The operator can select from common presets (e.g., "HackRF bare", "HackRF + amplifier", "HackRF + directional antenna") or manually enter custom values. Antenna height is particularly critical for terrain-aware viewshed calculations (P3), where even a few meters of elevation dramatically changes what terrain is visible.

**Why this priority**: The default Friis calculation with HackRF stock parameters provides a useful baseline (P1), but real-world operators swap antennas and add amplifiers. Configurable parameters make the range estimate operationally accurate rather than just illustrative.

**Independent Test**: Can be tested by adjusting TX power from 10 dBm to 20 dBm and observing that the range circle grows. Selecting a preset like "HackRF + amplifier" should visibly enlarge the range compared to "HackRF bare".

**Acceptance Scenarios**:

1. **Given** the RF range overlay is active, **When** the operator increases transmit power from 10 dBm to 20 dBm, **Then** the range circle grows to reflect the increased effective distance.
2. **Given** the operator selects the "HackRF + directional antenna" preset, **When** the preset is applied, **Then** the antenna gain value updates and the range circle adjusts accordingly.
3. **Given** the operator enters a custom antenna gain of 12 dBi, **When** the value is applied, **Then** the range calculation uses that gain and the overlay updates in real time.
4. **Given** the operator changes antenna height AGL from 1.5m (handheld) to 10m (mast-mounted), **When** the value is applied, **Then** the terrain-aware viewshed (P3) recalculates with the new observation height, and the free-space overlay (P1) remains unchanged (height does not affect Friis path loss).

---

### User Story 3 - Multi-Band Range Rings (Priority: P2)

The operator wants to see the range displayed as concentric colored bands rather than a single circle, representing signal quality zones — strong, usable, marginal, and theoretical maximum. This mirrors how the existing WiFi detection range bands work but is driven by RF propagation math instead of hardcoded distances.

**Why this priority**: A single-radius circle implies a hard cutoff, but RF propagation is gradual. Concentric bands give the operator an intuitive feel for where signals will be strong vs. where they degrade. This builds directly on the existing concentric range band pattern already in the codebase.

**Independent Test**: Can be tested by enabling the RF range overlay and verifying that 4 concentric colored rings appear (strong to marginal), with the outermost ring matching the theoretical maximum free-space range and inner rings representing higher-confidence coverage zones.

**Acceptance Scenarios**:

1. **Given** the RF range overlay is active, **When** the operator views the map, **Then** at least 3 concentric bands are visible, each with a distinct color indicating signal quality (mapped via design tokens: `--signal-very-strong` sage green, `--signal-strong` blue, `--signal-fair` gold, `--signal-weak` faded red).
2. **Given** the operator changes frequency, **When** all bands update, **Then** the proportional spacing between bands is maintained (inner bands are always a percentage of the outer).

---

### User Story 4 - Terrain-Aware Line of Sight (Priority: P3)

The operator wants the range overlay to account for terrain obstructions. Instead of a perfect circle (flat-earth model), the overlay should show an irregular shape that reflects where line-of-sight is blocked by hills, mountains, or valleys. This requires querying elevation data for the surrounding terrain and performing viewshed analysis from the operator's position and antenna height.

**Why this priority**: This is the most operationally valuable version of the feature — it answers "can my signal actually reach that point?" rather than "how far could it reach in a vacuum." However, it requires either network access to an elevation API or locally cached terrain data, which significantly increases complexity and has an external dependency. It builds on P1-P2 and can be deferred without impacting their value.

**Independent Test**: Can be tested by positioning the operator near a known hill or ridge (or using simulated elevation data) and verifying that the range overlay shows a "shadow" behind the obstruction where LOS is blocked.

**Acceptance Scenarios**:

1. **Given** terrain data is available for the operator's area, **When** the RF range overlay is enabled, **Then** the overlay shape is irregular — extending farther in directions with clear line-of-sight and cut short where terrain blocks the path.
2. **Given** terrain data is unavailable (offline, no cached data), **When** the RF range overlay is enabled, **Then** the system falls back to the flat-earth circular model (P1 behavior) and indicates to the operator that terrain data is not available.
3. **Given** the operator is at 920m ASL near a 1200m ridge, **When** the viewshed is calculated, **Then** the range overlay does not extend beyond the ridge in that azimuth direction.

---

### Edge Cases

- What happens when the SDR is disconnected mid-display? The range overlay should disappear within one update cycle.
- What happens when GPS fix is lost while the overlay is active? The overlay should freeze at the last known position and show a visual indicator that the position is stale, then disappear after a configurable timeout.
- What happens at extremely low frequencies (1 MHz)? The theoretical range could be enormous — the overlay should cap at a maximum display radius to prevent rendering a circle larger than the visible map area.
- What happens at extremely high frequencies (6 GHz)? The range may be very small — the overlay should have a minimum visible radius so it doesn't become invisible.
- What happens when the operator is indoors or in a vehicle? The free-space model will overestimate. The system should clearly label the overlay as "free-space estimate" to set expectations.
- What happens when multiple SDR devices are connected? The overlay should use the active/primary SDR's frequency. If both are active, show only the one the user has selected.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an RF range overlay on the map centered on the operator's current GPS position when an SDR is connected and GPS has a fix.
- **FR-002**: System MUST calculate the effective range using a free-space path loss model (Friis equation) based on the active operating frequency.
- **FR-003**: System MUST automatically update the range overlay when the operating frequency changes.
- **FR-004**: System MUST automatically reposition the range overlay as the operator's GPS position updates.
- **FR-005**: System MUST remove the range overlay when the SDR is disconnected or GPS fix is lost.
- **FR-006**: System MUST support the full HackRF One frequency range (1 MHz – 6 GHz) for range calculations.
- **FR-007**: System MUST allow the operator to configure transmit power (dBm), antenna gain (dBi), receiver sensitivity (dBm), and antenna height above ground level (meters) to customize the range estimate.
- **FR-008**: System MUST provide at least 3 hardware presets for common configurations (bare HackRF, HackRF with amplifier, HackRF with directional antenna).
- **FR-009**: System MUST display the range as concentric colored bands representing signal quality zones (strong, usable, marginal, theoretical maximum).
- **FR-010**: System MUST provide a toggle in the Layers panel to show/hide the RF range overlay independently of other map layers.
- **FR-011**: System MUST cap the maximum displayed range radius to prevent rendering artifacts on the map.
- **FR-012**: System MUST label the overlay to indicate whether it is a "free-space estimate" or "terrain-aware" calculation.
- **FR-013**: System SHOULD query terrain elevation data to compute a line-of-sight viewshed when network connectivity or cached terrain data is available.
- **FR-014**: System MUST fall back to the flat-earth circular model when terrain data is unavailable.

### Key Entities

- **RF Range Profile**: A set of parameters that define a range calculation — frequency (MHz), transmit power (dBm), antenna gain (dBi), receiver sensitivity (dBm), antenna height AGL (meters), and propagation model type (free-space or terrain-aware). May be a saved preset or custom values.
- **Range Band**: A concentric zone within the range overlay, defined by an inner radius, outer radius, color, and label (e.g., "Strong", "Usable", "Marginal", "Maximum"). Extends the existing range band concept used for WiFi detection.
- **Viewshed**: The area visible from the operator's position considering terrain elevation. An irregular polygon representing where line-of-sight exists, used to clip or reshape the range overlay.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Operator can see an RF range overlay on the map within 2 seconds of an SDR becoming active with a GPS fix.
- **SC-002**: Range overlay updates within 500ms when the active frequency changes.
- **SC-003**: Range calculation is within 10% of the theoretical Friis free-space path loss for any frequency in the 1 MHz – 6 GHz range.
- **SC-004**: Operator can switch between at least 3 hardware presets and see the range overlay adjust in under 1 second.
- **SC-005**: The feature uses less than 15 MB of additional memory and adds less than 5% CPU load on the Raspberry Pi 5.
- **SC-006**: When terrain data is available, the viewshed calculation completes within 5 seconds for a 10 km radius at standard resolution.
- **SC-007**: Operator can identify at a glance (within 3 seconds) whether a target location is within effective RF range by looking at the map overlay.

## Assumptions

- The HackRF One is the primary SDR device. Other SDR hardware (RTL-SDR, USRP) is out of scope for this feature but the propagation model should be device-agnostic.
- The USRP B205-mini is a full-duplex transceiver capable of actual RF transmission (unlike the HackRF in sweep/monitor mode). When the B205-mini is the active device and transmitting, the range overlay should use real TX power from the device configuration rather than preset estimates. Full B205-mini integration depends on the future SoapySDR device management layer (spec 021+), which will provide a unified frequency and TX power API across all connected SDRs.
- Default TX power for HackRF One bare is assumed to be ~10 dBm (10 mW). With amplifier enabled, ~20 dBm (100 mW). These are approximations — actual power varies by frequency.
- Default receiver sensitivity threshold is assumed to be -90 dBm (a reasonable baseline for most receivers in the field).
- Default antenna gain is 0 dBi (omnidirectional, which the HackRF stock antenna approximates).
- Default antenna height AGL is 1.5m (handheld operator). Presets should include common heights: 1.5m (handheld), 3m (vehicle-mounted), 10m (portable mast), 30m (tower/building roof). Antenna height does not affect the Friis free-space calculation (P1/P2) but is critical for terrain-aware viewshed computation (P3) — inspired by TAKX's "Default Sensor Elevation" parameter in their Line of Sight plugin.
- The free-space path loss model is a deliberate simplification. Real-world range will always be shorter due to atmospheric absorption, multipath, foliage, buildings, etc. The overlay is an upper-bound estimate.
- Terrain-aware LOS (P3) will use an external elevation API or locally cached terrain tiles. The specific elevation data source is an implementation decision.
- The existing concentric range band rendering pattern and GeoJSON FillLayer pipeline are the intended rendering approach.
