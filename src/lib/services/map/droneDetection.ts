/**
 * Drone Detection and Tracking Service
 * Specialized algorithms for identifying and tracking drone signals
 */

import type { SignalMarker } from '$lib/stores/map/signals';
import { signalFilter, type FilteringOptions, DRONE_FREQUENCY_BANDS as _DRONE_FREQUENCY_BANDS } from './signalFiltering';

export interface DroneSignature {
  id: string;
  type: 'controller' | 'video' | 'telemetry' | 'unknown';
  confidence: number;
  signals: SignalMarker[];
  trajectory?: TrajectoryData;
  characteristics: DroneCharacteristics;
  firstSeen: number;
  lastSeen: number;
  status: 'active' | 'lost' | 'landed';
}

export interface TrajectoryData {
  points: Array<{ lat: number; lon: number; timestamp: number; altitude?: number }>;
  speed: number; // m/s
  heading: number; // degrees
  altitude?: number; // meters
  verticalSpeed?: number; // m/s
  predictedPath?: Array<{ lat: number; lon: number; timestamp: number }>;
}

export interface DroneCharacteristics {
  manufacturer?: string;
  model?: string;
  controlFreq?: number;
  videoFreq?: number;
  signalPattern: string; // 'continuous' | 'burst' | 'frequency_hopping'
  powerProfile: 'commercial' | 'professional' | 'military' | 'custom';
}

// Known drone signal patterns
const DRONE_PATTERNS = {
  DJI: {
    control: [2400, 2483], // 2.4GHz
    video: [5725, 5850], // 5.8GHz
    signalPattern: 'continuous',
    powerRange: [-70, -40]
  },
  Parrot: {
    control: [2400, 2483],
    video: [2400, 2483], // Uses same band
    signalPattern: 'burst',
    powerRange: [-75, -45]
  },
  Autel: {
    control: [2400, 2483],
    video: [5725, 5850],
    signalPattern: 'continuous',
    powerRange: [-70, -40]
  },
  Custom: {
    control: [433, 915, 1200], // Various ISM bands
    video: [1200, 2400, 5800],
    signalPattern: 'frequency_hopping',
    powerRange: [-80, -30]
  }
};

export class DroneDetectionService {
  private activeDrones = new Map<string, DroneSignature>();
  private signalAssociations = new Map<string, string>(); // signalId -> droneId
  private detectionHistory = new Map<string, DroneSignature[]>();
  
  constructor(
    private filterOptions: FilteringOptions = {
      droneFrequencies: true,
      minPower: -80,
      movingSignalsOnly: false, // We'll handle movement detection ourselves
      timeWindow: 60000 // 1 minute window
    }
  ) {}
  
  /**
   * Process signals to detect and track drones
   */
  detectDrones(signals: SignalMarker[]): DroneDetectionResult {
    // First, apply drone-specific filtering
    const filtered = signalFilter.filterSignals(signals);
    
    // Group signals by potential drone associations
    const droneGroups = this.groupSignalsByDrone(filtered.signals);
    
    // Update or create drone signatures
    droneGroups.forEach(group => {
      this.updateDroneSignature(group);
    });
    
    // Clean up old/inactive drones
    this.cleanupInactiveDrones();
    
    // Analyze trajectories and predict paths
    this.updateTrajectories();
    
    // Generate alerts for significant events
    const alerts = this.generateAlerts();
    
    return {
      activeDrones: Array.from(this.activeDrones.values()),
      totalSignals: filtered.signals.length,
      filteredSignals: filtered.signals,
      alerts,
      statistics: this.generateStatistics()
    };
  }
  
