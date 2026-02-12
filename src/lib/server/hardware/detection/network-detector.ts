/**
 * Network Device Detector
 * Detects networked SDRs and other network-connected hardware
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import type { DetectedHardware, SDRCapabilities } from '$lib/server/hardware/detection-types';

const execAsync = promisify(exec);

/**
 * Detect networked USRP devices
 */
async function detectNetworkUSRP(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		const { stdout } = await execAsync('uhd_find_devices --args="type=usrp" 2>&1', {
			timeout: 5000
		});

		// Parse network USRP devices
		const lines = stdout.split('\n');
		let currentDevice: Partial<DetectedHardware> | null = null;

		for (const line of lines) {
			if (line.includes('Device Address')) {
				if (currentDevice && currentDevice.ipAddress) {
					hardware.push(currentDevice as DetectedHardware);
				}
				currentDevice = {
					category: 'sdr',
					connectionType: 'network',
					status: 'connected',
					lastSeen: Date.now(),
					firstSeen: Date.now()
				};
			} else if (currentDevice) {
				const addrMatch = line.match(/addr:\s*([0-9.]+)/i);
				const serialMatch = line.match(/serial:\s*([A-F0-9]+)/i);
				const typeMatch = line.match(/type:\s*([^\n,]+)/i);
				const nameMatch = line.match(/name:\s*([^\n,]+)/i);

				if (addrMatch) currentDevice.ipAddress = addrMatch[1];
				if (serialMatch) currentDevice.serial = serialMatch[1];
				if (typeMatch) currentDevice.model = typeMatch[1];
				if (nameMatch) currentDevice.name = nameMatch[1];
			}
		}

		// Add last device
		if (currentDevice && currentDevice.ipAddress) {
			currentDevice.id = `usrp-net-${currentDevice.ipAddress.replace(/\./g, '-')}`;
			currentDevice.name = currentDevice.name || 'Network USRP';
			currentDevice.manufacturer = 'Ettus Research';
			currentDevice.capabilities = {
				minFrequency: 70_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 61_440_000,
				txCapable: true,
				rxCapable: true,
				fullDuplex: true
			} as SDRCapabilities;
			currentDevice.compatibleTools = ['spectrum.analysis.usrp', 'cellular.analysis.usrp'];

			hardware.push(currentDevice as DetectedHardware);
		}
	} catch (_error) {
		// No network USRPs found
	}

	return hardware;
}

/**
 * Check if Kismet server is available
 */
async function detectKismetServer(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		// Check if Kismet is running on localhost:2501
		const kismetUrl = process.env.PUBLIC_KISMET_API_URL || 'http://localhost:2501';
		const url = new URL('/system/status.json', kismetUrl);

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(2000)
		});

		if (response.ok) {
			const data = await response.json();

			hardware.push({
				id: 'kismet-server',
				name: 'Kismet Server',
				category: 'network',
				connectionType: 'network',
				status: 'connected',
				capabilities: {
					service: 'kismet',
					version: data.kismet_version || 'unknown'
				},
				ipAddress: new URL(kismetUrl).hostname,
				port: parseInt(new URL(kismetUrl).port) || 2501,
				lastSeen: Date.now(),
				firstSeen: Date.now(),
				compatibleTools: ['wifi.scan.kismet', 'wifi.monitor.kismet']
			});
		}
	} catch (_error) {
		// Kismet not available
	}

	return hardware;
}

/**
 * Check if HackRF API server is available
 */
async function detectHackRFServer(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		const hackrfUrl = process.env.PUBLIC_HACKRF_API_URL || 'http://localhost:8092';
		const url = new URL('/status', hackrfUrl);

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(2000)
		});

		if (response.ok) {
			const data = await response.json();

			hardware.push({
				id: 'hackrf-server',
				name: 'HackRF API Server',
				category: 'network',
				connectionType: 'network',
				status: 'connected',
				capabilities: {
					service: 'hackrf-api',
					version: data.version || 'unknown'
				},
				ipAddress: new URL(hackrfUrl).hostname,
				port: parseInt(new URL(hackrfUrl).port) || 8092,
				lastSeen: Date.now(),
				firstSeen: Date.now(),
				compatibleTools: ['spectrum.analysis.hackrf']
			});
		}
	} catch (_error) {
		// HackRF API not available
	}

	return hardware;
}

/**
 * Detect OpenWebRX instances
 */
async function detectOpenWebRX(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		// Check common OpenWebRX port
		const response = await fetch('http://localhost:8073', {
			signal: AbortSignal.timeout(2000)
		});

		if (response.ok) {
			hardware.push({
				id: 'openwebrx-server',
				name: 'OpenWebRX Server',
				category: 'network',
				connectionType: 'network',
				status: 'connected',
				capabilities: {
					service: 'openwebrx',
					webInterface: true
				},
				ipAddress: 'localhost',
				port: 8073,
				lastSeen: Date.now(),
				firstSeen: Date.now(),
				compatibleTools: ['spectrum.view.openwebrx']
			});
		}
	} catch (_error) {
		// OpenWebRX not running
	}

	return hardware;
}

/**
 * Main network device detection function
 */
export async function detectNetworkDevices(): Promise<DetectedHardware[]> {
	console.log('[NetworkDetector] Scanning for network hardware...');

	const results = await Promise.allSettled([
		detectNetworkUSRP(),
		detectKismetServer(),
		detectHackRFServer(),
		detectOpenWebRX()
	]);

	const allHardware: DetectedHardware[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allHardware.push(...result.value);
		}
	}

	console.log(`[NetworkDetector] Found ${allHardware.length} network devices`);

	return allHardware;
}
