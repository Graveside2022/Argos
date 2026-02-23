export interface TakServerConfig {
	id: string;
	name: string;
	hostname: string;
	port: number;
	protocol: 'tls';
	certPath?: string;
	keyPath?: string;
	caPath?: string;
	shouldConnectOnStartup: boolean;
	authMethod?: 'enroll' | 'import';
	truststorePath?: string;
	truststorePass: string;
	certPass: string;
	enrollmentUser?: string;
	enrollmentPass?: string;
	enrollmentPort: number;
}

export interface TakStatus {
	status: 'connected' | 'disconnected' | 'error';
	serverName?: string;
	serverHost?: string;
	uptime?: number;
	messageCount?: number;
	lastError?: string;
}
