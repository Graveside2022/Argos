# Signal Aggregation System Implementation Plan

## Overview

This plan outlines the implementation of a grid-based signal aggregation system for the Argos HackRF project. The system will aggregate RF signals into configurable grid cells to reduce data density while maintaining meaningful information for visualization and analysis.

## Architecture Design

### 1. Grid-Based Aggregation Algorithm

#### Core Components

```typescript
// Grid cell structure
interface GridCell {
	id: string; // Unique cell identifier (e.g., "grid_88.0_108.0_-90_-80")
	freqStart: number; // Start frequency (Hz)
	freqEnd: number; // End frequency (Hz)
	powerMin: number; // Minimum power level (dBm)
	powerMax: number; // Maximum power level (dBm)
	center: {
		frequency: number; // Center frequency
		power: number; // Center power
	};
	statistics: GridCellStatistics;
}

interface GridCellStatistics {
	signalCount: number; // Number of signals in this cell
	avgPower: number; // Average power level
	maxPower: number; // Peak power level
	minPower: number; // Minimum power level
	variance: number; // Power variance
	occupancy: number; // Channel occupancy percentage
	lastUpdated: number; // Timestamp of last update
	classifications: Map<string, number>; // Signal type counts
	timeActive: number; // Total time cell has been active (ms)
	detectionConfidence: number; // Statistical confidence 0-1
}
```

#### Grid Configuration

```typescript
interface GridConfiguration {
	frequencyResolution: number; // Hz per grid cell (e.g., 1 MHz)
	powerResolution: number; // dBm per grid cell (e.g., 10 dBm)
	timeWindow: number; // Aggregation time window (ms)
	minSignalsForCell: number; // Minimum signals to create cell
	mergeSimilarCells: boolean; // Merge adjacent cells with similar stats
	adaptiveGridding: boolean; // Adjust grid based on signal density
}

// Default configurations for different use cases
const GRID_PRESETS = {
	highDetail: {
		frequencyResolution: 100_000, // 100 kHz
		powerResolution: 5, // 5 dBm
		timeWindow: 1000, // 1 second
		minSignalsForCell: 1,
		mergeSimilarCells: false,
		adaptiveGridding: false
	},
	balanced: {
		frequencyResolution: 1_000_000, // 1 MHz
		powerResolution: 10, // 10 dBm
		timeWindow: 5000, // 5 seconds
		minSignalsForCell: 3,
		mergeSimilarCells: true,
		adaptiveGridding: false
	},
	overview: {
		frequencyResolution: 10_000_000, // 10 MHz
		powerResolution: 20, // 20 dBm
		timeWindow: 30000, // 30 seconds
		minSignalsForCell: 5,
		mergeSimilarCells: true,
		adaptiveGridding: true
	}
};
```

### 2. Real-time Aggregation in Signal Processor

#### Enhanced Signal Processor (`signalProcessor.ts`)

