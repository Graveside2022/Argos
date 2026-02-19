/**
 * Pure utility functions for frequency conversion, normalization, and signal classification.
 * Extracted from SweepManager to keep the orchestrator focused on process lifecycle.
 */

/** Convert frequency value to Hz from any unit */
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
			return value * 1000000;
	}
}

/** Convert frequency value to MHz from any unit */
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

/** Categorize dB power level into human-readable signal strength */
export function getSignalStrength(dB: number): string {
	if (dB < -90) return 'No Signal';
	if (dB >= -90 && dB < -70) return 'Very Weak';
	if (dB >= -70 && dB < -50) return 'Weak';
	if (dB >= -50 && dB < -30) return 'Moderate';
	if (dB >= -30 && dB < -10) return 'Strong';
	return 'Very Strong';
}

/** Normalize heterogeneous frequency inputs to standard { value, unit } format */
export function normalizeFrequencies(
	frequencies: (number | { frequency?: number; value?: number; unit?: string })[]
): Array<{ value: number; unit: string }> {
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

/** Check if an error message indicates a critical HackRF startup failure */
export function isCriticalStartupError(message: string): boolean {
	const criticalErrors = [
		'No HackRF boards found',
		'hackrf_open() failed',
		'Resource busy',
		'Permission denied',
		'libusb_open() failed',
		'USB error',
		'hackrf_is_streaming() failed',
		'hackrf_start_rx() failed'
	];
	return criticalErrors.some((error) => message.toLowerCase().includes(error.toLowerCase()));
}

/** Check if an error message indicates a critical system failure */
export function isCriticalError(message: string): boolean {
	const criticalPatterns = [
		/no hackrf boards found/i,
		/hackrf_open\(\) failed/i,
		/resource busy/i,
		/permission denied/i,
		/libusb_open\(\) failed/i,
		/usb error/i,
		/hackrf_is_streaming\(\) failed/i,
		/hackrf_start_rx\(\) failed/i,
		/device not found/i,
		/initialization failed/i,
		/fatal error/i
	];
	return criticalPatterns.some((pattern) => pattern.test(message));
}
