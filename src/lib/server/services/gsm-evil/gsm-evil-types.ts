/**
 * Shared types for GSM Evil control services.
 * Extracted to break the circular dependency between gsm-evil-control-service.ts,
 * gsm-evil-control-helpers.ts, and gsm-evil-stop-helpers.ts.
 */

export interface GsmEvilStartResult {
	success: boolean;
	message: string;
	error?: string;
	conflictingService?: string;
}

export interface GsmEvilStopResult {
	success: boolean;
	message: string;
	error?: string;
	suggestion?: string;
}
