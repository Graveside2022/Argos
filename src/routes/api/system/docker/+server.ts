import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		// Check if Docker is running
		const { stdout: psOutput } = await execAsync(
			'docker ps -a --format "{{.Names}}|{{.State}}|{{.Status}}|{{.Image}}" 2>&1'
		);

		const containers = psOutput
			.trim()
			.split('\n')
			.filter((line) => line.length > 0)
			.map((line) => {
				const [name, state, status, image] = line.split('|');
				return { name, state, status, image };
			});

		// Check Docker Compose status for Argos services
		const argosContainers = containers.filter(
			(c) =>
				c.name.includes('argos') ||
				c.name.includes('hackrf') ||
				c.name.includes('openwebrx') ||
				c.name.includes('bettercap')
		);

		// Get Docker system info
		const { stdout: infoOutput } = await execAsync('docker info --format "{{json .}}" 2>&1');
		const dockerInfo = JSON.parse(infoOutput);

		return json({
			success: true,
			docker_running: true,
			total_containers: containers.length,
			argos_containers: argosContainers.length,
			containers: argosContainers,
			system: {
				driver: dockerInfo.Driver || 'unknown',
				memory_limit: dockerInfo.MemoryLimit || false,
				swap_limit: dockerInfo.SwapLimit || false
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);

		// Docker not running
		if (msg.includes('Cannot connect') || msg.includes('Is the docker daemon running')) {
			return json({
				success: false,
				error: 'Docker daemon not running',
				docker_running: false
			});
		}

		return json({
			success: false,
			error: msg,
			docker_running: false
		});
	}
};
