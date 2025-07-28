# Data Models

## Signal

**Purpose:** Core RF signal detection data from hardware devices

**Key Attributes:**
- id: string - Unique signal identifier (UUID)
- timestamp: Date - Detection time with millisecond precision
- frequency: number - Signal frequency in Hz
- rssi: number - Received Signal Strength Indicator in dBm
- latitude: number - GPS latitude of detection
- longitude: number - GPS longitude of detection
- altitude: number - Altitude in meters
- droneId: string - Source drone identifier
- modulation: string - Signal modulation type (AM, FM, etc.)
- bandwidth: number - Signal bandwidth in Hz
- metadata: JSON - Additional device-specific data

### TypeScript Interface

```typescript
interface Signal {
  id: string;
  timestamp: Date;
  frequency: number;
  rssi: number;
  latitude: number;
  longitude: number;
  altitude: number;
  droneId: string;
  modulation?: string;
  bandwidth?: number;
  metadata?: Record<string, any>;
}
```

### Relationships

- Many-to-one with Drone
- Many-to-one with Mission
- Many-to-many with SignalClassification

## Mission

**Purpose:** Flight mission planning and execution tracking

**Key Attributes:**
- id: string - Mission identifier
- name: string - Human-readable mission name
- type: MissionType - sweep, track, patrol
- status: MissionStatus - planned, active, completed, aborted
- startTime: Date - Mission start time
- endTime: Date - Mission end time
- area: GeoJSON - Mission area polygon
- parameters: JSON - Mission-specific parameters
- droneId: string - Assigned drone

### TypeScript Interface

```typescript
interface Mission {
  id: string;
  name: string;
  type: 'sweep' | 'track' | 'patrol';
  status: 'planned' | 'active' | 'completed' | 'aborted';
  startTime: Date;
  endTime?: Date;
  area: GeoJSON.Polygon;
  parameters: {
    altitude?: number;
    speed?: number;
    sweepPattern?: string;
    targetFrequencies?: number[];
  };
  droneId: string;
}
```

### Relationships

- One-to-many with Signal
- Many-to-one with Drone
- One-to-many with Waypoint

## Drone

**Purpose:** Drone platform information and status

**Key Attributes:**
- id: string - Drone identifier
- name: string - Drone name/callsign
- type: string - Drone model/type
- status: DroneStatus - offline, ready, flying, error
- lastTelemetry: JSON - Latest telemetry data
- capabilities: string[] - Available sensors/radios
- homeLocation: Point - Home/launch location

### TypeScript Interface

```typescript
interface Drone {
  id: string;
  name: string;
  type: string;
  status: 'offline' | 'ready' | 'flying' | 'error';
  lastTelemetry: {
    latitude: number;
    longitude: number;
    altitude: number;
    heading: number;
    speed: number;
    battery: number;
    timestamp: Date;
  };
  capabilities: string[];
  homeLocation: {
    latitude: number;
    longitude: number;
  };
}
```

### Relationships

- One-to-many with Mission
- One-to-many with Signal
- One-to-many with HardwareDevice

## SweepSession

**Purpose:** Groups signals from a specific sweep operation

**Key Attributes:**
- id: string - Session identifier
- startTime: Date - Sweep start time
- endTime: Date - Sweep end time
- frequencyStart: number - Starting frequency in Hz
- frequencyEnd: number - Ending frequency in Hz
- stepSize: number - Frequency step size
- antennaGain: number - Antenna gain in dBi
- signalCount: number - Total signals detected

### TypeScript Interface

```typescript
interface SweepSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  frequencyStart: number;
  frequencyEnd: number;
  stepSize: number;
  antennaGain: number;
  signalCount: number;
  droneId: string;
  missionId?: string;
}
```

### Relationships

- One-to-many with Signal
- Many-to-one with Mission
- Many-to-one with Drone

## CellTower

**Purpose:** Cellular tower identification and tracking

**Key Attributes:**
- id: string - Tower identifier
- mcc: string - Mobile Country Code
- mnc: string - Mobile Network Code
- lac: number - Location Area Code
- cellId: number - Cell ID
- latitude: number - Estimated latitude
- longitude: number - Estimated longitude
- signalStrength: number - Average RSSI
- lastSeen: Date - Last detection time

### TypeScript Interface

```typescript
interface CellTower {
  id: string;
  mcc: string;
  mnc: string;
  lac: number;
  cellId: number;
  latitude?: number;
  longitude?: number;
  signalStrength: number;
  lastSeen: Date;
  technology: '2G' | '3G' | '4G' | '5G';
}
```

### Relationships

- One-to-many with CellularSignal
- Many-to-many with Mission (towers seen during mission)
