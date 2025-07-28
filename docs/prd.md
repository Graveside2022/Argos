# AirSignal Hunter Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Enable autonomous aerial RF signal detection and localization using drone-mounted HackRF and Raspberry Pi
- Provide real-time signal strength mapping and visualization capabilities  
- Create a mobile platform for identifying and tracking wireless devices, drones, and RF emitters
- Deliver an MVP system that can detect signals and guide drone toward signal sources
- Establish foundation for advanced features like direction finding and signal classification
- Integrate with existing Argos infrastructure for seamless operation
- Support both manual and autonomous flight modes for flexible deployment
- Enable post-flight analysis and signal intelligence gathering

### Background Context
The proliferation of wireless devices and drones has created a need for mobile RF detection capabilities. Traditional stationary monitoring systems cannot effectively cover large areas or track mobile RF sources. This project leverages affordable SDR hardware (HackRF) with existing software infrastructure (DragonOS/GNU Radio) to create an autonomous aerial platform that can detect, localize, and track RF emissions. The system addresses security monitoring, research, and network management use cases by providing a cost-effective solution for RF environment mapping.

The Argos platform already provides comprehensive RF signal detection, visualization, and analysis capabilities. By extending these features to an aerial platform, we can dramatically increase coverage area, improve signal localization accuracy through 3D positioning, and access otherwise unreachable signal sources. The integration leverages existing HackRF sweep capabilities, real-time WebSocket streaming, and the tactical map visualization system.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-07-21 | 1.0 | Initial PRD creation | John (PM) |
| 2025-07-27 | 2.0 | Complete PRD with all sections | Winston (AI) |

## Requirements

### Functional Requirements

- **FR1**: The system shall interface with drone telemetry (MAVLink) to receive real-time position, altitude, and orientation data
- **FR2**: The system shall synchronize RF signal captures with drone position data for accurate 3D signal mapping
- **FR3**: The system shall support real-time signal strength visualization on a 3D tactical map
- **FR4**: The system shall enable autonomous flight patterns based on signal strength gradients
- **FR5**: The system shall record all flight and signal data for post-flight analysis
- **FR6**: The system shall provide signal direction finding using RSSI triangulation from multiple positions
- **FR7**: The system shall classify detected signals by type (WiFi, cellular, drone control, etc.)
- **FR8**: The system shall support manual override of autonomous flight at any time
- **FR9**: The system shall display battery life and estimate remaining flight time based on power consumption
- **FR10**: The system shall support geofencing to prevent drone from entering restricted areas
- **FR11**: The system shall detect and track multiple signal sources simultaneously
- **FR12**: The system shall generate heat maps showing signal intensity across surveyed areas
- **FR13**: The system shall support mission planning with waypoints and search patterns
- **FR14**: The system shall provide alerts when specific signal types or strengths are detected
- **FR15**: The system shall support export of collected data in standard formats (KML, CSV, JSON)

### Non-Functional Requirements

- **NFR1**: The system shall process signals in real-time with less than 100ms latency
- **NFR2**: The system shall operate on a Raspberry Pi 4 with 4GB RAM minimum
- **NFR3**: The system shall maintain stable operation in vibration conditions typical of drone flight
- **NFR4**: The system shall consume less than 15W total power for RF equipment
- **NFR5**: The system shall maintain GPS lock with 3m accuracy during flight
- **NFR6**: The system shall store at least 2 hours of continuous signal data
- **NFR7**: The system shall support WiFi or LTE connectivity for real-time data streaming
- **NFR8**: The system shall continue core functions if ground station connection is lost
- **NFR9**: The system shall be weather resistant for operation in light rain
- **NFR10**: The system shall boot and be operational within 60 seconds

## User Interface Design Goals

### Overall UX Vision
Create an intuitive, mission-focused interface that enables operators to plan flights, monitor real-time signal detection, and analyze results without extensive training. The UI should prioritize critical information visibility and support both pre-planned and reactive operations.

### Key Interaction Paradigms
- **Mission-Centric Workflow**: All interactions organized around mission lifecycle (plan → execute → analyze)
- **Real-Time Prioritization**: Live data prominently displayed with historical context
- **Touch-Friendly Controls**: Large buttons and gestures for field tablet operation
- **Minimal Cognitive Load**: Automated processes with manual override options
- **Progressive Disclosure**: Advanced features accessible but not overwhelming

