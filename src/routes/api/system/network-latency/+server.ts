import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { TakService } from '$lib/server/tak/tak-service';
import type { PingResult } from '$lib/types/network';
import { logger } from '$lib/utils/logger';

/** Parse the summary stats line: "rtt min/avg/max/mdev = 1.2/3.4/5.6/0.8 ms" */
function parseRttLine(stdout: string): { latencyMs: number; jitterMs: number } | null {
	const match = stdout.match(
		/rtt\s+min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/
	);
	if (!match) return null;
	return {
		latencyMs: Math.round(parseFloat(match[2])),
		jitterMs: parseFloat(parseFloat(match[4]).toFixed(1))
	};
}

/** Parse the packet loss line: "3 packets transmitted, 3 received, 0% packet loss" */
function parsePacketLoss(stdout: string): number {
	const match = stdout.match(/([\d.]+)%\s+packet\s+loss/);
	return match ? parseFloat(match[1]) : 100;
}

/** Derive status from latency and packet loss values. */
function deriveStatus(latencyMs: number | null, packetLoss: number): 'ok' | 'timeout' | 'error' {
	if (latencyMs === null || packetLoss === 100) return 'timeout';
	if (packetLoss > 0) return 'timeout';
	return 'ok';
}

/** Extract latency and jitter from RTT parse result, defaulting nulls. */
function extractRtt(rtt: { latencyMs: number; jitterMs: number } | null) {
	return { latencyMs: rtt?.latencyMs ?? null, jitterMs: rtt?.jitterMs ?? null };
}

/** Build a PingResult from parsed ping output. */
function buildPingResult(target: string, label: string, stdout: string): PingResult {
	const rtt = extractRtt(parseRttLine(stdout));
	const packetLoss = parsePacketLoss(stdout);
	return { target, label, ...rtt, packetLoss, status: deriveStatus(rtt.latencyMs, packetLoss) };
}

/** Build an error PingResult when ping fails entirely. */
function buildErrorResult(target: string, label: string): PingResult {
	return { target, label, latencyMs: null, packetLoss: 100, jitterMs: null, status: 'error' };
}

/** Ping a single host and return a structured result. */
async function pingHost(target: string, label: string): Promise<PingResult> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/ping', ['-c', '3', '-W', '3', target], {
			timeout: 15000
		});
		return buildPingResult(target, label, stdout);
	} catch (error: unknown) {
		logger.warn(`[network-latency] Ping failed for ${target}`, { error: errMsg(error) });
		return buildErrorResult(target, label);
	}
}

/** Get the TAK server hostname if connected. */
function getTakHost(): string | null {
	try {
		const status = TakService.getInstance().getStatus();
		if (status.status === 'connected' && status.serverHost) {
			return status.serverHost;
		}
	} catch {
		/* TAK service may not be initialized */
	}
	return null;
}

export const GET = createHandler(async () => {
	const targets: Array<{ target: string; label: string }> = [
		{ target: '8.8.8.8', label: 'Internet' }
	];

	const takHost = getTakHost();
	if (takHost) {
		targets.push({ target: takHost, label: 'TAK Server' });
	}

	const results = await Promise.all(targets.map(({ target, label }) => pingHost(target, label)));

	return { results, timestamp: new Date().toISOString() };
});
