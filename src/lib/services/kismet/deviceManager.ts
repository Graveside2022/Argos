/**
 * Device Management Service
 * Advanced device tracking and analysis
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { KismetDevice } from '../api/kismet';

interface EnrichedDevice extends KismetDevice {
  // Location tracking
  locations?: Array<{
    lat: number;
    lon: number;
    signal: number;
    timestamp: string;
  }>;
  
  // Movement analysis
  movement?: {
    isMoving: boolean;
    speed?: number; // m/s
    direction?: number; // degrees
    distance?: number; // meters from first seen
  };
  
  // Network analysis
  networkInfo?: {
    associatedClients: string[];
    parentAP?: string;
    probeRequests?: string[];
    dataRate?: number;
  };
  
  // Security analysis
  security?: {
    encryption: string[];
    wps: boolean;
    vulnerabilities: string[];
    riskScore: number; // 0-10
  };
  
  // Activity tracking
  activity?: {
    packetsPerSecond: number;
    bytesPerSecond: number;
    lastActive: string;
    activityScore: number; // 0-100
  };
}

interface DeviceGroup {
  id: string;
  name: string;
  devices: string[]; // MAC addresses
  type: 'network' | 'manufacturer' | 'location' | 'custom';
  metadata?: Record<string, unknown>;
}

interface DeviceManagerState {
  devices: Map<string, EnrichedDevice>;
  groups: DeviceGroup[];
  selectedDevices: Set<string>;
  trackingEnabled: boolean;
  locationHistory: Map<string, Array<{ lat: number; lon: number; signal: number; timestamp: string }>>;
  lastUpdate: number;
}

interface TrackingOptions {
  enableLocation: boolean;
  enableMovement: boolean;
  enableActivity: boolean;
  locationUpdateInterval: number; // ms
  movementThreshold: number; // meters
}

class DeviceManager {
  private state = writable<DeviceManagerState>({
    devices: new Map(),
    groups: [],
    selectedDevices: new Set(),
    trackingEnabled: false,
    locationHistory: new Map(),
    lastUpdate: Date.now()
  });
  
  private options: TrackingOptions = {
    enableLocation: true,
    enableMovement: true,
    enableActivity: true,
    locationUpdateInterval: 5000,
    movementThreshold: 10
  };
  
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Public readable stores
  public readonly devices: Readable<EnrichedDevice[]>;
  public readonly groups: Readable<DeviceGroup[]>;
  public readonly selectedDevices: Readable<Set<string>>;
  public readonly deviceStats: Readable<{
    total: number;
    aps: number;
    clients: number;
    moving: number;
    active: number;
  }>;
  
  constructor() {
    this.devices = derived(this.state, $state => 
      Array.from($state.devices.values())
    );
    
    this.groups = derived(this.state, $state => $state.groups);
    this.selectedDevices = derived(this.state, $state => $state.selectedDevices);
    
    this.deviceStats = derived(this.state, $state => {
      const devices = Array.from($state.devices.values());
      return {
        total: devices.length,
        aps: devices.filter(d => d.type === 'AP').length,
        clients: devices.filter(d => d.type === 'CLIENT').length,
        moving: devices.filter(d => d.movement?.isMoving).length,
        active: devices.filter(d => 
          d.activity && d.activity.activityScore > 50
        ).length
      };
    });
  }
  
  /**
   * Configure tracking options
   */
  setOptions(options: Partial<TrackingOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.enableLocation !== undefined || 
        options.locationUpdateInterval !== undefined) {
      this.restartTracking();
    }
  }
  
  /**
   * Process new or updated device
   */
  processDevice(device: KismetDevice): void {
    this.state.update(state => {
      const devices = new Map(state.devices);
      const existing = devices.get(device.mac);
      
      // Create or update enriched device
      const enriched: EnrichedDevice = {
        ...existing,
        ...device
      };
      
      // Update enrichments
      if (this.options.enableLocation && device.gps) {
        this.updateLocation(enriched, device.gps as { lat: number; lon: number; alt?: number });
      }
      
      if (this.options.enableMovement) {
        this.updateMovement(enriched);
      }
      
      if (this.options.enableActivity) {
        this.updateActivity(enriched);
      }
      
      this.updateSecurity(enriched);
      this.updateNetworkInfo(enriched);
      
      devices.set(device.mac, enriched);
      
      return {
        ...state,
        devices,
        lastUpdate: Date.now()
      };
    });
  }
  
  /**
   * Update device location
   */
  private updateLocation(device: EnrichedDevice, gps: { lat: number; lon: number; alt?: number }): void {
    if (!device.locations) {
      device.locations = [];
    }
    
    const location = {
      lat: gps.lat,
      lon: gps.lon,
      signal: (device.signal as number) || -100,
      timestamp: new Date().toISOString()
    };
    
    device.locations.push(location);
    
    // Keep only last 100 locations
    if (device.locations.length > 100) {
      device.locations = device.locations.slice(-100);
    }
    
    // Update location history
    this.state.update(state => {
      const history = new Map(state.locationHistory);
      const deviceHistory = history.get(device.mac) || [];
      deviceHistory.push(location);
      history.set(device.mac, deviceHistory.slice(-1000));
      return { ...state, locationHistory: history };
    });
  }
  
  /**
   * Update movement analysis
   */
  private updateMovement(device: EnrichedDevice): void {
    if (!device.locations || device.locations.length < 2) {
      device.movement = { isMoving: false };
      return;
    }
    
    const recent = device.locations.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    // Calculate distance
    const distance = this.calculateDistance(
      first.lat, first.lon,
      last.lat, last.lon
    );
    
    // Calculate time difference
    const timeDiff = (new Date(last.timestamp).getTime() - 
                     new Date(first.timestamp).getTime()) / 1000;
    
    // Calculate speed
    const speed = timeDiff > 0 ? distance / timeDiff : 0;
    
    // Calculate direction
    const direction = this.calculateBearing(
      first.lat, first.lon,
      last.lat, last.lon
    );
    
    // Calculate total distance from first seen
    const firstLocation = device.locations[0];
    const totalDistance = this.calculateDistance(
      firstLocation.lat, firstLocation.lon,
      last.lat, last.lon
    );
    
    device.movement = {
      isMoving: distance > this.options.movementThreshold,
      speed,
      direction,
      distance: totalDistance
    };
  }
  
  /**
   * Update activity tracking
   */
  private updateActivity(device: EnrichedDevice): void {
    // Calculate activity score based on packets and last seen
    const now = Date.now();
    const lastSeen = device.lastSeen ? new Date(device.lastSeen).getTime() : 0;
    const timeSinceLastSeen = (now - lastSeen) / 1000;
    
    let activityScore = 0;
    
    if (timeSinceLastSeen < 60) {
      activityScore = 100;
    } else if (timeSinceLastSeen < 300) {
      activityScore = 80;
    } else if (timeSinceLastSeen < 600) {
      activityScore = 50;
    } else if (timeSinceLastSeen < 1800) {
      activityScore = 20;
    }
    
    // Safe type checking for packet rate
    let packetsRate = 0;
    if (device.packets && typeof device.packets === 'object' && 'rate' in device.packets) {
      const rate = (device.packets as { rate: unknown }).rate;
      if (typeof rate === 'number') {
        packetsRate = rate;
      }
    }
    
    // Safe type checking for bytes rate
    let bytesRate = 0;
    if (device.bytes && typeof device.bytes === 'object' && 'rate' in device.bytes) {
      const rate = (device.bytes as { rate: unknown }).rate;
      if (typeof rate === 'number') {
        bytesRate = rate;
      }
    }
    
    device.activity = {
      packetsPerSecond: packetsRate,
      bytesPerSecond: bytesRate,
      lastActive: device.lastSeen || '',
      activityScore
    };
  }
  
  /**
   * Update security analysis
   */
  private updateSecurity(device: EnrichedDevice): void {
    const vulnerabilities: string[] = [];
    let riskScore = 0;
    
    // Check encryption
    if (!device.encryption || device.encryption.length === 0) {
      vulnerabilities.push('No encryption');
      riskScore += 5;
    } else if (device.encryption.includes('WEP')) {
      vulnerabilities.push('Weak encryption (WEP)');
      riskScore += 4;
    } else if (device.encryption.includes('WPA')) {
      vulnerabilities.push('Outdated encryption (WPA)');
      riskScore += 2;
    }
    
    // Check WPS
    if (device.wps) {
      vulnerabilities.push('WPS enabled');
      riskScore += 3;
    }
    
    // Check for common vulnerable manufacturers
    const vulnerableManufacturers = ['D-Link', 'TP-Link', 'Netgear'];
    if (device.manufacturer && 
        vulnerableManufacturers.some(m => 
          device.manufacturer?.toLowerCase().includes(m.toLowerCase())
        )) {
      vulnerabilities.push('Known vulnerable manufacturer');
      riskScore += 1;
    }
    
    device.security = {
      encryption: (device.encryption && Array.isArray(device.encryption)) ? device.encryption : [],
      wps: Boolean(device.wps),
      vulnerabilities,
      riskScore: Math.min(riskScore, 10)
    };
  }
  
  /**
   * Update network information
   */
  private updateNetworkInfo(device: EnrichedDevice): void {
    // This would be populated from additional data sources
    // Safe type checking for probe requests
    let probeRequests: string[] = [];
    if (device.probes && Array.isArray(device.probes)) {
      probeRequests = device.probes as string[];
    }
    
    // Data rate is not available in KismetDevice interface
    const dataRate: number | undefined = undefined;
    
    device.networkInfo = {
      associatedClients: [],
      parentAP: undefined,
      probeRequests: probeRequests,
      dataRate: dataRate
    };
  }
  
  /**
   * Create device group
   */
  createGroup(name: string, type: DeviceGroup['type'], devices: string[]): string {
    const id = `group-${Date.now()}`;
    
    this.state.update(state => {
      const groups = [...state.groups, {
        id,
        name,
        type,
        devices
      }];
      
      return { ...state, groups };
    });
    
    return id;
  }
  
  /**
   * Auto-group devices
   */
  autoGroup(by: 'network' | 'manufacturer' | 'location'): void {
    this.state.update(state => {
      const devices = Array.from(state.devices.values());
      const groups: DeviceGroup[] = [];
      
      switch (by) {
        case 'network': {
          // Group by SSID for APs
          const networks = new Map<string, string[]>();
          devices.filter(d => d.type === 'AP' && d.ssid).forEach(d => {
            const ssid = d.ssid;
            if (ssid) {
              if (!networks.has(ssid)) {
                networks.set(ssid, []);
              }
              networks.get(ssid)?.push(d.mac);
            }
          });
          
          networks.forEach((macs, ssid) => {
            groups.push({
              id: `network-${Date.now()}-${groups.length}`,
              name: `Network: ${ssid}`,
              type: 'network',
              devices: macs
            });
          });
          break;
        }
          
        case 'manufacturer': {
          // Group by manufacturer
          const manufacturers = new Map<string, string[]>();
          devices.filter(d => d.manufacturer).forEach(d => {
            const mfr = d.manufacturer;
            if (mfr) {
              if (!manufacturers.has(mfr)) {
                manufacturers.set(mfr, []);
              }
              manufacturers.get(mfr)?.push(d.mac);
            }
          });
          
          manufacturers.forEach((macs, mfr) => {
            groups.push({
              id: `mfr-${Date.now()}-${groups.length}`,
              name: `Manufacturer: ${mfr}`,
              type: 'manufacturer',
              devices: macs
            });
          });
          break;
        }
          
        case 'location': {
          // Group by proximity (within 50m)
          // This is a simplified clustering - real implementation would use
          // proper clustering algorithms
          const clustered = new Set<string>();
          
          devices.filter(d => d.locations && d.locations.length > 0).forEach(d => {
            if (clustered.has(d.mac)) return;
            
            const cluster = [d.mac];
            clustered.add(d.mac);
            
            const loc = d.locations?.[d.locations.length - 1];
            if (!loc) return;
            
            devices.forEach(other => {
              if (other.mac === d.mac || clustered.has(other.mac)) return;
              if (!other.locations || other.locations.length === 0) return;
              
              const otherLoc = other.locations[other.locations.length - 1];
              const distance = this.calculateDistance(
                loc.lat, loc.lon,
                otherLoc.lat, otherLoc.lon
              );
              
              if (distance < 50) {
                cluster.push(other.mac);
                clustered.add(other.mac);
              }
            });
            
            if (cluster.length > 1) {
              groups.push({
                id: `location-${Date.now()}-${groups.length}`,
                name: `Location Cluster ${groups.length + 1}`,
                type: 'location',
                devices: cluster,
                metadata: { center: loc }
              });
            }
          });
          break;
        }
      }
      
      return { ...state, groups: [...state.groups, ...groups] };
    });
  }
  
  /**
   * Select/deselect devices
   */
  toggleDeviceSelection(mac: string): void {
    this.state.update(state => {
      const selected = new Set(state.selectedDevices);
      
      if (selected.has(mac)) {
        selected.delete(mac);
      } else {
        selected.add(mac);
      }
      
      return { ...state, selectedDevices: selected };
    });
  }
  
  /**
   * Clear selection
   */
  clearSelection(): void {
    this.state.update(state => ({
      ...state,
      selectedDevices: new Set()
    }));
  }
  
  /**
   * Get device by MAC
   */
  getDevice(mac: string): EnrichedDevice | undefined {
    let device: EnrichedDevice | undefined;
    this.state.subscribe(state => {
      device = state.devices.get(mac);
    })();
    return device;
  }
  
  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
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
  
  /**
   * Calculate bearing between two coordinates
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360;
  }
  
  /**
   * Start tracking
   */
  private restartTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    
    if (this.options.enableLocation) {
      this.trackingInterval = setInterval(() => {
        // Update location-based tracking
        this.state.update(state => {
          state.devices.forEach(device => {
            if (device.gps) {
              this.updateLocation(device, device.gps as { lat: number; lon: number; alt?: number });
              this.updateMovement(device);
            }
          });
          return { ...state, lastUpdate: Date.now() };
        });
      }, this.options.locationUpdateInterval);
    }
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    
    this.state.set({
      devices: new Map(),
      groups: [],
      selectedDevices: new Set(),
      trackingEnabled: false,
      locationHistory: new Map(),
      lastUpdate: Date.now()
    });
  }
}

// Export singleton instance
export const deviceManager = new DeviceManager();