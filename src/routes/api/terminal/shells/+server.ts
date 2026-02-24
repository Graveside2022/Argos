/**
 * API endpoint to detect available shells on the system
 * GET /api/terminal/shells
 */

import { access, constants } from 'fs/promises';
import path from 'path';

import { createHandler } from '$lib/server/api/create-handler';
import type { ShellInfo, ShellsResponse } from '$lib/types/terminal';
import { logger } from '$lib/utils/logger';

// Four independent tmux profiles — resolved relative to project root
const PROJECT_ROOT = process.cwd();
const SHELL_PATHS = [
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-0.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-1.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-2.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-3.sh')
];

/**
 * Check if a shell exists and is executable
 */
async function isShellAvailable(shellPath: string): Promise<boolean> {
	try {
		// Just check if the file exists and is executable
		// Skip the exec verification as it can fail in some server environments
		await access(shellPath, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

/** Friendly names for known tmux profiles. */
const SHELL_NAMES: Record<string, string> = {
	'tmux-0.sh': 'Tmux 0',
	'tmux-1.sh': 'Tmux 1',
	'tmux-2.sh': 'Tmux 2',
	'tmux-3.sh': 'Tmux 3'
};

/** Get the display name for a shell. */
function getShellName(shellPath: string): string {
	const basename = shellPath.split('/').pop() || shellPath;
	return SHELL_NAMES[basename] || basename;
}

export const GET = createHandler(async () => {
	try {
		// Get system default shell (prefer ZSH if SHELL not set)
		const defaultShell = process.env.SHELL || '/bin/zsh';

		// Check all known shell paths in parallel
		const shellChecks = await Promise.all(
			SHELL_PATHS.map(async (path): Promise<ShellInfo | null> => {
				const available = await isShellAvailable(path);
				if (!available) return null;

				return {
					path,
					name: getShellName(path),
					isDefault: path === defaultShell
				};
			})
		);

		// Filter out unavailable shells and deduplicate by name
		const availableShells = shellChecks.filter((s): s is ShellInfo => s !== null);

		// Deduplicate (e.g., /bin/bash and /usr/bin/bash are the same)
		const seen = new Set<string>();
		const uniqueShells = availableShells.filter((shell) => {
			if (seen.has(shell.name)) return false;
			seen.add(shell.name);
			return true;
		});

		// Sort with default shell first
		uniqueShells.sort((a, b) => {
			if (a.isDefault) return -1;
			if (b.isDefault) return 1;
			return a.name.localeCompare(b.name);
		});

		const response: ShellsResponse = {
			shells: uniqueShells,
			defaultShell
		};

		return response;
	} catch (error) {
		logger.error('Error detecting shells', {
			endpoint: 'terminal/shells',
			error: error instanceof Error ? error.message : String(error)
		});

		// Return at least zsh as fallback
		return {
			shells: [{ path: '/bin/zsh', name: 'zsh', isDefault: true }],
			defaultShell: '/bin/zsh'
		} satisfies ShellsResponse;
	}
});
