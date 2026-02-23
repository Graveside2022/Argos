import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { fusionKismetController } from '$lib/server/kismet/fusion-controller';
import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const INACTIVE_DATA = {
	isRunning: false,
	interface: null,
	channels: [],
	deviceCount: 0,
	uptime: 0,
	startTime: null,
	monitorInterfaces: [],
	metrics: {}
};

const MOCK_DATA = { ...INACTIVE_DATA, interface: 'wlan0', channels: [1, 6, 11] };

/** Read a numeric field from Kismet system status, defaulting to 0. */
function ssNum(ss: Record<string, unknown>, key: string): number {
	return (ss[key] as number) || 0;
}

/** Read a string field from Kismet system status. */
function ssStr(ss: Record<string, unknown>, key: string, fallback: string): string {
	return (ss[key] as string) || fallback;
}

/** Build the data payload for a running Kismet proxy. */
function buildProxyData(ss: Record<string, unknown>) {
	const config = KismetProxy.getConfig();
	const startSec = ssNum(ss, 'kismet.system.timestamp.start_sec');
	const nowSec = ssNum(ss, 'kismet.system.timestamp.sec');
	return {
		isRunning: true,
		host: config.host,
		port: config.port,
		version: ssStr(ss, 'kismet.system.version', 'unknown'),
		deviceCount: ssNum(ss, 'kismet.system.devices.count'),
		uptime: nowSec - startSec,
		startTime: startSec ? new Date(startSec * 1000).toISOString() : null,
		memoryKB: ssNum(ss, 'kismet.system.memory.rss'),
		monitorInterfaces: [],
		metrics: {
			sensors: ss['kismet.system.sensors.temp'] || {},
			fan: ss['kismet.system.sensors.fan'] || {}
		}
	};
}

/** Parse Kismet proxy system status into response format. */
function buildProxyResponse(ss: Record<string, unknown>) {
	return { success: true, isRunning: true, status: 'running', data: buildProxyData(ss) };
}

/** Try Kismet proxy API. Returns response or null. */
async function tryKismetProxy(): Promise<Record<string, unknown> | null> {
	try {
		const ss = (await KismetProxy.getSystemStatus()) as Record<string, unknown>;
		return buildProxyResponse(ss);
	} catch {
		return null;
	}
}

/** Try fusion controller. Returns response or null. */
async function tryFusionController(): Promise<Record<string, unknown> | null> {
	if (!fusionKismetController.isReady()) return null;
	const status = await fusionKismetController.getStatus();
	return {
		success: true,
		isRunning: status.isRunning,
		status: status.isRunning ? 'running' : 'stopped',
		data: status
	};
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		if (url.searchParams.get('mock') === 'true') {
			return json({ success: true, isRunning: false, status: 'inactive', data: MOCK_DATA });
		}

		const proxyResult = await tryKismetProxy();
		if (proxyResult) return json(proxyResult);

		const fusionResult = await tryFusionController();
		if (fusionResult) return json(fusionResult);

		return json({ success: true, isRunning: false, status: 'inactive', data: INACTIVE_DATA });
	} catch (error) {
		logger.error('Error getting Kismet status', { error: errMsg(error) });
		return json({
			success: false,
			status: 'error',
			error: errMsg(error),
			data: { isRunning: false, interface: null, channels: [], deviceCount: 0, uptime: 0 }
		});
	}
};
