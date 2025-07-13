/**
 * Data Stream Manager
 * Manages real-time data streaming between services
 */

import { writable, type Writable, type Readable, derived } from 'svelte/store';
// Import types are defined locally to avoid circular dependencies

interface StreamSubscription {
  id: string;
  stream: string;
  callback: (data: unknown) => void;
  filter?: (data: unknown) => boolean;
  active: boolean;
}

interface StreamStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesDropped: number;
  bytesReceived: number;
  lastMessage: number;
  averageLatency: number;
}

interface StreamState {
  streams: Map<string, StreamStats>;
  subscriptions: Map<string, StreamSubscription>;
  buffers: Map<string, unknown[]>;
  recording: Map<string, boolean>;
  recordings: Map<string, unknown[]>;
}

interface StreamOptions {
  maxBufferSize: number;
  bufferTimeout: number;
  enableRecording: boolean;
  compressionEnabled: boolean;
  latencyTracking: boolean;
}

// Stream types are defined implicitly through usage

class DataStreamManager {
  private state: Writable<StreamState>;
  private options: StreamOptions = {
    maxBufferSize: 1000,
    bufferTimeout: 100,
    enableRecording: false,
    compressionEnabled: false,
    latencyTracking: true
  };
  
  private bufferTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private latencyTrackers: Map<string, number[]> = new Map();
  
  // Public readable stores
  public readonly streamStats: Readable<Map<string, StreamStats>>;
  public readonly activeStreams: Readable<string[]>;
  public readonly totalMessages: Readable<number>;
  
  constructor() {
    this.state = writable({
      streams: new Map(),
      subscriptions: new Map(),
      buffers: new Map(),
      recording: new Map(),
      recordings: new Map()
    });
    
    this.streamStats = derived(this.state, $state => $state.streams);
    this.activeStreams = derived(this.state, $state => 
      Array.from($state.streams.keys()).filter(key => {
        const stats = $state.streams.get(key);
        return stats && Date.now() - stats.lastMessage < 5000;
      })
    );
    this.totalMessages = derived(this.state, $state => {
      let total = 0;
      $state.streams.forEach(stats => {
        total += stats.messagesReceived;
      });
      return total;
    });
  }
  
  /**
   * Initialize the stream manager
   */
  initialize(): void {
    // Register default streams
    this.registerStream('hackrf_spectrum');
    this.registerStream('hackrf_signals');
    this.registerStream('kismet_devices');
    this.registerStream('kismet_status');
    this.registerStream('system_health');
  }
  
