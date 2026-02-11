import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		const services = [
			{ name: 'kismet', port: 2501, process: 'kismet' },
			{ name: 'hackrf-backend', port: 8092, process: 'python.*app.py' },
			{ name: 'argos-dev', port: 5173, process: 'vite' }
		];

		const results = await Promise.all(
			services.map(async (service) => {
				let processRunning = false;
				let portListening = false;
				let pid = null;

				// Check if process is running
				try {
					const { stdout } = await execAsync(`pgrep -f "${service.process}"`);
					if (stdout.trim()) {
						processRunning = true;
						pid = parseInt(stdout.trim().split('\n')[0]);
					}
				} catch {
					processRunning = false;
				}

				// Check if port is listening
				try {
					await execAsync(`lsof -i:${service.port} -sTCP:LISTEN`);
					portListening = true;
				} catch {
					portListening = false;
				}

				// Determine health status
				let status = 'stopped';
				if (processRunning && portListening) {
					status = 'healthy';
				} else if (processRunning && !portListening) {
					status = 'degraded';
				} else if (!processRunning && portListening) {
					status = 'zombie'; // Port held but process dead
				}

				return {
					name: service.name,
					status,
					process_running: processRunning,
					port_listening: portListening,
					port: service.port,
					pid
				};
			})
		);

		const healthyCount = results.filter((r) => r.status === 'healthy').length;
		const overallHealth = healthyCount === services.length ? 'healthy' : 'degraded';

		return json({
			success: true,
			overall_health: overallHealth,
			services: results,
			healthy_count: healthyCount,
			total_count: services.length
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return json({
			success: false,
			error: msg
		});
	}
};
