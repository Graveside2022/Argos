# Feature Specification: Terrain-Aware Viewshed Analysis

**Feature Branch**: `022-terrain-viewshed`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "Replace Friis free-space RF range overlay with ATAK-style terrain-aware viewshed analysis using offline DTED Level 0 elevation tiles"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Terrain-Aware Line of Sight Overlay (Priority: P1)

An operator deployed at a field location wants to see which surrounding terrain is visible from their position and which areas are blocked by hills, ridges, or other terrain features. When the operator enables the Line of Sight overlay in Map Settings, a colored viewshed appears on the map centered on their GPS position — green areas indicate clear line of sight, red areas indicate terrain obstruction. This replaces the previous circular RF range rings, which assumed flat terrain and gave an unrealistically optimistic picture.

**Why this priority**: The circular Friis overlay gives a false sense of coverage in hilly or mountainous terrain. An operator relying on it could position equipment in a location where terrain blocks the signal path. Terrain-aware viewshed is the single most important upgrade because it tells the operator the truth about what they can actually see and reach from their current position.

**Independent Test**: Enable the Line of Sight overlay while at a location near terrain variation. Verify that the overlay shows green in directions with clear line of sight and red in directions where hills or ridges block the view. Adjust the Height Above Ground slider — verify the visible area expands as height increases. Adjust the radius — verify the overlay extends or contracts accordingly.

**Acceptance Scenarios**:

1. **Given** DTED elevation tiles are loaded on the device and the operator has a GPS fix, **When** the operator enables the Line of Sight overlay, **Then** a viewshed appears on the map centered on the operator's position showing green (visible) and red (obstructed) areas based on terrain elevation.
2. **Given** the viewshed is active, **When** the operator increases the Height Above Ground value, **Then** the visible (green) area expands because a higher observation point sees over more terrain obstructions.
3. **Given** the viewshed is active, **When** the operator changes the radius, **Then** the viewshed recalculates to cover the new area and the overlay updates within 3 seconds.
4. **Given** the viewshed is active, **When** the operator moves to a new GPS position (delta > 50 meters), **Then** the viewshed recalculates for the new position automatically.
5. **Given** the previous Friis circular ring overlay, **When** this feature is deployed, **Then** the concentric ring bands are fully replaced by the terrain-aware viewshed — no circular rings remain.

---

### User Story 2 - DTED Tile Management (Priority: P1)

The operator or administrator needs to load DTED Level 0 elevation data onto the device so the viewshed analysis has terrain data to work with. They receive DTED tiles as a .zip archive, place it on the device, and the system extracts and indexes the tiles. The operator can see which geographic areas have elevation coverage and which do not.

**Why this priority**: Without elevation data, the viewshed cannot function. Tile loading is a prerequisite for the core feature and must work reliably with the standard DTED directory structure that military systems produce.

**Independent Test**: Place a DTED .zip file in the designated directory on the device. Verify the system detects, extracts, and indexes the tiles. Navigate the map to the covered area — confirm the viewshed overlay works. Navigate outside the covered area — confirm a clear indication that no elevation data is available.

**Acceptance Scenarios**:

1. **Given** a .zip archive containing DTED Level 0 tiles in standard directory structure (e.g., `w117/n34.dt0`), **When** the file is placed in the designated DTED directory on the device, **Then** the system extracts and indexes the tiles for use by the viewshed.
2. **Given** DTED tiles are loaded, **When** the operator enables the viewshed in an area covered by the tiles, **Then** the viewshed renders correctly using the elevation data.
3. **Given** the operator enables the viewshed in an area with no DTED coverage, **When** the viewshed attempts to calculate, **Then** the system displays a "No elevation data available for this area" message instead of rendering an incorrect overlay.
4. **Given** DTED tiles are loaded, **When** the operator opens the Line of Sight settings, **Then** they can see which geographic region has elevation coverage (tile count or bounding box).

---

### User Story 3 - Viewshed Appearance Controls (Priority: P2)

The operator wants to adjust how the viewshed looks on the map — controlling the opacity of visible (green) and obstructed (red) areas independently, similar to ATAK's seen/unseen sliders. This lets operators tune the overlay so it provides useful information without obscuring the underlying map imagery.

**Why this priority**: In different map contexts (satellite imagery, tactical vector maps), different opacity levels are needed. If the overlay is too opaque it hides the map; too transparent and the operator misses obstructed areas. Independent opacity control is how ATAK handles this and operators are already trained on it.

**Independent Test**: Enable the viewshed. Adjust the "Visible" opacity slider — verify the green areas become more or less transparent. Adjust the "Obstructed" opacity slider — verify the red areas change independently. Toggle "Adjust Together" — verify both sliders move in sync.

