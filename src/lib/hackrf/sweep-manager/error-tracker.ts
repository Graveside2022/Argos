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
import { RecoveryManager } from './error-recovery';

export type { DeviceState, ErrorAnalysis, RecoveryConfig };

export interface ErrorState {
	consecutiveErrors: number;
	maxConsecutiveErrors: number;
	frequencyErrors: Map<number, number>;
	recentFailures: number[];
	maxFailuresPerMinute: number;
}

/**
 * Manages error tracking and analysis for HackRF operations.
 * Recovery logic delegated to RecoveryManager.
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

	private readonly recovery: RecoveryManager;

	constructor(config: RecoveryConfig = {}) {
		this.recovery = new RecoveryManager(config);
		logger.info('[SEARCH] ErrorTracker initialized', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute
		});
	}

	/** Record a successful operation */
	recordSuccess(): void {
		this.errorState.consecutiveErrors = 0;
		this.deviceState.status = 'available';
		this.deviceState.lastSuccessfulOperation = new Date();
		this.deviceState.consecutiveBusyErrors = 0;
		this.deviceState.recoveryState = 'none';
		this.recovery.reset();
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
		if (newStatus) this.deviceState.status = newStatus;
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

	hasMaxConsecutiveErrors(): boolean {
		return this.errorState.consecutiveErrors >= this.errorState.maxConsecutiveErrors;
	}

	hasMaxFailuresPerMinute(): boolean {
		return this.errorState.recentFailures.length >= this.errorState.maxFailuresPerMinute;
	}

	shouldBlacklistFrequency(frequency: number): boolean {
		return (this.errorState.frequencyErrors.get(frequency) || 0) >= 3;
	}

	getFrequenciesToBlacklist(): number[] {
		const toBlacklist: number[] = [];
		for (const [frequency, errorCount] of this.errorState.frequencyErrors.entries()) {
			if (errorCount >= 3) toBlacklist.push(frequency);
		}
		return toBlacklist;
	}

	shouldAttemptRecovery(): boolean {
		return this.recovery.shouldAttemptRecovery(
			this.errorState.consecutiveErrors,
			this.deviceState.status
		);
	}

	startRecovery(): void {
		this.deviceState.recoveryState = this.recovery.start();
	}

	completeRecovery(successful: boolean): void {
		this.recovery.complete(successful);
		if (successful) {
			this.recordSuccess();
		} else {
			this.deviceState.recoveryState = 'cooling_down';
		}
	}

	getErrorState(): ErrorState {
		return { ...this.errorState, frequencyErrors: new Map(this.errorState.frequencyErrors) };
	}

	getDeviceState(): DeviceState {
		return { ...this.deviceState };
	}

	getRecoveryStatus() {
		return this.recovery.getStatus(this.errorState.consecutiveErrors, this.deviceState.status);
	}

	getErrorStatistics() {
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

	resetFrequencyErrors(frequency: number): void {
		this.errorState.frequencyErrors.delete(frequency);
		logger.info('[CLEANUP] Frequency error count reset', { frequency });
	}

	resetErrorTracking(): void {
		this.errorState.consecutiveErrors = 0;
		this.errorState.frequencyErrors.clear();
		this.errorState.recentFailures = [];
		this.deviceState.status = 'unknown';
		this.deviceState.consecutiveBusyErrors = 0;
		this.deviceState.recoveryState = 'none';
		this.recovery.reset();
		logger.info('[CLEANUP] All error tracking reset');
	}

	updateConfig(
		config: Partial<
			RecoveryConfig & { maxConsecutiveErrors?: number; maxFailuresPerMinute?: number }
		>
	): void {
		if (config.maxConsecutiveErrors !== undefined)
			this.errorState.maxConsecutiveErrors = config.maxConsecutiveErrors;
		if (config.maxFailuresPerMinute !== undefined)
			this.errorState.maxFailuresPerMinute = config.maxFailuresPerMinute;
		this.recovery.updateConfig(config);
		logger.info('[CONFIG] ErrorTracker configuration updated', {
			maxConsecutiveErrors: this.errorState.maxConsecutiveErrors,
			maxFailuresPerMinute: this.errorState.maxFailuresPerMinute
		});
	}

	private cleanupOldFailures(): void {
		const oneMinuteAgo = Date.now() - 60000;
		this.errorState.recentFailures = this.errorState.recentFailures.filter(
			(timestamp) => timestamp > oneMinuteAgo
		);
	}

	cleanup(): void {
		this.resetErrorTracking();
		logger.info('[CLEANUP] ErrorTracker cleanup completed');
	}
}
