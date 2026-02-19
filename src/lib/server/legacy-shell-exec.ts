/**
 * LEGACY Shell Execution — TEMPORARY shim for 009-gsm-evil-exec-migration
 *
 * This wrapper exists ONLY for GSM Evil and Kismet Extended files that
 * depend on shell features (pipes, redirects, backgrounding, inline scripts).
 * These files will be migrated to execFile/spawn in branch 009.
 *
 * DO NOT use this in new code. Use execFile or spawn with argument arrays.
 * @see src/lib/server/security/input-sanitizer.ts for input validation
 * @deprecated Will be deleted in branch 009-gsm-evil-exec-migration
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Execute a shell command on the host system.
 * @deprecated Use execFileAsync or spawn with argument arrays instead.
 */
export async function legacyShellExec(
	cmd: string,
	options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
	return execAsync(cmd, { ...options, encoding: 'utf8' as const });
}
