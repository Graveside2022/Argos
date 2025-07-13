/**
 * Signal Filtering and Noise Reduction Service
 * Strategies to reduce visual noise when dealing with 1000+ signals
 * Optimized for drone surveillance operations
 */

import type { SignalMarker } from '$lib/stores/map/signals';

export interface FilteringOptions {
  // Signal strength filtering
  minPower?: number; // Minimum signal strength in dBm
  maxPower?: number; // Maximum signal strength in dBm
  
  // Frequency band filtering
  frequencyBands?: FrequencyBand[];
  excludeBands?: FrequencyBand[]; // Bands to exclude (e.g., known friendly signals)
  
  // Spatial aggregation
  gridSize?: number; // Grid cell size in meters
  aggregationMethod?: 'max' | 'avg' | 'density' | 'weighted';
  
  // Temporal filtering
  timeWindow?: number; // Time window in milliseconds
  minDuration?: number; // Minimum signal duration to display
  
  // Signal prioritization
  maxSignalsPerArea?: number; // Max signals to show per grid cell
  priorityMode?: 'strongest' | 'newest' | 'persistent' | 'anomalous';
  
  // Drone-specific filters
  droneFrequencies?: boolean; // Focus on known drone frequencies
  movingSignalsOnly?: boolean; // Show only signals with position changes
  altitudeFilter?: { min: number; max: number }; // Filter by estimated altitude
}

export interface FrequencyBand {
  name: string;
  minFreq: number; // MHz
  maxFreq: number; // MHz
  priority?: number; // Higher = more important
}

// Common drone frequency bands
export const DRONE_FREQUENCY_BANDS: FrequencyBand[] = [
  { name: '900MHz ISM', minFreq: 902, maxFreq: 928, priority: 8 },
  { name: '2.4GHz Control', minFreq: 2400, maxFreq: 2483.5, priority: 10 },
  { name: '5.8GHz Video', minFreq: 5725, maxFreq: 5875, priority: 9 },
  { name: '1.2GHz Video', minFreq: 1200, maxFreq: 1300, priority: 7 },
  { name: '433MHz Control', minFreq: 433, maxFreq: 435, priority: 8 },
  { name: 'GPS L1', minFreq: 1574, maxFreq: 1576, priority: 6 },
  { name: 'GPS L2', minFreq: 1226, maxFreq: 1228, priority: 6 },
];

// Common interference sources to filter out
export const INTERFERENCE_BANDS: FrequencyBand[] = [
  { name: 'FM Radio', minFreq: 88, maxFreq: 108, priority: 1 },
  { name: 'Cellular', minFreq: 850, maxFreq: 900, priority: 2 },
  { name: 'WiFi 2.4GHz', minFreq: 2400, maxFreq: 2483.5, priority: 3 },
  { name: 'WiFi 5GHz', minFreq: 5150, maxFreq: 5850, priority: 3 },
];

export class SignalFilterService {
  private signalHistory = new Map<string, SignalMarker[]>();
  private gridCache = new Map<string, GridCell>();
  private movementTracker = new Map<string, MovementData>();
  
  constructor(private options: FilteringOptions = {}) {
    this.setDefaultOptions();
  }
  
  private setDefaultOptions() {
    this.options = {
      minPower: -80, // Filter out very weak signals
      gridSize: 50, // 50m grid cells
      aggregationMethod: 'weighted',
      timeWindow: 30000, // 30 seconds
      maxSignalsPerArea: 10,
      priorityMode: 'anomalous',
      droneFrequencies: true,
      ...this.options
    };
  }
  
  /**
   * Update filtering options
   */
  setOptions(newOptions: FilteringOptions): void {
    this.options = {
      ...this.options,
      ...newOptions
    };
  }
  
  /**
   * Apply all filtering strategies to reduce signal noise
   */
  filterSignals(signals: SignalMarker[]): FilteredResult {
    let filtered = [...signals];
    const stats = {
      original: signals.length,
      afterStrength: 0,
      afterFrequency: 0,
      afterSpatial: 0,
      afterTemporal: 0,
      final: 0
    };
    
    // 1. Signal strength filtering
    filtered = this.filterBySignalStrength(filtered);
    stats.afterStrength = filtered.length;
    
    // 2. Frequency band filtering
    filtered = this.filterByFrequencyBands(filtered);
    stats.afterFrequency = filtered.length;
    
    // 3. Temporal filtering
    filtered = this.filterByTemporalPatterns(filtered);
    stats.afterTemporal = filtered.length;
    
    // 4. Spatial aggregation and prioritization
    const aggregated = this.applySpatialAggregation(filtered);
    stats.afterSpatial = aggregated.signals.length;
    
    // 5. Apply priority-based selection
    const prioritized = this.prioritizeSignals(aggregated.signals);
    stats.final = prioritized.length;
    
    return {
      signals: prioritized,
      gridCells: aggregated.gridCells,
      statistics: stats,
      anomalies: this.detectAnomalies(prioritized)
    };
  }
  
