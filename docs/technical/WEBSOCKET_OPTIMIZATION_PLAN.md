# WebSocket Data Flow Optimization Plan

## Executive Summary

This plan outlines comprehensive strategies to optimize WebSocket data flow in the ArgosFinal project, focusing on bandwidth reduction and performance improvements across HackRF spectrum analysis and Kismet device tracking systems.

## 1. Data Compression Strategies

### 1.1 Message-Level Compression

- **Current State**: Basic perMessageDeflate enabled with default settings
- **Optimization**:
    ```typescript
    // Enhanced compression configuration
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 6,              // Increase from 3 to 6 for better compression
        memLevel: 8,           // Increase from 7 to 8
        strategy: 2            // Z_HUFFMAN_ONLY for spectrum data
      },
      threshold: 256,          // Decrease from 1024 for aggressive compression
      clientNoContextTakeover: false,  // Enable context for better compression
      serverNoContextTakeover: false
    }
    ```

### 1.2 Binary Protocol Implementation

- Replace JSON with MessagePack or Protocol Buffers for 30-50% size reduction
- Implement custom binary format for spectrum data:
    ```typescript
    // Binary format: [header(4)] [timestamp(8)] [freq_count(2)] [frequencies(4*n)] [power_values(2*n)]
    interface BinarySpectrumData {
    	toBuffer(): ArrayBuffer;
    	fromBuffer(buffer: ArrayBuffer): SpectrumData;
    }
    ```

### 1.3 Field-Specific Compression

- Delta encoding for sequential frequency values
- Quantization of power values (16-bit floats instead of 64-bit)
- Run-length encoding for sparse data regions

## 2. Throttling/Batching Mechanisms

### 2.1 Adaptive Rate Control

```typescript
interface AdaptiveThrottle {
  baseRate: number;        // 30 Hz for local, 10 Hz for remote
  congestionMultiplier: number;  // 0.1 to 1.0 based on RTT
  bufferThreshold: number;       // Pause if buffer > threshold

  calculateRate(): number {
    const rtt = this.measureRTT();
    const bufferPressure = this.getBufferPressure();
    return this.baseRate * this.congestionMultiplier * (1 - bufferPressure);
  }
}
```

### 2.2 Message Batching

```typescript
class MessageBatcher {
	private queue: Message[] = [];
	private batchSize = 10;
	private batchInterval = 100; // ms

	add(message: Message) {
		this.queue.push(message);
		if (this.queue.length >= this.batchSize) {
			this.flush();
		}
	}

	flush() {
		if (this.queue.length === 0) return;

		const batch = {
			type: 'batch',
			messages: this.queue,
			timestamp: Date.now()
		};

		this.send(batch);
		this.queue = [];
	}
}
```

### 2.3 Priority-Based Throttling

- High priority: Alerts, emergency stops (no throttling)
- Medium priority: Status updates (10 Hz max)
- Low priority: Spectrum data (adaptive throttling)

## 3. Delta Encoding for Updates

### 3.1 Spectrum Data Delta Encoding

```typescript
class SpectrumDeltaEncoder {
	private baseline: Float32Array | null = null;
	private keyframeInterval = 30; // Send full frame every 30 deltas
	private frameCount = 0;

	encode(power: Float32Array): DeltaFrame | KeyFrame {
		this.frameCount++;

		if (!this.baseline || this.frameCount % this.keyframeInterval === 0) {
			this.baseline = power.slice();
			return { type: 'keyframe', data: power };
		}

		const delta = new Int16Array(power.length);
		for (let i = 0; i < power.length; i++) {
			delta[i] = Math.round((power[i] - this.baseline[i]) * 100);
		}

		return { type: 'delta', data: delta };
	}
}
```

### 3.2 Device Update Deltas

```typescript
interface DeviceDelta {
	mac: string;
	changes: {
		field: string;
		oldValue: any;
		newValue: any;
	}[];
	timestamp: number;
}
```

### 3.3 Predictive Delta Compression

- Linear prediction for smooth spectrum changes
- Kalman filtering for device position updates
- Send only prediction errors when within threshold

## 4. Client-Side Buffering Improvements

### 4.1 Ring Buffer Implementation

