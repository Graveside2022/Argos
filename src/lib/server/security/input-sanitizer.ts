import path from 'path';

/**
 * Input sanitization library for Argos SDR & Network Analysis Console.
 *
 * Design principles:
 * 1. Fail-closed: Invalid input throws, never returns a default
 * 2. Type-safe: Return types match validated constraints
 * 3. Minimal: Each function validates exactly one concern
 * 4. No shell awareness: These functions validate data, not commands
 *
 * Usage: Import individual validators at each injection point.
 * Do NOT import this module in client-side code.
 */

export class InputValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InputValidationError';
	}
}

/**
 * Validates that a value is a finite number within a specified range.
 * Use for: frequency, gain, duration, PID, latitude, longitude, radius
 */
export function validateNumericParam(
	value: unknown,
	name: string,
	min: number,
	max: number
): number {
	const num = Number(value);
	if (!Number.isFinite(num) || num < min || num > max) {
		throw new InputValidationError(
			`${name} must be a finite number between ${min} and ${max}, got: ${String(value)}`
		);
	}
	return num;
}

/**
 * Validates that a value is a member of an explicit allowlist.
 * Use for: action types, mode selections, enum-like parameters
 */
export function validateAllowlist<T extends string>(
	value: unknown,
	name: string,
	allowlist: readonly T[]
): T {
	if (typeof value !== 'string' || !allowlist.includes(value as T)) {
		throw new InputValidationError(
			`${name} must be one of: ${allowlist.join(', ')}, got: ${String(value)}`
		);
	}
	return value as T;
}

/**
 * Validates IEEE 802 MAC address format (colon-separated hex).
 * Use for: WiFi BSSID, Bluetooth MAC, network device addresses
 */
export function validateMacAddress(value: unknown): string {
	if (typeof value !== 'string' || !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value)) {
		throw new InputValidationError(`Invalid MAC address format: ${String(value)}`);
	}
	return value;
}

/**
 * Validates Linux network interface name format.
 * Use for: wlan0, eth0, mon0, wlx0013ef..., etc. Max 15 chars per IFNAMSIZ.
 */
export function validateInterfaceName(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,15}$/.test(value)) {
		throw new InputValidationError(`Invalid interface name: ${String(value)}`);
	}
	return value;
}

/**
 * Validates that a path resolves within an allowed directory.
 * Prevents path traversal attacks (../../etc/passwd).
 * Use for: file paths from user input or external command output
 *
 * IMPORTANT: Uses path.resolve() to canonicalize, then verifies prefix.
 * This is resistant to ../ traversal unlike startsWith() on raw input.
 */
export function validatePathWithinDir(value: unknown, allowedDir: string): string {
	if (typeof value !== 'string') {
		throw new InputValidationError('Path must be a string');
	}
	if (value.includes('\0')) {
		throw new InputValidationError('Null byte in path');
	}
	const resolved = path.resolve(allowedDir, value);
	if (!resolved.startsWith(path.resolve(allowedDir))) {
		throw new InputValidationError('Path traversal detected');
	}
	return resolved;
}

/**
 * Validates a SQL identifier (table name, index name, column name).
 * Only allows alphanumeric characters and underscores, starting with a letter or underscore.
 * Use for: table names in VACUUM, ANALYZE, REINDEX, and dynamic SQL.
 */
export function validateSqlIdentifier(value: unknown, name: string): string {
	if (typeof value !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
		throw new InputValidationError(
			`${name} must be a valid SQL identifier (alphanumeric and underscore only), got: ${String(value)}`
		);
	}
	return value;
}