  /**
   * Filter by signal strength threshold
   */
  private filterBySignalStrength(signals: SignalMarker[]): SignalMarker[] {
    const { minPower = -80, maxPower = 0 } = this.options;
    
    return signals.filter(signal => 
      signal.power >= minPower && signal.power <= maxPower
    );
  }
  
  /**
   * Filter by frequency bands (include/exclude)
   */
  private filterByFrequencyBands(signals: SignalMarker[]): SignalMarker[] {
    const { frequencyBands, excludeBands, droneFrequencies } = this.options;
    
    // Use drone frequencies if specified
    const includeBands = droneFrequencies ? DRONE_FREQUENCY_BANDS : frequencyBands || [];
    const excludeList = excludeBands || (droneFrequencies ? INTERFERENCE_BANDS : []);
    
    return signals.filter(signal => {
      const freq = signal.frequency;
      
      // Check exclusions first
      const isExcluded = excludeList.some(band => 
        freq >= band.minFreq && freq <= band.maxFreq
      );
      if (isExcluded) return false;
      
      // If no include bands specified, include all non-excluded
      if (includeBands.length === 0) return true;
      
      // Check if in any include band
      return includeBands.some(band => 
        freq >= band.minFreq && freq <= band.maxFreq
      );
    });
  }
  
  /**
   * Filter by temporal patterns (duration, persistence)
   */
  private filterByTemporalPatterns(signals: SignalMarker[]): SignalMarker[] {
    const { timeWindow = 30000, minDuration = 0, movingSignalsOnly = false } = this.options;
    const now = Date.now();
    
    // Update signal history
    signals.forEach(signal => {
      const history = this.signalHistory.get(signal.id) || [];
      history.push(signal);
      
      // Keep only recent history
      const recentHistory = history.filter(s => 
        now - s.timestamp <= timeWindow
      );
      this.signalHistory.set(signal.id, recentHistory);
      
      // Track movement
      if (recentHistory.length > 1) {
        const movement = this.calculateMovement(recentHistory);
        this.movementTracker.set(signal.id, movement);
      }
    });
    
    return signals.filter(signal => {
      const history = this.signalHistory.get(signal.id) || [];
      
      // Check minimum duration
      if (history.length > 0) {
        const duration = now - history[0].timestamp;
        if (duration < minDuration) return false;
      }
      
      // Check movement requirement
      if (movingSignalsOnly) {
        const movement = this.movementTracker.get(signal.id);
        if (!movement || movement.speed < 0.5) return false; // 0.5 m/s threshold
      }
      
      return true;
    });
  }
  
  /**
   * Apply spatial aggregation to reduce visual clutter
   */
  private applySpatialAggregation(signals: SignalMarker[]): AggregatedResult {
    const { gridSize = 50, aggregationMethod = 'weighted' } = this.options;
    const gridCells = new Map<string, GridCell>();
    
    // Group signals by grid cell
    signals.forEach(signal => {
      const gridKey = this.getGridKey(signal.lat, signal.lon, gridSize);
      
      if (!gridCells.has(gridKey)) {
        const [gridLat, gridLon] = gridKey.split(',').map(Number);
        gridCells.set(gridKey, {
          key: gridKey,
          lat: gridLat,
          lon: gridLon,
          signals: [],
          stats: {
            count: 0,
            avgPower: 0,
            maxPower: -100,
            dominantFreq: 0,
            priority: 0
          }
        });
      }
      
      const cell = gridCells.get(gridKey);
      if (cell) {
        cell.signals.push(signal);
      }
    });
    
    // Calculate cell statistics
    gridCells.forEach(cell => {
      this.calculateCellStats(cell, aggregationMethod);
    });
    
    // Select representative signals from each cell
    const aggregatedSignals: SignalMarker[] = [];
    gridCells.forEach(cell => {
      const representatives = this.selectRepresentativeSignals(cell);
      aggregatedSignals.push(...representatives);
    });
    
    return {
      signals: aggregatedSignals,
      gridCells: Array.from(gridCells.values())
    };
  }
  
