#!/usr/bin/env tsx
/**
 * Fort Irwin Commander SITREP — one-shot automation.
 *
 * Starts NovaSDR + Kismet, waits for collection window, pulls WiFi + Bluetooth,
 * screenshots spectrum (separate script step via Chrome DevTools MCP), creates
 * a mission + tick capture, injects live emitters, renders a PDF SITREP.
 *
 * Usage:
 *   npx tsx scripts/reports/generate-ftirwin-sitrep.ts [--duration 300]
 *     [--skip-bluetooth] [--skip-spectrum] [--skip-novasdr]
 *
 * Env:
 *   ARGOS_API_KEY (required, min 32 chars)
 *   NOVASDR_URL   (optional, defaults to http://localhost:8073)
 *   ARGOS_URL     (optional, defaults to http://localhost:5173)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	type BluetoothAdapterStatus,
	checkBluetoothAdapter,
	scanBluetooth
} from '../../src/lib/server/services/reports/bluetooth-scan';

// ---------- config ----------

interface CliArgs {
	durationSec: number;
	skipBluetooth: boolean;
	skipSpectrum: boolean;
	skipNovasdr: boolean;
}

function applyDurationFlag(args: CliArgs, raw: string | undefined): void {
	const n = parseInt(raw ?? '', 10);
	if (Number.isFinite(n) && n > 0) args.durationSec = n;
}

const FLAG_HANDLERS: Record<string, (args: CliArgs) => void> = {
	'--skip-bluetooth': (a) => {
		a.skipBluetooth = true;
	},
	'--skip-spectrum': (a) => {
		a.skipSpectrum = true;
	},
	'--skip-novasdr': (a) => {
		a.skipNovasdr = true;
	}
};

function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {
		durationSec: 300,
		skipBluetooth: false,
		skipSpectrum: false,
		skipNovasdr: false
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--duration') {
			applyDurationFlag(args, argv[++i]);
			continue;
		}
		const handler = FLAG_HANDLERS[a];
		if (handler) handler(args);
	}
	return args;
}

function isQuotedWith(val: string, q: string): boolean {
	return val.length >= 2 && val.startsWith(q) && val.endsWith(q);
}

function stripQuotes(val: string): string {
	if (isQuotedWith(val, '"') || isQuotedWith(val, "'")) return val.slice(1, -1);
	return val;
}

function parseEnvLine(line: string): [string, string] | null {
	const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
	if (!m) return null;
	return [m[1], stripQuotes(m[2])];
}

function loadEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!existsSync(path)) return out;
	for (const line of readFileSync(path, 'utf-8').split('\n')) {
		const entry = parseEnvLine(line);
		if (entry) out[entry[0]] = entry[1];
	}
	return out;
}

// ---------- Argos client ----------

interface ArgosClient {
	get: <T>(path: string) => Promise<T>;
	post: <T>(path: string, body: unknown) => Promise<T>;
}

const DEFAULT_HTTP_TIMEOUT_MS = 120_000;

async function fetchWithTimeout(
	url: string,
	init: Parameters<typeof fetch>[1],
	method: string,
	path: string
): Promise<Response> {
	try {
		return await fetch(url, { ...init, signal: AbortSignal.timeout(DEFAULT_HTTP_TIMEOUT_MS) });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('aborted') || msg.includes('timeout')) {
			throw new Error(`${method} ${path} timed out after ${DEFAULT_HTTP_TIMEOUT_MS}ms`);
		}
		throw err;
	}
}

function parseResponseJson(text: string, isOk: boolean, method: string, path: string): unknown {
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch (parseErr) {
		if (isOk) {
			throw new Error(
				`${method} ${path} → 200 but invalid JSON: ${(parseErr as Error).message}`
			);
		}
		return null;
	}
}

function createArgosClient(baseUrl: string, apiKey: string): ArgosClient {
	const call = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
		const res = await fetchWithTimeout(
			`${baseUrl}${path}`,
			{
				method,
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey
				},
				body: body === undefined ? undefined : JSON.stringify(body)
			},
			method,
			path
		);
		const text = await res.text();
		const json = parseResponseJson(text, res.ok, method, path);
		if (!res.ok) {
			throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
		}
		return json as T;
	};
	return {
		get: <T>(path: string) => call<T>('GET', path),
		post: <T>(path: string, body: unknown) => call<T>('POST', path, body)
	};
}

// ---------- types ----------

interface KismetDevice {
	mac: string;
	ssid?: string | null;
	channel?: number | string | null;
	frequency?: number | null;
	signal?: { last_signal?: number | null } | null;
	manufacturer?: string | null;
	type?: string | null;
}

interface DevicesResponse {
	devices: KismetDevice[];
	error: string | null;
	source: string;
}

interface EmitterRow {
	source_table: string;
	source_id: string;
	signal_type: string;
	identifier: string | null;
	fingerprint_key: string;
	freq_hz: number | null;
	power_dbm: number | null;
	modulation: string | null;
	mgrs: string | null;
	classification: string | null;
	sensor_tool: string | null;
	raw_json: string;
}

interface Mission {
	id: string;
	name: string;
	type: string;
}
interface CaptureRow {
	id: string;
	mission_id: string;
	role: string;
	start_dtg: number;
}
interface ReportRow {
	id: string;
	pdf_path: string | null;
	html_path: string;
	source_qmd_path: string;
}

// ---------- helpers ----------

function log(msg: string): void {
	const t = new Date().toISOString();
	process.stdout.write(`[${t}] ${msg}\n`);
}

function channel24GhzToHz(n: number): number | null {
	if (n < 1 || n > 14) return null;
	if (n === 14) return 2484 * 1_000_000;
	return (2407 + n * 5) * 1_000_000;
}

function channel5GhzToHz(n: number): number | null {
	return n >= 32 && n <= 177 ? (5000 + n * 5) * 1_000_000 : null;
}

function channel6GhzToHz(n: number): number | null {
	return n > 0 && n <= 233 ? (5950 + n * 5) * 1_000_000 : null;
}

function parseChannelNumber(ch: number | string): number | null {
	const n = typeof ch === 'number' ? ch : parseInt(ch, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeChannel(ch: number | string | null | undefined): number | null {
	if (ch === null || ch === undefined || ch === '') return null;
	return parseChannelNumber(ch);
}

function channelToHz(ch: number | string | null | undefined): number | null {
	const n = normalizeChannel(ch);
	if (n === null) return null;
	return channel24GhzToHz(n) ?? channel5GhzToHz(n) ?? channel6GhzToHz(n);
}

function kismetFreqHz(d: KismetDevice): number | null {
	if (d.frequency && d.frequency > 0) return d.frequency;
	return channelToHz(d.channel);
}

function kismetPowerDbm(d: KismetDevice): number | null {
	const s = d.signal?.last_signal;
	return typeof s === 'number' ? s : null;
}

function kismetIdentifier(d: KismetDevice): string {
	return d.ssid && d.ssid.length > 0 ? d.ssid : d.mac;
}

function kismetToEmitter(d: KismetDevice): EmitterRow {
	return {
		source_table: 'kismet_devices',
		source_id: d.mac,
		signal_type: 'wifi',
		identifier: kismetIdentifier(d),
		fingerprint_key: d.mac,
		freq_hz: kismetFreqHz(d),
		power_dbm: kismetPowerDbm(d),
		modulation: null,
		mgrs: null,
		classification: 'unknown',
		sensor_tool: 'kismet-wifi',
		raw_json: JSON.stringify(d)
	};
}

interface BtDevice {
	mac: string;
	name: string | null;
	rssi_dbm: number | null;
}

function btToEmitter(b: BtDevice): EmitterRow {
	return {
		source_table: 'bluetooth_scan',
		source_id: b.mac,
		signal_type: 'bluetooth',
		identifier: b.name ?? b.mac,
		fingerprint_key: b.mac,
		freq_hz: 2_440_000_000,
		power_dbm: b.rssi_dbm,
		modulation: null,
		mgrs: null,
		classification: 'unknown',
		sensor_tool: 'bluetoothctl',
		raw_json: JSON.stringify(b)
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// ---------- pipeline steps ----------

async function startNovasdr(client: ArgosClient, skip: boolean): Promise<void> {
	if (skip) {
		log('NovaSDR: skipped by flag');
		return;
	}
	try {
		await client.post('/api/novasdr/control', { action: 'start' });
		log('NovaSDR: start requested');
	} catch (err) {
		log(`NovaSDR: start failed (continuing) — ${(err as Error).message}`);
	}
}

async function startKismet(client: ArgosClient): Promise<void> {
	try {
		await client.post('/api/kismet/start', {});
		log('Kismet: start requested');
	} catch (err) {
		log(`Kismet: start failed — ${(err as Error).message}`);
		throw err;
	}
}

interface KismetHealthResp {
	healthy: boolean;
	processAlive: boolean;
	apiResponding: boolean;
	devicesFetchable: boolean;
	reason: string | null;
	sampleDeviceCount: number;
}

interface KismetRestartResp {
	success: boolean;
	reason: string | null;
	durationMs: number;
}

function tryParseTrailingJson<T>(msg: string): T | null {
	const match = msg.match(/\{.*\}$/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as T;
	} catch {
		return null;
	}
}

function buildProbeErrorFallback(msg: string): KismetHealthResp {
	return {
		healthy: false,
		processAlive: false,
		apiResponding: false,
		devicesFetchable: false,
		reason: `probe error: ${msg}`,
		sampleDeviceCount: 0
	};
}

async function probeHealthOnce(client: ArgosClient): Promise<KismetHealthResp> {
	try {
		return await client.get<KismetHealthResp>('/api/kismet/health');
	} catch (err) {
		const msg = (err as Error).message;
		return tryParseTrailingJson<KismetHealthResp>(msg) ?? buildProbeErrorFallback(msg);
	}
}

async function probeUntilHealthyOrExhausted(
	client: ArgosClient
): Promise<{ healthy: boolean; lastReason: string | null; sampleDeviceCount: number }> {
	let lastReason: string | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		const health = await probeHealthOnce(client);
		if (health.healthy) {
			return { healthy: true, lastReason: null, sampleDeviceCount: health.sampleDeviceCount };
		}
		lastReason = health.reason;
		log(`Kismet probe ${attempt + 1}/3 unhealthy — ${health.reason ?? 'unknown'}`);
		if (attempt < 2) await sleep(3000);
	}
	return { healthy: false, lastReason, sampleDeviceCount: 0 };
}

async function callRestartEndpoint(client: ArgosClient): Promise<KismetRestartResp> {
	try {
		return await client.post<KismetRestartResp>('/api/kismet/restart', {});
	} catch (err) {
		const msg = (err as Error).message;
		return (
			tryParseTrailingJson<KismetRestartResp>(msg) ?? {
				success: false,
				reason: msg,
				durationMs: 0
			}
		);
	}
}

async function runKismetRecovery(client: ArgosClient, initialReason: string | null): Promise<void> {
	log(`Kismet unhealthy after 3 probes (${initialReason ?? 'unknown'}) — attempting restart`);
	const restart = await callRestartEndpoint(client);
	log(
		`Kismet restart result: success=${restart.success} reason=${restart.reason ?? 'none'} durationMs=${restart.durationMs}`
	);
	const final = await probeHealthOnce(client);
	if (!final.healthy) {
		throw new Error(
			`Kismet could not be recovered after restart: ${final.reason ?? 'unknown'}. Aborting SITREP.`
		);
	}
	log(`Kismet healthy after restart: ${final.sampleDeviceCount} preview devices`);
}

async function ensureKismetHealthy(client: ArgosClient): Promise<void> {
	const initial = await probeUntilHealthyOrExhausted(client);
	if (initial.healthy) {
		log(`Kismet healthy: ${initial.sampleDeviceCount} preview devices`);
		return;
	}
	await runKismetRecovery(client, initial.lastReason);
}

async function createMissionAndCapture(
	client: ArgosClient,
	args: CliArgs
): Promise<{ mission: Mission; capture: CaptureRow }> {
	const missionRes = await client.post<{ success: boolean; mission: Mission }>('/api/missions', {
		name: `Fort Irwin Site Survey ${new Date().toISOString().slice(0, 16)}`,
		type: 'sitrep-loop',
		unit: 'Argos EW',
		ao_mgrs: null,
		set_active: true
	});
	log(`Mission created: ${missionRes.mission.id}`);

	const sensors: Array<{ tool: string; interface?: string; gain?: number }> = [
		{ tool: 'kismet-wifi', interface: 'wlan1' }
	];
	if (!args.skipBluetooth) sensors.push({ tool: 'bluetoothctl', interface: 'hci0' });
	if (!args.skipSpectrum) sensors.push({ tool: 'hackrf-novasdr', interface: 'usb', gain: 30 });

	const captureRes = await client.post<{ success: boolean; capture: CaptureRow }>(
		'/api/captures/start',
		{
			mission_id: missionRes.mission.id,
			role: 'tick',
			loadout: { sensors }
		}
	);
	log(`Capture created: ${captureRes.capture.id}`);
	return { mission: missionRes.mission, capture: captureRes.capture };
}

function isWifiTimeout(res: DevicesResponse | undefined): boolean {
	if (!res) return false;
	if (res.source === 'timeout') return true;
	return !!(res.error && res.error.includes('timed out'));
}

async function collectWifiAfterRecovery(client: ArgosClient): Promise<EmitterRow[]> {
	try {
		await ensureKismetHealthy(client);
		const retry = await client.get<DevicesResponse>('/api/kismet/devices');
		const devs = Array.isArray(retry?.devices) ? retry.devices : [];
		log(`WiFi: ${devs.length} Kismet devices pulled after recovery`);
		return devs.map(kismetToEmitter);
	} catch (err) {
		log(`WiFi: recovery failed — ${(err as Error).message}`);
		return [];
	}
}

function normalizeWifiResponse(res: DevicesResponse | undefined): EmitterRow[] {
	const devices = Array.isArray(res?.devices) ? res.devices : [];
	log(`WiFi: ${devices.length} Kismet devices pulled`);
	return devices.map(kismetToEmitter);
}

async function collectWifi(client: ArgosClient): Promise<EmitterRow[]> {
	try {
		const res = await client.get<DevicesResponse>('/api/kismet/devices');
		if (isWifiTimeout(res)) {
			log(
				`WiFi: devices endpoint timed out (${res.error ?? 'no detail'}) — attempting recovery`
			);
			return collectWifiAfterRecovery(client);
		}
		return normalizeWifiResponse(res);
	} catch (err) {
		log(`WiFi: pull failed — ${(err as Error).message}`);
		return [];
	}
}

interface BluetoothCollection {
	emitters: EmitterRow[];
	status: BluetoothAdapterStatus;
}

async function collectBluetooth(durationMs: number): Promise<BluetoothCollection> {
	let status: BluetoothAdapterStatus;
	try {
		status = await checkBluetoothAdapter();
	} catch (err) {
		log(`Bluetooth: adapter probe failed — ${(err as Error).message}`);
		return {
			emitters: [],
			status: {
				available: false,
				powered: false,
				address: null,
				reason: 'adapter probe failed'
			}
		};
	}
	if (!status.available) {
		log(`Bluetooth: adapter unavailable — ${status.reason ?? 'unknown'} (skipping scan)`);
		return { emitters: [], status };
	}
	try {
		const devs = await scanBluetooth(durationMs);
		log(`Bluetooth: ${devs.length} devices discovered`);
		return { emitters: devs.map((d) => btToEmitter(d)), status };
	} catch (err) {
		log(`Bluetooth: scan failed (continuing) — ${(err as Error).message}`);
		return { emitters: [], status };
	}
}

function writeSpectrumPlaceholder(projectDir: string, reportId: string, reason: string): string {
	const outDir = join(projectDir, 'data', 'reports', `staging-${reportId}`);
	if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
	const p = join(outDir, 'spectrum-placeholder.txt');
	writeFileSync(p, `Spectrum capture skipped: ${reason}\n`, 'utf-8');
	return p;
}

async function addEmittersToCapture(
	client: ArgosClient,
	captureId: string,
	emitters: EmitterRow[]
): Promise<void> {
	if (emitters.length === 0) {
		log('Emitters: none to insert');
		return;
	}
	await client.post('/api/captures/add-emitters', { capture_id: captureId, emitters });
	log(`Emitters: ${emitters.length} inserted into capture ${captureId}`);
}

interface NarrativeInputs {
	wifiCount: number;
	btCount: number;
	btStatus: BluetoothAdapterStatus;
	spectrumCaptured: boolean;
}

function buildNarrative(n: NarrativeInputs): string {
	const parts: string[] = [];
	parts.push(`Automated site survey — Fort Irwin.`);
	parts.push(`WiFi: ${n.wifiCount} emitters observed via Kismet.`);
	if (n.btCount > 0) {
		parts.push(`Bluetooth: ${n.btCount} devices observed via bluetoothctl.`);
	} else {
		parts.push(`Bluetooth: unavailable — ${n.btStatus.reason ?? 'no devices observed'}.`);
	}
	parts.push(
		n.spectrumCaptured
			? `Spectrum snapshot captured from NovaSDR waterfall.`
			: `Spectrum snapshot unavailable.`
	);
	return parts.join(' ');
}

async function generateReport(
	client: ArgosClient,
	missionId: string,
	periodStart: number,
	periodEnd: number,
	spectrumImagePath: string | null,
	narrative: string
): Promise<ReportRow> {
	const body: Record<string, unknown> = {
		mission_id: missionId,
		period_start: periodStart,
		period_end: periodEnd,
		narrative
	};
	if (spectrumImagePath) {
		body.spectrum_image_path = spectrumImagePath;
		body.spectrum_caption = 'NovaSDR waterfall — Fort Irwin site survey';
	}
	const res = await client.post<{ success: boolean; report: ReportRow }>(
		'/api/reports/generate-sitrep',
		body
	);
	return res.report;
}

// ---------- main ----------

interface RuntimeConfig {
	args: CliArgs;
	projectDir: string;
	apiKey: string;
	argosUrl: string;
	novasdrUrl: string;
}

function pickEnv(envFile: Record<string, string>, key: string, fallback: string): string {
	return process.env[key] ?? envFile[key] ?? fallback;
}

function loadRuntimeConfig(): RuntimeConfig | null {
	const args = parseArgs(process.argv.slice(2));
	const projectDir = process.cwd();
	const envFile = loadEnvFile(join(projectDir, '.env'));
	const apiKey = pickEnv(envFile, 'ARGOS_API_KEY', '');
	if (apiKey.length < 32) {
		log('ERROR: ARGOS_API_KEY missing or < 32 chars');
		return null;
	}
	return {
		args,
		projectDir,
		apiKey,
		argosUrl: pickEnv(envFile, 'ARGOS_URL', 'http://localhost:5173'),
		novasdrUrl: pickEnv(envFile, 'NOVASDR_URL', 'http://localhost:8073')
	};
}

function logStartupBanner(cfg: RuntimeConfig): void {
	log(`Argos: ${cfg.argosUrl}`);
	log(`NovaSDR: ${cfg.novasdrUrl}`);
	log(
		`Duration: ${cfg.args.durationSec}s | BT: ${cfg.args.skipBluetooth ? 'skip' : 'on'} | Spectrum: ${cfg.args.skipSpectrum ? 'skip' : 'on'}`
	);
}

async function runPreflight(client: ArgosClient): Promise<boolean> {
	try {
		await client.get<unknown>('/api/health');
		return true;
	} catch (err) {
		log(`Preflight failed: ${(err as Error).message}`);
		return false;
	}
}

async function collectAll(
	client: ArgosClient,
	args: CliArgs
): Promise<{ wifi: EmitterRow[]; btCollection: BluetoothCollection }> {
	const btMs = args.skipBluetooth ? 0 : Math.min(30_000, args.durationSec * 1000);
	const skippedBtStatus: BluetoothAdapterStatus = {
		available: false,
		powered: false,
		address: null,
		reason: 'skipped by --skip-bluetooth'
	};
	const [wifi, btCollection] = await Promise.all([
		collectWifi(client),
		args.skipBluetooth
			? Promise.resolve<BluetoothCollection>({ emitters: [], status: skippedBtStatus })
			: collectBluetooth(btMs)
	]);
	return { wifi, btCollection };
}

function resolveSpectrumPath(
	projectDir: string,
	captureId: string,
	skipSpectrum: boolean
): string | null {
	const conventionPath = join(
		projectDir,
		'data',
		'reports',
		'_pending',
		`spectrum-${captureId}.png`
	);
	const envOverride = process.env.SPECTRUM_IMAGE_PATH;
	const candidate = envOverride && envOverride.length > 0 ? envOverride : conventionPath;
	if (existsSync(candidate)) {
		log(`Spectrum: using ${candidate}`);
		return candidate;
	}
	if (!skipSpectrum) {
		log(
			`Spectrum: no image found at ${candidate} — report will render without spectrum section`
		);
	}
	return null;
}

function logReportLocations(report: ReportRow): void {
	log('='.repeat(60));
	log(`REPORT ID:   ${report.id}`);
	log(`QMD SOURCE:  ${report.source_qmd_path}`);
	log(`HTML:        ${report.html_path}`);
	log(`PDF:         ${report.pdf_path ?? '(not rendered)'}`);
	log('='.repeat(60));
}

function advertiseSpectrumTarget(projectDir: string, captureId: string, novasdrUrl: string): void {
	const pendingDir = join(projectDir, 'data', 'reports', '_pending');
	if (!existsSync(pendingDir)) mkdirSync(pendingDir, { recursive: true });
	log(`SPECTRUM_TARGET_PATH: ${join(pendingDir, `spectrum-${captureId}.png`)}`);
	log(`SPECTRUM_TARGET_URL:  ${novasdrUrl}`);
}

async function startAllServices(client: ArgosClient, cfg: RuntimeConfig): Promise<void> {
	await startNovasdr(client, cfg.args.skipSpectrum || cfg.args.skipNovasdr);
	await startKismet(client);
	await ensureKismetHealthy(client);
}

interface CollectionResult {
	wifiEmitters: EmitterRow[];
	btEmitters: EmitterRow[];
	btStatus: BluetoothAdapterStatus;
}

async function runCollection(
	client: ArgosClient,
	cfg: RuntimeConfig,
	captureId: string
): Promise<CollectionResult> {
	log(`Collecting for ${cfg.args.durationSec}s...`);
	await sleep(cfg.args.durationSec * 1000);

	const { wifi, btCollection } = await collectAll(client, cfg.args);
	const allEmitters = [...wifi, ...btCollection.emitters];
	log(
		`Total emitters: ${allEmitters.length} (wifi=${wifi.length}, bt=${btCollection.emitters.length})`
	);
	await addEmittersToCapture(client, captureId, allEmitters);

	return {
		wifiEmitters: wifi,
		btEmitters: btCollection.emitters,
		btStatus: btCollection.status
	};
}

async function buildAndRenderReport(
	client: ArgosClient,
	cfg: RuntimeConfig,
	missionId: string,
	captureId: string,
	periodStart: number,
	periodEnd: number,
	collection: CollectionResult
): Promise<ReportRow> {
	const spectrumImagePath = resolveSpectrumPath(cfg.projectDir, captureId, cfg.args.skipSpectrum);
	const narrative = buildNarrative({
		wifiCount: collection.wifiEmitters.length,
		btCount: collection.btEmitters.length,
		btStatus: collection.btStatus,
		spectrumCaptured: spectrumImagePath !== null
	});
	const report = await generateReport(
		client,
		missionId,
		periodStart,
		periodEnd,
		spectrumImagePath,
		narrative
	);
	logReportLocations(report);
	if (!spectrumImagePath) {
		writeSpectrumPlaceholder(cfg.projectDir, report.id, 'pending MCP screenshot step');
	}
	return report;
}

async function main(): Promise<number> {
	const cfg = loadRuntimeConfig();
	if (!cfg) return 1;
	logStartupBanner(cfg);

	const client = createArgosClient(cfg.argosUrl, cfg.apiKey);
	if (!(await runPreflight(client))) return 1;

	const periodStart = Date.now();
	await startAllServices(client, cfg);
	const { mission, capture } = await createMissionAndCapture(client, cfg.args);
	advertiseSpectrumTarget(cfg.projectDir, capture.id, cfg.novasdrUrl);

	const collection = await runCollection(client, cfg, capture.id);
	const periodEnd = Date.now();

	await buildAndRenderReport(
		client,
		cfg,
		mission.id,
		capture.id,
		periodStart,
		periodEnd,
		collection
	);
	return 0;
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		log(`FATAL: ${(err as Error).stack ?? (err as Error).message}`);
		process.exit(1);
	});
