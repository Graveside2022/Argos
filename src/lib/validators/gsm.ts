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
 * Validate GSM frequency parameter
 * @param freq - Frequency value (string or number)
 * @returns Validated frequency as number in MHz
 * @throws ValidationError if invalid
 */
export function validateFrequency(freq: string | number): number {
	const freqNum = typeof freq === 'string' ? parseFloat(freq) : freq;

	if (isNaN(freqNum)) {
		throw new ValidationError('Frequency must be a valid number');
	}

	if (freqNum < GSM_LIMITS.FREQ_MIN_MHZ || freqNum > GSM_LIMITS.FREQ_MAX_MHZ) {
		throw new ValidationError(
			`Frequency must be between ${GSM_LIMITS.FREQ_MIN_MHZ} and ${GSM_LIMITS.FREQ_MAX_MHZ} MHz`
		);
	}

	return freqNum;
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
