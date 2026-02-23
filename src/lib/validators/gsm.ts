/**
 * GSM parameter validation to prevent command injection
 * All user input for GSM operations must pass through these validators
 */

import { GSM_LIMITS } from '$lib/constants/limits';

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

/**
 * Validate GSM gain parameter
 * @param gain - Gain value (string or number)
 * @returns Validated gain as number in dB
 * @throws ValidationError if invalid
 */
export function validateGain(gain: string | number): number {
	const gainNum = typeof gain === 'string' ? parseInt(gain, 10) : gain;

	if (isNaN(gainNum)) {
		throw new ValidationError('Gain must be a valid integer');
	}

	if (gainNum < GSM_LIMITS.GAIN_MIN_DB || gainNum > GSM_LIMITS.GAIN_MAX_DB) {
		throw new ValidationError(
			`Gain must be between ${GSM_LIMITS.GAIN_MIN_DB} and ${GSM_LIMITS.GAIN_MAX_DB} dB`
		);
	}

	return gainNum;
}