```typescript
class SignalAggregator {
	private gridCells: Map<string, GridCell> = new Map();
	private config: GridConfiguration;
	private updateBuffer: SignalDetection[] = [];
	private lastProcessTime: number = Date.now();

	// Spatial index for fast lookup
	private spatialIndex: {
		frequencyIndex: Map<number, Set<string>>; // Frequency band -> cell IDs
		powerIndex: Map<number, Set<string>>; // Power level -> cell IDs
	};

	constructor(config: GridConfiguration) {
		this.config = config;
		this.spatialIndex = {
			frequencyIndex: new Map(),
			powerIndex: new Map()
		};
	}

	// Add signal to aggregation buffer
	addSignal(signal: SignalDetection): void {
		this.updateBuffer.push(signal);

		// Process buffer if time window elapsed or buffer full
		if (
			Date.now() - this.lastProcessTime > this.config.timeWindow ||
			this.updateBuffer.length > 1000
		) {
			this.processBuffer();
		}
	}

	// Process buffered signals into grid cells
	private processBuffer(): void {
		const startTime = performance.now();

		// Group signals by grid cell
		const cellGroups = this.groupSignalsByCells(this.updateBuffer);

		// Update or create grid cells
		for (const [cellKey, signals] of cellGroups) {
			this.updateGridCell(cellKey, signals);
		}

		// Apply adaptive gridding if enabled
		if (this.config.adaptiveGridding) {
			this.adaptiveGridAdjustment();
		}

		// Merge similar cells if enabled
		if (this.config.mergeSimilarCells) {
			this.mergeSimilarGridCells();
		}

		// Clear old cells
		this.pruneInactiveCells();

		// Update metrics
		const processingTime = performance.now() - startTime;
		this.updatePerformanceMetrics(processingTime, this.updateBuffer.length);

		// Clear buffer
		this.updateBuffer = [];
		this.lastProcessTime = Date.now();
	}

	// Calculate grid cell key for a signal
	private calculateCellKey(signal: SignalDetection): string {
		const freqBin = Math.floor(signal.frequency / this.config.frequencyResolution);
		const powerBin = Math.floor(signal.power / this.config.powerResolution);
		return `grid_${freqBin}_${powerBin}`;
	}

	// Group signals by their grid cells
	private groupSignalsByCells(signals: SignalDetection[]): Map<string, SignalDetection[]> {
		const groups = new Map<string, SignalDetection[]>();

		for (const signal of signals) {
			const cellKey = this.calculateCellKey(signal);
			if (!groups.has(cellKey)) {
				groups.set(cellKey, []);
			}
			groups.get(cellKey)!.push(signal);
		}

		return groups;
	}

	// Update grid cell with new signals
	private updateGridCell(cellKey: string, signals: SignalDetection[]): void {
		let cell = this.gridCells.get(cellKey);

		if (!cell) {
			// Create new cell if minimum signals met
			if (signals.length < this.config.minSignalsForCell) {
				return;
			}

			cell = this.createGridCell(cellKey, signals);
			this.gridCells.set(cellKey, cell);
			this.updateSpatialIndex(cell, 'add');
		} else {
			// Update existing cell
			this.updateCellStatistics(cell, signals);
		}
	}

	// Adaptive grid adjustment based on signal density
	private adaptiveGridAdjustment(): void {
		const densityMap = this.calculateDensityMap();

		for (const [region, density] of densityMap) {
			if (density > DENSITY_THRESHOLD_HIGH) {
				// Split high-density cells for more detail
				this.splitHighDensityCells(region);
			} else if (density < DENSITY_THRESHOLD_LOW) {
				// Merge low-density cells to reduce noise
				this.mergeLowDensityCells(region);
			}
		}
	}
}
```

### 3. Client-Side Aggregation for Display

#### Visualization Aggregator (`visualizationAggregator.ts`)

