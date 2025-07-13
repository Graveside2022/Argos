# Drone-Specific Features Design for ArgosFinal

## Overview

This document outlines the design for integrating drone-specific features into the ArgosFinal SDR & Network Analysis Console. The features will enhance the existing tactical map capabilities with drone flight operations, altitude-based signal analysis, and mission planning tools.

## Architecture Integration

### Core Components Extension

1. **Existing Components to Extend:**
    - `/tactical-map` route - Add drone layer controls
    - `signalDatabase.ts` - Add flight path and altitude indexing
    - `dataAccessLayer.ts` - Add drone mission storage methods
    - WebSocket services - Add MAVLink/drone telemetry support

2. **New Components to Create:**
    - `/drone-ops` route - Dedicated drone operations dashboard
    - Drone-specific Svelte components
    - Flight data services
    - Offline map tile management

## Feature Specifications

### 1. Flight Path Recording and Visualization

#### Component: `FlightPathVisualization.svelte`

**Location:** `/src/lib/components/drone/`

**Features:**

- Real-time flight path rendering with altitude gradient coloring
- 3D visualization option using altitude data
- Signal strength overlay along flight path
- Playback controls for historical flights
- Export to KML/GPX formats

**Data Structure:**

```typescript
interface FlightPath {
	id: string;
	missionId: string;
	points: FlightPoint[];
	signalCaptures: SignalCapture[];
	metadata: {
		drone: string;
		pilot: string;
		weather: WeatherConditions;
		notes: string;
	};
}

interface FlightPoint {
	timestamp: number;
	lat: number;
	lon: number;
	altitude: number; // meters AGL
	heading: number;
	speed: number;
	signalStrength?: number;
	battery?: number;
}

interface SignalCapture {
	flightPointId: string;
	signals: SignalMarker[];
	averagePower: number;
	strongestSignal: SignalMarker;
}
```

### 2. Altitude-Based Signal Layers

#### Component: `AltitudeSignalLayers.svelte`

**Location:** `/src/lib/components/drone/`

**Features:**

- Stratified signal visualization by altitude bands
- Heat density maps at different altitudes
- 3D signal propagation modeling
- Altitude filter controls (0-400m AGL)
- Signal strength vs altitude analysis

**Altitude Bands:**

- Ground Level: 0-10m
- Low Altitude: 10-50m
- Medium Altitude: 50-150m
- High Altitude: 150-400m

**Visualization Modes:**

- Stacked layers view
- Single altitude slice
- 3D volumetric rendering
- Cross-section view

### 3. Mission Planning Tools

#### Component: `MissionPlanner.svelte`

**Location:** `/src/lib/components/drone/`

**Features:**

- Interactive waypoint placement on map
- Automated survey pattern generation
- Signal detection mission templates
- Geofence definition
- No-fly zone integration
- Mission duration estimation
- Battery consumption calculator

**Mission Types:**

```typescript
interface DroneMission {
	id: string;
	name: string;
	type: 'survey' | 'patrol' | 'monitoring' | 'mapping';
	waypoints: Waypoint[];
	areaOfInterest?: Polygon;
	parameters: {
		altitude: number;
		speed: number;
		scanInterval: number;
		signalThreshold: number;
	};
	constraints: {
		maxDuration: number;
		geofence: Polygon;
		noFlyZones: Polygon[];
		minAltitude: number;
		maxAltitude: number;
	};
}

interface Waypoint {
	lat: number;
	lon: number;
	altitude: number;
	actions: WaypointAction[];
}

interface WaypointAction {
	type: 'hover' | 'scan' | 'photo' | 'rtl';
	duration?: number;
	parameters?: Record<string, any>;
}
```

### 4. Real-time Statistics Dashboard

#### Component: `DroneStatsDashboard.svelte`

**Location:** `/src/lib/components/drone/`

**Features:**

- Live telemetry display
- Signal detection statistics
- Coverage area calculation
- Mission progress tracking
- Environmental conditions
- Battery and range estimation

**Statistics Tracked:**

