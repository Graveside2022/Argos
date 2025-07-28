# Epic 1: Foundation & Drone Integration

Establish the foundational infrastructure for drone telemetry integration, creating the bridge between the aerial platform and existing Argos systems. This epic delivers basic drone connectivity, position tracking, and data recording capabilities that all future features will build upon.

## Story 1.1: Drone Telemetry Service

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

## Story 1.2: Database Schema Extension

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

## Story 1.3: Telemetry API Endpoints

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

## Story 1.4: Basic Drone Status UI

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
