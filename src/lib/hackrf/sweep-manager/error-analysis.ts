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

type ErrorTypeMatch = {
	patterns: string[];
	errorType: ErrorAnalysis['errorType'];
};

const ERROR_TYPE_MATCHERS: ErrorTypeMatch[] = [
	{ patterns: ['resource busy', 'device busy'], errorType: 'device_busy' },
	{ patterns: ['permission denied', 'access denied'], errorType: 'permission_denied' },
	{
		patterns: ['no hackrf boards found', 'hackrf_open() failed', 'device not found'],
		errorType: 'device_not_found'
	},
	{ patterns: ['libusb', 'usb error', 'usb_open() failed'], errorType: 'usb_error' }
];

function classifyErrorType(lowerError: string): ErrorAnalysis['errorType'] {
	const match = ERROR_TYPE_MATCHERS.find((m) => m.patterns.some((p) => lowerError.includes(p)));
	return match?.errorType ?? 'unknown';
}

type AnalysisBuilder = Record<
	ErrorAnalysis['errorType'],
	(busyCount: number, errCount: number, maxErr: number) => ErrorAnalysis
>;

const ANALYSIS_BUILDERS: AnalysisBuilder = {
	device_busy: (busyCount) => ({
		errorType: 'device_busy',
		severity: busyCount > 3 ? 'high' : 'medium',
		isRecoverable: true,
		recommendedAction: 'Wait and retry with process cleanup',
		requiresRestart: busyCount > 5
	}),
	permission_denied: () => ({
		errorType: 'permission_denied',
		severity: 'high',
		isRecoverable: false,
		recommendedAction: 'Check user permissions and udev rules',
		requiresRestart: false
	}),
	device_not_found: () => ({
		errorType: 'device_not_found',
		severity: 'critical',
		isRecoverable: true,
		recommendedAction: 'Check USB connection and device power',
		requiresRestart: true
	}),
	usb_error: () => ({
		errorType: 'usb_error',
		severity: 'high',
		isRecoverable: true,
		recommendedAction: 'Reset USB connection or restart device',
		requiresRestart: true
	}),
	unknown: (_busyCount, errCount, maxErr) => ({
		errorType: 'unknown',
		severity: errCount > 5 ? 'high' : 'medium',
		isRecoverable: true,
		recommendedAction: 'Generic retry with exponential backoff',
		requiresRestart: errCount > maxErr
	})
};

/**
 * Analyze an error message and determine its type, severity, and recovery options.
 */
export function analyzeError(
	errorMessage: string,
	consecutiveBusyErrors: number,
	consecutiveErrors: number,
	maxConsecutiveErrors: number
): ErrorAnalysis {
	const errorType = classifyErrorType(errorMessage.toLowerCase());
	return ANALYSIS_BUILDERS[errorType](
		consecutiveBusyErrors,
		consecutiveErrors,
		maxConsecutiveErrors
	);
}

const DEVICE_STATUS_MAP: Record<
	ErrorAnalysis['errorType'],
	'busy' | 'disconnected' | 'stuck' | null
> = {
	device_busy: 'busy',
	device_not_found: 'disconnected',
	permission_denied: 'disconnected',
	usb_error: 'stuck',
	unknown: null
};

/**
 * Determine device status from an error analysis result.
 */
export function deriveDeviceStatus(
	analysis: ErrorAnalysis,
	consecutiveErrors: number
): 'busy' | 'disconnected' | 'stuck' | null {
	const mapped = DEVICE_STATUS_MAP[analysis.errorType];
	if (mapped !== null) return mapped;
	return consecutiveErrors > 3 ? 'stuck' : null;
}

const DEVICE_STATUS_PENALTY: Record<string, number> = {
	available: 0,
	busy: 20,
	stuck: 30
};

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
	const deviceStatusPenalty = DEVICE_STATUS_PENALTY[deviceStatus] ?? 40;

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
