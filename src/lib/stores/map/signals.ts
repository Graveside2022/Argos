import { writable, derived } from 'svelte/store';
import { SignalSource } from '$lib/types/enums';

type LatLngExpression = [number, number] | { lat: number; lng: number };

export interface SignalMarker {
  id: string;
  lat: number;
  lon: number;
  frequency: number;
  power: number;
  timestamp: number;
  altitude?: number; // Altitude in meters (for drone operations)
  source: SignalSource;
  metadata: {
    ssid?: string;
    mac?: string;
    channel?: number;
    encryption?: string;
    vendor?: string;
    signalType?: string;
    bandwidth?: number;
    modulation?: string;
    velocity?: { speed: number; heading: number }; // For moving signals
    flightPath?: { lat: number; lon: number; alt: number }[]; // Historical positions
    type?: string; // Device type (AP, Client, Bridge, Unknown)
    deviceId?: string; // Device identifier
  };
}

export interface MapConfig {
  center: LatLngExpression;
  zoom: number;
  showHackRF: boolean;
  showKismet: boolean;
  showClustering: boolean;
  showHeatmap: boolean;
  signalThreshold: number; // Minimum signal strength to display
  maxAge: number; // Maximum age of signals in seconds
}

// Signal storage
export const signals = writable<Map<string, SignalMarker>>(new Map());

// Map configuration
export const mapConfig = writable<MapConfig>({
  center: [0, 0],
  zoom: 15,
  showHackRF: true,
  showKismet: true,
  showClustering: true,
  showHeatmap: false,
  signalThreshold: -90,
  maxAge: 300 // 5 minutes
});

// User position
export const userPosition = writable<{
  lat: number;
  lon: number;
  accuracy: number;
  heading: number | null;
  timestamp: number;
} | null>(null);

// Filtered signals based on config
export const filteredSignals = derived(
  [signals, mapConfig],
  ([$signals, $config]) => {
    const now = Date.now();
    const filtered: SignalMarker[] = [];
    
    $signals.forEach(signal => {
      // Check age
      if ((now - signal.timestamp) / 1000 > $config.maxAge) return;
      
      // Check source visibility
      if (signal.source === SignalSource.HackRF && !$config.showHackRF) return;
      if (signal.source === SignalSource.Kismet && !$config.showKismet) return;
      
      // Check signal strength
      if (signal.power < $config.signalThreshold) return;
      
      filtered.push(signal);
    });
    
    return filtered;
  }
);

// Signal statistics
export const signalStats = derived(signals, $signals => {
  const stats = {
    total: $signals.size,
    hackrf: 0,
    kismet: 0,
    avgPower: 0,
    strongSignals: 0,
    mediumSignals: 0,
    weakSignals: 0
  };
  
  let totalPower = 0;
  $signals.forEach(signal => {
    if (signal.source === SignalSource.HackRF) stats.hackrf++;
    if (signal.source === SignalSource.Kismet) stats.kismet++;
    
    totalPower += signal.power;
    
    if (signal.power >= -50) stats.strongSignals++;
    else if (signal.power >= -70) stats.mediumSignals++;
    else stats.weakSignals++;
  });
  
  stats.avgPower = stats.total > 0 ? totalPower / stats.total : 0;
  
  return stats;
});

// Helper functions
export function addSignal(signal: SignalMarker) {
  signals.update(s => {
    s.set(signal.id, signal);
    return s;
  });
}

export function removeSignal(id: string) {
  signals.update(s => {
    s.delete(id);
    return s;
  });
}

export function clearSignals(source?: SignalSource) {
  signals.update(s => {
    if (source) {
      // Remove only signals from specific source
      Array.from(s.entries()).forEach(([id, signal]) => {
        if (signal.source === source) {
          s.delete(id);
        }
      });
    } else {
      // Clear all
      s.clear();
    }
    return s;
  });
}

export function updateUserPosition(position: GeolocationPosition) {
  userPosition.set({
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    timestamp: position.timestamp
  });
  
  // Also update map center if this is the first position
  mapConfig.update(config => {
    // Check if center is an array and is at origin
    if (Array.isArray(config.center) && config.center[0] === 0 && config.center[1] === 0) {
      config.center = [position.coords.latitude, position.coords.longitude];
    } else if (!Array.isArray(config.center) && config.center.lat === 0 && config.center.lng === 0) {
      config.center = { lat: position.coords.latitude, lng: position.coords.longitude };
    }
    return config;
  });
}

// Color mapping for signal strength
export function getSignalColor(power: number): string {
  if (power >= -50) return '#ff0000'; // Strong - Red
  if (power >= -60) return '#ff6600'; // Good - Orange
  if (power >= -70) return '#ffcc00'; // Medium - Yellow
  if (power >= -80) return '#66ff00'; // Fair - Light Green
  if (power >= -90) return '#00ff00'; // Weak - Green
  return '#0066ff'; // Very Weak - Blue
}

// Get icon for signal type
export function getSignalIcon(signal: SignalMarker): string {
  if (signal.source === SignalSource.HackRF) {
    return 'radio'; // RF signal icon
  } else if (signal.source === SignalSource.Kismet) {
    if (signal.metadata.signalType === 'wifi') {
      return 'wifi';
    } else if (signal.metadata.signalType === 'bluetooth') {
      return 'bluetooth';
    }
  }
  return 'signal'; // Generic signal icon
}