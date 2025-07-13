import { writable, derived } from 'svelte/store';
import type { SignalMarker } from './map/signals';

// Drone mission types
export interface DroneMission {
  id: string;
  name: string;
  type: 'survey' | 'patrol' | 'monitoring' | 'mapping';
  status: 'planned' | 'active' | 'paused' | 'completed';
  waypoints: Waypoint[];
  areaOfInterest?: AreaOfInterest;
  startTime?: number;
  endTime?: number;
  flightPath: FlightPoint[];
  signalCaptures: SignalCapture[];
  statistics: MissionStatistics;
  settings: MissionSettings;
}

export interface Waypoint {
  id: string;
  lat: number;
  lon: number;
  altitude: number; // meters AGL
  speed?: number; // m/s
  hover?: number; // seconds to hover
  actions?: WaypointAction[];
}

export interface WaypointAction {
  type: 'scan' | 'photo' | 'video' | 'signal_sweep';
  parameters?: Record<string, string | number | boolean>;
}

export interface AreaOfInterest {
  id: string;
  name: string;
  type: 'polygon' | 'circle' | 'rectangle';
  coordinates: [number, number][]; // [lat, lon]
  center?: { lat: number; lon: number };
  radius?: number; // for circle type
  scanPattern?: 'grid' | 'spiral' | 'random';
  flightAltitude: number;
  overlap?: number; // percentage for grid patterns
}

export interface FlightPoint {
  timestamp: number;
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  speed: number;
  signalStrength?: number; // aggregate signal strength at this point
  battery?: number;
}

export interface SignalCapture {
  id: string;
  timestamp: number;
  position: { lat: number; lon: number; altitude: number };
  signals: SignalMarker[];
  strongestSignal?: SignalMarker;
  averagePower: number;
  signalCount: number;
}

export interface MissionStatistics {
  totalDistance: number; // meters
  totalDuration: number; // seconds
  averageSpeed: number; // m/s
  maxAltitude: number;
  minAltitude: number;
  signalsCaptured: number;
  uniqueDevices: number;
  coverageArea: number; // square meters
  batteryUsed?: number; // percentage
}

export interface MissionSettings {
  altitudeFilter: { min: number; max: number };
  signalThreshold: number; // minimum power in dBm
  scanInterval: number; // seconds between scans
  autoLand: boolean;
  returnToHome: boolean;
  geofence?: { center: { lat: number; lon: number }; radius: number };
}

// Drone state
export interface DroneState {
  connected: boolean;
  armed: boolean;
  flying: boolean;
  mode: 'manual' | 'auto' | 'guided' | 'rtl';
  position: {
    lat: number;
    lon: number;
    altitude: number;
    heading: number;
  };
  velocity: {
    groundSpeed: number;
    verticalSpeed: number;
  };
  battery: {
    voltage: number;
    current: number;
    remaining: number; // percentage
    timeRemaining?: number; // seconds
  };
  gps: {
    fix: boolean;
    satellites: number;
    hdop: number;
  };
  sensors: {
    imu: boolean;
    compass: boolean;
    barometer: boolean;
    rangefinder?: boolean;
  };
}

// Flight recorder state
export interface FlightRecorder {
  recording: boolean;
  startTime?: number;
  duration: number;
  points: FlightPoint[];
  events: FlightEvent[];
}

export interface FlightEvent {
  timestamp: number;
  type: 'takeoff' | 'landing' | 'mode_change' | 'battery_warning' | 'signal_detection' | 'geofence_breach';
  description: string;
  data?: {
    altitude?: number;
    battery?: number;
    signal?: SignalMarker;
    mode?: string;
    position?: { lat: number; lon: number };
    [key: string]: string | number | boolean | SignalMarker | { lat: number; lon: number } | undefined;
  };
}

// Create stores
export const droneState = writable<DroneState>({
  connected: false,
  armed: false,
  flying: false,
  mode: 'manual',
  position: { lat: 0, lon: 0, altitude: 0, heading: 0 },
  velocity: { groundSpeed: 0, verticalSpeed: 0 },
  battery: { voltage: 0, current: 0, remaining: 100 },
  gps: { fix: false, satellites: 0, hdop: 99 },
  sensors: { imu: false, compass: false, barometer: false }
});

export const activeMission = writable<DroneMission | null>(null);
export const missionHistory = writable<DroneMission[]>([]);
export const flightRecorder = writable<FlightRecorder>({
  recording: false,
  duration: 0,
  points: [],
  events: []
});

