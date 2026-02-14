/**
 * Host Execution Bridge for Docker Containers
 *
 * When Argos runs inside a Docker container, RF tools (grgsm, tcpdump,
 * hackrf_info, etc.) live on the host filesystem. The container is started
 * with pid:host + privileged, so nsenter -t 1 -m gives access to the host
 * mount namespace where all the tools are installed.
 *
 * Outside Docker, commands run directly as before.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** Cached Docker detection result */
let _isDocker: boolean | null = null;

/**
 * Detect if running inside a Docker container with nsenter access to the host.
 * Result is cached after first call.
 */
export async function isDockerContainer(): Promise<boolean> {
	if (_isDocker !== null) return _isDocker;
	try {
		await execAsync('cat /.dockerenv 2>/dev/null');
		await execAsync('nsenter -t 1 -m -- true 2>/dev/null');
		_isDocker = true;
	} catch (_error: unknown) {
		_isDocker = false;
	}
	return _isDocker;
}

/**
 * Execute a shell command on the host system.
 * In Docker: wraps the command with nsenter to access host mount namespace.
 * Outside Docker: runs directly.
 * Always returns { stdout: string, stderr: string } (never Buffer).
 */
export async function hostExec(
	cmd: string,
	options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
	// Safe: Encoding literal narrowed to const for child_process exec options type
	const execOpts = { ...options, encoding: 'utf8' as const };
	const inDocker = await isDockerContainer();
	if (inDocker) {
		const escaped = cmd.replace(/'/g, "'\\''");
		return execAsync(`nsenter -t 1 -m -- bash -c '${escaped}'`, execOpts);
	}
	return execAsync(cmd, execOpts);
}