```typescript
interface DisplayGrid {
	cells: DisplayCell[];
	viewport: {
		freqStart: number;
		freqEnd: number;
		powerMin: number;
		powerMax: number;
	};
	resolution: {
		frequency: number;
		power: number;
	};
}

interface DisplayCell {
	x: number; // Pixel X coordinate
	y: number; // Pixel Y coordinate
	width: number; // Cell width in pixels
	height: number; // Cell height in pixels
	intensity: number; // 0-1 normalized intensity
	color: string; // Computed color based on data
	data: GridCell; // Original grid cell data
}

class VisualizationAggregator {
	private canvas: {
		width: number;
		height: number;
	};
	private zoomLevel: number = 1.0;
	private panOffset: { x: number; y: number } = { x: 0, y: 0 };

	// Convert grid cells to display cells
	gridToDisplay(gridCells: GridCell[], viewport: ViewportConfig): DisplayGrid {
		const displayCells: DisplayCell[] = [];

		// Calculate pixel mapping
		const freqScale = this.canvas.width / (viewport.freqEnd - viewport.freqStart);
		const powerScale = this.canvas.height / (viewport.powerMax - viewport.powerMin);

		for (const cell of gridCells) {
			// Skip cells outside viewport
			if (!this.isInViewport(cell, viewport)) continue;

			// Calculate pixel coordinates
			const x = (cell.freqStart - viewport.freqStart) * freqScale;
			const y = this.canvas.height - (cell.powerMax - viewport.powerMin) * powerScale;
			const width = (cell.freqEnd - cell.freqStart) * freqScale;
			const height = (cell.powerMax - cell.powerMin) * powerScale;

			// Calculate intensity and color
			const intensity = this.calculateIntensity(cell);
			const color = this.calculateColor(cell, intensity);

			displayCells.push({
				x: Math.round(x),
				y: Math.round(y),
				width: Math.ceil(width),
				height: Math.ceil(height),
				intensity,
				color,
				data: cell
			});
		}

		return {
			cells: displayCells,
			viewport,
			resolution: {
				frequency: (viewport.freqEnd - viewport.freqStart) / this.canvas.width,
				power: (viewport.powerMax - viewport.powerMin) / this.canvas.height
			}
		};
	}

	// Level-of-detail (LOD) optimization
	getOptimalGridResolution(zoomLevel: number): GridConfiguration {
		if (zoomLevel > 10) {
			return GRID_PRESETS.highDetail;
		} else if (zoomLevel > 1) {
			return GRID_PRESETS.balanced;
		} else {
			return GRID_PRESETS.overview;
		}
	}

	// Calculate cell intensity based on statistics
	private calculateIntensity(cell: GridCell): number {
		const stats = cell.statistics;

		// Weighted combination of factors
		const powerFactor = (stats.avgPower + 100) / 100; // Normalize -100 to 0 dBm
		const occupancyFactor = stats.occupancy;
		const confidenceFactor = stats.detectionConfidence;
		const activityFactor = Math.min(stats.timeActive / 60000, 1); // Normalize to 1 minute

		// Weighted average
		return (
			powerFactor * 0.4 +
			occupancyFactor * 0.3 +
			confidenceFactor * 0.2 +
			activityFactor * 0.1
		);
	}

	// Calculate cell color based on data
	private calculateColor(cell: GridCell, intensity: number): string {
		// Base color on signal classification if available
		const primaryClass = this.getPrimaryClassification(cell);
		const baseColor = this.getClassificationColor(primaryClass);

		// Apply intensity
		return this.applyIntensity(baseColor, intensity);
	}
}
```

### 4. Configurable Aggregation Levels

#### Aggregation Manager (`aggregationManager.ts`)

