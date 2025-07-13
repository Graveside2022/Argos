import { logInfo, logError, logWarn } from '$lib/utils/logger';

export interface FrequencyConfig {
	value: number;
	unit: string;
}

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
		switchTimer: null
	};

	private cycleConfig: CycleConfig = {
		frequencies: [],
		cycleTime: 10000,
		switchingTime: 3000
	};

	private frequencyBlacklist = new Set<number>();

	/**
	 * Initialize cycling with frequency configuration
	 */
	initializeCycling(config: CycleConfig): void {
		this.cycleConfig = { ...config };
		this.cycleState.currentIndex = 0;
		this.cycleState.isCycling = config.frequencies.length > 1;
		this.cycleState.inFrequencyTransition = false;

		// Dynamically adjust switching time
		this.cycleConfig.switchingTime = Math.min(
			3000,
			Math.max(500, Math.floor(this.cycleConfig.cycleTime * 0.25))
		);

		logInfo('🔄 Frequency cycling initialized', {
			frequencies: config.frequencies.length,
			cycleTime: this.cycleConfig.cycleTime,
			switchingTime: this.cycleConfig.switchingTime,
			isCycling: this.cycleState.isCycling
		});
	}

	/**
	 * Get current frequency
	 */
	getCurrentFrequency(): FrequencyConfig | null {
		if (this.cycleConfig.frequencies.length === 0) {
			return null;
		}
		return this.cycleConfig.frequencies[this.cycleState.currentIndex];
	}

	/**
	 * Get next frequency in cycle
	 */
	getNextFrequency(): FrequencyConfig | null {
		if (this.cycleConfig.frequencies.length === 0) {
			return null;
		}
		const nextIndex = (this.cycleState.currentIndex + 1) % this.cycleConfig.frequencies.length;
		return this.cycleConfig.frequencies[nextIndex];
	}

	/**
	 * Start automatic cycling
	 */
	startAutomaticCycling(
		onCycleComplete: (nextFreq: FrequencyConfig) => Promise<void>,
		onCycleStart?: (currentFreq: FrequencyConfig) => void
	): void {
		if (!this.cycleState.isCycling || this.cycleConfig.frequencies.length <= 1) {
			logInfo('Single frequency mode - no cycling needed');
			return;
		}

		const currentFreq = this.getCurrentFrequency();
		if (currentFreq && onCycleStart) {
			onCycleStart(currentFreq);
		}

		// Set timer for next frequency
		this.cycleState.cycleTimer = setTimeout(() => {
			this.cycleToNext(onCycleComplete).catch((error) => {
				logError('Error cycling to next frequency', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, this.cycleConfig.cycleTime);

		logInfo('🔄 Automatic cycling started', {
			currentFreq: currentFreq?.value,
			nextCycleIn: this.cycleConfig.cycleTime
		});
	}

	/**
	 * Cycle to next frequency
	 */
	async cycleToNext(onCycleComplete: (nextFreq: FrequencyConfig) => Promise<void>): Promise<void> {
		if (!this.cycleState.isCycling) {
			return;
		}

		this.cycleState.inFrequencyTransition = true;

		// Move to next frequency
		this.cycleState.currentIndex =
			(this.cycleState.currentIndex + 1) % this.cycleConfig.frequencies.length;

		const nextFreq = this.getCurrentFrequency();
		if (!nextFreq) {
			logError('No next frequency available');
			return;
		}

		logInfo('🔄 Cycling to next frequency', {
			from: this.cycleState.currentIndex === 0 
				? this.cycleConfig.frequencies[this.cycleConfig.frequencies.length - 1] 
				: this.cycleConfig.frequencies[this.cycleState.currentIndex - 1],
			to: nextFreq,
			index: this.cycleState.currentIndex
		});

		// Wait before switching
		this.cycleState.switchTimer = setTimeout(() => {
			this.cycleState.inFrequencyTransition = false;
			onCycleComplete(nextFreq).catch((error) => {
				logError('Error in cycle completion callback', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, this.cycleConfig.switchingTime);
	}

	/**
	 * Skip to specific frequency index
	 */
	skipToFrequency(index: number): FrequencyConfig | null {
		if (index < 0 || index >= this.cycleConfig.frequencies.length) {
			logWarn('Invalid frequency index', { index, total: this.cycleConfig.frequencies.length });
			return null;
		}

		this.cycleState.currentIndex = index;
		const frequency = this.getCurrentFrequency();

		logInfo('⏭️ Skipped to frequency', { index, frequency });
		return frequency;
	}

	/**
	 * Stop cycling and clear timers
	 */
	stopCycling(): void {
		this.cycleState.isCycling = false;
		this.cycleState.inFrequencyTransition = false;

		// Clear all timers
		if (this.cycleState.cycleTimer) {
			clearTimeout(this.cycleState.cycleTimer);
			this.cycleState.cycleTimer = null;
		}

		if (this.cycleState.switchTimer) {
			clearTimeout(this.cycleState.switchTimer);
			this.cycleState.switchTimer = null;
		}

		logInfo('🛑 Frequency cycling stopped');
	}

	/**
	 * Add frequency to blacklist
	 */
	blacklistFrequency(frequency: FrequencyConfig): void {
		const freqHz = this.convertToHz(frequency.value, frequency.unit);
		this.frequencyBlacklist.add(freqHz);
		
		logWarn('⚫ Frequency blacklisted', { frequency, freqHz });
	}

	/**
	 * Check if frequency is blacklisted
	 */
	isFrequencyBlacklisted(frequency: FrequencyConfig): boolean {
		const freqHz = this.convertToHz(frequency.value, frequency.unit);
		return this.frequencyBlacklist.has(freqHz);
	}

	/**
	 * Get valid (non-blacklisted) frequencies
	 */
	getValidFrequencies(): FrequencyConfig[] {
		return this.cycleConfig.frequencies.filter((freq) => !this.isFrequencyBlacklisted(freq));
	}

	/**
	 * Remove frequency from blacklist
	 */
	unblacklistFrequency(frequency: FrequencyConfig): void {
		const freqHz = this.convertToHz(frequency.value, frequency.unit);
		this.frequencyBlacklist.delete(freqHz);
		
		logInfo('⚪ Frequency removed from blacklist', { frequency, freqHz });
	}

	/**
	 * Clear all blacklisted frequencies
	 */
	clearBlacklist(): void {
		this.frequencyBlacklist.clear();
		logInfo('🧹 Frequency blacklist cleared');
	}

	/**
	 * Normalize frequencies to standard format
	 */
	normalizeFrequencies(
		frequencies: (number | { frequency?: number; value?: number; unit?: string })[]
	): FrequencyConfig[] {
		return frequencies
			.map((freq) => {
				if (typeof freq === 'number') {
					return { value: freq, unit: 'MHz' };
				} else if (freq.frequency !== undefined) {
					return { value: freq.frequency, unit: freq.unit || 'MHz' };
				} else if (freq.value !== undefined) {
					return { value: freq.value, unit: freq.unit || 'MHz' };
				}
				throw new Error('Invalid frequency format');
			})
			.filter((f) => f.value > 0);
	}

	/**
	 * Convert frequency to Hz
	 */
	convertToHz(value: number, unit: string): number {
		switch (unit.toLowerCase()) {
			case 'hz':
				return value;
			case 'khz':
				return value * 1000;
			case 'mhz':
				return value * 1000000;
			case 'ghz':
				return value * 1000000000;
			default:
				return value * 1000000; // Default to MHz
		}
	}

	/**
	 * Convert frequency to MHz
	 */
	convertToMHz(value: number, unit: string): number {
		switch (unit.toLowerCase()) {
			case 'hz':
				return value / 1000000;
			case 'khz':
				return value / 1000;
			case 'mhz':
				return value;
			case 'ghz':
				return value * 1000;
			default:
				return value;
		}
	}

	/**
	 * Get current cycle state
	 */
	getCycleState(): CycleState {
		return { ...this.cycleState };
	}

	/**
	 * Get cycle configuration
	 */
	getCycleConfig(): CycleConfig {
		return { ...this.cycleConfig };
	}

	/**
	 * Get cycle progress information
	 */
	getCycleProgress(): {
		currentIndex: number;
		totalFrequencies: number;
		progress: number;
		currentFrequency: FrequencyConfig | null;
		nextFrequency: FrequencyConfig | null;
		blacklistedCount: number;
	} {
		const currentFrequency = this.getCurrentFrequency();
		const nextFrequency = this.getNextFrequency();
		const progress = this.cycleConfig.frequencies.length > 0 
			? (this.cycleState.currentIndex / this.cycleConfig.frequencies.length) * 100 
			: 0;

		return {
			currentIndex: this.cycleState.currentIndex,
			totalFrequencies: this.cycleConfig.frequencies.length,
			progress,
			currentFrequency,
			nextFrequency,
			blacklistedCount: this.frequencyBlacklist.size
		};
	}

	/**
	 * Update cycle timing configuration
	 */
	updateTiming(cycleTime?: number, switchingTime?: number): void {
		if (cycleTime !== undefined) {
			this.cycleConfig.cycleTime = cycleTime;
		}
		if (switchingTime !== undefined) {
			this.cycleConfig.switchingTime = switchingTime;
		}

		logInfo('⏱️ Cycle timing updated', {
			cycleTime: this.cycleConfig.cycleTime,
			switchingTime: this.cycleConfig.switchingTime
		});
	}

	/**
	 * Clean up resources
	 */
	cleanup(): void {
		this.stopCycling();
		this.clearBlacklist();
		logInfo('🧹 FrequencyCycler cleanup completed');
	}
}