```typescript
class AdaptiveRingBuffer<T> {
	private buffer: T[];
	private size: number;
	private writeIndex = 0;
	private readIndex = 0;

	constructor(initialSize: number = 100) {
		this.size = initialSize;
		this.buffer = new Array(this.size);
	}

	// Dynamic resizing based on consumption rate
	private resize() {
		const fillRate = this.getFillRate();
		if (fillRate > 0.9 && this.size < 1000) {
			this.size *= 2;
		} else if (fillRate < 0.1 && this.size > 50) {
			this.size /= 2;
		}
	}
}
```

### 4.2 Jitter Buffer

```typescript
class JitterBuffer {
	private targetDelay = 100; // ms
	private adaptiveDelay = this.targetDelay;

	adjustDelay(jitter: number) {
		// Increase delay if jitter is high
		this.adaptiveDelay = this.targetDelay + jitter * 2;
	}

	shouldRelease(packet: TimestampedPacket): boolean {
		const age = Date.now() - packet.timestamp;
		return age >= this.adaptiveDelay;
	}
}
```

### 4.3 Prefetch and Cache Strategy

- Prefetch historical data during idle periods
- LRU cache for frequently accessed spectrum ranges
- Predictive prefetching based on user interaction patterns

## 5. Selective Data Streaming Based on Zoom Level

### 5.1 Level-of-Detail (LOD) System

```typescript
interface LODConfig {
	zoomLevel: number;
	frequencyResolution: number; // Hz per bin
	updateRate: number; // Hz
	powerPrecision: number; // decimal places
}

const LOD_LEVELS: LODConfig[] = [
	{ zoomLevel: 0, frequencyResolution: 1000000, updateRate: 1, powerPrecision: 0 }, // Overview
	{ zoomLevel: 1, frequencyResolution: 100000, updateRate: 5, powerPrecision: 1 }, // Regional
	{ zoomLevel: 2, frequencyResolution: 10000, updateRate: 10, powerPrecision: 2 }, // Local
	{ zoomLevel: 3, frequencyResolution: 1000, updateRate: 30, powerPrecision: 3 } // Detailed
];
```

### 5.2 Viewport-Based Streaming

```typescript
class ViewportManager {
	private viewport: FrequencyRange;
	private margin = 0.2; // 20% margin outside viewport

	getDataRequest(): DataRequest {
		const expanded = this.expandViewport(this.viewport, this.margin);
		const lod = this.calculateLOD(expanded);

		return {
			startFreq: expanded.start,
			endFreq: expanded.end,
			resolution: lod.frequencyResolution,
			updateRate: lod.updateRate
		};
	}
}
```

### 5.3 Progressive Data Loading

- Initial low-resolution sweep of entire range
- Progressive refinement of visible areas
- Background loading of adjacent regions
- Tile-based caching system

## Implementation Priority

1. **Phase 1 (Week 1-2)**:
    - Implement binary protocol for spectrum data
    - Add basic delta encoding
    - Enhance client-side buffering

2. **Phase 2 (Week 3-4)**:
    - Implement adaptive throttling
    - Add message batching
    - Implement LOD system

3. **Phase 3 (Week 5-6)**:
    - Advanced compression strategies
    - Predictive delta encoding
    - Viewport-based streaming

4. **Phase 4 (Week 7-8)**:
    - Performance testing and optimization
    - Fine-tuning of parameters
    - Documentation and deployment

## Expected Results

- **Bandwidth Reduction**: 60-80% for typical usage patterns
- **Latency Improvement**: 30-50% reduction in perceived latency
- **CPU Usage**: 20-30% reduction on client side
- **Memory Usage**: 40% reduction through efficient buffering
- **Scalability**: Support for 10x more concurrent connections

## Monitoring and Metrics

Key metrics to track:

- Bytes per second (in/out)
- Message rate (per second)
- Compression ratio
- Client-side frame drops
- Buffer utilization
- Round-trip time (RTT)
- Jitter measurements

## Risk Mitigation

- Fallback to JSON for compatibility
- Graceful degradation under high load
- Automatic quality adjustment based on connection
- Client-side data validation
- Server-side rate limiting