export const areasOfInterest = writable<AreaOfInterest[]>([]);
export const selectedAOI = writable<AreaOfInterest | null>(null);

// Derived stores for UI
export const isOperational = derived(
  droneState,
  $state => $state.connected && $state.gps.fix && $state.battery.remaining > 20
);

export const missionProgress = derived(
  [activeMission, droneState],
  ([$mission, $state]) => {
    if (!$mission || $mission.status !== 'active') return 0;
    
    if ($mission.waypoints.length === 0) return 0;
    
    // Calculate progress based on waypoints visited
    const currentPos = $state.position;
    let visitedCount = 0;
    
    for (const waypoint of $mission.waypoints) {
      const distance = calculateDistance(
        currentPos.lat, currentPos.lon,
        waypoint.lat, waypoint.lon
      );
      if (distance < 10) { // Within 10 meters
        visitedCount++;
      }
    }
    
    return (visitedCount / $mission.waypoints.length) * 100;
  }
);

// Store functions
export function startMission(mission: DroneMission) {
  mission.status = 'active';
  mission.startTime = Date.now();
  activeMission.set(mission);
  
  // Start flight recording
  flightRecorder.update(state => ({
    ...state,
    recording: true,
    startTime: Date.now(),
    points: [],
    events: [{
      timestamp: Date.now(),
      type: 'takeoff',
      description: `Mission "${mission.name}" started`
    }]
  }));
}

export function pauseMission() {
  activeMission.update(mission => {
    if (mission) {
      mission.status = 'paused';
      
      flightRecorder.update(state => ({
        ...state,
        recording: false,
        events: [...state.events, {
          timestamp: Date.now(),
          type: 'mode_change',
          description: 'Mission paused'
        }]
      }));
    }
    return mission;
  });
}

export function completeMission() {
  activeMission.update(mission => {
    if (mission) {
      mission.status = 'completed';
      mission.endTime = Date.now();
      
      // Add to history
      missionHistory.update(history => [...history, mission]);
      
      // Stop recording
      flightRecorder.update(state => ({
        ...state,
        recording: false,
        events: [...state.events, {
          timestamp: Date.now(),
          type: 'landing',
          description: 'Mission completed'
        }]
      }));
    }
    return null;
  });
}

export function addSignalCapture(capture: SignalCapture) {
  activeMission.update(mission => {
    if (mission && mission.status === 'active') {
      mission.signalCaptures.push(capture);
      mission.statistics.signalsCaptured += capture.signalCount;
      
      // Update unique devices count
      const uniqueIds = new Set(
        mission.signalCaptures.flatMap(c => c.signals.map(s => s.id))
      );
      mission.statistics.uniqueDevices = uniqueIds.size;
    }
    return mission;
  });
}

export function recordFlightPoint(point: FlightPoint) {
  flightRecorder.update(state => {
    if (state.recording) {
      state.points.push(point);
      state.duration = Date.now() - (state.startTime || 0);
    }
    return state;
  });
  
  // Update mission flight path
  activeMission.update(mission => {
    if (mission && mission.status === 'active') {
      mission.flightPath.push(point);
      
      // Update statistics
      if (mission.flightPath.length > 1) {
        const lastPoint = mission.flightPath[mission.flightPath.length - 2];
        const distance = calculateDistance(
          lastPoint.lat, lastPoint.lon,
          point.lat, point.lon
        );
        mission.statistics.totalDistance += distance;
        mission.statistics.totalDuration = Date.now() - (mission.startTime || 0);
        mission.statistics.maxAltitude = Math.max(mission.statistics.maxAltitude, point.altitude);
        mission.statistics.minAltitude = Math.min(mission.statistics.minAltitude, point.altitude);
      }
    }
    return mission;
  });
}

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Export helper to create new missions
export function createMission(
  name: string,
  type: DroneMission['type'],
  waypoints: Waypoint[] = [],
  aoi?: AreaOfInterest,
  settings?: Partial<MissionSettings>
): DroneMission {
  return {
    id: `mission-${Date.now()}`,
    name,
    type,
    status: 'planned',
    waypoints,
    areaOfInterest: aoi,
    flightPath: [],
    signalCaptures: [],
    statistics: {
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
      maxAltitude: 0,
      minAltitude: Infinity,
      signalsCaptured: 0,
      uniqueDevices: 0,
      coverageArea: 0
    },
    settings: {
      altitudeFilter: { min: 0, max: 400 },
      signalThreshold: -90,
      scanInterval: 1,
      autoLand: true,
      returnToHome: true,
      ...settings
    }
  };
}