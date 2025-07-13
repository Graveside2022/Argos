/**
 * Grid processor service that interfaces with the WebWorker
 */

export interface GridSignal {
	lat: number;
	lon: number;
	power: number;
	freq: number;
	timestamp: number;
}

export interface GridBounds {
	minLat: number;
	maxLat: number;
	minLon: number;
	maxLon: number;
}

export interface FrequencyInfo {
	freq: number;
	power: number;
	band: string;
	count: number;
}

export interface GridCell {
	key: string;
	bounds: GridBounds;
	stats: {
		count: number;
		avgPower: number;
		maxPower: number;
		minPower: number;
		aggregatedPower: number;
		stdDev: number;
		density: number;
		densityFactor: number;
		dominantBand: string;
		freqBands: Record<string, number>;
		bandCategories: Record<string, number>;
		strongestFreq: number;
		strongestFreqPower: number;
		strongestByCategory: Record<string, FrequencyInfo>;
		topFrequencies: FrequencyInfo[];
		timeRange: {
			start: number;
			end: number;
		};
		confidenceFactor: number;
		temporalSpanMinutes: number;
	};
}

export interface GridProcessResult {
	cells: GridCell[];
	totalSignals: number;
	totalCells: number;
	processingTime: number;
	gridSize: number;
}

export interface GridStatsResult {
	totalSignals: number;
	avgPower: number;
	maxPower: number;
	minPower: number;
	processingTime: number;
}

export class GridProcessor {
	private worker: Worker | null = null;
	private pendingCallbacks = new Map<
		string,
		(result: GridProcessResult | GridStatsResult | { error: string }) => void
	>();
	private requestId = 0;

	constructor() {
		if (typeof Worker !== 'undefined') {
			this.initWorker();
		}
	}

	private initWorker() {
		try {
			this.worker = new Worker('/workers/gridProcessor.js');

			this.worker.addEventListener('message', (event) => {
				const { type, data, error, requestId } = event.data as {
					type: string;
					data: unknown;
					error: unknown;
					requestId: string;
				};

				if (type === 'error') {
					console.error('Grid processor error:', error);
					const callback = this.pendingCallbacks.get(requestId);
					if (callback) {
						// Validate error is a string
						const errorMessage = typeof error === 'string' ? error : String(error);
						callback({ error: errorMessage });
						this.pendingCallbacks.delete(requestId);
					}
					return;
				}

				// Find and execute callback based on requestId
				const callback = this.pendingCallbacks.get(requestId);
				if (
					callback &&
					(type === 'gridProcessed' ||
						type === 'hexGridProcessed' ||
						type === 'statsCalculated')
				) {
					// Validate data based on type
					if (data && typeof data === 'object' && !('error' in data)) {
						if (type === 'statsCalculated') {
							callback(data as GridStatsResult);
						} else {
							callback(data as GridProcessResult);
						}
					} else {
						callback({ error: 'Invalid data received from worker' });
					}
					this.pendingCallbacks.delete(requestId);
				}
			});

			this.worker.addEventListener('error', (error) => {
				console.error('Grid processor worker error:', error);
			});
		} catch (error) {
			console.error('Failed to initialize grid processor worker:', error);
		}
	}

	/**
	 * Process signals into grid cells
	 */
	async processGrid(
		signals: GridSignal[],
		gridSize: number,
		bounds?: GridBounds
	): Promise<GridProcessResult> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				// Fallback to main thread processing
				reject(new Error('WebWorker not available'));
				return;
			}

			const id = `grid-${this.requestId++}`;
			this.pendingCallbacks.set(id, (result) => {
				if ('error' in result) {
					reject(new Error(result.error));
				} else {
					resolve(result as GridProcessResult);
				}
			});

			this.worker.postMessage({
				type: 'processGrid',
				requestId: id,
				data: {
					signals,
					gridSize,
					bounds
				}
			});
		});
	}

	/**
	 * Process signals into hexagonal grid cells
	 */
	async processHexGrid(
		signals: GridSignal[],
		hexSize: number,
		bounds?: GridBounds
	): Promise<GridProcessResult> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('WebWorker not available'));
				return;
			}

			const id = `hex-${this.requestId++}`;
			this.pendingCallbacks.set(id, (result) => {
				if ('error' in result) {
					reject(new Error(result.error));
				} else {
					resolve(result as GridProcessResult);
				}
			});

			this.worker.postMessage({
				type: 'processHexGrid',
				requestId: id,
				data: {
					signals,
					hexSize,
					bounds
				}
			});
		});
	}

	/**
	 * Calculate overall statistics for signals
	 */
	async calculateStats(signals: GridSignal[], bounds: GridBounds): Promise<GridStatsResult> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('WebWorker not available'));
				return;
			}

			const id = `stats-${this.requestId++}`;
			this.pendingCallbacks.set(id, (result) => {
				if ('error' in result) {
					reject(new Error(result.error));
				} else {
					resolve(result as GridStatsResult);
				}
			});

			this.worker.postMessage({
				type: 'calculateStats',
				requestId: id,
				data: {
					signals,
					bounds
				}
			});
		});
	}

	/**
	 * Terminate the worker
	 */
	destroy() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.pendingCallbacks.clear();
	}
}

// Singleton instance
let gridProcessorInstance: GridProcessor | null = null;

export function getGridProcessor(): GridProcessor {
	if (!gridProcessorInstance) {
		gridProcessorInstance = new GridProcessor();
	}
	return gridProcessorInstance;
}
