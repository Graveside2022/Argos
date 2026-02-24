import type { TakServerConfig, TakStatus } from '../../types/tak';

export interface TakBroadcastState {
	config: TakServerConfig | null;
	connectedAt: number | null;
	messageCount: number;
}

/** Broadcast TAK connection status to all WebSocket clients */
export function broadcastTakStatus(
	state: TakBroadcastState,
	status: TakStatus['status'],
	lastError?: string
): void {
	import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
		WebSocketManager.getInstance().broadcast({
			type: 'tak_status',
			data: {
				status,
				serverName: state.config?.name,
				serverHost: state.config?.hostname,
				uptime: state.connectedAt
					? Math.floor((Date.now() - state.connectedAt) / 1000)
					: undefined,
				messageCount: state.messageCount,
				lastError
			},
			timestamp: new Date().toISOString()
		});
	});
}

/** Broadcast a CoT XML message to all WebSocket clients */
export function broadcastTakCot(xml: string): void {
	import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
		WebSocketManager.getInstance().broadcast({
			type: 'tak_cot',
			data: { xml },
			timestamp: new Date().toISOString()
		});
	});
}
