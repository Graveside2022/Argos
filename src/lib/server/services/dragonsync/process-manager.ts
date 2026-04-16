/**
 * DragonSync + droneid-go process manager.
 *
 * Manages two EXTERNAL systemd services (zmq-decoder.service, dragonsync.service).
 * Argos does NOT spawn these processes — it starts/stops them via systemctl
 * and polls the DragonSync HTTP API for drone detections.
 *
 * @module
 */

import { execFileAsync } from '$lib/server/exec';
import type {
	DragonSyncControlResult,
	DragonSyncDrone,
	DragonSyncServiceStatus,
	DragonSyncStatusResult
} from '$lib/types/dragonsync';
import { logger } from '$lib/utils/logger';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const DRAGONSYNC_API = 'http://127.0.0.1:8088';
const POLL_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 3000;
const STATUS_TIMEOUT_MS = 2000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let cachedDrones: DragonSyncDrone[] = [];
let lastPollError: string | null = null;

// ---------------------------------------------------------------------------
// Systemd helpers
// ---------------------------------------------------------------------------

async function isServiceActive(serviceName: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('sudo', ['systemctl', 'is-active', serviceName]);
		return stdout.trim() === 'active';
	} catch {
		return false;
	}
}

async function startService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'start', serviceName]);
		return true;
	} catch {
		return false;
	}
}

async function stopService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'stop', serviceName]);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// API polling
// ---------------------------------------------------------------------------

function isDroneTrack(item: unknown): item is DragonSyncDrone {
	if (typeof item !== 'object' || item === null) return false;
	const rec = item as Record<string, unknown>;
	return rec['track_type'] === 'drone';
}

async function pollDragonSyncApi(): Promise<void> {
	try {
		const res = await fetch(`${DRAGONSYNC_API}/drones`, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!res.ok) {
			lastPollError = `HTTP ${res.status}`;
			return;
		}

		const data: unknown = await res.json();
		const rawDrones = (data as { drones?: unknown[] }).drones ?? [];
		cachedDrones = rawDrones.filter(isDroneTrack);
		lastPollError = null;
	} catch (err) {
		lastPollError = err instanceof Error ? err.message : 'poll failed';
	}
}

// ---------------------------------------------------------------------------
// Public API — status
// ---------------------------------------------------------------------------

async function checkApiReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${DRAGONSYNC_API}/status`, {
			signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
		});
		return res.ok;
	} catch {
		return false;
	}
}

const SERVICE_STATUS_MAP: Record<string, DragonSyncServiceStatus> = {
	'true-true-true': 'running',
	'true-true-false': 'starting',
	'true-false-true': 'starting',
	'true-false-false': 'starting',
	'false-true-true': 'starting',
	'false-true-false': 'starting',
	'false-false-true': 'stopped',
	'false-false-false': 'stopped'
};

function deriveServiceStatus(
	droneidGo: boolean,
	dragonSync: boolean,
	apiReachable: boolean
): DragonSyncServiceStatus {
	const key = `${droneidGo}-${dragonSync}-${apiReachable}`;
	return SERVICE_STATUS_MAP[key] ?? 'stopped';
}

export async function getDragonSyncStatus(): Promise<DragonSyncStatusResult> {
	const [droneidGo, dragonSync, apiReachable] = await Promise.all([
		isServiceActive('zmq-decoder.service'),
		isServiceActive('dragonsync.service'),
		checkApiReachable()
	]);

	return {
		success: true,
		droneidGoRunning: droneidGo,
		dragonSyncRunning: dragonSync,
		status: deriveServiceStatus(droneidGo, dragonSync, apiReachable),
		droneCount: cachedDrones.length,
		apiReachable,
		error: lastPollError ?? undefined
	};
}

export function getDragonSyncDrones(): DragonSyncDrone[] {
	return cachedDrones;
}

// ---------------------------------------------------------------------------
// Public API — control
// ---------------------------------------------------------------------------

export async function startDragonSync(): Promise<DragonSyncControlResult> {
	logger.info('[dragonsync] Starting zmq-decoder + dragonsync services');

	const droneidOk = await startService('zmq-decoder.service');
	if (!droneidOk) {
		return {
			success: false,
			message: 'Failed to start zmq-decoder.service',
			error: 'systemctl start failed'
		};
	}

	const dsOk = await startService('dragonsync.service');
	if (!dsOk) {
		await stopService('zmq-decoder.service');
		return {
			success: false,
			message: 'Failed to start dragonsync.service',
			error: 'systemctl start failed'
		};
	}

	startDragonSyncPoller();
	return { success: true, message: 'DragonSync services started' };
}

export async function stopDragonSync(): Promise<DragonSyncControlResult> {
	logger.info('[dragonsync] Stopping dragonsync + zmq-decoder services');
	stopDragonSyncPoller();

	const dsOk = await stopService('dragonsync.service');
	const droneidOk = await stopService('zmq-decoder.service');
	cachedDrones = [];

	const failed = [!dsOk && 'dragonsync', !droneidOk && 'zmq-decoder'].filter(Boolean);
	if (failed.length > 0) {
		logger.warn(`[dragonsync] Failed to stop: ${failed.join(', ')}`);
		return { success: false, message: `Failed to stop: ${failed.join(', ')}` };
	}
	return { success: true, message: 'DragonSync services stopped' };
}

// ---------------------------------------------------------------------------
// Public API — poller lifecycle
// ---------------------------------------------------------------------------

export function startDragonSyncPoller(): void {
	if (pollTimer) return;
	logger.info('[dragonsync] Starting API poller (2s interval)');
	void pollDragonSyncApi();
	pollTimer = setInterval(() => void pollDragonSyncApi(), POLL_INTERVAL_MS);
}

export function stopDragonSyncPoller(): void {
	if (!pollTimer) return;
	logger.info('[dragonsync] Stopping API poller');
	clearInterval(pollTimer);
	pollTimer = null;
}
