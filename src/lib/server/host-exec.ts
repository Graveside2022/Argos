/**
 * Host Execution Bridge
 *
 * Runs shell commands directly on the host system.
 * Previously handled Docker nsenter bridging — now Argos runs natively.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Execute a shell command on the host system.
 * Returns { stdout: string, stderr: string } (never Buffer).
 */
export async function hostExec(
	cmd: string,
	options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
	return execAsync(cmd, { ...options, encoding: 'utf8' as const });
}
