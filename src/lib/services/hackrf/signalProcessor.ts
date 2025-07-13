/**
 * Signal Processing Service
 * Advanced signal detection and classification
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import type { SignalDetection } from '../api/hackrf';
import { timeWindowFilter } from './timeWindowFilter';

interface ProcessedSignal extends SignalDetection {
  confidence: number;
  classification: string;
  snr: number; // Signal-to-noise ratio
  occupied: boolean; // Channel occupancy
  duration?: number; // How long signal has been present
}

interface SignalDatabase {
  [frequency: string]: {
    lastSeen: number;
    avgPower: number;
    maxPower: number;
    occurrences: number;
    classification: string;
    confidence: number;
  };
}

interface ProcessorState {
  activeSignals: ProcessedSignal[];
  signalDatabase: SignalDatabase;
  classificationStats: Record<string, number>;
  totalSignalsProcessed: number;
  lastProcessed: number;
}

interface ProcessorOptions {
  signalTimeout: number; // ms before signal is considered gone
  minSNR: number; // Minimum SNR for valid signal
  confidenceThreshold: number; // Minimum confidence for classification
  frequencyTolerance: number; // Hz tolerance for same signal
}

class SignalProcessor {
  private state = writable<ProcessorState>({
    activeSignals: [],
    signalDatabase: {},
    classificationStats: {},
    totalSignalsProcessed: 0,
    lastProcessed: Date.now()
  });
  
  private options: ProcessorOptions = {
    signalTimeout: 30000, // 30 seconds
    minSNR: 6, // 6 dB minimum SNR
    confidenceThreshold: 0.7, // 70% confidence
    frequencyTolerance: 10000 // 10 kHz tolerance
  };
  
  // Define pattern types for better type safety
  private readonly patterns: Record<string, {
    freqRange: number[] | number[][];
    bandwidth: number[];
    modulation: string;
  }> = {
    'FM Broadcast': {
      freqRange: [88e6, 108e6],
      bandwidth: [150e3, 200e3],
      modulation: 'FM'
    },
    'Aviation': {
      freqRange: [108e6, 137e6],
      bandwidth: [8e3, 25e3],
      modulation: 'AM'
    },
    'Amateur 2m': {
      freqRange: [144e6, 148e6],
      bandwidth: [12.5e3, 25e3],
      modulation: 'FM'
    },
    'Amateur 70cm': {
      freqRange: [420e6, 450e6],
      bandwidth: [12.5e3, 25e3],
      modulation: 'FM'
    },
    'Public Safety': {
      freqRange: [150e6, 174e6],
      bandwidth: [12.5e3, 25e3],
      modulation: 'FM'
    },
    'Marine VHF': {
      freqRange: [156e6, 162e6],
      bandwidth: [25e3],
      modulation: 'FM'
    },
    'GSM': {
      freqRange: [
        [890e6, 915e6], // GSM 900 uplink
        [935e6, 960e6], // GSM 900 downlink
        [1710e6, 1785e6], // GSM 1800 uplink
        [1805e6, 1880e6] // GSM 1800 downlink
      ],
      bandwidth: [200e3],
      modulation: 'GMSK'
    },
    'WiFi 2.4GHz': {
      freqRange: [2400e6, 2483.5e6],
      bandwidth: [20e6, 40e6],
      modulation: 'OFDM'
    },
    'WiFi 5GHz': {
      freqRange: [5150e6, 5850e6],
      bandwidth: [20e6, 40e6, 80e6, 160e6],
      modulation: 'OFDM'
    }
  };
  
  // Public readable stores
  public readonly activeSignals: Readable<ProcessedSignal[]>;
  public readonly signalStats: Readable<{
    total: number;
    byType: Record<string, number>;
  }>;
  
  constructor() {
    this.activeSignals = derived(this.state, $state => $state.activeSignals);
    this.signalStats = derived(this.state, $state => ({
      total: $state.totalSignalsProcessed,
      byType: $state.classificationStats
    }));
  }
  
  /**
   * Configure processor options
   */
  setOptions(options: Partial<ProcessorOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Process new signal detection
   */
  processSignal(signal: SignalDetection, noiseFloor: number): ProcessedSignal | null {
    // Calculate SNR
    const snr = signal.power - noiseFloor;
    
    if (snr < this.options.minSNR) {
      return null; // Signal too weak
    }
    
    // Classify signal
    const classification = this.classifySignal(signal);
    
    // Create processed signal
    const processed: ProcessedSignal = {
      ...signal,
      snr,
      confidence: classification.confidence,
      classification: classification.type,
      occupied: true
    };
    
    // Update database
    this.updateSignalDatabase(processed);
    
    // Add to time window filter
    timeWindowFilter.addSignal(processed);
    
    // Update state
    this.state.update(state => {
      // Remove old signals
      const now = Date.now();
      const activeSignals = state.activeSignals.filter(
        s => now - s.timestamp < this.options.signalTimeout
      );
      
      // Add or update signal
      const existingIndex = activeSignals.findIndex(
        s => Math.abs(s.frequency - signal.frequency) < this.options.frequencyTolerance
      );
      
      if (existingIndex >= 0 && activeSignals[existingIndex]) {
        // Update existing signal
        activeSignals[existingIndex] = {
          ...processed,
          duration: now - activeSignals[existingIndex].timestamp
        };
      } else {
        // Add new signal
        activeSignals.push(processed);
      }
      
      // Update classification stats
      const classificationStats = { ...state.classificationStats };
      classificationStats[classification.type] = 
        (classificationStats[classification.type] || 0) + 1;
      
      return {
        ...state,
        activeSignals,
        classificationStats,
        totalSignalsProcessed: state.totalSignalsProcessed + 1,
        lastProcessed: now
      };
    });
    
    return processed;
  }
  
  /**
   * Classify signal based on frequency and characteristics
   */
  private classifySignal(signal: SignalDetection): {
    type: string;
    confidence: number;
  } {
    let bestMatch = 'Unknown';
    let bestConfidence = 0;
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      let confidence = 0;
      let matches = 0;
      let checks = 0;
      
      // Check frequency range
      if (Array.isArray(pattern.freqRange[0])) {
        // Multiple ranges
        const ranges = pattern.freqRange as number[][];
        for (const range of ranges) {
          checks++;
          if (Array.isArray(range) && range.length >= 2 && 
              signal.frequency >= range[0] && signal.frequency <= range[1]) {
            matches++;
            break;
          }
        }
      } else {
        // Single range
        checks++;
        const range = pattern.freqRange as number[];
        if (Array.isArray(range) && range.length >= 2 && 
            signal.frequency >= range[0] && signal.frequency <= range[1]) {
          matches++;
        }
      }
      
      // Check bandwidth
      if (pattern.bandwidth && signal.bandwidth && Array.isArray(pattern.bandwidth)) {
        checks++;
        for (const bw of pattern.bandwidth) {
          if (typeof bw === 'number' && bw > 0 && 
              Math.abs(signal.bandwidth - bw) / bw < 0.2) { // 20% tolerance
            matches++;
            break;
          }
        }
      }
      
      // Check modulation if available
      if (pattern.modulation && signal.modulation) {
        checks++;
        if (signal.modulation === pattern.modulation) {
          matches++;
        }
      }
      
      confidence = checks > 0 ? matches / checks : 0;
      
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = type;
      }
    }
    
    // If no good match, try to classify by frequency alone
    if (bestConfidence < this.options.confidenceThreshold) {
      bestMatch = this.getFrequencyBandName(signal.frequency);
      bestConfidence = 0.5; // Lower confidence for generic classification
    }
    
    return {
      type: bestMatch,
      confidence: bestConfidence
    };
  }
  
  /**
   * Get generic frequency band name
   */
  private getFrequencyBandName(frequency: number): string {
    const freq = frequency / 1e6; // Convert to MHz
    
    if (freq < 30) return 'HF';
    if (freq < 300) return 'VHF';
    if (freq < 3000) return 'UHF';
    if (freq < 30000) return 'SHF';
    return 'EHF';
  }
  
  /**
   * Update signal database
   */
  private updateSignalDatabase(signal: ProcessedSignal): void {
    const key = signal.frequency.toFixed(0);
    
    this.state.update(state => {
      const database = { ...state.signalDatabase };
      
      if (database[key]) {
        // Update existing entry
        const entry = database[key];
        if (entry) {
          entry.lastSeen = Date.now();
          entry.avgPower = (entry.avgPower * entry.occurrences + signal.power) / 
                           (entry.occurrences + 1);
          entry.maxPower = Math.max(entry.maxPower, signal.power);
          entry.occurrences++;
          
          // Update classification if more confident
          if (signal.confidence > entry.confidence) {
            entry.classification = signal.classification;
            entry.confidence = signal.confidence;
          }
        }
      } else {
        // Create new entry
        database[key] = {
          lastSeen: Date.now(),
          avgPower: signal.power,
          maxPower: signal.power,
          occurrences: 1,
          classification: signal.classification,
          confidence: signal.confidence
        };
      }
      
      // Limit database size to prevent memory exhaustion
      const dbSize = Object.keys(database).length;
      if (dbSize > 1000) {
        // Keep only the 500 most recent signals
        const entries = Object.entries(database)
          .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
          .slice(0, 500);
        
        const newDatabase: SignalDatabase = {};
        entries.forEach(([key, value]) => {
          if (key && value) {
            newDatabase[key] = value;
          }
        });
        
        // [SignalProcessor] Cleaned signal database: ${dbSize} -> 500 entries
        return { ...state, signalDatabase: newDatabase };
      }
      
      return { ...state, signalDatabase: database };
    });
  }
  
  /**
   * Get signal history for a frequency
   */
  getSignalHistory(frequency: number, tolerance?: number): Array<{ frequency: number; lastSeen: number; avgPower: number; maxPower: number; occurrences: number; classification: string; confidence: number }> {
    const tol = tolerance || this.options.frequencyTolerance;
    const currentState: ProcessorState = get(this.state);
    
    const history: Array<{ frequency: number; lastSeen: number; avgPower: number; maxPower: number; occurrences: number; classification: string; confidence: number }> = [];
    
    for (const [freq, data] of Object.entries(currentState.signalDatabase)) {
      const parsedFreq = parseFloat(freq);
      if (!isNaN(parsedFreq) && Math.abs(parsedFreq - frequency) <= tol) {
        history.push({
          frequency: parsedFreq,
          ...data
        });
      }
    }
    
    return history;
  }
  
  /**
   * Export signal database
   */
  exportDatabase(): string {
    const currentState: ProcessorState = get(this.state);
    
    const data = {
      exportDate: new Date().toISOString(),
      totalSignals: currentState.totalSignalsProcessed,
      classificationStats: currentState.classificationStats,
      signals: Object.entries(currentState.signalDatabase).map(([freq, data]) => {
        const parsedFreq = parseFloat(freq);
        return {
          frequency: isNaN(parsedFreq) ? 0 : parsedFreq,
          ...data
        };
      })
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.state.set({
      activeSignals: [],
      signalDatabase: {},
      classificationStats: {},
      totalSignalsProcessed: 0,
      lastProcessed: Date.now()
    });
  }
  
  /**
   * Get frequency bands (compatibility method)
   * Returns the patterns as band definitions
   */
  getBands(): Array<{ id: string; name: string; freqRange: number[] | number[][]; bandwidth: number[]; modulation: string }> {
    return Object.entries(this.patterns).map(([name, pattern]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      freqRange: pattern.freqRange,
      bandwidth: pattern.bandwidth,
      modulation: pattern.modulation
    }));
  }
}

// Export singleton instance
export const signalProcessor = new SignalProcessor();