  /**
   * Prioritize signals based on importance for drone surveillance
   */
  private prioritizeSignals(signals: SignalMarker[]): SignalMarker[] {
    const { priorityMode = 'anomalous' } = this.options;
    
    // Calculate priority scores
    const scoredSignals = signals.map(signal => ({
      signal,
      score: this.calculatePriorityScore(signal, priorityMode)
    }));
    
    // Sort by priority score
    scoredSignals.sort((a, b) => b.score - a.score);
    
    // Apply global limit if needed
    const maxSignals = this.options.maxSignalsPerArea ? 
      this.options.maxSignalsPerArea * 100 : // Rough estimate
      1000; // Hard limit
    
    return scoredSignals
      .slice(0, maxSignals)
      .map(item => item.signal);
  }
  
  /**
   * Calculate priority score for a signal
   */
  private calculatePriorityScore(signal: SignalMarker, mode: string): number {
    let score = 0;
    
    // Base score from signal strength
    score += (signal.power + 100) / 100; // Normalize -100 to 0 dBm
    
    // Frequency band priority
    const band = this.getFrequencyBand(signal.frequency);
    if (band) {
      score += (band.priority || 5) / 10;
    }
    
    // Mode-specific scoring
    switch (mode) {
      case 'strongest':
        score += signal.power / 50;
        break;
        
      case 'newest': {
        const age = Date.now() - signal.timestamp;
        score += Math.max(0, 1 - age / 60000); // Decay over 1 minute
        break;
      }
        
      case 'persistent': {
        const history = this.signalHistory.get(signal.id) || [];
        score += Math.min(history.length / 10, 1);
        break;
      }
        
      case 'anomalous': {
        // Check for unusual patterns
        const movement = this.movementTracker.get(signal.id);
        if (movement && movement.speed > 5) score += 2; // Fast movement
        if (this.isUnusualFrequency(signal.frequency)) score += 1.5;
        if (this.isPowerAnomaly(signal)) score += 1;
        break;
      }
    }
    
    return score;
  }
  