  /**
   * Group signals that likely belong to the same drone
   */
  private groupSignalsByDrone(signals: SignalMarker[]): SignalGroup[] {
    const groups: SignalGroup[] = [];
    const unassigned = new Set(signals);
    
    // First pass: Group by spatial-temporal proximity
    signals.forEach(signal => {
      if (!unassigned.has(signal)) return;
      
      const group: SignalGroup = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        signals: [signal],
        centerLat: signal.lat,
        centerLon: signal.lon,
        timeRange: { start: signal.timestamp, end: signal.timestamp }
      };
      
      unassigned.delete(signal);
      
      // Find related signals
      unassigned.forEach(other => {
        if (this.areSignalsRelated(signal, other)) {
          group.signals.push(other);
          unassigned.delete(other);
          
          // Update group center and time range
          group.centerLat = (group.centerLat * (group.signals.length - 1) + other.lat) / group.signals.length;
          group.centerLon = (group.centerLon * (group.signals.length - 1) + other.lon) / group.signals.length;
          group.timeRange.start = Math.min(group.timeRange.start, other.timestamp);
          group.timeRange.end = Math.max(group.timeRange.end, other.timestamp);
        }
      });
      
      groups.push(group);
    });
    
    // Second pass: Merge groups that likely belong to the same drone
    return this.mergeRelatedGroups(groups);
  }
  
  /**
   * Check if two signals are likely from the same drone
   */
  private areSignalsRelated(s1: SignalMarker, s2: SignalMarker): boolean {
    // Spatial proximity (within 100m)
    const distance = this.calculateDistance(s1.lat, s1.lon, s2.lat, s2.lon);
    if (distance > 100) return false;
    
    // Temporal proximity (within 5 seconds)
    const timeDiff = Math.abs(s1.timestamp - s2.timestamp);
    if (timeDiff > 5000) return false;
    
    // Check if frequencies match known drone patterns
    const pattern = this.matchDronePattern(s1.frequency, s2.frequency);
    if (pattern) return true;
    
    // Similar signal strength (within 10 dB)
    const powerDiff = Math.abs(s1.power - s2.power);
    if (powerDiff > 10) return false;
    
    return true;
  }
  
  /**
   * Match frequencies to known drone patterns
   */
  private matchDronePattern(freq1: number, freq2: number): string | null {
    for (const [manufacturer, pattern] of Object.entries(DRONE_PATTERNS)) {
      const inControl = pattern.control.some(f => 
        (typeof f === 'number' && Math.abs(freq1 - f) < 50) ||
        (Array.isArray(f) && freq1 >= f[0] && freq1 <= f[1])
      );
      
      const inVideo = pattern.video.some(f => 
        (typeof f === 'number' && Math.abs(freq2 - f) < 50) ||
        (Array.isArray(f) && freq2 >= f[0] && freq2 <= f[1])
      );
      
      if ((inControl && inVideo) || (inVideo && inControl)) {
        return manufacturer;
      }
    }
    
    return null;
  }
  
  /**
   * Merge signal groups that belong to the same drone
   */
  private mergeRelatedGroups(groups: SignalGroup[]): SignalGroup[] {
    const merged: SignalGroup[] = [];
    const used = new Set<number>();
    
    groups.forEach((group, i) => {
      if (used.has(i)) return;
      
      const mergedGroup = { ...group };
      used.add(i);
      
      // Check other groups for merging
      groups.forEach((other, j) => {
        if (i === j || used.has(j)) return;
        
        // Check if groups should be merged
        const distance = this.calculateDistance(
          group.centerLat, group.centerLon,
          other.centerLat, other.centerLon
        );
        
        const timeOverlap = 
          (group.timeRange.start <= other.timeRange.end) &&
          (other.timeRange.start <= group.timeRange.end);
        
        if (distance < 200 && timeOverlap) {
          // Merge groups
          mergedGroup.signals.push(...other.signals);
          used.add(j);
          
          // Recalculate center
          const totalSignals = mergedGroup.signals.length;
          mergedGroup.centerLat = mergedGroup.signals.reduce((sum, s) => sum + s.lat, 0) / totalSignals;
          mergedGroup.centerLon = mergedGroup.signals.reduce((sum, s) => sum + s.lon, 0) / totalSignals;
          
          // Update time range
          mergedGroup.timeRange.start = Math.min(mergedGroup.timeRange.start, other.timeRange.start);
          mergedGroup.timeRange.end = Math.max(mergedGroup.timeRange.end, other.timeRange.end);
        }
      });
      
      merged.push(mergedGroup);
    });
    
    return merged;
  }
  
  /**
   * Update or create drone signature from signal group
   */
  private updateDroneSignature(group: SignalGroup): void {
    // Check if this group matches an existing drone
    let droneId: string | null = null;
    
    for (const signal of group.signals) {
      const existingDroneId = this.signalAssociations.get(signal.id);
      if (existingDroneId && this.activeDrones.has(existingDroneId)) {
        droneId = existingDroneId;
        break;
      }
    }
    
    if (droneId) {
      // Update existing drone
      const drone = this.activeDrones.get(droneId);
      if (drone) {
        this.updateExistingDrone(drone, group);
      }
    } else {
      // Create new drone signature
      const newDrone = this.createDroneSignature(group);
      this.activeDrones.set(newDrone.id, newDrone);
      
      // Associate signals with drone
      group.signals.forEach(signal => {
        this.signalAssociations.set(signal.id, newDrone.id);
      });
    }
  }
  
  /**
   * Create new drone signature from signal group
   */
  private createDroneSignature(group: SignalGroup): DroneSignature {
    const characteristics = this.analyzeDroneCharacteristics(group.signals);
    
    return {
      id: `drone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.determineDroneType(group.signals),
      confidence: this.calculateConfidence(group.signals),
      signals: group.signals,
      trajectory: this.calculateTrajectory(group.signals),
      characteristics,
      firstSeen: group.timeRange.start,
      lastSeen: group.timeRange.end,
      status: 'active'
    };
  }
  
  /**
   * Update existing drone with new signals
   */
  private updateExistingDrone(drone: DroneSignature, group: SignalGroup): void {
    // Add new signals
    drone.signals.push(...group.signals);
    
    // Keep only recent signals (last 2 minutes)
    const cutoff = Date.now() - 120000;
    drone.signals = drone.signals.filter(s => s.timestamp > cutoff);
    
    // Update timestamps
    drone.lastSeen = group.timeRange.end;
    
    // Recalculate confidence
    drone.confidence = this.calculateConfidence(drone.signals);
    
    // Update trajectory
    if (drone.trajectory) {
      const newPoints = group.signals.map(s => ({
        lat: s.lat,
        lon: s.lon,
        timestamp: s.timestamp
      }));
      drone.trajectory.points.push(...newPoints);
      
      // Recalculate trajectory metrics
      this.updateTrajectoryMetrics(drone.trajectory);
    }
    
    // Update associations
    group.signals.forEach(signal => {
      this.signalAssociations.set(signal.id, drone.id);
    });
  }
  
  /**
   * Determine drone type based on signal characteristics
   */
  private determineDroneType(signals: SignalMarker[]): DroneSignature['type'] {
    const frequencies = signals.map(s => s.frequency);
    const uniqueFreqs = new Set(frequencies);
    
    // Check for video frequencies (typically 1.2, 2.4, or 5.8 GHz)
    const hasVideo = Array.from(uniqueFreqs).some(f => 
      (f >= 1200 && f <= 1300) ||
      (f >= 2400 && f <= 2500) ||
      (f >= 5725 && f <= 5875)
    );
    
    // Check for control frequencies
    const hasControl = Array.from(uniqueFreqs).some(f =>
      (f >= 2400 && f <= 2483) ||
      (f >= 433 && f <= 435) ||
      (f >= 900 && f <= 928)
    );
    
    // Check for telemetry (often on 433 or 915 MHz)
    const hasTelemetry = Array.from(uniqueFreqs).some(f =>
      (f >= 433 && f <= 435) ||
      (f >= 902 && f <= 928)
    );
    
    if (hasVideo) return 'video';
    if (hasControl) return 'controller';
    if (hasTelemetry) return 'telemetry';
    return 'unknown';
  }
  
  /**
   * Calculate detection confidence
   */
  private calculateConfidence(signals: SignalMarker[]): number {
    let confidence = 0;
    
    // More signals = higher confidence
    confidence += Math.min(signals.length / 20, 0.3);
    
    // Consistent signal strength
    const powers = signals.map(s => s.power);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    const variance = powers.reduce((sum, p) => sum + Math.pow(p - avgPower, 2), 0) / powers.length;
    const stdDev = Math.sqrt(variance);
    confidence += stdDev < 5 ? 0.2 : 0;
    
    // Frequency pattern matches known drones
    const freqs = signals.map(s => s.frequency);
    const matchesPattern = this.matchesKnownPattern(freqs);
    confidence += matchesPattern ? 0.3 : 0;
    
    // Movement pattern consistency
    if (signals.length > 5) {
      const trajectory = this.calculateTrajectory(signals);
      if (trajectory && trajectory.speed > 0 && trajectory.speed < 50) {
        confidence += 0.2;
      }
    }
    
    return Math.min(confidence, 1);
  }
  
  /**
   * Analyze drone characteristics from signals
   */
  private analyzeDroneCharacteristics(signals: SignalMarker[]): DroneCharacteristics {
    const frequencies = signals.map(s => s.frequency);
    const powers = signals.map(s => s.power);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    
    // Try to identify manufacturer
    let manufacturer: string | undefined;
    let model: string | undefined;
    
    for (const [mfr, pattern] of Object.entries(DRONE_PATTERNS)) {
      const matchesControl = frequencies.some(f => 
        pattern.control.some(range => 
          Array.isArray(range) ? (f >= range[0] && f <= range[1]) : Math.abs(f - range) < 50
        )
      );
      
      const matchesPower = avgPower >= pattern.powerRange[0] && avgPower <= pattern.powerRange[1];
      
      if (matchesControl && matchesPower) {
        manufacturer = mfr;
        break;
      }
    }
    
    // Determine power profile
    let powerProfile: DroneCharacteristics['powerProfile'] = 'commercial';
    if (avgPower > -40) powerProfile = 'professional';
    if (avgPower > -30) powerProfile = 'military';
    if (!manufacturer) powerProfile = 'custom';
    
    // Analyze signal pattern
    let signalPattern: DroneCharacteristics['signalPattern'] = 'continuous';
    
    // Check for frequency hopping
    const uniqueFreqs = new Set(frequencies);
    if (uniqueFreqs.size > 5 && signals.length > 10) {
      signalPattern = 'frequency_hopping';
    } else {
      // Check for burst pattern
      const timeDiffs = [];
      for (let i = 1; i < signals.length; i++) {
        timeDiffs.push(signals[i].timestamp - signals[i-1].timestamp);
      }
      const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      if (avgTimeDiff > 100) signalPattern = 'burst';
    }
    
    return {
      manufacturer,
      model,
      controlFreq: frequencies.find(f => f >= 2400 && f <= 2500),
      videoFreq: frequencies.find(f => f >= 5725 && f <= 5875),
      signalPattern,
      powerProfile
    };
  }
  
  /**
   * Calculate drone trajectory from signals
   */
  private calculateTrajectory(signals: SignalMarker[]): TrajectoryData | undefined {
    if (signals.length < 2) return undefined;
    
    // Sort by timestamp
    const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);
    
    const points = sorted.map(s => ({
      lat: s.lat,
      lon: s.lon,
      timestamp: s.timestamp
    }));
    
    // Calculate speed and heading
    const lastIdx = points.length - 1;
    const distance = this.calculateDistance(
      points[0].lat, points[0].lon,
      points[lastIdx].lat, points[lastIdx].lon
    );
    
    const timeDelta = (points[lastIdx].timestamp - points[0].timestamp) / 1000;
    const speed = timeDelta > 0 ? distance / timeDelta : 0;
    
    const heading = this.calculateHeading(
      points[lastIdx - 1]?.lat || points[0].lat,
      points[lastIdx - 1]?.lon || points[0].lon,
      points[lastIdx].lat,
      points[lastIdx].lon
    );
    
    return {
      points,
      speed,
      heading,
      predictedPath: this.predictPath(points, speed, heading)
    };
  }
  
  /**
   * Update trajectory metrics
   */
  private updateTrajectoryMetrics(trajectory: TrajectoryData): void {
    if (trajectory.points.length < 2) return;
    
    // Keep only recent points (last 30 seconds)
    const cutoff = Date.now() - 30000;
    trajectory.points = trajectory.points.filter(p => p.timestamp > cutoff);
    
    // Recalculate speed and heading from recent points
    const recent = trajectory.points.slice(-5); // Last 5 points
    if (recent.length >= 2) {
      const distances: number[] = [];
      const headings: number[] = [];
      
      for (let i = 1; i < recent.length; i++) {
        const dist = this.calculateDistance(
          recent[i-1].lat, recent[i-1].lon,
          recent[i].lat, recent[i].lon
        );
        const time = (recent[i].timestamp - recent[i-1].timestamp) / 1000;
        if (time > 0) distances.push(dist / time);
        
        const hdg = this.calculateHeading(
          recent[i-1].lat, recent[i-1].lon,
          recent[i].lat, recent[i].lon
        );
        headings.push(hdg);
      }
      
      // Average speed and heading
      trajectory.speed = distances.length > 0 ? 
        distances.reduce((a, b) => a + b, 0) / distances.length : 0;
      
      trajectory.heading = headings.length > 0 ?
        this.averageHeading(headings) : 0;
      
      // Update predicted path
      trajectory.predictedPath = this.predictPath(
        trajectory.points,
        trajectory.speed,
        trajectory.heading
      );
    }
  }
  
  /**
   * Predict future path based on current trajectory
   */
  private predictPath(
    points: Array<{ lat: number; lon: number; timestamp: number }>,
    speed: number,
    heading: number
  ): Array<{ lat: number; lon: number; timestamp: number }> {
    if (points.length === 0 || speed === 0) return [];
    
    const lastPoint = points[points.length - 1];
    const predicted: Array<{ lat: number; lon: number; timestamp: number }> = [];
    
    // Predict next 30 seconds (every 5 seconds)
    for (let i = 1; i <= 6; i++) {
      const futureTime = lastPoint.timestamp + (i * 5000);
      const distance = speed * (i * 5); // meters
      
      // Calculate new position
      const headingRad = heading * Math.PI / 180;
      const R = 6371e3; // Earth's radius
      const lat1 = lastPoint.lat * Math.PI / 180;
      const lon1 = lastPoint.lon * Math.PI / 180;
      
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distance / R) +
        Math.cos(lat1) * Math.sin(distance / R) * Math.cos(headingRad)
      );
      
      const lon2 = lon1 + Math.atan2(
        Math.sin(headingRad) * Math.sin(distance / R) * Math.cos(lat1),
        Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
      );
      
      predicted.push({
        lat: lat2 * 180 / Math.PI,
        lon: lon2 * 180 / Math.PI,
        timestamp: futureTime
      });
    }
    
    return predicted;
  }
  
  /**
   * Clean up inactive drones
   */
  private cleanupInactiveDrones(): void {
    const inactiveTimeout = 30000; // 30 seconds
    const now = Date.now();
    
    this.activeDrones.forEach((drone, id) => {
      if (now - drone.lastSeen > inactiveTimeout) {
        drone.status = 'lost';
        
        // Move to history
        const history = this.detectionHistory.get(id) || [];
        history.push(drone);
        this.detectionHistory.set(id, history);
        
        // Remove from active
        this.activeDrones.delete(id);
        
        // Clean up associations
        drone.signals.forEach(signal => {
          this.signalAssociations.delete(signal.id);
        });
      }
    });
  }
  
  /**
   * Update all drone trajectories
   */
  private updateTrajectories(): void {
    this.activeDrones.forEach(drone => {
      if (drone.trajectory) {
        this.updateTrajectoryMetrics(drone.trajectory);
      }
    });
  }
  
  /**
   * Generate alerts for significant drone events
   */
  private generateAlerts(): DroneAlert[] {
    const alerts: DroneAlert[] = [];
    
    this.activeDrones.forEach(drone => {
      // New drone detected
      if (Date.now() - drone.firstSeen < 5000) {
        alerts.push({
          type: 'new_drone',
          severity: 'medium',
          drone,
          message: `New drone detected: ${drone.characteristics.manufacturer || 'Unknown'} at ${drone.confidence * 100}% confidence`,
          timestamp: Date.now()
        });
      }
      
      // High-speed drone
      if (drone.trajectory && drone.trajectory.speed > 20) {
        alerts.push({
          type: 'high_speed',
          severity: 'high',
          drone,
          message: `Drone moving at high speed: ${drone.trajectory.speed.toFixed(1)} m/s`,
          timestamp: Date.now()
        });
      }
      
      // Military/professional drone
      if (drone.characteristics.powerProfile === 'military' || 
          drone.characteristics.powerProfile === 'professional') {
        alerts.push({
          type: 'professional_drone',
          severity: 'high',
          drone,
          message: `${drone.characteristics.powerProfile} drone detected`,
          timestamp: Date.now()
        });
      }
      
      // Frequency hopping (potential security concern)
      if (drone.characteristics.signalPattern === 'frequency_hopping') {
        alerts.push({
          type: 'frequency_hopping',
          severity: 'medium',
          drone,
          message: 'Drone using frequency hopping - possible encrypted communications',
          timestamp: Date.now()
        });
      }
    });
    
    return alerts;
  }
  
  /**
   * Generate detection statistics
   */
  private generateStatistics(): DroneStatistics {
    const stats: DroneStatistics = {
      totalActive: this.activeDrones.size,
      byType: new Map(),
      byManufacturer: new Map(),
      avgConfidence: 0,
      detectionRate: 0
    };
    
    let totalConfidence = 0;
    
    this.activeDrones.forEach(drone => {
      // By type
      stats.byType.set(drone.type, (stats.byType.get(drone.type) || 0) + 1);
      
      // By manufacturer
      const mfr = drone.characteristics.manufacturer || 'Unknown';
      stats.byManufacturer.set(mfr, (stats.byManufacturer.get(mfr) || 0) + 1);
      
      totalConfidence += drone.confidence;
    });
    
    stats.avgConfidence = this.activeDrones.size > 0 ? 
      totalConfidence / this.activeDrones.size : 0;
    
    // Calculate detection rate (detections per minute)
    const historyCount = Array.from(this.detectionHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    stats.detectionRate = (this.activeDrones.size + historyCount) / 60; // Rough estimate
    
    return stats;
  }
  
  /**
   * Helper methods
   */
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  
  private calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  }
  
  private averageHeading(headings: number[]): number {
    if (headings.length === 0) return 0;
    
    // Convert to unit vectors, average, then convert back
    let x = 0, y = 0;
    headings.forEach(h => {
      const rad = h * Math.PI / 180;
      x += Math.cos(rad);
      y += Math.sin(rad);
    });
    
    x /= headings.length;
    y /= headings.length;
    
    const avg = Math.atan2(y, x) * 180 / Math.PI;
    return (avg + 360) % 360;
  }
  
  private matchesKnownPattern(frequencies: number[]): boolean {
    for (const pattern of Object.values(DRONE_PATTERNS)) {
      const matchesControl = frequencies.some(f => 
        pattern.control.some(range => 
          Array.isArray(range) ? (f >= range[0] && f <= range[1]) : Math.abs(f - range) < 50
        )
      );
      
      const matchesVideo = frequencies.some(f => 
        pattern.video.some(range => 
          Array.isArray(range) ? (f >= range[0] && f <= range[1]) : Math.abs(f - range) < 50
        )
      );
      
      if (matchesControl || matchesVideo) return true;
    }
    
    return false;
  }
}

// Type definitions

interface SignalGroup {
  id: string;
  signals: SignalMarker[];
  centerLat: number;
  centerLon: number;
  timeRange: { start: number; end: number };
}

export interface DroneDetectionResult {
  activeDrones: DroneSignature[];
  totalSignals: number;
  filteredSignals: SignalMarker[];
  alerts: DroneAlert[];
  statistics: DroneStatistics;
}

export interface DroneAlert {
  type: 'new_drone' | 'high_speed' | 'professional_drone' | 'frequency_hopping' | 'lost_drone';
  severity: 'low' | 'medium' | 'high';
  drone: DroneSignature;
  message: string;
  timestamp: number;
}

export interface DroneStatistics {
  totalActive: number;
  byType: Map<string, number>;
  byManufacturer: Map<string, number>;
  avgConfidence: number;
  detectionRate: number; // per minute
}

// Export singleton instance
export const droneDetector = new DroneDetectionService();