/**
 * Error recovery logic and device state management for HackRF operations.
 * Extracted from error-tracker.ts for constitutional compliance (Article 2.2).
 */

import { logInfo, logWarn } from '$lib/utils/logger';

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
 * Analyze error message and determine characteristics
 */
export function analyzeError(
	errorMessage: string,
	consecutiveBusyErrors: number,
	consecutiveErrors: number,
	maxConsecutiveErrors: number
): { analysis: ErrorAnalysis; isBusyError: boolean } {
	const lowerError = errorMessage.toLowerCase();

	if (lowerError.includes('resource busy') || lowerError.includes('device busy')) {
		return {
			analysis: {
				errorType: 'device_busy',
				severity: consecutiveBusyErrors + 1 > 3 ? 'high' : 'medium',
				isRecoverable: true,
				recommendedAction: 'Wait and retry with process cleanup',
				requiresRestart: consecutiveBusyErrors + 1 > 5
			},
			isBusyError: true
		};
	}

	if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
		return {
			analysis: {
				errorType: 'permission_denied',
				severity: 'high',
				isRecoverable: false,
				recommendedAction: 'Check user permissions and udev rules',
				requiresRestart: false
			},
			isBusyError: false
		};
	}

	if (
		lowerError.includes('no hackrf boards found') ||
		lowerError.includes('hackrf_open() failed') ||
		lowerError.includes('device not found')
	) {
		return {
			analysis: {
				errorType: 'device_not_found',
				severity: 'critical',
				isRecoverable: true,
				recommendedAction: 'Check USB connection and device power',
				requiresRestart: true
			},
			isBusyError: false
		};
	}

	if (
		lowerError.includes('libusb') ||
		lowerError.includes('usb error') ||
		lowerError.includes('usb_open() failed')
	) {
		return {
			analysis: {
				errorType: 'usb_error',
				severity: 'high',
				isRecoverable: true,
				recommendedAction: 'Reset USB connection or restart device',
				requiresRestart: true
			},
			isBusyError: false
		};
	}

	return {
		analysis: {
			errorType: 'unknown',
			severity: consecutiveErrors > 5 ? 'high' : 'medium',
			isRecoverable: true,
			recommendedAction: 'Generic retry with exponential backoff',
			requiresRestart: consecutiveErrors > maxConsecutiveErrors
		},
		isBusyError: false
	};
}

/**
 * Update device state based on error analysis
 */
export function updateDeviceState(
	deviceState: DeviceState,
	analysis: ErrorAnalysis,
	consecutiveErrors: number
): DeviceState {
	const updated = { ...deviceState };

	switch (analysis.errorType) {
		case 'device_busy':
			updated.status = 'busy';
			break;
		case 'device_not_found':
			updated.status = 'disconnected';
			break;
		case 'permission_denied':
			updated.status = 'disconnected';
			break;
		case 'usb_error':
			updated.status = 'stuck';
			break;
		default:
			if (consecutiveErrors > 3) {
				updated.status = 'stuck';
			}
	}

	return updated;
}

/**
 * Check if recovery should be attempted
 */
export function shouldAttemptRecovery(
	isRecovering: boolean,
	recoveryAttempts: number,
	lastRecoveryAttempt: Date | null,
	recoveryConfig: RecoveryConfig,
	consecutiveErrors: number,
	deviceStatus: DeviceState['status']
): boolean {
	if (isRecovering) return false;
	if (recoveryAttempts >= (recoveryConfig.maxRecoveryAttempts || 3)) return false;

	if (lastRecoveryAttempt) {
		const timeSinceLastAttempt = Date.now() - lastRecoveryAttempt.getTime();
		if (timeSinceLastAttempt < (recoveryConfig.recoveryDelayMs || 2000)) {
			return false;
		}
	}

	return consecutiveErrors >= 2 || deviceStatus === 'busy' || deviceStatus === 'stuck';
}

/**
 * Start recovery process and return updated state
 */
export function startRecovery(
	recoveryAttempts: number,
	recoveryConfig: RecoveryConfig,
	deviceState: DeviceState
): { recoveryAttempts: number; deviceState: DeviceState; lastRecoveryAttempt: Date } {
	const newAttempts = recoveryAttempts + 1;
	const updatedDevice = { ...deviceState };

	if (newAttempts >= (recoveryConfig.escalationThreshold || 5)) {
		updatedDevice.recoveryState = 'escalating';
	} else {
		updatedDevice.recoveryState = 'retrying';
	}

	logWarn('[RETRY] Recovery process started', {
		attempt: newAttempts,
		maxAttempts: recoveryConfig.maxRecoveryAttempts,
		deviceStatus: updatedDevice.status,
		recoveryState: updatedDevice.recoveryState
	});

	return {
		recoveryAttempts: newAttempts,
		deviceState: updatedDevice,
		lastRecoveryAttempt: new Date()
	};
}

/**
 * Complete recovery process
 */
export function completeRecovery(
	successful: boolean,
	recoveryAttempts: number,
	recoveryConfig: RecoveryConfig
): { recoveryState: DeviceState['recoveryState'] } {
	if (successful) {
		logInfo('[OK] Recovery completed successfully');
		return { recoveryState: 'none' };
	}

	logWarn('[ERROR] Recovery attempt failed', {
		attempt: recoveryAttempts,
		nextAction:
			recoveryAttempts >= (recoveryConfig.maxRecoveryAttempts || 3)
				? 'Give up'
				: 'Retry after delay'
	});

	return { recoveryState: 'cooling_down' };
}

/**
 * Calculate overall error health score (0-100, higher is better)
 */
export function calculateHealthScore(
	consecutiveErrors: number,
	maxConsecutiveErrors: number,
	recentFailuresCount: number,
	maxFailuresPerMinute: number,
	deviceStatus: DeviceState['status']
): number {
	const consecutiveErrorPenalty = (consecutiveErrors / maxConsecutiveErrors) * 40;
	const recentFailurePenalty = (recentFailuresCount / maxFailuresPerMinute) * 30;
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
 * Find the frequency with the most errors
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