  /**
   * Detect anomalies in filtered signals
   */
  private detectAnomalies(signals: SignalMarker[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    signals.forEach(signal => {
      // Fast moving signals
      const movement = this.movementTracker.get(signal.id);
      if (movement && movement.speed > 10) {
        anomalies.push({
          type: 'fast_movement',
          signal,
          description: `Signal moving at ${movement.speed.toFixed(1)} m/s`,
          severity: movement.speed > 20 ? 'high' : 'medium'
        });
      }
      
      // Unusual frequency
      if (this.isUnusualFrequency(signal.frequency)) {
        anomalies.push({
          type: 'unusual_frequency',
          signal,
          description: `Uncommon frequency: ${signal.frequency.toFixed(1)} MHz`,
          severity: 'medium'
        });
      }
      
      // Power anomaly
      if (this.isPowerAnomaly(signal)) {
        anomalies.push({
          type: 'power_anomaly',
          signal,
          description: `Abnormal power level: ${signal.power} dBm`,
          severity: signal.power > -30 ? 'high' : 'low'
        });
      }
    });
    
    return anomalies;
  }
  
  /**
   * Helper methods
   */
  
  private getGridKey(lat: number, lon: number, gridSize: number): string {
    const latMetersPerDegree = 111320;
    const lonMetersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
    
    const gridLat = Math.floor(lat * latMetersPerDegree / gridSize) * gridSize / latMetersPerDegree;
    const gridLon = Math.floor(lon * lonMetersPerDegree / gridSize) * gridSize / lonMetersPerDegree;
    
    return `${gridLat.toFixed(6)},${gridLon.toFixed(6)}`;
  }
  
  private calculateCellStats(cell: GridCell, method: string): void {
    const signals = cell.signals;
    if (signals.length === 0) return;
    
    cell.stats.count = signals.length;
    
    switch (method) {
      case 'max':
        cell.stats.maxPower = Math.max(...signals.map(s => s.power));
        cell.stats.avgPower = cell.stats.maxPower;
        break;
        
      case 'avg':
        cell.stats.avgPower = signals.reduce((sum, s) => sum + s.power, 0) / signals.length;
        cell.stats.maxPower = Math.max(...signals.map(s => s.power));
        break;
        
      case 'weighted': {
        // Weight by signal strength
        let weightedSum = 0;
        let weightSum = 0;
        signals.forEach(s => {
          const weight = Math.pow(10, s.power / 10); // Convert dBm to linear
          weightedSum += s.power * weight;
          weightSum += weight;
        });
        cell.stats.avgPower = weightSum > 0 ? weightedSum / weightSum : 0;
        cell.stats.maxPower = Math.max(...signals.map(s => s.power));
        break;
      }
        
      case 'density':
        cell.stats.avgPower = signals.reduce((sum, s) => sum + s.power, 0) / signals.length;
        cell.stats.priority = signals.length; // Prioritize dense areas
        break;
    }
    
    // Find dominant frequency
    const freqMap = new Map<number, number>();
    signals.forEach(s => {
      const freqBin = Math.round(s.frequency / 10) * 10; // 10 MHz bins
      freqMap.set(freqBin, (freqMap.get(freqBin) || 0) + 1);
    });
    
    let maxCount = 0;
    freqMap.forEach((count, freq) => {
      if (count > maxCount) {
        maxCount = count;
        cell.stats.dominantFreq = freq;
      }
    });
  }
  
  private selectRepresentativeSignals(cell: GridCell): SignalMarker[] {
    const { maxSignalsPerArea = 10 } = this.options;
    
    // Sort signals by power
    const sorted = [...cell.signals].sort((a, b) => b.power - a.power);
    
    // Take top N signals
    return sorted.slice(0, maxSignalsPerArea);
  }
  
  private calculateMovement(history: SignalMarker[]): MovementData {
    if (history.length < 2) {
      return { speed: 0, direction: 0, distance: 0 };
    }
    
    const recent = history[history.length - 1];
    const previous = history[history.length - 2];
    
    const distance = this.calculateDistance(
      previous.lat, previous.lon,
      recent.lat, recent.lon
    );
    
    const timeDelta = (recent.timestamp - previous.timestamp) / 1000; // seconds
    const speed = timeDelta > 0 ? distance / timeDelta : 0;
    
    const direction = Math.atan2(
      recent.lon - previous.lon,
      recent.lat - previous.lat
    ) * 180 / Math.PI;
    
    return { speed, direction, distance };
  }
  
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
  
  private getFrequencyBand(frequency: number): FrequencyBand | null {
    const allBands = [...DRONE_FREQUENCY_BANDS, ...INTERFERENCE_BANDS];
    return allBands.find(band => 
      frequency >= band.minFreq && frequency <= band.maxFreq
    ) || null;
  }
  
  private isUnusualFrequency(frequency: number): boolean {
    const band = this.getFrequencyBand(frequency);
    return !band || (band.priority || 0) < 3;
  }
  
  private isPowerAnomaly(signal: SignalMarker): boolean {
    // Very strong signal
    if (signal.power > -40) return true;
    
    // Check against historical average for this frequency
    const band = this.getFrequencyBand(signal.frequency);
    if (band) {
      // These are rough expected ranges
      const expectedRanges: Record<string, [number, number]> = {
        '2.4GHz Control': [-70, -40],
        '5.8GHz Video': [-80, -50],
        'WiFi 2.4GHz': [-80, -30],
        'WiFi 5GHz': [-85, -35],
      };
      
      const range = expectedRanges[band.name];
      if (range) {
        return signal.power < range[0] || signal.power > range[1];
      }
    }
    
    return false;
  }
}

// Type definitions

interface GridCell {
  key: string;
  lat: number;
  lon: number;
  signals: SignalMarker[];
  stats: {
    count: number;
    avgPower: number;
    maxPower: number;
    dominantFreq: number;
    priority: number;
  };
}

interface MovementData {
  speed: number; // m/s
  direction: number; // degrees
  distance: number; // meters
}

interface AggregatedResult {
  signals: SignalMarker[];
  gridCells: GridCell[];
}

export interface FilteredResult {
  signals: SignalMarker[];
  gridCells: GridCell[];
  statistics: {
    original: number;
    afterStrength: number;
    afterFrequency: number;
    afterSpatial: number;
    afterTemporal: number;
    final: number;
  };
  anomalies: Anomaly[];
}

export interface Anomaly {
  type: 'fast_movement' | 'unusual_frequency' | 'power_anomaly' | 'frequency_hopping';
  signal: SignalMarker;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Export singleton instance
export const signalFilter = new SignalFilterService();