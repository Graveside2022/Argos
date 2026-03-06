/**
 * Kismet Recon API — runs wifi_recon module and returns enriched device data.
 *
 * Bridges the tactical wifi_recon Python module (which reads native .kismet
 * SQLite files directly) into the web UI, providing WPS, beacon fingerprints,
 * retry/error rates, client associations, GPS bounds, frequency maps, and alerts
 * that the standard Kismet REST API does not expose.
 *
 * GET /api/kismet/recon
 *   ?type=all|ap|client          (default: all)
 *   &sort=signal|last_seen|data|packets|clients  (default: signal)
 *   &showClients=true            (include associated client MACs)
 *   &alerts=true                 (include Kismet security alerts)
 *   &minSignal=-80               (minimum RSSI filter)
 *   &ssid=MyNetwork              (SSID filter)
 *   &encryption=open|wep|wpa     (encryption filter)
 *   &connectedTo=AA:BB:CC:DD:EE:FF  (show AP + its clients)
 *
 * @module
 */

import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { join } from 'path';

import { createHandler } from '$lib/server/api/create-handler';
import { logger } from '$lib/utils/logger';

const MODULE_RUNNER = join(process.cwd(), 'tactical/modules/module_runner.ts');
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 10_000_000;

interface ReconResult {
	status: string;
	module: string;
	targets?: unknown[];
	alerts?: unknown[];
	summary?: Record<string, unknown>;
	message?: string;
	timestamp?: string;
	[key: string]: unknown;
}

const VALID_TYPES = /^(all|ap|client)$/i;
const VALID_SORTS = /^(signal|last_seen|data|packets|clients)$/;
const VALID_ENC = /^(open|wep|wpa|wpa2|wpa3)$/i;
const VALID_MAC = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const VALID_INT = /^-?\d+$/;

interface ParamRule {
	key: string;
	flag: string;
	validate: (v: string) => boolean;
}

const PARAM_RULES: ParamRule[] = [
	{ key: 'type', flag: '--type', validate: (v) => VALID_TYPES.test(v) },
	{ key: 'sort', flag: '--sort', validate: (v) => VALID_SORTS.test(v) },
	{ key: 'minSignal', flag: '--min-signal', validate: (v) => VALID_INT.test(v) },
	{ key: 'ssid', flag: '--ssid', validate: (v) => v.length <= 64 },
	{ key: 'encryption', flag: '--encryption', validate: (v) => VALID_ENC.test(v) },
	{ key: 'connectedTo', flag: '--connected-to', validate: (v) => VALID_MAC.test(v) }
];

const BOOL_FLAGS: Array<{ key: string; flag: string }> = [
	{ key: 'showClients', flag: '--show-clients' },
	{ key: 'alerts', flag: '--alerts' }
];

function applyParamRule(args: string[], url: URL, rule: ParamRule): void {
	const val = url.searchParams.get(rule.key);
	if (val && rule.validate(val)) args.push(rule.flag, val);
}

function applyBoolFlag(args: string[], url: URL, bf: { key: string; flag: string }): void {
	if (url.searchParams.get(bf.key) === 'true') args.push(bf.flag);
}

function buildArgs(url: URL): string[] {
	const args = ['wifi_recon'];
	PARAM_RULES.forEach((rule) => applyParamRule(args, url, rule));
	BOOL_FLAGS.forEach((bf) => applyBoolFlag(args, url, bf));
	return args;
}

function runRecon(args: string[]): Promise<ReconResult> {
	return new Promise((resolvePromise, reject) => {
		const chunks: Buffer[] = [];
		let totalBytes = 0;
		let stdoutEnded = false;
		let exitCode: number | null = null;

		const child = spawn('npx', ['tsx', MODULE_RUNNER, ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
			cwd: process.cwd(),
			env: { ...process.env }
		});

		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error('Recon timed out after 30s'));
		}, TIMEOUT_MS);

		child.stdout.on('data', (chunk: Buffer) => {
			totalBytes += chunk.length;
			if (totalBytes <= MAX_OUTPUT_BYTES) chunks.push(chunk);
		});

		child.stderr.on('data', (chunk: Buffer) => {
			logger.debug(`[recon] ${chunk.toString().trim()}`);
		});

		function parseStdout(raw: string): ReconResult {
			const jsonStart = raw.indexOf('{');
			if (jsonStart === -1) throw new Error('wifi_recon returned no JSON object');
			return JSON.parse(raw.slice(jsonStart)) as ReconResult;
		}

		function tryResolve(): void {
			if (!stdoutEnded || exitCode === null) return;
			clearTimeout(timer);

			const stdout = Buffer.concat(chunks).toString('utf-8').trim();
			if (!stdout) {
				reject(new Error(`wifi_recon exited ${exitCode} with no output`));
				return;
			}

			try {
				resolvePromise(parseStdout(stdout));
			} catch {
				reject(new Error('wifi_recon returned non-JSON output'));
			}
		}

		child.stdout.on('end', () => {
			stdoutEnded = true;
			tryResolve();
		});

		child.on('close', (code) => {
			exitCode = code ?? 1;
			tryResolve();
		});

		child.on('error', (err) => {
			clearTimeout(timer);
			reject(new Error(`Failed to spawn wifi_recon: ${err.message}`));
		});
	});
}

function reconErrorResponse(result: ReconResult) {
	return json({ success: false, error: result.message ?? 'wifi_recon failed' }, { status: 502 });
}

function reconSuccessBody(result: ReconResult) {
	return {
		success: true,
		targets: result.targets ?? [],
		alerts: result.alerts ?? [],
		summary: result.summary ?? {},
		timestamp: result.timestamp
	};
}

function formatReconResponse(result: ReconResult) {
	return result.status === 'error' ? reconErrorResponse(result) : reconSuccessBody(result);
}

export const GET = createHandler(
	async ({ url }) => {
		const args = buildArgs(url);
		logger.info(`[recon] Running: wifi_recon ${args.slice(1).join(' ')}`);

		try {
			return formatReconResponse(await runRecon(args));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[recon] ${msg}`);
			return json({ success: false, error: msg }, { status: 502 });
		}
	},
	{ method: 'GET /api/kismet/recon' }
);
