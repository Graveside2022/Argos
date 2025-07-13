/**
 * Type guard utilities for runtime type checking
 * These utilities provide type-safe validation for unknown data
 */

/**
 * Checks if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a value is a string
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Checks if a value is a number (including checking for NaN)
 */
export function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value);
}

/**
 * Checks if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

/**
 * Checks if an object has a specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
	return isObject(obj) && key in obj;
}

/**
 * Checks if an object has multiple properties
 */
export function hasProperties<K extends string>(
	obj: unknown,
	keys: K[]
): obj is Record<K, unknown> {
	return isObject(obj) && keys.every((key) => key in obj);
}

/**
 * Type guard for error objects with a code property
 */
export function isErrorWithCode(error: unknown): error is Error & { code: string } {
	return (
		error instanceof Error &&
		'code' in error &&
		isString((error as Error & { code: unknown }).code)
	);
}

/**
 * Type guard for WebSocket message validation
 */
export interface ValidatedMessage {
	type: string;
	data?: unknown;
}

export function isValidMessage(msg: unknown): msg is ValidatedMessage {
	return isObject(msg) && hasProperty(msg, 'type') && isString(msg.type);
}

/**
 * Type guard for sweep data validation
 */
export interface SweepDataValidation {
	frequency_start: number;
	frequency_end: number;
	bin_count: number;
	bins: number[];
	sample_rate: number;
}

export function isSweepData(data: unknown): data is SweepDataValidation {
	if (!isObject(data)) return false;

	return (
		hasProperties(data, [
			'frequency_start',
			'frequency_end',
			'bin_count',
			'bins',
			'sample_rate'
		]) &&
		isNumber(data.frequency_start) &&
		isNumber(data.frequency_end) &&
		isNumber(data.bin_count) &&
		Array.isArray(data.bins) &&
		data.bins.every(isNumber) &&
		isNumber(data.sample_rate)
	);
}

/**
 * Type guard for device info validation
 */
export interface DeviceInfoValidation {
	serial: string;
	version: string;
	status: string;
}

export function isDeviceInfo(info: unknown): info is DeviceInfoValidation {
	if (!isObject(info)) return false;

	return (
		hasProperties(info, ['serial', 'version', 'status']) &&
		isString(info.serial) &&
		isString(info.version) &&
		isString(info.status)
	);
}

/**
 * Type guard for status message validation
 */
export interface StatusMessage {
	status: string;
	message?: string;
}

export function isStatusMessage(msg: unknown): msg is StatusMessage {
	if (!isObject(msg)) return false;

	return hasProperty(msg, 'status') && isString(msg.status);
}

/**
 * Type guard for error message validation
 */
export function hasErrorProperty(data: unknown): data is { error: string } {
	return isObject(data) && hasProperty(data, 'error') && isString(data.error);
}

/**
 * Safe property access with type checking
 */
export function getProperty<T>(
	obj: unknown,
	key: string,
	validator: (value: unknown) => value is T
): T | undefined {
	if (!isObject(obj) || !(key in obj)) {
		return undefined;
	}

	const value = obj[key];
	return validator(value) ? value : undefined;
}

/**
 * Assert that a value is not null or undefined
 */
export function assertDefined<T>(
	value: T | null | undefined,
	message = 'Value is null or undefined'
): asserts value is T {
	if (value === null || value === undefined) {
		throw new Error(message);
	}
}