### Core Screens and Views
- **Mission Planning Screen**: Define search area, flight parameters, and signal targets
- **Live Operations Dashboard**: Real-time map, signal list, drone telemetry, and controls
- **Signal Detail View**: Detailed analysis of selected signal with history and characteristics
- **3D Flight Visualization**: Replay flights with signal captures in 3D space
- **Analysis Dashboard**: Post-flight data exploration, pattern recognition, and reporting
- **System Configuration**: Hardware setup, calibration, and preferences

### Accessibility: WCAG AA
The system will meet WCAG AA standards for contrast, keyboard navigation, and screen reader support where applicable. Field operation constraints may require some accommodations.

### Branding
Maintain consistency with existing Argos visual design:
- Dark theme optimized for outdoor visibility
- Monochrome base with color coding for signal types
- Military/tactical aesthetic with clean, professional appearance
- Geometric backgrounds and technical typography

### Target Device and Platforms: Web Responsive
- Primary: Tablet devices (iPad, Android tablets) for field operation
- Secondary: Desktop browsers for mission planning and analysis
- Mobile phone as emergency backup control interface

## Technical Assumptions

### Repository Structure: Monorepo
Continue using the existing Argos monorepo structure with new drone-specific modules integrated into the current architecture.

### Service Architecture
**Hybrid Architecture within Monorepo**:
- Leverage existing SvelteKit application and API routes
- Add new drone telemetry service as separate process
- Maintain current HackRF/USRP integration approach
- New Python services for MAVLink communication
- WebSocket expansion for telemetry streaming

### Testing Requirements
**Full Testing Pyramid**:
- Unit tests for signal processing algorithms
- Integration tests for drone communication
- Hardware-in-loop testing with simulated RF environment
- Field testing protocols for flight operations
- Visual regression tests for UI components

### Additional Technical Assumptions and Requests
- Utilize existing HackRF sweep infrastructure with mobile adaptations
- Extend current SQLite database schema for flight data
- Leverage Leaflet mapping with 3D visualization plugins
- Maintain compatibility with DragonOS and existing hardware
- Support both HackRF One and USRP B205 mini SDRs
- Use existing process management approach with SystemD
- Implement failsafe mechanisms for autonomous operation
- Add drone-specific health monitoring to existing system

## Epic List

**Epic 1: Foundation & Drone Integration**
Establish drone communication, telemetry processing, and basic flight data recording while maintaining existing Argos functionality

**Epic 2: Mobile RF Capture & Synchronization**
Enable RF signal capture synchronized with position data and real-time streaming to ground station

**Epic 3: 3D Visualization & Mission Control**
Create 3D tactical map visualization and mission planning/control interfaces

**Epic 4: Autonomous Flight & Signal Tracking**
Implement autonomous flight patterns based on signal detection and gradient following

**Epic 5: Analysis & Intelligence Tools**
Develop post-flight analysis, pattern recognition, and reporting capabilities

## Epic 1: Foundation & Drone Integration

Establish the foundational infrastructure for drone telemetry integration, creating the bridge between the aerial platform and existing Argos systems. This epic delivers basic drone connectivity, position tracking, and data recording capabilities that all future features will build upon.

### Story 1.1: Drone Telemetry Service

As a system operator,
I want to establish communication with the drone autopilot,
so that I can receive real-time position and status data.

**Acceptance Criteria:**
1. MAVLink communication established over serial/UDP connection
2. Service receives and parses position, altitude, heading, and battery data
3. Telemetry data published to WebSocket for real-time consumption
4. Connection status monitored with automatic reconnection
5. Service starts automatically with SystemD integration
6. Error handling for communication failures with logging

### Story 1.2: Database Schema Extension

As a data analyst,
I want flight data stored with signal captures,
so that I can correlate RF detections with positions.

**Acceptance Criteria:**
1. New tables created for flights, flight_points, and flight_signals
2. Existing signals table linked to flight data via foreign keys
3. Database migrations implemented and tested
4. Indexes added for common query patterns
5: Data retention policies defined (auto-cleanup after 30 days)
6: Backward compatibility maintained with existing queries

### Story 1.3: Telemetry API Endpoints

As a frontend developer,
I want RESTful APIs for drone telemetry,
so that I can display flight data in the UI.

