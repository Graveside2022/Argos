/** GlobalProtect VPN configuration stored in SQLite. */
export interface GlobalProtectConfig {
	id: string;
	portal: string;
	username: string;
	connectOnStartup: boolean;
	authMethod: 'password' | 'certificate';
	certificatePath?: string;
}

/** Real-time status from the GlobalProtect CLI. */
export interface GlobalProtectStatus {
	status: 'connected' | 'disconnected' | 'connecting' | 'error';
	portal?: string;
	gateway?: string;
	assignedIp?: string;
	uptime?: string;
	lastError?: string;
}
