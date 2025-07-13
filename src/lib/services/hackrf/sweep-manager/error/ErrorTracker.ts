import { logInfo, logError, logWarn } from '$lib/utils/logger';

export interface ErrorState {
	consecutiveErrors: number;
	maxConsecutiveErrors: number;
	frequencyErrors: Map<number, number>;
	recentFailures: number[];
	maxFailuresPerMinute: number;
}

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
 * Manages error tracking, analysis, and recovery for HackRF operations
 */
export class ErrorTracker {
	private errorState: ErrorState = {
		consecutiveErrors: 0,
		maxConsecutiveErrors: 8,
		frequencyErrors: new Map<number, number>(),
		recentFailures: [],
		maxFailuresPerMinute: 5
	};

	private deviceState: DeviceState = {
		status: 'unknown',
		lastSuccessfulOperation: null,
		consecutiveBusyErrors: 0,
		recoveryState: 'none'
	};

	private recoveryConfig: RecoveryConfig = {
		maxRecoveryAttempts: 3,
		recoveryDelayMs: 2000,
		escalationThreshold: 5,
		cooldownPeriodMs: 30000
	};

	private recoveryAttempts = 0;
	private lastRecoveryAttempt: Date | null = null;
	private isRecovering = false;

	constructor(config: RecoveryConfig = {}) {
		this.recoveryConfig = { ...this.recoveryConfig, ...config };
		
		logInfo('🔍 ErrorTracker initialized', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute,
			maxRecoveryAttempts: this.recoveryConfig.maxRecoveryAttempts
		});
	}

	/**
	 * Record a successful operation
	 */
	recordSuccess(): void {
		this.errorState.consecutiveErrors = 0;
		this.deviceState.status = 'available';
		this.deviceState.lastSuccessfulOperation = new Date();
		this.deviceState.consecutiveBusyErrors = 0;
		this.deviceState.recoveryState = 'none';
		this.recoveryAttempts = 0;
		this.isRecovering = false;

		logInfo('✅ Operation successful - error counters reset');
	}

	/**
	 * Record an error and analyze it
	 */
	recordError(
		error: Error | string, 
		context: { frequency?: number; operation?: string } = {}
	): ErrorAnalysis {
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// Increment consecutive errors
		this.errorState.consecutiveErrors++;
		
		// Add to recent failures
		this.errorState.recentFailures.push(Date.now());
		this.cleanupOldFailures();

		// Track frequency-specific errors
		if (context.frequency) {
			const currentCount = this.errorState.frequencyErrors.get(context.frequency) || 0;
			this.errorState.frequencyErrors.set(context.frequency, currentCount + 1);
		}

		// Analyze the error
		const analysis = this.analyzeError(errorMessage);

		// Update device state based on error type
		this.updateDeviceState(analysis);

		logError('❌ Error recorded and analyzed', {
			error: errorMessage,
			context,
			analysis,
			consecutiveErrors: this.errorState.consecutiveErrors,
			deviceStatus: this.deviceState.status
		});

		return analysis;
	}

	/**
	 * Analyze error message and determine characteristics
	 */
	private analyzeError(errorMessage: string): ErrorAnalysis {
		const lowerError = errorMessage.toLowerCase();

		// Device busy errors
		if (lowerError.includes('resource busy') || lowerError.includes('device busy')) {
			this.deviceState.consecutiveBusyErrors++;
			return {
				errorType: 'device_busy',
				severity: this.deviceState.consecutiveBusyErrors > 3 ? 'high' : 'medium',
				isRecoverable: true,
				recommendedAction: 'Wait and retry with process cleanup',
				requiresRestart: this.deviceState.consecutiveBusyErrors > 5
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
		if (lowerError.includes('no hackrf boards found') || 
		    lowerError.includes('hackrf_open() failed') ||
		    lowerError.includes('device not found')) {
			return {
				errorType: 'device_not_found',
				severity: 'critical',
				isRecoverable: true,
				recommendedAction: 'Check USB connection and device power',
				requiresRestart: true
			};
		}

		// USB errors
		if (lowerError.includes('libusb') || 
		    lowerError.includes('usb error') ||
		    lowerError.includes('usb_open() failed')) {
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
			severity: this.errorState.consecutiveErrors > 5 ? 'high' : 'medium',
			isRecoverable: true,
			recommendedAction: 'Generic retry with exponential backoff',
			requiresRestart: this.errorState.consecutiveErrors > this.errorState.maxConsecutiveErrors
		};
	}

	/**
	 * Update device state based on error analysis
	 */
	private updateDeviceState(analysis: ErrorAnalysis): void {
		switch (analysis.errorType) {
			case 'device_busy':
				this.deviceState.status = 'busy';
				break;
			case 'device_not_found':
				this.deviceState.status = 'disconnected';
				break;
			case 'permission_denied':
				this.deviceState.status = 'disconnected';
				break;
			case 'usb_error':
				this.deviceState.status = 'stuck';
				break;
			default:
				if (this.errorState.consecutiveErrors > 3) {
					this.deviceState.status = 'stuck';
				}
		}
	}

	/**
	 * Check if maximum consecutive errors reached
	 */
	hasMaxConsecutiveErrors(): boolean {
		return this.errorState.consecutiveErrors >= this.errorState.maxConsecutiveErrors;
	}

	/**
	 * Check if maximum failures per minute reached
	 */
	hasMaxFailuresPerMinute(): boolean {
		return this.errorState.recentFailures.length >= this.errorState.maxFailuresPerMinute;
	}

	/**
	 * Check if frequency should be blacklisted due to repeated errors
	 */
	shouldBlacklistFrequency(frequency: number): boolean {
		const errorCount = this.errorState.frequencyErrors.get(frequency) || 0;
		return errorCount >= 3; // Blacklist after 3 errors on same frequency
	}

	/**
	 * Get frequencies that should be blacklisted
	 */
	getFrequenciesToBlacklist(): number[] {
		const toBlacklist: number[] = [];
		
		for (const [frequency, errorCount] of this.errorState.frequencyErrors.entries()) {
			if (errorCount >= 3) {
				toBlacklist.push(frequency);
			}
		}

		return toBlacklist;
	}

	/**
	 * Check if recovery should be attempted
	 */
	shouldAttemptRecovery(): boolean {
		if (this.isRecovering) {
			return false;
		}

		if (this.recoveryAttempts >= (this.recoveryConfig.maxRecoveryAttempts || 3)) {
			return false;
		}

		// Check if enough time has passed since last recovery attempt
		if (this.lastRecoveryAttempt) {
			const timeSinceLastAttempt = Date.now() - this.lastRecoveryAttempt.getTime();
			if (timeSinceLastAttempt < (this.recoveryConfig.recoveryDelayMs || 2000)) {
				return false;
			}
		}

		// Attempt recovery for certain error conditions
		return this.errorState.consecutiveErrors >= 2 || 
		       this.deviceState.status === 'busy' || 
		       this.deviceState.status === 'stuck';
	}

	/**
	 * Start recovery process
	 */
	startRecovery(): void {
		this.isRecovering = true;
		this.recoveryAttempts++;
		this.lastRecoveryAttempt = new Date();

		if (this.recoveryAttempts >= (this.recoveryConfig.escalationThreshold || 5)) {
			this.deviceState.recoveryState = 'escalating';
		} else {
			this.deviceState.recoveryState = 'retrying';
		}

		logWarn('🔄 Recovery process started', {
			attempt: this.recoveryAttempts,
			maxAttempts: this.recoveryConfig.maxRecoveryAttempts,
			deviceStatus: this.deviceState.status,
			recoveryState: this.deviceState.recoveryState
		});
	}

	/**
	 * Complete recovery process
	 */
	completeRecovery(successful: boolean): void {
		this.isRecovering = false;

		if (successful) {
			this.recordSuccess();
			logInfo('✅ Recovery completed successfully');
		} else {
			this.deviceState.recoveryState = 'cooling_down';
			logWarn('❌ Recovery attempt failed', {
				attempt: this.recoveryAttempts,
				nextAction: this.recoveryAttempts >= (this.recoveryConfig.maxRecoveryAttempts || 3) 
					? 'Give up' 
					: 'Retry after delay'
			});
		}
	}

	/**
	 * Get current error state
	 */
	getErrorState(): ErrorState {
		return { 
			...this.errorState,
			frequencyErrors: new Map(this.errorState.frequencyErrors)
		};
	}

	/**
	 * Get current device state
	 */
	getDeviceState(): DeviceState {
		return { ...this.deviceState };
	}

	/**
	 * Get recovery status
	 */
	getRecoveryStatus(): {
		isRecovering: boolean;
		recoveryAttempts: number;
		maxRecoveryAttempts: number;
		lastRecoveryAttempt: Date | null;
		canAttemptRecovery: boolean;
	} {
		return {
			isRecovering: this.isRecovering,
			recoveryAttempts: this.recoveryAttempts,
			maxRecoveryAttempts: this.recoveryConfig.maxRecoveryAttempts || 3,
			lastRecoveryAttempt: this.lastRecoveryAttempt,
			canAttemptRecovery: this.shouldAttemptRecovery()
		};
	}

	/**
	 * Get error statistics
	 */
	getErrorStatistics(): {
		consecutiveErrors: number;
		recentFailureCount: number;
		frequencyErrorCount: number;
		mostProblematicFrequency: { frequency: number; errors: number } | null;
		deviceStatus: string;
		overallHealthScore: number;
	} {
		// Find most problematic frequency
		let mostProblematicFrequency: { frequency: number; errors: number } | null = null;
		for (const [frequency, errors] of this.errorState.frequencyErrors.entries()) {
			if (!mostProblematicFrequency || errors > mostProblematicFrequency.errors) {
				mostProblematicFrequency = { frequency, errors };
			}
		}

		// Calculate health score (0-100, higher is better)
		const maxErrors = this.errorState.maxConsecutiveErrors;
		const consecutiveErrorPenalty = (this.errorState.consecutiveErrors / maxErrors) * 40;
		const recentFailurePenalty = (this.errorState.recentFailures.length / this.errorState.maxFailuresPerMinute) * 30;
		const deviceStatusPenalty = this.deviceState.status === 'available' ? 0 : 
		                           this.deviceState.status === 'busy' ? 20 :
		                           this.deviceState.status === 'stuck' ? 30 : 40;
		
		const overallHealthScore = Math.max(0, 100 - consecutiveErrorPenalty - recentFailurePenalty - deviceStatusPenalty);

		return {
			consecutiveErrors: this.errorState.consecutiveErrors,
			recentFailureCount: this.errorState.recentFailures.length,
			frequencyErrorCount: this.errorState.frequencyErrors.size,
			mostProblematicFrequency,
			deviceStatus: this.deviceState.status,
			overallHealthScore: Math.round(overallHealthScore)
		};
	}

	/**
	 * Reset frequency error tracking for specific frequency
	 */
	resetFrequencyErrors(frequency: number): void {
		this.errorState.frequencyErrors.delete(frequency);
		logInfo('🧹 Frequency error count reset', { frequency });
	}

	/**
	 * Reset all error tracking
	 */
	resetErrorTracking(): void {
		this.errorState.consecutiveErrors = 0;
		this.errorState.frequencyErrors.clear();
		this.errorState.recentFailures = [];
		this.deviceState.status = 'unknown';
		this.deviceState.consecutiveBusyErrors = 0;
		this.deviceState.recoveryState = 'none';
		this.recoveryAttempts = 0;
		this.isRecovering = false;
		this.lastRecoveryAttempt = null;

		logInfo('🧹 All error tracking reset');
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<RecoveryConfig & { maxConsecutiveErrors?: number; maxFailuresPerMinute?: number }>): void {
		if (config.maxConsecutiveErrors !== undefined) {
			this.errorState.maxConsecutiveErrors = config.maxConsecutiveErrors;
		}
		if (config.maxFailuresPerMinute !== undefined) {
			this.errorState.maxFailuresPerMinute = config.maxFailuresPerMinute;
		}

		this.recoveryConfig = { ...this.recoveryConfig, ...config };

		logInfo('⚙️ ErrorTracker configuration updated', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute,
			recoveryConfig: this.recoveryConfig
		});
	}

	/**
	 * Clean up old failure records (older than 1 minute)
	 */
	private cleanupOldFailures(): void {
		const oneMinuteAgo = Date.now() - 60000;
		this.errorState.recentFailures = this.errorState.recentFailures.filter(
			timestamp => timestamp > oneMinuteAgo
		);
	}

	/**
	 * Clean up resources
	 */
	cleanup(): void {
		this.resetErrorTracking();
		logInfo('🧹 ErrorTracker cleanup completed');
	}
}