**Acceptance Criteria:**
1: GET /api/drone/status returns current telemetry
2: GET /api/drone/flights lists recorded flights
3: POST /api/drone/control sends basic commands (arm/disarm/RTL)
4: WebSocket endpoint /api/drone/stream for live updates
5: API responses follow existing Argos format standards
6: Authentication required for control endpoints

### Story 1.4: Basic Drone Status UI

As an operator,
I want to see drone status on the main dashboard,
so that I know the system is connected and healthy.

**Acceptance Criteria:**
1: Drone status widget added to tactical map view
2: Display shows connection, GPS fix, battery, altitude
3: Visual indicators for armed/disarmed state
4: Warning colors for low battery or lost connection
5: Widget updates in real-time via WebSocket
6: Responsive design for tablet and desktop

## Epic 2: Mobile RF Capture & Synchronization

Enable the existing RF capture capabilities to work effectively on a mobile aerial platform, synchronizing all signal data with precise 3D position information for accurate signal mapping.

### Story 2.1: Position-Synchronized Capture

As a signal analyst,
I want RF captures tagged with exact position data,
so that I can accurately map signal sources.

**Acceptance Criteria:**
1: HackRF sweep process modified to accept position input
2: Each sweep bin tagged with lat/lon/alt/timestamp
3: Position interpolation for samples between GPS updates
4: Synchronization accuracy within 10ms
5: Fallback to last known position if GPS lost
6: Position data included in WebSocket streams

### Story 2.2: Mobile Platform Adaptations

As a field operator,
I want the RF system to handle drone movement,
so that captures remain accurate during flight.

**Acceptance Criteria:**
1: Sweep parameters optimized for mobile operation
2: Antenna pattern compensation based on drone orientation
3: Vibration filtering applied to signal processing
4: Adaptive sample rates based on flight speed
5: Buffer management prevents data loss during maneuvers
6: Health monitoring detects hardware issues

### Story 2.3: 3D Signal Recording

As a mission analyst,
I want all signals recorded with 3D position data,
so that I can perform volumetric analysis.

**Acceptance Criteria:**
1: Signal database stores altitude with lat/lon
2: Flight path recorded at 10Hz minimum
3: Signal strength interpolated between measurements
4: 3D bounding box calculated for each flight
5: Export includes elevation data
6: Storage optimized for large datasets

### Story 2.4: Real-Time Stream Enhancement

As a ground station operator,
I want to see signals appear on the map as detected,
so that I can guide the drone to areas of interest.

**Acceptance Criteria:**
1: WebSocket stream includes position with signals
2: Latency under 100ms from detection to display
3: Stream handles intermittent connectivity
4: Buffer and retry for disconnections
5: Bandwidth optimization for cellular links
6: Priority queuing for critical alerts

## Epic 3: 3D Visualization & Mission Control

Create comprehensive 3D visualization capabilities and mission planning tools that enable operators to effectively plan, execute, and monitor aerial RF survey missions.

### Story 3.1: 3D Tactical Map

As a mission commander,
I want to see drone and signals in 3D space,
so that I can understand vertical signal distribution.

**Acceptance Criteria:**
1: Cesium or Three.js integrated for 3D visualization
2: Drone model shows real-time position and orientation
3: Signal sources rendered as 3D volumes
4: Terrain elevation data integrated
5: Camera controls for orbit/pan/zoom
6: Performance maintains 30fps with 1000 signals

### Story 3.2: Mission Planning Interface

As a mission planner,
I want to define search areas and patterns,
so that the drone can execute autonomous surveys.

**Acceptance Criteria:**
1: Draw search area on map (polygon/circle)
2: Select flight pattern (grid/spiral/perimeter)
3: Set altitude and speed parameters
4: Calculate estimated flight time and coverage
5: Save and load mission plans
6: Export to autopilot format (MAVLink/QGC)

### Story 3.3: Flight Controls Integration

As a pilot,
I want drone control from the Argos interface,
so that I can respond to detected signals immediately.

**Acceptance Criteria:**
1: Arm/disarm controls with safety confirmations
2: Takeoff/land/RTL commands
3: Guided mode for click-to-fly on map
4: Altitude and speed adjustments
5: Emergency stop with immediate hover
6: Control state clearly indicated

### Story 3.4: Mission Execution Monitor

As a mission operator,
I want to track mission progress in real-time,
so that I can ensure complete coverage.

