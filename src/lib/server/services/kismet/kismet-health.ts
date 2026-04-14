/**
 * Kismet health probe + restart helper.
 *
 * Answers the question "Is Kismet actually returning devices right now?" —
 * not just "Is the process alive?". Used by the SITREP automation script
 * and the /api/kismet/health + /api/kismet/restart endpoints to avoid
 * shipping a broken report when the daemon is wedged.
 *
 * The probe bypasses the Fusion controller layer and hits Kismet's native
 * HTTP API directly. This intentionally distinguishes "Fusion is confused"
 * from "Kismet daemon is dead".
 */

import { env } from '$lib/server/env';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { isKismetRunning } from './kismet-control-service';
import { startKismetExtended, stopKismetExtended } from './kismet-control-service-extended';

export interface KismetHealth {
	healthy: boolean;
	processAlive: boolean;
	apiResponding: boolean;
	devicesFetchable: boolean;
	reason: string | null;
	sampleDeviceCount: number;
}

export interface RestartResult {
	success: boolean;
	reason: string | null;
	durationMs: number;
}

const TIMESTAMP_TIMEOUT_MS = 2000;
const DEVICES_TIMEOUT_MS = 5000;

function kismetAuthHeader(): Record<string, string> {
	if (!env.KISMET_PASSWORD) return {};
	const raw = `${env.KISMET_USER ?? 'kismet'}:${env.KISMET_PASSWORD}`;
	return { Authorization: `Basic ${Buffer.from(raw).toString('base64')}` };
}

function errorToFetchReason(err: unknown, timeoutMs: number): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (msg.includes('aborted') || msg.includes('timeout')) {
		return `timeout after ${timeoutMs}ms`;
	}
	return msg;
}

async function readJsonBody(
	response: Response
): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
	if (!response.ok) {
		return { ok: false, reason: `HTTP ${response.status}` };
	}
	const body: unknown = await response.json().catch(() => null);
	if (body === null) return { ok: false, reason: 'invalid JSON body' };
	return { ok: true, body };
}

async function fetchJson(
	url: string,
	timeoutMs: number
): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: kismetAuthHeader(),
			signal: AbortSignal.timeout(timeoutMs)
		});
		return readJsonBody(response);
	} catch (err) {
		return { ok: false, reason: errorToFetchReason(err, timeoutMs) };
	}
}

function hasTimestamp(body: unknown): boolean {
	if (typeof body !== 'object' || body === null) return false;
	const obj = body as Record<string, unknown>;
	return (
		'timestamp' in obj ||
		'kismet.system.timestamp' in obj ||
		'kismet.system.timestamp.sec' in obj
	);
}

function countDevices(body: unknown): number {
	if (Array.isArray(body)) return body.length;
	return 0;
}

/**
 * Probe whether Kismet is alive, responding, and fetchable.
 *
 * Returns a structured status rather than throwing — callers decide what
 * to do with an unhealthy result.
 */
function unhealthyProcessDead(): KismetHealth {
	return {
		healthy: false,
		processAlive: false,
		apiResponding: false,
		devicesFetchable: false,
		reason: 'Kismet process not running',
		sampleDeviceCount: 0
	};
}

function unhealthyApi(timestampResult: { ok: boolean; reason?: string }): KismetHealth {
	return {
		healthy: false,
		processAlive: true,
		apiResponding: false,
		devicesFetchable: false,
		reason: timestampResult.ok
			? 'Kismet API returned unexpected body'
			: `Kismet API unresponsive: ${timestampResult.reason}`,
		sampleDeviceCount: 0
	};
}

function unhealthyDevices(reason: string): KismetHealth {
	return {
		healthy: false,
		processAlive: true,
		apiResponding: true,
		devicesFetchable: false,
		reason: `Kismet devices endpoint unresponsive: ${reason}`,
		sampleDeviceCount: 0
	};
}

export async function probeKismetHealth(): Promise<KismetHealth> {
	if (!(await isKismetRunning())) return unhealthyProcessDead();

	const timestampResult = await fetchJson(
		`${env.KISMET_API_URL}/system/timestamp.json`,
		TIMESTAMP_TIMEOUT_MS
	);
	if (!timestampResult.ok || !hasTimestamp(timestampResult.body)) {
		return unhealthyApi(timestampResult);
	}

	const devicesResult = await fetchJson(
		`${env.KISMET_API_URL}/devices/views/phydot11_accesspoints/devices.json`,
		DEVICES_TIMEOUT_MS
	);
	if (!devicesResult.ok) return unhealthyDevices(devicesResult.reason);

	return {
		healthy: true,
		processAlive: true,
		apiResponding: true,
		devicesFetchable: true,
		reason: null,
		sampleDeviceCount: countDevices(devicesResult.body)
	};
}

/**
 * Stop Kismet, wait for interface teardown, start again, verify healthy.
 * Returns structured result — never throws.
 */
function startFailureResult(
	start: number,
	startResult: { error?: string; message?: string }
): RestartResult {
	return {
		success: false,
		reason: `start failed: ${startResult.error ?? startResult.message ?? 'unknown'}`,
		durationMs: Date.now() - start
	};
}

function finalHealthResult(start: number, health: KismetHealth): RestartResult {
	return {
		success: health.healthy,
		reason: health.healthy ? null : (health.reason ?? 'unhealthy after restart'),
		durationMs: Date.now() - start
	};
}

export async function restartKismet(): Promise<RestartResult> {
	const start = Date.now();
	logger.info('[kismet-health] Restart requested');
	await safeStopKismet();
	await delay(2000);
	const startResult = await startKismetExtended();
	if (!startResult.success) return startFailureResult(start, startResult);
	const health = await probeKismetHealth();
	return finalHealthResult(start, health);
}

async function safeStopKismet(): Promise<void> {
	try {
		await stopKismetExtended();
	} catch (err) {
		logger.warn('[kismet-health] stop failed (continuing)', {
			error: err instanceof Error ? err.message : String(err)
		});
	}
}