**Acceptance Scenarios**:

1. **Given** the viewshed is active, **When** the operator adjusts the "Visible" opacity slider, **Then** the green (line-of-sight) areas change opacity without affecting the red (obstructed) areas.
2. **Given** the viewshed is active, **When** the operator adjusts the "Obstructed" opacity slider, **Then** the red areas change opacity without affecting the green areas.
3. **Given** "Adjust Together" is enabled, **When** the operator moves either slider, **Then** both sliders move proportionally.
4. **Given** the operator adjusts opacity settings, **When** they close and reopen the Line of Sight panel, **Then** the opacity settings persist.

---

### User Story 4 - RF-Aware Viewshed with Hardware Presets (Priority: P2)

The operator wants the viewshed to incorporate their RF hardware parameters — not just terrain visibility, but whether their signal can actually reach visible areas given their transmit power, frequency, and antenna configuration. The existing hardware presets (HackRF Bare, HackRF + Amplifier, HackRF + Directional, Custom) remain available, and the viewshed clips its maximum radius based on the calculated RF range for the active configuration.

**Why this priority**: Pure terrain viewshed shows what's geometrically visible, but doesn't account for signal attenuation. An area may have clear line of sight but be beyond the effective RF range of the equipment. Combining terrain visibility with RF range limits gives the operator the most accurate picture of their actual coverage.

**Independent Test**: Enable the viewshed with HackRF Bare preset at 2.4 GHz. Note the viewshed radius. Switch to HackRF + Amplifier — verify the radius expands. Switch to HackRF + Directional — verify the radius changes again. Set the radius to exceed the calculated RF range — verify the viewshed clips to the RF limit.

**Acceptance Scenarios**:

1. **Given** the viewshed is active with a hardware preset selected, **When** the preset specifies TX power and antenna gain, **Then** the viewshed maximum radius is limited by the calculated free-space RF range for those parameters and the active frequency.
2. **Given** the operator switches hardware presets, **When** the new preset has different TX power or gain, **Then** the viewshed radius adjusts and recalculates.
3. **Given** the operator sets the frequency source to "Auto" and the SDR is tuned to a frequency, **When** the frequency changes, **Then** the viewshed radius adjusts because RF range varies with frequency.
4. **Given** the operator sets a manual radius that exceeds the calculated RF range, **When** the viewshed renders, **Then** the radius is capped at the RF range limit and an indicator shows the cap is active.

---

### Edge Cases

- What happens when GPS is lost while the viewshed is active? The overlay should freeze at the last known position for 30 seconds (matching current behavior), then clear with a "GPS signal lost" indicator.
- What happens when the operator is at the edge of DTED tile coverage? The viewshed should render for the area that has elevation data and show a clear boundary where data ends, with uncovered sectors either omitted or marked distinctly.
- What happens when the DTED .zip contains corrupted or non-standard files? The system should skip invalid tiles, log the errors, and use whatever valid tiles are available. The operator should see which tiles failed to load.
- What happens when the viewshed calculation takes longer than expected on a large radius? A loading indicator should appear, and the operator should be able to reduce the radius. The previous viewshed should remain visible until the new calculation completes.
- What happens when the operator zooms out far enough that the viewshed is very small on screen? The viewshed should remain rendered but the system should not waste resources recalculating at high resolution when it occupies only a few pixels.
- What happens when the operator enables the viewshed with no DTED tiles loaded at all? The system should show a clear message: "No elevation data loaded — add DTED tiles to enable terrain analysis" with guidance on where to place the files.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST replace the existing concentric Friis free-space RF range rings with a terrain-aware viewshed overlay on the map.
- **FR-002**: System MUST calculate terrain visibility using a line-of-sight algorithm against elevation data from the operator's GPS position at a configurable height above ground level.
- **FR-003**: System MUST render visible (line-of-sight) areas in green and obstructed (terrain-blocked) areas in red on the map overlay, centered on the observation point.
- **FR-004**: System MUST support loading DTED Level 0 elevation tiles from a .zip archive placed on the device, following the standard DTED directory structure (`<westing>/<northing>.dt0`).
- **FR-005**: System MUST provide a configurable Height Above Ground control (range: 0.5 to 100 meters, default: 2 meters) representing the observer's elevation above the terrain surface.
- **FR-006**: System MUST provide a configurable viewshed radius (range: 100 meters to 50 kilometers) that limits how far the analysis extends.
- **FR-007**: System MUST provide independent opacity sliders for visible (green) and obstructed (red) areas, with an "Adjust Together" toggle to link them.
- **FR-008**: System MUST recalculate the viewshed when the operator's GPS position changes by more than 50 meters, completing the recalculation within 3 seconds for a 5 km radius.
- **FR-009**: System MUST retain the existing hardware presets (HackRF Bare, HackRF + Amplifier, HackRF + Directional, Custom) and use the calculated RF range to cap the viewshed maximum radius.
- **FR-010**: System MUST retain the frequency source selector (Auto from SDR / Manual entry) and recalculate when frequency changes.
- **FR-011**: System MUST display a clear message when no DTED elevation data is available for the current area, preventing the display of an incorrect overlay.
- **FR-012**: System MUST show the operator which geographic region has loaded elevation coverage (tile count or bounding box).
- **FR-013**: System MUST persist all viewshed settings (height, radius, opacity, preset, frequency source) across sessions.
- **FR-014**: System MUST display the computed maximum range and active propagation model in the Line of Sight panel.
- **FR-015**: System MUST show a loading indicator during viewshed calculation for radii that take more than 500 milliseconds to compute.

