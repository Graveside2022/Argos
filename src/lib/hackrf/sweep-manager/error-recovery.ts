import { logger } from '$lib/utils/logger';

import { type DeviceState, type RecoveryConfig } from './error-analysis';

export type { RecoveryConfig };

export interface RecoveryStatus {
	isRecovering: boolean;
	recoveryAttempts: number;
	maxRecoveryAttempts: number;
	lastRecoveryAttempt: Date | null;
	canAttemptRecovery: boolean;
}

/**
 * Manages device recovery state and cooldown logic for HackRF operations.
 * Separated from error tracking so each responsibility is independently testable.
 */
export class RecoveryManager {
	private config: RecoveryConfig;
	private attempts = 0;
	private lastAttempt: Date | null = null;
	private recovering = false;

	constructor(config: RecoveryConfig = {}) {
		this.config = {
			maxRecoveryAttempts: 3,
			recoveryDelayMs: 2000,
			escalationThreshold: 5,
			cooldownPeriodMs: 30000,
			...config
		};
	}

	get isRecovering(): boolean {
		return this.recovering;
	}

	get recoveryAttempts(): number {
		return this.attempts;
	}

	/** Check if recovery cooldown is still active. */
	private isCooldownActive(): boolean {
		if (!this.lastAttempt) return false;
		const elapsed = Date.now() - this.lastAttempt.getTime();
		return elapsed < (this.config.recoveryDelayMs || 2000);
	}

	/** Whether a recoverable condition is present in the given state. */
	hasRecoverableCondition(consecutiveErrors: number, deviceStatus: string): boolean {
		return consecutiveErrors >= 2 || deviceStatus === 'busy' || deviceStatus === 'stuck';
	}

	/** Check if recovery should be attempted. */
	shouldAttemptRecovery(consecutiveErrors: number, deviceStatus: string): boolean {
		if (this.recovering) return false;
		if (this.attempts >= (this.config.maxRecoveryAttempts || 3)) return false;
		if (this.isCooldownActive()) return false;
		return this.hasRecoverableCondition(consecutiveErrors, deviceStatus);
	}

	/** Start recovery process, returning the new recovery state for the device. */
	start(): DeviceState['recoveryState'] {
		this.recovering = true;
		this.attempts++;
		this.lastAttempt = new Date();

		const state: DeviceState['recoveryState'] =
			this.attempts >= (this.config.escalationThreshold || 5) ? 'escalating' : 'retrying';

		logger.warn('[RETRY] Recovery process started', {
			attempt: this.attempts,
			maxAttempts: this.config.maxRecoveryAttempts,
			recoveryState: state
		});

		return state;
	}

	/** Complete recovery process. Returns true if it was successful. */
	complete(successful: boolean): void {
		this.recovering = false;

		if (successful) {
			this.reset();
			logger.info('[OK] Recovery completed successfully');
		} else {
			logger.warn('[ERROR] Recovery attempt failed', {
				attempt: this.attempts,
				nextAction:
					this.attempts >= (this.config.maxRecoveryAttempts || 3)
						? 'Give up'
						: 'Retry after delay'
			});
		}
	}

	/** Reset all recovery state. */
	reset(): void {
		this.attempts = 0;
		this.recovering = false;
		this.lastAttempt = null;
	}

	/** Update configuration. */
	updateConfig(config: Partial<RecoveryConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/** Get current recovery status. */
	getStatus(consecutiveErrors: number, deviceStatus: string): RecoveryStatus {
		return {
			isRecovering: this.recovering,
			recoveryAttempts: this.attempts,
			maxRecoveryAttempts: this.config.maxRecoveryAttempts || 3,
			lastRecoveryAttempt: this.lastAttempt,
			canAttemptRecovery: this.shouldAttemptRecovery(consecutiveErrors, deviceStatus)
		};
	}
}
