import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';

import { errMsg } from '$lib/server/api/error-utils';
import { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import type {
	BluedragonControlResult,
	BluedragonProfile,
	BluedragonStatusResult,
	BluetoothDevice
} from '$lib/types/bluedragon';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { DeviceAggregator } from './device-aggregator';
import { PcapStreamParser } from './pcap-stream-parser';

const BD_BIN = '/home/kali/Documents/Argos/Argos/tactical/blue-dragon/target/release/blue-dragon';
const BD_PCAP_PATH = '/tmp/bd-live.fifo';
const BD_INTERFACE = 'usrp-B205mini-329F4D0';
const PARSER_START_DELAY_MS = 1000;
const SIGINT_GRACE_MS = 2000;
const SIGKILL_GRACE_MS = 500;

interface ProfileArgs {
	gain: number;
	channels: number;
	squelch: number;
	centerMhz: number;
	antenna: string;
}

const PROFILES: Record<BluedragonProfile, ProfileArgs> = {
	clean: { gain: 40, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' },
	volume: { gain: 50, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' },
	max: { gain: 55, channels: 40, squelch: -55, centerMhz: 2426, antenna: 'TX/RX' }
};

interface RuntimeState {
	process: ChildProcess | null;
	parser: PcapStreamParser | null;
	aggregator: DeviceAggregator | null;
	pid: number | null;
	startedAt: number | null;
	profile: BluedragonProfile | null;
	status: 'stopped' | 'starting' | 'running' | 'stopping';
	parserStartTimer: ReturnType<typeof setTimeout> | null;
	frozenDevices: BluetoothDevice[];
	frozenPacketCount: number;
}

const state: RuntimeState = {
	process: null,
	parser: null,
	aggregator: null,
	pid: null,
	startedAt: null,
	profile: null,
	status: 'stopped',
	parserStartTimer: null,
	frozenDevices: [],
	frozenPacketCount: 0
};

function ensureFifo(path: string): void {
	if (existsSync(path)) unlinkSync(path);
	spawnSync('/usr/bin/mkfifo', [path]);
}

function cleanupFifo(path: string): void {
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		/* ignore */
	}
}

function buildArgs(profile: BluedragonProfile): string[] {
	const p = PROFILES[profile];
	return [
		'--live',
		'--interface',
		BD_INTERFACE,
		'-c',
		String(p.centerMhz),
		'-C',
		String(p.channels),
		'-g',
		String(p.gain),
		'--antenna',
		p.antenna,
		`--squelch=${p.squelch}`,
		'--check-crc',
		'-w',
		BD_PCAP_PATH
	];
}

function broadcastDevice(op: 'upsert' | 'remove', device: BluetoothDevice): void {
	WebSocketManager.getInstance().broadcast({
		type: 'bluetooth_device_update',
		data: { op, device: device as unknown as Record<string, unknown> },
		timestamp: new Date().toISOString()
	});
}

function broadcastStatus(): void {
	const status = getBluedragonStatusSync();
	WebSocketManager.getInstance().broadcast({
		type: 'bluetooth_status_update',
		data: status as unknown as Record<string, unknown>,
		timestamp: new Date().toISOString()
	});
}

function attachProcessListeners(proc: ChildProcess): void {
	proc.stdout?.on('data', (chunk) => {
		const text = chunk.toString().trim();
		if (text) logger.debug('[bluedragon] stdout', { text: text.slice(0, 200) });
	});

	proc.stderr?.on('data', (chunk) => {
		const text = chunk.toString().trim();
		if (text) logger.debug('[bluedragon] stderr', { text: text.slice(0, 200) });
	});

	proc.on('exit', (code, signal) => {
		logger.info('[bluedragon] Process exited', { code, signal });
		handleProcessExit();
	});

	proc.on('error', (err) => {
		logger.error('[bluedragon] Process error', { err: errMsg(err) });
		handleProcessExit();
	});
}

function scheduleParserStart(): void {
	state.parserStartTimer = setTimeout(() => {
		if (state.status === 'starting' || state.status === 'running') startParser();
	}, PARSER_START_DELAY_MS);
}

function startParser(): void {
	if (!state.aggregator) return;
	const parser = new PcapStreamParser({
		pcapPath: BD_PCAP_PATH,
		onFrame: (frame) => state.aggregator?.ingest(frame),
		onError: (err) => logger.error('[bluedragon] Parser error', { err: String(err) }),
		onExit: (code) => logger.info('[bluedragon] Parser exited', { code })
	});
	parser.start();
	state.parser = parser;
	logger.info('[bluedragon] Parser attached');
}

function initRuntimeState(proc: ChildProcess, profile: BluedragonProfile): void {
	state.process = proc;
	state.pid = proc.pid ?? null;
	state.startedAt = Date.now();
	state.profile = profile;

	const aggregator = new DeviceAggregator((op, device) => broadcastDevice(op, device));
	aggregator.start();
	state.aggregator = aggregator;

	scheduleParserStart();
	state.status = 'running';
}

function clearRuntimeState(): void {
	if (state.parserStartTimer) {
		clearTimeout(state.parserStartTimer);
		state.parserStartTimer = null;
	}
	state.parser?.stop();
	state.parser = null;
	state.aggregator?.stop();
	state.aggregator = null;
	state.process = null;
	state.pid = null;
	state.startedAt = null;
	state.profile = null;
	state.status = 'stopped';
	cleanupFifo(BD_PCAP_PATH);
}

export async function startBluedragon(
	profile: BluedragonProfile = 'volume'
): Promise<BluedragonControlResult> {
	if (state.status !== 'stopped') {
		return {
			success: false,
			message: 'Blue Dragon is already running or transitioning',
			error: `Current status: ${state.status}`
		};
	}

	state.status = 'starting';
	state.frozenDevices = [];
	state.frozenPacketCount = 0;
	broadcastStatus();
	logger.info('[bluedragon] Starting', { profile, bin: BD_BIN });

	try {
		ensureFifo(BD_PCAP_PATH);
		const proc = spawn(BD_BIN, buildArgs(profile), { stdio: ['ignore', 'pipe', 'pipe'] });
		attachProcessListeners(proc);
		initRuntimeState(proc, profile);
		broadcastStatus();
		return {
			success: true,
			message: 'Blue Dragon started',
			details: `PID ${state.pid}, profile ${profile}`
		};
	} catch (err) {
		logger.error('[bluedragon] Start failed', { err: errMsg(err) });
		clearRuntimeState();
		broadcastStatus();
		return {
			success: false,
			message: 'Failed to start Blue Dragon',
			error: errMsg(err)
		};
	}
}

async function terminateProcess(proc: ChildProcess): Promise<void> {
	if (proc.killed) return;
	proc.kill('SIGINT');
	await delay(SIGINT_GRACE_MS);
	if (!proc.killed) {
		logger.warn('[bluedragon] SIGINT did not stop, sending SIGKILL');
		proc.kill('SIGKILL');
		await delay(SIGKILL_GRACE_MS);
	}
}

function freezeDeviceSnapshot(): void {
	state.frozenDevices = state.aggregator?.getSnapshot() ?? [];
	state.frozenPacketCount = state.aggregator?.getPacketCount() ?? 0;
}

async function performStop(): Promise<void> {
	if (state.parserStartTimer) {
		clearTimeout(state.parserStartTimer);
		state.parserStartTimer = null;
	}
	state.parser?.stop();
	state.parser = null;
	freezeDeviceSnapshot();
	if (state.process) await terminateProcess(state.process);
	clearRuntimeState();
}

export async function stopBluedragon(): Promise<BluedragonControlResult> {
	if (state.status === 'stopped') {
		return { success: true, message: 'Blue Dragon already stopped' };
	}

	state.status = 'stopping';
	broadcastStatus();
	logger.info('[bluedragon] Stopping');

	try {
		await performStop();
		broadcastStatus();
		return { success: true, message: 'Blue Dragon stopped' };
	} catch (err) {
		logger.error('[bluedragon] Stop failed', { err: errMsg(err) });
		return {
			success: false,
			message: 'Failed to stop Blue Dragon cleanly',
			error: errMsg(err)
		};
	}
}

function handleProcessExit(): void {
	clearRuntimeState();
	broadcastStatus();
}

function isBluedragonActive(): boolean {
	return state.status === 'running' || state.status === 'starting';
}

function currentPacketCount(): number {
	if (isBluedragonActive()) return state.aggregator?.getPacketCount() ?? 0;
	return state.frozenPacketCount;
}

function currentDeviceCount(): number {
	if (isBluedragonActive()) return state.aggregator?.getDeviceCount() ?? 0;
	return state.frozenDevices.length;
}

export function getBluedragonStatusSync(): BluedragonStatusResult {
	return {
		success: true,
		isRunning: isBluedragonActive(),
		status: state.status,
		pid: state.pid,
		startedAt: state.startedAt,
		packetCount: currentPacketCount(),
		deviceCount: currentDeviceCount(),
		profile: state.profile
	};
}

export function getBluedragonDevices(): BluetoothDevice[] {
	if (state.aggregator) return state.aggregator.getSnapshot();
	return state.frozenDevices;
}

export function resetBluedragonDevices(): void {
	state.aggregator?.reset();
	state.frozenDevices = [];
	state.frozenPacketCount = 0;
	broadcastStatus();
}
