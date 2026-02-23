/**
 * Zod Validation Error Handling Utility
 * Created for: Constitutional Audit Remediation (P1)
 * Tasks: T041-T044
 *
 * Purpose: Centralized error handling for Zod validation failures
 * - Console logging with full diagnostic details (FR-005)
 * - UI toast notifications for user-initiated actions (FR-006)
 * - No UI notifications for background tasks (FR-007)
 */

import { ZodError, type ZodIssue } from 'zod';

import { logger } from '$lib/utils/logger';

/**
 * Validation error context - determines whether to show UI notifications
 */
export type ValidationContext = 'user-action' | 'background' | 'api' | 'websocket';

/**
 * Formatted validation error for logging
 */
export interface FormattedValidationError {
	field: string;
	message: string;
	constraint: string;
	receivedValue: unknown;
	path: string;
}

/** Format a too_small issue by type. */
function formatTooSmall(issue: Extract<ZodIssue, { code: 'too_small' }>): string {
	if (issue.type === 'string') return `Must be at least ${issue.minimum} characters`;
	if (issue.type === 'number') return `Must be ${issue.inclusive ? '>=' : '>'} ${issue.minimum}`;
	return 'Too small';
}

/** Format a too_big issue by type. */
function formatTooBig(issue: Extract<ZodIssue, { code: 'too_big' }>): string {
	if (issue.type === 'string') return `Must be at most ${issue.maximum} characters`;
	if (issue.type === 'number') return `Must be ${issue.inclusive ? '<=' : '<'} ${issue.maximum}`;
	return 'Too large';
}

/** Formatter lookup for Zod issue codes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod issue union requires any for generic dispatch
const ISSUE_FORMATTERS: Record<string, (issue: any) => string> = {
	invalid_type: (i) => `Expected ${i.expected}, received ${i.received}`,
	too_small: formatTooSmall,
	too_big: formatTooBig,
	invalid_string: (i) => `Invalid format: ${i.validation}`,
	unrecognized_keys: (i) => `Unexpected keys: ${i.keys.join(', ')}`
};

/** Generate a user-friendly message for a Zod issue. */
function issueMessage(issue: ZodIssue): string {
	const formatter = ISSUE_FORMATTERS[issue.code];
	return formatter ? formatter(issue) : issue.message;
}

/**
 * Format a single Zod issue into a readable error message
 */
function formatZodIssue(issue: ZodIssue): FormattedValidationError {
	const field = issue.path.join('.');
	return {
		field: field || 'root',
		message: issueMessage(issue),
		constraint: issue.message,
		receivedValue: 'received' in issue ? issue.received : undefined,
		path: issue.path.join(' → ')
	};
}

/**
 * Log validation error to console with full diagnostic details
 * Per FR-005: Includes error message, field path, input data, stack trace
 */
export function logValidationError(
	error: ZodError,
	context: ValidationContext,
	inputData?: unknown
): void {
	const formattedErrors = error.issues.map(formatZodIssue);

	logger.error('Zod Validation Error', {
		context,
		failures: formattedErrors.map((err, idx) => ({
			index: idx + 1,
			field: err.field,
			path: err.path || 'root',
			error: err.message,
			constraint: err.constraint,
			receivedValue: err.receivedValue
		})),
		inputData,
		stack: error.stack
	});
}

/**
 * Get user-friendly error message for UI display
 * Per FR-006: Plain language, no stack traces, actionable guidance
 */
export function getUserFriendlyMessage(error: ZodError): string {
	if (error.issues.length === 0) {
		return 'Validation failed';
	}

	const firstIssue = formatZodIssue(error.issues[0]);
	const fieldName = firstIssue.field || 'Input';

	// Return concise, actionable message
	return `${fieldName}: ${firstIssue.message}`;
}

/**
 * Handle Zod validation error with context-aware logging and notifications
 *
 * @param error - ZodError from validation failure
 * @param context - Context of the validation (determines UI notification behavior)
 * @param inputData - Optional input data for debugging
 * @param showToast - Optional toast function for UI notifications (only called for user-action context)
 *
 * @example
 * ```typescript
 * const result = MySchema.safeParse(data);
 * if (!result.success) {
 *   handleValidationError(result.error, 'user-action', data, showToast);
 *   throw new Error('Validation failed');
 * }
 * ```
 */
export function handleValidationError(
	error: ZodError,
	context: ValidationContext,
	inputData?: unknown,
	showToast?: (message: string, type: 'error') => void
): void {
	// Always log to console (FR-005)
	logValidationError(error, context, inputData);

	// Only show UI notification for user-initiated actions (FR-006, FR-007)
	if (context === 'user-action' && showToast) {
		const message = getUserFriendlyMessage(error);
		showToast(message, 'error');
	}
}

/**
 * Safe parse with automatic error handling
 *
 * @param schema - Zod schema to parse with
 * @param data - Data to validate
 * @param context - Validation context
 * @param showToast - Optional toast function for UI notifications
 * @returns Parsed data if successful, undefined if validation fails
 *
 * @example
 * ```typescript
 * const signal = safeParseWithHandling(SignalSchema, rawData, 'api');
 * if (!signal) {
 *   return json({ error: 'Invalid signal data' }, { status: 400 });
 * }
 * ```
 */
export function safeParseWithHandling<T>(
	schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } },
	data: unknown,
	context: ValidationContext,
	showToast?: (message: string, type: 'error') => void
): T | undefined {
	const result = schema.safeParse(data);
	if (!result.success) {
		// Type assertion safe: Zod guarantees error exists when success is false
		handleValidationError(result.error!, context, data, showToast);
		return undefined;
	}
	return result.data;
}
