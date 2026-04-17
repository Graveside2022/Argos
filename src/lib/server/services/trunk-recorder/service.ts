import { json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { writePresetFiles } from './config-builder';
import { getPreset } from './preset-repository';
import type { Preset, TrunkRecorderStatus } from './types';

/**
 * Lifecycle manager for the trunk-recorder + rdio-scanner Docker pair.
 *
 * - trunk-recorder: ephemeral — started with a preset's config, stopped when
 *   the operator switches presets or clicks Stop. Takes EXCLUSIVE HackRF lock
 *   via ResourceManager (trunk-recorder is not a WebRX-peer — it refuses to
 *   start if any other tool holds the HackRF and does not auto-recover).
 * - rdio-scanner: persistent — started once and left running so archived
 *   calls remain replayable after trunk-recorder stops.
 */

const TRUNK_RECORDER_CONTAINER = 'trunk-recorder';
const RDIO_SCANNER_CONTAINER = 'rdio-scanner';
const TOOL_NAME = 'trunk-recorder';
const START_WARMUP_MS = 3_000;

interface RuntimeState {
	activePresetId: string | null;
	startedAt: number | null;
	status: TrunkRecorderStatus['status'];
}

const state: RuntimeState = {
	activePresetId: null,
	startedAt: null,
	status: 'stopped'
};

async function isContainerRunning(name: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('docker', [
			'ps',
			'--filter',
			`name=${name}`,
			'--format',
			'{{.State}}'
		]);
		return stdout.trim() === 'running';
	} catch {
		return false;
	}
}

async function ensureRdioScannerRunning(): Promise<boolean> {
	if (await isContainerRunning(RDIO_SCANNER_CONTAINER)) return true;
	try {
		await execFileAsync('docker', ['start', RDIO_SCANNER_CONTAINER]);
		await delay(1500);
		return await isContainerRunning(RDIO_SCANNER_CONTAINER);
	} catch (err) {
		logger.error('[trunk-recorder] Failed to start rdio-scanner', { err: String(err) });
		return false;
	}
}

export async function getStatus(): Promise<TrunkRecorderStatus> {
	const running = await isContainerRunning(TRUNK_RECORDER_CONTAINER);
	const rdioRunning = await isContainerRunning(RDIO_SCANNER_CONTAINER);
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	return {
		running,
		status: running ? 'running' : state.status,
		presetId: state.activePresetId,
		owner: owner ?? null,
		startedAt: state.startedAt,
		rdioScannerRunning: rdioRunning
	};
}

interface StartResult {
	success: boolean;
	message: string;
	owner?: string;
	rdioUrl?: string;
}

async function materializeAndStart(preset: Preset): Promise<StartResult> {
	writePresetFiles(preset);
	await execFileAsync('docker', ['start', TRUNK_RECORDER_CONTAINER]);
	await delay(START_WARMUP_MS);
	const running = await isContainerRunning(TRUNK_RECORDER_CONTAINER);
	if (!running) {
		await resourceManager.release(TOOL_NAME, HardwareDevice.HACKRF);
		state.status = 'stopped';
		return { success: false, message: 'trunk-recorder container failed to start' };
	}
	state.activePresetId = preset.id;
	state.startedAt = Date.now();
	state.status = 'running';
	return {
		success: true,
		message: `trunk-recorder started with preset ${preset.name}`,
		rdioUrl: env.RDIO_SCANNER_URL
	};
}

/** Guard start preconditions: not already running, and preset exists. */
function resolveStartPreset(presetId: string): { preset: Preset } | { error: StartResult } {
	if (state.status === 'running' || state.status === 'starting') {
		return {
			error: { success: false, message: 'trunk-recorder is already running or transitioning' }
		};
	}
	const preset = getPreset(getRFDatabase().rawDb, presetId);
	if (!preset) return { error: { success: false, message: `Preset ${presetId} not found` } };
	return { preset };
}

async function claimHackRf(): Promise<StartResult | null> {
	const claim = await resourceManager.acquire(TOOL_NAME, HardwareDevice.HACKRF);
	if (claim.success) return null;
	state.status = 'stopped';
	return {
		success: false,
		message: `HackRF is in use by ${claim.owner ?? 'unknown'}. Stop it first.`,
		owner: claim.owner ?? undefined
	};
}

export async function start(presetId: string): Promise<StartResult> {
	const resolved = resolveStartPreset(presetId);
	if ('error' in resolved) return resolved.error;

	const { preset } = resolved;
	state.status = 'starting';
	logger.info('[trunk-recorder] Starting', { presetId: preset.id, name: preset.name });

	const claimFailure = await claimHackRf();
	if (claimFailure) return claimFailure;

	await ensureRdioScannerRunning();

	try {
		return await materializeAndStart(preset);
	} catch (err) {
		logger.error('[trunk-recorder] Start failed', { err: String(err) });
		await resourceManager.release(TOOL_NAME, HardwareDevice.HACKRF);
		state.status = 'stopped';
		return { success: false, message: `Failed to start: ${String(err)}` };
	}
}

export async function stop(): Promise<{ success: boolean; message: string }> {
	state.status = 'stopping';
	try {
		await execFileAsync('docker', ['stop', TRUNK_RECORDER_CONTAINER]);
	} catch (err) {
		logger.warn('[trunk-recorder] Stop reported error (may already be stopped)', {
			err: String(err)
		});
	}
	await resourceManager.release(TOOL_NAME, HardwareDevice.HACKRF);
	await resourceManager.refreshNow(HardwareDevice.HACKRF);
	state.activePresetId = null;
	state.startedAt = null;
	state.status = 'stopped';
	return { success: true, message: 'trunk-recorder stopped; rdio-scanner left running' };
}

export async function restart(presetId: string): Promise<StartResult> {
	await stop();
	return start(presetId);
}

/** Build a SvelteKit-compatible JSON Response reflecting a StartResult. */
export function startResultToResponse(result: StartResult): Response {
	const status = result.success ? 200 : result.owner ? 409 : 500;
	return json(result, { status });
}
