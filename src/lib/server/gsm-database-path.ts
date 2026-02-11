/**
 * GSM Evil Database Path Resolution
 *
 * Resolves the database path used by GsmEvil2 for IMSI capture storage.
 */

/**
 * Resolve the GSM Evil database path.
 * Returns the default path used by GsmEvil2 for storing captured IMSI data.
 */
export async function resolveGsmDatabasePath(): Promise<string> {
	// Default GsmEvil2 database location
	// This is where the gsmevil.py script stores captured data
	return '/tmp/gsm_db.sqlite';
}
