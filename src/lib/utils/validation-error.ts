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

/**
 * Format a single Zod issue into a readable error message
 */
function formatZodIssue(issue: ZodIssue): FormattedValidationError {
	const field = issue.path.join('.');
	const constraint = issue.message;
	const receivedValue = 'received' in issue ? issue.received : undefined;

	// Generate user-friendly message based on issue type
	let message: string;
	switch (issue.code) {
		case 'invalid_type':
			message = `Expected ${issue.expected}, received ${issue.received}`;
			break;
		case 'too_small':
			if (issue.type === 'string') {
				message = `Must be at least ${issue.minimum} characters`;
			} else if (issue.type === 'number') {
				message = `Must be ${issue.inclusive ? '>=' : '>'} ${issue.minimum}`;
			} else {
				message = `Too small`;
			}
			break;
		case 'too_big':
			if (issue.type === 'string') {
				message = `Must be at most ${issue.maximum} characters`;
			} else if (issue.type === 'number') {
				message = `Must be ${issue.inclusive ? '<=' : '<'} ${issue.maximum}`;
			} else {
				message = `Too large`;
			}
			break;
		case 'invalid_string':
			message = `Invalid format: ${issue.validation}`;
			break;
		case 'unrecognized_keys':
			message = `Unexpected keys: ${issue.keys.join(', ')}`;
			break;
		default:
			message = issue.message;
	}

	return {
		field: field || 'root',
		message,
		constraint,
		receivedValue,
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

	console.error('═══ Zod Validation Error ═══');
	console.error(`Context: ${context}`);
	console.error(`Timestamp: ${new Date().toISOString()}`);
	console.error('\nValidation Failures:');
	formattedErrors.forEach((err, idx) => {
		console.error(`  ${idx + 1}. Field: ${err.field}`);
		console.error(`     Path: ${err.path || 'root'}`);
		console.error(`     Error: ${err.message}`);
		console.error(`     Constraint: ${err.constraint}`);
		if (err.receivedValue !== undefined) {
			console.error(`     Received: ${JSON.stringify(err.receivedValue)}`);
		}
	});

	if (inputData) {
		console.error('\nInput Data:');
		console.error(JSON.stringify(inputData, null, 2));
	}

	console.error('\nStack Trace:');
	console.error(error.stack);
	console.error('═══════════════════════════');
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
 * Get multiple user-friendly messages for UI display (for toast stacking)
 */
export function getAllUserFriendlyMessages(error: ZodError, maxMessages = 3): string[] {
	return error.issues.slice(0, maxMessages).map((issue) => {
		const formatted = formatZodIssue(issue);
		const fieldName = formatted.field || 'Input';
		return `${fieldName}: ${formatted.message}`;
	});
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
 * Type guard to check if an error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
	return error instanceof ZodError;
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
		handleValidationError(result.error, context, data, showToast);
		return undefined;
	}
	return result.data;
}