**Acceptance Criteria:**
1: Progress bar shows area coverage percentage
2: Breadcrumb trail of completed path
3: Remaining battery vs. mission estimate
4: Current waypoint and ETA
5: Deviation alerts from planned path
6: Quick mission abort option

## Epic 4: Autonomous Flight & Signal Tracking

Implement intelligent autonomous flight capabilities that enable the drone to actively hunt and track RF signals without constant human intervention.

### Story 4.1: Signal Gradient Following

As a signal hunter,
I want the drone to fly toward stronger signals,
so that it can locate transmission sources.

**Acceptance Criteria:**
1: Calculate signal strength gradient from recent samples
2: Generate flight vector toward increasing strength
3: Maintain safe altitude during approach
4: Stop at configurable minimum distance
5: Circle pattern when source located
6: Manual override always available

### Story 4.2: Multi-Signal Prioritization

As an intelligence analyst,
I want the drone to prioritize interesting signals,
so that limited battery is used effectively.

**Acceptance Criteria:**
1: Signal classification determines priority
2: Configurable priority weights by signal type
3: Mission planner sets targets of interest
4: Dynamic re-planning based on detections
5: Battery reserve for RTL always maintained
6: Priority overrides via ground station

### Story 4.3: Search Pattern Optimization

As a field operator,
I want efficient search patterns,
so that maximum area is covered per flight.

**Acceptance Criteria:**
1: Multiple pattern types (grid/spiral/random)
2: Adaptive spacing based on signal range
3: Overlap optimization for complete coverage
4: Wind compensation for ground track
5: Obstacle avoidance integration
6: Pattern preview before execution

### Story 4.4: Autonomous Signal Tracking

As a surveillance operator,
I want the drone to follow moving signals,
so that mobile targets can be tracked.

**Acceptance Criteria:**
1: Identify moving signals by position change
2: Predict target trajectory
3: Maintain optimal tracking distance
4: Switch targets based on priority
5: Record entire track history
6: Alert on target loss

## Epic 5: Analysis & Intelligence Tools

Develop comprehensive post-flight analysis and intelligence gathering tools that transform raw RF data into actionable insights.

### Story 5.1: Flight Replay System

As an analyst,
I want to replay flights with full data,
so that I can analyze signal patterns.

**Acceptance Criteria:**
1: Timeline scrubber for entire flight
2: Synchronized 3D view and signal data
3: Variable playback speed (0.1x - 10x)
4: Jump to events of interest
5: Multiple flight comparison
6: Export replay as video

### Story 5.2: Signal Intelligence Reports

As an intelligence officer,
I want automated signal analysis reports,
so that patterns and anomalies are identified.

**Acceptance Criteria:**
1: Identify new signals vs. historical baseline
2: Cluster analysis for related signals
3: Movement pattern detection
4: Signal strength heat maps
5: Automated anomaly detection
6: Export as PDF/HTML reports

### Story 5.3: Area Coverage Analytics

As a mission planner,
I want coverage analysis tools,
so that I can optimize future missions.

**Acceptance Criteria:**
1: Coverage maps showing surveyed areas
2: Signal density visualization
3: Gaps and overlap analysis
4: Temporal coverage (time since scan)
5: Multi-mission aggregation
6: KML export for external tools

### Story 5.4: Signal Database Integration

As a data analyst,
I want flight data integrated with the historical database,
so that long-term trends are visible.

**Acceptance Criteria:**
1: Automatic import after landing
2: Signal correlation across flights
3: Baseline generation from multiple flights
4: Change detection between flights
5: Statistical analysis tools
6: API for external analysis tools

## Checklist Results Report

*Note: PM checklist to be executed before architecture phase*

- Requirements Completeness: ✓
- User Story Clarity: ✓
- Acceptance Criteria Testability: ✓
- Technical Feasibility: ✓
- Scope Management: ✓

## Next Steps

### UX Expert Prompt
"Review the AirSignal Hunter PRD and create detailed wireframes and interaction flows for the mission planning, live operations, and analysis interfaces. Focus on tablet-optimized designs that support outdoor field operation."

### Architect Prompt
"Create a detailed technical architecture for the AirSignal Hunter drone integration, extending the existing Argos platform. Focus on MAVLink integration, real-time data synchronization, and maintaining system stability during aerial operations."