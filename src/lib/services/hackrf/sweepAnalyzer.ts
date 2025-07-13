/**
 * Sweep Data Analyzer Service
 * Provides real-time analysis of HackRF sweep data
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { SpectrumData, SignalDetection } from '../api/hackrf';

interface Peak {
  frequency: number;
  power: number;
  bandwidth: number;
  timestamp: number;
}

interface AnalysisState {
  peaks: Peak[];
  noiseFloor: number;
  averagePower: number;
  maxPower: number;
  minPower: number;
  frequencyRange: { start: number; end: number };
  signalCount: number;
  lastAnalysis: number;
}

interface AnalysisOptions {
  peakThreshold: number; // dB above noise floor
  minBandwidth: number; // Hz
  noiseFloorPercentile: number; // 0-100
  smoothingFactor: number; // 0-1
}

class SweepAnalyzer {
  private state = writable<AnalysisState>({
    peaks: [],
    noiseFloor: -100,
    averagePower: -80,
    maxPower: -120,
    minPower: 0,
    frequencyRange: { start: 0, end: 0 },
    signalCount: 0,
    lastAnalysis: Date.now()
  });
  
  private options: AnalysisOptions = {
    peakThreshold: 10, // 10 dB above noise floor
    minBandwidth: 25000, // 25 kHz minimum bandwidth
    noiseFloorPercentile: 20, // Bottom 20% for noise floor
    smoothingFactor: 0.3 // 30% smoothing
  };
  
  private powerHistory: number[][] = [];
  private maxHistorySize = 100;
  
  // Public readable stores
  public readonly peaks: Readable<Peak[]>;
  public readonly noiseFloor: Readable<number>;
  public readonly stats: Readable<{
    averagePower: number;
    maxPower: number;
    minPower: number;
    signalCount: number;
  }>;
  
  constructor() {
    this.peaks = derived(this.state, $state => $state.peaks);
    this.noiseFloor = derived(this.state, $state => $state.noiseFloor);
    this.stats = derived(this.state, $state => ({
      averagePower: $state.averagePower,
      maxPower: $state.maxPower,
      minPower: $state.minPower,
      signalCount: $state.signalCount
    }));
  }
  
  /**
   * Configure analysis options
   */
  setOptions(options: Partial<AnalysisOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Analyze spectrum data
   */
  analyzeSpectrum(data: SpectrumData): void {
    if (!data.frequencies || !data.powers || 
        data.frequencies.length !== data.powers.length) {
      return;
    }
    
    // Update power history
    this.updatePowerHistory(data.powers);
    
    // Calculate statistics
    const stats = this.calculateStatistics(data.powers);
    
    // Detect peaks
    const peaks = this.detectPeaks(
      data.frequencies, 
      data.powers, 
      stats.noiseFloor
    );
    
    // Update state
    this.state.update(state => ({
      ...state,
      peaks,
      noiseFloor: stats.noiseFloor,
      averagePower: stats.averagePower,
      maxPower: stats.maxPower,
      minPower: stats.minPower,
      frequencyRange: {
        start: Math.min(...data.frequencies),
        end: Math.max(...data.frequencies)
      },
      signalCount: peaks.length,
      lastAnalysis: Date.now()
    }));
  }
  
  /**
   * Process detected signals
   */
  processSignals(signals: SignalDetection[]): Peak[] {
    return signals.map(signal => ({
      frequency: signal.frequency,
      power: signal.power,
      bandwidth: signal.bandwidth,
      timestamp: signal.timestamp
    }));
  }
  
  /**
   * Get waterfall data for visualization
   */
  getWaterfallData(): number[][] {
    return this.powerHistory;
  }
  
  /**
   * Update power history for waterfall
   */
  private updatePowerHistory(powers: number[]): void {
    this.powerHistory.push([...powers]);
    
    if (this.powerHistory.length > this.maxHistorySize) {
      this.powerHistory.shift();
    }
  }
  
  /**
   * Calculate statistics from power data
   */
  private calculateStatistics(powers: number[]): {
    noiseFloor: number;
    averagePower: number;
    maxPower: number;
    minPower: number;
  } {
    if (powers.length === 0) {
      return {
        noiseFloor: -100,
        averagePower: -80,
        maxPower: -120,
        minPower: 0
      };
    }
    
    // Sort powers for percentile calculation
    const sortedPowers = [...powers].sort((a, b) => a - b);
    
    // Calculate noise floor (percentile method)
    const noiseIndex = Math.floor(sortedPowers.length * this.options.noiseFloorPercentile / 100);
    const noiseFloor = sortedPowers[noiseIndex];
    
    // Calculate other statistics
    const sum = powers.reduce((a, b) => a + b, 0);
    const averagePower = sum / powers.length;
    const maxPower = Math.max(...powers);
    const minPower = Math.min(...powers);
    
    return {
      noiseFloor,
      averagePower,
      maxPower,
      minPower
    };
  }
  
  /**
   * Detect peaks in spectrum data
   */
  private detectPeaks(
    frequencies: number[], 
    powers: number[], 
    noiseFloor: number
  ): Peak[] {
    const peaks: Peak[] = [];
    const threshold = noiseFloor + this.options.peakThreshold;
    
    let inPeak = false;
    let peakStart = 0;
    let peakMax = -Infinity;
    let peakMaxIndex = 0;
    
    for (let i = 0; i < powers.length; i++) {
      const power = powers[i];
      
      if (power > threshold) {
        if (!inPeak) {
          inPeak = true;
          peakStart = i;
          peakMax = power;
          peakMaxIndex = i;
        } else if (power > peakMax) {
          peakMax = power;
          peakMaxIndex = i;
        }
      } else if (inPeak) {
        // End of peak
        const bandwidth = (i - peakStart) * (frequencies[1] - frequencies[0]);
        
        if (bandwidth >= this.options.minBandwidth) {
          peaks.push({
            frequency: frequencies[peakMaxIndex],
            power: peakMax,
            bandwidth,
            timestamp: Date.now()
          });
        }
        
        inPeak = false;
      }
    }
    
    // Handle peak at end of spectrum
    if (inPeak) {
      const bandwidth = (powers.length - peakStart) * (frequencies[1] - frequencies[0]);
      
      if (bandwidth >= this.options.minBandwidth) {
        peaks.push({
          frequency: frequencies[peakMaxIndex],
          power: peakMax,
          bandwidth,
          timestamp: Date.now()
        });
      }
    }
    
    return peaks;
  }
  
  /**
   * Apply smoothing to power data
   */
  smoothPowers(powers: number[]): number[] {
    if (powers.length < 3) return powers;
    
    const smoothed = [...powers];
    const factor = this.options.smoothingFactor;
    
    for (let i = 1; i < powers.length - 1; i++) {
      smoothed[i] = powers[i] * (1 - factor) + 
                    (powers[i - 1] + powers[i + 1]) * factor / 2;
    }
    
    return smoothed;
  }
  
  /**
   * Clear analysis data
   */
  clear(): void {
    this.powerHistory = [];
    this.state.set({
      peaks: [],
      noiseFloor: -100,
      averagePower: -80,
      maxPower: -120,
      minPower: 0,
      frequencyRange: { start: 0, end: 0 },
      signalCount: 0,
      lastAnalysis: Date.now()
    });
  }
}

// Export singleton instance
export const sweepAnalyzer = new SweepAnalyzer();