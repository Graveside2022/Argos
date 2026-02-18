/**
 * GSM Evil Path Resolution
 *
 * All GSM Evil directory paths are resolved from the GSMEVIL_DIR environment variable.
 * No hardcoded paths — works on any system regardless of username or clone location.
 */

import { homedir } from 'os';
import path from 'path';

/**
 * Resolve the GsmEvil2 installation directory.
 * Uses GSMEVIL_DIR env var, falls back to ~/gsmevil2.
 */
export function getGsmEvilDir(): string {
	return process.env.GSMEVIL_DIR || path.join(homedir(), 'gsmevil2');
}

/**
 * Resolve the GSM Evil IMSI database path.
 * Checks the GsmEvil2 directory first, then the legacy /tmp location.
 */
export async function resolveGsmDatabasePath(): Promise<string> {
	const gsmDir = getGsmEvilDir();
	return path.join(gsmDir, 'database', 'imsi.db');
}

/**
 * Get the allowed IMSI database paths for input validation.
 * Used by API routes to prevent path traversal.
 */
export function getAllowedImsiDbPaths(): string[] {
	const gsmDir = getGsmEvilDir();
	return [path.join(gsmDir, 'database', 'imsi.db'), '/tmp/gsm_db.sqlite'];
}
