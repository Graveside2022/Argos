import { logger } from '$lib/utils/logger';

import { FrequencyBlacklist, type FrequencyConfig, normalizeFrequencies } from './frequency-utils';

// Re-export so existing callers don't break
export type { FrequencyConfig } from './frequency-utils';

export interface CycleConfig {
	frequencies: FrequencyConfig[];
	cycleTime: number;
	switchingTime: number;
}

export interface CycleState {
	currentIndex: number;
	isCycling: boolean;
	inFrequencyTransition: boolean;
	cycleTimer: ReturnType<typeof setTimeout> | null;
	switchTimer: ReturnType<typeof setTimeout> | null;
	frequencies: FrequencyConfig[];
	cycleTime: number;
	frequencyCount: number;
	currentFrequency: FrequencyConfig | null;
}

/**
 * Manages frequency cycling logic and timing for HackRF sweeps
 */
export class FrequencyCycler {
	private cycleState: CycleState = {
		currentIndex: 0,
		isCycling: false,
		inFrequencyTransition: false,
		cycleTimer: null,
		switchTimer: null,
		frequencies: [],
		cycleTime: 0,
		frequencyCount: 0,
		currentFrequency: null
	};

	private cycleConfig: CycleConfig = {
		frequencies: [],
		cycleTime: 10000,
		switchingTime: 3000
	};

	private frequencyBlacklist = new FrequencyBlacklist();

	/** Initialize cycling with frequency configuration */
	initializeCycling(config: CycleConfig): void {
		this.cycleConfig = { ...config };
		this.cycleState.currentIndex = 0;
		this.cycleState.isCycling = config.frequencies.length > 1;
		this.cycleState.inFrequencyTransition = false;
		this.cycleState.frequencies = [...config.frequencies];
		this.cycleState.cycleTime = config.cycleTime;
		this.cycleState.frequencyCount = config.frequencies.length;
		this.cycleState.currentFrequency = config.frequencies[0] || null;

		this.cycleConfig.switchingTime = Math.min(
			3000,
			Math.max(500, Math.floor(this.cycleConfig.cycleTime * 0.25))
		);

		logger.info('[RETRY] Frequency cycling initialized', {
			frequencies: config.frequencies.length,
			cycleTime: this.cycleConfig.cycleTime,
			switchingTime: this.cycleConfig.switchingTime,
			isCycling: this.cycleState.isCycling
		});
	}

	/** Get current frequency */
	getCurrentFrequency(): FrequencyConfig | null {
		if (this.cycleConfig.frequencies.length === 0) return null;
		return this.cycleConfig.frequencies[this.cycleState.currentIndex];
	}

	/** Get next frequency in cycle */
	getNextFrequency(): FrequencyConfig | null {
		if (this.cycleConfig.frequencies.length === 0) return null;
		const nextIndex = (this.cycleState.currentIndex + 1) % this.cycleConfig.frequencies.length;
		return this.cycleConfig.frequencies[nextIndex];
	}

