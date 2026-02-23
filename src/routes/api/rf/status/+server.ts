import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

interface DeviceInfo {
	connected: boolean;
	serial?: string;
	info?: string;
	usbInfo?: string;
	error?: string;
}

/** Parse hackrf_info output into a DeviceInfo record. */
function parseHackrfInfo(stdout: string): DeviceInfo {
	const serialMatch = stdout.match(/Serial number:\s*(\S+)/);
	return { connected: true, serial: serialMatch?.[1] ?? 'unknown', info: stdout.trim() };
}

/** Probe for HackRF device via hackrf_info. */
async function detectHackrf(): Promise<DeviceInfo> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hackrf_info', [], { timeout: 2000 });
		if (stdout.includes('Serial number')) return parseHackrfInfo(stdout);
		return { connected: false, error: 'Not detected' };
	} catch {
		return { connected: false, error: 'Not detected' };
	}
}

/** Build the full status response payload. */
function buildStatusPayload(hackrfInfo: DeviceInfo) {
	const hackrf = hackrfInfo.connected;
	return {
		connectedDevices: { hackrf },
		deviceInfo: { hackrf: hackrfInfo },
		activeDevice: hackrf ? 'hackrf' : 'none',
		device: hackrf ? 'hackrf' : 'none',
		...sweepManager.getStatus(),
		bufferStats: null,
		bufferHealth: null
	};
}

export const GET: RequestHandler = async () => {
	try {
		const hackrfInfo = await detectHackrf();
		return json({ status: 'success', data: buildStatusPayload(hackrfInfo) });
	} catch (error: unknown) {
		const msg = errMsg(error);
		logger.error('Error in rf/status endpoint', { error: msg });
		return json({ status: 'error', message: msg }, { status: 500 });
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