```typescript
interface DroneStatistics {
	flight: {
		duration: number;
		distance: number;
		maxAltitude: number;
		avgSpeed: number;
		batteryUsed: number;
	};
	signals: {
		totalDetected: number;
		uniqueDevices: number;
		byAltitude: Record<string, number>;
		byFrequency: Record<string, number>;
		strongestSignal: SignalMarker;
	};
	coverage: {
		area: number; // square meters
		efficiency: number; // percentage
		gaps: Polygon[];
	};
}
```

### 5. Offline Map Support

#### Component: `OfflineMapManager.svelte`

**Location:** `/src/lib/components/map/`

**Features:**

- Pre-download map tiles for mission areas
- Automatic tile caching during flights
- Storage management UI
- Multiple map sources support
- Elevation data integration

**Implementation:**

```typescript
interface OfflineMapConfig {
	sources: MapSource[];
	storage: {
		maxSize: number; // MB
		currentSize: number;
		tileCount: number;
	};
	regions: OfflineRegion[];
}

interface OfflineRegion {
	id: string;
	name: string;
	bounds: LatLngBounds;
	zoomLevels: [number, number];
	lastUpdated: number;
	tileCount: number;
	size: number; // bytes
}

interface MapSource {
	name: string;
	url: string;
	type: 'osm' | 'satellite' | 'terrain';
	maxZoom: number;
	attribution: string;
}
```

## Database Schema Extensions

### New Tables for SQLite Backend

```sql
-- Flight missions table
CREATE TABLE drone_missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  pilot_id TEXT,
  drone_id TEXT,
  parameters JSON,
  statistics JSON,
  FOREIGN KEY (pilot_id) REFERENCES pilots(id),
  FOREIGN KEY (drone_id) REFERENCES drones(id)
);

-- Flight paths table
CREATE TABLE flight_paths (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  altitude REAL NOT NULL,
  heading REAL,
  speed REAL,
  battery_percent INTEGER,
  signal_count INTEGER,
  FOREIGN KEY (mission_id) REFERENCES drone_missions(id)
);

-- Create spatial index for flight paths
CREATE INDEX idx_flight_paths_spatial ON flight_paths(lat, lon);
CREATE INDEX idx_flight_paths_altitude ON flight_paths(altitude);
CREATE INDEX idx_flight_paths_mission ON flight_paths(mission_id);

-- Altitude-based signal captures
CREATE TABLE altitude_signals (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  flight_path_id TEXT,
  altitude REAL NOT NULL,
  altitude_band TEXT NOT NULL,
  capture_angle REAL,
  FOREIGN KEY (signal_id) REFERENCES signals(id),
  FOREIGN KEY (flight_path_id) REFERENCES flight_paths(id)
);

-- Offline map tiles
CREATE TABLE offline_tiles (
  z INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  source TEXT NOT NULL,
  data BLOB NOT NULL,
  last_accessed INTEGER NOT NULL,
  size INTEGER NOT NULL,
  PRIMARY KEY (z, x, y, source)
);
```

### IndexedDB Extensions for Client

```typescript
// Add to existing signalDatabase.ts
interface DroneDB extends IDBDatabase {
	// Existing object stores...

	// New object stores
	missions: {
		key: string;
		value: DroneMission;
		indexes: {
			'by-date': number;
			'by-type': string;
			'by-status': string;
		};
	};

	flightPaths: {
		key: string;
		value: FlightPoint;
		indexes: {
			'by-mission': string;
			'by-timestamp': number;
			'by-altitude': number;
			spatial: [number, number]; // [lat, lon]
		};
	};

	offlineTiles: {
		key: string; // "z/x/y/source"
		value: {
			data: ArrayBuffer;
			timestamp: number;
		};
	};
}
```

## WebSocket Integration

### MAVLink Protocol Support

```typescript
// New WebSocket service for drone telemetry
export class DroneWebSocketService extends BaseWebSocketService {
	private mavlinkParser: MAVLinkParser;

	constructor() {
		super('ws://localhost:14550/mavlink'); // MAVLink over WebSocket
		this.mavlinkParser = new MAVLinkParser();
	}

	protected handleMessage(data: ArrayBuffer): void {
		const messages = this.mavlinkParser.parse(data);
		messages.forEach((msg) => {
			switch (msg.msgId) {
				case MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
					this.updateDronePosition(msg);
					break;
				case MAVLINK_MSG_ID_ATTITUDE:
					this.updateDroneAttitude(msg);
					break;
				case MAVLINK_MSG_ID_BATTERY_STATUS:
					this.updateBatteryStatus(msg);
					break;
			}
		});
	}
}
```