```typescript
interface AggregationProfile {
	name: string;
	description: string;
	config: GridConfiguration;
	performanceTarget: 'quality' | 'balanced' | 'performance';
	autoAdjust: boolean;
}

class AggregationManager {
	private profiles: Map<string, AggregationProfile> = new Map();
	private activeProfile: string = 'balanced';
	private performanceMonitor: PerformanceMonitor;

	constructor() {
		this.initializeDefaultProfiles();
		this.performanceMonitor = new PerformanceMonitor();
	}

	// Initialize default profiles
	private initializeDefaultProfiles(): void {
		this.profiles.set('highQuality', {
			name: 'High Quality',
			description: 'Maximum detail for analysis',
			config: {
				frequencyResolution: 50_000, // 50 kHz
				powerResolution: 2, // 2 dBm
				timeWindow: 500, // 0.5 seconds
				minSignalsForCell: 1,
				mergeSimilarCells: false,
				adaptiveGridding: false
			},
			performanceTarget: 'quality',
			autoAdjust: false
		});

		this.profiles.set('balanced', {
			name: 'Balanced',
			description: 'Good detail with smooth performance',
			config: GRID_PRESETS.balanced,
			performanceTarget: 'balanced',
			autoAdjust: true
		});

		this.profiles.set('performance', {
			name: 'Performance',
			description: 'Optimized for smooth operation',
			config: {
				frequencyResolution: 5_000_000, // 5 MHz
				powerResolution: 15, // 15 dBm
				timeWindow: 10000, // 10 seconds
				minSignalsForCell: 10,
				mergeSimilarCells: true,
				adaptiveGridding: true
			},
			performanceTarget: 'performance',
			autoAdjust: true
		});

		this.profiles.set('custom', {
			name: 'Custom',
			description: 'User-defined settings',
			config: { ...GRID_PRESETS.balanced },
			performanceTarget: 'balanced',
			autoAdjust: false
		});
	}

	// Switch aggregation profile
	setProfile(profileName: string): void {
		if (!this.profiles.has(profileName)) {
			throw new Error(`Profile ${profileName} not found`);
		}

		this.activeProfile = profileName;
		const profile = this.profiles.get(profileName)!;

		// Apply profile configuration
		this.applyConfiguration(profile.config);

		// Start auto-adjustment if enabled
		if (profile.autoAdjust) {
			this.startAutoAdjustment(profile);
		}
	}

	// Auto-adjust aggregation based on performance
	private startAutoAdjustment(profile: AggregationProfile): void {
		const monitor = setInterval(() => {
			const metrics = this.performanceMonitor.getMetrics();

			if (metrics.fps < 30 && profile.performanceTarget !== 'quality') {
				// Reduce quality to improve performance
				this.adjustForPerformance(profile.config, 0.8);
			} else if (metrics.fps > 55 && metrics.cpuUsage < 50) {
				// Increase quality if performance headroom exists
				this.adjustForQuality(profile.config, 1.2);
			}
		}, 5000);
	}

	// Dynamic adjustment methods
	private adjustForPerformance(config: GridConfiguration, factor: number): void {
		config.frequencyResolution *= factor;
		config.powerResolution *= factor;
		config.timeWindow *= factor;
		config.minSignalsForCell = Math.ceil(config.minSignalsForCell * factor);
	}

	private adjustForQuality(config: GridConfiguration, factor: number): void {
		config.frequencyResolution /= factor;
		config.powerResolution /= factor;
		config.timeWindow /= factor;
		config.minSignalsForCell = Math.max(1, Math.floor(config.minSignalsForCell / factor));
	}
}
```

### 5. Statistics Tracking Per Grid Cell

#### Statistics Engine (`gridStatistics.ts`)

```typescript
class GridStatisticsEngine {
	private historyDepth: number = 100; // Keep last 100 updates per cell
	private cellHistory: Map<string, CellHistoryEntry[]> = new Map();

	// Update statistics for a grid cell
	updateCellStatistics(cell: GridCell, newSignals: SignalDetection[]): void {
		const stats = cell.statistics;
		const now = Date.now();

		// Update basic statistics
		const powers = newSignals.map((s) => s.power);
		const oldAvg = stats.avgPower;
		const oldCount = stats.signalCount;

		stats.signalCount += newSignals.length;
		stats.avgPower =
			(oldAvg * oldCount + powers.reduce((a, b) => a + b, 0)) / stats.signalCount;
		stats.maxPower = Math.max(stats.maxPower, ...powers);
		stats.minPower = Math.min(stats.minPower, ...powers);

		// Calculate variance
		const squaredDiffs = powers.map((p) => Math.pow(p - stats.avgPower, 2));
		stats.variance = squaredDiffs.reduce((a, b) => a + b, 0) / powers.length;

		// Update occupancy (simplified: signals detected / time window)
		const timeWindow = now - stats.lastUpdated;
		const activeTime = newSignals.length * 100; // Assume 100ms per signal
		stats.occupancy = Math.min(activeTime / timeWindow, 1);

		// Update classifications
		for (const signal of newSignals) {
			if (signal.classification) {
				const count = stats.classifications.get(signal.classification) || 0;
				stats.classifications.set(signal.classification, count + 1);
			}
		}

		// Update time active
		stats.timeActive += timeWindow;

		// Calculate detection confidence based on consistency
		stats.detectionConfidence = this.calculateConfidence(cell, newSignals);

		stats.lastUpdated = now;

		// Store history entry
		this.addHistoryEntry(cell.id, {
			timestamp: now,
			avgPower: stats.avgPower,
			signalCount: newSignals.length,
			occupancy: stats.occupancy
		});
	}

	// Calculate statistical confidence
	private calculateConfidence(cell: GridCell, signals: SignalDetection[]): number {
		const stats = cell.statistics;

		// Factors affecting confidence
		const signalStrength = Math.min((stats.avgPower + 100) / 80, 1); // -100 to -20 dBm normalized
		const consistency = 1 - Math.sqrt(stats.variance) / 50; // Lower variance = higher confidence
		const sampleSize = Math.min(stats.signalCount / 100, 1); // More samples = higher confidence
		const occupancyFactor = stats.occupancy;

		// Weighted confidence score
		return signalStrength * 0.3 + consistency * 0.3 + sampleSize * 0.2 + occupancyFactor * 0.2;
	}

	// Get trending analysis for a cell
	getCellTrend(cellId: string, timeWindow: number = 60000): TrendAnalysis {
		const history = this.cellHistory.get(cellId) || [];
		const cutoff = Date.now() - timeWindow;
		const relevantHistory = history.filter((h) => h.timestamp > cutoff);

		if (relevantHistory.length < 2) {
			return { trend: 'stable', confidence: 0 };
		}

		// Calculate trend using linear regression
		const xValues = relevantHistory.map((h, i) => i);
		const yValues = relevantHistory.map((h) => h.avgPower);

		const n = xValues.length;
		const sumX = xValues.reduce((a, b) => a + b, 0);
		const sumY = yValues.reduce((a, b) => a + b, 0);
		const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
		const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const rSquared = this.calculateRSquared(xValues, yValues, slope);

		return {
			trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
			confidence: rSquared,
			slope,
			prediction: this.predictNextValue(slope, yValues)
		};
	}
}
```

