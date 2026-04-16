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
	DragonSyncFpvSignal,
	DragonSyncServiceStatus,
	DragonSyncStatusResult
} from '$lib/types/dragonsync';
import { logger } from '$lib/utils/logger';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const DRAGONSYNC_API = 'http://127.0.0.1:8088';
const POLL_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 5000;
const STATUS_TIMEOUT_MS = 6000;

const ZMQ_DECODER_SERVICE = 'zmq-decoder.service';
const DRAGONSYNC_SERVICE = 'dragonsync.service';
const FPV_SERVICE = 'wardragon-fpv-detect.service';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let cachedDrones: DragonSyncDrone[] = [];
let cachedFpv: DragonSyncFpvSignal[] = [];
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

function isFpvSignal(item: unknown): item is DragonSyncFpvSignal {
	if (typeof item !== 'object' || item === null) return false;
	const rec = item as Record<string, unknown>;
	return typeof rec['uid'] === 'string';
}

async function pollDronesEndpoint(): Promise<void> {
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
}

async function pollSignalsEndpoint(): Promise<void> {
	const res = await fetch(`${DRAGONSYNC_API}/signals`, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		logger.debug(`[dragonsync] /signals returned HTTP ${res.status}`);
		return;
	}
	const data: unknown = await res.json();
	const rawSignals = (data as { signals?: unknown[] }).signals ?? [];
	cachedFpv = rawSignals.filter(isFpvSignal);
}

async function pollDragonSyncApi(): Promise<void> {
	try {
		await Promise.all([pollDronesEndpoint(), pollSignalsEndpoint()]);
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
		const res = await fetch(`${DRAGONSYNC_API}/drones`, {
			signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
		});
		return res.ok;
	} catch {
		return false;
	}
}

function deriveServiceStatus(
	droneidGo: boolean,
	dragonSync: boolean,
	_apiReachable: boolean,
	fpvScanner: boolean
): DragonSyncServiceStatus {
	// apiReachable intentionally ignored in state derivation — HTTP probe races with
	// systemd on RPi5 (node event-loop lag under load). Unit state is authoritative.
	const flags = [droneidGo, dragonSync, fpvScanner];
	if (flags.every((f) => f)) return 'running';
	if (flags.every((f) => !f)) return 'stopped';
	return 'starting';
}

export async function getDragonSyncStatus(): Promise<DragonSyncStatusResult> {
	const [droneidGo, dragonSync, apiReachable, fpvScanner] = await Promise.all([
		isServiceActive(ZMQ_DECODER_SERVICE),
		isServiceActive(DRAGONSYNC_SERVICE),
		checkApiReachable(),
		isServiceActive(FPV_SERVICE)
	]);

	return {
		success: true,
		droneidGoRunning: droneidGo,
		dragonSyncRunning: dragonSync,
		fpvScannerRunning: fpvScanner,
		status: deriveServiceStatus(droneidGo, dragonSync, apiReachable, fpvScanner),
		droneCount: cachedDrones.length,
		apiReachable,
		error: lastPollError ?? undefined
	};
}

export function getDragonSyncDrones(): DragonSyncDrone[] {
	return cachedDrones;
}

export function getDragonSyncFpvSignals(): DragonSyncFpvSignal[] {
	return cachedFpv;
}

export function isDragonSyncApiReachable(): boolean {
	return lastPollError === null;
}

export function getLastPollError(): string | null {
	return lastPollError;
}

// ---------------------------------------------------------------------------
// Public API — control
// ---------------------------------------------------------------------------

export async function startDragonSync(): Promise<DragonSyncControlResult> {
	logger.info('[dragonsync] Starting zmq-decoder + dragonsync + wardragon-fpv-detect');

	const droneidOk = await startService(ZMQ_DECODER_SERVICE);
	if (!droneidOk) {
		return {
			success: false,
			message: `Failed to start ${ZMQ_DECODER_SERVICE}`,
			error: 'systemctl start failed'
		};
	}

	const dsOk = await startService(DRAGONSYNC_SERVICE);
	if (!dsOk) {
		await stopService(ZMQ_DECODER_SERVICE);
		return {
			success: false,
			message: `Failed to start ${DRAGONSYNC_SERVICE}`,
			error: 'systemctl start failed'
		};
	}

	const fpvOk = await startService(FPV_SERVICE);
	if (!fpvOk) {
		await stopService(DRAGONSYNC_SERVICE);
		await stopService(ZMQ_DECODER_SERVICE);
		return {
			success: false,
			message: `Failed to start ${FPV_SERVICE}`,
			error: 'systemctl start failed'
		};
	}

	startDragonSyncPoller();
	return { success: true, message: 'DragonSync services started' };
}

export async function stopDragonSync(): Promise<DragonSyncControlResult> {
	logger.info('[dragonsync] Stopping wardragon-fpv-detect + dragonsync + zmq-decoder');
	stopDragonSyncPoller();

	const fpvOk = await stopService(FPV_SERVICE);
	const dsOk = await stopService(DRAGONSYNC_SERVICE);
	const droneidOk = await stopService(ZMQ_DECODER_SERVICE);
	cachedDrones = [];
	cachedFpv = [];

	const failed = [
		!fpvOk && 'wardragon-fpv-detect',
		!dsOk && 'dragonsync',
		!droneidOk && 'zmq-decoder'
	].filter(Boolean);
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