  /**
   * Configure stream options
   */
  setOptions(options: Partial<StreamOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Register a new stream
   */
  registerStream(streamName: string): void {
    this.state.update(state => {
      if (!state.streams.has(streamName)) {
        state.streams.set(streamName, {
          messagesReceived: 0,
          messagesProcessed: 0,
          messagesDropped: 0,
          bytesReceived: 0,
          lastMessage: 0,
          averageLatency: 0
        });
        state.buffers.set(streamName, []);
        state.recording.set(streamName, false);
        state.recordings.set(streamName, []);
      }
      return state;
    });
  }
  
  /**
   * Subscribe to a stream
   */
  subscribe(
    streamName: string, 
    callback: (data: unknown) => void,
    filter?: (data: unknown) => boolean
  ): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random()}`;
    
    this.state.update(state => {
      state.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        stream: streamName,
        callback,
        filter,
        active: true
      });
      return state;
    });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from a stream
   */
  unsubscribe(subscriptionId: string): void {
    this.state.update(state => {
      state.subscriptions.delete(subscriptionId);
      return state;
    });
  }
  
  /**
   * Publish data to a stream
   */
  publish(streamName: string, data: unknown, timestamp?: number): void {
    const publishTime = timestamp || Date.now();
    
    this.state.update(state => {
      // Update stream stats
      const stats = state.streams.get(streamName);
      if (stats) {
        stats.messagesReceived++;
        stats.bytesReceived += this.estimateSize(data);
        stats.lastMessage = publishTime;
        
        // Track latency
        if (this.options.latencyTracking && data && typeof data === 'object' && 'timestamp' in data) {
          const timestampValue = (data as { timestamp: unknown }).timestamp;
          if (timestampValue && (typeof timestampValue === 'string' || typeof timestampValue === 'number')) {
            const latency = publishTime - new Date(timestampValue).getTime();
            this.updateLatency(streamName, latency);
            stats.averageLatency = this.getAverageLatency(streamName);
          }
        }
      }
      
      // Add to buffer
      const buffer = state.buffers.get(streamName) || [];
      buffer.push({ data, timestamp: publishTime });
      
      // Trim buffer if needed
      if (buffer.length > this.options.maxBufferSize) {
        const dropped = buffer.length - this.options.maxBufferSize;
        buffer.splice(0, dropped);
        if (stats) {
          stats.messagesDropped += dropped;
        }
      }
      
      state.buffers.set(streamName, buffer);
      
      // Handle recording
      if (state.recording.get(streamName)) {
        const recordings = state.recordings.get(streamName) || [];
        recordings.push({ data, timestamp: publishTime });
        state.recordings.set(streamName, recordings);
      }
      
      return state;
    });
    
    // Process subscriptions
    this.processSubscriptions(streamName, data);
    
    // Schedule buffer flush
    this.scheduleBufferFlush(streamName);
  }
  
  /**
   * Batch publish multiple data items
   */
  batchPublish(streamName: string, dataArray: unknown[]): void {
    const timestamp = Date.now();
    
    dataArray.forEach((data, index) => {
      this.publish(streamName, data, timestamp + index);
    });
  }
  
  /**
   * Process subscriptions for a stream
   */
  private processSubscriptions(streamName: string, data: unknown): void {
    let subscriptions: StreamSubscription[] = [];
    
    this.state.subscribe(state => {
      subscriptions = Array.from(state.subscriptions.values())
        .filter(sub => sub.stream === streamName && sub.active);
    })();
    
    subscriptions.forEach(sub => {
      try {
        if (!sub.filter || sub.filter(data)) {
          sub.callback(data);
          
          // Update processed count
          this.state.update(state => {
            const stats = state.streams.get(streamName);
            if (stats) {
              stats.messagesProcessed++;
            }
            return state;
          });
        }
      } catch (error) {
        console.error(`Subscription ${sub.id} error:`, error);
      }
    });
  }
  
  /**
   * Schedule buffer flush
   */
  private scheduleBufferFlush(streamName: string): void {
    // Clear existing timeout
    const existingTimeout = this.bufferTimeouts.get(streamName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule new flush
    const timeout = setTimeout(() => {
      this.flushBuffer(streamName);
    }, this.options.bufferTimeout);
    
    this.bufferTimeouts.set(streamName, timeout);
  }
  
  /**
   * Flush stream buffer
   */
  private flushBuffer(streamName: string): void {
    this.state.update(state => {
      state.buffers.set(streamName, []);
      return state;
    });
    
    this.bufferTimeouts.delete(streamName);
  }
  
  /**
   * Get buffered data for a stream
   */
  getBuffer(streamName: string): unknown[] {
    let buffer: unknown[] = [];
    
    this.state.subscribe(state => {
      buffer = state.buffers.get(streamName) || [];
    })();
    
    return buffer;
  }
  
  /**
   * Start recording a stream
   */
  startRecording(streamName: string): void {
    this.state.update(state => {
      state.recording.set(streamName, true);
      state.recordings.set(streamName, []);
      return state;
    });
  }
  
  /**
   * Stop recording a stream
   */
  stopRecording(streamName: string): unknown[] {
    let recording: unknown[] = [];
    
    this.state.update(state => {
      state.recording.set(streamName, false);
      recording = state.recordings.get(streamName) || [];
      state.recordings.set(streamName, []);
      return state;
    });
    
    return recording;
  }
  
  /**
   * Export stream recording
   */
  exportRecording(streamName: string, format: 'json' | 'csv' = 'json'): string {
    const recording = this.stopRecording(streamName);
    
    if (format === 'json') {
      return JSON.stringify({
        stream: streamName,
        recordedAt: new Date().toISOString(),
        dataPoints: recording.length,
        data: recording
      }, null, 2);
    } else {
      // CSV format - simplified for general data
      const headers = ['timestamp', 'data'];
      const rows = recording.map((item: unknown) => {
        const recordItem = item as { timestamp?: unknown; data?: unknown };
        return [
          recordItem.timestamp || '',
          JSON.stringify(recordItem.data || '')
        ];
      });
      
      return [headers, ...rows].map(row => (row as string[]).join(',')).join('\n');
    }
  }
  
  /**
   * Create a filtered stream
   */
  createFilteredStream(
    sourceStream: string,
    targetStream: string,
    filter: (data: unknown) => boolean
  ): string {
    this.registerStream(targetStream);
    
    return this.subscribe(sourceStream, (data) => {
      if (filter(data)) {
        this.publish(targetStream, data);
      }
    });
  }
  
  /**
   * Create a transformed stream
   */
  createTransformedStream<T, U>(
    sourceStream: string,
    targetStream: string,
    transformer: (data: T) => U
  ): string {
    this.registerStream(targetStream);
    
    return this.subscribe(sourceStream, (data: unknown) => {
      try {
        const transformed = transformer(data as T);
        this.publish(targetStream, transformed);
      } catch (error) {
        console.error('Transform error:', error);
      }
    });
  }
  
  /**
   * Merge multiple streams
   */
  mergeStreams(
    sourceStreams: string[],
    targetStream: string,
    merger?: (data: unknown[]) => unknown
  ): string[] {
    this.registerStream(targetStream);
    const subscriptionIds: string[] = [];
    
    sourceStreams.forEach(stream => {
      const subId = this.subscribe(stream, (data) => {
        if (merger) {
          // Custom merger logic would go here
          this.publish(targetStream, data);
        } else {
          // Default: pass through with source info
          this.publish(targetStream, { source: stream, data });
        }
      });
      subscriptionIds.push(subId);
    });
    
    return subscriptionIds;
  }
  
  /**
   * Update latency tracking
   */
  private updateLatency(streamName: string, latency: number): void {
    const trackers = this.latencyTrackers.get(streamName) || [];
    trackers.push(latency);
    
    // Keep only last 100 measurements
    if (trackers.length > 100) {
      trackers.shift();
    }
    
    this.latencyTrackers.set(streamName, trackers);
  }
  
  /**
   * Get average latency
   */
  private getAverageLatency(streamName: string): number {
    const trackers = this.latencyTrackers.get(streamName) || [];
    if (trackers.length === 0) return 0;
    
    const sum = trackers.reduce((a, b) => a + b, 0);
    return sum / trackers.length;
  }
  
  /**
   * Estimate data size
   */
  private estimateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  
  /**
   * Get stream statistics
   */
  getStreamStats(streamName: string): StreamStats | null {
    let stats: StreamStats | null = null;
    
    this.state.subscribe(state => {
      stats = state.streams.get(streamName) || null;
    })();
    
    return stats;
  }
  
  /**
   * Reset stream statistics
   */
  resetStats(streamName?: string): void {
    this.state.update(state => {
      if (streamName) {
        const stats = state.streams.get(streamName);
        if (stats) {
          stats.messagesReceived = 0;
          stats.messagesProcessed = 0;
          stats.messagesDropped = 0;
          stats.bytesReceived = 0;
        }
      } else {
        // Reset all streams
        state.streams.forEach(stats => {
          stats.messagesReceived = 0;
          stats.messagesProcessed = 0;
          stats.messagesDropped = 0;
          stats.bytesReceived = 0;
        });
      }
      return state;
    });
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timeouts
    this.bufferTimeouts.forEach(timeout => clearTimeout(timeout));
    this.bufferTimeouts.clear();
    
    // Clear all data
    this.state.set({
      streams: new Map(),
      subscriptions: new Map(),
      buffers: new Map(),
      recording: new Map(),
      recordings: new Map()
    });
  }
}

// Export singleton instance
export const dataStreamManager = new DataStreamManager();