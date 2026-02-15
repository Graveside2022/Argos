import { exec } from 'child_process';
import { stat } from 'fs/promises';
import { promisify } from 'util';

import { FileNotFoundError, GitNotAvailableError, type ViolationCategory } from './types.js';

const execAsync = promisify(exec);

/**
 * Constitution ratification Unix timestamp (2026-02-13T02:53:01+01:00)
 * Violations before this date are pre-existing, violations after are new
 */
const CONSTITUTION_UNIX = 1770947581;

/**
 * Categorize violation by timestamp using git blame
 * Uses --porcelain format for reliable parsing (per R4 research)
 *
 * @param file - Relative file path from project root
 * @param line - Line number (1-indexed)
 * @returns Promise<ViolationCategory> - Categorization with commit metadata
 * @throws GitNotAvailableError if git not installed or not a git repository
 * @throws FileNotFoundError if file does not exist
 */
export async function categorizeViolationByTimestamp(
	file: string,
	line: number
): Promise<ViolationCategory> {
	// Verify file exists
	try {
		await stat(file);
	} catch {
		throw new FileNotFoundError(file);
	}

	// Check if git is available
	try {
		await execAsync('git rev-parse --git-dir');
	} catch {
		// Fallback to file mtime with WARNING
		return await fallbackToMtime(file);
	}

	try {
		// Use git blame --porcelain for reliable parsing
		const { stdout } = await execAsync(`git blame --porcelain -L${line},${line} "${file}"`);

		// Parse porcelain format
		const commitHash = stdout.match(/^([0-9a-f]{40})/)?.[1];
		const authorTime = stdout.match(/^author-time (\d+)$/m)?.[1];
		const authorName = stdout.match(/^author (.+)$/m)?.[1];

		if (!commitHash || !authorTime || !authorName) {
			throw new Error('Failed to parse git blame output');
		}

		const authorTimeUnix = parseInt(authorTime, 10);
		const commitDate = new Date(authorTimeUnix * 1000).toISOString();

		return {
			isPreExisting: authorTimeUnix < CONSTITUTION_UNIX,
			commitDate,
			commitHash,
			commitAuthor: authorName
		};
	} catch (_error) {
		// If git blame fails, fall back to mtime
		return await fallbackToMtime(file);
	}
}

/**
 * Fallback to file modification time if git is unavailable
 * Returns WARNING in author field to indicate reduced accuracy
 */
async function fallbackToMtime(file: string): Promise<ViolationCategory> {
	const stats = await stat(file);
	const mtimeUnix = Math.floor(stats.mtimeMs / 1000);
	const commitDate = stats.mtime.toISOString();

	return {
		isPreExisting: mtimeUnix < CONSTITUTION_UNIX,
		commitDate,
		commitHash: '0000000000000000000000000000000000000000',
		commitAuthor: 'UNKNOWN (git unavailable - using file mtime)'
	};
}

/**
 * Batch categorize violations for performance
 * Uses git log --since for bulk analysis (per R4 research alternative)
 *
 * @param violations - Array of {file, line} pairs to categorize
 * @returns Promise<Map<string, ViolationCategory>> - Map of "file:line" -> category
 */
export async function batchCategorizeViolations(
	violations: Array<{ file: string; line: number }>
): Promise<Map<string, ViolationCategory>> {
	const results = new Map<string, ViolationCategory>();

	// Check if git is available
	try {
		await execAsync('git rev-parse --git-dir');
	} catch {
		throw new GitNotAvailableError();
	}

	// Process violations in parallel (max 10 concurrent)
	const batchSize = 10;
	for (let i = 0; i < violations.length; i += batchSize) {
		const batch = violations.slice(i, i + batchSize);
		const promises = batch.map(async ({ file, line }) => {
			try {
				const category = await categorizeViolationByTimestamp(file, line);
				results.set(`${file}:${line}`, category);
			} catch (error) {
				// Skip violations that can't be categorized
				console.warn(`Failed to categorize ${file}:${line}:`, error);
			}
		});
		await Promise.all(promises);
	}

	return results;
}
