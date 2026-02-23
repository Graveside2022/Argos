/**
 * Signal classification and error detection utilities for HackRF sweep operations.
 * Frequency conversion functions live in frequency-utils.ts (canonical home).
 */

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
