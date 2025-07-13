/**
 * AI-powered pattern detection for RF signals
 * Identifies anomalies, moving signals, and interesting patterns
 */

import type { SignalMarker } from '$lib/stores/map/signals';

export interface Pattern {
  id: string;
  type: PatternType;
  confidence: number; // 0-1
  priority: 'high' | 'medium' | 'low';
  signals: SignalMarker[];
  description: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export type PatternType = 
  | 'new_device'
  | 'moving_signal'
  | 'anomalous_power'
  | 'frequency_hopping'
  | 'device_cluster'
  | 'suspicious_behavior'
  | 'infrastructure'
  | 'routine_traffic';

export interface PatternDetectorConfig {
  enabledPatterns: PatternType[];
  sensitivityLevel: 'high' | 'medium' | 'low';
  baselineLearningTime: number; // minutes
  anomalyThreshold: number; // standard deviations
}

export const DEFAULT_PATTERN_CONFIG: PatternDetectorConfig = {
  enabledPatterns: [
    'new_device',
    'moving_signal',
    'anomalous_power',
    'frequency_hopping',
    'suspicious_behavior'
  ],
  sensitivityLevel: 'medium',
  baselineLearningTime: 5,
  anomalyThreshold: 2.5
};

/**
 * Signal baseline for anomaly detection
 */
export class SignalBaseline {
  private signalHistory = new Map<string, SignalMarker[]>();
  private locationProfiles = new Map<string, LocationProfile>();
  private deviceProfiles = new Map<string, DeviceProfile>();
  private startTime = Date.now();
  
  addSignal(signal: SignalMarker) {
    const key = this.getSignalKey(signal);
    if (!this.signalHistory.has(key)) {
      this.signalHistory.set(key, []);
    }
    this.signalHistory.get(key)?.push(signal);
    
    // Update profiles
    this.updateLocationProfile(signal);
    this.updateDeviceProfile(signal);
  }
  
  private getSignalKey(signal: SignalMarker): string {
    // Create a key based on frequency band and approximate location
    const freqBand = Math.floor(signal.frequency / 100) * 100;
    const latGrid = Math.floor(signal.lat * 1000) / 1000;
    const lonGrid = Math.floor(signal.lon * 1000) / 1000;
    return `${freqBand}_${latGrid}_${lonGrid}`;
  }
  
  private updateLocationProfile(signal: SignalMarker) {
    const locKey = `${Math.floor(signal.lat * 100)}_${Math.floor(signal.lon * 100)}`;
    
    if (!this.locationProfiles.has(locKey)) {
      this.locationProfiles.set(locKey, {
        position: { lat: signal.lat, lon: signal.lon },
        typicalPower: { mean: signal.power, stdDev: 0, samples: 1 },
        typicalFrequencies: new Set([signal.frequency]),
        deviceTypes: new Map()
      });
    } else {
      const profile = this.locationProfiles.get(locKey);
      if (!profile) return;
      // Update running statistics
      const oldMean = profile.typicalPower.mean;
      const n = profile.typicalPower.samples;
      profile.typicalPower.mean = (oldMean * n + signal.power) / (n + 1);
      profile.typicalPower.samples++;
      
      // Update standard deviation
      const variance = Math.pow(signal.power - profile.typicalPower.mean, 2);
      profile.typicalPower.stdDev = Math.sqrt(
        (profile.typicalPower.stdDev * profile.typicalPower.stdDev * n + variance) / (n + 1)
      );
      
      profile.typicalFrequencies.add(signal.frequency);
      
      const deviceType = signal.metadata?.signalType || 'unknown';
      profile.deviceTypes.set(deviceType, (profile.deviceTypes.get(deviceType) || 0) + 1);
    }
  }
  
  private updateDeviceProfile(signal: SignalMarker) {
    const deviceKey = `${signal.metadata?.signalType}_${Math.floor(signal.frequency / 100)}`;
    
    if (!this.deviceProfiles.has(deviceKey)) {
      this.deviceProfiles.set(deviceKey, {
        type: signal.metadata?.signalType || 'unknown',
        typicalPower: { mean: signal.power, stdDev: 0, samples: 1 },
        frequencyRange: { min: signal.frequency, max: signal.frequency },
        lastSeen: signal.timestamp,
        locations: new Set([`${signal.lat.toFixed(4)}_${signal.lon.toFixed(4)}`])
      });
    } else {
      const profile = this.deviceProfiles.get(deviceKey);
      if (!profile) return;
      
      // Update power statistics
      const oldMean = profile.typicalPower.mean;
      const n = profile.typicalPower.samples;
      profile.typicalPower.mean = (oldMean * n + signal.power) / (n + 1);
      profile.typicalPower.samples++;
      
      profile.frequencyRange.min = Math.min(profile.frequencyRange.min, signal.frequency);
      profile.frequencyRange.max = Math.max(profile.frequencyRange.max, signal.frequency);
      profile.lastSeen = signal.timestamp;
      profile.locations.add(`${signal.lat.toFixed(4)}_${signal.lon.toFixed(4)}`);
    }
  }
  
