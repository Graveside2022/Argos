import { logger } from '$lib/utils/logger';

import {
	analyzeError,
	calculateHealthScore,
	deriveDeviceStatus,
	type DeviceState,
	type ErrorAnalysis,
	findMostProblematicFrequency,
	type RecoveryConfig
} from './error-analysis';

export type { DeviceState, ErrorAnalysis, RecoveryConfig };

export interface ErrorState {
	consecutiveErrors: number;
	maxConsecutiveErrors: number;
	frequencyErrors: Map<number, number>;
	recentFailures: number[];
	maxFailuresPerMinute: number;
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

		logger.info('[SEARCH] ErrorTracker initialized', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute,
			maxRecoveryAttempts: this.recoveryConfig.maxRecoveryAttempts
		});
	}

	/** Record a successful operation */
	recordSuccess(): void {
		this.errorState.consecutiveErrors = 0;
		this.deviceState.status = 'available';
		this.deviceState.lastSuccessfulOperation = new Date();
		this.deviceState.consecutiveBusyErrors = 0;
		this.deviceState.recoveryState = 'none';
		this.recoveryAttempts = 0;
		this.isRecovering = false;
		logger.info('[OK] Operation successful - error counters reset');
	}

	private trackFrequencyError(frequency: number | undefined): void {
		if (!frequency) return;
		const currentCount = this.errorState.frequencyErrors.get(frequency) || 0;
		this.errorState.frequencyErrors.set(frequency, currentCount + 1);
	}

	private applyAnalysisToState(analysis: ErrorAnalysis): void {
		if (analysis.errorType === 'device_busy') {
			this.deviceState.consecutiveBusyErrors++;
		}
		const newStatus = deriveDeviceStatus(analysis, this.errorState.consecutiveErrors);
		if (newStatus) {
			this.deviceState.status = newStatus;
		}
	}

	/** Record an error and analyze it */
	recordError(
		error: Error | string,
		context: { frequency?: number; operation?: string } = {}
	): ErrorAnalysis {
		const errorMessage = error instanceof Error ? error.message : String(error);

		this.errorState.consecutiveErrors++;
		this.errorState.recentFailures.push(Date.now());
		this.cleanupOldFailures();
		this.trackFrequencyError(context.frequency);

		const analysis = analyzeError(
			errorMessage,
			this.deviceState.consecutiveBusyErrors,
			this.errorState.consecutiveErrors,
			this.errorState.maxConsecutiveErrors
		);

		this.applyAnalysisToState(analysis);

		logger.error('[ERROR] Error recorded and analyzed', {
			error: errorMessage,
			context,
			analysis,
			consecutiveErrors: this.errorState.consecutiveErrors,
			deviceStatus: this.deviceState.status
		});

		return analysis;
	}

	/** Check if maximum consecutive errors reached */
	hasMaxConsecutiveErrors(): boolean {
		return this.errorState.consecutiveErrors >= this.errorState.maxConsecutiveErrors;
	}

	/** Check if maximum failures per minute reached */
	hasMaxFailuresPerMinute(): boolean {
		return this.errorState.recentFailures.length >= this.errorState.maxFailuresPerMinute;
	}

	/** Check if frequency should be blacklisted due to repeated errors */
	shouldBlacklistFrequency(frequency: number): boolean {
		const errorCount = this.errorState.frequencyErrors.get(frequency) || 0;
		return errorCount >= 3;
	}

	/** Get frequencies that should be blacklisted */
	getFrequenciesToBlacklist(): number[] {
		const toBlacklist: number[] = [];
		for (const [frequency, errorCount] of this.errorState.frequencyErrors.entries()) {
			if (errorCount >= 3) {
				toBlacklist.push(frequency);
			}
		}
		return toBlacklist;
	}

	private isRecoveryCooldownActive(): boolean {
		if (!this.lastRecoveryAttempt) return false;
		const elapsed = Date.now() - this.lastRecoveryAttempt.getTime();
		return elapsed < (this.recoveryConfig.recoveryDelayMs || 2000);
	}

	private hasRecoverableCondition(): boolean {
		return (
			this.errorState.consecutiveErrors >= 2 ||
			this.deviceState.status === 'busy' ||
			this.deviceState.status === 'stuck'
		);
	}

	/** Check if recovery should be attempted */
	shouldAttemptRecovery(): boolean {
		if (this.isRecovering) return false;
		if (this.recoveryAttempts >= (this.recoveryConfig.maxRecoveryAttempts || 3)) return false;
		if (this.isRecoveryCooldownActive()) return false;
		return this.hasRecoverableCondition();
	}

	/** Start recovery process */
	startRecovery(): void {
		this.isRecovering = true;
		this.recoveryAttempts++;
		this.lastRecoveryAttempt = new Date();

		this.deviceState.recoveryState =
			this.recoveryAttempts >= (this.recoveryConfig.escalationThreshold || 5)
				? 'escalating'
				: 'retrying';

		logger.warn('[RETRY] Recovery process started', {
			attempt: this.recoveryAttempts,
			maxAttempts: this.recoveryConfig.maxRecoveryAttempts,
			deviceStatus: this.deviceState.status,
			recoveryState: this.deviceState.recoveryState
		});
	}

	/** Complete recovery process */
	completeRecovery(successful: boolean): void {
		this.isRecovering = false;

		if (successful) {
			this.recordSuccess();
			logger.info('[OK] Recovery completed successfully');
		} else {
			this.deviceState.recoveryState = 'cooling_down';
			logger.warn('[ERROR] Recovery attempt failed', {
				attempt: this.recoveryAttempts,
				nextAction:
					this.recoveryAttempts >= (this.recoveryConfig.maxRecoveryAttempts || 3)
						? 'Give up'
						: 'Retry after delay'
			});
		}
	}

	/** Get current error state */
	getErrorState(): ErrorState {
		return {
			...this.errorState,
			frequencyErrors: new Map(this.errorState.frequencyErrors)
		};
	}

	/** Get current device state */
	getDeviceState(): DeviceState {
		return { ...this.deviceState };
	}

	/** Get recovery status */
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

	/** Get error statistics */
	getErrorStatistics(): {
		consecutiveErrors: number;
		recentFailureCount: number;
		frequencyErrorCount: number;
		mostProblematicFrequency: { frequency: number; errors: number } | null;
		deviceStatus: string;
		overallHealthScore: number;
	} {
		return {
			consecutiveErrors: this.errorState.consecutiveErrors,
			recentFailureCount: this.errorState.recentFailures.length,
			frequencyErrorCount: this.errorState.frequencyErrors.size,
			mostProblematicFrequency: findMostProblematicFrequency(this.errorState.frequencyErrors),
			deviceStatus: this.deviceState.status,
			overallHealthScore: calculateHealthScore(
				this.errorState.consecutiveErrors,
				this.errorState.maxConsecutiveErrors,
				this.errorState.recentFailures.length,
				this.errorState.maxFailuresPerMinute,
				this.deviceState.status
			)
		};
	}

	/** Reset frequency error tracking for specific frequency */
	resetFrequencyErrors(frequency: number): void {
		this.errorState.frequencyErrors.delete(frequency);
		logger.info('[CLEANUP] Frequency error count reset', { frequency });
	}

	/** Reset all error tracking */
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
		logger.info('[CLEANUP] All error tracking reset');
	}

	/** Update configuration */
	updateConfig(
		config: Partial<
			RecoveryConfig & {
				maxConsecutiveErrors?: number;
				maxFailuresPerMinute?: number;
			}
		>
	): void {
		if (config.maxConsecutiveErrors !== undefined) {
			this.errorState.maxConsecutiveErrors = config.maxConsecutiveErrors;
		}
		if (config.maxFailuresPerMinute !== undefined) {
			this.errorState.maxFailuresPerMinute = config.maxFailuresPerMinute;
		}
		this.recoveryConfig = { ...this.recoveryConfig, ...config };
		logger.info('[CONFIG] ErrorTracker configuration updated', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute,
			recoveryConfig: this.recoveryConfig
		});
	}

	/** Clean up old failure records (older than 1 minute) */
	private cleanupOldFailures(): void {
		const oneMinuteAgo = Date.now() - 60000;
		this.errorState.recentFailures = this.errorState.recentFailures.filter(
			(timestamp) => timestamp > oneMinuteAgo
		);
	}

	/** Clean up resources */
	cleanup(): void {
		this.resetErrorTracking();
		logger.info('[CLEANUP] ErrorTracker cleanup completed');
	}
}
