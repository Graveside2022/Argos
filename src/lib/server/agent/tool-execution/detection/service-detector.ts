/**
 * SystemD Service Detector
 *
 * Checks for installed and running SystemD services
 */

import { spawn } from 'child_process';

export interface ServiceInfo {
	name: string;
	loaded: boolean;
	active: boolean;
	running: boolean;
	description?: string;
}

/**
 * Check if a SystemD service is installed
 */
export async function checkService(serviceName: string): Promise<ServiceInfo | null> {
	try {
		// Ensure service name has .service extension
		const fullName = serviceName.endsWith('.service') ? serviceName : `${serviceName}.service`;

		// Use systemctl show to get service info
		const output = await execCommand('systemctl', ['show', fullName]);

		if (!output) return null;

		// Parse systemctl show output
		const lines = output.split('\n');
		const props: Record<string, string> = {};

		for (const line of lines) {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				props[key] = valueParts.join('=');
			}
		}

		// Check if service is loaded
		const loadState = props['LoadState'];
		if (loadState !== 'loaded') {
			return null; // Service not found
		}

		return {
			name: serviceName,
			loaded: loadState === 'loaded',
			active: props['ActiveState'] === 'active',
			running: props['SubState'] === 'running',
			description: props['Description']
		};
	} catch (_error) {
		// Service not found or systemctl not available
		return null;
	}
}

/**
 * Check multiple services at once
 */
export async function checkServices(serviceNames: string[]): Promise<Map<string, ServiceInfo>> {
	const results = new Map<string, ServiceInfo>();

	// Check if systemd is available
	const systemdAvailable = await checkSystemdAvailable();
	if (!systemdAvailable) {
		console.log('[ServiceDetector] SystemD not available on system');
		return results;
	}

	const promises = serviceNames.map(async (name) => {
		const info = await checkService(name);
		if (info) {
			results.set(name, info);
		}
	});

	await Promise.all(promises);

	console.log(`[ServiceDetector] Found ${results.size}/${serviceNames.length} services`);
	return results;
}

/**
 * List all services matching a pattern
 */
export async function findServices(pattern: string): Promise<ServiceInfo[]> {
	try {
		const output = await execCommand('systemctl', [
			'list-units',
			'--type=service',
			'--all',
			'--no-pager',
			'--plain'
		]);

		if (!output) return [];

		const services: ServiceInfo[] = [];
		const lines = output.split('\n').filter(Boolean);

		for (const line of lines) {
			// Parse systemctl list-units output
			// Format: UNIT LOAD ACTIVE SUB DESCRIPTION
			const match = line.match(/^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
			if (!match) continue;

			const [, name, load, active, sub, description] = match;

			// Filter by pattern
			if (!name.toLowerCase().includes(pattern.toLowerCase())) {
				continue;
			}

			services.push({
				name: name.replace('.service', ''),
				loaded: load === 'loaded',
				active: active === 'active',
				running: sub === 'running',
				description: description.trim()
			});
		}

		return services;
	} catch {
		return [];
	}
}

/**
 * Check if SystemD is available
 */
async function checkSystemdAvailable(): Promise<boolean> {
	try {
		await execCommand('systemctl', ['--version']);
		return true;
	} catch {
		return false;
	}
}

/**
 * Execute a command and return stdout
 */
function execCommand(command: string, args: string[], timeout: number = 5000): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args);
		let stdout = '';

		const timeoutId = setTimeout(() => {
			child.kill();
			reject(new Error('Command timeout'));
		}, timeout);

		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		child.on('error', (error) => {
			clearTimeout(timeoutId);
			reject(error);
		});

		child.on('close', (code) => {
			clearTimeout(timeoutId);
			if (code === 0 || code === null) {
				resolve(stdout);
			} else {
				reject(new Error(`Command exited with code ${code}`));
			}
		});
	});
}
