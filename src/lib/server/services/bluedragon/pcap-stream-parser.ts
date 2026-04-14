import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { logger } from '$lib/utils/logger';

import { hexToBytes } from './decoders';
import type { FrameObservation } from './device-aggregator';

export interface PcapParserOptions {
	pcapPath: string;
	tsharkBin?: string;
	onFrame: (frame: FrameObservation) => void;
	onError?: (err: Error) => void;
	onExit?: (code: number | null) => void;
}

interface RawEkLayers {
	frame?: Record<string, unknown>;
	btle?: Record<string, unknown>;
	btle_rf?: Record<string, unknown>;
	btbredr_rf?: Record<string, unknown>;
	[key: string]: Record<string, unknown> | undefined;
}

interface RawEkPacket {
	timestamp?: string;
	layers?: RawEkLayers;
}

const TSHARK_DEFAULT = '/usr/bin/tshark';

export class PcapStreamParser {
	private process: ChildProcess | null = null;
	private opts: PcapParserOptions;
	private stopped = false;

	constructor(opts: PcapParserOptions) {
		this.opts = opts;
	}

	start(): void {
		const tshark = this.opts.tsharkBin ?? TSHARK_DEFAULT;
		const args = [
			'-r',
			this.opts.pcapPath,
			'-l',
			'-n',
			'-T',
			'ek',
			'-Y',
			'btle.advertising_address or btbredr_rf'
		];

		logger.info('[bluedragon-parser] Starting tshark on FIFO', {
			tshark,
			fifo: this.opts.pcapPath
		});

		this.process = spawn(tshark, args, { stdio: ['ignore', 'pipe', 'pipe'] });

		const stdout = this.process.stdout;
		if (!stdout) {
			this.opts.onError?.(new Error('tshark stdout missing'));
			return;
		}

		const rl = createInterface({ input: stdout, crlfDelay: Infinity });
		rl.on('line', (line) => this.handleLine(line));

		this.process.stderr?.on('data', (chunk) => this.handleStderr(chunk));
		this.process.on('exit', (code) => this.opts.onExit?.(code));
		this.process.on('error', (err) => this.opts.onError?.(err));
	}

	stop(): void {
		this.stopped = true;
		if (this.process && !this.process.killed) {
			this.process.kill('SIGTERM');
		}
		this.process = null;
	}

	private handleLine(line: string): void {
		if (this.stopped || !line.startsWith('{')) return;
		const packet = parseEkLine(line);
		if (!packet) return;
		const frame = this.parsePacket(packet);
		if (frame) this.opts.onFrame(frame);
	}

	private handleStderr(chunk: Buffer): void {
		const text = chunk.toString().trim();
		if (text && !text.includes('Running as user')) {
			logger.warn('[bluedragon-parser] tshark stderr', { text: text.slice(0, 200) });
		}
	}

	private parsePacket(packet: RawEkPacket): FrameObservation | null {
		const layers = packet.layers ?? {};
		const ts = resolveTimestamp(packet, layers.frame ?? {});
		return dispatchLayer(layers, ts);
	}
}

function dispatchLayer(layers: RawEkLayers, ts: number): FrameObservation | null {
	if (layers.btbredr_rf) return parseClassicBt(layers.btbredr_rf, ts);
	if (layers.btle) return parseBleAdv(layers.btle, layers.btle_rf ?? {}, ts);
	return null;
}

function parseEkLine(line: string): RawEkPacket | null {
	const parsed = safeJsonParse(line);
	if (!parsed || typeof parsed !== 'object') return null;
	if ('index' in parsed) return null;
	const packet = parsed as RawEkPacket;
	return packet.layers ? packet : null;
}

function safeJsonParse(line: string): unknown {
	try {
		return JSON.parse(line);
	} catch {
		return null;
	}
}

function resolveTimestamp(packet: RawEkPacket, frameLayer: Record<string, unknown>): number {
	if (packet.timestamp) return Number(packet.timestamp);
	const tsEpoch = readNumber(frameLayer.frame_frame_time_epoch);
	return tsEpoch != null ? tsEpoch * 1000 : Date.now();
}

