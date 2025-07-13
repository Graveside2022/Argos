/**
 * Signal Aggregator for Simple Tactical Map
 * Aggregates HackRF spectrum data into meaningful signals
 */

export interface AggregatedSignal {
  frequency: number;  // MHz
  power: number;      // dBm (average)
  count: number;      // Number of detections
  firstSeen: number;  // Timestamp
  lastSeen: number;   // Timestamp
}

export class SignalAggregator {
  private signalBuffer: Map<number, AggregatedSignal> = new Map();
  private lastFlush: number = Date.now();
  private readonly flushInterval = 1000; // 1 second
  private readonly frequencyTolerance = 1.0; // ±1 MHz
  private readonly minPower = -80; // dBm threshold
  
  /**
   * Add spectrum data to aggregator
   */
  addSpectrumData(data: {
    peak_freq?: number;
    peak_power?: number;
    centerFreq?: number;
    avg_power?: number;
  }): void {
    const freq = data.peak_freq || data.centerFreq;
    const power = data.peak_power || data.avg_power;
    
    if (!freq || !power || power < this.minPower) {
      return;
    }
    
    // Round frequency to nearest MHz for grouping
    const binFreq = Math.round(freq);
    
    const existing = this.signalBuffer.get(binFreq);
    if (existing) {
      // Update existing signal
      existing.power = (existing.power * existing.count + power) / (existing.count + 1);
      existing.count++;
      existing.lastSeen = Date.now();
    } else {
      // Create new signal
      this.signalBuffer.set(binFreq, {
        frequency: freq,
        power: power,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
  }
  
  /**
   * Check if frequency matches target (with tolerance)
   */
  matchesTargetFrequency(signalFreq: number, targetFreq: number): boolean {
    return Math.abs(signalFreq - targetFreq) <= this.frequencyTolerance;
  }
  
  /**
   * Get aggregated signals and clear buffer if interval elapsed
   */
  getAggregatedSignals(targetFrequency?: number): AggregatedSignal[] {
    const now = Date.now();
    const shouldFlush = (now - this.lastFlush) >= this.flushInterval;
    
    if (!shouldFlush && this.signalBuffer.size === 0) {
      return [];
    }
    
    // Filter by target frequency if specified
    let signals = Array.from(this.signalBuffer.values());
    if (targetFrequency) {
      signals = signals.filter(s => 
        this.matchesTargetFrequency(s.frequency, targetFrequency)
      );
    }
    
    // Clear buffer if flush interval elapsed
    if (shouldFlush) {
      this.signalBuffer.clear();
      this.lastFlush = now;
    }
    
    return signals;
  }
  
  /**
   * Force flush the buffer
   */
  flush(): AggregatedSignal[] {
    const signals = Array.from(this.signalBuffer.values());
    this.signalBuffer.clear();
    this.lastFlush = Date.now();
    return signals;
  }
  
  /**
   * Get signal persistence in seconds
   */
  getSignalPersistence(signal: AggregatedSignal): number {
    return (signal.lastSeen - signal.firstSeen) / 1000;
  }
}