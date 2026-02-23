/**
 * Shared async exec utility.
 *
 * Replaces 36 local `promisify(execFile)` declarations across the codebase.
 * Uses `execFile` (not `exec`) to avoid shell injection risks —
 * arguments are passed as an array, never interpolated into a shell string.
 *
 * @module
 */

import { execFile, type ExecFileOptions } from 'child_process';
import { promisify } from 'util';

const promisifiedExecFile = promisify(execFile);

/**
 * Execute a file asynchronously with optional configuration overrides.
 *
 * @param file - Absolute path to the executable
 * @param args - Command-line arguments
 * @param options - Optional overrides for maxBuffer, timeout, cwd, env
 * @returns Promise resolving to `{ stdout, stderr }` strings
 *
 * @example
 * ```ts
 * const { stdout } = await execFileAsync('/usr/bin/lsof', ['-i:5173', '-sTCP:LISTEN']);
 * ```
 *
 * @example
 * ```ts
 * const { stdout } = await execFileAsync('/usr/bin/hackrf_info', [], { timeout: 3000 });
 * ```
 */
export async function execFileAsync(
	file: string,
	args: readonly string[] = [],
	options?: ExecFileOptions
): Promise<{ stdout: string; stderr: string }> {
	return promisifiedExecFile(file, [...args], options ?? {});
}
