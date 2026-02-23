import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';

import type { RequestHandler } from './$types';

interface ServiceDef {
	name: string;
	port: number;
	process: string;
}

/** Service definitions for health monitoring */
const MONITORED_SERVICES: ServiceDef[] = [
	{ name: 'kismet', port: 2501, process: 'kismet' },
	{ name: 'argos-dev', port: 5173, process: 'vite' }
];

/** Lookup table: [processRunning][portListening] → health status */
const HEALTH_STATUS_MAP: Record<string, string> = {
	'true:true': 'healthy',
	'true:false': 'degraded',
	'false:true': 'zombie',
	'false:false': 'stopped'
};

/** Determine health status from process and port state */
function deriveHealthStatus(processRunning: boolean, portListening: boolean): string {
	return HEALTH_STATUS_MAP[`${processRunning}:${portListening}`] ?? 'stopped';
}

/** Check whether a process matching the given pattern is running, return its PID */
async function checkProcess(pattern: string): Promise<{ running: boolean; pid: number | null }> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', pattern]);
		if (stdout.trim()) {
			return { running: true, pid: parseInt(stdout.trim().split('\n')[0]) };
		}
	} catch {
		// pgrep exits non-zero when no match found
	}
	return { running: false, pid: null };
}

/** Check whether a TCP port has an active listener */
async function checkPort(port: number): Promise<boolean> {
	try {
		await execFileAsync('/usr/bin/lsof', [`-i:${port}`, '-sTCP:LISTEN']);
		return true;
	} catch {
		return false;
	}
}

/** Probe a single service and return its status record */
async function probeService(service: ServiceDef) {
	const [proc, portListening] = await Promise.all([
		checkProcess(service.process),
		checkPort(service.port)
	]);

	return {
		name: service.name,
		status: deriveHealthStatus(proc.running, portListening),
		process_running: proc.running,
		port_listening: portListening,
		port: service.port,
		pid: proc.pid
	};
}

export const GET: RequestHandler = async () => {
	try {
		const results = await Promise.all(MONITORED_SERVICES.map(probeService));

		const healthyCount = results.filter((r) => r.status === 'healthy').length;
		const overallHealth = healthyCount === MONITORED_SERVICES.length ? 'healthy' : 'degraded';

		return json({
			success: true,
			overall_health: overallHealth,
			services: results,
			healthy_count: healthyCount,
			total_count: MONITORED_SERVICES.length
		});
	} catch (error) {
		return json({
			success: false,
			error: errMsg(error)
		});
	}
};