function parseClassicBt(btbredr: Record<string, unknown>, ts: number): FrameObservation | null {
	const lap = readNumber(btbredr.btbredr_rf_btbredr_rf_lower_address_part);
	if (lap == null) return null;

	const lapHex = lap.toString(16).padStart(6, '0');
	const addr = `00:${lapHex.slice(0, 2)}:${lapHex.slice(2, 4)}:${lapHex.slice(4, 6)}:00:00`;

	const signalValid = readBool(btbredr.btbredr_rf_btbredr_rf_flags_signal_power_valid);
	const rssi = signalValid
		? readNumber(btbredr.btbredr_rf_btbredr_rf_invalid_signal_power)
		: readNumber(btbredr.btbredr_rf_btbredr_rf_noise_power);

	return {
		addr,
		addrType: 'classic_lap',
		timestamp: Math.floor(ts),
		rssi: rssi ?? null,
		phyFlag: null,
		bdClassic: true,
		localName: null,
		manufacturerCompanyId: null,
		manufacturerData: null,
		serviceUuids16: [],
		fastPairServiceData: null
	};
}

function parseBleAdv(
	btle: Record<string, unknown>,
	btleRf: Record<string, unknown>,
	ts: number
): FrameObservation | null {
	const advAddr = readString(btle.btle_btle_advertising_address);
	if (!advAddr) return null;

	const phy = readNumber(btleRf.btle_rf_btle_rf_phy);
	const rssi = readNumber(btleRf.btle_rf_btle_rf_signal_dbm);
	const eir = parseEirAdEntries(btle);

	return {
		addr: advAddr,
		timestamp: Math.floor(ts),
		rssi: rssi ?? null,
		phyFlag: phy ?? null,
		bdClassic: false,
		localName: eir.localName,
		manufacturerCompanyId: eir.companyId,
		manufacturerData: eir.manufacturerData,
		serviceUuids16: eir.serviceUuids16,
		fastPairServiceData: eir.fastPairServiceData
	};
}

interface ParsedEir {
	localName: string | null;
	companyId: number | null;
	manufacturerData: Uint8Array | null;
	serviceUuids16: string[];
	fastPairServiceData: Uint8Array | null;
}

function extractManufacturerData(btle: Record<string, unknown>): Uint8Array | null {
	const dataField = btle.btcommon_btcommon_eir_ad_entry_data;
	if (dataField == null) return null;
	const dataStr = Array.isArray(dataField)
		? String(dataField.find((d) => d != null) ?? '')
		: String(dataField);
	const cleanHex = dataStr.replace(/[^0-9a-fA-F]/g, '');
	return cleanHex.length >= 2 ? hexToBytes(cleanHex) : null;
}

function extractLocalName(btle: Record<string, unknown>): string | null {
	const nameField = btle.btcommon_btcommon_eir_ad_entry_device_name;
	if (nameField == null) return null;
	return Array.isArray(nameField)
		? String(nameField.find((n) => n != null) ?? '')
		: String(nameField);
}

function extractServiceUuids(btle: Record<string, unknown>): string[] {
	const uuidField = btle.btcommon_btcommon_eir_ad_entry_uuid_16;
	if (uuidField == null) return [];
	const uuids = Array.isArray(uuidField)
		? uuidField.map((u) => String(u ?? '')).filter(Boolean)
		: [String(uuidField)];
	return uuids.map(normalizeUuid16);
}

function parseEirAdEntries(btle: Record<string, unknown>): ParsedEir {
	const companyId = readNumber(btle.btcommon_btcommon_eir_ad_entry_company_id);
	return {
		localName: extractLocalName(btle),
		companyId,
		manufacturerData: companyId != null ? extractManufacturerData(btle) : null,
		serviceUuids16: extractServiceUuids(btle),
		fastPairServiceData: null
	};
}

function normalizeUuid16(raw: string): string {
	return raw.replace(/^0x/, '').toUpperCase().padStart(4, '0');
}

function readNumber(v: unknown): number | null {
	if (v == null) return null;
	if (typeof v === 'number') return v;
	if (typeof v === 'string') {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function readStringFromArray(v: unknown[]): string | null {
	return v.length > 0 ? String(v[0] ?? '') : null;
}

function readString(v: unknown): string | null {
	if (v == null) return null;
	if (typeof v === 'string') return v;
	if (Array.isArray(v)) return readStringFromArray(v);
	return String(v);
}

function readBool(v: unknown): boolean {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'string') return v === 'true' || v === '1';
	return false;
}
