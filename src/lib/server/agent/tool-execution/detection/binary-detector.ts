/**
 * Binary Tool Detector
 *
 * Checks for native binaries installed on the system
 */

import { spawn } from 'child_process';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';

export interface BinaryInfo {
	name: string;
	path: string;
	executable: boolean;
	version?: string;
}

/**
 * Check if a binary is installed and accessible via PATH
 */
export async function checkBinary(binaryName: string): Promise<BinaryInfo | null> {
	try {
		// Try 'which' command first
		const path = await execCommand('which', [binaryName]);
		if (path) {
			const trimmedPath = path.trim();
			const isExecutable = await checkExecutable(trimmedPath);

			return {
				name: binaryName,
				path: trimmedPath,
				executable: isExecutable
			};
		}
	} catch {
		// 'which' failed, try common paths
	}

	// Try common binary paths
	const commonPaths = [
		`/usr/bin/${binaryName}`,
		`/usr/local/bin/${binaryName}`,
		`/opt/${binaryName}/bin/${binaryName}`,
		`/home/kali/.local/bin/${binaryName}`,
		`/bin/${binaryName}`
	];

	for (const path of commonPaths) {
		try {
			const exists = await fileExists(path);
			if (exists) {
				const isExecutable = await checkExecutable(path);
				return {
					name: binaryName,
					path,
					executable: isExecutable
				};
			}
		} catch {
			continue;
		}
	}

	return null;
}

/**
 * Check multiple binaries at once
 */
export async function checkBinaries(binaryNames: string[]): Promise<Map<string, BinaryInfo>> {
	const results = new Map<string, BinaryInfo>();

	const promises = binaryNames.map(async (name) => {
		const info = await checkBinary(name);
		if (info) {
			results.set(name, info);
		}
	});

	await Promise.all(promises);

	console.log(`[BinaryDetector] Found ${results.size}/${binaryNames.length} binaries`);
	return results;
}

/**
 * Get binary version if available
 */
export async function getBinaryVersion(binaryPath: string): Promise<string | null> {
	// Try common version flags
	const versionFlags = ['--version', '-v', '-V', 'version'];

	for (const flag of versionFlags) {
		try {
			const output = await execCommand(binaryPath, [flag], 2000);
			if (output) {
				// Extract version number from output (first line usually)
				const firstLine = output.split('\n')[0];
				return firstLine.trim();
			}
		} catch {
			continue;
		}
	}

	return null;
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a file is executable
 */
async function checkExecutable(path: string): Promise<boolean> {
	try {
		await access(path, constants.X_OK);
		const stats = await stat(path);
		return stats.isFile();
	} catch {
		return false;
	}
}

/**
 * Execute a command and return stdout
 */
function execCommand(command: string, args: string[], timeout: number = 5000): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args);
		let stdout = '';

		const timeoutId = setTimeout(() => {
			child.kill();
			reject(new Error('Command timeout'));
		}, timeout);

		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		child.on('error', (error) => {
			clearTimeout(timeoutId);
			reject(error);
		});

		child.on('close', (code) => {
			clearTimeout(timeoutId);
			if (code === 0 || code === null) {
				resolve(stdout);
			} else {
				reject(new Error(`Command exited with code ${code}`));
			}
		});
	});
}
