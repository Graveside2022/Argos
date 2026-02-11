/**
 * API endpoint to detect available shells on the system
 * GET /api/terminal/shells
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { access, constants } from 'fs/promises';
import type { ShellInfo, ShellsResponse } from '$lib/types/terminal';

// Four independent tmux profiles (container paths for Docker, host paths as fallback)
const SHELL_PATHS = [
	'/app/scripts/tmux/tmux-0.sh', // Tmux 0 (default) (container path)
	'/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-0.sh', // Tmux 0 (default) (host path)
	'/app/scripts/tmux/tmux-1.sh', // Tmux 1 (container path)
	'/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-1.sh', // Tmux 1 (host path)
	'/app/scripts/tmux/tmux-2.sh', // Tmux 2 (container path)
	'/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-2.sh', // Tmux 2 (host path)
	'/app/scripts/tmux/tmux-3.sh', // Tmux 3 (container path)
	'/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-3.sh' // Tmux 3 (host path)
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

/**
 * Get the display name for a shell
 */
function getShellName(shellPath: string): string {
	// Friendly names for the four tmux profiles
	if (shellPath.includes('tmux-0.sh')) {
		return 'Tmux 0';
	}
	if (shellPath.includes('tmux-1.sh')) {
		return 'Tmux 1';
	}
	if (shellPath.includes('tmux-2.sh')) {
		return 'Tmux 2';
	}
	if (shellPath.includes('tmux-3.sh')) {
		return 'Tmux 3';
	}
	const basename = shellPath.split('/').pop() || shellPath;
	return basename;
}

export const GET: RequestHandler = async () => {
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

		return json(response);
	} catch (error) {
		console.error('[terminal/shells] Error detecting shells:', error);

		// Return at least zsh as fallback
		return json({
			shells: [{ path: '/bin/zsh', name: 'zsh', isDefault: true }],
			defaultShell: '/bin/zsh'
		} satisfies ShellsResponse);
	}
};
