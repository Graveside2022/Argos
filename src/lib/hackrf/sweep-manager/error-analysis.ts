/**
 * Error analysis and classification for HackRF operations.
 * Extracted from error-tracker.ts for constitutional compliance (Article 2.2).
 */

export interface DeviceState {
	status: 'unknown' | 'available' | 'busy' | 'stuck' | 'disconnected';
	lastSuccessfulOperation: Date | null;
	consecutiveBusyErrors: number;
	recoveryState: 'none' | 'retrying' | 'escalating' | 'cooling_down';
}

export interface RecoveryConfig {
	maxRecoveryAttempts?: number;
	recoveryDelayMs?: number;
	escalationThreshold?: number;
	cooldownPeriodMs?: number;
}

export interface ErrorAnalysis {
	errorType: 'device_busy' | 'permission_denied' | 'device_not_found' | 'usb_error' | 'unknown';
	severity: 'low' | 'medium' | 'high' | 'critical';
	isRecoverable: boolean;
	recommendedAction: string;
	requiresRestart: boolean;
}

/**
 * Analyze an error message and determine its type, severity, and recovery options.
 */
export function analyzeError(
	errorMessage: string,
	consecutiveBusyErrors: number,
	consecutiveErrors: number,
	maxConsecutiveErrors: number
): ErrorAnalysis {
	const lowerError = errorMessage.toLowerCase();

	// Device busy errors
	if (lowerError.includes('resource busy') || lowerError.includes('device busy')) {
		return {
			errorType: 'device_busy',
			severity: consecutiveBusyErrors > 3 ? 'high' : 'medium',
			isRecoverable: true,
			recommendedAction: 'Wait and retry with process cleanup',
			requiresRestart: consecutiveBusyErrors > 5
		};
	}

	// Permission errors
	if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
		return {
			errorType: 'permission_denied',
			severity: 'high',
			isRecoverable: false,
			recommendedAction: 'Check user permissions and udev rules',
			requiresRestart: false
		};
	}

	// Device not found
	if (
		lowerError.includes('no hackrf boards found') ||
		lowerError.includes('hackrf_open() failed') ||
		lowerError.includes('device not found')
	) {
		return {
			errorType: 'device_not_found',
			severity: 'critical',
			isRecoverable: true,
			recommendedAction: 'Check USB connection and device power',
			requiresRestart: true
		};
	}

	// USB errors
	if (
		lowerError.includes('libusb') ||
		lowerError.includes('usb error') ||
		lowerError.includes('usb_open() failed')
	) {
		return {
			errorType: 'usb_error',
			severity: 'high',
			isRecoverable: true,
			recommendedAction: 'Reset USB connection or restart device',
			requiresRestart: true
		};
	}

	// Unknown error
	return {
		errorType: 'unknown',
		severity: consecutiveErrors > 5 ? 'high' : 'medium',
		isRecoverable: true,
		recommendedAction: 'Generic retry with exponential backoff',
		requiresRestart: consecutiveErrors > maxConsecutiveErrors
	};
}

/**
 * Determine device status from an error analysis result.
 */
export function deriveDeviceStatus(
	analysis: ErrorAnalysis,
	consecutiveErrors: number
): 'busy' | 'disconnected' | 'stuck' | null {
	switch (analysis.errorType) {
		case 'device_busy':
			return 'busy';
		case 'device_not_found':
		case 'permission_denied':
			return 'disconnected';
		case 'usb_error':
			return 'stuck';
		default:
			if (consecutiveErrors > 3) {
				return 'stuck';
			}
			return null;
	}
}

/**
 * Calculate an overall health score (0-100, higher is better) from error state.
 */
export function calculateHealthScore(
	consecutiveErrors: number,
	maxConsecutiveErrors: number,
	recentFailureCount: number,
	maxFailuresPerMinute: number,
	deviceStatus: string
): number {
	const consecutiveErrorPenalty = (consecutiveErrors / maxConsecutiveErrors) * 40;
	const recentFailurePenalty = (recentFailureCount / maxFailuresPerMinute) * 30;
	const deviceStatusPenalty =
		deviceStatus === 'available'
			? 0
			: deviceStatus === 'busy'
				? 20
				: deviceStatus === 'stuck'
					? 30
					: 40;

	return Math.max(
		0,
		Math.round(100 - consecutiveErrorPenalty - recentFailurePenalty - deviceStatusPenalty)
	);
}

/**
 * Find the frequency with the most errors from a frequency error map.
 */
export function findMostProblematicFrequency(
	frequencyErrors: Map<number, number>
): { frequency: number; errors: number } | null {
	let result: { frequency: number; errors: number } | null = null;

	for (const [frequency, errors] of frequencyErrors.entries()) {
		if (!result || errors > result.errors) {
			result = { frequency, errors };
		}
	}

	return result;
}
