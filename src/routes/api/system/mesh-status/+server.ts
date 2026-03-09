import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { TakService } from '$lib/server/tak/tak-service';
import type { TailscalePeer, TakServer } from '$lib/types/network';
import { logger } from '$lib/utils/logger';

interface TailscaleStatus {
	Peer?: Record<string, TailscalePeerRaw>;
}

interface TailscalePeerRaw {
	HostName: string;
	TailscaleIPs?: string[];
	Online: boolean;
	LastSeen: string;
	OS: string;
	Tags?: string[];
	ExitNodeOption?: boolean;
}

/** True if the peer is a Mullvad/third-party exit relay, not a team device. */
function isExitRelay(p: TailscalePeerRaw): boolean {
	if (p.Tags?.some((t) => t.includes('mullvad-exit-node'))) return true;
	return !!p.ExitNodeOption && !p.OS;
}

/** Parse Tailscale JSON status into typed peer list, excluding exit relays. */
function parseTailscalePeers(raw: TailscaleStatus): TailscalePeer[] {
	const peerMap = raw.Peer ?? {};
	return Object.values(peerMap)
		.filter((p) => !isExitRelay(p))
		.map((p) => ({
			name: p.HostName,
			ipv4: p.TailscaleIPs?.[0] ?? '',
			online: p.Online,
			lastSeen: p.LastSeen,
			os: p.OS
		}));
}

/** Fetch Tailscale peers via CLI. */
async function fetchTailscalePeers(): Promise<TailscalePeer[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/tailscale', ['status', '--json'], {
			timeout: 10000
		});
		const parsed = JSON.parse(stdout) as TailscaleStatus;
		return parseTailscalePeers(parsed);
	} catch (error: unknown) {
		logger.warn('[mesh-status] Tailscale status failed', { error: errMsg(error) });
		return [];
	}
}

/** Build TAK server entry from TakService status. */
function buildTakServer(): TakServer[] {
	try {
		const status = TakService.getInstance().getStatus();
		if (!status.serverHost) return [];
		const port = status.serverHost.includes(':') ? status.serverHost.split(':')[1] : '8089';
		return [
			{
				name: status.serverName ?? 'TAK PRIMARY',
				host: status.serverHost,
				port,
				connected: status.status === 'connected',
				uptime: status.uptime,
				messageCount: status.messageCount,
				connectionHealth: status.connectionHealth,
				tls: true
			}
		];
	} catch {
		return [];
	}
}

/** Get local hostname. */
async function fetchHostname(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hostname', [], { timeout: 3000 });
		return stdout.trim();
	} catch {
		return 'unknown';
	}
}

export const GET = createHandler(async () => {
	const [peers, selfHostname] = await Promise.all([fetchTailscalePeers(), fetchHostname()]);
	const takServers = buildTakServer();

	return { takServers, peers, selfHostname };
});