  isAnomaly(signal: SignalMarker, threshold: number): boolean {
    // Check if we have enough baseline data
    if (Date.now() - this.startTime < 60000) return false; // Need at least 1 minute
    
    const locKey = `${Math.floor(signal.lat * 100)}_${Math.floor(signal.lon * 100)}`;
    const locationProfile = this.locationProfiles.get(locKey);
    
    if (!locationProfile || locationProfile.typicalPower.samples < 10) {
      return false; // Not enough data
    }
    
    // Check if power is anomalous
    const powerDiff = Math.abs(signal.power - locationProfile.typicalPower.mean);
    const sigmas = powerDiff / (locationProfile.typicalPower.stdDev + 0.01);
    
    return sigmas > threshold;
  }
  
  getDeviceMovement(deviceType: string): number {
    const profiles = Array.from(this.deviceProfiles.entries())
      .filter(([key]) => key.startsWith(deviceType))
      .map(([_, profile]) => profile);
    
    if (profiles.length === 0) return 0;
    
    // Calculate average location spread
    let totalSpread = 0;
    profiles.forEach(profile => {
      totalSpread += profile.locations.size;
    });
    
    return totalSpread / profiles.length;
  }
}

interface LocationProfile {
  position: { lat: number; lon: number };
  typicalPower: { mean: number; stdDev: number; samples: number };
  typicalFrequencies: Set<number>;
  deviceTypes: Map<string, number>;
}

interface DeviceProfile {
  type: string;
  typicalPower: { mean: number; stdDev: number; samples: number };
  frequencyRange: { min: number; max: number };
  lastSeen: number;
  locations: Set<string>;
}

/**
 * AI Pattern Detector
 */
export class AIPatternDetector {
  private baseline = new SignalBaseline();
  private detectedPatterns = new Map<string, Pattern>();
  private signalBuffer: SignalMarker[] = [];
  private config: PatternDetectorConfig;
  
  constructor(config: PatternDetectorConfig = DEFAULT_PATTERN_CONFIG) {
    this.config = config;
  }
  
  /**
   * Process new signal and detect patterns
   */
  processSignal(signal: SignalMarker): Pattern[] {
    this.signalBuffer.push(signal);
    this.baseline.addSignal(signal);
    
    // Keep buffer size manageable
    if (this.signalBuffer.length > 1000) {
      this.signalBuffer = this.signalBuffer.slice(-1000);
    }
    
    const patterns: Pattern[] = [];
    
    // Run enabled pattern detectors
    if (this.config.enabledPatterns.includes('new_device')) {
      const newDevice = this.detectNewDevice(signal);
      if (newDevice) patterns.push(newDevice);
    }
    
    if (this.config.enabledPatterns.includes('anomalous_power')) {
      const anomaly = this.detectAnomalousPower(signal);
      if (anomaly) patterns.push(anomaly);
    }
    
    if (this.config.enabledPatterns.includes('moving_signal')) {
      const moving = this.detectMovingSignal(signal);
      if (moving) patterns.push(moving);
    }
    
    if (this.config.enabledPatterns.includes('frequency_hopping')) {
      const hopping = this.detectFrequencyHopping();
      if (hopping) patterns.push(hopping);
    }
    
    if (this.config.enabledPatterns.includes('suspicious_behavior')) {
      const suspicious = this.detectSuspiciousBehavior(signal);
      if (suspicious) patterns.push(suspicious);
    }
    
    // Store detected patterns
    patterns.forEach(pattern => {
      this.detectedPatterns.set(pattern.id, pattern);
    });
    
    return patterns;
  }
  
