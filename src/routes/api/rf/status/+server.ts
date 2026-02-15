import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';

import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

interface DeviceInfo {
	connected: boolean;
	serial?: string;
	info?: string;
	usbInfo?: string;
	error?: string;
}

async function detectConnectedDevices(): Promise<{
	hackrf: boolean;
	deviceInfo: Record<string, DeviceInfo>;
}> {
	const deviceInfo: Record<string, DeviceInfo> = {};
	let hackrfConnected = false;

	// Check for HackRF
	try {
		const { stdout } = await execAsync('timeout 2 hackrf_info');
		if (stdout.includes('Serial number')) {
			hackrfConnected = true;
			const serialMatch = stdout.match(/Serial number:\s*(\S+)/);
			deviceInfo.hackrf = {
				connected: true,
				serial: serialMatch ? serialMatch[1] : 'unknown',
				info: stdout.trim()
			};
		}
	} catch (_error) {
		deviceInfo.hackrf = { connected: false, error: 'Not detected' };
	}

	return { hackrf: hackrfConnected, deviceInfo };
}

export const GET: RequestHandler = async () => {
	try {
		// Detect connected devices (HackRF only)
		const { hackrf, deviceInfo } = await detectConnectedDevices();

		const hackrfStatus = sweepManager.getStatus();
		const status: Record<string, unknown> = {
			connectedDevices: {
				hackrf
			},
			deviceInfo,
			activeDevice: hackrf ? 'hackrf' : 'none',
			device: hackrf ? 'hackrf' : 'none',
			...hackrfStatus,
			bufferStats: null,
			bufferHealth: null
		};

		return json({
			status: 'success',
			data: status
		});
	} catch (error: unknown) {
		console.error('Error in rf/status endpoint:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// Add CORS headers
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