### Key Entities

- **Elevation Tile**: A DTED Level 0 tile covering a 1-degree x 1-degree geographic cell, containing a grid of terrain elevation values in meters above mean sea level. Indexed by westing/northing coordinates.
- **Viewshed Result**: The computed output of the terrain analysis — a grid of cells, each classified as visible (line-of-sight) or obstructed (terrain-blocked), with the observation point's coordinates, height above ground, and radius as input parameters.
- **Observation Point**: The location from which the viewshed is calculated — typically the operator's GPS position, at a specified height above the terrain surface.
- **RF Range Profile**: The existing hardware configuration (TX power, antenna gain, sensitivity, frequency) used to cap the viewshed radius at the maximum effective RF range.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Operators can see terrain-aware line-of-sight coverage on the map within 3 seconds of enabling the overlay (for a 5 km radius).
- **SC-002**: The viewshed accurately reflects terrain obstruction — areas behind ridges and hills are marked red, areas with clear sightlines are marked green, matching what an observer would actually see from that position and height.
- **SC-003**: The viewshed recalculates within 3 seconds when the operator moves more than 50 meters or changes any parameter (height, radius, preset, frequency).
- **SC-004**: DTED .zip files are extracted and indexed within 30 seconds of being placed on the device (for a typical regional dataset of 20-50 tiles).
- **SC-005**: Viewshed computation for a 5 km radius uses less than 200 MB of RAM and less than 50% CPU on the target hardware.
- **SC-006**: Operators can independently adjust visible and obstructed area opacity from 0% to 100%.
- **SC-007**: All previous Line of Sight panel functionality (hardware presets, frequency source, computed range readout) remains accessible with no regression.
- **SC-008**: The system clearly communicates when no elevation data is available, preventing operators from assuming flat terrain where data is simply missing.

## Assumptions

- DTED Level 0 tiles provide approximately 900-meter horizontal resolution (30 arc-second posts). This is sufficient for viewshed analysis at ranges of 1-50 km but will not capture small terrain features like individual buildings or berms. Higher resolution DTED (Level 1 at ~90m, Level 2 at ~30m) may be supported in the future but is out of scope for this version.
- The operator will provide DTED tiles as a .zip archive. The standard DTED directory structure (`<westing>/<northing>.dt0`) is assumed, matching the format produced by FalconView, JMPS Map Data Manager, and ATAK export.
- The Raspberry Pi 5 with 8 GB RAM is the target platform. Viewshed computation must be efficient enough for near-real-time use on this hardware.
- The viewshed replaces the Friis concentric rings entirely. The existing RF propagation math is retained only for computing the maximum effective range (to cap the viewshed radius) — it no longer drives the visual overlay.
- DTED tiles are stored on the local NVMe SSD (500 GB), so disk I/O is not a bottleneck. A typical DTED Level 0 dataset for a region (e.g., the western US) might be 50-200 MB.
- The viewshed uses a raster grid approach — the map overlay is a grid of cells. Resolution adapts to the radius to keep cell count manageable (target: under 100,000 cells for performance).
- Height Above Ground defaults to 2 meters (approximate eye-level for a standing operator). This is the most common use case per ATAK conventions.
- The "Adjust Together" toggle for opacity sliders defaults to ON, matching ATAK behavior.
- Earth curvature and atmospheric refraction are not modeled in this version. At DTED Level 0 ranges (typically under 50 km), curvature effects are minimal but present. This may be added in a future iteration.
- The File Formats document confirms DTED storage at `/atak/DTED/` with westing/northing directory structure. Argos will use an analogous local path.