  /**
   * Detect new device appearance
   */
  private detectNewDevice(signal: SignalMarker): Pattern | null {
    const recentSignals = this.signalBuffer.slice(-100);
    const similarSignals = recentSignals.filter(s => 
      Math.abs(s.frequency - signal.frequency) < 10 &&
      this.calculateDistance({lat: s.lat, lon: s.lon}, {lat: signal.lat, lon: signal.lon}) < 50
    );
    
    if (similarSignals.length === 1) { // Only this signal
      return {
        id: `new-device-${Date.now()}`,
        type: 'new_device',
        confidence: 0.8,
        priority: 'medium',
        signals: [signal],
        description: `New ${signal.metadata?.signalType || 'unknown'} device detected at ${signal.frequency.toFixed(0)} MHz`,
        timestamp: Date.now(),
        metadata: {
          deviceType: signal.metadata?.signalType,
          frequency: signal.frequency,
          power: signal.power
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detect anomalous power levels
   */
  private detectAnomalousPower(signal: SignalMarker): Pattern | null {
    if (this.baseline.isAnomaly(signal, this.config.anomalyThreshold)) {
      return {
        id: `anomaly-power-${Date.now()}`,
        type: 'anomalous_power',
        confidence: 0.7,
        priority: signal.power > -40 ? 'high' : 'medium',
        signals: [signal],
        description: `Unusual signal strength: ${signal.power.toFixed(0)} dBm at ${signal.frequency.toFixed(0)} MHz`,
        timestamp: Date.now(),
        metadata: {
          power: signal.power,
          expectedRange: { min: -80, max: -50 }
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detect moving signals
   */
  private detectMovingSignal(signal: SignalMarker): Pattern | null {
    const timeWindow = 30000; // 30 seconds
    const recentSignals = this.signalBuffer.filter(s => 
      s.timestamp > Date.now() - timeWindow &&
      Math.abs(s.frequency - signal.frequency) < 5 &&
      s.metadata?.signalType === signal.metadata?.signalType
    );
    
    if (recentSignals.length < 3) return null;
    
    // Calculate movement
    let totalDistance = 0;
    for (let i = 1; i < recentSignals.length; i++) {
      totalDistance += this.calculateDistance(
        {lat: recentSignals[i-1].lat, lon: recentSignals[i-1].lon},
        {lat: recentSignals[i].lat, lon: recentSignals[i].lon}
      );
    }
    
    const avgSpeed = totalDistance / (timeWindow / 1000); // m/s
    
    if (avgSpeed > 1) { // Moving faster than 1 m/s
      return {
        id: `moving-signal-${Date.now()}`,
        type: 'moving_signal',
        confidence: Math.min(0.9, avgSpeed / 10),
        priority: avgSpeed > 10 ? 'high' : 'medium',
        signals: recentSignals,
        description: `Moving signal detected: ${avgSpeed.toFixed(1)} m/s`,
        timestamp: Date.now(),
        metadata: {
          speed: avgSpeed,
          direction: this.calculateDirection(recentSignals),
          trajectory: recentSignals.map(s => ({lat: s.lat, lon: s.lon}))
        }
      };
    }
    
    return null;
  }
  
  /**
   * Detect frequency hopping behavior
   */
  private detectFrequencyHopping(): Pattern | null {
    const timeWindow = 10000; // 10 seconds
    const recentSignals = this.signalBuffer.filter(s => 
      s.timestamp > Date.now() - timeWindow
    );
    
    // Group by approximate location
    const locationGroups = new Map<string, SignalMarker[]>();
    recentSignals.forEach(signal => {
      const locKey = `${Math.floor(signal.lat * 1000)}_${Math.floor(signal.lon * 1000)}`;
      if (!locationGroups.has(locKey)) {
        locationGroups.set(locKey, []);
      }
      locationGroups.get(locKey)?.push(signal);
    });
    
    // Check each location group for frequency hopping
    for (const [locKey, signals] of locationGroups) {
      if (signals.length < 5) continue;
      
      // Check frequency variation
      const frequencies = signals.map(s => s.frequency);
      const uniqueFreqs = new Set(frequencies);
      
      if (uniqueFreqs.size >= 3 && uniqueFreqs.size === signals.length) {
        // All different frequencies - possible hopping
        return {
          id: `freq-hopping-${Date.now()}`,
          type: 'frequency_hopping',
          confidence: 0.75,
          priority: 'high',
          signals,
          description: `Frequency hopping detected: ${uniqueFreqs.size} frequencies in ${timeWindow/1000}s`,
          timestamp: Date.now(),
          metadata: {
            frequencies: Array.from(uniqueFreqs).sort(),
            hopRate: uniqueFreqs.size / (timeWindow / 1000),
            location: locKey
          }
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect suspicious behavior patterns
   */
  private detectSuspiciousBehavior(signal: SignalMarker): Pattern | null {
    // Check for unusual characteristics
    const suspicious: string[] = [];
    
    // Very high power in unexpected frequency
    if (signal.power > -30 && !this.isExpectedHighPower(signal)) {
      suspicious.push('Unusually high power');
    }
    
    // Rapid appearance/disappearance
    const similarRecent = this.signalBuffer.slice(-20).filter(s =>
      Math.abs(s.frequency - signal.frequency) < 5 &&
      this.calculateDistance({lat: s.lat, lon: s.lon}, {lat: signal.lat, lon: signal.lon}) < 20
    );
    
    if (similarRecent.length === 1 && this.signalBuffer.length > 10) {
      suspicious.push('Burst transmission');
    }
    
    // Non-standard frequencies
    if (!this.isStandardFrequency(signal.frequency)) {
      suspicious.push('Non-standard frequency');
    }
    
    if (suspicious.length > 0) {
      return {
        id: `suspicious-${Date.now()}`,
        type: 'suspicious_behavior',
        confidence: 0.6 + (suspicious.length * 0.1),
        priority: suspicious.length > 1 ? 'high' : 'medium',
        signals: [signal],
        description: `Suspicious signal: ${suspicious.join(', ')}`,
        timestamp: Date.now(),
        metadata: {
          reasons: suspicious,
          frequency: signal.frequency,
          power: signal.power
        }
      };
    }
    
    return null;
  }
  
  /**
   * Helper functions
   */
  private calculateDistance(pos1: { lat: number; lon: number }, pos2: { lat: number; lon: number }): number {
    const R = 6371e3;
    const φ1 = pos1.lat * Math.PI / 180;
    const φ2 = pos2.lat * Math.PI / 180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
    const Δλ = (pos2.lon - pos1.lon) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
  
  private calculateDirection(signals: SignalMarker[]): number {
    if (signals.length < 2) return 0;
    
    const first = {lat: signals[0].lat, lon: signals[0].lon};
    const last = {lat: signals[signals.length - 1].lat, lon: signals[signals.length - 1].lon};
    
    const dLon = (last.lon - first.lon) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(last.lat * Math.PI / 180);
    const x = Math.cos(first.lat * Math.PI / 180) * Math.sin(last.lat * Math.PI / 180) -
              Math.sin(first.lat * Math.PI / 180) * Math.cos(last.lat * Math.PI / 180) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  private isExpectedHighPower(signal: SignalMarker): boolean {
    // Cell towers and known APs can have high power
    return signal.metadata?.signalType === 'cellular' || 
           (signal.metadata?.signalType === 'wifi_2.4' && signal.power > -40);
  }
  
  private isStandardFrequency(freq: number): boolean {
    // Check against known frequency bands
    const standardBands = [
      { min: 2400, max: 2484 },    // 2.4 GHz WiFi/Bluetooth
      { min: 5150, max: 5875 },    // 5 GHz WiFi
      { min: 824, max: 894 },      // Cellular 850
      { min: 1850, max: 1990 },    // Cellular 1900
      { min: 902, max: 928 },      // ISM 900
      { min: 433, max: 435 }       // ISM 433
    ];
    
    return standardBands.some(band => freq >= band.min && freq <= band.max);
  }
  
  /**
   * Get filtered signals based on pattern priority
   */
  getFilteredSignals(signals: SignalMarker[], minPriority: 'low' | 'medium' | 'high' = 'medium'): SignalMarker[] {
    const priorityMap = { low: 0, medium: 1, high: 2 };
    const minPriorityValue = priorityMap[minPriority];
    
    // Get all signals that are part of high-priority patterns
    const importantSignalIds = new Set<string>();
    
    this.detectedPatterns.forEach(pattern => {
      if (priorityMap[pattern.priority] >= minPriorityValue) {
        pattern.signals.forEach(signal => {
          importantSignalIds.add(signal.id);
        });
      }
    });
    
    return signals.filter(signal => importantSignalIds.has(signal.id));
  }
  
  /**
   * Get active patterns
   */
  getActivePatterns(maxAge: number = 60000): Pattern[] {
    const now = Date.now();
    return Array.from(this.detectedPatterns.values())
      .filter(pattern => now - pattern.timestamp < maxAge)
      .sort((a, b) => {
        // Sort by priority then timestamp
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp - a.timestamp;
      });
  }
}