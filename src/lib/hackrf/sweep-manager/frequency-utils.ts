/**
 * Frequency conversion, normalization, and blacklist management utilities.
 * Extracted from frequency-cycler.ts to comply with Article 2.2 (max 300 lines/file).
 */

import { logInfo, logWarn } from '$lib/utils/logger';

export interface FrequencyConfig {
	value: number;
	unit: string;
}

/** Convert frequency value to Hz */
export function convertToHz(value: number, unit: string): number {
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

/** Convert frequency value to MHz */
export function convertToMHz(value: number, unit: string): number {
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

/** Normalize frequencies to standard FrequencyConfig format */
export function normalizeFrequencies(
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
 * Manages a set of blacklisted frequencies.
 * Frequencies are stored by their Hz value for precise matching.
 */
export class FrequencyBlacklist {
	private blacklist = new Set<number>();

	/** Add frequency to blacklist */
	add(frequency: FrequencyConfig): void {
		const freqHz = convertToHz(frequency.value, frequency.unit);
		this.blacklist.add(freqHz);
		logWarn('[BLOCK] Frequency blacklisted', { frequency, freqHz });
	}

	/** Check if frequency is blacklisted */
	has(frequency: FrequencyConfig): boolean {
		const freqHz = convertToHz(frequency.value, frequency.unit);
		return this.blacklist.has(freqHz);
	}

	/** Remove frequency from blacklist */
	remove(frequency: FrequencyConfig): void {
		const freqHz = convertToHz(frequency.value, frequency.unit);
		this.blacklist.delete(freqHz);
		logInfo('[CLEAR] Frequency removed from blacklist', { frequency, freqHz });
	}

	/** Get valid (non-blacklisted) frequencies from a list */
	filterValid(frequencies: FrequencyConfig[]): FrequencyConfig[] {
		return frequencies.filter((freq) => !this.has(freq));
	}

	/** Clear all blacklisted frequencies */
	clear(): void {
		this.blacklist.clear();
		logInfo('[CLEANUP] Frequency blacklist cleared');
	}

	/** Get the number of blacklisted frequencies */
	get size(): number {
		return this.blacklist.size;
	}
}