## UI/UX Enhancements

### Drone Control Panel

- Collapsible side panel in tactical map
- Quick access mission controls
- Altitude slider for layer filtering
- Flight mode indicators
- Emergency RTL button

### Map Interactions

- Long press to add waypoint
- Drag waypoints to adjust
- Pinch to zoom with altitude adjustment
- Swipe up/down for altitude layers
- Double-tap for point information

### Visual Indicators

- Animated drone icon with heading
- Altitude ribbon on flight path
- Signal detection animations
- Coverage area shading
- No-fly zone hatching

## Performance Optimizations

### Data Management

- Chunked loading for long flight paths
- Level-of-detail for altitude layers
- Tile pre-fetching for offline maps
- Signal aggregation at low zoom levels
- Automatic old data cleanup

### Rendering Optimizations

- WebGL for 3D visualizations
- Canvas for flight paths
- CSS transforms for smooth animations
- RequestAnimationFrame scheduling
- Virtual scrolling for mission lists

## Integration Points

### With Existing Features

1. **HackRF Integration**
    - Trigger sweeps at waypoints
    - Adjust sweep parameters by altitude
    - Correlate signal strength with position

2. **Kismet Integration**
    - Enhanced device tracking with altitude
    - 3D WiFi coverage mapping
    - Drone as mobile sensor platform

3. **GPS/TAK Integration**
    - Share drone position to TAK
    - Import TAK markers as waypoints
    - Collaborative mission planning

### API Endpoints

```typescript
// New API routes needed
POST   /api/drone/missions          // Create mission
GET    /api/drone/missions/:id      // Get mission details
PUT    /api/drone/missions/:id      // Update mission
DELETE /api/drone/missions/:id      // Delete mission
POST   /api/drone/missions/:id/start // Start mission
POST   /api/drone/missions/:id/stop  // Stop mission

GET    /api/drone/telemetry         // Live telemetry stream
POST   /api/drone/command           // Send drone command

GET    /api/drone/flights           // List flights
GET    /api/drone/flights/:id       // Get flight details
GET    /api/drone/flights/:id/path  // Get flight path
GET    /api/drone/flights/:id/signals // Get captured signals

POST   /api/maps/offline/download   // Download map tiles
GET    /api/maps/offline/regions    // List offline regions
DELETE /api/maps/offline/regions/:id // Delete offline region
```

## Security Considerations

1. **Flight Data Protection**
    - Encrypt stored flight paths
    - Require authentication for missions
    - Audit log for drone operations

2. **Geofence Enforcement**
    - Client and server validation
    - Real-time boundary checking
    - Automatic RTL on breach

3. **Data Privacy**
    - Anonymize captured signals
    - Configurable data retention
    - Export restrictions

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)

- Database schema implementation
- Basic flight path recording
- Simple visualization on tactical map
- Offline tile storage system

### Phase 2: Mission Planning (Week 3-4)

- Mission planner UI
- Waypoint management
- Survey pattern generation
- Basic statistics dashboard

### Phase 3: Advanced Features (Week 5-6)

- Altitude layer visualization
- 3D flight path rendering
- Signal correlation analysis
- MAVLink integration

### Phase 4: Polish & Optimization (Week 7-8)

- Performance optimization
- UI/UX refinements
- Comprehensive testing
- Documentation

## Testing Strategy

### Unit Tests

- Flight path calculations
- Mission validation logic
- Offline tile management
- Signal correlation algorithms

### Integration Tests

- WebSocket communication
- Database operations
- API endpoints
- Map rendering

### Field Tests

- Real drone flights
- Signal detection accuracy
- Offline operation
- Battery life impact

## Conclusion

These drone-specific features will transform ArgosFinal into a comprehensive aerial RF survey platform. The modular design ensures easy integration with existing components while providing powerful new capabilities for drone operators. The emphasis on offline operation and real-time visualization makes it ideal for field operations where internet connectivity may be limited.
