/**
 * Time-based Signal Filtering Service
 * Manages sliding time windows for signal relevance in drone operations
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import type { SignalDetection } from '$lib/services/api/hackrf';

export interface TimeWindowConfig {
  windowDuration: number; // Duration in seconds
  fadeStartPercent: number; // When to start fading (0-100)
  updateInterval: number; // How often to update in ms
  maxSignalAge: number; // Maximum age before removal in seconds
}

export interface TimedSignal extends SignalDetection {
  id: string;
  firstSeen: number;
  lastSeen: number;
  age: number; // Age in seconds
  opacity: number; // 0-1 for fade effect
  relevance: number; // 0-1 relevance score
  isExpiring: boolean;
  timeToLive: number; // Seconds until removal
}

export interface TimeWindowState {
  signals: Map<string, TimedSignal>;
  activeCount: number;
  expiringCount: number;
  oldestSignal: number;
  newestSignal: number;
  windowStart: number;
  windowEnd: number;
}

export interface TimeWindowStats {
  totalSignals: number;
  activeSignals: number;
  fadingSignals: number;
  expiredSignals: number;
  averageAge: number;
  signalTurnover: number; // Signals per second
}

class TimeWindowFilter {
  private config: TimeWindowConfig = {
    windowDuration: 30, // 30 seconds default
    fadeStartPercent: 60, // Start fading at 60% of window
    updateInterval: 100, // Update every 100ms
    maxSignalAge: 45 // Remove after 45 seconds
  };

  private state: Writable<TimeWindowState> = writable({
    signals: new Map(),
    activeCount: 0,
    expiringCount: 0,
    oldestSignal: Date.now(),
    newestSignal: Date.now(),
    windowStart: Date.now() - this.config.windowDuration * 1000,
    windowEnd: Date.now()
  });

  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private signalHistory: TimedSignal[] = [];
  private turnoverRate = 0;
  private lastTurnoverCheck = Date.now();

  // Public stores
  public readonly signals: Readable<TimedSignal[]>;
  public readonly activeSignals: Readable<TimedSignal[]>;
  public readonly fadingSignals: Readable<TimedSignal[]>;
  public readonly stats: Readable<TimeWindowStats>;

  constructor() {
    // Derive filtered signal arrays
    this.signals = derived(this.state, $state => 
      Array.from($state.signals.values())
        .sort((a, b) => b.power - a.power) // Sort by power (strongest first)
    );

    this.activeSignals = derived(this.state, $state =>
      Array.from($state.signals.values())
        .filter(s => s.opacity === 1 && !s.isExpiring)
        .sort((a, b) => b.power - a.power)
    );

    this.fadingSignals = derived(this.state, $state =>
      Array.from($state.signals.values())
        .filter(s => s.isExpiring || s.opacity < 1)
        .sort((a, b) => b.age - a.age) // Oldest first
    );

    this.stats = derived(this.state, $state => {
      const signals = Array.from($state.signals.values());
      const totalAge = signals.reduce((sum, s) => sum + s.age, 0);
      
      return {
        totalSignals: signals.length,
        activeSignals: signals.filter(s => !s.isExpiring).length,
        fadingSignals: signals.filter(s => s.isExpiring).length,
        expiredSignals: this.signalHistory.length,
        averageAge: signals.length > 0 ? totalAge / signals.length : 0,
        signalTurnover: this.turnoverRate
      };
    });

    // Start update timer
    this.startUpdateTimer();
  }

  /**
   * Configure time window parameters
   */
  setConfig(config: Partial<TimeWindowConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart timer if interval changed
    if (config.updateInterval !== undefined) {
      this.stopUpdateTimer();
      this.startUpdateTimer();
    }

    // Update window bounds
    this.updateWindowBounds();
  }

  /**
   * Add or update a signal
   */
  addSignal(signal: SignalDetection): TimedSignal {
    const now = Date.now();
    const id = this.generateSignalId(signal);
    
    this.state.update(state => {
      const existing = state.signals.get(id);
      
      const timedSignal: TimedSignal = existing ? {
        ...existing,
        ...signal,
        lastSeen: now,
        age: (now - existing.firstSeen) / 1000
      } : {
        ...signal,
        id,
        firstSeen: now,
        lastSeen: now,
        age: 0,
        opacity: 1,
        relevance: 1,
        isExpiring: false,
        timeToLive: this.config.maxSignalAge
      };

      state.signals.set(id, timedSignal);
      state.newestSignal = now;
      
      if (!existing) {
        this.updateTurnoverRate(1);
      }

      return this.recalculateState(state);
    });

    const storedSignal = get(this.state).signals.get(id);
    if (!storedSignal) throw new Error(`Signal ${id} not found`);
    return storedSignal;
  }

  /**
   * Batch add signals
   */
  addSignalBatch(signals: SignalDetection[]): void {
    this.state.update(state => {
      const now = Date.now();
      let newCount = 0;

      for (const signal of signals) {
        const id = this.generateSignalId(signal);
        const existing = state.signals.get(id);

        const timedSignal: TimedSignal = existing ? {
          ...existing,
          ...signal,
          lastSeen: now,
          age: (now - existing.firstSeen) / 1000
        } : {
          ...signal,
          id,
          firstSeen: now,
          lastSeen: now,
          age: 0,
          opacity: 1,
          relevance: 1,
          isExpiring: false,
          timeToLive: this.config.maxSignalAge
        };

        state.signals.set(id, timedSignal);
        
        if (!existing) {
          newCount++;
        }
      }

      state.newestSignal = now;
      
      if (newCount > 0) {
        this.updateTurnoverRate(newCount);
      }

      return this.recalculateState(state);
    });
  }

  /**
   * Get signals within a custom time range
   */
  getSignalsInRange(startTime: number, endTime: number): TimedSignal[] {
    const state = get(this.state);
    return Array.from(state.signals.values())
      .filter(s => s.lastSeen >= startTime && s.lastSeen <= endTime)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Get signal age distribution
   */
  getAgeDistribution(buckets: number = 10): { age: number; count: number }[] {
    const state = get(this.state);
    const signals = Array.from(state.signals.values());
    
    if (signals.length === 0) return [];

    const maxAge = Math.max(...signals.map(s => s.age));
    const bucketSize = maxAge / buckets;
    const distribution = new Array<number>(buckets).fill(0);

    signals.forEach(signal => {
      const bucketIndex = Math.min(
        Math.floor(signal.age / bucketSize),
        buckets - 1
      );
      distribution[bucketIndex]++;
    });

    return distribution.map((count, i) => ({
      age: (i + 0.5) * bucketSize,
      count
    }));
  }

  /**
   * Clear all signals
   */
  clear(): void {
    this.state.update(state => {
      const expiredCount = state.signals.size;
      
      // Archive to history
      state.signals.forEach(signal => {
        this.signalHistory.push(signal);
      });

      // Keep only recent history
      if (this.signalHistory.length > 1000) {
        this.signalHistory = this.signalHistory.slice(-500);
      }

      state.signals.clear();
      this.updateTurnoverRate(-expiredCount);

      return this.recalculateState(state);
    });
  }

  /**
   * Clear signals older than specified age
   */
  clearOlderThan(ageSeconds: number): number {
    let removed = 0;
    
    this.state.update(state => {
      const toRemove: string[] = [];
      
      state.signals.forEach((signal, id) => {
        if (signal.age > ageSeconds) {
          toRemove.push(id);
          this.signalHistory.push(signal);
        }
      });

      toRemove.forEach(id => state.signals.delete(id));
      removed = toRemove.length;
      
      if (removed > 0) {
        this.updateTurnoverRate(-removed);
      }

      return this.recalculateState(state);
    });

    return removed;
  }

  /**
   * Export current state for analysis
   */
  exportState(): { 
    timestamp: number; 
    signals: Array<{ 
      id: string; 
      frequency: number; 
      power: number; 
      age: number; 
      opacity: number; 
      relevance: number; 
      firstSeen: number; 
      lastSeen: number 
    }>; 
    stats: TimeWindowStats; 
    config: TimeWindowConfig; 
    ageDistribution: Array<{ age: number; count: number }>; 
    turnoverRate: number 
  } {
    const state = get(this.state);
    const signals = Array.from(state.signals.values());
    const stats = get(this.stats);

    return {
      timestamp: Date.now(),
      config: this.config,
      stats: stats,
      signals: signals.map(s => ({
        id: s.id,
        frequency: s.frequency,
        power: s.power,
        age: s.age,
        opacity: s.opacity,
        relevance: s.relevance,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen
      })),
      ageDistribution: this.getAgeDistribution(),
      turnoverRate: this.turnoverRate
    };
  }

  /**
   * Private methods
   */
  private startUpdateTimer(): void {
    this.updateTimer = setInterval(() => {
      this.updateSignals();
    }, this.config.updateInterval);
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  private updateSignals(): void {
    this.state.update(state => {
      const now = Date.now();
      const toRemove: string[] = [];

      state.signals.forEach((signal, id) => {
        // Update age
        signal.age = (now - signal.firstSeen) / 1000;
        signal.timeToLive = this.config.maxSignalAge - signal.age;

        // Calculate relevance and opacity
        const agePercent = (signal.age / this.config.windowDuration) * 100;
        
        if (signal.age > this.config.maxSignalAge) {
          // Signal is too old, mark for removal
          toRemove.push(id);
          this.signalHistory.push(signal);
        } else if (agePercent >= this.config.fadeStartPercent) {
          // Signal is fading
          signal.isExpiring = true;
          const fadePercent = (agePercent - this.config.fadeStartPercent) / 
                             (100 - this.config.fadeStartPercent);
          signal.opacity = Math.max(0.1, 1 - fadePercent);
          signal.relevance = signal.opacity;
        } else {
          // Signal is active
          signal.isExpiring = false;
          signal.opacity = 1;
          signal.relevance = 1;
        }
      });

      // Remove expired signals
      toRemove.forEach(id => state.signals.delete(id));
      
      if (toRemove.length > 0) {
        this.updateTurnoverRate(-toRemove.length);
      }

      // Update window bounds
      state.windowEnd = now;
      state.windowStart = now - (this.config.windowDuration * 1000);

      return this.recalculateState(state);
    });
  }

  private updateWindowBounds(): void {
    this.state.update(state => {
      const now = Date.now();
      state.windowEnd = now;
      state.windowStart = now - (this.config.windowDuration * 1000);
      return state;
    });
  }

  private recalculateState(state: TimeWindowState): TimeWindowState {
    const signals = Array.from(state.signals.values());
    
    state.activeCount = signals.filter(s => !s.isExpiring).length;
    state.expiringCount = signals.filter(s => s.isExpiring).length;
    
    if (signals.length > 0) {
      state.oldestSignal = Math.min(...signals.map(s => s.firstSeen));
      state.newestSignal = Math.max(...signals.map(s => s.lastSeen));
    }

    return state;
  }

  private generateSignalId(signal: SignalDetection): string {
    // Create unique ID based on frequency and approximate location
    const freqBin = Math.floor(signal.frequency / 1e6); // 1 MHz bins
    const powerBin = Math.floor(signal.power / 5) * 5; // 5 dB bins
    return `${freqBin}_${powerBin}_${signal.timestamp}`;
  }

  private updateTurnoverRate(change: number): void {
    const now = Date.now();
    const timeDiff = (now - this.lastTurnoverCheck) / 1000;
    
    if (timeDiff > 0) {
      // Exponential moving average
      const instantRate = Math.abs(change) / timeDiff;
      this.turnoverRate = this.turnoverRate * 0.9 + instantRate * 0.1;
      this.lastTurnoverCheck = now;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopUpdateTimer();
    this.signalHistory = [];
  }
}

// Export singleton instance
export const timeWindowFilter = new TimeWindowFilter();

// Helper functions for UI
export function formatAge(seconds: number): string {
  if (seconds < 1) return 'now';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function getAgeColor(agePercent: number): string {
  if (agePercent < 30) return '#10b981'; // Green
  if (agePercent < 60) return '#f59e0b'; // Amber
  if (agePercent < 80) return '#ef4444'; // Red
  return '#6b7280'; // Gray (expiring)
}

export function getRelevanceIcon(relevance: number): string {
  if (relevance > 0.8) return '●'; // Full circle
  if (relevance > 0.6) return '◐'; // Three-quarters
  if (relevance > 0.4) return '◑'; // Half
  if (relevance > 0.2) return '◒'; // Quarter
  return '○'; // Empty circle
}