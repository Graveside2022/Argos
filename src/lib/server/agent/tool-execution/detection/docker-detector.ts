/**
 * Docker Tool Detector
 *
 * Scans for installed Docker containers and extracts execution information
 */

import { spawn } from 'child_process';

export interface DockerContainer {
	name: string;
	id: string;
	image: string;
	status: 'running' | 'stopped' | 'paused' | 'exited';
	created: string;
}

/**
 * Detect all Docker containers on the system
 */
export async function detectDockerContainers(): Promise<DockerContainer[]> {
	try {
		// Check if Docker is available
		const dockerAvailable = await checkDockerAvailable();
		if (!dockerAvailable) {
			console.log('[DockerDetector] Docker not available on system');
			return [];
		}

		// Get all containers (including stopped ones)
		const output = await execCommand('docker', [
			'ps',
			'-a',
			'--format',
			'{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}|{{.CreatedAt}}'
		]);

		const containers: DockerContainer[] = [];
		const lines = output.trim().split('\n').filter(Boolean);

		for (const line of lines) {
			const [name, id, image, statusRaw, created] = line.split('|');

			// Parse status
			let status: DockerContainer['status'] = 'stopped';
			if (statusRaw.toLowerCase().includes('up')) {
				status = 'running';
			} else if (statusRaw.toLowerCase().includes('paused')) {
				status = 'paused';
			} else if (statusRaw.toLowerCase().includes('exited')) {
				status = 'exited';
			}

			containers.push({
				name: name.trim(),
				id: id.trim(),
				image: image.trim(),
				status,
				created: created.trim()
			});
		}

		console.log(`[DockerDetector] Found ${containers.length} Docker containers`);
		return containers;
	} catch (error) {
		console.error('[DockerDetector] Error detecting containers:', error);
		return [];
	}
}

/**
 * Check if a specific Docker container exists
 */
export async function checkDockerContainer(containerName: string): Promise<boolean> {
	try {
		const containers = await detectDockerContainers();
		return containers.some((c) => c.name === containerName || c.name.includes(containerName));
	} catch {
		return false;
	}
}

/**
 * Get Docker container by name pattern
 */
export async function findDockerContainer(pattern: string): Promise<DockerContainer | null> {
	try {
		const containers = await detectDockerContainers();

		// Try exact match first
		let found = containers.find((c) => c.name === pattern);
		if (found) return found;

		// Try pattern match (case-insensitive)
		const lowerPattern = pattern.toLowerCase();
		found = containers.find(
			(c) =>
				c.name.toLowerCase().includes(lowerPattern) ||
				c.image.toLowerCase().includes(lowerPattern)
		);

		return found || null;
	} catch {
		return null;
	}
}

/**
 * Check if Docker is available on the system
 */
async function checkDockerAvailable(): Promise<boolean> {
	try {
		await execCommand('docker', ['--version']);
		return true;
	} catch {
		return false;
	}
}

/**
 * Execute a command and return stdout
 */
function execCommand(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args);
		let stdout = '';
		let stderr = '';

		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		child.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		child.on('error', (error) => {
			reject(new Error(`Failed to execute ${command}: ${error.message}`));
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(`${command} exited with code ${code}: ${stderr}`));
			}
		});
	});
}
