import { exec } from 'child_process';
import { promisify } from 'util';
import { access, constants } from 'fs';
import { promisify as promisifyFs } from 'util';

const execAsync = promisify(exec);
const accessAsync = promisifyFs(access);

/**
 * Resolves the correct GSM Evil database path by checking multiple possible locations
 * This handles the database path inconsistency issue between different GSM Evil instances
 */
export async function resolveGsmDatabasePath(): Promise<string | null> {
	// Possible database locations in priority order
	const possiblePaths = [
		'/usr/src/gsmevil2/database/imsi.db', // Primary GSM Evil installation
		'/home/ubuntu/gsmevil-user/database/imsi.db', // User-specific installation
		'/usr/src/gsmevil/database/imsi.db', // Alternative installation
		'/opt/gsmevil2/database/imsi.db', // System-wide installation
		'/tmp/gsmevil2/database/imsi.db' // Temporary installation
	];

	// First, try to detect which path is actually being used by running processes
	try {
		// Check if GSM Evil process is running and what directory it's using
		const { stdout } = await execAsync(
			'ps aux | grep -E "python.*GsmEvil" | grep -v grep | head -1'
		);
		if (stdout.trim()) {
			// Extract working directory from process
			const parts = stdout.trim().split(/\s+/);
			const pid = parts[1];

			if (pid) {
				try {
					const { stdout: cwdOutput } = await execAsync(
						`readlink -f /proc/${pid}/cwd 2>/dev/null || echo ""`
					);
					const processWorkingDir = cwdOutput.trim();

					if (processWorkingDir && processWorkingDir !== '/') {
						// Try database path relative to process working directory
						const processDatabasePath = `${processWorkingDir}/database/imsi.db`;
						try {
							await accessAsync(processDatabasePath, constants.F_OK);
							console.log(
								`Found GSM database at process location: ${processDatabasePath}`
							);
							return processDatabasePath;
						} catch {
							// Process directory doesn't contain database, continue to other methods
						}
					}
				} catch {
					// Failed to get process working directory, continue
				}
			}
		}
	} catch {
		// No GSM Evil process running or error getting process info
	}

	// Check each possible path for existence
	for (const path of possiblePaths) {
		try {
			await accessAsync(path, constants.F_OK | constants.R_OK);
			console.log(`Found accessible GSM database at: ${path}`);
			return path;
		} catch {
			// Path doesn't exist or not accessible, try next
		}
	}

	// Check for database in any GSM Evil installation directory
	try {
		const { stdout } = await execAsync(
			'find /usr /opt /home -name "imsi.db" 2>/dev/null | head -5'
		);
		const foundDatabases = stdout
			.trim()
			.split('\n')
			.filter((path) => path.length > 0);

		if (foundDatabases.length > 0) {
			// Prefer databases in gsmevil directories
			const gsmEvilDbs = foundDatabases.filter((path) => path.includes('gsmevil'));
			if (gsmEvilDbs.length > 0) {
				console.log(`Found GSM database via search: ${gsmEvilDbs[0]}`);
				return gsmEvilDbs[0];
			}

			// Fall back to any found database
			console.log(`Found generic IMSI database: ${foundDatabases[0]}`);
			return foundDatabases[0];
		}
	} catch {
		// Find command failed or no databases found
	}

	console.warn('No accessible GSM Evil database found in any standard location');
	return null;
}
