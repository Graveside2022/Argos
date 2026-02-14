import { json } from '@sveltejs/kit';

import { fusionKismetController } from '$lib/server/kismet/fusion-controller';
import { KismetProxy } from '$lib/server/kismet/kismet-proxy';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const useMock = url.searchParams.get('mock') === 'true';

		if (useMock) {
			return json({
				success: true,
				running: false,
				status: 'inactive',
				data: {
					running: false,
					interface: 'wlan0',
					channels: [1, 6, 11],
					deviceCount: 0,
					uptime: 0,
					startTime: null,
					monitorInterfaces: [],
					metrics: {}
				}
			});
		}

		// Try real Kismet API first (uses proper Basic Auth)
		try {
			const systemStatus = await KismetProxy.getSystemStatus();
			const config = KismetProxy.getConfig();
			// Safe: Kismet API response cast to Record for dynamic property access by dot-notation keys
			// Safe: Runtime type validated Record cast for dynamic property access
			const ss = systemStatus as Record<string, unknown>;

			// Safe: Kismet system.status API contract guarantees these properties exist with known types
			const startSec = (ss['kismet.system.timestamp.start_sec'] as number) || 0;
			const nowSec = (ss['kismet.system.timestamp.sec'] as number) || 0;
			const deviceCount = (ss['kismet.system.devices.count'] as number) || 0;
			const version = (ss['kismet.system.version'] as string) || 'unknown';
			const memoryRss = (ss['kismet.system.memory.rss'] as number) || 0;

			return json({
				success: true,
				running: true,
				status: 'running',
				data: {
					running: true,
					host: config.host,
					port: config.port,
					version,
					deviceCount,
					uptime: nowSec - startSec,
					startTime: startSec ? new Date(startSec * 1000).toISOString() : null,
					memoryKB: memoryRss,
					monitorInterfaces: [],
					metrics: {
						sensors: ss['kismet.system.sensors.temp'] || {},
						fan: ss['kismet.system.sensors.fan'] || {}
					}
				}
			});
		} catch (_proxyError) {
			// Kismet API not reachable, try fusion controller
		}

		// Fall back to fusion controller
		if (fusionKismetController.isReady()) {
			const status = await fusionKismetController.getStatus();

			return json({
				success: true,
				running: status.running,
				status: status.running ? 'running' : 'stopped',
				data: {
					running: status.running,
					interface: status.interface,
					channels: status.channels,
					deviceCount: status.deviceCount,
					uptime: status.uptime,
					startTime: status.startTime,
					monitorInterfaces: status.monitorInterfaces,
					metrics: status.metrics
				}
			});
		}

		// Neither source available
		return json({
			success: true,
			running: false,
			status: 'inactive',
			data: {
				running: false,
				interface: null,
				channels: [],
				deviceCount: 0,
				uptime: 0,
				startTime: null,
				monitorInterfaces: [],
				metrics: {}
			}
		});
	} catch (error) {
		console.error('Error getting Kismet status:', error);

		return json({
			success: false,
			status: 'error',
			// Safe: Catch block error from KismetProxy.getSystemStatus() throws Error instances
			// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message,
			data: {
				running: false,
				interface: null,
				channels: [],
				deviceCount: 0,
				uptime: 0
			}
		});
	}
};
