/**
 * GSM Intelligent Scan event types and factory functions
 *
 * Shared types and event constructors used by all phases of the
 * intelligent scan pipeline.
 */

/** Discriminant for scan event payloads */
export type ScanEventType = 'update' | 'result' | 'error';

/** A single event yielded by the intelligent scan generator */
export interface ScanEvent {
	type: ScanEventType;
	message?: string;
	result?: Record<string, unknown>;
}

/**
 * Create a progress-update event for SSE streaming.
 *
 * @param message - Human-readable status line
 * @returns ScanEvent with type 'update'
 */
export function createUpdateEvent(message: string): ScanEvent {
	return { type: 'update', message };
}

/**
 * Create a result event carrying structured data.
 *
 * @param data - Arbitrary result payload
 * @returns ScanEvent with type 'result'
 */
export function createResultEvent(data: Record<string, unknown>): ScanEvent {
	return { type: 'result', result: data };
}

/**
 * Create an error event with a standardised error payload.
 *
 * @param error - Human-readable error description
 * @returns ScanEvent with type 'error' and an empty scanResults array
 */
export function createErrorEvent(error: string): ScanEvent {
	return {
		type: 'error',
		message: `[ERROR] ${error}`,
		result: {
			type: 'scan_complete',
			success: false,
			message: error,
			scanResults: [],
			totalTested: 0
		}
	};
}