	private scheduleCycleTimer(
		onCycleComplete: (nextFreq: FrequencyConfig) => Promise<void>
	): void {
		this.cycleState.cycleTimer = setTimeout(() => {
			this.cycleToNext(onCycleComplete).catch((error) => {
				logger.error('Error cycling to next frequency', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, this.cycleConfig.cycleTime);
	}

	private shouldCycle(): boolean {
		return this.cycleState.isCycling && this.cycleConfig.frequencies.length > 1;
	}

	/** Start automatic cycling */
	startAutomaticCycling(
		onCycleComplete: (nextFreq: FrequencyConfig) => Promise<void>,
		onCycleStart?: (currentFreq: FrequencyConfig) => void
	): void {
		if (!this.shouldCycle()) {
			logger.info('Single frequency mode - no cycling needed');
			return;
		}

		const currentFreq = this.getCurrentFrequency();
		if (currentFreq) onCycleStart?.(currentFreq);

		this.scheduleCycleTimer(onCycleComplete);

		logger.info('[RETRY] Automatic cycling started', {
			currentFreq: currentFreq?.value,
			nextCycleIn: this.cycleConfig.cycleTime
		});
	}

	/** Cycle to next frequency */
	async cycleToNext(
		onCycleComplete: (nextFreq: FrequencyConfig) => Promise<void>
	): Promise<void> {
		if (!this.cycleState.isCycling) return;

		this.cycleState.inFrequencyTransition = true;
		this.cycleState.currentIndex =
			(this.cycleState.currentIndex + 1) % this.cycleConfig.frequencies.length;

		const nextFreq = this.getCurrentFrequency();
		this.cycleState.currentFrequency = nextFreq;
		if (!nextFreq) {
			logger.error('No next frequency available');
			return;
		}

		logger.info('[RETRY] Cycling to next frequency', {
			from:
				this.cycleState.currentIndex === 0
					? this.cycleConfig.frequencies[this.cycleConfig.frequencies.length - 1]
					: this.cycleConfig.frequencies[this.cycleState.currentIndex - 1],
			to: nextFreq,
			index: this.cycleState.currentIndex
		});

		this.cycleState.switchTimer = setTimeout(() => {
			this.cycleState.inFrequencyTransition = false;
			onCycleComplete(nextFreq).catch((error) => {
				logger.error('Error in cycle completion callback', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, this.cycleConfig.switchingTime);
	}

	/** Skip to specific frequency index */
	skipToFrequency(index: number): FrequencyConfig | null {
		if (index < 0 || index >= this.cycleConfig.frequencies.length) {
			logger.warn('Invalid frequency index', {
				index,
				total: this.cycleConfig.frequencies.length
			});
			return null;
		}
		this.cycleState.currentIndex = index;
		const frequency = this.getCurrentFrequency();
		logger.info('Skipped to frequency', { index, frequency });
		return frequency;
	}

	/** Stop cycling and clear timers */
	stopCycling(): void {
		this.cycleState.isCycling = false;
		this.cycleState.inFrequencyTransition = false;
		if (this.cycleState.cycleTimer) {
			clearTimeout(this.cycleState.cycleTimer);
			this.cycleState.cycleTimer = null;
		}
		if (this.cycleState.switchTimer) {
			clearTimeout(this.cycleState.switchTimer);
			this.cycleState.switchTimer = null;
		}
		logger.info('[STOP] Frequency cycling stopped');
	}

	blacklistFrequency(frequency: FrequencyConfig): void {
		this.frequencyBlacklist.add(frequency);
	}

	normalizeFrequencies(
		frequencies: (number | { frequency?: number; value?: number; unit?: string })[]
	): FrequencyConfig[] {
		return normalizeFrequencies(frequencies);
	}

	/** Get current cycle state */
	getCycleState(): CycleState {
		return { ...this.cycleState };
	}

	/** Get cycle configuration */
	getCycleConfig(): CycleConfig {
		return { ...this.cycleConfig };
	}

	/** Get cycle progress information */
	getCycleProgress(): {
		currentIndex: number;
		totalFrequencies: number;
		progress: number;
		currentFrequency: FrequencyConfig | null;
		nextFrequency: FrequencyConfig | null;
		blacklistedCount: number;
	} {
		const progress =
			this.cycleConfig.frequencies.length > 0
				? (this.cycleState.currentIndex / this.cycleConfig.frequencies.length) * 100
				: 0;
		return {
			currentIndex: this.cycleState.currentIndex,
			totalFrequencies: this.cycleConfig.frequencies.length,
			progress,
			currentFrequency: this.getCurrentFrequency(),
			nextFrequency: this.getNextFrequency(),
			blacklistedCount: this.frequencyBlacklist.size
		};
	}

	/** Update cycle timing configuration */
	updateTiming(cycleTime?: number, switchingTime?: number): void {
		if (cycleTime !== undefined) this.cycleConfig.cycleTime = cycleTime;
		if (switchingTime !== undefined) this.cycleConfig.switchingTime = switchingTime;
		logger.info('[TIMER] Cycle timing updated', {
			cycleTime: this.cycleConfig.cycleTime,
			switchingTime: this.cycleConfig.switchingTime
		});
	}

	/** Reset cycling state to initial values */
	resetCycling(): void {
		this.stopCycling();
		this.cycleState.currentIndex = 0;
		logger.info('[RETRY] Cycling reset');
	}

	/** Emergency stop — alias for stopCycling with warning log */
	emergencyStop(): void {
		this.stopCycling();
		logger.warn('[ALERT] Emergency stop - frequency cycling halted');
	}

	/** Start cycle timer with callback */
	startCycleTimer(callback: () => void): void {
		this.cycleState.cycleTimer = setTimeout(callback, this.cycleConfig.cycleTime);
	}

	/** Start switch timer with callback */
	startSwitchTimer(callback: () => void): void {
		this.cycleState.switchTimer = setTimeout(callback, this.cycleConfig.switchingTime);
	}

	/** Clean up resources */
	cleanup(): void {
		this.stopCycling();
		this.frequencyBlacklist.clear();
		logger.info('[CLEANUP] FrequencyCycler cleanup completed');
	}
}
