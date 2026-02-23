/**
 * Signal classification and error detection utilities for HackRF sweep operations.
 * Frequency conversion functions live in frequency-utils.ts (canonical home).
 */

/** Categorize dB power level into human-readable signal strength */
export function getSignalStrength(dB: number): string {
	if (dB < -90) return 'No Signal';
	if (dB >= -90 && dB < -70) return 'Very Weak';
	if (dB >= -70 && dB < -50) return 'Weak';
	if (dB >= -50 && dB < -30) return 'Moderate';
	if (dB >= -30 && dB < -10) return 'Strong';
	return 'Very Strong';
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
