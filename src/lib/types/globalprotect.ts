/** GlobalProtect VPN configuration stored in SQLite. */
export interface GlobalProtectConfig {
	id: string;
	portal: string;
	username: string;
	connectOnStartup: boolean;
}

/** Real-time status from the openconnect process. */
export interface GlobalProtectStatus {
	status: 'connected' | 'disconnected' | 'connecting' | 'error';
	portal?: string;
	gateway?: string;
	assignedIp?: string;
	uptime?: string;
	lastError?: string;
}