## Performance Considerations

### 1. Memory Management

```typescript
class MemoryOptimizedGrid {
	private maxCells: number = 10000;
	private cellPool: ObjectPool<GridCell>;
	private lruCache: LRUCache<string, GridCell>;

	constructor() {
		// Object pooling for grid cells
		this.cellPool = new ObjectPool<GridCell>(
			() => this.createEmptyCell(),
			(cell) => this.resetCell(cell),
			this.maxCells
		);

		// LRU cache for active cells
		this.lruCache = new LRUCache<string, GridCell>(this.maxCells);
	}

	// Efficient cell allocation
	allocateCell(key: string): GridCell {
		let cell = this.cellPool.acquire();
		this.lruCache.set(key, cell);
		return cell;
	}

	// Return cell to pool when no longer needed
	deallocateCell(key: string): void {
		const cell = this.lruCache.get(key);
		if (cell) {
			this.cellPool.release(cell);
			this.lruCache.delete(key);
		}
	}
}
```

### 2. Processing Optimization

```typescript
class OptimizedProcessor {
	private workerPool: Worker[] = [];
	private processingQueue: ProcessingTask[] = [];

	constructor() {
		// Initialize web workers for parallel processing
		const workerCount = navigator.hardwareConcurrency || 4;
		for (let i = 0; i < workerCount; i++) {
			const worker = new Worker('/workers/aggregation-worker.js');
			this.workerPool.push(worker);
		}
	}

	// Distribute processing across workers
	async processInParallel(signals: SignalDetection[]): Promise<GridCell[]> {
		const chunkSize = Math.ceil(signals.length / this.workerPool.length);
		const chunks = this.chunkArray(signals, chunkSize);

		const promises = chunks.map((chunk, index) => {
			return this.processChunk(chunk, this.workerPool[index]);
		});

		const results = await Promise.all(promises);
		return results.flat();
	}
}
```

### 3. Rendering Optimization

```typescript
class RenderOptimizer {
	private renderCanvas: OffscreenCanvas;
	private renderContext: OffscreenCanvasRenderingContext2D;
	private frameBuffer: ImageData;
	private dirty: boolean = false;

	// Batch rendering with dirty region tracking
	renderGrid(displayGrid: DisplayGrid): void {
		if (!this.dirty) return;

		// Clear only dirty regions
		for (const region of this.dirtyRegions) {
			this.renderContext.clearRect(region.x, region.y, region.width, region.height);
		}

		// Render cells in batches by intensity level
		const cellsByIntensity = this.groupCellsByIntensity(displayGrid.cells);

		for (const [intensity, cells] of cellsByIntensity) {
			this.renderContext.globalAlpha = intensity;
			this.batchRenderCells(cells);
		}

		this.dirty = false;
		this.dirtyRegions.clear();
	}

	// Use WebGL for large datasets
	private useWebGLRenderer(cells: DisplayCell[]): void {
		const gl = this.webglContext;

		// Upload cell data as texture
		const cellTexture = this.createCellDataTexture(cells);

		// Use instanced rendering for efficiency
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cells.length);
	}
}
```

