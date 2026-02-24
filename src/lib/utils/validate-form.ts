import type { ZodSchema } from 'zod';

export interface FormValidationResult<T> {
	data: T | null;
	errors: Record<string, string>;
	isValid: boolean;
}

/**
 * Validate form data against a Zod schema.
 * Returns typed data on success, field-keyed error messages on failure.
 */
export function validateForm<T>(schema: ZodSchema<T>, data: unknown): FormValidationResult<T> {
	const result = schema.safeParse(data);

	if (result.success) {
		return { data: result.data, errors: {}, isValid: true };
	}

	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
		if (!errors[key]) {
			errors[key] = issue.message;
		}
	}

	return { data: null, errors, isValid: false };
}
