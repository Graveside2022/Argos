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

export interface TakContact {
	uid: string;
	callsign: string;
	type: string;
	lat: number;
	lon: number;
	hae: number;
	course?: number;
	speed?: number;
	lastSeen: string; // ISO8601
	team?: string;
	role?: string;
}

export interface CotMessage {
	event: {
		uid: string;
		type: string;
		time: string;
		start: string;
		stale: string;
		how: string;
		point: {
			lat: number;
			lon: number;
			hae: number;
			ce: number;
			le: number;
		};
		detail: {
			contact?: { callsign: string };
			track?: { course: number; speed: number };
			[key: string]: unknown;
		};
	};
}