## Implementation Timeline

### Phase 1: Core Aggregation Engine (Week 1)

- [ ] Implement basic grid cell structure and statistics
- [ ] Create signal-to-grid mapping algorithm
- [ ] Build in-memory grid storage with spatial indexing
- [ ] Add basic statistical calculations

### Phase 2: Real-time Processing (Week 2)

- [ ] Integrate aggregation into existing signal processor
- [ ] Implement buffering and batch processing
- [ ] Add performance monitoring and metrics
- [ ] Create worker-based parallel processing

### Phase 3: Client Visualization (Week 3)

- [ ] Build visualization aggregator
- [ ] Implement canvas-based grid rendering
- [ ] Add zoom/pan with LOD support
- [ ] Create interactive cell selection

### Phase 4: Configuration & Optimization (Week 4)

- [ ] Implement aggregation profiles
- [ ] Add auto-adjustment algorithms
- [ ] Optimize memory usage with pooling
- [ ] Performance testing and tuning

### Phase 5: Advanced Features (Week 5)

- [ ] Adaptive grid adjustment
- [ ] Cell merging algorithms
- [ ] Trend analysis and predictions
- [ ] Export aggregated data formats

## Testing Strategy

### Unit Tests

```typescript
describe('GridAggregator', () => {
	test('should create grid cells from signals', () => {
		const aggregator = new SignalAggregator(GRID_PRESETS.balanced);
		const signals = generateTestSignals(1000);

		aggregator.addSignals(signals);
		const cells = aggregator.getGridCells();

		expect(cells.length).toBeGreaterThan(0);
		expect(cells.length).toBeLessThan(signals.length);
	});

	test('should maintain statistical accuracy', () => {
		// Test that aggregated statistics match raw data
	});

	test('should handle edge cases', () => {
		// Test boundary conditions, empty data, etc.
	});
});
```

### Performance Benchmarks

```typescript
class AggregationBenchmark {
	async runBenchmarks() {
		const testSizes = [1000, 10000, 100000, 1000000];

		for (const size of testSizes) {
			const signals = this.generateSignals(size);

			console.time(`Aggregation ${size} signals`);
			const result = await aggregator.process(signals);
			console.timeEnd(`Aggregation ${size} signals`);

			console.log(
				`Input: ${size}, Output: ${result.cells.length}, Ratio: ${size / result.cells.length}`
			);
		}
	}
}
```

## API Documentation

### Signal Aggregation API

```typescript
// Add signal to aggregation
POST /api/hackrf/aggregation/add-signal
Body: SignalDetection

// Get aggregated grid
GET /api/hackrf/aggregation/grid?viewport={viewport}&profile={profile}
Response: GridCell[]

// Update aggregation profile
PUT /api/hackrf/aggregation/profile
Body: { profile: string, config?: Partial<GridConfiguration> }

// Get cell statistics
GET /api/hackrf/aggregation/cell/{cellId}/stats
Response: GridCellStatistics

// Export aggregated data
GET /api/hackrf/aggregation/export?format={csv|json|binary}
Response: Blob
```

## Conclusion

This signal aggregation system provides a scalable solution for handling large volumes of RF signal data while maintaining statistical accuracy and enabling smooth visualization. The grid-based approach with configurable aggregation levels allows users to balance between detail and performance based on their specific needs.

Key benefits:

- Reduces data volume by 10-100x depending on configuration
- Maintains statistical integrity of signal information
- Enables smooth real-time visualization of millions of signals
- Provides flexible configuration for different use cases
- Scales from detailed analysis to broad spectrum overview
